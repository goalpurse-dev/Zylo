create table if not exists public.cartoon_drive_by_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  world text not null,
  vehicle text not null default 'car',
  mood text not null default 'golden-dusk',
  quality_id text not null default 'cartoon-drive-v2',
  status text not null default 'completed',
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);

create index if not exists cartoon_drive_by_generations_user_created
  on public.cartoon_drive_by_generations (user_id, created_at desc);

alter table public.cartoon_drive_by_generations enable row level security;

drop policy if exists "cartoon_drive_by_generations_owner_all" on public.cartoon_drive_by_generations;
create policy "cartoon_drive_by_generations_owner_all"
  on public.cartoon_drive_by_generations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
