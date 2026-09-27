-- 2026-09-19 "Visual World incremental reconciliation" pass.
--
-- Closes the gap named explicitly in the prior forensic report: "generate
-- only the missing 8, reuse the other 6 execution engine is designed but
-- not built." Real Mars case this targets: plan v5 replanned, Visual World
-- compatibility resolver correctly reports 6 of 14 required references
-- reusable (matched by preserved entity id or exact name — see
-- visualWorldCompatibility.js's own fix) and 8 genuinely missing. Today the
-- only way to fix this is a FULL Visual World rebuild — regenerating all 14
-- (or however many the OLD world had) references, wasting real provider
-- cost on 6 that are already correct.
--
-- Schema additions only — no existing row is touched, no existing column's
-- meaning changes, the previous Visual World version remains completely
-- intact and independently readable/recoverable exactly as it was before
-- this migration.

alter table public.long_form_visual_world_versions
  add column if not exists parent_visual_world_version_id uuid references public.long_form_visual_world_versions(id),
  add column if not exists reused_asset_count int,
  add column if not exists new_asset_count int,
  add column if not exists reconciliation_idempotency_key text;

-- Idempotency (item 5): a double-click / refresh / retry must never create
-- two reconciliation world versions for the same (project, current plan,
-- parent world) triple. Partial unique index (not all worlds are
-- reconciliations — a project's first-ever world, and every plain
-- "Rebuild"/regenerate world, both leave this null).
create unique index if not exists long_form_visual_world_versions_reconciliation_idem_key
  on public.long_form_visual_world_versions (reconciliation_idempotency_key)
  where reconciliation_idempotency_key is not null;

-- Provenance for a COPIED (not regenerated) reference asset (item 2) —
-- mirrors the existing source_master_asset_id/source_crop_key/
-- source_crop_rect pattern already used for crop-derived assets, kept as
-- its own dedicated set of columns since "reused from a PRIOR WORLD
-- VERSION's own succeeded asset" is a materially different kind of
-- provenance than "cropped from this same world's master sheet."
alter table public.long_form_reference_assets
  add column if not exists source_visual_world_version_id uuid references public.long_form_visual_world_versions(id),
  add column if not exists source_reference_asset_id uuid references public.long_form_reference_assets(id),
  add column if not exists reuse_reason text;

-- start_visual_world_reconciliation: the ONE entry point for "Update Visual
-- World" (item 1/5) — creates a new, durable VisualWorldVersion scoped to
-- the project's CURRENT VisualPlanVersion, parented to the project's
-- CURRENT VisualWorldVersion. Idempotent: a second call with the SAME
-- (project, current plan, current world) triple returns the SAME row it
-- already created, never a duplicate, via the unique index above.
--
-- Auth pattern: mirrors start_visual_plan_version exactly (an explicit
-- p_user_id param, granted to service_role only) rather than
-- adopt_visual_plan_version's auth.uid()-based/authenticated-grantable
-- pattern — because unlike a plain plan adoption, this action must ALSO
-- dispatch the async worker (advance-long-form-visual-world, which needs
-- service-role credentials and the shared x-cron-secret), so it can only
-- ever be called from a service-role edge function
-- (reconcile-long-form-visual-world) that has already validated the
-- caller via requireUser, never directly from the browser.
--
-- Deliberately does NOT touch current_visual_world_version_id — the old
-- world remains the project's current/fallback world until the new one
-- actually satisfies the required-reference readiness gate (item 10),
-- which is what reconcile_visual_world_completion_status already does
-- unconditionally the moment ANY world's status resolves to something
-- other than 'failed' (see its own migration) — no new promotion logic is
-- needed here, that existing mechanism already scopes strictly to
-- `current_visual_plan_version_id = v.visual_plan_version_id`, so it can
-- never promote a reconciliation world built for a plan that has since
-- moved on again.
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

  -- Already compatible? Nothing to reconcile — the caller's own compatibility
  -- resolver should already have prevented this click, but this stays a
  -- genuine no-op rather than creating a needless world version if it
  -- happens anyway (e.g. a stale UI, a double-tab race).
  if parent_world.visual_plan_version_id = plan.id then raise exception 'ALREADY_COMPATIBLE'; end if;

  idem_key := p_project_id::text || ':vw_reconcile:' || plan.id::text || ':' || parent_world.id::text;
  select * into v from public.long_form_visual_world_versions where reconciliation_idempotency_key = idem_key;
  if found then return v; end if;

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
