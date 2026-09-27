-- Long Form Scene Generation — model tier selection, credit pricing and
-- idempotent episode-level charging (Generate workspace).
--
-- This is an ADDITIVE extension of the existing Scene Generation V1 backend
-- (long_form_scene_render_plans / long_form_scenes / start-long-form-scene-
-- generation / advance-long-form-scene-generation) — nothing here replaces
-- or rebuilds that machinery. It adds exactly two things V1 didn't have:
-- (1) a user-selectable GENERATE-renderer tier (V2/V3/V4), and (2) a real,
-- idempotent, server-computed credit charge for starting an episode's scene
-- generation, mirroring the existing generation_credit_ledger/deduct_credits
-- pattern used by every other paid Zyvo tool rather than inventing a
-- parallel wallet system.

alter table public.long_form_projects add column if not exists scene_generation_tier text not null default 'v3' check (scene_generation_tier in ('v2', 'v3', 'v4'));

-- Persisted on the PLAN itself at compile time (not just read live from the
-- project) so a tier change never silently reprices/reroutes a scene whose
-- SceneRenderPlan was already compiled under a different tier — matches the
-- explicit "must NOT change storyboard intelligence, SceneRenderPlans... "
-- constraint. Existing rows (compiled before this column existed, all under
-- the original Kling-only V1 policy) default to 'v3', which is exactly the
-- renderer they actually used.
alter table public.long_form_scene_render_plans add column if not exists render_tier text not null default 'v3' check (render_tier in ('v2', 'v3', 'v4'));

