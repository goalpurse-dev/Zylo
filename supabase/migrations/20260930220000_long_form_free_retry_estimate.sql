-- Part 5/6 of the scene-reliability pass: the displayed Regenerate cost
-- must match what the server will ACTUALLY charge — a scene that failed
-- BEFORE any provider job was created (job_id still null) resumes for FREE
-- via retry_long_form_scene's own pre-dispatch branch, so the modal's
-- "Try Again" must show no credit cost for exactly that case, not the
-- tier's normal regenerate price. Adds a `freeRetry` flag the frontend uses
-- to decide between "Try Again" (free) and "Regenerate [cost]" (paid) —
-- credits stays 0 whenever freeRetry is true, so old callers reading only
-- `credits` still get the right number either way.
create or replace function public.estimate_scene_operation_credits(p_scene_id uuid, p_operation text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare sc public.long_form_scenes; rp public.long_form_scene_render_plans; v public.long_form_visual_world_versions; free_retry boolean;
begin
  if p_operation not in ('regenerate', 'edit') then raise exception 'INVALID_OPERATION'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  if not exists (select 1 from public.long_form_projects p where p.id = v.project_id and (p.user_id = auth.uid() or auth.role() = 'service_role')) then
    raise exception 'SCENE_NOT_FOUND';
  end if;
  if p_operation = 'edit' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'edit', 'model', 'image:qwen.image-edit-plus', 'freeRetry', false);
  end if;
  free_retry := sc.status = 'failed' and sc.job_id is null;
  if free_retry then
    return jsonb_build_object('credits', 0, 'tier', rp.render_tier, 'operation', 'regenerate', 'model', case when sc.render_strategy = 'EDIT' then 'image:qwen.image-edit-plus' else public.long_form_tier_primary_tool_key(rp.render_tier) end, 'freeRetry', true);
  end if;
  if sc.render_strategy = 'EDIT' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', 'image:qwen.image-edit-plus', 'freeRetry', false);
  end if;
  return jsonb_build_object('credits', public.long_form_tier_generate_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', public.long_form_tier_primary_tool_key(rp.render_tier), 'freeRetry', false);
end $$;
