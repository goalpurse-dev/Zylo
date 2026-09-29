-- AI Fruit Story v2: the character library (150 core + 20 uk-roadman).
--
-- Public read (the app lists characters before sign-in too); nothing in the
-- browser can write. Rows are seeded from data/fruit-characters/library.json
-- by supabase/seeds/fruit_characters.sql (service role / SQL only).
-- ref_prompt and ref_seed are exactly what was sent to the image model for
-- the approved reference image; ref_image_url is permanent and immutable
-- (a new image gets a new path).

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.fruit_characters (
  id             text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{0,39}$'),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  first_name     text GENERATED ALWAYS AS (lower(split_part(name, ' ', 1))) STORED,
  collection     text NOT NULL DEFAULT 'core' CHECK (collection ~ '^[a-z][a-z0-9-]{0,39}$'),
  fruit          text NOT NULL,
  emoji          text NOT NULL DEFAULT '',
  hue            smallint NOT NULL DEFAULT 0 CHECK (hue BETWEEN 0 AND 360),
  gender         text NOT NULL CHECK (gender IN ('female', 'male')),
  age            smallint NOT NULL CHECK (age BETWEEN 19 AND 70),
  tag            text NOT NULL,
  role           text NOT NULL,
  story_types    text[] NOT NULL DEFAULT '{}',
  settings       text[] NOT NULL DEFAULT '{}',
  voice_style    text NOT NULL,
  face           text NOT NULL,
  build          text NOT NULL,
  outfit         text NOT NULL,
  ref_image_url  text NOT NULL CHECK (ref_image_url ~ '^https://'),
  ref_image_path text NOT NULL,
  ref_width      smallint NOT NULL,
  ref_height     smallint NOT NULL,
  ref_model      text NOT NULL,
  ref_seed       bigint,
  ref_prompt     text NOT NULL,
  ref_cost_usd   numeric(10, 6),
  active         boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Script-name matching uses the first word of the name, so it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS fruit_characters_first_name_key ON public.fruit_characters (first_name);
CREATE INDEX IF NOT EXISTS fruit_characters_list_idx ON public.fruit_characters (collection, sort_order) WHERE active;

COMMENT ON TABLE public.fruit_characters IS
  'AI Fruit Story character library. Public read; written only by SQL/service_role (seed).';

ALTER TABLE public.fruit_characters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fruit_characters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fruit_characters TO anon, authenticated;
GRANT ALL ON public.fruit_characters TO service_role;

DROP POLICY IF EXISTS fruit_characters_public_read ON public.fruit_characters;
CREATE POLICY fruit_characters_public_read
  ON public.fruit_characters
  FOR SELECT
  TO anon, authenticated
  USING (active);

CREATE OR REPLACE FUNCTION public.fruit_characters_block_client_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'FRUIT_CHARACTERS_READ_ONLY' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fruit_characters_block_client_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zzz_fruit_characters_guard ON public.fruit_characters;
CREATE TRIGGER zzz_fruit_characters_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.fruit_characters
  FOR EACH ROW EXECUTE FUNCTION public.fruit_characters_block_client_writes();

NOTIFY pgrst, 'reload schema';

COMMIT;
