-- Yearly plans: the monthly credit top-up, which has never worked.
--
-- THE BUG. topup_annual_credits() (20260518000000_annual_billing.sql) declared
-- `grant_id UUID` and ran `INSERT INTO credit_grants ... RETURNING id INTO
-- grant_id`. credit_grants.id is a bigint, so the first insert of every run
-- failed with `invalid input syntax for type uuid: "747"`. The function only
-- caught unique_violation, so that error ended the whole run: every day, for
-- everyone. No yearly subscriber ever got a monthly top-up.
--
-- THE FIX.
--   * Each subscriber is handled in their own block: an error for one is
--     written to annual_topup_failures and the run goes on to the next.
--   * Credits go through grant_credits_once (ledger row + balance in one
--     transaction) with the key annual_<user>_<YYYY_MM>: running the job twice,
--     or backfilling a month by hand with the same key, can never grant a month
--     twice.
--   * The months are counted from the paid year itself (current_period_end
--     minus one year), not from "29 days since the last top-up": month 0 is
--     paid with the yearly invoice (the webhook's plan_renewal grant), months
--     1..11 fall due on the same day of each following month. That is exactly
--     12 months of credits per paid year (the old rule would have given 13),
--     and only inside the paid period.
--   * The amount is profiles.annual_credits_per_month as the Stripe webhook
--     keeps it: the plan's amount (legacy 600 / 1,200 / 2,500 included), the
--     new tier after a mid-year upgrade, and the old tier during the last month
--     of the year when an upgrade is capped until the renewal is paid.
--   * annual_credits_last_topup is set to the month's due date: the webhook's
--     upgrade formula reads it as the start of the current credit month.
--
-- Each run grants the CURRENT credit month only. Months missed while the job
-- was broken are backfilled by hand with the same keys (reviewed separately).
--
-- The existing pg_cron job ('annual-monthly-credit-topup', daily 06:00 UTC,
-- `SELECT topup_annual_credits()`) keeps working unchanged: it now calls this
-- function with its default argument.
--
-- Needs grant_credits_once (20261004165741_grant_credits_once.sql).

-- Failures, one row per subscriber per failed run. Server only.
CREATE TABLE IF NOT EXISTS public.annual_topup_failures (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid,
  external_id text,   -- the month's key, when the failure happened at the grant
  sqlstate    text,
  error       text NOT NULL
);
ALTER TABLE public.annual_topup_failures ENABLE ROW LEVEL SECURITY;

-- The return type changes (void → jsonb), so the old function is dropped first.
DROP FUNCTION IF EXISTS public.topup_annual_credits();

-- p_now: the time of the run. Only tests pass another time.
-- Returns { checked, granted, already_granted, skipped, failed }.
CREATE OR REPLACE FUNCTION public.topup_annual_credits(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'UTC'
AS $$
DECLARE
  rec        record;
  v_start    timestamptz;  -- start of the paid year
  v_month    integer;      -- 1..11: the credit month that is current at p_now
  v_due      timestamptz;  -- when that month fell due
  v_key      text;
  v_checked  integer := 0;
  v_granted  integer := 0;
  v_already  integer := 0;
  v_skipped  integer := 0;
  v_failed   integer := 0;
  v_state    text;
  v_message  text;
BEGIN
  FOR rec IN
    SELECT id, plan_code, stripe_subscription_id, stripe_subscription_status,
           annual_credits_per_month, current_period_end
    FROM   public.profiles
    WHERE  billing_interval = 'yearly'
    ORDER  BY id
  LOOP
    v_checked := v_checked + 1;
    v_key := NULL;
    BEGIN
      -- Not owed a top-up: no paid plan, no live subscription (canceled, unpaid,
      -- past due), or no monthly amount.
      IF rec.plan_code IS NULL OR rec.plan_code NOT IN ('starter', 'pro', 'generative')
         OR rec.stripe_subscription_id IS NULL
         OR rec.stripe_subscription_status IS NULL
         OR rec.stripe_subscription_status NOT IN ('active', 'paid', 'trialing')
         OR COALESCE(rec.annual_credits_per_month, 0) <= 0 THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF rec.current_period_end IS NULL THEN
        RAISE EXCEPTION 'yearly subscriber without current_period_end: the paid year is unknown';
      END IF;

      -- The paid year is over: the renewal invoice starts the next one.
      IF rec.current_period_end <= p_now THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_start := rec.current_period_end - interval '1 year';
      SELECT max(k) INTO v_month
      FROM   generate_series(1, 11) AS k
      WHERE  v_start + make_interval(months => k) <= p_now;

      -- Still in the first month, which the yearly invoice paid for.
      IF v_month IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_due := v_start + make_interval(months => v_month);
      v_key := 'annual_' || rec.id::text || '_' || to_char(v_due, 'YYYY_MM');

      IF public.grant_credits_once(rec.id, rec.annual_credits_per_month, 'annual_monthly_topup', v_key) THEN
        v_granted := v_granted + 1;
      ELSE
        v_already := v_already + 1;
      END IF;

      -- The start of the current credit month (never moved backwards).
      UPDATE public.profiles
      SET    annual_credits_last_topup = v_due
      WHERE  id = rec.id
        AND  (annual_credits_last_topup IS NULL OR annual_credits_last_topup < v_due);
    EXCEPTION WHEN OTHERS THEN
      -- This subscriber's grant is rolled back; everyone else still gets theirs.
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
      v_failed := v_failed + 1;
      INSERT INTO public.annual_topup_failures (user_id, external_id, sqlstate, error)
      VALUES (rec.id, v_key, v_state, v_message);
      RAISE WARNING 'topup_annual_credits: user % failed (%): %', rec.id, v_state, v_message;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'checked', v_checked, 'granted', v_granted, 'already_granted', v_already,
    'skipped', v_skipped, 'failed', v_failed
  );
END;
$$;

-- Server only: pg_cron runs it as the database owner.
REVOKE ALL ON FUNCTION public.topup_annual_credits(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.topup_annual_credits(timestamptz) TO service_role;
