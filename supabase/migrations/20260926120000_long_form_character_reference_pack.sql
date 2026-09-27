-- Character reference PACK expansion (BACK, OUTFIT_DETAIL, ACTION_POSE
-- added alongside the existing PROFILE/FACE — see CHARACTER_REFERENCE_ROLES
-- in _shared/visualWorldStyle.ts). All of them derive from the entity's own
-- IDENTITY_3Q anchor the same way PROFILE/FACE already did, so the claim
-- gate that defers a derived view until its anchor is terminal needs to
-- recognize the new angle values too — otherwise a BACK/OUTFIT_DETAIL/
-- ACTION_POSE row would be claimable immediately, dispatching before its
-- identity anchor succeeded and never getting identity conditioning at all.
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
