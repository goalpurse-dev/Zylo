-- Rollback of 20261001100000: V2 keys back to no plan gate; 2AM back to the
-- 20261010100000 definition (free users clamped to V2).
BEGIN;
UPDATE public.tool_prices SET min_plan = NULL, updated_at = now()
 WHERE tool_key IN ('image:fruit-v2', 'video:fruit-v2', 'video:seedance15pro', 'image:nano.2', 'image:bts2k', 'image:cartoondrive2k', 'image:thirtydays1k', 'image:twoam1k');

CREATE OR REPLACE FUNCTION public.begin_two_am_generation(p_prompt text, p_settings jsonb, p_random_seed text, p_cost integer DEFAULT 42)
 RETURNS two_am_generations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    uuid := auth.uid();
  v_generation public.two_am_generations;
  v_plan       text;
  v_user_tier  integer;
  v_quality    text;
  v_per_image  integer;
  v_cost       integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_prompt, ''))) < 2 THEN
    RAISE EXCEPTION 'PROMPT_REQUIRED';
  END IF;

  -- p_cost is ignored: the cost is derived here from the requested quality
  -- tier, clamped to the caller's real plan (mirrors resolveQualityTier in
  -- supabase/functions/two-am-planner/index.ts), priced from tool_prices,
  -- 6 images per slideshow.
  SELECT lower(trim(COALESCE(plan_code, 'free'))) INTO v_plan FROM public.profiles WHERE id = v_user_id;
  v_user_tier := COALESCE(array_position(ARRAY['free','starter','pro','generative'], v_plan) - 1, 0);

  v_quality := COALESCE(p_settings->>'quality', '');
  IF v_quality NOT IN ('twoam-v2', 'twoam-v3', 'twoam-v4') THEN
    v_quality := 'twoam-v2';
  END IF;
  IF (CASE v_quality WHEN 'twoam-v2' THEN 1 WHEN 'twoam-v3' THEN 2 ELSE 3 END) > v_user_tier THEN
    v_quality := CASE WHEN v_user_tier >= 3 THEN 'twoam-v4'
                      WHEN v_user_tier >= 2 THEN 'twoam-v3'
                      ELSE 'twoam-v2' END;
  END IF;

  SELECT flat_credits INTO v_per_image
  FROM public.tool_prices
  WHERE active AND tool_key = CASE v_quality
    WHEN 'twoam-v2' THEN 'image:twoam1k'
    WHEN 'twoam-v3' THEN 'image:twoam2k'
    ELSE 'image:twoam4k' END;
  IF v_per_image IS NULL THEN
    RAISE EXCEPTION 'NO_SERVER_PRICE: 2AM tier % has no tool_prices row', v_quality;
  END IF;
  v_cost := 6 * v_per_image;

  PERFORM public.deduct_credits(v_user_id, v_cost);

  INSERT INTO public.two_am_generations (
    user_id, user_prompt, settings, random_seed, reserved_credits
  ) VALUES (
    v_user_id, trim(p_prompt),
    jsonb_set(COALESCE(p_settings, '{}'::jsonb), '{quality}', to_jsonb(v_quality), true),
    p_random_seed, v_cost
  )
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$function$;

COMMIT;
