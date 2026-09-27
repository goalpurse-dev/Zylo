-- Long Form Scene Generation V1 (2026-09-15).
--
-- Two tables, mirroring the proven long_form_reference_assets shape exactly
-- (claim_attempts/lease_until/qa_status/manual_approval/replaces-chain) —
-- reusing a design that has already survived many real incidents rather
-- than inventing a new one for scenes.
--
-- long_form_scene_render_plans: the durable, versioned, inspectable
-- SceneRenderPlan compiled from a VisualBeat (Part 3) — never held only in
-- React state. One row per (visual_world_version_id, visual_beat_id,
-- plan_version); a new plan_version is a full replacement, never an
-- in-place mutation of a plan already used to render a scene.
--
-- long_form_scenes: one row per actual render ATTEMPT (mirrors
-- long_form_reference_assets' "job.id = asset.id" 1:1 design with the jobs
-- table) — a scene's history is the replaces_scene_id chain, exactly like
-- reference assets, never overwritten in place.
create table if not exists public.long_form_scene_render_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  visual_world_version_id uuid not null references public.long_form_visual_world_versions(id) on delete cascade,
  visual_plan_version_id uuid not null references public.long_form_visual_plan_versions(id) on delete cascade,
  visual_beat_id text not null,
  plan_version int not null default 1,
  chapter_id text,
  sequence_index int,
  narration_segment_ids text[] not null default '{}',
  start_seconds numeric,
  end_seconds numeric,
  communication_goal text,
  narrative_function text,
  scene_type text not null,
  continuity_group_id text,
  base_setup_key text,
  composition jsonb not null default '{}',
  world_state_before jsonb not null default '{}',
  world_state_after jsonb not null default '{}',
  render_strategy text not null,
  source_scene_render_plan_id uuid references public.long_form_scene_render_plans(id),
  reference_asset_ids uuid[] not null default '{}',
  image_prompt text,
  overlay_spec jsonb,
  motion_intent text,
  factual_constraints jsonb not null default '[]',
  forbidden_elements text[] not null default '{}',
  qa_expectations jsonb not null default '{}',
  style_preset_id text,
  style_contract_version text,
  compiler_version text not null default 'scene-render-plan-v1',
  director_meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visual_world_version_id, visual_beat_id, plan_version)
);
create index if not exists idx_scene_render_plans_world on public.long_form_scene_render_plans(visual_world_version_id);

create table if not exists public.long_form_scenes (
  id uuid primary key default gen_random_uuid(),
  scene_render_plan_id uuid not null references public.long_form_scene_render_plans(id) on delete cascade,
  visual_world_version_id uuid not null references public.long_form_visual_world_versions(id) on delete cascade,
  visual_beat_id text not null,
  status text not null default 'pending', -- pending | running | succeeded | failed
  render_strategy text not null,
  render_model text,
  job_id uuid references public.jobs(id),
  result_url text,
  base_result_url text,
  final_result_url text,
  overlay_applied boolean not null default false,
  qa_status text,
  qa_result jsonb,
  qa_attempts int not null default 0,
  manual_approval boolean not null default false,
  manual_approval_user_id uuid,
  manual_approval_at timestamptz,
  replaces_scene_id uuid references public.long_form_scenes(id),
  edit_instruction text,
  input_reference_asset_ids uuid[] not null default '{}',
  claim_attempts int not null default 0,
  lease_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  cost_usd numeric,
  generation_latency_ms int,
  prompt_snapshot text,
  fallback_of_scene_id uuid references public.long_form_scenes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint long_form_scene_one_replacement unique (replaces_scene_id)
);
create index if not exists idx_scenes_world on public.long_form_scenes(visual_world_version_id);
create index if not exists idx_scenes_render_plan on public.long_form_scenes(scene_render_plan_id);
create index if not exists idx_scenes_job on public.long_form_scenes(job_id);

alter table public.long_form_projects add column if not exists current_scene_generation_status text;

