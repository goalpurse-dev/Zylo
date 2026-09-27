CREATE OR REPLACE FUNCTION public.enqueue_long_form_reference_job(p_asset_id uuid, p_job jsonb, p_claim_attempt integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid; tk text; expected_tk text; geometry boolean; is_sheet boolean; anchor_id uuid; anchor_url text;
begin
 select * into a from public.long_form_reference_assets where id=p_asset_id for update;
 if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
 if a.job_id is not null then return a.job_id; end if;
 if a.status<>'running' or a.claim_attempts<>p_claim_attempt or a.lease_until is null or a.lease_until<=now() then raise exception 'CLAIM_EXPIRED'; end if;
 select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
 select user_id into owner_id from public.long_form_projects where id=v.project_id;
 tk:=p_job->>'tool_key'; geometry:=public.reference_geometry_role(a.reference_type,a.angle_or_view);
 is_sheet:=a.reference_type='character_reference' and a.angle_or_view='identity_outfit_sheet';
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
 if a.reference_type='character_reference' and a.angle_or_view in ('face_sheet','profile_silhouette_sheet') then
   if p_job->'settings'->>'long_form_reference_role' is distinct from a.angle_or_view
     or p_job->'settings'->>'long_form_reference_entity_id' is distinct from a.entity_id
     or p_job->>'prompt' not like 'ROLE CONTRACT: '||a.angle_or_view||'.%'
   then raise exception 'SHEET_ROLE_CONTRACT_MISMATCH'; end if;
   if a.input_reference_asset_ids is distinct from array[anchor_id]
     or p_job->'input'->'ref_images' is distinct from jsonb_build_array(anchor_url)
     or not exists(select 1 from public.long_form_reference_assets r where r.id=anchor_id and r.angle_or_view='identity_outfit_sheet' and r.qa_status='approved' and not r.stale)
   then raise exception 'CURRENT_APPROVED_IDENTITY_SHEET_REQUIRED'; end if;
 end if;
 insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
 values(a.id,owner_id,'image',tk,null,p_job->>'prompt',
 (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_reference_asset_id',a.id),
 p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry then 1 else 3 end,now());
 update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when geometry then 'runware:108@22' when is_sheet then 'runware:400@4' else 'runware:400@6' end,updated_at=now() where id=a.id;
 return a.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_reference_qa_result(p_asset_id uuid, p_approved boolean, p_qa_result jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.long_form_reference_assets;
begin
  select * into a from public.long_form_reference_assets where id = p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.status <> 'succeeded' then raise exception 'TERMINAL_GENERATION_REQUIRED'; end if;
  if a.angle_or_view in ('face_sheet','profile_silhouette_sheet') and p_approved then
    if p_qa_result->>'assetId' is distinct from a.id::text or p_qa_result->>'role' is distinct from a.angle_or_view
      or a.input_reference_asset_ids is distinct from array[public.accepted_reference_identity(a.visual_world_version_id,a.entity_id)]
      or p_qa_result->>'anchorId' is distinct from a.input_reference_asset_ids[1]::text
    then raise exception 'SHEET_QA_PROVENANCE_MISMATCH'; end if;
  end if;
  update public.long_form_reference_assets
  set qa_status = case when p_approved then 'approved' else 'rejected' end,
      qa_result = p_qa_result, qa_attempts = a.qa_attempts + 1, updated_at = now()
  where id = p_asset_id;
  if p_approved and a.reference_type = 'character_reference' and a.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter') then
    perform public.mark_derived_sheets_stale_and_requeue(a.visual_world_version_id, a.entity_id, a.id);
  end if;
  return p_approved;
end;
$function$;
