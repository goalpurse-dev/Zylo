-- Back to provider names only. Blocky's own alert rows are removed first, or the old rule can't be put back.
DELETE FROM public.blocky_provider_alerts WHERE provider LIKE 'blocky:%';
ALTER TABLE public.blocky_provider_alerts DROP CONSTRAINT IF EXISTS blocky_provider_alerts_provider_check;
ALTER TABLE public.blocky_provider_alerts ADD CONSTRAINT blocky_provider_alerts_provider_check
  CHECK (provider = ANY (ARRAY['runware'::text, 'anthropic'::text, 'openai'::text]));
