-- Real incident: Face sat "running" burning claim_attempts toward a false
-- CLAIMS_EXHAUSTED while its Identity Master was genuinely qa_status:
-- 'rejected' (generation succeeded, review failed). The claim RPC's
-- geometry-role branch (profile/back) already gates on
-- accepted_reference_identity (qa-aware, added by 20260927120000), but
-- face_closeup/outfit_detail/action_pose went through a SEPARATE, older
-- clause that only checked anchor.status in ('succeeded','failed') —
-- generation-terminal, not qa-terminal. Face/back both structurally REQUIRE
-- a real accepted (qa-approved) master — Face crops its actual pixels,
-- Back/Profile condition Qwen on it — so both now use the SAME
-- accepted_reference_identity gate. Outfit/Action-pose only use the master
-- as OPTIONAL best-effort conditioning (referenceRendererPolicy:
-- requiresIdentityAnchor:false) with a graceful independent-generation
-- fallback already in stageGenerating, so they keep the old
-- generation-terminal check — waiting for full QA approval would delay them
-- for no correctness reason.
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
        or (
          -- profile/back/face_closeup structurally REQUIRE an accepted
          -- (qa-approved) identity master.
          r.angle_or_view in ('profile','back','face_closeup')
          and public.accepted_reference_identity(r.visual_world_version_id, r.entity_id) is not null
        )
        or (
          -- outfit_detail/action_pose only use the master as optional
          -- best-effort conditioning — a generation-terminal (not
          -- necessarily approved) anchor is enough to stop waiting, since
          -- stageGenerating falls back to independent generation.
          r.angle_or_view in ('outfit_detail','action_pose')
          and exists (
            select 1 from public.long_form_reference_assets anchor
            where anchor.visual_world_version_id = r.visual_world_version_id
              and anchor.entity_id = r.entity_id
              and anchor.angle_or_view = 'three_quarter_neutral'
              and anchor.status in ('succeeded','failed')
              and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
          )
        )
      )
    order by r.created_at limit 1 for update skip locked
  ) due
  where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;

-- Human override for Part 2's "QA usable but uncertain -> explicit user
-- approval" — never silently promotes; requires the SAME succeeded-only
-- precondition record_reference_qa_result already enforces, and stores who
-- approved it and why for the same qa_result audit trail.
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
  return true;
end $$;
revoke all on function public.approve_long_form_reference_identity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_long_form_reference_identity(uuid, uuid) to service_role;
