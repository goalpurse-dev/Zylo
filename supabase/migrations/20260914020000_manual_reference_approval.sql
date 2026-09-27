-- Part 8 of the 2026-09-14 "FINAL CHARACTER REFERENCE POLISH" fix: every
-- CURRENT required reference in "Needs Review" must have a deliberate
-- manual "Approve Anyway" override — QA can be too strict in the wrong
-- places (a missing action pose, minor prop text) and the user must be able
-- to say "this is fine" without regenerating or editing pixels. Manual
-- approval never touches the image, never calls a provider, and never
-- erases the automated QA result — it just promotes the asset to canonical
-- with a recorded human decision on top.
alter table public.long_form_reference_assets
  add column if not exists manual_approval boolean not null default false,
  add column if not exists manual_approval_user_id uuid,
  add column if not exists manual_approval_at timestamptz;

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
  return a.id;
end $$;
