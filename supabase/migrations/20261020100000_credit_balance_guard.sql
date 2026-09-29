-- Phase 7 (c): a balance can never go below 0.
-- 1. A table-level guard on every path.
-- 2. One guarded debit (only if the balance covers it, else INSUFFICIENT_CREDITS) that the
--    older functions which subtracted directly now go through.
-- 3. spend_on_success (legacy tools: 'never fail after the generation') is clamped at 0 instead.
alter table public.profiles drop constraint if exists credit_balance_nonnegative;
alter table public.profiles add constraint credit_balance_nonnegative check (credit_balance >= 0);

create or replace function public.debit_credits_guarded(p_user_id uuid, p_amount integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_amount is null or p_amount < 0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
  if p_amount = 0 then return; end if;
  update public.profiles
     set credit_balance = credit_balance - p_amount, credits_spent_today = coalesce(credits_spent_today, 0) + p_amount
   where id = p_user_id and credit_balance >= p_amount;
  if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
end $$;
revoke all on function public.debit_credits_guarded(uuid, integer) from public, anon, authenticated;
grant execute on function public.debit_credits_guarded(uuid, integer) to service_role;


-- reserve_long_form_project_credits: debit through the guarded path
CREATE OR REPLACE FUNCTION public.reserve_long_form_project_credits(p_project_id uuid, p_user_id uuid, p_generation_profile_id uuid, p_reserved_credits integer, p_breakdown jsonb)
 RETURNS long_form_project_reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  proj public.long_form_projects;
  existing public.long_form_project_reservations;
  active public.long_form_project_reservations;
  balance integer;
  idem_key text;
  new_row public.long_form_project_reservations;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_reserved_credits <= 0 then raise exception 'INVALID_RESERVATION_AMOUNT'; end if;

  idem_key := p_project_id::text || ':reservation:' || p_generation_profile_id::text;
  select * into existing from public.long_form_project_reservations where idempotency_key = idem_key;
  if existing.id is not null then return existing; end if;

  -- Only one ACTIVE reservation per project is structurally allowed (the
  -- unique index above) — a project with an existing 'reserved' row for a
  -- DIFFERENT profile must settle/release it first (an explicit, separate
  -- decision — see Section J: "changing this setting requires
  -- regenerating downstream stages," never a silent supersede of real
  -- reserved money).
  select * into active from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved' for update;
  if active.id is not null then raise exception 'RESERVATION_ALREADY_ACTIVE_FOR_DIFFERENT_PROFILE'; end if;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < p_reserved_credits then raise exception 'INSUFFICIENT_CREDITS'; end if;
  perform public.debit_credits_guarded(p_user_id, p_reserved_credits);

  insert into public.long_form_project_reservations (project_id, generation_profile_id, user_id, reserved_credits, breakdown, idempotency_key)
  values (p_project_id, p_generation_profile_id, p_user_id, p_reserved_credits, coalesce(p_breakdown, '{}'::jsonb), idem_key)
  returning * into new_row;
  return new_row;
end $function$;

-- charge_long_form_sample_generation: debit through the guarded path
CREATE OR REPLACE FUNCTION public.charge_long_form_sample_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_beat_ids jsonb, p_expected_credits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
  existing_active public.long_form_episode_generation_charges; quote jsonb; total integer; balance integer;
  idem_key text; new_id uuid; compat jsonb; v_reservation_result text;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  if jsonb_array_length(p_beat_ids) = 0 then raise exception 'NO_BEATS_SELECTED'; end if;

  select * into existing_active from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged';
  if found then raise exception 'GENERATION_ALREADY_ACTIVE'; end if;

  compat := public.long_form_visual_world_compatibility(p_project_id);
  if not coalesce((compat->>'compatible')::boolean, false) then raise exception 'VISUAL_WORLD_NOT_READY:%', coalesce(compat->>'reason','not_ready'); end if;
  select * into world from public.long_form_visual_world_versions where id = (compat->>'visualWorldVersionId')::uuid;
  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;

  quote := public.estimate_long_form_sample_credits(p_project_id, p_tier, p_beat_ids);
  total := (quote->>'totalCredits')::integer;
  if total <> p_expected_credits then raise exception 'SAMPLE_PRICE_MISMATCH: server computed % credits, caller expected %', total, p_expected_credits; end if;

  idem_key := p_project_id::text || ':sample_generation:' || plan.id::text || ':' || md5((select string_agg(v, ',' order by v) from jsonb_array_elements_text(p_beat_ids) v));
  select * into existing_active from public.long_form_episode_generation_charges where idempotency_key = idem_key;
  if found then
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'creditsCharged', 0, 'tier', existing_active.tier, 'generationRunId', existing_active.id, 'beatIds', existing_active.sample_beat_ids);
  end if;

  -- Reservation-aware debit (2026-10-02): identical fallback rule as
  -- charge_long_form_episode_generation.
  if total > 0 then
    v_reservation_result := public.commit_long_form_reservation_spend(p_project_id, total);
    if v_reservation_result = 'NO_RESERVATION' then
      select credit_balance into balance from public.profiles where id = p_user_id for update;
      if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;
      perform public.debit_credits_guarded(p_user_id, total);
    end if;
  end if;

  insert into public.long_form_episode_generation_charges
    (project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, chapter_gate_enabled, sample_beat_ids)
    values (p_project_id, world.id, plan.id, p_user_id, p_tier, total, quote, idem_key, false, p_beat_ids)
    returning id into new_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', quote->'breakdown', 'tier', p_tier, 'generationRunId', new_id, 'beatIds', p_beat_ids);
