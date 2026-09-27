-- Real bug found live on the Mars project during the 2026-09-14 "FINAL
-- VISUAL WORLD POLISH" audit (Part 1/3): world.status was stuck at
-- 'needs_attention' even though every CURRENTLY REQUIRED reference was
-- succeeded+approved. Root cause: stageFinalizing's own status computation
-- (advance-long-form-visual-world/index.ts) scoped `rows` to
-- isCanonicalReference(a) && !replaced — NOT to the current reference
-- plan's requiredViews — so 8 genuinely retired/historical rows for this
-- world (old three_quarter_neutral/profile/face_closeup component-pack
-- rows, old identity_outfit_sheet/face_sheet/profile_silhouette_sheet
-- 3-sheet-pack rows — all from taxonomies retired before the single
-- character_reference_sheet architecture) were still counted as "failed" or
-- "needs review" against a plan that no longer requires them at all.
-- Confirmed via direct query: none of those 8 angles appear anywhere in
-- this world's actual reference_plan.entities[].requiredViews.
--
-- Second problem this closes: stageFinalizing's computation only runs ONCE,
-- at the moment the world leaves the active generating pipeline. Once
-- status lands on 'needs_attention', nothing ever re-evaluates it — a later
-- Approve Anyway or a passing Regenerate resolves the actual asset but
-- never reopens/reconciles the WORLD's own terminal status, leaving it
-- stuck forever with no user refresh able to fix it (there is nothing to
-- refresh — the DB row itself never changes). This RPC is the ONE
-- authoritative "is this world's current required set complete" check,
-- callable any time from any resolution path (manual approval, a
-- regenerate/edit reconciling successfully, the recovery cron) — never
-- duplicated inline again.
create or replace function public.reconcile_visual_world_completion_status(p_visual_world_version_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.long_form_visual_world_versions;
  required_count int; ready_count int; needs_review_count int; failed_count int; active_count int;
  new_status text;
begin
  select * into v from public.long_form_visual_world_versions where id = p_visual_world_version_id for update;
  if not found then return null; end if;
  -- Guard on STAGE (has a reference plan actually been committed yet), not
  -- on the world's own status label — status is exactly the field this
  -- function exists to correct, so gating on it would make the guard
  -- circular. stageFinalizing itself calls this function while status is
  -- still 'generating' (the pre-transition value); the real thing to avoid
  -- is reconciling before any reference_plan/requiredViews exist at all
  -- (still in the 'planning' stage), which would wrongly compute
  -- required_count=0 -> 'ready' with nothing actually planned yet. The
  -- active_count check below is what protects against stomping a world
  -- with genuinely in-flight work, based on REAL asset state rather than a
  -- status label that can itself be stale — the whole point of this fix.
  if v.stage = 'planning' or v.reference_plan is null then return v.status; end if;

  with required as (
    select e->>'entityId' as entity_id, view->>'angle' as angle
    from jsonb_array_elements(coalesce(v.reference_plan->'entities', '[]'::jsonb)) e,
         jsonb_array_elements(coalesce(e->'requiredViews', '[]'::jsonb)) view
  ), all_assets as (
    select * from public.long_form_reference_assets where visual_world_version_id = p_visual_world_version_id
  ), replaced_ids as (
    select replaces_asset_id as id from all_assets where replaces_asset_id is not null
  ), matched as (
    select r.entity_id, r.angle, a.id, a.status, a.qa_status
    from required r
    left join all_assets a
      on a.entity_id = r.entity_id and a.angle_or_view = r.angle
      and a.id not in (select id from replaced_ids) and coalesce(a.stale, false) = false
  )
  select count(*),
    count(*) filter (where status = 'succeeded' and qa_status is distinct from 'rejected'),
    count(*) filter (where status = 'succeeded' and qa_status = 'rejected'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where id is null or status in ('pending', 'running'))
  into required_count, ready_count, needs_review_count, failed_count, active_count
  from matched;

  new_status := case
    when required_count = 0 then 'ready'
    when active_count > 0 then v.status
    when ready_count = required_count then 'ready'
    when ready_count <= 0 then 'failed'
    else 'needs_attention'
  end;

  if new_status is distinct from v.status then
    update public.long_form_visual_world_versions set status = new_status, updated_at = now() where id = p_visual_world_version_id;
    if new_status <> 'failed' then
      update public.long_form_projects set current_visual_world_version_id = p_visual_world_version_id, updated_at = now()
      where id = v.project_id and current_visual_plan_version_id = v.visual_plan_version_id;
    end if;
  end if;
  return new_status;
end $$;

-- Manual approval must immediately reconcile the world's own status too —
-- no separate dispatch/round trip, same transaction.
create or replace function public.approve_long_form_reference_asset_manually(p_asset_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid; replacement_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select id into replacement_id from public.long_form_reference_assets where replaces_asset_id=a.id;
  if replacement_id is not null then raise exception 'NOT_CURRENT'; end if;
  if a.status <> 'succeeded' or a.qa_status <> 'rejected' then raise exception 'NOTHING_TO_APPROVE'; end if;
  update public.long_form_reference_assets
  set qa_status = 'approved', manual_approval = true, manual_approval_user_id = p_user_id, manual_approval_at = now(), updated_at = now()
  where id = a.id;
  perform public.reconcile_visual_world_completion_status(a.visual_world_version_id);
  return a.id;
end $$;
