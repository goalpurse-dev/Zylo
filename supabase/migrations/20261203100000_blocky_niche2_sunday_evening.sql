-- Owner, 2026-11-08 (after blocky_niche2 was stopped at 11:00 for 3 "mailbox full" bounces on Saturday):
-- 1. "Mailbox full" addresses are switched off for good (suppressed), and only real bounces count toward the stop rule
--    (campaigns.js: realBounced).
-- 2. blocky_niche2 goes out today 18:00–21:00 Finnish (16–19 UTC) to the people already picked, the same email.
--    Only today: no depends_on, and if the Runware/voice check moves it past today, it is stopped instead.
-- 3. blocky_niche3 (Mon 400) is cancelled and its pick and seed jobs removed.

-- 1. Every address that ever bounced "mailbox full" → never emailed again.
insert into public.email_suppressions (email, reason, source)
select distinct lower(btrim(e.email)), 'bounced', 'mailbox_full'
  from public.email_events e
 where e.type = 'email.bounced' and e.detail ilike '%mailboxfull%' and e.email like '%@%'
   and not exists (select 1 from public.email_suppressions s where s.email = lower(btrim(e.email)))
on conflict do nothing;
update public.profiles p set email_updates = false
 where p.email_updates is true
   and exists (select 1 from public.email_suppressions s where s.source = 'mailbox_full' and s.email = lower(btrim(p.email)));

-- 2. Today's 250, minus anyone now suppressed, spread over 18:00–20:45 Finnish.
update public.email_campaign_queue q set status = 'skipped', reason = 'suppressed'
 where q.campaign = 'blocky_niche2' and q.status = 'queued'
   and exists (select 1 from public.email_suppressions s where s.email = q.email);
with o as (
  select id, row_number() over (order by send_after, id) rn, count(*) over () total
    from public.email_campaign_queue where campaign = 'blocky_niche2' and status = 'queued'
)
update public.email_campaign_queue q
   set send_after = timestamptz '2026-11-08 16:00+00' + interval '165 minutes' * ((o.rn - 1)::numeric / greatest(o.total, 1))
  from o where q.id = o.id;
update public.email_campaigns
   set status = 'approved', starts_at = timestamptz '2026-11-08 16:00+00', ends_at = timestamptz '2026-11-08 19:00+00',
       depends_on = null, finished_at = null, stop_reason = null, followup_report_at = null
 where id = 'blocky_niche2' and status = 'stopped'
   and not exists (select 1 from public.email_campaign_queue where campaign = 'blocky_niche2' and status = 'sent');

-- Only today: at 21:05 Finnish, a blocky_niche2 that was moved to another day is stopped and its queue dropped.
select cron.schedule('blocky-niche2-only-today', '5 19 8 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'blocky_niche2' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'blocky_niche2' and starts_at > timestamptz '2026-11-08 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Sunday 8 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'blocky_niche2' and status = 'approved' and starts_at > timestamptz '2026-11-08 19:00+00';
select cron.unschedule('blocky-niche2-only-today');
$job$);

-- 3. Monday's 400: cancelled, nothing picked, no jobs left.
update public.email_campaigns set status = 'stopped', stop_reason = 'cancelled by the owner (2026-11-08)', finished_at = now(), followup_report_at = now()
 where id = 'blocky_niche3' and status = 'approved';
select cron.unschedule(jobname) from cron.job where jobname in ('blocky-niche3-fill', 'blocky-niche3-seed');
