-- Content Machine: the two accounts (PGlite, scripts/contentMachine/sqlCheck.mjs).
DO $$
DECLARE i uuid;
BEGIN
  IF (SELECT count(*) FROM public.cm_lanes) <> 2 THEN RAISE EXCEPTION 'two lanes expected'; END IF;
  IF (SELECT slideshows_per_day FROM public.cm_lanes WHERE key = 'zyvo') <> 2 OR (SELECT slideshows_per_day FROM public.cm_lanes WHERE key = 'creator') <> 3 THEN RAISE EXCEPTION 'lane counts'; END IF;
  IF (SELECT brand_rules FROM public.cm_lanes WHERE key = 'creator') <> (SELECT brand_rules FROM public.cm_settings WHERE id) THEN RAISE EXCEPTION 'the creator lane takes the existing brand rules'; END IF;
  IF (SELECT slideshows_per_day FROM public.cm_settings WHERE id) <> 5 THEN RAISE EXCEPTION 'the total follows the lanes'; END IF;
  IF (SELECT count(*) FROM public.cm_facts WHERE status = 'active') < 30 THEN RAISE EXCEPTION 'the fact sheet is seeded'; END IF;
  IF (SELECT count(*) FROM public.cm_facts WHERE category = 'not_feature') <> 4 THEN RAISE EXCEPTION 'four NOT-features'; END IF;
  IF NOT (SELECT lanes = '{zyvo}' FROM public.cm_library WHERE kind = 'format' AND key = 'how_it_works') THEN RAISE EXCEPTION 'Zyvo formats are Zyvo-only'; END IF;
  IF NOT (SELECT lanes = '{creator}' FROM public.cm_library WHERE kind = 'format' AND key = 'tool_listicle') THEN RAISE EXCEPTION 'creator formats stay creator'; END IF;
  IF NOT (SELECT lanes @> '{creator,zyvo}' FROM public.cm_library WHERE kind = 'hook' AND key = 'question') THEN RAISE EXCEPTION 'hooks are shared'; END IF;
  INSERT INTO public.cm_ideas (status, title, format) VALUES ('done', 'An old one', 'meme') RETURNING id INTO i;
  IF (SELECT account FROM public.cm_ideas WHERE id = i) <> 'creator' THEN RAISE EXCEPTION 'existing slideshows are Creator'; END IF;
  BEGIN
    UPDATE public.cm_ideas SET account = 'other' WHERE id = i;
    RAISE EXCEPTION 'an unknown account was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.cm_facts (key, claim, source) VALUES ('Bad Key', 'Something true here', 'x/y.js');
    RAISE EXCEPTION 'a malformed fact key was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  DELETE FROM public.cm_ideas WHERE id = i;
END $$;
