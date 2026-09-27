-- Objective visual failures must stop before animation while preserving the
-- one-provider-image-per-scene contract. A visible manual retry is the only
-- way to purchase a replacement image.
CREATE OR REPLACE FUNCTION public.record_thirty_days_scene_qa(
  p_generation_id uuid,
  p_scene_index integer,
  p_job_id uuid,
  p_usable boolean,
  p_reason text
)
RETURNS public.thirty_days_generation_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset public.thirty_days_generation_assets;
  v_attempts integer;
  v_hard_failure boolean := NOT p_usable AND COALESCE(p_reason, '') LIKE 'hard_qa:%';
BEGIN
  SELECT asset.* INTO v_asset
  FROM public.thirty_days_generation_assets AS asset
  WHERE asset.generation_id = p_generation_id
    AND asset.asset_key = 'scene:' || p_scene_index || ':image'
    AND asset.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR auth.uid() IS NULL THEN RAISE EXCEPTION 'CREATION_ACCESS_DENIED'; END IF;
  IF v_asset.job_id <> p_job_id THEN RAISE EXCEPTION 'QA_JOB_MISMATCH'; END IF;
  IF v_asset.status <> 'succeeded' THEN RAISE EXCEPTION 'QA_JOB_NOT_SUCCEEDED'; END IF;

  v_attempts := CASE WHEN v_hard_failure THEN 2 ELSE LEAST(2, v_asset.qa_attempts + 1) END;
  UPDATE public.thirty_days_generation_assets
  SET qa_attempts = v_attempts,
      qa_status = CASE
        WHEN p_usable AND p_reason = 'qa_unavailable' THEN 'unavailable'
        WHEN p_usable THEN 'passed'
        ELSE 'failed'
      END,
      status = CASE WHEN p_usable THEN 'succeeded' WHEN v_hard_failure OR v_attempts >= 2 THEN 'failed' ELSE 'retrying' END,
      error = CASE WHEN p_usable THEN NULL ELSE left(COALESCE(NULLIF(p_reason, ''), 'qa_failed'), 500) END
  WHERE id = v_asset.id
  RETURNING * INTO v_asset;

  RETURN v_asset;
END;
$$;

REVOKE ALL ON FUNCTION public.record_thirty_days_scene_qa(uuid, integer, uuid, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_thirty_days_scene_qa(uuid, integer, uuid, boolean, text)
  TO authenticated;