-- One row per successfully charged "Generate Episode" action. A project can
-- have at most one ACTIVE (non-refunded) charge at a time — the partial
-- unique index below is what makes double-click/reload structurally unable
-- to double-charge: a second charge attempt for the same project simply
-- finds the existing row and returns it unchanged (see
-- charge_long_form_episode_generation below), never re-debiting.
create table if not exists public.long_form_episode_generation_charges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  visual_world_version_id uuid not null references public.long_form_visual_world_versions(id),
  visual_plan_version_id uuid not null references public.long_form_visual_plan_versions(id),
  user_id uuid not null,
  tier text not null check (tier in ('v2', 'v3', 'v4')),
  credits_charged int not null check (credits_charged >= 0),
  cost_breakdown jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'charged' check (status in ('charged', 'refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create unique index if not exists long_form_episode_charge_one_active_per_project
  on public.long_form_episode_generation_charges(project_id) where status = 'charged';

-- Deterministic strategy categorization — the SQL mirror of
-- _shared/sceneRenderPlan.ts's RENDER_STRATEGY_FROM_METHOD map (real Mars
-- evidence: renderMethod already maps 1:1 to render strategy for every one
-- of 115 real beats, see that file's own comment). Kept here rather than
-- called cross-runtime because Postgres cannot import a Deno module —
-- same disclosed duplication pattern this codebase already uses for
-- stylePresets.js mirroring visualWorldStyle.ts. Keep in sync by hand if
-- the render-method taxonomy ever changes.
create or replace function public.categorize_long_form_render_method(p_render_method text)
returns text language sql immutable as $$
  select case p_render_method
    when 'GENERATE' then 'freshGenerations'
    when 'EDIT' then 'edits'
    when 'REUSE' then 'reused'
    when 'CROP' then 'crops'
    when 'COMPOSITE' then 'crops'
    when 'PROGRAMMATIC_GRAPHIC' then 'graphics'
    else 'graphics'
  end
$$;

-- Per-tier GENERATE credit cost — mirrors src/lib/providers.ts's real
-- entries (image:flux2.klein9bkv=2, image:kling.o3=3) plus a disclosed
-- placeholder for Seedream 5.0 Pro (image:seedream5pro=5, NOT yet a real
-- verified Runware price — see providers.ts's own comment on that entry).
-- EDIT is always Qwen Image Edit Plus (2 credits) regardless of tier — the
-- user's own selected tier only ever changes the GENERATE/main renderer,
-- never the edit renderer. REUSE/CROP/PROGRAMMATIC_GRAPHIC are always 0.
create or replace function public.long_form_tier_generate_credits(p_tier text)
returns int language sql immutable as $$
  select case p_tier when 'v2' then 2 when 'v3' then 3 when 'v4' then 5 else 3 end
$$;
create or replace function public.long_form_tier_edit_credits(p_tier text)
returns int language sql immutable as $$ select 2 $$;

-- Pure, side-effect-free, callable anytime (including by an anonymous
-- price-preview) — the ONE authoritative price source both the frontend's
-- live estimate AND the server-side charge below read from, so they can
-- never drift apart. Categorizes every VisualBeat in the project's CURRENT
-- visual plan by its own (already-decided, deterministic) renderMethod —
-- never requires a SceneRenderPlan to already exist, so pricing an episode
-- that hasn't been compiled yet costs zero provider calls of any kind.
create or replace function public.estimate_long_form_episode_credits(p_project_id uuid, p_tier text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  plan jsonb; counts jsonb; total int; gen_credits int; edit_credits int;
begin
  if p_tier not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;
  -- security definer bypasses RLS — explicitly re-check ownership here so
  -- an authenticated user can't probe another project's scene breakdown by
  -- guessing its id (the SQL definer grant alone doesn't enforce this).
  select vpv.visual_plan into plan
  from public.long_form_projects p
  join public.long_form_visual_plan_versions vpv on vpv.id = p.current_visual_plan_version_id
  where p.id = p_project_id and (p.user_id = auth.uid() or auth.role() = 'service_role');
  if plan is null then raise exception 'VISUAL_PLAN_NOT_READY'; end if;

  with categorized as (
    select public.categorize_long_form_render_method(b->>'renderMethod') as category
    from jsonb_array_elements(coalesce(plan->'visualBeats', '[]'::jsonb)) b
  )
  select jsonb_build_object(
    'freshGenerations', count(*) filter (where category = 'freshGenerations'),
    'edits', count(*) filter (where category = 'edits'),
    'reused', count(*) filter (where category = 'reused'),
    'crops', count(*) filter (where category = 'crops'),
    'graphics', count(*) filter (where category = 'graphics')
  ) into counts from categorized;

  gen_credits := public.long_form_tier_generate_credits(p_tier);
  edit_credits := public.long_form_tier_edit_credits(p_tier);
  total := (counts->>'freshGenerations')::int * gen_credits + (counts->>'edits')::int * edit_credits;

  return jsonb_build_object(
    'totalCredits', total, 'tier', p_tier,
    'creditsPerFreshGeneration', gen_credits, 'creditsPerEdit', edit_credits,
    'breakdown', counts
  );
end $$;
revoke all on function public.estimate_long_form_episode_credits(uuid, text) from public, anon;
grant execute on function public.estimate_long_form_episode_credits(uuid, text) to authenticated, service_role;

-- Idempotent charge: recomputes price SERVER-SIDE via the function above
-- (never trusts a client-supplied amount), validates the project is
-- actually ready (Visual World ready, no Needs Review references, current
-- visual plan unchanged since p_visual_plan_version_id was read by the
-- caller), then debits credits exactly once per project via the SAME
-- row-locking pattern deduct_credits already uses elsewhere. A second call
-- for a project that already has an active charge returns that existing
-- charge unchanged (idempotent no-op) — this is what makes a double-click
-- or a reload-and-resubmit structurally unable to double-charge, with no
-- reliance on client-side debouncing.
create or replace function public.charge_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions;
  existing public.long_form_episode_generation_charges;
  price jsonb; total int; balance int; idem_key text;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;

  select * into existing from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged';
  if found then
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'creditsCharged', existing.credits_charged, 'breakdown', existing.cost_breakdown, 'tier', existing.tier);
  end if;

  if proj.current_visual_world_version_id is null or proj.current_visual_plan_version_id is null then raise exception 'NOT_READY'; end if;
  select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if world.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;

  price := public.estimate_long_form_episode_credits(p_project_id, p_tier);
  total := (price->>'totalCredits')::int;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;

  idem_key := p_project_id::text || ':episode_generation';
  insert into public.long_form_episode_generation_charges(project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key)
  values (p_project_id, proj.current_visual_world_version_id, proj.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key)
  on conflict (idempotency_key) do nothing;

  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid, uuid, text) to service_role;

-- SQL mirror of sceneRendererTiers.ts's SCENE_TIER_PRIMARY_TOOL_KEY — same
-- disclosed cross-runtime duplication as categorize_long_form_render_method
-- above (Postgres cannot import a Deno module). Keep both in sync by hand.
create or replace function public.long_form_tier_primary_tool_key(p_tier text)
returns text language sql immutable as $$
  select case p_tier when 'v2' then 'image:flux2.klein9bkv' when 'v4' then 'image:seedream5pro' else 'image:kling.o3' end
$$;

-- Tier-aware override of enqueue_long_form_scene_job (V1, in
-- 20260930150000_long_form_scene_generation_v1.sql): the ONLY change is
-- that GENERATE's expected tool_key now comes from the scene's OWN render
-- plan's persisted render_tier (rp.render_tier, already fetched into `rp`
-- earlier in this function) instead of being hardcoded to Kling — a plan
-- compiled under V2/V4 must dispatch to ITS tier's renderer, never silently
-- fall back to V3. EDIT is unchanged (always Qwen, regardless of tier).
-- Every other check in this function (reference-image matching, ownership,
-- claim-expiry, job-shape validation) is copied verbatim from V1.
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
    render_model = case when tk = 'image:kling.o3' then 'klingai:kling-image@o3' when tk = 'image:flux2.klein9bkv' then 'runware:400@6' when tk = 'image:seedream5pro' then 'bytedance:seedream-5@pro' when tk = 'image:qwen.image-edit-plus' then 'runware:108@22' else tk end,
    updated_at = now() where id = s.id;
  return s.id;
end $$;
