-- Rollback of 20261130100000. The app stays safe with the switch off, so turning off is usually enough:
--   UPDATE public.onboarding_settings SET rollout_percent = 0, free_preview_on = false;
-- This removes the tables too, and with them the survey answers and the funnel.
BEGIN;
DROP VIEW IF EXISTS public.funnel_summary;
DROP FUNCTION IF EXISTS public.track_funnel_event(text, jsonb);
DROP FUNCTION IF EXISTS public.finish_onboarding_tutorial();
DROP FUNCTION IF EXISTS public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean);
DROP FUNCTION IF EXISTS public.onboarding_status();
DROP FUNCTION IF EXISTS public.set_email_consent(boolean, text);
DROP TABLE IF EXISTS public.funnel_events;
DROP TABLE IF EXISTS public.cutaway_free_previews;
DROP TABLE IF EXISTS public.cutaway_preview_plans;
DROP TABLE IF EXISTS public.onboarding_settings;
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.cutaway_guard(uuid)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'WHERE NOT free_preview AND created_at >', 'WHERE created_at >');
END $$;
DROP INDEX IF EXISTS public.cutaway_runs_one_finish;
ALTER TABLE public.cutaway_runs DROP COLUMN IF EXISTS free_preview, DROP COLUMN IF EXISTS gift_finish, DROP COLUMN IF EXISTS preview_pool, DROP COLUMN IF EXISTS source_run_id;
ALTER TABLE public.user_onboarding DROP COLUMN IF EXISTS enrolled, DROP COLUMN IF EXISTS goals, DROP COLUMN IF EXISTS heard_from, DROP COLUMN IF EXISTS heard_creator, DROP COLUMN IF EXISTS survey_done_at, DROP COLUMN IF EXISTS survey_skipped_at, DROP COLUMN IF EXISTS tutorial_done_at, DROP COLUMN IF EXISTS email_consent_at, DROP COLUMN IF EXISTS email_consent_text;
GRANT INSERT, UPDATE ON public.user_onboarding TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
