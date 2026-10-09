-- Blocky Stories: the owner's "option A" credit prices for the new clip lineup (2026-10-08).
--
--   V2  5 -> 4 credits a second   (Grok Imagine Video 1.5 Lite at 720p, $0.0317 a second; then P-Video-2)
--   V3  9 -> 8 credits a second   (Veo 3.1 Lite, $0.05 a second; then P-Video-2)
--   V4  16, unchanged             (Veo 3.1 Fast, $0.15 a second; then Veo 3.1 Lite, then P-Video-2)
--
-- V3's clips now come in 4, 6 or 8 seconds (Veo 3.1 Lite makes no other length), so its row allows only those.
-- The notes say which models make the clips today. The picture (4) and the script share (15) are unchanged.
-- Only Blocky's own rows (keys with "blocky-story") are touched; no other tool's price moves.
-- The same numbers are in supabase/functions/_shared/blocky/pricing.js (tests/blockyPricing.test.mjs compares).
-- Undo: supabase/rollbacks/20261029100000_blocky_prices_option_a_rollback.sql
BEGIN;

UPDATE public.tool_prices
SET credits_per_second = 4, notes = 'Blocky Stories V2 clip: Grok Imagine Video 1.5 Lite 720p, i2v, audio ($0.0317/s); falls back to P-Video-2'
WHERE tool_key = 'video:blocky-story-v2';

UPDATE public.tool_prices
SET credits_per_second = 8, allowed_durations = ARRAY[4, 6, 8]::integer[], notes = 'Blocky Stories V3 clip: Veo 3.1 Lite 720p, i2v, audio ($0.05/s); falls back to P-Video-2'
WHERE tool_key = 'video:blocky-story-v3';

UPDATE public.tool_prices
SET notes = 'Blocky Stories V4 clip: Veo 3.1 Fast 720p, i2v, audio ($0.15/s); falls back to Veo 3.1 Lite, then P-Video-2'
WHERE tool_key = 'video:blocky-story-v4';

COMMIT;
