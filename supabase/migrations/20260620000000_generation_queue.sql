-- ============================================================
-- Generation Queue
-- Priority-based, concurrency-controlled generation queue.
-- Lower priority number = processed first.
--   generative = 1, pro = 2, starter = 3, free/unknown = 9
-- ============================================================

-- 1. Enhance existing jobs table with queue-aware columns
alter table public.jobs
  add column if not exists priority    int         not null default 9,
  add column if not exists attempts    int         not null default 0,
  add column if not exists retry_after timestamptz;

create index if not exists jobs_pick_idx
  on public.jobs (status, priority asc, created_at asc);

-- Update pick query to respect retry_after when set
create index if not exists jobs_retry_idx
  on public.jobs (status, retry_after, priority asc, created_at asc)
  where retry_after is not null;

-- 2. Generation queue table
create table if not exists public.generation_queue (
  id                   uuid        primary key default gen_random_uuid(),

  user_id              uuid        not null references auth.users(id) on delete cascade,
  parent_generation_id uuid,                    -- e.g. fruit_story_generations.id

  provider             text        not null default 'runware',
  model                text        not null,
  task_type            text        not null check (task_type in ('image', 'video')),

  -- Full payload needed to create the jobs row when concurrency allows
  payload              jsonb       not null,

  status               text        not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),

  plan_code            text        not null default 'free',
  priority             int         not null default 9,

  -- Populated when queue worker creates the actual jobs row
  job_id               uuid,

  result               jsonb,
  error                jsonb,

  attempts             int         not null default 0,
  max_attempts         int         not null default 5,

  retry_after          timestamptz not null default now(),

  locked_at            timestamptz,
  locked_by            text,

  started_at           timestamptz,
  completed_at         timestamptz,
  failed_at            timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Indexes
create index if not exists generation_queue_pick_idx
  on public.generation_queue (status, retry_after, priority asc, created_at asc);

create index if not exists generation_queue_user_idx
  on public.generation_queue (user_id, created_at desc);

create index if not exists generation_queue_parent_idx
  on public.generation_queue (parent_generation_id)
  where parent_generation_id is not null;

create index if not exists generation_queue_provider_idx
  on public.generation_queue (provider, task_type, status);

create index if not exists generation_queue_job_idx
  on public.generation_queue (job_id)
  where job_id is not null;

-- RLS: users read their own rows; service role does everything
alter table public.generation_queue enable row level security;

drop policy if exists "generation_queue_owner_select" on public.generation_queue;
create policy "generation_queue_owner_select"
  on public.generation_queue for select
  to authenticated
  using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.touch_generation_queue_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists generation_queue_updated_at on public.generation_queue;
create trigger generation_queue_updated_at
  before update on public.generation_queue
  for each row execute function public.touch_generation_queue_updated_at();

-- 3. Atomic claim RPC — picks highest priority jobs safely (skip locked)
create or replace function public.claim_generation_queue_jobs(
  worker_id  text,
  max_jobs   int default 3
)
returns setof public.generation_queue
language plpgsql
security definer
as $$
begin
  return query
  with picked as (
    select id
    from public.generation_queue
    where status      = 'queued'
      and retry_after <= now()
    order by priority asc, created_at asc
    limit max_jobs
    for update skip locked
  )
  update public.generation_queue q
  set
    status     = 'processing',
    locked_at  = now(),
    locked_by  = worker_id,
    started_at = coalesce(q.started_at, now()),
    updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
end;
$$;

-- 4. Requeue a job with exponential back-off (called by queue-worker on retryable error)
create or replace function public.requeue_generation_queue_job(
  p_id         uuid,
  p_attempts   int,
  p_retry_after timestamptz,
  p_error      jsonb default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.generation_queue
  set
    status      = 'queued',
    locked_at   = null,
    locked_by   = null,
    attempts    = p_attempts,
    error       = coalesce(p_error, error),
    retry_after = p_retry_after,
    updated_at  = now()
  where id = p_id;
end;
$$;
