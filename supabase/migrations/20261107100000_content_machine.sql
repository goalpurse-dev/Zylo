-- Content Machine (content/CONTENT_MACHINE_SPEC.md), Phase 1: the tables, and the one place money is
-- reserved. Admin-only and server-only: every table has RLS on and no grants to anon/authenticated, so
-- only the service role (the content-machine-api / worker edge functions) can read or write them.
--
-- Create-only: nothing existing is altered or dropped.
-- Rollback: supabase/rollbacks/20261107100000_content_machine.sql (drops these cm_* objects only).
--
-- Money: every paid call goes through cm_reserve_spend BEFORE it is made. Under a lock on the single
-- cm_settings row it sums what is already spent (actual, else the reserved estimate) for today and this
-- month in the settings' time zone (Europe/Helsinki), per provider and per lane (e.g. slideshow), checks
-- the kill switch and every cap, and only then inserts the reservation. Parallel workers wait on the lock,
-- so they cannot overspend together. cm_settle_spend writes the provider's actual cost afterwards.
BEGIN;
SET LOCAL lock_timeout = '5s';

/* ─── settings (one row) ─────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  daily_budget_usd numeric(10, 2) NOT NULL DEFAULT 8.00 CHECK (daily_budget_usd >= 0),
  monthly_budget_usd numeric(10, 2) NOT NULL DEFAULT 150.00 CHECK (monthly_budget_usd >= 0),
  -- {provider: usd per day}; a provider not listed has no cap of its own (the daily and monthly caps still apply).
  per_provider_daily_caps jsonb NOT NULL DEFAULT '{"runware": 6.00, "anthropic": 1.50, "apify": 0.50}',
  -- {lane: usd per day}: a cap for one kind of work, whatever provider it uses.
  lane_daily_caps jsonb NOT NULL DEFAULT '{"slideshow": 2.00}',
  daily_video_target integer NOT NULL DEFAULT 15 CHECK (daily_video_target BETWEEN 0 AND 100),
  slideshows_per_day integer NOT NULL DEFAULT 5 CHECK (slideshows_per_day BETWEEN 0 AND 50),
  format_mix jsonb NOT NULL DEFAULT '{"zyvo_native": 6, "listicle_slideshow": 2, "long_form_cutdown": 1}',
  auto_produce boolean NOT NULL DEFAULT true,
  end_card boolean NOT NULL DEFAULT true,
  -- true: no call happens at all, mocked or paid.
  kill_switch boolean NOT NULL DEFAULT false,
  -- true: paid calls are mocked at $0. ON until the owner says the first paid run may happen.
  dry_run boolean NOT NULL DEFAULT true,
  run_time_local text NOT NULL DEFAULT '07:00' CHECK (run_time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text NOT NULL DEFAULT 'Europe/Helsinki',
  watchlist jsonb NOT NULL DEFAULT '{"accounts": ["@aicenturyclips"], "hashtags": ["#aitools", "#aivideo", "#aifruit", "#faceless", "#youtubeautomation", "#stickman", "#claymation", "#aianimation"], "proposed": []}',
  brand_rules text NOT NULL DEFAULT $rules$- Promote Zyvo softly and honestly. Zyvo appears as the tool used, a listicle entry, a caption CTA, or an end card.
- No fake testimonials, fake users, invented income claims or invented stats. Listicle entries describe real tools accurately.
- No copyrighted characters, brands, logos, celebrity likenesses or real people. No copied designs from other creators.
- Flag ai_label_required for any realistic AI-generated visuals.
- No misleading "news" or fake events; no medical or financial advice.
- Vary content so it is never mass-produced duplicates.$rules$,
  -- {"main": "...", "fast": "..."}; empty means the CM_MODEL_MAIN / CM_MODEL_FAST function secrets.
  models jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
INSERT INTO public.cm_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

/* ─── runs, scout, ideas, generations, packages, posts ───────────────── */
CREATE TABLE IF NOT EXISTS public.cm_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  kind text NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily', 'slideshows', 'manual')),
  input jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scouting', 'ideating', 'producing', 'packaging', 'done', 'failed', 'budget_stopped')),
  dry_run boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  finished_at timestamptz,
  spend_usd numeric(12, 6) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One automatic daily run per day; manual and slideshow runs may be many.
CREATE UNIQUE INDEX IF NOT EXISTS cm_runs_one_daily ON public.cm_runs (run_date) WHERE kind = 'daily';

