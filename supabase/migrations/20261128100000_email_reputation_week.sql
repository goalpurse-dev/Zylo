-- The Gmail reputation week (owner, 2026-10-29): Day 4 landed in Gmail's spam.
--   1. The gate: anyone who got 2 marketing emails and opened none gets no marketing ("unengaged").
--   2. Seed copies: a campaign can name a seed address and time; the sender sends one copy of the
--      real email there (category "test") while the campaign still waits for the owner's "go".
--   3. The 12-hour open check: a campaign with min_open_rate whose opens are under it 12 hours after
--      its start stops every later day of the same series, and the owner is told.
--   4. The engaged group, best first, and filling a day's queue from it.

-- 1. The gate, unchanged except for the "unengaged" rule (marketing only).
create or replace function public.claim_email_send(p_email text, p_kind text, p_category text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_signed_up timestamptz;
  v_last_day int;
  v_id bigint;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_address');
  end if;
  if coalesce(btrim(p_kind), '') = '' or p_category is null or p_category not in ('marketing', 'account', 'test') then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;

  -- One claim at a time per address: two callers can't both count "0 so far".
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  if exists (select 1 from email_suppressions where email = v_email) then
    return jsonb_build_object('ok', false, 'reason', 'suppressed');
  end if;

  if p_category = 'marketing' then
    -- The newest ON profile with this address decides (there is normally one).
    select max(created_at) into v_signed_up
      from profiles where lower(btrim(email)) = v_email and email_updates is true;
    if v_signed_up is null then
      return jsonb_build_object('ok', false, 'reason', 'no_consent');
    end if;
    if v_signed_up > now() - interval '24 hours' then
      return jsonb_build_object('ok', false, 'reason', 'signed_up_today');
    end if;
    -- Owner, 2026-10-29: 2 marketing emails and not one opened → no marketing for now.
    if (select count(*) from email_sends where email = v_email and category = 'marketing') >= 2
       and not exists (select 1 from email_events where email = v_email and type = 'email.opened') then
      return jsonb_build_object('ok', false, 'reason', 'unengaged');
    end if;
  end if;

  if exists (select 1 from email_sends where email = v_email and kind = p_kind) then
    return jsonb_build_object('ok', false, 'reason', 'already_sent');
  end if;

  -- Each category has its own count. The ceilings are constants on purpose: a caller cannot raise them.
  select count(*) into v_last_day
    from email_sends
   where email = v_email
     and category = p_category
     and sent_at > now() - interval '24 hours';
  if v_last_day >= (case p_category when 'marketing' then 1 when 'account' then 10 else 20 end) then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;

  insert into email_sends (email, kind, category) values (v_email, p_kind, p_category) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$function$;

create index if not exists email_events_email_type_idx on public.email_events (email, type);

-- 2 and 3. Seed copies and the 12-hour open check.
alter table public.email_campaigns
  add column if not exists seed_to text,
  add column if not exists seed_at timestamptz,
  add column if not exists seed_sent_at timestamptz,
  add column if not exists min_open_rate numeric,
  add column if not exists open_check_at timestamptz;

-- The cron call also runs when a seed copy is due or a 12-hour open check is due.
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
     and not exists (select 1 from public.email_campaigns where status = 'waiting' and seed_to is not null and seed_sent_at is null and seed_at <= now())
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

-- A day moved by the Runware/voice start check takes its seed time along.
create or replace function public.postpone_campaigns(p_from text)
returns table(id text, starts_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare v_from timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign-postpone', 0));
  select c.starts_at into v_from from email_campaigns c
   where c.id = p_from and c.status in ('approved', 'waiting')
     and not exists (select 1 from email_campaign_queue q where q.campaign = c.id and q.status in ('sending', 'sent'));
  if v_from is null then
    return;  -- already moved by another call, started, or finished: nothing to do
  end if;
  return query
  with moving as (
    select c.id from email_campaigns c
     where c.status in ('approved', 'waiting') and c.starts_at >= v_from
       and not exists (select 1 from email_campaign_queue q where q.campaign = c.id and q.status in ('sending', 'sent'))
  ), q as (
    update email_campaign_queue q set send_after = q.send_after + interval '24 hours'
     where q.campaign in (select m.id from moving m) and q.status = 'queued'
     returning q.campaign
  )
  update email_campaigns c set starts_at = c.starts_at + interval '24 hours', ends_at = c.ends_at + interval '24 hours',
         seed_at = c.seed_at + interval '24 hours'
   where c.id in (select m.id from moving m)
  returning c.id, c.starts_at;
end;
$function$;

-- 4. The engaged group (owner, 2026-10-29), product updates ON, not suppressed, not "unengaged",
-- best first: tier 1 opened an email of warm-up days 2–4 (most opens, then latest open first);
-- tier 2 used Zyvo in the last 30 days: logged in or made something (latest first);
-- tier 3 signed up in the last 14 days (newest first).
create or replace function public.engaged_group()
returns table(profile_id uuid, email text, tier int, last_seen timestamptz, signed_up timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select p.id, lower(btrim(p.email)) email, p.created_at from profiles p
     where p.email_updates is true and p.email like '%@%'
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
  ),
  marketing as (select email, count(*) n from email_sends where category = 'marketing' group by email),
  ever_opened as (select distinct email from email_events where type = 'email.opened'),
  opened as (
    select email, count(*) opens, max(created_at) last_open from email_events
     where type = 'email.opened' and campaign in ('warmup_day2', 'warmup_day3', 'warmup_day4') group by email
  ),
  used as (
    select user_id, max(t) last_used from (
      select id user_id, last_sign_in_at t from auth.users where last_sign_in_at > now() - interval '30 days'
      union all select user_id, created_at from generation_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from fruit_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from blocky_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from thirty_days_credit_ledger where created_at > now() - interval '30 days'
      union all select user_id, created_at from long_form_projects where created_at > now() - interval '30 days'
      union all select user_id, created_at from creations where created_at > now() - interval '30 days'
    ) x group by user_id
  ),
  ranked as (
    select o.id, o.email, o.created_at,
           case when op.email is not null then 1 when u.user_id is not null then 2 when o.created_at > now() - interval '14 days' then 3 end tier,
           op.opens, coalesce(op.last_open, u.last_used, o.created_at) last_seen
      from on_people o
      left join opened op on op.email = o.email
      left join used u on u.user_id = o.id
     where not (coalesce((select m.n from marketing m where m.email = o.email), 0) >= 2
                and not exists (select 1 from ever_opened e where e.email = o.email))
  )
  select distinct on (email) id, email, tier, last_seen, created_at from ranked where tier is not null
  order by email, tier, last_seen desc;
$function$;

-- Put the next p_count best people of the engaged group who are not yet in any campaign of the
-- same series (same id without its trailing number, e.g. "checkin_day") into p_campaign's queue,
-- spread evenly over its window. Anyone who signed up less than 24 hours before the window is left
-- for a later day (the gate would refuse them). → how many were queued.
create or replace function public.fill_campaign_from_engaged(p_campaign text, p_count int)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c email_campaigns%rowtype;
  v_series text := regexp_replace(p_campaign, '[0-9]+$', '');
  v_n int;
begin
  select * into c from email_campaigns where id = p_campaign;
  if c.id is null or c.status not in ('waiting', 'approved') then
    raise exception 'campaign % is missing or already running/finished', p_campaign;
  end if;
  with pick as (
    select g.profile_id, g.email, row_number() over (order by g.tier, g.last_seen desc, g.email) rn
      from engaged_group() g
     where g.signed_up <= c.starts_at - interval '24 hours'
       and not exists (select 1 from email_campaign_queue q
                        where q.email = g.email and q.campaign like v_series || '%' and q.status <> 'skipped')
       and not exists (select 1 from email_campaign_queue q where q.campaign = p_campaign and (q.email = g.email or q.profile_id = g.profile_id))
     order by g.tier, g.last_seen desc, g.email
     limit greatest(p_count - (select count(*) from email_campaign_queue where campaign = p_campaign), 0)
  ), ins as (
    insert into email_campaign_queue (campaign, profile_id, email, send_after, status)
    select p_campaign, profile_id, email,
           c.starts_at + ((c.ends_at - interval '15 minutes') - c.starts_at) * ((rn - 1)::numeric / greatest((select count(*) from pick), 1)),
           'queued'
      from pick
    returning 1
  )
  select count(*) into v_n from ins;
  update email_campaigns set planned = (select count(*) from email_campaign_queue where campaign = p_campaign) where id = p_campaign;
  return v_n;
end;
$function$;

revoke all on function public.engaged_group() from public, anon, authenticated;
revoke all on function public.fill_campaign_from_engaged(text, int) from public, anon, authenticated;
