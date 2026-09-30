-- AI Fruit Story v2 stage 3f: final video on a per-job Fly machine.
--   * fruit_stories.final_call_id: the final build in flight. The machine's
--     report is accepted only for this id (an older build's late report is ignored).
--   * fruit_ai_calls may log the Fly machine run (provider 'fly', its compute cost).
BEGIN;

ALTER TABLE public.fruit_stories ADD COLUMN IF NOT EXISTS final_call_id uuid;

ALTER TABLE public.fruit_ai_calls DROP CONSTRAINT IF EXISTS fruit_ai_calls_provider_check;
ALTER TABLE public.fruit_ai_calls ADD CONSTRAINT fruit_ai_calls_provider_check
  CHECK (provider IN ('runware', 'anthropic', 'openai', 'fly'));

NOTIFY pgrst, 'reload schema';
COMMIT;
