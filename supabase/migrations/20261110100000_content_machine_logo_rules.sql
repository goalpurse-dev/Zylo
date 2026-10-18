-- Content Machine: how each tool's mark is shown (owner, 2026-10-18). Additive: one column with a default.
--   logo  the approved official file (the default; still needs the owner's approval to be used)
--   tile  the initials tile, whatever file there is (Seedance, Hailuo)
--   name  the name only, no mark at all (Veo, Midjourney)
-- Rollback: ALTER TABLE public.cm_logos DROP COLUMN IF EXISTS display;
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.cm_logos ADD COLUMN IF NOT EXISTS display text NOT NULL DEFAULT 'logo' CHECK (display IN ('logo', 'tile', 'name'));
UPDATE public.cm_logos SET display = 'name', updated_at = now() WHERE domain IN ('deepmind.google', 'midjourney.com');
UPDATE public.cm_logos SET display = 'tile', updated_at = now() WHERE domain IN ('seed.bytedance.com', 'hailuoai.video');
COMMIT;
