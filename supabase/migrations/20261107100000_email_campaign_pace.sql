-- Scheduled campaigns, third step (2026-10-26, warm-up days 4–7):
--   pace       day 6 is 1,500 emails in 7 hours, one every 17 seconds: the cron job now runs
--              every 10 seconds and a campaign may send one email per 8 seconds at most
--              (it was one per 25 seconds, which fits 1,000 in 7 hours)
--   follow-up  the second report comes 48 hours after a campaign ends (it was 12): the owner
--              wants the plans bought within 48 hours of each email in it
create or replace function public.claim_campaign_email(p_campaign text)
returns setof public.email_campaign_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign:' || p_campaign, 0));
  if not exists (select 1 from email_campaigns where id = p_campaign and status in ('approved', 'sending') and starts_at <= now() and ends_at > now()) then
    return;
  end if;
  -- At most one per 8 seconds per campaign, however often this is called.
  if exists (select 1 from email_campaign_queue where campaign = p_campaign and claimed_at > now() - interval '8 seconds') then
    return;
  end if;
  return query
    update email_campaign_queue q set status = 'sending', claimed_at = now()
     where q.id = (select id from email_campaign_queue
                    where campaign = p_campaign and status = 'queued' and send_after <= now()
                    order by send_after, id limit 1 for update skip locked)
    returning q.*;
end;
$$;
revoke all on function public.claim_campaign_email(text) from public, anon, authenticated;
grant execute on function public.claim_campaign_email(text) to service_role;

-- The cron tick: nothing (no HTTP call) unless a campaign may send right now or a follow-up report is due.
create or replace function private.trigger_campaign_sender()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare secret text; sender_url text;
begin
  if not exists (select 1 from public.email_campaigns where status in ('approved', 'sending') and starts_at <= now())
     and not exists (select 1 from public.email_campaigns where status in ('done', 'stopped') and followup_report_at is null and finished_at < now() - interval '48 hours') then
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
revoke all on function private.trigger_campaign_sender() from public, anon, authenticated;
grant execute on function private.trigger_campaign_sender() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '10 seconds') from cron.job where jobname = 'email-campaign-sender';
  end if;
end $$;

notify pgrst, 'reload schema';
