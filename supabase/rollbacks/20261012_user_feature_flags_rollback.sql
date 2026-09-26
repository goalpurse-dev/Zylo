-- Rollback for 20261012100000_user_feature_flags.sql
--
-- Safe to run any time: with the table gone, isFruitV2Enabled() treats every
-- user as "flag off" and /workspace/ai-fruit-story shows the current tool.

BEGIN;
DROP TABLE IF EXISTS public.user_feature_flags;
DROP FUNCTION IF EXISTS public.user_feature_flags_block_client_writes();
NOTIFY pgrst, 'reload schema';
COMMIT;
