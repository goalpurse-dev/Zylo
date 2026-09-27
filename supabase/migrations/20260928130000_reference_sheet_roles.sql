-- HERO pack redesign: identity_outfit_sheet/face_sheet/profile_silhouette_sheet
-- replace the old three_quarter_neutral/profile/back/face_closeup/
-- outfit_detail 5-view pack for HERO characters. identity_outfit_sheet
-- occupies the SAME "identity anchor" slot three_quarter_neutral used to —
-- exactly one exists per entity depending on which pack taxonomy that
-- entity uses — so every place that checked angle_or_view='three_quarter_
-- neutral' now checks IN ('three_quarter_neutral','identity_outfit_sheet').
-- face_sheet/profile_silhouette_sheet are STRICT dependents exactly like
-- profile/back/face_closeup were: they need the anchor to be genuinely
-- ACCEPTED (qa-approved), not merely generation-terminal.
create or replace function public.accepted_reference_identity(p_world uuid,p_entity text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet')
 and a.status='succeeded' and a.result_url is not null
 and a.generation_type='provider'
 and coalesce(a.qa_expectations->>'reviewStatus','approved')='approved'
 and (a.qa_status is null or a.qa_status='approved')
 and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id
   and n.generation_type<>'turnaround_master' and coalesce(n.qa_expectations->>'reviewStatus','approved')<>'rejected')
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_reference_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.accepted_reference_identity(uuid,text) to service_role;

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
        or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose','face_sheet','profile_silhouette_sheet')
        or not exists (
          select 1 from public.long_form_reference_assets anchor
          where anchor.visual_world_version_id = r.visual_world_version_id
            and anchor.entity_id = r.entity_id
            and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet')
            and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
        )
        or (
          r.angle_or_view in ('profile','back','face_closeup','face_sheet','profile_silhouette_sheet')
          and public.accepted_reference_identity(r.visual_world_version_id, r.entity_id) is not null
        )
        or (
          r.angle_or_view in ('outfit_detail','action_pose')
          and exists (
            select 1 from public.long_form_reference_assets anchor
            where anchor.visual_world_version_id = r.visual_world_version_id
              and anchor.entity_id = r.entity_id
              and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet')
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
