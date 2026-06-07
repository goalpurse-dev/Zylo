-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260602000002_rls_user_owned_tables.sql
-- Enable RLS on tables where every row belongs to one authenticated user.
-- All policies use auth.uid() = user_id (or join through brands.user_id).
-- Edge Functions using SERVICE_ROLE_KEY bypass RLS and are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── creations ────────────────────────────────────────────────────────────────
-- Used by:
--   • src/lib/creations.js — INSERT, UPSERT (UPDATE), SELECT (eq user_id), DELETE
--   • src/components/GenerationsDock.jsx — upsert on job completion
--   • src/components/reference-images/ReferenceImageModal.jsx — SELECT
-- All existing queries already filter by user_id; policies mirror that.

ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own creations"
  ON public.creations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own creations"
  ON public.creations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Covers both explicit UPDATE calls and UPSERT (which Postgres routes as UPDATE
-- when the row already exists).
CREATE POLICY "Users can update own creations"
  ON public.creations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- deleteCreation() in src/lib/creations.js calls .delete().eq("id", row.id).
-- The row's user_id must still match because that's what loaded it initially,
-- but we enforce it here at the DB level too.
CREATE POLICY "Users can delete own creations"
  ON public.creations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── user_onboarding ──────────────────────────────────────────────────────────
-- Used by:
--   • src/components/EmailConsentModal.jsx — UPSERT (INSERT + UPDATE)
--   • src/components/onboarding/FirstGenFlow.jsx — SELECT, UPSERT
-- UPSERT with onConflict: "user_id" means Postgres executes INSERT then UPDATE
-- on conflict; both policies must be present.

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding"
  ON public.user_onboarding
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON public.user_onboarding
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON public.user_onboarding
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── generation_feedback ──────────────────────────────────────────────────────
-- Used by:
--   • src/components/GenerationsDock.jsx — SELECT (eq user_id, job_id), UPSERT
--   • src/components/ResultVoteButtons.jsx — SELECT, UPSERT
-- UPSERT uses onConflict: "user_id,job_id"; requires both INSERT and UPDATE policies.

ALTER TABLE public.generation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own generation feedback"
  ON public.generation_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation feedback"
  ON public.generation_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generation feedback"
  ON public.generation_feedback
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── brand_avatars ─────────────────────────────────────────────────────────────
-- Used by:
--   • src/lib/api/avatars.js — UPDATE (is_primary = false), INSERT
-- No direct user_id column; ownership is via brands.user_id.
-- Policies use an EXISTS subquery to verify the brand belongs to auth.uid().
-- The brands table has RLS enabled separately (not in scope here).

ALTER TABLE public.brand_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their brand avatars"
  ON public.brand_avatars
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_avatars.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their brand avatars"
  ON public.brand_avatars
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_avatars.brand_id
        AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their brand avatars"
  ON public.brand_avatars
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_avatars.brand_id
        AND brands.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_avatars.brand_id
        AND brands.user_id = auth.uid()
    )
  );


-- ── image_generations ────────────────────────────────────────────────────────
-- Written by two Edge Functions:
--   • supabase/functions/runware-image (SERVICE_ROLE → bypasses RLS)
--   • supabase/functions/generate-image-v2 (user JWT via requireUser → needs policy)
-- No frontend SELECT of this table exists; counts are derived from the jobs table
-- in eligibility.ts. Only INSERT is needed for the user-JWT path.

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log own image generations"
  ON public.image_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ── credit_grants ─────────────────────────────────────────────────────────────
-- Used exclusively by supabase/functions/stripe-webhook/index.ts (service role).
-- grantCreditsOnce() inserts a ledger row to prevent double-crediting.
-- Must NOT be readable or writable from browser clients; no policies added.

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
