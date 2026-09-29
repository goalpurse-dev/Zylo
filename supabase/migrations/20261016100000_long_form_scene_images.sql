-- Phase 6c — Stickman Scenes step: one row per scene image version.
--
-- The autopilot draws every beat of the project's beat plan on its tier
-- (render-long-form-scene, one scene per invocation), and the Scenes review
-- page regenerates / re-describes / re-texts single scenes. The current
-- version of each scene is the row with is_current = true. The on-screen text
-- is an editable layer (overlay jsonb, 1920x1080 coordinates) — editing it
-- never re-renders the image.
create table if not exists public.long_form_scene_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  beat_plan_version_id uuid not null references public.long_form_beat_plan_versions(id) on delete cascade,
  beat_sequence integer not null,
  version integer not null default 1,
  is_current boolean not null default true,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'ready', 'failed')),
  tier text not null check (tier in ('V2', 'V3', 'V4')),
  source text not null default 'autopilot' check (source in ('autopilot', 'regenerate', 'edit_description', 'seeded')),
  description_override text,
  image_url text,          -- 1920x1080-class base image (no text)
  master_url text,         -- upscaled master (2x) when kept separately
  original_url text,       -- the model's raw render
  overlay jsonb,           -- editable text layer (OverlayLayer, 1920x1080 coordinates) or null
  overlay_text text,
  warnings jsonb not null default '[]'::jsonb,
  qa jsonb,
  cost_usd numeric(10, 5) not null default 0,
  credits_charged integer not null default 0,
  attempts integer not null default 0,
  lease_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz
);

create unique index if not exists long_form_scene_images_current_uq
  on public.long_form_scene_images (project_id, beat_plan_version_id, beat_sequence) where is_current;
create index if not exists long_form_scene_images_project_idx on public.long_form_scene_images (project_id, beat_plan_version_id);
create index if not exists long_form_scene_images_lease_idx on public.long_form_scene_images (status, lease_until) where status in ('queued', 'rendering');

alter table public.long_form_scene_images enable row level security;
drop policy if exists "owner reads scene images" on public.long_form_scene_images;
create policy "owner reads scene images" on public.long_form_scene_images
  for select to authenticated
  using (exists (select 1 from public.long_form_projects p where p.id = project_id and p.user_id = auth.uid()));
-- Writes go through edge functions (service role) only.
revoke insert, update, delete on public.long_form_scene_images from authenticated, anon;

-- Atomic claim of the next queued scene (or a specific one) for a worker.
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
      where project_id = p_project_id and is_current and status = 'queued'
        and (p_scene_id is null or id = p_scene_id)
      order by beat_sequence
      limit 1
      for update skip locked)
  returning s.*;
end $$;
revoke all on function public.claim_long_form_scene_image(uuid, uuid, integer) from public, anon, authenticated;
