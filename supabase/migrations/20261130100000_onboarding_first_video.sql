-- New-user onboarding (owner, 2026-11-02): a survey, a free 10-second Cutaway preview, an upgrade that finishes the same
-- video as a gift, and the funnel to measure it. Everything is OFF until onboarding_settings is changed:
--   starts_at        only accounts created from this moment on can be enrolled (NULL: nobody)
--   rollout_percent  the share of those accounts that get the new flow (the launch is 10); the rest stay as the control group
--   free_preview_on  the second switch: no free render starts without it
-- Existing accounts never get the survey or a preview.
-- Rollback: supabase/rollbacks/20261130100000_onboarding_first_video_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ---------- the switch ----------
CREATE TABLE IF NOT EXISTS public.onboarding_settings (
  id                         integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starts_at                  timestamptz,
  rollout_percent            integer NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  free_preview_on            boolean NOT NULL DEFAULT false,
  free_preview_daily_cap_usd numeric(8,2) NOT NULL DEFAULT 10,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.onboarding_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY; -- no policies: the server only
REVOKE ALL ON public.onboarding_settings FROM PUBLIC, anon, authenticated;

-- ---------- the survey ----------
ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS enrolled          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goals             text[],
  ADD COLUMN IF NOT EXISTS heard_from        text,
  ADD COLUMN IF NOT EXISTS heard_creator     text,
  ADD COLUMN IF NOT EXISTS survey_done_at    timestamptz,
  ADD COLUMN IF NOT EXISTS survey_skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS tutorial_done_at  timestamptz,
  ADD COLUMN IF NOT EXISTS email_consent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS email_consent_text text;
-- Everything is saved through the functions below, so nobody can put themselves in or out of the rollout.
REVOKE INSERT, UPDATE, DELETE ON public.user_onboarding FROM authenticated;

-- A proof of when and to what someone said yes, and the one rule: a yes turns emails on; an unticked box only says no for
-- someone who never answered. It never turns off someone who opted in. (Settings and the unsubscribe link still can.)
CREATE OR REPLACE FUNCTION public.set_email_consent(p_consent boolean, p_text text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_consent IS TRUE THEN
    UPDATE public.profiles SET email_updates = true WHERE id = v_user;
    INSERT INTO public.user_onboarding (user_id, email_updates, email_consent_at, email_consent_text)
      VALUES (v_user, true, now(), left(p_text, 300))
      ON CONFLICT (user_id) DO UPDATE SET email_updates = true, email_consent_at = now(), email_consent_text = left(p_text, 300);
  ELSE
    UPDATE public.profiles SET email_updates = false WHERE id = v_user AND email_updates IS NULL;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_email_consent(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_email_consent(boolean, text) TO authenticated, service_role;

-- What the app needs at sign-in: is this account in the new flow, and how far is it? The group is decided once and kept.
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
REVOKE ALL ON FUNCTION public.onboarding_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_status() TO authenticated, service_role;

-- The survey's answers, or its Skip (p_skipped), which still leads to the tutorial.
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

CREATE OR REPLACE FUNCTION public.finish_onboarding_tutorial()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_onboarding SET tutorial_done_at = COALESCE(tutorial_done_at, now()) WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.finish_onboarding_tutorial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_onboarding_tutorial() TO authenticated, service_role;

-- ---------- the funnel ----------
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event      text NOT NULL CHECK (char_length(event) <= 60),
  props      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_events_event_time ON public.funnel_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_user ON public.funnel_events (user_id, created_at);
-- Counted once per account, whoever reports it and however many times.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_once ON public.funnel_events (user_id, event)
  WHERE event IN ('signed_up', 'survey_completed', 'survey_skipped', 'tutorial_started', 'tutorial_skipped', 'preview_generated', 'preview_watched_to_end', 'upgrade_screen_shown', 'upgraded', 'full_video_completed_after_upgrade');
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY; -- no policies: written below or by the server, read by the server
REVOKE ALL ON public.funnel_events FROM PUBLIC, anon, authenticated;

-- The browser can report only these. preview_generated, upgraded and full_video_completed_after_upgrade come from the server.
CREATE OR REPLACE FUNCTION public.track_funnel_event(p_event text, p_props jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF p_event NOT IN ('signed_up', 'survey_answer', 'survey_completed', 'survey_skipped', 'tutorial_started', 'tutorial_step_completed', 'preview_watched_to_end', 'tutorial_skipped', 'upgrade_screen_shown') THEN
    RAISE EXCEPTION 'UNKNOWN_EVENT' USING ERRCODE = '22023';
  END IF;
  -- signed_up counts only for an account made in the last day: an old account can't enter the new funnel
  IF p_event = 'signed_up' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND created_at > now() - interval '1 day') THEN RETURN; END IF;
  INSERT INTO public.funnel_events (user_id, event, props) VALUES (v_user, p_event, COALESCE(p_props, '{}'::jsonb)) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.track_funnel_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_funnel_event(text, jsonb) TO authenticated, service_role;

-- The numbers, new flow against the control group: scripts/onboardingFunnel.mjs reads this.
CREATE OR REPLACE VIEW public.funnel_summary AS
  SELECT COALESCE(o.enrolled, false) AS enrolled, e.event, count(*) AS events, count(DISTINCT e.user_id) AS users, min(e.created_at) AS first_at, max(e.created_at) AS last_at
    FROM public.funnel_events e LEFT JOIN public.user_onboarding o ON o.user_id = e.user_id
   GROUP BY 1, 2;
REVOKE ALL ON public.funnel_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.funnel_summary TO service_role;

-- ---------- the free preview ----------
ALTER TABLE public.cutaway_runs
  ADD COLUMN IF NOT EXISTS free_preview  boolean NOT NULL DEFAULT false,  -- only the first ~10 s, no credits, no download
  ADD COLUMN IF NOT EXISTS gift_finish   boolean NOT NULL DEFAULT false,  -- the same video in full after an upgrade, no credits
  ADD COLUMN IF NOT EXISTS preview_pool  boolean NOT NULL DEFAULT false,  -- the owner's run that prepares a topic's shared plan
  ADD COLUMN IF NOT EXISTS source_run_id uuid REFERENCES public.cutaway_runs (id) ON DELETE SET NULL;
-- A preview is finished once; after a failure it can be tried again.
CREATE UNIQUE INDEX IF NOT EXISTS cutaway_runs_one_finish ON public.cutaway_runs (source_run_id)
  WHERE source_run_id IS NOT NULL AND gift_finish AND status <> 'failed';

-- A topic's shared script and voice: every preview of the topic renders from this run's plan files.
CREATE TABLE IF NOT EXISTS public.cutaway_preview_plans (
  topic_key  text PRIMARY KEY,
  source_run uuid NOT NULL REFERENCES public.cutaway_runs (id) ON DELETE RESTRICT,
  title      text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cutaway_preview_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_preview_plans FROM PUBLIC, anon, authenticated;

-- One free preview per account, on the server: a row here, not a flag on the profile. A failed one is given back.
CREATE TABLE IF NOT EXISTS public.cutaway_free_previews (
  user_id       uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  run_id        uuid REFERENCES public.cutaway_runs (id) ON DELETE SET NULL,
  topic_key     text NOT NULL,
  ip_hash       text,
  device_hash   text,
  status        text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'ready', 'failed')),
  paid_at       timestamptz,
  finish_run_id uuid REFERENCES public.cutaway_runs (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutaway_free_previews_ip ON public.cutaway_free_previews (ip_hash, created_at DESC) WHERE status <> 'failed';
CREATE INDEX IF NOT EXISTS cutaway_free_previews_device ON public.cutaway_free_previews (device_hash, created_at DESC) WHERE status <> 'failed';
CREATE INDEX IF NOT EXISTS cutaway_free_previews_to_finish ON public.cutaway_free_previews (paid_at) WHERE paid_at IS NOT NULL AND finish_run_id IS NULL;
ALTER TABLE public.cutaway_free_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cutaway_free_previews FROM PUBLIC, anon, authenticated;

-- Free previews have their own daily cap, so they can never use up the emergency cap paying customers rely on.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.cutaway_guard(uuid)'::regprocedure) INTO v_def;
  IF v_def NOT LIKE '%NOT free_preview%' THEN
    v_def := replace(v_def, 'FROM public.cutaway_runs WHERE created_at >', 'FROM public.cutaway_runs WHERE NOT free_preview AND created_at >');
    IF v_def NOT LIKE '%NOT free_preview%' THEN RAISE EXCEPTION 'cutaway_guard changed: update this migration'; END IF;
    EXECUTE v_def;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
