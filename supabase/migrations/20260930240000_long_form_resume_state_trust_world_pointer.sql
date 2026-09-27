-- Fix a real bug in the resume resolver itself, found immediately on
-- verifying it against the live Mars project: the first version looked up
-- Visual World by requiring `visual_plan_version_id = project.current_
-- visual_plan_version_id` exactly — but a shot-density-only replan (the
-- prior task's v1->v3 planner migration) bumped the project's
-- current_visual_plan_version_id to a NEW row while correctly leaving
-- current_visual_world_version_id untouched, since the entity registry
-- (characters/locations/objects the Visual World is actually built from)
-- was carried forward UNCHANGED — no new Visual World was ever needed. The
-- strict version therefore found "no world for this plan version" and
-- routed Mars straight back to Look, reproducing the exact bug this task
-- exists to fix.
--
-- Fix: trust project.current_visual_world_version_id directly — it is the
-- field specifically designed to represent "the currently valid world"
-- (set by reconcile_visual_world_completion_status) — rather than re-
-- deriving it from a plan-version match that assumes a 1:1 world-per-plan-
-- version relationship the product doesn't actually have. Only when that
-- pointer is unset do we fall back to checking whether any world was ever
-- built for the CURRENT plan version at all (a genuinely brand-new plan
-- with no world yet).
create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
  charge public.long_form_episode_generation_charges; total_beats int; scene_counts jsonb; has_current_plans boolean;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id = auth.uid() or auth.role() = 'service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('stage', 'none', 'route', null);
  end if;
  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;

  if proj.current_visual_world_version_id is not null then
    select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  end if;
  if world.id is null then
    -- No durable pointer set yet — only true for a project whose Visual
    -- World has never reached a real status transition. Fall back to a
    -- live check scoped to the CURRENT plan version specifically (never an
    -- older, retired one) in case a build is in flight but hasn't finished.
    select * into world from public.long_form_visual_world_versions
      where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id
      order by version desc limit 1;
  end if;

  if world.id is null then
    return jsonb_build_object('stage', 'visual_plan_ready', 'route', 'look', 'visualPlanStatus', plan.status);
  end if;

  select * into charge from public.long_form_episode_generation_charges
    where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id and status = 'charged';

  select exists(
    select 1 from public.long_form_scene_render_plans
    where visual_world_version_id = world.id and visual_plan_version_id = proj.current_visual_plan_version_id
  ) into has_current_plans;

  if charge.id is null and not has_current_plans then
    return jsonb_build_object('stage', 'visual_world', 'route', 'visual-world', 'visualWorldStatus', world.status);
  end if;

  select
    count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'approved') as ready,
    count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'rejected') as needs_review,
    count(*) filter (where sc.status = 'failed') as failed,
    count(*) filter (where sc.status = 'running') as generating,
    count(*) filter (where sc.status = 'pending') as queued,
    count(*) as compiled
  into scene_counts
  from public.long_form_scenes sc
  where sc.visual_world_version_id = world.id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'), (plan.storyboard_summary->>'totalVisualBeats')::int, 0);

  return jsonb_build_object(
    'stage', 'generate', 'route', 'generate',
    'visualWorldStatus', world.status,
    'chargeExists', charge.id is not null,
    'creditsCharged', charge.credits_charged,
    'totalBeats', total_beats,
    'ready', coalesce((scene_counts->>'ready')::int, 0),
    'needsReview', coalesce((scene_counts->>'needs_review')::int, 0),
    'failed', coalesce((scene_counts->>'failed')::int, 0),
    'generating', coalesce((scene_counts->>'generating')::int, 0),
    'queued', coalesce((scene_counts->>'queued')::int, 0),
    'planned', greatest(0, total_beats - coalesce((scene_counts->>'compiled')::int, 0))
  );
end $$;
