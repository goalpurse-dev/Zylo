-- Per-user feature flags (e.g. {"fruit_v2": true}).
--
-- The browser can READ its own row and nothing else. Nothing in the browser
-- can write: browser roles get no INSERT/UPDATE/DELETE grant and no write
-- policy, and a trigger rejects writes from anon/authenticated even if a
-- grant is ever added by mistake (same idea as the jobs write guard).
-- Flags are set with SQL (dashboard / service role) only.

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.user_feature_flags (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  flags      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(flags) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_feature_flags IS
  'Per-user feature flags. Owner can read their own row; only SQL/service_role can write.';

ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated; take that back and grant only what is needed.
REVOKE ALL ON public.user_feature_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_feature_flags TO authenticated;
GRANT ALL ON public.user_feature_flags TO service_role;

DROP POLICY IF EXISTS user_feature_flags_select_own ON public.user_feature_flags;
CREATE POLICY user_feature_flags_select_own
  ON public.user_feature_flags
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_feature_flags_block_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'FEATURE_FLAGS_READ_ONLY' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.user_feature_flags_block_client_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zzz_user_feature_flags_guard ON public.user_feature_flags;
CREATE TRIGGER zzz_user_feature_flags_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.user_feature_flags_block_client_writes();

NOTIFY pgrst, 'reload schema';

COMMIT;
