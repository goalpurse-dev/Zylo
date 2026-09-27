-- =============================================================================
-- referral_codes
-- Foundation for the "Earn" affiliate page: one stable referral code per user.
-- Frontend never inserts directly — it always goes through the SECURITY
-- DEFINER RPC below so code generation/collision handling stays server-side.
-- =============================================================================
create table if not exists public.referral_codes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null unique references auth.users(id) on delete cascade,
  code       text        not null unique,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

create policy "referral_codes_select_own"
  on public.referral_codes
  for select
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- get_or_create_referral_code()
-- Returns the caller's referral code, generating one on first call.
-- SECURITY DEFINER so it can insert past RLS; always scoped to auth.uid().
-- =============================================================================
create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  new_code      text;
  alphabet      text := 'abcdefghijklmnopqrstuvwxyz0123456789';
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select code into existing_code
  from public.referral_codes
  where user_id = auth.uid();

  if existing_code is not null then
    return existing_code;
  end if;

  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    begin
      insert into public.referral_codes (user_id, code) values (auth.uid(), new_code);
      return new_code;
    exception when unique_violation then
      -- code collision or concurrent call already inserted a row; retry/re-check
      select code into existing_code
      from public.referral_codes
      where user_id = auth.uid();
      if existing_code is not null then
        return existing_code;
      end if;
    end;
  end loop;
end;
$$;
