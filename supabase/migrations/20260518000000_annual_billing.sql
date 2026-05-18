-- ============================================================
-- Annual billing support
-- ============================================================

-- 1. Add annual tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_interval         TEXT         DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS annual_credits_per_month INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_credits_last_topup TIMESTAMPTZ DEFAULT NULL;

-- 2. Function that runs daily and tops up annual subscribers
--    Idempotent: uses credit_grants.external_id unique constraint
--    so double-firing the cron on the same month is a no-op.
CREATE OR REPLACE FUNCTION topup_annual_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec       RECORD;
  grant_id  UUID;
BEGIN
  FOR rec IN
    SELECT id, annual_credits_per_month
    FROM   profiles
    WHERE  billing_interval          = 'yearly'
      AND  plan_code                IN ('starter', 'pro', 'generative')
      AND  stripe_subscription_status IN ('active', 'paid')
      AND  annual_credits_per_month  > 0
      -- 29 days to avoid drift from rounding
      AND  (
        annual_credits_last_topup IS NULL
        OR annual_credits_last_topup <= NOW() - INTERVAL '29 days'
      )
  LOOP
    BEGIN
      -- Insert grant row (unique per user + month, prevents double-grant)
      INSERT INTO credit_grants (user_id, reason, amount, external_id)
      VALUES (
        rec.id,
        'annual_monthly_topup',
        rec.annual_credits_per_month,
        'annual_' || rec.id::text || '_' || TO_CHAR(NOW(), 'YYYY_MM')
      )
      RETURNING id INTO grant_id;

      -- Only touch balance if the row was actually inserted
      IF grant_id IS NOT NULL THEN
        UPDATE profiles
        SET
          credit_balance            = credit_balance + rec.annual_credits_per_month,
          annual_credits_last_topup = NOW()
        WHERE id = rec.id;
      END IF;

    EXCEPTION WHEN unique_violation THEN
      -- Already topped up this month — skip silently
      NULL;
    END;
  END LOOP;
END;
$$;

-- 3. Schedule the function to run every day at 06:00 UTC
--    pg_cron is enabled on all Supabase projects by default.
SELECT cron.schedule(
  'annual-monthly-credit-topup',   -- job name (must be unique)
  '0 6 * * *',                     -- every day at 06:00 UTC
  'SELECT topup_annual_credits()'
);
