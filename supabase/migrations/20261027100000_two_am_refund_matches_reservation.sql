-- 2AM: a failed image gives back what was reserved for it, not a fixed 10 credits.
--
-- Both settle functions refunded (6 - completed) * 10, a leftover from when an
-- image cost 10 credits. A 2AM story now reserves 30 credits for its six images
-- (5 each), so every failed image gave back twice what it had cost: on 7 Oct 2026
-- one account was refunded 70 credits on two stories that had reserved 60.
--
-- Now: refund = the story's own reservation x failed images / 6, never more than
-- was reserved. Nothing else in the two functions changes. Balances are not
-- touched by this migration (the account above keeps the 35 extra credits).
--
-- Applied to the real project on 7 Oct 2026 (approved), as a single file.

create or replace function public.two_am_refund_for(p_reserved integer, p_completed integer)
returns integer language sql immutable as $$
  select least(greatest(coalesce(p_reserved, 0), 0),
               round(greatest(coalesce(p_reserved, 0), 0) * (6 - least(6, greatest(0, coalesce(p_completed, 0)))) / 6.0)::integer);
$$;

CREATE OR REPLACE FUNCTION public.settle_two_am_generation(p_generation_id uuid, p_completed_scenes integer)
 RETURNS two_am_generations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_generation public.two_am_generations;
  v_completed integer := LEAST(6, GREATEST(0, COALESCE(p_completed_scenes, 0)));
  v_refund integer;
BEGIN
  SELECT * INTO v_generation
  FROM public.two_am_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  v_refund := public.two_am_refund_for(v_generation.reserved_credits, v_completed);
  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_refund,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_refund)
    WHERE id = v_generation.user_id;
  END IF;

  UPDATE public.two_am_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_completed = 0 THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_completed = 6 THEN 'completed' WHEN v_completed = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_two_am_generation_from_jobs(p_generation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_generation public.two_am_generations;
  v_total integer;
  v_terminal integer;
  v_completed integer;
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

  -- Never settle a partially-created batch. The planner owns exactly six
  -- initial child jobs, and settlement happens only after all six stop.
  IF v_total <> 6 OR v_terminal <> 6 THEN
    RETURN;
  END IF;

  v_refund := public.two_am_refund_for(v_generation.reserved_credits, v_completed);

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
$function$;

revoke all on function public.two_am_refund_for(integer, integer) from public, anon, authenticated;
grant execute on function public.two_am_refund_for(integer, integer) to service_role;
