-- Blocky Stories: its own backend. Its own tables (blocky_*), functions,
-- row-level security, guards, live updates and job sweep. Nothing here reads,
-- writes, alters or depends on an AI Fruit Story object (fruit_*).
--
-- Built as a copy of the LIVE definitions of AI Fruit Story's backend (read
-- from the real database on 2026-10-06) under Blocky's names, so the money
-- path is the one that already runs in production:
--   blocky_charge_step        one atomic charge per paid step, priced on the server
--   blocky_refund_job         a failed job gives its credits back, once
--   blocky_complete_job, blocky_refresh_story_status, blocky_create_story
-- What is shared is the platform's, exactly as Fruit uses it: profiles (the
-- ONE credit balance), deduct_credits, tool_prices + compute_tool_price.
--
-- Credits and row locking (the same as Fruit's, so a Blocky charge and a
-- Fruit charge at the same moment can never spend the same credits):
--   - a charge goes through public.deduct_credits: ONE statement,
--       UPDATE profiles SET credit_balance = credit_balance - n WHERE id = uid AND credit_balance >= n
--     Postgres locks that profile row for the statement. A second charge on
--     the same account (Blocky's or Fruit's) waits for the first to finish,
--     then checks the balance that is left. No path reads the balance first
--     and writes it later.
--   - a refund is ONE statement too: credit_balance = credit_balance + n, on
--     the same row, after the job row is locked (FOR UPDATE) and checked, so
--     a job is refunded at most once (also guarded by the ledger's unique key).
--   - the story row and each scene row are locked (FOR UPDATE) for the step.
--
-- Different from Fruit on purpose:
--   - blocky_characters: an avatar has no age and no gender column at all.
--   - the library is not readable from the browser (no policy): the API serves
--     it, behind the blocky_v1 switch.
--   - no ideas table yet (the idea engine is its own phase).
--
-- Rollback: supabase/pending/20261026100000_blocky_stories_backend_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.blocky_plan_rank(p_plan text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(p_plan, 'free'))
    WHEN 'starter' THEN 1 WHEN 'affiliate' THEN 1 WHEN 'pro' THEN 2 WHEN 'generative' THEN 3 ELSE 0 END
$function$
;
REVOKE ALL ON FUNCTION public.blocky_plan_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_plan_rank(text) TO service_role;

CREATE OR REPLACE FUNCTION public.blocky_block_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'BLOCKY_READ_ONLY' USING ERRCODE = '42501';
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
$function$
;
REVOKE ALL ON FUNCTION public.blocky_block_client_writes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_block_client_writes() TO service_role;

CREATE OR REPLACE FUNCTION public.blocky_characters_block_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'BLOCKY_CHARACTERS_READ_ONLY' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;
REVOKE ALL ON FUNCTION public.blocky_characters_block_client_writes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_characters_block_client_writes() TO service_role;

/* ─── The avatar library ──────────────────────────────────────────────── */

-- An avatar is "a blocky game avatar": a name, a locked look, a face decal and
-- how it sounds. There is NO age and NO gender column, so neither can ever
-- reach a prompt.
CREATE TABLE public.blocky_characters (
  id             text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{0,39}$'),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  first_name     text GENERATED ALWAYS AS (lower(split_part(name, ' ', 1))) STORED,
  hue            smallint NOT NULL DEFAULT 0 CHECK (hue BETWEEN 0 AND 360),
  tag            text NOT NULL,
  role           text NOT NULL,
  role_tags      text[] NOT NULL DEFAULT '{}',
  voice_style    text NOT NULL,
  face           text NOT NULL,
  look           text NOT NULL,
  ref_image_url  text NOT NULL CHECK (ref_image_url ~ '^https?://'),
  ref_image_path text NOT NULL,
  ref_width      smallint NOT NULL,
  ref_height     smallint NOT NULL,
  ref_model      text NOT NULL,
  ref_seed       bigint,
  ref_prompt     text NOT NULL,
  ref_cost_usd   numeric(10,6),
  active         boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.blocky_characters IS 'Blocky Stories avatar library. No age, no gender. Written by the service role only; the API serves it.';
-- Script-name matching uses the first word of the name, so it is unique.
CREATE UNIQUE INDEX blocky_characters_first_name_key ON public.blocky_characters (first_name);
CREATE INDEX blocky_characters_list_idx ON public.blocky_characters (sort_order) WHERE active;

/* ─── Stories, scenes, series, jobs, charges, the ledger, the call log ─── */

CREATE TABLE public.blocky_series (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  logline text NOT NULL DEFAULT ''::text,
  concept text NOT NULL,
  cast_ids text[] NOT NULL,
  tone text NOT NULL DEFAULT ''::text,
  opener text NOT NULL DEFAULT ''::text,
  episode_count smallint NOT NULL,
  bible jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.blocky_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  title text NOT NULL DEFAULT ''::text,
  cast_ids text[] NOT NULL,
  quality text NOT NULL,
  length_sec smallint NOT NULL,
  aspect text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  series_id uuid,
  episode_number smallint,
  final_status text NOT NULL DEFAULT 'none'::text,
  final_url text,
  final_captions boolean NOT NULL DEFAULT true,
  final_trimmed_sec numeric(6,2) NOT NULL DEFAULT 0,
  final_trimmed_per_clip numeric(6,2)[] NOT NULL DEFAULT '{}'::numeric[],
  final_error text,
  final_requested_at timestamptz,
  error_code text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  planner jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_call_id uuid,
  cast_roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  end_state jsonb,
  upload_package jsonb,
  final_part_label boolean NOT NULL DEFAULT false,
  final_end_card boolean NOT NULL DEFAULT false,
  cover_url text
);

CREATE TABLE public.blocky_story_scenes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  idx smallint NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  speaker_id text NOT NULL,
  line text NOT NULL,
  present_ids text[] NOT NULL,
  location_id text,
  action text NOT NULL DEFAULT ''::text,
  emotion text NOT NULL DEFAULT ''::text,
  shot text NOT NULL DEFAULT ''::text,
  duration_sec smallint NOT NULL,
  image_status text NOT NULL DEFAULT 'queued'::text,
  image_url text,
  image_prompt text NOT NULL DEFAULT ''::text,
  image_job_id uuid,
  clip_status text NOT NULL DEFAULT 'none'::text,
  clip_url text,
  clip_prompt text NOT NULL DEFAULT ''::text,
  clip_job_id uuid,
  error_code text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  placement text NOT NULL DEFAULT ''::text,
  image_check text NOT NULL DEFAULT 'none'::text,
  image_check_notes text,
  free_regen_used boolean NOT NULL DEFAULT false
);

CREATE TABLE public.blocky_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  step text NOT NULL,
  credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blocky_test_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  tool_key text NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_job uuid
);

