-- AI Fruit Story v2 backend (Phase 3b): stories, scenes, series, ideas,
-- provider jobs, the credit ledger and the AI call log.
--
-- Rules this schema enforces:
-- * The browser can READ its own stories/scenes/series (and public ideas) and
--   write NOTHING. Every write goes through the fruit-story-api / fruit-worker
--   edge functions (service role). A guard trigger rejects anon/authenticated
--   writes even if a grant is ever added by mistake.
-- * Credits move only inside fruit_charge_step / fruit_refund_job, priced from
--   tool_prices via compute_tool_price, with one ledger row per item and an
--   idempotency key per charge and per refund.
-- * A step is charged in the same transaction that checks and moves the story
--   status, so a double click can't charge twice.
-- * Fruit v2 has its own tool keys (image:fruit-story, video:fruit-story-v2/v3/v4).
--   The v1 keys (image:fruit-v2, video:fruit-v2/v3/v4) are untouched because
--   live v1 still sends 5 s / 496x864 jobs on them.

BEGIN;
SET LOCAL lock_timeout = '10s';

/* ─── Tables ─────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.fruit_series (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT '',
  logline       text NOT NULL DEFAULT '',
  concept       text NOT NULL CHECK (length(concept) BETWEEN 1 AND 1000),
  cast_ids      text[] NOT NULL CHECK (cardinality(cast_ids) BETWEEN 2 AND 5),
  tone          text NOT NULL DEFAULT '',
  opener        text NOT NULL DEFAULT '',
  episode_count smallint NOT NULL CHECK (episode_count BETWEEN 3 AND 10),
  bible         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS fruit_series_user_created_idx ON public.fruit_series (user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fruit_stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('idea', 'prompt', 'script', 'episode')),
  input           jsonb NOT NULL DEFAULT '{}'::jsonb,          -- what the user submitted, as submitted
  title           text NOT NULL DEFAULT '',
  cast_ids        text[] NOT NULL CHECK (cardinality(cast_ids) BETWEEN 1 AND 5),
  quality         text NOT NULL CHECK (quality IN ('v2', 'v3', 'v4')),
  length_sec      smallint NOT NULL CHECK (length_sec BETWEEN 5 AND 180),
  aspect          text NOT NULL CHECK (aspect IN ('9:16', '16:9')),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'pictures', 'pictures_ready', 'animating', 'clips_ready', 'building', 'final_ready', 'failed')),
  locations       jsonb NOT NULL DEFAULT '[]'::jsonb,          -- [{id, description}]
  series_id       uuid REFERENCES public.fruit_series(id) ON DELETE SET NULL,
  episode_number  smallint,
  final_status    text NOT NULL DEFAULT 'none' CHECK (final_status IN ('none', 'building', 'ready', 'failed')),
  final_url       text,
  final_captions  boolean NOT NULL DEFAULT true,
  final_trimmed_sec numeric(6, 2) NOT NULL DEFAULT 0,
  final_trimmed_per_clip numeric(6, 2)[] NOT NULL DEFAULT '{}',
  final_error     text,
  final_requested_at timestamptz,
  error_code      text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK ((series_id IS NULL) = (episode_number IS NULL))
);
CREATE INDEX IF NOT EXISTS fruit_stories_user_created_idx ON public.fruit_stories (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fruit_stories_episode_key ON public.fruit_stories (series_id, episode_number) WHERE series_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fruit_story_scenes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id     uuid NOT NULL REFERENCES public.fruit_stories(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- denormalized for RLS + realtime filters
  idx          smallint NOT NULL CHECK (idx BETWEEN 0 AND 39),
  title        text NOT NULL DEFAULT '',
  speaker_id   text NOT NULL REFERENCES public.fruit_characters(id),
  line         text NOT NULL CHECK (length(line) BETWEEN 1 AND 400),        -- the exact spoken line
  present_ids  text[] NOT NULL CHECK (cardinality(present_ids) BETWEEN 1 AND 3),
  location_id  text,
  action       text NOT NULL DEFAULT '',
  emotion      text NOT NULL DEFAULT '',
  shot         text NOT NULL DEFAULT '',
  duration_sec smallint NOT NULL CHECK (duration_sec BETWEEN 1 AND 15),
  image_status text NOT NULL DEFAULT 'queued' CHECK (image_status IN ('queued', 'generating', 'ready', 'failed')),
  image_url    text,
  image_prompt text NOT NULL DEFAULT '',                                     -- the exact prompt sent for the current picture
  image_job_id uuid,
  clip_status  text NOT NULL DEFAULT 'none' CHECK (clip_status IN ('none', 'queued', 'generating', 'ready', 'failed')),
  clip_url     text,
  clip_prompt  text NOT NULL DEFAULT '',                                     -- the exact prompt sent for the current clip
  clip_job_id  uuid,
  error_code   text,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, idx),
  CHECK (speaker_id = ANY (present_ids))
);
CREATE INDEX IF NOT EXISTS fruit_story_scenes_story_idx ON public.fruit_story_scenes (story_id, idx);

CREATE TABLE IF NOT EXISTS public.fruit_series_episodes (
  series_id   uuid NOT NULL REFERENCES public.fruit_series(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number      smallint NOT NULL CHECK (number BETWEEN 1 AND 10),
  title       text NOT NULL,
  summary     text NOT NULL,
  cliffhanger text NOT NULL,
  story_id    uuid REFERENCES public.fruit_stories(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series_id, number)
);

CREATE TABLE IF NOT EXISTS public.fruit_ideas (
  id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title      text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  summary    text NOT NULL CHECK (length(summary) BETWEEN 1 AND 200),
  cast_ids   text[] NOT NULL CHECK (cardinality(cast_ids) BETWEEN 2 AND 3),
  story_type text NOT NULL,
  collection text NOT NULL DEFAULT 'core',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One charge per step (pictures, one edit, animate all, one clip, ...).
CREATE TABLE IF NOT EXISTS public.fruit_charges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id   uuid NOT NULL REFERENCES public.fruit_stories(id) ON DELETE CASCADE,
  step       text NOT NULL CHECK (step IN ('pictures', 'edit', 'regenerate', 'retry_picture', 'animate', 'reclip')),
  credits    integer NOT NULL CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per paid provider item. Retries after a provider error reuse the
-- row (attempt + 1, fresh task_uuid); the item is charged once and refunded
-- at most once.
CREATE TABLE IF NOT EXISTS public.fruit_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id         uuid NOT NULL REFERENCES public.fruit_stories(id) ON DELETE CASCADE,
  scene_id         uuid NOT NULL REFERENCES public.fruit_story_scenes(id) ON DELETE CASCADE,
  charge_id        uuid NOT NULL REFERENCES public.fruit_charges(id),
  kind             text NOT NULL CHECK (kind IN ('image', 'clip')),
  tool_key         text NOT NULL,
  price_input      jsonb NOT NULL,                  -- what compute_tool_price priced
  credits          integer NOT NULL CHECK (credits >= 0),
  request          jsonb NOT NULL,                  -- the exact Runware task (minus taskUUID/webhookURL, added per attempt)
  status           text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'submitting', 'submitted', 'provider_done', 'succeeded', 'failed', 'canceled')),
  attempt          smallint NOT NULL DEFAULT 0,
  max_attempts     smallint NOT NULL DEFAULT 3,
  task_uuid        uuid,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  lease_until      timestamptz,
  submitted_at     timestamptz,
  provider_done_at timestamptz,
  finished_at      timestamptz,
  result           jsonb,                           -- raw provider result of the last attempt
  output_url       text,                            -- provider URL (temporary)
  stored_url       text,                            -- permanent public URL in Storage
  cost_usd         numeric(12, 6) NOT NULL DEFAULT 0,   -- real provider cost, summed over attempts
  error_code       text,
  error            text,
  refunded_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fruit_jobs_task_uuid_key ON public.fruit_jobs (task_uuid) WHERE task_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS fruit_jobs_open_idx ON public.fruit_jobs (status, next_attempt_at) WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done');
CREATE INDEX IF NOT EXISTS fruit_jobs_story_idx ON public.fruit_jobs (story_id, kind, status);

CREATE TABLE IF NOT EXISTS public.fruit_credit_ledger (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id        uuid REFERENCES public.fruit_stories(id) ON DELETE SET NULL,
  charge_id       uuid REFERENCES public.fruit_charges(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES public.fruit_jobs(id) ON DELETE SET NULL,
  operation       text NOT NULL CHECK (operation IN ('charge', 'refund')),
  credits         integer NOT NULL CHECK (credits >= 0),
  idempotency_key text NOT NULL UNIQUE,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fruit_credit_ledger_user_idx ON public.fruit_credit_ledger (user_id, created_at DESC);

-- Every AI call (LLM and Runware): the exact request, the response and the real cost.
CREATE TABLE IF NOT EXISTS public.fruit_ai_calls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  story_id           uuid REFERENCES public.fruit_stories(id) ON DELETE SET NULL,
  series_id          uuid REFERENCES public.fruit_series(id) ON DELETE SET NULL,
  scene_id           uuid REFERENCES public.fruit_story_scenes(id) ON DELETE SET NULL,
  job_id             uuid REFERENCES public.fruit_jobs(id) ON DELETE SET NULL,
  provider           text NOT NULL CHECK (provider IN ('runware', 'anthropic', 'openai')),
  model              text NOT NULL,
  purpose            text NOT NULL,
  attempt            smallint NOT NULL DEFAULT 1,
  request            jsonb NOT NULL,
  response           jsonb,
  http_status        smallint,
  ok                 boolean,
  error              text,
  cost_usd           numeric(12, 6),
  input_tokens       integer,
  output_tokens      integer,
  cache_read_tokens  integer,
  cache_write_tokens integer,
  latency_ms         integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);
CREATE INDEX IF NOT EXISTS fruit_ai_calls_story_idx ON public.fruit_ai_calls (story_id, created_at);
CREATE INDEX IF NOT EXISTS fruit_ai_calls_job_idx ON public.fruit_ai_calls (job_id) WHERE job_id IS NOT NULL;

/* ─── Access: owner read, public ideas, no browser writes ─────────────── */

