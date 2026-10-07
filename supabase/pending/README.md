# SQL waiting for the owner's go

Files here are written and reviewed but NOT applied to the real database. They
are kept out of `supabase/migrations/` on purpose, so `supabase db push` can
never apply one by accident. When the owner approves a file, it is applied,
checked, and only then moved to `supabase/migrations/` (same name).

Nothing is waiting right now.

Applied and moved out:
- `20261026100000_blocky_stories_backend.sql` (Blocky Stories' own backend): 2026-10-07.
- `20261026090000_story_niches_undo.sql` (AI Fruit Story's tables back to what they were before the
  template seam): 2026-10-07, 19:49 UTC.
