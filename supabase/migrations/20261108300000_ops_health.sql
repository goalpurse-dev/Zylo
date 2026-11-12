-- The owner's health check (2026-10-26): every outside service, a daily email at 9:00 Finnish
-- time, instant alerts only for real users failing or a balance running out within 3 days.
--   provider_balance_history  a reading of a balance (or of what was used) every 30 minutes, so
--                             "days left" comes from real use; a rise (a top-up) is ignored
--   cron ops-health           every 10 minutes; the function decides whether the 9:00 email is due
create table if not exists public.provider_balance_history (
  id       bigint generated always as identity primary key,
  provider text not null,                 -- 'runware' (usd left), 'elevenlabs_used' (characters used this period)
  balance  numeric not null,
  unit     text not null,
  at       timestamptz not null default now()
);
alter table public.provider_balance_history enable row level security;   -- no policies: service role only
create index if not exists provider_balance_history_idx on public.provider_balance_history (provider, at desc);

-- The cron tick: calls ops-health with its secret (both in the vault: ops_health_url, ops_health_secret).
create schema if not exists private;
create or replace function private.trigger_ops_health()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare secret text; fn_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'ops_health_secret' limit 1;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'ops_health_url' limit 1;
  if secret is null or fn_url is null then
    return;
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ops-secret', secret),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 60000
  );
end;
$function$;
revoke all on function private.trigger_ops_health() from public, anon, authenticated;
grant execute on function private.trigger_ops_health() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ops-health';
    perform cron.schedule('ops-health', '*/10 * * * *', 'select private.trigger_ops_health();');
  end if;
end $$;
