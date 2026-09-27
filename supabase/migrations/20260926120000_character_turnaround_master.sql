-- Additive provenance. Existing assets and their replacement chains remain intact.
alter table public.long_form_reference_assets
  add column generation_type text not null default 'provider',
  add column source_master_asset_id uuid references public.long_form_reference_assets(id),
  add column source_crop_key text,
  add column source_crop_rect jsonb;
alter table public.long_form_reference_assets add constraint reference_crop_provenance check (
  generation_type <> 'deterministic_crop' or
  (source_master_asset_id is not null and source_crop_key is not null and source_crop_rect is not null and cost_usd=0 and job_id is null)
);
create unique index reference_master_cell_unique on public.long_form_reference_assets(source_master_asset_id,source_crop_key);
-- One controlled experiment per character/world, including failed attempts.
create unique index reference_master_experiment_unique on public.long_form_reference_assets(visual_world_version_id,entity_id) where generation_type='turnaround_master';

create or replace function public.enqueue_character_turnaround(p_anchor_id uuid,p_prompt text,p_appearance_lock text,p_include_pose boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; p public.long_form_projects; mid uuid; prior jsonb;
begin
  select * into a from public.long_form_reference_assets where id=p_anchor_id;
  if not found or a.status<>'succeeded' or a.reference_type<>'character_reference' or a.angle_or_view<>'three_quarter_neutral' then raise exception 'READY_ANCHOR_REQUIRED'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select id into mid from public.long_form_reference_assets where visual_world_version_id=v.id and entity_id=a.entity_id and generation_type='turnaround_master';
  if mid is not null then return mid; end if;
  if v.status<>'ready' then raise exception 'WORLD_NOT_READY'; end if;
  if not exists(select 1 from public.long_form_visual_plan_versions vp, jsonb_array_elements(vp.entity_registry) e where vp.id=v.visual_plan_version_id and e->>'id'=a.entity_id and e->>'importance'='HERO') then raise exception 'HERO_REQUIRED'; end if;
  if exists(select 1 from public.long_form_reference_assets r where r.replaces_asset_id=a.id) then raise exception 'STALE_ANCHOR'; end if;
  if length(p_prompt) not between 100 and 10000 or length(p_appearance_lock) not between 20 and 4000 then raise exception 'INVALID_PROMPT'; end if;
  select * into p from public.long_form_projects where id=v.project_id;
  select coalesce(jsonb_object_agg(r.angle_or_view,r.id),'{}') into prior from public.long_form_reference_assets r where r.visual_world_version_id=v.id and r.entity_id=a.entity_id and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=r.id);
  mid:=gen_random_uuid();
  insert into public.long_form_reference_assets(id,visual_world_version_id,entity_id,reference_type,angle_or_view,status,claim_attempts,render_model,prompt_snapshot,generation_type,qa_expectations)
  values(mid,v.id,a.entity_id,'character_reference','turnaround_master','running',1,'runware:400@6',p_prompt,'turnaround_master',jsonb_build_object('strategy','MULTIVIEW_MASTER','reviewStatus','pending','automatedVisionPerformed',false,'generatedTextForbidden',true,'neutralBackgroundExpected',true,'comparisonAnchorId',a.id,'appearanceLock',p_appearance_lock,'includePose',p_include_pose,'previousRoleAssets',prior));
  insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values(mid,p.user_id,'image','image:flux2.klein9bkv',null,p_prompt,
    jsonb_build_object('tool_key','image:flux2.klein9bkv','credits',0,'priceUSD',0,'creation_type','photo','long_form_internal',true,'long_form_reference_asset_id',mid),
    jsonb_build_object('tool','image','subject',p_prompt,'style',null,'creation_type','photo','negative',null,'brand',jsonb_build_object('id',null,'use_palette',false),'init_image_url',null,'width',1536,'height',1024),
    'queued',0,0,false,9,'free','runware',0,1,now());
  update public.long_form_reference_assets set job_id=mid where id=mid;
  return mid;
end $$;
revoke all on function public.enqueue_character_turnaround(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_character_turnaround(uuid,text,text,boolean) to service_role;

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
    for c in select * from public.long_form_reference_assets where source_master_asset_id=m.id loop
      old_id:=(m.qa_expectations->'previousRoleAssets'->>c.angle_or_view)::uuid;
      if exists(select 1 from public.long_form_reference_assets r where r.visual_world_version_id=m.visual_world_version_id and r.entity_id=m.entity_id and r.angle_or_view=c.angle_or_view and r.source_master_asset_id is distinct from m.id and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=r.id) and r.id is distinct from old_id) then raise exception 'ROLE_CHANGED_DURING_REVIEW'; end if;
      update public.long_form_reference_assets set replaces_asset_id=old_id,qa_expectations=qa_expectations||jsonb_build_object('reviewStatus','approved'),updated_at=now() where id=c.id;
    end loop;
    select jsonb_agg(jsonb_build_object('angle',r.angle_or_view,'referenceType','character_reference','purpose',case r.angle_or_view when 'three_quarter_neutral' then 'Identity anchor' when 'profile' then 'Side reference' when 'back' then 'Rear reference' when 'face_closeup' then 'Identity detail' when 'outfit_detail' then 'Clothing/equipment' else 'Alternate pose' end) order by r.source_crop_rect->>'y',r.source_crop_rect->>'x') into views from public.long_form_reference_assets r where r.source_master_asset_id=m.id;
    update public.long_form_visual_world_versions set reference_plan=jsonb_set(reference_plan,'{entities}',(select jsonb_agg(case when e->>'entityId'=m.entity_id then e||jsonb_build_object('requiredViews',views,'importance','HERO','characterReferenceStrategy','MULTIVIEW_MASTER','turnaroundMasterAssetId',m.id) else e end) from jsonb_array_elements(reference_plan->'entities') e)) where id=m.visual_world_version_id;
  else
    update public.long_form_reference_assets set qa_expectations=qa_expectations||jsonb_build_object('reviewStatus','rejected'),updated_at=now() where source_master_asset_id=m.id;
  end if;
  update public.long_form_reference_assets set qa_expectations=qa_expectations||jsonb_build_object('reviewStatus',case when p_pass then 'approved' else 'rejected' end,'review',p_review,'reviewedAt',now()),updated_at=now() where id=m.id;
  return p_pass;
end $$;
revoke all on function public.review_character_turnaround(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.review_character_turnaround(uuid,boolean,jsonb) to service_role;
