// Pure pricing math shared by the pricing page, the Long Form Setup page and
// tests (no network, no React): plan prices and savings, Long Form tier access
// and counts, and the plan finder's recommendation. Inputs are live data
// (plan-prices for money, tool_prices for credits); nothing here is typed in
// except the plan order and each quality tier's lowest plan.
import { PLAN_CREDITS } from "../../supabase/functions/_shared/stripePlanPrices.js";
import { planTierIndex } from "./planGating.js";

export const PLAN_ORDER = ["starter", "pro", "generative"];
export const QUALITY_TIERS = ["v2", "v3", "v4"];
/** Lowest plan per quality tier for templates and Long Form (job-worker / tool_prices gates). */
export const TIER_MIN_PLAN = { v2: "starter", v3: "pro", v4: "generative" };
export const planRank = (planId) => PLAN_ORDER.indexOf(planId);

/** "20-second" — the adjective form used in sentences ("20-second videos"). */
export const secondsAdj = (sec) => `${sec}-second`;

/** Math.floor(planCredits / generationCredits), never negative/NaN. */
export function calculateCompleteOutputs(planCredits, generationCredits) {
  if (!planCredits || !generationCredits || generationCredits <= 0) return 0;
  return Math.floor(planCredits / generationCredits);
}

/* ─── Money ─────────────────────────────────────────────────────────────── */

/** "€18", "€6.99", "€0.60" (whole amounts without cents unless `cents`). */
export function formatMoney(amount, currency = "eur", { cents = false } = {}) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const whole = Number.isInteger(amount) && !cents;
  return new Intl.NumberFormat("en-IE", {
    style: "currency", currency: String(currency).toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * What a plan card shows for one billing choice (prices from plan-prices).
 *   perMonth       the price per month for this billing (yearly ÷ 12 on yearly)
 *   crossedOut     the real monthly price, shown struck through on yearly only
 *   billedYearly   the yearly charge (yearly only)
 *   savingAmount   monthly × 12 − yearly
 *   savingPercent  rounded to a whole percent
 *   perDay         the charge ÷ 30 (monthly) or ÷ 365 (yearly)
 */
export function planPriceView(prices, planId, billing) {
  const plan = prices?.plans?.[planId];
  if (!plan) return null;
  const yearly = billing === "yearly";
  const savingAmount = round2(plan.monthly * 12 - plan.yearly);
  return {
    currency: prices.currency,
    credits: plan.credits,
    perMonth: yearly ? round2(plan.yearly / 12) : plan.monthly,
    crossedOut: yearly && plan.yearly / 12 < plan.monthly ? plan.monthly : null,
    billedYearly: yearly ? plan.yearly : null,
    savingAmount,
    savingPercent: Math.round((savingAmount / (plan.monthly * 12)) * 100),
    perDay: round2(yearly ? plan.yearly / 365 : plan.monthly / 30),
  };
}

/** The biggest yearly saving across plans, as a whole percent (the toggle's "save up to"). */
export function maxSavingPercent(prices) {
  const ids = Object.keys(prices?.plans ?? {});
  if (!ids.length) return null;
  return Math.max(...ids.map((id) => planPriceView(prices, id, "yearly").savingPercent));
}

/* ─── Long Form tiers (tool_prices longform:v2/v3/v4) ───────────────────── */

export const LONG_FORM_TIERS = ["v2", "v3", "v4"];
export const LONG_FORM_LENGTHS = [8, 10, 12, 15];
export const LONG_FORM_HEADLINE_MINUTES = 10;

/** Plan rank for Long Form; affiliates get the entry tier only (as on the server). */
export function longFormPlanRank(planCode) {
  return String(planCode ?? "").toLowerCase().trim() === "affiliate" ? 1 : planTierIndex(planCode);
}

/** { v2: { perMinute, minPlan }, ... } from tool_prices rows; null if any tier is missing. */
export function tiersFromRows(rows) {
  const tiers = {};
  for (const tier of LONG_FORM_TIERS) {
    const row = (rows ?? []).find((r) => r.tool_key === `longform:${tier}`);
    const perMinute = Number(row?.flat_credits);
    if (!row || !(perMinute > 0)) return null;
    tiers[tier] = { perMinute, minPlan: row.min_plan ?? null };
  }
  return tiers;
}

export function longFormTierAllowed(tiers, tier, planCode) {
  const t = tiers?.[tier];
  return Boolean(t) && longFormPlanRank(planCode) >= longFormPlanRank(t.minPlan ?? "free");
}

export function allowedLongFormTiers(tiers, planCode) {
  return LONG_FORM_TIERS.filter((tier) => longFormTierAllowed(tiers, tier, planCode));
}

/** The best (highest) tier the plan allows, or null when none is. */
export function bestLongFormTier(tiers, planCode) {
  const allowed = allowedLongFormTiers(tiers, planCode);
  return allowed.length ? allowed[allowed.length - 1] : null;
}

/** Credits for one video: ceil(perMinute × minutes), the server's formula. */
export function longFormVideoCredits(tiers, tier, minutes) {
  const perMinute = tiers?.[tier]?.perMinute;
  return perMinute ? Math.ceil(perMinute * minutes) : null;
}

/**
 * Long Form videos of `minutes` a plan's monthly credits make on `tier`:
 *   { included: false }            the plan doesn't include the tier ("—")
 *   { included: true, count, credits }
 *   null                           prices not loaded yet
 */
export function longFormOutputs(tiers, planId, tier, minutes, planCredits = PLAN_CREDITS) {
  if (!tiers) return null;
  if (!longFormTierAllowed(tiers, tier, planId)) return { included: false };
  const credits = longFormVideoCredits(tiers, tier, minutes);
  return { included: true, credits, count: calculateCompleteOutputs(planCredits[planId], credits) };
}

/* ─── Plan finder ───────────────────────────────────────────────────────── */

/**
 * The cheapest plan whose monthly credits cover everything picked and whose
 * tier access includes every chosen quality.
 *   picks: [{ credits (per video), count, tier }]
 * → null when nothing is picked, else
 *   { plan, needed, credits, fits, shortBy } — fits=false means even that plan
 *   (the highest one allowed) runs short by shortBy credits a month.
 */
export function recommendPlan(picks, planCredits = PLAN_CREDITS) {
  const active = (picks ?? []).filter((p) => p && p.count > 0 && p.credits > 0);
  if (!active.length) return null;
  const needed = active.reduce((sum, p) => sum + p.credits * p.count, 0);
  const minRank = Math.max(0, ...active.map((p) => planRank(TIER_MIN_PLAN[p.tier] ?? "starter")));
  const eligible = PLAN_ORDER.filter((id) => planRank(id) >= minRank);
  const fit = eligible.find((id) => planCredits[id] >= needed);
  const plan = fit ?? eligible[eligible.length - 1];
  return { plan, needed, credits: planCredits[plan], fits: Boolean(fit), shortBy: fit ? 0 : needed - planCredits[plan] };
}
