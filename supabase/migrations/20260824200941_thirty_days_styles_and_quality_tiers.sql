-- Finalize 30 Days V1 product configuration before rollout:
--   * persist the chosen visual interpretation
--   * keep tier pricing/model metadata in one trusted table
--   * price and create immutable assets from that table

ALTER TABLE public.thirty_days_generations
  ADD COLUMN IF NOT EXISTS visual_style text NOT NULL DEFAULT 'auto';

ALTER TABLE public.thirty_days_generations
  DROP CONSTRAINT IF EXISTS thirty_days_generations_visual_style_check;
ALTER TABLE public.thirty_days_generations
  ADD CONSTRAINT thirty_days_generations_visual_style_check
  CHECK (visual_style IN ('auto', 'cinematic_3d', 'anime_accurate', 'realistic', 'dark_cinematic'));

CREATE TABLE IF NOT EXISTS public.thirty_days_quality_tiers (
  quality_tier text PRIMARY KEY,
  label text NOT NULL,
  min_plan text NOT NULL CHECK (min_plan IN ('starter', 'pro', 'generative')),
  reference_tool_key text NOT NULL,
  reference_width integer NOT NULL CHECK (reference_width > 0),
  reference_height integer NOT NULL CHECK (reference_height > 0),
  reference_cost_credits integer NOT NULL CHECK (reference_cost_credits > 0),
  image_tool_key text NOT NULL,
  image_width integer NOT NULL CHECK (image_width > 0),
  image_height integer NOT NULL CHECK (image_height > 0),
  image_cost_credits integer NOT NULL CHECK (image_cost_credits > 0),
  video_tool_key text NOT NULL,
  video_provider text NOT NULL,
  video_model text NOT NULL,
  video_width integer NOT NULL CHECK (video_width > 0),
  video_height integer NOT NULL CHECK (video_height > 0),
  video_duration_seconds integer NOT NULL CHECK (video_duration_seconds BETWEEN 4 AND 12),
  video_cost_credits integer NOT NULL CHECK (video_cost_credits > 0),
  with_sound boolean NOT NULL DEFAULT false CHECK (with_sound = false),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.thirty_days_quality_tiers (
  quality_tier, label, min_plan,
  reference_tool_key, reference_width, reference_height, reference_cost_credits,
  image_tool_key, image_width, image_height, image_cost_credits,
  video_tool_key, video_provider, video_model, video_width, video_height,
  video_duration_seconds, video_cost_credits, with_sound
) VALUES
  (
    'thirtydays-v2', 'V2', 'starter',
    'image:thirtydays1k', 768, 1376, 5,
    'image:thirtydays1k', 768, 1376, 5,
    'video:seedance15pro', 'runware', 'bytedance:seedance@1.5-pro', 496, 864,
    5, 6, false
  ),
  (
    'thirtydays-v3', 'V3', 'pro',
    'image:thirtydays1k', 768, 1376, 5,
    'image:thirtydays2k', 1536, 2752, 7,
    'video:veo31lite', 'runware', 'google:veo@3.1-lite', 720, 1280,
    6, 18, false
  ),
  (
    'thirtydays-v4', 'V4', 'generative',
    'image:thirtydays1k', 768, 1376, 5,
    'image:thirtydays4k', 3072, 5504, 10,
    'video:cartoondriveseedance720', 'runware', 'bytedance:seedance@2.0', 720, 1280,
    5, 80, false
  )
ON CONFLICT (quality_tier) DO UPDATE SET
  label = EXCLUDED.label,
  min_plan = EXCLUDED.min_plan,
  reference_tool_key = EXCLUDED.reference_tool_key,
  reference_width = EXCLUDED.reference_width,
  reference_height = EXCLUDED.reference_height,
  reference_cost_credits = EXCLUDED.reference_cost_credits,
  image_tool_key = EXCLUDED.image_tool_key,
  image_width = EXCLUDED.image_width,
  image_height = EXCLUDED.image_height,
  image_cost_credits = EXCLUDED.image_cost_credits,
  video_tool_key = EXCLUDED.video_tool_key,
  video_provider = EXCLUDED.video_provider,
  video_model = EXCLUDED.video_model,
  video_width = EXCLUDED.video_width,
  video_height = EXCLUDED.video_height,
  video_duration_seconds = EXCLUDED.video_duration_seconds,
  video_cost_credits = EXCLUDED.video_cost_credits,
  with_sound = EXCLUDED.with_sound,
  updated_at = now();

ALTER TABLE public.thirty_days_quality_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users read 30 Days quality tiers"
  ON public.thirty_days_quality_tiers;
CREATE POLICY "Authenticated users read 30 Days quality tiers"
  ON public.thirty_days_quality_tiers FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.thirty_days_quality_tiers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.thirty_days_quality_tiers TO authenticated;

CREATE OR REPLACE FUNCTION public.begin_thirty_days_generation(
  p_user_id uuid,
  p_universe text,
  p_ai_idea_mode boolean,
  p_premise text,
  p_plan jsonb,
  p_quality_tier text
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_plan_code text;
  v_quality text := COALESCE(NULLIF(trim(p_quality_tier), ''), 'thirtydays-v2');
  v_tier public.thirty_days_quality_tiers;
  v_style text := COALESCE(NULLIF(trim(p_plan->>'visualStyle'), ''), 'auto');
  v_voice_limit integer;
  v_service_cost integer;
  v_total_cost integer;
  v_reference_count integer := COALESCE(jsonb_array_length(p_plan->'visualReferences'), 0);
  v_scene_count integer := COALESCE(jsonb_array_length(p_plan->'scenes'), 0);
  v_ref jsonb;
  v_scene jsonb;
  v_reference_id text;
  v_scene_index integer;
  v_scene_day integer;
  v_day_scene integer;
  v_dependencies text[];
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_universe, ''))) < 2 THEN RAISE EXCEPTION 'UNIVERSE_REQUIRED'; END IF;
  IF v_reference_count <> 5 THEN RAISE EXCEPTION 'INVALID_REFERENCE_COUNT'; END IF;
  IF v_scene_count <> 8 THEN RAISE EXCEPTION 'INVALID_SCENE_COUNT'; END IF;
  IF v_style NOT IN ('auto', 'cinematic_3d', 'anime_accurate', 'realistic', 'dark_cinematic') THEN
    RAISE EXCEPTION 'INVALID_VISUAL_STYLE';
  END IF;

  SELECT lower(COALESCE(plan_code, 'free')) INTO v_plan_code
  FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_tier
  FROM public.thirty_days_quality_tiers
  WHERE quality_tier = v_quality
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_QUALITY_TIER'; END IF;

  IF (v_tier.min_plan = 'starter' AND v_plan_code NOT IN ('starter', 'affiliate', 'pro', 'generative'))
     OR (v_tier.min_plan = 'pro' AND v_plan_code NOT IN ('pro', 'generative'))
     OR (v_tier.min_plan = 'generative' AND v_plan_code <> 'generative')
  THEN
    RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED';
  END IF;

  v_voice_limit := CASE v_plan_code WHEN 'generative' THEN 5 WHEN 'pro' THEN 3 ELSE 2 END;
  v_service_cost := 12 + v_voice_limit * 3;
  v_total_cost := v_reference_count * v_tier.reference_cost_credits
    + 8 * v_tier.image_cost_credits
    + 8 * v_tier.video_cost_credits
    + v_service_cost;

  IF (
    SELECT count(DISTINCT value->>'id')
    FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(value)
  ) <> v_reference_count OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(value)
    WHERE length(trim(COALESCE(value->>'id', ''))) = 0
  ) THEN RAISE EXCEPTION 'INVALID_REFERENCE_IDS'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_plan->'scenes') AS scenes(scene),
         jsonb_array_elements_text(COALESCE(scene->'referenceIds', '[]'::jsonb)) AS assigned(reference_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(reference)
      WHERE reference->>'id' = assigned.reference_id
    )
  ) THEN RAISE EXCEPTION 'INVALID_SCENE_REFERENCE'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_plan->'scenes') WITH ORDINALITY AS scenes(scene, ordinality)
    WHERE (scene->>'index')::integer <> ordinality - 1
       OR (scene->>'day')::integer <> (ARRAY[1, 1, 10, 10, 20, 20, 30, 30])[ordinality::integer]
       OR (scene->>'dayScene')::integer <> (CASE WHEN ordinality % 2 = 1 THEN 1 ELSE 2 END)
  ) THEN RAISE EXCEPTION 'INVALID_MILESTONE_STRUCTURE'; END IF;

  PERFORM public.deduct_credits(p_user_id, v_total_cost);

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, title, hook, camera_mode,
    visual_style, world_bible, visual_references, scenes, quality_tier, status,
    reserved_credits, reservation_status, voice_generation_limit, service_credits_charged
  ) VALUES (
    p_user_id, trim(p_universe), COALESCE(p_ai_idea_mode, true),
    NULLIF(trim(COALESCE(p_premise, '')), ''),
    NULLIF(trim(COALESCE(p_plan->>'title', '')), ''),
    NULLIF(trim(COALESCE(p_plan->>'hook', '')), ''),
    CASE WHEN p_plan->>'cameraMode' = 'first_person' THEN 'first_person' ELSE 'third_person' END,
    v_style, COALESCE(p_plan->'worldBible', '{}'::jsonb), p_plan->'visualReferences', p_plan->'scenes',
    v_quality, 'references', v_total_cost, 'reserved', v_voice_limit, v_service_cost
  ) RETURNING * INTO v_generation;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(p_plan->'visualReferences') LOOP
    v_reference_id := v_ref->>'id';
    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, reference_id, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'reference:' || v_reference_id,
      'reference_image', v_reference_id, v_tier.reference_tool_key, v_tier.reference_cost_credits
    );
  END LOOP;

  FOR v_scene IN SELECT value FROM jsonb_array_elements(p_plan->'scenes') LOOP
    v_scene_index := (v_scene->>'index')::integer;
    v_scene_day := (v_scene->>'day')::integer;
    v_day_scene := (v_scene->>'dayScene')::integer;
    IF v_scene_index NOT BETWEEN 0 AND 7 THEN RAISE EXCEPTION 'INVALID_SCENE_INDEX'; END IF;
    IF v_scene_day <> (ARRAY[1, 1, 10, 10, 20, 20, 30, 30])[v_scene_index + 1]
       OR v_day_scene <> (CASE WHEN v_scene_index % 2 = 0 THEN 1 ELSE 2 END)
    THEN RAISE EXCEPTION 'INVALID_MILESTONE_STRUCTURE'; END IF;

    SELECT COALESCE(array_agg('reference:' || value ORDER BY ordinality), '{}'::text[])
    INTO v_dependencies
    FROM jsonb_array_elements_text(COALESCE(v_scene->'referenceIds', '[]'::jsonb))
      WITH ORDINALITY AS ids(value, ordinality);
    IF cardinality(v_dependencies) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'INVALID_SCENE_REFERENCES'; END IF;

    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, scene_index, dependency_keys, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'scene:' || v_scene_index || ':image',
      'scene_image', v_scene_index, v_dependencies, v_tier.image_tool_key, v_tier.image_cost_credits
    );
    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, scene_index, dependency_keys, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'scene:' || v_scene_index || ':video',
      'scene_video', v_scene_index, ARRAY['scene:' || v_scene_index || ':image'],
      v_tier.video_tool_key, v_tier.video_cost_credits
    );
  END LOOP;

  INSERT INTO public.thirty_days_credit_ledger (generation_id, user_id, operation, credits)
  VALUES (v_generation.id, p_user_id, 'reserve', v_total_cost);
  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text) TO service_role;

