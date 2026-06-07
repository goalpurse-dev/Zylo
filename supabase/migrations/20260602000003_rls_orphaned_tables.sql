-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260602000003_rls_orphaned_tables.sql
-- Enable RLS on tables with no active frontend queries in the current codebase.
-- No anon or authenticated policies are added — these are effectively locked
-- to browser clients. Service role (Edge Functions / admin) can still access.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── feedback ─────────────────────────────────────────────────────────────────
-- supabase/functions/submit-feedback/index.ts sends an SMTP email only.
-- It does NOT insert into this table. No other frontend code queries it.
-- Enable RLS with no policies: no browser client can read or write it.

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;


-- ── image_likes ───────────────────────────────────────────────────────────────
-- Not referenced anywhere in src/ or supabase/functions/.
-- Enable RLS with no policies to match principle of least privilege.
-- If this table is activated in the future, add user_id policies at that time.

ALTER TABLE public.image_likes ENABLE ROW LEVEL SECURITY;
