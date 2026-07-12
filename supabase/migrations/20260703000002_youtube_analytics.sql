-- =============================================================================
-- Migration: 20260703000002_youtube_analytics.sql
-- YouTube analytics storage:
--   1. Add title/duration to social_posts (YouTube has video titles)
--   2. Add YouTube-specific metric columns to social_post_metrics_snapshots
--   3. Add last_analytics_sync_at to social_accounts (sync cooldown)
--   4. youtube_channel_daily_analytics — daily time-series for charts
-- =============================================================================

-- social_posts: add title + duration for YouTube videos
alter table public.social_posts
  add column if not exists title              text,
  add column if not exists duration_seconds   integer;

-- social_post_metrics_snapshots: add YouTube-specific metrics
alter table public.social_post_metrics_snapshots
  add column if not exists watch_time_minutes              numeric,
  add column if not exists average_view_duration_seconds   numeric,
  add column if not exists subscribers_gained              bigint;

-- social_accounts: cooldown column for analytics syncs
alter table public.social_accounts
  add column if not exists last_analytics_sync_at timestamptz;

-- =============================================================================
-- youtube_channel_daily_analytics
-- One row per (social_account_id, date). Upserted on each analytics sync.
-- Drives the daily line chart.
-- =============================================================================
create table if not exists public.youtube_channel_daily_analytics (
  id                              uuid        primary key default gen_random_uuid(),
  user_id                         uuid        not null references auth.users(id) on delete cascade,
  social_account_id               uuid        not null references public.social_accounts(id) on delete cascade,
  date                            date        not null,
  views                           bigint      not null default 0,
  watch_time_minutes              numeric     not null default 0,
  average_view_duration_seconds   numeric     not null default 0,
  subscribers_gained              bigint      not null default 0,
  subscribers_lost                bigint      not null default 0,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  unique (social_account_id, date)
);

create index if not exists yt_daily_account_date_idx
  on public.youtube_channel_daily_analytics (social_account_id, date desc);

create index if not exists yt_daily_user_date_idx
  on public.youtube_channel_daily_analytics (user_id, date desc);

alter table public.youtube_channel_daily_analytics enable row level security;

create policy "Users read own YouTube daily analytics"
  on public.youtube_channel_daily_analytics for select to authenticated
  using (auth.uid() = user_id);
