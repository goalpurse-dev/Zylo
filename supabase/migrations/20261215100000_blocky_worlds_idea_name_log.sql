-- Blocky Worlds: the IDEA LOG and the USED-NAMES LOG (owner, 2026-11-14). NOT APPLIED. The owner applies it after
-- 20261214100000_blocky_worlds_studio_prices.sql:
--   npx supabase db query --linked -f supabase/migrations/20261215100000_blocky_worlds_idea_name_log.sql
--   npx supabase migration repair --linked --status applied 20261215100000
--
-- 1. blocky_worlds_idea_log: every idea the idea engine (_shared/blockyWorlds/ideaEngine.js) has GIVEN OUT, so no customer gets a
--    repeat and the engine rejects near-duplicates of it. rule_key = the rule's content words, sorted (ideaKey); unique.
-- 2. blocky_worlds_name_log: every character name used by a written script (bans.js namesUsedBy), so the planner is handed
--    fresh names (freshNames' `used`). One row per name; seen counts the scripts.
-- Only the edge functions (service role) read and write these tables: RLS on, no policies.
BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_idea_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  rule text NOT NULL,
  hook text NOT NULL,
  style text NOT NULL CHECK (style IN ('funny', 'dark')),
  twist text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  total integer NOT NULL DEFAULT 0,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  given_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  given_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_idea_log_given_at ON public.blocky_worlds_idea_log (given_at DESC);
ALTER TABLE public.blocky_worlds_idea_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_name_log (
  name text PRIMARY KEY,
  seen integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blocky_worlds_name_log ENABLE ROW LEVEL SECURITY;

-- one atomic call: log names (insert, or seen + 1)
CREATE OR REPLACE FUNCTION public.blocky_worlds_log_names(p_names text[]) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.blocky_worlds_name_log (name)
  SELECT DISTINCT lower(trim(n)) FROM unnest(p_names) AS n WHERE trim(n) <> ''
  ON CONFLICT (name) DO UPDATE SET seen = public.blocky_worlds_name_log.seen + 1, last_seen = now();
$$;
REVOKE ALL ON FUNCTION public.blocky_worlds_log_names(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_log_names(text[]) TO service_role;

COMMIT;
