-- THE CREATE STUDIOS + THE DIRECTOR (docs/studio-v2-plan.md). NOT RUN: the owner runs it.
-- Safe on live: three new tables, one new function, nothing existing changes.
--   director_drafts         one storyboard per row (plan first, render last); "My drafts" on /create
--   director_usage          one row per plan / chat change: the daily caps (planning is free, so it is capped)
--   director_claude_videos  one row per draft a user builds with their own Claude: the free plan's 2 a month
-- RLS: a user may READ their own drafts (the Director page lists them); every write goes through the edge function
-- director-api / zyvo-mcp (service role), which checks sizes, caps and ownership.
BEGIN;

CREATE TABLE IF NOT EXISTS public.director_drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  style_id      text NOT NULL,                       -- a row of the styles registry (_shared/director/styles.js)
  studio_id     text,                                -- the studio it was planned in (short-form, long-form, ...)
  idea          text NOT NULL DEFAULT '',            -- what the user typed
  title         text NOT NULL DEFAULT '',
  hook          text NOT NULL DEFAULT '',
  scenes        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, narration, visual, camera, seconds }]
  length_sec    integer NOT NULL DEFAULT 30,
  format        text NOT NULL DEFAULT '9:16' CHECK (format IN ('9:16', '16:9')),
  extras        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { reference_image, copy_script, avoid }
  chat          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- the last chat changes [{ ask, at }] (kept short)
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent_zyvo', 'sent_claude', 'done')),
  made_where    text CHECK (made_where IN ('zyvo', 'claude')),
  result_url    text,                                -- the engine page / result it was handed to
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS director_drafts_user ON public.director_drafts (user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.director_usage (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('plan', 'revise')),
  draft_id    uuid,
  ok          boolean NOT NULL DEFAULT true,
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS director_usage_user ON public.director_usage (user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.director_claude_videos (
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  draft_id    uuid NOT NULL REFERENCES public.director_drafts (id) ON DELETE CASCADE,
  style_id    text NOT NULL,
  project_id  uuid,                                  -- the zyvo_studio_projects row once Claude saved it
  finished_at timestamptz,                           -- set when finish_my_video is done for that project
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, draft_id)
);
CREATE INDEX IF NOT EXISTS director_claude_videos_month ON public.director_claude_videos (user_id, created_at DESC);

-- one Claude video per (user, draft), and at most p_limit new ones since p_since (null = no limit): atomic, so two
-- Claude chats at once can't both take the last free one. Returns 'ok' (new or already counted) or 'LIMIT'.
CREATE OR REPLACE FUNCTION public.director_claim_claude_video(p_user uuid, p_draft uuid, p_style text, p_since timestamptz, p_limit integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('director_claude:' || p_user::text));
  IF EXISTS (SELECT 1 FROM director_claude_videos WHERE user_id = p_user AND draft_id = p_draft) THEN RETURN 'ok'; END IF;
  IF p_limit IS NOT NULL THEN
    SELECT count(*) INTO n FROM director_claude_videos WHERE user_id = p_user AND created_at >= p_since;
    IF n >= p_limit THEN RETURN 'LIMIT'; END IF;
  END IF;
  INSERT INTO director_claude_videos (user_id, draft_id, style_id) VALUES (p_user, p_draft, p_style);
  UPDATE director_drafts SET status = 'sent_claude', made_where = 'claude', updated_at = now() WHERE id = p_draft AND user_id = p_user;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.director_claim_claude_video(uuid, uuid, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.director_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_claude_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS director_drafts_read_own ON public.director_drafts;
CREATE POLICY director_drafts_read_own ON public.director_drafts FOR SELECT TO authenticated USING (user_id = auth.uid() AND deleted_at IS NULL);

COMMIT;
