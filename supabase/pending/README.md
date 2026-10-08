# SQL waiting for the owner's go

Files here are written and reviewed but NOT applied to the real database. They
are kept out of `supabase/migrations/` on purpose, so `supabase db push` can
never apply one by accident. When the owner approves a file, it is applied,
checked, and only then moved to `supabase/migrations/` (same name).

Nothing is waiting right now.

Applied and moved out:
- `20261028100000_blocky_script_share.sql` (Blocky Stories: the script share of the picture step, 15 credits;
  one new price row with a Blocky key, two columns on `blocky_charges`, the two Blocky functions that charge
  and refund): 2026-10-08, on the owner go.
- `20261027100000_blocky_story_options.sql` (Blocky Stories: the three versions a user chooses from, and
  the vetted story plans; two Blocky tables and one function): 2026-10-08, on the owner's go.
- `20261026100000_blocky_stories_backend.sql` (Blocky Stories' own backend): 2026-10-07.
- `20261026090000_story_niches_undo.sql` (AI Fruit Story's tables back to what they were before the
  template seam): 2026-10-07, 19:49 UTC.
