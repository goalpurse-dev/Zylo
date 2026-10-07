-- Rollback for 20261026090000_story_niches_undo.sql: puts the template columns back.
-- This is 20261006190000_story_niches.sql again (every statement in it is IF NOT EXISTS / OR REPLACE / ON CONFLICT,
-- so it is safe to run on a database that already has the Blocky price rows and the blocky_v1 switch).

-- One engine, more than one template: a `niche` on the rows a viewer would
-- tell apart. Everything that exists today is AI Fruit Story and becomes
-- 'fruit' by default; 'blocky' is Blocky Stories (docs/roblox-scope.md).
--
-- Additive, and safe to apply while today's functions are live: they never
-- name the new columns, every default is 'fruit', and the two functions
-- replaced here answer today's calls exactly as before.
--
-- ORDER: apply this BEFORE deploying fruit-story-api / fruit-worker from the
-- Blocky branch. The new API filters every list by niche, so it needs the columns.
--
-- Nothing here charges, refunds or prices differently for Fruit. The charge
-- function (fruit_charge_step) is not touched: it prices any tool_key from
-- tool_prices, and Blocky gets its own four rows below with Fruit's values.
--
-- Rollback: supabase/rollbacks/20261006190000_story_niches_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

/* ─── 1. The niche column ─────────────────────────────────────────────── */

ALTER TABLE public.fruit_characters ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'fruit' CHECK (niche IN ('fruit', 'blocky'));
ALTER TABLE public.fruit_ideas      ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'fruit' CHECK (niche IN ('fruit', 'blocky'));
ALTER TABLE public.fruit_stories    ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'fruit' CHECK (niche IN ('fruit', 'blocky'));
ALTER TABLE public.fruit_series     ADD COLUMN IF NOT EXISTS niche text NOT NULL DEFAULT 'fruit' CHECK (niche IN ('fruit', 'blocky'));

COMMENT ON COLUMN public.fruit_stories.niche IS 'The template this story belongs to (supabase/functions/_shared/fruit/niches/). Set once, when the story is created.';
COMMENT ON COLUMN public.fruit_series.niche IS 'The template this series belongs to; every episode is a story of the same niche.';
COMMENT ON COLUMN public.fruit_characters.niche IS 'The template whose library this character is in. A story only ever uses characters of its own niche.';

-- Lists are always one niche's: recent stories, series, the library.
CREATE INDEX IF NOT EXISTS fruit_stories_user_niche_idx ON public.fruit_stories (user_id, niche, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fruit_series_user_niche_idx  ON public.fruit_series  (user_id, niche, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fruit_characters_niche_list_idx ON public.fruit_characters (niche, sort_order) WHERE active;

/* ─── 2. The character library, per niche ─────────────────────────────── */

-- Script-name matching uses the first word of the name, so it must be unique
-- within the library the user sees: per niche now (it was table-wide).
DROP INDEX IF EXISTS public.fruit_characters_first_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS fruit_characters_niche_first_name_key ON public.fruit_characters (niche, first_name);

-- A Blocky avatar is always "a blocky toy avatar": it has no age and is never a
-- man or a woman, so those two columns are for Fruit only. Fruit rows still
-- need both; a Blocky row must leave both empty, so neither can ever reach a prompt.
ALTER TABLE public.fruit_characters ALTER COLUMN age DROP NOT NULL;
ALTER TABLE public.fruit_characters ALTER COLUMN gender DROP NOT NULL;
ALTER TABLE public.fruit_characters DROP CONSTRAINT IF EXISTS fruit_characters_person_by_niche;
ALTER TABLE public.fruit_characters ADD CONSTRAINT fruit_characters_person_by_niche CHECK (
  (niche = 'fruit'  AND age IS NOT NULL AND gender IS NOT NULL) OR
  (niche = 'blocky' AND age IS NULL     AND gender IS NULL)
);

/* ─── 3. Ideas: picked from one niche's library ───────────────────────── */

-- Same pick as before, now from one niche. The old two-argument form is
-- dropped in the same transaction so there is exactly one function: today's
-- API call (p_seed, p_count) lands on it with p_niche = 'fruit'.
DROP FUNCTION IF EXISTS public.fruit_pick_ideas(text, integer);
CREATE OR REPLACE FUNCTION public.fruit_pick_ideas(p_seed text, p_count integer DEFAULT 5, p_niche text DEFAULT 'fruit')
 RETURNS SETOF public.fruit_ideas
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.fruit_ideas WHERE active AND niche = COALESCE(p_niche, 'fruit')
  ORDER BY md5(id || ':' || coalesce(p_seed, '')) LIMIT LEAST(GREATEST(p_count, 1), 20)
$function$;

REVOKE ALL ON FUNCTION public.fruit_pick_ideas(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_pick_ideas(text, integer, text) TO service_role;

/* ─── 4. A story is created with its niche ────────────────────────────── */

-- The body of 20260930151906 with ONE change: the story row also gets
-- p_story->>'niche' ('fruit' when the caller sends none, as today's API does).
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

  INSERT INTO public.fruit_stories (id, user_id, source, input, title, cast_ids, quality, length_sec, aspect, locations, planner, series_id, episode_number, niche)
  VALUES (
    v_id, p_user_id, p_story->>'source', COALESCE(p_story->'input', '{}'::jsonb), COALESCE(p_story->>'title', ''),
    ARRAY(SELECT jsonb_array_elements_text(p_story->'cast_ids')), p_story->>'quality', (p_story->>'length_sec')::smallint,
    p_story->>'aspect', COALESCE(p_story->'locations', '[]'::jsonb), COALESCE(p_story->'planner', '{}'::jsonb),
    NULLIF(p_story->>'series_id', '')::uuid, NULLIF(p_story->>'episode_number', '')::smallint,
    COALESCE(NULLIF(p_story->>'niche', ''), 'fruit')
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

/* ─── 5. On-screen text for a scene ───────────────────────────────────── */

-- Pictures and clips never show readable text. When a scene needs words (a
-- name tag, a chat line, a countdown) they are kept here and drawn by the
-- final video at a fixed spot: {"kind": "tag" | "chat" | "countdown", "text": "..."}.
-- Empty for every scene today; nothing reads it yet.
ALTER TABLE public.fruit_story_scenes ADD COLUMN IF NOT EXISTS overlay jsonb CHECK (overlay IS NULL OR jsonb_typeof(overlay) = 'object');

/* ─── 6. Blocky's own price rows, with Fruit's values ─────────────────── */

-- Picture / edit 4 credits; clips 5 / 9 / 16 credits per second for V2 / V3 /
-- V4; the same durations, sizes, sound rule and plans as the Fruit rows they
-- are copied from. Separate rows so either template's price can change alone.
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes)
SELECT replace(tool_key, 'fruit-story', 'blocky-story'), credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active,
       replace(notes, 'AI Fruit Story v2', 'Blocky Stories')
FROM public.tool_prices
WHERE tool_key IN ('image:fruit-story', 'video:fruit-story-v2', 'video:fruit-story-v3', 'video:fruit-story-v4')
ON CONFLICT (tool_key) DO NOTHING;

/* ─── 7. Blocky Stories is hidden until launch ────────────────────────── */

INSERT INTO public.global_feature_flags (key, enabled, note)
VALUES ('blocky_v1', false, 'Blocky Stories for everyone. false = hidden (accounts with a per-user blocky_v1 flag still get it).')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
