-- =============================================================================
-- Migration: 20260623000000_social_publishing.sql
-- Social OAuth states, connected accounts, and Instagram publish jobs.
--
-- Security model:
--   social_oauth_states   → server-only (no authenticated policies; service role only)
--   social_accounts       → server-only for raw rows; safe metadata via get_my_social_accounts() RPC
--   instagram_publish_jobs → authenticated users can SELECT their own rows (no token columns here)
-- =============================================================================


-- =============================================================================
-- social_oauth_states
-- Binds an Instagram OAuth redirect callback to the Zyvo user who initiated
-- the flow. The raw state travels in the browser URL; only the SHA-256 hash
-- is persisted here, so the secret value never touches the database.
-- =============================================================================
create table if not exists public.social_oauth_states (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  platform   text        not null,
  state_hash text        not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,               -- null = unused; set atomically on first use
  created_at timestamptz not null default now()
);

-- Hash lookup (callback path)
create index if not exists social_oauth_states_hash_idx
  on public.social_oauth_states (state_hash);

-- Rate-limit queries (how many starts per user per hour)
create index if not exists social_oauth_states_user_rate_idx
  on public.social_oauth_states (user_id, platform, created_at desc);

-- Server-only: no browser policies.
-- All access uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
alter table public.social_oauth_states enable row level security;


-- =============================================================================
-- social_accounts
-- One row per (user × platform × platform_user_id).
-- access_token_encrypted must never be returned to the browser.
-- All frontend reads must go through get_my_social_accounts() RPC below.
-- =============================================================================
create table if not exists public.social_accounts (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  platform               text        not null,
  platform_user_id       text        not null,          -- Instagram user ID
  username               text,
  display_name           text,
  avatar_url             text,
  access_token_encrypted text        not null default '', -- AES-256-GCM; '' when revoked
  token_expires_at       timestamptz,
  scopes                 text[]      not null default '{}',
  metadata               jsonb       not null default '{}',
  connected_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  revoked_at             timestamptz,                   -- set on disconnect; null = active

  unique (user_id, platform, platform_user_id)
);

create index if not exists social_accounts_user_platform_idx
  on public.social_accounts (user_id, platform);

-- No SELECT policy for authenticated role: access_token_encrypted must stay
-- server-side. Frontend access is exclusively through the SECURITY DEFINER
-- RPC get_my_social_accounts() which omits the token column.
alter table public.social_accounts enable row level security;


-- =============================================================================
-- instagram_publish_jobs
-- Tracks full lifecycle of a Reel publish attempt. No token columns.
-- Frontend can poll its own rows for status updates.
-- =============================================================================
create table if not exists public.instagram_publish_jobs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  social_account_id uuid        not null references public.social_accounts(id) on delete restrict,
  creation_id       uuid,                               -- zyvo creations row (nullable for future)
  video_url         text        not null,               -- storage URL used for this attempt
  caption           text        not null default '',
  status            text        not null default 'queued'
    check (status in (
      'queued',
      'creating_container',
      'processing',
      'publishing',
      'published',
      'failed',
      'canceled'
    )),
  idempotency_key   text        not null unique,        -- prevents double-publish
  container_id      text,                               -- Meta media container ID
  media_id          text,                               -- Meta published media ID
  permalink         text,                               -- final IG post permalink
  error_code        text,                               -- internal error code
  error_message     text,                               -- user-facing message (sanitized)
  attempts          int         not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

-- User's publish history (most recent first)
create index if not exists instagram_publish_jobs_user_idx
  on public.instagram_publish_jobs (user_id, created_at desc);

-- Active jobs for background status checks
create index if not exists instagram_publish_jobs_active_idx
  on public.instagram_publish_jobs (status, updated_at)
  where status not in ('published', 'failed', 'canceled');

alter table public.instagram_publish_jobs enable row level security;

create policy "Users can read own Instagram publish jobs"
  on public.instagram_publish_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- get_my_social_accounts()
-- SECURITY DEFINER so it can read social_accounts past RLS, but always
-- filters to auth.uid(). access_token_encrypted is intentionally omitted.
-- =============================================================================
create or replace function public.get_my_social_accounts()
returns table (
  id               uuid,
  platform         text,
  platform_user_id text,
  username         text,
  display_name     text,
  avatar_url       text,
  token_expires_at timestamptz,
  scopes           text[],
  connected_at     timestamptz,
  updated_at       timestamptz,
  is_expired       boolean
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    platform,
    platform_user_id,
    username,
    display_name,
    avatar_url,
    token_expires_at,
    scopes,
    connected_at,
    updated_at,
    (token_expires_at is not null and token_expires_at < now()) as is_expired
  from public.social_accounts
  where user_id   = auth.uid()
    and revoked_at is null
  order by connected_at desc;
$$;
