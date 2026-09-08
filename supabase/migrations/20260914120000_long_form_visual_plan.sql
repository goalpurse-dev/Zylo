-- Visual Plan (VisualBeat Director + rough storyboard). A VisualPlanVersion
-- is keyed to the EXACT ScriptVersion it was planned from — if the script
-- changes, the old plan becomes stale (never deleted), same dependency
-- philosophy as Research->Script.
--
-- Async but deliberately NOT a many-stage worker like Research: a single
-- Visual Director call over a full ~1500-word ScriptDocument asking for
-- 80-110 detailed VisualBeats is plausibly one of the largest single
-- structured-output requests in this system, so this still uses the
-- proven durable stage-machine pattern (self-chained dispatch, claim via
-- SKIP LOCKED, worker_lock_until lease) purely as protection against the
-- flat 150s gateway idle-timeout already hit twice by Research — but it is
-- only two stages: planning (the one main Visual Director call, with its
-- own bounded inline repair — see advance-long-form-visual-plan) and
-- finalizing (zero-cost: deterministic validation + storyboard summary
-- economics + persist). No Visual/Continuity/Storyboard/Entity Critic
-- stages — deterministic validators do that work for free.
create table public.long_form_visual_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  script_version_id uuid not null references public.long_form_script_versions(id) on delete cascade,
  version integer not null,

  status text not null default 'planning', -- planning | ready | failed

  stage text not null default 'planning', -- planning | finalizing
  stage_attempt integer not null default 0,
  stage_started_at timestamptz,
  worker_lock_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  visual_mode text, -- STORY | EXPLAINER | HYBRID

  -- { entityRegistry, continuityGroups, visualBeats, visualPayoffs } — the
  -- durable output of the one Visual Director call (plus its own bounded
  -- repair, if needed). This IS the Rough Storyboard's data source; no
  -- separate storyboard table.
  visual_plan jsonb,

  -- Denormalized read-optimized copies of visual_plan's own arrays, kept
  -- only because the Look page and a future Reference/Entity stage will
  -- query these independently and often — never written to separately from
  -- visual_plan, always derived from it at persist time.
  entity_registry jsonb,
  continuity_groups jsonb,
  -- Sparse snapshot only: { [continuityGroupId]: inheritedState }, derived
  -- directly from continuity_groups[].inheritedState — deliberately NOT a
  -- separate per-beat mutation timeline (see advance-long-form-visual-plan's
  -- comments on why WorldState stays sparse here).
  world_state_model jsonb,

  -- { totalVisualBeats, estimatedBaseSetups, estimatedEdits, estimatedInserts,
  --   estimatedDiagrams, estimatedMaps, estimatedProgrammaticGraphics,
  --   estimatedReuseEvents } — planning estimates only, never a render/charge
  -- commitment. This is what the Look page's Storyboard hero reads.
  storyboard_summary jsonb,

  -- Reserved for the optional single rough-preview-image feature — not
  -- populated by this milestone (no image generation happens yet), kept so
  -- that feature has an obvious home without a later migration.
  representative_preview_job_id uuid,
  representative_preview_url text,

  generation_model text,
  meta jsonb, -- { modelCalls, repairCalls, inputTokens, outputTokens, reasoningTokens, estimatedModelCostUsd, estimatedTotalCostUsd, callLedger[] }

  created_at timestamptz not null default now(),

  unique (project_id, script_version_id, version)
);

create unique index long_form_visual_plan_versions_one_active_idx
  on public.long_form_visual_plan_versions (project_id, script_version_id)
  where status = 'planning';

create index long_form_visual_plan_versions_project_id_idx
  on public.long_form_visual_plan_versions (project_id, script_version_id, version desc);

alter table public.long_form_visual_plan_versions enable row level security;

create policy "Users can view their own project's visual plan versions"
  on public.long_form_visual_plan_versions for select
  using (exists (
    select 1 from public.long_form_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

alter table public.long_form_projects
  add column current_visual_plan_version_id uuid references public.long_form_visual_plan_versions(id) on delete set null;

create or replace function public.claim_long_form_visual_plan_stage(p_limit int default 1)
returns setof public.long_form_visual_plan_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_visual_plan_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  from (
    select id from public.long_form_visual_plan_versions
    where status = 'planning'
      and stage_attempt < 3
      and (worker_lock_until is null or worker_lock_until < now())
    order by stage_started_at nulls first
    limit p_limit
    for update skip locked
  ) due
  where v.id = due.id
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_visual_plan_stage(int) from public;
grant execute on function public.claim_long_form_visual_plan_stage(int) to service_role;

create or replace function public.claim_long_form_visual_plan_stage_by_id(p_id uuid)
returns setof public.long_form_visual_plan_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_visual_plan_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  where v.id = p_id
    and v.status = 'planning'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_visual_plan_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_visual_plan_stage_by_id(uuid) to service_role;
