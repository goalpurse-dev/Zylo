-- Undo of 20261006190000_story_niches.sql: AI Fruit Story's tables go back to
-- what they were before Blocky Stories was built inside them. Blocky Stories is
-- its own product now, with its own tables (blocky_*), so Fruit's tables no
-- longer carry a template column.
--
-- What this does, in ONE transaction (all of it or none of it):
--   1. fruit_create_story  → the body of 20260930151906 (no template).
--   2. fruit_pick_ideas    → two arguments again (p_seed, p_count), as in 20260927123135.
--   3. fruit_characters    → age and gender are required again; first names unique table-wide again.
--   4. The template column is dropped from fruit_characters, fruit_ideas,
--      fruit_stories and fruit_series (with its three indexes and checks), and
--      fruit_story_scenes.overlay is dropped.
-- What it keeps: the four Blocky price rows (image:blocky-story,
-- video:blocky-story-v2/v3/v4) and the blocky_v1 switch. Blocky uses both.
--
-- Safe with the functions that are live (fruit-story-api v56, fruit-worker
-- v55, which are main's code): they never read or write a template column or
-- an overlay, they call fruit_pick_ideas by name with {p_seed, p_count} (works
-- with the three-argument form before this and the two-argument form after),
-- and fruit_create_story keeps its four arguments.
--
-- It refuses to run if any row is not a Fruit row, if any scene has an
-- overlay, if a character has no age or gender, or if two first names clash.
-- It gives up (and changes nothing) rather than wait more than 5 seconds for a
-- lock, so it can never hold Fruit up.
--
-- Applied to the real database on 2026-10-07 19:49 UTC (0 jobs in flight; smoke check and rolled-back
-- story creation before and after).
-- Rollback: supabase/rollbacks/20261026090000_story_niches_undo_rollback.sql
-- (which is 20261006190000_story_niches.sql again).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  n bigint;
  t text;
BEGIN
  -- Each check only where the column is still there, so running this file a second time changes nothing and fails nothing.
  FOREACH t IN ARRAY ARRAY['fruit_characters', 'fruit_ideas', 'fruit_stories', 'fruit_series'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'niche') THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE niche <> %L', t, 'fruit') INTO n;
      IF n > 0 THEN RAISE EXCEPTION 'undo refused: % rows of % belong to another template', n, t; END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fruit_story_scenes' AND column_name = 'overlay') THEN
    EXECUTE 'SELECT count(*) FROM public.fruit_story_scenes WHERE overlay IS NOT NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'undo refused: % scenes have an overlay', n; END IF;
  END IF;
  SELECT count(*) INTO n FROM public.fruit_characters WHERE age IS NULL OR gender IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'undo refused: % characters have no age or gender', n; END IF;
  SELECT count(*) INTO n FROM (SELECT first_name FROM public.fruit_characters GROUP BY first_name HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'undo refused: % first names are used twice', n; END IF;
END $$;

/* ─── 1. fruit_create_story: the body of 20260930151906, word for word ─── */

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
REVOKE ALL ON FUNCTION public.fruit_create_story(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_create_story(uuid, jsonb, jsonb, uuid[]) TO service_role;

/* ─── 2. fruit_pick_ideas: two arguments again (20260927123135) ───────── */

-- Dropped and created in this one transaction: there is no moment without it.
-- The live API calls it by name with p_seed and p_count, which both forms accept.
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

/* ─── 3. The character library: as it was ─────────────────────────────── */

ALTER TABLE public.fruit_characters DROP CONSTRAINT IF EXISTS fruit_characters_person_by_niche;
ALTER TABLE public.fruit_characters ALTER COLUMN age SET NOT NULL;
ALTER TABLE public.fruit_characters ALTER COLUMN gender SET NOT NULL;
DROP INDEX IF EXISTS public.fruit_characters_niche_first_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS fruit_characters_first_name_key ON public.fruit_characters (first_name);

/* ─── 4. The template column and the overlay column go ────────────────── */

DROP INDEX IF EXISTS public.fruit_characters_niche_list_idx;
DROP INDEX IF EXISTS public.fruit_series_user_niche_idx;
DROP INDEX IF EXISTS public.fruit_stories_user_niche_idx;
-- Dropping the column drops its check (fruit_*_niche_check) with it.
ALTER TABLE public.fruit_series       DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_stories      DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_ideas        DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_characters   DROP COLUMN IF EXISTS niche;
ALTER TABLE public.fruit_story_scenes DROP COLUMN IF EXISTS overlay;

NOTIFY pgrst, 'reload schema';
COMMIT;
