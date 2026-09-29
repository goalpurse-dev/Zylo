-- Phase 6d-1 — the Edit step's document (the EDL the render worker renders).
-- Versioned: every autosave is a new row (the newest is the edit); the last
-- 100 versions per project are kept. Written only by the long-form-edit
-- function (service role) after an ownership check.
create table if not exists public.long_form_edits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  version int not null,
  doc jsonb not null,
  narration_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index if not exists long_form_edits_project_idx on public.long_form_edits (project_id, version desc);
alter table public.long_form_edits enable row level security;
revoke all on public.long_form_edits from public, anon, authenticated;

-- A split scene's own picture (Edit step): a NON-current version of the
-- source beat, drawn by the same worker when it is claimed by its id.
create or replace function public.claim_long_form_scene_image(p_project_id uuid, p_scene_id uuid, p_lease_seconds integer)
returns setof public.long_form_scene_images
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.long_form_scene_images s
     set status = 'rendering', attempts = s.attempts + 1, started_at = now(),
         lease_until = now() + make_interval(secs => p_lease_seconds)
   where s.id = (
     select id from public.long_form_scene_images
      where project_id = p_project_id and status = 'queued'
        and (is_current or (p_scene_id is not null and source = 'split'))
        and (p_scene_id is null or id = p_scene_id)
      order by beat_sequence
      limit 1
      for update skip locked)
  returning s.*;
end $$;
revoke all on function public.claim_long_form_scene_image(uuid, uuid, integer) from public, anon, authenticated;
