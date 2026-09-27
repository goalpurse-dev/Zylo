-- =============================================================================
-- Migration: 20260823020000_abandoned_checkout_processor_infra.sql
--
-- Phase 6/7 plumbing for the abandoned-checkout recovery sender.
--
-- Deliberately independent of the existing analytics/cleanup cron jobs,
-- which the live audit found are currently failing (analytics: null
-- URL/service-key settings; cleanup: missing vault secrets; annual topup:
-- invalid UUID input). This job gets its own vault secrets, its own trigger
-- function, and its own private-schema helper -- nothing here is read by or
-- shared with the existing (broken) jobs, and nothing here touches them.
--
-- IMPORTANT: this migration creates the plumbing but deliberately does NOT
-- call cron.schedule(...) to start the recurring run. Per the Phase 6 spec,
-- the schedule must only be enabled after: (1) a manual invocation returns
-- 2xx, (2) a controlled test checkout is processed correctly, and (3)
-- cron.job_run_details shows a successful row. The exact cron.schedule(...)
-- call to run once those checks pass is given separately (see deployment
-- notes), not embedded here, so a routine `supabase db push` can never
-- silently turn on production email sending.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE SCHEMA IF NOT EXISTS private;

-- ── Claim RPC (Phase 7) ──────────────────────────────────────────────────────
-- Atomically selects and claims up to p_limit due rows using
-- FOR UPDATE SKIP LOCKED, so two concurrent processor invocations can never
-- claim the same row. processing_started_at acts both as the claim marker
-- and, via the 5-minute staleness check, as a self-healing release in case a
-- worker dies mid-send without clearing it.
--
-- Scope is hard-limited to recovery_system_version = 'v2' -- the 1036
-- legacy rows (Phase 9) can never be selected by this function, regardless
-- of their status/recovery_stage, because they were never (and will never
-- be) written with version = 'v2'.
CREATE OR REPLACE FUNCTION public.claim_due_abandoned_checkouts(p_limit int DEFAULT 25)
RETURNS SETOF public.abandoned_checkouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.abandoned_checkouts ac
  SET processing_started_at = now()
  FROM (
    SELECT id FROM public.abandoned_checkouts
    WHERE recovery_system_version = 'v2'
      AND paid = false
      AND status IN ('pending', 'in_sequence', 'expired')
      AND recovery_stage < 3
      AND (processing_started_at IS NULL OR processing_started_at < now() - interval '5 minutes')
      AND (
        (recovery_stage = 0 AND created_at         <= now() - interval '10 minutes') OR
        (recovery_stage = 1 AND last_email_sent_at  <= now() - interval '2 hours')   OR
        (recovery_stage = 2 AND last_email_sent_at  <= now() - interval '20 hours')
      )
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) due
  WHERE ac.id = due.id
  RETURNING ac.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_abandoned_checkouts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_abandoned_checkouts(int) TO service_role;

-- Lets a worker release a claim without advancing state (used when the
-- global email cooldown blocks a send this cycle, so the row stays eligible
-- next cycle instead of being stuck "processing" for 5 minutes).
CREATE OR REPLACE FUNCTION public.release_abandoned_checkout_claim(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.abandoned_checkouts SET processing_started_at = NULL WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.release_abandoned_checkout_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_abandoned_checkout_claim(uuid) TO service_role;

-- ── Cron trigger function (Phase 6) ──────────────────────────────────────────
-- Reads its OWN vault secrets, set independently of every other cron job in
-- this project:
--   select vault.create_secret('<url>',    'abandoned_checkout_processor_url');
--   select vault.create_secret('<secret>', 'abandoned_checkout_processor_secret');
-- The <secret> value must match ABANDONED_CHECKOUT_CRON_SECRET set on the
-- edge function itself (see deployment notes) -- this is a static shared
-- secret the function checks in its own code, not Supabase JWT verification,
-- matching the pattern already used by cleanup-generation-references.
CREATE OR REPLACE FUNCTION private.trigger_abandoned_checkout_processor()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'abandoned_checkout_processor_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'abandoned_checkout_processor_secret' ORDER BY created_at DESC LIMIT 1;

  IF NULLIF(v_url, '') IS NULL OR NULLIF(v_secret, '') IS NULL THEN
    RAISE EXCEPTION 'ABANDONED_CHECKOUT_PROCESSOR_VAULT_SECRETS_MISSING';
  END IF;

  SELECT net.http_post(
    url     => v_url,
    headers => jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    => '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_abandoned_checkout_processor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.trigger_abandoned_checkout_processor() TO service_role;

-- NOTE: cron.schedule(...) is intentionally NOT called here.
-- See deployment notes for the exact statement to run manually once the
-- Phase 6 verification checklist has passed.
