-- V2 of paid tools needs a paid plan on the server, like V3 (Pro) and V4
-- (Generative). job-worker gates every job by tool_prices.min_plan (affiliates
-- count as Starter there, see job-worker planTierIndex), so the template V2
-- keys get min_plan = starter. The Image Generator free allowance (5 Flux Base
-- images per 30 days, image:flux.base) is untouched. 2AM starts in an RPC,
-- which now refuses free users instead of clamping them to V2.
-- Rollback: supabase/rollbacks/20261001100000_paid_plan_for_v2_templates.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

UPDATE public.tool_prices
   SET min_plan = 'starter', updated_at = now()
 WHERE min_plan IS NULL
   AND tool_key IN (
     'image:fruit-v2',  -- Clay / Face / Micro / Kit Swap / Cooking / original Fruit pictures
     'video:fruit-v2',  -- AI Fruit Story (original) V2 clips
     'video:seedance15pro',  -- Clay / Face / Micro / Kit Swap / CDB / BTS V2 clips (and Video Generator V2)
     'image:nano.2',  -- Face ASMR / Kit Swap pictures (and Image Generator Nano Banana 2)
     'image:bts2k',  -- Behind the Scenes V2
     'image:cartoondrive2k',  -- Cartoon Drive By V2
     'image:thirtydays1k',  -- 30 Days V2
     'image:twoam1k'   -- 2AM V2 regeneration
   );

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
  -- 2026-10-01: V2 of paid tools needs a paid plan. Affiliates keep the entry
  -- tier (as in job-worker / planGating); free users are refused, not clamped.
  IF v_plan = 'affiliate' THEN
    v_user_tier := 1;
  END IF;
  IF v_user_tier < 1 THEN
    RAISE EXCEPTION 'PAID_PLAN_REQUIRED';
  END IF;

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
