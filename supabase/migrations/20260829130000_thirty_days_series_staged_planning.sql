-- Series creation was one synchronous edge-function request chaining
-- research -> franchise resolution -> creative plan -> critic -> repair ->
-- billing -> DB insert. Measured live: a best-case run (cached research)
-- takes ~129s; an uncached run comfortably exceeds Supabase's ~150s platform
-- request-idle ceiling, and the platform kills the whole isolate with an
-- ungraceful 504 and no response body at all — no error message, no partial
-- progress, and (worse) research is only cached on FULL request success, so
-- a franchise that fails downstream of research re-pays that cost on every
-- retry forever. No combination of per-call timeouts fixes this: the
-- mandatory sequential cost alone can exceed the ceiling before a single
-- retry. This migration splits series creation into a durable draft row
-- created instantly (0 credits charged) plus staged, resumable background
-- progress, mirroring the EdgeRuntime.waitUntil pattern already proven in
-- runware-video/index.ts for the same class of platform-timeout problem.

ALTER TABLE public.thirty_days_series
  ADD COLUMN IF NOT EXISTS planning_stage text,
  ADD COLUMN IF NOT EXISTS planning_error text,
  ADD COLUMN IF NOT EXISTS planning_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS planning_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.thirty_days_series
  ADD CONSTRAINT thirty_days_series_planning_stage_check
    CHECK (planning_stage IS NULL OR planning_stage IN (
      'resolving', 'researching', 'planning', 'validating', 'reserving'
    )),
  ADD CONSTRAINT thirty_days_series_planning_payload_object
    CHECK (jsonb_typeof(planning_payload) = 'object');

