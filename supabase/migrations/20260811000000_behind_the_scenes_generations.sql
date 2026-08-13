create table if not exists public.behind_the_scenes_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place text not null,
  disaster text not null default 'wave',
  vantage text not null default 'tank-edge',
  quality_id text not null default 'bts-v2',
  status text not null default 'completed',
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);

create index if not exists behind_the_scenes_generations_user_created
  on public.behind_the_scenes_generations (user_id, created_at desc);

alter table public.behind_the_scenes_generations enable row level security;

drop policy if exists "behind_the_scenes_generations_owner_all" on public.behind_the_scenes_generations;
create policy "behind_the_scenes_generations_owner_all"
  on public.behind_the_scenes_generations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
