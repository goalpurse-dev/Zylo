-- Keep 2AM generation rows in sync with their six child jobs even when the
-- browser closes, realtime disconnects, or a terminal event is missed.

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

  v_refund := (6 - LEAST(6, GREATEST(0, v_completed))) * 10;

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

CREATE OR REPLACE FUNCTION public.sync_two_am_generation_job_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation_id uuid;
  v_scene_status text;
BEGIN
  IF COALESCE(NEW.settings->>'two_am_generation_id', '') = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_generation_id := (NEW.settings->>'two_am_generation_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;

  v_scene_status := CASE
    WHEN NEW.status = 'succeeded' AND NEW.result_url IS NOT NULL THEN 'completed'
    WHEN NEW.status IN ('failed', 'canceled') THEN 'failed'
    WHEN NEW.status = 'queued' THEN 'queued'
    ELSE 'generating'
  END;

  UPDATE public.two_am_generations AS generation
  SET scenes = COALESCE((
        SELECT jsonb_agg(
          CASE
            WHEN scene->>'jobId' = NEW.id::text THEN
              scene || jsonb_build_object(
                'status', v_scene_status,
                'progress', CASE
                  WHEN NEW.status IN ('succeeded', 'failed', 'canceled') THEN 100
                  ELSE LEAST(99, GREATEST(0, COALESCE(NEW.progress, 0)))
                END,
                'imageUrl', CASE
                  WHEN NEW.status = 'succeeded' AND NEW.result_url IS NOT NULL
                    THEN to_jsonb(NEW.result_url)
                  ELSE scene->'imageUrl'
                END,
                'error', CASE
                  WHEN NEW.status IN ('failed', 'canceled')
                    THEN to_jsonb(COALESCE(NEW.error, 'Scene generation failed'))
                  ELSE 'null'::jsonb
                END
              )
            ELSE scene
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(generation.scenes) WITH ORDINALITY AS items(scene, ordinality)
      ), generation.scenes),
      status = CASE
        WHEN generation.status IN ('completed', 'partial', 'failed') THEN generation.status
        ELSE 'generating'
      END
  WHERE generation.id = v_generation_id;

  IF NEW.status IN ('succeeded', 'failed', 'canceled') THEN
    PERFORM public.finalize_two_am_generation_from_jobs(v_generation_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_two_am_generation_on_job_update ON public.jobs;
CREATE TRIGGER sync_two_am_generation_on_job_update
  AFTER UPDATE OF status, progress, result_url, error ON public.jobs
  FOR EACH ROW
  WHEN (NEW.settings ? 'two_am_generation_id')
  EXECUTE FUNCTION public.sync_two_am_generation_job_result();

REVOKE ALL ON FUNCTION public.finalize_two_am_generation_from_jobs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_two_am_generation_job_result() FROM PUBLIC;
