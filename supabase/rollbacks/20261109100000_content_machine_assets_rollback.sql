-- Removes round 3 of the Content Machine (20261109100000_content_machine_assets.sql): the asset library
-- table (the files in the bucket's library/ folder stay; delete them in the dashboard if wanted) and the
-- wider status lists. Rows that use 'cancelled' or 'samples' must be changed first, or the constraints fail.
-- The 08:00 time, the brand-rule line and the style descriptions are left as they are (harmless).
BEGIN;
DROP TABLE IF EXISTS public.cm_assets;
UPDATE public.cm_runs SET status = 'failed' WHERE status = 'cancelled';
UPDATE public.cm_ideas SET status = 'failed' WHERE status = 'cancelled';
DELETE FROM public.cm_runs WHERE kind = 'samples';
ALTER TABLE public.cm_runs DROP CONSTRAINT IF EXISTS cm_runs_status_check;
ALTER TABLE public.cm_runs ADD CONSTRAINT cm_runs_status_check CHECK (status IN ('pending', 'scouting', 'ideating', 'producing', 'packaging', 'done', 'failed', 'budget_stopped'));
ALTER TABLE public.cm_runs DROP CONSTRAINT IF EXISTS cm_runs_kind_check;
ALTER TABLE public.cm_runs ADD CONSTRAINT cm_runs_kind_check CHECK (kind IN ('daily', 'slideshows', 'manual'));
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_status_check;
ALTER TABLE public.cm_ideas ADD CONSTRAINT cm_ideas_status_check CHECK (status IN ('proposed', 'approved', 'rejected', 'producing', 'done', 'failed', 'skipped_budget'));
COMMIT;
