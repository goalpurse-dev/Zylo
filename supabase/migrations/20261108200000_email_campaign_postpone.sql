-- Scheduled campaigns, fourth step (2026-10-26, the owner's rule): a day that may not start
-- because Runware or the voice provider failed in the last 3 hours is not cancelled. It and every
-- later day move one day forward: start, end (the window an email may still go in) and each of
-- their queued emails, all +24 hours, in one transaction.
-- Bounces or complaints still stop a day, and the days after it (depends_on), as before.
-- p_from: the day that may not start. Moved: every campaign in "approved" or "waiting" that starts
-- at or after it and has sent nothing yet. Returns the moved campaigns with their new start.
create or replace function public.postpone_campaigns(p_from text)
returns table (id text, starts_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare v_from timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign-postpone', 0));
  select c.starts_at into v_from from email_campaigns c
   where c.id = p_from and c.status in ('approved', 'waiting')
     and not exists (select 1 from email_campaign_queue q where q.campaign = c.id and q.status in ('sending', 'sent'));
  if v_from is null then
    return;  -- already moved by another call, started, or finished: nothing to do
  end if;
  return query
  with moving as (
    select c.id from email_campaigns c
     where c.status in ('approved', 'waiting') and c.starts_at >= v_from
       and not exists (select 1 from email_campaign_queue q where q.campaign = c.id and q.status in ('sending', 'sent'))
  ), q as (
    update email_campaign_queue q set send_after = q.send_after + interval '24 hours'
     where q.campaign in (select m.id from moving m) and q.status = 'queued'
     returning q.campaign
  )
  update email_campaigns c set starts_at = c.starts_at + interval '24 hours', ends_at = c.ends_at + interval '24 hours'
   where c.id in (select m.id from moving m)
  returning c.id, c.starts_at;
end;
$$;
revoke all on function public.postpone_campaigns(text) from public, anon, authenticated;
grant execute on function public.postpone_campaigns(text) to service_role;

notify pgrst, 'reload schema';
