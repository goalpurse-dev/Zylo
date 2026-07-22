-- Request accounting for the paid Cooking Matic service bundle. These
-- counters make retries atomic, verify creation ownership, and stop parallel
-- browser requests from exceeding the included voice/service allowances.

ALTER TABLE public.cooking_matic_generations
  ADD COLUMN IF NOT EXISTS voice_generation_limit integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS voice_generations_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_request_counts jsonb NOT NULL DEFAULT
    '{"script":0,"preview":0,"transcription":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS service_credits_charged integer NOT NULL DEFAULT 0;

UPDATE public.cooking_matic_generations
SET voice_generations_used = LEAST(
  voice_generation_limit,
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements(COALESCE(voice_takes, '[]'::jsonb)) AS take(value)
    WHERE COALESCE(take.value->>'imported', 'false') <> 'true'
  )
)
WHERE voice_generations_used = 0;

CREATE OR REPLACE FUNCTION public.reserve_cooking_service_request(
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
  IF p_kind NOT IN ('script', 'preview', 'transcription') THEN
    RAISE EXCEPTION 'INVALID_SERVICE_KIND';
  END IF;

  SELECT user_id, COALESCE(service_request_counts, '{}'::jsonb)
  INTO v_owner, v_counts
  FROM public.cooking_matic_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND OR auth.uid() IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  v_used := GREATEST(0, COALESCE((v_counts->>p_kind)::integer, 0));
  v_limit := CASE p_kind
    WHEN 'script' THEN 6
    WHEN 'preview' THEN 30
    WHEN 'transcription' THEN 4
  END;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'SERVICE_LIMIT_REACHED:%', p_kind;
  END IF;

  v_counts := jsonb_set(v_counts, ARRAY[p_kind], to_jsonb(v_used + 1), true);
  UPDATE public.cooking_matic_generations
  SET service_request_counts = v_counts, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cooking_service_request(
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
  IF p_kind NOT IN ('script', 'preview', 'transcription') THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(service_request_counts, '{}'::jsonb)
  INTO v_counts
  FROM public.cooking_matic_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_used := GREATEST(0, COALESCE((v_counts->>p_kind)::integer, 0) - 1);
  v_counts := jsonb_set(v_counts, ARRAY[p_kind], to_jsonb(v_used), true);
  UPDATE public.cooking_matic_generations
  SET service_request_counts = v_counts, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_cooking_voice_generation(
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
  FROM public.cooking_matic_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND OR auth.uid() IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'CREATION_ACCESS_DENIED';
  END IF;

  IF COALESCE(v_used, 0) >= GREATEST(1, COALESCE(v_limit, 2)) THEN
    RAISE EXCEPTION 'VOICE_LIMIT_REACHED';
  END IF;

  v_used := COALESCE(v_used, 0) + 1;
  UPDATE public.cooking_matic_generations
  SET voice_generations_used = v_used, updated_at = now()
  WHERE id = p_generation_id;

  RETURN v_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cooking_voice_generation(
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
  UPDATE public.cooking_matic_generations
  SET voice_generations_used = GREATEST(0, COALESCE(voice_generations_used, 0) - 1),
      updated_at = now()
  WHERE id = p_generation_id
  RETURNING voice_generations_used INTO v_used;

  RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_cooking_service_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cooking_service_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_cooking_voice_generation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cooking_voice_generation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_cooking_service_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_cooking_service_request(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_cooking_voice_generation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_cooking_voice_generation(uuid) TO service_role;
