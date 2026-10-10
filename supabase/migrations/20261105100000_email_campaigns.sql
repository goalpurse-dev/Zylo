-- Scheduled campaigns (2026-10-10, the warm-up): a fixed list of people, each
-- with the minute their email may go, sent one at a time by the campaign-sender
-- function, which a cron job calls every minute. Why here and not a script on a
-- laptop: a warm-up day is 200 emails spread over 7 hours, it must stop by
-- itself on bounces or a complaint, and neither may depend on a terminal that
-- stays open.
--   email_campaigns       one row per campaign: is it allowed to send, did it stop, why
--   email_campaign_queue  who gets it and when; what happened to each one
--   email_events          what Resend reported about campaign emails (delivered, bounced, complained)
-- Every send still passes the email gate (claim_email_send): this adds a schedule, not a way around it.

create table if not exists public.email_campaigns (
  id             text primary key,                 -- a key of CAMPAIGNS in _shared/campaigns.js
  -- waiting: queued, NOT allowed to send (the owner has not said go) · approved: starts at starts_at
  -- sending · done · stopped (a stop rule, or by hand; see stop_reason)
  status         text not null default 'waiting' check (status in ('waiting', 'approved', 'sending', 'done', 'stopped')),
  planned        integer not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,             -- an email still waiting then is dropped, never sent late
  stop_reason    text,
  finished_at    timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;       -- no policies: service role only

create table if not exists public.email_campaign_queue (
  id         bigint generated always as identity primary key,
  campaign   text not null references public.email_campaigns(id) on delete cascade,
  profile_id uuid not null,
  email      text not null,                        -- lower-cased; must still be the profile's address at send time
  send_after timestamptz not null,
  status     text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'skipped', 'failed')),
  reason     text,                                 -- why skipped or failed
  claimed_at timestamptz,                          -- when the sender took it (status 'sending')
  resend_id  text,
  sent_at    timestamptz,
  unique (campaign, profile_id),
  unique (campaign, email)
);
alter table public.email_campaign_queue enable row level security;  -- no policies: service role only
create index if not exists email_campaign_queue_due_idx on public.email_campaign_queue (campaign, status, send_after);
create index if not exists email_campaign_queue_resend_idx on public.email_campaign_queue (resend_id);

create table if not exists public.email_events (
  id         bigint generated always as identity primary key,
  resend_id  text not null,
  type       text not null,                        -- email.delivered, email.bounced, email.complained, ...
  email      text,
  campaign   text,
  detail     text,                                 -- for a bounce: "Permanent/General", "Transient/MailboxFull", ...
  created_at timestamptz not null default now(),
  unique (resend_id, type)
);
alter table public.email_events enable row level security;          -- no policies: service role only
create index if not exists email_events_campaign_idx on public.email_events (campaign, type);

-- The next email of a campaign that is due, taken by exactly one caller.
-- At most one per 45 seconds per campaign, however often this is called: a
-- double cron tick or a hand-made request cannot turn the schedule into a burst.
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
  if exists (select 1 from email_campaign_queue where campaign = p_campaign and claimed_at > now() - interval '45 seconds') then
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

-- The cron tick. Does nothing (no HTTP call at all) unless a campaign is allowed
-- to send right now. The function's address and its secret live in the vault
-- (campaign_sender_url, campaign_sender_secret); until both are set this does nothing.
create schema if not exists private;
create or replace function private.trigger_campaign_sender()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare secret text; sender_url text;
begin
  if not exists (select 1 from public.email_campaigns where status in ('approved', 'sending') and starts_at <= now()) then
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
    timeout_milliseconds := 30000
  );
end;
$function$;
revoke all on function private.trigger_campaign_sender() from public, anon, authenticated;
grant execute on function private.trigger_campaign_sender() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'email-campaign-sender';
    perform cron.schedule('email-campaign-sender', '* * * * *', 'select private.trigger_campaign_sender();');
  end if;
end $$;

notify pgrst, 'reload schema';
