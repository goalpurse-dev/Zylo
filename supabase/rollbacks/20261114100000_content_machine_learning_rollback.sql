-- Rollback of 20261114100000_content_machine_learning.sql (drops the analyses and the playbook).
BEGIN;
CREATE OR REPLACE FUNCTION private.trigger_content_machine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE s public.cm_settings%ROWTYPE; secret text; worker_url text; local_now timestamp; due boolean;
BEGIN
  SELECT * INTO s FROM public.cm_settings WHERE id;
  IF NOT FOUND OR s.kill_switch THEN RETURN; END IF;
  local_now := now() AT TIME ZONE s.timezone;
  due := EXISTS (SELECT 1 FROM public.cm_jobs WHERE (status = 'queued' AND run_after <= now()) OR (status = 'running' AND locked_until < now()))
      OR (s.daily_auto_run AND s.slideshows_per_day > 0 AND to_char(local_now, 'HH24:MI') >= s.run_time_local
          AND NOT EXISTS (SELECT 1 FROM public.cm_runs WHERE kind = 'daily' AND run_date = local_now::date));
  IF NOT due THEN RETURN; END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cm_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'cm_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cm-worker-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 5000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_content_machine() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_content_machine() TO service_role;
DROP INDEX IF EXISTS public.cm_scout_reports_created;
ALTER TABLE public.cm_scout_reports DROP COLUMN IF EXISTS cost_usd;
ALTER TABLE public.cm_scout_reports DROP COLUMN IF EXISTS report;
DELETE FROM public.cm_scout_reports WHERE run_id IS NULL;
ALTER TABLE public.cm_scout_reports ALTER COLUMN run_id SET NOT NULL;
DROP TABLE IF EXISTS public.cm_analyses;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS daily_scout;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS analysis_suggest_after;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS winner_min_successes;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS half_life_days;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS playbook_updated_at;
ALTER TABLE public.cm_settings DROP COLUMN IF EXISTS playbook;
COMMIT;
