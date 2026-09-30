-- AI Fruit Story v2 (Phase 3d follow-ups):
-- 1. Scenes get `placement`: where each character is relative to the setting
--    (inside/outside, behind the glass, at the door). Locations (jsonb) now also
--    carry timeOfDay + lighting; no schema change is needed for that.
-- 2. One-job test overrides: an admin (SQL/service role only) can let ONE paid
--    job run on a tier above the user's plan (e.g. a V4 test clip for a Pro
--    account). The override is single-use, expires on its own, and the job
--    records which override it used. Profiles and Stripe are never touched.

BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.fruit_story_scenes ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.fruit_test_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id    uuid NOT NULL REFERENCES public.fruit_stories(id) ON DELETE CASCADE,
  tool_key    text NOT NULL,
  reason      text NOT NULL,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL CHECK (expires_at <= created_at + interval '2 hours'),
  used_at     timestamptz,
  used_by_job uuid
);
ALTER TABLE public.fruit_test_overrides ENABLE ROW LEVEL SECURITY;          -- no policies: no browser access
REVOKE ALL ON public.fruit_test_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fruit_test_overrides TO service_role;
DROP TRIGGER IF EXISTS zzz_fruit_test_overrides_guard ON public.fruit_test_overrides;
CREATE TRIGGER zzz_fruit_test_overrides_guard BEFORE INSERT OR UPDATE OR DELETE ON public.fruit_test_overrides
  FOR EACH ROW EXECUTE FUNCTION public.fruit_block_client_writes();
COMMENT ON TABLE public.fruit_test_overrides IS
  'Admin-only, single-use, auto-expiring permission for ONE Fruit job above the user''s plan (testing). Never changes the profile or Stripe.';

ALTER TABLE public.fruit_jobs ADD COLUMN IF NOT EXISTS test_override_id uuid REFERENCES public.fruit_test_overrides(id);

-- fruit_charge_step: unchanged except the plan check, which may consume one
-- matching test override for a single-item step.
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

-- fruit_create_story: also saves each scene's placement.
CREATE OR REPLACE FUNCTION public.fruit_create_story(p_user_id uuid, p_story jsonb, p_scenes jsonb, p_call_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id    uuid := gen_random_uuid();
  v_scene jsonb;
  v_idx   integer := 0;
BEGIN
  IF p_scenes IS NULL OR jsonb_typeof(p_scenes) <> 'array' OR jsonb_array_length(p_scenes) < 1 OR jsonb_array_length(p_scenes) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: 1 to 40 scenes' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.fruit_stories (id, user_id, source, input, title, cast_ids, quality, length_sec, aspect, locations, planner, series_id, episode_number)
  VALUES (
    v_id, p_user_id, p_story->>'source', COALESCE(p_story->'input', '{}'::jsonb), COALESCE(p_story->>'title', ''),
    ARRAY(SELECT jsonb_array_elements_text(p_story->'cast_ids')), p_story->>'quality', (p_story->>'length_sec')::smallint,
    p_story->>'aspect', COALESCE(p_story->'locations', '[]'::jsonb), COALESCE(p_story->'planner', '{}'::jsonb),
    NULLIF(p_story->>'series_id', '')::uuid, NULLIF(p_story->>'episode_number', '')::smallint
  );

  FOR v_scene IN SELECT value FROM jsonb_array_elements(p_scenes) LOOP
    INSERT INTO public.fruit_story_scenes (story_id, user_id, idx, title, speaker_id, line, present_ids, location_id, action, emotion, shot, placement, duration_sec)
    VALUES (
      v_id, p_user_id, v_idx, COALESCE(v_scene->>'title', ''), v_scene->>'speaker_id', v_scene->>'line',
      ARRAY(SELECT jsonb_array_elements_text(v_scene->'present_ids')), v_scene->>'location_id',
      COALESCE(v_scene->>'action', ''), COALESCE(v_scene->>'emotion', ''), COALESCE(v_scene->>'shot', ''),
      COALESCE(v_scene->>'placement', ''), (v_scene->>'duration_sec')::smallint
    );
    v_idx := v_idx + 1;
  END LOOP;

  IF p_story->>'series_id' IS NOT NULL THEN
    UPDATE public.fruit_series_episodes SET story_id = v_id
    WHERE series_id = (p_story->>'series_id')::uuid AND number = (p_story->>'episode_number')::smallint AND user_id = p_user_id;
  END IF;

  IF cardinality(p_call_ids) > 0 THEN
    UPDATE public.fruit_ai_calls SET story_id = v_id WHERE id = ANY (p_call_ids) AND user_id = p_user_id;
  END IF;
  RETURN v_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
