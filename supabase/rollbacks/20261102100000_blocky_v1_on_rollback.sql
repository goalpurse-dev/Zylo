-- Switches Blocky Stories off for everyone again (accounts with their own blocky_v1 switch keep it).
-- The page, its menu entry and its two places on Home disappear within 30 seconds; the API answers
-- "this page doesn't exist". Stories already made stay in the database. To also stop all spending at once:
-- node scripts/blocky/paid.mjs off
UPDATE public.global_feature_flags SET enabled = false, note = 'Blocky Stories: switched off', updated_at = now() WHERE key = 'blocky_v1';
