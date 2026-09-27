-- A 30-day series needs to remember returning places (lab, base, route,
-- arena, town) across the entire run. The original setup-only cap of ten
-- references prevented that memory from growing beyond the first episodes.
ALTER TABLE public.thirty_days_series
  DROP CONSTRAINT IF EXISTS thirty_days_series_reference_library_check;

ALTER TABLE public.thirty_days_series
  ADD CONSTRAINT thirty_days_series_reference_library_check
  CHECK (jsonb_array_length(reference_library) <= 40);

-- Keep the database-side episode reservation in sync with the planner: two
-- identity references plus one optional new environment per episode, with a
-- long-lived 40-reference library. pg_get_functiondef preserves the current
-- deployed body while changing only these validated limits.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.begin_thirty_days_series_episode(uuid,uuid,jsonb)'::regprocedure)
  INTO v_definition;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'BEGIN_SERIES_EPISODE_FUNCTION_MISSING';
  END IF;
  v_definition := replace(v_definition, 'jsonb_array_length(v_new_refs) > 2', 'jsonb_array_length(v_new_refs) > 3');
  v_definition := replace(v_definition, 'jsonb_array_length(v_series.reference_library) + jsonb_array_length(v_new_refs) > 10', 'jsonb_array_length(v_series.reference_library) + jsonb_array_length(v_new_refs) > 40');
  EXECUTE v_definition;
END;
$$;
