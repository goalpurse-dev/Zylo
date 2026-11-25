-- Rewards (owner, 2026-11-25): paying users earn free credits. Numbers: supabase/functions/_shared/rewards/config.js
-- (the callers pass them in). Separate from the affiliate program, but one referrer per new user: an affiliate
-- referral always wins over an invite.
--   reward_submissions  "Made with Zyvo" video links; reviewed by hand; a re-check pays only the difference
--   invite_codes        each user's invite code (?invite=CODE)
--   invites             who invited whom; rewarded on the friend's FIRST purchase; refunds take unspent credits back
-- Server only: RLS on, no policies (rewards-api and stripe-webhook use the service role).
-- Run after the affiliate migrations (20261217100000…120000). Rollback: supabase/rollbacks/20261218100000_rewards_rollback.sql

create table if not exists public.reward_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  url           text not null check (char_length(url) <= 300),
  url_key       text not null unique,                     -- platform + video id: the same video only once, by anyone
  platform      text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  claimed_views bigint check (claimed_views >= 0),
  status        text not null default 'in_review' check (status in ('in_review', 'approved', 'rejected')),
  tier_views    bigint,                                   -- the highest tier approved so far
  credits_paid  integer not null default 0,
  reject_reason text check (char_length(reject_reason) <= 300),
  recheck       boolean not null default false,           -- in review again after an approval or a rejection
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   text
);
create index if not exists reward_submissions_user_time on public.reward_submissions (user_id, created_at desc);
create index if not exists reward_submissions_queue on public.reward_submissions (updated_at) where status = 'in_review';

create table if not exists public.invite_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id              uuid primary key default gen_random_uuid(),
  invited_user_id uuid not null unique references auth.users(id) on delete cascade,   -- one inviter per new user
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  code            text,
  ip_hash         text,
  status          text not null default 'joined' check (status in ('joined', 'rewarded', 'no_credit', 'affiliate', 'cancelled', 'reversed')),
  reason          text,
  payment_id      text,
  payment_intent  text,
  inviter_credits integer not null default 0,
  friend_credits  integer not null default 0,
  created_at      timestamptz not null default now(),
  rewarded_at     timestamptz,
  closed_at       timestamptz
);
create index if not exists invites_inviter_time on public.invites (inviter_user_id, created_at desc);
create index if not exists invites_payment on public.invites (payment_id) where payment_id is not null;
create index if not exists invites_intent on public.invites (payment_intent) where payment_intent is not null;

alter table public.reward_submissions enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invites enable row level security;
revoke all on public.reward_submissions, public.invite_codes, public.invites from public, anon, authenticated;

