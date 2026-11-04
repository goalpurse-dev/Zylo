-- The follow-up reminders after sign-up (owner, 2026-11-04): _shared/signupReminders.js has the rules and the texts.
--   onboarding_settings.reminders_on   the switch, OFF until the owner has seen the texts and says go
--   signup_reminders                   one row per reminder sent (the claim, then Resend's id): once per kind per account,
--                                      the dashboard's numbers, and "no two reminders in 24 hours"
--   cron job signup-reminders          every 10 minutes; while the switch is off it doesn't even call the function
alter table public.onboarding_settings add column if not exists reminders_on boolean not null default false;

create table if not exists public.signup_reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('preview_unpaid', 'preview_not_made', 'bonus_day2')),
  resend_id text,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create index if not exists signup_reminders_sent_at on public.signup_reminders (sent_at);
alter table public.signup_reminders enable row level security; -- no policies: the service role only

-- The same pattern as private.trigger_ops_health: the function's address is ops-health's with its own name, and the
-- x-ops-secret header (vault ops_health_secret) is what the function checks.
create or replace function private.trigger_signup_reminders()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare secret text; fn_url text;
begin
  if not coalesce((select reminders_on from public.onboarding_settings where id = 1), false) then
    return;
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'ops_health_secret' limit 1;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'ops_health_url' limit 1;
  if secret is null or fn_url is null or fn_url !~ '/ops-health$' then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(fn_url, '/ops-health$', '/signup-reminders'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ops-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function private.trigger_signup_reminders() from public, anon, authenticated;

select cron.unschedule('signup-reminders') where exists (select 1 from cron.job where jobname = 'signup-reminders');
select cron.schedule('signup-reminders', '*/10 * * * *', 'select private.trigger_signup_reminders();');
