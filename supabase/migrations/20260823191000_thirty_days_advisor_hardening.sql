-- Clear direct default grants left on the original voice/service RPCs.
-- Reservation calls are owned-user actions; release calls are worker-only.
REVOKE ALL ON FUNCTION public.reserve_thirty_days_service_request(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_thirty_days_service_request(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_thirty_days_voice_generation(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_thirty_days_voice_generation(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_thirty_days_service_request(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_service_request(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_thirty_days_voice_generation(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_voice_generation(uuid)
  TO service_role;

-- Evaluate auth.uid() once per statement instead of once per candidate row.
DROP POLICY IF EXISTS "Users read own 30 Days generations"
  ON public.thirty_days_generations;
CREATE POLICY "Users read own 30 Days generations"
  ON public.thirty_days_generations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own 30 Days generations"
  ON public.thirty_days_generations;
CREATE POLICY "Users update own 30 Days generations"
  ON public.thirty_days_generations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS thirty_days_credit_ledger_user
  ON public.thirty_days_credit_ledger (user_id);
