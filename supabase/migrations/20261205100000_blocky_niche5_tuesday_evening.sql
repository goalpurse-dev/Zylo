-- Owner, 2026-11-10: blocky_niche5 was stopped at 11:00 (Monday's real opens 4.0%, under 5%). Send it anyway,
-- today 18:00–21:00 Finnish (16–19 UTC), to the 400 already picked, the same email. Only today: no depends_on,
-- and if the Runware/voice check moves it past today, it is stopped instead.

-- Anyone switched off since the pick, or emailed in the 24 hours before the window ends, is skipped.
update public.email_campaign_queue q set status = 'skipped', reason = 'suppressed'
 where q.campaign = 'blocky_niche5' and q.status = 'queued'
   and (exists (select 1 from public.email_suppressions s where s.email = q.email)
        or exists (select 1 from public.profiles p where p.id = q.profile_id and p.email_updates is not true));
update public.email_campaign_queue q set status = 'skipped', reason = 'daily_limit'
 where q.campaign = 'blocky_niche5' and q.status = 'queued'
   and exists (select 1 from public.email_sends e where e.email = q.email and e.sent_at > timestamptz '2026-11-09 19:00+00');

with o as (
  select id, row_number() over (order by send_after, id) rn, count(*) over () total
    from public.email_campaign_queue where campaign = 'blocky_niche5' and status = 'queued'
)
update public.email_campaign_queue q
   set send_after = timestamptz '2026-11-10 16:00+00' + interval '165 minutes' * ((o.rn - 1)::numeric / greatest(o.total, 1))
  from o where q.id = o.id;
update public.email_campaigns
   set status = 'approved', starts_at = timestamptz '2026-11-10 16:00+00', ends_at = timestamptz '2026-11-10 19:00+00',
       depends_on = null, finished_at = null, stop_reason = null, followup_report_at = null
 where id = 'blocky_niche5' and status = 'stopped'
   and not exists (select 1 from public.email_campaign_queue where campaign = 'blocky_niche5' and status = 'sent');

-- Only today: at 21:05 Finnish, a blocky_niche5 that was moved to another day is stopped and its queue dropped.
select cron.schedule('blocky-niche5-only-today', '5 19 10 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'blocky_niche5' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'blocky_niche5' and starts_at > timestamptz '2026-11-10 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Tuesday 10 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'blocky_niche5' and status = 'approved' and starts_at > timestamptz '2026-11-10 19:00+00';
select cron.unschedule('blocky-niche5-only-today');
$job$);
