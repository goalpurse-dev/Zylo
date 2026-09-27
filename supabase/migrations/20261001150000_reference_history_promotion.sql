-- Visual World reference history promotion.
-- Selecting an older succeeded image creates a zero-cost canonical alias
-- at the head of the same slot lineage. No provider job is created, no
-- image bytes are copied, and every later/earlier row remains immutable.

alter table public.long_form_reference_assets
  drop constraint if exists long_form_reference_assets_generation_reason_check;

alter table public.long_form_reference_assets
  add constraint long_form_reference_assets_generation_reason_check
  check (generation_reason in ('INITIAL','REBUILD_WORLD','USER_REGENERATE','SYSTEM_REPAIR','HISTORY_PROMOTION'));

create or replace function public.promote_long_form_reference_asset_version(p_asset_id uuid)
returns public.long_form_reference_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen public.long_form_reference_assets;
  current_asset public.long_form_reference_assets;
  promoted public.long_form_reference_assets;
  owner_id uuid;
begin
  select a.* into chosen
  from public.long_form_reference_assets a
  where a.id = p_asset_id
  for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;

  select p.user_id into owner_id
  from public.long_form_visual_world_versions w
  join public.long_form_projects p on p.id = w.project_id
  where w.id = chosen.visual_world_version_id;
  if owner_id is distinct from auth.uid() then raise exception 'FORBIDDEN'; end if;
  if chosen.status <> 'succeeded' or chosen.result_url is null then raise exception 'REFERENCE_VERSION_NOT_USABLE'; end if;

  select a.* into current_asset
  from public.long_form_reference_assets a
  where a.visual_world_version_id = chosen.visual_world_version_id
    and a.entity_id = chosen.entity_id
    and a.angle_or_view = chosen.angle_or_view
    and not exists (
      select 1 from public.long_form_reference_assets child
      where child.replaces_asset_id = a.id
    )
  order by a.created_at desc
  limit 1
  for update;

  if current_asset.id is null then raise exception 'CURRENT_REFERENCE_NOT_FOUND'; end if;
  if current_asset.id = chosen.id then return current_asset; end if;
  if current_asset.status in ('pending','running') then raise exception 'REFERENCE_SLOT_BUSY'; end if;

  insert into public.long_form_reference_assets(
    visual_world_version_id, entity_id, reference_type, angle_or_view,
    status, result_url, render_model, prompt_snapshot,
    input_reference_asset_ids, cost_usd, replaces_asset_id,
    qa_expectations, qa_status, qa_result, generation_type,
    source_reference_asset_id, source_visual_world_version_id, reuse_reason,
    manual_approval, manual_approval_user_id, manual_approval_at,
    generation_reason, stale
  ) values (
    chosen.visual_world_version_id, chosen.entity_id, chosen.reference_type, chosen.angle_or_view,
    'succeeded', chosen.result_url, chosen.render_model, chosen.prompt_snapshot,
    chosen.input_reference_asset_ids, 0, current_asset.id,
    chosen.qa_expectations,
    case when chosen.qa_status = 'rejected' and not chosen.manual_approval then 'rejected' else coalesce(chosen.qa_status, 'approved') end,
    chosen.qa_result, coalesce(chosen.generation_type, 'provider'),
    chosen.id, chosen.visual_world_version_id, 'history_promotion',
    chosen.manual_approval, chosen.manual_approval_user_id, chosen.manual_approval_at,
    'HISTORY_PROMOTION', false
  ) returning * into promoted;

  perform public.reconcile_visual_world_completion_status(chosen.visual_world_version_id);
  return promoted;
end $$;

revoke all on function public.promote_long_form_reference_asset_version(uuid) from public, anon;
grant execute on function public.promote_long_form_reference_asset_version(uuid) to authenticated;