ALTER TABLE public.fruit_series          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_stories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_story_scenes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_ideas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_charges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_credit_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fruit_ai_calls        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fruit_series, public.fruit_stories, public.fruit_story_scenes, public.fruit_series_episodes,
              public.fruit_ideas, public.fruit_charges, public.fruit_jobs, public.fruit_credit_ledger, public.fruit_ai_calls
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.fruit_credit_ledger_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fruit_series, public.fruit_stories, public.fruit_story_scenes, public.fruit_series_episodes TO authenticated;
GRANT SELECT ON public.fruit_ideas TO anon, authenticated;
GRANT ALL ON public.fruit_series, public.fruit_stories, public.fruit_story_scenes, public.fruit_series_episodes,
             public.fruit_ideas, public.fruit_charges, public.fruit_jobs, public.fruit_credit_ledger, public.fruit_ai_calls
  TO service_role;
GRANT USAGE ON SEQUENCE public.fruit_credit_ledger_id_seq TO service_role;

DROP POLICY IF EXISTS fruit_series_select_own ON public.fruit_series;
CREATE POLICY fruit_series_select_own ON public.fruit_series FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fruit_stories_select_own ON public.fruit_stories;
CREATE POLICY fruit_stories_select_own ON public.fruit_stories FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);
DROP POLICY IF EXISTS fruit_story_scenes_select_own ON public.fruit_story_scenes;
CREATE POLICY fruit_story_scenes_select_own ON public.fruit_story_scenes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS fruit_series_episodes_select_own ON public.fruit_series_episodes;
CREATE POLICY fruit_series_episodes_select_own ON public.fruit_series_episodes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS fruit_ideas_public_read ON public.fruit_ideas;
CREATE POLICY fruit_ideas_public_read ON public.fruit_ideas FOR SELECT TO anon, authenticated
  USING (active);
