-- Fresh Visual World generation/regeneration uses Kling IMAGE O3 for every
-- independent reference class. Seedream remains restricted to explicit
-- edits and legacy identity-conditioned geometry roles.
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
  expected_model text;
  geometry boolean;
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

  if is_edit or geometry then
    expected_tk := 'image:seedream5pro';
    expected_model := 'bytedance:seedream@5.0-pro';
  else
    expected_tk := 'image:kling.o3';
    expected_model := 'klingai:kling-image@o3';
  end if;

  if tk is distinct from expected_tk
     or (p_job->>'user_id')::uuid is distinct from owner_id
     or (p_job->>'id')::uuid is distinct from a.id then
    raise exception 'INVALID_REFERENCE_JOB';
  end if;

  ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'),0);
  if is_edit then
    select result_url into parent_url from public.long_form_reference_assets where id=a.replaces_asset_id;
    if a.replaces_asset_id is null or parent_url is null
       or a.input_reference_asset_ids is null or array_length(a.input_reference_asset_ids,1) <> 1
       or a.input_reference_asset_ids[1] is distinct from a.replaces_asset_id
       or ref_count <> 1
       or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url) then
      raise exception 'EDIT_SOURCE_IMAGE_REQUIRED';
    end if;
  elsif geometry then
    anchor_id := public.accepted_reference_identity(v.id,a.entity_id);
    select result_url into anchor_url from public.long_form_reference_assets where id=anchor_id;
    if anchor_id is null or a.input_reference_asset_ids is null
       or array_length(a.input_reference_asset_ids,1) not in (1,2)
       or a.input_reference_asset_ids[1] is distinct from anchor_id
       or ref_count not in (1,2)
       or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(anchor_url) then
      raise exception 'ACCEPTED_IDENTITY_ANCHOR_REQUIRED';
    end if;
  elsif ref_count <> 0 then
    raise exception 'INDEPENDENT_REFERENCE_MUST_HAVE_ZERO_REFERENCE_IMAGES';
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
  set job_id=a.id,prompt_snapshot=p_job->>'prompt',
      render_model=expected_model,updated_at=now()
  where id=a.id;
  return a.id;
end $$;

revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;
