-- One canonical character sheet (2026-09-13, major simplification): every
-- earlier character-reference taxonomy (component pack, 3-role sheet pack,
-- even-older three_quarter_neutral/face_closeup pair) is retired for
-- CURRENT generation. One character = one generated image = one source of
-- truth, independent generation (Klein 4B, same policy already proven for
-- the old Identity/Outfit sheet), no dependency of any kind.

-- 1. enqueue_long_form_reference_job must expect Klein 4B (image:flux.base)
-- for this role, not the default Klein 9B.
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
 is_sheet:=a.reference_type='character_reference' and a.angle_or_view in ('identity_outfit_sheet','character_reference_sheet');
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

-- 2. Resolution function for "the current canonical character sheet" — same
-- survives-regenerate semantics as accepted_reference_identity (a
-- qa_status:'approved' row always wins regardless of a newer non-approved
-- candidate; a qa_status:null row is only trusted as legacy-approved when
-- nothing for this entity's sheet has ever recorded a real qa_status).
-- Forward-looking (Part 8): Scene Generation does not exist yet, but this
-- is the one place it should resolve "this character's canonical sheet"
-- from, exactly the way accepted_reference_identity already is for the
-- (now-legacy) Identity/Outfit anchor.
create or replace function public.accepted_character_reference_sheet(p_world uuid, p_entity text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view='character_reference_sheet'
 and a.status='succeeded' and a.result_url is not null
 and a.generation_type='provider'
 and (
   a.qa_status='approved'
   or (
     a.qa_status is null
     and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id)
     and not exists(select 1 from public.long_form_reference_assets q where q.visual_world_version_id=a.visual_world_version_id and q.entity_id=a.entity_id and q.angle_or_view='character_reference_sheet' and q.qa_status is not null)
   )
 )
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_character_reference_sheet(uuid,text) from public,anon,authenticated;
grant execute on function public.accepted_character_reference_sheet(uuid,text) to service_role;
