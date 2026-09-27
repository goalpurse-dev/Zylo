-- Visual Plan only. No Script/Research data or generation logic is changed.
alter table public.long_form_visual_plan_versions
  add column workflow_started_at timestamptz,
  add column parent_visual_plan_version_id uuid references public.long_form_visual_plan_versions(id);

create or replace function public.claim_long_form_visual_plan_stage_by_id(p_id uuid)
returns setof public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
begin
  update public.long_form_visual_plan_versions set status='failed',last_error_code='stage_attempts_exhausted_via_worker_disappearance',last_error_at=now(),worker_lock_until=null
  where id=p_id and status='planning' and stage_attempt>=3 and (worker_lock_until is null or worker_lock_until<now());
  return query update public.long_form_visual_plan_versions v
  set worker_lock_until=now()+interval '6 minutes', stage_started_at=now(),
      workflow_started_at=coalesce(v.workflow_started_at,now()),stage_attempt=v.stage_attempt+1
  where id=p_id and status='planning' and stage_attempt<3 and (worker_lock_until is null or worker_lock_until<now()) returning v.*;
end $$;
create or replace function public.claim_long_form_visual_plan_stage(p_limit int default 1)
returns setof public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare target record;
begin
  for target in select id from public.long_form_visual_plan_versions where status='planning' and (worker_lock_until is null or worker_lock_until<now()) order by created_at limit least(greatest(p_limit,1),3) for update skip locked loop
    return query select * from public.claim_long_form_visual_plan_stage_by_id(target.id);
  end loop;
end $$;
revoke all on function public.claim_long_form_visual_plan_stage_by_id(uuid),public.claim_long_form_visual_plan_stage(int) from public,anon,authenticated;
grant execute on function public.claim_long_form_visual_plan_stage_by_id(uuid),public.claim_long_form_visual_plan_stage(int) to service_role;

-- A reservation survives process death and uncertain provider responses. Never reset by Start.
create or replace function public.reserve_visual_plan_provider_call(p_id uuid,p_claim timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.long_form_visual_plan_versions v set meta=coalesce(meta,'{}')||jsonb_build_object('providerCallsReserved',coalesce((meta->>'providerCallsReserved')::int,0)+1,'providerLastReservedAt',now())
  where id=p_id and status='planning' and stage='planning' and stage_started_at=p_claim and worker_lock_until>now()
  and coalesce((meta->>'providerCallsReserved')::int,0)<least(coalesce((meta->>'providerCallLimit')::int,3),3)
  and coalesce((meta->>'estimatedTotalCostUsd')::numeric,0)<0.3;
  return found;
end $$;
revoke all on function public.reserve_visual_plan_provider_call(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_visual_plan_provider_call(uuid,timestamptz) to service_role;

-- Serialize starts on the owning project; refresh/StrictMode/regenerate races return the same active row.
create or replace function public.start_visual_plan_version(p_project_id uuid,p_user_id uuid,p_regenerate boolean default false)
returns public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare p public.long_form_projects; v public.long_form_visual_plan_versions; n int;
begin
  select * into p from public.long_form_projects where id=p_project_id and user_id=p_user_id for update;
  if not found then raise exception 'Project not found'; end if;
  if not exists(select 1 from public.long_form_script_versions where id=p.current_script_version_id and status='ready') then raise exception 'SCRIPT_NOT_READY'; end if;
  select * into v from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id order by (status='planning') desc,version desc limit 1;
  if found and (v.status='planning' or not p_regenerate) then return v; end if;
  select coalesce(max(version),0)+1 into n from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id;
  if (select count(*) from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id and parent_visual_plan_version_id is null)>=6 then raise exception 'TOO_MANY_VERSIONS'; end if;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version) values(p.id,p.current_script_version_id,n) returning * into v;
  return v;
end $$;
revoke all on function public.start_visual_plan_version(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.start_visual_plan_version(uuid,uuid,boolean) to service_role;

create or replace function private.trigger_long_form_visual_plan_recovery()
returns void language plpgsql security definer set search_path='' as $$
declare target record; secret text; endpoint text; gateway text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select replace(decrypted_secret,'advance-long-form-research','advance-long-form-visual-plan') into endpoint from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  select decrypted_secret into gateway from vault.decrypted_secrets where name='long_form_gateway_anon_key' limit 1;
  if secret is null or endpoint is null or gateway is null then return; end if;
  for target in select id from public.long_form_visual_plan_versions where status='planning' and (worker_lock_until is null or worker_lock_until<now()) order by created_at limit 3 loop
    perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway,'apikey',gateway,'x-recovery-secret',secret),body:=jsonb_build_object('visualPlanVersionId',target.id),timeout_milliseconds:=10000);
  end loop;
end $$;
revoke all on function private.trigger_long_form_visual_plan_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_visual_plan_recovery() to service_role;
select cron.schedule('long-form-visual-plan-recovery','* * * * *','select private.trigger_long_form_visual_plan_recovery();');

