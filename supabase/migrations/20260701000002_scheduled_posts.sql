-- =============================================================================
-- Migration: 20260701000002_scheduled_posts.sql
-- Adds scheduled_for to instagram_publish_jobs so posts can be queued for
-- a future date/time. Jobs with scheduled_for in the future stay in 'queued'
-- status until the schedule-worker picks them up.
-- =============================================================================

alter table public.instagram_publish_jobs
  add column if not exists scheduled_for timestamptz;

-- Fast lookup for the schedule-worker (find due jobs)
create index if not exists instagram_publish_jobs_scheduled_idx
  on public.instagram_publish_jobs (scheduled_for)
  where status = 'queued' and scheduled_for is not null;

-- Expose scheduled_for to the frontend (it's not a secret column)
-- The existing get_my_social_accounts RPC is unrelated; instagram_publish_jobs
-- already has an authenticated SELECT policy so no changes needed there.
