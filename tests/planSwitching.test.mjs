import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CREDIT_MONTH_SECONDS, PLAN_PRICE_IDS, PLAN_PRICE_MAP, prorationCreditShare, scheduledPlanChange } from "../supabase/functions/_shared/stripePlanPrices.js";

// Plan switching in the Stripe billing portal: an upgrade is charged (prorated)
// and applies at once, and its credits follow the money; a downgrade waits for
// the end of the paid period. The webhook's event handling is exercised by
// tests/stripe-webhook/simulate.ts; this file covers the two pure functions and
// the wiring in the app.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

const NOW = 1_800_000_000;
const DAY = 86400;
const monthly = PLAN_PRICE_MAP[PLAN_PRICE_IDS.pro.monthly];
const yearly = PLAN_PRICE_MAP[PLAN_PRICE_IDS.pro.yearly];
const line = (unit, amount, start = NOW) => ({ amount, quantity: 1, price: { unit_amount: unit }, period: { start } });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("monthly price: a proration line is worth the share of the price on it", () => {
  assert.deepEqual(prorationCreditShare(line(3800, 1900), monthly, NaN), { share: 0.5, monthsPaid: null });
  assert.deepEqual(prorationCreditShare(line(3800, -1900), monthly, NaN), { share: 0.5, monthsPaid: null }, "unused time counts the same, the caller applies the sign");
  near(prorationCreditShare(line(3800, 127), monthly, NaN).share, 127 / 3800); // last day
  assert.equal(prorationCreditShare(line(3800, 3800), monthly, NaN).share, 1);
  assert.equal(prorationCreditShare(line(3800, 9999), monthly, NaN).share, 1, "never more than one month");
  assert.equal(prorationCreditShare(line(0, 1900), monthly, NaN).share, 0, "no price on the line: nothing");
  assert.equal(prorationCreditShare({}, monthly, NaN).share, 0);
});

test("yearly price, a month or more of the year paid for: the rest of the current credit month", () => {
  // 9 months of the year left, top-up 10 days ago → 20 of 30 days left.
  const r = prorationCreditShare(line(38400, 28800), yearly, NOW - 10 * DAY);
  near(r.share, 20 / 30);
  near(r.monthsPaid, 9);
  near(prorationCreditShare(line(38400, 19200), yearly, NOW - 3600).share, 1 - 3600 / CREDIT_MONTH_SECONDS); // right after a top-up
  assert.equal(prorationCreditShare(line(38400, 19200), yearly, NOW - 45 * DAY).share, 0, "top-up overdue: the next one brings the new amount");
  assert.equal(prorationCreditShare(line(38400, 19200), yearly, NOW + DAY).share, 1, "never more than one month");
  assert.equal(prorationCreditShare(line(38400, 19200), yearly, NaN).share, 0, "no top-up date on record");
});

test("yearly price, less than a month paid for: exactly what the money buys, whatever the top-up date", () => {
  // 3 of 365 days: €3.16 of €384 → 0.09875 months of Pro.
  for (const lastTopup of [NOW - 3600, NOW - 29 * DAY, NaN]) {
    const r = prorationCreditShare(line(38400, 316), yearly, lastTopup);
    near(r.share, (316 / 38400) * 12);
    near(r.monthsPaid, (316 / 38400) * 12);
    assert.ok(r.share < 0.1 && r.monthsPaid < 1);
  }
  // 849 credits of difference would be owed by the calendar; the money buys 84.
  const credits = (316 / 38400) * 12 * 1600 - (148 / 18000) * 12 * 750;
  assert.equal(Math.round(credits), 84);
});

