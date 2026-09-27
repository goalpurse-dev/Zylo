-- Third real bug found verifying against Mars: the scene-counting query
-- scoped by `visual_world_version_id` alone counted 143 "current" scenes,
-- not 136 — 7 of them belong to visual_beat_ids from the OLD (pre-replan)
-- 115-beat plan that the current 136-beat plan doesn't even contain
-- (specifically the 7 old scenes deliberately left un-reconciled/history-
-- only during the density-replan migration, whose ids were shifted to
-- avoid colliding with the new plan's own beats — they're still real,
-- still "current" with respect to their OWN replaces_scene_id chain, but
-- they don't belong to the ACTIVE plan version at all). A Visual World
-- persists across a shot-density replan (see the previous fix), but scenes
-- must still be scoped to the plan version whose SceneRenderPlans they
-- actually belong to. Fix: inner-join through long_form_scene_render_plans
-- filtered to the CURRENT visual_plan_version_id, rather than trusting
-- long_form_scenes.visual_world_version_id alone.
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
  where srp.visual_world_version_id = world.id
    and srp.visual_plan_version_id = proj.current_visual_plan_version_id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'), (plan.storyboard_summary->>'totalVisualBeats')::int, 0);

  return jsonb_build_object(
    'stage', 'generate', 'route', 'generate',
    'visualWorldStatus', world.status,
    'chargeExists', charge.id is not null,
    'creditsCharged', charge.credits_charged,
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
