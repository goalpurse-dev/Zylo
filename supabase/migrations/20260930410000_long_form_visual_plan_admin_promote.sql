-- 2026-09-20 real incident: "If the Sun Vanished Right Now" (project
-- cf3ebf6e-4439-4b43-8af8-5700d2850f09) — VisualPlan v2 finished validation
-- cleanly (7 chapters, 214 beats, correct global ordering/duration) but the
-- project's current_visual_plan_version_id stayed NULL, because v2's parent
-- (v1) had FAILED, not succeeded, and the auto-promotion rule at the time
-- treated "has a parent" as "an explicit replan of usable work the user must
-- review" regardless of whether that parent ever actually became usable.
-- advance-long-form-visual-plan's own stageFinalizing has been fixed in
-- code to use the right rule going forward (promote whenever there is no
-- currently ADOPTED, READY plan) — this is the matching one-time recovery
-- primitive for a plan that already finished under the OLD rule and is
-- sitting ready but un-adopted, so it can be promoted through a real,
-- auditable, narrowly-scoped mechanism instead of an ad-hoc column write.
-- Mirrors adopt_visual_plan_version's own checks (status must be 'ready',
-- script version must match the project's current one) but omits its
-- interactive auth.uid() ownership gate, since this is meant for
-- service-role recovery calls, not a client-facing action — never exposed
-- to `authenticated` or `anon`.
create or replace function public.admin_promote_visual_plan_version(p_visual_plan_version_id uuid)
returns public.long_form_projects
language plpgsql
security definer
set search_path = ''
as $$
declare v public.long_form_visual_plan_versions; proj public.long_form_projects; current_plan public.long_form_visual_plan_versions;
begin
  select * into v from public.long_form_visual_plan_versions where id = p_visual_plan_version_id for update;
  if not found then raise exception 'VISUAL_PLAN_NOT_FOUND'; end if;
  if v.status is distinct from 'ready' then raise exception 'VISUAL_PLAN_NOT_READY'; end if;

  select * into proj from public.long_form_projects where id = v.project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.current_script_version_id is distinct from v.script_version_id then raise exception 'SCRIPT_HAS_CHANGED_SINCE_THIS_PLAN'; end if;

  if proj.current_visual_plan_version_id is not null then
    select * into current_plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;
    if found and current_plan.status = 'ready' then
      raise exception 'PROJECT_ALREADY_HAS_AN_ADOPTED_PLAN';
    end if;
  end if;

  update public.long_form_projects set current_visual_plan_version_id = v.id, updated_at = now() where id = proj.id returning * into proj;
  return proj;
end $$;
revoke all on function public.admin_promote_visual_plan_version(uuid) from public, anon, authenticated;
grant execute on function public.admin_promote_visual_plan_version(uuid) to service_role;
