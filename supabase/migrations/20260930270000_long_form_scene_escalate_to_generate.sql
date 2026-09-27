-- Escalate a weak EDIT to a fresh GENERATE (2026-09-15 "content grounding +
-- UX" pass, item 5: "if [the promised visual delta] is not happening,
-- escalate it to NEW SCENE").
--
-- Real gap this closes: retry_long_form_scene deliberately NEVER rewrites
-- render_strategy (a failed EDIT always retries as the same EDIT with the
-- same weak instruction) — correct for a genuine provider hiccup, wrong for
-- an EDIT that produced a near-duplicate of its source (qa_result.
-- visualDeltaSatisfied = false, from the perceptual-hash check added in the
-- prior QA-calibration pass). Retrying that identically would just pay for
-- the same failure again. This creates a NEW SceneRenderPlan version for the
-- SAME beat with render_strategy = 'GENERATE' — a real new visual setup,
-- independent of the source frame that failed to change — and a new scene
-- row against it, priced at the tier's GENERATE cost (never the EDIT cost,
-- since real new compute/a real new renderer call is being paid for).
--
-- The actual reference-resolution + prompt compilation (which needs the
-- VisualPlan JSON + LLM-authored director_meta + a live resolve_canonical_
-- reference lookup) happens in the calling edge function
-- (escalate-long-form-scene-to-generate) — mirroring how start-long-form-
-- scene-generation compiles a GENERATE beat. This function's job is only the
-- atomic charge + row creation, exactly like retry_long_form_scene's own
-- split of concerns.

alter table public.long_form_scene_operation_charges drop constraint if exists long_form_scene_operation_charges_operation_check;
alter table public.long_form_scene_operation_charges add constraint long_form_scene_operation_charges_operation_check
  check (operation in ('regenerate', 'edit', 'escalate_generate'));

-- estimate_scene_operation_credits gains the 'escalate_generate' operation —
-- always the tier's GENERATE price, regardless of the scene's current
-- render_strategy (unlike 'regenerate', which prices whatever the scene
-- already is).
create or replace function public.estimate_scene_operation_credits(p_scene_id uuid, p_operation text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare sc public.long_form_scenes; rp public.long_form_scene_render_plans; v public.long_form_visual_world_versions;
begin
  if p_operation not in ('regenerate', 'edit', 'escalate_generate') then raise exception 'INVALID_OPERATION'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  if not exists (select 1 from public.long_form_projects p where p.id = v.project_id and (p.user_id = auth.uid() or auth.role() = 'service_role')) then
    raise exception 'SCENE_NOT_FOUND';
  end if;
  if p_operation = 'edit' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'edit', 'model', 'image:qwen.image-edit-plus');
  end if;
  if p_operation = 'escalate_generate' then
    return jsonb_build_object('credits', public.long_form_tier_generate_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'escalate_generate', 'model', public.long_form_tier_primary_tool_key(rp.render_tier));
  end if;
  if sc.render_strategy = 'EDIT' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', 'image:qwen.image-edit-plus');
  end if;
  return jsonb_build_object('credits', public.long_form_tier_generate_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', public.long_form_tier_primary_tool_key(rp.render_tier));
end $$;

create or replace function public.escalate_long_form_scene_to_generate(p_scene_id uuid, p_user_id uuid, p_image_prompt text, p_reference_asset_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int; new_plan_id uuid; new_base_key text;
begin
  if coalesce(trim(p_image_prompt), '') = '' then raise exception 'MISSING_IMAGE_PROMPT'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status not in ('succeeded', 'failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if sc.render_strategy <> 'EDIT' then raise exception 'NOT_AN_EDIT_SCENE'; end if;

  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  price := public.long_form_tier_generate_credits(rp.render_tier);
  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today, 0) + price where id = p_user_id;

  -- A fresh, independent visual setup for this one beat — never the old
  -- EDIT's baseSetupKey, which named the setup that just failed to change.
  new_base_key := coalesce(rp.base_setup_key, rp.visual_beat_id) || '__escalated_' || substr(sc.id::text, 1, 8);

  insert into public.long_form_scene_render_plans(
    project_id, visual_world_version_id, visual_plan_version_id, visual_beat_id, plan_version,
    chapter_id, sequence_index, narration_segment_ids, start_seconds, end_seconds,
    communication_goal, narrative_function, scene_type, continuity_group_id, base_setup_key,
    composition, world_state_before, world_state_after,
    render_strategy, source_scene_render_plan_id, reference_asset_ids, image_prompt, overlay_spec, motion_intent,
    factual_constraints, forbidden_elements, qa_expectations,
    style_preset_id, style_contract_version, compiler_version, render_tier, director_meta
  )
  select
    src_rp.project_id, src_rp.visual_world_version_id, src_rp.visual_plan_version_id, src_rp.visual_beat_id, src_rp.plan_version + 1,
    src_rp.chapter_id, src_rp.sequence_index, src_rp.narration_segment_ids, src_rp.start_seconds, src_rp.end_seconds,
    src_rp.communication_goal, src_rp.narrative_function, src_rp.scene_type, src_rp.continuity_group_id, new_base_key,
    src_rp.composition, src_rp.world_state_before, src_rp.world_state_after,
    'GENERATE', null, p_reference_asset_ids, p_image_prompt, null, src_rp.motion_intent,
    src_rp.factual_constraints, src_rp.forbidden_elements, src_rp.qa_expectations,
    src_rp.style_preset_id, src_rp.style_contract_version, src_rp.compiler_version, src_rp.render_tier, src_rp.director_meta
  from public.long_form_scene_render_plans src_rp where src_rp.id = sc.scene_render_plan_id
  returning id into new_plan_id;

  insert into public.long_form_scenes(scene_render_plan_id, visual_world_version_id, visual_beat_id, render_strategy, replaces_scene_id, credits_charged, input_reference_asset_ids, generation_run_id)
  values(new_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'GENERATE', sc.id, price, p_reference_asset_ids, sc.generation_run_id)
  returning id into replacement_id;

  insert into public.long_form_scene_operation_charges(scene_id, project_id, user_id, operation, tier, credits)
  values(replacement_id, v.project_id, p_user_id, 'escalate_generate', rp.render_tier, price);

  return replacement_id;
end $$;
revoke all on function public.escalate_long_form_scene_to_generate(uuid, uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.escalate_long_form_scene_to_generate(uuid, uuid, text, uuid[]) to service_role;
