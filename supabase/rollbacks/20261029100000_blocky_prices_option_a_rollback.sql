-- Undo of 20261029100000_blocky_prices_option_a.sql: Blocky's V2 and V3 clip prices back to 5 and 9 credits a
-- second, and V3 allowed at every length from 4 to 15 seconds again. The notes keep naming today's models.
-- (pricing.js must be put back to 5 and 9 at the same time, or tests/blockyPricing.test.mjs fails.)
BEGIN;
UPDATE public.tool_prices SET credits_per_second = 5 WHERE tool_key = 'video:blocky-story-v2';
UPDATE public.tool_prices SET credits_per_second = 9, allowed_durations = ARRAY[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::integer[] WHERE tool_key = 'video:blocky-story-v3';
COMMIT;
