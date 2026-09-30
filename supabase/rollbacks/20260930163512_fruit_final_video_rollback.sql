-- Rollback of the stage 3f final-video migration.
BEGIN;
DELETE FROM public.fruit_ai_calls WHERE provider = 'fly';
ALTER TABLE public.fruit_ai_calls DROP CONSTRAINT IF EXISTS fruit_ai_calls_provider_check;
ALTER TABLE public.fruit_ai_calls ADD CONSTRAINT fruit_ai_calls_provider_check CHECK (provider IN ('runware', 'anthropic', 'openai'));
ALTER TABLE public.fruit_stories DROP COLUMN IF EXISTS final_call_id;
NOTIFY pgrst, 'reload schema';
COMMIT;
