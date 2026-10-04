-- Email outbox: every email the product sends is a row here first.
--
-- Why. Email used to be sent straight from whatever code wanted it (public
-- Vercel scripts, the signup page): no record of what was sent, nothing to stop
-- the same email going out twice or a thousand times, and a failed send was
-- simply lost. Now:
--   * an event (new account, first plan payment, credit pack, plan ended, …)
--     ENQUEUES a row with a unique dedupe_key. The same event can enqueue as
--     often as it likes: the key lets exactly one row exist, so one email.
--   * a scheduled edge function (email-sender) CLAIMS due rows, sends them
--     through Resend (with the row's key as Resend's idempotency key) and
--     records the result. A failed send is retried with growing pauses, then
--     marked failed and shows up in the daily alert.
--   * the row is the log: what, to whom, when, Resend's id, the last error.
-- Enqueueing is a single insert and never sends anything itself, so the code
-- that enqueues (the Stripe webhook, the signup trigger) cannot be slowed down
-- or failed by email.
--
-- The sender needs two function secrets (EMAIL_SENDER_SECRET, RESEND_API_KEY)
-- and the cron jobs need Vault secrets; see the end of this file. Nothing is
-- scheduled by this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE SCHEMA IF NOT EXISTS private;

-- ── the table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key      text NOT NULL UNIQUE,      -- e.g. welcome:<user>, plan_welcome:<subscription>, pack:<checkout session>
  template        text NOT NULL,             -- a key of _shared/emails/templates.js
  category        text NOT NULL DEFAULT 'transactional'
                  CHECK (category IN ('transactional', 'marketing')),
  user_id         uuid,                      -- whose email it is (consent and address are read at send time)
  to_email        text,                      -- only for mail not tied to a profile; otherwise the profile's address is used
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped', 'canceled')),
  send_after      timestamptz NOT NULL DEFAULT now(),
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz,               -- when a sender run claimed it
  last_error      text,
  provider_id     text,                      -- Resend's email id
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),   -- last claim or result
  CHECK (user_id IS NOT NULL OR to_email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS email_outbox_due_idx ON public.email_outbox (next_attempt_at) WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS email_outbox_user_idx ON public.email_outbox (user_id);
-- Server only: no policies, so the browser can neither read nor write it.
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- ── enqueue: one row per key, however often it is called ─────────────────────
-- Returns true when the row is new, false when this key was already queued.
CREATE OR REPLACE FUNCTION public.enqueue_email(
  p_dedupe_key text,
  p_template   text,
  p_user_id    uuid DEFAULT NULL,
  p_payload    jsonb DEFAULT '{}'::jsonb,
  p_category   text DEFAULT 'transactional',
  p_send_after timestamptz DEFAULT now(),
  p_to_email   text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF COALESCE(p_dedupe_key, '') = '' OR COALESCE(p_template, '') = '' THEN
    RAISE EXCEPTION 'enqueue_email: dedupe_key and template are required';
  END IF;
  INSERT INTO public.email_outbox (dedupe_key, template, category, user_id, to_email, payload, send_after, next_attempt_at)
  VALUES (p_dedupe_key, p_template, COALESCE(p_category, 'transactional'), p_user_id, NULLIF(p_to_email, ''),
          COALESCE(p_payload, '{}'::jsonb), COALESCE(p_send_after, now()), COALESCE(p_send_after, now()))
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ── claim: the rows one sender run will send ─────────────────────────────────
-- Due pending rows, oldest first. A row left in 'sending' for 10 minutes (the
-- run died) is claimed again: Resend's idempotency key keeps a second attempt
-- from producing a second email. SKIP LOCKED lets two runs overlap safely.
CREATE OR REPLACE FUNCTION public.claim_emails(p_limit integer DEFAULT 10)
RETURNS SETOF public.email_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_outbox AS o
  SET    status = 'sending', attempts = o.attempts + 1, locked_at = now(), updated_at = now()
  WHERE  o.id IN (
    SELECT id FROM public.email_outbox
    WHERE  (status = 'pending' AND next_attempt_at <= now())
        OR (status = 'sending' AND locked_at < now() - interval '10 minutes')
    ORDER  BY next_attempt_at, id
    LIMIT  GREATEST(1, LEAST(COALESCE(p_limit, 10), 50))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.*;
$$;

-- ── finish: what happened to a claimed row ───────────────────────────────────
-- p_result: 'sent' | 'retry' | 'failed' | 'skipped' | 'canceled'.
-- 'retry' waits 1 min, 5 min, 30 min, 2 h, 12 h; the 6th failure is final.
CREATE OR REPLACE FUNCTION public.finish_email(
  p_id          bigint,
  p_result      text,
  p_provider_id text DEFAULT NULL,
  p_error       text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_status   text;
  v_wait     interval;
BEGIN
  SELECT attempts INTO v_attempts FROM public.email_outbox WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'finish_email: no row %', p_id; END IF;

  IF p_result = 'sent' THEN
    UPDATE public.email_outbox SET status = 'sent', sent_at = now(), provider_id = p_provider_id, last_error = NULL, locked_at = NULL, updated_at = now() WHERE id = p_id;
    RETURN 'sent';
  ELSIF p_result = 'retry' THEN
    IF v_attempts >= 6 THEN
      v_status := 'failed';
      UPDATE public.email_outbox SET status = 'failed', last_error = left(p_error, 1000), locked_at = NULL, updated_at = now() WHERE id = p_id;
    ELSE
      v_status := 'pending';
      v_wait := (ARRAY[interval '1 minute', interval '5 minutes', interval '30 minutes', interval '2 hours', interval '12 hours'])[v_attempts];
      UPDATE public.email_outbox SET status = 'pending', next_attempt_at = now() + v_wait, last_error = left(p_error, 1000), locked_at = NULL, updated_at = now() WHERE id = p_id;
    END IF;
    RETURN v_status;
  ELSIF p_result IN ('failed', 'skipped', 'canceled') THEN
    UPDATE public.email_outbox SET status = p_result, last_error = left(p_error, 1000), locked_at = NULL, updated_at = now() WHERE id = p_id;
    RETURN p_result;
  END IF;
  RAISE EXCEPTION 'finish_email: unknown result %', p_result;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_email(text, text, uuid, jsonb, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_emails(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_email(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, text, uuid, jsonb, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_emails(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_email(bigint, text, text, text) TO service_role;

-- ── welcome: every new account, whichever way it signed up ───────────────────
-- Fires for new profiles only (nobody who already has an account is mailed).
-- It must never stand in the way of a signup: any error is swallowed.
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.enqueue_email('welcome:' || NEW.id::text, 'welcome', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_welcome_email: % (%)', SQLERRM, NEW.id;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_enqueue_welcome_email ON public.profiles;
CREATE TRIGGER profiles_enqueue_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email();

-- ── the sender's cron trigger ────────────────────────────────────────────────
-- Calls the email-sender edge function. URL and secret come from Vault.
CREATE OR REPLACE FUNCTION private.trigger_email_sender()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
  v_url text; v_secret text; v_request_id bigint;
BEGIN
  -- Nothing due: no call at all.
  IF NOT EXISTS (
    SELECT 1 FROM public.email_outbox
    WHERE (status = 'pending' AND next_attempt_at <= now())
       OR (status = 'sending' AND locked_at < now() - interval '10 minutes')
  ) THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'email_sender_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'email_sender_secret' ORDER BY created_at DESC LIMIT 1;
  IF NULLIF(v_url, '') IS NULL OR NULLIF(v_secret, '') IS NULL THEN
    RAISE EXCEPTION 'EMAIL_SENDER_VAULT_SECRETS_MISSING';
  END IF;
  SELECT net.http_post(
    url     => v_url,
    headers => jsonb_build_object('content-type', 'application/json', 'x-email-sender-secret', v_secret),
    body    => '{}'::jsonb
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION private.trigger_email_sender() FROM PUBLIC;

-- ── daily alert: did anything scheduled fail in the last 24 hours? ───────────
-- What is wrong, as rows of { source, name, detail, count }:
--   cron      a pg_cron job run that failed
--   http      a call a cron job made to an edge function that did not answer 2xx
--             (such a job run itself counts as "succeeded")
--   topup     a row in annual_topup_failures
--   email     an outbox row that ended as failed
CREATE OR REPLACE FUNCTION private.cron_failure_report(p_since timestamptz DEFAULT now() - interval '24 hours')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_part  jsonb;
BEGIN
  -- Each source in its own block: one missing table must not hide the others.
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('source', 'cron', 'name', x.jobname, 'detail', x.detail, 'count', x.n)), '[]'::jsonb) INTO v_part
    FROM (
      SELECT COALESCE(j.jobname, 'job ' || d.jobid) AS jobname, left(max(d.return_message), 300) AS detail, count(*) AS n
      FROM cron.job_run_details d LEFT JOIN cron.job j ON j.jobid = d.jobid
      WHERE d.status = 'failed' AND d.start_time >= p_since
      GROUP BY 1
    ) x;
    v_items := v_items || v_part;
  EXCEPTION WHEN OTHERS THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object('source', 'cron', 'name', 'report', 'detail', SQLERRM, 'count', 1));
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('source', 'http', 'name', x.code, 'detail', x.detail, 'count', x.n)), '[]'::jsonb) INTO v_part
    FROM (
      SELECT COALESCE(r.status_code::text, 'no response') AS code, left(max(COALESCE(r.error_msg, r.content, '')), 300) AS detail, count(*) AS n
      FROM net._http_response r
      WHERE r.created >= p_since AND (r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300)
      GROUP BY 1
    ) x;
    v_items := v_items || v_part;
  EXCEPTION WHEN OTHERS THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object('source', 'http', 'name', 'report', 'detail', SQLERRM, 'count', 1));
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('source', 'topup', 'name', x.user_id, 'detail', x.detail, 'count', x.n)), '[]'::jsonb) INTO v_part
    FROM (
      SELECT user_id::text AS user_id, left(max(error), 300) AS detail, count(*) AS n
      FROM public.annual_topup_failures WHERE created_at >= p_since GROUP BY 1
    ) x;
    v_items := v_items || v_part;
  EXCEPTION WHEN OTHERS THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object('source', 'topup', 'name', 'report', 'detail', SQLERRM, 'count', 1));
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('source', 'email', 'name', x.template, 'detail', x.detail, 'count', x.n)), '[]'::jsonb) INTO v_part
    FROM (
      SELECT template, left(max(last_error), 300) AS detail, count(*) AS n
      FROM public.email_outbox WHERE status = 'failed' AND updated_at >= p_since
      GROUP BY 1
    ) x;
    v_items := v_items || v_part;
  EXCEPTION WHEN OTHERS THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object('source', 'email', 'name', 'report', 'detail', SQLERRM, 'count', 1));
  END;

  RETURN v_items;
