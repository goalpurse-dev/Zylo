-- Adds V2/V3/V4 quality tiers (1K/2K/4K) to 2AM Worlds. Each tier reserves a
-- different total credit amount (30/42/60 for 6 images), resolved and
-- clamped to the caller's plan server-side inside the two-am-planner edge
-- function — this migration just lets begin_two_am_generation accept that
-- resolved cost instead of always reserving a hardcoded 42.

DROP FUNCTION IF EXISTS public.begin_two_am_generation(text, jsonb, text);

CREATE OR REPLACE FUNCTION public.begin_two_am_generation(
  p_prompt text,
  p_settings jsonb,
  p_random_seed text,
  p_cost integer DEFAULT 42
)
RETURNS public.two_am_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.two_am_generations;
  -- Clamped to the valid tier range (30=1K, 42=2K, 60=4K, all x6 images) as
  -- basic sanity — the real tier/plan enforcement happens in the calling
  -- edge function, which resolves plan_code from the DB itself.
  v_cost integer := GREATEST(30, LEAST(60, COALESCE(p_cost, 42)));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_prompt, ''))) < 2 THEN
    RAISE EXCEPTION 'PROMPT_REQUIRED';
  END IF;

  PERFORM public.deduct_credits(v_user_id, v_cost);

  INSERT INTO public.two_am_generations (
    user_id, user_prompt, settings, random_seed, reserved_credits
  ) VALUES (
    v_user_id, trim(p_prompt), COALESCE(p_settings, '{}'::jsonb), p_random_seed, v_cost
  )
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_two_am_generation(text, jsonb, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_two_am_generation(text, jsonb, text, integer) TO authenticated;

-- settle_two_am_generation and finalize_two_am_generation_from_jobs already
-- derive v_per_image from reserved_credits / 6, so they adapt to whatever
-- tier was actually reserved without needing any changes here.
