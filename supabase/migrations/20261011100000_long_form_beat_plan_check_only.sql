-- Phase 2a-polish: window-limited CHECK runs (test projects only) store a
-- partial plan as 'check_only' — never 'ready', so nothing treats it as a
-- usable plan.
alter table public.long_form_beat_plan_versions
  drop constraint if exists long_form_beat_plan_versions_status_check;
alter table public.long_form_beat_plan_versions
  add constraint long_form_beat_plan_versions_status_check
  check (status in ('building', 'ready', 'ready_with_warnings', 'check_only', 'failed', 'superseded'));
