-- The Blocky and Fruit sweeps run every 30 seconds instead of every 20 (owner, 2026-10-08, after the
-- database outage on the Nano size: fewer wake-ups for the same job). Each sweep is one cheap query when
-- nothing is in flight; a story waits at most 10 seconds longer for a step the callback missed.
-- Only the schedule changes: the same two jobs, the same commands.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.alter_job(jobid, schedule := '30 seconds')
    FROM cron.job
    WHERE jobname IN ('blocky-story-reconcile', 'fruit-story-reconcile');
  END IF;
END $$;
