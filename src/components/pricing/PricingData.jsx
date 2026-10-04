import { createContext, useContext, useMemo } from "react";
import usePricingOutputCosts from "../../hooks/usePricingOutputCosts";
import usePlanCode from "../../hooks/usePlanCode";
import usePaymentAction from "../../hooks/usePaymentAction";
import { useFeatureFlag } from "../../lib/featureFlags";
import { useLongFormTiers } from "../../lib/longFormTiers";
import { usePlanPrices } from "../../lib/planPrices";
import { fruitHeadline, fruitToolKey } from "../../lib/pricingOutputs";

/**
 * Everything the pricing page reads, loaded once:
 *   costs    per-output credits from tool_prices quotes (usePricingOutputCosts)
 *   lf       Long Form tier prices + plans (tool_prices longform:*)
 *   prices   Stripe plan and top-up prices (plan-prices edge function)
 *   account  the viewer's plan; fruitV2 = the viewer has the fruit_v2 flag
 *   pay      { busy, run }: one lock for every purchase button on the page
 *            (hooks/usePaymentAction), so a second click can't open a second checkout
 */
const PricingDataContext = createContext(null);

export function PricingDataProvider({ billing, children }) {
  const costs = usePricingOutputCosts();
  const lf = useLongFormTiers();
  const prices = usePlanPrices();
  const account = usePlanCode();
  const { busy: payBusy, run: payRun } = usePaymentAction();
  const flag = useFeatureFlag("fruit_v2", account.userId);
  const fruitV2 = flag.enabled;
  const value = useMemo(() => ({
    costs, lf, prices, account, billing, fruitV2,
    fruit: { key: fruitToolKey(fruitV2), headline: fruitHeadline(fruitV2) },
    pay: { busy: payBusy, run: payRun },
  }), [costs, lf, prices, account, billing, fruitV2, payBusy, payRun]);
  return <PricingDataContext.Provider value={value}>{children}</PricingDataContext.Provider>;
}

export function usePricingData() {
  const value = useContext(PricingDataContext);
  if (!value) throw new Error("usePricingData outside PricingDataProvider");
  return value;
}

/** A number that may still be loading: skeleton, "—" on error, else the formatted value. */
export function Num({ status, value, format = (v) => v.toLocaleString("en-US"), className = "" }) {
  if (status === "error") return <span className={className}>—</span>;
  if (status !== "ready" || value == null) {
    return <span aria-label="Loading" className={`inline-block h-[0.85em] w-7 animate-pulse rounded bg-current opacity-20 align-[-0.08em] motion-reduce:animate-none ${className}`} />;
  }
  return <span className={className}>{format(value)}</span>;
}

/** "Couldn't load … Retry" line for any failed source. */
export function LoadError({ what = "live prices", onRetry, className = "" }) {
  return (
    <p className={`text-[12px] text-white/55 ${className}`} role="status">
      Couldn&apos;t load {what}.{" "}
      <button type="button" onClick={onRetry} className="font-semibold text-lime-300 underline decoration-dotted underline-offset-2">Retry</button>
    </p>
  );
}

export const PLAN_COPY = {
  starter: { line: "Every tool and template at V2 quality.", tiers: ["v2"] },
  pro: { line: "Sharper V3 quality and more credits.", tiers: ["v2", "v3"], badge: "Recommended: unlocks V3" },
  generative: { line: "Every quality tier and the most credits.", tiers: ["v2", "v3", "v4"] },
};
