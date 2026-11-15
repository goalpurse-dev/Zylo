-- Owner, 2026-11-15: the day text is final ("It's coming next week", campaign-sender 43929a92 live), so town_early1 is
-- approved for 18:00–21:00 Finnish. Seed copies to the owner's two inboxes at 17:15 Finnish (15:15 UTC), the real subject
-- (asSent), before the send starts, so the owner can check they land in Primary.
update public.email_campaigns set status = 'approved' where id = 'town_early1' and status = 'waiting';

select cron.schedule('town-early1-seed', '15 15 15 11 *', $job$
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'town_early1', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaigns where id = 'town_early1' and status in ('approved', 'sending'));
select cron.unschedule('town-early1-seed');
$job$);
