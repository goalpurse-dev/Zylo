-- Server-side pricing for EVERY browser-created job (all tools).
--
-- 1. tool_prices gains sound_credits_per_second + size_tiers so it can express
--    every price the app charges today (per-second with/without sound,
--    per-size tiers, flat per clip/image).
-- 2. Seeds a row for every tool_key the browser can create, at the price
--    users are charged TODAY (see docs in the approval thread for sources).
-- 3. jobs_enforce_tool_pricing is widened from 'video:fruit%' to every
--    browser insert, and FAILS CLOSED: a browser insert whose tool_key has no
--    active tool_prices row is rejected (and logged to the Postgres log).
--    Trusted writers (service_role edge functions, SECURITY DEFINER SQL such
--    as Long Form / 2AM / 30 Days) keep the price they set — those flows bill
--    through reservations, not per-job charges.
-- 4. begin_two_am_generation derives its cost server-side (p_cost ignored).
-- 5. service_finalize_thirty_days_series becomes service_role-only.
--
-- Keys deliberately WITHOUT a row (browser inserts rejected; server inserts
-- unaffected): image:kling.o3, image:qwen.image-edit-plus,
-- image:flux2.klein9bkv, image:seedream5pro, image:seedream5lite (Long Form,
-- server-created only) and image:fruit-v3 (retired, not in code).

BEGIN;
SET LOCAL lock_timeout = '10s';

/* ─── 1. Table shape ──────────────────────────────────────────────────── */

ALTER TABLE public.tool_prices
  ADD COLUMN IF NOT EXISTS sound_credits_per_second numeric(10,4)
    CHECK (sound_credits_per_second IS NULL OR sound_credits_per_second > 0),
  -- [{ "max_pixels": 400000, "credits": 5 }, { "max_pixels": null, "credits_per_second": 6.8 }, ...]
  -- First tier whose max_pixels >= width*height wins (null = unbounded).
  -- Each tier sets either a flat "credits" or a "credits_per_second".
  ADD COLUMN IF NOT EXISTS size_tiers jsonb
    CHECK (size_tiers IS NULL OR jsonb_typeof(size_tiers) = 'array');

ALTER TABLE public.tool_prices DROP CONSTRAINT IF EXISTS tool_prices_check;
ALTER TABLE public.tool_prices DROP CONSTRAINT IF EXISTS tool_prices_has_price;
ALTER TABLE public.tool_prices ADD CONSTRAINT tool_prices_has_price
  CHECK (flat_credits IS NOT NULL OR credits_per_second IS NOT NULL
         OR sound_credits_per_second IS NOT NULL OR size_tiers IS NOT NULL);

