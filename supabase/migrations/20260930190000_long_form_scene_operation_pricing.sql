-- Long Form scene-operation pricing + billing (2026-09-14).
--
-- PRICING AUDIT FINDING: the prior V3 estimate (43 credits) used a flat,
-- wrong EDIT credit value (2) that didn't reflect the "retail = 2x actual
-- internal provider cost" rule against the REAL measured Qwen cost ($0.009,
-- not the earlier doc-derived $0.0166 estimate). Corrected: retailUSD =
-- 0.009*2 = $0.018, credits = roundCredits(0.018 / 0.02) = 1 (src/lib/
-- pricing.ts's CREDIT_RETAIL_USD=$0.02/credit and roundCredits=ceil-with-
-- floor-1 are the SAME authoritative conversion every other Zyvo tool
-- uses — T2I/T2V/ad/product-photo credit constants are all derived the
-- identical way; nothing new is invented here). Kling (V3 GENERATE, $0.028)
-- and Seedream (V4 GENERATE, $0.035) already round to the SAME 3/4 credits
-- under a strict 2x rule as their existing registry retailUSD, so those
-- were NOT wrong — only EDIT was. V2 (FLUX.2 Klein 9B KV) is deliberately
-- NOT recomputed from 2x — its real cost ($0.00169) is so small that a
-- strict 2x would round to 1 credit, undervaluing it; per explicit
-- instruction this tier keeps the existing verified registry price
-- (retailUSD=$0.03, credits=2) as-is.
--
-- Corrected real Mars V3 total: 11 GENERATE x 3 + 5 EDIT x 1 = 38 credits
-- (was 43). See the final report for the full V2/V3/V4 recomputation.

create or replace function public.long_form_tier_edit_credits(p_tier text)
returns int language sql immutable as $$
  -- EDIT is ALWAYS Qwen Image Edit Plus regardless of tier (Part 3/7) — the
  -- p_tier parameter is kept only for call-site symmetry with
  -- long_form_tier_generate_credits, never actually branches on it.
  select 1
$$;

-- Per-scene-attempt charge bookkeeping — durable enough to (a) know exactly
-- how much a specific scene ROW cost the user so a pre-provider failure can
-- refund exactly that amount, and (b) provide the same kind of audit trail
-- generation_credit_ledger already gives every other paid Zyvo generation.
alter table public.long_form_scenes add column if not exists credits_charged int not null default 0;
alter table public.long_form_scenes add column if not exists credits_refunded_at timestamptz;

