-- Rollback of 20261112100000_content_machine_round5.sql
BEGIN;
ALTER TABLE public.cm_assets DROP CONSTRAINT IF EXISTS cm_assets_subtitles_check;
ALTER TABLE public.cm_assets DROP COLUMN IF EXISTS subtitles;
UPDATE public.cm_library
SET spec = spec || '{"hero_prompt": "Meme-style cartoon scene: {subject}. Invented cartoon characters with exaggerated expressions, simple colourful background, comic look", "bg_prompt": "funny relatable scene illustration, expressive cartoon character at a desk with a laptop, simple background, no text"}'::jsonb,
    updated_at = now()
WHERE kind = 'style' AND key = 'meme_style';
COMMIT;
