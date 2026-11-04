-- Content Machine: the Studio view of Analytics (owner, 2026-11-04). Studio videos (rage hook, trend how-to, the
-- story angles) learn on their own: their own median, winners and retire suggestions on the Studio score, and their
-- own playbook, which the Studio writer follows.
--   cm_analyses.account  'studio': "Let the agent analyze" in the Studio view reads only Studio videos
--   cm_settings          studio_playbook (+ when and by whom it was saved)
--   cm_post_stats        top_countries: the top viewer countries as the analytics screen shows them ("US 41, GB 9")
-- Additive only.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.cm_analyses DROP CONSTRAINT IF EXISTS cm_analyses_account_check;
ALTER TABLE public.cm_analyses ADD CONSTRAINT cm_analyses_account_check CHECK (account IN ('creator', 'zyvo', 'both', 'studio'));

ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS studio_playbook text NOT NULL DEFAULT '';
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS studio_playbook_updated_at timestamptz;
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS studio_playbook_by text;

ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS top_countries text CHECK (top_countries IS NULL OR length(top_countries) <= 200);

COMMIT;
