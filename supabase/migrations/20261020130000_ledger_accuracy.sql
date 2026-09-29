-- Phase 7 (ledger accuracy):
-- 1. Account-level rows (idea generation runs before a project exists): project optional + the user.
-- 2. Research / script rows copied from meta.callLedger are priced from REAL token usage x list
--    price (how the providers bill) — no longer flagged estimated when usage is present.
alter table public.long_form_cost_ledger alter column project_id drop not null;
alter table public.long_form_cost_ledger add column if not exists user_id uuid;
alter table public.long_form_cost_ledger drop constraint if exists long_form_cost_ledger_owner;
alter table public.long_form_cost_ledger add constraint long_form_cost_ledger_owner check (project_id is not null or user_id is not null);
create index if not exists long_form_cost_ledger_user on public.long_form_cost_ledger (user_id, created_at) where user_id is not null;

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
      coalesce((e->>'estimatedCostUsd')::numeric, 0),
      -- real usage present = priced from the provider's own token counts
      not (e ? 'inputTokens' and e ? 'outputTokens'),
      tg_table_name, new.id
    );
  end loop;
  return new;
end;
$$;
