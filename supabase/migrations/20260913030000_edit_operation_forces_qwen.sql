-- Real bug found during the 2026-09-13 Generate/Edit routing-contract audit
-- (Part 3/4): enqueue_long_form_reference_job's expected_tk computation only
-- ever looked at the asset's ROLE (geometry / is_sheet / else) to decide
-- which renderer a job was allowed to use — it had no concept of "edit"
-- at all. character_reference_sheet's role-level policy is an independent
-- Klein 4B generation (is_sheet -> 'image:flux.base'), so when Edit
-- Reference (edit_long_form_reference_asset) created a replacement row with
-- edit_instruction set, ANY attempt to actually dispatch it through Qwen
-- Image Edit Plus (the correct renderer for an edit) would have been
-- REJECTED by this exact function as INVALID_REFERENCE_JOB — the DB itself
-- was enforcing the wrong contract. This mirrors and closes the same gap
-- just fixed on the JS side (resolveReferenceOperationRenderer in
-- referenceRendererPolicy.js / referenceJobPayload in visualWorldJobs.ts):
-- the renderer must be resolved from the OPERATION (is edit_instruction
-- set?), not merely from the role. This is the true last line of defense —
-- SQL SECURITY DEFINER, independent of whatever the edge function computed
-- — so a future regression in the JS layer still cannot dispatch an Edit
-- Reference job through the wrong model, or a Regenerate job through Qwen.
--
-- Also adds a dedicated EDIT_SOURCE_IMAGE_REQUIRED validation (Part 3: "if
-- operation === 'edit': assert(sourceImage != null)") for the is_edit case,
-- parallel to the existing geometry branch's ACCEPTED_IDENTITY_ANCHOR_REQUIRED
-- check: an edit row's own input_reference_asset_ids must point at exactly
-- the asset it replaces, and the job's ref_images must carry that same
-- asset's result_url — the edit can never be dispatched without a real
-- source image, and never against some other asset's identity anchor.
create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid;
  tk text; expected_tk text; geometry boolean; is_sheet boolean; is_edit boolean;
  anchor_id uuid; anchor_url text; parent_url text;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.job_id is not null then return a.job_id; end if;
  if a.status<>'running' or a.claim_attempts<>p_claim_attempt or a.lease_until is null or a.lease_until<=now() then raise exception 'CLAIM_EXPIRED'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  tk:=p_job->>'tool_key';
  is_edit:=a.edit_instruction is not null;
  geometry:=public.reference_geometry_role(a.reference_type,a.angle_or_view);
  is_sheet:=a.reference_type='character_reference' and a.angle_or_view in ('identity_outfit_sheet','character_reference_sheet');
  expected_tk:=case when is_edit then 'image:qwen.image-edit-plus' when geometry then 'image:qwen.image-edit-plus' when is_sheet then 'image:flux.base' else 'image:flux2.klein9bkv' end;
  if tk is distinct from expected_tk
  or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from a.id then raise exception 'INVALID_REFERENCE_JOB'; end if;
  if is_edit then
    select result_url into parent_url from public.long_form_reference_assets where id=a.replaces_asset_id;
    if a.replaces_asset_id is null
    or parent_url is null
    or a.input_reference_asset_ids is null
    or array_length(a.input_reference_asset_ids,1) <> 1
    or a.input_reference_asset_ids[1] is distinct from a.replaces_asset_id
    or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url)
    then raise exception 'EDIT_SOURCE_IMAGE_REQUIRED'; end if;
  elsif geometry then
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
  p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry or is_edit then 1 else 3 end,now());
  update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when is_edit then 'runware:108@22' when geometry then 'runware:108@22' when is_sheet then 'runware:400@4' else 'runware:400@6' end,updated_at=now() where id=a.id;
  return a.id;
end $$;
