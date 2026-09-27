-- A provider completion can be recovered into generation.scenes after an
-- earlier QA job row was marked failed. The scene projection is the durable
-- current truth used by the renderer/UI, so episode commit must verify that
-- projection rather than permanently strand a completed episode on stale
-- asset-attempt history.
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

  IF jsonb_array_length(COALESCE(v_generation.scenes, '[]'::jsonb)) <> 7
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_generation.scenes) scene
       WHERE COALESCE(scene->>'imageStatus', '') <> 'succeeded'
          OR NULLIF(trim(COALESCE(scene->>'imageUrl', '')), '') IS NULL
          OR COALESCE(scene->>'qaStatus', '') NOT IN ('passed', 'unavailable')
          OR COALESCE(scene->>'videoStatus', '') <> 'succeeded'
          OR NULLIF(trim(COALESCE(scene->>'videoUrl', '')), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'EPISODE_MEDIA_NOT_VERIFIED';
  END IF;

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
