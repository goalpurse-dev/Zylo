-- Rollback of 20261113100000_content_machine_posts.sql (drops every stats snapshot).
BEGIN;
DROP TABLE IF EXISTS public.cm_post_stats;
DROP INDEX IF EXISTS public.cm_posts_idea;
DROP INDEX IF EXISTS public.cm_posts_posted_at;
ALTER TABLE public.cm_posts DROP COLUMN IF EXISTS posted_by;
ALTER TABLE public.cm_posts DROP COLUMN IF EXISTS idea_id;
UPDATE public.cm_ideas SET status = 'done' WHERE status = 'posted';
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_status_check;
ALTER TABLE public.cm_ideas ADD CONSTRAINT cm_ideas_status_check CHECK (status IN ('proposed', 'approved', 'rejected', 'producing', 'done', 'failed', 'skipped_budget', 'cancelled'));
UPDATE public.cm_assets SET status = 'active' WHERE status = 'flawed';
ALTER TABLE public.cm_assets DROP CONSTRAINT IF EXISTS cm_assets_status_check;
ALTER TABLE public.cm_assets ADD CONSTRAINT cm_assets_status_check CHECK (status IN ('pending', 'active', 'excluded', 'blocked'));
ALTER TABLE public.cm_assets DROP COLUMN IF EXISTS flaw_reason;
ALTER TABLE public.cm_settings ALTER COLUMN per_provider_daily_caps SET DEFAULT '{"runware": 2, "anthropic": 1.5, "fly": 0.5, "apify": 0.5}'::jsonb;
UPDATE public.cm_settings SET per_provider_daily_caps = per_provider_daily_caps || '{"anthropic": 1.5}'::jsonb;
COMMIT;
