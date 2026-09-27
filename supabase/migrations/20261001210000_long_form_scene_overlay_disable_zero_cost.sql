-- 2026-09-22 "FINAL stabilization pass" §0/§10 — overlays must be a
-- user-controllable step with ZERO image-provider cost, stored separately
-- from the base image, and history-preserving (never destroys the prior
-- attempt). This is the disable/"use no overlay" half of that: reverts a
-- scene's displayed frame to its clean base_result_url without touching
-- base_result_url itself, WITHOUT any provider call, by creating a new
-- history row via the SAME replaces_scene_id chain every retry/edit
-- already uses — reusing 100% of the existing current-scene-resolution
-- (current_scene_for_render_plan), history (buildSceneHistory), and
-- display-URL (resolveSceneDisplayUrl) infrastructure, rather than a new
-- overlay-history table. credits_charged is always 0 (no image-provider
-- call is ever made here) and cost_usd is always 0.
--
-- Re-enabling a previously-disabled overlay is intentionally NOT built in
-- this function — it would need to either recomposite (a real, if
-- zero-cost, code path) or look back through scene history for the most
-- recent overlay_applied=true row's final_result_url. Deliberately scoped
-- out of this pass (see final report) as the smaller, safe next slice; the
-- history chain this function writes already preserves everything a
-- follow-up would need to implement it without any further migration.
--
-- PENDING: this migration is written and code-complete but has NOT been
-- applied to the production database — supabase db push is currently
-- blocked by an unrelated migration-history bookkeeping mismatch (14
-- remote-only entries with no local file) that requires `supabase
-- migration repair`, explicitly not run without direct user approval. See
-- the final report's migration status table.
create or replace function public.disable_long_form_scene_overlay(p_scene_id uuid, p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; owner_id uuid; replacement_id uuid;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  -- Only a genuinely approved scene with both a base image and a currently
  -- applied overlay is eligible — never touches a scene still pending QA,
  -- never touches one that never had an overlay in the first place (a
  -- true no-op, not an error, since the desired end state already holds).
  if sc.status <> 'succeeded' or sc.qa_status <> 'approved' then raise exception 'SCENE_NOT_APPROVED'; end if;
  if sc.base_result_url is null then raise exception 'NO_BASE_IMAGE'; end if;
  if not sc.overlay_applied then return sc.id; end if;
  insert into public.long_form_scenes(
    scene_render_plan_id, visual_world_version_id, visual_beat_id, render_strategy, replaces_scene_id,
    credits_charged, input_reference_asset_ids, generation_run_id, reference_bundle_id,
    status, result_url, base_result_url, final_result_url, overlay_applied, qa_status, qa_result, cost_usd, render_model
  )
  values(
    sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, sc.render_strategy, sc.id,
    0, sc.input_reference_asset_ids, sc.generation_run_id, sc.reference_bundle_id,
    'succeeded', sc.result_url, sc.base_result_url, sc.base_result_url, false, sc.qa_status, sc.qa_result, 0, sc.render_model
  )
  returning id into replacement_id;
  return replacement_id;
end $$;
revoke all on function public.disable_long_form_scene_overlay(uuid, uuid) from public, anon, authenticated;
grant execute on function public.disable_long_form_scene_overlay(uuid, uuid) to authenticated, service_role;
