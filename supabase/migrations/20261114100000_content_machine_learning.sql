-- Content Machine, Phase 3 (owner, 2026-10-18): the learning loop.
--   cm_settings     the playbook (editable rules the writer follows), the learning knobs (freshness half-life,
--                   successes a winner needs, new posts with stats before an analysis is suggested) and the
--                   daily scout (paid, OFF until the owner turns it on).
--   cm_analyses     each "Let the agent analyze": the report, the proposed playbook, the cost.
--   cm_scout_reports  can exist outside a run (the daily scout and "Scout now").
--   the minute tick also wakes the worker when today's scout is due.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS playbook text NOT NULL DEFAULT '';
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS playbook_updated_at timestamptz;
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS half_life_days integer NOT NULL DEFAULT 14 CHECK (half_life_days BETWEEN 1 AND 365);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS winner_min_successes integer NOT NULL DEFAULT 3 CHECK (winner_min_successes BETWEEN 1 AND 50);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS analysis_suggest_after integer NOT NULL DEFAULT 10 CHECK (analysis_suggest_after BETWEEN 1 AND 500);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS daily_scout boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cm_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  model text,
  posts_count integer NOT NULL DEFAULT 0,          -- posts with stats when it was asked for
  report jsonb,                                    -- summary, what works, proposed playbook, experiments, retire…
  learning jsonb,                                  -- the program's own numbers it was given (winners, retire)
  applied_at timestamptz,                          -- when the owner applied its playbook
  error text,
  cost_usd numeric(12, 6),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_analyses_created ON public.cm_analyses (created_at DESC);
ALTER TABLE public.cm_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_analyses FROM PUBLIC, anon, authenticated;

ALTER TABLE public.cm_scout_reports ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE public.cm_scout_reports ADD COLUMN IF NOT EXISTS report jsonb;
ALTER TABLE public.cm_scout_reports ADD COLUMN IF NOT EXISTS cost_usd numeric(12, 6);
CREATE INDEX IF NOT EXISTS cm_scout_reports_created ON public.cm_scout_reports (created_at DESC);

CREATE OR REPLACE FUNCTION private.trigger_content_machine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE s public.cm_settings%ROWTYPE; secret text; worker_url text; local_now timestamp; due boolean;
BEGIN
  SELECT * INTO s FROM public.cm_settings WHERE id;
  IF NOT FOUND OR s.kill_switch THEN RETURN; END IF;
  local_now := now() AT TIME ZONE s.timezone;
  due := EXISTS (SELECT 1 FROM public.cm_jobs WHERE (status = 'queued' AND run_after <= now()) OR (status = 'running' AND locked_until < now()))
      OR (s.daily_auto_run AND s.slideshows_per_day > 0 AND to_char(local_now, 'HH24:MI') >= s.run_time_local
          AND NOT EXISTS (SELECT 1 FROM public.cm_runs WHERE kind = 'daily' AND run_date = local_now::date))
      OR (s.daily_scout AND to_char(local_now, 'HH24:MI') >= s.run_time_local
          AND NOT EXISTS (SELECT 1 FROM public.cm_scout_reports WHERE (created_at AT TIME ZONE s.timezone)::date = local_now::date)
          AND NOT EXISTS (SELECT 1 FROM public.cm_jobs WHERE stage = 'scout' AND (created_at AT TIME ZONE s.timezone)::date = local_now::date));
  IF NOT due THEN RETURN; END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cm_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'cm_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cm-worker-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 5000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_content_machine() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_content_machine() TO service_role;

COMMIT;
