-- Safe Full-Episode Rebuild (2026-09-15 "rebuild flow" pass).
--
-- A "generation run" in this codebase already IS a
-- long_form_episode_generation_charges row (long_form_scenes.generation_run_id
-- already references it) — this does not invent a new concept, it teaches
-- the EXISTING one to survive more than once per project.
--
-- Real architectural constraint this respects: long_form_scene_render_plans'
-- own header comment already says "a new plan_version is a full replacement,
-- never an in-place mutation of a plan already used to render a scene" — the
-- versioning this rebuild needs was already designed in, just never
-- exercised (every beat has only ever had plan_version=1 in production).
--
-- `active_generation_charge_id` is the new, EXPLICIT "one authoritative
-- active generation run" pointer (Part 5) — a project row field, same
-- convention as current_visual_plan_version_id/current_visual_world_version_id.
-- The OLD charge row is never deleted or stripped of its real data (tier,
-- credits_charged, cost_breakdown, created_at all stay exactly as they were)
-- — only its `status` moves from 'charged' to 'superseded', the same kind of
-- non-destructive status transition 'refunded' already is in this schema.
alter table public.long_form_projects add column if not exists active_generation_charge_id uuid references public.long_form_episode_generation_charges(id);

alter table public.long_form_episode_generation_charges drop constraint if exists long_form_episode_generation_charges_status_check;
alter table public.long_form_episode_generation_charges add constraint long_form_episode_generation_charges_status_check
  check (status in ('charged', 'refunded', 'superseded'));
alter table public.long_form_episode_generation_charges add column if not exists superseded_at timestamptz;
alter table public.long_form_episode_generation_charges add column if not exists superseded_by_charge_id uuid references public.long_form_episode_generation_charges(id);
-- Null for an original "Generate Episode" charge; set to the charge it
-- replaced for every rebuild — lets the full Run 1 -> Run 2 -> Run 3 lineage
-- be walked in either direction without needing a separate history table.
alter table public.long_form_episode_generation_charges add column if not exists rebuild_of_charge_id uuid references public.long_form_episode_generation_charges(id);

-- Backfill: every project that already has a real 'charged' row (Mars
-- included) gets its pointer populated retroactively — the pointer becomes
-- authoritative going forward without disturbing any project that has never
-- touched this feature.
update public.long_form_projects p
set active_generation_charge_id = c.id
from public.long_form_episode_generation_charges c
where c.project_id = p.id and c.status = 'charged' and p.active_generation_charge_id is null;

-- charge_long_form_episode_generation (the ORIGINAL "Generate Episode"
-- action) now also populates the pointer on a fresh charge — otherwise a
-- BRAND NEW project's first-ever charge would leave the pointer null until
-- its first rebuild, which would break the "one authoritative active run"
-- read path from day one for new projects. Identical to the prior version
-- (20260930200000) in every other respect.
create or replace function public.charge_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  price jsonb; total int; balance int; idem_key text; new_id uuid;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;

  select * into existing from public.long_form_episode_generation_charges
    where project_id = p_project_id and status = 'charged' and visual_plan_version_id = proj.current_visual_plan_version_id;
  if found then
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'creditsCharged', existing.credits_charged, 'breakdown', existing.cost_breakdown, 'tier', existing.tier);
  end if;

  select * into stale from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged';
  if found then raise exception 'STALE_CHARGE_BLOCKS_NEW_GENERATION'; end if;

  if proj.current_visual_world_version_id is null or proj.current_visual_plan_version_id is null then raise exception 'NOT_READY'; end if;
  select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if world.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;

  price := public.estimate_long_form_episode_credits(p_project_id, p_tier);
  total := (price->>'totalCredits')::int;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;

  idem_key := p_project_id::text || ':episode_generation:' || proj.current_visual_plan_version_id::text;
  insert into public.long_form_episode_generation_charges(project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key)
  values (p_project_id, proj.current_visual_world_version_id, proj.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key)
  on conflict (idempotency_key) do nothing
  returning id into new_id;
  if new_id is null then select id into new_id from public.long_form_episode_generation_charges where idempotency_key = idem_key; end if;

  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', active_generation_charge_id = new_id, updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $$;

