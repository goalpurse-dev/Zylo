-- NOT A MIGRATION. Run by hand in the SQL editor, once, after review.
--
-- Backfill of the monthly credits the 6 yearly subscribers never received
-- (the top-up job failed on every run, see
-- migrations/20261004201455_annual_topup_fix.sql).
--
-- Source: Stripe, read 2026-10-04 17:13 UTC. All six subscriptions are active
-- and inside their first paid year. Each got month 0 with the yearly invoice
-- (the webhook's plan_renewal grant) and nothing since. A month is owed when
-- its due date (period start + k months) is past and inside the paid period.
--
--   user      plan     paid period              per month  owed months            credits
--   5d598d4d  Starter  2026-06-01 → 2027-06-01     600     Jul Aug Sep Oct  (4)     2,400
--   550ee7ed  Pro      2026-06-07 → 2027-06-07   1,200     Jul Aug Sep      (3)     3,600
--   f01f21bd  Starter  2026-07-03 → 2027-07-03     600     Aug Sep Oct      (3)     1,800
--   7b60f3a8  Pro      2026-07-03 → 2027-07-03   1,200     Aug Sep Oct      (3)     3,600
--   490e4f3e  Starter  2026-07-06 → 2027-07-06     600     Aug Sep          (2)     1,200
--   f81f4464  Starter  2026-07-23 → 2027-07-23     600     Aug Sep          (2)     1,200
--                                                                          17      13,800
--
-- Safe to run twice, and safe next to the fixed job: every grant goes through
-- grant_credits_once with the job's own key (annual_<user>_<YYYY_MM>), so a
-- month that is already granted returns granted = false and adds nothing.
-- Needs grant_credits_once (20261004165741_grant_credits_once.sql).
--
-- Months that fall due after 2026-10-04 (550ee7ed on 7 Oct, 490e4f3e on 6 Oct,
-- …) are not in here: the fixed job grants them.

-- 1. The grants. One row per month, with granted = true when the credits were added.
SELECT b.user_id, b.month_key, b.amount,
       public.grant_credits_once(b.user_id, b.amount, 'annual_monthly_topup', b.month_key) AS granted
FROM (VALUES
  -- 5d598d4d  Starter, started 2026-06-01 01:50:05 UTC
  ('5d598d4d-f63b-4784-81d2-0c83bff83897'::uuid,  600, 'annual_5d598d4d-f63b-4784-81d2-0c83bff83897_2026_07'),
  ('5d598d4d-f63b-4784-81d2-0c83bff83897'::uuid,  600, 'annual_5d598d4d-f63b-4784-81d2-0c83bff83897_2026_08'),
  ('5d598d4d-f63b-4784-81d2-0c83bff83897'::uuid,  600, 'annual_5d598d4d-f63b-4784-81d2-0c83bff83897_2026_09'),
  ('5d598d4d-f63b-4784-81d2-0c83bff83897'::uuid,  600, 'annual_5d598d4d-f63b-4784-81d2-0c83bff83897_2026_10'),
  -- 550ee7ed  Pro, started 2026-06-07 06:55:22 UTC
  ('550ee7ed-2c72-4578-8a9a-7c61cd645307'::uuid, 1200, 'annual_550ee7ed-2c72-4578-8a9a-7c61cd645307_2026_07'),
  ('550ee7ed-2c72-4578-8a9a-7c61cd645307'::uuid, 1200, 'annual_550ee7ed-2c72-4578-8a9a-7c61cd645307_2026_08'),
  ('550ee7ed-2c72-4578-8a9a-7c61cd645307'::uuid, 1200, 'annual_550ee7ed-2c72-4578-8a9a-7c61cd645307_2026_09'),
  -- f01f21bd  Starter, started 2026-07-03 14:23:59 UTC
  ('f01f21bd-b4a3-4476-88b1-96c5492c00d0'::uuid,  600, 'annual_f01f21bd-b4a3-4476-88b1-96c5492c00d0_2026_08'),
  ('f01f21bd-b4a3-4476-88b1-96c5492c00d0'::uuid,  600, 'annual_f01f21bd-b4a3-4476-88b1-96c5492c00d0_2026_09'),
  ('f01f21bd-b4a3-4476-88b1-96c5492c00d0'::uuid,  600, 'annual_f01f21bd-b4a3-4476-88b1-96c5492c00d0_2026_10'),
  -- 7b60f3a8  Pro, started 2026-07-03 20:31:53 UTC
  ('7b60f3a8-a99e-4072-a5bc-841f80d24e58'::uuid, 1200, 'annual_7b60f3a8-a99e-4072-a5bc-841f80d24e58_2026_08'),
  ('7b60f3a8-a99e-4072-a5bc-841f80d24e58'::uuid, 1200, 'annual_7b60f3a8-a99e-4072-a5bc-841f80d24e58_2026_09'),
  ('7b60f3a8-a99e-4072-a5bc-841f80d24e58'::uuid, 1200, 'annual_7b60f3a8-a99e-4072-a5bc-841f80d24e58_2026_10'),
  -- 490e4f3e  Starter, started 2026-07-06 04:31:24 UTC
  ('490e4f3e-8e9b-4377-81a7-9a77b9918911'::uuid,  600, 'annual_490e4f3e-8e9b-4377-81a7-9a77b9918911_2026_08'),
  ('490e4f3e-8e9b-4377-81a7-9a77b9918911'::uuid,  600, 'annual_490e4f3e-8e9b-4377-81a7-9a77b9918911_2026_09'),
  -- f81f4464  Starter, started 2026-07-23 14:26:08 UTC
  ('f81f4464-3a55-4e03-9a28-dfd08d0a0a9c'::uuid,  600, 'annual_f81f4464-3a55-4e03-9a28-dfd08d0a0a9c_2026_08'),
  ('f81f4464-3a55-4e03-9a28-dfd08d0a0a9c'::uuid,  600, 'annual_f81f4464-3a55-4e03-9a28-dfd08d0a0a9c_2026_09')
) AS b(user_id, amount, month_key);

-- 2. The paid year and the start of the current credit month on each profile,
--    from Stripe: the fixed job counts its months from current_period_end, and
--    the upgrade formula reads annual_credits_last_topup. The top-up date is
--    never moved backwards. Returns the rows it touched.
UPDATE public.profiles AS p
SET    current_period_end        = v.period_end,
       annual_credits_last_topup = GREATEST(COALESCE(p.annual_credits_last_topup, v.last_due), v.last_due)
FROM (VALUES
  ('5d598d4d-f63b-4784-81d2-0c83bff83897'::uuid, '2027-06-01 01:50:05+00'::timestamptz, '2026-10-01 01:50:05+00'::timestamptz),
  ('550ee7ed-2c72-4578-8a9a-7c61cd645307'::uuid, '2027-06-07 06:55:22+00'::timestamptz, '2026-09-07 06:55:22+00'::timestamptz),
  ('f01f21bd-b4a3-4476-88b1-96c5492c00d0'::uuid, '2027-07-03 14:23:59+00'::timestamptz, '2026-10-03 14:23:59+00'::timestamptz),
  ('7b60f3a8-a99e-4072-a5bc-841f80d24e58'::uuid, '2027-07-03 20:31:53+00'::timestamptz, '2026-10-03 20:31:53+00'::timestamptz),
  ('490e4f3e-8e9b-4377-81a7-9a77b9918911'::uuid, '2027-07-06 04:31:24+00'::timestamptz, '2026-09-06 04:31:24+00'::timestamptz),
  ('f81f4464-3a55-4e03-9a28-dfd08d0a0a9c'::uuid, '2027-07-23 14:26:08+00'::timestamptz, '2026-09-23 14:26:08+00'::timestamptz)
) AS v(user_id, period_end, last_due)
WHERE  p.id = v.user_id
RETURNING p.id, p.plan_code, p.credit_balance, p.annual_credits_per_month, p.current_period_end, p.annual_credits_last_topup;
