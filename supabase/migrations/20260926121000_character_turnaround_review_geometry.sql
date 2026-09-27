alter table public.long_form_reference_assets drop constraint reference_crop_provenance;
alter table public.long_form_reference_assets add constraint reference_crop_provenance check (
  generation_type <> 'deterministic_crop' or
  (source_master_asset_id is not null and source_crop_key is not null and source_crop_rect is not null and cost_usd is not null and cost_usd=0 and job_id is null)
);
create or replace function public.review_character_turnaround(p_master_id uuid,p_pass boolean,p_review jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare m public.long_form_reference_assets; c public.long_form_reference_assets; old_id uuid; expected integer; views jsonb;
begin
  select * into m from public.long_form_reference_assets where id=p_master_id for update;
  if not found or m.generation_type<>'turnaround_master' or m.status<>'succeeded' then raise exception 'READY_MASTER_REQUIRED'; end if;
  if m.qa_expectations->>'reviewStatus'<>'pending' then raise exception 'ALREADY_REVIEWED'; end if;
  perform 1 from public.long_form_visual_world_versions where id=m.visual_world_version_id for update;
  if p_pass then
    if not (p_review @> '{"sameIdentity":true,"profileCorrect":true,"backCorrect":true,"faceCorrect":true,"outfitStable":true,"neutralBackground":true,"noGeneratedText":true,"matchesExistingIdentity":true,"cellLayoutCorrect":true}'::jsonb) then raise exception 'ALL_QA_SIGNALS_REQUIRED'; end if;
    expected:=case when (m.qa_expectations->>'includePose')::boolean then 6 else 5 end;
    if (select count(*) from public.long_form_reference_assets where source_master_asset_id=m.id and status='succeeded' and result_url is not null)<>expected then raise exception 'CROPS_INCOMPLETE'; end if;
    if exists(select 1 from public.long_form_reference_assets r where r.source_master_asset_id=m.id and (r.source_crop_key is distinct from r.angle_or_view or r.source_crop_key not in ('three_quarter_neutral','profile','back','face_closeup','outfit_detail','action_pose') or r.source_crop_rect is distinct from jsonb_build_object('x',case r.source_crop_key when 'three_quarter_neutral' then 0 when 'profile' then 512 when 'back' then 1024 when 'face_closeup' then 0 when 'outfit_detail' then 512 else 1024 end,'y',case when r.source_crop_key in ('three_quarter_neutral','profile','back') then 0 else 512 end,'width',512,'height',512) or (r.source_crop_key='action_pose' and expected=5))) then raise exception 'CROP_GEOMETRY_MISMATCH'; end if;
    for c in select * from public.long_form_reference_assets where source_master_asset_id=m.id loop
      old_id:=(m.qa_expectations->'previousRoleAssets'->>c.angle_or_view)::uuid;
      if exists(select 1 from public.long_form_reference_assets r where r.visual_world_version_id=m.visual_world_version_id and r.entity_id=m.entity_id and r.angle_or_view=c.angle_or_view and r.source_master_asset_id is distinct from m.id and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=r.id) and r.id is distinct from old_id) then raise exception 'ROLE_CHANGED_DURING_REVIEW'; end if;
      update public.long_form_reference_assets set replaces_asset_id=old_id,qa_expectations=qa_expectations||jsonb_build_object('reviewStatus','approved'),updated_at=now() where id=c.id;
    end loop;
    select jsonb_agg(jsonb_build_object('angle',r.angle_or_view,'referenceType','character_reference','purpose',case r.angle_or_view when 'three_quarter_neutral' then 'Identity anchor' when 'profile' then 'Side reference' when 'back' then 'Rear reference' when 'face_closeup' then 'Identity detail' when 'outfit_detail' then 'Clothing/equipment' else 'Alternate pose' end) order by (r.source_crop_rect->>'y')::int,(r.source_crop_rect->>'x')::int) into views from public.long_form_reference_assets r where r.source_master_asset_id=m.id;
    update public.long_form_visual_world_versions set reference_plan=jsonb_set(reference_plan,'{entities}',(select jsonb_agg(case when e->>'entityId'=m.entity_id then e||jsonb_build_object('requiredViews',views,'importance','HERO','characterReferenceStrategy','MULTIVIEW_MASTER','turnaroundMasterAssetId',m.id) else e end) from jsonb_array_elements(reference_plan->'entities') e)) where id=m.visual_world_version_id;
  else
    update public.long_form_reference_assets set qa_expectations=qa_expectations||jsonb_build_object('reviewStatus','rejected'),updated_at=now() where source_master_asset_id=m.id;
  end if;
  update public.long_form_reference_assets set qa_expectations=qa_expectations||jsonb_build_object('reviewStatus',case when p_pass then 'approved' else 'rejected' end,'review',p_review,'reviewedAt',now()),updated_at=now() where id=m.id;
  return p_pass;
end $$;
revoke all on function public.review_character_turnaround(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.review_character_turnaround(uuid,boolean,jsonb) to service_role;

