-- =============================================================================
-- Migration: 20260710000000_tiktok_publish_jobs.sql
-- Adds TikTok publishing support:
--   1. tiktok_publish_jobs table (mirrors instagram_publish_jobs / youtube_publish_jobs)
--
-- social_accounts, social_oauth_states, social_posts, and the metrics snapshot
-- tables are already platform-neutral (no CHECK constraint on `platform`), so
-- TikTok reuses them as-is with platform = 'tiktok' — no changes needed there.
-- =============================================================================

-- =============================================================================
-- tiktok_publish_jobs
-- Tracks full lifecycle of a TikTok Direct Post / Draft upload attempt.
-- No token columns — frontend polls its own rows for status.
-- =============================================================================
create table if not exists public.tiktok_publish_jobs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  social_account_id uuid        not null references public.social_accounts(id) on delete restrict,
  creation_id       uuid,                               -- zyvo jobs row (nullable for custom uploads)
  video_url         text        not null,               -- storage URL used for this attempt

  -- Requested post options (validated against creator_info before publish)
  publish_mode      text        not null default 'draft'
    check (publish_mode in ('direct', 'draft')),         -- 'draft' = inbox/drafts, 'direct' = public/direct post
  title             text        not null default '',     -- TikTok caption text (post_info.title)
  privacy_level     text,                                -- e.g. PUBLIC_TO_EVERYONE | SELF_ONLY | MUTUAL_FOLLOW_FRIENDS | FOLLOWER_OF_CREATOR
  disable_comment   boolean     not null default false,
  disable_duet      boolean     not null default false,
  disable_stitch    boolean     not null default false,
  is_commercial     boolean     not null default false,  -- brand_content_toggle or brand_organic_toggle requested
  is_branded_content boolean    not null default false,  -- brand_content_toggle specifically (paid partnership)

  status            text        not null default 'queued'
    check (status in (
      'queued',
      'preparing',
      'uploading',
      'processing',
      'published',
      'draft_created',
      'failed',
      'canceled'
    )),
  idempotency_key   text        not null unique,        -- prevents double-publish

  tiktok_publish_id text,                               -- publish_id returned by /video/init or /inbox/video/init
  tiktok_post_id    text,                                -- final published video/post id, once known
  tiktok_share_url  text,                                -- share URL, if TikTok returns one
  error_code        text,                                -- internal or TikTok error code (sanitized)
  error_message     text,                                -- user-facing message (sanitized, never raw TikTok error)
  attempts          int         not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

-- User's publish history (most recent first)
create index if not exists tiktok_publish_jobs_user_idx
  on public.tiktok_publish_jobs (user_id, created_at desc);

-- Active jobs for background status polling
create index if not exists tiktok_publish_jobs_active_idx
  on public.tiktok_publish_jobs (status, updated_at)
  where status not in ('published', 'draft_created', 'failed', 'canceled');

alter table public.tiktok_publish_jobs enable row level security;

create policy "Users can read own TikTok publish jobs"
  on public.tiktok_publish_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);
