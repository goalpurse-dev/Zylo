-- Reference-rendering-architecture fix: FLUX.2 Klein 9B provably cannot
-- compose a 3-panel "sheet" in one image (4 separate live Mars attempts
-- all rendered a single frontal view instead). Each HERO reference is now
-- its OWN component ReferenceAsset — the "sheet" is a programmatic UI
-- composition, never a 4th AI-generated image. New roles:
--   identity_outfit_three_quarter (anchor), identity_outfit_side, identity_outfit_back
--   face_front (crop), face_side, face_back
--   silhouette_front, silhouette_side, silhouette_back (adopted — zero-cost aliases)

-- Generalizes accepted_reference_identity's survives-regenerate logic
-- (qa_status:'approved' always wins regardless of a newer non-approved
-- candidate; qa_status:null only trusted as legacy-approved when nothing
-- for this entity+angle has ever recorded a real qa_status) to an
-- ARBITRARY single angle — needed because silhouette_side/back each adopt
-- a DIFFERENT specific sibling (identity_outfit_side / identity_outfit_back),
-- not the top-level identity anchor.
create or replace function public.accepted_component(p_world uuid, p_entity text, p_angle text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view=p_angle
 and a.status='succeeded' and a.result_url is not null
 and (
   a.qa_status='approved'
   or (
     a.qa_status is null
     and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id and coalesce(n.qa_expectations->>'reviewStatus','approved')<>'rejected')
     and not exists(select 1 from public.long_form_reference_assets q where q.visual_world_version_id=a.visual_world_version_id and q.entity_id=a.entity_id and q.angle_or_view=p_angle and q.qa_status is not null)
   )
 )
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_component(uuid,text,text) from public,anon,authenticated;
grant execute on function public.accepted_component(uuid,text,text) to service_role;

-- Claim gate extended with the new component roles. STRICT dependents
-- (identity_outfit_side/back, face_side/back) require the identity anchor
-- to be genuinely ACCEPTED (qa-approved) — mirrors accepted_reference_
-- identity exactly. face_front requires the SAME. silhouette_front/side/
-- back each require THEIR OWN specific source component (not necessarily
-- the top-level identity) to be accepted, via accepted_component.
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
            or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose','face_sheet','profile_silhouette_sheet','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back')
            or not exists (
              select 1 from public.long_form_reference_assets anchor
              where anchor.visual_world_version_id = r.visual_world_version_id
                and anchor.entity_id = r.entity_id
                and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
                and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
            )
            or (
              r.angle_or_view in ('profile','back','face_closeup','face_sheet','profile_silhouette_sheet','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back')
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
