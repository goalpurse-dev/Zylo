// Pricing page: live Stripe prices, credits, Long Form counts, plan finder and
// honest copy (offline; sample data mirrors today's Stripe + tool_prices).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLAN_CREDITS, TOPUP_CREDITS, PLAN_PRICE_IDS, TOPUP_PRICE_IDS, summarizeStripePrices, vatIncluded,
  PLAN_PRICE_MAP, EARLY_PLAN_CREDITS, NEW_GRANT_CUTOFF, planCreditsFor,
} from "../supabase/functions/_shared/stripePlanPrices.js";
import {
  formatMoney, planPriceView, maxSavingPercent, tiersFromRows, longFormOutputs, bestLongFormTier, allowedLongFormTiers,
  recommendPlan, LONG_FORM_LENGTHS, defaultLongFormTier,
} from "../src/lib/pricingMath.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Stripe today (EUR, VAT inclusive by currency).
const STRIPE = { starter: [18, 180], pro: [38, 384], generative: [78, 780] };
function stripeById() {
  const byId = {};
  for (const [plan, [m, y]] of Object.entries(STRIPE)) {
    byId[PLAN_PRICE_IDS[plan].monthly] = { id: PLAN_PRICE_IDS[plan].monthly, active: true, unit_amount: m * 100, currency: "eur", tax_behavior: "unspecified", recurring: { interval: "month" } };
    byId[PLAN_PRICE_IDS[plan].yearly] = { id: PLAN_PRICE_IDS[plan].yearly, active: true, unit_amount: y * 100, currency: "eur", tax_behavior: "unspecified", recurring: { interval: "year" } };
  }
  for (const [pack, cents] of Object.entries({ mini: 699, standard: 1199, max: 1999 })) {
    byId[TOPUP_PRICE_IDS[pack]] = { id: TOPUP_PRICE_IDS[pack], active: true, unit_amount: cents, currency: "eur", tax_behavior: "unspecified" };
  }
  return byId;
}
const PRICES = summarizeStripePrices(stripeById(), "inferred_by_currency");
const LF_ROWS = [
  { tool_key: "longform:v2", flat_credits: 25, min_plan: "starter" },
  { tool_key: "longform:v3", flat_credits: 75, min_plan: "pro" },
  { tool_key: "longform:v4", flat_credits: 110, min_plan: "generative" },
];

test("the webhook grants the page promise (750 / 1,600 / 3,200) to new subscriptions; earlier ones keep theirs", () => {
  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  assert.ok(webhook.includes('import { PLAN_PRICE_MAP, planCreditsFor } from "../_shared/stripePlanPrices.js"'));
  assert.ok(webhook.includes("planCredits += planCreditsFor(map, subStart)"));
  assert.doesNotMatch(webhook, /"price_1Tm/, "no second copy of the price map in the webhook");
  assert.deepEqual(PLAN_CREDITS, { starter: 750, pro: 1600, generative: 3200 });
  const cutoff = Date.parse(NEW_GRANT_CUTOFF) / 1000;
  for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
    for (const id of [ids.monthly, ids.yearly]) {
      const entry = PLAN_PRICE_MAP[id];
      assert.equal(entry.plan, plan);
      assert.equal(planCreditsFor(entry, cutoff + 60), PLAN_CREDITS[plan], `${plan}: new subscription gets the page amount`);
      assert.equal(planCreditsFor(entry, cutoff - 86400), EARLY_PLAN_CREDITS[plan], `${plan}: earlier subscription keeps its grant`);
      assert.equal(planCreditsFor(entry, undefined), PLAN_CREDITS[plan]);
    }
  }
  assert.equal(PLAN_PRICE_MAP.price_1TYWNYHtn4q5rIncWMa3mmvI.credits, 600, "legacy prices keep 600 / 1,200 / 2,500");
  assert.equal(planCreditsFor(PLAN_PRICE_MAP.price_1TGKSSHtn4q5rIncSTurqkCN, 0), 2500);
  for (const [pack, id] of Object.entries(TOPUP_PRICE_IDS)) {
    assert.ok(webhook.includes(`"${id}": ${TOPUP_CREDITS[pack]},`), `${pack} pack credits`);
  }
  // Checkout sells from the same shared map (no second copy of the ids).
  const checkout = read("supabase/functions/create-checkout-session/index.ts");
  assert.ok(checkout.includes('import { PLAN_PRICE_IDS, TOPUP_PRICE_IDS } from "../_shared/stripePlanPrices.js"'), "checkout sells the same packs and plans");
  assert.doesNotMatch(checkout, /price_1/, "no price id typed into checkout");
});

test("Stripe prices → € amounts, VAT included (EUR under inferred_by_currency), credits attached", () => {
  assert.equal(PRICES.currency, "eur");
  assert.equal(PRICES.vatIncluded, true);
  assert.deepEqual(PRICES.plans.starter, { monthly: 18, yearly: 180, credits: 750 });
  assert.deepEqual(PRICES.topups.mini, { price: 6.99, credits: 300 });
  assert.equal(vatIncluded({ currency: "usd", tax_behavior: "unspecified" }, "inferred_by_currency"), false);
  assert.equal(vatIncluded({ currency: "eur", tax_behavior: "exclusive" }, "inferred_by_currency"), false);
  const broken = stripeById();
  broken[PLAN_PRICE_IDS.pro.yearly].active = false;
  assert.throws(() => summarizeStripePrices(broken, null), /PRICE_UNAVAILABLE/);
});

