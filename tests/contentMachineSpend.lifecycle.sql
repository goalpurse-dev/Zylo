-- Content Machine: the spend reservation (cm_reserve_spend / cm_settle_spend). Run after the migration
-- inside BEGIN/ROLLBACK; it changes the settings and writes ledger rows that the rollback removes.
-- Locally: node scripts/contentMachine/sqlCheck.mjs (runs the migration and this file in PGlite).
begin;
do $$
declare r jsonb; id1 uuid; n integer;
begin
  -- Fresh state: the seeded settings, and paid calls mocked until the owner says otherwise.
  assert (select dry_run and not kill_switch and daily_budget_usd = 8 and monthly_budget_usd = 150 from public.cm_settings), 'seeded settings';
  delete from public.cm_spend_ledger;
  update public.cm_settings set daily_budget_usd = 10, monthly_budget_usd = 100,
    per_provider_daily_caps = '{"runware": 6, "anthropic": 1.5}', lane_daily_caps = '{"slideshow": 2}';

  -- A provider cap: 6 for Runware. Exactly at the cap still goes; a cent over does not, and nothing is written.
  r := public.cm_reserve_spend('runware', 'runware.image.fast', 4);
  assert (r->>'ok')::boolean, 'first runware call';
  id1 := (r->>'ledger_id')::uuid;
  r := public.cm_reserve_spend('runware', 'runware.image.fast', 2);
  assert (r->>'ok')::boolean, 'exactly at the runware cap goes';
  r := public.cm_reserve_spend('runware', 'runware.image.fast', 0.01);
  assert not (r->>'ok')::boolean and r->>'reason' = 'provider_cap', 'over the runware cap: ' || r::text;
  assert (r->>'ledger_id') is null, 'a refusal reserves nothing';
  assert (select count(*) from public.cm_spend_ledger) = 2, 'two reservations';

  -- Settling with the actual cost frees what the estimate held: 4 reserved, 1.5 actual.
  assert public.cm_settle_spend(id1, 1.5, 'settled', 'task-abc'), 'settle';
  assert not public.cm_settle_spend(id1, 0, 'settled'), 'a row settles once';
  r := public.cm_reserve_spend('runware', 'runware.image.fast', 2.5);
  assert (r->>'ok')::boolean and (r->>'provider_today_usd')::numeric = 3.5, 'actual replaces the estimate: ' || r::text;

  -- A lane cap: slideshow work, whatever provider, $2 a day.
  r := public.cm_reserve_spend('anthropic', 'anthropic.messages', 1.2, 'slideshow');
  assert (r->>'ok')::boolean, 'slideshow writing';
  r := public.cm_reserve_spend('other', 'other.thing', 0.9, 'slideshow');
  assert not (r->>'ok')::boolean and r->>'reason' = 'lane_cap', 'over the slideshow cap: ' || r::text;
  r := public.cm_reserve_spend('other', 'other.thing', 0.9);
  assert (r->>'ok')::boolean, 'the same call outside the lane goes';

  -- The daily cap: 6 + 1.2 + 0.9 = 8.1 spent of 10.
  r := public.cm_reserve_spend('other', 'other.thing', 2);
  assert not (r->>'ok')::boolean and r->>'reason' = 'daily_cap', 'over the daily cap: ' || r::text;
  assert (r->>'today_usd')::numeric = 8.1, 'today sums actual else estimate: ' || r::text;

  -- The monthly cap is checked too.
  update public.cm_settings set monthly_budget_usd = 9;
  r := public.cm_reserve_spend('other', 'other.thing', 1);
  assert not (r->>'ok')::boolean and r->>'reason' = 'monthly_cap', 'over the monthly cap: ' || r::text;
  update public.cm_settings set monthly_budget_usd = 100;

  -- A failed call with no actual keeps its estimate counted; failed with actual 0 releases it.
  r := public.cm_reserve_spend('other', 'other.thing', 1);
  perform public.cm_settle_spend((r->>'ledger_id')::uuid, null, 'failed', null, 'timeout');
  r := public.cm_reserve_spend('other', 'other.thing', 0);
  assert (r->>'today_usd')::numeric = 9.1, 'a failed call still counts: ' || r::text;

  -- A dry run checks the caps with the real estimate but reserves nothing.
  r := public.cm_reserve_spend('other', 'other.thing', 5, null, null, null, true);
  assert not (r->>'ok')::boolean and r->>'reason' = 'daily_cap', 'a dry run is refused like the real call';
  r := public.cm_reserve_spend('other', 'other.thing', 0.5, null, null, null, true);
  assert (r->>'ok')::boolean, 'dry run within caps';
  assert (select estimated_usd = 0 and would_cost_usd = 0.5 and dry_run from public.cm_spend_ledger where id = (r->>'ledger_id')::uuid), 'dry row holds $0';
  perform public.cm_settle_spend((r->>'ledger_id')::uuid, 0.5);
  assert (select actual_usd = 0 from public.cm_spend_ledger where id = (r->>'ledger_id')::uuid), 'a dry row never costs';

  -- A bad estimate, and the kill switch (it stops even dry runs).
  r := public.cm_reserve_spend('other', 'other.thing', -1);
  assert r->>'reason' = 'bad_estimate', 'negative estimate';
  update public.cm_settings set kill_switch = true;
  r := public.cm_reserve_spend('other', 'other.thing', 0, null, null, null, true);
  assert not (r->>'ok')::boolean and r->>'reason' = 'kill_switch', 'kill switch';

  -- Only the service role may touch any of it.
  assert not has_function_privilege('anon', 'public.cm_reserve_spend(text,text,numeric,text,uuid,uuid,boolean)', 'execute'), 'anon reserve';
  assert not has_function_privilege('authenticated', 'public.cm_reserve_spend(text,text,numeric,text,uuid,uuid,boolean)', 'execute'), 'authenticated reserve';
  assert not has_function_privilege('authenticated', 'public.cm_settle_spend(uuid,numeric,text,text,text)', 'execute'), 'authenticated settle';
  assert has_function_privilege('service_role', 'public.cm_reserve_spend(text,text,numeric,text,uuid,uuid,boolean)', 'execute'), 'service role reserve';
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name like 'cm\_%' and grantee in ('anon', 'authenticated', 'PUBLIC');
  assert n = 0, 'no table grants to anon/authenticated';
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relname like 'cm\_%' and not c.relrowsecurity;
  assert n = 0, 'RLS on every cm_ table';
  assert (select not public from storage.buckets where id = 'content-machine'), 'the bucket is private';
end $$;
rollback;