-- Claim ONE pending scene for this world — SKIP LOCKED, same shape as
-- claim_long_form_reference_asset_for_version. Dependency gate: an EDIT/CROP
-- scene (has source_scene_render_plan_id, i.e. depends on a base scene
-- rendered from a DIFFERENT plan row for the same baseSetupKey) only claims
-- once that source's own CURRENT (unreplaced) scene row is terminal
-- (succeeded or failed) — Part 33's "generate the base scene first". A
-- scene with no source dependency claims immediately. Also sweeps
-- claim_attempts>=3 to CLAIMS_EXHAUSTED, matching the reference-asset
-- pattern exactly.
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
      and (
        srp.source_scene_render_plan_id is null
        or exists (
          select 1 from public.long_form_scenes src
          where src.scene_render_plan_id = srp.source_scene_render_plan_id
            and src.status in ('succeeded', 'failed')
            and not exists (select 1 from public.long_form_scenes newer2 where newer2.replaces_scene_id = src.id)
        )
      )
    order by sc.created_at limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;

-- Enqueue a scene's provider job — the SQL-level, true-last-resort renderer
-- contract enforcement, mirroring enqueue_long_form_reference_job exactly:
-- GENERATE must be Kling O3 with ZERO reference images (same "Regenerate
-- must never silently become image-to-image" invariant Visual World already
-- proved out); EDIT must be Qwen with exactly ONE reference image (the
-- scene it's editing).
create or replace function public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid;
  tk text; expected_tk text; ref_count int; parent_url text;
begin
  select * into s from public.long_form_scenes where id = p_scene_id for update;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  if s.job_id is not null then return s.job_id; end if;
  if s.status <> 'running' or s.claim_attempts <> p_claim_attempt or s.lease_until is null or s.lease_until <= now() then raise exception 'CLAIM_EXPIRED'; end if;
  select * into rp from public.long_form_scene_render_plans where id = s.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = s.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  tk := p_job->>'tool_key';
  ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'), 0);
  expected_tk := case when s.render_strategy = 'EDIT' then 'image:qwen.image-edit-plus' when s.render_strategy = 'GENERATE' then 'image:kling.o3' else null end;
  if expected_tk is null then raise exception 'SCENE_RENDER_STRATEGY_NOT_DISPATCHABLE'; end if;
  if tk is distinct from expected_tk
  or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from s.id then raise exception 'INVALID_SCENE_JOB'; end if;
  if s.render_strategy = 'EDIT' then
    -- Two distinct EDIT origins share this one dispatch path (Part 31): (a)
    -- a storyboard-driven EDIT beat whose source is a FIXED, different
    -- already-rendered scene (the render plan's own
    -- source_scene_render_plan_id -> that plan's current succeeded scene) —
    -- this source never changes across retries of the SAME plan, even
    -- though a retry also sets replaces_scene_id (to the failed/previous
    -- attempt of THIS shot, which must never be mistaken for the thing
    -- being edited); or (b) an ad-hoc user "Edit Scene" action layered onto
    -- a GENERATE-origin plan (no source_scene_render_plan_id at all), where
    -- replaces_scene_id genuinely IS the source. Check (a) first — a plan-
    -- level source always wins when one exists.
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
    -- Unlike character-SHEET regeneration (where a reference image caused
    -- REAL observed over-copying of a PRIOR sheet — the specific failure
    -- that made zero-references the rule there), a scene's GENERATE step is
    -- SUPPOSED to condition on the resolved canonical character/location
    -- reference images (Part 6/7: "character reference sheets used as
    -- reference material") — Kling faithfully following a reference is
    -- exactly what keeps a character/location visually consistent across
    -- scenes. The invariant to enforce here is narrower: the job's
    -- ref_images must be EXACTLY the render plan's own resolved
    -- reference_asset_ids (in any order) — never zero when references were
    -- required, never a substituted/extra image. A GENERATE beat with no
    -- required references (e.g. a referenceNeeded:false location) legally
    -- has zero.
    if ref_count <> coalesce(array_length(rp.reference_asset_ids, 1), 0)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(p_job->'input'->'ref_images', '[]'::jsonb)) got(url)
      where got.url not in (select coalesce(result_url, '') from public.long_form_reference_assets where id = any(rp.reference_asset_ids))
    )
    then raise exception 'GENERATE_REFERENCE_IMAGES_MUST_MATCH_RESOLVED_PLAN'; end if;
  end if;
  insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values(s.id,owner_id,'image',tk,null,p_job->>'prompt',
  (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_scene_id',s.id),
  p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_scenes set job_id = s.id, prompt_snapshot = p_job->>'prompt',
    render_model = case when tk = 'image:kling.o3' then 'klingai:kling-image@o3' when tk = 'image:qwen.image-edit-plus' then 'runware:108@22' else tk end,
    updated_at = now() where id = s.id;
  return s.id;
end $$;

-- Manual approval — identical contract to
-- approve_long_form_reference_asset_manually: column-only, no pixels, no
-- provider call, preserves the automated QA result.
create or replace function public.approve_long_form_scene_manually(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; owner_id uuid; replacement_id uuid;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then raise exception 'NOT_CURRENT'; end if;
  if sc.status <> 'succeeded' or sc.qa_status <> 'rejected' then raise exception 'NOTHING_TO_APPROVE'; end if;
  update public.long_form_scenes set qa_status = 'approved', manual_approval = true, manual_approval_user_id = p_user_id, manual_approval_at = now(), updated_at = now() where id = sc.id;
  return sc.id;
end $$;

-- Regenerate (Part 31): pre-dispatch failure (job_id null) resumes the SAME
-- row without burning provider retry budget; a genuine provider
-- failure/QA-rejection creates a fresh replacement row — same branching as
-- retry_long_form_reference_asset.
create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; owner_id uuid; replacement_id uuid;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;

  if sc.status = 'failed' and sc.job_id is null then
    update public.long_form_scenes set status='pending', claim_attempts=0, lease_until=null, last_error_code=null, last_error_at=null, updated_at=now() where id = sc.id;
    replacement_id := sc.id;
  else
    -- Retry a FRESH attempt of whatever this scene's OWN render strategy
    -- already is (inherited from its render plan at compile time) — never
    -- hardcoded to GENERATE. A failed storyboard-driven EDIT retries as an
    -- EDIT from the same fixed source (source_scene_render_plan_id), not a
    -- surprise brand-new GENERATE the plan never called for. The "Regenerate
    -- never silently uses Qwen" invariant (Part 31) is about a GENERATE-
    -- strategy scene never routing to Qwen on retry — enforced structurally
    -- by enqueue_long_form_scene_job's own tool_key<->render_strategy check,
    -- not by rewriting the strategy here.
    insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id)
    values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, sc.render_strategy, sc.id) returning id into replacement_id;
  end if;
  return replacement_id;
end $$;

-- Edit Scene (Part 31): always Qwen, always the current image + a natural-
-- language instruction, always additive.
create or replace function public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; owner_id uuid; trimmed text; replacement_id uuid;
begin
  trimmed := trim(coalesce(p_instruction, ''));
  if length(trimmed) < 3 or length(trimmed) > 800 then raise exception 'INVALID_INSTRUCTION'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  select id into replacement_id from public.long_form_scenes where replaces_scene_id = sc.id;
  if replacement_id is not null then return replacement_id; end if;
  if sc.status <> 'succeeded' or sc.result_url is null then raise exception 'NOTHING_TO_EDIT'; end if;
  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,edit_instruction,input_reference_asset_ids)
  values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'EDIT', sc.id, trimmed, array[]::uuid[]) returning id into replacement_id;
  return replacement_id;
