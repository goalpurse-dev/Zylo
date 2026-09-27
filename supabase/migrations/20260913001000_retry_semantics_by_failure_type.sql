-- Part 7 of the reliability fix: retry semantics must depend on WHY a row
-- failed, not use one blind "always create a new row" Regenerate for
-- everything.
--   PRE-DISPATCH FAILURE (job_id is null — no provider request was ever
--   made): resume the SAME row. Nothing was generated, nothing to
--   supersede, $0 duplicate spend — reset it in place so the existing
--   claim/dispatch machinery just tries it again.
--   POST-DISPATCH FAILURE or QA REJECTION (job_id exists — a real provider
--   attempt happened): create a replacement row, exactly like the existing
--   replace_long_form_reference_asset, preserving the old one as history.
-- One entrypoint the frontend's "Try Again"/"Regenerate" action can always
-- call regardless of failure type — the row itself already tells us which
-- case applies via job_id, no separate classification needed client-side.
create or replace function public.retry_long_form_reference_asset(p_asset_id uuid, p_user_id uuid)
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

  if a.status='failed' and a.job_id is null then
    -- Pre-dispatch failure: no provider generation ever occurred for this
    -- row. Resume it in place rather than creating history for something
    -- that produced no result to preserve.
    update public.long_form_reference_assets
    set status='pending', claim_attempts=0, lease_until=null, last_error_code=null, last_error_at=null, updated_at=now()
    where id=a.id;
    replacement_id := a.id;
  else
    insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,replaces_asset_id,render_model)
    values(a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,a.id,a.render_model) returning id into replacement_id;
  end if;
  update public.long_form_visual_world_versions set status='generating',stage='generating',stage_attempt=0,worker_lock_until=null,last_error_code=null,updated_at=now() where id=v.id;
  return replacement_id;
end $$;
revoke all on function public.retry_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_long_form_reference_asset(uuid,uuid) to service_role;