-- ---------- videos ----------
create or replace function public.rewards_submit(p_user_id uuid, p_url text, p_url_key text, p_platform text, p_views bigint, p_week_limit integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; s reward_submissions;
begin
  select count(*) into v_n from reward_submissions where user_id = p_user_id and created_at > now() - interval '7 days';
  if v_n >= p_week_limit then return jsonb_build_object('result', 'weekly_limit'); end if;
  begin
    insert into reward_submissions (user_id, url, url_key, platform, claimed_views)
    values (p_user_id, p_url, p_url_key, p_platform, case when p_views >= 0 then p_views end) returning * into s;
  exception when unique_violation then
    return jsonb_build_object('result', 'duplicate');
  end;
  return jsonb_build_object('result', 'submitted', 'id', s.id);
end $$;

-- "Re-check views": back in the queue (once a day), with the views they see now.
create or replace function public.rewards_recheck(p_user_id uuid, p_id uuid, p_views bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s reward_submissions;
begin
  select * into s from reward_submissions where id = p_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if s.status = 'in_review' then return jsonb_build_object('result', 'in_review'); end if;
  if s.reviewed_at > now() - interval '1 day' then return jsonb_build_object('result', 'too_soon'); end if;
  update reward_submissions set status = 'in_review', recheck = true, updated_at = now(),
    claimed_views = case when p_views >= 0 then p_views else claimed_views end
  where id = s.id;
  return jsonb_build_object('result', 'requeued');
end $$;

-- The admin's decision. Approve pays the chosen tier minus what this video already got (once per tier).
create or replace function public.rewards_review(p_id uuid, p_approve boolean, p_tier_views bigint, p_tier_credits integer, p_reason text, p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s reward_submissions; v_diff int := 0; v_granted boolean := false;
begin
  select * into s from reward_submissions where id = p_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if s.status <> 'in_review' then return jsonb_build_object('result', 'not_in_review'); end if;
  if p_approve then
    v_diff := greatest(0, coalesce(p_tier_credits, 0) - s.credits_paid);
    if v_diff > 0 then
      v_granted := grant_credits_once(s.user_id, v_diff, 'rewards_video', 'rewards_video:' || s.id::text || ':' || p_tier_views::text);
      if not v_granted then v_diff := 0; end if;
    end if;
    update reward_submissions set status = 'approved', recheck = false, reject_reason = null,
      tier_views = greatest(coalesce(tier_views, 0), p_tier_views), credits_paid = credits_paid + v_diff,
      reviewed_at = now(), reviewed_by = left(p_admin, 200), updated_at = now()
    where id = s.id;
    return jsonb_build_object('result', 'approved', 'credits_added', v_diff);
  end if;
  update reward_submissions set status = 'rejected', recheck = false, reject_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Not eligible'), 300),
    reviewed_at = now(), reviewed_by = left(p_admin, 200), updated_at = now()
  where id = s.id;
  return jsonb_build_object('result', 'rejected');
end $$;

-- ---------- invites ----------
-- The user's code; p_new_code is used only when they have none (null back = that code was taken: try another).
create or replace function public.rewards_invite_code(p_user_id uuid, p_new_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select code into v from invite_codes where user_id = p_user_id;
  if v is not null then return v; end if;
  begin
    insert into invite_codes (user_id, code) values (p_user_id, p_new_code) on conflict (user_id) do nothing;
  exception when unique_violation then
    return null;
  end;
  select code into v from invite_codes where user_id = p_user_id;
  return v;
end $$;

create or replace function public.rewards_claim_invite(p_user_id uuid, p_code text, p_ip_hash text, p_window_days integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inviter uuid; v_aff text; v_created timestamptz; v_plan text;
begin
  if exists (select 1 from invites where invited_user_id = p_user_id) then return jsonb_build_object('result', 'already_invited'); end if;
  if exists (select 1 from referrals where referred_user_id = p_user_id) then return jsonb_build_object('result', 'affiliate_referred'); end if;
  select user_id into v_inviter from invite_codes where code = upper(coalesce(p_code, ''));
  if v_inviter is null then return jsonb_build_object('result', 'unknown_code'); end if;
  if v_inviter = p_user_id then return jsonb_build_object('result', 'self'); end if;
  -- an affiliate's invite link IS their affiliate link: the caller claims that code instead
  select code into v_aff from affiliates where user_id = v_inviter and status = 'active';
  if v_aff is not null then return jsonb_build_object('result', 'use_affiliate', 'code', v_aff); end if;
  select created_at, lower(coalesce(plan_code, 'free')) into v_created, v_plan from profiles where id = p_user_id;
  if v_created is null then return jsonb_build_object('result', 'no_profile'); end if;
  if v_created < now() - make_interval(days => p_window_days) then return jsonb_build_object('result', 'too_old'); end if;
  if v_plan not in ('free', '') or exists (select 1 from credit_grants where user_id = p_user_id and reason in ('topup', 'plan_renewal', 'plan_upgrade')) then
    return jsonb_build_object('result', 'already_paid');
  end if;
  begin
    insert into invites (invited_user_id, inviter_user_id, code, ip_hash) values (p_user_id, v_inviter, upper(p_code), p_ip_hash);
  exception when unique_violation then
    return jsonb_build_object('result', 'already_invited');
  end;
  return jsonb_build_object('result', 'joined');
end $$;

-- The webhook: the invited friend's FIRST purchase → both rewarded (or a reason why not). Once: the row leaves 'joined'.
create or replace function public.rewards_record_payment(p_user_id uuid, p_payment_id text, p_payment_intent text, p_inviter_credits integer,
  p_friend_credits integer, p_max_per_month integer, p_ip_days integer, p_paid_plans text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare i invites; v_plan text; v_n int; v_reason text;
begin
  select * into i from invites where invited_user_id = p_user_id for update;
  if not found then return jsonb_build_object('result', 'not_invited'); end if;
  if i.status <> 'joined' then return jsonb_build_object('result', 'done', 'status', i.status); end if;
  if exists (select 1 from referrals where referred_user_id = p_user_id) then
    update invites set status = 'affiliate', reason = 'an affiliate referred this user', payment_id = p_payment_id, closed_at = now() where id = i.id;
    return jsonb_build_object('result', 'affiliate');
  end if;
  select lower(coalesce(plan_code, 'free')) into v_plan from profiles where id = i.inviter_user_id;
  if not (coalesce(v_plan, 'free') = any(p_paid_plans)) then v_reason := 'inviter_not_paid';
  else
    select count(*) into v_n from invites where inviter_user_id = i.inviter_user_id and status = 'rewarded' and rewarded_at >= date_trunc('month', now());
    if v_n >= p_max_per_month then v_reason := 'monthly_cap';
    elsif i.ip_hash is not null and exists (select 1 from invites where ip_hash = i.ip_hash and id <> i.id and friend_credits > 0
                                             and rewarded_at > now() - make_interval(days => p_ip_days)) then v_reason := 'ip_recent';
    end if;
  end if;
  if v_reason is not null then
    update invites set status = 'no_credit', reason = v_reason, payment_id = p_payment_id, payment_intent = nullif(p_payment_intent, ''), closed_at = now() where id = i.id;
    return jsonb_build_object('result', 'no_credit', 'reason', v_reason);
  end if;
  perform grant_credits_once(i.inviter_user_id, p_inviter_credits, 'invite_reward', 'invite_inviter:' || i.id::text);
  perform grant_credits_once(p_user_id, p_friend_credits, 'invite_bonus', 'invite_friend:' || i.id::text);
  update invites set status = 'rewarded', payment_id = p_payment_id, payment_intent = nullif(p_payment_intent, ''), rewarded_at = now(),
    inviter_credits = p_inviter_credits, friend_credits = p_friend_credits
  where id = i.id;
  return jsonb_build_object('result', 'rewarded', 'inviter_credits', p_inviter_credits, 'friend_credits', p_friend_credits);
end $$;

-- Takes back what is still unspent of one rewarded invite (both sides), as negative ledger rows, once.
create or replace function public.rewards_take_back(p_invite_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i invites; v_bal int; v_take int; v_taken_inviter int := 0; v_taken_friend int := 0; v_rows int;
begin
  select * into i from invites where id = p_invite_id for update;
  if not found or i.status <> 'rewarded' then return jsonb_build_object('result', 'not_rewarded'); end if;
  select coalesce(credit_balance, 0) into v_bal from profiles where id = i.inviter_user_id for update;
  v_take := least(i.inviter_credits, greatest(v_bal, 0));
  if v_take > 0 then
    insert into credit_grants (user_id, reason, amount, external_id) values (i.inviter_user_id, 'invite_clawback', -v_take, 'invite_clawback:' || i.id::text || ':inviter')
    on conflict (external_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then update profiles set credit_balance = credit_balance - v_take where id = i.inviter_user_id; v_taken_inviter := v_take; end if;
  end if;
  select coalesce(credit_balance, 0) into v_bal from profiles where id = i.invited_user_id for update;
  v_take := least(i.friend_credits, greatest(v_bal, 0));
  if v_take > 0 then
    insert into credit_grants (user_id, reason, amount, external_id) values (i.invited_user_id, 'invite_clawback', -v_take, 'invite_clawback:' || i.id::text || ':friend')
    on conflict (external_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then update profiles set credit_balance = credit_balance - v_take where id = i.invited_user_id; v_taken_friend := v_take; end if;
  end if;
  update invites set status = p_status, reason = left(p_reason, 200), closed_at = now() where id = i.id;
  return jsonb_build_object('result', 'taken_back', 'inviter', v_taken_inviter, 'friend', v_taken_friend);
end $$;

-- Refund / dispute of the first purchase within the window → the unspent reward credits go back.
create or replace function public.rewards_reverse_payment(p_payment_id text, p_payment_intent text, p_window_days integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int := 0;
begin
  for v_id in
    select id from invites where status = 'rewarded' and rewarded_at > now() - make_interval(days => p_window_days)
      and ((p_payment_id is not null and payment_id = p_payment_id) or (p_payment_intent is not null and payment_intent = p_payment_intent))
  loop
    perform rewards_take_back(v_id, 'reversed', p_reason);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('reversed', v_n);
end $$;

-- The admin's "Cancel": a waiting invite pays nothing; a rewarded one gives back what is unspent.
create or replace function public.rewards_cancel_invite(p_invite_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i invites;
begin
  select * into i from invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if i.status = 'rewarded' then return rewards_take_back(i.id, 'cancelled', coalesce(p_reason, 'cancelled by admin')); end if;
  if i.status = 'joined' then
    update invites set status = 'cancelled', reason = left(coalesce(p_reason, 'cancelled by admin'), 200), closed_at = now() where id = i.id;
    return jsonb_build_object('result', 'cancelled');
  end if;
  return jsonb_build_object('result', 'closed_already', 'status', i.status);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'rewards_submit(uuid, text, text, text, bigint, integer)',
    'rewards_recheck(uuid, uuid, bigint)',
    'rewards_review(uuid, boolean, bigint, integer, text, text)',
    'rewards_invite_code(uuid, text)',
    'rewards_claim_invite(uuid, text, text, integer)',
    'rewards_record_payment(uuid, text, text, integer, integer, integer, integer, text[])',
    'rewards_take_back(uuid, text, text)',
    'rewards_reverse_payment(text, text, integer, text)',
    'rewards_cancel_invite(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
