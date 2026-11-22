-- "Your In This Town video is waiting" (owner, 2026-11-23): one email Monday 23 Nov 13:00–21:00 Finnish (11–19 UTC) from
-- Niko <niko@tryzyvo.com>, plain, one link (the free In This Town: the free kit's template page) plus the unsubscribe.
-- Up to 4,000 people, in this order (fewer is fine, the rules are never bent to reach 4,000):
--   Group 1: really opened any In This Town email (town_early1 = the pre-hype, town_launch1, town_launch2, town_free1)
--            (first open more than 30 s after delivery: the owner's real-open line since 2026-11-21), latest open first.
--   Group 2: came back to Zyvo after a campaign email since 4 Nov, most recent first.
--   Group 3: really opened any of our emails since 4 Nov, most recent open first.
--   Group 4: everyone left who never had a marketing email, newest sign-ups first.
-- Rules for all: email updates ON, not blocked, not "unengaged" (2 marketing emails and no open: ON in the gate since
-- 2026-11-21), nobody emailed (any email) in the 24 hours before the window ends, nobody who signed up in the 24 hours
-- before the window starts (the gate would skip them), nobody gets this email twice, not the owner's or seed addresses.
-- Stop rules: campaigns.js (as before). Created 'waiting': it goes only after the owner's checks are done by 12:00
-- (paid In This Town videos back on, the free path checked, Runware) and the status is set to 'approved'.

create or replace function public.town_free2_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
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
       and p.created_at <= p_starts - interval '24 hours'
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.kind = 'campaign:' || p_campaign)
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where lower(v.email) = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open_rows as (
    select d.email, d.resend_id, o.t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '30 seconds'
  ), real_open as (
    select email, max(t) t from real_open_rows group by email
  ), town_open as (
    select r.email, max(r.t) t from real_open_rows r
      join email_campaign_queue q on q.resend_id = r.resend_id and q.campaign in ('town_early1', 'town_launch1', 'town_launch2', 'town_free1')
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
        union all select b.created_at from blocky_worlds_events b where b.user_id = s.profile_id
        union all select b.created_at from blocky_worlds_drafts b where b.user_id = s.profile_id
        union all select b.created_at from blocky_worlds_runs b where b.user_id = s.profile_id
        union all select k.created_at from zyvo_kit_downloads k where k.user_id = s.profile_id
      ) x on x.t > s.sent_at
     group by s.profile_id
  ), g as (
    select o.id, o.email, o.created_at, tt.t town_t, cb.t cb_t, ro.t ro_t,
           (select count(*) from email_sends e where e.email = o.email and e.category = 'marketing') mk
      from on_people o
      left join town_open tt on tt.email = o.email
      left join came_back cb on cb.profile_id = o.id
      left join real_open ro on ro.email = o.email
  )
  select id, email,
         case when town_t is not null then 1 when cb_t is not null then 2 when ro_t is not null then 3 else 4 end,
         case when town_t is not null then town_t when cb_t is not null then cb_t when ro_t is not null then ro_t else created_at end
    from g
   where town_t is not null or cb_t is not null or ro_t is not null or mk = 0;
$function$;
revoke all on function public.town_free2_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

-- (Re)pick: while nothing has gone out, the queue is rebuilt from scratch.
create or replace function public.fill_town_free2(p_campaign text, p_count int)
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
    select * from public.town_free2_candidates(p_campaign, c.starts_at, c.ends_at) t
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
revoke all on function public.fill_town_free2(text, int) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('town_free2', 'waiting', 0, timestamptz '2026-11-23 11:00+00', timestamptz '2026-11-23 19:00+00', null)
on conflict (id) do nothing;

select public.fill_town_free2('town_free2', 4000);

-- 12:00 Finnish: a last re-pick while it is still waiting (picks up sign-ups that turned 24 h old and drops anyone
-- emailed or unsubscribed overnight). Nothing changes once something has gone out.
select cron.schedule('town-free2-repick', '0 10 23 11 *', $job$
select public.fill_town_free2('town_free2', 4000);
select cron.unschedule('town-free2-repick');
$job$);

-- Seeds 12:30 Finnish: one copy each to the owner's two inboxes with the real subject, only if the send is approved.
select cron.schedule('town-free2-seeds', '30 10 23 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'town_free2', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaigns where id = 'town_free2' and status in ('approved', 'sending'));
select cron.unschedule('town-free2-seeds');
$job$);

-- Only today: at 21:05 Finnish, a town_free2 that was moved to another day (or never approved) is stopped.
select cron.schedule('town-free2-only-today', '5 19 23 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'town_free2' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'town_free2' and (status = 'waiting' or starts_at > timestamptz '2026-11-23 19:00+00'));
update public.email_campaigns set status = 'stopped', stop_reason = 'only Monday 23 Nov (owner): not approved by 12:00 or moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'town_free2' and (status = 'waiting' or (status = 'approved' and starts_at > timestamptz '2026-11-23 19:00+00'));
select cron.unschedule('town-free2-only-today');
$job$);