CREATE TABLE IF NOT EXISTS public.cm_scout_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cm_runs (id) ON DELETE CASCADE,
  raw_sources jsonb NOT NULL DEFAULT '[]',
  trend_brief text,
  top_formats jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cm_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.cm_runs (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'producing', 'done', 'failed', 'skipped_budget')),
  source text NOT NULL DEFAULT 'machine' CHECK (source IN ('machine', 'owner')),
  format text NOT NULL,
  zyvo_tool text,
  title text NOT NULL,
  hook text,
  concept text,
  script jsonb NOT NULL DEFAULT '{}',
  generator_inputs jsonb NOT NULL DEFAULT '{}',
  making_of_angle text,
  why_it_could_go_viral text,
  zyvo_integration text,
  target_platforms text[] NOT NULL DEFAULT '{tiktok,instagram,youtube}',
  estimated_cost_usd numeric(12, 6),
  virality_score smallint CHECK (virality_score BETWEEN 1 AND 10),
  similarity_hash text,
  embedding jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_ideas_run ON public.cm_ideas (run_id);
CREATE INDEX IF NOT EXISTS cm_ideas_created ON public.cm_ideas (created_at DESC);

-- Files are storage paths in the private content-machine bucket (signed on read), never public URLs.
CREATE TABLE IF NOT EXISTS public.cm_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.cm_ideas (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('result', 'making_of', 'slideshow')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'rendering', 'done', 'failed')),
  video_path text,
  thumbnail_path text,
  files jsonb NOT NULL DEFAULT '{}',
  duration_s numeric(8, 2),
  aspect text NOT NULL DEFAULT '9:16',
  source_assets jsonb NOT NULL DEFAULT '{}',
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_generations_idea ON public.cm_generations (idea_id);

CREATE TABLE IF NOT EXISTS public.cm_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.cm_generations (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  caption text,
  title text,
  hashtags text[] NOT NULL DEFAULT '{}',
  on_screen_text text[] NOT NULL DEFAULT '{}',
  suggested_post_time text,
  ai_label_required boolean NOT NULL DEFAULT false,
  sound_suggestion text,
  compliance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_id, platform)
);

CREATE TABLE IF NOT EXISTS public.cm_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES public.cm_packages (id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  post_url text NOT NULL,
  posted_at timestamptz,
  views_24h integer,
  views_7d integer,
  likes integer,
  comments integer,
  shares integer,
  signups_attributed integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* ─── money ──────────────────────────────────────────────────────────── */
-- One row per paid call, inserted (reserved) before the call. Spend = actual_usd once known, else the
-- estimate: a call that never reported back still counts.
CREATE TABLE IF NOT EXISTS public.cm_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.cm_runs (id) ON DELETE SET NULL,
  idea_id uuid REFERENCES public.cm_ideas (id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('runware', 'anthropic', 'apify', 'youtube', 'fly', 'other')),
  lane text,
  operation text NOT NULL,
  estimated_usd numeric(12, 6) NOT NULL CHECK (estimated_usd >= 0),
  actual_usd numeric(12, 6) CHECK (actual_usd >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'failed')),
  dry_run boolean NOT NULL DEFAULT false,
  -- In a dry run nothing is reserved (estimated_usd = 0); this is what the call would have cost.
  would_cost_usd numeric(12, 6),
  request_ref text,
  error text,
  local_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS cm_spend_ledger_day ON public.cm_spend_ledger (local_day, provider);
CREATE INDEX IF NOT EXISTS cm_spend_ledger_created ON public.cm_spend_ledger (created_at DESC);

