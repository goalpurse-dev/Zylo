-- 2026-09-19 billing-incident hotfix — real Mars repro.
--
-- Symptom: after replanning (adopting VisualPlanVersion v5), clicking
-- "Generate Episode" always returned "Could not start episode generation"
-- with zero way to recover. The user also reported their balance dropping
-- by 242 credits.
--
-- Live forensic finding: NO new charge row exists for v5 and
-- profiles.credit_balance for the project owner is BYTE-IDENTICAL to the
-- last verified checkpoint (89089) — no debit ever happened. The "-242"
-- the user saw was a SEPARATE frontend bug (GenerateWorkspace.jsx's
-- handleGenerate called emitCreditSpend() optimistically BEFORE awaiting
-- the server result, with no rollback on failure — fixed alongside this
-- migration, no SQL change needed for that half).
--
-- Real server root cause: charge_long_form_episode_generation's own stale-
-- charge guard --
--   select * into stale from ... where project_id = p_project_id and status = 'charged';
--   if found then raise exception 'STALE_CHARGE_BLOCKS_NEW_GENERATION'; end if;
-- -- fires for ANY 'charged' row for the project, not just one for the
-- CURRENT plan. adopt_visual_plan_version deliberately never touches
-- active_generation_charge_id on replan (billing history must survive a
-- replan, see that function's own comment) -- so Mars's OLD v4 charge
-- (7b045213, still status='charged') permanently blocks EVERY future
-- "Generate Episode" click for the NEW v5 plan, forever, with no path
-- forward: rebuild_long_form_episode_generation exists and CAN supersede a
-- stale charge, but the Generate page only exposes that action once
-- episodeCharge is non-null for the CURRENT plan -- which it never is here,
-- since fetchEpisodeCharge() correctly nulls out a charge whose own
-- visual_plan_version_id doesn't match the current plan. The user has no
-- button that reaches rebuild_long_form_episode_generation in this state.
--
-- Fix: charge_long_form_episode_generation now auto-supersedes a stale
-- charge for a DIFFERENT (already-superseded) plan version -- the exact
-- same supersede-then-insert sequence rebuild_long_form_episode_generation
-- already uses, inlined here so "Generate Episode" itself is the one
-- button that always works, atomically, in the same transaction as the
-- debit. A stale charge for the SAME plan is still handled by the existing
-- early-return above this (returns alreadyCharged:true, unchanged) -- this
-- only ever fires once we already know no charge exists for the current
-- plan, so superseding is unambiguously correct, never a guess.
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

  -- A 'charged' row exists but NOT for the current plan (guaranteed by the
  -- check above) -- this is a genuinely superseded run left over from
  -- before a replan, never a concurrent generation for the SAME plan. Mark
  -- it superseded (never deleted; its own tier/credits_charged/
  -- cost_breakdown/created_at stay the real historical record forever,
  -- same convention rebuild_long_form_episode_generation already uses)
  -- before inserting the new charge, since the partial unique index (one
  -- 'charged' row per project) would otherwise reject the new insert while
  -- the old row is still 'charged'.
  select * into stale from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged';

  if proj.current_visual_world_version_id is null or proj.current_visual_plan_version_id is null then raise exception 'NOT_READY'; end if;
  select * into world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if world.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;

  price := public.estimate_long_form_episode_credits(p_project_id, p_tier);
  total := (price->>'totalCredits')::int;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;

  -- Checked via stale.id, never plpgsql's own `found` -- two more SELECTs
  -- (world, balance) ran since the stale-charge lookup above and would have
  -- silently overwritten `found` with their own result instead.
  if stale.id is not null then
    update public.long_form_episode_generation_charges set status = 'superseded', superseded_at = now() where id = stale.id;
  end if;

  update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;

  idem_key := p_project_id::text || ':episode_generation:' || proj.current_visual_plan_version_id::text;
  insert into public.long_form_episode_generation_charges(project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, rebuild_of_charge_id)
  values (p_project_id, proj.current_visual_world_version_id, proj.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key, stale.id)
  on conflict (idempotency_key) do nothing
  returning id into new_id;
  if new_id is null then select id into new_id from public.long_form_episode_generation_charges where idempotency_key = idem_key; end if;

  if stale.id is not null then
    update public.long_form_episode_generation_charges set superseded_by_charge_id = new_id where id = stale.id and superseded_by_charge_id is null;
  end if;

  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', active_generation_charge_id = new_id, updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $$;
