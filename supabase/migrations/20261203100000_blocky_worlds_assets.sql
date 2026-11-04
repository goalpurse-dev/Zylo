-- Blocky Worlds: the shared library of things the engine built for a video (scripts/blockyWorlds/engine/lib/builder).
-- NOT APPLIED. The owner applies it (db query --linked -f, then migration repair; never db push), after
-- 20261202100000_blocky_worlds_render.sql.
--
-- A line needs an object or a place the kit doesn't have: the engine looks here first (by normalized name / alias,
-- singular), else an AI designs it as a block blueprint (object) or a world spec (place), a still + an AI vision check
-- confirm it, and it is saved here so the next video gets it instantly and for free.
--   kind        object | world
--   name_key    the normalized name (lib/builder/spec.js normName); unique per kind: two videos building the same thing
--               at the same time keep the first one
--   keys        normalized name + aliases: lookup is keys && array[...]
--   blueprint   the object blueprint or the world spec (validated by lib/builder/spec.js before it is saved)
--   still_path  the check still in storage (bucket blocky-worlds-renders, assets/<kind>/<id>.jpg)
--   verdict     the vision check's reply { ok, confidence, reads_as, fix } + attempts
--   status      live | retired (the owner retires a bad one; it is then never served, and the next video rebuilds it)
-- Only the edge functions (service role) read and write it: RLS on, no policies. The RunPod worker never sees a key:
-- the server hands the prepare job a snapshot and inserts what the job built (its "assets" event).

BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('object', 'world')),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  name_key    text NOT NULL,
  aliases     text[] NOT NULL DEFAULT '{}',
  keys        text[] NOT NULL DEFAULT '{}',
  blueprint   jsonb NOT NULL,
  still_path  text,
  verdict     jsonb,
  model       text,
  cost_usd    numeric(10,5) NOT NULL DEFAULT 0,
  uses        integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'retired')),
  run_id      uuid REFERENCES public.blocky_worlds_runs (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocky_worlds_assets_name UNIQUE (kind, name_key),
  CONSTRAINT blocky_worlds_assets_size CHECK (pg_column_size(blueprint) < 200000)
);
CREATE INDEX IF NOT EXISTS blocky_worlds_assets_keys ON public.blocky_worlds_assets USING gin (keys);
CREATE INDEX IF NOT EXISTS blocky_worlds_assets_live ON public.blocky_worlds_assets (kind, uses DESC) WHERE status = 'live';
ALTER TABLE public.blocky_worlds_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_assets FROM anon, authenticated;

-- a reuse (counted per video that used it)
CREATE OR REPLACE FUNCTION public.blocky_worlds_asset_used(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.blocky_worlds_assets SET uses = uses + 1, updated_at = now() WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.blocky_worlds_asset_used(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_worlds_asset_used(uuid) TO service_role;

COMMIT;
