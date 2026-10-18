-- Content Machine round 6 + Part 2 (PGlite, scripts/contentMachine/sqlCheck.mjs): the Anthropic cap, flawed
-- assets, posted slideshows and stats snapshots.
DO $$
DECLARE i uuid; p uuid; ok boolean;
BEGIN
  IF (SELECT (per_provider_daily_caps->>'anthropic')::numeric FROM public.cm_settings LIMIT 1) <> 2.5 THEN RAISE EXCEPTION 'the Anthropic cap is not 2.50'; END IF;
  IF (SELECT daily_budget_usd FROM public.cm_settings LIMIT 1) <> 3 THEN RAISE EXCEPTION 'the daily total changed'; END IF;

  INSERT INTO public.cm_assets (ref, path, source_path, sha256, content_type, status, flaw_reason)
  VALUES ('r6flaw01', 'library/r6flaw01.webp', 'x', 'sha-r6-1', 'image/webp', 'flawed', 'distorted hands');

  INSERT INTO public.cm_ideas (status, title, format) VALUES ('posted', 'A posted slideshow', 'tool_listicle') RETURNING id INTO i;
  INSERT INTO public.cm_posts (idea_id, platform, post_url, posted_at) VALUES (i, 'tiktok', 'https://www.tiktok.com/@zyvo/photo/1', now() - interval '30 hours') RETURNING id INTO p;
  INSERT INTO public.cm_post_stats (post_id, taken_at, hours_since_post, views, likes, saves, watched_full_pct) VALUES (p, now(), 30, 1200, 80, 12, 41.5);
  ok := false;
  BEGIN
    INSERT INTO public.cm_post_stats (post_id, taken_at, views) VALUES (p, now(), -1);
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'negative views were accepted'; END IF;
  -- Deleting the slideshow removes its posts and their snapshots.
  DELETE FROM public.cm_ideas WHERE id = i;
  IF EXISTS (SELECT 1 FROM public.cm_post_stats WHERE post_id = p) THEN RAISE EXCEPTION 'snapshots outlived their post'; END IF;
  DELETE FROM public.cm_assets WHERE ref = 'r6flaw01';
END $$;
