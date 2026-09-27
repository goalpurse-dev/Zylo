-- Only scene VIDEOS had a reopen-and-retry path (reopen_thirty_days_series_video_retry).
-- A scene whose IMAGE fails visual QA twice had no way back at all: no retry
-- button existed client-side, and even if one were added, there was no RPC
-- to reopen its (now-settled/refunded) reservation slot. Since the video
-- asset depends on the image, both must be reopened together — the video's
-- own reservation was already refunded via settle's dependency cascade
-- (dependency_failed) the moment the image was marked failed.
CREATE OR REPLACE FUNCTION public.reopen_thirty_days_series_image_retry(
  p_generation_id uuid,
  p_scene_index integer
)
RETURNS public.thirty_days_generation_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_image_asset public.thirty_days_generation_assets;
  v_video_asset public.thirty_days_generation_assets;
  v_recharge integer := 0;
BEGIN
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
    AND generation_mode = 'series_episode'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;

  SELECT * INTO v_image_asset FROM public.thirty_days_generation_assets
  WHERE generation_id = p_generation_id AND asset_key = 'scene:' || p_scene_index || ':image'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_NOT_FOUND'; END IF;
  IF v_image_asset.status NOT IN ('failed', 'canceled') OR v_image_asset.refunded_credits <> v_image_asset.cost_credits THEN
    RAISE EXCEPTION 'ASSET_NOT_REFUNDED';
  END IF;
  IF v_image_asset.retry_count >= 1 THEN RAISE EXCEPTION 'SERIES_RETRY_LIMIT_REACHED'; END IF;

  SELECT * INTO v_video_asset FROM public.thirty_days_generation_assets
  WHERE generation_id = p_generation_id AND asset_key = 'scene:' || p_scene_index || ':video'
  FOR UPDATE;

  v_recharge := v_image_asset.cost_credits;
  IF FOUND AND v_video_asset.refunded_credits = v_video_asset.cost_credits THEN
    v_recharge := v_recharge + v_video_asset.cost_credits;
  END IF;

  PERFORM public.deduct_credits(v_generation.user_id, v_recharge);
  INSERT INTO public.thirty_days_series_retry_ledger (generation_id, asset_id, user_id, credits)
  VALUES (p_generation_id, v_image_asset.id, v_generation.user_id, v_image_asset.cost_credits)
  ON CONFLICT (asset_id) DO NOTHING;
  UPDATE public.thirty_days_generations
  SET reservation_status = 'reserved',
      refunded_credits = GREATEST(0, refunded_credits - v_recharge),
      status = 'scenes'
  WHERE id = p_generation_id;
  UPDATE public.thirty_days_generation_assets
  SET retry_count = retry_count + 1, refunded_credits = 0, job_id = NULL,
      status = 'retrying', result_url = NULL, error = NULL
  WHERE id = v_image_asset.id RETURNING * INTO v_image_asset;
  IF v_video_asset.id IS NOT NULL THEN
    UPDATE public.thirty_days_generation_assets
    SET refunded_credits = 0, job_id = NULL, status = 'planned', result_url = NULL, error = NULL
    WHERE id = v_video_asset.id;
  END IF;
  UPDATE public.thirty_days_series_episodes SET status = 'generating'
  WHERE id = v_generation.series_episode_id;
  RETURN v_image_asset;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_thirty_days_series_image_retry(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_thirty_days_series_image_retry(uuid, integer) TO authenticated;