end $function$;

-- edit_long_form_scene: debit through the guarded path
CREATE OR REPLACE FUNCTION public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform public.debit_credits_guarded(p_user_id, price);
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
end $function$;

-- escalate_long_form_scene_to_generate: debit through the guarded path
CREATE OR REPLACE FUNCTION public.escalate_long_form_scene_to_generate(p_scene_id uuid, p_user_id uuid, p_image_prompt text, p_reference_asset_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.debit_credits_guarded(p_user_id, price);

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
end $function$;

-- rebuild_long_form_episode_generation: debit through the guarded path
CREATE OR REPLACE FUNCTION public.rebuild_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_expected_active_charge_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; existing public.long_form_episode_generation_charges;
  price jsonb; total int; balance int; idem_key text; new_id uuid;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;
  if p_expected_active_charge_id is null then raise exception 'MISSING_EXPECTED_ACTIVE_CHARGE'; end if;

  idem_key := p_project_id::text || ':episode_rebuild:' || p_expected_active_charge_id::text;
  -- Idempotent short-circuit FIRST, before touching balance or plan state —
  -- a double-click's second call (once unblocked by the project row lock
  -- above) lands here and returns the already-created run.
  select id into new_id from public.long_form_episode_generation_charges where idempotency_key = idem_key;
  if new_id is not null then
    select * into existing from public.long_form_episode_generation_charges where id = new_id;
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'newGenerationRunId', new_id, 'previousGenerationRunId', p_expected_active_charge_id, 'creditsCharged', existing.credits_charged, 'breakdown', existing.cost_breakdown, 'tier', existing.tier);
  end if;

  if proj.active_generation_charge_id is distinct from p_expected_active_charge_id then
    raise exception 'ACTIVE_RUN_CHANGED_SINCE_QUOTE';
  end if;
  select * into existing from public.long_form_episode_generation_charges where id = p_expected_active_charge_id and status = 'charged';
  if not found then raise exception 'NO_ACTIVE_GENERATION_TO_REBUILD'; end if;

  if proj.current_visual_world_version_id is null or proj.current_visual_plan_version_id is null then raise exception 'NOT_READY'; end if;
  select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if world.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;

  price := public.estimate_long_form_episode_credits(p_project_id, p_tier);
  total := (price->>'totalCredits')::int;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;

  perform public.debit_credits_guarded(p_user_id, total);

  -- The PREVIOUS run is marked superseded FIRST — never deleted, and no
  -- other field on it is touched (credits_charged/cost_breakdown/tier/
  -- created_at remain the real historical record forever, Part 4/6) — this
  -- must happen BEFORE the new row is inserted: the partial unique index
  -- (one 'charged' row per project) would otherwise reject the new insert
  -- while the old row is still 'charged', since both would briefly coexist.
  update public.long_form_episode_generation_charges set status = 'superseded', superseded_at = now() where id = existing.id;

  insert into public.long_form_episode_generation_charges(project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, rebuild_of_charge_id)
  values (p_project_id, proj.current_visual_world_version_id, proj.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key, existing.id)
  returning id into new_id;

  update public.long_form_episode_generation_charges set superseded_by_charge_id = new_id where id = existing.id;
  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', active_generation_charge_id = new_id, updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'newGenerationRunId', new_id, 'previousGenerationRunId', existing.id, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $function$;

