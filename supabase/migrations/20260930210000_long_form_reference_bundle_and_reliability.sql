-- Scene generation reliability pass (2026-09-15). Real production blockers
-- found by inspecting Mars's live state directly: (1) every V3 GENERATE
-- scene needing >1 canonical reference structurally cannot dispatch — Kling
-- IMAGE O3's own verified maxReferenceImages is 1, but a real scene often
-- needs a character sheet + location anchor + object reference at once;
-- (2) the claim queue orders by created_at, not story order, so early
-- scenes can wait behind later ones for no reason; (3) an ad-hoc Edit Scene
-- action and a plain Regenerate both drop the predecessor's canonical
-- reference association instead of inheriting it; (4) test/history scenes
-- from before a real paid charge have no way to be excluded from that
-- charge's own progress counters.

-- ---------------------------------------------------------------------
-- SceneReferenceBundle: a $0, deterministic, cacheable composited image —
-- transport/conditioning material only, never a generation itself. Content-
-- addressed by bundle_hash (visual_world_version_id + sorted canonical
-- reference asset ids + contract version — see sceneReferenceBundle.ts) so
-- the identical set of references is composited exactly once, ever.
create table if not exists public.long_form_scene_reference_bundles (
  id uuid primary key default gen_random_uuid(),
  visual_world_version_id uuid not null references public.long_form_visual_world_versions(id) on delete cascade,
  bundle_hash text not null unique,
  source_reference_asset_ids uuid[] not null,
  layout_version text not null,
  storage_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_scene_reference_bundles_world on public.long_form_scene_reference_bundles(visual_world_version_id);
alter table public.long_form_scene_reference_bundles enable row level security;
revoke all on public.long_form_scene_reference_bundles from anon, authenticated;
create policy "Owners can view their project's reference bundles" on public.long_form_scene_reference_bundles
  for select using (exists (
    select 1 from public.long_form_visual_world_versions v join public.long_form_projects p on p.id = v.project_id
    where v.id = long_form_scene_reference_bundles.visual_world_version_id and p.user_id = auth.uid()
  ));

-- reference_bundle_id: which bundle (if any) actually conditioned this
-- scene's dispatch — purely provenance/debugging, never read for policy
-- decisions (input_reference_asset_ids, below, remains the one place the
-- CANONICAL reference set lives regardless of transport mechanism).
alter table public.long_form_scenes add column if not exists reference_bundle_id uuid references public.long_form_scene_reference_bundles(id);

-- generation_run_id: which paid Generate Episode charge this scene attempt
-- belongs to (Part 10). NULL means pre-charge test/history — existing rows
-- backfilled to NULL explicitly (they predate any real charge on this
-- project), so the frontend's paid-run progress counters can filter to
-- `generation_run_id = <the active charge id>` and never count old
-- development scenes as part of a fresh paid run's Ready/Needs Review
-- totals. History remains fully queryable — nothing is deleted or hidden,
-- only excluded from THIS specific counter.
alter table public.long_form_scenes add column if not exists generation_run_id uuid references public.long_form_episode_generation_charges(id);
update public.long_form_scenes set generation_run_id = null where generation_run_id is not null and false; -- no-op safety line, real backfill is the column default (already null)
create index if not exists idx_scenes_generation_run on public.long_form_scenes(generation_run_id);

-- ---------------------------------------------------------------------
-- Claim priority: sequence_index (real story order), not created_at (Part
-- 11) — the HOOK/opening must never wait behind a later scene that simply
-- happened to compile first. Independent GENERATE scenes are still NOT
-- serialized on provider completion (the worker fires a job and re-claims
-- immediately — see advance-long-form-scene-generation's kickJobWorker
-- comment); this only changes the ORDER claims are handed out in, not
-- whether they run concurrently.
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
    order by srp.sequence_index limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;

-- ---------------------------------------------------------------------
-- enqueue_long_form_scene_job: GENERATE validation now accepts EITHER the
-- exact resolved canonical reference URLs directly (renderer's own limit
-- covers them) OR exactly one bundle image whose OWN persisted source set
-- exactly equals the plan's resolved reference_asset_ids (Part 2/3) — never
-- a partial/truncated set either way. EDIT's single-source-image check is
-- unchanged.
create or replace function public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid;
  tk text; expected_tk text; ref_count int; parent_url text; required_ids uuid[]; bundle_id_used uuid;
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

-- ---------------------------------------------------------------------
-- retry_long_form_scene / edit_long_form_scene: the replacement row now
-- inherits BOTH input_reference_asset_ids (Part 12 — a retry/edit must
-- never silently drift away from the canonical Visual World just because
-- its OWN insert forgot to carry the predecessor's reference set forward)
-- and generation_run_id (Part 10 — "Regenerate/Edit descendants stay
-- associated with the generation run") from the scene they replace. Every
-- other check/branch is unchanged from the pricing migration's version.
create or replace function public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; replacement_id uuid; price int; balance int;
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
    select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
    if sc.render_strategy = 'EDIT' then
      price := public.long_form_tier_edit_credits(rp.render_tier);
    else
      price := public.long_form_tier_generate_credits(rp.render_tier);
    end if;
    select credit_balance into balance from public.profiles where id = p_user_id for update;
    if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
    update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
    insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,credits_charged,input_reference_asset_ids,generation_run_id)
    values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, sc.render_strategy, sc.id, price, sc.input_reference_asset_ids, sc.generation_run_id) returning id into replacement_id;
    insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
    values(replacement_id, v.project_id, p_user_id, 'regenerate', rp.render_tier, price);
  end if;
  return replacement_id;
end $$;

create or replace function public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid; trimmed text; replacement_id uuid; price int; balance int;
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

  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  price := public.long_form_tier_edit_credits(rp.render_tier);
  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,edit_instruction,input_reference_asset_ids,credits_charged,generation_run_id)
  values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'EDIT', sc.id, trimmed, sc.input_reference_asset_ids, price, sc.generation_run_id) returning id into replacement_id;
  insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
  values(replacement_id, v.project_id, p_user_id, 'edit', rp.render_tier, price);
  return replacement_id;
end $$;
