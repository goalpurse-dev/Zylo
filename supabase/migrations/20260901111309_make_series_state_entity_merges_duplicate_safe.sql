-- A planner retry can historically leave two updates for the same entity in
-- one episode delta. Preserve the latest declaration instead of making the
-- entire already-rendered episode impossible to verify.
CREATE OR REPLACE FUNCTION public.merge_thirty_days_story_state(
  p_previous jsonb,
  p_delta jsonb,
  p_verified jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_previous jsonb := COALESCE(p_previous, '{}'::jsonb);
  v_delta jsonb := COALESCE(p_delta, '{}'::jsonb);
  v_verified jsonb := COALESCE(p_verified, '{}'::jsonb);
  v_entities jsonb;
  v_inventory jsonb;
  v_abilities jsonb;
  v_events jsonb;
  v_beats jsonb;
BEGIN
  WITH previous_entities AS (
    SELECT DISTINCT ON (value->>'entityId') value AS entity
    FROM jsonb_array_elements(COALESCE(v_previous->'entities', '[]'::jsonb)) WITH ORDINALITY AS entries(value, position)
    WHERE NULLIF(value->>'entityId', '') IS NOT NULL
    ORDER BY value->>'entityId', position DESC
  ), changes AS (
    SELECT DISTINCT ON (value->>'entityId') value AS change
    FROM jsonb_array_elements(COALESCE(v_delta->'entityChanges', '[]'::jsonb)) WITH ORDINALITY AS entries(value, position)
    WHERE NULLIF(value->>'entityId', '') IS NOT NULL
    ORDER BY value->>'entityId', position DESC
  ), ids AS (
    SELECT entity->>'entityId' AS id FROM previous_entities
    UNION
    SELECT change->>'entityId' AS id FROM changes
  )
  SELECT COALESCE(jsonb_agg(
    COALESCE((SELECT entity FROM previous_entities WHERE entity->>'entityId' = ids.id), '{}'::jsonb)
    || COALESCE((SELECT change FROM changes WHERE change->>'entityId' = ids.id), '{}'::jsonb)
    ORDER BY ids.id
  ), '[]'::jsonb) INTO v_entities FROM ids WHERE ids.id IS NOT NULL;

  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb) INTO v_inventory
  FROM (SELECT DISTINCT value FROM (
    SELECT value FROM jsonb_array_elements_text(COALESCE(v_previous->'inventory', '[]'::jsonb))
    UNION ALL SELECT value FROM jsonb_array_elements_text(COALESCE(v_delta #> '{inventoryChanges,added}', '[]'::jsonb))
  ) items WHERE value <> ALL(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_delta #> '{inventoryChanges,removed}', '[]'::jsonb)))) ) kept;

  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb) INTO v_abilities
  FROM (SELECT DISTINCT value FROM (
    SELECT value FROM jsonb_array_elements_text(COALESCE(v_previous->'abilities', '[]'::jsonb))
    UNION ALL SELECT value FROM jsonb_array_elements_text(COALESCE(v_delta #> '{abilityChanges,learned}', '[]'::jsonb))
  ) items WHERE value <> ALL(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_delta #> '{abilityChanges,lost}', '[]'::jsonb)))) ) kept;

  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) INTO v_events FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_previous->'events', '[]'::jsonb))
      UNION ALL SELECT value FROM jsonb_array_elements(COALESCE(v_verified->'events', '[]'::jsonb))
    ) all_events
  ) unique_events;
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) INTO v_beats FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements_text(COALESCE(v_previous->'consumedBeatIds', '[]'::jsonb))
      UNION ALL SELECT value FROM jsonb_array_elements_text(COALESCE(v_delta->'roadmapBeatsConsumed', '[]'::jsonb))
    ) all_beats
  ) unique_beats;

  RETURN v_previous || jsonb_build_object(
    'entities', v_entities,
    'relationships', COALESCE(v_previous->'relationships', '{}'::jsonb) || COALESCE(v_delta->'relationshipChanges', '{}'::jsonb),
    'inventory', v_inventory,
    'abilities', v_abilities,
    'mysteries', COALESCE(v_previous->'mysteries', '{}'::jsonb) || COALESCE(v_delta->'mysteryChanges', '{}'::jsonb),
    'currentLocation', COALESCE(v_delta->'locationChange', v_previous->'currentLocation', 'null'::jsonb),
    'events', v_events,
    'consumedBeatIds', v_beats,
    'lastVerifiedEpisodeId', COALESCE(v_verified->'episodeId', v_previous->'lastVerifiedEpisodeId', 'null'::jsonb),
    'lastVerifiedAt', COALESCE(v_verified->'verifiedAt', v_previous->'lastVerifiedAt', 'null'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_thirty_days_story_state(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_thirty_days_story_state(jsonb, jsonb, jsonb) TO service_role;
