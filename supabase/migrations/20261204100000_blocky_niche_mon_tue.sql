-- Two more Blocky days (owner, 2026-11-08): the same email from Niko <niko@tryzyvo.com>, 11:00–13:00 Finnish (09–11 UTC).
-- blocky_niche4 = 250 on Mon 9 Nov; blocky_niche5 = 400 on Tue 10 Nov only if Monday had 0 complaints, fewer than
-- 2 real bounces and real opens of at least 5% by 11:00 Tuesday (campaigns.js: maxRealBouncesBefore, minRealOpenRateBefore).
-- Same group as before (ON, active 30 days or opened since October, not blocked, never got this email), most recently
-- active first, and now also nobody emailed in the last 24 hours. Picked at 10:50, seed copies at 15:00 if the day sent.

create or replace function public.fill_blocky_niche(p_campaign text, p_count int)
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
  if c.id is null or c.status <> 'approved' then
    return 0;  -- stopped, moved past, or missing: nothing to fill
  end if;
  with on_people as (
    select p.id, lower(btrim(p.email)) email from profiles p
     where p.email_updates is true and p.email like '%@%'
       and p.created_at <= c.starts_at - interval '24 hours'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       -- owner, 2026-11-08: nobody emailed (any email) in the 24 hours before the window ends
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > c.ends_at - interval '24 hours')
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'blocky_niche%' and q.status in ('sent', 'sending', 'queued'))
  ), seen as (
    select user_id, max(t) t from (
      select id user_id, last_sign_in_at t from auth.users where last_sign_in_at > now() - interval '30 days'
      union all select user_id, greatest(created_at, updated_at, refreshed_at) from auth.sessions where greatest(created_at, updated_at, refreshed_at) > now() - interval '30 days'
      union all select user_id, created_at from funnel_events where created_at > now() - interval '30 days'
      union all select user_id, created_at from creations where created_at > now() - interval '30 days'
      union all select user_id, created_at from long_form_projects where created_at > now() - interval '30 days'
      union all select user_id, created_at from generation_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from fruit_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from blocky_credit_ledger where created_at > now() - interval '30 days'
    ) x where user_id is not null group by user_id
  ), opened as (
    select email, max(created_at) t from email_events where type = 'email.opened' and created_at >= timestamptz '2026-10-01 00:00+03' group by email
  ), pick as (
    select o.id, o.email, greatest(s.t, op.t) last_seen
      from on_people o left join seen s on s.user_id = o.id left join opened op on op.email = o.email
     where (s.t is not null or op.t is not null)
       and not ((select count(*) from email_sends e where e.email = o.email and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where v.email = o.email and v.type = 'email.opened'))
     order by last_seen desc, o.email
     limit greatest(p_count - (select count(*) from email_campaign_queue where campaign = p_campaign), 0)
  ), ordered as (
    select *, row_number() over (order by last_seen desc, email) rn, count(*) over () total from pick
  ), ins as (
    insert into email_campaign_queue (campaign, profile_id, email, send_after, status)
    select p_campaign, id, email,
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
revoke all on function public.fill_blocky_niche(text, int) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('blocky_niche4', 'approved', 0, timestamptz '2026-11-09 09:00+00', timestamptz '2026-11-09 11:00+00', null),
  ('blocky_niche5', 'approved', 0, timestamptz '2026-11-10 09:00+00', timestamptz '2026-11-10 11:00+00', 'blocky_niche4')
on conflict (id) do nothing;

select cron.schedule('blocky-niche4-fill', '50 8 9 11 *', $job$ select public.fill_blocky_niche('blocky_niche4', 250); select cron.unschedule('blocky-niche4-fill'); $job$);
select cron.schedule('blocky-niche5-fill', '50 8 10 11 *', $job$ select public.fill_blocky_niche('blocky_niche5', 400); select cron.unschedule('blocky-niche5-fill'); $job$);
select cron.schedule('blocky-niche4-seed', '0 13 9 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'blocky_niche4', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaign_queue where campaign = 'blocky_niche4' and status = 'sent');
select cron.unschedule('blocky-niche4-seed');
$job$);
select cron.schedule('blocky-niche5-seed', '0 13 10 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'blocky_niche5', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaign_queue where campaign = 'blocky_niche5' and status = 'sent');
select cron.unschedule('blocky-niche5-seed');
$job$);
