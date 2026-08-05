-- The URL and authorization value are provisioned into Supabase Vault outside
-- source control. No service-role key or cron secret is stored in this file.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.trigger_generation_reference_cleanup()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=private,public,vault AS $$
DECLARE v_url text; v_secret text; v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name='generation_reference_cleanup_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name='generation_reference_cleanup_secret' ORDER BY created_at DESC LIMIT 1;
  IF NULLIF(v_url,'') IS NULL OR NULLIF(v_secret,'') IS NULL THEN
    RAISE EXCEPTION 'GENERATION_REFERENCE_CLEANUP_VAULT_SECRETS_MISSING';
  END IF;
  SELECT net.http_post(
    url=>v_url,
    headers=>jsonb_build_object('content-type','application/json','x-cleanup-secret',v_secret),
    body=>'{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_generation_reference_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.trigger_generation_reference_cleanup() TO service_role;

DO $$
DECLARE v_existing bigint;
BEGIN
  SELECT jobid INTO v_existing FROM cron.job WHERE jobname='generation-reference-cleanup-daily';
  IF v_existing IS NOT NULL THEN PERFORM cron.unschedule(v_existing); END IF;
  PERFORM cron.schedule(
    'generation-reference-cleanup-daily',
    '17 3 * * *',
    'select private.trigger_generation_reference_cleanup();'
  );
END;
$$;