-- fruit_charges, fruit_jobs, fruit_credit_ledger, fruit_ai_calls: no policy = no browser access.

CREATE OR REPLACE FUNCTION public.fruit_block_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'FRUIT_READ_ONLY' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  -- Tables with an updated_at column pass 'touch' as the trigger argument.
  IF TG_OP = 'UPDATE' AND TG_NARGS > 0 AND TG_ARGV[0] = 'touch' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fruit_block_client_writes() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fruit_series', 'fruit_stories', 'fruit_story_scenes', 'fruit_series_episodes', 'fruit_ideas', 'fruit_charges', 'fruit_jobs', 'fruit_credit_ledger', 'fruit_ai_calls'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zzz_%1$s_guard ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER zzz_%1$s_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.fruit_block_client_writes(%2$s)',
      t, CASE WHEN t IN ('fruit_charges', 'fruit_credit_ledger', 'fruit_ai_calls') THEN '' ELSE '''touch''' END);
  END LOOP;
END $$;

-- Live updates for subscribeStory (RLS applies to realtime).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fruit_stories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fruit_stories;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fruit_story_scenes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fruit_story_scenes;
  END IF;
END $$;

/* ─── Prices (Fruit v2 only; placeholders until measured in 3e) ─────── */

INSERT INTO public.tool_prices
  (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, notes)
