-- Owner, 2026-11-02.
-- 1. The sign-up bonus: +50 credits on the first plan, paid within 3 days of the account's own sign-up (_shared/signupBonus.js).
--    signup_bonuses holds each new account's end time, from this migration on; older accounts have no row and no bonus.
--    The webhook gives the credits through grant_offer_bonus: once per account. reminder_sent_at is for the emails to come.
-- 2. public_creator_count: "Join 21,000+ creators" on the sign-up page, rounded down to the thousand. Nothing else is exposed.
create table if not exists public.signup_bonuses (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  expires_at       timestamptz not null,
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.signup_bonuses enable row level security;
revoke all on public.signup_bonuses from public, anon, authenticated;
grant select on public.signup_bonuses to authenticated;
drop policy if exists "signup_bonuses: read own" on public.signup_bonuses;
create policy "signup_bonuses: read own" on public.signup_bonuses for select to authenticated using (auth.uid() = user_id);

-- A problem here must never stop a sign-up: the account just has no bonus.
create or replace function public.start_signup_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.signup_bonuses (user_id, expires_at)
  values (new.id, coalesce(new.created_at, now()) + interval '3 days')
  on conflict (user_id) do nothing;
  return new;
exception when others then
  raise warning 'start_signup_bonus: %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.start_signup_bonus() from public, anon, authenticated;

drop trigger if exists on_auth_user_signup_bonus on auth.users;
create trigger on_auth_user_signup_bonus after insert on auth.users
  for each row execute function public.start_signup_bonus();

create or replace function public.public_creator_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select ((count(*) / 1000) * 1000)::integer from public.profiles;
$$;
revoke all on function public.public_creator_count() from public;
grant execute on function public.public_creator_count() to anon, authenticated;

notify pgrst, 'reload schema';
