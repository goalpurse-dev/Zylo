-- Clay Rescue generations table
create table if not exists clay_rescue_generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  length_id   text,
  status      text not null default 'completed',
  scenes      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: owner-only access
alter table clay_rescue_generations enable row level security;

create policy "owner only" on clay_rescue_generations
  for all using (auth.uid() = user_id);

-- Fast reverse-chronological lookup
create index if not exists clay_rescue_generations_user_created
  on clay_rescue_generations (user_id, created_at desc);

-- Reuse the existing set_updated_at trigger function
create trigger set_clay_rescue_updated_at
  before update on clay_rescue_generations
  for each row execute function set_updated_at();
