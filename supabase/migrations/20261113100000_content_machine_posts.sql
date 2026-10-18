-- Content Machine, round 6 + Part 2 start (owner, 2026-10-18):
--   cm_settings       the Anthropic cap per day goes to $2.50 (writing is 85–99 % of the cost); $3/day and
--                     $90/month stay.
--   cm_assets         status "flawed" (+ flaw_reason): the vision QA found an artifact in a real Zyvo output;
--                     it is no longer offered to the writer; the owner can unflag it.
--   cm_ideas          status "posted": a slideshow marked as posted leaves Today for the Posted tab.
--   cm_posts          linked to the slideshow (idea_id); several posts per slideshow (one per platform).
--   cm_post_stats     one row per stats update (a snapshot): its own editable time, the numbers, hours since
--                     posting, and the pasted screenshot (private bucket) when the numbers came from one.
BEGIN;
SET LOCAL lock_timeout = '5s';

/* ─── the Anthropic cap ──────────────────────────────────────────────── */
ALTER TABLE public.cm_settings ALTER COLUMN per_provider_daily_caps SET DEFAULT '{"runware": 2, "anthropic": 2.5, "fly": 0.5, "apify": 0.5}'::jsonb;
UPDATE public.cm_settings
SET per_provider_daily_caps = per_provider_daily_caps || '{"anthropic": 2.5}'::jsonb, updated_at = now()
WHERE COALESCE((per_provider_daily_caps->>'anthropic')::numeric, 0) < 2.5;

/* ─── flawed assets ──────────────────────────────────────────────────── */
ALTER TABLE public.cm_assets ADD COLUMN IF NOT EXISTS flaw_reason text;
ALTER TABLE public.cm_assets DROP CONSTRAINT IF EXISTS cm_assets_status_check;
ALTER TABLE public.cm_assets ADD CONSTRAINT cm_assets_status_check CHECK (status IN ('pending', 'active', 'excluded', 'blocked', 'flawed'));

/* ─── posted ─────────────────────────────────────────────────────────── */
ALTER TABLE public.cm_ideas DROP CONSTRAINT IF EXISTS cm_ideas_status_check;
ALTER TABLE public.cm_ideas ADD CONSTRAINT cm_ideas_status_check CHECK (status IN ('proposed', 'approved', 'rejected', 'producing', 'done', 'failed', 'skipped_budget', 'cancelled', 'posted'));

ALTER TABLE public.cm_posts ADD COLUMN IF NOT EXISTS idea_id uuid REFERENCES public.cm_ideas (id) ON DELETE CASCADE;
ALTER TABLE public.cm_posts ADD COLUMN IF NOT EXISTS posted_by text;
CREATE INDEX IF NOT EXISTS cm_posts_idea ON public.cm_posts (idea_id);
CREATE INDEX IF NOT EXISTS cm_posts_posted_at ON public.cm_posts (posted_at DESC);

CREATE TABLE IF NOT EXISTS public.cm_post_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.cm_posts (id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL,                 -- when the numbers were read (Helsinki in the page)
  hours_since_post numeric,                      -- taken_at − posted_at, kept in sync on every save
  views integer CHECK (views >= 0),
  likes integer CHECK (likes >= 0),
  comments integer CHECK (comments >= 0),
  shares integer CHECK (shares >= 0),
  saves integer CHECK (saves >= 0),
  avg_watch_sec numeric CHECK (avg_watch_sec >= 0),
  watched_full_pct numeric CHECK (watched_full_pct >= 0 AND watched_full_pct <= 100),
  profile_visits integer CHECK (profile_visits >= 0),
  new_followers integer CHECK (new_followers >= 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'screenshot')),
  screenshot_path text,                          -- private bucket: posts/<post id>/<stats id>.png
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_post_stats_post ON public.cm_post_stats (post_id, taken_at);
ALTER TABLE public.cm_post_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_post_stats FROM PUBLIC, anon, authenticated;

COMMIT;