test("scheduled downgrade: the next phase of the subscription schedule", () => {
  const schedule = { phases: [
    { start_date: NOW - 10 * DAY, end_date: NOW + 20 * DAY, items: [{ price: PLAN_PRICE_IDS.pro.monthly }] },
    { start_date: NOW + 20 * DAY, end_date: NOW + 50 * DAY, items: [{ price: PLAN_PRICE_IDS.starter.monthly }] },
  ] };
  assert.deepEqual(scheduledPlanChange(schedule, PLAN_PRICE_IDS.pro.monthly, NOW), { plan: "starter", interval: "month", price_id: PLAN_PRICE_IDS.starter.monthly, date: NOW + 20 * DAY });
  // yearly → monthly of the same plan
  const toMonthly = { phases: [{ start_date: NOW - DAY, items: [{ price: { id: PLAN_PRICE_IDS.pro.yearly } }] }, { start_date: NOW + 100 * DAY, items: [{ price: { id: PLAN_PRICE_IDS.pro.monthly } }] }] };
  assert.deepEqual(scheduledPlanChange(toMonthly, PLAN_PRICE_IDS.pro.yearly, NOW), { plan: "pro", interval: "month", price_id: PLAN_PRICE_IDS.pro.monthly, date: NOW + 100 * DAY });
  assert.equal(scheduledPlanChange({ phases: [schedule.phases[0]] }, PLAN_PRICE_IDS.pro.monthly, NOW), null, "no later phase");
  assert.equal(scheduledPlanChange({ phases: [schedule.phases[0], { start_date: NOW + 20 * DAY, items: [{ price: PLAN_PRICE_IDS.pro.monthly }] }] }, PLAN_PRICE_IDS.pro.monthly, NOW), null, "the next phase keeps the price");
  assert.equal(scheduledPlanChange(null, PLAN_PRICE_IDS.pro.monthly, NOW), null);
  assert.equal(scheduledPlanChange({ phases: [{ start_date: NOW + DAY, items: [{ price: "price_unknown" }] }] }, "x", NOW).plan, null);
});

test("webhook: proration lines count, one grant per invoice, plan-change payment failures are not past due", () => {
  const src = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(src, /changeCredits \+= Math\.sign\(amount\) \* share \* perMonth;/);
  assert.match(src, /const credits = Math\.max\(0, Math\.round\(planCredits \+ changeCredits\)\);/);
  assert.match(src, /grantCreditsOnce\(userId, credits, hasProration \? "plan_upgrade" : "plan_renewal", inv\.id\)/, "keyed by the invoice id");
  assert.match(src, /raiseTopupNow: monthsPaid == null \|\| monthsPaid >= 1/);
  assert.match(src, /else if \(changedTo\?\.yearly && changedTo\.raiseTopupNow\)/);
  assert.match(src, /const isPlanChange = inv\?\.billing_reason === "subscription_update";/);
  assert.match(src, /subId === profile\.stripe_subscription_id && !isPlanChange/);
  // The subscription handlers are untouched: the plan follows an active subscription's price.
  assert.match(src, /if \(paysForPlan\) \{\s*await updateProfile\(profile\.id, livePlanPatch\(sub\)/);
});

test("app: subscribers switch in the portal, past-due accounts fix the card first, the page shows a scheduled change", () => {
  const cards = read("src/components/pricing/PlanCards.jsx");
  assert.match(cards, /if \(account\.pastDue\) \{[\s\S]{0,260}openBillingPortal\(\{ flow: "payment_method", returnPath: "\/pricing\?from=portal" \}\)/);
  assert.match(cards, /openBillingPortal\(\{ flow: "change_plan", returnPath: "\/pricing\?from=portal" \}\)/);
  assert.ok(cards.indexOf("if (account.pastDue)") < cards.indexOf("if (account.hasSub)"), "the card comes before the plan change");
  assert.match(cards, /Switching here on \$\{formatPlanDate\(scheduled\.date\)\}/);
  assert.match(cards, /Current plan until \$\{formatPlanDate\(scheduled\.date\)\}/);
  const page = read("src/pages/Pricing.jsx");
  assert.match(page, /data-testid="scheduled-change"/);
  assert.match(page, /You keep \{current\} until then\./);
  assert.match(page, /<ScheduledChangeNotice \/>\s*<PlanCards/);
  const data = read("src/components/pricing/PricingData.jsx");
  assert.match(data, /supabase\.functions\.invoke\("billing-summary"/);
  assert.match(data, /searchParams\.get\("from"\) !== "portal"/);
  assert.match(read("src/hooks/usePlanCode.js"), /export default function usePlanCode\(refresh = 0\)/);
  const summary = read("supabase/functions/billing-summary/index.ts");
  assert.match(summary, /scheduledPlanChange\(schedule, plan\.price_id/);
  assert.match(summary, /return json\(req, \{ plan, scheduled_change, payment_method, invoices \}\);/);
  assert.match(read("src/pages/settings/Billing.jsx"), /data-testid="billing-scheduled-change"/);
  // /settings?tab=billing really opens the billing tab: nothing resets the tab after the first render.
  const settings = read("src/pages/settings/WorkspaceSettings.jsx");
  assert.ok(settings.includes('get("tab") === "billing" ? "billing" : "account"'));
  assert.ok(!settings.includes('useEffect(() => setActive("account"), [])'), "an effect that resets the tab on load would undo ?tab=billing");
  // The portal function already accepts the return path with its query.
  assert.match(read("supabase/functions/create-portal-session/index.ts"), /const RETURN_PATHS = \["\/settings", "\/pricing", "\/"\];/);
});
