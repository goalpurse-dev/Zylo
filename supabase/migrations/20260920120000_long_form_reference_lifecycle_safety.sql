-- This migration follows the Visual World base/renderer migrations.
alter table public.long_form_reference_assets
  add column replaces_asset_id uuid references public.long_form_reference_assets(id),
  add column generation_latency_ms bigint;
create unique index long_form_reference_one_replacement on public.long_form_reference_assets(replaces_asset_id) where replaces_asset_id is not null;
update public.jobs j set settings=coalesce(j.settings,'{}'::jsonb)||jsonb_build_object('long_form_internal',true)
where exists(select 1 from public.long_form_reference_assets a where a.job_id=j.id);

-- The caller is a trusted worker only. Job insertion and the asset link
-- commit together; the provider cannot observe an orphan job after a crash.
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
  if v.renderer_tool_key <> 'image:flux.base' or p_job->>'tool_key' <> 'image:flux.base' or (p_job->>'user_id')::uuid <> owner_id or (p_job->>'id')::uuid <> a.id then raise exception 'INVALID_REFERENCE_JOB'; end if;
  insert into public.jobs (id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values (a.id,owner_id,'image','image:flux.base',null,p_job->>'prompt',p_job->'settings',p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_reference_assets set job_id=a.id, prompt_snapshot=p_job->>'prompt',render_model='runware:400@4',updated_at=now() where id=a.id;
  return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;

-- Replacements preserve the old row/job/cost/prompt/result. Lock the parent
-- first to serialize with finalization, then the slot. Repeat calls return
-- the SAME replacement, including after an uncertain HTTP response.
create or replace function public.replace_long_form_reference_asset(p_asset_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; replacement_id uuid; owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id from public.long_form_reference_assets where replaces_asset_id=a.id;
  if replacement_id is not null then return replacement_id; end if;
  if a.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if v.worker_lock_until > now() then raise exception 'WORLD_BUSY'; end if;
  if v.stage='planning' or exists(select 1 from public.long_form_visual_world_versions other where other.project_id=v.project_id and other.id<>v.id and other.status in ('planning','generating')) then raise exception 'WORLD_BUSY'; end if;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,replaces_asset_id,prompt_snapshot,render_model)
  values(a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,a.id,a.prompt_snapshot,a.render_model) returning id into replacement_id;
  update public.long_form_visual_world_versions set status='generating',stage='generating',stage_attempt=0,worker_lock_until=null,last_error_code=null,updated_at=now() where id=v.id;
  return replacement_id;
end $$;
revoke all on function public.replace_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.replace_long_form_reference_asset(uuid,uuid) to service_role;

-- Observing a submitted job is free and must never consume claim attempts.
-- Only rows without a durable job need the paid-work claim/reap lifecycle.
create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_reference_assets a set status='failed',lease_until=null,last_error_code='CLAIMS_EXHAUSTED',last_error_at=now()
  where a.visual_world_version_id=p_visual_world_version_id and a.job_id is null and a.status in ('pending','running') and a.claim_attempts>=3 and (a.lease_until is null or a.lease_until<now());
  return query update public.long_form_reference_assets a set status='running',claim_attempts=a.claim_attempts+1,lease_until=now()+interval '3 minutes',updated_at=now()
  from (select r.id from public.long_form_reference_assets r where r.visual_world_version_id=p_visual_world_version_id and r.job_id is null and r.claim_attempts<3 and (r.status='pending' or (r.status='running' and r.lease_until<now())) and not exists(select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=r.id) order by r.created_at limit 1 for update skip locked) due
  where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;

-- Deterministic recovery only. Uses the existing server-only recovery secret
-- without exposing it or changing it. The receiving endpoint accepts this
-- header ONLY for a generating/finalizing target, never for an LLM stage.
create or replace function private.trigger_long_form_visual_world_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  if secret is null or research_url is null then return; end if;
  for target in select id from public.long_form_visual_world_versions where status in ('planning','generating') and stage in ('generating','finalizing') and (worker_lock_until is null or worker_lock_until<now()) order by updated_at limit 3 loop
    perform net.http_post(url:=replace(research_url,'advance-long-form-research','advance-long-form-visual-world'),headers:=jsonb_build_object('Content-Type','application/json','x-recovery-secret',secret),body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=10000);
  end loop;
end $$;
revoke all on function private.trigger_long_form_visual_world_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_visual_world_recovery() to service_role;
select cron.schedule('long-form-visual-world-recovery','* * * * *','select private.trigger_long_form_visual_world_recovery();');
