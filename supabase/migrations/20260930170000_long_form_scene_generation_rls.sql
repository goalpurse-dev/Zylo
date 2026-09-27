-- URGENT SECURITY FIX: long_form_scene_render_plans, long_form_scenes and
-- long_form_episode_generation_charges were created (Phase J / this
-- session) WITHOUT row level security enabled. Supabase's default anon/
-- authenticated grants on a new public table are full CRUD with no RLS —
-- confirmed via information_schema.role_table_grants that both anon AND
-- authenticated held SELECT/INSERT/UPDATE/DELETE/TRUNCATE on these tables,
-- meaning ANY visitor (including unauthenticated) could read, modify or
-- delete ANY user's scene data via the public PostgREST API. This mirrors
-- the exact same real incident structurally as if long_form_reference_
-- assets had shipped without its own RLS policy — it did not (see that
-- table's "Users can view their own project's reference assets" policy,
-- which this migration copies verbatim in shape). Read-only for clients;
-- every actual write already goes through a service-role edge function
-- (start-long-form-scene-generation / advance-long-form-scene-generation /
-- approve|retry|edit-long-form-scene / charge-long-form-episode-generation),
-- never a direct client-side table write — so revoking INSERT/UPDATE/DELETE
-- from anon/authenticated changes no legitimate behavior.

alter table public.long_form_scene_render_plans enable row level security;
alter table public.long_form_scenes enable row level security;
alter table public.long_form_episode_generation_charges enable row level security;

revoke insert, update, delete, truncate, references, trigger on public.long_form_scene_render_plans from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.long_form_scenes from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.long_form_episode_generation_charges from anon, authenticated;
revoke all on public.long_form_scene_render_plans from anon;
revoke all on public.long_form_scenes from anon;
revoke all on public.long_form_episode_generation_charges from anon;

create policy "Users can view their own project's scene render plans" on public.long_form_scene_render_plans
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_scene_render_plans.project_id and p.user_id = auth.uid()));

create policy "Users can view their own project's scenes" on public.long_form_scenes
  for select using (exists (
    select 1 from public.long_form_visual_world_versions v
    join public.long_form_projects p on p.id = v.project_id
    where v.id = long_form_scenes.visual_world_version_id and p.user_id = auth.uid()
  ));

create policy "Users can view their own project's episode charges" on public.long_form_episode_generation_charges
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_episode_generation_charges.project_id and p.user_id = auth.uid()));
