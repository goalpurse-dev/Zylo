-- Blocky Stories: every price is 2× our real cost (owner, 2026-10-08).
--
-- The basis (supabase/functions/_shared/blocky/pricing.js#BASIS): 1 credit = €0.024 (the Starter plan, €18 for
-- 750 credits; no VAT in it), $1 = €0.894, and what each thing really costs us with its checks.
--
--   a scene picture, an edit, a regenerate   4 -> 3 credits      (costs us $0.0362 with its check)
--   the script's share of the picture step  15 -> 13 credits     (costs us $0.17)
--   V2 clips                                 4 -> 2.4 a second   (Grok 1.5 Lite at 720p, $0.0317 a second)
--   V3 clips                                 8 -> 3.75 a second  (Veo 3.1 Lite, $0.05 a second)
--   V4 clips                                16 -> 11.25 a second (Veo 3.1 Fast, $0.15 a second)
--
-- A clip is charged CEIL(rate × seconds), as before. Only Blocky's own rows (keys with "blocky-story") are
-- touched; no other tool's price moves. tests/blockyPricing.test.mjs holds these to pricing.js and to 2×.
-- Undo: supabase/rollbacks/20261030100000_blocky_prices_2x_rollback.sql
BEGIN;

UPDATE public.tool_prices SET flat_credits = 3 WHERE tool_key = 'image:blocky-story';
UPDATE public.tool_prices SET flat_credits = 13 WHERE tool_key = 'script:blocky-story';
UPDATE public.tool_prices SET credits_per_second = 2.4 WHERE tool_key = 'video:blocky-story-v2';
UPDATE public.tool_prices SET credits_per_second = 3.75 WHERE tool_key = 'video:blocky-story-v3';
UPDATE public.tool_prices SET credits_per_second = 11.25 WHERE tool_key = 'video:blocky-story-v4';

COMMIT;
