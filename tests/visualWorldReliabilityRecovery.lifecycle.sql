-- Run only after 20260913000000_retry_independent_of_world_backoff.sql and
-- 20260913001000_retry_semantics_by_failure_type.sql. Scratch rows under a
-- fake entity_id tied to the real Mars world (FK requires a real
-- visual_world_version_id); rollback leaves no trace.
begin;
do $$
declare
  world_id uuid := '973ec40c-82d2-42d8-9090-c6cf469dd3f4';
  owner_id uuid;
  entity_id text := 'e_lifecycle_recovery_test';
  identity_id uuid := '44444444-4444-4444-4444-444444444444';
  predispatch_failed_id uuid := '55555555-5555-5555-5555-555555555555';
  postdispatch_failed_id uuid := '66666666-6666-6666-6666-666666666666';
  claimed_stuck_id uuid := '77777777-7777-7777-7777-777777777777';
  retried uuid;
  saved_lock timestamptz;
begin
  select user_id into owner_id from public.long_form_projects where id = (select project_id from public.long_form_visual_world_versions where id = world_id);

  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, qa_status, result_url, generation_type)
  values (identity_id, world_id, entity_id, 'character_reference', 'identity_outfit_sheet', 'succeeded', 'approved', 'https://example.test/identity.png', 'provider');

  -- job_id has a real FK to jobs — scratch rows for the two "post-dispatch"
  -- cases below (a genuine provider request actually existed).
  insert into public.jobs(id, user_id, type, tool_key, prompt, settings, input, status, provider)
  values
    (postdispatch_failed_id, owner_id, 'image', 'image:qwen.image-edit-plus', 'test', '{}'::jsonb, '{"width":1024,"height":1024}'::jsonb, 'failed', 'runware'),
    (claimed_stuck_id, owner_id, 'image', 'image:qwen.image-edit-plus', 'test', '{}'::jsonb, '{"width":1024,"height":1024}'::jsonb, 'failed', 'runware');

  -- G: PRE-DISPATCH failure (job_id null — no provider request ever made).
  -- retry_long_form_reference_asset must resume the SAME row, not create a
  -- replacement.
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, job_id, last_error_code, claim_attempts, input_reference_asset_ids)
  values (predispatch_failed_id, world_id, entity_id, 'character_reference', 'face_sheet', 'failed', null, 'CLAIMS_EXHAUSTED', 3, array[identity_id]);
  retried := public.retry_long_form_reference_asset(predispatch_failed_id, owner_id);
  if retried is distinct from predispatch_failed_id then raise exception 'G_PRE_DISPATCH_RETRY_SHOULD_REUSE_SAME_ROW'; end if;
  if (select status from public.long_form_reference_assets where id = predispatch_failed_id) <> 'pending' then raise exception 'G_ROW_NOT_RESET_TO_PENDING'; end if;
  if (select claim_attempts from public.long_form_reference_assets where id = predispatch_failed_id) <> 0 then raise exception 'G_CLAIM_ATTEMPTS_NOT_RESET'; end if;
  if exists (select 1 from public.long_form_reference_assets where replaces_asset_id = predispatch_failed_id) then raise exception 'G_SHOULD_NOT_HAVE_CREATED_A_REPLACEMENT_ROW'; end if;

  -- H: POST-DISPATCH failure (job_id exists — a real provider attempt
  -- happened). retry_long_form_reference_asset must create a replacement,
  -- preserving the old row as history.
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, job_id, last_error_code, input_reference_asset_ids)
  values (postdispatch_failed_id, world_id, entity_id, 'character_reference', 'profile_silhouette_sheet', 'failed', postdispatch_failed_id, 'PROVIDER_GENERATION_FAILED', array[identity_id]);
  retried := public.retry_long_form_reference_asset(postdispatch_failed_id, owner_id);
  if retried = postdispatch_failed_id then raise exception 'H_POST_DISPATCH_RETRY_SHOULD_CREATE_A_REPLACEMENT'; end if;
  if (select replaces_asset_id from public.long_form_reference_assets where id = retried) is distinct from postdispatch_failed_id then raise exception 'H_REPLACEMENT_NOT_LINKED_TO_OLD_ROW'; end if;
  if (select status from public.long_form_reference_assets where id = postdispatch_failed_id) <> 'failed' then raise exception 'H_OLD_ROW_MUST_REMAIN_AS_HISTORY'; end if;

  -- Retry must work regardless of the WORLD's own backoff state (real
  -- incident: Profile retry was blocked by Face's unrelated
  -- worker_lock_until). Simulate a world stuck in backoff far in the
  -- future and confirm retry still succeeds.
  select worker_lock_until into saved_lock from public.long_form_visual_world_versions where id = world_id;
  update public.long_form_visual_world_versions set worker_lock_until = now() + interval '1 hour' where id = world_id;
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, job_id, last_error_code, input_reference_asset_ids)
  values (claimed_stuck_id, world_id, entity_id, 'character_reference', 'face_sheet', 'failed', claimed_stuck_id, 'PROVIDER_GENERATION_FAILED', array[identity_id]);
  begin
    retried := public.retry_long_form_reference_asset(claimed_stuck_id, owner_id);
  exception when others then
    raise exception 'RETRY_MUST_NOT_BE_BLOCKED_BY_UNRELATED_WORLD_BACKOFF: %', sqlerrm;
  end;
  update public.long_form_visual_world_versions set worker_lock_until = saved_lock where id = world_id;

  -- A / L: a claimed-but-jobless row with an expired lease must satisfy the
  -- claim RPC's own re-claim eligibility predicate (checked directly here
  -- rather than invoking claim_long_form_reference_asset_for_version live —
  -- that function claims across the ENTIRE world with `limit 1`, and could
  -- pick a real Mars row instead of this scratch one, touching production
  -- state mid-transaction even though it would ultimately roll back).
  insert into public.long_form_reference_assets(id, visual_world_version_id, entity_id, reference_type, angle_or_view, status, job_id, claim_attempts, lease_until, generation_type)
  values ('88888888-8888-8888-8888-888888888888', world_id, entity_id, 'character_reference', 'face_sheet', 'running', null, 1, now() - interval '1 minute', 'provider');
  if not exists (
    select 1 from public.long_form_reference_assets r
    where r.id = '88888888-8888-8888-8888-888888888888'
      and r.job_id is null
      and r.claim_attempts < 3
      and (r.status = 'pending' or (r.status = 'running' and r.lease_until < now()))
  ) then raise exception 'A_L_CLAIMED_JOBLESS_EXPIRED_LEASE_ROW_NOT_RECLAIM_ELIGIBLE'; end if;

  -- M: none of the above ever touched the Identity/Outfit anchor.
  if (select status from public.long_form_reference_assets where id = identity_id) <> 'succeeded'
    or (select qa_status from public.long_form_reference_assets where id = identity_id) <> 'approved'
  then raise exception 'M_IDENTITY_WAS_DISTURBED'; end if;
end $$;
rollback;
