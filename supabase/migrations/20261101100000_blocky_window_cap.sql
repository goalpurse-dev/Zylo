-- Blocky's one spending limit (owner, 2026-10-09): our real cost for ALL Blocky users together in any
-- 3 hours. When it is reached, new stories are asked to wait ("High demand right now"); stories already
-- in progress go on. The number lives here so the owner can raise it on /admin/ops without a code change.
-- Blocky's own settings row only; nobody but the service role can read or write it (as before).
ALTER TABLE public.blocky_settings
  ADD COLUMN IF NOT EXISTS window_cap_usd numeric(8,2) NOT NULL DEFAULT 20.00 CHECK (window_cap_usd > 0);
COMMENT ON COLUMN public.blocky_settings.window_cap_usd IS 'Blocky Stories: our real cost in USD that all users together may cause in any 3 hours (spendWatch.js#WINDOW_HOURS). Raised by the owner on /admin/ops.';
