-- Undoes 20261130120000: the click events are refused again and the welcome switch is gone (the function then treats it as off).
CREATE OR REPLACE FUNCTION public.track_funnel_event(p_event text, p_props jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_event NOT IN ('signed_up', 'survey_answer', 'survey_completed', 'survey_skipped', 'tutorial_started', 'tutorial_step_completed', 'preview_watched_to_end', 'tutorial_skipped', 'upgrade_screen_shown') THEN
    RAISE EXCEPTION 'UNKNOWN_EVENT' USING ERRCODE = '22023';
  END IF;
  IF p_event = 'signed_up' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND created_at > now() - interval '1 day') THEN RETURN; END IF;
  INSERT INTO public.funnel_events (user_id, event, props) VALUES (v_user, p_event, COALESCE(p_props, '{}'::jsonb)) ON CONFLICT DO NOTHING;
END $$;
ALTER TABLE public.onboarding_settings DROP COLUMN IF EXISTS welcome_email_on;
NOTIFY pgrst, 'reload schema';
