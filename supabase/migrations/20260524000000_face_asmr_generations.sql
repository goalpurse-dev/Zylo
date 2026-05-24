-- face_asmr_generations
-- Persists every Face ASMR generation pack per user so Recent Creations
-- stay consistent across devices, browsers, and domains.

create table if not exists public.face_asmr_generations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text,
  scene_count    int         default 3,
  length_id      text        default '15s',
  background_id  text,
  status         text        default 'completed',
  scenes         jsonb       default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists face_asmr_generations_user_created
  on public.face_asmr_generations (user_id, created_at desc);

alter table public.face_asmr_generations enable row level security;

create policy "face_asmr_generations_owner_all"
  on public.face_asmr_generations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger face_asmr_generations_updated_at
  before update on public.face_asmr_generations
  for each row execute procedure public.set_updated_at();
