-- =============================================================================
-- Migration: 20260823010000_abandoned_checkouts_security_and_schema.sql
--
-- Phase 1 of the abandoned-checkout rebuild.
--
-- Live audit (2026-08-23) confirmed:
--   - RLS is ENABLED on abandoned_checkouts but the existing policies allow
--     anon/authenticated to SELECT/INSERT/UPDATE every row (verified: an
--     unauthenticated request with only the public anon key could read
--     emails out of this table). Policy names were not recoverable from the
--     API surface available at audit time, so this migration drops ALL
--     existing policies on the table dynamically (by name, from pg_policies)
--     rather than guessing names to DROP.
--   - 1036 existing rows, 35 with real (unique) stripe_session_id values from
--     2026-03-18 through 2026-04-04. These are preserved, never deleted.
--   - 1035/1036 rows match a profiles row by email; user_id is backfilled
--     case-insensitively and left nullable for the one unmatched row.
--
-- After this migration: only the service_role (which bypasses RLS by
-- default in Supabase, same as every other server-side table in this app)
-- can read or write this table. No anon/authenticated policies are created
-- because the client no longer needs direct access at all -- row creation
-- moves server-side into create-checkout-session (Phase 2).
-- =============================================================================

-- ── 1. Lock down RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'abandoned_checkouts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.abandoned_checkouts', pol.policyname);
  END LOOP;
END $$;

-- Deliberately no CREATE POLICY here. service_role bypasses RLS; anon and
-- authenticated get zero rows/zero writes with no policies present, which is
-- exactly the "no client access at all" model requested.

-- ── 2. Additive schema ───────────────────────────────────────────────────────
ALTER TABLE public.abandoned_checkouts
  ADD COLUMN IF NOT EXISTS user_id                    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS purchase_type              text,
  ADD COLUMN IF NOT EXISTS plan_code                  text,
  ADD COLUMN IF NOT EXISTS pack                       text,
  ADD COLUMN IF NOT EXISTS billing_interval           text,
  ADD COLUMN IF NOT EXISTS price_id                   text,
  ADD COLUMN IF NOT EXISTS amount                     integer,
  ADD COLUMN IF NOT EXISTS currency                   text,
  ADD COLUMN IF NOT EXISTS expires_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_checkout_url      text,
  ADD COLUMN IF NOT EXISTS recovered_from_session_id  text,
  ADD COLUMN IF NOT EXISTS converted_at               timestamptz,
  -- Phase 9: explicit version marker so the new processor (Phase 5/6) can
  -- never touch the 1036 legacy rows. New rows written by the rebuilt
  -- create-checkout-session set this to 'v2' explicitly; every existing row
  -- (including the 35 real-session ones) defaults to 'legacy' and stays that
  -- way -- nothing in this migration ever sets a row to 'v2'.
  ADD COLUMN IF NOT EXISTS recovery_system_version    text NOT NULL DEFAULT 'legacy',
  -- Phase 7: claim marker so two concurrent cron runs can't send the same
  -- stage twice. Set by the claim RPC in the next migration, cleared after
  -- each send attempt completes (success or failure).
  ADD COLUMN IF NOT EXISTS processing_started_at      timestamptz;

-- ── 3. Backfill user_id (case-insensitive email match), nullable by design ──
UPDATE public.abandoned_checkouts ac
SET user_id = p.id
FROM public.profiles p
WHERE lower(p.email) = lower(ac.email)
  AND ac.user_id IS NULL;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
-- Safe per the audit: all 35 populated stripe_session_id values are unique,
-- and Postgres unique indexes don't treat multiple NULLs as duplicates, so
-- this adds cleanly against the current 1001 NULL + 35 populated rows.
CREATE UNIQUE INDEX IF NOT EXISTS abandoned_checkouts_session_id_key
  ON public.abandoned_checkouts (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS abandoned_checkouts_user_status_idx
  ON public.abandoned_checkouts (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS abandoned_checkouts_email_status_idx
  ON public.abandoned_checkouts (lower(email), status, created_at DESC);

-- Supports the Phase 5/7 claim query (version + status + due-time scan).
CREATE INDEX IF NOT EXISTS abandoned_checkouts_processor_scan_idx
  ON public.abandoned_checkouts (recovery_system_version, status, paid, recovery_stage)
  WHERE paid = false;

-- ── 5. Status enum, validated against real data ──────────────────────────────
-- Confirmed by audit: only pending/in_sequence/finished/converted exist today
-- (all 1000 sampled rows accounted for). superseded/expired are new.
-- NOT VALID skips an immediate full-table lock/scan; validate as a fast
-- follow once confirmed no stray value exists outside the sampled 1000 rows:
--   ALTER TABLE public.abandoned_checkouts VALIDATE CONSTRAINT abandoned_checkouts_status_check;
ALTER TABLE public.abandoned_checkouts DROP CONSTRAINT IF EXISTS abandoned_checkouts_status_check;
ALTER TABLE public.abandoned_checkouts
  ADD CONSTRAINT abandoned_checkouts_status_check
  CHECK (status IN ('pending','in_sequence','finished','converted','superseded','expired'))
  NOT VALID;

-- ── 6. Analytics event log (append-only) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.abandoned_checkout_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checkout_id  uuid REFERENCES public.abandoned_checkouts(id),
  event_type   text NOT NULL,   -- checkout_started, email_1_sent, email_1_clicked,
                                 -- email_2_sent, email_2_clicked, email_3_sent, email_3_clicked,
                                 -- checkout_converted_without_email, recovered_purchase, expired
  stage        int,
  amount       integer,
  currency     text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS abandoned_checkout_events_checkout_idx
  ON public.abandoned_checkout_events (checkout_id, event_type);
CREATE INDEX IF NOT EXISTS abandoned_checkout_events_type_idx
  ON public.abandoned_checkout_events (event_type, created_at DESC);

ALTER TABLE public.abandoned_checkout_events ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only, same model as abandoned_checkouts itself.
