-- AI Fruit Story v2: out-of-credit guard. When a provider (Runware,
-- Anthropic, OpenAI) refuses work because OUR account is out of balance:
--   * the user's item is refunded at once (no retries, no fallback) with a
--     friendly "temporarily unavailable" message, and can be retried later;
--   * new paid steps are refused BEFORE charging while the alert is fresh
--     (10 minutes since the last refusal), so nobody pays for work that can't run;
--   * one alert row per provider counts the refusals; the edge function emails
--     the admin when an alert opens (first refusal, or first after an hour quiet).
BEGIN;

CREATE TABLE IF NOT EXISTS public.fruit_provider_alerts (
  provider      text PRIMARY KEY CHECK (provider IN ('runware', 'anthropic', 'openai')),
  code          text NOT NULL DEFAULT '',
  message       text NOT NULL DEFAULT '',
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  count         integer NOT NULL DEFAULT 0,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  notified_at   timestamptz
);
ALTER TABLE public.fruit_provider_alerts ENABLE ROW LEVEL SECURITY;   -- no policies: service role only
REVOKE ALL ON public.fruit_provider_alerts FROM anon, authenticated;

-- Records one refusal. Returns true when the admin should be emailed (a new
-- alert, or the first refusal after an hour without one).
CREATE OR REPLACE FUNCTION public.fruit_raise_provider_alert(p_provider text, p_code text, p_message text, p_context jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_prev timestamptz; v_notify boolean;
BEGIN
  SELECT last_seen_at INTO v_prev FROM public.fruit_provider_alerts WHERE provider = p_provider FOR UPDATE;
  v_notify := v_prev IS NULL OR v_prev < now() - interval '1 hour';
  INSERT INTO public.fruit_provider_alerts AS a (provider, code, message, context, count, opened_at, last_seen_at, notified_at)
  VALUES (p_provider, left(coalesce(p_code, ''), 200), left(coalesce(p_message, ''), 1000), coalesce(p_context, '{}'::jsonb), 1, now(), now(), CASE WHEN v_notify THEN now() END)
  ON CONFLICT (provider) DO UPDATE SET
    code = EXCLUDED.code, message = EXCLUDED.message, context = EXCLUDED.context,
    count = CASE WHEN v_notify THEN 1 ELSE a.count + 1 END,
    opened_at = CASE WHEN v_notify THEN now() ELSE a.opened_at END,
    last_seen_at = now(),
    notified_at = CASE WHEN v_notify THEN now() ELSE a.notified_at END;
  RETURN v_notify;
END;
$function$;
REVOKE ALL ON FUNCTION public.fruit_raise_provider_alert(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_raise_provider_alert(text, text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
