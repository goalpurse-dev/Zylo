-- 2026-09-21 EMERGENCY: durable pause for an in-progress episode scene
-- generation run. Real incident: Sun project generation (charge
-- c0c18228-bd55-4a84-b6f2-eb16123db5fb) needed to stop immediately with
-- zero further Runware submissions, without losing completed scenes,
-- without creating a new generation version, and without deleting anything.
--
-- The pause flag lives on long_form_episode_generation_charges — the ONE
-- row every long_form_scenes row already points back to via
-- generation_run_id, i.e. exactly "the generation/version entity already
-- controlling the scene workflow." Two independent gates check it:
--   1. claim_long_form_scene_for_render — refuses to claim any scene whose
--      generation run is paused (stops a scene from ever entering
--      'running'/being handed to a worker at all).
--   2. enqueue_long_form_scene_job — the actual pre-submission boundary
--      (the last write before a Runware job row is created) — re-checks
--      pause even for an ALREADY-claimed scene, closing the race where a
--      worker claimed a scene a moment before pause was set. If paused
--      here, the scene is released back to 'pending' with claim_attempts
--      decremented back to its pre-claim value (never consumes an attempt,
--      never counted as a failure) so it resumes cleanly once un-paused.
-- A scene whose provider job was already actually submitted (job_id set)
-- is explicitly NOT touched by either gate — normal polling lets it finish
-- and persist its result, per the explicit requirement not to lose
-- already-submitted paid work. Every other line of both functions below is
-- copied verbatim from their current definitions (20260930210000) — only
-- the pause checks are new.

alter table public.long_form_episode_generation_charges
  add column if not exists is_paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by uuid;

create or replace function public.claim_long_form_scene_for_render(p_visual_world_version_id uuid)
returns setof public.long_form_scenes
language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_scenes s set status='failed', lease_until=null, last_error_code='CLAIMS_EXHAUSTED', last_error_at=now()
  where s.visual_world_version_id = p_visual_world_version_id and s.job_id is null and s.status in ('pending','running')
    and s.claim_attempts >= 3 and (s.lease_until is null or s.lease_until < now());

  return query update public.long_form_scenes s set status='running', claim_attempts=s.claim_attempts+1, lease_until=now()+interval '4 minutes', updated_at=now()
  from (
    select sc.id, srp.source_scene_render_plan_id
    from public.long_form_scenes sc
    join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
    where sc.visual_world_version_id = p_visual_world_version_id
      and sc.job_id is null
      and sc.claim_attempts < 3
      and (sc.status = 'pending' or (sc.status = 'running' and sc.lease_until < now()))
      and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id)
      -- EMERGENCY PAUSE GATE: never claim a scene belonging to a paused
      -- generation run. A scene with no generation_run_id at all (legacy/
      -- edit rows outside the episode-generation flow) is unaffected.
      and not exists (
        select 1 from public.long_form_episode_generation_charges g
        where g.id = sc.generation_run_id and g.is_paused = true
      )
      and (
        srp.source_scene_render_plan_id is null
        or exists (
          select 1 from public.long_form_scenes src
          where src.scene_render_plan_id = srp.source_scene_render_plan_id
            and src.status in ('succeeded', 'failed')
            and not exists (select 1 from public.long_form_scenes newer2 where newer2.replaces_scene_id = src.id)
        )
      )
    order by srp.sequence_index limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;

-- Race-safety boundary: a worker may have claimed a scene a moment BEFORE
-- pause was set. This is the actual pre-submission checkpoint (the very
-- next write before a Runware job is created) — re-checking pause here
-- closes that window.
create or replace function public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid;
  tk text; expected_tk text; ref_count int; parent_url text; required_ids uuid[]; bundle_id_used uuid; run_paused boolean;
