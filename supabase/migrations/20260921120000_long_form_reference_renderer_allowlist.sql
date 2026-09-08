-- Extends enqueue_long_form_reference_job's hard-coded single-renderer check
-- (image:flux.base only) to a small explicit allowlist, so the FLUX.2
-- [klein] 9B KV renderer A/B test can go through the SAME real durable
-- ReferenceAsset -> job -> job-worker -> Runware -> reconciliation pipeline
-- as flux.base, never a temporary script calling Runware directly. Still
-- exactly two entries — no premium/unverified model is added here.
create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.job_id is not null then return a.job_id; end if;
  if a.status <> 'running' or a.claim_attempts <> p_claim_attempt or a.lease_until <= now() then raise exception 'CLAIM_EXPIRED'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if v.renderer_tool_key not in ('image:flux.base','image:flux2.klein9bkv')
     or p_job->>'tool_key' <> v.renderer_tool_key
     or (p_job->>'user_id')::uuid <> owner_id
     or (p_job->>'id')::uuid <> a.id then
    raise exception 'INVALID_REFERENCE_JOB';
  end if;
  insert into public.jobs (id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values (a.id,owner_id,'image',v.renderer_tool_key,null,p_job->>'prompt',p_job->'settings',p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_reference_assets set job_id=a.id, prompt_snapshot=p_job->>'prompt', render_model=case v.renderer_tool_key when 'image:flux2.klein9bkv' then 'runware:400@6' else 'runware:400@4' end, updated_at=now() where id=a.id;
  return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;
