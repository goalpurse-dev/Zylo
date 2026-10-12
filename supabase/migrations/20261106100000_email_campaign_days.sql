-- Scheduled campaigns, second step (2026-10-12, warm-up days 2 and 3):
--   depends_on          a campaign that may only run if the one before it went well
--                       (0 spam complaints, bounces under 2%): checked by campaign-sender
--   followup_report_at  the owner gets the numbers again 12 hours after a campaign ends,
--                       when the opens, late bounces and unsubscribes are in
--   pace                day 3 is 500 emails in 7 hours, one every 50 seconds: the cron job
--                       now runs every 30 seconds and a campaign may send one email per
--                       25 seconds at most (it was one a minute, which fits 420 in 7 hours)
alter table public.email_campaigns add column if not exists depends_on text references public.email_campaigns(id);
alter table public.email_campaigns add column if not exists followup_report_at timestamptz;
-- Campaigns that ended before this existed get no follow-up (the owner has their numbers).
update public.email_campaigns set followup_report_at = now() where status in ('done', 'stopped') and followup_report_at is null;

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
  -- At most one per 25 seconds per campaign, however often this is called.
  if exists (select 1 from email_campaign_queue where campaign = p_campaign and claimed_at > now() - interval '25 seconds') then
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
     and not exists (select 1 from public.email_campaigns where status in ('done', 'stopped') and followup_report_at is null and finished_at < now() - interval '12 hours') then
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
    timeout_milliseconds := 25000
  );
end;
$function$;
revoke all on function private.trigger_campaign_sender() from public, anon, authenticated;
grant execute on function private.trigger_campaign_sender() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '30 seconds') from cron.job where jobname = 'email-campaign-sender';
  end if;
end $$;

notify pgrst, 'reload schema';
