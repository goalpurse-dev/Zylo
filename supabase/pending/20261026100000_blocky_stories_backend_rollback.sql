-- Rollback for 20261026100000_blocky_stories_backend.sql: removes Blocky Stories' backend.
-- It deletes every Blocky story, scene, job, charge row and log row. Credits already
-- charged stay charged (the balance is on profiles); refund by hand first if any are owed.
-- It touches no AI Fruit Story object, and keeps the price rows and the blocky_v1 switch.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blocky-story-reconcile';
  END IF;
END $$;
DROP FUNCTION IF EXISTS private.trigger_blocky_reconcile();
DROP FUNCTION IF EXISTS public.blocky_create_story(uuid, jsonb, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.blocky_charge_step(uuid, uuid, text, text[], text, jsonb);
DROP FUNCTION IF EXISTS public.blocky_complete_job(uuid, text, numeric, jsonb);
DROP FUNCTION IF EXISTS public.blocky_refund_job(uuid, text, text, numeric);
DROP FUNCTION IF EXISTS public.blocky_refresh_story_status(uuid);
DROP FUNCTION IF EXISTS public.blocky_raise_provider_alert(text, text, text, jsonb);
DROP TABLE IF EXISTS public.blocky_provider_alerts CASCADE;
DROP TABLE IF EXISTS public.blocky_series_episodes CASCADE;
DROP TABLE IF EXISTS public.blocky_ai_calls CASCADE;
DROP TABLE IF EXISTS public.blocky_credit_ledger CASCADE;
DROP TABLE IF EXISTS public.blocky_jobs CASCADE;
DROP TABLE IF EXISTS public.blocky_test_overrides CASCADE;
DROP TABLE IF EXISTS public.blocky_charges CASCADE;
DROP TABLE IF EXISTS public.blocky_story_scenes CASCADE;
DROP TABLE IF EXISTS public.blocky_stories CASCADE;
DROP TABLE IF EXISTS public.blocky_series CASCADE;
DROP TABLE IF EXISTS public.blocky_characters CASCADE;
DROP FUNCTION IF EXISTS public.blocky_characters_block_client_writes();
DROP FUNCTION IF EXISTS public.blocky_block_client_writes();
DROP FUNCTION IF EXISTS public.blocky_plan_rank(text);
NOTIFY pgrst, 'reload schema';
COMMIT;
