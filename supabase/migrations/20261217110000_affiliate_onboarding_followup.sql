-- Affiliate program, round 2 (owner, 2026-11-17): the creator code is a follow-up to "Where did you hear about Zyvo?"
-- (TikTok / YouTube / Instagram), and:
--   referrals.platform        the platform the new user picked (NULL: came by link without the survey, or another answer)
--   affiliate_rate_events     code checks per IP hash / user, so codes can't be guessed in bulk (affiliate_rate_ok)
--   affiliate_claim           + p_platform; the 5 credits are skipped (the referral still counts) when the same IP hash
--                             already got creator credits in the last p_ip_bonus_days days
-- Run after 20261217100000_affiliate_program.sql. Safe to run twice.
-- Rollback: supabase/rollbacks/20261217110000_affiliate_onboarding_followup_rollback.sql

alter table public.referrals add column if not exists platform text check (platform in ('tiktok', 'youtube', 'instagram'));

create table if not exists public.affiliate_rate_events (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists affiliate_rate_events_key_at on public.affiliate_rate_events (key, at desc);
create index if not exists affiliate_rate_events_at on public.affiliate_rate_events (at);
alter table public.affiliate_rate_events enable row level security;
revoke all on public.affiliate_rate_events from public, anon, authenticated;

-- true and counted when every key is under p_max in the last p_window_seconds; false (nothing counted) otherwise.
create or replace function public.affiliate_rate_ok(p_keys text[], p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  delete from affiliate_rate_events where at < now() - interval '1 day';
  foreach v_key in array p_keys loop
    continue when v_key is null;
    if (select count(*) from affiliate_rate_events e where e.key = v_key and e.at > now() - make_interval(secs => p_window_seconds)) >= p_max then
      return false;
    end if;
  end loop;
  insert into affiliate_rate_events (key) select u.x from unnest(p_keys) as u(x) where u.x is not null;
  return true;
end $$;

drop function if exists public.affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer);
create or replace function public.affiliate_claim(p_user_id uuid, p_code text, p_source text, p_ip_hash text, p_window_days integer,
  p_bonus_credits integer, p_link_bonus boolean, p_flag_same_ip boolean, p_max_per_ip integer, p_platform text, p_ip_bonus_days integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates; r referrals; v_created timestamptz; v_plan text; v_flag text; v_bonus boolean := false; v_n int; v_skip text;
begin
  if p_source not in ('link', 'code') then raise exception 'affiliate_claim: bad source'; end if;
  select * into r from referrals where referred_user_id = p_user_id;
  if found then
    return jsonb_build_object('result', 'already_attributed', 'same', (select lower(code) = lower(coalesce(p_code, '')) from affiliates where id = r.affiliate_id));
  end if;
  select * into a from affiliates where lower(code) = lower(coalesce(p_code, '')) and status = 'active';
  if not found then return jsonb_build_object('result', 'unknown_code'); end if;
  if a.user_id = p_user_id then return jsonb_build_object('result', 'self'); end if;
  select created_at, lower(coalesce(plan_code, 'free')) into v_created, v_plan from profiles where id = p_user_id;
  if v_created is null then return jsonb_build_object('result', 'no_profile'); end if;
  if v_created < now() - make_interval(days => p_window_days) then return jsonb_build_object('result', 'too_old'); end if;
  if v_plan not in ('free', '') or exists (select 1 from credit_grants where user_id = p_user_id and reason in ('topup', 'plan_renewal', 'plan_upgrade')) then
    return jsonb_build_object('result', 'already_paid');
  end if;

  if p_ip_hash is not null then
    if p_flag_same_ip and p_ip_hash = any(a.ip_hashes) then v_flag := 'same_ip_as_affiliate';
    else
      select count(*) into v_n from referrals where affiliate_id = a.id and ip_hash = p_ip_hash;
      if v_n >= p_max_per_ip then v_flag := 'many_signups_one_ip'; end if;
    end if;
  end if;

  begin
    insert into referrals (referred_user_id, affiliate_id, source, flagged, flag_reason, ip_hash, platform)
    values (p_user_id, a.id, p_source, v_flag is not null, v_flag, p_ip_hash,
            case when p_platform in ('tiktok', 'youtube', 'instagram') then p_platform end)
    returning * into r;
  exception when unique_violation then
    return jsonb_build_object('result', 'already_attributed');
  end;

  if v_flag is null and p_bonus_credits > 0 and (p_source = 'code' or p_link_bonus) then
    if p_ip_hash is not null and exists (select 1 from referrals where ip_hash = p_ip_hash and bonus_granted and id <> r.id
                                         and created_at > now() - make_interval(days => p_ip_bonus_days)) then
      v_skip := 'ip_recent';
    else
      v_bonus := grant_credits_once(p_user_id, p_bonus_credits, 'creator_code_bonus', 'creator_code_bonus:' || p_user_id::text);
      update referrals set bonus_granted = v_bonus where id = r.id;
    end if;
  end if;
  return jsonb_build_object('result', 'claimed', 'display_name', a.display_name, 'code', a.code, 'bonus', v_bonus,
    'bonus_credits', case when v_bonus then p_bonus_credits else 0 end, 'flagged', v_flag is not null, 'bonus_skipped', v_skip);
end $$;

revoke all on function public.affiliate_rate_ok(text[], integer, integer) from public, anon, authenticated;
grant execute on function public.affiliate_rate_ok(text[], integer, integer) to service_role;
revoke all on function public.affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer, text, integer) from public, anon, authenticated;
grant execute on function public.affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer, text, integer) to service_role;

notify pgrst, 'reload schema';
