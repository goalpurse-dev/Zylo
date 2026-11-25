-- Affiliate program, round 3 (owner, 2026-11-25): "Where do you post?" before "Get my code".
--   affiliates.handles   [{ "platform": "tiktok"|"youtube"|"instagram"|"other", "handle": "..." }], at least one to join
--   affiliate_join       + p_handles (affiliate-api cleans them; this refuses an empty list); the old 6-argument join is gone
-- Run after 20261217110000. Safe to run twice.
-- Rollback: supabase/rollbacks/20261217120000_affiliate_handles_rollback.sql

alter table public.affiliates add column if not exists handles jsonb not null default '[]'::jsonb
  check (jsonb_typeof(handles) = 'array' and jsonb_array_length(handles) <= 6);

drop function if exists public.affiliate_join(uuid, text[], text, numeric, numeric, text);
create or replace function public.affiliate_join(p_user_id uuid, p_candidates text[], p_display_name text, p_cash_rate numeric,
  p_credit_rate numeric, p_ip_hash text, p_handles jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a affiliates; c text;
begin
  select * into a from affiliates where user_id = p_user_id;
  if found then return jsonb_build_object('result', 'exists', 'id', a.id, 'code', a.code); end if;
  if p_handles is null or jsonb_typeof(p_handles) <> 'array' or jsonb_array_length(p_handles) = 0 then
    return jsonb_build_object('result', 'no_handles');
  end if;
  foreach c in array p_candidates loop
    continue when c is null or c !~ '^[A-Z0-9]{3,20}$';
    continue when exists (select 1 from affiliates where lower(code) = lower(c));
    begin
      insert into affiliates (user_id, code, display_name, cash_rate, credit_rate, ip_hashes, handles)
      values (p_user_id, c, left(coalesce(nullif(btrim(p_display_name), ''), c), 40), p_cash_rate, p_credit_rate,
              case when p_ip_hash is null then '{}'::text[] else array[p_ip_hash] end, p_handles)
      returning * into a;
      return jsonb_build_object('result', 'created', 'id', a.id, 'code', a.code);
    exception when unique_violation then
      select * into a from affiliates where user_id = p_user_id;
      if found then return jsonb_build_object('result', 'exists', 'id', a.id, 'code', a.code); end if;
    end;
  end loop;
  return jsonb_build_object('result', 'no_free_code');
end $$;

-- The first free code among the candidates (the "Your code will be" line before joining). Read-only.
create or replace function public.affiliate_free_code(p_candidates text[])
returns text language sql stable security definer set search_path = public as $$
  select c from unnest(p_candidates) with ordinality as t(c, i)
  where c ~ '^[A-Z0-9]{3,20}$' and not exists (select 1 from affiliates where lower(code) = lower(c))
  order by i limit 1;
$$;

revoke all on function public.affiliate_join(uuid, text[], text, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.affiliate_join(uuid, text[], text, numeric, numeric, text, jsonb) to service_role;
revoke all on function public.affiliate_free_code(text[]) from public, anon, authenticated;
grant execute on function public.affiliate_free_code(text[]) to service_role;

notify pgrst, 'reload schema';
