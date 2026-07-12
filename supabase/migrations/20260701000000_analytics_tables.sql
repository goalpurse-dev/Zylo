-- =============================================================================
-- Migration: 20260701000000_analytics_tables.sql
-- Platform-neutral analytics: posts, metrics snapshots, AI insights.
--
-- Security model:
--   social_posts                        → authenticated users read their own rows
--   social_post_metrics_snapshots       → authenticated users read their own rows
--   social_account_metrics_snapshots    → authenticated users read their own rows
--   ai_social_insights                  → authenticated users read their own rows
--   All writes go through service-role Edge Functions only (no insert policies).
--   Access tokens are never stored in these tables.
-- =============================================================================


-- =============================================================================
-- social_posts
-- Canonical record for each post synced from a connected platform.
-- One row per (social_account_id × platform_post_id). Upserted on sync.
-- =============================================================================
create table if not exists public.social_posts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  social_account_id uuid        not null references public.social_accounts(id) on delete cascade,
  platform          text        not null,          -- instagram | youtube | tiktok
  platform_post_id  text        not null,          -- platform's native ID
  media_type        text,                          -- REEL | IMAGE | CAROUSEL_ALBUM | VIDEO
  caption           text,
  permalink         text,
  thumbnail_url     text,
  media_url         text,
  posted_at         timestamptz,
  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  unique (social_account_id, platform_post_id)
);

create index if not exists social_posts_user_idx
  on public.social_posts (user_id, posted_at desc nulls last);

create index if not exists social_posts_account_idx
  on public.social_posts (social_account_id, posted_at desc nulls last);

alter table public.social_posts enable row level security;

create policy "Users read own social posts"
  on public.social_posts for select to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- social_post_metrics_snapshots
-- Time-series metrics per post. A new row is inserted on each sync run so
-- growth over time can be charted. Null = metric not available for this platform
-- or not yet supported (e.g. insights scope not granted).
-- =============================================================================
create table if not exists public.social_post_metrics_snapshots (
  id             uuid        primary key default gen_random_uuid(),
  social_post_id uuid        not null references public.social_posts(id) on delete cascade,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  platform       text        not null,
  snapshotted_at timestamptz not null default now(),
  -- engagement
  views          bigint,
  likes          bigint,
  comments       bigint,
  shares         bigint,
  saves          bigint,
  -- reach / distribution
  reach          bigint,
  impressions    bigint,
  -- computed (likes+comments+shares+saves) / reach * 100
  engagement_rate float,
  -- platform-specific extras (e.g. carousel_album_engagement, tiktok_duet_count)
  raw            jsonb       not null default '{}'
);

create index if not exists post_metrics_post_time_idx
  on public.social_post_metrics_snapshots (social_post_id, snapshotted_at desc);

create index if not exists post_metrics_user_time_idx
  on public.social_post_metrics_snapshots (user_id, snapshotted_at desc);

alter table public.social_post_metrics_snapshots enable row level security;

create policy "Users read own post metrics"
  on public.social_post_metrics_snapshots for select to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- social_account_metrics_snapshots
-- Account-level metrics snapshot (followers, averages) over time.
-- =============================================================================
create table if not exists public.social_account_metrics_snapshots (
  id                uuid        primary key default gen_random_uuid(),
  social_account_id uuid        not null references public.social_accounts(id) on delete cascade,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  platform          text        not null,
  snapshotted_at    timestamptz not null default now(),
  followers         bigint,
  following         bigint,
  media_count       bigint,
  -- rolling averages computed at snapshot time from recent posts
  avg_views         float,
  avg_likes         float,
  avg_comments      float,
  avg_engagement    float,
  raw               jsonb       not null default '{}'
);

create index if not exists account_metrics_account_time_idx
  on public.social_account_metrics_snapshots (social_account_id, snapshotted_at desc);

create index if not exists account_metrics_user_time_idx
  on public.social_account_metrics_snapshots (user_id, snapshotted_at desc);

alter table public.social_account_metrics_snapshots enable row level security;

create policy "Users read own account metrics"
  on public.social_account_metrics_snapshots for select to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- ai_social_insights
