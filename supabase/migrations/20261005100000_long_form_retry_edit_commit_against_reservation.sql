-- Phase 0, Section B.3 — Scene Retry/Edit charges now draw down against an
-- active project reservation (commit_long_form_reservation_spend) instead
-- of always debiting profiles.credit_balance directly. Falls back to the
-- direct debit ONLY when commit_long_form_reservation_spend reports
-- NO_RESERVATION (the project's reservation has already been
-- settled/released, or this is a legacy project that never had one) — and
-- logs that fallback to system_logs, per the explicit instruction to make
-- "money moving outside the quoted reservation" visible rather than silent.
-- If a reservation EXISTS but committing would exceed its ceiling,
-- commit_long_form_reservation_spend raises RESERVATION_CEILING_EXCEEDED,
-- which propagates up and aborts the whole operation (no charge, no scene
-- row inserted) — deliberately never silently overspending past what the
-- user was quoted; the caller must ask for more credit authorization.
--
-- Every line not touching the charging block is copied verbatim from each
-- function's current definition (20260930460000).
--
-- Idempotency: unchanged from the existing design — both functions already
-- look up `replaces_scene_id` BEFORE charging anything and return the
-- existing replacement scene id if a retry/edit for this exact scene
-- already happened, so a double-click was already safe before this change
-- and stays exactly as safe now, regardless of which of the two charging
-- paths below actually fires.

create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans;
  owner_id uuid; replacement_id uuid; price int; balance int; run_paused boolean; commit_result text;
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
      commit_result := public.commit_long_form_reservation_spend(v.project_id, price);
      if commit_result = 'NO_RESERVATION' then
        select credit_balance into balance from public.profiles where id = p_user_id for update;
        if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
        update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
        insert into public.system_logs (level, source, event, user_id, message, details)
        values ('warn', 'retry_long_form_scene', 'charged_outside_reservation', p_user_id,
                'Scene retry charged directly — no active reservation for this project',
                jsonb_build_object('project_id', v.project_id, 'scene_id', p_scene_id, 'credits', price));
      end if;
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
declare
  sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans;
  owner_id uuid; trimmed text; replacement_id uuid; price int; balance int; run_paused boolean; commit_result text;
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
  commit_result := public.commit_long_form_reservation_spend(v.project_id, price);
  if commit_result = 'NO_RESERVATION' then
    select credit_balance into balance from public.profiles where id = p_user_id for update;
    if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
    update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
    insert into public.system_logs (level, source, event, user_id, message, details)
    values ('warn', 'edit_long_form_scene', 'charged_outside_reservation', p_user_id,
            'Scene edit charged directly — no active reservation for this project',
            jsonb_build_object('project_id', v.project_id, 'scene_id', p_scene_id, 'credits', price));
  end if;
  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,edit_instruction,input_reference_asset_ids,credits_charged,generation_run_id)
  values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'EDIT', sc.id, trimmed, sc.input_reference_asset_ids, price, sc.generation_run_id) returning id into replacement_id;
  insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
  values(replacement_id, v.project_id, p_user_id, 'edit', rp.render_tier, price);
  return replacement_id;
end $$;
