-- Preserve every successful persistent-reference edit and let the owner pick
-- which historical version is active for future episode generation.

CREATE OR REPLACE FUNCTION public.commit_thirty_days_series_reference_edit(
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
  v_current jsonb;
  v_generated jsonb;
  v_history jsonb;
  v_updated jsonb;
  v_refs jsonb;
  v_entities jsonb;
  v_new_id text := 'edit:' || p_generation_id::text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id AND series_id = p_series_id AND user_id = v_user_id
    AND generation_mode = 'series_reference' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REFERENCE_GENERATION_NOT_FOUND'; END IF;
  SELECT * INTO v_asset FROM public.thirty_days_generation_assets
  WHERE generation_id = v_generation.id AND asset_key = 'reference:' || p_reference_id FOR UPDATE;
  IF NOT FOUND OR v_asset.status <> 'succeeded' OR NULLIF(v_asset.result_url, '') IS NULL THEN
    RAISE EXCEPTION 'REFERENCE_GENERATION_NOT_READY';
  END IF;
  SELECT value INTO v_current FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id LIMIT 1;
  IF v_current IS NULL OR NULLIF(v_current->>'imageUrl', '') IS NULL THEN RAISE EXCEPTION 'REFERENCE_IMAGE_NOT_FOUND'; END IF;
  SELECT value INTO v_generated FROM jsonb_array_elements(COALESCE(v_generation.visual_references, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id LIMIT 1;

  -- Seed legacy references with their current/original image exactly once,
  -- then append the newly generated edit. URLs are stable immutable media.
  v_history := COALESCE(v_current->'imageHistory', '[]'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_history) entries(value)
                 WHERE value->>'imageUrl' = v_current->>'imageUrl') THEN
    v_history := v_history || jsonb_build_array(jsonb_build_object(
      'id', 'original:' || p_reference_id,
      'imageUrl', v_current->>'imageUrl',
      'kind', 'original',
      'createdAt', COALESCE(v_current->>'createdAt', v_series.created_at::text)
    ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_history) entries(value)
                 WHERE value->>'imageUrl' = v_asset.result_url) THEN
    v_history := v_history || jsonb_build_array(jsonb_build_object(
      'id', v_new_id,
      'imageUrl', v_asset.result_url,
      'kind', 'edit',
      'editInstruction', COALESCE(v_generated->>'editInstruction', ''),
      'createdAt', now()::text
    ));
  END IF;
  v_updated := (v_current - 'error') || jsonb_build_object(
    'imageUrl', v_asset.result_url,
    'selectedImageId', v_new_id,
    'imageHistory', v_history,
    'jobId', v_asset.job_id,
    'progress', 100,
    'status', 'succeeded'
  );

  SELECT COALESCE(jsonb_agg(CASE WHEN value->>'id' = p_reference_id THEN v_updated ELSE value END ORDER BY ordinality), '[]'::jsonb)
  INTO v_refs FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) WITH ORDINALITY refs(value, ordinality);
  SELECT COALESCE(jsonb_agg(CASE WHEN value->>'entityId' = v_updated->>'entityId'
    THEN jsonb_set(value, '{referenceId}', to_jsonb(p_reference_id), true) ELSE value END ORDER BY ordinality), '[]'::jsonb)
  INTO v_entities FROM jsonb_array_elements(COALESCE(v_series.entity_registry, '[]'::jsonb)) WITH ORDINALITY entities(value, ordinality);
  UPDATE public.thirty_days_series
  SET reference_library = v_refs, entity_registry = v_entities,
      cover_url = CASE WHEN cover_url = v_current->>'imageUrl' THEN v_asset.result_url ELSE cover_url END,
      last_active_at = now(), updated_at = now()
  WHERE id = v_series.id RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

CREATE OR REPLACE FUNCTION public.select_thirty_days_series_reference_image(
  p_series_id uuid,
  p_reference_id text,
  p_image_id text
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series public.thirty_days_series;
  v_current jsonb;
  v_selected jsonb;
  v_updated jsonb;
  v_refs jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series
  WHERE id = p_series_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  IF v_series.status IN ('planning', 'references') OR EXISTS (
    SELECT 1 FROM public.thirty_days_series_episodes WHERE series_id = v_series.id
      AND status IN ('planning', 'generating', 'voiceover', 'stitching')
  ) THEN RAISE EXCEPTION 'SERIES_REFERENCE_BUSY'; END IF;
  SELECT value INTO v_current FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) refs(value)
  WHERE value->>'id' = p_reference_id LIMIT 1;
  IF v_current IS NULL THEN RAISE EXCEPTION 'REFERENCE_NOT_FOUND'; END IF;
  SELECT value INTO v_selected FROM jsonb_array_elements(COALESCE(v_current->'imageHistory', '[]'::jsonb)) entries(value)
  WHERE value->>'id' = p_image_id AND NULLIF(value->>'imageUrl', '') IS NOT NULL LIMIT 1;
  IF v_selected IS NULL THEN RAISE EXCEPTION 'REFERENCE_IMAGE_VERSION_NOT_FOUND'; END IF;
  v_updated := v_current || jsonb_build_object('imageUrl', v_selected->>'imageUrl', 'selectedImageId', p_image_id, 'status', 'succeeded', 'progress', 100);
  SELECT COALESCE(jsonb_agg(CASE WHEN value->>'id' = p_reference_id THEN v_updated ELSE value END ORDER BY ordinality), '[]'::jsonb)
  INTO v_refs FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb)) WITH ORDINALITY refs(value, ordinality);
  UPDATE public.thirty_days_series SET reference_library = v_refs,
      cover_url = CASE WHEN cover_url = v_current->>'imageUrl' THEN v_selected->>'imageUrl' ELSE cover_url END,
      last_active_at = now(), updated_at = now()
  WHERE id = v_series.id RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_thirty_days_series_reference_edit(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.select_thirty_days_series_reference_image(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_thirty_days_series_reference_edit(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_thirty_days_series_reference_image(uuid, text, text) TO authenticated;
