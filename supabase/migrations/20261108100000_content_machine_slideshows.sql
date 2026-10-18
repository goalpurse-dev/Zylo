-- Content Machine, Phase 2: slideshow experiments. Additive only: new tables, new columns with defaults,
-- new functions, one cron job. Nothing existing is dropped or rewritten.
-- Rollback: supabase/rollbacks/20261108100000_content_machine_slideshows_rollback.sql
--
--   cm_library   the format / visual style / hook-type library (seeded here, edited in admin; the agent
--                may PROPOSE new entries, which wait as status 'proposed' until the owner accepts them)
--   cm_ideas     + the experiment recipe of every slideshow (format, hook, style, topic, Zyvo placement,
--                platform, hypothesis), so Phase 3 can learn from real stats
--   cm_settings  + experiment phase length, the automatic daily run, winners vs experiments per day
--   cm_claim_jobs  the worker's queue claim (FOR UPDATE SKIP LOCKED, a lease, attempts)
--   private.trigger_content_machine  the minute tick: calls content-machine-worker only when there is
--                work (a due job, or today's 07:00 run not made yet). Its address and secret live in the
--                vault (cm_worker_url, cm_worker_secret); until both are set the tick does nothing.
BEGIN;
SET LOCAL lock_timeout = '5s';

/* ─── the library ────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('format', 'style', 'hook')),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  spec jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'proposed', 'retired')),
  source text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'agent', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, key)
);

INSERT INTO public.cm_library (kind, key, name, description, spec) VALUES
  ('format', 'tool_listicle', 'Tool listicle cards', 'Cover hook, one card per real tool (icon tile with the name, one accurate line on what it does), CTA slide.', '{"slides": [6, 8], "layout": "cards", "zyvo": "one genuine entry, position varies"}'),
  ('format', 'numbered_steps', 'Aesthetic background + numbered steps', 'A calm aesthetic background with big numbered steps, e.g. "How I''d start YT automation from scratch".', '{"slides": [6, 8], "layout": "steps", "zyvo": "the step where the video gets made"}'),
  ('format', 'pov_text', 'POV text', 'Short first-person POV lines over a mood background, one beat per slide.', '{"slides": [4, 6], "layout": "text", "zyvo": "the turn of the story or the last slide"}'),
  ('format', 'wish_i_knew', 'Things I wish I knew before…', 'Hard-won lessons, one per slide, about starting faceless content or AI video.', '{"slides": [6, 8], "layout": "text", "zyvo": "one lesson about making videos faster"}'),
  ('format', 'mistakes', 'Mistakes to avoid', 'Numbered mistakes with the fix under each.', '{"slides": [6, 8], "layout": "steps", "zyvo": "the fix for one mistake"}'),
  ('format', 'myth_fact', 'Myth vs fact', 'Each slide: a common myth, then the fact.', '{"slides": [6, 8], "layout": "versus", "zyvo": "a fact slide or the CTA"}'),
  ('format', 'tool_vs_tool', 'Tool A vs tool B', 'Two real tools compared honestly on 4–5 points, then a verdict by use case.', '{"slides": [6, 8], "layout": "versus", "zyvo": "one side only when the comparison is fair, else the CTA"}'),
  ('format', 'tier_list', 'Tier list', 'Real tools or niches ranked S/A/B/C with one reason each.', '{"slides": [5, 7], "layout": "tiers", "zyvo": "placed where it honestly belongs"}'),
  ('format', 'guess_ai', 'Guess which one is AI', 'Pairs of images; the viewer guesses; the answer comes on the next slide.', '{"slides": [5, 7], "layout": "quiz", "zyvo": "reveal that the AI ones were made with Zyvo"}'),
  ('format', 'before_after', 'Before / after', 'The old way (hours of editing) vs the new way, shown side by side.', '{"slides": [5, 7], "layout": "versus", "zyvo": "the after"}'),
  ('format', 'hot_take', 'Hot take', 'One strong opinion, argued over a few slides, ending on a question for the comments.', '{"slides": [4, 6], "layout": "text", "zyvo": "soft, only in the CTA"}'),
  ('format', 'mini_story', 'Mini story carousel', 'A tiny story told over the slides with a twist at the end.', '{"slides": [6, 8], "layout": "text", "zyvo": "the story''s tool, or the CTA"}'),
  ('format', 'cheat_sheet', 'Cheat sheet ("save this")', 'Dense, useful reference slides people save for later.', '{"slides": [5, 7], "layout": "steps", "zyvo": "one line in the sheet"}'),
  ('format', 'checklist', 'Checklist', 'A checklist with boxes to tick, one theme per slide.', '{"slides": [5, 7], "layout": "checklist", "zyvo": "one item"}'),
  ('format', 'quiz', 'Quiz', 'Questions with the answer on the next slide; ends asking for the score in the comments.', '{"slides": [6, 8], "layout": "quiz", "zyvo": "a question about making videos"}'),
  ('format', 'meme', 'Meme format', 'A relatable meme-style setup and punchline about creator life.', '{"slides": [3, 5], "layout": "meme", "zyvo": "the punchline or the CTA"}'),
  ('format', 'zyvo_showcase', 'Zyvo output showcase', '"Would you watch this?": stills from Zyvo videos, asking the viewer to judge.', '{"slides": [5, 7], "layout": "showcase", "zyvo": "the subject, said plainly"}'),

  ('style', 'luxury_night', 'Luxury dark interiors / city at night', 'Moody luxury interiors, night city lights, warm highlights.', '{"bg_prompt": "moody luxury interior at night, floor-to-ceiling windows, city lights bokeh, cinematic, dark, warm highlights, empty space in the middle, no text, no people", "bg": "#0b0b0f", "fg": "#ffffff", "accent": "#f5c542", "highlight": "#f5c542", "font": "anton"}'),
  ('style', 'neon_grid', 'Dark grid + neon purple (Zyvo brand)', 'Our brand: near-black grid background, neon purple glow, lime accents.', '{"bg_prompt": "abstract dark background, subtle perspective grid, soft neon purple glow, futuristic, minimal, lots of empty space, no text", "bg": "#07060d", "fg": "#ffffff", "accent": "#a855f7", "highlight": "#facc15", "font": "anton", "grid": true}'),
  ('style', 'minimal_clean', 'Minimal clean', 'Off-white background, black type, one accent colour.', '{"bg_prompt": "soft minimal paper texture background, warm off-white, subtle shadow, no objects, no text", "bg": "#f6f3ee", "fg": "#111111", "accent": "#2563eb", "highlight": "#fde047", "font": "inter"}'),
  ('style', 'screenshot_collage', 'Screenshot collage', 'Tilted UI screenshots and cut-outs on a dark board.', '{"bg_prompt": "dark desk mood board background, soft spotlight, paper texture, empty space, no text, no logos", "bg": "#111318", "fg": "#ffffff", "accent": "#22d3ee", "highlight": "#facc15", "font": "anton", "collage": true}'),
  ('style', 'meme_style', 'Meme style', 'White top caption bar, image below, Impact-like type.', '{"bg_prompt": "funny relatable scene illustration, expressive cartoon character at a desk with a laptop, simple background, no text", "bg": "#ffffff", "fg": "#000000", "accent": "#000000", "highlight": "#ffffff", "font": "anton", "meme": true}'),

  ('hook', 'question', 'Question', 'Opens with a question the viewer wants answered.', '{"example": "Why do faceless channels with 10 videos beat ones with 100?"}'),
  ('hook', 'bold_statement', 'Bold statement', 'A flat, confident claim (true, no invented numbers).', '{"example": "You don''t need a camera to start a YouTube channel."}'),
  ('hook', 'number_list', 'Number promise', 'Promises a count: "5 tools that…".', '{"example": "5 free AI tools that replace a video editor"}'),
  ('hook', 'pov', 'POV', 'Puts the viewer in a situation.', '{"example": "POV: you finally automated your channel"}'),
  ('hook', 'warning', 'Warning / mistake', 'Stops the scroll with a warning.', '{"example": "Stop doing this if you run a faceless channel"}'),
  ('hook', 'curiosity_gap', 'Curiosity gap', 'Teases something without saying it.', '{"example": "The tool nobody talks about for faceless videos"}'),
  ('hook', 'contrarian', 'Contrarian', 'Goes against common advice.', '{"example": "Posting every day is killing your channel"}'),
  ('hook', 'relatable_pain', 'Relatable pain', 'Names a pain the viewer has.', '{"example": "Spent 6 hours editing a 60-second video again?"}'),
  ('hook', 'challenge', 'Challenge / quiz', 'Invites the viewer to play.', '{"example": "Only 1 in 10 people can spot the AI image"}'),
  ('hook', 'save_this', 'Save this', 'Signals reference value.', '{"example": "Save this before you start your channel"}')
ON CONFLICT (kind, key) DO NOTHING;

/* ─── the experiment recipe on every idea ────────────────────────────── */
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS recipe jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS hypothesis text;
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false;
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS compliance jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.cm_ideas ADD COLUMN IF NOT EXISTS error text;
CREATE INDEX IF NOT EXISTS cm_ideas_format_style ON public.cm_ideas ((recipe ->> 'format'), (recipe ->> 'style'));

/* ─── settings for the experiment phase and the daily run ────────────── */
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS experiment_days integer NOT NULL DEFAULT 14 CHECK (experiment_days BETWEEN 0 AND 365);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS experiment_started_on date;
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS daily_auto_run boolean NOT NULL DEFAULT true;
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS winners_per_day integer NOT NULL DEFAULT 3 CHECK (winners_per_day BETWEEN 0 AND 50);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS experiments_per_day integer NOT NULL DEFAULT 2 CHECK (experiments_per_day BETWEEN 0 AND 50);
ALTER TABLE public.cm_settings ADD COLUMN IF NOT EXISTS use_batch_for_daily boolean NOT NULL DEFAULT true;

/* ─── the queue claim ────────────────────────────────────────────────── */
-- Due queued jobs, plus running jobs whose lease ran out (the worker died): claimed once each, oldest
-- first. A job past max_attempts is failed instead of claimed.
CREATE OR REPLACE FUNCTION public.cm_claim_jobs(p_limit integer DEFAULT 1, p_lease_seconds integer DEFAULT 150)
RETURNS SETOF public.cm_jobs
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.cm_jobs SET status = 'failed', error = coalesce(error, 'gave up after ' || attempts || ' attempts'), updated_at = now()
   WHERE status = 'running' AND locked_until < now() AND attempts >= max_attempts;
  RETURN QUERY
  UPDATE public.cm_jobs j
     SET status = 'running', attempts = j.attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
   WHERE j.id IN (
     SELECT id FROM public.cm_jobs
      WHERE (status = 'queued' AND run_after <= now()) OR (status = 'running' AND locked_until < now())
      ORDER BY run_after
      LIMIT greatest(1, least(p_limit, 20))
      FOR UPDATE SKIP LOCKED)
  RETURNING j.*;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_claim_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cm_claim_jobs(integer, integer) TO service_role;

/* ─── the minute tick ────────────────────────────────────────────────── */
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.trigger_content_machine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE s public.cm_settings%ROWTYPE; secret text; worker_url text; local_now timestamp; due boolean;
BEGIN
  SELECT * INTO s FROM public.cm_settings WHERE id;
  IF NOT FOUND OR s.kill_switch THEN RETURN; END IF;
  local_now := now() AT TIME ZONE s.timezone;
  due := EXISTS (SELECT 1 FROM public.cm_jobs WHERE (status = 'queued' AND run_after <= now()) OR (status = 'running' AND locked_until < now()))
      OR (s.daily_auto_run AND s.slideshows_per_day > 0 AND to_char(local_now, 'HH24:MI') >= s.run_time_local
          AND NOT EXISTS (SELECT 1 FROM public.cm_runs WHERE kind = 'daily' AND run_date = local_now::date));
  IF NOT due THEN RETURN; END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cm_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'cm_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cm-worker-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 5000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_content_machine() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_content_machine() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'content-machine-tick';
    PERFORM cron.schedule('content-machine-tick', '* * * * *', 'select private.trigger_content_machine();');
  END IF;
END $$;

/* ─── the logo library (owner, 2026-10-18) ───────────────────────────── */
-- Official logo files only (from each company's press / brand kit page), unaltered, shown small next to
-- the tool's name. A logo is used ONLY once the owner has approved it; a new upload clears the approval.
-- Without an approved logo the slide shows the icon tile. Files live in the private bucket (logos/...).
CREATE TABLE IF NOT EXISTS public.cm_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE CHECK (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  logo_path text,
  content_type text,
  source_url text,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Approval needs the file and where it came from.
  CONSTRAINT cm_logos_approved_needs_file CHECK (NOT approved OR (logo_path IS NOT NULL AND source_url IS NOT NULL))
);
INSERT INTO public.cm_logos (name, domain, notes) VALUES
  ('Zyvo', 'tryzyvo.com', 'Our own logo'),
  ('Descript', 'descript.com', NULL), ('ElevenLabs', 'elevenlabs.io', NULL), ('CapCut', 'capcut.com', NULL),
  ('Runway', 'runwayml.com', NULL), ('Pika', 'pika.art', NULL), ('Kling', 'klingai.com', NULL),
  ('Hedra', 'hedra.com', NULL), ('Hailuo', 'hailuoai.video', NULL), ('Seedance', 'seed.bytedance.com', 'Check the domain'),
  ('Veo', 'deepmind.google', 'Google DeepMind'), ('Canva', 'canva.com', NULL), ('HeyGen', 'heygen.com', NULL),
  ('Synthesia', 'synthesia.io', NULL), ('InVideo', 'invideo.io', NULL), ('OpusClip', 'opus.pro', NULL),
  ('Suno', 'suno.com', NULL), ('Midjourney', 'midjourney.com', NULL), ('ChatGPT', 'chatgpt.com', NULL)
ON CONFLICT (domain) DO NOTHING;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.cm_library ENABLE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON public.cm_library FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER TABLE public.cm_logos ENABLE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON public.cm_logos FROM PUBLIC, anon, authenticated';
END $$;

COMMIT;
