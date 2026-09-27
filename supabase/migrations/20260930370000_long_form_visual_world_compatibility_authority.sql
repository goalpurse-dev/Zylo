-- 2026-09-19 forensic fix #2 — real Mars incident, shipping blocker.
--
-- Real repro (read-only, verified live): project 49a18b78, current plan
-- 56a0e0b5 (v5), current visual world d64cce75 (v2) — world.status='ready'
-- and world.visual_plan_version_id = 56a0e0b5, i.e. the world IS genuinely
-- ready and compatible with the current plan. Yet
-- long_form_project_resume_state kept returning route='visual-world',
-- producing an infinite Storyboard -> Visual World -> Scenes -> "Visual
-- World update required" -> Visual World loop, while the Generate page
-- (which reads scene/plan data independently) correctly priced the new
-- 136-scene / 242-credit quote. Contradictory truth from two code paths.
--
-- Root cause: the previous fix (20260930340000) added a routing gate
--   if not charge_matches_plan and not has_current_plans then route := 'visual-world'
-- to stop a STALE charge (for an old, superseded plan) from making Generate
-- look like a run was already in progress. But that gate fires on the
-- absence of ANY charge or scene-render-plan for the current pairing --
-- which is true for every plan the very first time it reaches Generate,
-- even when the Visual World is already 100% ready and plan-compatible.
-- It conflated two unrelated questions:
--   (a) "is the Visual World ready and does it belong to the current plan?"
--   (b) "has generation actually been dispatched for this pairing yet?"
-- (b) should only ever affect what STATS are shown inside the generate
-- stage (so a stale old-plan charge is never mistaken for an active run);
-- it must never gate the ROUTE away from 'generate'. Only (a) should.
--
-- Fix: extract (a) into one authoritative SQL function,
-- long_form_visual_world_compatibility(project_id), that is the single
-- source of truth for "is the current Visual World compatible+ready for
-- the current VisualPlan" -- resolving the durable world pointer but
-- verifying (not blindly trusting) that it actually belongs to the current
-- plan, falling back to a by-plan lookup if the pointer is stale/absent.
-- long_form_project_resume_state now gates routing on this function alone;
-- charge/scene-plan matching is demoted to informational fields carried
-- inside the 'generate' stage payload (staleChargeForDifferentPlan /
-- staleChargeCreditsCharged), never a redirect away from Generate.
--
-- No historical data mutated. No provider calls. Read-only diagnosis only;
-- this migration only changes function bodies.