begin
  select * into s from public.long_form_scenes where id = p_scene_id for update;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  if s.job_id is not null then return s.job_id; end if;
  if s.status <> 'running' or s.claim_attempts <> p_claim_attempt or s.lease_until is null or s.lease_until <= now() then raise exception 'CLAIM_EXPIRED'; end if;

  -- EMERGENCY PAUSE GATE (race-safety boundary): a worker may have claimed
  -- this scene a moment before pause was set. Release it back to 'pending'
  -- without consuming the claim attempt just spent, so it is never counted
  -- as a failure and resumes cleanly once un-paused.
  select is_paused into run_paused from public.long_form_episode_generation_charges where id = s.generation_run_id;
  if run_paused then
    update public.long_form_scenes set status = 'pending', claim_attempts = p_claim_attempt - 1, lease_until = null where id = s.id;
    raise exception 'GENERATION_PAUSED';
  end if;

  select * into rp from public.long_form_scene_render_plans where id = s.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = s.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  tk := p_job->>'tool_key';
  ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'), 0);
  expected_tk := case when s.render_strategy = 'EDIT' then 'image:qwen.image-edit-plus' when s.render_strategy = 'GENERATE' then public.long_form_tier_primary_tool_key(rp.render_tier) else null end;
  if expected_tk is null then raise exception 'SCENE_RENDER_STRATEGY_NOT_DISPATCHABLE'; end if;
  if tk is distinct from expected_tk
  or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from s.id then raise exception 'INVALID_SCENE_JOB'; end if;
  if s.render_strategy = 'EDIT' then
    if rp.source_scene_render_plan_id is not null then
      select sc2.result_url into parent_url
      from public.long_form_scenes sc2
      where sc2.scene_render_plan_id = rp.source_scene_render_plan_id and sc2.status = 'succeeded'
        and not exists (select 1 from public.long_form_scenes newer3 where newer3.replaces_scene_id = sc2.id)
      order by sc2.created_at desc limit 1;
    elsif s.replaces_scene_id is not null then
      select result_url into parent_url from public.long_form_scenes where id = s.replaces_scene_id;
    end if;
    if parent_url is null or ref_count <> 1
    or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url)
    then raise exception 'EDIT_SOURCE_IMAGE_REQUIRED'; end if;
  elsif s.render_strategy = 'GENERATE' then
    required_ids := rp.reference_asset_ids;
    if coalesce(array_length(required_ids, 1), 0) = 0 then
      if ref_count <> 0 then raise exception 'GENERATE_REFERENCE_IMAGES_MUST_MATCH_RESOLVED_PLAN'; end if;
    elsif ref_count = array_length(required_ids, 1)
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(p_job->'input'->'ref_images', '[]'::jsonb)) got(url)
        where got.url not in (select coalesce(result_url, '') from public.long_form_reference_assets where id = any(required_ids))
      )
    then
      -- Direct match: the renderer's own limit covered every canonical
      -- reference, sent as-is.
      null;
    elsif ref_count = 1 then
      -- Must be exactly one SceneReferenceBundle whose OWN persisted
      -- source set is EXACTLY (as a set, order-independent) this plan's
      -- resolved reference_asset_ids — never a bundle built from a
      -- different, partial, or superseded reference set.
      select b.id into bundle_id_used from public.long_form_scene_reference_bundles b
      where b.storage_url = (p_job->'input'->'ref_images'->>0)
        and b.visual_world_version_id = s.visual_world_version_id
        and (select array_agg(x order by x) from unnest(b.source_reference_asset_ids) x) = (select array_agg(x order by x) from unnest(required_ids) x);
      if bundle_id_used is null then raise exception 'GENERATE_REFERENCE_BUNDLE_MISMATCH'; end if;
    else
      raise exception 'GENERATE_REFERENCE_IMAGES_MUST_MATCH_RESOLVED_PLAN';
    end if;
  end if;
  insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values(s.id,owner_id,'image',tk,null,p_job->>'prompt',
  (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_scene_id',s.id),
  p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_scenes set job_id = s.id, prompt_snapshot = p_job->>'prompt', reference_bundle_id = bundle_id_used,
    render_model = case when tk = 'image:kling.o3' then 'klingai:kling-image@o3' when tk = 'image:flux2.klein9bkv' then 'runware:400@6' when tk = 'image:seedream5lite' then 'bytedance:seedream@5.0-lite' when tk = 'image:qwen.image-edit-plus' then 'runware:108@22' else tk end,
    updated_at = now() where id = s.id;
  return s.id;
end $$;

-- 2026-09-21 EMERGENCY PAUSE: set THIS SPECIFIC generation run's pause flag
-- immediately. No new version created, no scenes deleted, no status on any
-- long_form_scenes row changed — completed scenes stay completed, pending
-- scenes stay pending (simply no longer eligible for claiming), and the one
-- scene already 'running' at the moment of this migration is left alone to
-- finish and persist its result via normal polling.
update public.long_form_episode_generation_charges
set is_paused = true, paused_at = now()
where id = 'c0c18228-bd55-4a84-b6f2-eb16123db5fb';
