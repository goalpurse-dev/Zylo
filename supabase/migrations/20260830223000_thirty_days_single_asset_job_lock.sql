-- Prevent the browser runner and the stale-generation background runner from
-- dispatching two provider jobs for the same reserved asset. A worker retry
-- for the SAME job remains idempotent; an explicit user retry first clears
-- asset.job_id in the existing reopen RPCs.
CREATE OR REPLACE FUNCTION public.authorize_thirty_days_asset_job(
  p_generation_id uuid,
  p_asset_key text,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset public.thirty_days_generation_assets;
  v_job public.jobs;
  v_current_job public.jobs;
  v_generation public.thirty_days_generations;
  v_tier public.thirty_days_quality_tiers;
BEGIN
  SELECT * INTO v_asset
  FROM public.thirty_days_generation_assets
  WHERE generation_id = p_generation_id AND asset_key = p_asset_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSET_RESERVATION_NOT_FOUND'; END IF;

  SELECT * INTO v_generation
  FROM public.thirty_days_generations
  WHERE id = p_generation_id;
  IF NOT FOUND OR v_generation.reservation_status <> 'reserved' THEN
    RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE';
  END IF;

  SELECT * INTO v_tier
  FROM public.thirty_days_quality_tiers
  WHERE quality_tier = v_generation.quality_tier;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRICING_NOT_CONFIGURED'; END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND
    OR v_job.user_id <> v_asset.user_id
    OR v_job.tool_key <> v_asset.tool_key
    OR COALESCE(v_job.charge_credits, -1) <> 0
    OR (v_asset.asset_type = 'scene_video' AND v_job.type <> 'video')
    OR (v_asset.asset_type <> 'scene_video' AND v_job.type <> 'image')
    OR v_job.input #>> '{billing_reservation,template}' <> 'thirty-days'
    OR v_job.input #>> '{billing_reservation,generationId}' <> p_generation_id::text
    OR v_job.input #>> '{billing_reservation,assetKey}' <> p_asset_key
    OR (
      v_asset.asset_type = 'scene_video' AND (
        COALESCE((v_job.input->>'width')::integer, -1) <> v_tier.video_width
        OR COALESCE((v_job.input->>'height')::integer, -1) <> v_tier.video_height
        OR COALESCE((v_job.input->>'durationSec')::integer, -1) <> v_tier.video_duration_seconds
        OR COALESCE((v_job.input->>'withSound')::boolean, true) <> v_tier.with_sound
      )
    )
  THEN
    RAISE EXCEPTION 'INVALID_RESERVED_JOB';
  END IF;

  IF v_asset.status = 'succeeded' AND v_asset.qa_status IN ('passed', 'unavailable') THEN
    RAISE EXCEPTION 'ASSET_ALREADY_COMPLETED';
  END IF;

  IF v_asset.job_id IS NOT NULL AND v_asset.job_id <> p_job_id THEN
    SELECT * INTO v_current_job FROM public.jobs WHERE id = v_asset.job_id;
    IF FOUND AND v_current_job.status IN ('queued', 'running', 'processing', 'succeeded') THEN
      RAISE EXCEPTION 'ASSET_JOB_ALREADY_ACTIVE';
    END IF;
  END IF;

  UPDATE public.thirty_days_generation_assets
  SET job_id = p_job_id,
      status = CASE v_job.status
        WHEN 'succeeded' THEN 'succeeded'
        WHEN 'failed' THEN 'failed'
        WHEN 'canceled' THEN 'canceled'
        WHEN 'queued' THEN 'queued'
        ELSE 'running'
      END,
      result_url = v_job.result_url,
      error = v_job.error
  WHERE id = v_asset.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid) TO service_role;
