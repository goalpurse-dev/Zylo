-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260602000000_rls_public_read_tables.sql
-- Enable RLS on global config / public-gallery tables.
-- These hold no per-user data; anyone (or any authenticated user) may SELECT.
-- INSERT / UPDATE / DELETE remain inaccessible to browser clients.
-- Edge Functions using SERVICE_ROLE_KEY bypass RLS and are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── app_plans ────────────────────────────────────────────────────────────────
-- Used by:
--   • src/components/myproduct/step1.jsx (authenticated)
--   • src/pages/adstudio/AdCreateStep3.jsx (authenticated)
--   • src/pages/brands/BrandWorkspace.jsx (authenticated)
--   • supabase/functions/check-tool (service role → bypasses RLS)
-- No user_id column — global plan-feature lookup table.
-- Anon users hit the pricing / landing pages, so allow anon SELECT too.

ALTER TABLE public.app_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app plans"
  ON public.app_plans
  FOR SELECT
  TO anon, authenticated
  USING (true);


-- ── public_images ────────────────────────────────────────────────────────────
-- Used by:
--   • src/pages/viral/Image.jsx — reads all rows, no WHERE clause, no auth check
-- Intentionally a public gallery; anon visitors may read it.

ALTER TABLE public.public_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public images"
  ON public.public_images
  FOR SELECT
  TO anon, authenticated
  USING (true);
