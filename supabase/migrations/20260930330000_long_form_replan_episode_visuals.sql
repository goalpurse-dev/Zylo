-- "Replan Episode Visuals" (2026-09-19 "fix the missing production
-- workflow" pass, items 2/3/8).
--
-- Real gap this closes: start_visual_plan_version(p_regenerate=true) already
-- did the RIGHT half of "Replan" (creates a brand-new
-- long_form_visual_plan_versions row, never mutates the old one, never
-- touches Visual World or credits, never calls an image provider) — but the
-- moment that new version finished planning, advance-long-form-visual-plan's
-- own finalize step unconditionally flipped
-- long_form_projects.current_visual_plan_version_id to it with ZERO user
-- review. That is exactly the "NO active-plan pointer mutation" the task
-- forbids for an unreviewed replan, and it silently defeated "show the new
-- storyboard, let me inspect it... do not charge anything until I explicitly
-- click Generate/Rebuild" (item 3) — Generate/Visual World would start
-- reading the new plan's entity registry against an OLD, potentially
-- incompatible Visual World with no warning at all.
--
-- The fix distinguishes "the very first plan for this script" (still
-- auto-promoted the instant it's ready — unchanged, zero risk, matches every
-- existing project's behavior to date) from "an explicit replan of an
-- established script" (now held for review; the OLD plan stays the
-- project's active one until the user explicitly adopts the new one).
-- parent_visual_plan_version_id (added 2026-09-21, never previously
-- populated by this function) is the one durable signal that distinguishes
-- them.

create or replace function public.start_visual_plan_version(p_project_id uuid,p_user_id uuid,p_regenerate boolean default false)
returns public.long_form_visual_plan_versions language plpgsql security definer set search_path='' as $$
declare p public.long_form_projects; v public.long_form_visual_plan_versions; n int; parent_id uuid;
begin
  select * into p from public.long_form_projects where id=p_project_id and user_id=p_user_id for update;
  if not found then raise exception 'Project not found'; end if;
  if not exists(select 1 from public.long_form_script_versions where id=p.current_script_version_id and status='ready') then raise exception 'SCRIPT_NOT_READY'; end if;
  select * into v from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id order by (status='planning') desc,version desc limit 1;
  if found and (v.status='planning' or not p_regenerate) then return v; end if;
  -- A found, non-planning `v` here means p_regenerate=true against an
  -- already-completed plan — a genuine explicit replan, so the new row
  -- durably records what it replanned FROM. No `v` found at all means this
  -- is the project's very first plan for this script (parent stays null,
  -- preserving the original always-auto-promoted behavior below).
  parent_id := case when found then v.id else null end;
  select coalesce(max(version),0)+1 into n from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id;
  if (select count(*) from public.long_form_visual_plan_versions where project_id=p.id and script_version_id=p.current_script_version_id and parent_visual_plan_version_id is null)>=6 then raise exception 'TOO_MANY_VERSIONS'; end if;
  insert into public.long_form_visual_plan_versions(project_id,script_version_id,version,parent_visual_plan_version_id) values(p.id,p.current_script_version_id,n,parent_id) returning * into v;
  return v;
end $$;

-- adopt_visual_plan_version: the ONLY thing that ever promotes an explicit
-- replan (parent_visual_plan_version_id is not null) to
-- current_visual_plan_version_id — a real user action ("Use This Plan"),
-- never automatic. A plan with no parent (the project's original,
-- first-ever plan) is still auto-promoted the instant it's ready, by
-- advance-long-form-visual-plan directly, exactly as before — this function
-- is not involved in that path at all and does not need to be, since
-- nothing has ever needed reviewing there. Ownership is checked via
-- auth.uid() (mirrors save_storyboard_edits' own pattern exactly) since this
-- is called directly from the client, not proxied through a service-role
-- edge function.
create or replace function public.adopt_visual_plan_version(p_visual_plan_version_id uuid)
returns public.long_form_projects language plpgsql security definer set search_path = '' as $$
declare v public.long_form_visual_plan_versions; proj public.long_form_projects;
begin
  select * into v from public.long_form_visual_plan_versions where id = p_visual_plan_version_id for update;
  if not found then raise exception 'VISUAL_PLAN_NOT_FOUND'; end if;
  select * into proj from public.long_form_projects where id = v.project_id and user_id = auth.uid() for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if v.status is distinct from 'ready' then raise exception 'VISUAL_PLAN_NOT_READY'; end if;
  if proj.current_script_version_id is distinct from v.script_version_id then raise exception 'SCRIPT_HAS_CHANGED_SINCE_THIS_PLAN'; end if;

  update public.long_form_projects set current_visual_plan_version_id = v.id, updated_at = now() where id = proj.id returning * into proj;
  return proj;
end $$;
revoke all on function public.adopt_visual_plan_version(uuid) from public, anon;
grant execute on function public.adopt_visual_plan_version(uuid) to authenticated;
