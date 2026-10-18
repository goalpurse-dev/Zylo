-- Content Machine: the minute tick (private.trigger_content_machine). ONLY for the PGlite check
-- (scripts/contentMachine/sqlCheck.mjs), where net.http_post and the vault are stubs that record calls.
-- Never run this against a real database: there the tick makes a real HTTP call.
begin;
do $$
declare n integer;
begin
  delete from public.cm_jobs; delete from public.cm_runs; delete from net.calls;
  update public.cm_settings set kill_switch = false, daily_auto_run = false, timezone = 'UTC', run_time_local = '00:00';

  -- Nothing due: no call.
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 0, 'idle: no call';

  -- A due job: one call, with the secret header.
  insert into public.cm_jobs (stage) values ('plan');
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'a due job: one call';
  assert (select headers ->> 'x-cm-worker-secret' = 'test-secret' and url = 'https://worker.test/tick' from net.calls), 'secret and url from the vault';

  -- The kill switch: no call even with work waiting.
  update public.cm_settings set kill_switch = true;
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'kill switch: no call';
  update public.cm_settings set kill_switch = false;

  -- The daily run: due once the local time is past the run time and today's run doesn't exist yet.
  delete from public.cm_jobs; delete from net.calls;
  update public.cm_settings set daily_auto_run = true, run_time_local = '00:00';
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'daily run due';
  insert into public.cm_runs (run_date, kind) values ((now() at time zone 'UTC')::date, 'daily');
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 1, 'today''s run exists: no more calls';
  delete from public.cm_runs;
  update public.cm_settings set run_time_local = '23:59';
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) <= 2, 'before the run time: no call (unless the clock is at 23:59)';

  -- No secret in the vault: nothing happens.
  delete from vault.decrypted_secrets where name = 'cm_worker_secret';
  delete from net.calls;
  insert into public.cm_jobs (stage) values ('plan');
  perform private.trigger_content_machine();
  assert (select count(*) from net.calls) = 0, 'no secret: no call';
end $$;
rollback;
