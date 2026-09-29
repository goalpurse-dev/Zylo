-- Phase 7 billing rules, checked against the LIVE functions on the internal
-- test account. Everything runs in one DO block that always ends with
-- RAISE, so every change (rows, balance) rolls back. Run:
--   npx supabase db query --linked -f tests/sql/phase7_billing_rules.sql
-- Expect: ERROR ... PHASE7_BILLING PASS <details>.
do $$
declare
  uid uuid := 'd66a0ea9-3574-4fad-94ed-c82aea15061f'; -- @zyvo-internal.test
  sess uuid; p uuid[] := '{}'; g uuid[] := '{}'; pid uuid; gid uuid;
  r public.long_form_project_reservations; bal int; out text := ''; fails text := '';
begin
  for i in 1..3 loop
    insert into public.long_form_discovery_sessions(user_id) values (uid) returning id into sess;
    insert into public.long_form_projects(user_id, discovery_session_id, topic) values (uid, sess, 'phase7 billing test ' || i) returning id into pid;
    insert into public.long_form_generation_profiles(project_id, visual_recipe, recipe_version, render_tier, target_duration_minutes)
      values (pid, 'stickman', 'stickman_v1', 'v2', 10) returning id into gid;
    p := p || pid; g := g || gid;
  end loop;

  -- 1. A user with EXACTLY the quote can generate and finish; settle = the full quote.
  update public.profiles set credit_balance = 250 where id = uid;
  r := public.reserve_long_form_project_credits(p[1], uid, g[1], 250, '[]'::jsonb);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 0 then fails := fails || ' exact_reserve_bal=' || bal; end if;
  r := public.settle_long_form_reservation_full(r.id, uid);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 0 or r.committed_credits <> 250 or r.released_credits <> 0 or r.status <> 'settled' then
    fails := fails || format(' full_settle(bal=%s committed=%s released=%s status=%s)', bal, r.committed_credits, r.released_credits, r.status);
  end if;
  out := out || format('exact: reserve 250 of 250 -> bal %s, settled %s/%s; ', bal, r.committed_credits, r.reserved_credits);

  -- 2. Never below 0: a debit over the balance fails, a direct write to -1 is rejected.
  begin
    perform public.deduct_credits(uid, 1);
    fails := fails || ' deduct_at_0_allowed';
  exception when others then out := out || 'deduct at 0 -> ' || sqlerrm || '; ';
  end;
  begin
    update public.profiles set credit_balance = -1 where id = uid;
    fails := fails || ' negative_balance_allowed';
  exception when check_violation then out := out || 'balance -1 -> check_violation; ';
  end;

  -- 3. Add-on (1440p shape): charged at start from the balance, refunded if the render fails.
  update public.profiles set credit_balance = 12 where id = uid;
  perform public.deduct_credits(uid, 10);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 2 then fails := fails || ' addon_charge_bal=' || bal; end if;
  perform public.deduct_credits(uid, -10);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 12 then fails := fails || ' addon_refund_bal=' || bal; end if;
  out := out || format('addon 10 -> 2 -> refund -> %s; ', bal);

  -- 4. Deleted/cancelled/failed before completion -> full release.
  update public.profiles set credit_balance = 100 where id = uid;
  r := public.reserve_long_form_project_credits(p[2], uid, g[2], 90, '[]'::jsonb);
  perform public.release_long_form_reservation(r.id, uid);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 100 then fails := fails || ' release_bal=' || bal; end if;
  out := out || format('reserve 90 then release -> bal %s; ', bal);

  -- 5. 7-day idle settle (partial) with nothing committed refunds everything.
  r := public.reserve_long_form_project_credits(p[3], uid, g[3], 75, '[]'::jsonb);
  perform public.settle_long_form_reservation(r.id, uid);
  select credit_balance into bal from public.profiles where id = uid;
  if bal <> 100 then fails := fails || ' idle_settle_bal=' || bal; end if;
  out := out || format('idle settle, 0 committed -> bal %s', bal);

  raise exception 'PHASE7_BILLING % %', case when fails = '' then 'PASS' else 'FAIL:' || fails end, out;
end $$;
