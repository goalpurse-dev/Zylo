-- Run inside BEGIN / ROLLBACK only, after installing the migration within
-- that same transaction. No fake project/job can be seen by another worker.
do $$
declare source_project public.long_form_projects; d uuid; p uuid; s uuid; vp uuid; w uuid; a uuid; a2 uuid; j uuid; replacement uuid; again uuid; claimed public.long_form_reference_assets; payload jsonb; n integer;
begin
  select * into source_project from public.long_form_projects where current_story_plan_version_id is not null and current_research_version_id is not null limit 1;
  if not found then raise exception 'Test requires an existing research-ready context (read only)'; end if;
  insert into public.long_form_discovery_sessions(user_id) values(source_project.user_id) returning id into d;
  insert into public.long_form_projects(user_id,discovery_session_id,topic) values(source_project.user_id,d,'ROLLBACK ONLY Visual World lifecycle fixture') returning id into p;
  insert into public.long_form_script_versions(project_id,story_plan_version_id,research_version_id,version,status) values(p,source_project.current_story_plan_version_id,source_project.current_research_version_id,1,'ready') returning id into s;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version,status) values(p,s,1,'ready') returning id into vp;
  insert into public.long_form_visual_world_versions(project_id,script_version_id,visual_plan_version_id,version,status,stage) values(p,s,vp,1,'generating','generating') returning id into w;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view) values(w,'hero','character_reference','profile') returning id into a;
  select * into claimed from public.claim_long_form_reference_asset_for_version(w);
  if claimed.id<>a or claimed.claim_attempts<>1 or claimed.lease_until<=now() then raise exception 'Claim must increment and lease atomically'; end if;
  payload=jsonb_build_object('id',a,'user_id',source_project.user_id,'tool_key','image:flux.base','prompt','Synthetic test; never committed or rendered','settings',jsonb_build_object('credits',0,'long_form_internal',true),'input',jsonb_build_object('width',1024,'height',1024),'plan_code','free');
  j=public.enqueue_long_form_reference_job(a,payload,1);
  again=public.enqueue_long_form_reference_job(a,payload,1);
  if j<>again or j<>a then raise exception 'Lost-response retry changed job identity'; end if;
  select count(*) into n from public.jobs where id=j and charge_credits=0 and max_attempts=3;
  if n<>1 then raise exception 'Expected one free bounded job'; end if;
  select count(*) into n from public.long_form_reference_assets where id=a and job_id=j and prompt_snapshot=payload->>'prompt';
  if n<>1 then raise exception 'Asset/job link not atomic'; end if;
  update public.long_form_reference_assets set lease_until=now()-interval '1 minute' where id=a;
  select count(*) into n from public.claim_long_form_reference_asset_for_version(w);
  if n<>0 then raise exception 'Observing a submitted job consumed another claim'; end if;
  update public.long_form_reference_assets set status='succeeded',result_url='https://example.invalid/old.png',cost_usd=0.0006 where id=a;
  update public.long_form_visual_world_versions set status='ready',stage='finalizing' where id=w;
  replacement=public.replace_long_form_reference_asset(a,source_project.user_id);
  again=public.replace_long_form_reference_asset(a,source_project.user_id);
  if replacement= a or again<>replacement then raise exception 'Replacement is not independent and idempotent'; end if;
  select count(*) into n from public.long_form_reference_assets where id=a and result_url='https://example.invalid/old.png' and job_id=j and cost_usd=0.0006;
  if n<>1 then raise exception 'History was erased'; end if;
  begin
    perform public.replace_long_form_reference_asset(a,gen_random_uuid());
    raise exception 'Ownership bypass';
  exception when others then
    if sqlerrm<>'FORBIDDEN' then raise; end if;
  end;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,status,claim_attempts,lease_until) values(w,'dead','object_reference','wide','running',3,now()-interval '1 minute') returning id into a2;
  perform public.claim_long_form_reference_asset_for_version(w);
  if (select status from public.long_form_reference_assets where id=a2)<>'failed' then raise exception 'Exhausted worker was not reaped'; end if;
  if has_function_privilege('authenticated','public.enqueue_long_form_reference_job(uuid,jsonb,integer)','EXECUTE') or has_function_privilege('anon','public.replace_long_form_reference_asset(uuid,uuid)','EXECUTE') then raise exception 'Privileged functions exposed'; end if;
end $$;
select 'PASS: atomic claim, free job/link, uncertain-response idempotency, no polling claims, immutable replacement history, ownership, exhausted claims, function ACLs' as lifecycle_checks;
