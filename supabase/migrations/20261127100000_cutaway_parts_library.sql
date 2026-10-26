-- Cutaway Explainer: the kit grows by itself (the owner, 2026-10-26). A part the scene planner designed from building
-- blocks (kind "rig") in a video that passed every check and finished is saved here with its name and synonyms; later
-- videos are shown it and reuse it for free. The owner sees every new part on /admin/ops and can retire a bad one.
-- Also the "Beta" badge for custom topics (off by default, switched on /admin/ops).
CREATE TABLE IF NOT EXISTS public.cutaway_parts_library (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  synonyms    text[] NOT NULL DEFAULT '{}',
  recipe      jsonb NOT NULL,
  topic       text,
  source_run  uuid REFERENCES public.cutaway_runs (id) ON DELETE SET NULL,
  uses        integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz
);
-- one live part per name (a retired one can be designed again)
CREATE UNIQUE INDEX IF NOT EXISTS cutaway_parts_library_live_name ON public.cutaway_parts_library (name) WHERE retired_at IS NULL;
ALTER TABLE public.cutaway_parts_library ENABLE ROW LEVEL SECURITY; -- no policies: the edge functions only
REVOKE ALL ON public.cutaway_parts_library FROM anon, authenticated;

-- a saved part used again by another finished video
CREATE OR REPLACE FUNCTION public.cutaway_part_used(p_name text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.cutaway_parts_library SET uses = uses + 1 WHERE name = p_name AND retired_at IS NULL; $$;
REVOKE ALL ON FUNCTION public.cutaway_part_used(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cutaway_part_used(text) TO service_role;

ALTER TABLE public.cutaway_settings ADD COLUMN IF NOT EXISTS custom_beta boolean NOT NULL DEFAULT false;

-- The custom price with the cost of designing a part (pricing.js MEASURED custom design: about $0.04 a 30 s video,
-- counted on its refunded failures too): still 1 credit = $0.01 of our full cost.
UPDATE public.tool_prices SET flat_credits = 136 WHERE tool_key = 'cutaway:custom-30';
UPDATE public.tool_prices SET flat_credits = 195 WHERE tool_key = 'cutaway:custom-60';
