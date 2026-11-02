-- Security fix (owner's go, 2026-11-02). Until now, on the live database:
--   1. profiles_read_all (USING true, role public) let anyone with the public key read every profile, emails included.
--   2. A signed-in user could update any column of their own row: plan_code, credit_balance, the Stripe ids...
--   3. Six functions that add or take credits could be called by anyone, signed in or not, for any account.
-- After this: a user reads only their own profile and can change only the columns below; everything else is the
-- server's (edge functions use the service role, and SECURITY DEFINER functions run as their owner: neither is affected).
-- No page reads another user's profile, so no public view is needed. No user data changes here.
-- Rollback: supabase/rollbacks/20261128100000_profiles_lockdown_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ---------- who can read ----------
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
-- Rows are created by the handle_new_user trigger; the app never inserts one.
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
REVOKE ALL ON public.profiles FROM PUBLIC, anon;

-- ---------- what a user can change on their own row ----------
-- A column added later is not writable by users unless it is granted here.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, email_updates, onboarding_completed) ON public.profiles TO authenticated;

-- ---------- functions that move credits: the server only ----------
-- None of them checks who is calling, and the browser calls none of them. deduct_credits stays: it refuses a browser
-- call that adds credits or names another account.
REVOKE EXECUTE ON FUNCTION public.increment_credit_balance(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_charge_job_profiles(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_two_am_generation_from_jobs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credit_balance(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_charge_job_profiles(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_two_am_generation_from_jobs(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
