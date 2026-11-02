-- Owner, 2026-11-03. The funnel dashboard's missing clicks, and the switch for the welcome email (OFF until the owner has
-- seen where the test copy lands). Nothing here changes what anyone sees.
-- Rollback: supabase/rollbacks/20261130120000_funnel_tracking_and_welcome_switch_rollback.sql
ALTER TABLE public.onboarding_settings ADD COLUMN IF NOT EXISTS welcome_email_on boolean NOT NULL DEFAULT false;

-- The browser can report only these. preview_generated, upgraded and full_video_completed_after_upgrade come from the server.
CREATE OR REPLACE FUNCTION public.track_funnel_event(p_event text, p_props jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_event NOT IN ('signed_up', 'survey_started', 'survey_answer', 'survey_completed', 'survey_skipped', 'plan_screen_shown', 'plan_screen_finished', 'tutorial_started', 'tutorial_step_completed', 'preview_watched_to_end', 'tutorial_skipped', 'upgrade_screen_shown', 'upgrade_click', 'compare_plan_click', 'checkout_opened', 'welcome_email_clicked') THEN
    RAISE EXCEPTION 'UNKNOWN_EVENT' USING ERRCODE = '22023';
  END IF;
  -- signed_up counts only for an account made in the last day: an old account can't enter the new funnel
  IF p_event = 'signed_up' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND created_at > now() - interval '1 day') THEN RETURN; END IF;
  INSERT INTO public.funnel_events (user_id, event, props) VALUES (v_user, p_event, COALESCE(p_props, '{}'::jsonb)) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.track_funnel_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_funnel_event(text, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
