-- Real incident, caught live during the controlled identity_outfit_side
-- test: enqueue_long_form_reference_job's validation hardcoded
-- `a.input_reference_asset_ids is distinct from array[anchor_id]` — exactly
-- ONE element, matching the anchor alone. The dual-reference feature
-- (master + Face Detail crop as REFERENCE 1/REFERENCE 2, added several
-- migrations ago at the TS/JS layer) has been setting
-- input_reference_asset_ids to TWO elements whenever a face sibling
-- exists, but no prior live test ever actually found one — this is the
-- first real geometry dispatch where a face sibling (the pre-existing
-- face_closeup/face_front crop) was present, and it stranded the claimed
-- asset with ACCEPTED_IDENTITY_ANCHOR_REQUIRED before job creation, exactly
-- the "claimed but no job_id" class of bug from an earlier reliability
-- pass. Now accepts either [anchor_id] or [anchor_id, faceAssetId] — the
-- anchor must always be first and must always match ref_images[0]; a
-- second reference is accepted without over-constraining what it is (the
-- TS layer is the only caller and only ever supplies a real face-crop
-- sibling there).
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
 update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when geometry then 'runware:108@22' else 'runware:400@6' end,updated_at=now() where id=a.id;
 return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;
