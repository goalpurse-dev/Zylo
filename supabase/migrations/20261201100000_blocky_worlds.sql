-- Blocky Worlds (the "In this world..." story template): the flow idea -> script -> settings -> generate -> result.
-- NOT APPLIED. The owner applies it (db query --linked -f, then migration repair; never db push), before the function
-- blocky-worlds-api is deployed.
--
-- 1. blocky_worlds_ideas: the idea cards a user was shown (the twist stays here, never in the page).
-- 2. blocky_worlds_drafts: scripts being written or edited (written from an idea, or the user's own).
-- 3. blocky_worlds_ai_calls: every writing call (ideas, scripts) for the daily limits and the spend count.
-- 4. blocky_worlds_runs: one row per video; the script is copied in at start, so later edits never change a paid run.
-- 5. blocky_worlds_settings (one row: the caps) and blocky_worlds_cost_ledger (every paid call of a run).
-- 6. RPCs: blocky_worlds_start_run (charge once + create the run, one transaction), blocky_worlds_refund (once),
--    blocky_worlds_add_cost, blocky_worlds_guard (the counts the caps need).
-- 7. Storage: the private bucket blocky-worlds-renders.
-- 8. Prices: tool_prices rows, equal to _shared/blockyWorlds/pricing.js PRICE_ROWS (tests/blockyWorlds.test.mjs).
-- Only the edge functions (service role) read and write these tables: RLS on, no policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_ideas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source     text NOT NULL CHECK (source IN ('batch', 'topic')),
  topic      text,
  idea       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_ideas_user ON public.blocky_worlds_ideas (user_id, created_at DESC);
ALTER TABLE public.blocky_worlds_ideas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_ideas FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  idea_id     uuid REFERENCES public.blocky_worlds_ideas (id) ON DELETE SET NULL,
  source      text NOT NULL CHECK (source IN ('idea', 'topic', 'own')),
  title       text NOT NULL DEFAULT '',
  length_sec  integer NOT NULL CHECK (length_sec IN (60, 90, 120)),
  lines       jsonb NOT NULL DEFAULT '[]'::jsonb,
  post        jsonb NOT NULL DEFAULT '{}'::jsonb,
  checks      jsonb NOT NULL DEFAULT '{}'::jsonb,
  writes      integer NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_drafts_user ON public.blocky_worlds_drafts (user_id, updated_at DESC);
ALTER TABLE public.blocky_worlds_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_drafts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_ai_calls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('ideas', 'script')),
  provider   text NOT NULL DEFAULT 'anthropic',
  usd        numeric(10,6) NOT NULL DEFAULT 0,
  ok         boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_ai_calls_user ON public.blocky_worlds_ai_calls (user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS blocky_worlds_ai_calls_created ON public.blocky_worlds_ai_calls (created_at DESC);
ALTER TABLE public.blocky_worlds_ai_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_ai_calls FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  draft_id         uuid REFERENCES public.blocky_worlds_drafts (id) ON DELETE SET NULL,
  env              text NOT NULL DEFAULT 'prod' CHECK (env IN ('prod', 'test')),
  title            text NOT NULL DEFAULT '',
  length_sec       integer NOT NULL CHECK (length_sec IN (60, 90, 120)),
  lines            jsonb NOT NULL,           -- the script as charged (a copy: later draft edits never change it)
  narration        text NOT NULL,
  post             jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrator         jsonb NOT NULL,           -- the voice, model and settings this run uses (config.js NARRATOR)
  end_card         boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'voice', 'plan', 'render', 'done', 'failed')),
  stage_at         timestamptz NOT NULL DEFAULT now(),
  pct              integer NOT NULL DEFAULT 0,
  files            jsonb,
  provider         text,
  provider_job_id  text,
  attempt          integer NOT NULL DEFAULT 1,
  dispatched_at    timestamptz,
  heartbeat_at     timestamptz,
  credits_charged  integer NOT NULL DEFAULT 0,
  credits_refunded integer NOT NULL DEFAULT 0,
  refunded_at      timestamptz,
  cost_usd         numeric(10,5) NOT NULL DEFAULT 0,
  error_code       text,
  error_message    text,
  finished_at      timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_runs_user_created ON public.blocky_worlds_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blocky_worlds_runs_running ON public.blocky_worlds_runs (status) WHERE status NOT IN ('done', 'failed');
