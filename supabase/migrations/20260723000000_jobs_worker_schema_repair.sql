-- Repair production schema drift between the jobs table and job-worker.
-- Safe to run when some or all columns already exist.

alter table public.jobs
  add column if not exists priority      integer     not null default 9,
  add column if not exists plan_code     text        not null default 'free',
  add column if not exists provider      text        not null default 'runware',
  add column if not exists attempts      integer     not null default 0,
  add column if not exists max_attempts  integer     not null default 5,
  add column if not exists retry_after   timestamptz not null default now(),
  add column if not exists locked_at     timestamptz,
  add column if not exists locked_by     text,
  add column if not exists started_at    timestamptz,
  add column if not exists completed_at  timestamptz,
  add column if not exists failed_at     timestamptz;

-- Earlier queue migrations created retry_after as nullable before a later
-- migration made it required. Normalize either historical shape.
update public.jobs
set
  priority = coalesce(priority, 9),
  plan_code = coalesce(nullif(plan_code, ''), 'free'),
  provider = coalesce(nullif(provider, ''), 'runware'),
  attempts = coalesce(attempts, 0),
  max_attempts = coalesce(max_attempts, 5),
  retry_after = coalesce(retry_after, now())
where
  priority is null
  or plan_code is null
  or plan_code = ''
  or provider is null
  or provider = ''
  or attempts is null
  or max_attempts is null
  or retry_after is null;

alter table public.jobs
  alter column priority set default 9,
  alter column priority set not null,
  alter column plan_code set default 'free',
  alter column plan_code set not null,
  alter column provider set default 'runware',
  alter column provider set not null,
  alter column attempts set default 0,
  alter column attempts set not null,
  alter column max_attempts set default 5,
  alter column max_attempts set not null,
  alter column retry_after set default now(),
  alter column retry_after set not null;

create index if not exists jobs_worker_pick_idx
  on public.jobs (status, retry_after, priority asc, created_at asc);

create index if not exists jobs_processing_provider_idx
  on public.jobs (provider, status);

create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at desc);

create index if not exists jobs_plan_priority_idx
  on public.jobs (plan_code, priority, created_at desc);

-- Edge Functions query through PostgREST, which can continue serving a stale
-- column map after DDL until its schema cache is refreshed.
notify pgrst, 'reload schema';
