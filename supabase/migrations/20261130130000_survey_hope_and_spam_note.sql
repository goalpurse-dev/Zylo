-- Owner, 2026-11-03. The survey's last, optional question ("What do you hope Zyvo will help you create?"), and the
-- "check your spam" note shown only to someone the welcome email was really sent to, until they tap "I found it".
-- Safe with the live site: the old page's survey call (7 arguments) still works through the new argument's default.
-- Rollback: supabase/rollbacks/20261130130000_survey_hope_and_spam_note_rollback.sql
ALTER TABLE public.user_onboarding ADD COLUMN IF NOT EXISTS hope text CHECK (char_length(hope) <= 300);
ALTER TABLE public.user_onboarding ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;          -- set by send-welcome-email
ALTER TABLE public.user_onboarding ADD COLUMN IF NOT EXISTS spam_note_dismissed_at timestamptz;   -- "I found it"

-- One function, not two: an overload with the old 7 arguments would make the old page's call ambiguous.
DROP FUNCTION IF EXISTS public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean);
CREATE OR REPLACE FUNCTION public.save_onboarding_survey(p_goals text[], p_experience text, p_heard_from text, p_heard_creator text, p_email_consent boolean, p_consent_text text DEFAULT NULL, p_skipped boolean DEFAULT false, p_hope text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.user_onboarding (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_onboarding SET
    goals = CASE WHEN p_skipped THEN goals ELSE p_goals[1:8] END,
    experience = CASE WHEN p_skipped THEN experience ELSE left(p_experience, 40) END,
    heard_from = CASE WHEN p_skipped THEN heard_from ELSE left(p_heard_from, 40) END,
    heard_creator = CASE WHEN p_skipped THEN heard_creator ELSE left(p_heard_creator, 120) END,
    hope = CASE WHEN p_skipped THEN hope ELSE NULLIF(left(btrim(p_hope), 300), '') END,
    survey_done_at = CASE WHEN p_skipped THEN survey_done_at ELSE COALESCE(survey_done_at, now()) END,
    survey_skipped_at = CASE WHEN p_skipped THEN COALESCE(survey_skipped_at, now()) ELSE survey_skipped_at END
  WHERE user_id = v_user;
  UPDATE public.profiles SET onboarding_completed = true WHERE id = v_user;
  IF NOT p_skipped THEN PERFORM public.set_email_consent(COALESCE(p_email_consent, false), p_consent_text); END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean, text) TO authenticated, service_role;

-- The page asks this: welcomeSent and spamNoteDismissed decide the "check your spam" note.
CREATE OR REPLACE FUNCTION public.onboarding_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  s public.onboarding_settings;
  v_created timestamptz;
  r public.user_onboarding;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('enrolled', false); END IF;
  SELECT * INTO r FROM public.user_onboarding WHERE user_id = v_user;
  IF NOT FOUND OR (r.survey_done_at IS NULL AND r.survey_skipped_at IS NULL AND NOT r.enrolled) THEN
    SELECT * INTO s FROM public.onboarding_settings WHERE id = 1;
    SELECT created_at INTO v_created FROM public.profiles WHERE id = v_user;
    IF s.starts_at IS NOT NULL AND v_created >= s.starts_at THEN
      INSERT INTO public.user_onboarding (user_id, enrolled)
        VALUES (v_user, abs(hashtext(v_user::text)) % 100 < s.rollout_percent)
        ON CONFLICT (user_id) DO NOTHING;
      SELECT * INTO r FROM public.user_onboarding WHERE user_id = v_user;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'enrolled', COALESCE(r.enrolled, false),
    'surveyDone', r.survey_done_at IS NOT NULL OR r.survey_skipped_at IS NOT NULL,
    'tutorialDone', r.tutorial_done_at IS NOT NULL,
    'goals', COALESCE(to_jsonb(r.goals), '[]'::jsonb),
    'welcomeSent', r.welcome_sent_at IS NOT NULL,
    'spamNoteDismissed', r.spam_note_dismissed_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.onboarding_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_status() TO authenticated, service_role;

-- "I found it ✓": the note never shows again for this account.
CREATE OR REPLACE FUNCTION public.dismiss_spam_note()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_onboarding SET spam_note_dismissed_at = COALESCE(spam_note_dismissed_at, now()) WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.dismiss_spam_note() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_spam_note() TO authenticated, service_role;

-- The browser can report only these. preview_generated, upgraded and full_video_completed_after_upgrade come from the server.
CREATE OR REPLACE FUNCTION public.track_funnel_event(p_event text, p_props jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_event NOT IN ('signed_up', 'survey_started', 'survey_answer', 'survey_completed', 'survey_skipped', 'plan_screen_shown', 'plan_screen_finished', 'tutorial_started', 'tutorial_step_completed', 'preview_watched_to_end', 'tutorial_skipped', 'upgrade_screen_shown', 'upgrade_click', 'compare_plan_click', 'checkout_opened', 'welcome_email_clicked', 'spam_note_shown', 'spam_note_found') THEN
    RAISE EXCEPTION 'UNKNOWN_EVENT' USING ERRCODE = '22023';
  END IF;
  -- signed_up counts only for an account made in the last day: an old account can't enter the new funnel
  IF p_event = 'signed_up' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND created_at > now() - interval '1 day') THEN RETURN; END IF;
  INSERT INTO public.funnel_events (user_id, event, props) VALUES (v_user, p_event, COALESCE(p_props, '{}'::jsonb)) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.track_funnel_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_funnel_event(text, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
