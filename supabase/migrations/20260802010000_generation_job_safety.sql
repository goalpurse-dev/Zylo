-- Production-safety hardening for provider dispatch, leases, terminal state,
-- and credit idempotency. This migration is additive for mixed deployments.

-- Queue workers touch generation_queue before creating/updating jobs. Acquire
-- the DDL locks in that same order so a live worker cannot deadlock this
-- migration by holding one relation while waiting on the other.
LOCK TABLE public.generation_queue IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.jobs IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_task_id text,
  ADD COLUMN IF NOT EXISTS dispatch_key uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS submission_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reconciliation_reason text;

ALTER TABLE public.generation_queue
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

UPDATE public.jobs
SET provider_task_id = NULLIF(settings->>'provider_job_id', '')
WHERE provider_task_id IS NULL AND NULLIF(settings->>'provider_job_id', '') IS NOT NULL;

UPDATE public.jobs
SET
  dispatch_key = COALESCE(dispatch_key, id),
  submission_state = CASE
    WHEN status = 'succeeded' THEN 'completed'
    WHEN status IN ('failed', 'canceled') THEN 'failed'
    WHEN provider_task_id IS NOT NULL THEN 'submitted'
    WHEN status IN ('running', 'processing') THEN 'reconciliation_required'
    ELSE 'pending'
  END,
  claimed_at = CASE WHEN status IN ('running', 'processing') THEN COALESCE(claimed_at, updated_at, now()) ELSE claimed_at END,
  heartbeat_at = CASE WHEN status IN ('running', 'processing') THEN COALESCE(heartbeat_at, updated_at, now()) ELSE heartbeat_at END,
  lease_expires_at = CASE WHEN status IN ('running', 'processing') THEN COALESCE(lease_expires_at, now() + interval '10 minutes') ELSE lease_expires_at END,
  claimed_by = CASE WHEN status IN ('running', 'processing') THEN COALESCE(claimed_by, 'legacy-rollout') ELSE claimed_by END;

ALTER TABLE public.jobs ALTER COLUMN dispatch_key SET NOT NULL;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_submission_state_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_submission_state_check CHECK (
  submission_state IN ('pending', 'submitting', 'submitted', 'reconciliation_required', 'completed', 'failed', 'canceled')
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_dispatch_key_uidx ON public.jobs(dispatch_key);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_provider_task_uidx
  ON public.jobs(provider, provider_task_id) WHERE provider_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_expired_lease_idx
  ON public.jobs(lease_expires_at, heartbeat_at)
  WHERE status IN ('running', 'processing');

CREATE INDEX IF NOT EXISTS generation_queue_expired_lease_idx
  ON public.generation_queue(lease_expires_at, heartbeat_at)
  WHERE status='processing';

CREATE OR REPLACE FUNCTION public.claim_generation_queue_jobs(worker_id text, max_jobs int DEFAULT 3)
RETURNS SETOF public.generation_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY WITH picked AS (
    SELECT id FROM public.generation_queue WHERE status='queued' AND retry_after<=now()
    ORDER BY priority,created_at LIMIT max_jobs FOR UPDATE SKIP LOCKED
  ) UPDATE public.generation_queue q SET status='processing',locked_at=now(),locked_by=worker_id,
    heartbeat_at=now(),lease_expires_at=now()+interval '2 minutes',started_at=COALESCE(q.started_at,now()),updated_at=now()
  FROM picked WHERE q.id=picked.id RETURNING q.*;
END;
$$;

CREATE TABLE IF NOT EXISTS public.generation_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation IN ('charge', 'refund')),
  amount integer NOT NULL CHECK (amount >= 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, operation),
  UNIQUE(idempotency_key)
);
ALTER TABLE public.generation_credit_ledger ENABLE ROW LEVEL SECURITY;

