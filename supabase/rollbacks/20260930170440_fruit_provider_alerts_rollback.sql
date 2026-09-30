BEGIN;
DROP FUNCTION IF EXISTS public.fruit_raise_provider_alert(text, text, text, jsonb);
DROP TABLE IF EXISTS public.fruit_provider_alerts;
NOTIFY pgrst, 'reload schema';
COMMIT;