-- retry_long_form_scene: debit through the guarded path
CREATE OR REPLACE FUNCTION public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        perform public.debit_credits_guarded(p_user_id, price);
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
end $function$;

-- app_charge_job: debit through the guarded path (the earlier balance read could race)
CREATE OR REPLACE FUNCTION public.app_charge_job(p_user uuid, p_job uuid, p_tool_key text, p_model text DEFAULT NULL::text, p_seconds integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_need     integer;
  v_balance  integer;
begin
  -- how many credits this job costs (reads app_provider_prices)
  v_need := app_get_credits(p_tool_key, p_model, p_seconds);

  -- lock the profile row so concurrent charges don't race
  select credit_balance
    into v_balance
    from profiles
    where id = p_user
    for update;

  if v_balance is null then
    raise exception 'Profile not found for user %', p_user;
  end if;

  if v_balance < v_need then
    raise exception 'Insufficient balance (% credits needed)', v_need;
  end if;

  -- stamp job for audit
  update jobs
     set tool_key      = p_tool_key,
         model         = coalesce(p_model, '∅'),
         charge_credits = v_need
   where id = p_job;

  -- deduct
  perform public.debit_credits_guarded(p_user, v_need);

  -- ledger
  insert into credit_ledger(user_id, job_id, delta, type, reason)
  values (p_user, p_job, -v_need, 'spend',
          jsonb_build_object(
            'tool_key', p_tool_key,
            'model',    coalesce(p_model, '∅'),
            'seconds',  p_seconds));

  return v_need;
end $function$;

-- spend_on_success: clamped at 0 (it must never fail after a generation)
CREATE OR REPLACE FUNCTION public.spend_on_success(p_job_id uuid, p_tool_key text, p_model text DEFAULT NULL::text, p_seconds integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_user uuid;
  v_need int;
begin
  -- find job owner
  select user_id into v_user from jobs where id = p_job_id;
  if v_user is null then
    raise exception 'Job % not found', p_job_id;
  end if;

  -- how many credits
  v_need := app_get_credits(p_tool_key, p_model, p_seconds);

  -- stamp job for auditing
  update jobs
  set tool_key = p_tool_key,
      model    = coalesce(p_model, '∅'),
      charge_credits = v_need
  where id = p_job_id;

  -- deduct (no exception — you asked to avoid failing after gen)
  update profiles
  set credit_balance = greatest(0, credit_balance - v_need)  -- never below 0, never fails after the generation
  where id = v_user;

  -- ledger
  insert into credit_ledger (user_id, job_id, delta, type, reason)
  values (v_user, p_job_id, -v_need, 'spend',
          jsonb_build_object('tool_key', p_tool_key, 'model', coalesce(p_model,'∅'), 'seconds', p_seconds));
end $function$;
