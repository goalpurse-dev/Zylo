-- The affiliate program (owner's brief, 2026-11-17). Business numbers live in
-- supabase/functions/_shared/affiliate/config.js; the callers pass them in, so this file holds no rates.
--   affiliates        one row per creator who joined (/affiliate): code, rates, payout choice
--   referral_clicks   one row per ?ref=CODE visit: hashed IP only, never the raw IP
--   referrals         which affiliate brought a user: ONE per user, set at sign-up, never changed
--   commissions       one per referred user, on their FIRST payment; pending → available → paid, or reversed
--   payouts           cash paid by hand (PayPal/Wise) or credits added automatically
-- Nobody reads or writes these tables from the browser: RLS is on with no policies, and every call goes
-- through the affiliate-api function or the Stripe webhook (service role).
-- Safe with the live site: nothing calls these until stripe-webhook and affiliate-api are deployed; a webhook
-- deployed BEFORE this migration skips the affiliate step (missing function) and pays nothing out.
-- Rollback: supabase/rollbacks/20261217100000_affiliate_program_rollback.sql

create table if not exists public.affiliates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  code          text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  display_name  text not null,
  status        text not null default 'active' check (status in ('active', 'disabled')),
  cash_rate     numeric(5,4) not null check (cash_rate >= 0 and cash_rate <= 1),
  credit_rate   numeric(5,4) not null check (credit_rate >= 0 and credit_rate <= 2),
  payout_type   text not null default 'cash' check (payout_type in ('cash', 'credits')),
  payout_method text check (payout_method in ('paypal', 'wise')),
  payout_email  text check (char_length(payout_email) <= 200),
  code_edits    integer not null default 0,
  ip_hashes     text[] not null default '{}',   -- the affiliate's own recent hashed IPs (self-referral check)
  last_seen_at  timestamptz,                    -- "new since your last visit"
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists affiliates_code_ci on public.affiliates (lower(code));

create table if not exists public.referral_clicks (
  id           bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  created_at   timestamptz not null default now(),
  ip_hash      text,
  user_agent   text check (char_length(user_agent) <= 300)
);
create index if not exists referral_clicks_affiliate_time on public.referral_clicks (affiliate_id, created_at desc);

create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  affiliate_id     uuid not null references public.affiliates(id) on delete cascade,
  source           text not null check (source in ('link', 'code')),
  flagged          boolean not null default false,
  flag_reason      text,
  review_status    text not null default 'none' check (review_status in ('none', 'approved', 'rejected')),
  reviewed_at      timestamptz,
  ip_hash          text,
  bonus_granted    boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists referrals_affiliate_time on public.referrals (affiliate_id, created_at desc);

create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount       integer not null check (amount >= 0),        -- euro cents (the credits' value for a credit payout)
  credits      integer not null default 0,
  method       text not null check (method in ('paypal', 'wise', 'credits')),
  status       text not null default 'paid' check (status in ('paid')),
  reference    text check (char_length(reference) <= 200),
  paid_to      text,
  paid_at      timestamptz not null default now(),
  created_by   text
);
create index if not exists payouts_affiliate_time on public.payouts (affiliate_id, paid_at desc);

create table if not exists public.commissions (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references public.affiliates(id) on delete cascade,
  referred_user_id  uuid not null unique references auth.users(id) on delete cascade,  -- one-time: first payment only
  payment_id        text not null unique,                 -- invoice id or checkout session id
  payment_intent    text,                                 -- refunds and disputes arrive with this
  plan              text,                                 -- starter / pro / generative / topup (the feed's label)
  amount_paid       integer not null check (amount_paid > 0),   -- cents, before tax
  currency          text not null default 'eur',
  commission_amount integer not null check (commission_amount >= 0), -- euro cents
  commission_credits integer not null default 0,
  type              text not null check (type in ('cash', 'credits')),
  status            text not null default 'pending' check (status in ('pending', 'available', 'paid', 'reversed')),
  on_hold           boolean not null default false,       -- a flagged referral: waits for the admin
  available_at      timestamptz not null,
  paid_at           timestamptz,
  payout_id         uuid references public.payouts(id),
  reversed_at       timestamptz,
  reversed_reason   text,
  is_test           boolean not null default false,       -- made by the admin page's test tools
  created_at        timestamptz not null default now()
);
create index if not exists commissions_affiliate_time on public.commissions (affiliate_id, created_at desc);
create index if not exists commissions_due on public.commissions (available_at) where status = 'pending';
create index if not exists commissions_intent on public.commissions (payment_intent) where payment_intent is not null;

alter table public.affiliates      enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.referrals       enable row level security;
alter table public.commissions     enable row level security;
alter table public.payouts         enable row level security;
revoke all on public.affiliates, public.referral_clicks, public.referrals, public.commissions, public.payouts from public, anon, authenticated;

-- ---------- join: the first free code of the candidates (the caller checked their shape) ----------
create or replace function public.affiliate_join(p_user_id uuid, p_candidates text[], p_display_name text, p_cash_rate numeric, p_credit_rate numeric, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates; c text;
begin
  select * into a from affiliates where user_id = p_user_id;
  if found then return jsonb_build_object('result', 'exists', 'id', a.id, 'code', a.code); end if;
  foreach c in array p_candidates loop
    continue when c is null or c !~ '^[A-Z0-9]{3,20}$';
    continue when exists (select 1 from affiliates where lower(code) = lower(c));
    begin
      insert into affiliates (user_id, code, display_name, cash_rate, credit_rate, ip_hashes)
      values (p_user_id, c, left(coalesce(nullif(btrim(p_display_name), ''), c), 40), p_cash_rate, p_credit_rate,
              case when p_ip_hash is null then '{}'::text[] else array[p_ip_hash] end)
      returning * into a;
      return jsonb_build_object('result', 'created', 'id', a.id, 'code', a.code);
    exception when unique_violation then
      select * into a from affiliates where user_id = p_user_id;
      if found then return jsonb_build_object('result', 'exists', 'id', a.id, 'code', a.code); end if;
      -- that code went to someone else a moment ago: try the next
    end;
  end loop;
  return jsonb_build_object('result', 'no_free_code');
end $$;

-- ---------- a new code: once by the affiliate, any time by the admin ----------
create or replace function public.affiliate_set_code(p_affiliate_id uuid, p_code text, p_by_admin boolean, p_max_edits integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{3,20}$' then return jsonb_build_object('result', 'invalid'); end if;
  select * into a from affiliates where id = p_affiliate_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if a.code = p_code then return jsonb_build_object('result', 'unchanged', 'code', a.code); end if;
  if not p_by_admin and a.code_edits >= p_max_edits then return jsonb_build_object('result', 'edit_used'); end if;
  if exists (select 1 from affiliates where lower(code) = lower(p_code) and id <> a.id) then return jsonb_build_object('result', 'taken'); end if;
  begin
    update affiliates set code = p_code, code_edits = code_edits + case when p_by_admin then 0 else 1 end, updated_at = now() where id = a.id;
  exception when unique_violation then
    return jsonb_build_object('result', 'taken');
  end;
  return jsonb_build_object('result', 'changed', 'code', p_code);
end $$;

-- ---------- attribution: a new user's creator code or link ----------
-- Refused for: an unknown or disabled code, the affiliate's own account, an account older than the
-- window, an account that already paid, an account that already has an affiliate. A referral from one of
-- the affiliate's own hashed IPs (or too many from one IP) is kept but flagged: no bonus, and its commission
-- waits for the admin.
create or replace function public.affiliate_claim(p_user_id uuid, p_code text, p_source text, p_ip_hash text, p_window_days integer,
  p_bonus_credits integer, p_link_bonus boolean, p_flag_same_ip boolean, p_max_per_ip integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates; r referrals; v_created timestamptz; v_plan text; v_flag text; v_bonus boolean := false; v_n int;
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
    insert into referrals (referred_user_id, affiliate_id, source, flagged, flag_reason, ip_hash)
    values (p_user_id, a.id, p_source, v_flag is not null, v_flag, p_ip_hash) returning * into r;
  exception when unique_violation then
    return jsonb_build_object('result', 'already_attributed');
  end;

  if v_flag is null and p_bonus_credits > 0 and (p_source = 'code' or p_link_bonus) then
    v_bonus := grant_credits_once(p_user_id, p_bonus_credits, 'creator_code_bonus', 'creator_code_bonus:' || p_user_id::text);
    update referrals set bonus_granted = v_bonus where id = r.id;
  end if;
  return jsonb_build_object('result', 'claimed', 'display_name', a.display_name, 'code', a.code, 'bonus', v_bonus,
    'bonus_credits', case when v_bonus then p_bonus_credits else 0 end, 'flagged', v_flag is not null);
end $$;

-- ---------- the webhook: a referred user's FIRST payment → one commission ----------
create or replace function public.affiliate_record_payment(p_user_id uuid, p_payment_id text, p_payment_intent text, p_amount_cents integer,
  p_currency text, p_plan text, p_paid_at timestamptz, p_hold_days integer, p_credit_value_cents integer, p_is_test boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r referrals; a affiliates; v_cents int; v_credits int := 0; c commissions;
begin
  if coalesce(p_payment_id, '') = '' then raise exception 'affiliate_record_payment: payment id is required'; end if;
  select * into r from referrals where referred_user_id = p_user_id for update;
  if not found then return jsonb_build_object('result', 'not_referred'); end if;
  select * into c from commissions where payment_id = p_payment_id;
  if found then return jsonb_build_object('result', 'duplicate', 'commission_id', c.id); end if;
  if exists (select 1 from commissions where referred_user_id = p_user_id) then return jsonb_build_object('result', 'not_first'); end if;
  if r.review_status = 'rejected' then return jsonb_build_object('result', 'rejected'); end if;
  if coalesce(p_amount_cents, 0) <= 0 then return jsonb_build_object('result', 'zero_amount'); end if;
  select * into a from affiliates where id = r.affiliate_id;
  if a.status <> 'active' then return jsonb_build_object('result', 'affiliate_disabled'); end if;

  if a.payout_type = 'credits' then
    v_credits := floor(round(p_amount_cents * a.credit_rate) / p_credit_value_cents);
    v_cents := v_credits * p_credit_value_cents;
  else
    v_cents := round(p_amount_cents * a.cash_rate);
  end if;

  begin
    insert into commissions (affiliate_id, referred_user_id, payment_id, payment_intent, plan, amount_paid, currency, commission_amount,
      commission_credits, type, on_hold, available_at, is_test, created_at)
    values (a.id, p_user_id, p_payment_id, nullif(p_payment_intent, ''), p_plan, p_amount_cents, lower(coalesce(p_currency, 'eur')), v_cents,
      v_credits, a.payout_type, r.flagged and r.review_status <> 'approved', coalesce(p_paid_at, now()) + make_interval(days => p_hold_days), coalesce(p_is_test, false),
      coalesce(p_paid_at, now()))
    returning * into c;
  exception when unique_violation then
    return jsonb_build_object('result', 'duplicate');
  end;
  return jsonb_build_object('result', 'created', 'commission_id', c.id, 'type', c.type, 'amount', c.commission_amount, 'credits', c.commission_credits, 'on_hold', c.on_hold);
end $$;

-- ---------- refund / chargeback: an unpaid commission is reversed ----------
create or replace function public.affiliate_reverse_payment(p_payment_id text, p_payment_intent text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_reversed int; v_paid int;
begin
  update commissions set status = 'reversed', reversed_at = now(), reversed_reason = left(p_reason, 80)
  where status in ('pending', 'available')
    and ((p_payment_id is not null and payment_id = p_payment_id) or (p_payment_intent is not null and payment_intent = p_payment_intent));
  get diagnostics v_reversed = row_count;
  select count(*) into v_paid from commissions
  where status = 'paid' and ((p_payment_id is not null and payment_id = p_payment_id) or (p_payment_intent is not null and payment_intent = p_payment_intent));
  return jsonb_build_object('reversed', v_reversed, 'already_paid', v_paid);
end $$;

-- ---------- after the hold: pending → available; a credit commission is added to the account at once ----------
-- Daily (pg_cron below) and on every read of the page (affiliate-api). Held (flagged) commissions and
-- disabled affiliates wait. Each credit grant is once-only by its commission id.
create or replace function public.affiliate_release_due(p_affiliate_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare c record; v_n int := 0; v_payout uuid;
begin
  for c in
    select cm.*, af.user_id as aff_user from commissions cm join affiliates af on af.id = cm.affiliate_id
    where cm.status = 'pending' and not cm.on_hold and cm.available_at <= now() and af.status = 'active'
      and (p_affiliate_id is null or cm.affiliate_id = p_affiliate_id)
    order by cm.available_at
    for update of cm skip locked
  loop
    if c.type = 'credits' then
      if c.commission_credits > 0 then
        perform grant_credits_once(c.aff_user, c.commission_credits, 'affiliate_commission', 'affiliate_commission:' || c.id::text);
      end if;
      insert into payouts (affiliate_id, amount, credits, method, reference, created_by)
      values (c.affiliate_id, c.commission_amount, c.commission_credits, 'credits', 'commission ' || c.id::text, 'auto') returning id into v_payout;
      update commissions set status = 'paid', paid_at = now(), payout_id = v_payout where id = c.id;
    else
      update commissions set status = 'available' where id = c.id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------- the admin's "Mark as paid": every available cash commission of one affiliate ----------
create or replace function public.affiliate_mark_paid(p_affiliate_id uuid, p_min_cents integer, p_reference text, p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates; v_sum int; v_payout uuid;
begin
  select * into a from affiliates where id = p_affiliate_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if a.payout_method is null or coalesce(a.payout_email, '') = '' then return jsonb_build_object('result', 'no_payout_details'); end if;
  select coalesce(sum(commission_amount), 0) into v_sum from commissions
  where affiliate_id = a.id and type = 'cash' and status = 'available' and not on_hold;
  if v_sum < p_min_cents then return jsonb_build_object('result', 'below_minimum', 'amount', v_sum); end if;
  insert into payouts (affiliate_id, amount, method, reference, paid_to, created_by)
  values (a.id, v_sum, a.payout_method, left(p_reference, 200), a.payout_email, left(p_admin, 200)) returning id into v_payout;
  update commissions set status = 'paid', paid_at = now(), payout_id = v_payout
  where affiliate_id = a.id and type = 'cash' and status = 'available' and not on_hold;
  return jsonb_build_object('result', 'paid', 'payout_id', v_payout, 'amount', v_sum);
end $$;

-- ---------- the admin's review of a flagged referral ----------
create or replace function public.affiliate_resolve_flag(p_referral_id uuid, p_approve boolean, p_bonus_credits integer, p_link_bonus boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r referrals; v_bonus boolean := false;
begin
  select * into r from referrals where id = p_referral_id for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if p_approve then
    update referrals set review_status = 'approved', reviewed_at = now() where id = r.id;
    update commissions set on_hold = false where referred_user_id = r.referred_user_id and status in ('pending', 'available');
    if not r.bonus_granted and p_bonus_credits > 0 and (r.source = 'code' or p_link_bonus) then
      v_bonus := grant_credits_once(r.referred_user_id, p_bonus_credits, 'creator_code_bonus', 'creator_code_bonus:' || r.referred_user_id::text);
      update referrals set bonus_granted = v_bonus where id = r.id;
    end if;
  else
    update referrals set review_status = 'rejected', reviewed_at = now() where id = r.id;
    update commissions set status = 'reversed', reversed_at = now(), reversed_reason = 'referral rejected'
    where referred_user_id = r.referred_user_id and status in ('pending', 'available');
  end if;
  return jsonb_build_object('result', case when p_approve then 'approved' else 'rejected' end, 'bonus', v_bonus);
end $$;

-- ---------- totals per affiliate (the page's tiles and the admin table) ----------
-- Money in euro cents: pending = waiting out the hold (cash + credits' value), available = cash ready to
-- pay, paid = paid out (cash, and credits' value). Reversed commissions count nowhere.
create or replace function public.affiliate_stats(p_affiliate_id uuid default null)
returns table (affiliate_id uuid, clicks bigint, signups bigint, buyers bigint, flagged bigint, pending_cents bigint, pending_credits bigint,
  available_cents bigint, paid_cents bigint, paid_credits bigint, next_unlock_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id,
    (select count(*) from referral_clicks k where k.affiliate_id = a.id),
    (select count(*) from referrals r where r.affiliate_id = a.id and r.review_status <> 'rejected'),
    (select count(*) from commissions c where c.affiliate_id = a.id and c.status <> 'reversed'),
    (select count(*) from referrals r where r.affiliate_id = a.id and r.flagged and r.review_status = 'none'),
    (select coalesce(sum(commission_amount), 0) from commissions c where c.affiliate_id = a.id and c.status = 'pending'),
    (select coalesce(sum(commission_credits), 0) from commissions c where c.affiliate_id = a.id and c.status = 'pending'),
    (select coalesce(sum(commission_amount), 0) from commissions c where c.affiliate_id = a.id and c.status = 'available'),
    (select coalesce(sum(commission_amount), 0) from commissions c where c.affiliate_id = a.id and c.status = 'paid'),
    (select coalesce(sum(commission_credits), 0) from commissions c where c.affiliate_id = a.id and c.status = 'paid'),
    (select min(available_at) from commissions c where c.affiliate_id = a.id and c.status = 'pending')
  from affiliates a
  where p_affiliate_id is null or a.id = p_affiliate_id;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'affiliate_stats(uuid)',
    'affiliate_join(uuid, text[], text, numeric, numeric, text)',
    'affiliate_set_code(uuid, text, boolean, integer)',
    'affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer)',
    'affiliate_record_payment(uuid, text, text, integer, text, text, timestamptz, integer, integer, boolean)',
    'affiliate_reverse_payment(text, text, text)',
    'affiliate_release_due(uuid)',
    'affiliate_mark_paid(uuid, integer, text, text)',
    'affiliate_resolve_flag(uuid, boolean, integer, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- The daily release (06:15 UTC). The page also releases on every read, so nothing waits on this.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'affiliate-release';
    perform cron.schedule('affiliate-release', '15 6 * * *', 'select public.affiliate_release_due(null);');
  end if;
end $$;

notify pgrst, 'reload schema';
