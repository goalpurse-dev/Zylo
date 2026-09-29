-- Rollback for 20260927104458_fruit_characters.sql (drops the table and its data).
BEGIN;
DROP TABLE IF EXISTS public.fruit_characters;
DROP FUNCTION IF EXISTS public.fruit_characters_block_client_writes();
NOTIFY pgrst, 'reload schema';
COMMIT;
