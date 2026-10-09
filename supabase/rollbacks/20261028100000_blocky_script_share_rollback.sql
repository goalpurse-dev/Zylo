-- Undo of 20261028100000_blocky_script_share.sql: the two functions as they were (copied from
-- 20261026100000_blocky_stories_backend.sql), the price row removed, the two columns dropped.
-- Shares already charged stay charged (they are in the ledger); none is refunded by this file.
BEGIN;

CREATE OR REPLACE FUNCTION public.blocky_charge_step(p_user_id uuid, p_story_id uuid, p_step text, p_from_statuses text[], p_to_status text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_story     public.blocky_stories%ROWTYPE;
  v_plan      text;
  v_item      jsonb;
  v_credits   integer;
  v_total     integer := 0;
  v_min_plan  text;
  v_charge_id uuid := gen_random_uuid();
  v_job_id    uuid;
  v_scene     public.blocky_story_scenes%ROWTYPE;
  v_jobs      jsonb := '[]'::jsonb;
  v_priced    jsonb := '[]'::jsonb;
  v_override  uuid;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: items must be a non-empty array of at most 40' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.blocky_stories WHERE id = p_story_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_story.user_id <> p_user_id THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_story.status = ANY (p_from_statuses)) THEN
    RAISE EXCEPTION 'WRONG_STATUS: story is %', v_story.status USING ERRCODE = '55000';
  END IF;

  SELECT plan_code INTO v_plan FROM public.profiles WHERE id = p_user_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'kind') NOT IN ('image', 'clip') OR jsonb_typeof(v_item->'request') <> 'object' THEN
      RAISE EXCEPTION 'VALIDATION: bad item' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_scene FROM public.blocky_story_scenes WHERE id = (v_item->>'scene_id')::uuid AND story_id = p_story_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: scene' USING ERRCODE = 'P0002';
    END IF;
    SELECT min_plan INTO v_min_plan FROM public.tool_prices WHERE tool_key = v_item->>'tool_key' AND active;
    IF public.blocky_plan_rank(v_plan) < GREATEST(1, public.blocky_plan_rank(v_min_plan)) THEN
      -- A single-item step may use one unexpired, unused admin test override.
      IF jsonb_array_length(p_items) = 1 THEN
        SELECT id INTO v_override FROM public.blocky_test_overrides
        WHERE user_id = p_user_id AND story_id = p_story_id AND tool_key = v_item->>'tool_key'
          AND used_at IS NULL AND expires_at > now()
        ORDER BY created_at LIMIT 1 FOR UPDATE;
      END IF;
      IF v_override IS NULL THEN
        RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED: %', COALESCE(v_min_plan, 'starter') USING ERRCODE = '42501';
      END IF;
    END IF;
    v_credits := public.compute_tool_price(v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb));
    IF v_credits IS NULL THEN
      RAISE EXCEPTION 'NO_SERVER_PRICE: %', v_item->>'tool_key' USING ERRCODE = '22023';
    END IF;
    -- Free regenerate: once, for a picture our automatic check flagged.
    IF p_step = 'free_regenerate' THEN
      IF jsonb_array_length(p_items) <> 1 OR v_item->>'kind' <> 'image' OR v_scene.image_check <> 'failed' OR v_scene.free_regen_used THEN
        RAISE EXCEPTION 'WRONG_STATUS: no free regenerate for this scene' USING ERRCODE = '55000';
      END IF;
      v_credits := 0;
    END IF;
    v_total := v_total + v_credits;
    v_priced := v_priced || jsonb_build_array(v_item || jsonb_build_object('credits', v_credits));
  END LOOP;

  IF v_total > 0 THEN
    PERFORM public.deduct_credits(p_user_id, v_total);
  END IF;

  INSERT INTO public.blocky_charges (id, user_id, story_id, step, credits)
  VALUES (v_charge_id, p_user_id, p_story_id, p_step, v_total);

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_priced) LOOP
    v_job_id := gen_random_uuid();
    INSERT INTO public.blocky_jobs (id, user_id, story_id, scene_id, charge_id, kind, tool_key, price_input, credits, request, test_override_id)
    VALUES (v_job_id, p_user_id, p_story_id, (v_item->>'scene_id')::uuid, v_charge_id, v_item->>'kind',
            v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb), (v_item->>'credits')::integer, v_item->'request', v_override);
    INSERT INTO public.blocky_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
    VALUES (p_user_id, p_story_id, v_charge_id, v_job_id, 'charge', (v_item->>'credits')::integer, 'job:' || v_job_id || ':charge', p_step);

    IF v_item->>'kind' = 'image' THEN
      UPDATE public.blocky_story_scenes
      SET image_status = 'queued', image_job_id = v_job_id, image_prompt = COALESCE(v_item->>'prompt', image_prompt),
          error_code = NULL, error = NULL, image_check = 'none', image_check_notes = NULL,
          free_regen_used = free_regen_used OR p_step = 'free_regenerate'
      WHERE id = (v_item->>'scene_id')::uuid;
    ELSE
      UPDATE public.blocky_story_scenes
      SET clip_status = 'queued', clip_job_id = v_job_id, clip_prompt = COALESCE(v_item->>'prompt', clip_prompt),
          duration_sec = COALESCE((v_item->'price_input'->>'durationSec')::smallint, duration_sec),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    END IF;
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object('job_id', v_job_id, 'scene_id', v_item->>'scene_id', 'credits', (v_item->>'credits')::integer));
  END LOOP;

  IF v_override IS NOT NULL THEN
    UPDATE public.blocky_test_overrides SET used_at = now(), used_by_job = v_job_id WHERE id = v_override;
  END IF;

  UPDATE public.blocky_stories SET status = p_to_status, error_code = NULL, error = NULL WHERE id = p_story_id;

  RETURN jsonb_build_object('charge_id', v_charge_id, 'credits', v_total, 'jobs', v_jobs, 'test_override_id', v_override);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blocky_refund_job(p_job_id uuid, p_error_code text, p_error text, p_cost_usd numeric DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job public.blocky_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.blocky_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_job.credits > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_job.credits,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_job.credits)
    WHERE id = v_job.user_id;
  END IF;
  INSERT INTO public.blocky_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
  VALUES (v_job.user_id, v_job.story_id, v_job.charge_id, p_job_id, 'refund', v_job.credits, 'job:' || p_job_id || ':refund', p_error_code)
  ON CONFLICT (idempotency_key) DO NOTHING;
  UPDATE public.blocky_jobs
  SET status = 'failed', error_code = p_error_code, error = p_error, refunded_at = now(), finished_at = now(),
      lease_until = NULL, cost_usd = cost_usd + COALESCE(p_cost_usd, 0)
  WHERE id = p_job_id;
  IF v_job.kind = 'image' THEN
    UPDATE public.blocky_story_scenes SET image_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND image_job_id = p_job_id;
  ELSE
    UPDATE public.blocky_story_scenes SET clip_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND clip_job_id = p_job_id;
  END IF;
  PERFORM public.blocky_refresh_story_status(v_job.story_id);
  RETURN true;
END;
$function$
;

DELETE FROM public.tool_prices WHERE tool_key = 'script:blocky-story';
ALTER TABLE public.blocky_charges DROP CONSTRAINT IF EXISTS blocky_charges_script_credits_check;
ALTER TABLE public.blocky_charges DROP COLUMN IF EXISTS script_refunded_at;
ALTER TABLE public.blocky_charges DROP COLUMN IF EXISTS script_credits;

NOTIFY pgrst, 'reload schema';
COMMIT;
