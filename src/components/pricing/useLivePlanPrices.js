import { formatMoney, maxSavingPercent, planPriceView, usePlanPrices } from "../../lib/planPrices";

/**
 * Live € plan prices for paywalls and upsells (Stripe via plan-prices), so no
 * paywall types a price. For one billing choice:
 *   main(planId)  "€15" (per month) — "…" while loading, "—" on error
 *   note(planId)  "€180 billed yearly" / "Billed monthly"
 *   saveUpTo      biggest yearly saving in whole % (null until loaded)
 *   from          "€15/mo" — the lowest monthly price for this billing (null until loaded)
 */
export default function useLivePlanPrices(billing = "monthly") {
  const { status, prices, retry } = usePlanPrices();
  const ready = status === "ready";
  const view = (planId) => (ready ? planPriceView(prices, planId, billing) : null);
  const money = (n) => formatMoney(n, prices?.currency);
  return {
    status,
    retry,
    main: (planId) => {
      const v = view(planId);
      if (v) return money(v.perMonth);
      return status === "error" ? "—" : "…";
    },
    note: (planId) => {
      const v = view(planId);
      if (billing !== "yearly") return "Billed monthly";
      return v ? `${money(v.billedYearly)} billed yearly` : "Billed yearly";
    },
    /** "€0.60" a day for this billing, or null until loaded. */
    perDay: (planId) => {
      const v = view(planId);
      return v ? formatMoney(v.perDay, prices.currency, { cents: true }) : null;
    },
    saveUpTo: ready ? maxSavingPercent(prices) : null,
    from: ready ? `${money(Math.min(...Object.keys(prices.plans).map((id) => planPriceView(prices, id, billing).perMonth)))}/mo` : null,
  };
}
