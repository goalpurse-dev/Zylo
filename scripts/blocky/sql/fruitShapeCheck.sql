-- Read-only: the shape of AI Fruit Story's tables and functions that the undo
-- of the template columns changes, and whether anything is in flight.
-- Run before and after it:
--   npx supabase db query --linked -f scripts/blocky/sql/fruitShapeCheck.sql
-- After the undo: template_columns and template_indexes are empty, pick_ideas
-- is "p_seed text, p_count integer", first_name_index is
-- fruit_characters_first_name_key, age_gender_required is age:true, gender:true,
-- and every row count is what it was.
SELECT
  (SELECT coalesce(string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name), '') FROM information_schema.columns WHERE table_schema = 'public' AND table_name LIKE 'fruit%' AND column_name IN ('niche', 'overlay')) AS template_columns,
  (SELECT coalesce(string_agg(indexname, ', ' ORDER BY indexname), '') FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%niche%') AS template_indexes,
  (SELECT string_agg(pg_get_function_identity_arguments(oid), ' | ') FROM pg_proc WHERE proname = 'fruit_pick_ideas') AS pick_ideas,
  (SELECT string_agg(pg_get_function_identity_arguments(oid), ' | ') FROM pg_proc WHERE proname = 'fruit_create_story') AS create_story,
  (SELECT string_agg(indexname, ', ') FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'fruit_characters%first_name%') AS first_name_index,
  (SELECT string_agg(attname || ':' || attnotnull, ', ' ORDER BY attname) FROM pg_attribute WHERE attrelid = 'public.fruit_characters'::regclass AND attname IN ('age', 'gender')) AS age_gender_required,
  (SELECT count(*) FROM public.fruit_characters) AS characters,
  (SELECT count(*) FROM public.fruit_ideas) AS ideas,
  (SELECT count(*) FROM public.fruit_stories) AS stories,
  (SELECT count(*) FROM public.fruit_series) AS series,
  (SELECT count(*) FROM public.fruit_story_scenes) AS scenes,
  (SELECT count(*) FROM public.fruit_jobs WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done')) AS jobs_in_flight,
  (SELECT count(*) FROM public.fruit_stories WHERE status = 'building') AS finals_building,
  (SELECT string_agg(tool_key, ', ' ORDER BY tool_key) FROM public.tool_prices WHERE tool_key LIKE '%blocky%') AS blocky_price_rows,
  (SELECT enabled FROM public.global_feature_flags WHERE key = 'blocky_v1') AS blocky_v1_global;
