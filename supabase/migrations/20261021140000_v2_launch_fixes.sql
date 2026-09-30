-- V2 launch test fixes.
-- 1. Thumbnails: when a draw started (the watchdog re-dispatches a draw whose
--    worker was killed, then marks it failed so the page offers a free retry).
alter table public.long_form_thumbnails add column if not exists draw_started_at timestamptz;

-- 2. Scene images: realtime for the drawing grid (the page still polls as a fallback).
--    The owner's existing select policy decides who receives the rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'long_form_scene_images'
  ) then
    alter publication supabase_realtime add table public.long_form_scene_images;
  end if;
end $$;

-- 3. Project covers, v3: + the chosen idea's thumbnail and the title. The page
--    picks YouTube thumbnail -> first finished scene -> chosen idea's thumbnail
--    -> a neutral cover with the title (never another video's niche art).
drop function if exists public.long_form_project_covers();
create or replace function public.long_form_project_covers()
returns table (project_id uuid, thumbnail_url text, scene_url text, idea_thumbnail_url text, title text, niche text)
language sql stable security definer set search_path = '' as $$
  select p.id,
    (select coalesce(t.full_url, t.image_url) from public.long_form_thumbnails t
      where t.project_id = p.id and t.status = 'ready' and coalesce(t.full_url, t.image_url) is not null
      order by t.selected desc nulls last, t.created_at desc limit 1),
    (select coalesce(s.image_url, s.master_url) from public.long_form_scene_images s
      where s.project_id = p.id and s.status = 'ready' and s.is_current and coalesce(s.image_url, s.master_url) is not null
      order by s.beat_sequence limit 1),
    (select coalesce(i -> 'thumbnail' ->> 'imageUrl', i -> 'conceptPreview' ->> 'imageUrl')
      from public.long_form_discovery_sessions d,
        jsonb_array_elements(
          coalesce(d.ideas, '[]'::jsonb)
          || coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(d.idea_batches, '[]'::jsonb)) b, jsonb_array_elements(coalesce(b -> 'ideas', '[]'::jsonb)) x), '[]'::jsonb)
        ) i
      where d.id = p.discovery_session_id and p.selected_idea_id is not null and i ->> 'id' = p.selected_idea_id::text
        and coalesce(i -> 'thumbnail' ->> 'imageUrl', i -> 'conceptPreview' ->> 'imageUrl') is not null
      limit 1),
    coalesce(p.selected_title, p.selected_idea_title, p.topic),
    (select g.raw_setup_snapshot ->> 'niche' from public.long_form_generation_profiles g
      where g.project_id = p.id order by g.created_at desc limit 1)
  from public.long_form_projects p
  where p.user_id = auth.uid() and p.deleted_at is null
$$;
revoke all on function public.long_form_project_covers() from public, anon;
grant execute on function public.long_form_project_covers() to authenticated;