-- Creates the durable row a client polls immediately, before any OpenAI call
-- runs. Deliberately re-validates only what doesn't require the generated
-- plan (universe/premise/days/style/quality tier/plan eligibility) so a
-- doomed request (e.g. PLAN_UPGRADE_REQUIRED) fails in milliseconds instead
-- of after a wasted 100+ second generation. Charges nothing.
CREATE OR REPLACE FUNCTION public.begin_thirty_days_series_draft(
  p_user_id uuid,
  p_universe text,
  p_premise text,
  p_visual_style text,
  p_quality_tier text,
  p_days_per_episode integer
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_series public.thirty_days_series;
  v_tier public.thirty_days_quality_tiers;
  v_plan_code text;
  v_plan_rank integer;
  v_min_rank integer;
  v_style text := COALESCE(NULLIF(trim(p_visual_style), ''), 'auto');
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_universe, ''))) < 2 THEN RAISE EXCEPTION 'UNIVERSE_REQUIRED'; END IF;
  IF length(trim(COALESCE(p_premise, ''))) < 5 THEN RAISE EXCEPTION 'PREMISE_REQUIRED'; END IF;
  IF p_days_per_episode NOT IN (1, 2, 3, 5) THEN RAISE EXCEPTION 'INVALID_DAYS_PER_EPISODE'; END IF;
  IF v_style NOT IN ('auto', 'cinematic_3d', 'anime_accurate', 'realistic', 'dark_cinematic') THEN
    RAISE EXCEPTION 'INVALID_VISUAL_STYLE';
  END IF;

  SELECT * INTO v_tier FROM public.thirty_days_quality_tiers
  WHERE quality_tier = p_quality_tier FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_QUALITY_TIER'; END IF;

  SELECT lower(COALESCE(plan_code, 'free')) INTO v_plan_code
  FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  v_plan_rank := CASE v_plan_code WHEN 'generative' THEN 3 WHEN 'pro' THEN 2
    WHEN 'starter' THEN 1 WHEN 'affiliate' THEN 1 ELSE 0 END;
  v_min_rank := CASE v_tier.min_plan WHEN 'generative' THEN 3 WHEN 'pro' THEN 2 ELSE 1 END;
  IF v_plan_rank < v_min_rank THEN RAISE EXCEPTION 'PLAN_UPGRADE_REQUIRED'; END IF;

  INSERT INTO public.thirty_days_series (
    user_id, title, universe, premise, visual_style, quality_tier,
    days_per_episode, status, planning_stage, planning_payload, planning_updated_at,
    master_story_bible, hidden_future_beats
  ) VALUES (
    p_user_id, '30 Days in ' || trim(p_universe), trim(p_universe), trim(p_premise),
    v_style, v_tier.quality_tier, p_days_per_episode, 'planning', 'resolving',
    jsonb_build_object('premise', trim(p_premise), 'visualStyle', v_style, 'qualityTier', v_tier.quality_tier, 'daysPerEpisode', p_days_per_episode),
    now(), '{}'::jsonb, '[]'::jsonb
  ) RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_thirty_days_series_draft(uuid, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_series_draft(uuid, text, text, text, text, integer) TO service_role;

-- Called by the background planning pipeline after every stage — persists
-- resumable progress (research notes, resolved franchise, draft plan) so a
-- retry after a failure resumes past whatever already completed instead of
-- re-running expensive, already-paid-for OpenAI calls.
CREATE OR REPLACE FUNCTION public.service_update_thirty_days_series_planning(
  p_series_id uuid,
  p_stage text,
  p_payload_patch jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_series public.thirty_days_series;
BEGIN
  UPDATE public.thirty_days_series
  SET planning_stage = COALESCE(p_stage, planning_stage),
      planning_payload = planning_payload || COALESCE(p_payload_patch, '{}'::jsonb),
      planning_error = p_error,
      status = CASE WHEN p_error IS NOT NULL THEN 'failed' ELSE status END,
      planning_updated_at = now()
  WHERE id = p_series_id AND status IN ('planning', 'failed')
  RETURNING * INTO v_series;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_PLANNING'; END IF;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.service_update_thirty_days_series_planning(uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_update_thirty_days_series_planning(uuid, text, jsonb, text) TO service_role;

-- Same billing + generation-row creation as the old begin_thirty_days_series,
-- but UPDATEs an existing draft row instead of inserting a new one, and runs
-- as service role since it's invoked from the background pipeline (no user
-- JWT in scope there). Idempotent: a row that already left 'planning'/
-- 'failed' is returned as-is rather than double-charged.
CREATE OR REPLACE FUNCTION public.service_finalize_thirty_days_series(
  p_series_id uuid,
  p_master_plan jsonb
)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
  v_tier public.thirty_days_quality_tiers;
  v_refs jsonb := COALESCE(p_master_plan->'visualReferences', '[]'::jsonb);
  v_ref jsonb;
  v_ref_count integer := jsonb_array_length(v_refs);
  v_setup_service integer := 12;
  v_total integer;
BEGIN
  SELECT * INTO v_series FROM public.thirty_days_series WHERE id = p_series_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  IF v_series.status NOT IN ('planning', 'failed') THEN RETURN v_series; END IF;

  IF v_ref_count <> 5 THEN RAISE EXCEPTION 'INVALID_REFERENCE_COUNT'; END IF;
  IF jsonb_typeof(COALESCE(p_master_plan->'seriesBible', '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(p_master_plan->'hiddenFutureBeats', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SERIES_BIBLE';
  END IF;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_refs) refs(value)) <> v_ref_count
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_refs) refs(value)
                WHERE length(trim(COALESCE(value->>'id', ''))) = 0) THEN
    RAISE EXCEPTION 'INVALID_REFERENCE_IDS';
  END IF;

  SELECT * INTO v_tier FROM public.thirty_days_quality_tiers
  WHERE quality_tier = v_series.quality_tier FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_QUALITY_TIER'; END IF;

  v_total := v_ref_count * v_tier.reference_cost_credits + v_setup_service;
  PERFORM public.deduct_credits(v_series.user_id, v_total);

  UPDATE public.thirty_days_series
  SET title = COALESCE(NULLIF(trim(p_master_plan->>'title'), ''), title),
      status = 'references', planning_stage = NULL, planning_error = NULL,
      planning_payload = '{}'::jsonb,
      master_story_bible = p_master_plan->'seriesBible',
      hidden_future_beats = COALESCE(p_master_plan->'hiddenFutureBeats', '[]'::jsonb)
  WHERE id = p_series_id RETURNING * INTO v_series;

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, title, hook, camera_mode,
    world_bible, visual_references, scenes, quality_tier, visual_style,
    status, reserved_credits, reservation_status, voice_generation_limit,
    service_credits_charged, generation_mode, series_id
  ) VALUES (
    v_series.user_id, v_series.universe, true, v_series.premise, v_series.title,
    COALESCE(p_master_plan->>'hook', v_series.premise),
    CASE WHEN p_master_plan->>'cameraMode' = 'first_person' THEN 'first_person' ELSE 'third_person' END,
    COALESCE(p_master_plan->'worldBible', '{}'::jsonb), v_refs, '[]'::jsonb,
    v_tier.quality_tier, v_series.visual_style, 'references', v_total, 'reserved', 1,
    v_setup_service, 'series_setup', v_series.id
  ) RETURNING * INTO v_generation;

  UPDATE public.thirty_days_series SET setup_generation_id = v_generation.id WHERE id = v_series.id
  RETURNING * INTO v_series;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(v_refs) LOOP
    INSERT INTO public.thirty_days_generation_assets (
      generation_id, user_id, asset_key, asset_type, reference_id, tool_key, cost_credits
    ) VALUES (
      v_generation.id, v_series.user_id, 'reference:' || (v_ref->>'id'), 'reference_image',
      v_ref->>'id', v_tier.reference_tool_key, v_tier.reference_cost_credits
    );
  END LOOP;
  INSERT INTO public.thirty_days_credit_ledger (generation_id, user_id, operation, credits)
  VALUES (v_generation.id, v_series.user_id, 'reserve', v_total);
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.service_finalize_thirty_days_series(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_finalize_thirty_days_series(uuid, jsonb) TO service_role;

-- begin_thirty_days_series (the old one-shot RPC) is superseded by the
-- draft/finalize pair above but left in place, unused by the new client
-- flow, in case any in-flight request from before this deploy still
-- references it.
