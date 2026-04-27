-- Migration: update deduct_credits to also track credits_spent_today
--
-- All credit deductions in the app go through this single RPC.
-- Adding credits_spent_today here means every call site (image gen,
-- video gen, script gen, product photo, image-to-script) is fixed
-- atomically with no changes required in calling code.
--
-- Safety guarantees preserved:
--   • Both columns updated in one UPDATE — no drift between them
--   • credit_balance >= amount guard still raises INSUFFICIENT_CREDITS
--   • SECURITY DEFINER so the function can bypass RLS on profiles

CREATE OR REPLACE FUNCTION public.deduct_credits(uid uuid, amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    credit_balance      = credit_balance - amount,
    credits_spent_today = credits_spent_today + amount
  WHERE id = uid
    AND credit_balance >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;
END;
$$;
