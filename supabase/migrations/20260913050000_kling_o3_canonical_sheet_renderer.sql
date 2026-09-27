-- V3 canonical Character Reference Sheet renderer migration (2026-09-13):
-- moves character_reference_sheet from FLUX Klein 4B to Kling IMAGE O3 —
-- direct Runware evidence showed Kling substantially better suited to this
-- exact "one image, many correct views of one character" use case. This
-- does NOT touch the retired identity_outfit_sheet role (Phase C/D
-- architecture, history-only, never produced again) — it keeps using Klein
-- 4B via the SAME is_sheet branch it always has, just now split out from
-- character_reference_sheet's own branch so the two can diverge.
--
-- Also adds real validation for Part 3B's new "Regenerate MAY optionally
-- supply the current approved sheet as a pure identity/style reference"
-- allowance: previously this SQL gate only validated reference images for
-- is_edit (Qwen edit) and geometry (Qwen anchor-derived) jobs; a Kling sheet
-- job with ref_images was neither, so nothing checked it was even the RIGHT
-- image. A Kling sheet job may now supply ZERO or exactly ONE reference
-- image, and if one is supplied it must be the asset's own replaces_asset_id
-- (the specific sheet being regenerated from) — never an arbitrary/stale
-- image, and never more than one (Part 17: "exactly ONE reference image
-- maximum").
create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid;
  tk text; expected_tk text; geometry boolean; is_klein_sheet boolean; is_kling_sheet boolean; is_edit boolean;
  anchor_id uuid; anchor_url text; parent_url text; ref_count int;
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
  is_klein_sheet:=a.reference_type='character_reference' and a.angle_or_view='identity_outfit_sheet';
  is_kling_sheet:=a.reference_type='character_reference' and a.angle_or_view='character_reference_sheet';
  expected_tk:=case when is_edit then 'image:qwen.image-edit-plus' when geometry then 'image:qwen.image-edit-plus' when is_kling_sheet then 'image:kling.o3' when is_klein_sheet then 'image:flux.base' else 'image:flux2.klein9bkv' end;
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
  elsif is_kling_sheet then
    ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'), 0);
    if ref_count > 1 then raise exception 'SHEET_IDENTITY_REFERENCE_LIMIT_EXCEEDED'; end if;
    if ref_count = 1 then
      select result_url into parent_url from public.long_form_reference_assets where id=a.replaces_asset_id;
      if a.replaces_asset_id is null
      or parent_url is null
      or a.input_reference_asset_ids is null
      or array_length(a.input_reference_asset_ids,1) <> 1
      or a.input_reference_asset_ids[1] is distinct from a.replaces_asset_id
      or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url)
      then raise exception 'SHEET_IDENTITY_REFERENCE_MISMATCH'; end if;
    end if;
  end if;
  insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values(a.id,owner_id,'image',tk,null,p_job->>'prompt',
  (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_reference_asset_id',a.id),
  p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry or is_edit then 1 else 3 end,now());
  update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when is_edit then 'runware:108@22' when geometry then 'runware:108@22' when is_kling_sheet then 'klingai:kling-image@o3' when is_klein_sheet then 'runware:400@4' else 'runware:400@6' end,updated_at=now() where id=a.id;
  return a.id;
end $$;