create table if not exists public.long_form_scene_operation_charges (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.long_form_scenes(id) on delete cascade,
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  user_id uuid not null,
  operation text not null check (operation in ('regenerate', 'edit')),
  tier text,
  credits int not null check (credits >= 0),
  status text not null default 'charged' check (status in ('charged', 'refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
alter table public.long_form_scene_operation_charges enable row level security;
revoke all on public.long_form_scene_operation_charges from anon;
revoke insert, update, delete, truncate, references, trigger on public.long_form_scene_operation_charges from anon, authenticated;
create policy "Users can view their own project's scene operation charges" on public.long_form_scene_operation_charges
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_scene_operation_charges.project_id and p.user_id = auth.uid()));

-- Pure, side-effect-free, callable anytime (read-only) — the SAME source
-- both the scene modal's displayed Regenerate/Edit cost AND the real charge
-- below consume, so they can never drift apart.
--
-- "regenerate" (Retry) is priced by the SCENE'S OWN existing render_strategy
-- (inherited from its render plan), exactly mirroring retry_long_form_
-- scene's actual dispatch behavior (a failed attempt is retried as whatever
-- it already was — GENERATE stays GENERATE at the tier's primary renderer,
-- EDIT stays EDIT at the flat Qwen price). It is NOT always the tier's
-- GENERATE price: a scene whose render plan calls for EDIT must show/charge
-- the Qwen cost on retry, never the (usually higher) primary-renderer cost.
-- "edit" (the user-initiated Edit Scene action, always creating a NEW EDIT
-- row regardless of the source scene's own strategy) is always the flat
-- Qwen cost, regardless of tier.
create or replace function public.estimate_scene_operation_credits(p_scene_id uuid, p_operation text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare sc public.long_form_scenes; rp public.long_form_scene_render_plans; v public.long_form_visual_world_versions;
begin
  if p_operation not in ('regenerate', 'edit') then raise exception 'INVALID_OPERATION'; end if;
  select * into sc from public.long_form_scenes where id = p_scene_id;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  -- security definer bypasses RLS — explicitly re-check ownership (same
  -- pattern as estimate_long_form_episode_credits).
  if not exists (select 1 from public.long_form_projects p where p.id = v.project_id and (p.user_id = auth.uid() or auth.role() = 'service_role')) then
    raise exception 'SCENE_NOT_FOUND';
  end if;
  if p_operation = 'edit' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'edit', 'model', 'image:qwen.image-edit-plus');
  end if;
  if sc.render_strategy = 'EDIT' then
    return jsonb_build_object('credits', public.long_form_tier_edit_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', 'image:qwen.image-edit-plus');
  end if;
  return jsonb_build_object('credits', public.long_form_tier_generate_credits(rp.render_tier), 'tier', rp.render_tier, 'operation', 'regenerate', 'model', public.long_form_tier_primary_tool_key(rp.render_tier));
end $$;
revoke all on function public.estimate_scene_operation_credits(uuid, text) from public, anon;
grant execute on function public.estimate_scene_operation_credits(uuid, text) to authenticated, service_role;

-- Idempotent refund for a scene attempt that never produced a usable
-- image: a pre-dispatch policy/validation failure (job never created) OR a
-- genuine provider rejection/failure (job created but never succeeded) —
-- both leave status='failed' with no real result. A genuine provider
-- SUCCESS that later fails QA (status='succeeded', qa_status='rejected')
-- is deliberately NEVER refunded here — real compute was consumed and a
-- real image exists, exactly the distinction Part 10 asks for. Mirrors
-- fail_and_refund_generation_job's exact profile-credit-adjustment shape.
create or replace function public.refund_scene_operation_charge_if_failed(p_scene_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare sc public.long_form_scenes; v public.long_form_visual_world_versions; owner_id uuid;
begin
  select * into sc from public.long_form_scenes where id = p_scene_id for update;
  if not found then return false; end if;
  if sc.status <> 'failed' or sc.credits_charged <= 0 or sc.credits_refunded_at is not null then return false; end if;
  select * into v from public.long_form_visual_world_versions where id = sc.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  update public.profiles set credit_balance = credit_balance + sc.credits_charged, credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - sc.credits_charged) where id = owner_id;
  update public.long_form_scenes set credits_refunded_at = now() where id = p_scene_id;
  update public.long_form_scene_operation_charges set status = 'refunded', refunded_at = now() where scene_id = p_scene_id and status = 'charged';
  return true;
end $$;
revoke all on function public.refund_scene_operation_charge_if_failed(uuid) from public, anon, authenticated;
grant execute on function public.refund_scene_operation_charge_if_failed(uuid) to service_role;

-- retry_long_form_scene (V1, in 20260930150000) is re-declared here with
-- ONE addition: the fresh-replacement-row branch now charges credits
-- FIRST, atomically, before creating that row. Idempotency is structural,
-- not a separate key: the existing "if a replacement already exists,
-- return it unchanged" check (unchanged, still the very first thing this
-- function does after locking) means a double-click can NEVER reach the
-- charge logic twice — the second call finds replacement_id already set
-- and returns immediately. The "resume the SAME row" branch (job_id was
-- still null — a pre-dispatch failure) never re-charges at all, since
-- nothing new is being created; that attempt was already paid for.
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
    -- Pre-dispatch failure: no job was ever created, nothing was ever
    -- charged for THIS attempt (this row was never a paid replacement in
    -- the first place, or already had its charge refunded by
    -- refund_scene_operation_charge_if_failed). Resuming the same row is
    -- free — there is no new paid attempt being created here.
    update public.long_form_scenes set status='pending', claim_attempts=0, lease_until=null, last_error_code=null, last_error_at=null, updated_at=now() where id = sc.id;
    replacement_id := sc.id;
  else
    select * into rp from public.long_form_scene_render_plans where id = sc.scene_render_plan_id;
    -- Price by the scene's OWN render_strategy, not assumed-GENERATE: a
    -- render-plan-driven EDIT scene retries as EDIT (Qwen price), a
    -- GENERATE scene retries at its tier's primary-renderer price.
    if sc.render_strategy = 'EDIT' then
      price := public.long_form_tier_edit_credits(rp.render_tier);
    else
      price := public.long_form_tier_generate_credits(rp.render_tier);
    end if;
    select credit_balance into balance from public.profiles where id = p_user_id for update;
    if balance is null or balance < price then raise exception 'INSUFFICIENT_CREDITS'; end if;
    update public.profiles set credit_balance = credit_balance - price, credits_spent_today = coalesce(credits_spent_today,0) + price where id = p_user_id;
    insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,credits_charged)
    values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, sc.render_strategy, sc.id, price) returning id into replacement_id;
    insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
    values(replacement_id, v.project_id, p_user_id, 'regenerate', rp.render_tier, price);
  end if;
  return replacement_id;
end $$;

-- edit_long_form_scene (V1, in 20260930150000) — same charge-before-create
-- addition, same structural idempotency via the existing replacement check.
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
  insert into public.long_form_scenes(scene_render_plan_id,visual_world_version_id,visual_beat_id,render_strategy,replaces_scene_id,edit_instruction,input_reference_asset_ids,credits_charged)
  values(sc.scene_render_plan_id, sc.visual_world_version_id, sc.visual_beat_id, 'EDIT', sc.id, trimmed, array[]::uuid[], price) returning id into replacement_id;
  insert into public.long_form_scene_operation_charges(scene_id,project_id,user_id,operation,tier,credits)
  values(replacement_id, v.project_id, p_user_id, 'edit', rp.render_tier, price);
  return replacement_id;
end $$;
