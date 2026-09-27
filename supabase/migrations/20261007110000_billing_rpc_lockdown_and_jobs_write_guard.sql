-- Platform-wide billing hotfix (all tools).
--
-- 1. deduct_credits: callable by anon/authenticated with any uid and any
--    amount (including negative, which ADDS credits). Browser callers may now
--    only spend a non-negative amount from their own account. Server callers
--    (service_role, postgres, cron) keep the original behaviour, including
--    the negative "refund" calls made by the Long Form edge functions.
-- 2. Service-only job/billing RPCs were executable by anon/authenticated
--    (e.g. refund_job_credits, complete_generation_job, charge_job_credits).
--    No browser code calls them; revoke so only service_role can.
-- 3. jobs write guard: browser (anon/authenticated) inserts can no longer set
--    billing or lifecycle state, and browser updates can only cancel a job
--    (plus saveFullVideo's result_url/prompt edits). SECURITY DEFINER SQL
--    functions run as their owner and are therefore trusted, as are
--    service_role edge functions.

BEGIN;
-- Fail fast instead of queueing behind long transactions on public.jobs.
SET LOCAL lock_timeout = '10s';

/* ─── 1. deduct_credits ───────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.deduct_credits(uid uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- The PostgREST request role survives SECURITY DEFINER (current_user does
  -- not), so this is 'authenticated'/'anon' for browser calls even when they
  -- arrive through another SECURITY DEFINER function.
  v_role text := COALESCE(NULLIF(current_setting('role', true), ''), 'none');
BEGIN
  IF v_role IN ('anon', 'authenticated') AND COALESCE(auth.role(), '') <> 'service_role' THEN
    IF amount IS NULL OR amount < 0 THEN
      RAISE EXCEPTION 'INVALID_CREDIT_AMOUNT' USING ERRCODE = '22023';
    END IF;
    IF auth.uid() IS NULL OR uid IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'CREDIT_ACCOUNT_MISMATCH' USING ERRCODE = '42501';
    END IF;
  END IF;

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

/* ─── 2. Service-only RPCs ────────────────────────────────────────────── */

REVOKE EXECUTE ON FUNCTION
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
FROM PUBLIC, anon, authenticated;

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
TO service_role;

/* ─── 3. jobs write guard ─────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.guard_client_job_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old       jsonb;
  v_new       jsonb;
  v_generated text[];
BEGIN
  -- SECURITY INVOKER: current_user is 'anon'/'authenticated' only for direct
  -- browser writes. service_role edge functions and SECURITY DEFINER SQL
  -- functions (owner postgres) are trusted and pass through untouched.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.credits_charged_at  := NULL;
    NEW.credits_refunded_at := NULL;

    -- saveFullVideo (src/lib/jobs.ts): a client-rendered export. No provider
    -- work exists for it, so it is stored already succeeded and free. It can
    -- never be dispatched: no provider link exists for 'full-video' and
    -- job-worker only claims 'queued' rows.
    IF NEW.tool_key = 'full-video' AND NEW.provider = 'client' THEN
      NEW.status         := 'succeeded';
      NEW.charge_credits := 0;
      NEW.charged        := false;
      RETURN NEW;
    END IF;

    NEW.charged := false;
    NEW.status  := 'queued';
    -- charge_credits for server-priced tool_keys has already been replaced by
    -- the pricing triggers (jobs_enforce_cooking_pricing,
    -- jobs_enforce_tool_pricing), which fire before this one.
    RETURN NEW;
  END IF;

  -- UPDATE: every column is read-only for the browser except
  --   status      — only the change to 'canceled' (cancelJob)
  --   result_url,
  --   prompt      — only on client-rendered full-video rows (saveFullVideo)
  --   updated_at  — bumped by trg_jobs_touch_updated / trg_jobs_updated_at
  -- This also blocks changing tool_key/input/settings after insert (e.g.
  -- inserting a cheap job, then switching it to an expensive unpriced tool).
  -- Stored generated columns (e.g. jobs.pct = progress) are still NULL in NEW
  -- during a BEFORE trigger, so they'd always look changed — skip them.
  SELECT COALESCE(array_agg(attname::text), '{}') INTO v_generated
  FROM pg_attribute
  WHERE attrelid = TG_RELID AND attnum > 0 AND NOT attisdropped AND attgenerated <> '';

  v_old := to_jsonb(OLD) - 'status' - 'updated_at' - v_generated;
  v_new := to_jsonb(NEW) - 'status' - 'updated_at' - v_generated;
  IF OLD.tool_key = 'full-video' AND OLD.provider = 'client' THEN
    v_old := v_old - 'result_url' - 'prompt';
    v_new := v_new - 'result_url' - 'prompt';
  END IF;

  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'JOB_FIELDS_READ_ONLY' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'canceled' THEN
    RAISE EXCEPTION 'JOB_STATUS_READ_ONLY' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- Named to sort last among BEFORE triggers on jobs (triggers fire in name
-- order), so it sees charge_credits after every pricing trigger has run.
DROP TRIGGER IF EXISTS zzz_jobs_guard_client_writes ON public.jobs;
CREATE TRIGGER zzz_jobs_guard_client_writes
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_job_writes();

NOTIFY pgrst, 'reload schema';

COMMIT;