-- AI-generated performance analysis stored as structured JSON.
-- content shape depends on insight_type:
--   weekly_summary  → { summary, best_post_id, worst_post_id, key_wins, key_fails }
--   recommendations → { next_topics[], best_hooks[], best_formats[], avoid[] }
--   post_analysis   → { verdict, above_avg_metrics[], below_avg_metrics[], tip }
-- =============================================================================
create table if not exists public.ai_social_insights (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  social_account_id uuid        references public.social_accounts(id) on delete set null,
  platform          text,
  insight_type      text        not null
    check (insight_type in ('weekly_summary', 'recommendations', 'post_analysis')),
  period_start      date,
  period_end        date,
  content           jsonb       not null default '{}',
  generated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists ai_insights_user_time_idx
  on public.ai_social_insights (user_id, generated_at desc);

create index if not exists ai_insights_account_type_idx
  on public.ai_social_insights (social_account_id, insight_type, generated_at desc);

alter table public.ai_social_insights enable row level security;

create policy "Users read own AI insights"
  on public.ai_social_insights for select to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- get_my_social_posts()
-- SECURITY DEFINER RPC: returns the calling user's posts with their most-recent
-- metrics snapshot joined laterally. No tokens, no other users' data.
-- =============================================================================
create or replace function public.get_my_social_posts(
  p_platform text    default null,
  p_limit    integer default 50,
  p_offset   integer default 0
)
returns table (
  id               uuid,
  platform         text,
  platform_post_id text,
  social_account_id uuid,
  media_type       text,
  caption          text,
  permalink        text,
  thumbnail_url    text,
  media_url        text,
  posted_at        timestamptz,
  synced_at        timestamptz,
  -- latest metrics
  views            bigint,
  likes            bigint,
  comments         bigint,
  shares           bigint,
  saves            bigint,
  reach            bigint,
  impressions      bigint,
  engagement_rate  float,
  metrics_at       timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sp.id,
    sp.platform,
    sp.platform_post_id,
    sp.social_account_id,
    sp.media_type,
    sp.caption,
    sp.permalink,
    sp.thumbnail_url,
    sp.media_url,
    sp.posted_at,
    sp.synced_at,
    m.views,
    m.likes,
    m.comments,
    m.shares,
    m.saves,
    m.reach,
    m.impressions,
    m.engagement_rate,
    m.snapshotted_at as metrics_at
  from public.social_posts sp
  left join lateral (
    select *
    from public.social_post_metrics_snapshots
    where social_post_id = sp.id
    order by snapshotted_at desc
    limit 1
  ) m on true
  where sp.user_id = auth.uid()
    and (p_platform is null or sp.platform = p_platform)
  order by sp.posted_at desc nulls last
  limit  p_limit
  offset p_offset;
$$;


-- =============================================================================
-- get_my_analytics_summary()
-- Returns latest account snapshot + top 10 posts by views for the dashboard.
-- =============================================================================
create or replace function public.get_my_analytics_summary(p_platform text default 'instagram')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'account', (
      select row_to_json(s)
      from (
        select followers, following, media_count, avg_views, avg_likes,
               avg_comments, avg_engagement, snapshotted_at
        from public.social_account_metrics_snapshots
        where user_id  = auth.uid()
          and platform = p_platform
        order by snapshotted_at desc
        limit 1
      ) s
    ),
    'top_posts', (
      select jsonb_agg(row_to_json(p))
      from (
        select
          sp.id, sp.platform_post_id, sp.media_type, sp.caption,
          sp.permalink, sp.thumbnail_url, sp.posted_at,
          m.views, m.likes, m.comments, m.engagement_rate
        from public.social_posts sp
        left join lateral (
          select views, likes, comments, engagement_rate
          from public.social_post_metrics_snapshots
          where social_post_id = sp.id
          order by snapshotted_at desc limit 1
        ) m on true
        where sp.user_id  = auth.uid()
          and sp.platform = p_platform
        order by coalesce(m.views, m.likes, 0) desc
        limit 10
      ) p
    ),
    'latest_insight', (
      select content
      from public.ai_social_insights
      where user_id     = auth.uid()
        and platform    = p_platform
        and insight_type = 'weekly_summary'
      order by generated_at desc
      limit 1
    )
  );
$$;
