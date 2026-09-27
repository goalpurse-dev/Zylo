-- 2026-09-20 "Rebuild Visual World" fix. Real requirement: a "Rebuild
-- Visual World" action must create a NEW long_form_visual_world_versions
-- row (already supported: start-long-form-visual-world's regenerate:true
-- branch), never mutate/replace the existing one, and the OLD world must
-- stay current until the user explicitly reviews and adopts the new one —
-- "no destructive replacement." That last guarantee did not actually exist:
-- reconcile_visual_world_completion_status (called from stageFinalizing on
-- every successful reconciliation) auto-promoted current_visual_world_
-- version_id the instant ANY world for the same visual plan finished
-- ready, with no check for whether a perfectly good, already-adopted world
-- already existed. This mirrors the exact same real-incident fix already
-- applied to Visual Plan adoption (advance-long-form-visual-plan's
-- stageFinalizing, 2026-09-20): auto-promote only when there is NO
-- currently-adopted READY world yet; otherwise require an explicit adopt.

create or replace function public.reconcile_visual_world_completion_status(p_visual_world_version_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.long_form_visual_world_versions;
  required_count int; ready_count int; needs_review_count int; failed_count int; active_count int;
  new_status text;
begin
  select * into v from public.long_form_visual_world_versions where id = p_visual_world_version_id for update;
  if not found then return null; end if;
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
      -- Only auto-promote when the project has NO currently-adopted READY
      -- world yet (the project's own first-ever world for this plan) — a
      -- rebuild that finishes while a real, already-adopted world exists
      -- must wait for an explicit adopt_visual_world_version call instead.
      if not exists (
        select 1 from public.long_form_projects p
        join public.long_form_visual_world_versions cur on cur.id = p.current_visual_world_version_id
        where p.id = v.project_id and cur.status = 'ready'
      ) then
        update public.long_form_projects set current_visual_world_version_id = p_visual_world_version_id, updated_at = now()
        where id = v.project_id and current_visual_plan_version_id = v.visual_plan_version_id;
      end if;
    end if;
  end if;
  return new_status;
end $$;

-- adopt_visual_world_version: the explicit "Review & Adopt" user action for
-- a completed rebuild — mirrors adopt_visual_plan_version's own shape and
-- checks exactly (status must be ready, the plan it was built from must
-- still be the project's current one), called directly from the client
-- with the real user's own auth, never proxied through a service-role
-- function.
create or replace function public.adopt_visual_world_version(p_visual_world_version_id uuid)
returns public.long_form_projects language plpgsql security definer set search_path = '' as $$
declare v public.long_form_visual_world_versions; proj public.long_form_projects;
begin
  select * into v from public.long_form_visual_world_versions where id = p_visual_world_version_id for update;
  if not found then raise exception 'VISUAL_WORLD_NOT_FOUND'; end if;
  select * into proj from public.long_form_projects where id = v.project_id and user_id = auth.uid() for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if v.status is distinct from 'ready' then raise exception 'VISUAL_WORLD_NOT_READY'; end if;
  if proj.current_visual_plan_version_id is distinct from v.visual_plan_version_id then raise exception 'PLAN_HAS_CHANGED_SINCE_THIS_WORLD'; end if;

  update public.long_form_projects set current_visual_world_version_id = v.id, updated_at = now() where id = proj.id returning * into proj;
  return proj;
end $$;
revoke all on function public.adopt_visual_world_version(uuid) from public, anon;
grant execute on function public.adopt_visual_world_version(uuid) to authenticated;
