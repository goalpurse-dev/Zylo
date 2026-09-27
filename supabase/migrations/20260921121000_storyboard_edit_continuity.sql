create or replace function public.save_storyboard_edits(p_source_id uuid,p_patches jsonb)
returns public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare src public.long_form_visual_plan_versions; dest public.long_form_visual_plan_versions; owner public.long_form_projects;
  patch jsonb; beat jsonb; beats jsonb; updated jsonb; chars jsonb; n int; pos int; changed boolean; seen text[]:=array[]::text[]; established text[]:=array[]::text[]; normalized jsonb; final_plan jsonb; summary jsonb;
begin
  select * into src from public.long_form_visual_plan_versions where id=p_source_id;
  select * into owner from public.long_form_projects where id=src.project_id and user_id=auth.uid() for update;
  if not found or src.status<>'ready' then raise exception 'Storyboard unavailable'; end if;
  if owner.current_script_version_id<>src.script_version_id or owner.current_visual_plan_version_id is distinct from src.id then raise exception 'Storyboard changed. Refresh before saving.'; end if;
  if exists(select 1 from public.long_form_visual_plan_versions where project_id=src.project_id and script_version_id=src.script_version_id and status='planning') then raise exception 'Wait for the new storyboard before editing.'; end if;
  if jsonb_typeof(p_patches)<>'array' or jsonb_array_length(p_patches) not between 1 and 300 then raise exception 'Invalid edits'; end if;
  beats:=src.visual_plan->'visualBeats';
  for patch in select value from jsonb_array_elements(p_patches) loop
    if exists(select 1 from jsonb_object_keys(patch) k where k not in ('beatId','informationToCommunicate','shotSize','visualType','locationId','characterIds')) then raise exception 'Unsupported edit field'; end if;
    if patch->>'beatId'=any(seen) then raise exception 'Duplicate beat edit'; end if;
    seen:=array_append(seen,patch->>'beatId');
    select value,(ordinality-1)::int into beat,pos from jsonb_array_elements(beats) with ordinality where value->>'id'=patch->>'beatId';
    if not found then raise exception 'Unknown beat'; end if;
    if src.visual_plan->>'shotPlannerVersion' is not null and ((patch->>'shotSize' in ('DETAIL','INSERT')) or patch->>'visualType'='OBJECT_DETAIL') and (beat->>'estimatedEndSeconds')::numeric-(beat->>'estimatedStartSeconds')::numeric>7 then raise exception 'This timing needs a wider shot with visual motion; choose Close-up or retain the current type.'; end if;
    if length(trim(coalesce(patch->>'informationToCommunicate',''))) not between 1 and 3000
      or coalesce(patch->>'shotSize','') not in ('WIDE','MEDIUM','CLOSE','DETAIL','INSERT')
      or coalesce(patch->>'visualType','') not in ('STORY_ILLUSTRATION','ENVIRONMENT','CHARACTER','OBJECT_DETAIL','DIAGRAM','MAP','COMPARISON','CUTAWAY','TIMELINE','PROGRAMMATIC_GRAPHIC') then raise exception 'Invalid description, shot or visual type'; end if;
    if patch->>'locationId' is not null and not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->>'id'=patch->>'locationId' and e->>'category'='LOCATION') then raise exception 'Unknown location'; end if;
    chars:=coalesce(patch->'characterIds','[]');
    if jsonb_typeof(chars)<>'array' or exists(select 1 from jsonb_array_elements_text(chars) c where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->>'id'=c and e->>'category'='CHARACTER')) then raise exception 'Unknown character'; end if;
    changed:=true; -- A user-authored scene must not reuse a stale generated composition.
    updated:=beat||jsonb_build_object('informationToCommunicate',trim(patch->>'informationToCommunicate'),'shotSize',patch->>'shotSize','visualType',patch->>'visualType','locationId',patch->'locationId',
      'primaryEntityIds',coalesce((select jsonb_agg(ids.value) from jsonb_array_elements(beat->'primaryEntityIds') ids where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->'id'=ids.value and e->>'category'='CHARACTER')),'[]')||chars,
      'supportingEntityIds',coalesce((select jsonb_agg(ids.value) from jsonb_array_elements(beat->'supportingEntityIds') ids where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->'id'=ids.value and e->>'category'='CHARACTER')),'[]'));
    -- Geometry/type changes become an independent setup, never an invalid reuse of the old camera/location.
    if changed then updated:=updated||jsonb_build_object('baseSetupKey',case when patch->>'visualType' in ('DIAGRAM','MAP','COMPARISON','TIMELINE','PROGRAMMATIC_GRAPHIC') then null else 'user_'||gen_random_uuid()::text end,'continuityGroupId',null,'deltaInstruction',null,'shotStrategy',case patch->>'visualType' when 'DIAGRAM' then 'DIAGRAM' when 'MAP' then 'MAP' when 'COMPARISON' then 'COMPARISON' when 'PROGRAMMATIC_GRAPHIC' then 'TEXT_INFOGRAPHIC' when 'OBJECT_DETAIL' then 'DETAIL' else 'NEW_SETUP' end,'renderMethod',case when patch->>'visualType' in ('DIAGRAM','MAP','COMPARISON','TIMELINE','PROGRAMMATIC_GRAPHIC') then 'PROGRAMMATIC_GRAPHIC' else 'GENERATE' end); end if;
    updated:=updated-'productionFrame'; -- An edit invalidates any reference-backed frame tied to the old shot.
    updated:=updated||jsonb_build_object('sketchContext',jsonb_build_object('key',coalesce(updated->>'baseSetupKey',updated->>'id'),'environment',coalesce((select e->>'name' from jsonb_array_elements(src.entity_registry) e where e->>'id'=patch->>'locationId'),'')||' '||(patch->>'informationToCommunicate'),'characterCount',jsonb_array_length(chars)));
    beats:=jsonb_set(beats,array[pos::text],updated);
  end loop;
  normalized:='[]';
  for beat in select value from jsonb_array_elements(beats) loop
    if beat->>'baseSetupKey' is not null then
      if beat->>'shotStrategy'='REUSE_WITH_DELTA' and not (beat->>'baseSetupKey'=any(established)) then
        beat:=beat||jsonb_build_object('shotStrategy','NEW_SETUP','renderMethod','GENERATE','deltaInstruction',null);
      end if;
      established:=array_append(established,beat->>'baseSetupKey');
    end if;
    normalized:=normalized||jsonb_build_array(beat);
  end loop;
  beats:=normalized;
  select jsonb_build_object('totalVisualBeats',jsonb_array_length(beats),'totalSequences',coalesce(jsonb_array_length(src.visual_plan->'visualSequences'),0),'estimatedBaseSetups',count(distinct b->>'baseSetupKey') filter(where b->>'renderMethod'='GENERATE'),'estimatedEdits',count(*) filter(where b->>'renderMethod'='EDIT'),'estimatedReuseEvents',count(*) filter(where b->>'renderMethod'='REUSE'),'estimatedCrops',count(*) filter(where b->>'renderMethod'='CROP'),'estimatedDiagrams',count(*) filter(where b->>'visualType'='DIAGRAM'),'estimatedMaps',count(*) filter(where b->>'visualType'='MAP'),'estimatedProgrammaticGraphics',count(*) filter(where b->>'renderMethod'='PROGRAMMATIC_GRAPHIC')) into summary from jsonb_array_elements(beats) b;
  final_plan:=jsonb_set(src.visual_plan,'{visualBeats}',beats);
  final_plan:=final_plan||jsonb_build_object('productionAssets',coalesce((select jsonb_agg(jsonb_build_object('setupKey',b->>'baseSetupKey','establishingShotId',b->>'id','locationId',b->'locationId','entityIds',(b->'primaryEntityIds')||(b->'supportingEntityIds'))) from jsonb_array_elements(beats) b where b->>'renderMethod'='GENERATE'),'[]'::jsonb));
  if final_plan->'densityDiagnostics' is not null then final_plan:=jsonb_set(final_plan,'{densityDiagnostics}',(final_plan->'densityDiagnostics')||jsonb_build_object('expectedBaseImages',summary->'estimatedBaseSetups','expectedEdits',summary->'estimatedEdits','expectedReuse',summary->'estimatedReuseEvents','expectedCrops',summary->'estimatedCrops','expectedProgrammaticGraphics',summary->'estimatedProgrammaticGraphics')); end if;
  select coalesce(max(version),0)+1 into n from public.long_form_visual_plan_versions where project_id=src.project_id and script_version_id=src.script_version_id;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version,status,stage,parent_visual_plan_version_id,visual_mode,visual_plan,entity_registry,continuity_groups,world_state_model,storyboard_summary,generation_model,meta)
  values(src.project_id,src.script_version_id,n,'ready','finalizing',src.id,src.visual_mode,final_plan,src.entity_registry,src.continuity_groups,src.world_state_model,summary,
    src.generation_model,jsonb_build_object('source','user_edit','sourceVersionId',src.id,'editedBeatIds',to_jsonb(seen),'modelCalls',0,'estimatedTotalCostUsd',0)) returning * into dest;
  update public.long_form_projects set current_visual_plan_version_id=dest.id,updated_at=now() where id=src.project_id;
  return dest;
