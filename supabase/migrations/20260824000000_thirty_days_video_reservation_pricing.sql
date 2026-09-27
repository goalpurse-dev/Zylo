-- Keep prepaid 30 Days video children at zero charge without changing the
-- shared Cooking Matic pricing function. PostgreSQL runs same-event triggers
-- in name order, so this narrowly scoped trigger runs after
-- jobs_enforce_cooking_pricing and restores the reservation-backed price.
CREATE OR REPLACE FUNCTION public.restore_thirty_days_reserved_job_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation_id uuid;
  v_asset_key text;
BEGIN
  IF NEW.input #>> '{billing_reservation,template}' <> 'thirty-days' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_generation_id := (NEW.input #>> '{billing_reservation,generationId}')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;
  v_asset_key := NEW.input #>> '{billing_reservation,assetKey}';

  -- Do not grant zero pricing from client metadata alone. All immutable
  -- reservation fields must already match trusted generation/asset rows.
  IF (SELECT auth.uid()) = NEW.user_id AND EXISTS (
    SELECT 1
    FROM public.thirty_days_generation_assets AS asset
    JOIN public.thirty_days_generations AS generation
      ON generation.id = asset.generation_id
    WHERE asset.generation_id = v_generation_id
      AND asset.asset_key = v_asset_key
      AND asset.user_id = NEW.user_id
      AND generation.user_id = NEW.user_id
      AND generation.reservation_status = 'reserved'
      AND asset.tool_key = NEW.tool_key
      AND (
        (asset.asset_type = 'scene_video' AND NEW.type = 'video') OR
        (asset.asset_type <> 'scene_video' AND NEW.type = 'image')
      )
  ) THEN
    NEW.charge_credits := 0;
    NEW.settings := jsonb_set(
      COALESCE(NEW.settings, '{}'::jsonb),
      '{credits}',
      '0'::jsonb,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_jobs_restore_thirty_days_reserved_pricing ON public.jobs;
CREATE TRIGGER zz_jobs_restore_thirty_days_reserved_pricing
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.restore_thirty_days_reserved_job_pricing();

REVOKE ALL ON FUNCTION public.restore_thirty_days_reserved_job_pricing() FROM PUBLIC;
