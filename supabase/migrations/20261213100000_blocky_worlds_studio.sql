-- Blocky Worlds STUDIO ENGINE (soft launch, owner 2026-11-13; _shared/blockyWorlds/studio.js, docs/blocky-worlds-launch.md).
-- NOT APPLIED. The owner applies it BEFORE deploying blocky-worlds-api / blocky-worlds-render with this code, the same
-- way as the other Blocky Worlds migrations (never db push):
--   npx supabase db query --linked -f supabase/migrations/20261213100000_blocky_worlds_studio.sql
--   npx supabase migration repair --linked --status applied 20261213100000
-- Safe on live: new columns with defaults (every existing run stays engine 'pipeline'), a new table, new functions, and
-- blocky_worlds_start_run gets ONE more parameter with a default (the old 11-argument call keeps working).
--
-- 1. blocky_worlds_runs: engine ('pipeline' | 'studio'), studio_stage (the progress screen's stage), worker_id +
--    claimed_at (which Studio worker holds the run), notified_at ("your video is ready" sent).
-- 2. blocky_worlds_workers: each Studio worker says hello every ~30 s; start refuses before any charge when none did lately.
-- 3. blocky_worlds_start_run(..., p_engine): the run is created with its engine in the same transaction as the charge,
--    so the pipeline's sweeper can never see a Studio run as its own.
-- 4. blocky_worlds_claim_studio_run(p_worker): the oldest queued Studio run, taken by one worker only (SKIP LOCKED).
-- Only the edge functions and the worker (service role) read and write these: RLS on, no policies.

BEGIN;

ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'pipeline';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocky_worlds_runs_engine_check') THEN
    ALTER TABLE public.blocky_worlds_runs ADD CONSTRAINT blocky_worlds_runs_engine_check CHECK (engine IN ('pipeline', 'studio'));
  END IF;
END $$;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS studio_stage text;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS worker_id text;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS blocky_worlds_runs_studio_line ON public.blocky_worlds_runs (created_at) WHERE engine = 'studio' AND status = 'queued';
CREATE INDEX IF NOT EXISTS blocky_worlds_runs_studio_live ON public.blocky_worlds_runs (engine) WHERE engine = 'studio' AND status NOT IN ('done', 'failed');

CREATE TABLE IF NOT EXISTS public.blocky_worlds_workers (
  id         text PRIMARY KEY,                 -- the worker's name (Fly machine id + process start)
  version    text,
  busy_run   uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  seen_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blocky_worlds_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_workers FROM anon, authenticated;

-- The start: the 11-argument version is replaced by one with p_engine (default 'pipeline'), in this transaction, so a
-- call with or without p_engine always finds exactly one function.
DROP FUNCTION IF EXISTS public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text);
CREATE OR REPLACE FUNCTION public.blocky_worlds_start_run(p_user uuid, p_draft uuid, p_title text, p_length integer,
  p_lines jsonb, p_narration text, p_post jsonb, p_narrator jsonb, p_end_card boolean, p_credits integer, p_env text,
  p_engine text DEFAULT 'pipeline')
RETURNS public.blocky_worlds_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_run public.blocky_worlds_runs;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
  IF COALESCE(p_engine, 'pipeline') NOT IN ('pipeline', 'studio') THEN RAISE EXCEPTION 'INVALID_ENGINE'; END IF;
  PERFORM public.deduct_credits(p_user, p_credits);
  INSERT INTO public.blocky_worlds_runs (user_id, draft_id, title, length_sec, lines, narration, post, narrator, end_card, credits_charged, env, engine)
  VALUES (p_user, p_draft, COALESCE(p_title, ''), p_length, p_lines, p_narration, COALESCE(p_post, '{}'::jsonb), p_narrator, p_end_card, p_credits, COALESCE(p_env, 'prod'), COALESCE(p_engine, 'pipeline'))
  RETURNING * INTO v_run;
  RETURN v_run;
END;
$$;

-- One queued Studio run for one worker: the oldest first; two workers asking at once never get the same run.
CREATE OR REPLACE FUNCTION public.blocky_worlds_claim_studio_run(p_worker text)
RETURNS SETOF public.blocky_worlds_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_worker IS NULL OR length(p_worker) = 0 THEN RAISE EXCEPTION 'NO_WORKER'; END IF;
  RETURN QUERY
  UPDATE public.blocky_worlds_runs r
     SET worker_id = p_worker, claimed_at = now(), heartbeat_at = now(), status = 'voice', studio_stage = 'voice',
         stage_at = now(), pct = 4, updated_at = now()
   WHERE r.id = (
     SELECT q.id FROM public.blocky_worlds_runs q
      WHERE q.engine = 'studio' AND q.status = 'queued' AND q.worker_id IS NULL AND q.deleted_at IS NULL
        -- blocky-worlds-api writes the run's idea card just after the charge: a run is taken once that is surely done
        AND q.created_at < now() - interval '5 seconds'
      ORDER BY q.created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED)
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_claim_studio_run(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_claim_studio_run(text) TO service_role;

COMMIT;
