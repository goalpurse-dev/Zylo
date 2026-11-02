-- Rollback of 20261128100000. This reopens the holes it closed: use only if the fix broke something, and fix forward
-- as soon as possible. Better first: grant the one missing column, instead of running all of this.
BEGIN;
CREATE POLICY profiles_read_all ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credit_balance(uuid, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(uuid, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_charge_job_profiles(uuid, uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_two_am_generation_from_jobs(uuid) TO PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
