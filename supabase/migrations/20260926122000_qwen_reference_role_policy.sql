-- Database dispatch guard mirrors REFERENCE_RENDER_POLICY, independent of UI selection.
create or replace function public.reference_geometry_role(p_type text,p_angle text)
returns boolean language sql immutable set search_path='' as $$
 select p_type='character_reference' and p_angle=any(array['profile','back'])
$$;
revoke all on function public.reference_geometry_role(text,text) from public,anon,authenticated;
grant execute on function public.reference_geometry_role(text,text) to service_role;

create or replace function public.accepted_reference_identity(p_world uuid,p_entity text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view='three_quarter_neutral'
 and a.status='succeeded' and a.result_url is not null
 and a.generation_type='provider'
 and coalesce(a.qa_expectations->>'reviewStatus','approved')='approved'
 and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id
   and n.generation_type<>'turnaround_master' and coalesce(n.qa_expectations->>'reviewStatus','approved')<>'rejected')
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_reference_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.accepted_reference_identity(uuid,text) to service_role;

create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid,p_job jsonb,p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid; tk text; expected_tk text; geometry boolean; anchor_id uuid; anchor_url text;
begin
 select * into a from public.long_form_reference_assets where id=p_asset_id for update;
 if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
 if a.job_id is not null then return a.job_id; end if;
 if a.status<>'running' or a.claim_attempts<>p_claim_attempt or a.lease_until is null or a.lease_until<=now() then raise exception 'CLAIM_EXPIRED'; end if;
 select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
 select user_id into owner_id from public.long_form_projects where id=v.project_id;
 tk:=p_job->>'tool_key'; geometry:=public.reference_geometry_role(a.reference_type,a.angle_or_view);
 expected_tk:=case when geometry then 'image:qwen.image-edit-plus' else 'image:flux2.klein9bkv' end;
 if tk is distinct from expected_tk
 or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from a.id then raise exception 'INVALID_REFERENCE_JOB'; end if;
 if geometry then
   anchor_id:=public.accepted_reference_identity(v.id,a.entity_id);
   select result_url into anchor_url from public.long_form_reference_assets where id=anchor_id;
   if anchor_id is null or a.input_reference_asset_ids is distinct from array[anchor_id]
   or p_job->'input'->'ref_images' is distinct from jsonb_build_array(anchor_url) then raise exception 'ACCEPTED_IDENTITY_ANCHOR_REQUIRED'; end if;
 end if;
 insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
 values(a.id,owner_id,'image',tk,null,p_job->>'prompt',
 (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_reference_asset_id',a.id),
 p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry then 1 else 3 end,now());
 update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when geometry then 'runware:108@22' else 'runware:400@6' end,updated_at=now() where id=a.id;
 return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;

-- One experiment per entity/world, even after failure, refresh, or lost response.
create unique index reference_qwen_experiment_unique on public.long_form_reference_assets(visual_world_version_id,entity_id) where generation_type='role_edit_experiment';
create or replace function public.enqueue_reference_profile_test(p_anchor_id uuid,p_prompt text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; mid uuid; old_id uuid; owner_id uuid; payload jsonb;
begin
 select * into a from public.long_form_reference_assets where id=p_anchor_id;
 if not found then raise exception 'ANCHOR_NOT_FOUND'; end if;
 select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
 select id into mid from public.long_form_reference_assets where visual_world_version_id=v.id and entity_id=a.entity_id and generation_type='role_edit_experiment';
 if mid is not null then return mid; end if;
 if v.status<>'ready' then raise exception 'WORLD_NOT_READY'; end if;
 if public.accepted_reference_identity(v.id,a.entity_id) is distinct from a.id then raise exception 'ACCEPTED_IDENTITY_ANCHOR_REQUIRED'; end if;
 if length(p_prompt) not between 100 and 2000 then raise exception 'INVALID_PROMPT'; end if;
 select r.id into old_id from public.long_form_reference_assets r where r.visual_world_version_id=v.id and r.entity_id=a.entity_id and r.angle_or_view='profile' and r.generation_type='provider'
 and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=r.id) order by r.created_at desc limit 1;
 if old_id is null then raise exception 'CURRENT_PROFILE_REQUIRED'; end if;
 select user_id into owner_id from public.long_form_projects where id=v.project_id;
 mid:=gen_random_uuid();
 insert into public.long_form_reference_assets(id,visual_world_version_id,entity_id,reference_type,angle_or_view,status,claim_attempts,lease_until,generation_type,input_reference_asset_ids,qa_expectations)
 values(mid,v.id,a.entity_id,'character_reference','profile','running',1,now()+interval '3 minutes','role_edit_experiment',array[a.id],jsonb_build_object('reviewStatus','pending','identityAnchorId',a.id,'previousRoleAssetId',old_id,'automatedVisionPerformed',false));
 payload:=jsonb_build_object('id',mid,'user_id',owner_id,'tool_key','image:qwen.image-edit-plus','prompt',p_prompt,'plan_code','free',
 'settings',jsonb_build_object('tool_key','image:qwen.image-edit-plus','creation_type','photo'),
 'input',jsonb_build_object('tool','image','subject',p_prompt,'creation_type','photo','width',1024,'height',1024,'ref_images',jsonb_build_array(a.result_url)));
 perform public.enqueue_long_form_reference_job(mid,payload,1);
 return mid;
end $$;
revoke all on function public.enqueue_reference_profile_test(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_reference_profile_test(uuid,text) to service_role;

create or replace function public.review_reference_profile_test(p_asset_id uuid,p_pass boolean,p_review jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.long_form_reference_assets; old_id uuid;
begin
 select * into a from public.long_form_reference_assets where id=p_asset_id for update;
 if not found or a.generation_type<>'role_edit_experiment' or a.status not in ('succeeded','failed') then raise exception 'TERMINAL_TEST_REQUIRED'; end if;
 if a.qa_expectations->>'reviewStatus'<>'pending' then raise exception 'ALREADY_REVIEWED'; end if;
 perform 1 from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
 if p_pass then
   if a.status<>'succeeded' or a.result_url is null or not coalesce(p_review @> '{"sameIdentity":true,"sameHair":true,"sameFacialHair":true,"sameOutfit":true,"strictProfile":true,"oneEye":true,"noseChinSilhouette":true,"differentComposition":true,"noGeneratedText":true,"neutralBackground":true}',false) then raise exception 'ALL_QA_SIGNALS_REQUIRED'; end if;
   if public.accepted_reference_identity(a.visual_world_version_id,a.entity_id) is distinct from a.input_reference_asset_ids[1] then raise exception 'IDENTITY_CHANGED_DURING_REVIEW'; end if;
   old_id:=(a.qa_expectations->>'previousRoleAssetId')::uuid;
   if exists(select 1 from public.long_form_reference_assets where replaces_asset_id=old_id) then raise exception 'PROFILE_CHANGED_DURING_REVIEW'; end if;
 end if;
 update public.long_form_reference_assets set replaces_asset_id=case when p_pass then old_id else null end,qa_expectations=qa_expectations||jsonb_build_object('reviewStatus',case when p_pass then 'approved' else 'rejected' end,'review',p_review,'reviewedAt',now()),updated_at=now() where id=a.id;
 return p_pass;
end $$;
revoke all on function public.review_reference_profile_test(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.review_reference_profile_test(uuid,boolean,jsonb) to service_role;

create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_reference_assets a set status='failed',lease_until=null,last_error_code='CLAIMS_EXHAUSTED',last_error_at=now()
  where a.visual_world_version_id=p_visual_world_version_id and a.job_id is null and a.status in ('pending','running') and a.claim_attempts>=3 and (a.lease_until is null or a.lease_until<now());

  return query update public.long_form_reference_assets a set status='running',claim_attempts=a.claim_attempts+1,lease_until=now()+interval '3 minutes',updated_at=now()
  from (
    select r.id from public.long_form_reference_assets r
    where r.visual_world_version_id=p_visual_world_version_id
      and r.job_id is null
      and r.generation_type='provider'
      and (not public.reference_geometry_role(r.reference_type,r.angle_or_view) or public.accepted_reference_identity(r.visual_world_version_id,r.entity_id) is not null)
      and r.claim_attempts<3
      and (r.status='pending' or (r.status='running' and r.lease_until<now()))
      and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=r.id)
      and (
        r.reference_type <> 'character_reference'
        or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose')
        or not exists (
          select 1 from public.long_form_reference_assets anchor
          where anchor.visual_world_version_id = r.visual_world_version_id
            and anchor.entity_id = r.entity_id
            and anchor.angle_or_view = 'three_quarter_neutral'
            and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
        )
        or exists (
          select 1 from public.long_form_reference_assets anchor
          where anchor.visual_world_version_id = r.visual_world_version_id
            and anchor.entity_id = r.entity_id
            and anchor.angle_or_view = 'three_quarter_neutral'
            and anchor.status in ('succeeded','failed')
            and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
        )
      )
    order by r.created_at limit 1 for update skip locked
  ) due
  where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;