end $$;
revoke all on function public.save_storyboard_edits(uuid,jsonb) from public,anon;
grant execute on function public.save_storyboard_edits(uuid,jsonb) to authenticated;


create or replace function public.start_visual_plan_version(p_project_id uuid,p_user_id uuid,p_regenerate boolean default false)
returns public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare p public.long_form_projects; v public.long_form_visual_plan_versions; n int;
begin
  select * into p from public.long_form_projects where id=p_project_id and user_id=p_user_id for update;
  if not found then raise exception 'Project not found'; end if;
  if not exists(select 1 from public.long_form_script_versions where id=p.current_script_version_id and status='ready') then raise exception 'SCRIPT_NOT_READY'; end if;
  select * into v from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id and meta->>'supersededBy' is null order by (status='planning') desc,version desc limit 1;
  if found and (v.status='planning' or not p_regenerate) then return v; end if;
  select coalesce(max(version),0)+1 into n from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id;
  if (select count(*) from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id and parent_visual_plan_version_id is null)>=6 then raise exception 'TOO_MANY_VERSIONS'; end if;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version) values(p.id,p.current_script_version_id,n) returning * into v;
  return v;
end $$;
revoke all on function public.start_visual_plan_version(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.start_visual_plan_version(uuid,uuid,boolean) to service_role;


