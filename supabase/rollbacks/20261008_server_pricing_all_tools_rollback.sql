-- Rollback for 20261008100000_server_pricing_all_tools.sql.
-- Restores: Fruit-only pricing trigger + previous compute_tool_price
-- (20261007120000), the original tool_prices shape and its 4 Fruit rows, the
-- original begin_two_am_generation (client-supplied p_cost, clamped 30–60),
-- and the pre-hotfix grants on service_finalize_thirty_days_series.
--
--   npx supabase db query --linked -f supabase/rollbacks/20261008_server_pricing_all_tools_rollback.sql
--   npx supabase migration repair --status reverted 20261008100000 --linked

BEGIN;
SET LOCAL lock_timeout = '10s';

-- Seeded rows (keep the 4 Fruit rows from 20261007120000).
DELETE FROM public.tool_prices
WHERE tool_key NOT IN ('video:fruit-v2', 'video:fruit-v3', 'video:fruit-v4', 'video:fruitveo31lite');

ALTER TABLE public.tool_prices DROP CONSTRAINT IF EXISTS tool_prices_has_price;
ALTER TABLE public.tool_prices DROP COLUMN IF EXISTS size_tiers;
ALTER TABLE public.tool_prices DROP COLUMN IF EXISTS sound_credits_per_second;
ALTER TABLE public.tool_prices ADD CONSTRAINT tool_prices_check
  CHECK (flat_credits IS NOT NULL OR credits_per_second IS NOT NULL);

-- Previous compute_tool_price + Fruit-scoped trigger (verbatim from 20261007120000).
CREATE OR REPLACE FUNCTION public.compute_tool_price(p_tool_key text, p_input jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r          public.tool_prices%ROWTYPE;
  v_dur_raw  numeric;
  v_duration integer;
  v_size     text;
  v_sound    boolean;
BEGIN
  SELECT * INTO r FROM public.tool_prices WHERE tool_key = p_tool_key AND active;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_dur_raw := NULLIF(p_input->>'durationSec', '')::numeric;
    v_sound   := COALESCE((p_input->>'withSound')::boolean, false);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: malformed durationSec/withSound for %', p_tool_key USING ERRCODE = '22023';
  END;

  IF v_dur_raw IS NOT NULL THEN
    IF v_dur_raw <> trunc(v_dur_raw) OR v_dur_raw <= 0 THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: duration % not allowed for %', v_dur_raw, p_tool_key USING ERRCODE = '22023';
    END IF;
    v_duration := v_dur_raw::integer;
  END IF;

  IF r.allowed_durations IS NOT NULL AND (v_duration IS NULL OR NOT (v_duration = ANY (r.allowed_durations))) THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: duration % not allowed for %', COALESCE(v_duration::text, 'missing'), p_tool_key USING ERRCODE = '22023';
  END IF;

  IF r.allowed_sizes IS NOT NULL THEN
    v_size := COALESCE(p_input->>'width', '') || 'x' || COALESCE(p_input->>'height', '');
    IF NOT (v_size = ANY (r.allowed_sizes)) THEN
      RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: size % not allowed for %', v_size, p_tool_key USING ERRCODE = '22023';
    END IF;
  END IF;

  IF r.requires_sound IS NOT NULL AND v_sound IS DISTINCT FROM r.requires_sound THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: withSound must be % for %', r.requires_sound, p_tool_key USING ERRCODE = '22023';
  END IF;

  IF r.flat_credits IS NOT NULL THEN
    RETURN r.flat_credits;
  END IF;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'INVALID_JOB_SIGNATURE: durationSec required for per-second price of %', p_tool_key USING ERRCODE = '22023';
  END IF;
  RETURN CEIL(r.credits_per_second * v_duration)::integer;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_tool_price(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_tool_price(text, jsonb) TO anon, authenticated, service_role;

/* ─── Fruit-scoped pricing trigger ────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.enforce_tool_job_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits integer;
BEGIN
  v_credits := public.compute_tool_price(NEW.tool_key, NEW.input);
  IF v_credits IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.charge_credits := v_credits;
  NEW.settings := jsonb_set(COALESCE(NEW.settings, '{}'::jsonb), '{credits}', to_jsonb(v_credits), true);
  RETURN NEW;
END;
$function$;

-- Scoped to Fruit keys for now; widen the WHEN clause when other tools
-- move onto tool_prices.
DROP TRIGGER IF EXISTS jobs_enforce_tool_pricing ON public.jobs;
CREATE TRIGGER jobs_enforce_tool_pricing
  BEFORE INSERT OR UPDATE OF charge_credits, input, tool_key ON public.jobs
  FOR EACH ROW
  WHEN (NEW.tool_key LIKE 'video:fruit%')
  EXECUTE FUNCTION public.enforce_tool_job_pricing();

-- Original begin_two_am_generation.
CREATE OR REPLACE FUNCTION public.begin_two_am_generation(p_prompt text, p_settings jsonb, p_random_seed text, p_cost integer DEFAULT 42)
 RETURNS two_am_generations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_generation public.two_am_generations;
  -- Clamped to the valid tier range (30=1K, 42=2K, 60=4K, all x6 images) as
  -- basic sanity — the real tier/plan enforcement happens in the calling
  -- edge function, which resolves plan_code from the DB itself.
  v_cost integer := GREATEST(30, LEAST(60, COALESCE(p_cost, 42)));
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
$function$;

-- Pre-hotfix ACL: {postgres, anon, authenticated, service_role} (no PUBLIC).
GRANT EXECUTE ON FUNCTION public.service_finalize_thirty_days_series(uuid, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
