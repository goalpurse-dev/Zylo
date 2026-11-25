# Affiliate program — setup and testing

Branch `affiliate` (folder `C:\Users\Public\Zylo-affiliate`). Not on laptop-transfer or main.

## Where things are
- Rules (rates, 30-day hold, €25 minimum, 30 sign-up credits, reserved words…): `supabase/functions/_shared/affiliate/config.js`
- Database: `supabase/migrations/20261217100000_affiliate_program.sql` (rollback in `supabase/rollbacks/`)
- API: `supabase/functions/affiliate-api` (logic in `_shared/affiliate/api.js`)
- Payment hook: `supabase/functions/stripe-webhook/index.ts` (first payment → commission; `charge.refunded` / `charge.dispute.created` → reversed)
- Pages: `/affiliate` (src/pages/workspace/affiliate), `/admin/affiliates` (src/pages/admin/Affiliates.jsx)
- Survey step: `src/components/onboarding/CreatorCodeStep.jsx`; link capture: `src/lib/affiliate.js`

## Owner steps before it works
1. Run the migration `20261217100000_affiliate_program.sql` (it also schedules the daily 06:15 UTC release job if pg_cron is on; the page releases on every visit anyway).
2. Deploy `affiliate-api` (new) and `stripe-webhook` (changed). Diff live `stripe-webhook` against this branch first: live has drifted before.
3. Stripe Dashboard → the webhook endpoint → add events `charge.refunded` and `charge.dispute.created`.
4. Optional: secret `AFFILIATE_IP_SALT` (any random string). Without it the IP hash uses a key derived from the service key.
5. `ADMIN_EMAILS` (already set for the Content Machine) decides who sees /admin/affiliates.

Order matters only one way: a webhook deployed before the migration just skips the affiliate step.

## Testing on the preview (no real money)
1. Account A opens /affiliate → "Get my code" → copy code / link.
2. Account B (new, in a private window) opens the link or types the code in the survey (or on /affiliate, "Did a creator send you?") → 30 credits.
3. /admin/affiliates → Test tools → B's email, €38, pro → "Simulate payment" → A's page shows €7.60 pending.
4. Table → A → Edit → "Test: skip 30 days" → available. Repeat with more referred accounts until ≥ €25 → Payout queue → "Mark as paid".
5. Refund: another referred account → Simulate payment → Simulate refund → reversed.
6. Self-referral: A types their own code → refused. Same IP as A → listed under Flagged.
Test rows are marked `is_test` in `commissions`.

## Offline checks (free)
- `node --import ./tests/setup.mjs --test tests/affiliate.test.mjs`
- `npx -y deno@2.9.6 run --allow-env --allow-read --no-check --no-lock --no-config --import-map=tests/stripe-webhook/import_map.json tests/stripe-webhook/simulate.ts` (section 15)
- `scripts/affiliate/e2e.mjs`: the real API + real SQL in an in-memory Postgres (instructions in the file).
