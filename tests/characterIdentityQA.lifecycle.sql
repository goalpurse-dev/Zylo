-- Run only after 20260927120000_character_identity_qa.sql. Rollback keeps
-- the real Mars protagonist rows untouched.
begin;
do $$
declare anchor_id uuid := 'a5fd4c3c-b1d7-4fea-80a6-898132bd54ae'; world_id uuid := '973ec40c-82d2-42d8-9090-c6cf469dd3f4'; got uuid;
begin
  got := public.accepted_reference_identity(world_id, 'e_protagonist');
  if got is distinct from anchor_id then raise exception 'BASELINE_ANCHOR_UNEXPECTED'; end if;

  -- A master under review (qa_status:'pending') is not an accepted identity.
  update public.long_form_reference_assets set qa_status = 'pending' where id = anchor_id;
  if public.accepted_reference_identity(world_id, 'e_protagonist') is not null then raise exception 'PENDING_MASTER_ACCEPTED'; end if;

  -- A rejected master is not accepted, and does NOT silently revive the
  -- older superseded master either (real risk: reviving a stale identity
  -- for new Profile/Back dispatch instead of blocking outright).
  update public.long_form_reference_assets set qa_status = 'rejected' where id = anchor_id;
  if public.accepted_reference_identity(world_id, 'e_protagonist') is not null then raise exception 'REJECTED_MASTER_ACCEPTED_OR_REVIVED_OLD'; end if;

  -- Approval restores normal dispatch eligibility.
  update public.long_form_reference_assets set qa_status = 'approved' where id = anchor_id;
  if public.accepted_reference_identity(world_id, 'e_protagonist') is distinct from anchor_id then raise exception 'APPROVED_MASTER_NOT_ACCEPTED'; end if;

  -- record_reference_qa_result only accepts a terminal (succeeded) generation.
  begin
    perform public.record_reference_qa_result('6437d0ea-9de8-4ba8-abd6-2334e1f24631', true, '{}'::jsonb);
  exception when others then
    if sqlerrm not in ('TERMINAL_GENERATION_REQUIRED') then raise; end if;
  end;

  -- Recording a real QA verdict persists qa_status/qa_result and increments
  -- qa_attempts, without disturbing any other column (rolled back regardless).
  perform public.record_reference_qa_result(anchor_id, false, '{"reasons":["test"]}'::jsonb);
  if (select qa_status from public.long_form_reference_assets where id = anchor_id) <> 'rejected' then raise exception 'QA_RESULT_NOT_RECORDED'; end if;
  if (select qa_attempts from public.long_form_reference_assets where id = anchor_id) < 1 then raise exception 'QA_ATTEMPTS_NOT_INCREMENTED'; end if;
end $$;
rollback;
