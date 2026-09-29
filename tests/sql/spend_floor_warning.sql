-- spend_on_success floors at 0 AND logs a billing warning. Rolls back (always
-- ends with RAISE). Run: npx supabase db query --linked -f tests/sql/spend_floor_warning.sql
do $$
declare uid uuid := 'd66a0ea9-3574-4fad-94ed-c82aea15061f'; jid uuid; tk text; need int; bal int; logged int;
begin
  select tool_key into tk from app_provider_prices where active and model_norm = '∅' and credits > 1 order by tool_key limit 1;
  need := app_get_credits(tk, null, null);
  insert into jobs (user_id, type, tool_key, prompt, settings, input) values (uid, 'image', tk, 'floor test', '{"width":1024,"height":1024}', '{"width":1024,"height":1024}') returning id into jid;
  update profiles set credit_balance = greatest(need - 1, 0) where id = uid;
  perform spend_on_success(jid, tk, null, null);
  select credit_balance into bal from profiles where id = uid;
  select count(*) into logged from system_logs where event = 'spend_floored_at_zero' and job_id = jid;
  raise exception 'SPEND_FLOOR % tool=% need=% balance_after=% logged=%', case when bal = 0 and logged = 1 and need > 0 then 'PASS' else 'FAIL' end, tk, need, bal, logged;
end $$;