VALUES
  ('image:fruit-story', NULL, 3, NULL, ARRAY['768x1376', '1376x768'], NULL, 'starter',
   'AI Fruit Story v2 scene picture / edit / regenerate: Nano Banana 2 Lite'),
  ('video:fruit-story-v2', 5, NULL, ARRAY[4,5,6,7,8,9,10,11,12,13,14,15], ARRAY['720x1280', '1280x720'], true, 'starter',
   'AI Fruit Story v2 V2 clip: Seedance 2.0 Mini, i2v, audio. PLACEHOLDER price, set before rollout'),
  ('video:fruit-story-v3', 8, NULL, ARRAY[4,5,6,7,8,9,10,11,12,13,14,15], ARRAY['720x1280', '1280x720'], true, 'pro',
   'AI Fruit Story v2 V3 clip: Seedance 2.0 Fast, i2v, audio. PLACEHOLDER price, set before rollout'),
  ('video:fruit-story-v4', 10, NULL, ARRAY[4,6,8], ARRAY['720x1280', '1280x720'], true, 'generative',
   'AI Fruit Story v2 V4 clip: Veo 3.1 Fast, i2v, audio. PLACEHOLDER price, set before rollout')
ON CONFLICT (tool_key) DO NOTHING;

/* ─── Credits: charge a step, complete a job, refund a job ────────────── */

CREATE OR REPLACE FUNCTION public.fruit_plan_rank(p_plan text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(p_plan, 'free'))
    WHEN 'starter' THEN 1 WHEN 'affiliate' THEN 1 WHEN 'pro' THEN 2 WHEN 'generative' THEN 3 ELSE 0 END
$function$;

