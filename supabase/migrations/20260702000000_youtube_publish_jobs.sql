-- =============================================================================
-- Migration: 20260702000000_youtube_publish_jobs.sql
-- Adds YouTube publishing support:
--   1. refresh_token_encrypted column on social_accounts (needed for Google OAuth)
--   2. youtube_publish_jobs table (mirrors instagram_publish_jobs)
-- =============================================================================

-- Google OAuth returns a refresh token that must be stored alongside the
-- access token. Instagram doesn't need this (long-lived token, renewed
-- server-side). We add it as a nullable column so the constraint doesn't
-- break existing Instagram rows.
alter table public.social_accounts
  add column if not exists refresh_token_encrypted text not null default '';


-- =============================================================================
-- youtube_publish_jobs
-- Tracks full lifecycle of a YouTube video upload attempt.
-- No token columns — frontend polls its own rows for status.
-- =============================================================================
create table if not exists public.youtube_publish_jobs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  social_account_id uuid        not null references public.social_accounts(id) on delete restrict,
  creation_id       uuid,                               -- zyvo jobs row (nullable for custom uploads)
  video_url         text        not null,               -- storage URL used for this attempt
  title             text        not null default '',     -- YouTube video title (required by API)
  description       text        not null default '',     -- maps to caption / body text
  privacy_status    text        not null default 'public'
    check (privacy_status in ('public', 'unlisted', 'private')),
  status            text        not null default 'queued'
    check (status in (
      'queued',
      'uploading',
      'processing',
      'published',
      'failed',
      'canceled'
    )),
  idempotency_key   text        not null unique,
  youtube_video_id  text,                               -- YouTube video ID once uploaded
  youtube_url       text,                               -- full watch URL
  error_code        text,
  error_message     text,                               -- sanitized user-facing message
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index if not exists youtube_publish_jobs_user_idx
  on public.youtube_publish_jobs (user_id, created_at desc);

create index if not exists youtube_publish_jobs_active_idx
  on public.youtube_publish_jobs (status, updated_at)
  where status not in ('published', 'failed', 'canceled');

alter table public.youtube_publish_jobs enable row level security;

create policy "Users can read own YouTube publish jobs"
  on public.youtube_publish_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);
