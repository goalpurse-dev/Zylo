-- Versioned persistent-story architecture for 30 Days Series. This migration
-- is intentionally not deployed automatically; planner/state/media tests must
-- pass first. Existing rows remain readable at v1 and are repaired lazily.

ALTER TABLE public.thirty_days_series
  ADD COLUMN IF NOT EXISTS raw_user_input text,
  ADD COLUMN IF NOT EXISTS normalized_input text,
  ADD COLUMN IF NOT EXISTS franchise_resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS entity_registry jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS roadmap_beats jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pacing_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_story_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS series_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS roadmap_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS entity_registry_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.thirty_days_series
  ADD CONSTRAINT thirty_days_series_franchise_resolution_object
    CHECK (jsonb_typeof(franchise_resolution) = 'object'),
  ADD CONSTRAINT thirty_days_series_entity_registry_array
    CHECK (jsonb_typeof(entity_registry) = 'array'),
  ADD CONSTRAINT thirty_days_series_roadmap_beats_array
    CHECK (jsonb_typeof(roadmap_beats) = 'array'),
  ADD CONSTRAINT thirty_days_series_pacing_state_object
    CHECK (jsonb_typeof(pacing_state) = 'object'),
  ADD CONSTRAINT thirty_days_series_verified_story_state_object
    CHECK (jsonb_typeof(verified_story_state) = 'object');

ALTER TABLE public.thirty_days_series_episodes
  ADD COLUMN IF NOT EXISTS state_delta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_episode jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS render_observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS episode_plan_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tts_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.thirty_days_series_episodes
  ADD CONSTRAINT thirty_days_series_episode_state_delta_object
    CHECK (jsonb_typeof(state_delta) = 'object'),
  ADD CONSTRAINT thirty_days_series_episode_verified_object
    CHECK (jsonb_typeof(verified_episode) = 'object'),
  ADD CONSTRAINT thirty_days_series_episode_observations_array
    CHECK (jsonb_typeof(render_observations) = 'array');

ALTER TABLE public.thirty_days_generation_assets
  ADD COLUMN IF NOT EXISTS qa_observations jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.thirty_days_series
