-- Run only after 20260911160000_sheet_pack_v4_identity_derived_faceprofile.sql.
-- Uses scratch rows under a fake entity_id tied to the real Mars world (FK
-- requires a real visual_world_version_id) so it never touches real Mars
-- protagonist data; rollback leaves no trace either way.
begin;
do $$
declare
  world_id uuid := '973ec40c-82d2-42d8-9090-c6cf469dd3f4';
  entity_id text := 'e_lifecycle_test_sheet_v4';
  identity1_id uuid := gen_random_uuid();
  identity2_rejected_id uuid := gen_random_uuid();
  identity2_id uuid := gen_random_uuid();
  face1_id uuid := gen_random_uuid();
  profile1_id uuid := gen_random_uuid();
begin
  -- created_at is set explicitly and strictly increasing below: now() is
  -- frozen at transaction start in Postgres, so every row in this single
  -- wrapped transaction would otherwise get an IDENTICAL created_at,
  -- making accepted_reference_identity's "most recent wins" tie-break
  -- arbitrary — a test-methodology artifact only (real rows are created in
  -- separate transactions with genuinely different timestamps).
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, qa_status, result_url, generation_type, created_at)
  values (identity1_id, world_id, entity_id, 'character_reference', 'identity_outfit_sheet', 'succeeded', 'approved', 'https://example.test/identity1.png', 'provider', now());

  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, qa_status, result_url, generation_type, input_reference_asset_ids, created_at)
  values
    (face1_id, world_id, entity_id, 'character_reference', 'face_sheet', 'succeeded', 'approved', 'https://example.test/face1.png', 'provider', array[identity1_id], now() + interval '1 second'),
    (profile1_id, world_id, entity_id, 'character_reference', 'profile_silhouette_sheet', 'succeeded', 'approved', 'https://example.test/profile1.png', 'provider', array[identity1_id], now() + interval '1 second');

  -- H: a REJECTED identity candidate must not disturb the old canonical
  -- identity or mark correctly-derived Face/Profile stale.
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, replaces_asset_id, generation_type, result_url, created_at)
  values (identity2_rejected_id, world_id, entity_id, 'character_reference', 'identity_outfit_sheet', 'succeeded', identity1_id, 'provider', 'https://example.test/identity2_rejected.png', now() + interval '2 seconds');
  perform public.record_reference_qa_result(identity2_rejected_id, false, '{"reasons":["test rejection"]}'::jsonb);
  if public.accepted_reference_identity(world_id, entity_id) is distinct from identity1_id then raise exception 'H_OLD_IDENTITY_NOT_CANONICAL_AFTER_REJECTION'; end if;
  if (select stale from public.long_form_reference_assets where id = face1_id) is distinct from false then raise exception 'H_FACE_WRONGLY_MARKED_STALE_ON_REJECTION'; end if;
  if (select stale from public.long_form_reference_assets where id = profile1_id) is distinct from false then raise exception 'H_PROFILE_WRONGLY_MARKED_STALE_ON_REJECTION'; end if;

  -- A / B / I: a NEW APPROVED identity must move the canonical pointer,
  -- mark the old Face/Profile (still pointing at the OLD identity) stale,
  -- and queue exactly one fresh pending replacement for each.
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, replaces_asset_id, generation_type, result_url, created_at)
  values (identity2_id, world_id, entity_id, 'character_reference', 'identity_outfit_sheet', 'succeeded', identity2_rejected_id, 'provider', 'https://example.test/identity2.png', now() + interval '3 seconds');
  perform public.record_reference_qa_result(identity2_id, true, '{"reasons":[]}'::jsonb);

  if public.accepted_reference_identity(world_id, entity_id) is distinct from identity2_id then raise exception 'I_CANONICAL_POINTER_DID_NOT_CHANGE'; end if;
  if (select stale from public.long_form_reference_assets where id = face1_id) is distinct from true then raise exception 'A_PREVIOUS_FACE_NOT_MARKED_STALE'; end if;
  if (select stale from public.long_form_reference_assets where id = profile1_id) is distinct from true then raise exception 'B_PREVIOUS_PROFILE_NOT_MARKED_STALE'; end if;
  if (select count(*) from public.long_form_reference_assets where replaces_asset_id = face1_id and angle_or_view = 'face_sheet' and status = 'pending') <> 1 then
    raise exception 'A_FRESH_FACE_REPLACEMENT_NOT_QUEUED_EXACTLY_ONCE';
  end if;
  if (select count(*) from public.long_form_reference_assets where replaces_asset_id = profile1_id and angle_or_view = 'profile_silhouette_sheet' and status = 'pending') <> 1 then
    raise exception 'B_FRESH_PROFILE_REPLACEMENT_NOT_QUEUED_EXACTLY_ONCE';
  end if;

  -- Idempotency: re-invoking the marker for the same identity must not
  -- double-queue a second replacement for an already-stale row.
  perform public.mark_derived_sheets_stale_and_requeue(world_id, entity_id, identity2_id);
  if (select count(*) from public.long_form_reference_assets where replaces_asset_id = face1_id) <> 1 then raise exception 'DOUBLE_QUEUED_FACE_REPLACEMENT'; end if;
  if (select count(*) from public.long_form_reference_assets where replaces_asset_id = profile1_id) <> 1 then raise exception 'DOUBLE_QUEUED_PROFILE_REPLACEMENT'; end if;

  -- A Face/Profile row already correctly derived from the CURRENT identity
  -- must never be marked stale by re-running the marker.
  if exists (
    select 1 from public.long_form_reference_assets
    where replaces_asset_id = face1_id and stale = true
  ) then raise exception 'FRESH_REPLACEMENT_SHOULD_NOT_START_STALE'; end if;
end $$;
rollback;
