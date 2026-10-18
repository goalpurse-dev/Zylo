-- Content Machine, round 5 (owner, 2026-10-18):
--   cm_assets.subtitles   burned-in subtitles on a frame: none / full / cut (cut off mid-sentence). The writer
--                         never gets a "cut" frame and prefers "none". Set by the fast model when tagging.
--   meme_style            simpler scenes: one or two invented characters, no crowds, nothing branded,
--                         screens with a plain glow (the first meme run showed a laptop logo and a crowd).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.cm_assets ADD COLUMN IF NOT EXISTS subtitles text;
ALTER TABLE public.cm_assets DROP CONSTRAINT IF EXISTS cm_assets_subtitles_check;
ALTER TABLE public.cm_assets ADD CONSTRAINT cm_assets_subtitles_check CHECK (subtitles IS NULL OR subtitles IN ('none', 'full', 'cut'));

UPDATE public.cm_library
SET spec = spec || '{"hero_prompt": "Simple meme-style cartoon scene: {subject}. One or two invented cartoon characters at most, never a crowd, exaggerated expressions, plain unbranded laptop, phone and clothes, any screen shows a soft plain colour glow, simple flat colourful background, comic look", "bg_prompt": "simple flat colourful cartoon background, an empty room corner with a plain desk, no people, no devices with logos"}'::jsonb,
    updated_at = now()
WHERE kind = 'style' AND key = 'meme_style';

COMMIT;
