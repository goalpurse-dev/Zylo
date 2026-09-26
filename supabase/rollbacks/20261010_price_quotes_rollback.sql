-- Rollback for 20261010100000_price_quotes.sql
--
-- Revert the frontend FIRST: the UI reads every price from quote_tool_prices
-- (and Cooking Matic from quote_cooking_matic_service / cooking_matic_service_terms);
-- dropping them under a live new frontend turns every Generate button into
-- "Couldn't load price — Retry".
--
-- Charges are unchanged by the rollback: 2AM goes back to its inline 5/7/10
-- per image (same numbers as tool_prices image:twoam1k/2k/4k) and Cooking
-- Matic to its inline 10 + voice_limit × 3 (same formula as the helper).

BEGIN;
SET LOCAL lock_timeout = '10s';

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
  v_cost       integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_prompt, ''))) < 2 THEN
    RAISE EXCEPTION 'PROMPT_REQUIRED';
  END IF;

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
  v_cost := 6 * CASE v_quality WHEN 'twoam-v2' THEN 5 WHEN 'twoam-v3' THEN 7 ELSE 10 END;

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

CREATE OR REPLACE FUNCTION public.begin_cooking_matic_generation(p_dish_name text, p_vibe_id text)
 RETURNS cooking_matic_generations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan text;
  v_voice_limit integer;
  v_service_credits integer;
  v_generation public.cooking_matic_generations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT lower(COALESCE(plan_code, 'free'))
  INTO v_plan
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_plan NOT IN ('starter', 'pro', 'generative', 'affiliate') THEN
    RAISE EXCEPTION 'PAID_PLAN_REQUIRED';
  END IF;

  v_voice_limit := CASE v_plan
    WHEN 'generative' THEN 5
    WHEN 'pro' THEN 3
    ELSE 2
  END;
  v_service_credits := 10 + (v_voice_limit * 3);
  PERFORM public.deduct_credits(v_user_id, v_service_credits);

  INSERT INTO public.cooking_matic_generations (
    user_id,
    dish_name,
    vibe_id,
    status,
    scenes,
    clips,
    voice_generation_limit,
    voice_generations_used,
    service_credits_charged
  ) VALUES (
    v_user_id,
    left(COALESCE(NULLIF(trim(p_dish_name), ''), 'dish'), 100),
    left(COALESCE(NULLIF(trim(p_vibe_id), ''), 'dark-moody'), 60),
    'generating',
    '[]'::jsonb,
    '[]'::jsonb,
    v_voice_limit,
    0,
    v_service_credits
  )
  RETURNING * INTO v_generation;

  INSERT INTO public.cooking_matic_service_entitlements (
    generation_id,
    user_id,
    service_credits,
    voice_limit
  ) VALUES (
    v_generation.id,
    v_user_id,
    v_service_credits,
    v_voice_limit
  );

  RETURN v_generation;
END;
$function$;

DROP FUNCTION IF EXISTS public.quote_cooking_matic_service();
DROP FUNCTION IF EXISTS public.cooking_matic_service_terms(text);
DROP FUNCTION IF EXISTS public.quote_tool_prices(jsonb);

NOTIFY pgrst, 'reload schema';

COMMIT;
