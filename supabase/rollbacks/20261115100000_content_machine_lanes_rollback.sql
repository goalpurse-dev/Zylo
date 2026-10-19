-- Rollback of 20261115100000_content_machine_lanes.sql (drops the lanes, the fact sheet and the Zyvo formats).
BEGIN;
ALTER TABLE public.cm_generations DROP COLUMN IF EXISTS layout_version;
ALTER TABLE public.cm_post_stats DROP COLUMN IF EXISTS link_clicks;
ALTER TABLE public.cm_assets DROP COLUMN IF EXISTS prompt;
DELETE FROM public.cm_library WHERE key IN ('feature_hero', 'style_grid', 'how_it_works', 'feature_spotlight', 'prompt_result', 'template_showcase', 'by_hand_vs_zyvo', 'zyvo_brand', 'benefit_promise', 'show_the_result');
ALTER TABLE public.cm_library DROP COLUMN IF EXISTS lanes;
ALTER TABLE public.cm_analyses DROP COLUMN IF EXISTS account;
ALTER TABLE public.cm_posts DROP COLUMN IF EXISTS account;
ALTER TABLE public.cm_runs DROP COLUMN IF EXISTS account;
DROP INDEX IF EXISTS public.cm_ideas_account_created;
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_account_check;
ALTER TABLE public.cm_ideas DROP COLUMN IF EXISTS account;
DROP TABLE IF EXISTS public.cm_facts;
DROP TABLE IF EXISTS public.cm_lanes;
COMMIT;
