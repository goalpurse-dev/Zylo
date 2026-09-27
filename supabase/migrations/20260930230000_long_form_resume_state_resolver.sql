-- ONE authoritative Long Form project-resume resolver (2026-09-15).
--
-- Real bug this fixes: opening the Mars project from the lobby sent the
-- user back to Storyboard/Look, which then claimed "Build Visual World →"
-- even though a real, approved Visual World and an active 201-credit Scene
-- Generation run already existed. Root cause (confirmed by audit): the only
-- existing resume resolver, deriveProjectStageInfo (src/pages/workspace/
-- long-form/projectStage.js), only ever inspects Story/Script/Storyboard
-- pointers — it has NO awareness of Visual World or Scene Generation at
-- all, so its ceiling is structurally "Look" for every project, no matter
-- how far downstream work has actually progressed. Frontend bulk queries
-- (fetchUserLongFormProjects) never even fetched Visual World status or
-- scene/charge data to begin with.
--
-- This function computes the two tiers that actually need real backend
-- joins (Visual World completeness, Scene Generation activity) from DURABLE
-- truth only — the project's CURRENT visual_plan_version_id, the Visual
-- World version built against THAT SAME plan version (never a stale/
-- retired one), and scenes/charges scoped to that current world. The
-- existing JS resolver (projectStage.js) keeps deciding Story/Idea sub-
-- stages (that logic was already correct) but now checks this backend
-- state FIRST and defers to it whenever it reports past-Look progress —
-- see projectStage.js's updated deriveProjectStageInfo.
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

  -- The Visual World built against the CURRENT plan version specifically —
  -- never an older plan's world (Part 7: "do not accidentally infer current
  -- stage from a retired VisualPlan"). Reads the real row directly rather
  -- than trusting project.current_visual_world_version_id, which (per
  -- reconcile_visual_world_completion_status) is only updated on a status
  -- TRANSITION and is guarded by the plan pointer still matching — it can
  -- lag behind or never get set even though a real, usable world row
  -- exists.
  select * into world from public.long_form_visual_world_versions
    where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id
    order by version desc limit 1;

  if world.id is null then
    return jsonb_build_object('stage', 'visual_plan_ready', 'route', 'look', 'visualPlanStatus', plan.status);
  end if;

  -- Scene Generation state, scoped to (this world, this plan version) only
  -- — an active charge, any compiled SceneRenderPlans, or any scene rows at
  -- all are each independently sufficient proof generation has begun (Part
  -- 3: "do NOT require scenes to be fully complete before routing to
  -- Generate" — a single compiled plan or a charged-but-not-yet-compiled
  -- run both count).
  select * into charge from public.long_form_episode_generation_charges
    where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id and status = 'charged';

  select exists(
    select 1 from public.long_form_scene_render_plans
    where visual_world_version_id = world.id and visual_plan_version_id = proj.current_visual_plan_version_id
  ) into has_current_plans;

  if charge.id is null and not has_current_plans then
    -- Visual World exists for the current plan, but Scene Generation has
    -- not begun at all yet.
    return jsonb_build_object('stage', 'visual_world', 'route', 'visual-world', 'visualWorldStatus', world.status);
  end if;

  -- Scene Generation HAS begun (Part 3 — this must win over Look/Visual
  -- World regardless of completeness). Counts are display-only (for the
  -- lobby card and Generate's own summary), scoped to CURRENT (non-
  -- replaced) scenes for this exact world.
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
revoke all on function public.long_form_project_resume_state(uuid) from public, anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated, service_role;

-- Bulk variant for the lobby list — one query, no per-row round trip; scope
-- is always the CALLER's own projects, by construction (starts from
-- `where user_id = auth.uid()`), so this can never leak another user's
-- resume state even though the underlying function is security definer.
create or replace function public.my_long_form_project_resume_states()
returns table(project_id uuid, resume jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, public.long_form_project_resume_state(p.id)
  from public.long_form_projects p
  where p.user_id = auth.uid()
$$;
revoke all on function public.my_long_form_project_resume_states() from public, anon;
grant execute on function public.my_long_form_project_resume_states() to authenticated;
