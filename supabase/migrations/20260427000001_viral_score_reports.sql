-- ═══════════════════════════════════════════════════════════════════
-- Viral Score Reports
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.viral_score_reports (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references public.profiles(id) on delete cascade,
  video_path          text        not null,
  video_url           text,
  source_type         text        not null default 'upload',
  status              text        not null default 'uploaded',
  error_message       text,
  duration_seconds    numeric,
  transcript          text,
  analysis_version    text        default 'v1',
  overall_score       integer,
  hook_score          integer,
  retention_score     integer,
  pacing_score        integer,
  clarity_score       integer,
  visual_score        integer,
  payoff_score        integer,
  rewatch_score       integer,
  verdict             text,
  biggest_problem     text,
  biggest_opportunity text,
  top_fixes           jsonb       default '[]'::jsonb,
  timeline_notes      jsonb       default '[]'::jsonb,
  rewritten_hooks     jsonb       default '[]'::jsonb,
  improved_caption    text,
  improved_structure  jsonb       default '[]'::jsonb,
  full_report         jsonb       default '{}'::jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Row-level security
alter table public.viral_score_reports enable row level security;

create policy "users_own_viral_score_reports"
  on public.viral_score_reports
  for all
  using (auth.uid() = user_id);

-- Indexes
create index if not exists viral_score_reports_user_id_idx
  on public.viral_score_reports(user_id);

create index if not exists viral_score_reports_status_idx
  on public.viral_score_reports(status);

create index if not exists viral_score_reports_created_at_idx
  on public.viral_score_reports(created_at desc);

-- ───────────────────────────────────────────────────────────────────
-- NOTE: Also run this in Supabase Dashboard → Storage → New bucket:
--   Name:   viral-score-videos
--   Public: false
--
-- Or via SQL:
--   insert into storage.buckets (id, name, public)
--   values ('viral-score-videos', 'viral-score-videos', false)
--   on conflict do nothing;
--
-- Storage RLS (allow authenticated users to upload to their own folder):
--   create policy "upload_own_videos" on storage.objects
--     for insert to authenticated
--     with check (bucket_id = 'viral-score-videos' and (storage.foldername(name))[1] = auth.uid()::text);
--
--   create policy "read_own_videos" on storage.objects
--     for select to authenticated
--     using (bucket_id = 'viral-score-videos' and (storage.foldername(name))[1] = auth.uid()::text);
-- ───────────────────────────────────────────────────────────────────
