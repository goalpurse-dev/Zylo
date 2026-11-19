-- Owner, 2026-11-19 00:55: town_launch2 to 2,000 people with email updates ON, and the "2 marketing emails, no open"
-- (unengaged) rule switched off for ALL marketing email ("Switch the rule off for all"). Every other rule stays:
-- updates ON, not blocked, nobody who got town_launch1, nobody emailed in the 24 h before the window ends, once each.

-- 1. The gate every email passes (claim_email_send): the live version with only the unengaged rule taken out.
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
    -- The 2-emails-no-open ("unengaged") rule of 2026-10-29 was switched off by the owner on 2026-11-19.
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

-- 2. town_launch2's pick without that rule: the owner's 347 first (groups 1–3 as before), then the people the rule used
--    to block, fewest marketing emails first (group 4 = 2 emails, 5 = 3, 6 = 4 or more), most recently seen first.
create or replace function public.town_launch2_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
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
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'town_launch%'
                          and q.campaign <> p_campaign and q.status in ('sent', 'sending', 'queued'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open as (
    select d.email, max(o.t) t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '60 seconds'
     group by d.email
  ), g as (
    select o.id, o.email, o.created_at, ro.t ro_t,
           (select count(*) from email_sends e where e.email = o.email and e.category = 'marketing') mk,
           exists (select 1 from email_events v where lower(v.email) = o.email and v.type = 'email.opened') opened_ever,
           greatest(u.last_sign_in_at, u.created_at,
                    (select max(greatest(a.created_at, a.updated_at, a.refreshed_at)) from auth.sessions a where a.user_id = o.id)) broad_seen
      from on_people o
      join auth.users u on u.id = o.id
      left join real_open ro on ro.email = o.email
  )
  select id, email,
         case when mk = 0 then 1 when ro_t is not null then 2
              when not (mk >= 2 and not opened_ever) then 3
              else 3 + least(mk, 4)::int - 1 end,
         case when mk = 0 then created_at when ro_t is not null then ro_t else broad_seen end
    from g;
$function$;
revoke all on function public.town_launch2_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

-- 3. Re-pick to 2,000 (allowed while nothing has gone out; fill_town_launch2 refuses once anything did).
select public.fill_town_launch2('town_launch2', 2000);
