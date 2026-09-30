-- Rollback for 20260930145043_fruit_create_story.sql
BEGIN;
DROP FUNCTION IF EXISTS public.fruit_create_story(uuid, jsonb, jsonb, uuid[]);
ALTER TABLE public.fruit_stories DROP COLUMN IF EXISTS planner;
NOTIFY pgrst, 'reload schema';
COMMIT;
