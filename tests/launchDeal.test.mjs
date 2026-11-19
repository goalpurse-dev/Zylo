import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAUNCH_DEAL, LAUNCH_DEAL_EMAIL_LINE, launchDealCheckoutExpiry, launchDealFor, launchDealLive, launchDealMsLeft, launchDealPrice,
} from "../supabase/functions/_shared/launchDeal.js";

// The In This Town launch deal (owner, 2026-11-19): Starter 20% off the first month, new paying customers only,
// automatic at checkout, until Sunday 22 Nov 23:59 Finnish time, checked on the server, off by itself after.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("the window: Thursday 19 Nov 00:00 to Sunday 22 Nov 23:59:59 in Helsinki", () => {
  assert.equal(LAUNCH_DEAL.percentOff, 20);
  assert.equal(LAUNCH_DEAL.plan, "starter");
  assert.equal(LAUNCH_DEAL.billing, "monthly");
  assert.equal(new Date(LAUNCH_DEAL.endsAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki" }), "22/11/2026, 23:59:59");
  assert.equal(new Date(LAUNCH_DEAL.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki" }), "19/11/2026, 00:00:00");
  assert.equal(launchDealLive("2026-11-19T13:00:00Z"), true, "Thursday's send");
  assert.equal(launchDealLive("2026-11-22T21:59:59Z"), true, "Sunday 23:59:59 Finnish: still on");
  assert.equal(launchDealLive("2026-11-22T22:00:00Z"), false, "Monday 00:00 Finnish: over");
  assert.equal(launchDealLive("2026-11-18T21:59:59Z"), false, "before it starts");
  assert.equal(launchDealMsLeft("2026-11-22T22:00:00Z"), 0);
  assert.equal(launchDealMsLeft("2026-11-22T21:00:00Z"), 3599999);
});

test("the price: 20% off, €18 → €14.40, in euros and in cents", () => {
  assert.equal(launchDealPrice(18), 14.4);
  assert.equal(launchDealPrice(1800), 1440);
  assert.equal(launchDealPrice(15), 12);
});

test("who gets it: Starter monthly, never paid, inside the window; never on a failed check", () => {
  const thu = "2026-11-19T13:00:00Z";
  assert.equal(launchDealFor({ plan: "starter", billing: "monthly", at: thu, paidBefore: false }).apply, true);
  assert.match(launchDealFor({ plan: "starter", billing: "monthly", at: thu, paidBefore: true }).why, /paid before/);
  assert.match(launchDealFor({ plan: "starter", billing: "monthly", at: thu, paidBefore: null }).why, /could not check/, "new customers only, even when Stripe is down");
  assert.match(launchDealFor({ plan: "starter", billing: "yearly", at: thu, paidBefore: false }).why, /not Starter monthly/, "the first month: monthly only");
  assert.match(launchDealFor({ plan: "pro", billing: "monthly", at: thu, paidBefore: false }).why, /not Starter monthly/);
  assert.match(launchDealFor({ plan: "starter", billing: "monthly", at: "2026-11-22T22:00:01Z", paidBefore: false }).why, /outside/, "after Sunday 23:59");
});

test("an open checkout with the deal stops at the end (Stripe's 30 min floor, 24 h ceiling)", () => {
  const end = Date.parse("2026-11-22T22:00:00Z") / 1000;
  assert.equal(launchDealCheckoutExpiry("2026-11-22T12:00:00Z"), end, "a few hours before: ends with the deal");
  const late = Date.parse("2026-11-22T21:50:00Z") / 1000;
  assert.equal(launchDealCheckoutExpiry("2026-11-22T21:50:00Z"), late + 31 * 60, "in the last half hour: Stripe's minimum");
  const thu = Date.parse("2026-11-19T13:00:00Z") / 1000;
  assert.equal(launchDealCheckoutExpiry("2026-11-19T13:00:00Z"), thu + 23 * 3600, "days before: under Stripe's 24 h");
});

test("checkout: the server adds the coupon (never the browser), drops the code box, falls back to normal checkout", () => {
  const src = read("supabase/functions/create-checkout-session/index.ts");
  assert.match(src, /from "\.\.\/_shared\/launchDeal\.js"/);
  assert.match(src, /const \{ type, priceId, pack, successUrl, cancelUrl \} = await req\.json\(\)/, "the browser can't ask for a discount");
  assert.match(src, /body\.delete\("allow_promotion_codes"\);\s+body\.set\("discounts\[0\]\[coupon\]", LAUNCH_DEAL\.coupon\);/);
  assert.match(src, /launchDealFor\(\{ plan: sold\.plan, billing: sold\.billing, paidBefore: before \}\)\.apply/);
  assert.match(src, /\/v1\/customers\?email=/, "any Stripe customer with the same email counts as paid before");
  assert.match(src, /ch\?\.paid && ch\?\.status === "succeeded"/);
  assert.match(src, /launch deal coupon refused, normal checkout/);
  assert.match(src, /"metadata\[deal\]", LAUNCH_DEAL\.id/, "counted afterwards");
});

test("pages: the pricing banner, Starter's old and new price, the In This Town bar, the upgrade popup", () => {
  assert.match(read("src/pages/Pricing.jsx"), /!account\.hasSub && !account\.isPaid && <LaunchDealBanner \/>/);
  const cards = read("src/components/pricing/PlanCards.jsx");
  assert.match(cards, /planId === LAUNCH_DEAL\.plan && billing === LAUNCH_DEAL\.billing && launchDealForViewer\(deal, account\)/);
  assert.match(cards, /line-through[^>]*aria-label=\{`Normal price/);
  assert.match(read("src/pages/workspace/BlockyWorlds.jsx"), /\(access === "guest" \|\| access === "free"\) && <LaunchDealBar/);
  assert.match(read("src/components/viral-tools/face-asmr/FaceAsmrPaywall.jsx"), /deal\.live && tier\.id === LAUNCH_DEAL\.plan && billing === LAUNCH_DEAL\.billing/);
  assert.match(read("src/lib/useLaunchDeal.js"), /useState\(0\)/, "starts off: prerendered HTML never carries the deal");
  assert.equal(LAUNCH_DEAL_EMAIL_LINE, "Launch deal: Starter is 20% off your first month, until Sunday.");
});
