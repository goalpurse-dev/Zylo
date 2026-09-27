-- A provider can finish after a browser is suspended.  The durable job and
-- reserved asset already exist in that case; this repair reconnects them to
-- the JSON generation payload the UI reads.  It never creates another job.

CREATE OR REPLACE FUNCTION private.recover_thirty_days_generation_assets(
  p_generation_id uuid,
  p_expected_user_id uuid DEFAULT NULL
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_references jsonb;
BEGIN
  SELECT * INTO v_generation
  FROM public.thirty_days_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GENERATION_NOT_FOUND';
  END IF;
  IF p_expected_user_id IS NOT NULL AND v_generation.user_id <> p_expected_user_id THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  -- The client creates a job before it starts polling it. If a device sleeps
  -- between those two operations, claim the matching reserved job by its
  -- immutable billing reservation instead of submitting a duplicate.
  WITH candidates AS (
    SELECT DISTINCT ON (asset.id)
      asset.id AS asset_id,
      job.id AS job_id,
      job.status AS job_status,
      job.result_url,
      job.error
    FROM public.thirty_days_generation_assets AS asset
    JOIN public.jobs AS job
      ON job.user_id = asset.user_id
     AND job.input #>> '{billing_reservation,template}' = 'thirty-days'
     AND job.input #>> '{billing_reservation,generationId}' = p_generation_id::text
     AND job.input #>> '{billing_reservation,assetKey}' = asset.asset_key
    WHERE asset.generation_id = p_generation_id
      AND asset.job_id IS NULL
    ORDER BY asset.id,
      CASE WHEN job.status = 'succeeded' AND NULLIF(job.result_url, '') IS NOT NULL THEN 0 ELSE 1 END,
      job.created_at DESC
  )
  UPDATE public.thirty_days_generation_assets AS asset
  SET job_id = candidate.job_id,
      status = CASE candidate.job_status
        WHEN 'succeeded' THEN 'succeeded'
        WHEN 'failed' THEN 'failed'
        WHEN 'canceled' THEN 'canceled'
        WHEN 'queued' THEN 'queued'
        ELSE 'running'
      END,
      result_url = candidate.result_url,
      error = candidate.error
  FROM candidates AS candidate
  WHERE asset.id = candidate.asset_id;

  -- Refresh every already-bound asset as well. This is what turns a provider
  -- success into a visible image after a tab/laptop interruption.
  UPDATE public.thirty_days_generation_assets AS asset
  SET status = CASE job.status
        WHEN 'succeeded' THEN 'succeeded'
        WHEN 'failed' THEN 'failed'
        WHEN 'canceled' THEN 'canceled'
        WHEN 'queued' THEN 'queued'
        ELSE 'running'
      END,
      result_url = job.result_url,
      error = job.error
  FROM public.jobs AS job
  WHERE asset.generation_id = p_generation_id
    AND asset.job_id = job.id
    AND NOT (asset.qa_status = 'failed' AND asset.qa_attempts >= 2);

  -- The generation JSON is a display/progress projection of the durable
  -- assets. Rehydrate it in its existing order, preserving the planner's
  -- labels and visual locks while replacing only runtime fields.
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN asset.id IS NULL THEN ref.value
      WHEN asset.status = 'succeeded' AND NULLIF(asset.result_url, '') IS NOT NULL THEN
        (ref.value - 'error' - 'imageUrl' - 'jobId' - 'status' - 'progress') ||
        jsonb_build_object(
          'jobId', asset.job_id,
          'status', 'succeeded',
          'progress', 100,
          'imageUrl', asset.result_url
        )
      WHEN asset.status IN ('queued', 'running', 'retrying') THEN
        (ref.value - 'error' - 'jobId' - 'status') ||
        jsonb_build_object(
          'jobId', asset.job_id,
          'status', asset.status
        )
      WHEN asset.status IN ('failed', 'canceled') THEN
        (ref.value - 'jobId' - 'status' - 'error') ||
        jsonb_build_object(
          'jobId', asset.job_id,
          'status', 'failed',
          'error', COALESCE(NULLIF(asset.error, ''), 'Reference generation failed')
        )
      ELSE ref.value
    END
    ORDER BY ref.ordinality
  ), '[]'::jsonb)
  INTO v_references
  FROM jsonb_array_elements(COALESCE(v_generation.visual_references, '[]'::jsonb))
       WITH ORDINALITY AS ref(value, ordinality)
  LEFT JOIN public.thirty_days_generation_assets AS asset
    ON asset.generation_id = p_generation_id
   AND asset.asset_key = 'reference:' || (ref.value->>'id');

  UPDATE public.thirty_days_generations
  SET visual_references = v_references,
      updated_at = now()
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_thirty_days_generation(p_generation_id uuid)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN private.recover_thirty_days_generation_assets(p_generation_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.service_recover_thirty_days_generation(p_generation_id uuid)
RETURNS public.thirty_days_generations
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.recover_thirty_days_generation_assets(p_generation_id, NULL);
$$;

REVOKE ALL ON FUNCTION public.recover_thirty_days_generation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recover_thirty_days_generation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.service_recover_thirty_days_generation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_recover_thirty_days_generation(uuid) TO service_role;
