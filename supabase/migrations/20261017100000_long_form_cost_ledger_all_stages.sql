-- Phase 6d-1 — every stage writes cost-ledger rows.
-- Script and research kept their per-call costs only in meta.callLedger; a
-- trigger now copies every NEW callLedger entry into long_form_cost_ledger
-- (whatever code path wrote it), and the summary reads a version's callLedger
-- only when it has no ledger rows (older versions), so nothing counts twice.

create or replace function public.long_form_call_ledger_to_cost_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_n int := coalesce(jsonb_array_length(case when tg_op = 'UPDATE' then old.meta->'callLedger' end), 0);
  new_list jsonb := coalesce(new.meta->'callLedger', '[]'::jsonb);
  stage_name text := case when tg_table_name = 'long_form_script_versions' then 'script' else 'research' end;
  e jsonb;
  i int;
begin
  if jsonb_typeof(new_list) <> 'array' or jsonb_array_length(new_list) <= old_n then return new; end if;
  for i in old_n .. jsonb_array_length(new_list) - 1 loop
    e := new_list->i;
    insert into public.long_form_cost_ledger (project_id, stage, provider, model, units, usd, estimated, source_table, source_id)
    values (
      new.project_id, stage_name,
      case when coalesce(e->>'model', new.meta->>'model', '') ilike 'claude%' then 'anthropic' else 'openai' end,
      coalesce(e->>'model', new.meta->>'model'),
      jsonb_strip_nulls(jsonb_build_object(
        'calls', 1, 'inputTokens', (e->>'inputTokens')::numeric, 'outputTokens', (e->>'outputTokens')::numeric,
        'cacheReadTokens', (e->>'cacheReadTokens')::numeric, 'cacheWriteTokens', (e->>'cacheWriteTokens')::numeric,
        'webSearchCalls', (e->>'actualToolCalls')::numeric, 'callStage', e->>'stage', 'requestType', e->>'requestType')),
      coalesce((e->>'estimatedCostUsd')::numeric, 0), true, tg_table_name, new.id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists long_form_script_versions_cost_ledger on public.long_form_script_versions;
create trigger long_form_script_versions_cost_ledger
  after insert or update of meta on public.long_form_script_versions
  for each row execute function public.long_form_call_ledger_to_cost_ledger();

drop trigger if exists long_form_research_versions_cost_ledger on public.long_form_research_versions;
create trigger long_form_research_versions_cost_ledger
  after insert or update of meta on public.long_form_research_versions
  for each row execute function public.long_form_call_ledger_to_cost_ledger();

-- Backfill: every entry already in a callLedger becomes a ledger row once
-- (skipped for versions that already have rows), so the summary reads ONE table.
insert into public.long_form_cost_ledger (project_id, stage, provider, model, units, usd, estimated, source_table, source_id, created_at)
select v.project_id, v.stage_name,
  case when coalesce(e->>'model', v.meta->>'model', '') ilike 'claude%' then 'anthropic' else 'openai' end,
  coalesce(e->>'model', v.meta->>'model'),
  jsonb_strip_nulls(jsonb_build_object('calls', 1, 'inputTokens', (e->>'inputTokens')::numeric, 'outputTokens', (e->>'outputTokens')::numeric,
    'cacheReadTokens', (e->>'cacheReadTokens')::numeric, 'cacheWriteTokens', (e->>'cacheWriteTokens')::numeric,
    'webSearchCalls', (e->>'actualToolCalls')::numeric, 'callStage', e->>'stage', 'requestType', e->>'requestType', 'backfilled', true)),
  coalesce((e->>'estimatedCostUsd')::numeric, 0), true, v.tbl, v.id, v.created_at
from (
  select id, project_id, meta, created_at, 'script' as stage_name, 'long_form_script_versions' as tbl from public.long_form_script_versions
  union all
  select id, project_id, meta, created_at, 'research', 'long_form_research_versions' from public.long_form_research_versions
) v, jsonb_array_elements(case when jsonb_typeof(v.meta->'callLedger') = 'array' then v.meta->'callLedger' else '[]'::jsonb end) e
where v.project_id is not null
  and not exists (select 1 from public.long_form_cost_ledger l where l.source_id = v.id and l.source_table = v.tbl);

create or replace function public.long_form_project_cost_by_stage(p_project_id uuid)
returns table (stage text, usd numeric, calls bigint, source text)
language sql stable security definer set search_path = public as $$
  select l.stage, sum(l.usd)::numeric, coalesce(sum((l.units->>'calls')::bigint), count(*))::bigint, 'long_form_cost_ledger'
  from public.long_form_cost_ledger l where l.project_id = p_project_id group by l.stage;
$$;
revoke all on function public.long_form_project_cost_by_stage(uuid) from public, anon, authenticated;

-- Narration rows re-priced from the credits ElevenLabs reported (x $0.0002/credit,
-- costLedger.ts ELEVENLABS_USD_PER_CREDIT) instead of the old $0.0003/character guess.
update public.long_form_cost_ledger
set usd = round(((units->>'providerCredits')::numeric * 0.0002), 6), estimated = false,
    units = units || jsonb_build_object('repricedFromUsd', usd)
where stage = 'narration' and provider = 'elevenlabs'
  and jsonb_typeof(units->'providerCredits') = 'number' and (units->>'providerCredits')::numeric > 0
  and not (units ? 'repricedFromUsd');
