-- Captures the live-only jobs_enforce_cooking_pricing trigger so the repo
-- matches production. This function/trigger existed in the live database
-- (referenced in 20260824000000's comment) but was never committed to a
-- migration. Definition copied verbatim from pg_get_functiondef /
-- pg_get_triggerdef on 2026-09-26 — applying this is a no-op on production.
--
-- Note: despite the name, it prices every image:fruit-v2 and
-- video:seedance15pro job for ALL tools (Fruit, Clay Rescue, Face ASMR,
-- Micro Camera, Footballer, Cooking Matic, Video Generator, ...).

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.enforce_cooking_job_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits integer;
  v_duration numeric;
  v_with_sound boolean;
BEGIN
  IF NEW.tool_key = 'image:fruit-v2' THEN
    v_credits := 2;
  ELSIF NEW.tool_key = 'video:seedance15pro' THEN
    v_duration := GREATEST(1, COALESCE((NEW.input->>'durationSec')::numeric, 6));
    v_with_sound := COALESCE((NEW.input->>'withSound')::boolean, false);
    v_credits := CEIL(v_duration * CASE WHEN v_with_sound THEN 5.25 ELSE 2.5 END)::integer;
  ELSE
    RETURN NEW;
  END IF;

  NEW.charge_credits := v_credits;
  NEW.settings := jsonb_set(COALESCE(NEW.settings, '{}'::jsonb), '{credits}', to_jsonb(v_credits), true);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS jobs_enforce_cooking_pricing ON public.jobs;
CREATE TRIGGER jobs_enforce_cooking_pricing
  BEFORE INSERT OR UPDATE OF charge_credits, settings, input, tool_key ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cooking_job_pricing();

COMMIT;