END;
$$;

-- Sends the report to you, straight to Resend (not through the outbox: the
-- alert has to arrive even when the outbox sender is the thing that broke).
-- Nothing wrong → nothing sent. Returns the pg_net request id, or NULL.
CREATE OR REPLACE FUNCTION private.send_cron_failure_alert()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
  v_items jsonb; v_key text; v_to text; v_text text; v_request_id bigint;
BEGIN
  v_items := private.cron_failure_report();
  IF jsonb_array_length(v_items) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'resend_api_key' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_to FROM vault.decrypted_secrets WHERE name = 'alert_email' ORDER BY created_at DESC LIMIT 1;
  IF NULLIF(v_key, '') IS NULL OR NULLIF(v_to, '') IS NULL THEN
    RAISE EXCEPTION 'CRON_ALERT_VAULT_SECRETS_MISSING';
  END IF;
  SELECT string_agg(format('[%s] %s x%s: %s', i->>'source', i->>'name', i->>'count', i->>'detail'), E'\n')
  INTO v_text FROM jsonb_array_elements(v_items) AS i;
  SELECT net.http_post(
    url     => 'https://api.resend.com/emails',
    headers => jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || v_key,
                                  'idempotency-key', 'cron-alert-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
    body    => jsonb_build_object(
      'from', 'Zyvo Alerts <hello@tryzyvo.com>',
      'to', v_to,
      'subject', format('Zyvo: %s scheduled job problem(s) in the last 24 hours', jsonb_array_length(v_items)),
      'text', E'Something scheduled failed in the last 24 hours.\n\n' || v_text
              || E'\n\ncron    = a pg_cron job run failed (cron.job_run_details)\nhttp    = a cron job''s call to an edge function did not return 2xx (net._http_response)\ntopup   = the yearly credit top-up failed for a user (annual_topup_failures)\nemail   = an email could not be sent after all retries (email_outbox)'
    )
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION private.cron_failure_report(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.send_cron_failure_alert() FROM PUBLIC;

-- =============================================================================
-- AFTER APPLYING (run by hand; nothing above schedules or sends anything)
--
-- 1. Function secrets (Supabase → Edge Functions → Secrets):
--      EMAIL_SENDER_SECRET   a new random string
--      RESEND_API_KEY        already set
--      EMAIL_UNSUBSCRIBE_SECRET  already set
--
-- 2. Vault (SQL editor):
--      select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/email-sender', 'email_sender_url');
--      select vault.create_secret('<the same EMAIL_SENDER_SECRET>', 'email_sender_secret');
--      select vault.create_secret('<a Resend API key>', 'resend_api_key');
--      select vault.create_secret('<your address>', 'alert_email');
--
-- 3. Schedules:
--      select cron.schedule('email-outbox-send', '* * * * *', 'select private.trigger_email_sender();');
--      select cron.schedule('cron-failure-alert', '30 6 * * *', 'select private.send_cron_failure_alert();');
-- =============================================================================
