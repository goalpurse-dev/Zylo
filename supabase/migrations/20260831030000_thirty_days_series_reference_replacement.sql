-- Safe user-controlled replacement of one persistent Series reference.
-- Duplicate entity/version cards are removed and relinked without creating
-- another image. A unique card becomes an explicit placeholder; generation
-- is reserved only when the user presses Generate on that placeholder.

ALTER TABLE public.thirty_days_generations
  DROP CONSTRAINT IF EXISTS thirty_days_generations_generation_mode_check;
ALTER TABLE public.thirty_days_generations
  ADD CONSTRAINT thirty_days_generations_generation_mode_check
  CHECK (generation_mode IN ('single', 'series_setup', 'series_episode', 'series_reference'));

CREATE OR REPLACE FUNCTION public.remove_thirty_days_series_reference(
  p_series_id uuid,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series public.thirty_days_series;
  v_target jsonb;
  v_survivor jsonb;
  v_refs jsonb;
  v_entities jsonb;
  v_mode text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_series
  FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  IF v_series.status IN ('planning', 'references') OR EXISTS (
    SELECT 1 FROM public.thirty_days_series_episodes
    WHERE series_id = v_series.id
      AND status IN ('planning', 'generating', 'voiceover', 'stitching')
  ) THEN
    RAISE EXCEPTION 'SERIES_REFERENCE_BUSY';
  END IF;

  SELECT value INTO v_target
  FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id
  LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;

  -- The same entity and version is never a second valid identity. Removing
  -- one of these is a true cleanup: keep the other card and reconnect the
  -- registry atomically, rather than leaving a placeholder that would just
  -- regenerate the same duplicate again.
  IF NULLIF(v_target->>'entityId', '') IS NOT NULL THEN
    SELECT value INTO v_survivor
    FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
    WHERE value->>'id' <> p_reference_id
      AND value->>'entityId' = v_target->>'entityId'
      AND COALESCE(NULLIF(value->>'version', '')::integer, 1)
          = COALESCE(NULLIF(v_target->>'version', '')::integer, 1)
    ORDER BY COALESCE(NULLIF(value->>'imageUrl', ''), '') <> '' DESC
    LIMIT 1;
  END IF;

  IF v_survivor IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
    INTO v_refs
    FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb))
      WITH ORDINALITY refs(value, ordinality)
    WHERE value->>'id' <> p_reference_id;

    SELECT COALESCE(jsonb_agg(
      CASE WHEN value->>'referenceId' = p_reference_id
        THEN jsonb_set(value, '{referenceId}', to_jsonb(v_survivor->>'id'), true)
        ELSE value END
      ORDER BY ordinality
    ), '[]'::jsonb)
    INTO v_entities
    FROM jsonb_array_elements(COALESCE(v_series.entity_registry, '[]'::jsonb))
      WITH ORDINALITY entities(value, ordinality);
    v_mode := 'duplicate_removed';
  ELSE
    SELECT COALESCE(jsonb_agg(
      CASE WHEN value->>'id' = p_reference_id THEN
        (value - 'imageUrl' - 'jobId' - 'error' - 'progress') || jsonb_build_object(
          'imageUrl', NULL,
          'jobId', NULL,
          'error', NULL,
          'progress', 0,
          'status', 'awaiting_regeneration'
        )
      ELSE value END
      ORDER BY ordinality
    ), '[]'::jsonb)
    INTO v_refs
    FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb))
      WITH ORDINALITY refs(value, ordinality);
    v_entities := COALESCE(v_series.entity_registry, '[]'::jsonb);
    v_mode := 'placeholder_created';
  END IF;

  UPDATE public.thirty_days_series
  SET reference_library = v_refs,
      entity_registry = v_entities,
      cover_url = CASE
        WHEN cover_url = v_target->>'imageUrl' THEN (
          SELECT NULLIF(value->>'imageUrl', '')
          FROM jsonb_array_elements(v_refs) refs(value)
          WHERE NULLIF(value->>'imageUrl', '') IS NOT NULL
          LIMIT 1
        )
        ELSE cover_url
      END,
      last_active_at = now(),
      updated_at = now()
  WHERE id = v_series.id
  RETURNING * INTO v_series;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'series', to_jsonb(v_series),
    'survivorReferenceId', v_survivor->>'id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_thirty_days_series_reference_regeneration(
  p_series_id uuid,
  p_reference_id text
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
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_series
  FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  IF v_series.status IN ('planning', 'references') OR EXISTS (
    SELECT 1 FROM public.thirty_days_series_episodes
    WHERE series_id = v_series.id
      AND status IN ('planning', 'generating', 'voiceover', 'stitching')
  ) THEN
    RAISE EXCEPTION 'SERIES_REFERENCE_BUSY';
  END IF;

  SELECT value INTO v_reference
  FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id
  LIMIT 1;
  IF v_reference IS NULL THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
  IF NULLIF(v_reference->>'imageUrl', '') IS NOT NULL
     OR v_reference->>'status' <> 'awaiting_regeneration' THEN
    RAISE EXCEPTION 'REFERENCE_NOT_A_PLACEHOLDER';
  END IF;

  SELECT * INTO v_generation
  FROM public.thirty_days_generations
  WHERE series_id = v_series.id
    AND user_id = v_user_id
    AND generation_mode = 'series_reference'
    AND reservation_status = 'reserved'
    AND visual_references->0->>'id' = p_reference_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF FOUND THEN RETURN v_generation; END IF;

  SELECT * INTO v_tier
  FROM public.thirty_days_quality_tiers
  WHERE quality_tier = v_series.quality_tier
  FOR SHARE;
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
  v_reference := (v_reference - 'jobId' - 'error' - 'progress') || jsonb_build_object(
    'jobId', NULL, 'error', NULL, 'progress', 0, 'status', 'queued'
  );

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, title, hook, camera_mode,
    world_bible, visual_references, scenes, quality_tier, visual_style,
    status, reserved_credits, reservation_status, voice_generation_limit,
    service_credits_charged, generation_mode, series_id
  ) VALUES (
    v_user_id, v_series.universe, true, v_series.premise,
    'Reference replacement · ' || COALESCE(v_reference->>'label', p_reference_id),
    v_series.premise, 'third_person',
    COALESCE(v_series.master_story_bible->'worldBible', '{}'::jsonb),
    jsonb_build_array(v_reference), '[]'::jsonb,
    v_series.quality_tier, v_series.visual_style,
    'references', v_cost, 'reserved', 0, 0,
    'series_reference', v_series.id
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

CREATE OR REPLACE FUNCTION public.commit_thirty_days_series_reference_regeneration(
  p_series_id uuid,
  p_generation_id uuid,
  p_reference_id text
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
  v_asset public.thirty_days_generation_assets;
  v_reference jsonb;
  v_refs jsonb;
  v_entities jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id AND series_id = p_series_id
    AND user_id = v_user_id AND generation_mode = 'series_reference'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REFERENCE_GENERATION_NOT_FOUND'; END IF;
  SELECT * INTO v_asset FROM public.thirty_days_generation_assets
  WHERE generation_id = v_generation.id
    AND asset_key = 'reference:' || p_reference_id
  FOR UPDATE;
  IF NOT FOUND OR v_asset.status <> 'succeeded'
     OR NULLIF(v_asset.result_url, '') IS NULL THEN
    RAISE EXCEPTION 'REFERENCE_GENERATION_NOT_READY';
  END IF;

  SELECT value INTO v_reference
  FROM jsonb_array_elements(COALESCE(v_generation.visual_references, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id LIMIT 1;
  IF v_reference IS NULL THEN RAISE EXCEPTION 'REFERENCE_GENERATION_INVALID'; END IF;
  v_reference := (v_reference - 'error') || jsonb_build_object(
    'imageUrl', v_asset.result_url,
    'jobId', v_asset.job_id,
    'progress', 100,
    'status', 'succeeded'
  );

  SELECT COALESCE(jsonb_agg(
    CASE WHEN value->>'id' = p_reference_id THEN v_reference ELSE value END
    ORDER BY ordinality
  ), '[]'::jsonb)
  INTO v_refs
  FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb))
    WITH ORDINALITY refs(value, ordinality);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_refs) refs(value)
                 WHERE value->>'id' = p_reference_id) THEN
    RAISE EXCEPTION 'REFERENCE_PLACEHOLDER_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(
    CASE WHEN value->>'entityId' = v_reference->>'entityId'
      THEN jsonb_set(value, '{referenceId}', to_jsonb(p_reference_id), true)
      ELSE value END
    ORDER BY ordinality
  ), '[]'::jsonb)
  INTO v_entities
  FROM jsonb_array_elements(COALESCE(v_series.entity_registry, '[]'::jsonb))
    WITH ORDINALITY entities(value, ordinality);

  UPDATE public.thirty_days_series
  SET reference_library = v_refs,
      entity_registry = v_entities,
      cover_url = COALESCE(NULLIF(cover_url, ''), v_asset.result_url),
      last_active_at = now(),
      updated_at = now()
  WHERE id = v_series.id
  RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_thirty_days_series_reference(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_thirty_days_series_reference_regeneration(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.commit_thirty_days_series_reference_regeneration(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_thirty_days_series_reference(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_series_reference_regeneration(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_thirty_days_series_reference_regeneration(uuid, uuid, text)
  TO authenticated;

-- Restore must use the same identity invariant as deletion/planning. The old
-- implementation deduplicated only by reference id, so a restored setup id
-- such as `companion` could sit beside `ref_companion_eevee_v1` even though
-- both represented companion_eevee version 1.
CREATE OR REPLACE FUNCTION public.restore_thirty_days_series_references(
  p_series_id uuid
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series public.thirty_days_series;
  v_setup_references jsonb;
  v_merged_references jsonb;
  v_entities jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_series
  FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;

  SELECT COALESCE(visual_references, '[]'::jsonb)
  INTO v_setup_references
  FROM public.thirty_days_generations
  WHERE id = v_series.setup_generation_id AND user_id = v_user_id;
  IF COALESCE(jsonb_array_length(v_setup_references), 0) = 0 THEN
    RAISE EXCEPTION 'SETUP_REFERENCES_NOT_FOUND';
  END IF;

  WITH candidates AS (
    SELECT ref, 0 AS source_rank, ordinality AS source_order
    FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb))
      WITH ORDINALITY AS current_refs(ref, ordinality)
    UNION ALL
    SELECT ref, 1 AS source_rank, ordinality AS source_order
    FROM jsonb_array_elements(v_setup_references)
      WITH ORDINALITY AS setup_refs(ref, ordinality)
  ), keyed AS (
    SELECT *, CASE
      WHEN NULLIF(ref->>'entityId', '') IS NOT NULL
        THEN 'entity:' || (ref->>'entityId') || ':v' || COALESCE(NULLIF(ref->>'version', ''), '1')
      ELSE 'id:' || COALESCE(NULLIF(ref->>'id', ''), 'missing')
    END AS identity_key
    FROM candidates
    WHERE NULLIF(ref->>'id', '') IS NOT NULL
  ), selected AS (
    SELECT DISTINCT ON (identity_key) ref, source_rank, source_order
    FROM keyed
    ORDER BY identity_key, source_rank, source_order
  )
  SELECT COALESCE(jsonb_agg(ref ORDER BY source_rank, source_order), '[]'::jsonb)
  INTO v_merged_references
  FROM selected;
  IF jsonb_array_length(v_merged_references) = 0 THEN
    RAISE EXCEPTION 'SETUP_REFERENCES_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(
    CASE WHEN replacement.reference_id IS NOT NULL
      THEN jsonb_set(entity, '{referenceId}', to_jsonb(replacement.reference_id), true)
      ELSE entity END
    ORDER BY entity_order
  ), '[]'::jsonb)
  INTO v_entities
  FROM jsonb_array_elements(COALESCE(v_series.entity_registry, '[]'::jsonb))
    WITH ORDINALITY entities(entity, entity_order)
  LEFT JOIN LATERAL (
    SELECT ref->>'id' AS reference_id
    FROM jsonb_array_elements(v_merged_references) refs(ref)
    WHERE ref->>'entityId' = entity->>'entityId'
      AND NULLIF(ref->>'imageUrl', '') IS NOT NULL
    ORDER BY COALESCE(NULLIF(ref->>'version', '')::integer, 1) DESC
    LIMIT 1
  ) replacement ON true;

  UPDATE public.thirty_days_series
  SET reference_library = v_merged_references,
      entity_registry = v_entities,
      cover_url = COALESCE(NULLIF(cover_url, ''), NULLIF(v_merged_references->0->>'imageUrl', '')),
      last_active_at = now(),
      updated_at = now()
  WHERE id = v_series.id
  RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_thirty_days_series_references(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_thirty_days_series_references(uuid)
  TO authenticated;
