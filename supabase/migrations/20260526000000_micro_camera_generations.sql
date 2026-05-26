-- micro_camera_generations
-- Persists every Micro Camera Animal generation per user so Recent Creations
-- stay consistent across devices, browsers, and domains.

create table if not exists public.micro_camera_generations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  animal_label   text        default 'animal',
  length_id      text        default '15s',
  status         text        default 'completed',
  scenes         jsonb       default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists micro_camera_generations_user_created
  on public.micro_camera_generations (user_id, created_at desc);

alter table public.micro_camera_generations enable row level security;

create policy "micro_camera_generations_owner_all"
  on public.micro_camera_generations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger micro_camera_generations_updated_at
  before update on public.micro_camera_generations
  for each row execute procedure public.set_updated_at();
