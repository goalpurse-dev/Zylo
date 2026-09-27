-- Reference-image assets had no reopen path analogous to
-- reopen_thirty_days_series_video_retry. Once the references phase settles
-- (reservation_status leaves 'reserved' — e.g. right before
-- SETUP_REFERENCES_INCOMPLETE fires, or after an episode's reference batch
-- settles), authorize_thirty_days_asset_job permanently 403s any new job
-- against that generation, including a manual reference retry. This mirrors
-- the video retry's one-time reopened-slot billing so a failed persistent
-- reference (setup or episode) can actually be retried.
CREATE OR REPLACE FUNCTION public.reopen_thirty_days_reference_retry(
  p_generation_id uuid,
  p_reference_id text
)
RETURNS public.thirty_days_generation_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_asset public.thirty_days_generation_assets;
BEGIN
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
    AND generation_mode IN ('series_setup', 'series_episode')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;

  SELECT * INTO v_asset FROM public.thirty_days_generation_assets
  WHERE generation_id = p_generation_id
    AND asset_key = 'reference:' || p_reference_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_NOT_FOUND'; END IF;
  IF v_asset.status NOT IN ('failed', 'canceled') OR v_asset.refunded_credits <> v_asset.cost_credits THEN
    RAISE EXCEPTION 'ASSET_NOT_REFUNDED';
  END IF;
  IF v_asset.retry_count >= 1 THEN RAISE EXCEPTION 'SERIES_RETRY_LIMIT_REACHED'; END IF;

  PERFORM public.deduct_credits(v_generation.user_id, v_asset.cost_credits);
  INSERT INTO public.thirty_days_series_retry_ledger (generation_id, asset_id, user_id, credits)
  VALUES (p_generation_id, v_asset.id, v_generation.user_id, v_asset.cost_credits);
  UPDATE public.thirty_days_generations
  SET reservation_status = 'reserved',
      refunded_credits = GREATEST(0, refunded_credits - v_asset.cost_credits),
      status = CASE WHEN generation_mode = 'series_setup' THEN 'references' ELSE 'scenes' END
  WHERE id = p_generation_id;
  UPDATE public.thirty_days_generation_assets
  SET retry_count = retry_count + 1, refunded_credits = 0, job_id = NULL,
      status = 'retrying', result_url = NULL, error = NULL
  WHERE id = v_asset.id RETURNING * INTO v_asset;
  RETURN v_asset;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_thirty_days_reference_retry(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_thirty_days_reference_retry(uuid, text) TO authenticated;
