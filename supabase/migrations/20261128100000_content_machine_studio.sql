-- Content Machine: the Studio tab (owner, 2026-10-30). Short "how I made this with Zyvo" videos, made on the laptop
-- by a local studio worker ($0 render) from the owner's own finished creations (reuse first, no generation cost).
--   cm_studio_jobs     one video to make: the template, the recipe (hook type, length, end trigger, loop), the real
--                      creation it reuses (or "generate": waits for the owner's go with the cost), the estimate, the
--                      worker's progress, the Queue item it became
--   cm_studio_workers  the laptop worker's heartbeat (the tab says whether jobs will be picked up)
--   cm_post_stats      the TikTok retention graph: % still watching at 3 / 5 / 10 s and the biggest drop-off second
--   cm_settings        studio_batch_size ("Let AI decide": 3 winning recipes + 2 experiments), studio_rate_frame0
--                      (the worker asks the fast model to rate frame 0: paid, about $0.0005 a video; off by default)
-- Additive only.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.cm_studio_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid,                                   -- the jobs one "Start" made together
  template text NOT NULL CHECK (template ~ '^[a-z][a-z0-9_]{1,40}$'),
  mode text NOT NULL DEFAULT 'prompt' CHECK (mode IN ('ai_decide', 'prompt')),
  prompt text,                                     -- what the owner typed (or null for "Let AI decide")
  recipe jsonb NOT NULL DEFAULT '{}',              -- {variant, hook_type, length_s, end_trigger, loop, experiment_of, changes}
  source jsonb,                                    -- the reused creation {kind: "fruit_story", id, title, final_url, skip_scenes} or {kind: "generate"}
  estimate jsonb NOT NULL DEFAULT '{}',            -- {usd, minutes, generation_usd, why}
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('waiting_go', 'queued', 'claimed', 'done', 'failed', 'cancelled')),
  progress text,                                   -- the worker's current step, for the tab
  worker text,
  heartbeat_at timestamptz,
  idea_id uuid REFERENCES public.cm_ideas (id) ON DELETE SET NULL,   -- the Queue item it became
  spend_usd numeric NOT NULL DEFAULT 0,
  error text,
  approved_by text,                                -- who said go to a paid generation
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_studio_jobs_status ON public.cm_studio_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS cm_studio_jobs_created ON public.cm_studio_jobs (created_at DESC);
ALTER TABLE public.cm_studio_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_studio_jobs FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cm_studio_workers (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 60),
  last_seen timestamptz NOT NULL DEFAULT now(),
  info jsonb NOT NULL DEFAULT '{}'                 -- {host, gpu, version}
);
ALTER TABLE public.cm_studio_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cm_studio_workers FROM PUBLIC, anon, authenticated;

ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS hold_3s_pct numeric CHECK (hold_3s_pct >= 0 AND hold_3s_pct <= 100);
ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS hold_5s_pct numeric CHECK (hold_5s_pct >= 0 AND hold_5s_pct <= 100);
ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS hold_10s_pct numeric CHECK (hold_10s_pct >= 0 AND hold_10s_pct <= 100);
ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS dropoff_s numeric CHECK (dropoff_s >= 0);
ALTER TABLE public.cm_post_stats ADD COLUMN IF NOT EXISTS retention_screenshot_path text;   -- posts/<post id>/<stats id>_retention.png

ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS studio_batch_size integer NOT NULL DEFAULT 5 CHECK (studio_batch_size BETWEEN 1 AND 10);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS studio_rate_frame0 boolean NOT NULL DEFAULT false;

COMMIT;
