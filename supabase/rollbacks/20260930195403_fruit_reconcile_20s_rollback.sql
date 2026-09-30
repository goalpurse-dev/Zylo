SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fruit-story-reconcile'), schedule := '* * * * *');
