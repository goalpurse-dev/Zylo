-- Cutaway Explainer (short-form template, hidden behind the cutaway_explainer flag).
--
-- 1. cutaway_runs: one row per video. The edge function cutaway-api is the only
--    writer (service role); the browser reads its own rows and watches them live.
-- 2. tool_prices: what the user is charged. Must match
--    supabase/functions/_shared/cutaway/pricing.js (tests/cutaway.test.mjs).
-- 3. The global switch, off: only accounts with their own
--    user_feature_flags {"cutaway_explainer": true} see the template.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cutaway_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  topic            text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 120),
  length_sec       integer NOT NULL CHECK (length_sec IN (30, 60)),
  step             text NOT NULL DEFAULT 'plan',
  state            jsonb NOT NULL,
  version          integer NOT NULL DEFAULT 0,
  lease_until      timestamptz,
  credits_charged  integer NOT NULL DEFAULT 0,
  credits_refunded integer NOT NULL DEFAULT 0,
  charges          jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_usd         numeric(10,5) NOT NULL DEFAULT 0,
  final_url        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cutaway_runs_user_created ON public.cutaway_runs (user_id, created_at DESC);

ALTER TABLE public.cutaway_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cutaway_runs_select_own ON public.cutaway_runs;
CREATE POLICY cutaway_runs_select_own ON public.cutaway_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.cutaway_runs FROM anon, authenticated;
GRANT SELECT ON public.cutaway_runs TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.cutaway_runs;

-- Prices (2x our cost, EUR 18 per 750 credits; see pricing.js for the arithmetic).
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('cutaway:plan-30', NULL, 38, NULL, 'Cutaway Explainer 30 s, step 1: script + critic, voice, 5 wide images + vision checks (~$0.50)'),
  ('cutaway:plan-60', NULL, 49, NULL, 'Cutaway Explainer 60 s, step 1: script + critic, voice, 7 wide images + vision checks (~$0.66)'),
  ('cutaway:video', 3, NULL, ARRAY[30, 60]::integer[], 'Cutaway Explainer step 2: keyframes, P-Video-2 clips ($0.0252/s), sound effects, stitch (~$1.06 per 30 s)'),
  ('cutaway:image', NULL, 4, NULL, 'Cutaway Explainer: regenerate one wide image + its vision check (~$0.045)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;

INSERT INTO public.global_feature_flags (key, enabled, note)
VALUES ('cutaway_explainer', false, 'Cutaway Explainer template. false = hidden (accounts with a per-user cutaway_explainer flag still get it).')
ON CONFLICT (key) DO NOTHING;

COMMIT;
