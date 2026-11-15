-- Blocky Worlds: the BLENDER ENGINE prices (the owner approved the table 2026-11-15: 60 s 219, 90 s 313, 120 s 407).
-- 1 credit = $0.01 of our full cost; the user pays $0.02 a credit (2x). The numbers come from
-- _shared/blockyWorlds/blenderPricing.js blenderCredits (the measured Blender runs); pricing.js PRICES equals them
-- (tests/blockyWorlds.test.mjs holds the two together). The Blender page charges ONE flat price (the 90 s row, 313):
-- its scripts are capped at ~90 s (blenderPricing.js BLENDER_FLAT), so the 90 s row covers every video it makes.
-- Run by the owner (never db push), right AFTER deploying blocky-worlds-api with the new pricing.js:
--   npx supabase db query --linked -f supabase/migrations/20261216100000_blocky_worlds_blender_prices.sql
--   npx supabase migration repair --linked --status applied 20261216100000
-- Rollback: re-run 20261214100000_blocky_worlds_studio_prices.sql (the Studio rows) and revert pricing.js.
BEGIN;
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('blocky-worlds:video-30', NULL, 124, NULL, 'Blocky Worlds 30 s (Blender engine): our full cost ~$1.24 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-40', NULL, 156, NULL, 'Blocky Worlds 40 s (Blender engine): our full cost ~$1.55 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-50', NULL, 187, NULL, 'Blocky Worlds 50 s (Blender engine): our full cost ~$1.87 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-60', NULL, 219, NULL, 'Blocky Worlds 60 s (Blender engine): our full cost ~$2.18 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-70', NULL, 250, NULL, 'Blocky Worlds 70 s (Blender engine): our full cost ~$2.50 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-80', NULL, 282, NULL, 'Blocky Worlds 80 s (Blender engine): our full cost ~$2.81 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-90', NULL, 313, NULL, 'Blocky Worlds 90 s (Blender engine): our full cost ~$3.12 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-100', NULL, 344, NULL, 'Blocky Worlds 100 s (Blender engine): our full cost ~$3.44 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-110', NULL, 376, NULL, 'Blocky Worlds 110 s (Blender engine): our full cost ~$3.75 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-120', NULL, 407, NULL, 'Blocky Worlds 120 s (Blender engine): our full cost ~$4.07 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-130', NULL, 439, NULL, 'Blocky Worlds 130 s (Blender engine): our full cost ~$4.38 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-140', NULL, 470, NULL, 'Blocky Worlds 140 s (Blender engine): our full cost ~$4.70 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-150', NULL, 502, NULL, 'Blocky Worlds 150 s (Blender engine): our full cost ~$5.01 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-160', NULL, 533, NULL, 'Blocky Worlds 160 s (Blender engine): our full cost ~$5.33 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-170', NULL, 565, NULL, 'Blocky Worlds 170 s (Blender engine): our full cost ~$5.64 (measured model, 2026-11-15)'),
  ('blocky-worlds:video-180', NULL, 596, NULL, 'Blocky Worlds 180 s (Blender engine): our full cost ~$5.96 (measured model, 2026-11-15)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;
COMMIT;
