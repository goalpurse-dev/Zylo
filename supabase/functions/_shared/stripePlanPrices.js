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

// Credits each current price grants per month (monthly plans on renewal,
// yearly plans monthly via topup_annual_credits) and per top-up pack. Mirrors
// stripe-webhook's PRICE_MAP / TOPUP_PRICE_MAP; a test keeps them equal.
export const PLAN_CREDITS = { starter: 900, pro: 1900, generative: 3900 };
export const TOPUP_CREDITS = { mini: 300, standard: 500, max: 900 };

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
