-- Refund rule: credits already used for finished work (script, voice, scenes) are
-- never refunded, even if some scenes fail — failed scenes get the free retry.
-- EVERYTHING comes back only when the whole video can't be made at all: the run
-- failed (project status or autopilot) AND it has no finished scene.
-- Before: any failed autopilot, or a failed last render with no final video, refunded
-- everything including the committed work. A failed render is retried free; it no
-- longer makes the project "failed by us".
create or replace function public.long_form_failed_by_us(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (p.status like '%failed%' or coalesce(p.autopilot ->> 'status', '') = 'failed')
       and not exists (
         select 1 from public.long_form_scene_images s
         where s.project_id = p.id and s.is_current and s.status = 'ready')
    from public.long_form_projects p where p.id = p_project_id), false)
$$;
revoke all on function public.long_form_failed_by_us(uuid) from public, anon, authenticated;
grant execute on function public.long_form_failed_by_us(uuid) to service_role;
