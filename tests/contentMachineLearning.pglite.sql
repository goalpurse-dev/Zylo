-- Content Machine Phase 3 (PGlite only: net.http_post and the vault are stubs, see sqlCheck.mjs): analyses,
-- scout reports outside a run, and the tick waking the worker when today's scout is due.
begin;
do $$
begin
  delete from public.cm_jobs; delete from public.cm_runs; delete from net.calls; delete from public.cm_scout_reports;
  update public.cm_settings set kill_switch = false, daily_auto_run = false, daily_scout = false, timezone = 'UTC', run_time_local = '00:00';
  assert (select playbook = '' and half_life_days = 14 and winner_min_successes = 3 and analysis_suggest_after = 10 from public.cm_settings), 'learning defaults';

  insert into public.cm_analyses (status, posts_count, report) values ('done', 12, '{"summary": "x"}');
  insert into public.cm_scout_reports (run_id, trend_brief, report) values (null, '- numbered carousels', '{}');

  -- The daily scout is off by default (it's paid): no call.
  delete from public.cm_scout_reports;
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 0, 'scout off: no call';

  -- On, past the run time, no report or scout job today: one call.
  update public.cm_settings set daily_scout = true;
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'scout due: one call';

  -- Once today's scout job exists (queued and claimed later), no more calls for it.
  insert into public.cm_jobs (stage, status) values ('scout', 'done');
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'scout already queued today';

  update public.cm_settings set daily_scout = false;
  delete from public.cm_jobs; delete from net.calls; delete from public.cm_analyses;
end $$;
commit;
