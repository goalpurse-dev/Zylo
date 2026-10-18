-- Removes Phase 2 of the Content Machine (20261108100000_content_machine_slideshows.sql) and nothing else.
-- DESTRUCTIVE for its own data: the library and the recipes on ideas are gone afterwards.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'content-machine-tick';
  END IF;
END $$;
DROP FUNCTION IF EXISTS private.trigger_content_machine();
DROP FUNCTION IF EXISTS public.cm_claim_jobs(integer, integer);
DROP TABLE IF EXISTS public.cm_logos;
DROP TABLE IF EXISTS public.cm_library;
DROP INDEX IF EXISTS public.cm_ideas_format_style;
ALTER TABLE public.cm_ideas DROP COLUMN IF EXISTS recipe, DROP COLUMN IF EXISTS topic, DROP COLUMN IF EXISTS hypothesis,
  DROP COLUMN IF EXISTS dry_run, DROP COLUMN IF EXISTS compliance, DROP COLUMN IF EXISTS error;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS experiment_days, DROP COLUMN IF EXISTS experiment_started_on,
  DROP COLUMN IF EXISTS daily_auto_run, DROP COLUMN IF EXISTS winners_per_day, DROP COLUMN IF EXISTS experiments_per_day,
  DROP COLUMN IF EXISTS use_batch_for_daily;
COMMIT;
