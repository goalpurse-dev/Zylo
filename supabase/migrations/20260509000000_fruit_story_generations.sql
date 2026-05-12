-- fruit_story_generations
-- Persists every AI Fruit Story image-generation session so users can
-- return, restore, and animate their saved scene packs.

create table if not exists public.fruit_story_generations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text,
  story_angle    text,
  story_idea     text,
  scene_count    int         default 6,
  scene_aspect   text        default '9:16',
  image_model    text        default 'zyvo-v2',
  animation_model text,
  status         text        default 'generating_images',
  cast_data      jsonb       default '[]'::jsonb,
  planner_output jsonb       default '{}'::jsonb,
  scenes         jsonb       default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Index for fast per-user queries ordered by newest first
create index if not exists fruit_story_generations_user_created
  on public.fruit_story_generations (user_id, created_at desc);

-- RLS
alter table public.fruit_story_generations enable row level security;

-- Users can only read, write, and delete their own rows
create policy "fruit_story_generations_owner_all"
  on public.fruit_story_generations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fruit_story_generations_updated_at
  before update on public.fruit_story_generations
  for each row execute procedure public.set_updated_at();