end $$;

-- Record a scene QA result — mirrors record_reference_qa_result: only
-- accepts a terminal (succeeded) generation, increments qa_attempts.
create or replace function public.record_scene_qa_result(p_scene_id uuid, p_approved boolean, p_qa_result jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  if sc.status <> 'succeeded' then raise exception 'TERMINAL_GENERATION_REQUIRED'; end if;
  update public.long_form_scenes
  set qa_status = case when p_approved then 'approved' else 'rejected' end, qa_result = p_qa_result, qa_attempts = sc.qa_attempts + 1, updated_at = now()
  where id = p_scene_id;
end $$;

-- The DB-level equivalent of the frontend's currentReferenceAssets/
-- selectCurrentVisualWorldAssets selector (visualWorldPlanning.js) and of
-- reconcile_visual_world_completion_status's own "ready" definition: the
-- single authoritative "what does the Visual World currently, canonically
-- have" resolver — Scene Generation's reference resolver (Part 6: "never
-- historical/rejected/retired assets") must read through THIS, not
-- reinvent its own notion of "current" in application code. "Current" =
-- not superseded (no later row's replaces_asset_id points at it), not
-- stale. "Ready" = current AND succeeded AND qa_status is not 'rejected'
-- (null passes, exactly like reconcile_visual_world_completion_status).
create or replace function public.current_long_form_reference_assets(p_visual_world_version_id uuid)
returns table(id uuid, entity_id text, reference_type text, angle_or_view text, result_url text, status text, qa_status text, is_ready boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with all_assets as (
    select * from public.long_form_reference_assets where visual_world_version_id = p_visual_world_version_id
  ), replaced_ids as (
    select replaces_asset_id as id from all_assets where replaces_asset_id is not null
  )
  select a.id, a.entity_id, a.reference_type, a.angle_or_view, a.result_url, a.status, a.qa_status,
    (a.status = 'succeeded' and a.result_url is not null and a.qa_status is distinct from 'rejected') as is_ready,
    a.created_at
  from all_assets a
  where a.id not in (select id from replaced_ids) and coalesce(a.stale, false) = false
$$;

-- One canonical reference per entity/angle for a scene compile — picks the
-- most recently created current+ready row (an entity/angle should only
-- ever have one current row at a time, but "most recent" is the same
-- tie-break every other selector in this codebase uses).
-- The current (unreplaced) scene row for a render plan — used by the
-- worker to resolve a REUSE/CROP/COMPOSITE/EDIT scene's SOURCE image
-- before dispatch, and by enqueue_long_form_scene_job's own EDIT-source
-- check above (kept as an inline subquery there for atomicity; exposed
-- here too so the edge function doesn't need to reimplement the same
-- "no newer replacement" logic in application code).
create or replace function public.current_scene_for_render_plan(p_scene_render_plan_id uuid)
returns public.long_form_scenes
language sql stable security definer set search_path = '' as $$
  select sc.* from public.long_form_scenes sc
  where sc.scene_render_plan_id = p_scene_render_plan_id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id)
  order by sc.created_at desc limit 1
$$;

-- Standing per-minute recovery (Part: "durable generation surviving page
-- close/refresh/crash/worker restart/Edge Function timeout") — same proven
-- pattern as trigger_long_form_visual_world_recovery: reuse the existing
-- vault-stored recovery secret/URL via string-replace, never a new secret.
-- Sweeps every world with outstanding scene work (pending, or running past
-- its lease) rather than requiring a caller to remember a specific target.
create or replace function private.trigger_long_form_scene_generation_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  if secret is null or research_url is null then return; end if;
  for target in
    select distinct visual_world_version_id as id from public.long_form_scenes
    where status = 'pending' or (status = 'running' and (lease_until is null or lease_until < now()))
    order by id limit 5
  loop
    perform net.http_post(url:=replace(research_url,'advance-long-form-research','advance-long-form-scene-generation'),headers:=jsonb_build_object('Content-Type','application/json','x-recovery-secret',secret),body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=15000);
  end loop;
end $$;
revoke all on function private.trigger_long_form_scene_generation_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_scene_generation_recovery() to service_role;
select cron.schedule('long-form-scene-generation-recovery','* * * * *','select private.trigger_long_form_scene_generation_recovery();');

create or replace function public.resolve_canonical_reference(p_visual_world_version_id uuid, p_entity_id text, p_angle text)
returns table(id uuid, entity_id text, reference_type text, angle_or_view text, result_url text, status text, qa_status text, is_ready boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.current_long_form_reference_assets(p_visual_world_version_id)
  where entity_id = p_entity_id and angle_or_view = p_angle and is_ready
  order by created_at desc limit 1
$$;
