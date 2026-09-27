-- Scope charge_long_form_episode_generation's idempotency lookup to the
-- ACTIVE visual_plan_version_id, not just project_id (density/pricing
-- migration task, 2026-09-14, Part 7).
--
-- Real gap this closes: the previous idempotency check was
-- `where project_id = p_project_id and status = 'charged'` — if a project's
-- active plan version ever changes AFTER a real charge exists (e.g. Mars's
-- VisualPlan is migrated to a much higher-density N+1 version), a later
-- Generate Episode click would find that OLD charge and silently treat the
-- (much larger, differently-priced) NEW plan as "already charged" — never
-- pricing or debiting the real new scope. Scoping the lookup to also match
-- the CURRENT visual_plan_version_id means a charge tied to a superseded
-- plan is simply not found here, so estimate/charge proceeds fresh against
-- whatever plan is actually active now — exactly Part 7's "if the active
-- plan changed before generation was ever charged, estimate against the new
-- plan normally."
--
-- What this does NOT attempt: if a project is ALREADY charged for its
-- CURRENT plan (a real in-flight or completed generation) and something
-- later swaps the active plan version out from under it, the partial unique
-- index (one active charge per project) would then block a fresh charge for
-- the new plan with a real constraint violation rather than silently
-- misbehaving — surfaced here as a clear, distinct exception instead of an
-- opaque unique-violation error. Resolving that case for real (refunding or
-- superseding an old in-flight charge when the plan is swapped) is a
-- deliberate future feature, not something this migration task needs: no
-- Long Form project in production has ever had an active charge coexist
-- with a plan-version swap (confirmed for Mars — zero charge rows exist).
create or replace function public.charge_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  price jsonb; total int; balance int; idem_key text;
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

  -- An active charge exists but for a DIFFERENT (superseded) plan version —
  -- the partial unique index would otherwise turn this into an opaque
  -- constraint-violation error; raise a clear, named exception instead.
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
  on conflict (idempotency_key) do nothing;

  update public.long_form_projects set scene_generation_tier = p_tier, current_scene_generation_status = 'charged', updated_at = now() where id = p_project_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', price->'breakdown', 'tier', p_tier);
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid, uuid, text) to service_role;
