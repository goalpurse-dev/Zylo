create table if not exists public.lipsync_jobs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references public.profiles(id) on delete cascade,
  video_url   text        not null,
  audio_url   text        not null,
  result_url  text,
  status      text        not null default 'processing',  -- processing | completed | failed
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.lipsync_jobs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lipsync_jobs' and policyname = 'users_own_lipsync_jobs'
  ) then
    create policy "users_own_lipsync_jobs" on public.lipsync_jobs for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists lipsync_jobs_user_id_idx  on public.lipsync_jobs(user_id);
create index if not exists lipsync_jobs_created_idx  on public.lipsync_jobs(created_at desc);

-- Storage bucket (run separately if not using Supabase CLI):
-- insert into storage.buckets (id, name, public)
-- values ('lipsync-inputs', 'lipsync-inputs', false)
-- on conflict do nothing;
--
-- create policy "lipsync_upload" on storage.objects for insert to authenticated
--   with check (bucket_id = 'lipsync-inputs' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "lipsync_read" on storage.objects for select to authenticated
--   using (bucket_id = 'lipsync-inputs' and (storage.foldername(name))[1] = auth.uid()::text);
