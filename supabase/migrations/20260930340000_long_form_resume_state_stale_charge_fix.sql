-- 2026-09-19 forensic fix — real Mars incident.
--
-- Root cause of "136 scenes stuck at 0/136 Planned, UI behaves as though a
-- generation run exists": long_form_project_resume_state's own
-- `if charge.id is null and not has_current_plans` gate trusted ANY
-- existing active_generation_charge_id as proof the CURRENT plan had
-- started generating — even when that charge's own visual_plan_version_id
-- pointed at a DIFFERENT, already-superseded VisualPlanVersion (exactly
-- what happens after "Replan Episode Visuals" -> "Use This Plan": the plan
-- pointer moves, but the OLD plan's charge stays 'charged' and
-- active_generation_charge_id is untouched, by design — see
-- adopt_visual_plan_version's own comment, which correctly leaves billing
-- history alone).
--
-- Real Mars reproduction verified read-only: current_visual_plan_version_id
-- = 56a0e0b5 (v5, adopted), active_generation_charge_id = 7b045213 (a real
-- 220-credit charge, status='charged', but visual_plan_version_id =
-- e65b6e53 = v4, NOT v5). Zero long_form_scene_render_plans exist for
-- (v5, the current world) — start-long-form-scene-generation was never
-- invoked for v5 at all. The old function returned chargeExists:true,
-- creditsCharged:220, totalBeats:136 (from v5), ready:0 — a truthful-
-- looking but fundamentally mismatched combination the frontend had no way
-- to detect, since a real, currently-'charged' row genuinely did exist.
--
-- Fix: a charge only counts as proof of "this plan is generating" when its
-- own visual_plan_version_id matches the CURRENT plan. A charge that
-- exists but belongs to a superseded plan routes back to 'visual_world'
-- (not deleted, not superseded, not touched at all — this function is
-- read-only) with an honest `staleChargeForDifferentPlan` flag, so the
-- Visual World page can explain what's actually going on instead of the
-- Generate page silently showing 0% with no explanation.
create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
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

  if proj.active_generation_charge_id is not null then
    select * into charge from public.long_form_episode_generation_charges where id = proj.active_generation_charge_id;
  end if;

  -- The one real fix: a charge is only trusted as "the current plan has
  -- started generating" when it was actually charged FOR the current plan.
  charge_matches_plan := charge.id is not null and charge.visual_plan_version_id = proj.current_visual_plan_version_id;

  select exists(
    select 1 from public.long_form_scene_render_plans
    where visual_world_version_id = world.id and visual_plan_version_id = proj.current_visual_plan_version_id
  ) into has_current_plans;

  if not charge_matches_plan and not has_current_plans then
    return jsonb_build_object(
      'stage', 'visual_world', 'route', 'visual-world', 'visualWorldStatus', world.status,
      'staleChargeForDifferentPlan', charge.id is not null,
      'staleChargeCreditsCharged', case when charge.id is not null then charge.credits_charged else null end
    );
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
    and sc.generation_run_id is not distinct from proj.active_generation_charge_id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'), (plan.storyboard_summary->>'totalVisualBeats')::int, 0);

  return jsonb_build_object(
    'stage', 'generate', 'route', 'generate',
    'visualWorldStatus', world.status,
    'chargeExists', charge_matches_plan,
    'creditsCharged', case when charge_matches_plan then charge.credits_charged else null end,
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
