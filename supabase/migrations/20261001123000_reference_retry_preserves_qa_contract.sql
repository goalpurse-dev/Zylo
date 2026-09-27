-- A retry is the same logical reference role. Preserve its QA contract so
-- successful replacements cannot bypass automated review before the visual
-- world finalizes.
create or replace function public.retry_long_form_reference_asset(p_asset_id uuid,p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.long_form_reference_assets;
  v public.long_form_visual_world_versions;
  replacement_id uuid;
  owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;

  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id
  from public.long_form_reference_assets
  where replaces_asset_id=a.id
  order by created_at desc limit 1;
  if replacement_id is not null then return replacement_id; end if;

  if a.status in ('pending','running') then return a.id; end if;
  if a.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if v.stage='planning' or exists(
    select 1 from public.long_form_visual_world_versions other
    where other.project_id=v.project_id and other.id<>v.id
      and other.status in ('planning','generating')
  ) then raise exception 'WORLD_BUSY'; end if;

  if a.status='failed' and a.job_id is null then
    update public.long_form_reference_assets
    set status='pending',claim_attempts=0,lease_until=null,
        last_error_code=null,last_error_at=null,updated_at=now()
    where id=a.id;
    replacement_id := a.id;
  else
    insert into public.long_form_reference_assets(
      visual_world_version_id,entity_id,reference_type,angle_or_view,
      replaces_asset_id,render_model,qa_expectations
    ) values(
      a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,
      a.id,a.render_model,a.qa_expectations
    ) returning id into replacement_id;
  end if;

  update public.long_form_visual_world_versions
  set status='generating',stage='generating',stage_attempt=0,
      stage_started_at=now(),worker_lock_until=null,
      last_error_code=null,last_error_at=null,updated_at=now()
  where id=v.id;
  return replacement_id;
end $$;

revoke all on function public.retry_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_long_form_reference_asset(uuid,uuid) to service_role;
