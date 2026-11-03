-- Undoes 20261130130000: the survey call goes back to 7 arguments, the status loses the spam note's fields, the two new
-- events are refused again. The three columns stay (dropping them would lose the answers); nothing reads them after this.
DROP FUNCTION IF EXISTS public.dismiss_spam_note();

DROP FUNCTION IF EXISTS public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean, text);
CREATE OR REPLACE FUNCTION public.save_onboarding_survey(p_goals text[], p_experience text, p_heard_from text, p_heard_creator text, p_email_consent boolean, p_consent_text text DEFAULT NULL, p_skipped boolean DEFAULT false)
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
    survey_done_at = CASE WHEN p_skipped THEN survey_done_at ELSE COALESCE(survey_done_at, now()) END,
    survey_skipped_at = CASE WHEN p_skipped THEN COALESCE(survey_skipped_at, now()) ELSE survey_skipped_at END
  WHERE user_id = v_user;
  UPDATE public.profiles SET onboarding_completed = true WHERE id = v_user;
  IF NOT p_skipped THEN PERFORM public.set_email_consent(COALESCE(p_email_consent, false), p_consent_text); END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_survey(text[], text, text, text, boolean, text, boolean) TO authenticated, service_role;

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
    'goals', COALESCE(to_jsonb(r.goals), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.track_funnel_event(p_event text, p_props jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_event NOT IN ('signed_up', 'survey_started', 'survey_answer', 'survey_completed', 'survey_skipped', 'plan_screen_shown', 'plan_screen_finished', 'tutorial_started', 'tutorial_step_completed', 'preview_watched_to_end', 'tutorial_skipped', 'upgrade_screen_shown', 'upgrade_click', 'compare_plan_click', 'checkout_opened', 'welcome_email_clicked') THEN
    RAISE EXCEPTION 'UNKNOWN_EVENT' USING ERRCODE = '22023';
  END IF;
  IF p_event = 'signed_up' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND created_at > now() - interval '1 day') THEN RETURN; END IF;
  INSERT INTO public.funnel_events (user_id, event, props) VALUES (v_user, p_event, COALESCE(p_props, '{}'::jsonb)) ON CONFLICT DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
