-- 2026-09-22 "provider adapter transport" incident — retry must not
-- recharge a scene whose provider task was never actually accepted.
--
-- Real Atlantis finding: retry_long_form_scene's existing "free, in-place"
-- retry branch only checked `sc.job_id is null` — true for a PRE-dispatch
-- validation failure (no jobs row ever created), but FALSE for these 13
-- scenes: enqueue_long_form_scene_job already creates the jobs row (and
-- sets long_form_scenes.job_id) BEFORE the actual HTTP call to Runware, so
-- job_id was set even though Runware rejected task CREATION outright
-- (unsupported negativePrompt / broken reference transport — both fixed in
-- runware-image this same pass) and never accepted an inference task.
-- Retrying these through the existing charged branch would have deducted
-- credits a SECOND time for work that was never actually attempted by the
-- provider.
--
-- The reliable signal already exists on the jobs row itself:
-- provider_task_id is set ONLY by record_provider_submission, which
-- runware-image calls ONLY after Runware's create-task response succeeds.
-- A job with job_id set but provider_task_id still null never reached the
-- provider — safe and correct to treat exactly like the job_id-is-null
-- case: reset in place, no new row, no charge. job_id is cleared too (not
-- just status) since claim_long_form_scene_for_render requires job_id is
-- null to ever claim a scene again.
create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int; run_paused boolean; task_was_accepted boolean;
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

  select exists(select 1 from public.jobs j where j.id = sc.job_id and j.provider_task_id is not null) into task_was_accepted;

  if sc.status = 'failed' and not task_was_accepted then
    update public.long_form_scenes set status='pending', claim_attempts=0, lease_until=null, last_error_code=null, last_error_at=null, job_id=null, updated_at=now() where id = sc.id;
    -- enqueue_long_form_scene_job ALWAYS inserts the jobs row keyed by the
    -- SCENE's own id (jobs.id = long_form_scenes.id, a permanent 1:1
    -- pairing) — regardless of whether long_form_scenes.job_id currently
    -- reflects it. The stale row from the rejected attempt must be cleared
    -- or the next enqueue collides on jobs_pkey (real incident: exactly
    -- this, caught live by this fix's own smoke test — a retry that
    -- correctly reset job_id to null still failed on 23505 duplicate key
    -- because the OLD jobs row, keyed by sc.id, was never removed). Only
    -- ever deletes a row matching the SAME safe condition just checked
    -- above (never accepted by the provider).
    delete from public.jobs where id = sc.id and provider_task_id is null;
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
revoke all on function public.retry_long_form_scene(uuid, uuid) from public, anon, authenticated;
grant execute on function public.retry_long_form_scene(uuid, uuid) to authenticated, service_role;
