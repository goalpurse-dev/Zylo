-- Rollback for 20260930151906_fruit_staging_and_test_override.sql.
-- Re-apply 20260927123135 (fruit_charge_step) and 20260930145043 (fruit_create_story)
-- function bodies after running this, to restore the previous versions.
BEGIN;
ALTER TABLE public.fruit_jobs DROP COLUMN IF EXISTS test_override_id;
DROP TABLE IF EXISTS public.fruit_test_overrides;
ALTER TABLE public.fruit_story_scenes DROP COLUMN IF EXISTS placement;
NOTIFY pgrst, 'reload schema';
COMMIT;
