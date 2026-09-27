-- Every required reference must be claimable, actively leased, scheduled
-- for recovery, or terminal. This extends the existing Visual World lease
-- and cron architecture; it does not introduce a second queue.

create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets language plpgsql security definer set search_path = '' as $$
begin
  -- A strict derived role cannot ever become claimable when its identity
  -- source finished without an accepted result. Resolve that dependency to
  -- a real terminal state instead of leaving the child queued forever.
  update public.long_form_reference_assets a
  set status='failed', lease_until=null, last_error_code='IDENTITY_DEPENDENCY_UNAVAILABLE', last_error_at=now(), updated_at=now()
  where a.visual_world_version_id=p_visual_world_version_id
    and a.job_id is null and a.generation_type='provider'
    and a.status in ('pending','running')
    and a.angle_or_view in ('profile','back','face_closeup','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back','face_sheet','profile_silhouette_sheet')
    and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=a.id)
    and public.accepted_reference_identity(a.visual_world_version_id,a.entity_id) is null
    and exists (
      select 1 from public.long_form_reference_assets anchor
      where anchor.visual_world_version_id=a.visual_world_version_id and anchor.entity_id=a.entity_id
        and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
        and anchor.status in ('succeeded','failed')
        and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id=anchor.id)
    );

  update public.long_form_reference_assets a
  set status='failed', lease_until=null, last_error_code='ADOPT_SOURCE_UNAVAILABLE', last_error_at=now(), updated_at=now()
  from (values
    ('silhouette_front','identity_outfit_three_quarter'),
    ('silhouette_side','identity_outfit_side'),
    ('silhouette_back','identity_outfit_back')
  ) as dep(angle_or_view,source_angle)
  where a.visual_world_version_id=p_visual_world_version_id
    and a.angle_or_view=dep.angle_or_view and a.job_id is null
    and a.status in ('pending','running')
    and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=a.id)
    and public.accepted_component(a.visual_world_version_id,a.entity_id,dep.source_angle) is null
    and exists (
      select 1 from public.long_form_reference_assets source
      where source.visual_world_version_id=a.visual_world_version_id and source.entity_id=a.entity_id
        and source.angle_or_view=dep.source_angle and source.status in ('succeeded','failed')
        and not exists (select 1 from public.long_form_reference_assets newer2 where newer2.replaces_asset_id=source.id)
    );

  update public.long_form_reference_assets a
  set status='failed',lease_until=null,last_error_code='CLAIMS_EXHAUSTED',last_error_at=now(),updated_at=now()
  where a.visual_world_version_id=p_visual_world_version_id and a.job_id is null
    and a.status in ('pending','running') and a.claim_attempts>=3
    and (a.lease_until is null or a.lease_until<now());

  return query update public.long_form_reference_assets a
  set status='running',claim_attempts=a.claim_attempts+1,lease_until=now()+interval '3 minutes',updated_at=now()
  from (
    select r.id from public.long_form_reference_assets r
    left join (values
      ('silhouette_front','identity_outfit_three_quarter'),
      ('silhouette_side','identity_outfit_side'),
      ('silhouette_back','identity_outfit_back')
    ) as adopt_dep(angle_or_view,source_angle) on adopt_dep.angle_or_view=r.angle_or_view
    where r.visual_world_version_id=p_visual_world_version_id and r.job_id is null
      and r.generation_type='provider' and r.claim_attempts<3
      and (r.status='pending' or (r.status='running' and r.lease_until<now()))
      and not exists(select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=r.id)
      and (
        (adopt_dep.source_angle is not null and public.accepted_component(r.visual_world_version_id,r.entity_id,adopt_dep.source_angle) is not null)
        or (adopt_dep.source_angle is null and (
          r.reference_type<>'character_reference'
          or r.angle_or_view not in ('profile','back','face_closeup','outfit_detail','action_pose','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back','face_sheet','profile_silhouette_sheet')
          or not exists (
            select 1 from public.long_form_reference_assets anchor
            where anchor.visual_world_version_id=r.visual_world_version_id and anchor.entity_id=r.entity_id
              and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
              and not exists(select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id=anchor.id)
          )
          or (r.angle_or_view in ('profile','back','face_closeup','identity_outfit_side','identity_outfit_back','face_front','face_side','face_back','face_sheet','profile_silhouette_sheet')
              and public.accepted_reference_identity(r.visual_world_version_id,r.entity_id) is not null)
          or (r.angle_or_view in ('outfit_detail','action_pose') and exists (
            select 1 from public.long_form_reference_assets anchor
            where anchor.visual_world_version_id=r.visual_world_version_id and anchor.entity_id=r.entity_id
              and anchor.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet','identity_outfit_three_quarter')
              and anchor.status in ('succeeded','failed')
              and not exists(select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id=anchor.id)
          ))
        ))
      )
    order by r.created_at limit 1 for update skip locked
  ) due where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;

-- The existing minute cron already calls this function. A wider bounded
-- batch prevents an old backlog from starving newer worlds indefinitely.
create or replace function private.trigger_long_form_visual_world_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text; gateway_key text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  select decrypted_secret into gateway_key from vault.decrypted_secrets where name='long_form_gateway_anon_key' limit 1;
  if secret is null or research_url is null or gateway_key is null then return; end if;
  for target in
    select id from public.long_form_visual_world_versions
    where status in ('planning','generating') and stage in ('planning','generating','finalizing')
      and (worker_lock_until is null or worker_lock_until<now())
    order by updated_at limit 25
  loop
    perform net.http_post(
      url:=replace(research_url,'advance-long-form-research','advance-long-form-visual-world'),
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_key,'apikey',gateway_key,'x-recovery-secret',secret),
      body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=10000
    );
  end loop;
end $$;
revoke all on function private.trigger_long_form_visual_world_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_visual_world_recovery() to service_role;
