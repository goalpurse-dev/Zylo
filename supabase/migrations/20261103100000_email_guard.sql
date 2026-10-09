-- The email guard: one gate every email to a user passes BEFORE it is sent.
--
-- Why: api/send-recovery-manual.js mailed one person 23,263 times in four weeks
-- (2026-09-06 to 2026-10-04): it was a public URL that sent on every request and
-- nothing counted what an address had already received. Removing the file stopped
-- that one loop; this makes the next one impossible. The rules live in the
-- database, not in the callers, so a new script can't forget them:
--   1. an address on email_suppressions (bounced, complained, invalid) gets nothing
--   2. marketing goes only to a profile with email_updates = true
--   3. the same email (address + kind) is sent once, ever
--   4. at most 3 emails per address in any 24 hours (20 for test sends)
-- Callers: _shared/userEmail.ts (edge functions) and emails/marketing.js (campaign
-- scripts). tests/emailRules.test.mjs fails when any other file calls Resend.

-- 1. Addresses we never write to again.
create table if not exists public.email_suppressions (
  email      text primary key,                 -- lower-cased, trimmed
  reason     text not null check (reason in ('bounced', 'complained', 'invalid')),
  source     text not null,                    -- 'resend-webhook', 'resend-import', 'audit-2026-10-09', ...
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;   -- no policies: service role only

-- 2. Every email that was let through.
create table if not exists public.email_sends (
  id       bigint generated always as identity primary key,
  email    text not null,                      -- lower-cased, trimmed
  kind     text not null,                      -- 'welcome', 'checkout:<id>:<stage>', 'campaign:<name>', 'test:<name>:<ms>'
  category text not null check (category in ('marketing', 'account', 'test')),
  sent_at  timestamptz not null default now()
);
alter table public.email_sends enable row level security;          -- no policies: service role only
-- Rule 3 is this index: a second row for the same address and kind cannot exist.
create unique index if not exists email_sends_email_kind_key on public.email_sends (email, kind);
create index if not exists email_sends_email_sent_at_idx on public.email_sends (email, sent_at desc);

create index if not exists profiles_email_lower_idx on public.profiles (lower(btrim(email)));

-- 3. The gate. Returns {"ok": true, "id": <email_sends id>} or {"ok": false, "reason": ...}
--    with reason one of: bad_address, bad_request, suppressed, no_consent, already_sent, daily_limit.
--    The limits are constants here on purpose: a caller cannot raise them.
create or replace function public.claim_email_send(p_email text, p_kind text, p_category text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_last_day int;
  v_id bigint;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_address');
  end if;
  if coalesce(btrim(p_kind), '') = '' or p_category is null or p_category not in ('marketing', 'account', 'test') then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;

  -- One claim at a time per address: two callers can't both count "2 so far".
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  if exists (select 1 from email_suppressions where email = v_email) then
    return jsonb_build_object('ok', false, 'reason', 'suppressed');
  end if;
  if p_category = 'marketing' and not exists (
    select 1 from profiles where lower(btrim(email)) = v_email and email_updates is true
  ) then
    return jsonb_build_object('ok', false, 'reason', 'no_consent');
  end if;
  if exists (select 1 from email_sends where email = v_email and kind = p_kind) then
    return jsonb_build_object('ok', false, 'reason', 'already_sent');
  end if;

  select count(*) into v_last_day
    from email_sends
   where email = v_email
     and sent_at > now() - interval '24 hours'
     and (category = 'test') = (p_category = 'test');
  if v_last_day >= (case when p_category = 'test' then 20 else 3 end) then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;

  insert into email_sends (email, kind, category) values (v_email, p_kind, p_category) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 4. Stop writing to an address: remember it and switch its profile(s) OFF.
--    Returns how many profiles were switched from ON to OFF.
create or replace function public.suppress_email(p_email text, p_reason text, p_source text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_off integer;
begin
  if v_email = '' then return 0; end if;
  insert into email_suppressions (email, reason, source) values (v_email, p_reason, p_source)
  on conflict (email) do update
    set reason = case when excluded.reason = 'complained' then 'complained' else email_suppressions.reason end;
  update profiles set email_updates = false where lower(btrim(email)) = v_email and email_updates is true;
  get diagnostics v_off = row_count;
  return v_off;
end;
$$;

revoke all on function public.claim_email_send(text, text, text) from public, anon, authenticated;
revoke all on function public.suppress_email(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_email_send(text, text, text) to service_role;
grant execute on function public.suppress_email(text, text, text) to service_role;
