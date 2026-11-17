-- Owner, 2026-11-17: town_launch1 approved for 18:00–21:00 Finnish once campaign-sender with its text is live; seed copies
-- to the owner's two inboxes at 17:30 Finnish (15:30 UTC), the real subject (asSent), before the send starts.
update public.email_campaigns set status = 'approved' where id = 'town_launch1' and status = 'waiting';

select cron.schedule('town-launch1-seed', '30 15 17 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'town_launch1', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaigns where id = 'town_launch1' and status in ('approved', 'sending'));
select cron.unschedule('town-launch1-seed');
$job$);
