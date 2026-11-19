-- The unfinished-checkout emails (owner, 2026-11-19): _shared/checkoutReminders.js has the rules and the texts, the
-- checkout-reminders function sends them. NEW tables: the old abandoned_checkouts backlog is never read or sent.
--   checkout_reminder_settings   the switch (OFF), starts_at (only checkouts opened after it count), the small caps
--   checkout_reminders           one sequence per person, ever: the plan they picked, why it stopped, when they paid
--   checkout_reminder_sends      one row per email (or a skipped step): Resend's id for opens, the click
--   checkout_reminder_click()    the email's button lands on /billing/continue, which counts the click with this
--   cron job checkout-reminders  every 10 minutes; while the switch is off it doesn't even call the function

create table if not exists public.checkout_reminder_settings (
  id int primary key default 1 check (id = 1),
  "on" boolean not null default false,
  starts_at timestamptz,
  daily_cap int not null default 40 check (daily_cap between 0 and 500),
  per_tick int not null default 5 check (per_tick between 0 and 50),
  skip_emails text[] not null default '{}',     -- more of the owner's test addresses (ADMIN_EMAILS are always skipped)
  updated_at timestamptz not null default now()
);
insert into public.checkout_reminder_settings (id) values (1) on conflict (id) do nothing;
alter table public.checkout_reminder_settings enable row level security; -- no policies: the service role only

create table if not exists public.checkout_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  first_session_id text not null,
  last_session_id text,
  plan_id text not null,
  billing text not null,
  price_id text,
  amount int,            -- the plan's normal price, cents
  currency text,
  deal boolean not null default false,
  source text,           -- onboarding / pricing_or_paywall / long_form (from the checkout's back link)
  opened_at timestamptz not null,
  last_opened_at timestamptz not null,
  paid_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,      -- paid / done / declined / owner / no_email / gate
  gate_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checkout_reminders_running on public.checkout_reminders (opened_at) where stopped_at is null;
alter table public.checkout_reminders enable row level security;

create table if not exists public.checkout_reminder_sends (
  reminder_id uuid not null references public.checkout_reminders(id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  resend_id text,        -- null for a skipped step
  skipped text,
  sent_at timestamptz not null default now(),
  clicked_at timestamptz,
  primary key (reminder_id, step)
);
create index if not exists checkout_reminder_sends_sent_at on public.checkout_reminder_sends (sent_at);
alter table public.checkout_reminder_sends enable row level security;

-- The click: the link carries the sequence's id (t) and the step (s). Anyone with the link may mark it clicked once; it
-- changes nothing else and tells the caller nothing.
create or replace function public.checkout_reminder_click(p_token uuid, p_step int)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.checkout_reminder_sends set clicked_at = now()
   where reminder_id = p_token and step = p_step and resend_id is not null and clicked_at is null;
$$;
revoke all on function public.checkout_reminder_click(uuid, int) from public;
grant execute on function public.checkout_reminder_click(uuid, int) to anon, authenticated, service_role;

-- The same pattern as private.trigger_signup_reminders: ops-health's address with this function's name, x-ops-secret.
create or replace function private.trigger_checkout_reminders()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare secret text; fn_url text;
begin
  if not coalesce((select "on" from public.checkout_reminder_settings where id = 1), false) then
    return;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'ops_health_secret' limit 1;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'ops_health_url' limit 1;
  if secret is null or fn_url is null or fn_url !~ '/ops-health$' then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(fn_url, '/ops-health$', '/checkout-reminders'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ops-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function private.trigger_checkout_reminders() from public, anon, authenticated;

select cron.unschedule('checkout-reminders') where exists (select 1 from cron.job where jobname = 'checkout-reminders');
select cron.schedule('checkout-reminders', '*/10 * * * *', 'select private.trigger_checkout_reminders();');
