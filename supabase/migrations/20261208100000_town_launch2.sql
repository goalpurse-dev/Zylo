-- "In This Town" launch, round 2 (owner, 2026-11-19): one email Thursday 19 Nov 15:00–21:00 Finnish (13–19 UTC) from
-- Niko <niko@tryzyvo.com>, plain, one link (the In This Town page) plus the unsubscribe, the launch deal line while the
-- deal runs (_shared/launchDeal.js). The owner asked for 2,000; only 347 pass the rules, and the owner chose "All 347":
--   Group 1: never had a marketing email (newest sign-ups first).
--   Group 2: really opened any of our emails since 4 Nov (first open more than 60 s after delivery) but didn't get
--            the launch email (most recent open first).
--   Group 3: everyone else who passes the rules: 1 marketing email, never opened (most recently seen first).
-- Rules for all: email updates ON, not blocked, not "unengaged" (2 marketing emails and no open), nobody who got
-- town_launch1, nobody emailed (any email) in the 24 hours before the window ends, nobody gets this email twice, not
-- the owner's or seed addresses. Stop rules: campaigns.js. Seeds at 14:30 Finnish. Created 'waiting'.

create or replace function public.town_launch2_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
returns table (profile_id uuid, email text, grp int, last_seen timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select p.id, lower(btrim(p.email)) email, p.created_at from profiles p
     where p.email_updates is true and p.email like '%@%'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'town_launch%'
                          and q.campaign <> p_campaign and q.status in ('sent', 'sending', 'queued'))
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where lower(v.email) = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open as (
    select d.email, max(o.t) t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '60 seconds'
     group by d.email
  ), g as (
    select o.id, o.email, o.created_at, ro.t ro_t,
           (select count(*) from email_sends e where e.email = o.email and e.category = 'marketing') mk,
           greatest(u.last_sign_in_at, u.created_at,
                    (select max(greatest(a.created_at, a.updated_at, a.refreshed_at)) from auth.sessions a where a.user_id = o.id)) broad_seen
      from on_people o
      join auth.users u on u.id = o.id
      left join real_open ro on ro.email = o.email
  )
  select id, email,
         case when mk = 0 then 1 when ro_t is not null then 2 else 3 end,
         case when mk = 0 then created_at when ro_t is not null then ro_t else broad_seen end
    from g;
$function$;
revoke all on function public.town_launch2_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

-- (Re)pick: while nothing has gone out, the queue is rebuilt from scratch.
create or replace function public.fill_town_launch2(p_campaign text, p_count int)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c email_campaigns%rowtype;
  v_n int;
begin
  select * into c from email_campaigns where id = p_campaign;
  if c.id is null or c.status not in ('waiting', 'approved') then
    return 0;
  end if;
  if exists (select 1 from email_campaign_queue where campaign = p_campaign and status <> 'queued') then
    return 0;  -- something already went out: never re-pick
  end if;
  delete from email_campaign_queue where campaign = p_campaign and status = 'queued';
  with pick as (
    select * from public.town_launch2_candidates(p_campaign, c.starts_at, c.ends_at) t
     order by t.grp, t.last_seen desc nulls last, t.email
     limit p_count
  ), ordered as (
    select *, row_number() over (order by grp, last_seen desc nulls last, email) rn, count(*) over () total from pick
  ), ins as (
    insert into email_campaign_queue (campaign, profile_id, email, send_after, status)
    select p_campaign, profile_id, email,
           c.starts_at + ((c.ends_at - interval '15 minutes') - c.starts_at) * ((rn - 1)::numeric / greatest(total, 1)),
           'queued'
      from ordered
    on conflict (campaign, profile_id) do nothing
    returning 1
  )
  select count(*) into v_n from ins;
  update email_campaigns set planned = (select count(*) from email_campaign_queue where campaign = p_campaign) where id = p_campaign;
  return v_n;
end;
$function$;
revoke all on function public.fill_town_launch2(text, int) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('town_launch2', 'waiting', 0, timestamptz '2026-11-19 13:00+00', timestamptz '2026-11-19 19:00+00', null)
on conflict (id) do nothing;

-- The owner's 2,000 is a ceiling: everyone who passes the rules (347 on 19 Nov 00:30 Finnish).
select public.fill_town_launch2('town_launch2', 2000);

-- Only today: at 21:05 Finnish, a town_launch2 that was moved to another day is stopped and its queue dropped.
select cron.schedule('town-launch2-only-today', '5 19 19 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'town_launch2' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'town_launch2' and starts_at > timestamptz '2026-11-19 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Thursday 19 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'town_launch2' and status in ('waiting', 'approved') and starts_at > timestamptz '2026-11-19 19:00+00';
select cron.unschedule('town-launch2-only-today');
$job$);
