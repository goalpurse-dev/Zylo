-- Visual World / Canonical References — the first real image-production
-- milestone. A VisualWorldVersion is keyed to the EXACT VisualPlanVersion
-- (and its ScriptVersion) it was planned from, same dependency philosophy
-- as every earlier stage (Research->Script->VisualPlan->VisualWorld): if
-- the Visual Plan changes, the old Visual World becomes stale but is NEVER
-- deleted — a project's current_visual_world_version_id just stops
-- pointing at it.
--
-- Two-table design, same reasoning as long_form_research_sources: a parent
-- version row for the plan-level artifacts (style, reference plan, board),
-- plus a CHILD ROW per generated image. Reference generation is not "one
-- JSON blob" — each image has its own independent job, retry count, lease,
-- status and real provider cost, and there can be a dozen+ of them per
-- video. Hiding that inside one JSONB array would make partial progress,
-- crash-safety, and per-asset regeneration all much harder than they need
-- to be — exactly the mistake the extraction-batch JSONB approach avoided
-- by using durable per-batch fields, applied here as real rows instead
-- since these are independently queryable, orderable, user-facing assets.
create table public.long_form_visual_world_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  visual_plan_version_id uuid not null references public.long_form_visual_plan_versions(id) on delete cascade,
  script_version_id uuid not null references public.long_form_script_versions(id) on delete cascade,
  version integer not null,

  status text not null default 'planning', -- planning | generating | ready | needs_attention | failed

  -- Durable stage machine — identical crash-safety contract as Research/
  -- Script/Visual Plan (claim-time attempt increment, lease, bounded
  -- claims; see the 20260916120000 migration and its matching TS changes).
  -- Stages: planning (the one Reference Planner call) -> generating
  -- (dispatch + watch per-asset jobs in long_form_reference_assets) ->
  -- finalizing (build reference_board_meta + roll up cost, zero-cost).
  stage text not null default 'planning',
  stage_attempt integer not null default 0,
  stage_started_at timestamptz,
  worker_lock_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  -- The ONE locked Zyvo style (Part 6) — machine-readable (linework,
  -- shading, palette, face construction, proportions, environment detail,
  -- lighting, perspective, diagram/map grammar), never "make it like image
  -- X". Same spec object reused unchanged across every project/tier — kept
  -- on the version row (not a separate table) since V1 has exactly one
  -- style and versioning the STYLE isn't a goal yet, only versioning the
  -- Visual World itself.
  style_spec jsonb,

  -- The Reference Planner's one durable output — see ReferencePlan shape:
  -- { visualStyle, entities: [{ entityId, referencePriority, canonicalSpec,
  -- requiredViews: [{ referenceType, angle, purpose }], factualConstraints,
  -- forbiddenElements }] }. Never regenerated piecemeal — a full Visual
  -- World regenerate makes a new version with a fresh plan.
  reference_plan jsonb,

  -- Precomputed layout metadata for the programmatic reference board (Part
  -- 12) — which asset ids go in which section/slot, entity display names,
  -- section ordering. The board itself is composed from real stored images
  -- via HTML/CSS at render time, NEVER a separate generated image; this is
  -- just "how to arrange what already exists," cheap to recompute so it's
  -- fine to keep it here rather than inventing a third table.
  reference_board_meta jsonb,

  render_tier text not null default 'v2', -- v2 | v3 | v4 — rendering policy only, same Script/VisualPlan/EntityRegistry/ReferencePlan intelligence across all three (Part 7 item 19)

  -- { modelCalls, inputTokens, outputTokens, estimatedModelCostUsd (Reference
  -- Planner OpenAI cost only), referenceImageCostUsd (sum of child asset
  -- cost_usd, kept denormalized for a cheap read), estimatedTotalCostUsd,
  -- projectedCost: { v2, v3, v4 } (Part 16 economics estimate), callLedger[] }
  meta jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, visual_plan_version_id, script_version_id, version)
);

create unique index long_form_visual_world_versions_one_active_idx
  on public.long_form_visual_world_versions (project_id, visual_plan_version_id, script_version_id)
  where status in ('planning', 'generating');

create index long_form_visual_world_versions_project_id_idx
  on public.long_form_visual_world_versions (project_id, visual_plan_version_id, script_version_id, version desc);

alter table public.long_form_visual_world_versions enable row level security;

