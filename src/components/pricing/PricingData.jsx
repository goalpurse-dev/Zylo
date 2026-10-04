import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabaseClient";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
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
 *   scheduled  a plan change waiting for the end of the paid period (a downgrade
 *            made in the billing portal): { plan, interval, date } or null
 *   pay      { busy, run }: one lock for every purchase button on the page
 *            (hooks/usePaymentAction), so a second click can't open a second checkout
 */
const PricingDataContext = createContext(null);

// The plan before a visit to the billing portal (PlanCards stores it), to tell
// on the way back whether the plan changed.
export const PLAN_BEFORE_PORTAL_KEY = "zyvo:plan-before-portal";
const PORTAL_RECHECKS = 6;       // the webhook may still be writing the change:
const PORTAL_RECHECK_MS = 4000;  // read again for ~24 seconds

/** The subscriber's scheduled plan change, live from Stripe (billing-summary). */
function useScheduledChange(hasSub, refresh) {
  const [scheduled, setScheduled] = useState(null);
  useEffect(() => {
    if (!hasSub) { setScheduled(null); return undefined; }
    let cancelled = false;
    supabase.functions.invoke("billing-summary", { method: "POST", body: {} })
      .then(({ data }) => { if (!cancelled) setScheduled(data?.scheduled_change ?? null); })
      .catch(() => { /* the page works without it */ });
    return () => { cancelled = true; };
  }, [hasSub, refresh]);
  return scheduled;
}

export function PricingDataProvider({ billing, children }) {
  const costs = usePricingOutputCosts();
  const lf = useLongFormTiers();
  const prices = usePlanPrices();
  const [refresh, setRefresh] = useState(0);
  const account = usePlanCode(refresh);
  const scheduled = useScheduledChange(account.hasSub, refresh);

  // Back from the billing portal (?from=portal): read the plan again a few
  // times, and say so once an upgrade has arrived.
  const portal = useRef(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("from") !== "portal") return undefined;
    url.searchParams.delete("from");
    window.history.replaceState({}, "", url.toString());
    let before = null;
    try { before = sessionStorage.getItem(PLAN_BEFORE_PORTAL_KEY); sessionStorage.removeItem(PLAN_BEFORE_PORTAL_KEY); } catch { /* no storage */ }
    portal.current = { before, done: false };
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      if (portal.current?.done || n > PORTAL_RECHECKS) { clearInterval(timer); return; }
      setRefresh((r) => r + 1);
    }, PORTAL_RECHECK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const p = portal.current;
    if (!p || p.done || account.loading) return;
    if (p.before && account.plan !== p.before && PRICING_PLANS[account.plan]) {
      p.done = true;
      toast.success(`You're on ${PRICING_PLANS[account.plan].name} now. Your extra credits are added with the payment.`);
    } else if (scheduled) {
      p.done = true; // the page shows the scheduled change
    }
  }, [account.loading, account.plan, scheduled]);
  const { busy: payBusy, run: payRun } = usePaymentAction();
  const flag = useFeatureFlag("fruit_v2", account.userId);
  const fruitV2 = flag.enabled;
  const value = useMemo(() => ({
    costs, lf, prices, account, billing, fruitV2, scheduled,
    fruit: { key: fruitToolKey(fruitV2), headline: fruitHeadline(fruitV2) },
    pay: { busy: payBusy, run: payRun },
  }), [costs, lf, prices, account, billing, fruitV2, scheduled, payBusy, payRun]);
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
