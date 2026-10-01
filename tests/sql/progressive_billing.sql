-- Charge for work done (migration 20261022100000), checked with EXACT balances
-- against the LIVE functions on the internal test account. One DO block that
-- always ends with RAISE, so every change (rows, balance) rolls back. Run:
--   npx supabase db query --linked -f tests/sql/progressive_billing.sql
-- Expect: ERROR ... PROGRESSIVE_BILLING PASS <details>.
do $$
declare
  uid uuid := 'd66a0ea9-3574-4fad-94ed-c82aea15061f'; -- @zyvo-internal.test
  sess uuid; p uuid[] := '{}'; g uuid[] := '{}'; pid uuid; gid uuid;
  r public.long_form_project_reservations; bal int; c int; v record; out text := ''; fails text := '';
begin
  for i in 1..6 loop
    insert into public.long_form_discovery_sessions(user_id) values (uid) returning id into sess;
    insert into public.long_form_projects(user_id, discovery_session_id, topic) values (uid, sess, 'progressive billing test ' || i) returning id into pid;
    insert into public.long_form_generation_profiles(project_id, visual_recipe, recipe_version, render_tier, target_duration_minutes)
      values (pid, 'stickman', 'stickman_v1', 'v2', 10) returning id into gid;
    p := p || pid; g := g || gid;
  end loop;

  -- 1. DELETE MID-WAY: script + voice done ($0.89 real) -> 84 credits kept, 166 back.
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[1], uid, g[1], 250, '[]'::jsonb);
  if r.billing_mode <> 'progressive' then fails := fails || ' new_hold_not_progressive'; end if;
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[1], 'script', 'anthropic', 0.43, false), (p[1], 'narration', 'elevenlabs', 0.46, false);
  c := public.commit_long_form_work_done(p[1]);
  select * into v from public.long_form_reservation_view(p[1]);
  r := public.close_long_form_reservation(p[1], 'deleted');
  select credit_balance into bal from public.profiles where id = uid;
  if c <> 84 or v.kept <> 84 or v.refund_if_deleted <> 166 or r.committed_credits <> 84 or r.released_credits <> 166 or bal <> 916 then
    fails := fails || format(' delete_midway(c=%s view=%s/%s kept=%s back=%s bal=%s)', c, v.kept, v.refund_if_deleted, r.committed_credits, r.released_credits, bal);
  end if;
  out := out || format('delete mid-way: 1000 -> reserve 250 -> commit %s -> delete: kept %s, back %s, bal %s; ', c, r.committed_credits, r.released_credits, bal);

  -- 2. FINISH NORMALLY: progressive commits, then the full quote is settled (never more).
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[2], uid, g[2], 250, '[]'::jsonb);
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[2], 'script', 'anthropic', 0.89, false);
  c := public.commit_long_form_work_done(p[2]);
  r := public.settle_long_form_reservation_full(r.id, uid);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 750 or r.committed_credits <> 250 or r.status <> 'settled' then fails := fails || format(' finish(bal=%s committed=%s status=%s)', bal, r.committed_credits, r.status); end if;
  out := out || format('finish: commit %s then settle -> charged %s, bal %s; ', c, r.committed_credits, bal);

  -- 3. OUR FAILURE: committed credits come back too.
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[3], uid, g[3], 250, '[]'::jsonb);
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[3], 'script', 'anthropic', 0.89, false);
  c := public.commit_long_form_work_done(p[3]);
  update public.long_form_projects set autopilot = '{"status":"failed","failedReason":"the voiceover failed"}'::jsonb where id = p[3];
  select * into v from public.long_form_reservation_view(p[3]);
  r := public.close_long_form_reservation(p[3], 'deleted');
  select credit_balance into bal from public.profiles where id = uid;
  if c <> 84 or not v.failed_by_us or v.refund_if_deleted <> 250 or r.released_credits <> 250 or r.committed_credits <> 0 or r.close_reason <> 'failed_by_us' or bal <> 1000 then
    fails := fails || format(' our_failure(c=%s view=%s back=%s kept=%s reason=%s bal=%s)', c, v.refund_if_deleted, r.released_credits, r.committed_credits, r.close_reason, bal);
  end if;
  out := out || format('our failure: commit %s -> delete: back %s (all), bal %s; ', c, r.released_credits, bal);

  -- 4. IDLE 7 DAYS: the uncommitted part is released (the cron calls close 'idle').
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[4], uid, g[4], 250, '[]'::jsonb);
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[4], 'research', 'openai', 0.5, false);
  r := public.close_long_form_reservation(p[4], 'idle');
  select credit_balance into bal from public.profiles where id = uid;
  if r.committed_credits <> 47 or r.released_credits <> 203 or r.status <> 'settled' or bal <> 953 then fails := fails || format(' idle(kept=%s back=%s status=%s bal=%s)', r.committed_credits, r.released_credits, r.status, bal); end if;
  out := out || format('idle: kept %s, back %s, bal %s; ', r.committed_credits, r.released_credits, bal);

  -- 5. NEVER ABOVE THE QUOTE: $4.52 of real cost on a 250-credit video.
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[5], uid, g[5], 250, '[]'::jsonb);
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[5], 'images', 'runware', 4.52, false);
  c := public.commit_long_form_work_done(p[5]);
  r := public.close_long_form_reservation(p[5], 'deleted');
  select credit_balance into bal from public.profiles where id = uid;
  if c <> 250 or r.released_credits <> 0 or bal <> 750 then fails := fails || format(' cap(c=%s back=%s bal=%s)', c, r.released_credits, bal); end if;
  out := out || format('cap: commit %s of 250, back %s, bal %s; ', c, r.released_credits, bal);

  -- 6. EXISTING (fixed) holds keep today's behaviour: nothing committed, delete refunds it all.
  update public.profiles set credit_balance = 1000 where id = uid;
  r := public.reserve_long_form_project_credits(p[6], uid, g[6], 250, '[]'::jsonb);
  update public.long_form_project_reservations set billing_mode = 'fixed' where id = r.id;
  insert into public.long_form_cost_ledger(project_id, stage, provider, usd, estimated) values (p[6], 'script', 'anthropic', 0.89, false);
  c := public.commit_long_form_work_done(p[6]);
  r := public.close_long_form_reservation(p[6], 'deleted');
  select credit_balance into bal from public.profiles where id = uid;
  if c is not null or r.released_credits <> 250 or bal <> 1000 then fails := fails || format(' fixed(c=%s back=%s bal=%s)', c, r.released_credits, bal); end if;
  out := out || format('fixed: commit %s, back %s, bal %s', coalesce(c::text, 'none'), r.released_credits, bal);

  if fails <> '' then raise exception 'PROGRESSIVE_BILLING FAIL:%  || %', fails, out; end if;
  raise exception 'PROGRESSIVE_BILLING PASS %', out;
end $$;
