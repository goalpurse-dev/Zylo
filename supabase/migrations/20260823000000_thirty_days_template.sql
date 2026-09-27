-- 30 Days generation persistence, reference/scene job bookkeeping, credit
-- reservation for the visual phase, and voice/service request accounting for
-- the reused Cooking Matic-style voice bundle.

CREATE TABLE IF NOT EXISTS public.thirty_days_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  universe text NOT NULL,
  ai_idea_mode boolean NOT NULL DEFAULT true,
  premise text,
  title text,
  hook text,
  camera_mode text NOT NULL DEFAULT 'third_person'
    CHECK (camera_mode IN ('third_person', 'first_person')),
  world_bible jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_tier text NOT NULL DEFAULT 'thirtydays-v2',
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'references', 'scenes', 'voiceover', 'stitching', 'completed', 'partial', 'failed')),
  reserved_credits integer NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  refunded_credits integer NOT NULL DEFAULT 0 CHECK (refunded_credits >= 0),
  reservation_status text NOT NULL DEFAULT 'reserved'
    CHECK (reservation_status IN ('reserved', 'settled', 'refunded')),
  narration_script text,
  narration_take jsonb,
  voice_generation_limit integer NOT NULL DEFAULT 2,
  voice_generations_used integer NOT NULL DEFAULT 0,
  service_request_counts jsonb NOT NULL DEFAULT '{"script":0,"preview":0}'::jsonb,
  full_video_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.thirty_days_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own 30 Days generations"
  ON public.thirty_days_generations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own 30 Days generations"
  ON public.thirty_days_generations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS thirty_days_generations_user_created
  ON public.thirty_days_generations (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_thirty_days_updated_at ON public.thirty_days_generations;
CREATE TRIGGER set_thirty_days_updated_at
  BEFORE UPDATE ON public.thirty_days_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reserve the full visual-phase cost (references + scene images + scene
-- clips) in one transaction, then insert the planning row. p_cost is computed
-- server-side (thirty-days-planner) from the resolved quality tier, so the
-- clamp here is a defense-in-depth bound, not the source of truth.
CREATE OR REPLACE FUNCTION public.begin_thirty_days_generation(
  p_universe text,
  p_ai_idea_mode boolean,
  p_premise text,
  p_settings jsonb,
  p_cost integer
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.thirty_days_generations;
  v_cost integer := GREATEST(60, LEAST(2000, COALESCE(p_cost, 150)));
  v_quality_tier text := COALESCE(p_settings->>'quality', 'thirtydays-v2');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_universe, ''))) < 2 THEN
    RAISE EXCEPTION 'UNIVERSE_REQUIRED';
  END IF;

  PERFORM public.deduct_credits(v_user_id, v_cost);

  INSERT INTO public.thirty_days_generations (
    user_id, universe, ai_idea_mode, premise, quality_tier, reserved_credits
  ) VALUES (
    v_user_id, trim(p_universe), COALESCE(p_ai_idea_mode, true), NULLIF(trim(COALESCE(p_premise, '')), ''),
    v_quality_tier, v_cost
  )
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

-- Settle once every reference/scene-image/scene-video asset is terminal.
-- Refunds the per-asset share of the reservation for anything that never
-- completed.
CREATE OR REPLACE FUNCTION public.settle_thirty_days_generation(
  p_generation_id uuid,
  p_completed_assets integer,
  p_total_assets integer
)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_total integer := GREATEST(1, COALESCE(p_total_assets, 19));
  v_completed integer := LEAST(v_total, GREATEST(0, COALESCE(p_completed_assets, 0)));
  v_refund integer;
BEGIN
  SELECT * INTO v_generation
  FROM public.thirty_days_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  v_refund := round(v_generation.reserved_credits::numeric * (v_total - v_completed) / v_total);
  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_refund,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_refund)
    WHERE id = v_generation.user_id;
  END IF;

  UPDATE public.thirty_days_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_completed = 0 THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_completed = v_total THEN 'completed' WHEN v_completed = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

-- Voice/service request accounting — same shape as the Cooking Matic pair,
-- pointed at thirty_days_generations instead.
CREATE OR REPLACE FUNCTION public.reserve_thirty_days_service_request(
  p_generation_id uuid,
  p_kind text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_counts jsonb;
  v_used integer;
  v_limit integer;
BEGIN
  IF p_kind NOT IN ('script', 'preview') THEN
    RAISE EXCEPTION 'INVALID_SERVICE_KIND';
  END IF;

  SELECT user_id, COALESCE(service_request_counts, '{}'::jsonb)
  INTO v_owner, v_counts
  FROM public.thirty_days_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND OR auth.uid() IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  v_used := GREATEST(0, COALESCE((v_counts->>p_kind)::integer, 0));
  v_limit := CASE p_kind
    WHEN 'script' THEN 6
    WHEN 'preview' THEN 30
  END;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'SERVICE_LIMIT_REACHED:%', p_kind;
  END IF;

  v_counts := jsonb_set(v_counts, ARRAY[p_kind], to_jsonb(v_used + 1), true);
  UPDATE public.thirty_days_generations
  SET service_request_counts = v_counts, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_thirty_days_service_request(
  p_generation_id uuid,
  p_kind text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb;
  v_used integer;
BEGIN
  IF p_kind NOT IN ('script', 'preview') THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(service_request_counts, '{}'::jsonb)
  INTO v_counts
  FROM public.thirty_days_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_used := GREATEST(0, COALESCE((v_counts->>p_kind)::integer, 0) - 1);
  v_counts := jsonb_set(v_counts, ARRAY[p_kind], to_jsonb(v_used), true);
  UPDATE public.thirty_days_generations
  SET service_request_counts = v_counts, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_thirty_days_voice_generation(
  p_generation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_used integer;
  v_limit integer;
BEGIN
  SELECT user_id, voice_generations_used, voice_generation_limit
  INTO v_owner, v_used, v_limit
  FROM public.thirty_days_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND OR auth.uid() IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  IF COALESCE(v_used, 0) >= GREATEST(1, COALESCE(v_limit, 2)) THEN
    RAISE EXCEPTION 'VOICE_LIMIT_REACHED';
  END IF;

  v_used := COALESCE(v_used, 0) + 1;
  UPDATE public.thirty_days_generations
  SET voice_generations_used = v_used, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_thirty_days_voice_generation(
  p_generation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
BEGIN
  UPDATE public.thirty_days_generations
  SET voice_generations_used = GREATEST(0, COALESCE(voice_generations_used, 0) - 1),
      updated_at = now()
  WHERE id = p_generation_id
  RETURNING voice_generations_used INTO v_used;

  RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.begin_thirty_days_generation(text, boolean, text, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_thirty_days_generation(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_thirty_days_service_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_thirty_days_service_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_thirty_days_voice_generation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_thirty_days_voice_generation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.begin_thirty_days_generation(text, boolean, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_thirty_days_generation(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_thirty_days_service_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_service_request(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_thirty_days_voice_generation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_voice_generation(uuid) TO service_role;
