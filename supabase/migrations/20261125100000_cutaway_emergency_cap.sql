-- Cutaway Explainer: no money limit per user (the owner, 2026-10-25). A paying user with credits is never stopped by
-- a cap of their own. What is left in cutaway_settings: the paid-calls switch, ONE emergency cap for everyone together
-- ($20 of our provider cost in 24 h, raised by the owner on /admin/ops; emails at 50 % and 80 %), two videos at once per
-- user, and the starts-per-hour abuse limit. The 3-hour cap, the per-user daily dollars, the fail-streak pause and the
-- site-wide running limit are gone.
ALTER TABLE public.cutaway_settings ALTER COLUMN daily_cap_usd SET DEFAULT 20;
UPDATE public.cutaway_settings SET daily_cap_usd = 20, updated_at = now() WHERE id = 1;

ALTER TABLE public.cutaway_settings
  DROP COLUMN IF EXISTS window_cap_usd,
  DROP COLUMN IF EXISTS user_daily_usd,
  DROP COLUMN IF EXISTS user_fail_streak,
  DROP COLUMN IF EXISTS fail_pause_min,
  DROP COLUMN IF EXISTS max_running;
