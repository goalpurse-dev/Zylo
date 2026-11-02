-- Undoes 20261130110000. Bonuses already given stay given (offer_redemptions, credit ledger).
drop trigger if exists on_auth_user_signup_bonus on auth.users;
drop function if exists public.start_signup_bonus();
drop function if exists public.public_creator_count();
drop table if exists public.signup_bonuses;
notify pgrst, 'reload schema';
