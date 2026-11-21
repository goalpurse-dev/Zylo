-- "You can try it free now" (owner, 2026-11-21): one email Saturday 21 Nov 16:00–21:00 Finnish (14–19 UTC) from
-- Niko <niko@tryzyvo.com>, plain, one link (the free In This Town: the free kit's template page) plus the unsubscribe,
-- the deal line while the launch deal runs. Up to 3,000 people, in this order (fewer is fine):
--   Group 1: really opened an In This Town launch email (town_launch1, town_launch2) or the pre-hype (town_early1)
--            (first open more than 60 s after delivery), most recent open first.
--   Group 2: came back to Zyvo after a campaign email since 4 Nov, most recent first.
--   Group 3: really opened any of our emails since 4 Nov, most recent open first.
--   Group 4: everyone left who never had a marketing email, newest sign-ups first.
-- Rules for all: email updates ON, not blocked, not "unengaged" (2 marketing emails and no open: the rule is back ON
-- for all marketing, below), nobody emailed (any email) in the 24 hours before the window ends, nobody who signed up
-- in the 24 hours before the window starts (the gate would skip them), nobody gets this email twice, not the owner's or
-- seed addresses. Stop rules: campaigns.js (as before). Created 'waiting'.

-- 1. The owner, 2026-11-21: the "2 emails, no open" (unengaged) rule back ON in the gate every email passes, for all
--    future sends (it was switched off on 2026-11-19). Everything else in the gate is unchanged.
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
    -- (Off 2026-11-19 to 2026-11-21; back ON by the owner on 2026-11-21 for all future sends.)
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

-- 2. The pick.
create or replace function public.town_free1_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
returns table (profile_id uuid, email text, grp int, last_seen timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select p.id, lower(btrim(p.email)) email, p.created_at from profiles p
     where p.email_updates is true and p.email like '%@%'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and p.created_at <= p_starts - interval '24 hours'
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.kind = p_campaign)
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where lower(v.email) = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open_rows as (
    select d.email, d.resend_id, o.t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '60 seconds'
  ), real_open as (
    select email, max(t) t from real_open_rows group by email
  ), town_open as (
    select r.email, max(r.t) t from real_open_rows r
      join email_campaign_queue q on q.resend_id = r.resend_id and q.campaign in ('town_early1', 'town_launch1', 'town_launch2')
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
         case when town_t is not null then 1 when cb_t is not null then 2 when ro_t is not null then 3 else 4 end,
         case when town_t is not null then town_t when cb_t is not null then cb_t when ro_t is not null then ro_t else created_at end
    from g
   where town_t is not null or cb_t is not null or ro_t is not null or mk = 0;
$function$;
revoke all on function public.town_free1_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

-- (Re)pick: while nothing has gone out, the queue is rebuilt from scratch.
create or replace function public.fill_town_free1(p_campaign text, p_count int)
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
    select * from public.town_free1_candidates(p_campaign, c.starts_at, c.ends_at) t
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
revoke all on function public.fill_town_free1(text, int) from public, anon, authenticated;

-- Starts at 16:00 Finnish, or a few minutes from now if that has passed (the email was set up at ~16:00).
insert into public.email_campaigns (id, status, planned, starts_at, ends_at, depends_on) values
  ('town_free1', 'waiting', 0, greatest(timestamptz '2026-11-21 14:00+00', now() + interval '10 minutes'), timestamptz '2026-11-21 19:00+00', null)
on conflict (id) do nothing;

select public.fill_town_free1('town_free1', 3000);

-- Only today: at 21:05 Finnish, a town_free1 that was moved to another day is stopped and its queue dropped.
select cron.schedule('town-free1-only-today', '5 19 21 11 *', $job$
update public.email_campaign_queue set status = 'skipped', reason = 'window_closed'
 where campaign = 'town_free1' and status = 'queued'
   and exists (select 1 from public.email_campaigns where id = 'town_free1' and starts_at > timestamptz '2026-11-21 19:00+00');
update public.email_campaigns set status = 'stopped', stop_reason = 'only Saturday 21 Nov (owner): it was moved to another day', finished_at = now(), followup_report_at = now()
 where id = 'town_free1' and status in ('waiting', 'approved') and starts_at > timestamptz '2026-11-21 19:00+00';
select cron.unschedule('town-free1-only-today');
$job$);
