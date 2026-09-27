-- Phase 1c — an error code alone ("DRAFT_VALIDATION_FAILED") isn't enough
-- to diagnose a failure after the fact. Adds a `detail` jsonb column to
-- both script and research version rows to hold the exact failing
-- validators, messages, and offending text snippets, alongside the
-- existing last_error_code/last_error_at. Nullable, additive — no
-- existing read path breaks.
alter table public.long_form_script_versions add column if not exists detail jsonb;
alter table public.long_form_research_versions add column if not exists detail jsonb;