create or replace function public.long_form_visual_world_compatibility(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id = auth.uid() or auth.role() = 'service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('compatible', false, 'visualPlanVersionId', null, 'visualWorldVersionId', null, 'worldStatus', null, 'reason', 'no_current_plan');
  end if;

  -- Prefer the durable pointer, but only trust it if it actually belongs to
  -- the current plan -- a stale pointer left over from before the plan was
  -- replanned must not be reported as compatible just because it exists.
  if proj.current_visual_world_version_id is not null then
    select * into world from public.long_form_visual_world_versions
      where id = proj.current_visual_world_version_id
        and visual_plan_version_id = proj.current_visual_plan_version_id;
  end if;

  -- Fall back to the newest world actually built for the current plan,
  -- covering both "pointer never advanced" and "pointer stale/mismatched".
  if world.id is null then
    select * into world from public.long_form_visual_world_versions
      where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id
      order by version desc limit 1;
  end if;

  if world.id is null then
    return jsonb_build_object(
      'compatible', false, 'visualPlanVersionId', proj.current_visual_plan_version_id,
      'visualWorldVersionId', null, 'worldStatus', null, 'reason', 'no_world_for_current_plan'
    );
  end if;

  return jsonb_build_object(
    'compatible', world.status = 'ready',
    'visualPlanVersionId', proj.current_visual_plan_version_id,
    'visualWorldVersionId', world.id,
    'worldStatus', world.status,
    'reusableReferenceCount', world.reused_asset_count,
    'newReferenceCount', world.new_asset_count,
    'reason', case when world.status = 'ready' then null else 'world_not_ready' end
  );
end $$;
revoke all on function public.long_form_visual_world_compatibility(uuid) from public, anon;
grant execute on function public.long_form_visual_world_compatibility(uuid) to authenticated, service_role;

create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions;
  compat jsonb; world_id uuid;
  charge public.long_form_episode_generation_charges; total_beats int; scene_counts jsonb; has_current_plans boolean;
  charge_matches_plan boolean;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id = auth.uid() or auth.role() = 'service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('stage', 'none', 'route', null);
  end if;
  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;

  compat := public.long_form_visual_world_compatibility(p_project_id);

  if (compat->>'visualWorldVersionId') is null then
    return jsonb_build_object('stage', 'visual_plan_ready', 'route', 'look', 'visualPlanStatus', plan.status);
  end if;

  -- The one authoritative gate: route to Visual World only when the world
  -- itself is not ready/compatible for the CURRENT plan. Whether a charge
  -- or scene-render-plan already exists is irrelevant to this decision --
  -- a ready, compatible world always means the user can reach Generate,
  -- including the very first time (zero charge, zero scene plans yet).
  if not (compat->>'compatible')::boolean then
    return jsonb_build_object(
      'stage', 'visual_world', 'route', 'visual-world', 'visualWorldStatus', compat->>'worldStatus'
    );
  end if;

  world_id := (compat->>'visualWorldVersionId')::uuid;

  if proj.active_generation_charge_id is not null then
    select * into charge from public.long_form_episode_generation_charges where id = proj.active_generation_charge_id;
  end if;

  -- Informational only from here down: a charge belonging to a superseded
  -- plan must never be mistaken for proof the CURRENT plan is generating,
  -- but it also must never block reaching Generate for the current plan.
  charge_matches_plan := charge.id is not null and charge.visual_plan_version_id = proj.current_visual_plan_version_id;

  select exists(
    select 1 from public.long_form_scene_render_plans
    where visual_world_version_id = world_id and visual_plan_version_id = proj.current_visual_plan_version_id
  ) into has_current_plans;

  select jsonb_build_object(
    'ready', count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'approved'),
    'needsReview', count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'rejected'),
    'failed', count(*) filter (where sc.status = 'failed'),
    'generating', count(*) filter (where sc.status = 'running'),
    'queued', count(*) filter (where sc.status = 'pending'),
    'compiled', count(*)
  )
  into scene_counts
  from public.long_form_scenes sc
  join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
  where srp.visual_world_version_id = world_id
    and srp.visual_plan_version_id = proj.current_visual_plan_version_id
    and sc.generation_run_id is not distinct from proj.active_generation_charge_id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'), (plan.storyboard_summary->>'totalVisualBeats')::int, 0);

  return jsonb_build_object(
    'stage', 'generate', 'route', 'generate',
    'visualWorldStatus', compat->>'worldStatus',
    'chargeExists', charge_matches_plan,
    'creditsCharged', case when charge_matches_plan then charge.credits_charged else null end,
    'staleChargeForDifferentPlan', charge.id is not null and not charge_matches_plan and not has_current_plans,
    'staleChargeCreditsCharged', case when charge.id is not null and not charge_matches_plan and not has_current_plans then charge.credits_charged else null end,
    'totalBeats', total_beats,
    'ready', coalesce((scene_counts->>'ready')::int, 0),
    'needsReview', coalesce((scene_counts->>'needsReview')::int, 0),
    'failed', coalesce((scene_counts->>'failed')::int, 0),
    'generating', coalesce((scene_counts->>'generating')::int, 0),
    'queued', coalesce((scene_counts->>'queued')::int, 0),
    'planned', greatest(0, total_beats - coalesce((scene_counts->>'compiled')::int, 0))
  );
end $$;
revoke all on function public.long_form_project_resume_state(uuid) from public, anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated, service_role;
