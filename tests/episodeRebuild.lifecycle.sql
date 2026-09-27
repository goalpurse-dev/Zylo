-- Safe Full-Episode Rebuild (2026-09-15 pass) — run against REAL Mars data,
-- always rolled back. Covers Part 14's server-side guarantees: E (one click
-- = one new run), F (double click cannot double-charge or create two runs),
-- G (old run untouched), K (newest plan version pinned to the new run), L
-- (old run retains its original version pointers), M (insufficient credits
-- -> clean error, no partial state), O (active pointer switches only after
-- a fully successful setup). H (new scenes carry the new generation_run_id)
-- and J (Visual World references reused, not regenerated) are verified by
-- direct code inspection instead — this lifecycle script never calls
-- start-long-form-scene-generation (that would dispatch real provider work,
-- forbidden by Part 15), only the pricing/charge/supersede RPC itself.
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  mars_project uuid := '49a18b78-1d4b-4570-8113-5cd130687e1e';
  mars_owner uuid := 'a8ad2f35-6ad4-4071-bdae-4555afd13f51';
  original_charge uuid; original_tier text; original_credits int; original_created_at timestamptz;
  original_visual_plan_version_id uuid;
  result1 jsonb; result2 jsonb; run1 uuid; run2 uuid;
  charge_count int; active_count int; superseded_count int;
  balance_before int; balance_after int;
  pointer_before uuid; pointer_after uuid;
begin
  select active_generation_charge_id into pointer_before from public.long_form_projects where id = mars_project;
  select id, tier, credits_charged, created_at, visual_plan_version_id into original_charge, original_tier, original_credits, original_created_at, original_visual_plan_version_id
    from public.long_form_episode_generation_charges where id = pointer_before;
  if original_charge is null then raise exception 'BASELINE_MARS_HAS_NO_ACTIVE_CHARGE — this test assumes Mars already has one'; end if;

  select credit_balance into balance_before from public.profiles where id = mars_owner;

  -- E: one call creates exactly one new run.
  result1 := public.rebuild_long_form_episode_generation(mars_project, mars_owner, 'v3', original_charge);
  run1 := (result1->>'newGenerationRunId')::uuid;
  if run1 is null or run1 = original_charge then raise exception 'E_FAILED: rebuild did not create a genuinely new run id'; end if;
  if (result1->>'alreadyCharged')::boolean is distinct from false then raise exception 'E_FAILED: first call must not report alreadyCharged'; end if;

  -- F: an identical second call (double-click) must return the SAME run,
  -- never a second charge.
  result2 := public.rebuild_long_form_episode_generation(mars_project, mars_owner, 'v3', original_charge);
  run2 := (result2->>'newGenerationRunId')::uuid;
  if run2 is distinct from run1 then raise exception 'F_FAILED: double-click created a DIFFERENT run (%, %) instead of returning the same one', run1, run2; end if;
  if (result2->>'alreadyCharged')::boolean is distinct from true then raise exception 'F_FAILED: double-click must report alreadyCharged=true'; end if;

  select count(*) into charge_count from public.long_form_episode_generation_charges where project_id = mars_project;
  if charge_count <> 2 then raise exception 'F_FAILED: expected exactly 2 charge rows (original + one new), found %', charge_count; end if;

  select count(*) into active_count from public.long_form_episode_generation_charges where project_id = mars_project and status = 'charged';
  if active_count <> 1 then raise exception 'exactly one charged row must exist at a time, found %', active_count; end if;

  select credit_balance into balance_after from public.profiles where id = mars_owner;
  if balance_before - balance_after <> original_credits then
    raise exception 'F_FAILED: balance should be debited exactly ONCE for % credits (v3 == same price as the original charge since nothing about the plan changed), actual debit = %', original_credits, (balance_before - balance_after);
  end if;

  -- G/L: the OLD run's own real historical fields are completely untouched
  -- — only status/superseded_at/superseded_by_charge_id may have changed.
  -- Compares against original_tier/original_credits/original_created_at/
  -- original_visual_plan_version_id, captured BEFORE either rebuild call
  -- ran and never reassigned since.
  if not exists (
    select 1 from public.long_form_episode_generation_charges
    where id = original_charge and tier = original_tier and credits_charged = original_credits
      and created_at = original_created_at and visual_plan_version_id = original_visual_plan_version_id
  ) then raise exception 'G_FAILED: old run''s own historical fields (tier/credits_charged/created_at/visual_plan_version_id) were mutated'; end if;
  if not exists (
    select 1 from public.long_form_episode_generation_charges
    where id = original_charge and status = 'superseded' and superseded_by_charge_id = run1 and superseded_at is not null
  ) then raise exception 'G_FAILED: old run was not correctly marked superseded'; end if;
  if not exists (select 1 from public.long_form_episode_generation_charges where id = original_charge and credits_charged = original_credits) then
    raise exception 'G_FAILED: old run''s credits_charged changed — this must never happen';
  end if;

  -- K/L: the new run pins the project's CURRENT visual_plan_version_id
  -- (same value here, since this test never changes the storyboard — the
  -- real guarantee under test is that it's read fresh from the project row,
  -- not copied from the old charge).
  if not exists (
    select 1 from public.long_form_episode_generation_charges c
    join public.long_form_projects p on p.id = c.project_id
    where c.id = run1 and c.visual_plan_version_id = p.current_visual_plan_version_id and c.rebuild_of_charge_id = original_charge
  ) then raise exception 'K_FAILED: new run is not pinned to the project''s current visual_plan_version_id, or rebuild_of_charge_id is wrong'; end if;

  -- O: the active pointer now points at the NEW run.
  select active_generation_charge_id into pointer_after from public.long_form_projects where id = mars_project;
  if pointer_after is distinct from run1 then raise exception 'O_FAILED: active pointer did not switch to the new run'; end if;

  -- M: insufficient credits must fail cleanly with NO new run and NO
  -- pointer change (simulate by requesting an impossible balance check via
  -- a temporary balance override, then restore it).
  update public.profiles set credit_balance = 0 where id = mars_owner;
  begin
    perform public.rebuild_long_form_episode_generation(mars_project, mars_owner, 'v4', run1);
    raise exception 'M_FAILED: rebuild with zero balance should have raised INSUFFICIENT_CREDITS';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_CREDITS' then raise; end if;
  end;
  if (select active_generation_charge_id from public.long_form_projects where id = mars_project) is distinct from run1 then
    raise exception 'M_FAILED: a failed (insufficient-credits) rebuild attempt must not move the active pointer';
  end if;
  if (select count(*) from public.long_form_episode_generation_charges where project_id = mars_project) <> 2 then
    raise exception 'M_FAILED: a failed rebuild attempt must not create a new charge row';
  end if;

  raise notice 'ALL EPISODE REBUILD LIFECYCLE ASSERTIONS PASSED';
end $$;
rollback;
