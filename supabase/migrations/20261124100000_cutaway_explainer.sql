-- Cutaway Explainer, production (the 3D pipeline, M3 + M4). Replaces the never-applied 20261106100000 draft.
--
-- 1. cutaway_runs: one row per video. Only the edge functions (service role) read and write it; the page gets a view
--    of its own runs through cutaway-api (no costs, provider ids or keys ever reach the browser).
-- 2. cutaway_layouts: saved scene layouts; approved ones are reused for everyone (premade topics = approved layouts).
-- 3. cutaway_settings: the caps (one row); cutaway_cost_ledger: every paid call's cost per run.
-- 4. cutaway_parts_backlog: custom topics the kit can't build yet (nothing charged).
-- 5. RPCs: cutaway_start_run (charge once + create the run, one transaction), cutaway_refund (once), cutaway_add_cost,
--    cutaway_guard (the counts the caps need).
-- 6. Storage: the private bucket cutaway-renders (500 MB a file, the project's ceiling; the test bucket's 50 MB failed).
-- 7. Prices: tool_prices rows (must match _shared/cutaway/pricing.js PRICE_ROWS: tests/cutaway.test.mjs).
-- 8. The watchdog: pg_cron every 2 minutes -> cutaway-watchdog (header x-cutaway-cron = vault secret
--    'cutaway_cron_secret', which the function secret CUTAWAY_CRON_SECRET must equal: get_cutaway_cron_secret_once()).

BEGIN;

