-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260602000001_rls_server_only_tables.sql
-- Enable RLS on internal / billing tables that have NO legitimate browser access.
-- No anon or authenticated policies are created here intentionally.
-- All legitimate access to these tables goes through Edge Functions that use
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── app_provider_prices ──────────────────────────────────────────────────────
-- Not referenced in any frontend JS file.
-- Internal pricing config read by service-role Edge Functions only.

ALTER TABLE public.app_provider_prices ENABLE ROW LEVEL SECURITY;


-- ── products ─────────────────────────────────────────────────────────────────
-- Note: src/lib/storage.ts uses a *Storage bucket* named "products" via
-- supabase.storage.from("products") — that is a bucket, not this DB table.
-- This DB table has no frontend queries; internal use only.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;


-- ── billing_events_processed ─────────────────────────────────────────────────
-- Used exclusively by supabase/functions/stripe-webhook/index.ts (service role).
-- Acts as an idempotency ledger: INSERT with unique event_id, 23505 = already done.
-- Must NOT be readable or writable from browser clients.

ALTER TABLE public.billing_events_processed ENABLE ROW LEVEL SECURITY;


-- ── processed_billing_events ─────────────────────────────────────────────────
-- Not referenced in any JS/TS file in the project.
-- Likely a legacy or alternate billing idempotency table.
-- Lock it down; service role can still access if needed.

ALTER TABLE public.processed_billing_events ENABLE ROW LEVEL SECURITY;
