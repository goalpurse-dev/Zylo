-- Character sheet pack v3 (2026-09-11 architecture reversal): a manually
-- proven prompt showed FLUX CAN compose a correct 3-view sheet in one
-- image — the component-pack redesign this claim gate was extended for is
-- now superseded (deriveRequiredViews no longer produces those 9 angles).
-- Part 11 of this reversal explicitly requires the three sheets to
-- generate INDEPENDENTLY from the SAME CharacterIdentitySpec: "Do NOT feed
-- Identity/Outfit as an image reference into Face/Profile... For now the
-- priority is getting correctly structured sheets." This claim gate still
-- required an ACCEPTED identity_outfit_sheet/three_quarter_neutral/
-- identity_outfit_three_quarter anchor to exist before face_sheet or
-- profile_silhouette_sheet could even be CLAIMED (real incident: this is a
-- SEPARATE gate from the JS-layer dependsOnAngle already nulled out for
-- these two roles — this SQL function has its own independent, hardcoded
-- dependency list that the JS-layer change never touched). Removing
-- face_sheet/profile_silhouette_sheet from both occurrences below; every
-- other role's existing gating (old flat taxonomy, component-pack
-- taxonomy) is left untouched — those are legacy/historical only, not
-- reachable by current deriveRequiredViews output, so their gate becoming
-- moot for new rows is fine and lower-risk than touching it.
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
            or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back')
            or not exists (
              select 1 from public.long_form_reference_assets anchor
              where anchor.visual_world_version_id = r.visual_world_version_id
                and anchor.entity_id = r.entity_id
                and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
                and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
            )
            or (
              r.angle_or_view in ('profile','back','face_closeup','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back')
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