CREATE TABLE IF NOT EXISTS public.cutaway_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  env              text NOT NULL DEFAULT 'prod' CHECK (env IN ('prod', 'test')),
  topic            text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 120),
  topic_key        text,
  length_sec       integer NOT NULL CHECK (length_sec IN (30, 60)),
  kind             text NOT NULL CHECK (kind IN ('premade', 'custom')),
  end_card         boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'script', 'scene', 'render', 'done', 'failed')),
  stage            text NOT NULL DEFAULT 'queued',
  stage_at         timestamptz NOT NULL DEFAULT now(),
  pct              integer NOT NULL DEFAULT 0,
  title            text,
  narration        text,
  parts            jsonb,
  facts            jsonb,
  post             jsonb,
  preview_frames   integer NOT NULL DEFAULT 0,
  frames_total     integer,
  files            jsonb,
  renderer         text,
  layout_key       text,          -- the approved layout this video reused (premade)
  layout_used      boolean NOT NULL DEFAULT false,
  plan_key         text,          -- the key of the layout this video planned (custom)
  layout_approved  boolean,
  plan_ready       boolean NOT NULL DEFAULT false,
  provider         text NOT NULL DEFAULT 'runpod' CHECK (provider IN ('runpod', 'fly')),
  provider_job_id  text,
  attempt          integer NOT NULL DEFAULT 1,
  fallback         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched_at    timestamptz,
  heartbeat_at     timestamptz,
  watched_at       timestamptz,
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
CREATE INDEX IF NOT EXISTS cutaway_runs_user_created ON public.cutaway_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cutaway_runs_running ON public.cutaway_runs (status) WHERE status NOT IN ('done', 'failed');
CREATE INDEX IF NOT EXISTS cutaway_runs_finished ON public.cutaway_runs (finished_at DESC) WHERE status IN ('done', 'failed');
ALTER TABLE public.cutaway_runs ENABLE ROW LEVEL SECURITY; -- no policies: the edge functions only
REVOKE ALL ON public.cutaway_runs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cutaway_layouts (
  key          text PRIMARY KEY,
  topic        text NOT NULL,
  layout       jsonb NOT NULL,
  script       jsonb,
  approved     boolean NOT NULL DEFAULT false,
  approved_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at  timestamptz,
  retired_at   timestamptz,
  source_run   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cutaway_layouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_layouts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cutaway_settings (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paid_calls           boolean NOT NULL DEFAULT true,
  daily_cap_usd        numeric NOT NULL DEFAULT 3,
  window_cap_usd       numeric NOT NULL DEFAULT 3,
  user_daily_usd       numeric NOT NULL DEFAULT 1.5,
  user_max_running     integer NOT NULL DEFAULT 2,
  user_starts_per_hour integer NOT NULL DEFAULT 10,
  user_fail_streak     integer NOT NULL DEFAULT 3,
  fail_pause_min       integer NOT NULL DEFAULT 30,
  max_running          integer NOT NULL DEFAULT 4,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.cutaway_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.cutaway_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cutaway_cost_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES public.cutaway_runs (id) ON DELETE CASCADE,
  user_id    uuid,
  env        text NOT NULL DEFAULT 'prod',
  stage      text NOT NULL,
  provider   text NOT NULL,
  model      text,
  usd        numeric(10,6) NOT NULL DEFAULT 0,
  units      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutaway_cost_ledger_run ON public.cutaway_cost_ledger (run_id);
CREATE INDEX IF NOT EXISTS cutaway_cost_ledger_created ON public.cutaway_cost_ledger (created_at DESC);
ALTER TABLE public.cutaway_cost_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_cost_ledger FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cutaway_parts_backlog (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  topic      text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 200),
  missing    text[] NOT NULL DEFAULT '{}',
  checked_by text NOT NULL CHECK (checked_by IN ('rules', 'claude')),
  closest    text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutaway_parts_backlog_created ON public.cutaway_parts_backlog (created_at DESC);
ALTER TABLE public.cutaway_parts_backlog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_parts_backlog FROM anon, authenticated;

-- Charge once and create the run, in one transaction: INSUFFICIENT_CREDITS leaves nothing behind.
CREATE OR REPLACE FUNCTION public.cutaway_start_run(p_user uuid, p_topic text, p_topic_key text, p_length integer, p_kind text,
  p_end_card boolean, p_credits integer, p_env text, p_layout_key text)
RETURNS public.cutaway_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_run public.cutaway_runs;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
  PERFORM public.deduct_credits(p_user, p_credits);
  INSERT INTO public.cutaway_runs (user_id, topic, topic_key, length_sec, kind, end_card, credits_charged, env, layout_key, layout_used, dispatched_at)
  VALUES (p_user, p_topic, p_topic_key, p_length, p_kind, p_end_card, p_credits, COALESCE(p_env, 'prod'), p_layout_key, p_layout_key IS NOT NULL, now())
  RETURNING * INTO v_run;
  RETURN v_run;
END;
$$;

-- Refund a run once: the row is marked first, in the same statement that picks it, so a second call finds nothing.
CREATE OR REPLACE FUNCTION public.cutaway_refund(p_run uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid; v_credits integer;
BEGIN
  UPDATE public.cutaway_runs SET refunded_at = now(), credits_refunded = credits_charged, updated_at = now()
   WHERE id = p_run AND refunded_at IS NULL AND credits_charged > 0
   RETURNING user_id, credits_charged INTO v_user, v_credits;
  IF NOT FOUND THEN RETURN 0; END IF;
  PERFORM public.deduct_credits(v_user, -v_credits);
  RETURN v_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.cutaway_add_cost(p_run uuid, p_usd numeric)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.cutaway_runs SET cost_usd = cost_usd + COALESCE(p_usd, 0) WHERE id = p_run; $$;

-- The counts the caps need (_shared/cutaway/guard.js decide), read fresh before a start.
CREATE OR REPLACE FUNCTION public.cutaway_guard(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_streak integer := 0; r record; v_last_fail timestamptz; v_balance timestamptz;
BEGIN
  FOR r IN SELECT status FROM public.cutaway_runs WHERE user_id = p_user AND status IN ('done', 'failed') ORDER BY created_at DESC LIMIT 5 LOOP
    EXIT WHEN r.status = 'done';
    v_streak := v_streak + 1;
  END LOOP;
  SELECT max(finished_at) INTO v_last_fail FROM public.cutaway_runs WHERE user_id = p_user AND status = 'failed';
  SELECT max(finished_at) INTO v_balance FROM public.cutaway_runs WHERE error_code = 'PROVIDER_BALANCE' AND finished_at > now() - interval '1 hour';
  RETURN jsonb_build_object(
    'spent_24h', COALESCE((SELECT sum(CASE WHEN status IN ('done', 'failed') THEN cost_usd ELSE greatest(cost_usd, credits_charged * 0.01) END) FROM public.cutaway_runs WHERE created_at > now() - interval '24 hours'), 0),
    'spent_3h', COALESCE((SELECT sum(CASE WHEN status IN ('done', 'failed') THEN cost_usd ELSE greatest(cost_usd, credits_charged * 0.01) END) FROM public.cutaway_runs WHERE created_at > now() - interval '3 hours'), 0),
    'running', (SELECT count(*) FROM public.cutaway_runs WHERE status NOT IN ('done', 'failed')),
    'user_spent_24h', COALESCE((SELECT sum(CASE WHEN status IN ('done', 'failed') THEN cost_usd ELSE greatest(cost_usd, credits_charged * 0.01) END) FROM public.cutaway_runs WHERE user_id = p_user AND created_at > now() - interval '24 hours'), 0),
    'user_running', (SELECT count(*) FROM public.cutaway_runs WHERE user_id = p_user AND status NOT IN ('done', 'failed')),
    'user_starts_1h', (SELECT count(*) FROM public.cutaway_runs WHERE user_id = p_user AND created_at > now() - interval '1 hour'),
    'user_fail_streak', v_streak,
    'minutes_since_last_fail', CASE WHEN v_last_fail IS NULL THEN NULL ELSE extract(epoch FROM now() - v_last_fail) / 60 END,
    'minutes_since_balance_fail', CASE WHEN v_balance IS NULL THEN NULL ELSE extract(epoch FROM now() - v_balance) / 60 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cutaway_start_run(uuid, text, text, integer, text, boolean, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cutaway_refund(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cutaway_add_cost(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cutaway_guard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cutaway_start_run(uuid, text, text, integer, text, boolean, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cutaway_refund(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cutaway_add_cost(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.cutaway_guard(uuid) TO service_role;

-- The finished videos, their plans, preview frames and fallback chunks: private, 500 MB a file.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cutaway-renders', 'cutaway-renders', false, 524288000)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, public = false;

-- Prices: 1 credit = $0.01 of our full real cost (pricing.js: MEASURED, fullCostUsd); the user pays $0.02 a credit.
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('cutaway:premade-30', NULL, 25, NULL, 'Cutaway Explainer 30 s, premade topic (an approved layout): our full cost ~$0.24'),
  ('cutaway:premade-60', NULL, 40, NULL, 'Cutaway Explainer 60 s, premade topic: our full cost ~$0.40'),
  ('cutaway:custom-30', NULL, 129, NULL, 'Cutaway Explainer 30 s, custom topic (a new layout, failed attempts included): our full cost ~$1.29'),
  ('cutaway:custom-60', NULL, 187, NULL, 'Cutaway Explainer 60 s, custom topic: our full cost ~$1.87')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;

COMMIT;

-- The watchdog (outside the transaction: vault and cron).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE SCHEMA IF NOT EXISTS private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cutaway_watchdog_url') THEN
    PERFORM vault.create_secret('https://ilpiwoxubnevmxxikyvx.supabase.co/functions/v1/cutaway-watchdog', 'cutaway_watchdog_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cutaway_cron_secret') THEN
    PERFORM vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'cutaway_cron_secret');
  END IF;
END $$;

-- One-time: lets the deploying admin read the generated secret, to set the function secret CUTAWAY_CRON_SECRET to it.
CREATE OR REPLACE FUNCTION public.get_cutaway_cron_secret_once()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'cutaway_cron_secret' ORDER BY created_at DESC LIMIT 1;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cutaway_cron_secret_once() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cutaway_cron_secret_once() TO service_role;

CREATE OR REPLACE FUNCTION private.trigger_cutaway_watchdog()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, vault
AS $$
DECLARE v_url text; v_secret text; v_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'cutaway_watchdog_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cutaway_cron_secret' ORDER BY created_at DESC LIMIT 1;
  IF nullif(v_url, '') IS NULL OR nullif(v_secret, '') IS NULL THEN RAISE EXCEPTION 'CUTAWAY_WATCHDOG_VAULT_SECRETS_MISSING'; END IF;
  SELECT net.http_post(url => v_url, headers => jsonb_build_object('content-type', 'application/json', 'x-cutaway-cron', v_secret), body => '{}'::jsonb, timeout_milliseconds => 60000) INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.trigger_cutaway_watchdog() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cutaway-watchdog') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cutaway-watchdog');
SELECT cron.schedule('cutaway-watchdog', '*/2 * * * *', 'select private.trigger_cutaway_watchdog();');
