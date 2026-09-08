-- Generation-persistence audit fix (Part 0 of the VisualBeat milestone):
-- `ideas` on long_form_discovery_sessions is a single flattened array that
-- the frontend caps at MAX_VISIBLE_IDEAS (30) on every "Generate 10 More" —
-- once a session's running total exceeds that cap, the OLDEST batch's ideas
-- are silently dropped from the array and persisted that way, with no way
-- to reconstruct what an earlier "Generate Ideas" / "Generate 10 More"
-- click actually produced. `idea_batches` fixes this without replacing
-- `ideas` (which stays exactly as-is for the visible/capped UI list and
-- every existing read path) — it is the uncapped, append-only record of
-- every batch ever generated in this session: [{ batchId, createdAt,
-- ideas: Idea[] }, ...]. Only ever appended to, never overwritten in place.
alter table public.long_form_discovery_sessions
  add column if not exists idea_batches jsonb not null default '[]'::jsonb;
