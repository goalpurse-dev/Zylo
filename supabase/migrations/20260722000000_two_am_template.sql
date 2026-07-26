-- 2AM In... generation persistence, universe research cache, and atomic credits.

CREATE TABLE IF NOT EXISTS public.universe_reference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key text NOT NULL UNIQUE,
  franchise text,
  era text,
  reference_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.universe_reference_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS universe_reference_cache_expiry
  ON public.universe_reference_cache (normalized_key, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.two_am_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_prompt text NOT NULL,
  franchise text,
  world text,
  era text,
  anchor_character text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  world_bible jsonb NOT NULL DEFAULT '{}'::jsonb,
  random_seed text NOT NULL,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'generating', 'completed', 'partial', 'failed')),
  reserved_credits integer NOT NULL DEFAULT 60 CHECK (reserved_credits >= 0),
  refunded_credits integer NOT NULL DEFAULT 0 CHECK (refunded_credits >= 0),
  reservation_status text NOT NULL DEFAULT 'reserved'
    CHECK (reservation_status IN ('reserved', 'settled', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.two_am_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own 2AM generations"
  ON public.two_am_generations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own 2AM generations"
  ON public.two_am_generations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS two_am_generations_user_created
  ON public.two_am_generations (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_two_am_updated_at ON public.two_am_generations;
CREATE TRIGGER set_two_am_updated_at
  BEFORE UPDATE ON public.two_am_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reserve all six 4K Nano Banana 2 images in one transaction. The child jobs
-- are inserted with zero charge because this reservation owns their cost.
CREATE OR REPLACE FUNCTION public.begin_two_am_generation(
  p_prompt text,
  p_settings jsonb,
  p_random_seed text
)
RETURNS public.two_am_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.two_am_generations;
  v_cost constant integer := 60;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF length(trim(COALESCE(p_prompt, ''))) < 2 THEN
    RAISE EXCEPTION 'PROMPT_REQUIRED';
  END IF;

  PERFORM public.deduct_credits(v_user_id, v_cost);

  INSERT INTO public.two_am_generations (
    user_id, user_prompt, settings, random_seed, reserved_credits
  ) VALUES (
    v_user_id, trim(p_prompt), COALESCE(p_settings, '{}'::jsonb), p_random_seed, v_cost
  )
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

-- Settle once after all six jobs stop. Failed images are automatically
-- refunded at the same 10-credit 4K rate used by the reservation.
CREATE OR REPLACE FUNCTION public.settle_two_am_generation(
  p_generation_id uuid,
  p_completed_scenes integer
)
RETURNS public.two_am_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation public.two_am_generations;
  v_completed integer := LEAST(6, GREATEST(0, COALESCE(p_completed_scenes, 0)));
  v_refund integer;
BEGIN
  SELECT * INTO v_generation
  FROM public.two_am_generations
  WHERE id = p_generation_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  v_refund := (6 - v_completed) * 10;
  IF v_refund > 0 THEN
    UPDATE public.profiles
    SET credit_balance = credit_balance + v_refund,
        credits_spent_today = GREATEST(0, COALESCE(credits_spent_today, 0) - v_refund)
    WHERE id = v_generation.user_id;
  END IF;

  UPDATE public.two_am_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_completed = 0 THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_completed = 6 THEN 'completed' WHEN v_completed = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id
  RETURNING * INTO v_generation;

  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_two_am_generation(text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_two_am_generation(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_two_am_generation(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_two_am_generation(uuid, integer) TO authenticated;

