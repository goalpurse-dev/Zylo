-- Project covers, v2: for each of the CALLER's long-form projects, the picked
-- (else newest ready) YouTube thumbnail, its first finished scene image, and
-- the niche chosen at setup. The page picks thumbnail -> scene -> niche art,
-- so projects never share one generic fallback. Own rows only.
drop function if exists public.long_form_project_covers();
create or replace function public.long_form_project_covers()
returns table (project_id uuid, thumbnail_url text, scene_url text, niche text)
language sql stable security definer set search_path = '' as $$
  select p.id,
    (select coalesce(t.full_url, t.image_url) from public.long_form_thumbnails t
      where t.project_id = p.id and t.status = 'ready' and coalesce(t.full_url, t.image_url) is not null
      order by t.selected desc nulls last, t.created_at desc limit 1),
    (select coalesce(s.image_url, s.master_url) from public.long_form_scene_images s
      where s.project_id = p.id and s.status = 'ready' and s.is_current and coalesce(s.image_url, s.master_url) is not null
      order by s.beat_sequence limit 1),
    (select g.raw_setup_snapshot ->> 'niche' from public.long_form_generation_profiles g
      where g.project_id = p.id order by g.created_at desc limit 1)
  from public.long_form_projects p
  where p.user_id = auth.uid() and p.deleted_at is null
$$;
revoke all on function public.long_form_project_covers() from public, anon;
grant execute on function public.long_form_project_covers() to authenticated;
