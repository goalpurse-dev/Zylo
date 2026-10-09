-- Rollback for 20261006190000_story_niches.sql.
-- Only safe while no Blocky row exists and the functions deployed are the
-- ones from before the niche work (they never name these columns).
-- It refuses to run if any row is not 'fruit'.

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.fruit_characters WHERE niche <> 'fruit')
     OR EXISTS (SELECT 1 FROM public.fruit_ideas WHERE niche <> 'fruit')
     OR EXISTS (SELECT 1 FROM public.fruit_stories WHERE niche <> 'fruit')
     OR EXISTS (SELECT 1 FROM public.fruit_series WHERE niche <> 'fruit') THEN
    RAISE EXCEPTION 'rows of another niche exist: remove them first';
  END IF;
END $$;

DELETE FROM public.global_feature_flags WHERE key = 'blocky_v1';
DELETE FROM public.tool_prices WHERE tool_key IN ('image:blocky-story', 'video:blocky-story-v2', 'video:blocky-story-v3', 'video:blocky-story-v4');
ALTER TABLE public.fruit_story_scenes DROP COLUMN IF EXISTS overlay;

-- fruit_create_story: back to the body of 20260930151906 (no niche).
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
    INSERT INTO public.fruit_story_scenes (story_id, user_id, idx, title, speaker_id, line, present_ids, location_id, action, emotion, shot, placement, duration_sec)
    VALUES (
      v_id, p_user_id, v_idx, COALESCE(v_scene->>'title', ''), v_scene->>'speaker_id', v_scene->>'line',
      ARRAY(SELECT jsonb_array_elements_text(v_scene->'present_ids')), v_scene->>'location_id',
      COALESCE(v_scene->>'action', ''), COALESCE(v_scene->>'emotion', ''), COALESCE(v_scene->>'shot', ''),
      COALESCE(v_scene->>'placement', ''), (v_scene->>'duration_sec')::smallint
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

-- fruit_pick_ideas: back to two arguments.
DROP FUNCTION IF EXISTS public.fruit_pick_ideas(text, integer, text);
CREATE OR REPLACE FUNCTION public.fruit_pick_ideas(p_seed text, p_count integer DEFAULT 5)
 RETURNS SETOF public.fruit_ideas
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.fruit_ideas WHERE active
  ORDER BY md5(id || ':' || coalesce(p_seed, '')) LIMIT LEAST(GREATEST(p_count, 1), 20)
$function$;
REVOKE ALL ON FUNCTION public.fruit_pick_ideas(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_pick_ideas(text, integer) TO service_role;

ALTER TABLE public.fruit_characters DROP CONSTRAINT IF EXISTS fruit_characters_person_by_niche;
ALTER TABLE public.fruit_characters ALTER COLUMN age SET NOT NULL;
ALTER TABLE public.fruit_characters ALTER COLUMN gender SET NOT NULL;
DROP INDEX IF EXISTS public.fruit_characters_niche_first_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS fruit_characters_first_name_key ON public.fruit_characters (first_name);

DROP INDEX IF EXISTS public.fruit_characters_niche_list_idx;
DROP INDEX IF EXISTS public.fruit_series_user_niche_idx;
DROP INDEX IF EXISTS public.fruit_stories_user_niche_idx;
ALTER TABLE public.fruit_series     DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_stories    DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_ideas      DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_characters DROP COLUMN IF EXISTS niche;

NOTIFY pgrst, 'reload schema';
COMMIT;