INSERT INTO public.generation_credit_ledger(job_id,user_id,operation,amount,idempotency_key,created_at)
SELECT id,user_id,'charge',GREATEST(0,COALESCE(charge_credits,0)),id::text || ':charge',credits_charged_at
FROM public.jobs WHERE credits_charged_at IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.generation_credit_ledger(job_id,user_id,operation,amount,idempotency_key,created_at)
SELECT id,user_id,'refund',GREATEST(0,COALESCE(charge_credits,0)),id::text || ':refund',credits_refunded_at
FROM public.jobs WHERE credits_refunded_at IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.generation_late_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  provider_task_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generation_late_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_generation_job(
  p_worker_id text,
  p_job_id uuid DEFAULT NULL,
  p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN RAISE EXCEPTION 'WORKER_ID_REQUIRED'; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.jobs
    WHERE status = 'queued'
      -- A caller that supplies a concrete job id is handing off a job it just
      -- created. Its client-generated retry_after can be a few milliseconds
      -- ahead of the database clock, so applying queue backoff here can make
      -- the first dispatch look like a duplicate. Queue scans still honor the
      -- backoff; explicit handoffs claim immediately.
      AND (p_job_id IS NOT NULL OR retry_after <= now())
      AND (p_job_id IS NULL OR id = p_job_id)
    ORDER BY priority, created_at
    LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.jobs j SET
    status = 'running',
    claimed_at = now(), heartbeat_at = now(), claimed_by = p_worker_id,
    lease_expires_at = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
    submission_state = 'pending', reconciliation_reason = NULL, updated_at = now()
  FROM picked WHERE j.id = picked.id RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_generation_job(
  p_job_id uuid, p_worker_id text, p_lease_seconds integer DEFAULT 180
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET heartbeat_at = now(),
    lease_expires_at = now() + make_interval(secs => GREATEST(30, p_lease_seconds)), updated_at = now()
  WHERE id = p_job_id AND claimed_by = p_worker_id AND status IN ('running', 'processing');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.adopt_expired_generation_job(
  p_job_id uuid, p_worker_id text, p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN QUERY UPDATE public.jobs j SET claimed_by=p_worker_id, claimed_at=now(), heartbeat_at=now(),
    lease_expires_at=now()+make_interval(secs=>GREATEST(30,p_lease_seconds)), updated_at=now()
  WHERE j.id=p_job_id AND j.status IN ('running','processing')
    AND j.lease_expires_at < now() AND j.heartbeat_at < now()-interval '30 seconds'
    AND j.submission_state='submitted' AND j.provider_task_id IS NOT NULL RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_expired_unsubmitted_job(p_job_id uuid, p_retry_after timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.jobs SET status='queued', claimed_by=NULL, claimed_at=NULL, heartbeat_at=NULL,
    lease_expires_at=NULL, retry_after=p_retry_after, attempts=attempts+1, updated_at=now()
  WHERE id=p_job_id AND status IN ('running','processing') AND submission_state='pending'
    AND lease_expires_at < now() AND heartbeat_at < now()-interval '30 seconds';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_provider_submission(
  p_job_id uuid, p_worker_id text, p_provider_task_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NULLIF(btrim(p_provider_task_id),'') IS NULL THEN RETURN false; END IF;
  UPDATE public.jobs SET provider_task_id=p_provider_task_id,
    settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{provider_job_id}',to_jsonb(p_provider_task_id),true),
    submission_state='submitting', status='processing', heartbeat_at=now(), updated_at=now()
  WHERE id=p_job_id AND status IN ('running','processing') AND claimed_by=p_worker_id
    AND (provider_task_id IS NULL OR provider_task_id=p_provider_task_id)
    AND submission_state IN ('pending','submitting');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_provider_submitting(p_job_id uuid, p_worker_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.jobs SET submission_state='submitting',status='processing',heartbeat_at=now(),updated_at=now()
  WHERE id=p_job_id AND status IN ('running','processing') AND claimed_by=p_worker_id
    AND submission_state IN ('pending','submitting') AND provider_task_id IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_provider_submission(
  p_job_id uuid, p_worker_id text, p_provider_task_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NULLIF(btrim(p_provider_task_id), '') IS NULL THEN RETURN false; END IF;
  UPDATE public.jobs SET provider_task_id = p_provider_task_id,
    settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{provider_job_id}', to_jsonb(p_provider_task_id), true),
    submission_state = 'submitted', status = 'processing', heartbeat_at = now(), updated_at = now()
  WHERE id = p_job_id AND status IN ('running', 'processing')
    AND (claimed_by = p_worker_id OR claimed_by = 'legacy-rollout')
    AND (provider_task_id IS NULL OR provider_task_id = p_provider_task_id);
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_provider_submission_for_retry(
  p_job_id uuid, p_worker_id text, p_provider_task_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NULLIF(btrim(p_provider_task_id),'') IS NULL THEN RETURN false; END IF;
  UPDATE public.jobs SET
    settings=jsonb_set(
      jsonb_set(COALESCE(settings,'{}'::jsonb),'{provider_job_id}',to_jsonb(p_provider_task_id),true),
      '{provider_job_history}',COALESCE(settings->'provider_job_history','[]'::jsonb) || to_jsonb(provider_task_id),true
    ),
    provider_task_id=p_provider_task_id,submission_state='submitting',status='processing',heartbeat_at=now(),updated_at=now()
  WHERE id=p_job_id AND status IN ('running','processing') AND claimed_by=p_worker_id
    AND submission_state='submitted' AND provider_task_id IS DISTINCT FROM p_provider_task_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_generation_reconciliation_required(p_job_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET submission_state = 'reconciliation_required',
    reconciliation_reason = left(COALESCE(p_reason, 'uncertain provider submission'), 500), updated_at = now()
  WHERE id = p_job_id AND status IN ('running', 'processing');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_job_credits(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.jobs%ROWTYPE; v_amount integer;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.credits_refunded_at IS NOT NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.generation_credit_ledger WHERE job_id = p_job_id AND operation = 'charge')
     OR v_job.credits_charged_at IS NOT NULL OR COALESCE(v_job.charged, false) THEN RETURN true; END IF;
  IF v_job.status IN ('failed', 'canceled') THEN RETURN false; END IF;
  v_amount := GREATEST(0, COALESCE(v_job.charge_credits, 0));
  IF v_amount > 0 THEN
    BEGIN PERFORM public.deduct_credits(v_job.user_id, v_amount);
    EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%INSUFFICIENT_CREDITS%' THEN RETURN false; END IF; RAISE; END;
  END IF;
  INSERT INTO public.generation_credit_ledger(job_id,user_id,operation,amount,idempotency_key)
    VALUES (p_job_id,v_job.user_id,'charge',v_amount,p_job_id::text || ':charge') ON CONFLICT DO NOTHING;
  UPDATE public.jobs SET charged = true, credits_charged_at = COALESCE(credits_charged_at, now()), updated_at = now()
    WHERE id = p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_generation_job(
  p_job_id uuid, p_url text, p_output jsonb DEFAULT NULL, p_provider_task_id text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.jobs%ROWTYPE; v_charged boolean;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.status NOT IN ('running','processing') OR v_job.credits_refunded_at IS NOT NULL OR
     (p_provider_task_id IS NOT NULL AND v_job.provider_task_id IS NOT NULL AND p_provider_task_id <> v_job.provider_task_id) THEN
    INSERT INTO public.generation_late_events(job_id,event_type,provider_task_id,payload)
      VALUES (p_job_id,'completion_rejected',p_provider_task_id,jsonb_build_object('current_status',v_job.status));
    RETURN false;
  END IF;
  v_charged := public.charge_job_credits(p_job_id);
  IF NOT v_charged THEN RETURN false; END IF;
  UPDATE public.jobs SET status='succeeded', progress=100, result_url=p_url, output=COALESCE(p_output,output),
    completed_at=now(), submission_state='completed', lease_expires_at=NULL, heartbeat_at=now(), updated_at=now()
  WHERE id=p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_and_refund_generation_job(
  p_job_id uuid, p_error_code text, p_error text, p_provider_task_id text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.jobs%ROWTYPE; v_amount integer;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.status NOT IN ('queued','running','processing') OR
     (p_provider_task_id IS NOT NULL AND v_job.provider_task_id IS NOT NULL AND p_provider_task_id <> v_job.provider_task_id) THEN
    INSERT INTO public.generation_late_events(job_id,event_type,provider_task_id,payload)
      VALUES (p_job_id,'failure_rejected',p_provider_task_id,jsonb_build_object('current_status',v_job.status));
    RETURN false;
  END IF;
  IF (v_job.credits_charged_at IS NOT NULL OR COALESCE(v_job.charged,false)) AND v_job.credits_refunded_at IS NULL THEN
    v_amount := GREATEST(0,COALESCE(v_job.charge_credits,0));
    IF v_amount > 0 THEN UPDATE public.profiles SET credit_balance=credit_balance+v_amount,
      credits_spent_today=GREATEST(0,COALESCE(credits_spent_today,0)-v_amount) WHERE id=v_job.user_id; END IF;
    INSERT INTO public.generation_credit_ledger(job_id,user_id,operation,amount,idempotency_key)
      VALUES(p_job_id,v_job.user_id,'refund',v_amount,p_job_id::text || ':refund') ON CONFLICT DO NOTHING;
    UPDATE public.jobs SET charged=false,credits_refunded_at=now() WHERE id=p_job_id;
  END IF;
  UPDATE public.jobs SET status='failed', error_code=p_error_code, error=p_error, failed_at=now(),
    submission_state='failed', lease_expires_at=NULL, heartbeat_at=now(), updated_at=now() WHERE id=p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_job_credits(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.jobs%ROWTYPE; v_amount integer;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.credits_refunded_at IS NOT NULL OR
     (v_job.credits_charged_at IS NULL AND NOT COALESCE(v_job.charged,false)) THEN RETURN false; END IF;
  IF v_job.status NOT IN ('failed','canceled') THEN RETURN false; END IF;
  v_amount := GREATEST(0,COALESCE(v_job.charge_credits,0));
  IF v_amount > 0 THEN UPDATE public.profiles SET credit_balance=credit_balance+v_amount,
    credits_spent_today=GREATEST(0,COALESCE(credits_spent_today,0)-v_amount) WHERE id=v_job.user_id; END IF;
  INSERT INTO public.generation_credit_ledger(job_id,user_id,operation,amount,idempotency_key)
    VALUES(p_job_id,v_job.user_id,'refund',v_amount,p_job_id::text || ':refund') ON CONFLICT DO NOTHING;
  UPDATE public.jobs SET charged=false,credits_refunded_at=now(),updated_at=now() WHERE id=p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_generation_job_terminal_state()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.status IN ('succeeded','failed','canceled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'TERMINAL_JOB_STATE' USING ERRCODE='23514';
  END IF;
  IF OLD.credits_refunded_at IS NOT NULL AND NEW.status='succeeded' THEN
    RAISE EXCEPTION 'REFUNDED_JOB_CANNOT_SUCCEED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_generation_job_terminal_state ON public.jobs;
CREATE TRIGGER enforce_generation_job_terminal_state BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_generation_job_terminal_state();

REVOKE ALL ON TABLE public.generation_credit_ledger, public.generation_late_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_generation_job(text,uuid,integer), public.heartbeat_generation_job(uuid,text,integer),
  public.adopt_expired_generation_job(uuid,text,integer), public.requeue_expired_unsubmitted_job(uuid,timestamptz),
  public.reserve_provider_submission(uuid,text,text),
  public.mark_provider_submitting(uuid,text),
  public.replace_provider_submission_for_retry(uuid,text,text),
  public.record_provider_submission(uuid,text,text), public.mark_generation_reconciliation_required(uuid,text),
  public.complete_generation_job(uuid,text,jsonb,text), public.fail_and_refund_generation_job(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_generation_job(text,uuid,integer), public.heartbeat_generation_job(uuid,text,integer),
  public.adopt_expired_generation_job(uuid,text,integer), public.requeue_expired_unsubmitted_job(uuid,timestamptz),
  public.reserve_provider_submission(uuid,text,text),
  public.mark_provider_submitting(uuid,text),
  public.replace_provider_submission_for_retry(uuid,text,text),
  public.record_provider_submission(uuid,text,text), public.mark_generation_reconciliation_required(uuid,text),
  public.complete_generation_job(uuid,text,jsonb,text), public.fail_and_refund_generation_job(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_job_credits(uuid), public.refund_job_credits(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
