-- Undo of 20261027100000_blocky_story_options.sql (three versions to choose from, vetted plans).
-- Drafts and vetted plans are lost; stories already made from a draft are not touched.
DROP FUNCTION IF EXISTS public.blocky_set_draft_version(uuid, jsonb, numeric, uuid[]);
DROP TABLE IF EXISTS public.blocky_drafts;
DROP TABLE IF EXISTS public.blocky_plans;
