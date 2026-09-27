-- 2026-09-21 EMERGENCY (follow-up): "Retry logic must exclude paused
-- generations" — retry_long_form_scene, edit_long_form_scene,
-- escalate_long_form_scene_to_generate, and regenerate_long_form_graphic
-- all charge credits (except the graphic one, which is 0-cost but still
-- creates a scene row) and insert a new long_form_scenes row that would
-- otherwise sit stuck forever once claim_long_form_scene_for_render
-- excludes it as belonging to a paused run — charging a user for work that
-- can never be submitted while paused. Each function now refuses with
-- GENERATION_PAUSED before charging or inserting anything, once the
-- existing scene row (and therefore its generation_run_id) is loaded.
-- Every other line is copied verbatim from each function's current
-- definition (20260930320000 for retry, 20260930210000 for edit,
-- 20260930300000 for escalate, 20260930320000 for the graphic regenerate).

create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int; run_paused boolean;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;

  if sc.generation_run_id is not null then
    select is_paused into run_paused from public.long_form_episode_generation_charges where id = sc.generation_run_id;
    if run_paused then raise exception 'GENERATION_PAUSED'; end if;
  end if;

  if sc.status = 'failed' and sc.job_id is null then
    update public.long_form_scenes set status='pending', claim_attempts=0, lease_until=null, last_error_code=null, last_error_at=null, updated_at=now() where id = sc.id;
    replacement_id := sc.id;
  else
    select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
    if sc.render_strategy = 'PROGRAMMATIC_GRAPHIC' then
      price := 0;
    elsif sc.render_strategy = 'EDIT' then
      price := public.long_form_tier_edit_credits(rp.render_tier);
    else
      price := public.long_form_tier_generate_credits(rp.render_tier);
    end if;
    if price > 0 then
      select credit_balance into balance from public.profiles where id = p_user_id for update;
      if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
      update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
    end if;
    insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,credits_charged,input_reference_asset_ids,generation_run_id)
    values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, sc.render_strategy, sc.id, price, sc.input_reference_asset_ids, sc.generation_run_id) returning id into replacement_id;
    insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
    values(replacement_id, v.project_id, p_user_id, 'regenerate', rp.render_tier, price);
  end if;
  return replacement_id;
end $$;

create or replace function public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; trimmed text; replacement_id uuid; price int; balance int; run_paused boolean;
begin
  trimmed := trim(coalesce(p_instruction, ''));
  if length(trimmed) < 3 or length(trimmed) > 800 then raise exception 'INVALID_INSTRUCTION'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status <> 'succeeded' or sc.result_url is null then raise exception 'NOTHING_TO_EDIT'; end if;

  if sc.generation_run_id is not null then
    select is_paused into run_paused from public.long_form_episode_generation_charges where id = sc.generation_run_id;
    if run_paused then raise exception 'GENERATION_PAUSED'; end if;
  end if;

  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  price := public.long_form_tier_edit_credits(rp.render_tier);
  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,edit_instruction,input_reference_asset_ids,credits_charged,generation_run_id)
  values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'EDIT', sc.id, trimmed, sc.input_reference_asset_ids, price, sc.generation_run_id) returning id into replacement_id;
  insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
  values(replacement_id, v.project_id, p_user_id, 'edit', rp.render_tier, price);
  return replacement_id;
end $$;

create or replace function public.escalate_long_form_scene_to_generate(p_scene_id uuid, p_user_id uuid, p_image_prompt text, p_reference_asset_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int; new_plan_id uuid; new_base_key text; run_paused boolean;
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

  if sc.generation_run_id is not null then
    select is_paused into run_paused from public.long_form_episode_generation_charges where id = sc.generation_run_id;
    if run_paused then raise exception 'GENERATION_PAUSED'; end if;
  end if;

  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  price := public.long_form_tier_generate_credits(rp.render_tier);
  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today, 0) + price where id = p_user_id;

  new_base_key := coalesce(rp.base_setup_key, rp.visual_beat_id) || '__escalated_' || substr(sc.id::text, 1, 8);

  insert into public.long_form_scene_render_plans(
    project_id, visual_world_version_id, visual_plan_version_id, visual_beat_id, plan_version,
    chapter_id, sequence_index, narration_segment_ids, start_seconds, end_seconds,
    communication_goal, narrative_function, scene_type, continuity_group_id, base_setup_key,
    composition, world_state_before, world_state_after,
    render_strategy, source_scene_render_plan_id, reference_asset_ids, image_prompt, overlay_spec, motion_intent,
    factual_constraints, forbidden_elements, qa_expectations,
    style_preset_id, style_contract_version, compiler_version, render_tier, director_meta, narration_claim_id
  )
  select
    src_rp.project_id, src_rp.visual_world_version_id, src_rp.visual_plan_version_id, src_rp.visual_beat_id, src_rp.plan_version + 1,
    src_rp.chapter_id, src_rp.sequence_index, src_rp.narration_segment_ids, src_rp.start_seconds, src_rp.end_seconds,
    src_rp.communication_goal, src_rp.narrative_function, src_rp.scene_type, src_rp.continuity_group_id, new_base_key,
    src_rp.composition, src_rp.world_state_before, src_rp.world_state_after,
    'GENERATE', null, p_reference_asset_ids, p_image_prompt, null, src_rp.motion_intent,
    src_rp.factual_constraints, src_rp.forbidden_elements, src_rp.qa_expectations,
    src_rp.style_preset_id, src_rp.style_contract_version, src_rp.compiler_version, src_rp.render_tier, src_rp.director_meta, src_rp.narration_claim_id
  from public.long_form_scene_render_plans src_rp where src_rp.id = sc.scene_render_plan_id
  returning id into new_plan_id;

  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,credits_charged,input_reference_asset_ids,generation_run_id)
  values(new_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'GENERATE', sc.id, price, p_reference_asset_ids, sc.generation_run_id) returning id into replacement_id;
  insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
  values(replacement_id, v.project_id, p_user_id, 'escalate_generate', rp.render_tier, price);
  return replacement_id;
end $$;
