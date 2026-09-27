-- settle_thirty_days_generation's resync step deliberately excludes any
-- asset where qa_status='failed' AND qa_attempts>=2 from being overwritten
-- by a stray later job status (so a QA-exhausted scene can never get
-- silently resurrected as "succeeded" just because its last bound job
-- happened to complete). But excluding it from the resync entirely also
-- means nothing ever explicitly moves its `status` column to 'failed' if it
-- was still 'running'/'queued' at the moment QA exhaustion was recorded — it
-- can get stuck there forever, which then trips settle's own
-- ASSETS_NOT_TERMINAL guard and blocks the whole generation from ever
-- completing. Fix: still resync these assets, but force them to 'failed'
-- regardless of what the bound job's raw status says.
CREATE OR REPLACE FUNCTION public.settle_thirty_days_generation(p_generation_id uuid)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_changed integer := 1;
  v_nonterminal integer;
  v_succeeded integer;
  v_total integer;
  v_refund integer;
  v_refund_delta integer;
BEGIN
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  UPDATE public.thirty_days_generation_assets AS asset
  SET status = CASE
        WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2 THEN 'failed'
        ELSE (CASE job.status WHEN 'succeeded' THEN 'succeeded' WHEN 'failed' THEN 'failed'
          WHEN 'canceled' THEN 'canceled' WHEN 'queued' THEN 'queued' ELSE 'running' END)
      END,
      result_url = CASE WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2 THEN NULL ELSE job.result_url END,
      error = CASE WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2
        THEN COALESCE(NULLIF(asset.error, ''), 'Scene failed visual QA twice') ELSE job.error END
  FROM public.jobs AS job
  WHERE asset.generation_id = p_generation_id AND asset.job_id = job.id;
  WHILE v_changed > 0 LOOP
    UPDATE public.thirty_days_generation_assets AS dependent
    SET status = 'failed', error = 'dependency_failed'
    WHERE dependent.generation_id = p_generation_id
      AND dependent.status IN ('planned', 'queued', 'retrying')
      AND EXISTS (SELECT 1 FROM public.thirty_days_generation_assets AS dependency
        WHERE dependency.generation_id = dependent.generation_id
          AND dependency.asset_key = ANY(dependent.dependency_keys)
          AND dependency.status IN ('failed', 'canceled'));
    GET DIAGNOSTICS v_changed = ROW_COUNT;
  END LOOP;
  SELECT count(*), count(*) FILTER (WHERE status = 'succeeded'),
    count(*) FILTER (WHERE status NOT IN ('succeeded','failed','canceled')),
    COALESCE(sum(cost_credits) FILTER (WHERE status IN ('failed','canceled')), 0)
  INTO v_total, v_succeeded, v_nonterminal, v_refund
  FROM public.thirty_days_generation_assets WHERE generation_id = p_generation_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'GENERATION_ASSETS_MISSING'; END IF;
  IF v_nonterminal > 0 THEN RAISE EXCEPTION 'ASSETS_NOT_TERMINAL'; END IF;

  v_refund_delta := v_refund - v_generation.refunded_credits;
  IF v_refund_delta > 0 THEN
    UPDATE public.profiles SET credit_balance = credit_balance + v_refund_delta,
      credits_spent_today = GREATEST(0, COALESCE(credits_spent_today,0) - v_refund_delta)
    WHERE id = v_generation.user_id;
  END IF;
  INSERT INTO public.thirty_days_credit_ledger (generation_id,user_id,operation,credits)
  VALUES (p_generation_id,v_generation.user_id,'refund',v_refund)
  ON CONFLICT (generation_id,operation) DO UPDATE SET credits = EXCLUDED.credits;
  UPDATE public.thirty_days_generation_assets SET refunded_credits = CASE
    WHEN status IN ('failed','canceled') THEN cost_credits ELSE 0 END
  WHERE generation_id = p_generation_id;
  UPDATE public.thirty_days_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_refund = reserved_credits THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_succeeded = v_total THEN 'voiceover' WHEN v_succeeded = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id RETURNING * INTO v_generation;
  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_thirty_days_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_thirty_days_generation(uuid) TO authenticated;

-- Same fix applied to the service-role twin used by the background advancer.
CREATE OR REPLACE FUNCTION public.service_settle_thirty_days_generation(p_generation_id uuid)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_changed integer := 1;
  v_nonterminal integer;
  v_succeeded integer;
  v_total integer;
  v_refund integer;
  v_refund_delta integer;
BEGIN
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  UPDATE public.thirty_days_generation_assets AS asset
  SET status = CASE
        WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2 THEN 'failed'
        ELSE (CASE job.status WHEN 'succeeded' THEN 'succeeded' WHEN 'failed' THEN 'failed'
          WHEN 'canceled' THEN 'canceled' WHEN 'queued' THEN 'queued' ELSE 'running' END)
      END,
      result_url = CASE WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2 THEN NULL ELSE job.result_url END,
      error = CASE WHEN asset.qa_status = 'failed' AND asset.qa_attempts >= 2
        THEN COALESCE(NULLIF(asset.error, ''), 'Scene failed visual QA twice') ELSE job.error END
  FROM public.jobs AS job
  WHERE asset.generation_id = p_generation_id AND asset.job_id = job.id;
  WHILE v_changed > 0 LOOP
    UPDATE public.thirty_days_generation_assets AS dependent
    SET status = 'failed', error = 'dependency_failed'
    WHERE dependent.generation_id = p_generation_id
      AND dependent.status IN ('planned', 'queued', 'retrying')
      AND EXISTS (SELECT 1 FROM public.thirty_days_generation_assets AS dependency
        WHERE dependency.generation_id = dependent.generation_id
          AND dependency.asset_key = ANY(dependent.dependency_keys)
          AND dependency.status IN ('failed', 'canceled'));
    GET DIAGNOSTICS v_changed = ROW_COUNT;
  END LOOP;
  SELECT count(*), count(*) FILTER (WHERE status = 'succeeded'),
    count(*) FILTER (WHERE status NOT IN ('succeeded','failed','canceled')),
    COALESCE(sum(cost_credits) FILTER (WHERE status IN ('failed','canceled')), 0)
  INTO v_total, v_succeeded, v_nonterminal, v_refund
  FROM public.thirty_days_generation_assets WHERE generation_id = p_generation_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'GENERATION_ASSETS_MISSING'; END IF;
  IF v_nonterminal > 0 THEN RAISE EXCEPTION 'ASSETS_NOT_TERMINAL'; END IF;

  v_refund_delta := v_refund - v_generation.refunded_credits;
  IF v_refund_delta > 0 THEN
    UPDATE public.profiles SET credit_balance = credit_balance + v_refund_delta,
      credits_spent_today = GREATEST(0, COALESCE(credits_spent_today,0) - v_refund_delta)
    WHERE id = v_generation.user_id;
  END IF;
  INSERT INTO public.thirty_days_credit_ledger (generation_id,user_id,operation,credits)
  VALUES (p_generation_id,v_generation.user_id,'refund',v_refund)
  ON CONFLICT (generation_id,operation) DO UPDATE SET credits = EXCLUDED.credits;
  UPDATE public.thirty_days_generation_assets SET refunded_credits = CASE
    WHEN status IN ('failed','canceled') THEN cost_credits ELSE 0 END
  WHERE generation_id = p_generation_id;
  UPDATE public.thirty_days_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_refund = reserved_credits THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_succeeded = v_total THEN 'voiceover' WHEN v_succeeded = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id RETURNING * INTO v_generation;
  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.service_settle_thirty_days_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(uuid) TO service_role;
