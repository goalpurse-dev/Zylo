-- Add retry/concurrency columns to the existing jobs table.
-- The previous migration only added `priority` and `attempts`/`retry_after`.
-- This migration adds all remaining columns needed by the queue worker.

alter table public.jobs
  add column if not exists plan_code    text        not null default 'free';

alter table public.jobs
  add column if not exists provider     text        not null default 'runware';

alter table public.jobs
  add column if not exists attempts     int         not null default 0;

alter table public.jobs
  add column if not exists max_attempts int         not null default 5;

alter table public.jobs
  add column if not exists retry_after  timestamptz not null default now();

alter table public.jobs
  add column if not exists locked_at   timestamptz;

alter table public.jobs
  add column if not exists locked_by   text;

alter table public.jobs
  add column if not exists started_at  timestamptz;

alter table public.jobs
  add column if not exists completed_at timestamptz;

alter table public.jobs
  add column if not exists failed_at   timestamptz;

-- Indexes for the worker pick query and concurrency checks
create index if not exists jobs_worker_pick_idx
  on public.jobs (status, retry_after, priority asc, created_at asc);

create index if not exists jobs_processing_provider_idx
  on public.jobs (provider, status);

create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at desc);

create index if not exists jobs_plan_priority_idx
  on public.jobs (plan_code, priority, created_at desc);
