-- Content Machine round 5 (PGlite, scripts/contentMachine/sqlCheck.mjs): the subtitles tag on assets and the
-- simpler meme prompt.
DO $$
DECLARE ok boolean;
BEGIN
  INSERT INTO public.cm_assets (ref, path, source_path, sha256, content_type, kind, tool, status, subtitles)
  VALUES ('r5sub001', 'library/r5sub001.webp', 'public/lp/fruit/x.webp', 'sha-r5-1', 'image/webp', 'output', 'ai_fruit_story', 'active', 'cut');
  ok := false;
  BEGIN
    INSERT INTO public.cm_assets (ref, path, source_path, sha256, content_type, kind, status, subtitles)
    VALUES ('r5sub002', 'library/r5sub002.webp', 'x', 'sha-r5-2', 'image/webp', 'output', 'active', 'maybe');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'subtitles accepted a value outside none/full/cut'; END IF;
  IF (SELECT spec->>'hero_prompt' FROM public.cm_library WHERE kind = 'style' AND key = 'meme_style') NOT LIKE '%never a crowd%' THEN
    RAISE EXCEPTION 'the meme prompt was not updated';
  END IF;
  DELETE FROM public.cm_assets WHERE ref = 'r5sub001';
END $$;
