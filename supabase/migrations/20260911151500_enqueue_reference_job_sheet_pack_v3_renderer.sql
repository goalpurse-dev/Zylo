-- Real incident, caught BEFORE it could block the character-sheet-v3
-- controlled test: enqueue_long_form_reference_job hardcoded
-- expected_tk := case when geometry then 'image:qwen.image-edit-plus' else
-- 'image:flux2.klein9bkv' end — meaning ANY non-geometry character role was
-- expected to use Klein 9B, with no awareness that the 2026-09-11 sheet
-- pack v3 reversal moved identity_outfit_sheet/face_sheet/
-- profile_silhouette_sheet to Klein 4B (image:flux.base, cheaper and
-- proven to follow the 3-view layout contract). Without this fix, the
-- correctly-built Klein 4B job would have been rejected with
-- INVALID_REFERENCE_JOB before ever reaching Runware — the exact same bug
-- class as the reference_geometry_role fix earlier this session, just a
-- second hardcoded model-expectation switch that needed the same update.
create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid,p_job jsonb,p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid; tk text; expected_tk text; geometry boolean; is_sheet boolean; anchor_id uuid; anchor_url text;
begin
 select * into a from public.long_form_reference_assets where id=p_asset_id for update;
 if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
 if a.job_id is not null then return a.job_id; end if;
 if a.status<>'running' or a.claim_attempts<>p_claim_attempt or a.lease_until is null or a.lease_until<=now() then raise exception 'CLAIM_EXPIRED'; end if;
 select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
 select user_id into owner_id from public.long_form_projects where id=v.project_id;
 tk:=p_job->>'tool_key'; geometry:=public.reference_geometry_role(a.reference_type,a.angle_or_view);
 is_sheet:=a.reference_type='character_reference' and a.angle_or_view in ('identity_outfit_sheet','face_sheet','profile_silhouette_sheet');
 expected_tk:=case when geometry then 'image:qwen.image-edit-plus' when is_sheet then 'image:flux.base' else 'image:flux2.klein9bkv' end;
 if tk is distinct from expected_tk
 or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from a.id then raise exception 'INVALID_REFERENCE_JOB'; end if;
 if geometry then
   anchor_id:=public.accepted_reference_identity(v.id,a.entity_id);
   select result_url into anchor_url from public.long_form_reference_assets where id=anchor_id;
   if anchor_id is null
   or a.input_reference_asset_ids is null
   or array_length(a.input_reference_asset_ids,1) not in (1,2)
   or a.input_reference_asset_ids[1] is distinct from anchor_id
   or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(anchor_url)
   then raise exception 'ACCEPTED_IDENTITY_ANCHOR_REQUIRED'; end if;
 end if;
 insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
 values(a.id,owner_id,'image',tk,null,p_job->>'prompt',
 (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_reference_asset_id',a.id),
 p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry then 1 else 3 end,now());
 update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when geometry then 'runware:108@22' when is_sheet then 'runware:400@4' else 'runware:400@6' end,updated_at=now() where id=a.id;
 return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;
