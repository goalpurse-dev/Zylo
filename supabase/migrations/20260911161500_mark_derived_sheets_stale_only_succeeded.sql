-- Real bug caught by tests/sheetPackV4IdentityDependency.lifecycle.sql
-- before this ever reached production: mark_derived_sheets_stale_and_requeue
-- matched ANY current row with input_reference_asset_ids not containing the
-- new identity — including a row that hasn't dispatched yet (status
-- pending/running), which naturally has NULL input_reference_asset_ids
-- until dispatch populates it. A second invocation (e.g. a rapid duplicate
-- approval event) would treat that still-pending, freshly-queued
-- replacement as ITSELF stale and re-queue yet another replacement,
-- cascading. A row that hasn't actually generated anything yet has nothing
-- stale about it — it will pick up whatever identity is current the moment
-- it dispatches (stageGenerating always resolves the anchor fresh). Only a
-- status='succeeded' row (concrete content tied to a specific identity) can
-- meaningfully be "stale".
create or replace function public.mark_derived_sheets_stale_and_requeue(p_world uuid, p_entity text, p_new_identity_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
  for r in
    select a.id, a.angle_or_view from public.long_form_reference_assets a
    where a.visual_world_version_id = p_world
      and a.entity_id = p_entity
      and a.angle_or_view in ('face_sheet','profile_silhouette_sheet')
      and a.status = 'succeeded'
      and a.stale = false
      and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id = a.id)
      and (a.input_reference_asset_ids is null or not (a.input_reference_asset_ids @> array[p_new_identity_id]))
  loop
    update public.long_form_reference_assets set stale = true, updated_at = now() where id = r.id;
    insert into public.long_form_reference_assets(visual_world_version_id, entity_id, reference_type, angle_or_view, replaces_asset_id, status)
    values (p_world, p_entity, 'character_reference', r.angle_or_view, r.id, 'pending');
  end loop;
end $$;
revoke all on function public.mark_derived_sheets_stale_and_requeue(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mark_derived_sheets_stale_and_requeue(uuid,text,uuid) to service_role;
