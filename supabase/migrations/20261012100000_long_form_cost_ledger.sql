-- Phase 3b — per-project cost ledger (feeds the up-front quote later).
-- One row per paid call (or per stage run for stages that batch calls):
-- provider, model, stage, units (tokens / characters / provider credits /
-- images) and USD. The script and research engines already keep a per-call
-- ledger in their rows' meta.callLedger; the summary function reads those
-- directly instead of double-writing them.
create table if not exists public.long_form_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  stage text not null check (stage in ('story_plan', 'research', 'script', 'bible', 'beats', 'narration', 'images', 'qa', 'render', 'other')),
  provider text not null,
  model text,
  units jsonb not null default '{}'::jsonb, -- { calls, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, characters, providerCredits, images }
  usd numeric(12, 6) not null default 0,
  estimated boolean not null default true,  -- priced from published rates, not a provider-reported charge
  source_table text,
  source_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists long_form_cost_ledger_project_stage_idx on public.long_form_cost_ledger (project_id, stage);

alter table public.long_form_cost_ledger enable row level security;
revoke all on public.long_form_cost_ledger from public, anon, authenticated;

-- Total per stage for one project: ledger rows + the script/research
-- engines' own per-call ledgers (meta.callLedger[].estimatedCostUsd).
create or replace function public.long_form_project_cost_by_stage(p_project_id uuid)
returns table (stage text, usd numeric, calls bigint, source text)
language sql stable security definer set search_path = public as $$
  select l.stage, sum(l.usd)::numeric, coalesce(sum((l.units->>'calls')::bigint), count(*))::bigint, 'long_form_cost_ledger'
  from public.long_form_cost_ledger l where l.project_id = p_project_id group by l.stage
  union all
  select 'script', coalesce(sum((e->>'estimatedCostUsd')::numeric), 0), count(e)::bigint, 'long_form_script_versions.meta.callLedger'
  from public.long_form_script_versions s, jsonb_array_elements(coalesce(s.meta->'callLedger', '[]'::jsonb)) e
  where s.project_id = p_project_id
  union all
  select 'research', coalesce(sum((e->>'estimatedCostUsd')::numeric), 0), count(e)::bigint, 'long_form_research_versions.meta.callLedger'
  from public.long_form_research_versions r, jsonb_array_elements(coalesce(r.meta->'callLedger', '[]'::jsonb)) e
  where r.project_id = p_project_id;
$$;
revoke all on function public.long_form_project_cost_by_stage(uuid) from public, anon, authenticated;