-- What an operation is expected to cost (e.g. runware.image.fast). Phase 5 recalibrates from actuals.
CREATE TABLE IF NOT EXISTS public.cm_cost_estimates (
  operation text PRIMARY KEY,
  provider text NOT NULL,
  estimate_usd numeric(12, 6) NOT NULL CHECK (estimate_usd >= 0),
  samples integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cm_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_email text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_audit_log_created ON public.cm_audit_log (created_at DESC);

/* ─── jobs (the worker claims these from Phase 2 on) ─────────────────── */
CREATE TABLE IF NOT EXISTS public.cm_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.cm_runs (id) ON DELETE CASCADE,
  idea_id uuid REFERENCES public.cm_ideas (id) ON DELETE CASCADE,
  stage text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 2,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cm_jobs_due ON public.cm_jobs (status, run_after);

/* ─── nobody but the service role ────────────────────────────────────── */
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cm_settings', 'cm_runs', 'cm_scout_reports', 'cm_ideas', 'cm_generations', 'cm_packages',
                           'cm_posts', 'cm_spend_ledger', 'cm_cost_estimates', 'cm_audit_log', 'cm_jobs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

/* ─── spend: reserve before, settle after ────────────────────────────── */
-- Returns {ok, reason, ledger_id, today_usd, month_usd, provider_today_usd, lane_today_usd, ...caps}.
-- reason: kill_switch | daily_cap | monthly_cap | provider_cap | lane_cap | bad_estimate. Exactly at a cap still goes.
-- p_dry_run: the caps are checked with the real estimate (so a dry run shows what would be refused), but
-- the row reserves $0 and records the estimate in would_cost_usd.
CREATE OR REPLACE FUNCTION public.cm_reserve_spend(
  p_provider text, p_operation text, p_estimated_usd numeric,
  p_lane text DEFAULT NULL, p_run_id uuid DEFAULT NULL, p_idea_id uuid DEFAULT NULL, p_dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  s public.cm_settings%ROWTYPE;
  v_day date;
  v_today numeric; v_month numeric; v_provider numeric; v_lane numeric;
  v_provider_cap numeric; v_lane_cap numeric;
  v_reason text;
  v_id uuid;
BEGIN
  SELECT * INTO s FROM public.cm_settings WHERE id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cm_settings row is missing'; END IF;
  v_day := (now() AT TIME ZONE s.timezone)::date;
  v_provider_cap := NULLIF(s.per_provider_daily_caps ->> p_provider, '')::numeric;
  v_lane_cap := CASE WHEN p_lane IS NULL THEN NULL ELSE NULLIF(s.lane_daily_caps ->> p_lane, '')::numeric END;

  SELECT coalesce(sum(coalesce(actual_usd, estimated_usd)) FILTER (WHERE local_day = v_day), 0),
         coalesce(sum(coalesce(actual_usd, estimated_usd)), 0),
         coalesce(sum(coalesce(actual_usd, estimated_usd)) FILTER (WHERE local_day = v_day AND provider = p_provider), 0),
         coalesce(sum(coalesce(actual_usd, estimated_usd)) FILTER (WHERE local_day = v_day AND lane IS NOT DISTINCT FROM p_lane AND p_lane IS NOT NULL), 0)
    INTO v_today, v_month, v_provider, v_lane
    FROM public.cm_spend_ledger
   WHERE local_day >= date_trunc('month', v_day)::date AND local_day <= v_day;

  v_reason := CASE
    WHEN s.kill_switch THEN 'kill_switch'
    WHEN p_estimated_usd IS NULL OR p_estimated_usd < 0 THEN 'bad_estimate'
    WHEN v_today + p_estimated_usd > s.daily_budget_usd THEN 'daily_cap'
    WHEN v_month + p_estimated_usd > s.monthly_budget_usd THEN 'monthly_cap'
    WHEN v_provider_cap IS NOT NULL AND v_provider + p_estimated_usd > v_provider_cap THEN 'provider_cap'
    WHEN v_lane_cap IS NOT NULL AND v_lane + p_estimated_usd > v_lane_cap THEN 'lane_cap'
  END;

  IF v_reason IS NULL THEN
    INSERT INTO public.cm_spend_ledger (run_id, idea_id, provider, lane, operation, estimated_usd, dry_run, would_cost_usd, local_day)
    VALUES (p_run_id, p_idea_id, p_provider, p_lane, p_operation,
            CASE WHEN p_dry_run THEN 0 ELSE p_estimated_usd END, p_dry_run,
            CASE WHEN p_dry_run THEN p_estimated_usd END, v_day)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', v_reason IS NULL, 'reason', v_reason, 'ledger_id', v_id, 'local_day', v_day,
    'today_usd', v_today, 'month_usd', v_month, 'provider_today_usd', v_provider, 'lane_today_usd', v_lane,
    'daily_cap_usd', s.daily_budget_usd, 'monthly_cap_usd', s.monthly_budget_usd,
    'provider_cap_usd', v_provider_cap, 'lane_cap_usd', v_lane_cap);
END;
$$;

-- After the call: the provider's actual cost (status settled), or failed. Failed with no actual keeps the
-- estimate counted (the provider may have charged); failed with actual 0 releases it. A row settles once.
CREATE OR REPLACE FUNCTION public.cm_settle_spend(
  p_ledger_id uuid, p_actual_usd numeric, p_status text DEFAULT 'settled', p_request_ref text DEFAULT NULL, p_error text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF p_status NOT IN ('settled', 'failed') THEN RAISE EXCEPTION 'cm_settle_spend: bad status %', p_status; END IF;
  IF p_actual_usd IS NOT NULL AND p_actual_usd < 0 THEN RAISE EXCEPTION 'cm_settle_spend: negative actual'; END IF;
  UPDATE public.cm_spend_ledger
     SET actual_usd = CASE WHEN dry_run THEN 0 ELSE p_actual_usd END,
         status = p_status, request_ref = coalesce(p_request_ref, request_ref),
         error = left(p_error, 500), settled_at = now()
   WHERE id = p_ledger_id AND status = 'reserved';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cm_reserve_spend(text, text, numeric, text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cm_reserve_spend(text, text, numeric, text, uuid, uuid, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cm_settle_spend(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cm_settle_spend(uuid, numeric, text, text, text) TO service_role;

/* ─── private bucket for the machine's files ─────────────────────────── */
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-machine', 'content-machine', false, 524288000)
ON CONFLICT (id) DO NOTHING;

COMMIT;
