-- Blocky Stories: three versions to choose from, and vetted story plans.
-- Applied to the real database on 2026-10-08, on the owner's go.
-- Blocky's own tables only: nothing here reads or changes an AI Fruit Story table.
--
-- blocky_plans    hand-written story plans the owner has vetted (scripts/blocky/importPlans.mjs).
--                 Served as idea cards; an idea with a vetted plan shows that plan first.
-- blocky_drafts   one row per "write me three versions": the idea or description, the three
--                 story cards as they become ready, which one was picked, and the story made
--                 from it. The unpicked versions stay here; nothing is charged for a draft.
--                 It is also what the daily limit on free script generations counts.
-- blocky_set_draft_version   writes ONE version into a draft in a single statement, so three
--                 versions that finish at the same moment can't overwrite each other.

CREATE TABLE public.blocky_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,                          -- from the title; importing the same plan again updates its row
  title text NOT NULL,
  hook text NOT NULL,                          -- the one line on the idea card
  story_type text NOT NULL,                    -- one of the ten story types (vettedPlans.js#STORY_TYPES)
  plan jsonb NOT NULL,                         -- the checked plan: premise, pattern, mechanic, stakes, clue, payoff, last line, roles A/B/C
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocky_plans_pkey PRIMARY KEY (id),
  CONSTRAINT blocky_plans_slug_key UNIQUE (slug)
);

CREATE TABLE public.blocky_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'writing',
  input jsonb NOT NULL,                        -- source, the idea or the description, cast, quality, length, shape
  plan_id uuid REFERENCES public.blocky_plans(id) ON DELETE SET NULL,   -- the vetted plan it started from, if any
  versions jsonb NOT NULL DEFAULT '[]'::jsonb, -- up to three: {n, status, vetted, title, hook, lines, plan, script}
  judged jsonb,                                -- what the judge made of the plans
  picked smallint,
  story_id uuid REFERENCES public.blocky_stories(id) ON DELETE SET NULL,
  call_ids uuid[] NOT NULL DEFAULT '{}',
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,   -- what the writing cost us (the user pays nothing for a draft)
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocky_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT blocky_drafts_status_check CHECK (status IN ('writing', 'ready', 'failed', 'picked')),
  CONSTRAINT blocky_drafts_picked_check CHECK (picked IS NULL OR picked BETWEEN 1 AND 3)
);
-- The daily limit counts a user's drafts since midnight UTC; the page reads the newest one.
CREATE INDEX blocky_drafts_user_created_idx ON public.blocky_drafts (user_id, created_at DESC);

CREATE TRIGGER blocky_plans_block_client_writes BEFORE INSERT OR UPDATE OR DELETE ON public.blocky_plans
  FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');
CREATE TRIGGER blocky_drafts_block_client_writes BEFORE INSERT OR UPDATE OR DELETE ON public.blocky_drafts
  FOR EACH ROW EXECUTE FUNCTION public.blocky_block_client_writes('touch');

ALTER TABLE public.blocky_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocky_drafts ENABLE ROW LEVEL SECURITY;
-- A user reads only their own drafts. Plans have no policy: only the service role reads them
-- (the API turns them into idea cards and never sends the twist to the browser).
CREATE POLICY blocky_drafts_select_own ON public.blocky_drafts FOR SELECT TO authenticated USING ((user_id = auth.uid()));

GRANT ALL ON public.blocky_plans TO service_role;
GRANT ALL ON public.blocky_drafts TO service_role;
GRANT SELECT ON public.blocky_drafts TO authenticated;

-- One version into a draft, in one statement (the row lock makes it safe when three finish together).
-- p_version: {n: 1..3, ...}; it replaces the version with the same n, or is added. Adds its cost and calls.
-- The draft becomes 'ready' when no version is still being written, 'failed' when none came out.
CREATE OR REPLACE FUNCTION public.blocky_set_draft_version(p_draft_id uuid, p_version jsonb, p_cost_usd numeric DEFAULT 0, p_call_ids uuid[] DEFAULT '{}')
 RETURNS public.blocky_drafts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.blocky_drafts;
  v_n int := (p_version->>'n')::int;
  v_versions jsonb;
BEGIN
  IF v_n IS NULL OR v_n < 1 OR v_n > 3 THEN
    RAISE EXCEPTION 'BLOCKY_BAD_VERSION' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.blocky_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BLOCKY_DRAFT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status = 'picked' THEN
    RETURN v_row;                                -- a version that arrives after the pick changes nothing
  END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY (v->>'n')::int), '[]'::jsonb) INTO v_versions
  FROM (
    SELECT v FROM jsonb_array_elements(v_row.versions) AS v WHERE (v->>'n')::int <> v_n
    UNION ALL SELECT p_version
  ) AS t;
  UPDATE public.blocky_drafts SET
    versions = v_versions,
    cost_usd = cost_usd + coalesce(p_cost_usd, 0),
    call_ids = call_ids || coalesce(p_call_ids, '{}'),
    status = CASE
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_versions) AS v WHERE v->>'status' = 'writing') THEN 'writing'
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_versions) AS v WHERE v->>'status' = 'ready') THEN 'ready'
      ELSE 'failed' END
  WHERE id = p_draft_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$
;
REVOKE ALL ON FUNCTION public.blocky_set_draft_version(uuid, jsonb, numeric, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blocky_set_draft_version(uuid, jsonb, numeric, uuid[]) TO service_role;
