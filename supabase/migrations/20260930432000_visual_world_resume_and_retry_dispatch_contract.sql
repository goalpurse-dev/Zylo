-- Keep the durable reference-job validator aligned with the renderer policy
-- used by advance-long-form-visual-world. A drift here previously rejected
-- valid Kling jobs as INVALID_REFERENCE_JOB before a jobs row could exist.
create or replace function public.enqueue_long_form_reference_job(
  p_asset_id uuid, p_job jsonb, p_claim_attempt integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.long_form_reference_assets;
  v public.long_form_visual_world_versions;
  owner_id uuid;
  tk text;
  expected_tk text;
  geometry boolean;
  is_klein_sheet boolean;
  is_kling_sheet boolean;
  is_edit boolean;
  anchor_id uuid;
  anchor_url text;
  parent_url text;
  ref_count int;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.job_id is not null then return a.job_id; end if;
  if a.status<>'running' or a.claim_attempts<>p_claim_attempt or a.lease_until is null or a.lease_until<=now() then
    raise exception 'CLAIM_EXPIRED';
  end if;

  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;

  tk := p_job->>'tool_key';
  is_edit := a.edit_instruction is not null;
  geometry := public.reference_geometry_role(a.reference_type,a.angle_or_view);
  is_klein_sheet := a.reference_type='character_reference' and a.angle_or_view='identity_outfit_sheet';
  is_kling_sheet := a.reference_type='character_reference' and a.angle_or_view='character_reference_sheet';
  expected_tk := case
    when is_edit then 'image:qwen.image-edit-plus'
    when geometry then 'image:qwen.image-edit-plus'
    when is_kling_sheet then 'image:kling.o3'
    when is_klein_sheet then 'image:flux.base'
    when a.reference_type in (
      'location_reference','object_reference','vehicle_reference',
      'celestial_reference','environment_reference'
    ) then 'image:kling.o3'
    else 'image:flux2.klein9bkv'
  end;

  if tk is distinct from expected_tk
     or (p_job->>'user_id')::uuid is distinct from owner_id
     or (p_job->>'id')::uuid is distinct from a.id then
    raise exception 'INVALID_REFERENCE_JOB';
  end if;

  if is_edit then
    select result_url into parent_url from public.long_form_reference_assets where id=a.replaces_asset_id;
    if a.replaces_asset_id is null
       or parent_url is null
       or a.input_reference_asset_ids is null
       or array_length(a.input_reference_asset_ids,1) <> 1
       or a.input_reference_asset_ids[1] is distinct from a.replaces_asset_id
       or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url) then
      raise exception 'EDIT_SOURCE_IMAGE_REQUIRED';
    end if;
  elsif geometry then
    anchor_id := public.accepted_reference_identity(v.id,a.entity_id);
    select result_url into anchor_url from public.long_form_reference_assets where id=anchor_id;
    if anchor_id is null
       or a.input_reference_asset_ids is null
       or array_length(a.input_reference_asset_ids,1) not in (1,2)
       or a.input_reference_asset_ids[1] is distinct from anchor_id
       or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(anchor_url) then
      raise exception 'ACCEPTED_IDENTITY_ANCHOR_REQUIRED';
    end if;
  elsif is_kling_sheet then
    ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'),0);
    if ref_count <> 0 then raise exception 'REGENERATE_MUST_HAVE_ZERO_REFERENCE_IMAGES'; end if;
  end if;

  insert into public.jobs(
    id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,
    charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after
  ) values(
    a.id,owner_id,'image',tk,null,p_job->>'prompt',
    (p_job->'settings')||jsonb_build_object(
      'credits',0,'priceUSD',0,'long_form_internal',true,
      'long_form_reference_asset_id',a.id
    ),
    p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,
    case when geometry or is_edit then 1 else 3 end,now()
  );

  update public.long_form_reference_assets
  set job_id=a.id,
      prompt_snapshot=p_job->>'prompt',
      render_model=case tk
        when 'image:qwen.image-edit-plus' then 'runware:108@22'
        when 'image:kling.o3' then 'klingai:kling-image@o3'
        when 'image:flux.base' then 'runware:400@4'
        else 'runware:400@6'
      end,
      updated_at=now()
  where id=a.id;
  return a.id;
end $$;

revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;

