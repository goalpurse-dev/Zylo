-- 2026-09-22 "Fix Storyboard" targeted repair — atomically persists a
-- repaired VisualPlan version and switches the project's current pointer to
-- it, exactly mirroring save_storyboard_edits's own staleness/ownership
-- checks and versioning shape (new version, parent pointer, never a
-- destructive overwrite of the source). The actual repair COMPUTATION
-- (re-running the deterministic shot-planner pipeline with the fixed
-- fragment-prevention logic) happens in the calling edge function
-- (repair-long-form-storyboard) — this RPC only ever persists an
-- already-computed, already-validated plan; it never generates content and
-- never touches billing.
create or replace function public.apply_long_form_storyboard_repair(
  p_source_id uuid, p_user_id uuid, p_repaired_plan jsonb, p_storyboard_summary jsonb, p_repair_meta jsonb
) returns public.long_form_visual_plan_versions language plpgsql security definer set search_path = '' as $$
declare src public.long_form_visual_plan_versions; dest public.long_form_visual_plan_versions; owner public.long_form_projects; n int;
begin
  select * into src from public.long_form_visual_plan_versions where id = p_source_id for update;
  if not found then raise exception 'SOURCE_PLAN_NOT_FOUND'; end if;
  select * into owner from public.long_form_projects where id = src.project_id and user_id = p_user_id for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if src.status <> 'ready' then raise exception 'SOURCE_PLAN_NOT_READY'; end if;
  -- The exact same "storyboard changed under you" guard save_storyboard_edits
  -- uses — a repair computed against a plan that is no longer the project's
  -- current one must never silently apply itself over newer work.
  if owner.current_script_version_id <> src.script_version_id or owner.current_visual_plan_version_id is distinct from src.id then
    raise exception 'STORYBOARD_CHANGED';
  end if;
  if exists (select 1 from public.long_form_visual_plan_versions where project_id = src.project_id and script_version_id = src.script_version_id and status = 'planning') then
    raise exception 'REPLAN_IN_PROGRESS';
  end if;
  select coalesce(max(version), 0) + 1 into n from public.long_form_visual_plan_versions where project_id = src.project_id and script_version_id = src.script_version_id;
  insert into public.long_form_visual_plan_versions(
    project_id, script_version_id, version, status, stage, parent_visual_plan_version_id,
    visual_mode, visual_plan, entity_registry, continuity_groups, world_state_model, storyboard_summary, generation_model, meta
  ) values (
    src.project_id, src.script_version_id, n, 'ready', 'finalizing', src.id,
    src.visual_mode, p_repaired_plan, src.entity_registry, src.continuity_groups, src.world_state_model, p_storyboard_summary, src.generation_model,
    jsonb_build_object('source', 'semantic_duplicate_repair', 'repairSourceVersionId', src.id, 'modelCalls', 0, 'estimatedTotalCostUsd', 0) || p_repair_meta
  ) returning * into dest;
  update public.long_form_projects set current_visual_plan_version_id = dest.id, updated_at = now() where id = src.project_id;
  -- This repair NEVER changes entity_registry/continuity_groups (copied
  -- verbatim from the source plan above) — the repaired plan's canonical
  -- reference NEEDS are identical to the plan it replaces by construction,
  -- only its beat/shot structure changed. long_form_visual_world_
  -- compatibility's own world_plan_mismatch check would otherwise block an
  -- already-fully-covering, already-adopted Visual World purely because its
  -- visual_plan_version_id still points at the superseded plan — re-point
  -- it here (zero cost, zero provider/LLM call, no new version, no
  -- reference change) rather than forcing an unnecessary reconciliation.
  -- Only ever re-points a world that was pointed at the EXACT plan this
  -- repair just superseded — never touches a world already associated with
  -- some other/newer plan.
  update public.long_form_visual_world_versions set visual_plan_version_id = dest.id
  where id = owner.current_visual_world_version_id and visual_plan_version_id = src.id;
  return dest;
end $$;
revoke all on function public.apply_long_form_storyboard_repair(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_long_form_storyboard_repair(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
