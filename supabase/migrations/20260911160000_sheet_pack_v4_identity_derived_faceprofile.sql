-- Character sheet pack v4 (2026-09-11, second revision): v3 made Face and
-- Profile/Silhouette independent from-spec generations with NO dependency
-- on Identity/Outfit — this caused a real, visible incident: the Identity/
-- Outfit sheet (fresh, correct 3-view layout) and Face/Profile-Silhouette
-- (generated independently from the SAME text spec but different random
-- seeds) drifted into a VISIBLY DIFFERENT-LOOKING character. Face and
-- Profile/Silhouette are now DERIVED from the accepted Identity/Outfit
-- sheet via a single-reference Qwen Image Edit Plus identity-preserving
-- transformation (compileDerivedSheetEdit in visualWorldStyle.ts).
-- This migration restores the SQL-level dependency removed in
-- 20260911150000 (claim gate) and adds the new staleness-tracking system:
-- whenever an identity anchor becomes approved, any current Face/Profile
-- row that does NOT derive from that exact identity is marked stale and a
-- fresh pending replacement is queued automatically — no manual "why
-- didn't Face update" step for the user.

-- 1. Face_sheet/profile_silhouette_sheet are now Qwen edits requiring an
-- identity anchor, same class as profile/back/identity_outfit_side/back.
create or replace function public.reference_geometry_role(p_type text,p_angle text)
returns boolean language sql immutable set search_path='' as $$
 select p_type='character_reference' and p_angle=any(array[
   'profile','back',
   'identity_outfit_side','identity_outfit_back',
   'face_side','face_back',
   'face_sheet','profile_silhouette_sheet'
 ])
$$;
revoke all on function public.reference_geometry_role(text,text) from public,anon,authenticated;
grant execute on function public.reference_geometry_role(text,text) to service_role;

-- 2. is_sheet narrows to identity_outfit_sheet only (Klein 4B, independent).
-- face_sheet/profile_silhouette_sheet now match `geometry` above and expect
-- Qwen instead — the `case` order (geometry checked first) means this was
-- already functionally correct without this narrowing, but the explicit
-- narrowing keeps the variable's name honest.
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
 insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
 values(a.id,owner_id,'image',tk,null,p_job->>'prompt',
 (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_reference_asset_id',a.id),
 p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,case when geometry then 1 else 3 end,now());
 update public.long_form_reference_assets set job_id=a.id,prompt_snapshot=p_job->>'prompt',render_model=case when geometry then 'runware:108@22' when is_sheet then 'runware:400@4' else 'runware:400@6' end,updated_at=now() where id=a.id;
 return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;

-- 3. Claim gate: re-add face_sheet/profile_silhouette_sheet to the roles
-- that require an ACCEPTED identity anchor to even be claimable (reverses
-- 20260911150000's removal — that removal implemented v3's "no dependency"
-- design, which is itself now superseded).
create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_reference_assets a set status='failed',lease_until=null,last_error_code='CLAIMS_EXHAUSTED',last_error_at=now()
  where a.visual_world_version_id=p_visual_world_version_id and a.job_id is null and a.status in ('pending','running') and a.claim_attempts>=3 and (a.lease_until is null or a.lease_until<now());

  return query update public.long_form_reference_assets a set status='running',claim_attempts=a.claim_attempts+1,lease_until=now()+interval '3 minutes',updated_at=now()
  from (
    select r.id from public.long_form_reference_assets r
    left join (values
      ('silhouette_front','identity_outfit_three_quarter'),
      ('silhouette_side','identity_outfit_side'),
      ('silhouette_back','identity_outfit_back')
    ) as adopt_dep(angle_or_view, source_angle) on adopt_dep.angle_or_view = r.angle_or_view
    where r.visual_world_version_id=p_visual_world_version_id
      and r.job_id is null
      and r.generation_type='provider'
      and r.claim_attempts<3
      and (r.status='pending' or (r.status='running' and r.lease_until<now()))
      and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=r.id)
      and (
        (
          adopt_dep.source_angle is not null
          and public.accepted_component(r.visual_world_version_id, r.entity_id, adopt_dep.source_angle) is not null
        )
        or (
          adopt_dep.source_angle is null
          and (
            r.reference_type <> 'character_reference'
            or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back','face_sheet','profile_silhouette_sheet')
            or not exists (
              select 1 from public.long_form_reference_assets anchor
              where anchor.visual_world_version_id = r.visual_world_version_id
                and anchor.entity_id = r.entity_id
                and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
                and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
            )
            or (
              r.angle_or_view in ('profile','back','face_closeup','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back','face_sheet','profile_silhouette_sheet')
              and public.accepted_reference_identity(r.visual_world_version_id, r.entity_id) is not null
            )
            or (
              r.angle_or_view in ('outfit_detail','action_pose')
              and exists (
                select 1 from public.long_form_reference_assets anchor
                where anchor.visual_world_version_id = r.visual_world_version_id
                  and anchor.entity_id = r.entity_id
                  and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
                  and anchor.status in ('succeeded','failed')
                  and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
              )
            )
          )
        )
      )
    order by r.created_at limit 1 for update skip locked
  ) due
  where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;

