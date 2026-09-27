-- 2026-09-21 EMERGENCY (Priority 3): user-facing Pause/Continue Generation
-- controls. Both RPCs operate on the project's currently ACTIVE
-- (status='charged') episode generation charge — the SAME row
-- claim_long_form_scene_for_render / enqueue_long_form_scene_job already
-- gate on via is_paused (20260930440000). Ownership is verified against
-- p_user_id exactly like every other scene-operation RPC in this file
-- family (retry_long_form_scene, edit_long_form_scene) — callers are the
-- dedicated pause/continue edge functions, which derive p_user_id from a
-- verified JWT via requireUser(), never from client-supplied input.
--
-- Both are idempotent: pausing an already-paused run, or continuing an
-- already-active one, is a harmless no-op that returns the current row.
-- Resuming never clears paused_at/paused_by — that stays the audit record
-- of the last pause; a new resumed_at column marks when it ended instead.

alter table public.long_form_episode_generation_charges add column if not exists resumed_at timestamptz;

create or replace function public.pause_long_form_episode_generation(p_project_id uuid, p_user_id uuid)
returns public.long_form_episode_generation_charges
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; chg public.long_form_episode_generation_charges;
begin
  select user_id into owner_id from public.long_form_projects where id = p_project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into chg from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged' for update;
  if not found then raise exception 'NO_ACTIVE_GENERATION'; end if;
  if not chg.is_paused then
    update public.long_form_episode_generation_charges set is_paused = true, paused_at = now(), paused_by = p_user_id, resumed_at = null where id = chg.id returning * into chg;
  end if;
  return chg;
end $$;

create or replace function public.continue_long_form_episode_generation(p_project_id uuid, p_user_id uuid)
returns public.long_form_episode_generation_charges
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; chg public.long_form_episode_generation_charges;
begin
  select user_id into owner_id from public.long_form_projects where id = p_project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into chg from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged' for update;
  if not found then raise exception 'NO_ACTIVE_GENERATION'; end if;
  if chg.is_paused then
    update public.long_form_episode_generation_charges set is_paused = false, resumed_at = now() where id = chg.id returning * into chg;
  end if;
  return chg;
end $$;