CREATE TABLE public.blocky_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  kind text NOT NULL,
  tool_key text NOT NULL,
  price_input jsonb NOT NULL,
  credits integer NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text,
  attempt smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 3,
  task_uuid uuid,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  submitted_at timestamptz,
  provider_done_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  output_url text,
  stored_url text,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  error_code text,
  error text,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  test_override_id uuid
);

CREATE TABLE public.blocky_credit_ledger (
  id bigserial,
  user_id uuid NOT NULL,
  story_id uuid,
  charge_id uuid,
  job_id uuid,
  operation text NOT NULL,
  credits integer NOT NULL,
  idempotency_key text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blocky_ai_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  story_id uuid,
  series_id uuid,
  scene_id uuid,
  job_id uuid,
  provider text NOT NULL,
  model text NOT NULL,
  purpose text NOT NULL,
  attempt smallint NOT NULL DEFAULT 1,
  request jsonb NOT NULL,
  response jsonb,
  http_status smallint,
  ok boolean,
  error text,
  cost_usd numeric(12,6),
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.blocky_series_episodes (
  series_id uuid NOT NULL,
  user_id uuid NOT NULL,
  number smallint NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  cliffhanger text NOT NULL,
  story_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blocky_provider_alerts (
  provider text NOT NULL,
  code text NOT NULL DEFAULT ''::text,
  message text NOT NULL DEFAULT ''::text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  count integer NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

ALTER TABLE public.blocky_series ADD CONSTRAINT blocky_series_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_charges ADD CONSTRAINT blocky_charges_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_test_overrides ADD CONSTRAINT blocky_test_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_pkey PRIMARY KEY (id);
ALTER TABLE public.blocky_series_episodes ADD CONSTRAINT blocky_series_episodes_pkey PRIMARY KEY (series_id, number);
ALTER TABLE public.blocky_provider_alerts ADD CONSTRAINT blocky_provider_alerts_pkey PRIMARY KEY (provider);
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_story_id_idx_key UNIQUE (story_id, idx);
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE public.blocky_series ADD CONSTRAINT blocky_series_cast_ids_check CHECK (((cardinality(cast_ids) >= 2) AND (cardinality(cast_ids) <= 5)));
ALTER TABLE public.blocky_series ADD CONSTRAINT blocky_series_concept_check CHECK (((length(concept) >= 1) AND (length(concept) <= 1000)));
ALTER TABLE public.blocky_series ADD CONSTRAINT blocky_series_episode_count_check CHECK (((episode_count >= 3) AND (episode_count <= 10)));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_aspect_check CHECK ((aspect = ANY (ARRAY['9:16'::text, '16:9'::text])));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_cast_ids_check CHECK (((cardinality(cast_ids) >= 1) AND (cardinality(cast_ids) <= 5)));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_check CHECK (((series_id IS NULL) = (episode_number IS NULL)));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_final_status_check CHECK ((final_status = ANY (ARRAY['none'::text, 'building'::text, 'ready'::text, 'failed'::text])));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_length_sec_check CHECK (((length_sec >= 5) AND (length_sec <= 180)));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_quality_check CHECK ((quality = ANY (ARRAY['v2'::text, 'v3'::text, 'v4'::text])));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_source_check CHECK ((source = ANY (ARRAY['idea'::text, 'prompt'::text, 'script'::text, 'episode'::text])));
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pictures'::text, 'pictures_ready'::text, 'animating'::text, 'clips_ready'::text, 'building'::text, 'final_ready'::text, 'failed'::text])));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_check CHECK ((speaker_id = ANY (present_ids)));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_clip_status_check CHECK ((clip_status = ANY (ARRAY['none'::text, 'queued'::text, 'generating'::text, 'ready'::text, 'failed'::text])));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_duration_sec_check CHECK (((duration_sec >= 1) AND (duration_sec <= 15)));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_idx_check CHECK (((idx >= 0) AND (idx <= 39)));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_image_check_check CHECK ((image_check = ANY (ARRAY['none'::text, 'passed'::text, 'failed'::text])));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_image_status_check CHECK ((image_status = ANY (ARRAY['queued'::text, 'generating'::text, 'ready'::text, 'failed'::text])));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_line_check CHECK (((length(line) >= 1) AND (length(line) <= 400)));
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_present_ids_check CHECK (((cardinality(present_ids) >= 1) AND (cardinality(present_ids) <= 3)));
ALTER TABLE public.blocky_charges ADD CONSTRAINT blocky_charges_credits_check CHECK ((credits >= 0));
ALTER TABLE public.blocky_charges ADD CONSTRAINT blocky_charges_step_check CHECK ((step = ANY (ARRAY['pictures'::text, 'edit'::text, 'regenerate'::text, 'retry_picture'::text, 'animate'::text, 'reclip'::text, 'free_regenerate'::text])));
ALTER TABLE public.blocky_test_overrides ADD CONSTRAINT blocky_test_overrides_check CHECK ((expires_at <= (created_at + '02:00:00'::interval)));
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_credits_check CHECK ((credits >= 0));
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'clip'::text])));
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'submitting'::text, 'submitted'::text, 'provider_done'::text, 'succeeded'::text, 'failed'::text, 'canceled'::text])));
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_credits_check CHECK ((credits >= 0));
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_operation_check CHECK ((operation = ANY (ARRAY['charge'::text, 'refund'::text])));
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_provider_check CHECK ((provider = ANY (ARRAY['runware'::text, 'anthropic'::text, 'openai'::text, 'fly'::text])));
ALTER TABLE public.blocky_series_episodes ADD CONSTRAINT blocky_series_episodes_number_check CHECK (((number >= 1) AND (number <= 10)));
ALTER TABLE public.blocky_provider_alerts ADD CONSTRAINT blocky_provider_alerts_provider_check CHECK ((provider = ANY (ARRAY['runware'::text, 'anthropic'::text, 'openai'::text])));
ALTER TABLE public.blocky_series ADD CONSTRAINT blocky_series_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.blocky_series(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_stories ADD CONSTRAINT blocky_stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_speaker_id_fkey FOREIGN KEY (speaker_id) REFERENCES public.blocky_characters(id);
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_story_scenes ADD CONSTRAINT blocky_story_scenes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_charges ADD CONSTRAINT blocky_charges_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_charges ADD CONSTRAINT blocky_charges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_test_overrides ADD CONSTRAINT blocky_test_overrides_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_test_overrides ADD CONSTRAINT blocky_test_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES public.blocky_charges(id);
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.blocky_story_scenes(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_test_override_id_fkey FOREIGN KEY (test_override_id) REFERENCES public.blocky_test_overrides(id);
ALTER TABLE public.blocky_jobs ADD CONSTRAINT blocky_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES public.blocky_charges(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.blocky_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_credit_ledger ADD CONSTRAINT blocky_credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.blocky_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.blocky_story_scenes(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.blocky_series(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_ai_calls ADD CONSTRAINT blocky_ai_calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_series_episodes ADD CONSTRAINT blocky_series_episodes_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.blocky_series(id) ON DELETE CASCADE;
ALTER TABLE public.blocky_series_episodes ADD CONSTRAINT blocky_series_episodes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.blocky_stories(id) ON DELETE SET NULL;
ALTER TABLE public.blocky_series_episodes ADD CONSTRAINT blocky_series_episodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX blocky_ai_calls_job_idx ON public.blocky_ai_calls USING btree (job_id) WHERE (job_id IS NOT NULL);
CREATE INDEX blocky_ai_calls_story_idx ON public.blocky_ai_calls USING btree (story_id, created_at);
CREATE INDEX blocky_credit_ledger_user_idx ON public.blocky_credit_ledger USING btree (user_id, created_at DESC);
CREATE INDEX blocky_jobs_open_idx ON public.blocky_jobs USING btree (status, next_attempt_at) WHERE (status = ANY (ARRAY['queued'::text, 'submitting'::text, 'submitted'::text, 'provider_done'::text]));
CREATE INDEX blocky_jobs_story_idx ON public.blocky_jobs USING btree (story_id, kind, status);
CREATE UNIQUE INDEX blocky_jobs_task_uuid_key ON public.blocky_jobs USING btree (task_uuid) WHERE (task_uuid IS NOT NULL);
CREATE INDEX blocky_series_user_created_idx ON public.blocky_series USING btree (user_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX blocky_stories_episode_key ON public.blocky_stories USING btree (series_id, episode_number) WHERE ((series_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX blocky_stories_user_created_idx ON public.blocky_stories USING btree (user_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX blocky_story_scenes_story_idx ON public.blocky_story_scenes USING btree (story_id, idx);

/* ─── Who can read and write ──────────────────────────────────────────── */

-- Every table: row-level security on. The browser can only READ its own
-- stories, scenes, series and episodes (that is what live updates use); it can
-- write nothing. Everything else is the service role's.
ALTER TABLE public.blocky_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_story_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_test_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_provider_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocky_series_select_own ON public.blocky_series FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND (deleted_at IS NULL)));
CREATE POLICY blocky_series_episodes_select_own ON public.blocky_series_episodes FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY blocky_stories_select_own ON public.blocky_stories FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND (deleted_at IS NULL)));
CREATE POLICY blocky_story_scenes_select_own ON public.blocky_story_scenes FOR SELECT TO authenticated USING ((user_id = auth.uid()));

REVOKE ALL ON public.blocky_characters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_characters TO service_role;
REVOKE ALL ON public.blocky_series FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_series TO service_role;
GRANT SELECT ON public.blocky_series TO authenticated;
REVOKE ALL ON public.blocky_stories FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_stories TO service_role;
GRANT SELECT ON public.blocky_stories TO authenticated;
REVOKE ALL ON public.blocky_story_scenes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_story_scenes TO service_role;
GRANT SELECT ON public.blocky_story_scenes TO authenticated;
REVOKE ALL ON public.blocky_charges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_charges TO service_role;
REVOKE ALL ON public.blocky_test_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_test_overrides TO service_role;
REVOKE ALL ON public.blocky_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_jobs TO service_role;
REVOKE ALL ON public.blocky_credit_ledger FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_credit_ledger TO service_role;
REVOKE ALL ON public.blocky_ai_calls FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_ai_calls TO service_role;
REVOKE ALL ON public.blocky_series_episodes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_series_episodes TO service_role;
GRANT SELECT ON public.blocky_series_episodes TO authenticated;
REVOKE ALL ON public.blocky_provider_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blocky_provider_alerts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.blocky_credit_ledger_id_seq TO service_role;

CREATE TRIGGER zzz_blocky_ai_calls_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_ai_calls FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes();
CREATE TRIGGER zzz_blocky_characters_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_characters FOR EACH ROW EXECUTE FUNCTION public.blocky_characters_block_client_writes();
CREATE TRIGGER zzz_blocky_charges_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_charges FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes();
CREATE TRIGGER zzz_blocky_credit_ledger_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_credit_ledger FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes();
CREATE TRIGGER zzz_blocky_jobs_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_jobs FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER zzz_blocky_series_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_series FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER zzz_blocky_series_episodes_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_series_episodes FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER zzz_blocky_stories_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_stories FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER zzz_blocky_story_scenes_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_story_scenes FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER zzz_blocky_test_overrides_guard BEFORE INSERT OR DELETE OR UPDATE ON public.blocky_test_overrides FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes();

/* ─── The money path and the story state ──────────────────────────────── */

CREATE OR REPLACE FUNCTION public.blocky_create_story(p_user_id uuid, p_story jsonb, p_scenes jsonb, p_call_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id    uuid := gen_random_uuid();
  v_scene jsonb;
  v_idx   integer := 0;
BEGIN
  IF p_scenes IS NULL OR jsonb_typeof(p_scenes) <> 'array' OR jsonb_array_length(p_scenes) < 1 OR jsonb_array_length(p_scenes) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: 1 to 40 scenes' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.blocky_stories (id, user_id, source, input, title, cast_ids, quality, length_sec, aspect, locations, planner, series_id, episode_number)
  VALUES (
    v_id, p_user_id, p_story->>'source', COALESCE(p_story->'input', '{}'::jsonb), COALESCE(p_story->>'title', ''),
    ARRAY(SELECT jsonb_array_elements_text(p_story->'cast_ids')), p_story->>'quality', (p_story->>'length_sec')::smallint,
    p_story->>'aspect', COALESCE(p_story->'locations', '[]'::jsonb), COALESCE(p_story->'planner', '{}'::jsonb),
    NULLIF(p_story->>'series_id', '')::uuid, NULLIF(p_story->>'episode_number', '')::smallint
  );

  FOR v_scene IN SELECT value FROM jsonb_array_elements(p_scenes) LOOP
    INSERT INTO public.blocky_story_scenes (story_id, user_id, idx, title, speaker_id, line, present_ids, location_id, action, emotion, shot, placement, duration_sec)
    VALUES (
      v_id, p_user_id, v_idx, COALESCE(v_scene->>'title', ''), v_scene->>'speaker_id', v_scene->>'line',
      ARRAY(SELECT jsonb_array_elements_text(v_scene->'present_ids')), v_scene->>'location_id',
      COALESCE(v_scene->>'action', ''), COALESCE(v_scene->>'emotion', ''), COALESCE(v_scene->>'shot', ''),
      COALESCE(v_scene->>'placement', ''), (v_scene->>'duration_sec')::smallint
    );
    v_idx := v_idx + 1;
  END LOOP;

  IF p_story->>'series_id' IS NOT NULL THEN
    UPDATE public.blocky_series_episodes SET story_id = v_id
    WHERE series_id = (p_story->>'series_id')::uuid AND number = (p_story->>'episode_number')::smallint AND user_id = p_user_id;
  END IF;

  IF cardinality(p_call_ids) > 0 THEN
    UPDATE public.blocky_ai_calls SET story_id = v_id WHERE id = ANY (p_call_ids) AND user_id = p_user_id;
  END IF;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.blocky_refresh_story_status(p_story_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.blocky_stories WHERE id = p_story_id FOR UPDATE;
  IF v_status = 'pictures' AND NOT EXISTS (
    SELECT 1 FROM public.blocky_story_scenes WHERE story_id = p_story_id AND image_status IN ('queued', 'generating')
  ) THEN
    UPDATE public.blocky_stories SET status = 'pictures_ready' WHERE id = p_story_id;
    RETURN 'pictures_ready';
  END IF;
  IF v_status = 'animating' AND NOT EXISTS (
    SELECT 1 FROM public.blocky_story_scenes WHERE story_id = p_story_id AND clip_status IN ('queued', 'generating')
  ) THEN
    UPDATE public.blocky_stories SET status = 'clips_ready' WHERE id = p_story_id;
    RETURN 'clips_ready';
  END IF;
  RETURN v_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blocky_charge_step(p_user_id uuid, p_story_id uuid, p_step text, p_from_statuses text[], p_to_status text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_story     public.blocky_stories%ROWTYPE;
  v_plan      text;
  v_item      jsonb;
  v_credits   integer;
  v_total     integer := 0;
  v_min_plan  text;
  v_charge_id uuid := gen_random_uuid();
  v_job_id    uuid;
  v_scene     public.blocky_story_scenes%ROWTYPE;
  v_jobs      jsonb := '[]'::jsonb;
  v_priced    jsonb := '[]'::jsonb;
  v_override  uuid;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'VALIDATION: items must be a non-empty array of at most 40' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.blocky_stories WHERE id = p_story_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_story.user_id <> p_user_id THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_story.status = ANY (p_from_statuses)) THEN
    RAISE EXCEPTION 'WRONG_STATUS: story is %', v_story.status USING ERRCODE = '55000';
  END IF;

  SELECT plan_code INTO v_plan FROM public.profiles WHERE id = p_user_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'kind') NOT IN ('image', 'clip') OR jsonb_typeof(v_item->'request') <> 'object' THEN
      RAISE EXCEPTION 'VALIDATION: bad item' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_scene FROM public.blocky_story_scenes WHERE id = (v_item->>'scene_id')::uuid AND story_id = p_story_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: scene' USING ERRCODE = 'P0002';
    END IF;
    SELECT min_plan INTO v_min_plan FROM public.tool_prices WHERE tool_key = v_item->>'tool_key' AND active;
    IF public.blocky_plan_rank(v_plan) < GREATEST(1, public.blocky_plan_rank(v_min_plan)) THEN
      -- A single-item step may use one unexpired, unused admin test override.
      IF jsonb_array_length(p_items) = 1 THEN
        SELECT id INTO v_override FROM public.blocky_test_overrides
        WHERE user_id = p_user_id AND story_id = p_story_id AND tool_key = v_item->>'tool_key'
          AND used_at IS NULL AND expires_at > now()
        ORDER BY created_at LIMIT 1 FOR UPDATE;
      END IF;
      IF v_override IS NULL THEN
        RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED: %', COALESCE(v_min_plan, 'starter') USING ERRCODE = '42501';
      END IF;
    END IF;
    v_credits := public.compute_tool_price(v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb));
    IF v_credits IS NULL THEN
      RAISE EXCEPTION 'NO_SERVER_PRICE: %', v_item->>'tool_key' USING ERRCODE = '22023';
    END IF;
    -- Free regenerate: once, for a picture our automatic check flagged.
    IF p_step = 'free_regenerate' THEN
      IF jsonb_array_length(p_items) <> 1 OR v_item->>'kind' <> 'image' OR v_scene.image_check <> 'failed' OR v_scene.free_regen_used THEN
        RAISE EXCEPTION 'WRONG_STATUS: no free regenerate for this scene' USING ERRCODE = '55000';
      END IF;
      v_credits := 0;
    END IF;
    v_total := v_total + v_credits;
    v_priced := v_priced || jsonb_build_array(v_item || jsonb_build_object('credits', v_credits));
  END LOOP;

  IF v_total > 0 THEN
    PERFORM public.deduct_credits(p_user_id, v_total);
  END IF;

  INSERT INTO public.blocky_charges (id, user_id, story_id, step, credits)
  VALUES (v_charge_id, p_user_id, p_story_id, p_step, v_total);

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_priced) LOOP
    v_job_id := gen_random_uuid();
    INSERT INTO public.blocky_jobs (id, user_id, story_id, scene_id, charge_id, kind, tool_key, price_input, credits, request, test_override_id)
    VALUES (v_job_id, p_user_id, p_story_id, (v_item->>'scene_id')::uuid, v_charge_id, v_item->>'kind',
            v_item->>'tool_key', COALESCE(v_item->'price_input', '{}'::jsonb), (v_item->>'credits')::integer, v_item->'request', v_override);
    INSERT INTO public.blocky_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
    VALUES (p_user_id, p_story_id, v_charge_id, v_job_id, 'charge', (v_item->>'credits')::integer, 'job:' || v_job_id || ':charge', p_step);

    IF v_item->>'kind' = 'image' THEN
      UPDATE public.blocky_story_scenes
      SET image_status = 'queued', image_job_id = v_job_id, image_prompt = COALESCE(v_item->>'prompt', image_prompt),
          error_code = NULL, error = NULL, image_check = 'none', image_check_notes = NULL,
          free_regen_used = free_regen_used OR p_step = 'free_regenerate'
      WHERE id = (v_item->>'scene_id')::uuid;
    ELSE
      UPDATE public.blocky_story_scenes
      SET clip_status = 'queued', clip_job_id = v_job_id, clip_prompt = COALESCE(v_item->>'prompt', clip_prompt),
          duration_sec = COALESCE((v_item->'price_input'->>'durationSec')::smallint, duration_sec),
          error_code = NULL, error = NULL
      WHERE id = (v_item->>'scene_id')::uuid;
    END IF;
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object('job_id', v_job_id, 'scene_id', v_item->>'scene_id', 'credits', (v_item->>'credits')::integer));
  END LOOP;

  IF v_override IS NOT NULL THEN
    UPDATE public.blocky_test_overrides SET used_at = now(), used_by_job = v_job_id WHERE id = v_override;
  END IF;

  UPDATE public.blocky_stories SET status = p_to_status, error_code = NULL, error = NULL WHERE id = p_story_id;

  RETURN jsonb_build_object('charge_id', v_charge_id, 'credits', v_total, 'jobs', v_jobs, 'test_override_id', v_override);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blocky_complete_job(p_job_id uuid, p_stored_url text, p_cost_usd numeric, p_result jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job public.blocky_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.blocky_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL THEN
    RETURN false;
  END IF;
  UPDATE public.blocky_jobs
  SET status = 'succeeded', stored_url = p_stored_url, result = COALESCE(p_result, result),
      cost_usd = cost_usd + COALESCE(p_cost_usd, 0), finished_at = now(), lease_until = NULL
  WHERE id = p_job_id;
  IF v_job.kind = 'image' THEN
    UPDATE public.blocky_story_scenes SET image_status = 'ready', image_url = p_stored_url, error_code = NULL, error = NULL
    WHERE id = v_job.scene_id AND image_job_id = p_job_id;
  ELSE
    UPDATE public.blocky_story_scenes SET clip_status = 'ready', clip_url = p_stored_url, error_code = NULL, error = NULL
    WHERE id = v_job.scene_id AND clip_job_id = p_job_id;
  END IF;
  PERFORM public.blocky_refresh_story_status(v_job.story_id);
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blocky_refund_job(p_job_id uuid, p_error_code text, p_error text, p_cost_usd numeric DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_job public.blocky_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.blocky_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_job.credits > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_job.credits,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_job.credits)
    WHERE id = v_job.user_id;
  END IF;
  INSERT INTO public.blocky_credit_ledger (user_id, story_id, charge_id, job_id, operation, credits, idempotency_key, reason)
  VALUES (v_job.user_id, v_job.story_id, v_job.charge_id, p_job_id, 'refund', v_job.credits, 'job:' || p_job_id || ':refund', p_error_code)
  ON CONFLICT (idempotency_key) DO NOTHING;
  UPDATE public.blocky_jobs
  SET status = 'failed', error_code = p_error_code, error = p_error, refunded_at = now(), finished_at = now(),
      lease_until = NULL, cost_usd = cost_usd + COALESCE(p_cost_usd, 0)
  WHERE id = p_job_id;
  IF v_job.kind = 'image' THEN
    UPDATE public.blocky_story_scenes SET image_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND image_job_id = p_job_id;
  ELSE
    UPDATE public.blocky_story_scenes SET clip_status = 'failed', error_code = p_error_code, error = p_error
    WHERE id = v_job.scene_id AND clip_job_id = p_job_id;
  END IF;
  PERFORM public.blocky_refresh_story_status(v_job.story_id);
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blocky_raise_provider_alert(p_provider text, p_code text, p_message text, p_context jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_prev timestamptz; v_notify boolean;
BEGIN
  SELECT last_seen_at INTO v_prev FROM public.blocky_provider_alerts WHERE provider = p_provider FOR UPDATE;
  v_notify := v_prev IS NULL OR v_prev < now() - interval '1 hour';
  INSERT INTO public.blocky_provider_alerts AS a (provider, code, message, context, count, opened_at, last_seen_at, notified_at)
  VALUES (p_provider, left(coalesce(p_code, ''), 200), left(coalesce(p_message, ''), 1000), coalesce(p_context, '{}'::jsonb), 1, now(), now(), CASE WHEN v_notify THEN now() END)
  ON CONFLICT (provider) DO UPDATE SET
    code = EXCLUDED.code, message = EXCLUDED.message, context = EXCLUDED.context,
    count = CASE WHEN v_notify THEN 1 ELSE a.count + 1 END,
    opened_at = CASE WHEN v_notify THEN now() ELSE a.opened_at END,
    last_seen_at = now(),
    notified_at = CASE WHEN v_notify THEN now() ELSE a.notified_at END;
  RETURN v_notify;
END;
$function$
;

REVOKE ALL ON FUNCTION public.blocky_create_story(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_create_story(uuid, jsonb, jsonb, uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_refresh_story_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_refresh_story_status(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_charge_step(uuid, uuid, text, text[], text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_charge_step(uuid, uuid, text, text[], text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_complete_job(uuid, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_complete_job(uuid, text, numeric, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_refund_job(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_refund_job(uuid, text, text, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.blocky_raise_provider_alert(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_raise_provider_alert(text, text, text, jsonb) TO service_role;

/* ─── Live updates ────────────────────────────────────────────────────── */

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocky_stories, public.blocky_story_scenes;
  END IF;
END $$;

/* ─── The job sweep (every 20 seconds, only when something is in flight) ── */

-- Calls blocky-worker's reconcile with its secret. Both live in the vault
-- (blocky_worker_url, blocky_worker_secret); until they are set this does nothing.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.trigger_blocky_reconcile()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE secret text; worker_url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.blocky_jobs WHERE status IN ('queued', 'submitting', 'submitted', 'provider_done'))
     AND NOT EXISTS (SELECT 1 FROM public.blocky_stories WHERE status = 'building') THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'blocky_worker_secret' LIMIT 1;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'blocky_worker_url' LIMIT 1;
  IF secret IS NULL OR worker_url IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-blocky-worker-secret', secret),
    body := jsonb_build_object('action', 'reconcile'),
    timeout_milliseconds := 15000
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.trigger_blocky_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.trigger_blocky_reconcile() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'blocky-story-reconcile';
    PERFORM cron.schedule('blocky-story-reconcile', '20 seconds', 'select private.trigger_blocky_reconcile();');
  END IF;
END $$;

/* ─── Price rows and the switch ───────────────────────────────────────── */

-- Blocky's own price rows and its switch. On the real database they exist
-- already (20261006190000, kept by the undo); a fresh database gets them here.
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes) VALUES ('image:blocky-story', NULL, 4, NULL, ARRAY['768x1376', '1376x768']::text[], NULL, 'starter', true, 'Blocky Stories scene picture / edit / regenerate: Nano Banana 2 Lite ($0.035 each)') ON CONFLICT (tool_key) DO NOTHING;
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes) VALUES ('video:blocky-story-v2', 5, NULL, ARRAY[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::integer[], ARRAY['720x1280', '1280x720']::text[], true, 'starter', true, 'Blocky Stories V2 clip: Wan2.6 Flash 720p, i2v, audio ($0.050/s); falls back once to Seedance 2.0 Mini') ON CONFLICT (tool_key) DO NOTHING;
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes) VALUES ('video:blocky-story-v3', 9, NULL, ARRAY[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::integer[], ARRAY['720x1280', '1280x720']::text[], true, 'pro', true, 'Blocky Stories V3 clip: Seedance 2.0 Mini 720p, i2v, audio ($0.082/s)') ON CONFLICT (tool_key) DO NOTHING;
INSERT INTO public.tool_prices (tool_key, credits_per_second, flat_credits, allowed_durations, allowed_sizes, requires_sound, min_plan, active, notes) VALUES ('video:blocky-story-v4', 16, NULL, ARRAY[4, 6, 8]::integer[], ARRAY['720x1280', '1280x720']::text[], true, 'generative', true, 'Blocky Stories V4 clip: Veo 3.1 Fast 720p, i2v, audio ($0.15/s)') ON CONFLICT (tool_key) DO NOTHING;
INSERT INTO public.global_feature_flags (key, enabled, note) VALUES ('blocky_v1', false, 'Blocky Stories for everyone. false = hidden (accounts with a per-user blocky_v1 flag still get it).') ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