/* ─── 2. Price computation ────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.compute_tool_price(p_tool_key text, p_input jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r          public.tool_prices%ROWTYPE;
  v_dur_raw  numeric;
  v_duration integer;
  v_width    numeric;
  v_height   numeric;
  v_pixels   numeric;
  v_size     text;
  v_sound    boolean;
  v_tier     jsonb;
  v_rate     numeric;
BEGIN
  SELECT * INTO r FROM public.tool_prices WHERE tool_key = p_tool_key AND active;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_dur_raw := NULLIF(p_input->>'durationSec', '')::numeric;
    v_sound   := COALESCE((p_input->>'withSound')::boolean, false);
    v_width   := NULLIF(p_input->>'width', '')::numeric;
    v_height  := NULLIF(p_input->>'height', '')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: malformed durationSec/withSound/width/height for %', p_tool_key USING ERRCODE = '22023';
  END;

  IF v_dur_raw IS NOT NULL THEN
    IF v_dur_raw <> trunc(v_dur_raw) OR v_dur_raw <= 0 THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: duration % not allowed for %', v_dur_raw, p_tool_key USING ERRCODE = '22023';
    END IF;
    v_duration := v_dur_raw::integer;
  END IF;

  IF r.allowed_durations IS NOT NULL AND (v_duration IS NULL OR NOT (v_duration = ANY (r.allowed_durations))) THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: duration % not allowed for %', COALESCE(v_duration::text, 'missing'), p_tool_key USING ERRCODE = '22023';
  END IF;

  IF r.allowed_sizes IS NOT NULL THEN
    v_size := COALESCE(p_input->>'width', '') || 'x' || COALESCE(p_input->>'height', '');
    IF NOT (v_size = ANY (r.allowed_sizes)) THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: size % not allowed for %', v_size, p_tool_key USING ERRCODE = '22023';
    END IF;
  END IF;

  IF r.requires_sound IS NOT NULL AND v_sound IS DISTINCT FROM r.requires_sound THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: withSound must be % for %', r.requires_sound, p_tool_key USING ERRCODE = '22023';
  END IF;

  -- Size tiers (e.g. Nano Banana 2 1k/2k/4k) take precedence.
  IF r.size_tiers IS NOT NULL THEN
    IF v_width IS NULL OR v_height IS NULL THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: width/height required for %', p_tool_key USING ERRCODE = '22023';
    END IF;
    v_pixels := v_width * v_height;
    SELECT t INTO v_tier
    FROM jsonb_array_elements(r.size_tiers) AS t
    WHERE t->>'max_pixels' IS NULL OR v_pixels <= (t->>'max_pixels')::numeric
    ORDER BY COALESCE((t->>'max_pixels')::numeric, 'Infinity'::numeric)
    LIMIT 1;
    IF v_tier IS NULL THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: size %x% has no price tier for %', v_width, v_height, p_tool_key USING ERRCODE = '22023';
    END IF;
    IF v_tier ? 'credits' THEN
      RETURN (v_tier->>'credits')::integer;
    END IF;
    v_rate := (v_tier->>'credits_per_second')::numeric;
  ELSIF r.flat_credits IS NOT NULL THEN
    RETURN r.flat_credits;
  ELSE
    v_rate := CASE
      WHEN v_sound AND r.sound_credits_per_second IS NOT NULL THEN r.sound_credits_per_second
      ELSE r.credits_per_second
    END;
  END IF;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: no rate for % (withSound=%)', p_tool_key, v_sound USING ERRCODE = '22023';
  END IF;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: durationSec required for per-second price of %', p_tool_key USING ERRCODE = '22023';
  END IF;
  RETURN CEIL(v_rate * v_duration)::integer;
END;
$function$;

/* ─── 3. Seed today's prices ──────────────────────────────────────────── */
-- (tool_key, per-second, sound-per-second, flat, durations, sizes, requires_sound, size_tiers, notes)
INSERT INTO public.tool_prices
  (tool_key, credits_per_second, sound_credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, size_tiers, notes)
