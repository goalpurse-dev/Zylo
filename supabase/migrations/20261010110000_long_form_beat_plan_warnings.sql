-- Phase 2a final: quality rules never fail a paid beat-plan run. A plan whose
-- soft checks (subject variety, frozen-moment wording, SHORT_TEXT limits,
-- adjacency similarity) still fail after the one batched fix is kept as
-- 'ready_with_warnings', with the warnings stored per beat for the review UI.
alter table public.long_form_beat_plan_versions
  drop constraint if exists long_form_beat_plan_versions_status_check;
alter table public.long_form_beat_plan_versions
  add constraint long_form_beat_plan_versions_status_check
  check (status in ('building', 'ready', 'ready_with_warnings', 'failed', 'superseded'));

alter table public.long_form_beats
  add column if not exists warnings jsonb not null default '[]'::jsonb;