test("savings, per-month on yearly, crossed-out monthly and per-day come from the real prices", () => {
  const y = (id) => planPriceView(PRICES, id, "yearly");
  assert.deepEqual(["starter", "pro", "generative"].map((id) => y(id).perMonth), [15, 32, 65]);
  assert.deepEqual(["starter", "pro", "generative"].map((id) => y(id).savingPercent), [17, 16, 17]);
  assert.deepEqual(["starter", "pro", "generative"].map((id) => y(id).savingAmount), [36, 72, 156]);
  assert.deepEqual(["starter", "pro", "generative"].map((id) => y(id).crossedOut), [18, 38, 78]);
  assert.equal(planPriceView(PRICES, "pro", "monthly").crossedOut, null, "never crossed out on monthly");
  assert.equal(planPriceView(PRICES, "starter", "monthly").perDay, 0.6);
  assert.equal(maxSavingPercent(PRICES), 17);
  assert.equal(formatMoney(18, "eur"), "€18");
  assert.equal(formatMoney(6.99, "eur"), "€6.99");
  assert.equal(formatMoney(0.6, "eur", { cents: true }), "€0.60");
});

test("Long Form counts per plan: rounded down, — where the plan lacks the tier", () => {
  const tiers = tiersFromRows(LF_ROWS);
  const grid = (tier, minutes) => ["starter", "pro", "generative"].map((id) => {
    const out = longFormOutputs(tiers, id, tier, minutes);
    return out.included ? out.count : "—";
  });
  assert.deepEqual(grid("v2", 10), [3, 6, 12]);
  assert.deepEqual(grid("v3", 10), ["—", 2, 4]);
  assert.deepEqual(grid("v4", 10), ["—", "—", 2]);
  assert.deepEqual(grid("v2", 8), [3, 8, 16]);
  assert.deepEqual(grid("v4", 15), ["—", "—", 1]);
  assert.deepEqual(LONG_FORM_LENGTHS, [8, 10, 12, 15]);
  assert.equal(longFormOutputs(null, "pro", "v2", 10), null, "loading, not zero");
  assert.equal(tiersFromRows(LF_ROWS.slice(0, 2)), null, "a missing tier row fails closed");
  assert.deepEqual(allowedLongFormTiers(tiers, "affiliate"), ["v2"]);
  assert.equal(bestLongFormTier(tiers, "pro"), "v3");
  assert.equal(bestLongFormTier(tiers, "free"), null);
  assert.deepEqual(["starter", "pro", "generative", "affiliate", "free"].map((p) => defaultLongFormTier(tiers, p)), ["v2", "v3", "v3", "v2", null], "Setup default: V4 is never pre-picked");
});

test("plan finder: the cheapest plan that covers the credits and every chosen tier", () => {
  assert.equal(recommendPlan([]), null);
  assert.deepEqual(recommendPlan([{ credits: 118, count: 5, tier: "v2" }]), { plan: "starter", needed: 590, credits: 750, fits: true, shortBy: 0 });
  assert.equal(recommendPlan([{ credits: 250, count: 5, tier: "v2" }]).plan, "pro", "1,250 credits needs Pro");
  assert.equal(recommendPlan([{ credits: 118, count: 1, tier: "v3" }]).plan, "pro", "V3 needs Pro even when Starter's credits would do");
  assert.equal(recommendPlan([{ credits: 50, count: 1, tier: "v4" }]).plan, "generative");
  const over = recommendPlan([{ credits: 900, count: 5, tier: "v4" }]);
  assert.deepEqual([over.plan, over.fits, over.shortBy], ["generative", false, 1300]);
});

test("the page says only what data backs: no fake counters, urgency, ratings, testimonials or $ prices", () => {
  const page = ["src/pages/Pricing.jsx", ...["PlanCards", "PlanFinder", "OutputTables", "PricingExtras", "PricingData"].map((f) => `src/components/pricing/${f}.jsx`)].map(read).join("\n");
  for (const banned of [/spots left/i, /78%/, /80% of/i, /Or it's free/i, /2,000,8|2000847|useLiveCounter/, /800\+/, /4\.9/, /TESTIMONIALS|Sarah M\.|Marcus T\.|Priya S\./, /strikethrough/, /Enterprise|SSO/, /particle|blink-dot|animate-pulse rounded-full bg-green/i, /\$\d/, /5 image generations/]) {
    assert.doesNotMatch(page, banned, String(banned));
  }
  assert.match(page, /Make more videos/);
  assert.match(page, /Every number on this page comes from today&apos;s live prices/);
  assert.match(page, /Recommended: unlocks V3/);
  assert.match(page, /Made with Zyvo/);
  assert.doesNotMatch(page, /VAT/, "not VAT-registered: no VAT claims");
  assert.doesNotMatch(page, /\d+s AI Fruit|complete 20 seconds/, "hyphenated: 20-second");
});

test("flag rule: fruit_v2 users see v2 Fruit numbers (20 s), everyone else the original tool (30 s)", () => {
  const src = read("src/lib/pricingOutputs.js");
  assert.match(src, /fruitToolKey = \(fruitV2\) => \(fruitV2 \? "fruitStory" : "fruitStoryV1"\)/);
  assert.match(src, /fruitHeadline = \(fruitV2\) => \(fruitV2 \? \{ key: "fruitStory", idx: 0, sec: 20 \} : \{ key: "fruitStoryV1", idx: 1, sec: 30 \}\)/);
  const data = read("src/components/pricing/PricingData.jsx");
  assert.match(data, /useFeatureFlag\("fruit_v2", account\.userId\)/);
});
