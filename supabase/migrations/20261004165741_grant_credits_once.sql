-- Stripe webhook: credit grants that are safe to run twice.
--
-- The webhook now records an event as processed only after its handler
-- succeeded, so Stripe's retries really run. Every grant therefore has to be
-- idempotent AND all-or-nothing:
--   1. credit_grants.external_id is unique (invoice id, checkout session id,
--      annual_<user>_<YYYY_MM>): a second grant for the same id is refused.
--   2. grant_credits_once writes the ledger row and the balance in ONE
--      transaction. Before this, the row was inserted first and the balance
--      updated in a second call; if that second call failed, the retry saw the
--      row and skipped the credits for good.
--
-- Apply BEFORE deploying the new stripe-webhook. (If the webhook is deployed
-- first, paid events answer 500 and Stripe retries them until this is applied;
-- nothing is lost.)

-- 1. Unique external ids. A no-op if the constraint already exists under its
--    default name (credit_grants_external_id_key). Checked 2026-10-04: 646 rows,
--    no duplicate and no empty external_id, so this cannot fail on existing data.
CREATE UNIQUE INDEX IF NOT EXISTS credit_grants_external_id_key
  ON public.credit_grants (external_id);

-- 2. The grant itself. Returns true when the credits were added, false when
--    this external id was already granted. A missing profile raises, which
--    rolls the ledger row back too.
CREATE OR REPLACE FUNCTION public.grant_credits_once(
  p_user_id     uuid,
  p_amount      integer,
  p_reason      text,
  p_external_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'grant_credits_once: amount must be positive';
  END IF;
  IF p_external_id IS NULL OR p_external_id = '' THEN
    RAISE EXCEPTION 'grant_credits_once: external_id is required';
  END IF;

  BEGIN
    INSERT INTO public.credit_grants (user_id, reason, amount, external_id)
    VALUES (p_user_id, p_reason, p_amount, p_external_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;

  UPDATE public.profiles
  SET    credit_balance = COALESCE(credit_balance, 0) + p_amount
  WHERE  id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant_credits_once: no profile %', p_user_id;
  END IF;

  RETURN true;
END;
$$;

-- Server only: the webhook calls it with the service role.
REVOKE ALL ON FUNCTION public.grant_credits_once(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits_once(uuid, integer, text, text) TO service_role;
