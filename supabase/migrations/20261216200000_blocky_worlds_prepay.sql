-- Blocky Worlds: PAY WHEN THE SCRIPT IS WRITTEN (owner 2026-11-15, the Blender page; like our other templates).
-- ONE flat price per video (blenderPricing.js BLENDER_FLAT: 313 credits, the 90 s row) is charged when the user presses
-- "Write my script"; rewrites, the voice and the render are included. Then:
--   * the video fails       -> the WHOLE price back, once (the run carries the prepaid credits: blocky_worlds_refund);
--   * the writer fails      -> the WHOLE price back, once (blocky_worlds_prepay_refund(id, 0));
--   * no "Make my video" within 7 days -> everything but 25 credits (the script) back, once (blocky_worlds_prepay_expire,
--     hourly by pg_cron below).
-- Prepared, NOT applied. Run by the owner (never db push), BEFORE switching BLOCKY_WORLDS_PREPAY=on:
--   npx supabase db query --linked -f supabase/migrations/20261216200000_blocky_worlds_prepay.sql
--   npx supabase migration repair --linked --status applied 20261216200000
-- Safe on live: a new table and new functions; blocky_worlds_start_run gets p_prepay with a default (the old calls keep
-- working). Rollback: unset BLOCKY_WORLDS_PREPAY (charge at start again); the table can stay.
BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_prepays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  credits      integer NOT NULL CHECK (credits > 0),
  keep_credits integer NOT NULL DEFAULT 25 CHECK (keep_credits >= 0),
  draft_id     uuid REFERENCES public.blocky_worlds_drafts (id) ON DELETE SET NULL,
  run_id       uuid REFERENCES public.blocky_worlds_runs (id) ON DELETE SET NULL,
  used_at      timestamptz,
  refunded_at  timestamptz,
  refunded     integer NOT NULL DEFAULT 0,
  refund_why   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX IF NOT EXISTS blocky_worlds_prepays_user ON public.blocky_worlds_prepays (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blocky_worlds_prepays_open ON public.blocky_worlds_prepays (expires_at) WHERE run_id IS NULL AND refunded_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS blocky_worlds_prepays_one_per_draft ON public.blocky_worlds_prepays (draft_id) WHERE draft_id IS NOT NULL;
ALTER TABLE public.blocky_worlds_prepays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_prepays FROM anon, authenticated;

ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS prepay_id uuid REFERENCES public.blocky_worlds_prepays (id) ON DELETE SET NULL;

-- Charge the flat price and open a prepay, in one transaction (INSUFFICIENT_CREDITS leaves nothing behind).
CREATE OR REPLACE FUNCTION public.blocky_worlds_prepay(p_user uuid, p_credits integer, p_keep integer DEFAULT 25, p_days integer DEFAULT 7)
RETURNS public.blocky_worlds_prepays
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.blocky_worlds_prepays;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
  PERFORM public.deduct_credits(p_user, p_credits);
  INSERT INTO public.blocky_worlds_prepays (user_id, credits, keep_credits, expires_at)
  VALUES (p_user, p_credits, LEAST(GREATEST(COALESCE(p_keep, 25), 0), p_credits), now() + make_interval(days => COALESCE(p_days, 7)))
  RETURNING * INTO v;
  RETURN v;
END;
$$;

-- Refund an UNUSED prepay once, keeping p_keep credits (0 = everything back). The row is marked in the statement that
-- picks it, so a second call (or a run that already used it) finds nothing and returns 0.
CREATE OR REPLACE FUNCTION public.blocky_worlds_prepay_refund(p_prepay uuid, p_keep integer DEFAULT 0, p_why text DEFAULT 'writer_failed')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid; v_back integer;
BEGIN
  UPDATE public.blocky_worlds_prepays
     SET refunded_at = now(), refunded = GREATEST(credits - GREATEST(COALESCE(p_keep, 0), 0), 0), refund_why = p_why
   WHERE id = p_prepay AND refunded_at IS NULL AND run_id IS NULL
   RETURNING user_id, refunded INTO v_user, v_back;
  IF NOT FOUND OR v_back <= 0 THEN RETURN 0; END IF;
  PERFORM public.deduct_credits(v_user, -v_back);
  RETURN v_back;
END;
$$;

-- The 7-day sweeper: every prepay never used for a video and past its expiry gets everything but its keep_credits back.
CREATE OR REPLACE FUNCTION public.blocky_worlds_prepay_expire()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id, keep_credits FROM public.blocky_worlds_prepays WHERE run_id IS NULL AND refunded_at IS NULL AND expires_at < now() LIMIT 500 LOOP
    IF public.blocky_worlds_prepay_refund(r.id, r.keep_credits, 'expired_unused') > 0 THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END;
$$;

-- The start: p_prepay (the draft's paid prepay) is consumed instead of a new charge; the run carries its credits, so the
-- existing blocky_worlds_refund gives the WHOLE price back once if the video fails. Without p_prepay: as before.
DROP FUNCTION IF EXISTS public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text, text);
CREATE OR REPLACE FUNCTION public.blocky_worlds_start_run(p_user uuid, p_draft uuid, p_title text, p_length integer,
  p_lines jsonb, p_narration text, p_post jsonb, p_narrator jsonb, p_end_card boolean, p_credits integer, p_env text,
  p_engine text DEFAULT 'pipeline', p_prepay uuid DEFAULT NULL)
RETURNS public.blocky_worlds_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_run public.blocky_worlds_runs; v_paid integer;
BEGIN
  IF COALESCE(p_engine, 'pipeline') NOT IN ('pipeline', 'studio') THEN RAISE EXCEPTION 'INVALID_ENGINE'; END IF;
  IF p_prepay IS NOT NULL THEN
    UPDATE public.blocky_worlds_prepays SET used_at = now()
     WHERE id = p_prepay AND user_id = p_user AND draft_id = p_draft AND run_id IS NULL AND refunded_at IS NULL
     RETURNING credits INTO v_paid;
    IF NOT FOUND THEN RAISE EXCEPTION 'PREPAY_NOT_OPEN'; END IF;
  ELSE
    IF p_credits IS NULL OR p_credits <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
    PERFORM public.deduct_credits(p_user, p_credits);
    v_paid := p_credits;
  END IF;
  INSERT INTO public.blocky_worlds_runs (user_id, draft_id, title, length_sec, lines, narration, post, narrator, end_card, credits_charged, env, engine, prepay_id)
  VALUES (p_user, p_draft, COALESCE(p_title, ''), p_length, p_lines, p_narration, COALESCE(p_post, '{}'::jsonb), p_narrator, p_end_card, v_paid, COALESCE(p_env, 'prod'), COALESCE(p_engine, 'pipeline'), p_prepay)
  RETURNING * INTO v_run;
  IF p_prepay IS NOT NULL THEN UPDATE public.blocky_worlds_prepays SET run_id = v_run.id WHERE id = p_prepay; END IF;
  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.blocky_worlds_prepay(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_prepay_refund(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_prepay_expire() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_start_run(uuid, uuid, text, integer, jsonb, text, jsonb, jsonb, boolean, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- hourly: the unused prepays past 7 days (pg_cron is on in this project for the Blocky Worlds sweeper)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blocky-worlds-prepay-expire';
    PERFORM cron.schedule('blocky-worlds-prepay-expire', '23 * * * *', 'SELECT public.blocky_worlds_prepay_expire()');
  END IF;
END
$cron$;

COMMIT;
