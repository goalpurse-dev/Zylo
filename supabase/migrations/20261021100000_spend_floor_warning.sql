-- spend_on_success still never fails after a generation (it floors the balance
-- at 0), but a floor is now LOGGED as a billing warning so we can see it:
-- system_logs source 'billing', level 'warn', event 'spend_floored_at_zero'.
-- Nothing calls it today (legacy); its ledger row now uses an allowed type.
CREATE OR REPLACE FUNCTION public.spend_on_success(p_job_id uuid, p_tool_key text, p_model text DEFAULT NULL::text, p_seconds integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_user uuid;
  v_need int;
  v_balance int;
begin
  -- find job owner
  select user_id into v_user from jobs where id = p_job_id;
  if v_user is null then
    raise exception 'Job % not found', p_job_id;
  end if;

  -- how many credits
  v_need := app_get_credits(p_tool_key, p_model, p_seconds);

  -- stamp job for auditing
  update jobs
  set tool_key = p_tool_key,
      model    = coalesce(p_model, '∅'),
      charge_credits = v_need
  where id = p_job_id;

  select credit_balance into v_balance from profiles where id = v_user for update;

  -- deduct (no exception — you asked to avoid failing after gen)
  update profiles
  set credit_balance = greatest(0, credit_balance - v_need)  -- never below 0, never fails after the generation
  where id = v_user;

  -- The floor is a billing leak: log it (never let the log fail the spend).
  if v_need > coalesce(v_balance, 0) then
    begin
      insert into system_logs (source, level, event, job_id, user_id, tool_key, message, details)
      values ('billing', 'warn', 'spend_floored_at_zero', p_job_id, v_user, p_tool_key,
              format('spend_on_success needed %s credits but the balance was %s; floored at 0 (%s not charged)', v_need, coalesce(v_balance, 0), v_need - coalesce(v_balance, 0)),
              jsonb_build_object('need', v_need, 'balance', coalesce(v_balance, 0), 'shortfall', v_need - coalesce(v_balance, 0), 'model', coalesce(p_model, '∅'), 'seconds', p_seconds));
    exception when others then
      raise warning 'spend_floored_at_zero log failed: %', sqlerrm;
    end;
  end if;

  -- ledger
  insert into credit_ledger (user_id, job_id, delta, type, reason)
  values (v_user, p_job_id, -v_need, 'charge', -- 'spend' is not an allowed credit_ledger type (the insert always failed)
          jsonb_build_object('tool_key', p_tool_key, 'model', coalesce(p_model,'∅'), 'seconds', p_seconds));
end $function$;
