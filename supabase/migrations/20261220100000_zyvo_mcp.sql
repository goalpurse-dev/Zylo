-- THE ZYVO CONNECTOR (remote MCP at mcp.tryzyvo.com, docs/zyvo-studio-kit-plan.md B) + Studio projects.
-- Safe on live: new tables, new functions, a new private bucket, and ONE widened CHECK (blocky_worlds_ai_calls.purpose
-- gets 'studio', so the connector's real costs count in blocky_worlds_guard's spent_24h: the $25 alert and the $50
-- emergency pause cover it; the per-user idea/script counts filter on their own purposes and don't change).
-- Every table is service-role only (RLS on, no policies): the edge function zyvo-mcp and the Studio worker use it.
BEGIN;

-- ---------------------------------------------------------------- OAuth (oauth.js): tokens are stored as SHA-256 only
CREATE TABLE IF NOT EXISTS public.zyvo_mcp_clients (
  client_id     text PRIMARY KEY,
  client_name   text NOT NULL,
  redirect_uris text[] NOT NULL,
  ip_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_mcp_clients_ip ON public.zyvo_mcp_clients (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.zyvo_mcp_auth_requests (
  id_hash        text PRIMARY KEY,
  client_id      text NOT NULL REFERENCES public.zyvo_mcp_clients (client_id) ON DELETE CASCADE,
  redirect_uri   text NOT NULL,
  code_challenge text NOT NULL,
  scope          text NOT NULL,
  state          text,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zyvo_mcp_codes (
  code_hash      text PRIMARY KEY,
  client_id      text NOT NULL REFERENCES public.zyvo_mcp_clients (client_id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  redirect_uri   text NOT NULL,
  code_challenge text NOT NULL,
  scope          text NOT NULL,
  family_id      text,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zyvo_mcp_tokens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id          text NOT NULL REFERENCES public.zyvo_mcp_clients (client_id) ON DELETE CASCADE,
  scope              text NOT NULL,
  family_id          text NOT NULL,
  access_hash        text NOT NULL UNIQUE,
  refresh_hash       text NOT NULL UNIQUE,
  access_expires_at  timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at         timestamptz,
  revoked_why        text,
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_mcp_tokens_user ON public.zyvo_mcp_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS zyvo_mcp_tokens_family ON public.zyvo_mcp_tokens (family_id);

-- ---------------------------------------------------------------- paid tools: the confirm tokens, the calls log
CREATE TABLE IF NOT EXISTS public.zyvo_mcp_quotes (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tool       text NOT NULL,
  input_hash text NOT NULL,
  credits    integer NOT NULL CHECK (credits >= 0),
  free       boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_mcp_quotes_user ON public.zyvo_mcp_quotes (user_id, created_at DESC);

-- one row per MCP tool call: user, tool, cost, result (never a script, a token or a secret)
CREATE TABLE IF NOT EXISTS public.zyvo_mcp_calls (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  client_id  text,
  tool       text NOT NULL,
  ok         boolean NOT NULL,
  code       text,
  credits    integer NOT NULL DEFAULT 0,
  ms         integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_mcp_calls_user ON public.zyvo_mcp_calls (user_id, created_at DESC);

-- ---------------------------------------------------------------- Studio projects (the kit's projects on the account)
CREATE TABLE IF NOT EXISTS public.zyvo_studio_projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kit_project_id text NOT NULL,
  title          text NOT NULL,
  script         jsonb NOT NULL,                 -- { lines: [{ text, speaker? }] } (data, checked, size-capped)
  shot_plan      jsonb,                          -- the kit's shots.json (data)
  kit_version    text,
  voice          jsonb,                          -- { mp3, words, seconds, made_at } (paths in the zyvo-studio bucket)
  voice_old      jsonb,                          -- the voice of an earlier script (kept, never used)
  upload         jsonb,                          -- the pending recording upload { path, ext, created_at }
  recording      jsonb,                          -- { path, bytes, uploaded_at } (deleted after 7 days)
  final          jsonb,                          -- { final, noMusic, web, poster, seconds, made_at }
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  UNIQUE (user_id, kit_project_id)
);
CREATE INDEX IF NOT EXISTS zyvo_studio_projects_user ON public.zyvo_studio_projects (user_id, updated_at DESC);

-- the connector's jobs: script / video run in the edge function, voice / finish on the Studio worker
CREATE TABLE IF NOT EXISTS public.zyvo_studio_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.zyvo_studio_projects (id) ON DELETE SET NULL,
  kind            text NOT NULL CHECK (kind IN ('script', 'voice', 'finish', 'video')),
  tool            text NOT NULL,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  stage           text,
  pct             integer NOT NULL DEFAULT 0,
  input           jsonb NOT NULL DEFAULT '{}'::jsonb,
  output          jsonb,
  credits_charged integer NOT NULL DEFAULT 0 CHECK (credits_charged >= 0),
  free            boolean NOT NULL DEFAULT false,
  quote_hash      text,
  cost_usd        numeric NOT NULL DEFAULT 0,
  error_code      text,
  error_message   text,
  worker_id       text,
  claimed_at      timestamptz,
  heartbeat_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  refunded_at     timestamptz,
  refund_why      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_studio_jobs_user ON public.zyvo_studio_jobs (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS zyvo_studio_jobs_live ON public.zyvo_studio_jobs (status, created_at) WHERE status IN ('queued', 'running');
-- one voice or finish at a time per project (a double confirm can never run twice)
CREATE UNIQUE INDEX IF NOT EXISTS zyvo_studio_jobs_one_active ON public.zyvo_studio_jobs (project_id) WHERE status IN ('queued', 'running') AND kind IN ('voice', 'finish');

-- the first finish on an account is free (owner 2026-11-19): once per account, for ever
CREATE TABLE IF NOT EXISTS public.zyvo_free_finish (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id  uuid,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zyvo_mcp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_mcp_auth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_mcp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_mcp_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_mcp_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_studio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zyvo_free_finish ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- the paid start: ONE transaction
-- The confirm token is used up, the credits are taken (or the free finish is claimed), the job is created. Any error
-- rolls all of it back: QUOTE_INVALID (unknown, used, expired, another user / tool / input), INSUFFICIENT_CREDITS,
-- FREE_USED. The price is the quote's (never the caller's). p_charge = false: make_video_in_zyvo, whose money the
-- site's own prepay takes inside the task.
CREATE OR REPLACE FUNCTION public.zyvo_mcp_start(p_token_hash text, p_user uuid, p_tool text, p_input_hash text, p_kind text, p_job jsonb, p_charge boolean DEFAULT true)
RETURNS public.zyvo_studio_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE q public.zyvo_mcp_quotes; j public.zyvo_studio_jobs; v_charged integer := 0;
BEGIN
  SELECT * INTO q FROM public.zyvo_mcp_quotes WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR q.used_at IS NOT NULL OR q.expires_at < now() OR q.user_id <> p_user OR q.tool <> p_tool OR q.input_hash <> p_input_hash THEN
    RAISE EXCEPTION 'QUOTE_INVALID';
  END IF;
  UPDATE public.zyvo_mcp_quotes SET used_at = now() WHERE token_hash = p_token_hash;
  IF q.free THEN
    BEGIN
      INSERT INTO public.zyvo_free_finish (user_id) VALUES (p_user);
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'FREE_USED';
    END;
  ELSIF p_charge AND q.credits > 0 THEN
    PERFORM public.deduct_credits(p_user, q.credits);
    v_charged := q.credits;
  END IF;
  INSERT INTO public.zyvo_studio_jobs (user_id, project_id, kind, tool, input, credits_charged, free, quote_hash)
  VALUES (p_user, NULLIF(p_job->>'project_id', '')::uuid, p_kind, p_tool, COALESCE(p_job, '{}'::jsonb), v_charged, q.free, p_token_hash)
  RETURNING * INTO j;
  IF q.free THEN UPDATE public.zyvo_free_finish SET job_id = j.id WHERE user_id = p_user; END IF;
  RETURN j;
END;
$$;

-- A failed job's refund, ONCE: the credits back, or the free finish handed back. Returns the credits given back.
CREATE OR REPLACE FUNCTION public.zyvo_mcp_refund(p_job uuid, p_why text DEFAULT 'failed')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE j public.zyvo_studio_jobs;
BEGIN
  UPDATE public.zyvo_studio_jobs SET refunded_at = now(), refund_why = left(COALESCE(p_why, 'failed'), 80)
   WHERE id = p_job AND refunded_at IS NULL AND status <> 'done'
  RETURNING * INTO j;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF j.free THEN
    DELETE FROM public.zyvo_free_finish WHERE user_id = j.user_id AND job_id = j.id;
    RETURN 0;
  END IF;
  IF j.credits_charged > 0 THEN PERFORM public.deduct_credits(j.user_id, -j.credits_charged); END IF;
  RETURN j.credits_charged;
END;
$$;

-- The Studio worker takes the oldest queued voice / finish (atomic; two workers never take the same job).
CREATE OR REPLACE FUNCTION public.zyvo_studio_claim_job(p_worker text)
RETURNS SETOF public.zyvo_studio_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.zyvo_studio_jobs
   WHERE status = 'queued' AND kind IN ('voice', 'finish')
   ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_id IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.zyvo_studio_jobs SET status = 'running', worker_id = p_worker, claimed_at = now(), heartbeat_at = now(), started_at = now(), stage = 'starting'
   WHERE id = v_id RETURNING *;
END;
$$;

-- Stuck jobs: failed and refunded (a worker job with no heartbeat for 30 min or waiting 2 h; an edge task that never
-- finished within 7 min). Returns how many. Called by the worker loop and by check_progress.
CREATE OR REPLACE FUNCTION public.zyvo_studio_sweep()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.zyvo_studio_jobs
            WHERE (kind IN ('voice', 'finish') AND status = 'running' AND heartbeat_at < now() - interval '30 minutes')
               OR (kind IN ('voice', 'finish') AND status = 'queued' AND created_at < now() - interval '2 hours')
               OR (kind IN ('script', 'video') AND status IN ('queued', 'running') AND created_at < now() - interval '7 minutes')
            LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.zyvo_studio_jobs SET status = 'failed', error_code = 'STUCK', error_message = 'It took too long on our side. Your credits were given back.', finished_at = now() WHERE id = r.id;
    PERFORM public.zyvo_mcp_refund(r.id, 'stuck');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.zyvo_mcp_start(text, uuid, text, text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zyvo_mcp_refund(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zyvo_studio_claim_job(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zyvo_studio_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zyvo_mcp_start(text, uuid, text, text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.zyvo_mcp_refund(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.zyvo_studio_claim_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.zyvo_studio_sweep() TO service_role;

-- ---------------------------------------------------------------- the spend counts (the $25 alert, the $50 pause)
ALTER TABLE public.blocky_worlds_ai_calls DROP CONSTRAINT IF EXISTS blocky_worlds_ai_calls_purpose_check;
ALTER TABLE public.blocky_worlds_ai_calls ADD CONSTRAINT blocky_worlds_ai_calls_purpose_check CHECK (purpose IN ('ideas', 'script', 'library', 'card', 'studio'));

-- ---------------------------------------------------------------- the files: private, 500 MB a file
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('zyvo-studio', 'zyvo-studio', false, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'application/json', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
