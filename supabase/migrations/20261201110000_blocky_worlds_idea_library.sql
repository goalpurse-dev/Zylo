-- Blocky Worlds: the idea library, the learning loop and the owner's real post stats (docs/blocky-worlds-protocol.md).
-- NOT APPLIED. The owner applies it after 20261201100000_blocky_worlds.sql (db query --linked -f, then migration repair).
--
-- 1. blocky_worlds_library: every judged idea (a full idea card), its judge score, its stats and its rank.
--    status: live (served), pending (waiting for the judge: user ideas), rejected (never served), retired.
-- 2. blocky_worlds_seen: which ideas a user has been shown (a user never sees one twice).
-- 3. blocky_worlds_events: shown / picked / rewritten / generated / downloaded / thumb_up / thumb_down, for the stats.
-- 4. blocky_worlds_idea_batches: one row per library job run (what it made, kept, dropped, cost).
-- 5. blocky_worlds_posts: the owner's real TikTok numbers for posted videos (they count most in the rank).
-- 6. RPCs: blocky_worlds_library_candidates (unseen live ideas, best first), blocky_worlds_mark_seen,
--    blocky_worlds_bump (one stat +1, atomic). The rank is recomputed by the job (library.js rankOf).
-- Only the edge functions (service role) read and write these tables: RLS on, no policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea          jsonb NOT NULL,
  opener        text NOT NULL,
  opener_key    text NOT NULL,
  formula       text NOT NULL,
  twist         text NOT NULL,
  mood          text NOT NULL,
  setting       text,
  score         integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  judge         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('live', 'pending', 'rejected', 'retired')),
  source        text NOT NULL DEFAULT 'batch' CHECK (source IN ('batch', 'user', 'seed')),
  batch_id      uuid,
  source_draft  uuid,
  shown         integer NOT NULL DEFAULT 0,
  picked        integer NOT NULL DEFAULT 0,
  rewritten     integer NOT NULL DEFAULT 0,
  generated     integer NOT NULL DEFAULT 0,
  downloaded    integer NOT NULL DEFAULT 0,
  thumbs_up     integer NOT NULL DEFAULT 0,
  thumbs_down   integer NOT NULL DEFAULT 0,
  likes_total   bigint NOT NULL DEFAULT 0,
  rank          numeric(8,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS blocky_worlds_library_key ON public.blocky_worlds_library (opener_key) WHERE status IN ('live', 'pending');
CREATE INDEX IF NOT EXISTS blocky_worlds_library_live ON public.blocky_worlds_library (rank DESC) WHERE status = 'live';
ALTER TABLE public.blocky_worlds_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_library FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_seen (
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  library_id uuid NOT NULL REFERENCES public.blocky_worlds_library (id) ON DELETE CASCADE,
  shown_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, library_id)
);
ALTER TABLE public.blocky_worlds_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_seen FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  library_id uuid REFERENCES public.blocky_worlds_library (id) ON DELETE SET NULL,
  draft_id   uuid,
  run_id     uuid,
  kind       text NOT NULL CHECK (kind IN ('shown', 'picked', 'rewritten', 'generated', 'downloaded', 'thumb_up', 'thumb_down')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_events_library ON public.blocky_worlds_events (library_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS blocky_worlds_events_once ON public.blocky_worlds_events (user_id, run_id, kind) WHERE run_id IS NOT NULL AND kind IN ('downloaded', 'thumb_up', 'thumb_down');
ALTER TABLE public.blocky_worlds_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_events FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_idea_batches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL,
  requested   integer NOT NULL,
  generated   integer NOT NULL DEFAULT 0,
  dropped     integer NOT NULL DEFAULT 0,
  duplicates  integer NOT NULL DEFAULT 0,
  judged      integer NOT NULL DEFAULT 0,
  accepted    integer NOT NULL DEFAULT 0,
  rejected    integer NOT NULL DEFAULT 0,
  cost_usd    numeric(10,5) NOT NULL DEFAULT 0,
  mix         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'stopped', 'failed')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE public.blocky_worlds_idea_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_idea_batches FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid REFERENCES public.blocky_worlds_runs (id) ON DELETE SET NULL,
  library_id uuid REFERENCES public.blocky_worlds_library (id) ON DELETE SET NULL,
  url        text,
  likes      bigint NOT NULL DEFAULT 0 CHECK (likes >= 0),
  views      bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  posted_at  date,
  entered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blocky_worlds_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_posts FROM anon, authenticated;

-- the user's ideas point at the library idea they came from (null for "Your topic" and live fallbacks)
ALTER TABLE public.blocky_worlds_ideas ADD COLUMN IF NOT EXISTS library_id uuid REFERENCES public.blocky_worlds_library (id) ON DELETE SET NULL;
ALTER TABLE public.blocky_worlds_ideas DROP CONSTRAINT IF EXISTS blocky_worlds_ideas_source_check;
ALTER TABLE public.blocky_worlds_ideas ADD CONSTRAINT blocky_worlds_ideas_source_check CHECK (source IN ('batch', 'topic', 'library'));
-- every draft and run keeps its idea card (the protocol: every video runs from a complete card) and its beat sheet
ALTER TABLE public.blocky_worlds_drafts ADD COLUMN IF NOT EXISTS card jsonb;
ALTER TABLE public.blocky_worlds_drafts ADD COLUMN IF NOT EXISTS beats jsonb;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS card jsonb;
ALTER TABLE public.blocky_worlds_runs ADD COLUMN IF NOT EXISTS library_id uuid REFERENCES public.blocky_worlds_library (id) ON DELETE SET NULL;

-- Unseen live ideas for a user, best rank first (the page's mix is chosen in code: library.js pickForUser).
CREATE OR REPLACE FUNCTION public.blocky_worlds_library_candidates(p_user uuid, p_mood text, p_limit integer)
RETURNS SETOF public.blocky_worlds_library
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.* FROM public.blocky_worlds_library l
   WHERE l.status = 'live' AND (p_mood IS NULL OR l.mood = p_mood)
     AND NOT EXISTS (SELECT 1 FROM public.blocky_worlds_seen s WHERE s.user_id = p_user AND s.library_id = l.id)
   ORDER BY l.rank DESC, random()
   LIMIT greatest(1, least(coalesce(p_limit, 60), 200));
$$;

-- Mark ideas as shown to a user (and count the shows), in one statement.
CREATE OR REPLACE FUNCTION public.blocky_worlds_mark_seen(p_user uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  WITH ins AS (
    INSERT INTO public.blocky_worlds_seen (user_id, library_id) SELECT p_user, unnest(p_ids) ON CONFLICT DO NOTHING RETURNING library_id
  )
  UPDATE public.blocky_worlds_library l SET shown = shown + 1, updated_at = now() FROM ins WHERE l.id = ins.library_id;
  INSERT INTO public.blocky_worlds_events (user_id, library_id, kind) SELECT p_user, unnest(p_ids), 'shown';
END;
$$;

-- One stat +1 for a library idea, atomically (the event row is written by the caller).
CREATE OR REPLACE FUNCTION public.blocky_worlds_bump(p_library uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_library IS NULL THEN RETURN; END IF;
  UPDATE public.blocky_worlds_library SET
    picked = picked + (p_kind = 'picked')::int,
    rewritten = rewritten + (p_kind = 'rewritten')::int,
    generated = generated + (p_kind = 'generated')::int,
    downloaded = downloaded + (p_kind = 'downloaded')::int,
    thumbs_up = thumbs_up + (p_kind = 'thumb_up')::int,
    thumbs_down = thumbs_down + (p_kind = 'thumb_down')::int,
    updated_at = now()
  WHERE id = p_library;
END;
$$;

REVOKE ALL ON FUNCTION public.blocky_worlds_library_candidates(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_mark_seen(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blocky_worlds_bump(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_library_candidates(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_mark_seen(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_bump(uuid, text) TO service_role;

-- the library job's spend counts toward the emergency cap (blocky_worlds_guard reads ai_calls): allow its purpose
ALTER TABLE public.blocky_worlds_ai_calls DROP CONSTRAINT IF EXISTS blocky_worlds_ai_calls_purpose_check;
ALTER TABLE public.blocky_worlds_ai_calls ADD CONSTRAINT blocky_worlds_ai_calls_purpose_check CHECK (purpose IN ('ideas', 'script', 'library', 'card'));
ALTER TABLE public.blocky_worlds_ai_calls ALTER COLUMN user_id DROP NOT NULL;

COMMIT;