create policy "Users can view their own project's visual world versions"
  on public.long_form_visual_world_versions for select
  using (exists (
    select 1 from public.long_form_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

alter table public.long_form_projects
  add column current_visual_world_version_id uuid references public.long_form_visual_world_versions(id) on delete set null;

/* ============================ Reference assets (child rows) ============================ */

create table public.long_form_reference_assets (
  id uuid primary key default gen_random_uuid(),
  visual_world_version_id uuid not null references public.long_form_visual_world_versions(id) on delete cascade,

  entity_id text not null, -- matches long_form_visual_plan_versions.entity_registry[].id
  reference_type text not null, -- e.g. "character_reference" | "location_reference" | "object_reference" (broad category, mirrors the storyboard's own SHOT_STRATEGY-style vocabulary)
  angle_or_view text not null, -- e.g. "three_quarter_neutral" | "profile" | "face_closeup" | "wide_toward_hearth" — the SPECIFIC requested view, human-readable, never a generated label

  status text not null default 'pending', -- pending | running | succeeded | failed

  -- Crash-safety fields — identical contract to Research's per-batch
  -- claimAttempts/leaseUntil (see runExtractionBatchStage), but as real
  -- columns since each reference is already its own row rather than a
  -- JSONB array entry. claim_attempts increments atomically at claim time,
  -- before the Runware call begins; a "running" row whose lease has
  -- expired is proof the previous worker disappeared and is reclaimable.
  claim_attempts integer not null default 0,
  lease_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  job_id uuid references public.jobs(id) on delete set null, -- the durable jobs-table row backing the actual Runware call — background-safe, browser-independent, same invariant as every other paid generation in this product
  result_url text,
  render_model text, -- the real Runware AIR tag actually used (e.g. "runware:400@4") — never inferred after the fact
  prompt_snapshot text, -- the exact compiled prompt sent — audit trail + what a "Regenerate" reuses/tweaks
  input_reference_asset_ids uuid[] not null default '{}', -- other reference_assets.id this generation was conditioned on (edits/consistency passes), if any
  cost_usd numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index long_form_reference_assets_version_id_idx on public.long_form_reference_assets (visual_world_version_id);
create index long_form_reference_assets_entity_id_idx on public.long_form_reference_assets (visual_world_version_id, entity_id);

alter table public.long_form_reference_assets enable row level security;

create policy "Users can view their own project's reference assets"
  on public.long_form_reference_assets for select
  using (exists (
    select 1 from public.long_form_visual_world_versions v
    join public.long_form_projects p on p.id = v.project_id
    where v.id = visual_world_version_id and p.user_id = auth.uid()
  ));

/* ============================ Claim functions — same crash-safe contract ============================ */
-- Identical shape to claim_long_form_research_stage(_by_id) etc. (see
-- 20260916120000): stage_attempt increments atomically at claim time, a
-- reap pre-step fails any row exhausted via worker disappearance. Applied
-- here from day one — Visual World inherits the fix instead of needing to
-- rediscover it later (see the engagement's own "very important future
-- rule": every expensive background unit gets this contract from the
-- start).

create or replace function public.claim_long_form_visual_world_stage(p_limit int default 1)
returns setof public.long_form_visual_world_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_visual_world_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where status in ('planning', 'generating')
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_visual_world_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  from (
    select id from public.long_form_visual_world_versions
    where status in ('planning', 'generating')
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

revoke all on function public.claim_long_form_visual_world_stage(int) from public;
grant execute on function public.claim_long_form_visual_world_stage(int) to service_role;

create or replace function public.claim_long_form_visual_world_stage_by_id(p_id uuid)
returns setof public.long_form_visual_world_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_visual_world_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where id = p_id
    and status in ('planning', 'generating')
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_visual_world_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  where v.id = p_id
    and v.status in ('planning', 'generating')
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_visual_world_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_visual_world_stage_by_id(uuid) to service_role;

-- Per-asset claim (the reference-generation equivalent of an extraction
-- batch claim) — atomic: increments claim_attempts and assigns a lease in
-- the SAME update, before the Runware call begins. Max 3 claims per asset
-- (Part 11 item 23 — "2-3 automatic expensive attempts"), then it's left
-- as a genuinely failed asset rather than retried forever.
create or replace function public.claim_long_form_reference_asset(p_id uuid)
returns setof public.long_form_reference_assets
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_reference_assets a
  set status = 'running',
      claim_attempts = a.claim_attempts + 1,
      lease_until = now() + interval '3 minutes',
      updated_at = now()
  where a.id = p_id
    and a.claim_attempts < 3
    and (a.status = 'pending' or (a.status = 'running' and a.lease_until < now()))
  returning a.*;
end;
$$;

revoke all on function public.claim_long_form_reference_asset(uuid) from public;
grant execute on function public.claim_long_form_reference_asset(uuid) to service_role;

-- Sweep claim for the cron safety net (mirrors claim_long_form_research_stage)
-- — also reaps assets that exhausted their claim budget via disappearance,
-- same self-healing contract as every other worker in this system.
create or replace function public.claim_long_form_reference_assets(p_limit int default 1)
returns setof public.long_form_reference_assets
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_reference_assets
  set status = 'failed',
      last_error_code = 'claim_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      lease_until = null,
      updated_at = now()
  where claim_attempts >= 3
    and status = 'running'
    and lease_until < now();

  return query
  update public.long_form_reference_assets a
  set status = 'running',
      claim_attempts = a.claim_attempts + 1,
      lease_until = now() + interval '3 minutes',
      updated_at = now()
  from (
    select id from public.long_form_reference_assets
    where claim_attempts < 3
      and (status = 'pending' or (status = 'running' and lease_until < now()))
    order by created_at
    limit p_limit
    for update skip locked
  ) due
  where a.id = due.id
  returning a.*;
end;
$$;

revoke all on function public.claim_long_form_reference_assets(int) from public;
grant execute on function public.claim_long_form_reference_assets(int) to service_role;
