-- The email gate, second version (2026-10-10, the owner's rules):
--   - marketing: at most 1 per address in 24 hours, and none in the first 24
--     hours after the account was created
--   - account emails ("your video is ready", the welcome email) are counted on
--     their own: marketing can never use up their room. Their ceiling (10 in
--     24 hours) exists only so a broken sender can't loop
--   - test sends: 20 in 24 hours, as before
-- Unchanged: a suppressed address gets nothing, marketing needs
-- email_updates = true, the same email (address + kind) is sent once.
-- New reason: signed_up_today.
create or replace function public.claim_email_send(p_email text, p_kind text, p_category text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_signed_up timestamptz;
  v_last_day int;
  v_id bigint;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_address');
  end if;
  if coalesce(btrim(p_kind), '') = '' or p_category is null or p_category not in ('marketing', 'account', 'test') then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;

  -- One claim at a time per address: two callers can't both count "0 so far".
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  if exists (select 1 from email_suppressions where email = v_email) then
    return jsonb_build_object('ok', false, 'reason', 'suppressed');
  end if;

  if p_category = 'marketing' then
    -- The newest ON profile with this address decides (there is normally one).
    select max(created_at) into v_signed_up
      from profiles where lower(btrim(email)) = v_email and email_updates is true;
    if v_signed_up is null then
      return jsonb_build_object('ok', false, 'reason', 'no_consent');
    end if;
    if v_signed_up > now() - interval '24 hours' then
      return jsonb_build_object('ok', false, 'reason', 'signed_up_today');
    end if;
  end if;

  if exists (select 1 from email_sends where email = v_email and kind = p_kind) then
    return jsonb_build_object('ok', false, 'reason', 'already_sent');
  end if;

  -- Each category has its own count. The ceilings are constants on purpose: a caller cannot raise them.
  select count(*) into v_last_day
    from email_sends
   where email = v_email
     and category = p_category
     and sent_at > now() - interval '24 hours';
  if v_last_day >= (case p_category when 'marketing' then 1 when 'account' then 10 else 20 end) then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;

  insert into email_sends (email, kind, category) values (v_email, p_kind, p_category) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.claim_email_send(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_email_send(text, text, text) to service_role;
