-- Puts the Blocky and Fruit sweeps back to every 20 seconds.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.alter_job(jobid, schedule := '20 seconds')
    FROM cron.job
    WHERE jobname IN ('blocky-story-reconcile', 'fruit-story-reconcile');
  END IF;
END $$;
