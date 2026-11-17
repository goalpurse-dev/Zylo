-- In This Town: "TRY AGAIN" CONTINUES, AND CHARGES ONLY WHEN IT WORKS (owner, 2026-11-18, after "The Town Where Lies Grow
-- Animal Noses" was blocked by the quality checker and refunded).
--   * blocky_worlds_retry_run(user, failed run): a new run of the SAME script (same lines, voice settings, scene plan,
--     characters), queued for the Studio worker with credits_charged 0 and charge_on_done = what the failed run had
--     charged; card.resume_of = the failed run (the worker restores its saved parts: the voice, the plan, the shots, the
--     fix rounds' state, and continues from there).
--   * the charge happens when the run turns DONE (trigger below), once. A retry that fails again costs nothing (its
--     credits_charged is 0, so blocky_worlds_refund gives back 0). Too few credits at that moment: the video is still
--     delivered and the miss is written on the row (never blocks the delivery).
-- Safe on live: new columns with defaults, a new function, a new trigger that acts only on rows with charge_on_done > 0.
BEGIN;

ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS resume_of uuid REFERENCES public.blocky_worlds_runs (id) ON DELETE SET NULL;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS charge_on_done integer NOT NULL DEFAULT 0 CHECK (charge_on_done >= 0);
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS charged_on_done_at timestamptz;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS charge_on_done_error text;

CREATE OR REPLACE FUNCTION public.blocky_worlds_retry_run(p_user uuid, p_failed uuid, p_env text DEFAULT NULL)
RETURNS public.blocky_worlds_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE f public.blocky_worlds_runs; v public.blocky_worlds_runs; v_price integer; v_balance integer;
BEGIN
  SELECT * INTO f FROM public.blocky_worlds_runs WHERE id = p_failed AND user_id = p_user AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
  IF f.status <> 'failed' THEN RAISE EXCEPTION 'RUN_NOT_FAILED'; END IF;
  IF f.engine <> 'studio' THEN RAISE EXCEPTION 'RUN_NOT_STUDIO'; END IF;
  -- the price it will cost once it works: what the failed run charged (a retry of a retry carries it on)
  v_price := GREATEST(COALESCE(NULLIF(f.credits_charged, 0), f.charge_on_done, 0), 0);
  IF v_price <= 0 THEN RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT'; END IF;
  -- nothing is taken now, but the user must be able to pay it when it is done
  SELECT credit_balance INTO v_balance FROM public.profiles WHERE id = p_user;
  IF COALESCE(v_balance, 0) < v_price THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  INSERT INTO public.blocky_worlds_runs (user_id, draft_id, title, length_sec, lines, narration, post, narrator, end_card,
    credits_charged, env, engine, card, library_id, studio_builds, resume_of, charge_on_done)
  VALUES (p_user, f.draft_id, f.title, f.length_sec, f.lines, f.narration, COALESCE(f.post, '{}'::jsonb), f.narrator, f.end_card,
    0, COALESCE(p_env, f.env, 'prod'), 'studio', COALESCE(f.card, '{}'::jsonb) || jsonb_build_object('resume_of', f.id),
    f.library_id, f.studio_builds, f.id, v_price)
  RETURNING * INTO v;
  RETURN v;
END;
$$;

-- the charge when a retry run is delivered: once, only from a live status (a run failed elsewhere and rescued late is
-- never charged), never blocking the delivery
CREATE OR REPLACE FUNCTION public.blocky_worlds_charge_on_done()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status NOT IN ('done', 'failed') AND NEW.charge_on_done > 0 AND NEW.charged_on_done_at IS NULL THEN
    NEW.charged_on_done_at := now();
    BEGIN
      PERFORM public.deduct_credits(NEW.user_id, NEW.charge_on_done);
      NEW.credits_charged := NEW.charge_on_done;
    EXCEPTION WHEN others THEN
      NEW.charge_on_done_error := left(SQLERRM, 300);
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS blocky_worlds_runs_charge_on_done ON public.blocky_worlds_runs;
CREATE TRIGGER blocky_worlds_runs_charge_on_done BEFORE UPDATE OF status ON public.blocky_worlds_runs
  FOR EACH ROW EXECUTE FUNCTION public.blocky_worlds_charge_on_done();

REVOKE ALL ON FUNCTION public.blocky_worlds_retry_run(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_retry_run(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_worlds_charge_on_done() FROM PUBLIC, anon, authenticated;

COMMIT;
