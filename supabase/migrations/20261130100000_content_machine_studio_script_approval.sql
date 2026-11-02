-- Content Machine: script approval for Studio jobs (owner, 2026-11-02). The worker writes the script, the job waits in
-- 'script_review', and only the owner's approval sends it on to render.
--   cm_studio_jobs.script              the written script, with the owner's edits
--   cm_studio_jobs.script_approved_at  when it was approved; the worker renders nothing without it
-- Additive only.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.cm_studio_jobs ADD COLUMN IF NOT EXISTS script jsonb;
ALTER TABLE public.cm_studio_jobs ADD COLUMN IF NOT EXISTS script_approved_at timestamptz;
ALTER TABLE public.cm_studio_jobs DROP CONSTRAINT IF EXISTS cm_studio_jobs_status_check;
ALTER TABLE public.cm_studio_jobs ADD CONSTRAINT cm_studio_jobs_status_check CHECK (status IN ('waiting_go', 'queued', 'script_review', 'claimed', 'done', 'failed', 'cancelled'));

COMMIT;
