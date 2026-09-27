-- 2026-09-19 production incident fix — real Mars stuck world d64cce75
-- (status=planning, stage=planning, stage_attempt=1, worker_lock_until
-- expired for over a day, last_error_code set — genuinely stuck, verified
-- read-only).
--
-- Root cause #2 (independent of the generation_type null bug this same
-- pass fixes in advance-long-form-visual-world's stagePlanning): the
-- recovery cron's own row-selection query has ALWAYS excluded the
-- 'planning' stage —
--   where status in ('planning','generating') and stage in ('generating','finalizing')
-- — a world stuck failing during its OWN planning stage (the reference-
-- planner OpenAI call + asset-row creation, exactly where this incident's
-- bug lived) has NEVER had any automatic recovery coverage, before this
-- session's reconciliation feature ever existed. Compare
-- trigger_long_form_visual_plan_recovery (Visual PLAN's own recovery,
-- 20260921120000_long_form_visual_plan_recovery_and_edits.sql), which
-- correctly recovers ANY 'planning'-status row with no stage filter at all
-- — Visual World's own recovery cron never got the same coverage. Real
-- Mars evidence for the gap: stage_attempt stuck at 1 for over a day
-- despite the lock expiring in ~75 seconds and the cron running every
-- minute — the claim function (claim_long_form_visual_world_stage) was
-- NEVER once invoked for this row, because nothing ever dispatched to it.
--
-- Fix: widen the recovery cron's stage filter to include 'planning'. The
-- existing $0.05 planning-cost ceiling (MAX_REFERENCE_PLAN_COST_USD,
-- checked at the top of stagePlanning before any OpenAI call) already
-- bounds runaway spend from repeated planning retries — this migration
-- does not need its own new spend guard, it only needed to let a stuck
-- planning-stage row be REACHED by the same claim/attempt-ceiling
-- machinery every other stage already had. That existing machinery
-- (claim_long_form_visual_world_stage's own unconditional
-- `stage_attempt >= 3 -> status='failed'` transition, checked across ALL
-- stages, not just 'generating'/'finalizing') is what prevents this from
-- ever becoming a zombie again: once recovery can reach a 'planning'-stage
-- row at all, a genuinely persistent deterministic failure still resolves
-- to a terminal 'failed' status within 3 attempts, exactly like a
-- 'generating'-stage failure already does today.
create or replace function private.trigger_long_form_visual_world_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text; gateway_key text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  select decrypted_secret into gateway_key from vault.decrypted_secrets where name='long_form_gateway_anon_key' limit 1;
  if secret is null or research_url is null or gateway_key is null then return; end if;
  for target in select id from public.long_form_visual_world_versions where status in ('planning','generating') and stage in ('planning','generating','finalizing') and (worker_lock_until is null or worker_lock_until<now()) order by updated_at limit 3 loop
    perform net.http_post(url:=replace(research_url,'advance-long-form-research','advance-long-form-visual-world'),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_key,'apikey',gateway_key,'x-recovery-secret',secret),body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=10000);
  end loop;
end $$;
revoke all on function private.trigger_long_form_visual_world_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_visual_world_recovery() to service_role;

-- Part 4/5's "if manual re-kick is required, make it idempotent": before
-- this fix, start_visual_world_reconciliation's idempotent short-circuit
-- (`if found then return v`) returned a FAILED row completely unchanged —
-- a manual retry click could never actually retry anything, only ever
-- re-observe the same terminal failure forever, since nothing ever reset
-- status/stage/stage_attempt/worker_lock_until/last_error_code back to a
-- claimable state. Never creates a new version (v remains d64cce75 for
-- Mars's own real case) — same idempotency key, same row, same
-- reused_asset_count/new_asset_count/reference_plan once it succeeds.
create or replace function public.start_visual_world_reconciliation(p_project_id uuid, p_user_id uuid)
returns public.long_form_visual_world_versions language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; parent_world public.long_form_visual_world_versions;
  idem_key text; v public.long_form_visual_world_versions; next_version int;
begin
  select * into proj from public.long_form_projects where id = p_project_id and user_id = p_user_id for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if proj.current_visual_plan_version_id is null then raise exception 'NO_CURRENT_PLAN'; end if;
  if proj.current_visual_world_version_id is null then raise exception 'NO_CURRENT_VISUAL_WORLD'; end if;

  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;
  if not found or plan.status <> 'ready' then raise exception 'PLAN_NOT_READY'; end if;

  select * into parent_world from public.long_form_visual_world_versions where id = proj.current_visual_world_version_id;
  if not found or parent_world.status <> 'ready' then raise exception 'PARENT_VISUAL_WORLD_NOT_READY'; end if;

  if parent_world.visual_plan_version_id = plan.id then raise exception 'ALREADY_COMPATIBLE'; end if;

  idem_key := p_project_id::text || ':vw_reconcile:' || plan.id::text || ':' || parent_world.id::text;
  select * into v from public.long_form_visual_world_versions where reconciliation_idempotency_key = idem_key for update;
  if found then
    -- A genuinely terminal failure (e.g. every automatic recovery attempt
    -- was exhausted, or — the real Mars case — recovery could never even
    -- reach it before this same pass's other fix) gets reset for a fresh
    -- attempt on the SAME row, never a new version. A row still actively
    -- planning/generating (not yet failed) is returned completely
    -- untouched — the caller (reconcile-long-form-visual-world) re-nudges
    -- the worker either way, which is a safe no-op against a row that's
    -- genuinely already in flight (claim_long_form_visual_world_stage's own
    -- SKIP LOCKED + attempt/lock checks make a redundant dispatch harmless).
    if v.status = 'failed' then
      update public.long_form_visual_world_versions
      set status = 'planning', stage = 'planning', stage_attempt = 0, worker_lock_until = null,
          last_error_code = null, last_error_at = null, updated_at = now()
      where id = v.id
      returning * into v;
    end if;
    return v;
  end if;

  select coalesce(max(version), 0) + 1 into next_version from public.long_form_visual_world_versions where project_id = p_project_id;

  insert into public.long_form_visual_world_versions (
    project_id, visual_plan_version_id, script_version_id, version, status, stage,
    parent_visual_world_version_id, reconciliation_idempotency_key,
    renderer_tool_key, style_key, excluded_views
  ) values (
    p_project_id, plan.id, plan.script_version_id, next_version, 'planning', 'planning',
    parent_world.id, idem_key,
    parent_world.renderer_tool_key, parent_world.style_key, '[]'::jsonb
  )
  on conflict (reconciliation_idempotency_key) where reconciliation_idempotency_key is not null do nothing
  returning * into v;

  if v.id is null then
    select * into v from public.long_form_visual_world_versions where reconciliation_idempotency_key = idem_key;
  end if;
  return v;
end $$;
revoke all on function public.start_visual_world_reconciliation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_visual_world_reconciliation(uuid, uuid) to service_role;