-- Prove that reservation-backed video jobs use the exact immutable tier
-- signature, including sound-off. A matching tool key alone is insufficient.
CREATE OR REPLACE FUNCTION public.authorize_thirty_days_asset_job(
  p_generation_id uuid,
  p_asset_key text,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset public.thirty_days_generation_assets;
  v_job public.jobs;
  v_generation public.thirty_days_generations;
  v_tier public.thirty_days_quality_tiers;
BEGIN
  SELECT * INTO v_asset
  FROM public.thirty_days_generation_assets
  WHERE generation_id = p_generation_id AND asset_key = p_asset_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_RESERVATION_NOT_FOUND'; END IF;

  SELECT * INTO v_generation FROM public.thirty_days_generations WHERE id = p_generation_id;
  IF NOT FOUND OR v_generation.reservation_status <> 'reserved' THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;

  SELECT * INTO v_tier FROM public.thirty_days_quality_tiers WHERE quality_tier = v_generation.quality_tier;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRICING_NOT_CONFIGURED'; END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND
    OR v_job.user_id <> v_asset.user_id
    OR v_job.tool_key <> v_asset.tool_key
    OR COALESCE(v_job.charge_credits, -1) <> 0
    OR (v_asset.asset_type = 'scene_video' AND v_job.type <> 'video')
    OR (v_asset.asset_type <> 'scene_video' AND v_job.type <> 'image')
    OR v_job.input #>> '{billing_reservation,template}' <> 'thirty-days'
    OR v_job.input #>> '{billing_reservation,generationId}' <> p_generation_id::text
    OR v_job.input #>> '{billing_reservation,assetKey}' <> p_asset_key
    OR (
      v_asset.asset_type = 'scene_video' AND (
        COALESCE((v_job.input->>'width')::integer, -1) <> v_tier.video_width
        OR COALESCE((v_job.input->>'height')::integer, -1) <> v_tier.video_height
        OR COALESCE((v_job.input->>'durationSec')::integer, -1) <> v_tier.video_duration_seconds
        OR COALESCE((v_job.input->>'withSound')::boolean, true) <> v_tier.with_sound
      )
    )
  THEN
    RAISE EXCEPTION 'INVALID_RESERVED_JOB';
  END IF;

  IF v_asset.status = 'succeeded' AND v_asset.qa_status IN ('passed', 'unavailable') THEN
    RAISE EXCEPTION 'ASSET_ALREADY_COMPLETED';
  END IF;

  UPDATE public.thirty_days_generation_assets
  SET job_id = p_job_id,
      status = CASE v_job.status
        WHEN 'succeeded' THEN 'succeeded' WHEN 'failed' THEN 'failed'
        WHEN 'canceled' THEN 'canceled' WHEN 'queued' THEN 'queued' ELSE 'running' END,
      result_url = v_job.result_url,
      error = v_job.error
  WHERE id = v_asset.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid) TO service_role;

-- Trigger helpers never need to be callable through PostgREST. An older
-- deployment left explicit anon/authenticated grants behind even though the
-- function had already been revoked from PUBLIC.
REVOKE ALL ON FUNCTION public.restore_thirty_days_reserved_job_pricing()
  FROM PUBLIC, anon, authenticated;
