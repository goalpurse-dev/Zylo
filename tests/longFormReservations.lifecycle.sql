-- Phase 0, Section B.4 — reservation lifecycle tests: delete -> release,
-- complete -> settle with partial refund, retry within reservation, retry
-- after reservation exhausted, and double-invocation idempotency for both
-- release and settle. Run manually against the linked database wrapped in
-- BEGIN/ROLLBACK (as below) — nothing here persists. Borrows a real,
-- existing profiles row (enough credit_balance to reserve against) rather
-- than inserting a fake one, since profiles has its own auth.users FK chain
-- this test doesn't want to fabricate; the whole transaction rolls back so
-- that user's real balance is restored automatically.
begin;
do $$
declare
  test_user_id uuid;
  session_a uuid; session_b uuid; session_c uuid;
  project_a uuid; project_b uuid; project_c uuid;
  profile_a public.long_form_generation_profiles;
  profile_b public.long_form_generation_profiles;
  profile_c public.long_form_generation_profiles;
  res_a public.long_form_project_reservations;
  res_b public.long_form_project_reservations;
  res_c public.long_form_project_reservations;
  reread public.long_form_project_reservations;
  balance_start int;
  balance_now int;
  commit_result text;
  raised_ceiling boolean := false;
begin
  select id into test_user_id from public.profiles where credit_balance > 1000 limit 1;
  assert test_user_id is not null, 'no profile with enough credit_balance to test against';
  select credit_balance into balance_start from public.profiles where id = test_user_id;

  -- ============================================================
  -- Scenario 1: delete -> release (full refund), then double-invoke
  -- release on the same (now-released) reservation.
  -- ============================================================
  insert into public.long_form_discovery_sessions (user_id) values (test_user_id) returning id into session_a;
  insert into public.long_form_projects (user_id, discovery_session_id, topic)
    values (test_user_id, session_a, '[LIFECYCLE TEST] release-on-delete') returning id into project_a;
  profile_a := public.create_long_form_generation_profile(project_a, test_user_id,
    jsonb_build_object('visualRecipe','stickman_doodle_explainer','recipeVersion','STICKMAN_DOODLE_EXPLAINER_V1','renderTier','v3','targetDurationMinutes',10));
  res_a := public.reserve_long_form_project_credits(project_a, test_user_id, profile_a.id, 456, '{}'::jsonb);
  assert res_a.status = 'reserved', 'scenario 1: expected reserved';
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start - 456, 'scenario 1: balance not debited by reserve';

  res_a := public.release_long_form_reservation(res_a.id, test_user_id);
  assert res_a.status = 'released', 'scenario 1: expected released';
  assert res_a.released_credits = 456, 'scenario 1: expected full refund of 456';
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start, 'scenario 1: balance not fully restored after release';

  -- Double invocation — a project delete retried, a duplicate cron sweep, etc.
  reread := public.release_long_form_reservation(res_a.id, test_user_id);
  assert reread.status = 'released', 'scenario 1 double-invoke: status changed on second release';
  assert reread.released_credits = 456, 'scenario 1 double-invoke: released_credits changed on second release';
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start, 'scenario 1 double-invoke: balance refunded TWICE';

  -- ============================================================
  -- Scenario 2: retry within reservation, then complete -> settle
  -- with a PARTIAL refund (reserved 456, commit 3, refund must be 453).
  -- ============================================================
  insert into public.long_form_discovery_sessions (user_id) values (test_user_id) returning id into session_b;
  insert into public.long_form_projects (user_id, discovery_session_id, topic)
    values (test_user_id, session_b, '[LIFECYCLE TEST] settle-partial-refund') returning id into project_b;
  profile_b := public.create_long_form_generation_profile(project_b, test_user_id,
    jsonb_build_object('visualRecipe','stickman_doodle_explainer','recipeVersion','STICKMAN_DOODLE_EXPLAINER_V1','renderTier','v3','targetDurationMinutes',10));
  res_b := public.reserve_long_form_project_credits(project_b, test_user_id, profile_b.id, 456, '{}'::jsonb);

  commit_result := public.commit_long_form_reservation_spend(project_b, 3);
  assert commit_result = 'COMMITTED', 'scenario 2: expected COMMITTED for an in-budget commit';
  select * into res_b from public.long_form_project_reservations where id = res_b.id;
  assert res_b.committed_credits = 3, 'scenario 2: committed_credits not tracked correctly';
  -- balance should NOT have moved again — commit only earmarks against the
  -- already-reserved amount, it never touches profiles.credit_balance itself.
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start - 456, 'scenario 2: commit incorrectly touched credit_balance';

  res_b := public.settle_long_form_reservation(res_b.id, test_user_id);
  assert res_b.status = 'settled', 'scenario 2: expected settled';
  assert res_b.released_credits = 453, format('scenario 2: expected partial refund of 453, got %s', res_b.released_credits);
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start - 3, format('scenario 2: expected balance down by exactly 3 (the committed amount), got delta %s', balance_start - balance_now);

  -- Double invocation of settle.
  reread := public.settle_long_form_reservation(res_b.id, test_user_id);
  assert reread.status = 'settled', 'scenario 2 double-invoke: status changed on second settle';
  assert reread.released_credits = 453, 'scenario 2 double-invoke: released_credits changed on second settle';
  select credit_balance into balance_now from public.profiles where id = test_user_id;
  assert balance_now = balance_start - 3, 'scenario 2 double-invoke: balance refunded/charged again';

  -- ============================================================
  -- Scenario 3: retry AFTER reservation exhausted — committing past the
  -- reservation's own ceiling must raise, never silently overspend.
  -- ============================================================
  insert into public.long_form_discovery_sessions (user_id) values (test_user_id) returning id into session_c;
  insert into public.long_form_projects (user_id, discovery_session_id, topic)
    values (test_user_id, session_c, '[LIFECYCLE TEST] ceiling-exceeded') returning id into project_c;
  profile_c := public.create_long_form_generation_profile(project_c, test_user_id,
    jsonb_build_object('visualRecipe','stickman_doodle_explainer','recipeVersion','STICKMAN_DOODLE_EXPLAINER_V1','renderTier','v3','targetDurationMinutes',10));
  res_c := public.reserve_long_form_project_credits(project_c, test_user_id, profile_c.id, 5, '{}'::jsonb);

  commit_result := public.commit_long_form_reservation_spend(project_c, 5);
  assert commit_result = 'COMMITTED', 'scenario 3: expected the first commit (exactly at ceiling) to succeed';

  begin
    commit_result := public.commit_long_form_reservation_spend(project_c, 1);
    raise exception 'scenario 3: expected RESERVATION_CEILING_EXCEEDED to be raised, got %', commit_result;
  exception when others then
    if sqlerrm like 'RESERVATION_CEILING_EXCEEDED%' then
      raised_ceiling := true;
    else
      raise;
    end if;
  end;
  assert raised_ceiling, 'scenario 3: ceiling-exceeded exception was not raised as expected';
  select * into res_c from public.long_form_project_reservations where id = res_c.id;
  assert res_c.committed_credits = 5, 'scenario 3: committed_credits changed despite the rejected over-ceiling commit';

  -- ============================================================
  -- Scenario 4: commit_long_form_reservation_spend against a project with
  -- NO reservation at all -> NO_RESERVATION (the caller's cue to fall back
  -- to a direct debit, per retry_long_form_scene/edit_long_form_scene).
  -- ============================================================
  commit_result := public.commit_long_form_reservation_spend(project_a, 1); -- project_a's reservation is already released
  assert commit_result = 'NO_RESERVATION', format('scenario 4: expected NO_RESERVATION for a released project, got %s', commit_result);

  raise notice 'ALL RESERVATION LIFECYCLE SCENARIOS PASSED';
end $$;
rollback;
