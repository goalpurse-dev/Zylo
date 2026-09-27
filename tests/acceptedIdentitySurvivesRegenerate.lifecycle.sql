-- Run only after 20260929120000_accepted_identity_survives_regenerate.sql.
-- Uses the REAL Mars protagonist identity chain. Rollback keeps it untouched.
begin;
do $$
declare
  world_id uuid := '973ec40c-82d2-42d8-9090-c6cf469dd3f4';
  entity_id text := 'e_protagonist';
  approved_id uuid := '6c3c5a8b-4643-4de4-8152-1f311873907d'; -- current accepted (manually approved)
  candidate_id uuid;
begin
  if public.accepted_reference_identity(world_id, entity_id) is distinct from approved_id then raise exception 'BASELINE_ACCEPTED_UNEXPECTED'; end if;

  -- Regenerate: a brand-new, not-yet-reviewed candidate must NOT revoke the
  -- already-approved identity (real incident this fixes).
  candidate_id := gen_random_uuid();
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, result_url, generation_type, replaces_asset_id, qa_status)
  values (candidate_id, world_id, entity_id, 'character_reference', 'identity_outfit_sheet', 'succeeded', 'https://example.com/candidate.png', 'provider', approved_id, null);
  if public.accepted_reference_identity(world_id, entity_id) is distinct from approved_id then raise exception 'REGENERATE_REVOKED_APPROVED_IDENTITY'; end if;

  -- Candidate rejected: approved identity still stands, unaffected.
  update public.long_form_reference_assets set qa_status = 'rejected' where id = candidate_id;
  if public.accepted_reference_identity(world_id, entity_id) is distinct from approved_id then raise exception 'REJECTED_CANDIDATE_AFFECTED_ACCEPTED'; end if;

  -- Candidate approved: atomic promotion to the new one.
  update public.long_form_reference_assets set qa_status = 'approved' where id = candidate_id;
  if public.accepted_reference_identity(world_id, entity_id) is distinct from candidate_id then raise exception 'APPROVED_CANDIDATE_NOT_PROMOTED'; end if;
end $$;
rollback;
