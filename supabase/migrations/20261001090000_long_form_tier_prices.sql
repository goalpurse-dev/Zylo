-- Long Form tier prices and plan tiers in public.tool_prices, so the server
-- (quote-long-form-project, create-long-form-production-setup,
-- save-long-form-scene-tier) and the pricing page read ONE source.
-- flat_credits = credits PER MINUTE of finished video; a project costs
-- ceil(flat_credits × minutes) (estimateLongFormProjectQuote). These keys are
-- never used as a job tool_key, so no job is priced from them.
-- Rollback: supabase/rollbacks/20261001090000_long_form_tier_prices.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes)
VALUES
  ('longform:v2', NULL, 25, NULL, NULL, NULL, 'starter',    true, 'Long Form V2 — credits PER MINUTE of video (FLUX.2 Klein scenes)'),
  ('longform:v3', NULL, 75, NULL, NULL, NULL, 'pro',        true, 'Long Form V3 — credits PER MINUTE of video (Kling Image O3 scenes)'),
  ('longform:v4', NULL, 90, NULL, NULL, NULL, 'generative', true, 'Long Form V4 — credits PER MINUTE of video (Seedream 5.0 Lite scenes)')
ON CONFLICT (tool_key) DO UPDATE
  SET flat_credits = EXCLUDED.flat_credits, credits_per_second = NULL, min_plan = EXCLUDED.min_plan,
      active = true, notes = EXCLUDED.notes, updated_at = now();

COMMIT;
