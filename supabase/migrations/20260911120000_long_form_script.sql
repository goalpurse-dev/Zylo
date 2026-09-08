-- Script Engine. A ScriptVersion is keyed to the EXACT StoryPlanVersion AND
-- ResearchVersion it was written from (both, not just one) — either
-- changing makes the script stale, mirroring how Research is keyed to its
-- StoryPlanVersion. Never deleted when stale, same philosophy as Research.
--
-- Async/durable from day one (unlike Research, which started synchronous and
-- had to be migrated under production pressure — see
-- 20260910120000_long_form_research_async.sql for why). Same proven shape:
-- long_form_script_versions IS the workflow state (status/stage/
-- stage_attempt/worker_lock_until/intermediate), no separate job-queue
-- table. status is coarse and user-facing (drafting/ready/needs_research/
-- failed); stage is the fine-grained internal position a worker resumes
-- from (draft/critic/revision/finalizing) — kept deliberately separate,
-- same reasoning as Research's status/stage split.
create table public.long_form_script_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  story_plan_version_id uuid not null references public.long_form_story_plan_versions(id) on delete cascade,
  research_version_id uuid not null references public.long_form_research_versions(id) on delete cascade,
  version integer not null,

  status text not null default 'drafting', -- drafting | ready | needs_research | failed

  stage text not null default 'draft', -- draft | critic | revision | finalizing
  stage_attempt integer not null default 0,
  stage_started_at timestamptz,
  worker_lock_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  script_document jsonb, -- { title, narrationSegments, chapters, openLoops, actualWords, estimatedDurationSeconds, researchWarnings, qualitySummary }
  critic_result jsonb, -- Pass B's diagnostic output (issues[], hookAssessment, payoffAssessment, overallVerdict) — never itself rewritten prose

  -- Scratch space for stage-to-stage handoff only (the compact
  -- ScriptEvidencePack built once and reused by every pass, the
  -- pre-revision draft when a selective patch is in flight, deterministic
  -- validator output, critic routing decision) — script_document/
  -- critic_result remain the genuinely durable, inspectable outputs.
  intermediate jsonb,

  generation_model text,
  critic_model text,
  revision_model text,

  meta jsonb, -- { modelCalls, repairCalls, inputTokens, outputTokens, reasoningTokens, estimatedModelCostUsd, estimatedTotalCostUsd, callLedger[], revisionSkipped, revisionKind }

  created_at timestamptz not null default now(),

  unique (project_id, story_plan_version_id, research_version_id, version)
);

-- Same idempotency/concurrency guarantee as Research: only one row can be
-- actively "drafting" for a given (project, story plan version, research
-- version) triple at a time.
create unique index long_form_script_versions_one_active_idx
  on public.long_form_script_versions (project_id, story_plan_version_id, research_version_id)
  where status = 'drafting';

create index long_form_script_versions_project_id_idx
  on public.long_form_script_versions (project_id, story_plan_version_id, research_version_id, version desc);

alter table public.long_form_script_versions enable row level security;

create policy "Users can view their own project's script versions"
  on public.long_form_script_versions for select
  using (exists (
    select 1 from public.long_form_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

-- No insert/update/delete policy — every write goes through the
-- service-role start/advance-long-form-script edge functions, same as
-- Research's tables.

alter table public.long_form_projects
  add column current_script_version_id uuid references public.long_form_script_versions(id) on delete set null;

-- Claim: identical lease semantics to claim_long_form_research_stage —
-- SKIP LOCKED so a self-chained dispatch and any future safety-net sweep
-- never execute the same stage twice, and a crashed worker's lease expires
-- on its own instead of bricking the run.
create or replace function public.claim_long_form_script_stage(p_limit int default 1)
returns setof public.long_form_script_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_script_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  from (
    select id from public.long_form_script_versions
    where status = 'drafting'
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

revoke all on function public.claim_long_form_script_stage(int) from public;
grant execute on function public.claim_long_form_script_stage(int) to service_role;

-- Claims one specific script version's current stage — used by the
-- self-chained dispatch path right after the previous stage finished, same
-- role as claim_long_form_research_stage_by_id.
create or replace function public.claim_long_form_script_stage_by_id(p_id uuid)
returns setof public.long_form_script_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_script_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  where v.id = p_id
    and v.status = 'drafting'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_script_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_script_stage_by_id(uuid) to service_role;

-- No cron safety net yet — Research's own cron sweep was never actually
-- enabled either (see 20260910120000's deployment notes; vault secrets
-- require direct SQL access unavailable in this environment). Self-chain
-- dispatch is the real progression path for both. Add one identically to
-- Research's if a safety net is ever needed here.
