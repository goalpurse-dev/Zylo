-- Blocky Worlds: video lengths from 30 s to 3 min in 10 s steps (the page's length slider; owner, 2026-11-05).
-- 1. The drafts' and runs' length checks: any of 30, 40, ... 180 seconds (was 60, 90, 120 only).
-- 2. Prices: one tool_prices row per length, equal to _shared/blockyWorlds/pricing.js PRICE_ROWS (the same formula as
--    before; 60 / 90 / 120 keep 47 / 62 / 78 credits). tests/blockyWorlds.test.mjs holds the rows and this file together.
-- Run by the owner: npx supabase db query --remote -f supabase/migrations/20261205100000_blocky_worlds_lengths.sql
--                   npx supabase migration repair --remote --status applied 20261205100000

BEGIN;

-- the old inline checks (named by Postgres <table>_length_sec_check), whatever their names turned out to be
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.blocky_worlds_drafts'::regclass, 'public.blocky_worlds_runs'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%length_sec%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END
$$;

ALTER TABLE public.blocky_worlds_drafts ADD CONSTRAINT blocky_worlds_drafts_length_sec_check
  CHECK (length_sec BETWEEN 30 AND 180 AND length_sec % 10 = 0);
ALTER TABLE public.blocky_worlds_runs ADD CONSTRAINT blocky_worlds_runs_length_sec_check
  CHECK (length_sec BETWEEN 30 AND 180 AND length_sec % 10 = 0);

INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, notes) VALUES
  ('blocky-worlds:video-30', NULL, 31, NULL, 'Blocky Worlds 30 s: our full cost ~$0.30 (estimate)'),
  ('blocky-worlds:video-40', NULL, 36, NULL, 'Blocky Worlds 40 s: our full cost ~$0.36 (estimate)'),
  ('blocky-worlds:video-50', NULL, 41, NULL, 'Blocky Worlds 50 s: our full cost ~$0.41 (estimate)'),
  ('blocky-worlds:video-60', NULL, 47, NULL, 'Blocky Worlds 60 s: our full cost ~$0.46 (estimate)'),
  ('blocky-worlds:video-70', NULL, 52, NULL, 'Blocky Worlds 70 s: our full cost ~$0.51 (estimate)'),
  ('blocky-worlds:video-80', NULL, 57, NULL, 'Blocky Worlds 80 s: our full cost ~$0.57 (estimate)'),
  ('blocky-worlds:video-90', NULL, 62, NULL, 'Blocky Worlds 90 s: our full cost ~$0.62 (estimate)'),
  ('blocky-worlds:video-100', NULL, 67, NULL, 'Blocky Worlds 100 s: our full cost ~$0.67 (estimate)'),
  ('blocky-worlds:video-110', NULL, 73, NULL, 'Blocky Worlds 110 s: our full cost ~$0.72 (estimate)'),
  ('blocky-worlds:video-120', NULL, 78, NULL, 'Blocky Worlds 120 s: our full cost ~$0.77 (estimate)'),
  ('blocky-worlds:video-130', NULL, 83, NULL, 'Blocky Worlds 130 s: our full cost ~$0.83 (estimate)'),
  ('blocky-worlds:video-140', NULL, 88, NULL, 'Blocky Worlds 140 s: our full cost ~$0.88 (estimate)'),
  ('blocky-worlds:video-150', NULL, 94, NULL, 'Blocky Worlds 150 s: our full cost ~$0.93 (estimate)'),
  ('blocky-worlds:video-160', NULL, 99, NULL, 'Blocky Worlds 160 s: our full cost ~$0.98 (estimate)'),
  ('blocky-worlds:video-170', NULL, 104, NULL, 'Blocky Worlds 170 s: our full cost ~$1.04 (estimate)'),
  ('blocky-worlds:video-180', NULL, 109, NULL, 'Blocky Worlds 180 s: our full cost ~$1.09 (estimate)')
ON CONFLICT (tool_key) DO UPDATE SET
  credits_per_second = EXCLUDED.credits_per_second,
  flat_credits = EXCLUDED.flat_credits,
  allowed_durations = EXCLUDED.allowed_durations,
  notes = EXCLUDED.notes,
  active = true;

COMMIT;
