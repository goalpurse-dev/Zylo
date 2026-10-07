-- DRY RUN on the real database, always rolled back: picks an idea batch and
-- calls fruit_create_story the way the live fruit-story-api does, counts what
-- it wrote, then raises an exception so the whole transaction is undone.
-- Nothing is kept. The "error" it ends with IS the result:
--   DRY RUN OK (rolled back): 5 ideas picked; ... a story with 2 scenes; ...
-- Run before and after the undo of the template columns:
--   npx supabase db query --linked -f scripts/blocky/sql/fruitCreateStoryDryRun.sql
DO $$
DECLARE
  v_user uuid;
  v_id uuid;
  v_scenes integer;
  v_before integer;
  v_ideas integer;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'upwardlift6@gmail.com';
  SELECT count(*) INTO v_before FROM public.fruit_stories;
  -- The idea batch, called by name with the two arguments the live API sends.
  SELECT count(*) INTO v_ideas FROM public.fruit_pick_ideas(p_seed := v_user::text || ':0', p_count := 5);
  v_id := public.fruit_create_story(
    v_user,
    '{"source":"prompt","input":{"source":"prompt","prompt":"dry run"},"title":"Dry run","cast_ids":["mia","marco"],"quality":"v2","length_sec":15,"aspect":"9:16","locations":[{"id":"loc1","description":"a kitchen","timeOfDay":"morning","lighting":"soft light"}],"planner":{}}'::jsonb,
    '[{"title":"One","speaker_id":"mia","line":"Table for two, Marco?","present_ids":["mia","marco"],"location_id":"loc1","action":"holds up a receipt","emotion":"icy calm","shot":"close-up","placement":"","duration_sec":4},{"title":"Two","speaker_id":"marco","line":"It was a client dinner.","present_ids":["marco","mia"],"location_id":"loc1","action":"loosens his collar","emotion":"panicked","shot":"close-up","placement":"","duration_sec":4}]'::jsonb,
    '{}'::uuid[]
  );
  SELECT count(*) INTO v_scenes FROM public.fruit_story_scenes WHERE story_id = v_id;
  RAISE EXCEPTION 'DRY RUN OK (rolled back): % ideas picked; fruit_create_story made a story with % scenes; stories before=%', v_ideas, v_scenes, v_before;
END $$;
