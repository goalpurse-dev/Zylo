-- Home "Jump back in": each of the CALLER's long-form projects with its picked
-- (else newest ready) YouTube thumbnail. long_form_thumbnails itself stays
-- service-role only; this returns only the signed-in user's own rows.
create or replace function public.long_form_project_covers()
returns table (project_id uuid, url text)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.project_id) t.project_id, coalesce(t.full_url, t.image_url)
  from public.long_form_thumbnails t
  join public.long_form_projects p on p.id = t.project_id
  where p.user_id = auth.uid() and p.deleted_at is null and t.status = 'ready' and coalesce(t.full_url, t.image_url) is not null
  order by t.project_id, t.selected desc nulls last, t.created_at desc
$$;
revoke all on function public.long_form_project_covers() from public, anon;
grant execute on function public.long_form_project_covers() to authenticated;
