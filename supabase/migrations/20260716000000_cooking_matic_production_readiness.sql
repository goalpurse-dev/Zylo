-- Production safeguards shared by Cooking Matic's image/video jobs.
-- Charging and the jobs.charged marker must change in one transaction so
-- concurrent clip submissions cannot double-charge or deliver unpaid work.

CREATE OR REPLACE FUNCTION public.charge_job_credits(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_amount integer;
BEGIN
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_job.charged, false) THEN
    RETURN true;
  END IF;

  v_amount := GREATEST(0, COALESCE(v_job.charge_credits, 0));
  IF v_amount > 0 THEN
    BEGIN
      PERFORM public.deduct_credits(v_job.user_id, v_amount);
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%INSUFFICIENT_CREDITS%' THEN
          RETURN false;
        END IF;
        RAISE;
    END;
  END IF;

  UPDATE public.jobs
  SET charged = true, updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_job_credits(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_amount integer;
BEGIN
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR NOT COALESCE(v_job.charged, false) THEN
    RETURN false;
  END IF;

  v_amount := GREATEST(0, COALESCE(v_job.charge_credits, 0));
  IF v_amount > 0 THEN
    UPDATE public.profiles
    SET
      credit_balance = credit_balance + v_amount,
      credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_amount)
    WHERE id = v_job.user_id;
  END IF;

  UPDATE public.jobs
  SET charged = false, updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_job_credits(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_job_credits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_job_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_job_credits(uuid) TO service_role;

ALTER TABLE public.cooking_matic_generations
  ADD COLUMN IF NOT EXISTS full_video_url text;
