-- Crash-safe claiming for the three Long Form background workers (Research,
-- Script, Visual Plan). Real incident: a Research extraction batch was
-- claimed, the Edge Function invocation then disappeared (platform kill,
-- runtime termination, network failure — we don't need to know which)
-- BEFORE its own catch/handleStageFailure ever ran. Since stage_attempt was
-- previously only incremented from inside handleStageFailure, a worker that
-- disappears before reaching that code leaves stage_attempt untouched — the
-- row would be silently re-claimed and re-attempted FOREVER every time its
-- lease naturally expired, with zero record that anything had gone wrong.
--
-- Fix, applied identically to all three workers: stage_attempt now
-- increments as part of the CLAIM itself — atomically, before any risky
-- provider work begins — so the attempt is durably counted even if the
-- worker vanishes on the very next line. A stage/row that makes real
-- forward progress explicitly resets stage_attempt back to 0 in its own
-- checkpoint (see the matching advance-long-form-* code changes), so
-- healthy multi-round progress (e.g. Research's multi-batch extraction,
-- multi-query search) is never penalized by this — only CONSECUTIVE
-- claims with no progress in between accumulate.
--
-- This still leaves one gap on its own: once stage_attempt reaches 3 via
-- silent deaths, the row becomes permanently unclaimable (every claim
-- function's own `stage_attempt < 3` guard blocks it) but status is never
-- explicitly moved to 'failed', since nothing ever runs the code that would
-- do that for a worker that never got the chance to run its own failure
-- handler. Each claim function's "reap" step closes that gap: before
-- looking for new work, it explicitly fails any row that is exhausted
-- (stage_attempt >= 3) and not currently leased — self-healing the same
-- silent-death case, using only data already on the row (no new signal
-- needed to know a worker died; an expired lease at max attempts already
-- proves it).

/* ============================ Research ============================ */

create or replace function public.claim_long_form_research_stage(p_limit int default 1)
returns setof public.long_form_research_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Reap: a row that exhausted its claim budget entirely via workers that
  -- disappeared before ever recording a failure (last_error_code IS NULL is
  -- not required to distinguish this — a row that failed normally already
  -- has status = 'failed' via handleStageFailure, so anything still
  -- 'researching' at stage_attempt >= 3 can ONLY have gotten here via the
  -- silent-death path) is moved to a real terminal state so it stops being
  -- an invisible zombie and a human/future resume can see what happened.
  update public.long_form_research_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where status = 'researching'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_research_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  from (
    select id from public.long_form_research_versions
    where status = 'researching'
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

revoke all on function public.claim_long_form_research_stage(int) from public;
grant execute on function public.claim_long_form_research_stage(int) to service_role;

create or replace function public.claim_long_form_research_stage_by_id(p_id uuid)
returns setof public.long_form_research_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_research_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where id = p_id
    and status = 'researching'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_research_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  where v.id = p_id
    and v.status = 'researching'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_research_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_research_stage_by_id(uuid) to service_role;

/* ============================ Script ============================ */

create or replace function public.claim_long_form_script_stage(p_limit int default 1)
returns setof public.long_form_script_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_script_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where status = 'drafting'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_script_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
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

create or replace function public.claim_long_form_script_stage_by_id(p_id uuid)
returns setof public.long_form_script_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_script_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where id = p_id
    and status = 'drafting'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_script_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  where v.id = p_id
    and v.status = 'drafting'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_script_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_script_stage_by_id(uuid) to service_role;

/* ============================ Visual Plan ============================ */

create or replace function public.claim_long_form_visual_plan_stage(p_limit int default 1)
returns setof public.long_form_visual_plan_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.long_form_visual_plan_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where status = 'planning'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_visual_plan_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
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
  update public.long_form_visual_plan_versions
  set status = 'failed',
      last_error_code = 'stage_attempts_exhausted_via_worker_disappearance',
      last_error_at = now(),
      worker_lock_until = null
  where id = p_id
    and status = 'planning'
    and stage_attempt >= 3
    and (worker_lock_until is null or worker_lock_until < now());

  return query
  update public.long_form_visual_plan_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now(),
      stage_attempt = v.stage_attempt + 1
  where v.id = p_id
    and v.status = 'planning'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_visual_plan_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_visual_plan_stage_by_id(uuid) to service_role;