-- Charges one step atomically:
--   * locks the story, checks it is in p_from_statuses, moves it to p_to_status
--   * prices every item from tool_prices (plan-gated by min_plan)
--   * deducts the total (INSUFFICIENT_CREDITS if short; nothing changes)
--   * creates one fruit_jobs row + one ledger row per item
--   * points each scene at its new job and resets that scene's status
-- p_items: [{scene_id, kind: image|clip, tool_key, price_input: {...}, request: {...}, prompt: "..."}]
-- Returns {charge_id, credits, jobs: [{job_id, scene_id, credits}]}.
CREATE OR REPLACE FUNCTION public.fruit_charge_step(
  p_user_id uuid, p_story_id uuid, p_step text, p_from_statuses text[], p_to_status text, p_items jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_story     public.fruit_stories%ROWTYPE;
  v_plan      text;
  v_item      jsonb;
  v_credits   integer;
  v_total     integer := 0;
  v_min_plan  text;
  v_charge_id uuid := gen_random_uuid();
  v_job_id    uuid;
  v_scene     public.fruit_story_scenes%ROWTYPE;
  v_jobs      jsonb := '[]'::jsonb;
  v_priced    jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: items must be a non-empty array of at most 40' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.fruit_stories WHERE id = p_story_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_story.user_id <> p_user_id THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_story.status = ANY (p_from_statuses)) THEN
    RAISE EXCEPTION 'WRONG_STATUS: story is %', v_story.status USING ERRCODE = '55000';
  END IF;

  SELECT plan_code INTO v_plan FROM public.profiles WHERE id = p_user_id;

  -- Price everything first; nothing is written until every item is valid.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'kind') NOT IN ('image', 'clip') OR jsonb_typeof(v_item->'request') <> 'object' THEN
      RAISE EXCEPTION 'VALIDATION: bad item' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_scene FROM public.fruit_story_scenes WHERE id = (v_item->>'scene_id')::uuid AND story_id = p_story_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: scene' USING ERRCODE = 'P0002';
    END IF;
    SELECT min_plan INTO v_min_plan FROM public.tool_prices WHERE tool_key = v_item->>'tool_key' AND active;
    IF public.fruit_plan_rank(v_plan) < GREATEST(1, public.fruit_plan_rank(v_min_plan)) THEN
      RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED: %', COALESCE(v_min_plan, 'starter') USING ERRCODE = '42501';
    END IF;
    v_credits := public.compute_tool_price(v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb));
    IF v_credits IS NULL THEN
      RAISE EXCEPTION 'NO_SERVER_PRICE: %', v_item->>'tool_key' USING ERRCODE = '22023';
    END IF;
    v_total := v_total + v_credits;
    v_priced := v_priced || jsonb_build_array(v_item || jsonb_build_object('credits', v_credits));
  END LOOP;

  IF v_total > 0 THEN
    PERFORM public.deduct_credits(p_user_id, v_total);   -- raises INSUFFICIENT_CREDITS, all or nothing
  END IF;

  INSERT INTO public.fruit_charges (id, user_id, story_id, step, credits)
  VALUES (v_charge_id, p_user_id, p_story_id, p_step, v_total);

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_priced) LOOP
    v_job_id := gen_random_uuid();
    INSERT INTO public.fruit_jobs (id, user_id, story_id, scene_id, charge_id, kind, tool_key, price_input, credits, request)
    VALUES (v_job_id, p_user_id, p_story_id, (v_item->>'scene_id')::uuid, v_charge_id, v_item->>'kind',
            v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb), (v_item->>'credits')::integer, v_item->'request');
    INSERT INTO public.fruit_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
    VALUES (p_user_id, p_story_id, v_charge_id, v_job_id, 'charge', (v_item->>'credits')::integer, 'job:' || v_job_id || ':charge', p_step);

    IF v_item->>'kind' = 'image' THEN
      UPDATE public.fruit_story_scenes
      SET image_status = 'queued', image_job_id = v_job_id, image_prompt = COALESCE(v_item->>'prompt', image_prompt),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    ELSE
      UPDATE public.fruit_story_scenes
      SET clip_status = 'queued', clip_job_id = v_job_id, clip_prompt = COALESCE(v_item->>'prompt', clip_prompt),
          duration_sec = COALESCE((v_item->'price_input'->>'durationSec')::smallint, duration_sec),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    END IF;
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object('job_id', v_job_id, 'scene_id', v_item->>'scene_id', 'credits', (v_item->>'credits')::integer));
  END LOOP;

  UPDATE public.fruit_stories SET status = p_to_status, error_code = NULL, error = NULL WHERE id = p_story_id;

  RETURN jsonb_build_object('charge_id', v_charge_id, 'credits', v_total, 'jobs', v_jobs);
END;
$function$;