-- 4. Staleness tracking. `stale` marks a current (non-replaced) row whose
-- content was derived from an identity that is no longer the accepted one
-- — history is preserved (never deleted), but the UI must never present a
-- stale row as "Ready". `not exists (... replaces_asset_id ...)` protects
-- against double-queuing if this is somehow invoked twice for the same
-- identity change.
alter table public.long_form_reference_assets add column if not exists stale boolean not null default false;

create or replace function public.mark_derived_sheets_stale_and_requeue(p_world uuid, p_entity text, p_new_identity_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
  for r in
    select a.id, a.angle_or_view from public.long_form_reference_assets a
    where a.visual_world_version_id = p_world
      and a.entity_id = p_entity
      and a.angle_or_view in ('face_sheet','profile_silhouette_sheet')
      and a.stale = false
      and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id = a.id)
      and (a.input_reference_asset_ids is null or not (a.input_reference_asset_ids @> array[p_new_identity_id]))
  loop
    update public.long_form_reference_assets set stale = true, updated_at = now() where id = r.id;
    insert into public.long_form_reference_assets(visual_world_version_id, entity_id, reference_type, angle_or_view, replaces_asset_id, status)
    values (p_world, p_entity, 'character_reference', r.angle_or_view, r.id, 'pending');
  end loop;
end $$;
revoke all on function public.mark_derived_sheets_stale_and_requeue(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mark_derived_sheets_stale_and_requeue(uuid,text,uuid) to service_role;

-- 5. Hook the trigger into BOTH paths that can approve an identity anchor:
-- automated QA (record_reference_qa_result) and manual override
-- (approve_long_form_reference_identity). A rejected candidate never calls
-- either with p_approved=true, so the old accepted identity (and its
-- correctly-derived Face/Profile) remain untouched — no extra code needed
-- for that case, it falls out of accepted_reference_identity's existing
-- survives-regenerate logic.
create or replace function public.record_reference_qa_result(p_asset_id uuid, p_approved boolean, p_qa_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets;
begin
  select * into a from public.long_form_reference_assets where id = p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.status <> 'succeeded' then raise exception 'TERMINAL_GENERATION_REQUIRED'; end if;
  update public.long_form_reference_assets
  set qa_status = case when p_approved then 'approved' else 'rejected' end,
      qa_result = p_qa_result, qa_attempts = a.qa_attempts + 1, updated_at = now()
  where id = p_asset_id;
  if p_approved and a.reference_type = 'character_reference' and a.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter') then
    perform public.mark_derived_sheets_stale_and_requeue(a.visual_world_version_id, a.entity_id, a.id);
  end if;
  return p_approved;
end $$;
revoke all on function public.record_reference_qa_result(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.record_reference_qa_result(uuid, boolean, jsonb) to service_role;

create or replace function public.approve_long_form_reference_identity(p_asset_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id = p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.status <> 'succeeded' then raise exception 'TERMINAL_GENERATION_REQUIRED'; end if;
  select * into v from public.long_form_visual_world_versions where id = a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  update public.long_form_reference_assets
  set qa_status = 'approved', qa_result = coalesce(qa_result, '{}'::jsonb) || jsonb_build_object('manuallyApprovedBy', p_user_id, 'manuallyApprovedAt', now()),
      qa_attempts = qa_attempts + 1, updated_at = now()
  where id = p_asset_id;
  if a.reference_type = 'character_reference' and a.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter') then
    perform public.mark_derived_sheets_stale_and_requeue(a.visual_world_version_id, a.entity_id, a.id);
  end if;
  return true;
end $$;
revoke all on function public.approve_long_form_reference_identity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_long_form_reference_identity(uuid, uuid) to service_role;
