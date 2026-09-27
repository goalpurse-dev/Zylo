-- Price quotes: the UI shows exactly what the server will charge.
--
-- 1. quote_tool_prices(items) — batch quote for browser UIs. Each item is
--    { id, tool_key, input } with the same input shape a job row uses; the
--    price comes from compute_tool_price, the function the jobs pricing
--    trigger charges with.
-- 2. begin_two_am_generation reads its per-image price from tool_prices
--    (image:twoam1k/2k/4k) so the slideshow charge and the UI quote share one
--    source.
-- 3. cooking_matic_service_terms / quote_cooking_matic_service: one helper for
--    the Cooking Matic service fee, used by both the charge
--    (begin_cooking_matic_generation) and the UI quote.

BEGIN;
SET LOCAL lock_timeout = '10s';

/* ─── 1. Batch job-price quotes ───────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.quote_tool_prices(p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item    jsonb;
  v_credits integer;
  v_out     jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'QUOTE_ITEMS_MUST_BE_ARRAY' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'QUOTE_TOO_MANY_ITEMS' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_credits := public.compute_tool_price(v_item->>'tool_key', COALESCE(v_item->'input', '{}'::jsonb));
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_item->'id',
        'credits', v_credits,
        'error', CASE WHEN v_credits IS NULL THEN 'NO_SERVER_PRICE' END
      ));
    EXCEPTION WHEN others THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_item->'id', 'credits', NULL, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.quote_tool_prices(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_tool_prices(jsonb) TO anon, authenticated, service_role;

/* ─── 2. 2AM reads tool_prices ────────────────────────────────────────── */

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

/* ─── 3. Cooking Matic service fee: one formula for charge + quote ───── */

CREATE OR REPLACE FUNCTION public.cooking_matic_service_terms(p_plan text)
 RETURNS TABLE (voice_limit integer, service_credits integer)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- Ten bundled credits cover scene-aware script analysis, cached voice
  -- previews and imported-audio transcription. Each generated Flash/Turbo
  -- voice allowance adds three credits.
  SELECT l, 10 + l * 3
  FROM (SELECT CASE lower(COALESCE(p_plan, 'free'))
                 WHEN 'generative' THEN 5
                 WHEN 'pro' THEN 3
                 ELSE 2
               END AS l) s;
$function$;

-- Caller's own plan → { plan, voice_limit, service_credits, allowed }.
CREATE OR REPLACE FUNCTION public.quote_cooking_matic_service()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  t      record;
BEGIN
  SELECT lower(COALESCE(plan_code, 'free')) INTO v_plan FROM public.profiles WHERE id = auth.uid();
  v_plan := COALESCE(v_plan, 'free');
  SELECT * INTO t FROM public.cooking_matic_service_terms(v_plan);
  RETURN jsonb_build_object(
    'plan', v_plan,
    'voice_limit', t.voice_limit,
    'service_credits', t.service_credits,
    'allowed', v_plan IN ('starter', 'pro', 'generative', 'affiliate')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.quote_cooking_matic_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_cooking_matic_service() TO authenticated, service_role;

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

  SELECT t.voice_limit, t.service_credits INTO v_voice_limit, v_service_credits
  FROM public.cooking_matic_service_terms(v_plan) AS t;
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

NOTIFY pgrst, 'reload schema';

COMMIT;
