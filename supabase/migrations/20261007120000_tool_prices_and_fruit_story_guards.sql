-- Server-side pricing table + Fruit Story enforcement + edge-function rate
-- limiting.
--
-- tool_prices is the single source of truth for server prices. Both the
-- jobs_enforce_tool_pricing trigger and job-worker (via compute_tool_price)
-- read it. Only Fruit Story keys are seeded and the trigger is scoped to
-- 'video:fruit%' for now. The Fruit rebuild repoints video:fruit-v2/v3/v4 to
-- new models by changing providers.ts and these rows only.

BEGIN;
SET LOCAL lock_timeout = '10s';

/* ─── Price table ─────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.tool_prices (
  tool_key           text PRIMARY KEY,
  credits_per_second numeric(10,4) CHECK (credits_per_second IS NULL OR credits_per_second > 0),
  flat_credits       integer CHECK (flat_credits IS NULL OR flat_credits >= 0),
  allowed_durations  integer[],            -- seconds; NULL = any
  allowed_sizes      text[],               -- 'WIDTHxHEIGHT'; NULL = any
  requires_sound     boolean,              -- true = must be on, false = must be off, NULL = either
  min_plan           text CHECK (min_plan IS NULL OR min_plan IN ('free','starter','pro','generative')),
  active             boolean NOT NULL DEFAULT true,
  notes              text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (flat_credits IS NOT NULL OR credits_per_second IS NOT NULL)
);

ALTER TABLE public.tool_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tool_prices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tool_prices TO anon, authenticated;   -- public price list
GRANT ALL ON TABLE public.tool_prices TO service_role;
DROP POLICY IF EXISTS tool_prices_public_read ON public.tool_prices;
CREATE POLICY tool_prices_public_read ON public.tool_prices FOR SELECT USING (true);

-- V2 = 12 cr / 5s  -> 2.4 cr/s (exact)
-- V3 = 17 cr / 5s  -> 3.4 cr/s (exact)
-- V4 = 29 cr / 6s  -> not a clean per-second rate, so flat for now
INSERT INTO public.tool_prices
  (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, notes)
VALUES
  ('video:fruit-v2', 2.4, NULL, ARRAY[5], ARRAY['496x864','864x496','680x680'],       true, NULL,
   'AI Fruit Story V2 — Seedance 1.5 Pro 480p with audio'),
  ('video:fruit-v3', 3.4, NULL, ARRAY[5], ARRAY['720x1280','1280x720','960x960'],     true, 'pro',
   'AI Fruit Story V3 — Vidu Q3 Turbo 720p with audio'),
  ('video:fruit-v4', NULL, 29,  ARRAY[6], ARRAY['1080x1920','1920x1080','1080x1080'], true, 'generative',
   'AI Fruit Story V4 — Veo 3.1 Lite with audio'),
  ('video:fruitveo31lite', NULL, 29, ARRAY[6], ARRAY['1080x1920','1920x1080','1080x1080'], true, 'generative',
   'Legacy alias of video:fruit-v4 for old browser bundles — delete once they are gone')
ON CONFLICT (tool_key) DO NOTHING;

/* ─── Price computation (shared by trigger + job-worker) ──────────────── */

-- Returns NULL when the tool_key has no active server price. Raises
-- INVALID_JOB_SIGNATURE when the job's duration/size/sound isn't allowed.
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
  v_size     text;
  v_sound    boolean;
BEGIN
  SELECT * INTO r FROM public.tool_prices WHERE tool_key = p_tool_key AND active;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_dur_raw := NULLIF(p_input->>'durationSec', '')::numeric;
    v_sound   := COALESCE((p_input->>'withSound')::boolean, false);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: malformed durationSec/withSound for %', p_tool_key USING ERRCODE = '22023';
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

  IF r.flat_credits IS NOT NULL THEN
    RETURN r.flat_credits;
  END IF;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: durationSec required for per-second price of %', p_tool_key USING ERRCODE = '22023';
  END IF;
  RETURN CEIL(r.credits_per_second * v_duration)::integer;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_tool_price(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_tool_price(text, jsonb) TO anon, authenticated, service_role;

/* ─── Fruit-scoped pricing trigger ────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.enforce_tool_job_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits integer;
BEGIN
  v_credits := public.compute_tool_price(NEW.tool_key, NEW.input);
  IF v_credits IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.charge_credits := v_credits;
  NEW.settings := jsonb_set(COALESCE(NEW.settings, '{}'::jsonb), '{credits}', to_jsonb(v_credits), true);
  RETURN NEW;
END;
$function$;

-- Scoped to Fruit keys for now; widen the WHEN clause when other tools
-- move onto tool_prices.
DROP TRIGGER IF EXISTS jobs_enforce_tool_pricing ON public.jobs;
CREATE TRIGGER jobs_enforce_tool_pricing
  BEFORE INSERT OR UPDATE OF charge_credits, input, tool_key ON public.jobs
  FOR EACH ROW
  WHEN (NEW.tool_key LIKE 'video:fruit%')
  EXECUTE FUNCTION public.enforce_tool_job_pricing();

/* ─── Edge-function rate limiting ─────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.edge_rate_limit_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  bucket     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edge_rate_limit_events_lookup
  ON public.edge_rate_limit_events (user_id, bucket, created_at DESC);
ALTER TABLE public.edge_rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.edge_rate_limit_events_id_seq FROM PUBLIC, anon, authenticated;

-- Atomically checks and records one call. Returns allowed=false plus the
-- seconds until the oldest counted call leaves the window.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id uuid, p_bucket text, p_limit integer, p_window_seconds integer
)
 RETURNS TABLE (allowed boolean, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count        integer;
  v_oldest       timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_bucket, 0));

  DELETE FROM public.edge_rate_limit_events
  WHERE user_id = p_user_id AND bucket = p_bucket AND created_at < v_window_start;

  SELECT count(*), min(created_at) INTO v_count, v_oldest
  FROM public.edge_rate_limit_events
  WHERE user_id = p_user_id AND bucket = p_bucket;

  IF v_count >= p_limit THEN
    RETURN QUERY SELECT false,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
    RETURN;
  END IF;

  INSERT INTO public.edge_rate_limit_events (user_id, bucket) VALUES (p_user_id, p_bucket);
  RETURN QUERY SELECT true, 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, text, integer, integer) TO service_role;

-- Daily cleanup: consume_rate_limit already prunes a user's own expired rows
-- on each call; this removes rows for users who stopped calling.
SELECT cron.schedule(
  'edge-rate-limit-cleanup-daily',
  '17 3 * * *',
  $cron$DELETE FROM public.edge_rate_limit_events WHERE created_at < now() - interval '1 day'$cron$
);

NOTIFY pgrst, 'reload schema';

COMMIT;
