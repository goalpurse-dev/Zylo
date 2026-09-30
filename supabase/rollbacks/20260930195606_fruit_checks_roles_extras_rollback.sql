BEGIN;
CREATE OR REPLACE FUNCTION public.fruit_charge_step(
  p_user_id uuid, p_story_id uuid, p_step text, p_from_statuses text[], p_to_status text, p_items jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_story     public.fruit_stories%ROWTYPE;
  v_plan      text;
  v_item      jsonb;
  v_credits   integer;
  v_total     integer := 0;
  v_min_plan  text;
  v_charge_id uuid := gen_random_uuid();
  v_job_id    uuid;
  v_scene     public.fruit_story_scenes%ROWTYPE;
  v_jobs      jsonb := '[]'::jsonb;
  v_priced    jsonb := '[]'::jsonb;
  v_override  uuid;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: items must be a non-empty array of at most 40' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.fruit_stories WHERE id = p_story_id AND deleted_at IS NULL FOR UPDATE;
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
    SELECT * INTO v_scene FROM public.fruit_story_scenes WHERE id = (v_item->>'scene_id')::uuid AND story_id = p_story_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: scene' USING ERRCODE = 'P0002';
    END IF;
    SELECT min_plan INTO v_min_plan FROM public.tool_prices WHERE tool_key = v_item->>'tool_key' AND active;
    IF public.fruit_plan_rank(v_plan) < GREATEST(1, public.fruit_plan_rank(v_min_plan)) THEN
      -- A single-item step may use one unexpired, unused admin test override.
      IF jsonb_array_length(p_items) = 1 THEN
        SELECT id INTO v_override FROM public.fruit_test_overrides
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
    v_total := v_total + v_credits;
    v_priced := v_priced || jsonb_build_array(v_item || jsonb_build_object('credits', v_credits));
  END LOOP;

  IF v_total > 0 THEN
    PERFORM public.deduct_credits(p_user_id, v_total);
  END IF;

  INSERT INTO public.fruit_charges (id, user_id, story_id, step, credits)
  VALUES (v_charge_id, p_user_id, p_story_id, p_step, v_total);

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_priced) LOOP
    v_job_id := gen_random_uuid();
    INSERT INTO public.fruit_jobs (id, user_id, story_id, scene_id, charge_id, kind, tool_key, price_input, credits, request, test_override_id)
    VALUES (v_job_id, p_user_id, p_story_id, (v_item->>'scene_id')::uuid, v_charge_id, v_item->>'kind',
            v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb), (v_item->>'credits')::integer, v_item->'request', v_override);
    INSERT INTO public.fruit_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
    VALUES (p_user_id, p_story_id, v_charge_id, v_job_id, 'charge', (v_item->>'credits')::integer, 'job:' || v_job_id || ':charge', p_step);

    IF v_item->>'kind' = 'image' THEN
      UPDATE public.fruit_story_scenes
      SET image_status = 'queued', image_job_id = v_job_id, image_prompt = COALESCE(v_item->>'prompt', image_prompt),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    ELSE
      UPDATE public.fruit_story_scenes
      SET clip_status = 'queued', clip_job_id = v_job_id, clip_prompt = COALESCE(v_item->>'prompt', clip_prompt),
          duration_sec = COALESCE((v_item->'price_input'->>'durationSec')::smallint, duration_sec),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    END IF;
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object('job_id', v_job_id, 'scene_id', v_item->>'scene_id', 'credits', (v_item->>'credits')::integer));
  END LOOP;

  IF v_override IS NOT NULL THEN
    UPDATE public.fruit_test_overrides SET used_at = now(), used_by_job = v_job_id WHERE id = v_override;
  END IF;

  UPDATE public.fruit_stories SET status = p_to_status, error_code = NULL, error = NULL WHERE id = p_story_id;

  RETURN jsonb_build_object('charge_id', v_charge_id, 'credits', v_total, 'jobs', v_jobs, 'test_override_id', v_override);
END;
$function$;
DELETE FROM public.fruit_charges WHERE step = 'free_regenerate';
ALTER TABLE public.fruit_charges DROP CONSTRAINT IF EXISTS fruit_charges_step_check;
ALTER TABLE public.fruit_charges ADD CONSTRAINT fruit_charges_step_check CHECK (step IN ('pictures', 'edit', 'regenerate', 'retry_picture', 'animate', 'reclip'));
ALTER TABLE public.fruit_stories DROP COLUMN IF EXISTS cover_url, DROP COLUMN IF EXISTS final_end_card, DROP COLUMN IF EXISTS final_part_label,
  DROP COLUMN IF EXISTS upload_package, DROP COLUMN IF EXISTS end_state, DROP COLUMN IF EXISTS cast_roles;
ALTER TABLE public.fruit_story_scenes DROP COLUMN IF EXISTS free_regen_used, DROP COLUMN IF EXISTS image_check_notes, DROP COLUMN IF EXISTS image_check;
NOTIFY pgrst, 'reload schema';
COMMIT;
