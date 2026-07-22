-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260707000000_system_logs.sql
-- Central error/event log for the generation pipeline (job-worker,
-- runware-video, runware-image, queue-worker). Every edge function in that
-- pipeline writes a row here whenever something notable happens — job
-- started, provider rejected a request, credit charge/refund failed, a
-- background task crashed, etc. — so failures that only ever showed up as a
-- job silently stuck in "queued"/"running" are now visible in one table.
--
-- Server-only: no anon/authenticated policies are created. All writes/reads
-- go through Edge Functions using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS),
-- or the Supabase Studio table editor / SQL editor (uses the postgres role).
-- Mirrors the pattern in 20260602000001_rls_server_only_tables.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.system_logs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  level      text not null default 'info' check (level in ('info', 'warn', 'error')),
  source     text not null,   -- e.g. 'runware-video', 'job-worker', 'queue-worker', 'runware-image'
  event      text not null,   -- e.g. 'job_failed', 'poll_exception', 'credit_charge_failed'

  job_id     uuid,
  user_id    uuid,
  tool_key   text,

  message    text,
  details    jsonb not null default '{}'::jsonb
);

create index if not exists system_logs_created_at_idx on public.system_logs (created_at desc);
create index if not exists system_logs_job_id_idx      on public.system_logs (job_id);
create index if not exists system_logs_user_id_idx     on public.system_logs (user_id);
create index if not exists system_logs_level_idx       on public.system_logs (level, created_at desc);
create index if not exists system_logs_source_event_idx on public.system_logs (source, event, created_at desc);

alter table public.system_logs enable row level security;

-- Optional cleanup helper — call periodically (or via cron) to keep the
-- table from growing unbounded. Not scheduled by this migration.
create or replace function public.prune_system_logs(p_older_than interval default interval '30 days')
returns void
language sql
security definer
as $$
  delete from public.system_logs where created_at < now() - p_older_than;
$$;
