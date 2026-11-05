-- Blocky Worlds: one video at a time per script (the result panel's "Try again", 2026-11-05).
-- A second start of the same draft while a run of it is still being made fails inside blocky_worlds_start_run's own
-- transaction (the INSERT hits this index), so the credits deducted just before it are rolled back with it: a
-- double-tapped "Try again" can never charge twice. blocky-worlds-api also checks first and says it in plain words;
-- this index is the promise when two taps race.
-- Safe to run on live: today there is at most one unfinished run per draft (checked 2026-11-05, read-only).
-- Run by the owner: npx supabase db query --remote -f supabase/migrations/20261205200000_blocky_worlds_one_run_per_draft.sql
--                   npx supabase migration repair --remote --status applied 20261205200000

CREATE UNIQUE INDEX IF NOT EXISTS blocky_worlds_runs_one_active_per_draft
  ON public.blocky_worlds_runs (draft_id)
  WHERE draft_id IS NOT NULL AND status NOT IN ('done', 'failed');
