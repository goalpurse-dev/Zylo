-- Blocky Worlds: the production video pipeline (docs/blocky-worlds-pipeline.md).
-- NOT APPLIED. The owner applies it (db query --linked -f, then migration repair; never db push), after
-- 20261201100000_blocky_worlds.sql and 20261201110000_blocky_worlds_idea_library.sql, before blocky-worlds-render is
-- deployed. The cron at the end needs two vault secrets first (see the bottom).
--
-- 1. blocky_worlds_jobs: every RunPod job of a run (prepare, chunk i, finish), one row per try. The unique
--    (run_id, role, idx, attempt) is what makes a try be sent once even when two callbacks decide it at the same time.
-- 2. blocky_worlds_runs: render (the frame split), planned_at (the split is saved once), voice_ready (the paid take is
--    in storage: a retry never buys it again).
-- 3. blocky_worlds_cost_ledger.ref: one row per paid thing (gpu:<RunPod job>, voice:<job>); a repeated webhook adds nothing.
-- 4. The sweeper: pg_cron every minute -> blocky-worlds-render (header x-blocky-cron).
-- Only the edge functions (service role) read and write these: RLS on, no policies.

BEGIN;

ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS render jsonb;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS planned_at timestamptz;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS voice_ready boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES public.blocky_worlds_runs (id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('prepare', 'chunk', 'finish')),
  idx             integer NOT NULL DEFAULT 0,
  attempt         integer NOT NULL DEFAULT 1,
  state           text NOT NULL DEFAULT 'sent' CHECK (state IN ('sent', 'running', 'done', 'failed')),
  stage           text,
  pct             integer NOT NULL DEFAULT 0,
  from_frame      integer,
  to_frame        integer,
  provider_job_id text,
  dispatched_at   timestamptz,
  started_at      timestamptz,
  heartbeat_at    timestamptz,
  finished_at     timestamptz,
  gpu_seconds     numeric(10,2),
  error_code      text,
  error_message   text,
  output          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocky_worlds_jobs_once UNIQUE (run_id, role, idx, attempt)
);
CREATE INDEX IF NOT EXISTS blocky_worlds_jobs_run ON public.blocky_worlds_jobs (run_id);
CREATE INDEX IF NOT EXISTS blocky_worlds_jobs_provider ON public.blocky_worlds_jobs (provider_job_id) WHERE provider_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS blocky_worlds_jobs_uncosted ON public.blocky_worlds_jobs (finished_at) WHERE gpu_seconds IS NULL AND provider_job_id IS NOT NULL;
ALTER TABLE public.blocky_worlds_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_jobs FROM anon, authenticated;

ALTER TABLE public.blocky_worlds_cost_ledger ADD COLUMN IF NOT EXISTS ref text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocky_worlds_cost_ledger_ref') THEN
    ALTER TABLE public.blocky_worlds_cost_ledger ADD CONSTRAINT blocky_worlds_cost_ledger_ref UNIQUE (run_id, ref);
  END IF;
END $$;

-- The sweeper: every minute (stuck jobs, lost webhooks, the NO_GPU wait, the GPU cost of jobs whose webhook never came).
-- Vault secrets (the owner creates them once):
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/blocky-worlds-render', 'blocky_worlds_render_url');
--   select vault.create_secret('<the same value as the function secret BLOCKY_WORLDS_CRON_SECRET>', 'blocky_worlds_cron_secret');
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.trigger_blocky_worlds_sweeper()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, public, vault
AS $$
DECLARE v_url text; v_secret text; v_id bigint;
BEGIN
  -- nothing running: no call at all
  IF NOT EXISTS (SELECT 1 FROM public.blocky_worlds_runs WHERE status NOT IN ('done', 'failed'))
     AND NOT EXISTS (SELECT 1 FROM public.blocky_worlds_jobs WHERE gpu_seconds IS NULL AND provider_job_id IS NOT NULL AND finished_at > now() - interval '1 day') THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'blocky_worlds_render_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'blocky_worlds_cron_secret' ORDER BY created_at DESC LIMIT 1;
  IF nullif(v_url, '') IS NULL OR nullif(v_secret, '') IS NULL THEN RAISE EXCEPTION 'BLOCKY_WORLDS_SWEEPER_VAULT_SECRETS_MISSING'; END IF;
  SELECT net.http_post(url => v_url, headers => jsonb_build_object('content-type', 'application/json', 'x-blocky-cron', v_secret), body => '{"sweep":true}'::jsonb, timeout_milliseconds => 60000) INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION private.trigger_blocky_worlds_sweeper() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('blocky-worlds-sweeper') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'blocky-worlds-sweeper');
SELECT cron.schedule('blocky-worlds-sweeper', '* * * * *', 'select private.trigger_blocky_worlds_sweeper();');

COMMIT;
