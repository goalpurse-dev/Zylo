-- 2AM: a reservation nobody settled is settled by the server.
--
-- A 2AM story takes its credits up front (30 / 42 / 60) and gives back the
-- failed images' share when it is settled. Only two things settle it: the open
-- browser tab, and a trigger that fires once ALL SIX image jobs are finished.
-- So the credits stayed taken for ever when
--   - the planner died after taking them and before it made the six jobs, or
--   - the tab was closed while a job was still stuck.
-- One such story is in the table today: 60 credits reserved on 24 July 2026.
--
-- Now generation-sweeper calls this every minute. For each story reserved more
-- than 30 minutes ago (and made after p_created_after), whose jobs are all
-- finished or do not exist: the images that succeeded are kept and paid for,
-- the rest of the reservation goes back. The sweeper fails stuck jobs first
-- (30 minutes), so a story with a stuck job is settled on the next minute.
--
-- Needs 20261027100000_two_am_refund_matches_reservation.sql (two_am_refund_for).
-- Service role only. NOT APPLIED. Shown for approval first.

create or replace function public.release_stale_two_am_reservations(p_created_after timestamptz default '2026-10-07 00:00:00+00')
returns setof public.two_am_generations
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.two_am_generations;
  v_open integer;
  v_completed integer;
  v_refund integer;
begin
  for g in
    select * from public.two_am_generations
     where reservation_status = 'reserved'
       and created_at < now() - interval '30 minutes'
       and created_at >= p_created_after
     order by created_at
     limit 50
     for update skip locked
  loop
    select count(*) filter (where status not in ('succeeded', 'failed', 'canceled'))::integer,
           count(*) filter (where status = 'succeeded' and result_url is not null)::integer
      into v_open, v_completed
      from public.jobs
     where settings->>'two_am_generation_id' = g.id::text;
    -- A job still running: the sweeper ends it first; this story is settled on a later call.
    if v_open > 0 then continue; end if;

    v_refund := public.two_am_refund_for(g.reserved_credits, v_completed);
    if v_refund > 0 then
      update public.profiles
         set credit_balance = credit_balance + v_refund,
             credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - v_refund)
       where id = g.user_id;
    end if;
    update public.two_am_generations
       set refunded_credits = v_refund,
           reservation_status = case when v_completed = 0 then 'refunded' else 'settled' end,
           status = case when v_completed >= 6 then 'completed' when v_completed = 0 then 'failed' else 'partial' end
     where id = g.id and reservation_status = 'reserved'
    returning * into g;
    return next g;
  end loop;
end;
$$;

revoke all on function public.release_stale_two_am_reservations(timestamptz) from public, anon, authenticated;
grant execute on function public.release_stale_two_am_reservations(timestamptz) to service_role;
