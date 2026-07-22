-- Footballer Nationality Swap generations table
create table if not exists footballer_nationality_swap_generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  scene_count integer,
  status      text not null default 'completed',
  scenes      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: owner-only access
alter table footballer_nationality_swap_generations enable row level security;

create policy "owner only" on footballer_nationality_swap_generations
  for all using (auth.uid() = user_id);

-- Fast reverse-chronological lookup
create index if not exists footballer_nationality_swap_generations_user_created
  on footballer_nationality_swap_generations (user_id, created_at desc);

-- Reuse the existing set_updated_at trigger function
create trigger set_footballer_nationality_swap_updated_at
  before update on footballer_nationality_swap_generations
  for each row execute function set_updated_at();