-- rebuild_long_form_episode_generation: the new action. Prices with the
-- EXACT SAME estimate_long_form_episode_credits function Generate Episode
-- uses (Part 3 — never a second pricing calculation), against whatever
-- VisualPlanVersion is CURRENTLY active (Part 9 — never the old run's
-- pinned version). Idempotency is keyed to `p_expected_active_charge_id`
-- (the run the CALLER believes it is superseding, captured once when the
-- rebuild modal opened) rather than a live re-lookup of "the current active
-- charge" — a live lookup would itself change identity mid-double-click
-- (the first call's own supersede would make the second call's "current"
-- read something new), which is exactly the race this design avoids. A
-- second call carrying the SAME expected-charge-id hits the idempotency_key
-- unique constraint and returns the already-created run instead of creating
-- a second one or erroring.
create or replace function public.rebuild_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_expected_active_charge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; existing public.long_form_episode_generation_charges;
  price jsonb; total int; balance int; idem_key text; new_id uuid;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;
  if p_expected_active_charge_id is null then raise exception 'MISSING_EXPECTED_ACTIVE_CHARGE'; end if;

  idem_key := p_project_id::text || ':episode_rebuild:' || p_expected_active_charge_id::text;
  -- Idempotent short-circuit FIRST, before touching balance or plan state —
  -- a double-click's second call (once unblocked by the project row lock
  -- above) lands here and returns the already-created run.
  select id into new_id from public.long_form_episode_generation_charges where idempotency_key = idem_key;
  if new_id is not null then
    select * into existing from public.long_form_episode_generation_charges where id = new_id;
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'newGenerationRunId', new_id, 'previousGenerationRunId', p_expected_active_charge_id, 'creditsCharged', existing.credits_charged, 'breakdown', existing.cost_breakdown, 'tier', existing.tier);
  end if;

  if proj.active_generation_charge_id is distinct from p_expected_active_charge_id then
    raise exception 'ACTIVE_RUN_CHANGED_SINCE_QUOTE';
  end if;
  select * into existing from public.long_form_episode_generation_charges where id = p_expected_active_charge_id and status = 'charged';
  if not found then raise exception 'NO_ACTIVE_GENERATION_TO_REBUILD'; end if;

  if proj.current_visual_world_version_id is null or proj.current_visual_plan_version_id is null then raise exception 'NOT_READY'; end if;
  select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if world.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;

  price := public.estimate_long_form_episode_credits(p_project_id, p_tier);
  total := (price->>'totalCredits')::int;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;

  update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;

  -- The PREVIOUS run is marked superseded FIRST — never deleted, and no
  -- other field on it is touched (credits_charged/cost_breakdown/tier/
  -- created_at remain the real historical record forever, Part 4/6) — this
  -- must happen BEFORE the new row is inserted: the partial unique index
  -- (one 'charged' row per project) would otherwise reject the new insert
  -- while the old row is still 'charged', since both would briefly coexist.
  update public.long_form_episode_generation_charges set status = 'superseded', superseded_at = now() where id = existing.id;

  insert into public.long_form_episode_generation_charges(project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, rebuild_of_charge_id)
  values (p_project_id, proj.current_visual_world_version_id, proj.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key, existing.id)
  returning id into new_id;

  update public.long_form_episode_generation_charges set superseded_by_charge_id = new_id where id = existing.id;
  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', active_generation_charge_id = new_id, updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'newGenerationRunId', new_id, 'previousGenerationRunId', existing.id, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $$;
revoke all on function public.rebuild_long_form_episode_generation(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.rebuild_long_form_episode_generation(uuid, uuid, text, uuid) to service_role;

-- Resume-state scene counts must only reflect the ACTIVE run (Part 5: "do
-- not mix scene cards from different runs") — a rebuild leaves the OLD
-- run's SceneRenderPlans/scenes attached to the SAME visual_plan_version_id
-- (a rebuild does not require a new storyboard), so visual_plan_version_id
-- alone can no longer disambiguate which run a scene belongs to once a
-- rebuild has happened. `is not distinct from` correctly matches NULL=NULL
-- for a project that has compiled test scenes but never charged at all
-- (generation_run_id stays null on those, exactly as before).
create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
  charge public.long_form_episode_generation_charges; total_beats int; scene_counts jsonb; has_current_plans boolean;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id = auth.uid() or auth.role() = 'service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('stage', 'none', 'route', null);
  end if;
  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;

  if proj.current_visual_world_version_id is not null then
    select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  end if;
  if world.id is null then
    select * into world from public.long_form_visual_world_versions
      where project_id = p_project_id and visual_plan_version_id = proj.current_visual_plan_version_id
      order by version desc limit 1;
  end if;

  if world.id is null then
    return jsonb_build_object('stage', 'visual_plan_ready', 'route', 'look', 'visualPlanStatus', plan.status);
  end if;

  if proj.active_generation_charge_id is not null then
    select * into charge from public.long_form_episode_generation_charges where id = proj.active_generation_charge_id;
  end if;

  select exists(
    select 1 from public.long_form_scene_render_plans
    where visual_world_version_id = world.id and visual_plan_version_id = proj.current_visual_plan_version_id
  ) into has_current_plans;

  if charge.id is null and not has_current_plans then
    return jsonb_build_object('stage', 'visual_world', 'route', 'visual-world', 'visualWorldStatus', world.status);
  end if;

  select jsonb_build_object(
    'ready', count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'approved'),
    'needsReview', count(*) filter (where sc.status = 'succeeded' and sc.qa_status = 'rejected'),
    'failed', count(*) filter (where sc.status = 'failed'),
    'generating', count(*) filter (where sc.status = 'running'),
    'queued', count(*) filter (where sc.status = 'pending'),
    'compiled', count(*)
  )
  into scene_counts
  from public.long_form_scenes sc
  join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
  where srp.visual_world_version_id = world.id
    and srp.visual_plan_version_id = proj.current_visual_plan_version_id
    and sc.generation_run_id is not distinct from proj.active_generation_charge_id
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'), (plan.storyboard_summary->>'totalVisualBeats')::int, 0);

  return jsonb_build_object(
    'stage', 'generate', 'route', 'generate',
    'visualWorldStatus', world.status,
    'chargeExists', charge.id is not null,
    'creditsCharged', charge.credits_charged,
    'totalBeats', total_beats,
    'ready', coalesce((scene_counts->>'ready')::int, 0),
    'needsReview', coalesce((scene_counts->>'needsReview')::int, 0),
    'failed', coalesce((scene_counts->>'failed')::int, 0),
    'generating', coalesce((scene_counts->>'generating')::int, 0),
    'queued', coalesce((scene_counts->>'queued')::int, 0),
    'planned', greatest(0, total_beats - coalesce((scene_counts->>'compiled')::int, 0))
  );
end $$;
revoke all on function public.long_form_project_resume_state(uuid) from public, anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated, service_role;