SET raw_user_input = COALESCE(raw_user_input, universe),
    normalized_input = COALESCE(normalized_input, lower(trim(universe))),
    franchise_resolution = CASE WHEN franchise_resolution = '{}'::jsonb THEN
      jsonb_build_object(
        'rawUserInput', universe,
        'normalizedInput', lower(trim(universe)),
        'resolvedFranchise', COALESCE(master_story_bible #>> '{worldBible,franchise}', master_story_bible->>'franchise', universe),
        'resolvedProperty', COALESCE(master_story_bible #>> '{worldBible,world}', master_story_bible->>'world', universe),
        'resolvedWorld', COALESCE(master_story_bible #>> '{worldBible,world}', master_story_bible->>'world', universe),
        'confidence', COALESCE(master_story_bible #> '{worldBible,confidence}', master_story_bible->'confidence', '0'::jsonb),
        'aliases', '[]'::jsonb,
        'candidates', '[]'::jsonb,
        'rationale', 'Legacy row inferred from its persisted world bible'
      ) ELSE franchise_resolution END,
    entity_registry = CASE WHEN entity_registry = '[]'::jsonb THEN
      jsonb_build_array(jsonb_build_object(
        'entityId', 'protagonist', 'entityType', 'protagonist',
        'canonicalType', 'viewer protagonist', 'displayName', 'YOU',
        'status', 'active', 'introducedDay', 1,
        'currentForm', 'viewer protagonist',
        'visualIdentity', COALESCE(master_story_bible #>> '{worldBible,viewerProtagonist,visualIdentity}', ''),
        'referenceId', 'you', 'abilities', '[]'::jsonb, 'relationships', '{}'::jsonb
      )) ELSE entity_registry END,
    verified_story_state = CASE WHEN verified_story_state = '{}'::jsonb
      THEN current_story_state || jsonb_build_object('entities', entity_registry)
      ELSE verified_story_state END
WHERE raw_user_input IS NULL OR franchise_resolution = '{}'::jsonb
   OR entity_registry = '[]'::jsonb OR verified_story_state = '{}'::jsonb;

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
    SELECT value AS entity FROM jsonb_array_elements(COALESCE(v_previous->'entities', '[]'::jsonb))
  ), changes AS (
    SELECT value AS change FROM jsonb_array_elements(COALESCE(v_delta->'entityChanges', '[]'::jsonb))
  ), ids AS (
    SELECT entity->>'entityId' AS id FROM previous_entities
    UNION SELECT change->>'entityId' FROM changes
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

CREATE OR REPLACE FUNCTION public.service_commit_thirty_days_series_episode(
  p_episode_id uuid,
  p_verified_episode jsonb,
  p_state_delta jsonb,
  p_thumbnail_url text DEFAULT NULL
)
RETURNS public.thirty_days_series_episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_episode public.thirty_days_series_episodes;
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
  v_new_state jsonb;
  v_illegal_beats text[];
BEGIN
  SELECT * INTO v_episode FROM public.thirty_days_series_episodes WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EPISODE_NOT_FOUND'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series WHERE id = v_episode.series_id FOR UPDATE;
  SELECT * INTO v_generation FROM public.thirty_days_generations WHERE id = v_episode.generation_id FOR UPDATE;
  IF v_episode.status = 'completed' THEN RETURN v_episode; END IF;
  IF v_episode.start_day <> v_series.current_day + 1 THEN RAISE EXCEPTION 'EPISODE_OUT_OF_ORDER'; END IF;
  IF v_generation.reservation_status = 'reserved' THEN RAISE EXCEPTION 'EPISODE_ASSETS_NOT_SETTLED'; END IF;
  IF jsonb_typeof(COALESCE(p_verified_episode->'events', 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_verified_episode->'events', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'VERIFIED_EVENTS_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.thirty_days_generation_assets
    WHERE generation_id = v_generation.id AND asset_type = 'scene_image'
      AND (status <> 'succeeded' OR qa_status NOT IN ('passed', 'unavailable'))
  ) OR EXISTS (
    SELECT 1 FROM public.thirty_days_generation_assets
    WHERE generation_id = v_generation.id AND asset_type = 'scene_video' AND status <> 'succeeded'
  ) THEN RAISE EXCEPTION 'EPISODE_MEDIA_NOT_VERIFIED'; END IF;

  SELECT array_agg(value) INTO v_illegal_beats
  FROM jsonb_array_elements_text(COALESCE(p_state_delta->'roadmapBeatsConsumed', '[]'::jsonb)) consumed(value)
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_series.roadmap_beats) beat
    WHERE beat->>'beatId' = consumed.value
      AND COALESCE((beat->>'notBeforeDay')::integer, 1) <= v_episode.end_day
      AND COALESCE((beat->>'mustResolveByDay')::integer, 30) >= v_episode.start_day
  );
  IF cardinality(v_illegal_beats) > 0 THEN RAISE EXCEPTION 'ROADMAP_BEAT_LOCKED:%', array_to_string(v_illegal_beats, ','); END IF;

  v_new_state := public.merge_thirty_days_story_state(v_series.verified_story_state, p_state_delta, p_verified_episode);
  UPDATE public.thirty_days_series_episodes
  SET state_delta = COALESCE(p_state_delta, '{}'::jsonb),
      verified_episode = p_verified_episode,
      render_observations = COALESCE(p_verified_episode->'observations', '[]'::jsonb),
      episode_summary = p_verified_episode,
      verification_status = 'verified', status = 'completed', completed_at = now(),
      thumbnail_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), thumbnail_url),
      episode_plan_version = 2
  WHERE id = p_episode_id RETURNING * INTO v_episode;

  UPDATE public.thirty_days_series
  SET current_day = v_episode.end_day,
      current_episode = v_episode.episode_number,
      status = CASE WHEN v_episode.end_day >= total_days THEN 'completed' ELSE 'ready' END,
      verified_story_state = v_new_state,
      current_story_state = v_new_state,
      entity_registry = COALESCE(v_new_state->'entities', entity_registry),
      reference_library = v_generation.visual_references,
      pacing_state = pacing_state || jsonb_build_object(
        'consumedBeatIds', COALESCE(v_new_state->'consumedBeatIds', '[]'::jsonb),
        'lastCompletedDay', v_episode.end_day
      ),
      next_episode_tease = COALESCE(NULLIF(v_episode.next_episode_tease, ''), p_verified_episode->>'nextEpisodeSetup'),
      cover_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), cover_url),
      series_schema_version = 2, roadmap_version = 2, entity_registry_version = 1,
      last_active_at = now()
  WHERE id = v_series.id;
  RETURN v_episode;
END;
$$;

REVOKE ALL ON FUNCTION public.service_commit_thirty_days_series_episode(uuid, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_commit_thirty_days_series_episode(uuid, jsonb, jsonb, text) TO service_role;

-- Authenticated callers may attach a locally stitched/narrated export, but
-- cannot advance canon or submit an episode summary.
CREATE OR REPLACE FUNCTION public.attach_thirty_days_series_episode_export(
  p_episode_id uuid,
  p_final_video_url text,
  p_thumbnail_url text DEFAULT NULL
)
RETURNS public.thirty_days_series_episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_episode public.thirty_days_series_episodes;
BEGIN
  UPDATE public.thirty_days_series_episodes
  SET final_video_url = NULLIF(trim(COALESCE(p_final_video_url, '')), ''),
      thumbnail_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), thumbnail_url)
  WHERE id = p_episode_id AND user_id = auth.uid() AND status = 'completed'
  RETURNING * INTO v_episode;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERIFIED_EPISODE_NOT_FOUND'; END IF;
  RETURN v_episode;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_thirty_days_series_episode(uuid, jsonb, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.attach_thirty_days_series_episode_export(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_thirty_days_series_episode_export(uuid, text, text) TO authenticated;