-- Double-clicking Try Again is idempotent. A retry also reactivates the
-- exact owning world so both the immediate Edge dispatch and minute cron can
-- claim it after the browser closes.
create or replace function public.retry_long_form_reference_asset(p_asset_id uuid,p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.long_form_reference_assets;
  v public.long_form_visual_world_versions;
  replacement_id uuid;
  owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;

  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id
  from public.long_form_reference_assets
  where replaces_asset_id=a.id
  order by created_at desc limit 1;
  if replacement_id is not null then return replacement_id; end if;

  -- A concurrent/repeated click refers to the same logical retry.
  if a.status in ('pending','running') then return a.id; end if;
  if a.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if v.stage='planning' or exists(
    select 1 from public.long_form_visual_world_versions other
    where other.project_id=v.project_id and other.id<>v.id
      and other.status in ('planning','generating')
  ) then raise exception 'WORLD_BUSY'; end if;

  if a.status='failed' and a.job_id is null then
    update public.long_form_reference_assets
    set status='pending',claim_attempts=0,lease_until=null,
        last_error_code=null,last_error_at=null,updated_at=now()
    where id=a.id;
    replacement_id := a.id;
  else
    insert into public.long_form_reference_assets(
      visual_world_version_id,entity_id,reference_type,angle_or_view,
      replaces_asset_id,render_model
    ) values(
      a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,
      a.id,a.render_model
    ) returning id into replacement_id;
  end if;

  update public.long_form_visual_world_versions
  set status='generating',stage='generating',stage_attempt=0,
      stage_started_at=now(),worker_lock_until=null,
      last_error_code=null,last_error_at=null,updated_at=now()
  where id=v.id;
  return replacement_id;
end $$;

revoke all on function public.retry_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_long_form_reference_asset(uuid,uuid) to service_role;

-- One authoritative resume decision. A newer candidate always wins over an
-- older adopted board, and a ready board alone is not proof that Scenes has
-- started. Generate requires durable work for the exact active plan+world.
create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  plan public.long_form_visual_plan_versions;
  latest_world public.long_form_visual_world_versions;
  compat jsonb;
  world_id uuid;
  charge public.long_form_episode_generation_charges;
  total_beats int;
  scene_counts jsonb;
  has_current_plans boolean := false;
  charge_matches_exact boolean := false;
begin
  select * into proj from public.long_form_projects where id=p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id=auth.uid() or auth.role()='service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('stage','none','route',null);
  end if;
  select * into plan from public.long_form_visual_plan_versions where id=proj.current_visual_plan_version_id;

  select * into latest_world
  from public.long_form_visual_world_versions
  where project_id=proj.id and visual_plan_version_id=proj.current_visual_plan_version_id
  order by version desc,created_at desc limit 1;

  if latest_world.id is not null
     and latest_world.id is distinct from proj.current_visual_world_version_id then
    return jsonb_build_object(
      'stage','visual_world','route','visual-world',
      'visualWorldVersionId',latest_world.id,
      'visualWorldStatus',latest_world.status,
      'awaitingAdoption',latest_world.status='ready'
    );
  end if;

  compat := public.long_form_visual_world_compatibility(p_project_id);
  if (compat->>'visualWorldVersionId') is null then
    return jsonb_build_object('stage','visual_plan_ready','route','look','visualPlanStatus',plan.status);
  end if;
  if not (compat->>'compatible')::boolean then
    return jsonb_build_object(
      'stage','visual_world','route','visual-world',
      'visualWorldVersionId',compat->>'visualWorldVersionId',
      'visualWorldStatus',compat->>'worldStatus'
    );
  end if;

  world_id := (compat->>'visualWorldVersionId')::uuid;
  if proj.active_generation_charge_id is not null then
    select * into charge from public.long_form_episode_generation_charges
    where id=proj.active_generation_charge_id;
  end if;
  charge_matches_exact := charge.id is not null
    and charge.status='charged'
    and charge.visual_plan_version_id=proj.current_visual_plan_version_id
    and charge.visual_world_version_id=world_id;

  select exists(
    select 1 from public.long_form_scene_render_plans
    where project_id=proj.id
      and visual_world_version_id=world_id
      and visual_plan_version_id=proj.current_visual_plan_version_id
  ) into has_current_plans;

  if not charge_matches_exact and not has_current_plans then
    return jsonb_build_object(
      'stage','visual_world','route','visual-world',
      'visualWorldVersionId',world_id,
      'visualWorldStatus',compat->>'worldStatus',
      'awaitingAdoption',false
    );
  end if;

  select jsonb_build_object(
    'ready',count(*) filter(where sc.status='succeeded' and sc.qa_status='approved'),
    'needsReview',count(*) filter(where sc.status='succeeded' and sc.qa_status='rejected'),
    'failed',count(*) filter(where sc.status='failed'),
    'generating',count(*) filter(where sc.status='running'),
    'queued',count(*) filter(where sc.status='pending'),
    'compiled',count(*)
  ) into scene_counts
  from public.long_form_scenes sc
  join public.long_form_scene_render_plans srp on srp.id=sc.scene_render_plan_id
  where srp.project_id=proj.id
    and srp.visual_world_version_id=world_id
    and srp.visual_plan_version_id=proj.current_visual_plan_version_id
    and (not charge_matches_exact or sc.generation_run_id=charge.id)
    and not exists(select 1 from public.long_form_scenes newer where newer.replaces_scene_id=sc.id);

  total_beats := coalesce(
    jsonb_array_length(plan.visual_plan->'visualBeats'),
    (plan.storyboard_summary->>'totalVisualBeats')::int,0
  );

  return jsonb_build_object(
    'stage','generate','route','generate',
    'visualWorldVersionId',world_id,
    'visualWorldStatus',compat->>'worldStatus',
    'chargeExists',charge_matches_exact,
    'creditsCharged',case when charge_matches_exact then charge.credits_charged else null end,
    'totalBeats',total_beats,
    'ready',coalesce((scene_counts->>'ready')::int,0),
    'needsReview',coalesce((scene_counts->>'needsReview')::int,0),
    'failed',coalesce((scene_counts->>'failed')::int,0),
    'generating',coalesce((scene_counts->>'generating')::int,0),
    'queued',coalesce((scene_counts->>'queued')::int,0),
    'planned',greatest(0,total_beats-coalesce((scene_counts->>'compiled')::int,0))
  );
end $$;

revoke all on function public.long_form_project_resume_state(uuid) from public,anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated,service_role;
