-- Content Machine Phase 2: the library seed, the recipe columns and the queue claim. Run after both
-- migrations inside BEGIN/ROLLBACK (it writes jobs that the rollback removes). Calls nothing outside the
-- database. Locally: node scripts/contentMachine/sqlCheck.mjs
begin;
do $$
declare j public.cm_jobs; n integer; first_id uuid;
begin
  -- The seeded library: 17 formats, 5 styles, 10 hook types, all active.
  assert (select count(*) from public.cm_library where kind = 'format' and status = 'active') = 17, 'formats seeded';
  assert (select count(*) from public.cm_library where kind = 'style' and status = 'active') = 5, 'styles seeded';
  assert (select count(*) from public.cm_library where kind = 'hook' and status = 'active') = 10, 'hooks seeded';
  assert (select spec ->> 'bg_prompt' like '%no text%' from public.cm_library where kind = 'style' and key = 'neon_grid'), 'background prompts ask for no text';

  -- Settings carry the experiment phase and the daily run.
  assert (select experiment_days = 14 and daily_auto_run and winners_per_day = 3 and experiments_per_day = 2 and use_batch_for_daily from public.cm_settings), 'phase 2 settings';

  -- The claim: due jobs only, once each, oldest first; a lease that ran out is claimed again.
  delete from public.cm_jobs;
  insert into public.cm_jobs (stage, run_after) values ('a', now() - interval '2 minutes'), ('b', now() - interval '1 minute'), ('later', now() + interval '1 hour');
  select * into j from public.cm_claim_jobs(1, 60);
  assert j.stage = 'a' and j.status = 'running' and j.attempts = 1, 'oldest due job first';
  first_id := j.id;
  select count(*) into n from public.cm_claim_jobs(5, 60);
  assert n = 1, 'only the other due job, not the running one or the later one';
  update public.cm_jobs set locked_until = now() - interval '1 second' where id = first_id;
  select * into j from public.cm_claim_jobs(5, 60);
  assert j.id = first_id and j.attempts = 2, 'an expired lease is claimed again';
  update public.cm_jobs set locked_until = now() - interval '1 second' where id = first_id;
  select count(*) into n from public.cm_claim_jobs(5, 60);
  assert n = 0, 'past max_attempts it is not claimed';
  assert (select status = 'failed' from public.cm_jobs where id = first_id), 'and is failed instead';

  -- Nobody but the service role.
  assert not has_function_privilege('authenticated', 'public.cm_claim_jobs(integer,integer)', 'execute'), 'claim not exposed';
  assert not has_function_privilege('authenticated', 'private.trigger_content_machine()', 'execute'), 'tick not exposed';
  assert (select relrowsecurity from pg_class where oid = 'public.cm_library'::regclass), 'RLS on the library';
end $$;
rollback;
