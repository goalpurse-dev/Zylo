-- AI Fruit Story v2: run the reconciler every 20 seconds (was every minute).
-- When a Runware webhook doesn't arrive, the reconciler is what picks the
-- result up; "Caught at Dinner" lost up to a minute waiting for the next tick.
-- The trigger only calls the worker while Fruit work is open, so idle ticks cost nothing.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fruit-story-reconcile'), schedule := '20 seconds');
