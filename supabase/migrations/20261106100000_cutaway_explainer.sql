-- Cutaway Explainer (short-form template; shown by the VITE_CUTAWAY_ENABLED / CUTAWAY_ENABLED switch, no flag row).
--
-- 1. cutaway_runs: one row per video. The edge function cutaway-api is the only
--    writer (service role); the browser reads its own rows and watches them live.
-- 2. tool_prices: what the user is charged, one flat price per video: premade or custom topic, 30 or 60 s.
--    The server picks the row from the topic text (_shared/cutaway/topics.js). Must match
--    supabase/functions/_shared/cutaway/pricing.js (tests/cutaway.test.mjs).
-- 3. cutaway_parts_backlog: custom topics the kit can't build yet (nothing charged), for deciding which parts
--    to build next. Server-only.

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

CREATE TABLE IF NOT EXISTS public.cutaway_parts_backlog (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  topic      text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 200),
  missing    text[] NOT NULL DEFAULT '{}',
  checked_by text NOT NULL CHECK (checked_by IN ('rules', 'claude')),
  closest    text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutaway_parts_backlog_created ON public.cutaway_parts_backlog (created_at DESC);
ALTER TABLE public.cutaway_parts_backlog ENABLE ROW LEVEL SECURITY; -- no policies: service role only
REVOKE ALL ON public.cutaway_parts_backlog FROM anon, authenticated;

-- Prices (2.8x our cost, EUR 18 per 750 credits; see pricing.js COSTS_3D for the arithmetic).
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('cutaway:premade-30', NULL, 40, NULL, 'Cutaway Explainer 30 s, premade topic: saved layout and facts, Opus 5.5 script + timeline + preview check, voice, GPU render (~$0.38)'),
  ('cutaway:premade-60', NULL, 62, NULL, 'Cutaway Explainer 60 s, premade topic (~$0.59)'),
  ('cutaway:custom-30', NULL, 66, NULL, 'Cutaway Explainer 30 s, custom topic: + fact-check and a new scene plan on Sonnet 5.5, 20% re-plan buffer, kit check (~$0.62)'),
  ('cutaway:custom-60', NULL, 95, NULL, 'Cutaway Explainer 60 s, custom topic (~$0.91)'),
  ('cutaway:image', NULL, 4, NULL, 'Cutaway Explainer: regenerate one wide image + its vision check (~$0.045)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;

COMMIT;
