-- Isolated temporary project inside BEGIN/ROLLBACK. Does not alter Mars, Script or Research.
do $$
declare p public.long_form_projects; src public.long_form_visual_plan_versions; saved public.long_form_visual_plan_versions;
  fixture_project uuid:=gen_random_uuid(); fixture_plan uuid:=gen_random_uuid(); fixture_discovery uuid:=gen_random_uuid(); before_beat jsonb; after_beat jsonb; patch jsonb; owner_id uuid;
begin
  select * into src from public.long_form_visual_plan_versions where parent_visual_plan_version_id='eb25a8ee-9785-4b16-9e48-0a44c723d2a0' and meta->>'source'='deterministic_shot_refinement' order by version desc limit 1;
  assert src.status='ready','ready source required';
  select * into p from public.long_form_projects where id=src.project_id;
  owner_id:=p.user_id;
  insert into public.long_form_discovery_sessions select (jsonb_populate_record(null::public.long_form_discovery_sessions,to_jsonb(d)||jsonb_build_object('id',fixture_discovery))).* from public.long_form_discovery_sessions d where d.id=p.discovery_session_id;
  insert into public.long_form_projects(id,user_id,discovery_session_id,topic,current_script_version_id) values(fixture_project,p.user_id,fixture_discovery,'transaction-only storyboard edit test',src.script_version_id);
  insert into public.long_form_visual_plan_versions(id,project_id,script_version_id,version,status,stage,visual_plan,entity_registry,continuity_groups,world_state_model,visual_mode,storyboard_summary,meta)
  values(fixture_plan,fixture_project,src.script_version_id,1,'ready','finalizing',src.visual_plan,src.entity_registry,src.continuity_groups,src.world_state_model,src.visual_mode,src.storyboard_summary,src.meta);
  update public.long_form_projects set current_visual_plan_version_id=fixture_plan where id=fixture_project;
  before_beat:=src.visual_plan->'visualBeats'->0;
  patch:=jsonb_build_object('beatId',before_beat->>'id','informationToCommunicate','User-authored close view of the morning lights.','shotSize','CLOSE','visualType',before_beat->>'visualType','locationId',before_beat->'locationId','characterIds','[]'::jsonb);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  saved:=public.save_storyboard_edits(fixture_plan,jsonb_build_array(patch));
  after_beat:=saved.visual_plan->'visualBeats'->0;
  assert saved.id<>fixture_plan and saved.parent_visual_plan_version_id=fixture_plan and saved.version=2,'new immutable version';
  assert after_beat->>'informationToCommunicate'=patch->>'informationToCommunicate' and after_beat->>'shotSize'='CLOSE','visual edit saved';
  assert after_beat->'narrationRanges'=before_beat->'narrationRanges' and after_beat->'narrationSegmentIds'=before_beat->'narrationSegmentIds' and after_beat->'estimatedStartSeconds'=before_beat->'estimatedStartSeconds' and after_beat->'estimatedEndSeconds'=before_beat->'estimatedEndSeconds','narration link and range retained';
  assert after_beat->'factualVisualConstraints'=before_beat->'factualVisualConstraints' and after_beat->'forbiddenElements'=before_beat->'forbiddenElements' and after_beat->'revealConstraints'=before_beat->'revealConstraints','grounding retained';
  assert (select visual_plan=src.visual_plan from public.long_form_visual_plan_versions where id=fixture_plan),'source immutable';
  assert (saved.meta->>'modelCalls')::int=0,'zero model calls';
  assert (select current_visual_plan_version_id=saved.id from public.long_form_projects where id=fixture_project),'new dependency pointer';
  begin
    perform public.save_storyboard_edits(fixture_plan,jsonb_build_array(patch));
    raise exception 'TEST: stale source accepted';
  exception when others then if sqlerrm='TEST: stale source accepted' then raise; end if; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin
    perform public.save_storyboard_edits(saved.id,jsonb_build_array(patch));
    raise exception 'TEST: non-owner accepted';
  exception when others then if sqlerrm='TEST: non-owner accepted' then raise; end if; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  begin
    perform public.save_storyboard_edits(saved.id,jsonb_build_array(patch||'{"narrationSegmentIds":[]}'::jsonb));
    raise exception 'TEST: narration injection accepted';
  exception when others then if sqlerrm='TEST: narration injection accepted' then raise; end if; end;
end $$;
select 'Version, provenance, narration, grounding, ownership, stale-source and zero-call assertions passed; transaction rolls back' as result;

