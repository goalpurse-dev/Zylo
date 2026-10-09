-- Undo of 20261030100000_blocky_prices_2x.sql: Blocky's prices back to "option A" of 2026-10-08
-- (picture 4, script share 15, V2 4, V3 8, V4 16 credits a second).
-- (pricing.js must be put back at the same time, or tests/blockyPricing.test.mjs fails.)
BEGIN;
UPDATE public.tool_prices SET flat_credits = 4 WHERE tool_key = 'image:blocky-story';
UPDATE public.tool_prices SET flat_credits = 15 WHERE tool_key = 'script:blocky-story';
UPDATE public.tool_prices SET credits_per_second = 4 WHERE tool_key = 'video:blocky-story-v2';
UPDATE public.tool_prices SET credits_per_second = 8 WHERE tool_key = 'video:blocky-story-v3';
UPDATE public.tool_prices SET credits_per_second = 16 WHERE tool_key = 'video:blocky-story-v4';
COMMIT;
