-- A scene may need the protagonist, two recurring characters, and the one
-- matching persistent location reference. Keep the reservation RPC aligned
-- with the planner's four-reference scene cap.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.begin_thirty_days_series_episode(uuid,uuid,jsonb)'::regprocedure)
  INTO v_definition;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'BEGIN_SERIES_EPISODE_FUNCTION_MISSING';
  END IF;
  v_definition := replace(v_definition, 'cardinality(v_dependencies) NOT BETWEEN 1 AND 3', 'cardinality(v_dependencies) NOT BETWEEN 1 AND 4');
  EXECUTE v_definition;
END;
$$;
