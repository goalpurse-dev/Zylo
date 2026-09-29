-- Rollback for 20260927123135_fruit_story_backend.sql.
-- Drops every Fruit v2 story table and its data (stories, jobs, ledger, AI call log)
-- and the v2 price rows. Refund any open charges BEFORE running this.
BEGIN;
SELECT cron.unschedule('fruit-story-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fruit-story-reconcile');
DROP FUNCTION IF EXISTS private.trigger_fruit_reconcile();
DROP FUNCTION IF EXISTS public.fruit_pick_ideas(text, integer);
DROP FUNCTION IF EXISTS public.fruit_refund_job(uuid, text, text, numeric);
DROP FUNCTION IF EXISTS public.fruit_complete_job(uuid, text, numeric, jsonb);
DROP FUNCTION IF EXISTS public.fruit_refresh_story_status(uuid);
DROP FUNCTION IF EXISTS public.fruit_charge_step(uuid, uuid, text, text[], text, jsonb);
DROP FUNCTION IF EXISTS public.fruit_plan_rank(text);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fruit_story_scenes') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fruit_story_scenes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fruit_stories') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fruit_stories;
  END IF;
END $$;
DROP TABLE IF EXISTS public.fruit_ai_calls, public.fruit_credit_ledger, public.fruit_jobs, public.fruit_charges,
  public.fruit_series_episodes, public.fruit_story_scenes, public.fruit_stories, public.fruit_ideas, public.fruit_series;
DROP FUNCTION IF EXISTS public.fruit_block_client_writes();
DELETE FROM public.tool_prices WHERE tool_key IN ('image:fruit-story', 'video:fruit-story-v2', 'video:fruit-story-v3', 'video:fruit-story-v4');
NOTIFY pgrst, 'reload schema';
COMMIT;
