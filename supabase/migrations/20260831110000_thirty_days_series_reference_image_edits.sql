-- User-directed image-to-image edits for an existing persistent Series
-- reference. This keeps the existing reference live until the replacement
-- succeeds, so a failed provider job can be refunded without breaking future
-- episode continuity.

CREATE OR REPLACE FUNCTION public.begin_thirty_days_series_reference_edit(
  p_series_id uuid,
  p_reference_id text,
  p_edit_instruction text
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
  v_tier public.thirty_days_quality_tiers;
  v_reference jsonb;
  v_cost integer;
  v_plan_code text;
  v_plan_rank integer;
  v_min_rank integer;
  v_instruction text := btrim(COALESCE(p_edit_instruction, ''));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF length(v_instruction) < 3 OR length(v_instruction) > 800 THEN
    RAISE EXCEPTION 'INVALID_EDIT_INSTRUCTION';
  END IF;

  SELECT * INTO v_series FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  IF v_series.status IN ('planning', 'references') OR EXISTS (
    SELECT 1 FROM public.thirty_days_series_episodes
    WHERE series_id = v_series.id AND status IN ('planning', 'generating', 'voiceover', 'stitching')
  ) THEN RAISE EXCEPTION 'SERIES_REFERENCE_BUSY'; END IF;

  SELECT value INTO v_reference
  FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id LIMIT 1;
  IF v_reference IS NULL OR NULLIF(v_reference->>'imageUrl', '') IS NULL THEN
    RAISE EXCEPTION 'REFERENCE_IMAGE_NOT_FOUND';
  END IF;

  -- An active reservation makes repeat clicks idempotent; no second image or
  -- second charge can be created for the same edit slot.
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE series_id = v_series.id AND user_id = v_user_id
    AND generation_mode = 'series_reference' AND reservation_status = 'reserved'
    AND visual_references->0->>'id' = p_reference_id
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_generation; END IF;

  SELECT * INTO v_tier FROM public.thirty_days_quality_tiers
  WHERE quality_tier = v_series.quality_tier FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRICING_NOT_CONFIGURED'; END IF;
  SELECT lower(COALESCE(plan_code, 'free')) INTO v_plan_code
  FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  v_plan_rank := CASE v_plan_code WHEN 'generative' THEN 3 WHEN 'pro' THEN 2
    WHEN 'starter' THEN 1 WHEN 'affiliate' THEN 1 ELSE 0 END;
  v_min_rank := CASE v_tier.min_plan WHEN 'generative' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END;
  IF v_plan_rank < v_min_rank THEN RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED'; END IF;

  v_cost := v_tier.reference_cost_credits;
  PERFORM public.deduct_credits(v_user_id, v_cost);
  v_reference := v_reference || jsonb_build_object(
    'sourceImageUrl', v_reference->>'imageUrl',
    'editInstruction', v_instruction,
    'jobId', NULL, 'error', NULL, 'progress', 0, 'status', 'queued'
  );

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, title, hook, camera_mode,
    world_bible, visual_references, scenes, quality_tier, visual_style,
    status, reserved_credits, reservation_status, voice_generation_limit,
    service_credits_charged, generation_mode, series_id
  ) VALUES (
    v_user_id, v_series.universe, true, v_series.premise,
    'Reference edit · ' || COALESCE(v_reference->>'label', p_reference_id),
    v_series.premise, 'third_person',
    COALESCE(v_series.master_story_bible->'worldBible', '{}'::jsonb),
    jsonb_build_array(v_reference), '[]'::jsonb,
    v_series.quality_tier, v_series.visual_style,
    'references', v_cost, 'reserved', 0, 0, 'series_reference', v_series.id
  ) RETURNING * INTO v_generation;

  INSERT INTO public.thirty_days_generation_assets (
    generation_id, user_id, asset_key, asset_type, reference_id, tool_key, cost_credits
  ) VALUES (
    v_generation.id, v_user_id, 'reference:' || p_reference_id,
    'reference_image', p_reference_id, v_tier.reference_tool_key, v_cost
  );
  INSERT INTO public.thirty_days_credit_ledger (generation_id, user_id, operation, credits)
  VALUES (v_generation.id, v_user_id, 'reserve', v_cost);
  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_thirty_days_series_reference_edit(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_series_reference_edit(uuid, text, text)
  TO authenticated;
