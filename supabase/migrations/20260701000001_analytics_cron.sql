-- =============================================================================
-- Migration: 20260701000001_analytics_cron.sql
-- Scheduled analytics sync jobs via pg_cron + pg_net.
--
-- Requires pg_cron and pg_net extensions enabled in the Supabase Dashboard
-- (Database → Extensions → pg_cron + pg_net).
--
-- The ANALYTICS_CRON_SECRET must be set as a Supabase secret and also as a
-- pg_cron parameter — see the setup notes below.
--
-- Schedule:
--   Every 6 hours: sync all active users' Instagram media + metrics
--   Every Sunday 00:00 UTC: run AI insights for all active users
--
-- NOTE: These jobs call analytics-sync per-user. For large user bases,
-- replace with a fan-out queue pattern. For now this is sufficient.
-- =============================================================================

-- Ensure required extensions are available
-- (Enable in Dashboard UI first; these create statements are no-ops if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create private schema for internal server-only functions
create schema if not exists private;

-- Helper function: call analytics-sync for a single user (used by cron)
create or replace function private.trigger_analytics_sync(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  _url    text := current_setting('app.supabase_url',    true);
  _secret text := current_setting('app.analytics_cron_secret', true);
begin
  perform net.http_post(
    url     := _url || '/functions/v1/analytics-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key', true),
      'apikey',        current_setting('app.supabase_service_key', true)
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id::text,
      'secret',  _secret
    )
  );
end;
$$;

-- Helper function: sync all users who have active social accounts
create or replace function private.trigger_analytics_sync_all()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  _user record;
begin
  for _user in
    select distinct user_id
    from public.social_accounts
    where revoked_at is null
  loop
    perform private.trigger_analytics_sync(_user.user_id);
  end loop;
end;
$$;

-- Schedule: sync every 6 hours
select cron.schedule(
  'analytics-sync-6h',
  '0 */6 * * *',
  $$ select private.trigger_analytics_sync_all(); $$
);

-- Schedule: AI insights every Sunday at midnight UTC
select cron.schedule(
  'analytics-insights-weekly',
  '0 0 * * 0',
  $$ select private.trigger_analytics_sync_all(); $$
);

-- =============================================================================
-- SETUP NOTES
-- After running this migration, set the pg config variables in Supabase SQL
-- editor (these can't be set in migrations since they're runtime settings):
--
-- alter database postgres set app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
-- alter database postgres set app.supabase_service_key = 'YOUR_SERVICE_ROLE_KEY';
-- alter database postgres set app.analytics_cron_secret = 'YOUR_CRON_SECRET';
--
-- Also set ANALYTICS_CRON_SECRET as a Supabase secret:
--   supabase secrets set ANALYTICS_CRON_SECRET=<your-secret>
-- =============================================================================
