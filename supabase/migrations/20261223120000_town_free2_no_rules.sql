-- Owner, 2026-11-23 16:07 Finnish: "make the 4000 people send email start at 16.30 without any rules".
-- town_free2 only (every other email keeps every rule): starts 16:30 Finnish (14:30 UTC), ends 21:00 (19:00 UTC),
-- 4,000 people, approved now (no longer waits for paid In This Town videos to be back on).
-- Taken out for this email: the "2 emails, no open" (unengaged) rule, "nobody emailed in the last 24 hours",
-- "signed up in the last 24 hours", the one-marketing-email-a-day limit.
-- Kept (the law and the sender's safety, not the owner's choice rules): email updates ON, not unsubscribed/bounced/
-- complained (suppressed), the unsubscribe link, once per person, not the owner's or seed addresses, and the stop
-- rules (a spam complaint or real bounces over 2% stop it).
-- Order: groups 1-4 as before, then group 5: everyone else with email updates ON, newest sign-ups first.
-- Pace: up to one every 3 seconds for town_free2 (every 8 s for all others), the sender tick every 3 s until 21:10
-- Finnish, then back to every 10 s.

-- 1. The gate: the live version; for kind 'campaign:town_free2' only, the signed-up-today, unengaged and daily-limit
--    checks are skipped.
CREATE OR REPLACE FUNCTION public.claim_email_send(p_email text, p_kind text, p_category text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_signed_up timestamptz;
  v_last_day int;
  v_id bigint;
  v_no_rules boolean := (p_kind = 'campaign:town_free2');  -- owner, 2026-11-23: this one email without the rules
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
    if not v_no_rules and v_signed_up > now() - interval '24 hours' then
      return jsonb_build_object('ok', false, 'reason', 'signed_up_today');
    end if;
    -- Owner, 2026-10-29: 2 marketing emails and not one opened → no marketing for now.
    -- (Off 2026-11-19 to 2026-11-21; back ON by the owner on 2026-11-21 for all future sends; off for town_free2 only.)
    if not v_no_rules
       and (select count(*) from email_sends where email = v_email and category = 'marketing') >= 2
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
  if not v_no_rules and v_last_day >= (case p_category when 'marketing' then 1 when 'account' then 10 else 20 end) then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;

  insert into email_sends (email, kind, category) values (v_email, p_kind, p_category) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$function$;

-- 2. The pace: town_free2 one every 3 seconds, every other campaign one every 8 seconds (as before).
CREATE OR REPLACE FUNCTION public.claim_campaign_email(p_campaign text)
 RETURNS SETOF email_campaign_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign:' || p_campaign, 0));
  if not exists (select 1 from email_campaigns where id = p_campaign and status in ('approved', 'sending') and starts_at <= now() and ends_at > now()) then
    return;
  end if;
  -- At most one per 8 seconds per campaign (town_free2: one per 3 seconds, owner 2026-11-23), however often this is called.
  if exists (select 1 from email_campaign_queue where campaign = p_campaign
               and claimed_at > now() - (case when p_campaign = 'town_free2' then interval '3 seconds' else interval '8 seconds' end)) then
    return;
  end if;
  return query
    update email_campaign_queue q set status = 'sending', claimed_at = now()
     where q.id = (select id from email_campaign_queue
                    where campaign = p_campaign and status = 'queued' and send_after <= now()
                    order by send_after, id limit 1 for update skip locked)
    returning q.*;
end;
$function$;

-- 3. The pick without the rules: updates ON, not suppressed, real address, not the owner's/seeds, nobody twice.
create or replace function public.town_free2_all_candidates(p_campaign text)
returns table (profile_id uuid, email text, grp int, last_seen timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select distinct on (lower(btrim(p.email))) p.id, lower(btrim(p.email)) email, p.created_at from profiles p
     where p.email_updates is true and p.email like '%@%'
       and lower(btrim(p.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.kind = 'campaign:' || p_campaign)
     order by lower(btrim(p.email)), p.created_at desc
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open_rows as (
    select d.email, d.resend_id, o.t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '30 seconds'
  ), real_open as (
    select email, max(t) t from real_open_rows group by email
  ), town_open as (
    select r.email, max(r.t) t from real_open_rows r
      join email_campaign_queue q on q.resend_id = r.resend_id and q.campaign in ('town_early1', 'town_launch1', 'town_launch2', 'town_free1')
     group by r.email
  ), sent_q as (
    select profile_id, min(sent_at) sent_at from email_campaign_queue
     where status = 'sent' and sent_at >= timestamptz '2026-11-04 00:00+02' group by profile_id
  ), came_back as (
    select s.profile_id, max(x.t) t from sent_q s
      join lateral (
        select u.last_sign_in_at t from auth.users u where u.id = s.profile_id
        union all select greatest(a.created_at, a.updated_at, a.refreshed_at) from auth.sessions a where a.user_id = s.profile_id
        union all select f.created_at from funnel_events f where f.user_id = s.profile_id
        union all select c.created_at from creations c where c.user_id = s.profile_id
        union all select l.created_at from long_form_projects l where l.user_id = s.profile_id
        union all select g.created_at from generation_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from fruit_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from blocky_credit_ledger g where g.user_id = s.profile_id
        union all select b.created_at from blocky_stories b where b.user_id = s.profile_id
        union all select b.created_at from blocky_ai_calls b where b.user_id = s.profile_id
        union all select b.created_at from blocky_worlds_events b where b.user_id = s.profile_id
        union all select b.created_at from blocky_worlds_drafts b where b.user_id = s.profile_id
        union all select b.created_at from blocky_worlds_runs b where b.user_id = s.profile_id
        union all select k.created_at from zyvo_kit_downloads k where k.user_id = s.profile_id
      ) x on x.t > s.sent_at
     group by s.profile_id
  ), g as (
    select o.id, o.email, o.created_at, tt.t town_t, cb.t cb_t, ro.t ro_t,
           (select count(*) from email_sends e where e.email = o.email and e.category = 'marketing') mk
      from on_people o
      left join town_open tt on tt.email = o.email
      left join came_back cb on cb.profile_id = o.id
      left join real_open ro on ro.email = o.email
  )
  select id, email,
         case when town_t is not null then 1 when cb_t is not null then 2 when ro_t is not null then 3 when mk = 0 then 4 else 5 end,
         case when town_t is not null then town_t when cb_t is not null then cb_t when ro_t is not null then ro_t else created_at end
    from g;
$function$;
revoke all on function public.town_free2_all_candidates(text) from public, anon, authenticated;

-- 4. Re-pick (while nothing has gone out) from the no-rules pick.
create or replace function public.fill_town_free2(p_campaign text, p_count int)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c email_campaigns%rowtype;
  v_n int;
begin
  select * into c from email_campaigns where id = p_campaign;
  if c.id is null or c.status not in ('waiting', 'approved') then
    return 0;
  end if;
  if exists (select 1 from email_campaign_queue where campaign = p_campaign and status <> 'queued') then
    return 0;  -- something already went out: never re-pick
  end if;
  delete from email_campaign_queue where campaign = p_campaign and status = 'queued';
  with pick as (
    select * from public.town_free2_all_candidates(p_campaign) t
     order by t.grp, t.last_seen desc nulls last, t.email
     limit p_count
  ), ordered as (
    select *, row_number() over (order by grp, last_seen desc nulls last, email) rn, count(*) over () total from pick
  ), ins as (
    insert into email_campaign_queue (campaign, profile_id, email, send_after, status)
    select p_campaign, profile_id, email,
           c.starts_at + ((c.ends_at - interval '15 minutes') - c.starts_at) * ((rn - 1)::numeric / greatest(total, 1)),
           'queued'
      from ordered
    on conflict (campaign, profile_id) do nothing
    returning 1
  )
  select count(*) into v_n from ins;
  update email_campaigns set planned = (select count(*) from email_campaign_queue where campaign = p_campaign) where id = p_campaign;
  return v_n;
end;
$function$;
revoke all on function public.fill_town_free2(text, int) from public, anon, authenticated;

-- 5. 16:30 Finnish, 4,000, approved (only if nothing went out yet).
update public.email_campaigns set starts_at = timestamptz '2026-11-23 14:30+00'
 where id = 'town_free2' and status = 'waiting'
   and not exists (select 1 from public.email_campaign_queue where campaign = 'town_free2' and status <> 'queued');
select public.fill_town_free2('town_free2', 4000);
update public.email_campaigns set status = 'approved'
 where id = 'town_free2' and status = 'waiting' and starts_at = timestamptz '2026-11-23 14:30+00';

-- 6. The sender tick every 3 seconds today; back to every 10 seconds at 21:10 Finnish.
select cron.alter_job(jobid, schedule := '3 seconds') from cron.job where jobname = 'email-campaign-sender';
select cron.schedule('town-free2-pace-back', '10 19 23 11 *', $job$
select cron.alter_job(jobid, schedule := '10 seconds') from cron.job where jobname = 'email-campaign-sender';
select cron.unschedule('town-free2-pace-back');
$job$);

-- 7. The seeds now: one copy each to the owner's two inboxes with the real subject (the send is approved).
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_url' limit 1),
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_sender_secret' limit 1)),
  body := jsonb_build_object('action', 'test', 'campaign', 'town_free2', 'to', a, 'asSent', true),
  timeout_milliseconds := 20000)
from unnest(array['zzyloai@gmail.com', 'rakettileague@gmail.com']) a
where exists (select 1 from public.email_campaigns where id = 'town_free2' and status in ('approved', 'sending'));
