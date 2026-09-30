// The subscription and top-up prices the pricing page shows, read live from
// Stripe (plan-prices edge function) so the page can never drift from what
// checkout charges. Price ids mirror create-checkout-session / stripe-webhook.

export const PLAN_PRICE_IDS = {
  starter: { monthly: "price_1TmVZZHtn4q5rIncOuf5aKP4", yearly: "price_1TmVhxHtn4q5rIncS8sxm6UR" },
  pro: { monthly: "price_1TmVfXHtn4q5rInc9IaN1l3U", yearly: "price_1TmVjnHtn4q5rInccPDBIVaX" },
  generative: { monthly: "price_1TmVg2Htn4q5rIncWL0b3HJr", yearly: "price_1TmVlUHtn4q5rIncbtWbGyof" },
};

export const TOPUP_PRICE_IDS = {
  mini: "price_1TGKjDHtn4q5rInczlym0Dcz",
  standard: "price_1SpZczHtn4q5rInctZoF9rJV",
  max: "price_1TGKjxHtn4q5rIncQzzCGyrR",
};

// Credits a month for NEW subscriptions on the current prices: exactly what
// the pricing page promises (monthly plans on renewal, yearly plans monthly via
// topup_annual_credits). stripe-webhook grants from PLAN_PRICE_MAP below.
export const PLAN_CREDITS = { starter: 750, pro: 1600, generative: 3200 };
export const TOPUP_CREDITS = { mini: 300, standard: 500, max: 900 };

// Subscriptions on the current prices that started before NEW_GRANT_CUTOFF keep
// the grant they signed up with (900 / 1,900 / 3,900) for as long as that
// subscription lives; later ones get PLAN_CREDITS.
export const NEW_GRANT_CUTOFF = "2026-09-30T22:30:00Z";
export const EARLY_PLAN_CREDITS = { starter: 900, pro: 1900, generative: 3900 };

/**
 * Every recurring price the webhook grants credits for: current prices (with
 * the early grant for subscriptions before the cutoff) and legacy prices whose
 * subscribers keep 600 / 1,200 / 2,500.
 */
export const PLAN_PRICE_MAP = {
  ...Object.fromEntries(Object.entries(PLAN_PRICE_IDS).flatMap(([plan, ids]) => [
    [ids.monthly, { plan, credits: PLAN_CREDITS[plan], earlyCredits: EARLY_PLAN_CREDITS[plan] }],
    [ids.yearly, { plan, credits: PLAN_CREDITS[plan], earlyCredits: EARLY_PLAN_CREDITS[plan], interval: "yearly" }],
  ])),
  // Monthly v2 (legacy, EUR)
  price_1TGKT6Htn4q5rIncI47V5Ein: { plan: "starter", credits: 600 },
  price_1TGKSqHtn4q5rIncIf8RPa6e: { plan: "pro", credits: 1200 },
  price_1TGKSSHtn4q5rIncSTurqkCN: { plan: "generative", credits: 2500 },
  // Monthly v1 (legacy, pre-EUR)
  price_1T8gM3Htn4q5rInchn8CMEcO: { plan: "starter", credits: 600 },
  price_1T8gMVHtn4q5rIncWwcUi9mG: { plan: "pro", credits: 1200 },
  price_1T8gMsHtn4q5rIncW0vy8d57: { plan: "generative", credits: 2500 },
  // Annual v2 (legacy)
  price_1TYWNYHtn4q5rIncWMa3mmvI: { plan: "starter", credits: 600, interval: "yearly" },
  price_1TYWOWHtn4q5rIncTmN3GXdy: { plan: "pro", credits: 1200, interval: "yearly" },
  price_1TYWP8Htn4q5rIncbugChVhS: { plan: "generative", credits: 2500, interval: "yearly" },
};

/**
 * Credits for one invoice line: the early grant when the subscription started
 * before the cutoff, else the map's credits. subscriptionStartUnix = Stripe
 * subscription.start_date (seconds); unknown start → the new grant.
 */
export function planCreditsFor(entry, subscriptionStartUnix) {
  if (!entry) return 0;
  if (entry.earlyCredits && Number.isFinite(subscriptionStartUnix) && subscriptionStartUnix * 1000 < Date.parse(NEW_GRANT_CUTOFF)) {
    return entry.earlyCredits;
  }
  return entry.credits;
}

// Stripe's "inferred_by_currency" default: USD and CAD prices are tax
// exclusive, every other currency is tax inclusive.
const EXCLUSIVE_BY_CURRENCY = new Set(["usd", "cad"]);

/** True when the customer pays exactly the listed amount (VAT included). */
export function vatIncluded(price, defaultTaxBehavior) {
  const behavior = price?.tax_behavior;
  if (behavior === "inclusive") return true;
  if (behavior === "exclusive") return false;
  if (defaultTaxBehavior === "inclusive") return true;
  if (defaultTaxBehavior === "inferred_by_currency") return !EXCLUSIVE_BY_CURRENCY.has(String(price?.currency ?? "").toLowerCase());
  return false;
}

/**
 * Stripe price objects (by id) + the account's default tax behavior →
 * { currency, vatIncluded, plans: {id: {monthly, yearly}}, topups: {id: amount} }.
 * Amounts are in major units (18 = €18.00). Throws if any price is missing,
 * inactive, in another currency or not the expected interval.
 */
export function summarizeStripePrices(byId, defaultTaxBehavior) {
  const all = [...Object.values(PLAN_PRICE_IDS).flatMap((p) => [p.monthly, p.yearly]), ...Object.values(TOPUP_PRICE_IDS)];
  const currency = byId[PLAN_PRICE_IDS.starter.monthly]?.currency;
  for (const id of all) {
    const p = byId[id];
    if (!p || !p.active || !Number.isInteger(p.unit_amount)) throw new Error(`PRICE_UNAVAILABLE ${id}`);
    if (p.currency !== currency) throw new Error(`MIXED_CURRENCY ${id}`);
  }
  const amount = (id) => byId[id].unit_amount / 100;
  const plans = {};
  for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
    if (byId[ids.monthly].recurring?.interval !== "month" || byId[ids.yearly].recurring?.interval !== "year") throw new Error(`WRONG_INTERVAL ${plan}`);
    plans[plan] = { monthly: amount(ids.monthly), yearly: amount(ids.yearly), credits: PLAN_CREDITS[plan] };
  }
  const topups = Object.fromEntries(Object.entries(TOPUP_PRICE_IDS).map(([k, id]) => [k, { price: amount(id), credits: TOPUP_CREDITS[k] }]));
  return { currency, vatIncluded: all.every((id) => vatIncluded(byId[id], defaultTaxBehavior)), plans, topups };
}
