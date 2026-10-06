# SQL waiting for the owner's go

Files here are written and reviewed but NOT applied to the real database. They
are kept out of `supabase/migrations/` on purpose, so `supabase db push` can
never apply one by accident. When the owner approves a file, it is applied,
checked, and only then moved to `supabase/migrations/` (same name).

| File | What it does | Applied to the real database |
|---|---|---|
| `20261026090000_story_niches_undo.sql` | AI Fruit Story's tables go back to what they were before Blocky Stories was built inside them (drops the template columns) | no |
| `20261026090000_story_niches_undo_rollback.sql` | Puts the template columns back | (only if the undo has to be taken back) |
| `20261026100000_blocky_stories_backend.sql` | Blocky Stories' own tables, functions, rules, checks, the paid-calls switch and the daily cap | see `docs/roblox-phase0-plan.md` |
