-- 2026-09-21 EMERGENCY (Atlantis storyboard reliability): a real production
-- incident found that a FAILED long_form_visual_plan_versions row has NO
-- backend path back to life — claim_long_form_visual_plan_stage_by_id only
-- ever claims status='planning' rows, and the ONLY user-facing action wired
-- to a failed plan's "Try Again" button was start_visual_plan_version with
-- p_regenerate=true, which always creates a BRAND NEW version and reruns
-- every chapter's paid model call from scratch — discarding a fully
-- persisted entity_registry/continuity_groups/visual_plan and burning real
-- provider cost on chapters that had already succeeded. This adds the
-- missing resume path: reopen the SAME row so the normal claim/dispatch
-- machinery can pick it back up exactly where it left off, with everything
-- already persisted (chapters planned, cast established) untouched.
create or replace function public.resume_long_form_visual_plan_version(p_visual_plan_version_id uuid, p_user_id uuid)
returns public.long_form_visual_plan_versions
language plpgsql security definer set search_path = '' as $$
declare v public.long_form_visual_plan_versions; owner_id uuid;
begin
  select * into v from public.long_form_visual_plan_versions where id = p_visual_plan_version_id for update;
  if not found then raise exception 'VISUAL_PLAN_NOT_FOUND'; end if;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if v.status <> 'failed' then return v; end if;

  -- Reopen at the SAME stage it failed at (planning or finalizing) — never
  -- rewound to stage 'planning' from a finalizing failure, which would
  -- silently re-run chapter planning that already succeeded. stage_attempt
  -- resets to 0: a resume is a deliberate, informed retry (the operator
  -- fixed the underlying bug), not another blind attempt against the same
  -- broken code, so it deserves a full fresh attempt budget.
  update public.long_form_visual_plan_versions
  set status = 'planning', stage_attempt = 0, worker_lock_until = null, last_error_code = null, last_error_at = null
  where id = v.id
  returning * into v;
  return v;
end $$;
revoke all on function public.resume_long_form_visual_plan_version(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resume_long_form_visual_plan_version(uuid, uuid) to service_role;
