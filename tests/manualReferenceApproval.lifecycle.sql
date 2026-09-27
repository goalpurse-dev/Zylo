-- Run only after 20260914020000_manual_reference_approval.sql. Uses the
-- real Mars protagonist's current character_reference_sheet row (Needs
-- Review from a real live QA rejection — "Missing action pose panel", see
-- the 2026-09-13 Kling controlled test) as a realistic fixture. Rollback
-- keeps it untouched — no pixels, no jobs, no provider calls, matching
-- Part 15's "no paid image calls" requirement for this task.
begin;
do $$
declare
  asset_id uuid := 'c758b81c-fb99-4058-a971-1372e514ff62';
  owner_id uuid; wrong_user uuid := '00000000-0000-0000-0000-000000000000';
  before_qa_result jsonb; after_qa_result jsonb; returned uuid;
begin
  select p.user_id into owner_id
  from public.long_form_reference_assets a
  join public.long_form_visual_world_versions v on v.id = a.visual_world_version_id
  join public.long_form_projects p on p.id = v.project_id
  where a.id = asset_id;

  if (select status from public.long_form_reference_assets where id = asset_id) <> 'succeeded'
  or (select qa_status from public.long_form_reference_assets where id = asset_id) <> 'rejected' then
    raise exception 'FIXTURE_NOT_NEEDS_REVIEW — this test expects the real Mars protagonist sheet to still be in Needs Review; update the fixture asset id if it has since been resolved';
  end if;

  select qa_result into before_qa_result from public.long_form_reference_assets where id = asset_id;

  -- Wrong user is rejected outright — never silently succeeds for someone
  -- who does not own the project.
  begin
    perform public.approve_long_form_reference_asset_manually(asset_id, wrong_user);
    raise exception 'FORBIDDEN_NOT_ENFORCED';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;

  -- A: Needs-review asset -> Approve Anyway -> current asset becomes approved.
  returned := public.approve_long_form_reference_asset_manually(asset_id, owner_id);
  if returned <> asset_id then raise exception 'WRONG_ASSET_RETURNED'; end if;
  if (select qa_status from public.long_form_reference_assets where id = asset_id) <> 'approved' then
    raise exception 'NOT_PROMOTED_TO_APPROVED';
  end if;
  if (select manual_approval from public.long_form_reference_assets where id = asset_id) is not true then
    raise exception 'MANUAL_APPROVAL_FLAG_NOT_SET';
  end if;
  if (select manual_approval_user_id from public.long_form_reference_assets where id = asset_id) <> owner_id then
    raise exception 'MANUAL_APPROVAL_USER_NOT_RECORDED';
  end if;
  if (select manual_approval_at from public.long_form_reference_assets where id = asset_id) is null then
    raise exception 'MANUAL_APPROVAL_TIMESTAMP_NOT_RECORDED';
  end if;

  -- B: Manual approval does not erase the automated QA result — same
  -- reasons ("Missing action pose panel.") the real QA call actually
  -- produced must still be readable afterward.
  select qa_result into after_qa_result from public.long_form_reference_assets where id = asset_id;
  if after_qa_result is distinct from before_qa_result then
    raise exception 'AUTOMATED_QA_RESULT_WAS_OVERWRITTEN';
  end if;
  if not (after_qa_result ? 'reasons') then raise exception 'AUTOMATED_QA_RESULT_MISSING_REASONS_KEY'; end if;

  -- Approving again once already approved (not Needs Review anymore) must
  -- fail loudly, not silently no-op or re-approve.
  begin
    perform public.approve_long_form_reference_asset_manually(asset_id, owner_id);
    raise exception 'NOTHING_TO_APPROVE_NOT_ENFORCED';
  exception when others then
    if sqlerrm <> 'NOTHING_TO_APPROVE' then raise; end if;
  end;

  -- No pixel change: result_url identical before/after (paranoia check —
  -- the SQL function never touches this column at all).
  if (select result_url from public.long_form_reference_assets where id = asset_id) is distinct from
     'https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/c758b81c-fb99-4058-a971-1372e514ff62.jpg' then
    raise exception 'RESULT_URL_CHANGED';
  end if;
end $$;
rollback;
