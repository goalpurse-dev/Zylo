-- The Blocky niche days move earlier (owner, 2026-11-06): 150 on Sat 7 Nov, 250 on Sun 8 Nov, 400 on Mon 9 Nov,
-- still 11:00–13:00 Finnish (09–11 UTC), picked at 10:50 and seed copies at 15:00. Nothing else changes: same
-- people rule, same email, days 2 and 3 still depend on the day before (and 8% real opens there).
update public.email_campaigns set starts_at = timestamptz '2026-11-07 09:00+00', ends_at = timestamptz '2026-11-07 11:00+00'
 where id = 'blocky_niche1' and status = 'approved' and planned = 0;
update public.email_campaigns set starts_at = timestamptz '2026-11-08 09:00+00', ends_at = timestamptz '2026-11-08 11:00+00'
 where id = 'blocky_niche2' and status = 'approved' and planned = 0;
update public.email_campaigns set starts_at = timestamptz '2026-11-09 09:00+00', ends_at = timestamptz '2026-11-09 11:00+00'
 where id = 'blocky_niche3' and status = 'approved' and planned = 0;

select cron.alter_job(jobid, schedule := '50 8 7 11 *') from cron.job where jobname = 'blocky-niche1-fill';
select cron.alter_job(jobid, schedule := '50 8 8 11 *') from cron.job where jobname = 'blocky-niche2-fill';
select cron.alter_job(jobid, schedule := '50 8 9 11 *') from cron.job where jobname = 'blocky-niche3-fill';
select cron.alter_job(jobid, schedule := '0 13 7 11 *') from cron.job where jobname = 'blocky-niche1-seed';
select cron.alter_job(jobid, schedule := '0 13 8 11 *') from cron.job where jobname = 'blocky-niche2-seed';
select cron.alter_job(jobid, schedule := '0 13 9 11 *') from cron.job where jobname = 'blocky-niche3-seed';
