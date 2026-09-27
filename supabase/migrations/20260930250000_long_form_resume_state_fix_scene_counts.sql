-- Second real bug found while verifying against Mars: the previous
-- version's scene-counting query selected SIX aggregate columns
-- (ready/needs_review/failed/generating/queued/compiled) into a SINGLE
-- `jsonb` target variable (`into scene_counts`) — a target-count mismatch
-- that silently produced all-zero counts (PL/pgSQL only assigns the first
-- column, and count(*) as a bare bigint doesn't carry field names into a
-- jsonb variable) rather than raising a visible error. Verified live
-- against Mars: the fixed version below correctly returns ready=67,
-- generating=9, queued=60, failed=1 (excluding the 2 pre-existing
-- historical failures whose rows were superseded by a replacement, so they
-- don't count as CURRENT), compiled=136 — matching the real, independently-
-- confirmed state from the immediately preceding task. Fix: build the
-- jsonb object directly in the query so there is exactly one result column
-- for the one target variable.
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
    'needsReview', coalesce((scene_counts->>'needsReview')::int, 0),
    'failed', coalesce((scene_counts->>'failed')::int, 0),
    'generating', coalesce((scene_counts->>'generating')::int, 0),
    'queued', coalesce((scene_counts->>'queued')::int, 0),
    'planned', greatest(0, total_beats - coalesce((scene_counts->>'compiled')::int, 0))
  );
end $$;
revoke all on function public.long_form_project_resume_state(uuid) from public, anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated, service_role;
