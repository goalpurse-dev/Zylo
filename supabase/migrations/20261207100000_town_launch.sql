-- "In This Town" launch (owner, 2026-11-17): one email today 18:00–21:00 Finnish (16–19 UTC) from Niko
-- <niko@tryzyvo.com>, plain, one link (the In This Town page) plus the unsubscribe; 1,000 people in this order:
--   Group 1: the early-access people who replied "me" (owner's list).
--   Group 2: really opened Sunday's pre-hype email (town_early1; first open more than 60 s after delivery).
--   Group 3: really opened any of our emails sent since 4 Nov, or came back to Zyvo after a campaign email since 4 Nov.
--   Group 4: active in the last 30 days and never had a marketing email.
-- Rules for all: email updates ON, not blocked, not "unengaged" (2 marketing emails and no open), nobody emailed
-- (any email) in the 24 hours before the window ends, nobody gets this email twice, not the owner's or seed addresses.
-- Most recent first inside groups 2–4. Stop rules: campaigns.js. Seeds at 17:30 Finnish. Created 'waiting'.

create or replace function public.town_launch_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz, p_me text[])
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
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'town_launch%'
                          and q.campaign <> p_campaign and q.status in ('sent', 'sending', 'queued'))
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where lower(v.email) = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open_rows as (
    select d.email, d.resend_id, o.t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '60 seconds'
  ), real_open as (
    select email, max(t) t from real_open_rows group by email
  ), sunday_open as (
    select r.email, max(r.t) t from real_open_rows r
      join email_campaign_queue q on q.resend_id = r.resend_id and q.campaign = 'town_early1'
     group by r.email
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
  ), g as (
    select o.id, o.email, so.t so_t, ro.t ro_t, cb.t cb_t, s.t seen_t,
           o.email = any (select lower(btrim(m)) from unnest(p_me) m) is_me,
           exists (select 1 from email_sends e where e.email = o.email and e.category = 'marketing') had_marketing,
           exists (select 1 from email_events v where lower(v.email) = o.email and v.type = 'email.opened') opened_ever,
           greatest(u.last_sign_in_at, u.created_at,
                    (select max(greatest(a.created_at, a.updated_at, a.refreshed_at)) from auth.sessions a where a.user_id = o.id)) broad_seen
      from on_people o
      join auth.users u on u.id = o.id
      left join sunday_open so on so.email = o.email
      left join real_open ro on ro.email = o.email
      left join came_back cb on cb.profile_id = o.id
      left join seen s on s.user_id = o.id
  )
  -- Owner, 2026-11-17 ("Fill to 1,000"): after groups 1–4, group 5 = ever opened one of our emails, group 6 = never had a
  -- marketing email (seen longer ago), group 7 = everyone else who passes the rules (1 marketing email, no open).
  select id, email,
         case when is_me then 1 when so_t is not null then 2 when ro_t is not null or cb_t is not null then 3
              when seen_t is not null and not had_marketing then 4 when opened_ever then 5 when not had_marketing then 6 else 7 end,
         case when is_me then now() when so_t is not null then so_t when ro_t is not null or cb_t is not null then greatest(ro_t, cb_t)
              when seen_t is not null and not had_marketing then seen_t else broad_seen end
    from g;
$function$;
revoke all on function public.town_launch_candidates(text, timestamptz, timestamptz, text[]) from public, anon, authenticated;

-- (Re)pick: while nothing has gone out, the queue is rebuilt from scratch, so a later "me" list still goes first.
create or replace function public.fill_town_launch(p_campaign text, p_count int, p_me text[])
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
    select * from public.town_launch_candidates(p_campaign, c.starts_at, c.ends_at, p_me) t
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
revoke all on function public.fill_town_launch(text, int, text[]) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('town_launch1', 'waiting', 0, timestamptz '2026-11-17 16:00+00', timestamptz '2026-11-17 19:00+00', null)
on conflict (id) do nothing;

-- The owner's "me" list (2026-11-17).
select public.fill_town_launch('town_launch1', 1000, array['viola.bernath@icloud.com', 'djayehmisiedjan@gmail.com']);

-- Only today: at 21:05 Finnish, a town_launch1 that was moved to another day is stopped and its queue dropped.
select cron.schedule('town-launch1-only-today', '5 19 17 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'town_launch1' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'town_launch1' and starts_at > timestamptz '2026-11-17 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Tuesday 17 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'town_launch1' and status in ('waiting', 'approved') and starts_at > timestamptz '2026-11-17 19:00+00';
select cron.unschedule('town-launch1-only-today');
$job$);
