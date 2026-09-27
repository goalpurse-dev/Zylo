-- Move 30 Days V1 from seven isolated day beats to four fixed milestone
-- days with two scenes each. Existing generations remain readable; this
-- widens only the trusted asset index and replaces server-side reservation
-- validation/pricing for newly created generations.

ALTER TABLE public.thirty_days_generation_assets
  DROP CONSTRAINT IF EXISTS thirty_days_generation_assets_scene_index_check;

ALTER TABLE public.thirty_days_generation_assets
  ADD CONSTRAINT thirty_days_generation_assets_scene_index_check
  CHECK (scene_index BETWEEN 0 AND 7);

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
  v_image_tool text;
  v_image_cost integer;
  v_reference_cost integer := 5;
  v_video_cost integer := 6;
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
  IF v_reference_count NOT BETWEEN 4 AND 6 THEN RAISE EXCEPTION 'INVALID_REFERENCE_COUNT'; END IF;
  IF v_scene_count <> 8 THEN RAISE EXCEPTION 'INVALID_SCENE_COUNT'; END IF;

  SELECT lower(COALESCE(plan_code, 'free'))
  INTO v_plan_code
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  CASE v_quality
    WHEN 'thirtydays-v2' THEN
      v_image_tool := 'image:thirtydays1k';
      v_image_cost := 5;
      IF v_plan_code NOT IN ('starter', 'affiliate', 'pro', 'generative') THEN
        RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED';
      END IF;
    WHEN 'thirtydays-v3' THEN
      v_image_tool := 'image:thirtydays2k';
      v_image_cost := 7;
      IF v_plan_code NOT IN ('pro', 'generative') THEN RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED'; END IF;
    WHEN 'thirtydays-v4' THEN
      v_image_tool := 'image:thirtydays4k';
      v_image_cost := 10;
      IF v_plan_code <> 'generative' THEN RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED'; END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_QUALITY_TIER';
  END CASE;

  v_voice_limit := CASE v_plan_code
    WHEN 'generative' THEN 5
    WHEN 'pro' THEN 3
    ELSE 2
  END;
  v_service_cost := 12 + v_voice_limit * 3;
  v_total_cost := v_reference_count * v_reference_cost
    + 8 * v_image_cost
    + 8 * v_video_cost
    + v_service_cost;

  IF (
    SELECT count(DISTINCT value->>'id')
    FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(value)
  ) <> v_reference_count OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(value)
    WHERE length(trim(COALESCE(value->>'id', ''))) = 0
  ) THEN
    RAISE EXCEPTION 'INVALID_REFERENCE_IDS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_plan->'scenes') AS scenes(scene),
         jsonb_array_elements_text(COALESCE(scene->'referenceIds', '[]'::jsonb)) AS assigned(reference_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_plan->'visualReferences') AS refs(reference)
      WHERE reference->>'id' = assigned.reference_id
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_SCENE_REFERENCE';
  END IF;

  -- The service-role planner is trusted, but enforce the V1 milestone shape
  -- again at the billing boundary before any credit deduction.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_plan->'scenes') WITH ORDINALITY AS scenes(scene, ordinality)
    WHERE (scene->>'index')::integer <> ordinality - 1
       OR (scene->>'day')::integer <> (ARRAY[1, 1, 10, 10, 20, 20, 30, 30])[ordinality::integer]
       OR (scene->>'dayScene')::integer <> CASE WHEN ordinality % 2 = 1 THEN 1 ELSE 2 END
  ) THEN
    RAISE EXCEPTION 'INVALID_MILESTONE_STRUCTURE';
  END IF;

  PERFORM public.deduct_credits(p_user_id, v_total_cost);

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, title, hook, camera_mode,
    world_bible, visual_references, scenes, quality_tier, status,
    reserved_credits, reservation_status, voice_generation_limit,
    service_credits_charged
  ) VALUES (
    p_user_id,
    trim(p_universe),
    COALESCE(p_ai_idea_mode, true),
    NULLIF(trim(COALESCE(p_premise, '')), ''),
    NULLIF(trim(COALESCE(p_plan->>'title', '')), ''),
    NULLIF(trim(COALESCE(p_plan->>'hook', '')), ''),
    CASE WHEN p_plan->>'cameraMode' = 'first_person' THEN 'first_person' ELSE 'third_person' END,
    COALESCE(p_plan->'worldBible', '{}'::jsonb),
    p_plan->'visualReferences',
    p_plan->'scenes',
    v_quality,
    'references',
    v_total_cost,
    'reserved',
    v_voice_limit,
    v_service_cost
  ) RETURNING * INTO v_generation;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(p_plan->'visualReferences') LOOP
    v_reference_id := v_ref->>'id';
    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, reference_id, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'reference:' || v_reference_id,
      'reference_image', v_reference_id, 'image:thirtydays1k', v_reference_cost
    );
  END LOOP;

  FOR v_scene IN SELECT value FROM jsonb_array_elements(p_plan->'scenes') LOOP
    v_scene_index := (v_scene->>'index')::integer;
    v_scene_day := (v_scene->>'day')::integer;
    v_day_scene := (v_scene->>'dayScene')::integer;
    IF v_scene_index NOT BETWEEN 0 AND 7 THEN RAISE EXCEPTION 'INVALID_SCENE_INDEX'; END IF;
    IF v_scene_day <> (ARRAY[1, 1, 10, 10, 20, 20, 30, 30])[v_scene_index + 1]
       OR v_day_scene <> (CASE WHEN v_scene_index % 2 = 0 THEN 1 ELSE 2 END)
    THEN
      RAISE EXCEPTION 'INVALID_MILESTONE_STRUCTURE';
    END IF;

    SELECT COALESCE(array_agg('reference:' || value ORDER BY ordinality), '{}'::text[])
    INTO v_dependencies
    FROM jsonb_array_elements_text(COALESCE(v_scene->'referenceIds', '[]'::jsonb))
      WITH ORDINALITY AS ids(value, ordinality);

    IF cardinality(v_dependencies) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'INVALID_SCENE_REFERENCES'; END IF;

    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, scene_index,
      dependency_keys, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'scene:' || v_scene_index || ':image',
      'scene_image', v_scene_index, v_dependencies, v_image_tool, v_image_cost
    );

    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, scene_index,
      dependency_keys, tool_key, cost_credits
    ) VALUES (
      v_generation.id, p_user_id, 'scene:' || v_scene_index || ':video',
      'scene_video', v_scene_index, ARRAY['scene:' || v_scene_index || ':image'],
      'video:seedance15pro', v_video_cost
    );
  END LOOP;

  INSERT INTO public.thirty_days_credit_ledger (generation_id, user_id, operation, credits)
  VALUES (v_generation.id, p_user_id, 'reserve', v_total_cost);

  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text) TO service_role;
