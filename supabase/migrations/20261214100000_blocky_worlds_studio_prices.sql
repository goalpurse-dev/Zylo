-- Blocky Worlds: the STUDIO ENGINE prices (the owner's go: docs/blocky-worlds-launch.md, "Price"). 1 credit = $0.01 of
-- our full cost; the user pays $0.02 a credit (2x). The numbers come from _shared/blockyWorlds/studio.js studioCredits
-- (the measured Studio runs); pricing.js PRICES equals them (tests/blockyWorlds.test.mjs holds the two together).
-- Run by the owner (never db push), right AFTER deploying blocky-worlds-api with the new pricing.js (the page shows
-- PRICES, the charge reads these rows through compute_tool_price):
--   npx supabase db query --linked -f supabase/migrations/20261214100000_blocky_worlds_studio_prices.sql
--   npx supabase migration repair --linked --status applied 20261214100000
BEGIN;
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('blocky-worlds:video-30', NULL, 66, NULL, 'Blocky Worlds 30 s (Studio engine): our full cost ~$0.65 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-40', NULL, 80, NULL, 'Blocky Worlds 40 s (Studio engine): our full cost ~$0.79 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-50', NULL, 94, NULL, 'Blocky Worlds 50 s (Studio engine): our full cost ~$0.94 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-60', NULL, 108, NULL, 'Blocky Worlds 60 s (Studio engine): our full cost ~$1.08 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-70', NULL, 122, NULL, 'Blocky Worlds 70 s (Studio engine): our full cost ~$1.21 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-80', NULL, 136, NULL, 'Blocky Worlds 80 s (Studio engine): our full cost ~$1.35 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-90', NULL, 150, NULL, 'Blocky Worlds 90 s (Studio engine): our full cost ~$1.49 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-100', NULL, 164, NULL, 'Blocky Worlds 100 s (Studio engine): our full cost ~$1.63 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-110', NULL, 178, NULL, 'Blocky Worlds 110 s (Studio engine): our full cost ~$1.77 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-120', NULL, 192, NULL, 'Blocky Worlds 120 s (Studio engine): our full cost ~$1.91 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-130', NULL, 206, NULL, 'Blocky Worlds 130 s (Studio engine): our full cost ~$2.05 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-140', NULL, 220, NULL, 'Blocky Worlds 140 s (Studio engine): our full cost ~$2.19 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-150', NULL, 234, NULL, 'Blocky Worlds 150 s (Studio engine): our full cost ~$2.33 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-160', NULL, 248, NULL, 'Blocky Worlds 160 s (Studio engine): our full cost ~$2.47 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-170', NULL, 262, NULL, 'Blocky Worlds 170 s (Studio engine): our full cost ~$2.61 (measured model, 2026-11-13)'),
  ('blocky-worlds:video-180', NULL, 276, NULL, 'Blocky Worlds 180 s (Studio engine): our full cost ~$2.75 (measured model, 2026-11-13)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;
COMMIT;
