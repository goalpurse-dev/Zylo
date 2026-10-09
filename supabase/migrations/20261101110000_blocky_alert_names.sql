-- Blocky's own alerts could not be written (found by the live drill of the 3-hour limit, 2026-10-09):
-- blocky_provider_alerts accepted only the three provider names, so the rows for the spending alarm, the
-- retry alert, "the alarm was cleared" and the 3-hour limit were refused, and with them the owner's email
-- (the email is sent when the row says the alert is new). The alarm still paused paid calls; it just told
-- nobody. The names below are the constants in _shared/blocky/spendWatch.js (a test keeps the two in step).
-- Blocky's own table only.
ALTER TABLE public.blocky_provider_alerts DROP CONSTRAINT IF EXISTS blocky_provider_alerts_provider_check;
ALTER TABLE public.blocky_provider_alerts ADD CONSTRAINT blocky_provider_alerts_provider_check
  CHECK (provider = ANY (ARRAY['runware'::text, 'anthropic'::text, 'openai'::text, 'blocky:spend'::text, 'blocky:retries'::text, 'blocky:spend-cleared'::text, 'blocky:window'::text]));
