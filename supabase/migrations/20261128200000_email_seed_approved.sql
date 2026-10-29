-- Seed copies also for a day the owner approved ahead (owner, 2026-10-29: Day 1 on Friday sends
-- even if the seed lands in spam; the seed still goes at 15:00).
create or replace function private.trigger_campaign_sender()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare secret text; sender_url text;
begin
  if not exists (select 1 from public.email_campaigns where status in ('approved', 'sending') and starts_at <= now())
     and not exists (select 1 from public.email_campaigns where status in ('done', 'stopped') and followup_report_at is null and finished_at < now() - interval '48 hours')
     and not exists (select 1 from public.email_campaigns where status in ('waiting', 'approved') and seed_to is not null and seed_sent_at is null and seed_at <= now())
     and not exists (select 1 from public.email_campaigns where min_open_rate is not null and open_check_at is null and status in ('sending', 'done') and starts_at <= now() - interval '12 hours') then
    return;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1;
  select decrypted_secret into sender_url from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1;
  if secret is null or sender_url is null then
    return;
  end if;
  perform net.http_post(
    url := sender_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 9000
  );
end;
$function$;
