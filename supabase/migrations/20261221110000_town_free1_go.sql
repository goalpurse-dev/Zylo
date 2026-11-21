-- Owner, 2026-11-21: town_free1 approved for today 16:00–21:00 Finnish once campaign-sender with its text is live.
-- Seed copies to the owner's two inboxes (asked for 15:30 Finnish; the email was ready at ~15:45, so they go right away,
-- before the send starts), with the real subject (asSent).
update public.email_campaigns set status = 'approved' where id = 'town_free1' and status = 'waiting';

select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'town_free1', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaigns where id = 'town_free1' and status in ('approved', 'sending'));
