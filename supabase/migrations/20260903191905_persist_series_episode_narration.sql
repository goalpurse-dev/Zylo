-- Persist every Series narration draft against the exact episode that owns
-- it.  Episode rows remain read-only to browser clients; this narrowly scoped
-- RPC verifies auth.uid() and updates the paired generation atomically.

ALTER TABLE public.thirty_days_series_episodes
  ADD COLUMN IF NOT EXISTS cliffhanger_thread text,
  ADD COLUMN IF NOT EXISTS day_split_after_scene smallint;

ALTER TABLE public.thirty_days_series_episodes
  DROP CONSTRAINT IF EXISTS thirty_days_series_episodes_day_split_check;

ALTER TABLE public.thirty_days_series_episodes
  ADD CONSTRAINT thirty_days_series_episodes_day_split_check
  CHECK (day_split_after_scene IS NULL OR day_split_after_scene IN (3, 4));

CREATE OR REPLACE FUNCTION public.save_thirty_days_narration_draft(
  p_generation_id uuid,
  p_hook text,
  p_narration text,
  p_narration_take jsonb,
  p_episode_title text DEFAULT NULL,
  p_cliffhanger_thread text DEFAULT NULL,
  p_day_split_after_scene integer DEFAULT NULL
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.thirty_days_generations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_generation_id IS NULL OR NULLIF(trim(COALESCE(p_narration, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_NARRATION_DRAFT';
  END IF;
  IF jsonb_typeof(COALESCE(p_narration_take, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_NARRATION_TAKE';
  END IF;
  IF p_day_split_after_scene IS NOT NULL AND p_day_split_after_scene NOT IN (3, 4) THEN
    RAISE EXCEPTION 'INVALID_DAY_SPLIT';
  END IF;

  SELECT * INTO v_generation
  FROM public.thirty_days_generations
  WHERE id = p_generation_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  UPDATE public.thirty_days_generations
  SET hook = COALESCE(NULLIF(trim(COALESCE(p_hook, '')), ''), hook),
      title = CASE
        WHEN generation_mode = 'series_episode'
          THEN COALESCE(NULLIF(trim(COALESCE(p_episode_title, '')), ''), title)
        ELSE title
      END,
      narration_script = trim(p_narration),
      narration_take = p_narration_take,
      updated_at = now()
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  IF v_generation.generation_mode = 'series_episode' AND v_generation.series_episode_id IS NOT NULL THEN
    UPDATE public.thirty_days_series_episodes
    SET title = COALESCE(NULLIF(trim(COALESCE(p_episode_title, '')), ''), title),
        hook = COALESCE(NULLIF(trim(COALESCE(p_hook, '')), ''), hook),
        narration = trim(p_narration),
        narration_take = p_narration_take,
        cliffhanger_thread = COALESCE(NULLIF(trim(COALESCE(p_cliffhanger_thread, '')), ''), cliffhanger_thread),
        cliffhanger = COALESCE(NULLIF(trim(COALESCE(p_cliffhanger_thread, '')), ''), cliffhanger),
        day_split_after_scene = COALESCE(p_day_split_after_scene, day_split_after_scene),
        updated_at = now()
    WHERE id = v_generation.series_episode_id
      AND series_id = v_generation.series_id
      AND user_id = v_user_id;
  END IF;

  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.save_thirty_days_narration_draft(uuid, text, text, jsonb, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_thirty_days_narration_draft(uuid, text, text, jsonb, text, text, integer) TO authenticated;
