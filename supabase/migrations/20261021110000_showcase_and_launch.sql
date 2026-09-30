-- Long Form launch: showcase videos, one-time announcements, click tracking.

-- 1. Showcase videos (Home + Long Form lobby). Public read of ACTIVE rows only;
--    no insert/update/delete policies, so writes go through the dashboard /
--    service role only. See docs/showcase.md.
create table if not exists public.showcase_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  youtube_url text not null,
  thumbnail_url text,                         -- our own file (showcase bucket); null -> YouTube's image
  kind text not null default 'example' check (kind in ('example', 'tutorial')),
  placements text[] not null default array['home', 'long_form']
    check (placements <@ array['home', 'long_form']::text[] and cardinality(placements) > 0),
  niche text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists showcase_videos_active_sort on public.showcase_videos (sort_order, created_at) where is_active;
alter table public.showcase_videos enable row level security;
drop policy if exists showcase_videos_public_read on public.showcase_videos;
create policy showcase_videos_public_read on public.showcase_videos for select to anon, authenticated using (is_active);
grant select on public.showcase_videos to anon, authenticated;

-- Our own thumbnail files: a public bucket (uploads via the dashboard).
insert into storage.buckets (id, name, public) values ('showcase', 'showcase', true) on conflict (id) do nothing;

-- 2. One-time announcements, stored on the profile (once across devices).
alter table public.profiles add column if not exists seen_announcements text[] not null default '{}';
create or replace function public.mark_announcement_seen(p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_key is null or length(p_key) > 80 then return; end if;
  update public.profiles
     set seen_announcements = array_append(seen_announcements, p_key)
   where id = auth.uid() and not (p_key = any(seen_announcements));
end $$;
revoke all on function public.mark_announcement_seen(text) from public, anon;
grant execute on function public.mark_announcement_seen(text) to authenticated;

-- 3. Click tracking: the site can only INSERT (read it in the dashboard / SQL).
create table if not exists public.marketing_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  event text not null check (length(event) <= 60),
  placement text check (length(placement) <= 60),
  target text check (length(target) <= 300),
  path text check (length(path) <= 300),
  meta jsonb not null default '{}'::jsonb check (pg_column_size(meta) <= 2000)
);
create index if not exists marketing_events_event_time on public.marketing_events (event, created_at desc);
alter table public.marketing_events enable row level security;
drop policy if exists marketing_events_insert on public.marketing_events;
create policy marketing_events_insert on public.marketing_events for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
grant insert on public.marketing_events to anon, authenticated;

-- Seed: the two launch videos (links can be changed in the dashboard; see docs/showcase.md).
insert into public.showcase_videos (title, youtube_url, thumbnail_url, kind, placements, niche, sort_order)
select * from (values
  ('Did Vikings Really Wear Horned Helmets?', 'https://www.youtube.com/watch?v=2DFxSoSB5hY', null::text, 'example', array['home', 'long_form'], 'Myth vs Reality', 10),
  ('How Did Early Humans Hunt?', 'https://www.youtube.com/watch?v=-4oDXegn9vw', null::text, 'example', array['home', 'long_form'], 'History', 20)
) as v(title, youtube_url, thumbnail_url, kind, placements, niche, sort_order)
where not exists (select 1 from public.showcase_videos s where s.title = v.title);