-- User-authored versions copy every protected field from the source; clients cannot submit full plans.
create or replace function public.save_storyboard_edits(p_source_id uuid,p_patches jsonb)
returns public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare src public.long_form_visual_plan_versions; dest public.long_form_visual_plan_versions; owner public.long_form_projects;
  patch jsonb; beat jsonb; beats jsonb; updated jsonb; chars jsonb; n int; pos int; changed boolean; seen text[]:=array[]::text[];
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
    if length(trim(coalesce(patch->>'informationToCommunicate',''))) not between 1 and 3000
      or coalesce(patch->>'shotSize','') not in ('WIDE','MEDIUM','CLOSE','DETAIL','INSERT')
      or coalesce(patch->>'visualType','') not in ('STORY_ILLUSTRATION','ENVIRONMENT','CHARACTER','OBJECT_DETAIL','DIAGRAM','MAP','COMPARISON','CUTAWAY','TIMELINE','PROGRAMMATIC_GRAPHIC') then raise exception 'Invalid description, shot or visual type'; end if;
    if patch->>'locationId' is not null and not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->>'id'=patch->>'locationId' and e->>'category'='LOCATION') then raise exception 'Unknown location'; end if;
    chars:=coalesce(patch->'characterIds','[]');
    if jsonb_typeof(chars)<>'array' or exists(select 1 from jsonb_array_elements_text(chars) c where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->>'id'=c and e->>'category'='CHARACTER')) then raise exception 'Unknown character'; end if;
    changed:=beat->>'locationId' is distinct from patch->>'locationId' or beat->>'visualType' is distinct from patch->>'visualType' or beat->>'shotSize' is distinct from patch->>'shotSize';
    updated:=beat||jsonb_build_object('informationToCommunicate',trim(patch->>'informationToCommunicate'),'shotSize',patch->>'shotSize','visualType',patch->>'visualType','locationId',patch->'locationId',
      'primaryEntityIds',coalesce((select jsonb_agg(ids.value) from jsonb_array_elements(beat->'primaryEntityIds') ids where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->'id'=ids.value and e->>'category'='CHARACTER')),'[]')||chars,
      'supportingEntityIds',coalesce((select jsonb_agg(ids.value) from jsonb_array_elements(beat->'supportingEntityIds') ids where not exists(select 1 from jsonb_array_elements(src.entity_registry) e where e->'id'=ids.value and e->>'category'='CHARACTER')),'[]'));
    -- Geometry/type changes become an independent setup, never an invalid reuse of the old camera/location.
    if changed then updated:=updated||jsonb_build_object('baseSetupKey','user_'||gen_random_uuid()::text,'continuityGroupId',null,'deltaInstruction',null,'shotStrategy',case patch->>'visualType' when 'DIAGRAM' then 'DIAGRAM' when 'MAP' then 'MAP' when 'COMPARISON' then 'COMPARISON' when 'PROGRAMMATIC_GRAPHIC' then 'TEXT_INFOGRAPHIC' when 'OBJECT_DETAIL' then 'DETAIL' else 'NEW_SETUP' end,'renderMethod',case when patch->>'visualType' in ('DIAGRAM','MAP','COMPARISON','TIMELINE','PROGRAMMATIC_GRAPHIC') then 'PROGRAMMATIC_GRAPHIC' else 'GENERATE' end); end if;
    beats:=jsonb_set(beats,array[pos::text],updated);
  end loop;
  select coalesce(max(version),0)+1 into n from public.long_form_visual_plan_versions where project_id=src.project_id and script_version_id=src.script_version_id;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version,status,stage,parent_visual_plan_version_id,visual_mode,visual_plan,entity_registry,continuity_groups,world_state_model,storyboard_summary,generation_model,meta)
  values(src.project_id,src.script_version_id,n,'ready','finalizing',src.id,src.visual_mode,jsonb_set(src.visual_plan,'{visualBeats}',beats),src.entity_registry,src.continuity_groups,src.world_state_model,
    src.storyboard_summary||jsonb_build_object('estimatedBaseSetups',(select count(distinct b->>'baseSetupKey') from jsonb_array_elements(beats) b),'estimatedReuseEvents',(select count(*) from jsonb_array_elements(beats) b where b->>'shotStrategy'='REUSE_WITH_DELTA'),'estimatedDiagrams',(select count(*) from jsonb_array_elements(beats) b where b->>'visualType'='DIAGRAM'),'estimatedMaps',(select count(*) from jsonb_array_elements(beats) b where b->>'visualType'='MAP')),
    src.generation_model,jsonb_build_object('source','user_edit','sourceVersionId',src.id,'editedBeatIds',to_jsonb(seen),'modelCalls',0,'estimatedTotalCostUsd',0)) returning * into dest;
  update public.long_form_projects set current_visual_plan_version_id=dest.id,updated_at=now() where id=src.project_id;
  return dest;
end $$;
revoke all on function public.save_storyboard_edits(uuid,jsonb) from public,anon;
grant execute on function public.save_storyboard_edits(uuid,jsonb) to authenticated;

