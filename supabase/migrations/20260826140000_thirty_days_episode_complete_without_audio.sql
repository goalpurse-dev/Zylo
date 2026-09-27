-- Narration was a hard gate on an episode ever being "completed": the client
-- only called complete_thirty_days_series_episode after the full voice +
-- ffmpeg-stitch export produced a final_video_url, so an episode whose 7
-- scene videos all succeeded stayed stuck at status 'generating' forever if
-- the user never added narration (story progress never advanced, thumbnail
-- never appeared, reopening showed nothing). Video readiness alone is now
-- sufficient to complete an episode; final_video_url becomes optional, and a
-- narrated export can still be attached afterward without re-running
-- progression logic a second time.
CREATE OR REPLACE FUNCTION public.complete_thirty_days_series_episode(
  p_episode_id uuid,
  p_episode_summary jsonb,
  p_final_video_url text,
  p_thumbnail_url text
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
BEGIN
  SELECT * INTO v_episode FROM public.thirty_days_series_episodes
  WHERE id = p_episode_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EPISODE_NOT_FOUND'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series WHERE id = v_episode.series_id FOR UPDATE;
  SELECT * INTO v_generation FROM public.thirty_days_generations WHERE id = v_episode.generation_id FOR UPDATE;
  IF v_generation.reservation_status = 'reserved' THEN RAISE EXCEPTION 'EPISODE_ASSETS_NOT_SETTLED'; END IF;

  -- Already completed: this is a narrated export attaching itself after the
  -- fact, not a fresh completion. Only ever move final_video_url/thumbnail
  -- forward here — never re-run day/progress advancement a second time.
  IF v_episode.status = 'completed' THEN
    IF length(trim(COALESCE(p_final_video_url, ''))) > 0 THEN
      UPDATE public.thirty_days_series_episodes
      SET final_video_url = trim(p_final_video_url),
          thumbnail_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), thumbnail_url),
          narration = COALESCE(v_generation.narration_script, narration),
          narration_take = COALESCE(v_generation.narration_take, narration_take)
      WHERE id = p_episode_id RETURNING * INTO v_episode;
      UPDATE public.thirty_days_series
      SET cover_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), cover_url), last_active_at = now()
      WHERE id = v_series.id;
    END IF;
    RETURN v_episode;
  END IF;

  IF v_episode.start_day <> v_series.current_day + 1 THEN RAISE EXCEPTION 'EPISODE_OUT_OF_ORDER'; END IF;
  IF jsonb_typeof(COALESCE(p_episode_summary, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'INVALID_EPISODE_SUMMARY'; END IF;

  UPDATE public.thirty_days_series_episodes
  SET episode_summary = p_episode_summary,
      final_video_url = NULLIF(trim(COALESCE(p_final_video_url, '')), ''),
      thumbnail_url = NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), status = 'completed', completed_at = now(),
      narration = v_generation.narration_script, narration_take = v_generation.narration_take
  WHERE id = p_episode_id RETURNING * INTO v_episode;

  UPDATE public.thirty_days_series
  SET current_day = v_episode.end_day, current_episode = v_episode.episode_number,
      status = CASE WHEN v_episode.end_day >= total_days THEN 'completed' ELSE 'ready' END,
      current_story_state = p_episode_summary,
      next_episode_tease = COALESCE(NULLIF(v_episode.next_episode_tease, ''), p_episode_summary->>'cliffhanger'),
      reference_library = v_generation.visual_references,
      cover_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), cover_url),
      last_active_at = now()
  WHERE id = v_series.id;
  RETURN v_episode;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_thirty_days_series_episode(uuid, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_thirty_days_series_episode(uuid, jsonb, text, text) TO authenticated;
