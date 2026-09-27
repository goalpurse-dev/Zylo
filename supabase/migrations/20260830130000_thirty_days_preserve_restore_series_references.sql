-- Repair the first-episode deletion rollback introduced in
-- 20260830120000. An empty initialized JSON array was treated as a valid
-- previous-episode library and replaced the setup-time persistent references.
--
-- The recovery RPC restores the already-generated setup references without
-- charging or dispatching any work. The v2 delete entry point also guarantees
-- that deletion cannot commit with an empty persistent reference library.

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

  -- Keep any current/newer reference version first, then append setup
  -- references whose stable id is missing. This also repairs a fully empty
  -- library while remaining safe for a partially damaged one.
  WITH candidates AS (
    SELECT ref, 0 AS source_rank, ordinality AS source_order
    FROM jsonb_array_elements(COALESCE(v_series.reference_library, '[]'::jsonb))
      WITH ORDINALITY AS current_refs(ref, ordinality)
    UNION ALL
    SELECT ref, 1 AS source_rank, ordinality AS source_order
    FROM jsonb_array_elements(v_setup_references)
      WITH ORDINALITY AS setup_refs(ref, ordinality)
  ), selected AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(ref->>'id', ''), NULLIF(ref->>'entityId', '')))
      ref, source_rank, source_order
    FROM candidates
    WHERE COALESCE(NULLIF(ref->>'id', ''), NULLIF(ref->>'entityId', '')) IS NOT NULL
    ORDER BY COALESCE(NULLIF(ref->>'id', ''), NULLIF(ref->>'entityId', '')),
             source_rank, source_order
  )
  SELECT COALESCE(jsonb_agg(ref ORDER BY source_rank, source_order), '[]'::jsonb)
  INTO v_merged_references
  FROM selected;

  IF jsonb_array_length(v_merged_references) = 0 THEN
    RAISE EXCEPTION 'SETUP_REFERENCES_NOT_FOUND';
  END IF;

  UPDATE public.thirty_days_series
  SET reference_library = v_merged_references,
      cover_url = COALESCE(NULLIF(cover_url, ''), NULLIF(v_merged_references->0->>'imageUrl', '')),
      last_active_at = now()
  WHERE id = v_series.id
  RETURNING * INTO v_series;

  RETURN v_series;
END;
$$;

-- The original deletion RPC may already be deployed with the empty-array
-- bug. Keep it private and put a fail-safe wrapper in front of it so a delete
-- and its reference restoration remain one database transaction.
CREATE OR REPLACE FUNCTION public.delete_latest_thirty_days_series_episode_v2(
  p_episode_id uuid
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_series public.thirty_days_series;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  v_series := public.delete_latest_thirty_days_series_episode(p_episode_id);

  IF COALESCE(jsonb_array_length(v_series.reference_library), 0) = 0 THEN
    -- If setup references cannot be recovered, this exception rolls back the
    -- entire episode deletion instead of leaving the Series damaged.
    v_series := public.restore_thirty_days_series_references(v_series.id);
  END IF;

  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_thirty_days_series_references(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_latest_thirty_days_series_episode_v2(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_latest_thirty_days_series_episode(uuid)
  FROM authenticated;

GRANT EXECUTE ON FUNCTION public.restore_thirty_days_series_references(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_latest_thirty_days_series_episode_v2(uuid)
  TO authenticated;
