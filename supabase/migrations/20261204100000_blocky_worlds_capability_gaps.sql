-- Blocky Worlds: the capability gap log (scripts/blockyWorlds/engine/lib/gaps.js, lib/director/match.js).
-- NOT APPLIED. The owner applies it (db query --linked -f, then migration repair; never db push), after
-- 20261203100000_blocky_worlds_assets.sql.
--
-- The engine finds its own missing systems: the story director lists everything a video needs, the matcher maps every
-- item onto the capability registry (lib/capabilities.js), and every request no system can meet yet is logged here
-- (one row per gap, per video). The ranked view says what to build next: most-requested first, with example lines.
--   capability  the registry id ("crowd", "fx.fire", "weather.event", "giant"...)
--   detail      what exactly was missing ("action=swarm", "kind=flood", "planned")
--   item        the production-list item id; item_kind world | cast | creature | crowd | vehicle | prop | effect | event | camera
--   name        the item's name ("the wolf army", "fire (the bakery)")
--   line        the script line index (0-based) that first needs it; line_text that line
--   story_id    the run id, the library idea id, or the stress-test topic id; run_id the run when there is one
--   source      anthropic | mock | stress (who wrote the production list)
-- Only the edge functions (service role) read and write it: RLS on, no policies. The RunPod worker never sees a key:
-- it sends its gaps in its "planned" event and the edge function inserts them. Bookkeeping never fails a run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.blocky_worlds_capability_gaps (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  capability  text NOT NULL CHECK (char_length(capability) BETWEEN 1 AND 60),
  detail      text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 120),
  item        text NOT NULL DEFAULT '' CHECK (char_length(item) <= 60),
  item_kind   text NOT NULL DEFAULT '' CHECK (char_length(item_kind) <= 20),
  name        text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80),
  line        integer,
  line_text   text NOT NULL DEFAULT '' CHECK (char_length(line_text) <= 300),
  story_id    text CHECK (char_length(story_id) <= 120),
  run_id      uuid REFERENCES public.blocky_worlds_runs (id) ON DELETE SET NULL,
  source      text CHECK (source IN ('anthropic', 'mock', 'stress')),
  title       text CHECK (char_length(title) <= 120),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocky_worlds_capability_gaps_cap ON public.blocky_worlds_capability_gaps (capability, created_at DESC);
CREATE INDEX IF NOT EXISTS blocky_worlds_capability_gaps_run ON public.blocky_worlds_capability_gaps (run_id) WHERE run_id IS NOT NULL;
ALTER TABLE public.blocky_worlds_capability_gaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocky_worlds_capability_gaps FROM anon, authenticated;

-- the ranked list: per capability + detail, distinct stories first, then requests; the top items and 3 example lines.
-- Real customer videos (source anthropic) and stress runs are counted apart, so a stress test never outweighs customers.
CREATE OR REPLACE VIEW public.blocky_worlds_capability_gap_rank
WITH (security_invoker = true) AS
WITH g AS (
  SELECT capability, detail, coalesce(source, 'mock') AS source, name, line_text, coalesce(story_id, run_id::text, id::text) AS story, title, created_at
  FROM public.blocky_worlds_capability_gaps
)
SELECT
  capability,
  detail,
  source,
  count(DISTINCT story)                                       AS stories,
  count(*)                                                    AS requests,
  (SELECT array_agg(n ORDER BY c DESC) FROM (
     SELECT name AS n, count(*) AS c FROM g g2 WHERE g2.capability = g.capability AND g2.detail = g.detail AND g2.source = g.source
     GROUP BY name ORDER BY count(*) DESC LIMIT 5) t)          AS top_items,
  (SELECT array_agg(x) FROM (
     SELECT DISTINCT ON (line_text) line_text AS x FROM g g3
     WHERE g3.capability = g.capability AND g3.detail = g.detail AND g3.source = g.source AND line_text <> ''
     ORDER BY line_text, created_at DESC LIMIT 3) e)           AS examples,
  min(created_at)                                             AS first_at,
  max(created_at)                                             AS last_at
FROM g
GROUP BY capability, detail, source
ORDER BY count(DISTINCT story) DESC, count(*) DESC;

REVOKE ALL ON public.blocky_worlds_capability_gap_rank FROM anon, authenticated;

COMMIT;