ALTER TABLE public.blocky_worlds_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_runs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_settings (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paid_calls           boolean NOT NULL DEFAULT true,
  daily_cap_usd        numeric NOT NULL DEFAULT 20,
  user_max_running     integer NOT NULL DEFAULT 2,
  user_starts_per_hour integer NOT NULL DEFAULT 10,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.blocky_worlds_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.blocky_worlds_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_cost_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES public.blocky_worlds_runs (id) ON DELETE CASCADE,
  stage      text NOT NULL,
  provider   text NOT NULL,
  model      text,
  usd        numeric(10,6) NOT NULL DEFAULT 0,
  units      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_cost_ledger_run ON public.blocky_worlds_cost_ledger (run_id);
ALTER TABLE public.blocky_worlds_cost_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_cost_ledger FROM anon, authenticated;

-- Charge once and create the run, in one transaction: INSUFFICIENT_CREDITS leaves nothing behind.
CREATE OR REPLACE FUNCTION public.blocky_worlds_start_run(p_user uuid, p_draft uuid, p_title text, p_length integer,
  p_lines jsonb, p_narration text, p_post jsonb, p_narrator jsonb, p_end_card boolean, p_credits integer, p_env text)
RETURNS public.blocky_worlds_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_run public.blocky_worlds_runs;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
  PERFORM public.deduct_credits(p_user, p_credits);
  INSERT INTO public.blocky_worlds_runs (user_id, draft_id, title, length_sec, lines, narration, post, narrator, end_card, credits_charged, env)
  VALUES (p_user, p_draft, COALESCE(p_title, ''), p_length, p_lines, p_narration, COALESCE(p_post, '{}'::jsonb), p_narrator, p_end_card, p_credits, COALESCE(p_env, 'prod'))
  RETURNING * INTO v_run;
  RETURN v_run;
END;
$$;

-- Refund a run once: the row is marked first, in the same statement that picks it, so a second call finds nothing.
CREATE OR REPLACE FUNCTION public.blocky_worlds_refund(p_run uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid; v_credits integer;
BEGIN
  UPDATE public.blocky_worlds_runs SET refunded_at = now(), credits_refunded = credits_charged, updated_at = now()
   WHERE id = p_run AND refunded_at IS NULL AND credits_charged > 0
   RETURNING user_id, credits_charged INTO v_user, v_credits;
  IF NOT FOUND THEN RETURN 0; END IF;
  PERFORM public.deduct_credits(v_user, -v_credits);
  RETURN v_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.blocky_worlds_add_cost(p_run uuid, p_usd numeric)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.blocky_worlds_runs SET cost_usd = cost_usd + COALESCE(p_usd, 0) WHERE id = p_run; $$;

-- The counts the caps need (_shared/blockyWorlds/guard.js decide), read fresh before a start or a writing call.
-- spent_24h: every run's cost (a running one at least its charged credits x $0.01) plus every writing call.
CREATE OR REPLACE FUNCTION public.blocky_worlds_guard(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_balance timestamptz;
BEGIN
  SELECT max(finished_at) INTO v_balance FROM public.blocky_worlds_runs WHERE error_code = 'PROVIDER_BALANCE' AND finished_at > now() - interval '1 hour';
  RETURN jsonb_build_object(
    'spent_24h',
      COALESCE((SELECT sum(CASE WHEN status IN ('done', 'failed') THEN cost_usd ELSE greatest(cost_usd, credits_charged * 0.01) END) FROM public.blocky_worlds_runs WHERE created_at > now() - interval '24 hours'), 0)
      + COALESCE((SELECT sum(usd) FROM public.blocky_worlds_ai_calls WHERE created_at > now() - interval '24 hours'), 0),
    'user_running', (SELECT count(*) FROM public.blocky_worlds_runs WHERE user_id = p_user AND status NOT IN ('done', 'failed')),
    'user_starts_1h', (SELECT count(*) FROM public.blocky_worlds_runs WHERE user_id = p_user AND created_at > now() - interval '1 hour'),
    'user_ideas_today', (SELECT count(*) FROM public.blocky_worlds_ai_calls WHERE user_id = p_user AND purpose = 'ideas' AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'),
    'user_scripts_today', (SELECT count(*) FROM public.blocky_worlds_ai_calls WHERE user_id = p_user AND purpose = 'script' AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'),
    'minutes_since_balance_fail', CASE WHEN v_balance IS NULL THEN NULL ELSE extract(epoch FROM now() - v_balance) / 60 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_refund(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_add_cost(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_guard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_refund(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_add_cost(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_guard(uuid) TO service_role;

-- The finished videos: private, 500 MB a file.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('blocky-worlds-renders', 'blocky-worlds-renders', false, 524288000)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, public = false;

-- Prices: 1 credit = $0.01 of our full real cost (pricing.js); the user pays $0.02 a credit. ESTIMATES until the
-- owner's paid tests: change pricing.js, then these rows (the test holds them together).
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('blocky-worlds:video-60', NULL, 47, NULL, 'Blocky Worlds 60 s: our full cost ~$0.46 (estimate)'),
  ('blocky-worlds:video-90', NULL, 62, NULL, 'Blocky Worlds 90 s: our full cost ~$0.62 (estimate)'),
  ('blocky-worlds:video-120', NULL, 78, NULL, 'Blocky Worlds 120 s: our full cost ~$0.77 (estimate)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;

COMMIT;
