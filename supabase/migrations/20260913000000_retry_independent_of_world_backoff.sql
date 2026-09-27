-- Real incident: Profile/Silhouette's "Try Again" button appeared unusable
-- while Face was independently stuck (SHEET_ROLE_CONTRACT_MISMATCH,
-- unrelated). Root cause: replace_long_form_reference_asset's
-- `if v.worker_lock_until > now() then raise exception 'WORLD_BUSY'` ties
-- retrying ONE already-terminal (succeeded/failed) asset to whatever
-- backoff window the WORLD's own stage-orchestration is currently in,
-- regardless of cause — Face's unrelated failures kept pushing
-- worker_lock_until into the future, and every Profile retry attempt hit
-- this same gate. This check protects nothing the row-level `for update`
-- lock and the `replacement_id is not null -> return existing` idempotency
-- check don't already cover — removing it. The SEPARATE cross-VERSION
-- guard right below (don't touch this asset while a DIFFERENT visual world
-- version for the same project is planning/generating) is a genuinely
-- different concern and is kept unchanged.
create or replace function public.replace_long_form_reference_asset(p_asset_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; replacement_id uuid; owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id from public.long_form_reference_assets where replaces_asset_id=a.id;
  if replacement_id is not null then return replacement_id; end if;
  if a.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if v.stage='planning' or exists(select 1 from public.long_form_visual_world_versions other where other.project_id=v.project_id and other.id<>v.id and other.status in ('planning','generating')) then raise exception 'WORLD_BUSY'; end if;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,replaces_asset_id,render_model)
  values(a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,a.id,a.render_model) returning id into replacement_id;
  update public.long_form_visual_world_versions set status='generating',stage='generating',stage_attempt=0,worker_lock_until=null,last_error_code=null,updated_at=now() where id=v.id;
  return replacement_id;
end $$;
revoke all on function public.replace_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.replace_long_form_reference_asset(uuid,uuid) to service_role;
