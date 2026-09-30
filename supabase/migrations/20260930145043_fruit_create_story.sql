-- AI Fruit Story v2 (Phase 3c): save a planned story and its scenes atomically.
-- Called only by fruit-story-api (service role) after the planner succeeds.
-- Nothing is charged here; writing a story is free.

BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.fruit_stories ADD COLUMN IF NOT EXISTS planner jsonb NOT NULL DEFAULT '{}'::jsonb;  -- model, attempts, call ids, cost
COMMENT ON COLUMN public.fruit_stories.planner IS 'Planner metadata: provider, model, attempts, fruit_ai_calls ids, cost_usd.';

-- p_story:  {source, input, title, cast_ids, quality, length_sec, aspect, locations, planner, series_id?, episode_number?}
-- p_scenes: [{title, speaker_id, line, present_ids, location_id, action, emotion, shot, duration_sec}]
-- p_call_ids: fruit_ai_calls rows made while planning (linked to the new story)
CREATE OR REPLACE FUNCTION public.fruit_create_story(p_user_id uuid, p_story jsonb, p_scenes jsonb, p_call_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id    uuid := gen_random_uuid();
  v_scene jsonb;
  v_idx   integer := 0;
BEGIN
  IF p_scenes IS NULL OR jsonb_typeof(p_scenes) <> 'array' OR jsonb_array_length(p_scenes) < 1 OR jsonb_array_length(p_scenes) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: 1 to 40 scenes' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.fruit_stories (id, user_id, source, input, title, cast_ids, quality, length_sec, aspect, locations, planner, series_id, episode_number)
  VALUES (
    v_id, p_user_id, p_story->>'source', COALESCE(p_story->'input', '{}'::jsonb), COALESCE(p_story->>'title', ''),
    ARRAY(SELECT jsonb_array_elements_text(p_story->'cast_ids')), p_story->>'quality', (p_story->>'length_sec')::smallint,
    p_story->>'aspect', COALESCE(p_story->'locations', '[]'::jsonb), COALESCE(p_story->'planner', '{}'::jsonb),
    NULLIF(p_story->>'series_id', '')::uuid, NULLIF(p_story->>'episode_number', '')::smallint
  );

  FOR v_scene IN SELECT value FROM jsonb_array_elements(p_scenes) LOOP
    INSERT INTO public.fruit_story_scenes (story_id, user_id, idx, title, speaker_id, line, present_ids, location_id, action, emotion, shot, duration_sec)
    VALUES (
      v_id, p_user_id, v_idx, COALESCE(v_scene->>'title', ''), v_scene->>'speaker_id', v_scene->>'line',
      ARRAY(SELECT jsonb_array_elements_text(v_scene->'present_ids')), v_scene->>'location_id',
      COALESCE(v_scene->>'action', ''), COALESCE(v_scene->>'emotion', ''), COALESCE(v_scene->>'shot', ''),
      (v_scene->>'duration_sec')::smallint
    );
    v_idx := v_idx + 1;
  END LOOP;

  IF p_story->>'series_id' IS NOT NULL THEN
    UPDATE public.fruit_series_episodes SET story_id = v_id
    WHERE series_id = (p_story->>'series_id')::uuid AND number = (p_story->>'episode_number')::smallint AND user_id = p_user_id;
  END IF;

  IF cardinality(p_call_ids) > 0 THEN
    UPDATE public.fruit_ai_calls SET story_id = v_id WHERE id = ANY (p_call_ids) AND user_id = p_user_id;
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fruit_create_story(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_create_story(uuid, jsonb, jsonb, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
