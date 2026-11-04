-- The check-in from the main domain, days 2 and 3 (owner, 2026-11-04, after checkin_root1: 20 sent, 2 real opens):
-- checkin_root2 = 40 people Thu 5 Nov, checkin_root3 = 80 people Fri 6 Nov, 11:00–13:00 Finnish (09–11 UTC).
-- Each depends on the day before (0 complaints, bounces under 2%) and needs 2 real opens there (campaign-sender).
-- People are picked at 10:50 Finnish that morning, so "active in the last 48 hours" means before that day's send.

-- Who: product updates ON, signed in during the 48 hours before the pick, signed up at least 24 hours before the
-- window, never queued for any check-in, not suppressed, not "unengaged" (the gate would refuse them), not the
-- owner's or test addresses. Mostly Gmail: about 85% (as on day 1: 17 of 20), the rest from other providers; if one
-- side runs short the other fills in. Latest sign-in first, spread evenly over the window. → how many were queued.
create or replace function public.fill_checkin_root(p_campaign text, p_count int)
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
  with cand as (
    select p.id, lower(btrim(p.email)) email, u.last_sign_in_at, (lower(btrim(p.email)) like '%@gmail.com') gmail
      from profiles p join auth.users u on u.id = p.id
     where p.email_updates is true and p.email like '%@%'
       and u.last_sign_in_at > now() - interval '48 hours'
       and p.created_at <= c.starts_at - interval '24 hours'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'checkin%' and q.status in ('sent', 'sending', 'queued'))
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where v.email = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), ranked as (
    select *, row_number() over (partition by gmail order by last_sign_in_at desc, email) k from cand
  ), pick as (
    select * from ranked
     order by k / (case when gmail then 0.85 else 0.15 end), gmail desc, email
     limit greatest(p_count - (select count(*) from email_campaign_queue where campaign = p_campaign), 0)
  ), ordered as (
    select *, row_number() over (order by last_sign_in_at desc, email) rn, count(*) over () total from pick
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
revoke all on function public.fill_checkin_root(text, int) from public, anon, authenticated;

insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('checkin_root2', 'approved', 0, timestamptz '2026-11-05 09:00+00', timestamptz '2026-11-05 11:00+00', 'checkin_root1'),
  ('checkin_root3', 'approved', 0, timestamptz '2026-11-06 09:00+00', timestamptz '2026-11-06 11:00+00', 'checkin_root2')
on conflict (id) do nothing;

-- The pick at 10:50 Finnish, and the seed copies at 15:00 Finnish, only for a day that sent something. Each job
-- removes itself after its one run (a day moved by the Runware/voice check keeps its people, but gets no seed).
select cron.schedule('checkin-root2-fill', '50 8 5 11 *', $job$ select public.fill_checkin_root('checkin_root2', 40); select cron.unschedule('checkin-root2-fill'); $job$);
select cron.schedule('checkin-root3-fill', '50 8 6 11 *', $job$ select public.fill_checkin_root('checkin_root3', 80); select cron.unschedule('checkin-root3-fill'); $job$);
select cron.schedule('checkin-root2-seed', '0 13 5 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'checkin_root2', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaign_queue where campaign = 'checkin_root2' and status = 'sent');
select cron.unschedule('checkin-root2-seed');
$job$);
select cron.schedule('checkin-root3-seed', '0 13 6 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'checkin_root3', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaign_queue where campaign = 'checkin_root3' and status = 'sent');
select cron.unschedule('checkin-root3-seed');
$job$);
