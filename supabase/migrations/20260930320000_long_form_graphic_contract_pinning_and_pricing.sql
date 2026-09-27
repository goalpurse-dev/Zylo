-- 2026-09-17 "fix the PROGRAMMATIC_GRAPHIC / educational-explainer system"
-- pass — Parts 4 and 12.
--
-- PART 4 (contract-version pinning): the audit found Mars's
-- current_narration_contract_version_id = NULL while its beats still
-- reference real claim IDs from a SPECIFIC contract version — proof that
-- "just read project.current_narration_contract_version_id" is not durable
-- provenance. narration_contract_version_id is added to
-- long_form_scene_render_plans (parallel to the existing narration_claim_id
-- column) so every compiled render plan durably records EXACTLY which
-- contract version its semantic interpretation came from, independent of
-- whatever the project's "current" pointer says later.
alter table public.long_form_scene_render_plans
  add column if not exists narration_contract_version_id uuid references public.long_form_narration_contract_versions(id);

comment on column public.long_form_scene_render_plans.narration_contract_version_id is
  'The EXACT Narration Contract version this plan''s narration_claim_id/semantic notes/GraphicSpec were resolved against — pinned at compile time, never re-resolved to "current" later. Null only for a plan compiled with no contract at all.';

-- PART 12 (billing fix): programmatic deterministic graphics never touch
-- Runware/Kling/Qwen — a Regenerate on one must cost 0 credits, never the
-- generic GENERATE price. estimate_scene_operation_credits' own 'regenerate'
-- branch never special-cased PROGRAMMATIC_GRAPHIC and fell through to
-- long_form_tier_generate_credits — the confirmed real bug ("Shot 53 graphic
-- Regenerate charged 3 credits, provider cost $0").
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
  -- 'regenerate' from here down.
  if sc.render_strategy = 'PROGRAMMATIC_GRAPHIC' then
    return jsonb_build_object('credits', 0, 'tier', rp.render_tier, 'operation', 'regenerate', 'model', 'deterministic:programmatic-graphic', 'freeRetry', true);
  end if;
  if sc.render_strategy = 'EDIT' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', 'image:qwen.image-edit-plus');
  end if;
  return jsonb_build_object('credits', public.long_form_tier_generate_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', public.long_form_tier_primary_tool_key(rp.render_tier));
end $$;

-- retry_long_form_scene's own price computation gets the SAME
-- PROGRAMMATIC_GRAPHIC carve-out, for the (unlikely but real) case a caller
-- invokes the RPC directly rather than going through
-- retry-long-form-scene's new graphic-aware branch (see that edge
-- function). REUSE/CROP already never reach this function today (they are
-- zero-cost strategies with no live Regenerate action wired to them in the
-- UI/checked elsewhere), but the same 0-cost principle would apply if that
-- ever changes — PROGRAMMATIC_GRAPHIC is the one this task's audit actually
-- confirmed is real and reachable today.
create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int;
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

-- Part 5/6: the dedicated atomic op for a PROGRAMMATIC_GRAPHIC "Try Another
-- Layout" — unlike retry_long_form_scene (which reuses the SAME
-- scene_render_plan_id, i.e. the same GraphicSpec), this creates a NEW
-- render-plan VERSION carrying the caller-supplied overlay_spec (a new
-- treatment/variant, or a freshly-upgraded structured spec replacing a
-- legacy one) — the actual spec computation happens in the calling edge
-- function (mirrors escalate_long_form_scene_to_generate's own split:
-- compilation in TypeScript, atomic charge+insert in SQL). Always 0
-- credits — deterministic re-layout has zero provider cost by construction.
-- Historical rows are never touched: the OLD scene/plan stay exactly as
-- they were, `replaces_scene_id` links forward only.
create or replace function public.regenerate_long_form_graphic(
  p_scene_id uuid, p_user_id uuid, p_overlay_spec jsonb, p_narration_contract_version_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; new_plan_id uuid;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  if sc.render_strategy <> 'PROGRAMMATIC_GRAPHIC' then raise exception 'NOT_A_GRAPHIC_SCENE'; end if;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;

  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;

  insert into public.long_form_scene_render_plans(
    project_id, visual_world_version_id, visual_plan_version_id, visual_beat_id, plan_version,
    chapter_id, sequence_index, narration_segment_ids, start_seconds, end_seconds,
    communication_goal, narrative_function, scene_type, continuity_group_id, base_setup_key,
    composition, world_state_before, world_state_after,
    render_strategy, source_scene_render_plan_id, reference_asset_ids, image_prompt, overlay_spec, motion_intent,
    factual_constraints, forbidden_elements, qa_expectations,
    style_preset_id, style_contract_version, compiler_version, render_tier, director_meta,
    narration_claim_id, narration_contract_version_id
  )
  select
    src.project_id, src.visual_world_version_id, src.visual_plan_version_id, src.visual_beat_id, src.plan_version + 1,
    src.chapter_id, src.sequence_index, src.narration_segment_ids, src.start_seconds, src.end_seconds,
    src.communication_goal, src.narrative_function, src.scene_type, src.continuity_group_id, src.base_setup_key,
    src.composition, src.world_state_before, src.world_state_after,
    'PROGRAMMATIC_GRAPHIC', null, '{}'::uuid[], null, p_overlay_spec, src.motion_intent,
    src.factual_constraints, src.forbidden_elements, src.qa_expectations,
    src.style_preset_id, src.style_contract_version, src.compiler_version, src.render_tier, src.director_meta,
    src.narration_claim_id, p_narration_contract_version_id
  from public.long_form_scene_render_plans src where src.id = sc.scene_render_plan_id
  returning id into new_plan_id;

  insert into public.long_form_scenes(scene_render_plan_id, visual_world_version_id, visual_beat_id, render_strategy, replaces_scene_id, credits_charged, input_reference_asset_ids, generation_run_id)
  values(new_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'PROGRAMMATIC_GRAPHIC', sc.id, 0, '{}'::uuid[], sc.generation_run_id)
  returning id into replacement_id;

  insert into public.long_form_scene_operation_charges(scene_id, project_id, user_id, operation, tier, credits)
  values(replacement_id, v.project_id, p_user_id, 'regenerate', rp.render_tier, 0);

  return replacement_id;
end $$;
revoke all on function public.regenerate_long_form_graphic(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.regenerate_long_form_graphic(uuid, uuid, jsonb, uuid) to service_role;
