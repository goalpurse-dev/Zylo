-- "In This Town" early access (owner, 2026-11-15): one email today 18:00–21:00 Finnish (16–19 UTC) from
-- Niko <niko@tryzyvo.com>, plain, no link but the unsubscribe; 500 people, best first.
--   Group 1: really opened (first open more than 60 s after delivery) any of our emails sent since 4 Nov,
--            or came back to Zyvo after a campaign email sent since 4 Nov. Most recent first.
--   Group 2: active in the last 30 days and never had a marketing email. Most recently active first.
-- Rules for both: email updates ON, not blocked, not "unengaged" (2 marketing emails and no open),
-- nobody emailed (any email) in the 24 hours before the window ends, nobody gets this email twice,
-- not the owner's or seed addresses. Stop rules: campaigns.js (0 complaints, fewer than 2 real bounces;
-- mailbox full only switches that address off). Seeds at 17:15 Finnish.
-- The day is created 'waiting' (the sender skips it) and approved once the email text is final.

create or replace function public.town_early_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
returns table (profile_id uuid, email text, grp int, last_seen timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select p.id, lower(btrim(p.email)) email from profiles p
     where p.email_updates is true and p.email like '%@%'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'town_early%'
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
  ), sent_q as (
    select profile_id, min(sent_at) sent_at from email_campaign_queue
     where status = 'sent' and sent_at >= timestamptz '2026-11-04 00:00+02' group by profile_id
  ), came_back as (
    select s.profile_id, max(x.t) t from sent_q s
      join lateral (
        select u.last_sign_in_at t from auth.users u where u.id = s.profile_id
        union all select greatest(a.created_at, a.updated_at, a.refreshed_at) from auth.sessions a where a.user_id = s.profile_id
        union all select f.created_at from funnel_events f where f.user_id = s.profile_id
        union all select c.created_at from creations c where c.user_id = s.profile_id
        union all select l.created_at from long_form_projects l where l.user_id = s.profile_id
        union all select g.created_at from generation_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from fruit_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from blocky_credit_ledger g where g.user_id = s.profile_id
        union all select b.created_at from blocky_stories b where b.user_id = s.profile_id
        union all select b.created_at from blocky_ai_calls b where b.user_id = s.profile_id
      ) x on x.t > s.sent_at
     group by s.profile_id
  ), seen as (
    select user_id, max(t) t from (
      select id user_id, last_sign_in_at t from auth.users where last_sign_in_at > p_starts - interval '30 days'
      union all select user_id, greatest(created_at, updated_at, refreshed_at) from auth.sessions where greatest(created_at, updated_at, refreshed_at) > p_starts - interval '30 days'
      union all select user_id, created_at from funnel_events where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from creations where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from long_form_projects where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from generation_credit_ledger where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from fruit_credit_ledger where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from blocky_credit_ledger where created_at > p_starts - interval '30 days'
    ) x where user_id is not null group by user_id
  )
  select o.id, o.email,
         case when ro.t is not null or cb.t is not null then 1 else 2 end,
         case when ro.t is not null or cb.t is not null then greatest(ro.t, cb.t) else s.t end
    from on_people o
    left join real_open ro on ro.email = o.email
    left join came_back cb on cb.profile_id = o.id
    left join seen s on s.user_id = o.id
   where ro.t is not null or cb.t is not null
      or (s.t is not null and not exists (select 1 from email_sends e where e.email = o.email and e.category = 'marketing'));
$function$;
revoke all on function public.town_early_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.fill_town_early(p_campaign text, p_count int)
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
  with pick as (
    select * from public.town_early_candidates(p_campaign, c.starts_at, c.ends_at) t
     where not exists (select 1 from email_campaign_queue q where q.campaign = p_campaign and q.profile_id = t.profile_id)
     order by t.grp, t.last_seen desc, t.email
     limit greatest(p_count - (select count(*) from email_campaign_queue where campaign = p_campaign), 0)
  ), ordered as (
    select *, row_number() over (order by grp, last_seen desc, email) rn, count(*) over () total from pick
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
revoke all on function public.fill_town_early(text, int) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('town_early1', 'waiting', 0, timestamptz '2026-11-15 16:00+00', timestamptz '2026-11-15 19:00+00', null)
on conflict (id) do nothing;

select public.fill_town_early('town_early1', 500);

-- Only today: at 21:05 Finnish, a town_early1 that was moved to another day is stopped and its queue dropped.
select cron.schedule('town-early1-only-today', '5 19 15 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'town_early1' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'town_early1' and starts_at > timestamptz '2026-11-15 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Sunday 15 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'town_early1' and status in ('waiting', 'approved') and starts_at > timestamptz '2026-11-15 19:00+00';
select cron.unschedule('town-early1-only-today');
$job$);
