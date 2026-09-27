-- 2026-09-22 "provider adapter transport" incident, Root Cause 3 — durable
-- dependency resolution for REUSE/CROP/COMPOSITE scenes. Real Atlantis
-- finding: claim_long_form_scene_for_render treated a source scene's
-- status IN ('succeeded','failed') as "done, dependent may proceed" — but a
-- source that failed ONCE and still has retry attempts left (claim_attempts
-- < 3) is NOT done, it's about to be retried. Its dependent got claimed
-- immediately, found no successful source result, and threw
-- REUSE_SOURCE_NOT_READY — a genuine cascade failure of a transient/
-- systemic provider bug, permanently marking 2 scenes "failed" for a source
-- that would have succeeded on retry seconds later.
--
-- Fix: a dependent is only claimable once its source has genuinely
-- SUCCEEDED, or the source is PERMANENTLY exhausted (claim_attempts >= 3 —
-- the same threshold this function already uses to auto-fail a stuck
-- scene above). While the source is merely failed-but-retriable, the
-- dependent simply stays un-claimed (still 'pending', no error recorded)
-- instead of being claimed and immediately cascading to its own failure.
-- Everything else in this function (pause gate, chapter gate, claim
-- attempts) is unchanged from 20261001140000.
create or replace function public.claim_long_form_scene_for_render(p_visual_world_version_id uuid)
returns setof public.long_form_scenes
language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_scenes s set status='failed', lease_until=null, last_error_code='CLAIMS_EXHAUSTED', last_error_at=now()
  where s.visual_world_version_id = p_visual_world_version_id and s.job_id is null and s.status in ('pending','running')
    and s.claim_attempts >= 3 and (s.lease_until is null or s.lease_until < now());

  return query update public.long_form_scenes s set status='running', claim_attempts=s.claim_attempts+1, lease_until=now()+interval '4 minutes', updated_at=now()
  from (
    select sc.id, srp.source_scene_render_plan_id
    from public.long_form_scenes sc
    join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
    where sc.visual_world_version_id = p_visual_world_version_id
      and sc.job_id is null
      and sc.claim_attempts < 3
      and (sc.status = 'pending' or (sc.status = 'running' and sc.lease_until < now()))
      and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id)
      -- EMERGENCY PAUSE GATE: never claim a scene belonging to a paused
      -- generation run. A scene with no generation_run_id at all (legacy/
      -- edit rows outside the episode-generation flow) is unaffected.
      and not exists (
        select 1 from public.long_form_episode_generation_charges g
        where g.id = sc.generation_run_id and g.is_paused = true
      )
      -- CHAPTER GATE: a scene attached to a gated generation run is only
      -- claimable up to that run's current chapter boundary. A scene with
      -- no generation_run_id, or whose run never set a boundary, is
      -- unaffected (ordinary ungated behavior).
      and not exists (
        select 1 from public.long_form_episode_generation_charges g
        where g.id = sc.generation_run_id
          and g.chapter_gate_boundary_sequence_index is not null
          and srp.sequence_index > g.chapter_gate_boundary_sequence_index
      )
      -- DEPENDENCY GATE (durable): a REUSE/CROP/COMPOSITE scene is only
      -- claimable once its source has genuinely succeeded, or the source is
      -- permanently exhausted — never while the source merely failed once
      -- and is still eligible for its own retry.
      and (
        srp.source_scene_render_plan_id is null
        or exists (
          select 1 from public.long_form_scenes src
          where src.scene_render_plan_id = srp.source_scene_render_plan_id
            and (src.status = 'succeeded' or (src.status = 'failed' and src.claim_attempts >= 3))
            and not exists (select 1 from public.long_form_scenes newer2 where newer2.replaces_scene_id = src.id)
        )
      )
    order by srp.sequence_index limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;
revoke all on function public.claim_long_form_scene_for_render(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_scene_for_render(uuid) to service_role;