VALUES
  -- Images: Image Generator + shared template images
  ('image:fruit-v2',         NULL, NULL, 2,    NULL, NULL, NULL, NULL, 'GPT Image 2 low — Fruit/Clay/Face/Micro/Footballer/Cooking images'),
  ('image:flux.base',        NULL, NULL, 1,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:flux.max',         NULL, NULL, 7,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:hidream',          NULL, NULL, 1,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:juggernaut',       NULL, NULL, 2,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:nano',             NULL, NULL, 4,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:nano-pro',         NULL, NULL, 25,   NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:openai',           NULL, NULL, 10,   NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:seedream4.0',      NULL, NULL, 3,    NULL, NULL, NULL, NULL, 'Image Generator'),
  ('image:nano.2',           NULL, NULL, NULL, NULL, NULL, NULL,
     '[{"max_pixels":400000,"credits":4},{"max_pixels":1500000,"credits":7},{"max_pixels":null,"credits":10}]',
     'Nano Banana 2 by size: 1k=4 (lower of Face/Footballer fallback 4 and Image Generator 5), 2k=7, 4k=10'),
  -- Template-dedicated images (fixed sizes)
  ('image:twoam1k',          NULL, NULL, 5,    NULL, ARRAY['384x688'],   NULL, NULL, '2AM V2 regeneration (initial images are prepaid, server-created)'),
  ('image:twoam2k',          NULL, NULL, 7,    NULL, ARRAY['768x1376'],  NULL, NULL, '2AM V3 regeneration'),
  ('image:twoam4k',          NULL, NULL, 10,   NULL, ARRAY['1536x2752'], NULL, NULL, '2AM V4 regeneration'),
  ('image:bts2k',            NULL, NULL, 7,    NULL, ARRAY['768x1376'],  NULL, NULL, 'Behind the Scenes V2'),
  ('image:bts4kpro',         NULL, NULL, 10,   NULL, ARRAY['1536x2752'], NULL, NULL, 'Behind the Scenes V3'),
  ('image:bts4kmax',         NULL, NULL, 10,   NULL, ARRAY['1536x2752'], NULL, NULL, 'Behind the Scenes V4'),
  ('image:cartoondrive2k',   NULL, NULL, 7,    NULL, ARRAY['768x1376'],  NULL, NULL, 'Cartoon Drive By V2'),
  ('image:cartoondrive4kpro',NULL, NULL, 10,   NULL, ARRAY['1536x2752'], NULL, NULL, 'Cartoon Drive By V3'),
  ('image:cartoondrive4kmax',NULL, NULL, 10,   NULL, ARRAY['1536x2752'], NULL, NULL, 'Cartoon Drive By V4'),
  ('image:thirtydays1k',     NULL, NULL, 5,    NULL, ARRAY['768x1376'],  NULL, NULL, '30 Days — 0 when a verified reservation applies (zz_ trigger)'),
  ('image:thirtydays2k',     NULL, NULL, 7,    NULL, ARRAY['1536x2752'], NULL, NULL, '30 Days — 0 when a verified reservation applies (zz_ trigger)'),
  -- Per-second video (Video Generator + templates on shared keys)
  ('video:seedance15pro',    2.5,  5.25, NULL, ARRAY[4,5,6,7,8,9,10,11,12], NULL, NULL, NULL,
     'Seedance 1.5 Pro — same formula as jobs_enforce_cooking_pricing (what users are charged today)'),
  ('video:veo31lite',        3,    5,    NULL, ARRAY[4,6,8], NULL, NULL, NULL, 'Veo 3.1 Lite — Video Generator, 30 Days V3'),
  ('video:klingaist',        9,    NULL, NULL, ARRAY[3,5],   NULL, NULL,  NULL, 'Kling 3.0 Standard — Video Generator'),
  ('video:miniMaxFast',      4,    NULL, NULL, ARRAY[6,10],  NULL, NULL,  NULL, 'MiniMax Hailuo Fast — Video Generator'),
  ('video:wan26flash',       8,    NULL, NULL, ARRAY[3,5],   NULL, NULL,  NULL, 'Wan 2.6 Flash — Video Generator'),
  ('video:seedance20fast',   7,    7,    NULL, NULL,         NULL, NULL,  NULL, 'Seedance 2.0 Fast — Video Generator'),
  ('video:viduq3turbo',      NULL, NULL, NULL, ARRAY[3,5,8], NULL, NULL,
     '[{"max_pixels":600000,"credits_per_second":3.4},{"max_pixels":1300000,"credits_per_second":5.1},{"max_pixels":null,"credits_per_second":6.8}]',
     'Vidu Q3 Turbo via Atlas Cloud — 540p/720p/1080p rates from providers.ts'),
  ('video:btsseedance720',   16,   16,   NULL, ARRAY[8],  ARRAY['720x1280'],  NULL, NULL, 'Behind the Scenes V3 (8s = 128)'),
  ('video:btsseedance1080',  40,   40,   NULL, ARRAY[8],  ARRAY['1080x1920'], NULL, NULL, 'Behind the Scenes V4 (8s = 320)'),
  ('video:cartoondriveseedance720',  16, NULL, NULL, ARRAY[5,10], ARRAY['720x1280'],  false, NULL, 'Cartoon Drive By V3 (10s = 160), 30 Days V4 (5s = 80)'),
  ('video:cartoondriveseedance1080', 40, NULL, NULL, ARRAY[10],   ARRAY['1080x1920'], false, NULL, 'Cartoon Drive By V4 (10s = 400)'),
  -- Flat per-clip template video (per-second from providers.ts does not reproduce these)
  ('video:viduq3turbo720',   NULL, NULL, 16,   ARRAY[5], ARRAY['720x1280'],  true,  NULL, 'Clay Rescue V3 (16) / Face ASMR V3 (shows 17) — lower price, never charge more than shown'),
  ('video:viduq3turbo1080',  NULL, NULL, 19,   ARRAY[5], ARRAY['1080x1920'], true,  NULL, 'Clay Rescue V4 (19) / Face ASMR V4 (shows 20) — lower price, never charge more than shown'),
  ('video:microcamminimax720',  NULL, NULL, 18, ARRAY[6], ARRAY['768x1366'],  false, NULL, 'Micro Camera V3'),
  ('video:microcamminimax1080', NULL, NULL, 32, ARRAY[6], ARRAY['1080x1920'], false, NULL, 'Micro Camera V4'),
  ('video:footballerviduq3turbo1080', NULL, NULL, 24, ARRAY[6], ARRAY['1080x1920'], true, NULL, 'Footballer V3'),
  ('video:footballerseedance720',     NULL, NULL, 31, ARRAY[6], ARRAY['720x1280'],  true, NULL, 'Footballer V4'),
  -- Client-rendered exports (saveFullVideo) — no provider cost
  ('full-video',             NULL, NULL, 0,    NULL, NULL, NULL, NULL, 'Client-rendered stitched export (saveFullVideo)')
ON CONFLICT (tool_key) DO NOTHING;

/* ─── 4. Widen + fail closed ──────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.enforce_tool_job_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits integer;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    -- Browser write: the server decides the price, or the insert is refused.
    IF NEW.tool_key IS NULL THEN
      RAISE LOG 'NO_SERVER_PRICE: browser job insert without tool_key (user %, type %)', NEW.user_id, NEW.type;
      RAISE EXCEPTION 'NO_SERVER_PRICE: tool_key is required' USING ERRCODE = '42501';
    END IF;
    v_credits := public.compute_tool_price(NEW.tool_key, NEW.input);
    IF v_credits IS NULL THEN
      RAISE LOG 'NO_SERVER_PRICE: browser job insert for unpriced tool_key % (user %)', NEW.tool_key, NEW.user_id;
      RAISE EXCEPTION 'NO_SERVER_PRICE: % has no server price', NEW.tool_key USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.tool_key LIKE 'video:fruit%' THEN
    -- Fruit keys are only ever browser-created; keep re-pricing them on
    -- trusted writes too (unchanged from 20261007120000).
    v_credits := public.compute_tool_price(NEW.tool_key, NEW.input);
    IF v_credits IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    -- Trusted writer (service_role / SECURITY DEFINER SQL): keep its price.
    RETURN NEW;
  END IF;

  NEW.charge_credits := v_credits;
  NEW.settings := COALESCE(NEW.settings, '{}'::jsonb)
    || jsonb_build_object('credits', v_credits, 'price_source', 'tool_prices');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS jobs_enforce_tool_pricing ON public.jobs;
CREATE TRIGGER jobs_enforce_tool_pricing
  BEFORE INSERT OR UPDATE OF charge_credits, input, tool_key ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tool_job_pricing();

/* ─── 5. 2AM: server-side cost ────────────────────────────────────────── */

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

  -- p_cost is ignored: the cost is derived here from the requested quality
  -- tier, clamped to the caller's real plan. Mirrors QUALITY_TIERS +
  -- resolveQualityTier in supabase/functions/two-am-planner/index.ts
  -- (v2 1K = 5/img, starter; v3 2K = 7/img, pro; v4 4K = 10/img, generative;
  -- 6 images per slideshow).
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

/* ─── 6. service_finalize_thirty_days_series → service_role only ──────── */

REVOKE EXECUTE ON FUNCTION public.service_finalize_thirty_days_series(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_finalize_thirty_days_series(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
