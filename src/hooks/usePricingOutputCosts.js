import { useCallback, useEffect, useMemo, useState } from "react";
import useToolPriceQuotes from "./useToolPriceQuotes";
import { PLAN_ORDER, PRICING_PRICE_ITEMS, resolveOutputCosts } from "../lib/pricingOutputs";
import { quoteCookingMaticServiceForPlan } from "../components/viral-tools/ai-cooking-matic/api/cookingMaticApi";

/**
 * Pricing-page output costs from server quotes.
 *   status: "loading" | "ready" | "error"
 *   costs:  resolveOutputCosts(...) once ready, else null
 *   retry:  re-request whatever failed
 */
export default function usePricingOutputCosts() {
  const quotes = useToolPriceQuotes(PRICING_PRICE_ITEMS);
  const [service, setService] = useState({ status: "loading", byPlan: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(PLAN_ORDER.map((planId) => quoteCookingMaticServiceForPlan(planId)))
      .then((fees) => {
        if (!cancelled) setService({ status: "ready", byPlan: Object.fromEntries(PLAN_ORDER.map((id, i) => [id, fees[i]])) });
      })
      .catch(() => { if (!cancelled) setService({ status: "error", byPlan: null }); });
    return () => { cancelled = true; };
  }, [attempt]);

  const status = quotes.status === "error" || service.status === "error"
    ? "error"
    : quotes.status === "ready" && service.status === "ready" ? "ready" : "loading";

  const costs = useMemo(
    () => (status === "ready" ? resolveOutputCosts(quotes.prices, service.byPlan) : null),
    [status, quotes.prices, service.byPlan],
  );

  const { retry: retryQuotes } = quotes;
  const quotesFailed = quotes.status === "error";
  const serviceFailed = service.status === "error";
  const retry = useCallback(() => {
    if (quotesFailed) retryQuotes();
    if (serviceFailed) { setService({ status: "loading", byPlan: null }); setAttempt((n) => n + 1); }
  }, [quotesFailed, serviceFailed, retryQuotes]);

  return { status, costs, retry };
}