-- Moves a picture/animate step to its *_ready status once every scene of that
-- kind is terminal. Safe to call any time.
CREATE OR REPLACE FUNCTION public.fruit_refresh_story_status(p_story_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.fruit_stories WHERE id = p_story_id FOR UPDATE;
  IF v_status = 'pictures' AND NOT EXISTS (
    SELECT 1 FROM public.fruit_story_scenes WHERE story_id = p_story_id AND image_status IN ('queued', 'generating')
  ) THEN
    UPDATE public.fruit_stories SET status = 'pictures_ready' WHERE id = p_story_id;
    RETURN 'pictures_ready';
  END IF;
  IF v_status = 'animating' AND NOT EXISTS (
    SELECT 1 FROM public.fruit_story_scenes WHERE story_id = p_story_id AND clip_status IN ('queued', 'generating')
  ) THEN
    UPDATE public.fruit_stories SET status = 'clips_ready' WHERE id = p_story_id;
    RETURN 'clips_ready';
  END IF;
  RETURN v_status;
END;
$function$;

-- A job's result is stored: mark it succeeded and show it on the scene.
-- Returns false (and changes nothing) if the job was already finished,
-- refunded, or is no longer the scene's current job.
CREATE OR REPLACE FUNCTION public.fruit_complete_job(p_job_id uuid, p_stored_url text, p_cost_usd numeric, p_result jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job public.fruit_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.fruit_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL THEN
    RETURN false;
  END IF;
  UPDATE public.fruit_jobs
  SET status = 'succeeded', stored_url = p_stored_url, result = COALESCE(p_result, result),
      cost_usd = cost_usd + COALESCE(p_cost_usd, 0), finished_at = now(), lease_until = NULL
  WHERE id = p_job_id;
  IF v_job.kind = 'image' THEN
    UPDATE public.fruit_story_scenes SET image_status = 'ready', image_url = p_stored_url, error_code = NULL, error = NULL
    WHERE id = v_job.scene_id AND image_job_id = p_job_id;
  ELSE
    UPDATE public.fruit_story_scenes SET clip_status = 'ready', clip_url = p_stored_url, error_code = NULL, error = NULL
    WHERE id = v_job.scene_id AND clip_job_id = p_job_id;
  END IF;
  PERFORM public.fruit_refresh_story_status(v_job.story_id);
  RETURN true;
END;
$function$;

-- Fails a job and refunds its credits exactly once. p_cost_usd is any real
-- provider cost already spent on the failed attempt(s).
CREATE OR REPLACE FUNCTION public.fruit_refund_job(p_job_id uuid, p_error_code text, p_error text, p_cost_usd numeric DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job public.fruit_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.fruit_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_job.credits > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_job.credits,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_job.credits)
    WHERE id = v_job.user_id;
  END IF;
  INSERT INTO public.fruit_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
  VALUES (v_job.user_id, v_job.story_id, v_job.charge_id, p_job_id, 'refund', v_job.credits, 'job:' || p_job_id || ':refund', p_error_code)
  ON CONFLICT (idempotency_key) DO NOTHING;
  UPDATE public.fruit_jobs
  SET status = 'failed', error_code = p_error_code, error = p_error, refunded_at = now(), finished_at = now(),
      lease_until = NULL, cost_usd = cost_usd + COALESCE(p_cost_usd, 0)
  WHERE id = p_job_id;
  IF v_job.kind = 'image' THEN
    UPDATE public.fruit_story_scenes SET image_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND image_job_id = p_job_id;
  ELSE
    UPDATE public.fruit_story_scenes SET clip_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND clip_job_id = p_job_id;
  END IF;
  PERFORM public.fruit_refresh_story_status(v_job.story_id);
  RETURN true;
END;
$function$;

-- Deterministic "random" ideas: a different seed gives a different 5.
CREATE OR REPLACE FUNCTION public.fruit_pick_ideas(p_seed text, p_count integer DEFAULT 5)
 RETURNS SETOF public.fruit_ideas
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.fruit_ideas WHERE active
  ORDER BY md5(id || ':' || coalesce(p_seed, '')) LIMIT LEAST(GREATEST(p_count, 1), 20)
$function$;

REVOKE ALL ON FUNCTION public.fruit_plan_rank(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fruit_charge_step(uuid, uuid, text, text[], text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fruit_refresh_story_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fruit_complete_job(uuid, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fruit_refund_job(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fruit_pick_ideas(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fruit_plan_rank(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fruit_charge_step(uuid, uuid, text, text[], text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fruit_refresh_story_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fruit_complete_job(uuid, text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fruit_refund_job(uuid, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fruit_pick_ideas(text, integer) TO service_role;

/* ─── Reconciler: every minute, only when there is open work ─────────── */

-- Needs two vault secrets (created at deploy time, after this migration):
--   fruit_worker_url     https://<project>.supabase.co/functions/v1/fruit-worker
--   fruit_worker_secret  the same value as the FRUIT_WORKER_SECRET edge secret
-- Until they exist this does nothing.
CREATE OR REPLACE FUNCTION private.trigger_fruit_reconcile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE secret text; worker_url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fruit_jobs WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done'))
     AND NOT EXISTS (SELECT 1 FROM public.fruit_stories WHERE status = 'building') THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'fruit_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'fruit_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-fruit-worker-secret', secret),
    body := jsonb_build_object('action', 'reconcile'),
    timeout_milliseconds := 15000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_fruit_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_fruit_reconcile() TO service_role;

SELECT cron.schedule('fruit-story-reconcile', '* * * * *', 'select private.trigger_fruit_reconcile();');

NOTIFY pgrst, 'reload schema';

COMMIT;
