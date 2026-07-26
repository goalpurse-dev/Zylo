-- Move 2AM Worlds from Nano Banana 2 4K (10 credits/image) to the
-- provider's 2K 9:16 tier (7 credits/image): 6 x 7 = 42 credits.
-- Refunds remain compatible with historical 60-credit generations by deriving
-- their per-image price from the amount reserved on each generation row.

ALTER TABLE public.two_am_generations
  ALTER COLUMN reserved_credits SET DEFAULT 42;

CREATE OR REPLACE FUNCTION public.begin_two_am_generation(
  p_prompt text,
  p_settings jsonb,
  p_random_seed text
)
RETURNS public.two_am_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.two_am_generations;
  v_cost constant integer := 42;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_prompt, ''))) < 2 THEN
    RAISE EXCEPTION 'PROMPT_REQUIRED';
  END IF;

  PERFORM public.deduct_credits(v_user_id, v_cost);

  INSERT INTO public.two_am_generations (
    user_id, user_prompt, settings, random_seed, reserved_credits
  ) VALUES (
    v_user_id, trim(p_prompt), COALESCE(p_settings, '{}'::jsonb), p_random_seed, v_cost
  )
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_two_am_generation(
  p_generation_id uuid,
  p_completed_scenes integer
)
RETURNS public.two_am_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation public.two_am_generations;
  v_completed integer := LEAST(6, GREATEST(0, COALESCE(p_completed_scenes, 0)));
  v_per_image integer;
  v_refund integer;
BEGIN
  SELECT * INTO v_generation
  FROM public.two_am_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  v_per_image := GREATEST(1, v_generation.reserved_credits / 6);
  v_refund := (6 - v_completed) * v_per_image;

  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_refund,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_refund)
    WHERE id = v_generation.user_id;
  END IF;

  UPDATE public.two_am_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_completed = 0 THEN 'refunded' ELSE 'settled' END,
      status = CASE
        WHEN v_completed = 6 THEN 'completed'
        WHEN v_completed = 0 THEN 'failed'
        ELSE 'partial'
      END
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_two_am_generation_from_jobs(
  p_generation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation public.two_am_generations;
  v_total integer;
  v_terminal integer;
  v_completed integer;
  v_per_image integer;
  v_refund integer;
BEGIN
  SELECT * INTO v_generation
  FROM public.two_am_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND OR v_generation.reservation_status <> 'reserved' THEN
    RETURN;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status IN ('succeeded', 'failed', 'canceled'))::integer,
    count(*) FILTER (WHERE status = 'succeeded' AND result_url IS NOT NULL)::integer
  INTO v_total, v_terminal, v_completed
  FROM public.jobs
  WHERE settings->>'two_am_generation_id' = p_generation_id::text;

  IF v_total <> 6 OR v_terminal <> 6 THEN
    RETURN;
  END IF;

  v_per_image := GREATEST(1, v_generation.reserved_credits / 6);
  v_refund := (6 - LEAST(6, GREATEST(0, v_completed))) * v_per_image;

  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_refund,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_refund)
    WHERE id = v_generation.user_id;
  END IF;

  UPDATE public.two_am_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_completed = 0 THEN 'refunded' ELSE 'settled' END,
      status = CASE
        WHEN v_completed = 6 THEN 'completed'
        WHEN v_completed = 0 THEN 'failed'
        ELSE 'partial'
      END
  WHERE id = p_generation_id
    AND reservation_status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.begin_two_am_generation(text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_two_am_generation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_two_am_generation_from_jobs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_two_am_generation(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_two_am_generation(uuid, integer) TO authenticated;

-- Replay the existing synchronization trigger for old 2AM jobs. This repairs
-- slideshow rows whose job results arrived before the trigger was deployed.
UPDATE public.jobs
SET progress = progress
WHERE settings ? 'two_am_generation_id';
