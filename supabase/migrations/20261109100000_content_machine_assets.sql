-- Content Machine, round 3 (owner, 2026-10-18). Additive: a new table, wider status/kind lists, new
-- defaults, and updates to the machine's own rows (settings, library). Nothing else is touched.
-- Rollback: supabase/rollbacks/20261109100000_content_machine_assets_rollback.sql
--
--   cm_assets      the asset library: real Zyvo outputs and UI from the repo, in the private bucket
--                  (library/...), tagged by the fast model. Usable by default; anything showing a real
--                  person, a celebrity or a lookalike, or a third-party character or brand, is excluded
--                  automatically; the owner can block any asset.
--   cm_runs/ideas  a run or slideshow can be CANCELLED (Start → Cancel); a run can be a style SAMPLES run.
--   cm_settings    the automatic run at 08:00 Helsinki (was 07:00).
--   brand rules    stories are hypothetical ("Imagine…", "POV: you…") or about "you", never a made-up person.
--   cm_library     each visual style says how its pictures look (hero_prompt), and neon gets a background.
BEGIN;
SET LOCAL lock_timeout = '5s';

/* ─── the asset library ──────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,                          -- the short id the writer uses (first 8 of the sha)
  path text NOT NULL UNIQUE,                         -- in the private content-machine bucket
  source_path text NOT NULL,                         -- where it came from in the repo
  sha256 text NOT NULL UNIQUE,
  content_type text NOT NULL,
  bytes integer,
  width integer,
  height integer,
  kind text NOT NULL DEFAULT 'output' CHECK (kind IN ('output', 'ui', 'character', 'thumbnail', 'scene')),
  tool text,                                         -- which Zyvo tool made it (ai_fruit_story, long_form, …)
  style text,
  subject text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'excluded', 'blocked')),
  exclude_reason text,
  tagged_at timestamptz,
  blocked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_assets_status_tool ON public.cm_assets (status, tool);

/* ─── cancel, and the samples run ────────────────────────────────────── */
ALTER TABLE public.cm_runs DROP CONSTRAINT IF EXISTS cm_runs_status_check;
ALTER TABLE public.cm_runs ADD CONSTRAINT cm_runs_status_check CHECK (status IN ('pending', 'scouting', 'ideating', 'producing', 'packaging', 'done', 'failed', 'budget_stopped', 'cancelled'));
ALTER TABLE public.cm_runs DROP CONSTRAINT IF EXISTS cm_runs_kind_check;
ALTER TABLE public.cm_runs ADD CONSTRAINT cm_runs_kind_check CHECK (kind IN ('daily', 'slideshows', 'manual', 'samples'));
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_status_check;
ALTER TABLE public.cm_ideas ADD CONSTRAINT cm_ideas_status_check CHECK (status IN ('proposed', 'approved', 'rejected', 'producing', 'done', 'failed', 'skipped_budget', 'cancelled'));

/* ─── 08:00 ──────────────────────────────────────────────────────────── */
ALTER TABLE public.cm_settings ALTER COLUMN run_time_local SET DEFAULT '08:00';
UPDATE public.cm_settings SET run_time_local = '08:00' WHERE run_time_local = '07:00';

/* ─── honest stories ─────────────────────────────────────────────────── */
UPDATE public.cm_settings
   SET brand_rules = brand_rules || E'\n- Stories are clearly hypothetical ("Imagine…", "POV: you…") or about "you" (the viewer). Never a made-up real person ("She edited for 6 hours… 212 views" reads like a real testimonial).'
 WHERE brand_rules NOT LIKE '%clearly hypothetical%';
UPDATE public.cm_library
   SET description = 'A tiny story told over the slides with a twist at the end. Always hypothetical ("Imagine…", "POV: you…") or about "you": never a made-up real person.', updated_at = now()
 WHERE kind = 'format' AND key = 'mini_story';

/* ─── how each style's pictures look ─────────────────────────────────── */
UPDATE public.cm_library SET spec = spec || '{"hero_prompt": "Cinematic photoreal shot: {subject}. Luxury interior or city at night, warm practical lights, shallow depth of field, 35mm film look, no people", "visual": "cinematic photoreal interiors and cityscapes"}'::jsonb, updated_at = now() WHERE kind = 'style' AND key = 'luxury_night';
UPDATE public.cm_library SET spec = spec || '{"hero_prompt": "Glowing 3D render of {subject}, a single object floating, neon purple and lime rim light, glossy materials, dark background, centered, studio render", "visual": "glowing 3D objects and icons (camera, play button, rocket, clapperboard…)", "bg_prompt": "abstract dark background, faint perspective grid floor, soft neon purple glow, lots of empty space, no objects, no text"}'::jsonb, updated_at = now() WHERE kind = 'style' AND key = 'neon_grid';
UPDATE public.cm_library SET spec = spec || '{"hero_prompt": "Clean product-style 3D render of {subject}, soft studio light, pastel accents, off-white seamless background, minimal, centered", "visual": "clean product-style renders and illustrations"}'::jsonb, updated_at = now() WHERE kind = 'style' AND key = 'minimal_clean';
UPDATE public.cm_library SET spec = spec || '{"hero_prompt": "Flat editorial illustration of {subject}, cut-paper collage look, dark background", "visual": "real Zyvo UI and real Zyvo outputs from the asset library (asset_id); a generated illustration only when no asset fits", "assets_first": true}'::jsonb, updated_at = now() WHERE kind = 'style' AND key = 'screenshot_collage';
UPDATE public.cm_library SET spec = spec || '{"hero_prompt": "Meme-style cartoon scene: {subject}. Invented cartoon characters with exaggerated expressions, simple colourful background, comic look", "visual": "generated meme-style scenes"}'::jsonb, updated_at = now() WHERE kind = 'style' AND key = 'meme_style';

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.cm_assets ENABLE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON public.cm_assets FROM PUBLIC, anon, authenticated';
END $$;

COMMIT;
