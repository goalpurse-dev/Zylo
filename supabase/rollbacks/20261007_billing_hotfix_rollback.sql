-- Rollback for:
--   20261007110000_billing_rpc_lockdown_and_jobs_write_guard.sql
--   20261007120000_tool_prices_and_fruit_story_guards.sql
-- (20261007100000 only re-states the live cooking trigger verbatim, so it has
-- nothing to roll back.)
--
-- Restores the exact pre-hotfix state recorded from production on
-- 2026-09-26, INCLUDING the insecure grants. Run the sections independently
-- if only one part needs reverting:
--   psql / supabase db query --linked -f supabase/rollbacks/20261007_billing_hotfix_rollback.sql
--
-- WARNING: section B re-opens the deduct_credits / RPC holes. Prefer fixing
-- forward unless the hotfix itself is breaking production.

BEGIN;

/* ─── A. Fruit pricing + rate limiting (20261007120000) ───────────────── */

SELECT cron.unschedule('edge-rate-limit-cleanup-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'edge-rate-limit-cleanup-daily');

DROP TRIGGER IF EXISTS jobs_enforce_tool_pricing ON public.jobs;
DROP FUNCTION IF EXISTS public.enforce_tool_job_pricing();
DROP FUNCTION IF EXISTS public.compute_tool_price(text, jsonb);
DROP TABLE IF EXISTS public.tool_prices;
DROP FUNCTION IF EXISTS public.consume_rate_limit(uuid, text, integer, integer);
DROP TABLE IF EXISTS public.edge_rate_limit_events;

/* ─── B. Platform lockdown (20261007110000) ───────────────────────────── */

DROP TRIGGER IF EXISTS zzz_jobs_guard_client_writes ON public.jobs;
DROP FUNCTION IF EXISTS public.guard_client_job_writes();

-- Original deduct_credits (as live before the hotfix).
CREATE OR REPLACE FUNCTION public.deduct_credits(uid uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET
    credit_balance      = credit_balance - amount,
    credits_spent_today = credits_spent_today + amount
  WHERE id = uid
    AND credit_balance >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;
END;
$function$;

-- Pre-hotfix ACLs: anon + authenticated had EXECUTE on all of these ...
GRANT EXECUTE ON FUNCTION
  public.app_charge_job(uuid,uuid,text,text,integer),
  public.bump_job_progress(uuid,integer),
  public.charge_job_credits(uuid),
  public.claim_job(uuid),
  public.complete_generation_job(uuid,text,jsonb,text),
  public.complete_job(uuid,text,jsonb),
  public.fail_job(uuid,text),
  public.finish_job_failed(uuid,text),
  public.finish_job_success(uuid,text,jsonb),
  public.heartbeat_generation_job(uuid,text,integer),
  public.mark_generation_reconciliation_required(uuid,text),
  public.mark_provider_submitting(uuid,text),
  public.record_provider_submission(uuid,text,text),
  public.refund_job_credits(uuid),
  public.replace_provider_submission_for_retry(uuid,text,text),
  public.reserve_provider_submission(uuid,text,text),
  public.set_job_output(uuid,jsonb),
  public.spend_after_launch(uuid,uuid,text,text,text,integer),
  public.spend_after_launch(uuid,uuid,text,text,text,integer,integer),
  public.spend_on_success(uuid,text,text,integer),
  public.try_reserve_launch(uuid)
TO anon, authenticated;

-- ... and PUBLIC had EXECUTE on this subset.
GRANT EXECUTE ON FUNCTION
  public.app_charge_job(uuid,uuid,text,text,integer),
  public.bump_job_progress(uuid,integer),
  public.claim_job(uuid),
  public.complete_job(uuid,text,jsonb),
  public.fail_job(uuid,text),
  public.finish_job_failed(uuid,text),
  public.finish_job_success(uuid,text,jsonb),
  public.set_job_output(uuid,jsonb),
  public.spend_after_launch(uuid,uuid,text,text,text,integer),
  public.spend_after_launch(uuid,uuid,text,text,text,integer,integer),
  public.spend_on_success(uuid,text,text,integer),
  public.try_reserve_launch(uuid)
TO PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- After running, also remove the versions from migration history:
--   npx supabase migration repair --status reverted 20261007110000 20261007120000 --linked
