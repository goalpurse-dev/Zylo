-- 2026-09-22 "FINAL stabilization pass" §3 — a REUSE/CROP/COMPOSITE scene
-- must never be claimable while its source has succeeded but FAILED QA.
--
-- Real Atlantis finding (live-state evidence): Shot 1 = GENERATE, QA =
-- rejected; Shot 2 = REUSE of Shot 1, claimed and resolved anyway, QA =
-- approved with the reason "zero-cost reuse of an already-approved scene" —
-- a false statement. Same pattern: Shot 3 rejected, Shot 5 (REUSE) approved.
--
-- 20261001180000 already fixed the status-only half of this dependency gate
-- (a source that's merely failed-but-retriable must not let its dependent
-- get claimed and cascade to its own permanent failure). This migration adds
-- the missing qa_status dimension on top of that: a source with
-- status='succeeded' is only a valid dependency if it is ALSO qa_status IS
-- NULL (legacy/never independently re-checked — treated as approved,
-- matching this codebase's existing convention elsewhere, e.g.
-- acceptedIdentityAnchor in referenceRendererPolicy.js) or qa_status =
-- 'approved'. A succeeded-but-rejected source now correctly leaves its
-- dependent un-claimed (BLOCKED_BY_SOURCE, still 'pending', no error
-- recorded) instead of being claimed and inheriting a false approval.
--
-- Companion JS fix (advance-long-form-scene-generation/index.ts,
-- processZeroCostScene): defense-in-depth for a scene already claimed
-- before its source was rejected out from under it — throws
-- REUSE_SOURCE_REJECTED / CROP_SOURCE_REJECTED / COMPOSITE_SOURCE_REJECTED
-- rather than silently inheriting qa_status:'approved'. Everything else in
-- this function is unchanged from 20261001180000.
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
      -- DEPENDENCY GATE (durable, QA-aware): a REUSE/CROP/COMPOSITE scene is
      -- only claimable once its source has genuinely succeeded AND passed
      -- (or was never independently) QA'd, or the source is permanently
      -- exhausted. A source that succeeded but is qa_status='rejected' must
      -- never let its dependent proceed — that dependent stays blocked,
      -- exactly like a source that's still generating.
      and (
        srp.source_scene_render_plan_id is null
        or exists (
          select 1 from public.long_form_scenes src
          where src.scene_render_plan_id = srp.source_scene_render_plan_id
            and (
              (src.status = 'succeeded' and (src.qa_status is null or src.qa_status = 'approved'))
              or (src.status = 'failed' and src.claim_attempts >= 3)
            )
            and not exists (select 1 from public.long_form_scenes newer2 where newer2.replaces_scene_id = src.id)
        )
      )
    order by srp.sequence_index limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;
revoke all on function public.claim_long_form_scene_for_render(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_scene_for_render(uuid) to service_role;
