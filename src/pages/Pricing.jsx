import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { openBillingPortal } from "../lib/payments";
import { maxSavingPercent } from "../lib/planPrices";
import { PRICING_PLANS } from "../lib/pricingOutputs";
import { FOCUS, cx } from "../components/ui/zyvo/styles";
import { PricingDataProvider, usePricingData } from "../components/pricing/PricingData";
import PlanCards, { DISPLAY_FONT } from "../components/pricing/PlanCards";
import PlanFinder from "../components/pricing/PlanFinder";
import { CompareTable, WhatCanYouCreate } from "../components/pricing/OutputTables";
import { EveryPlanIncludes, Faq, FreePlan, MadeWithZyvo, Topups } from "../components/pricing/PricingExtras";

// Pricing page (lime design, docs/zyvo-lime-tokens.md). Every number comes
// from live data: plan and pack prices from Stripe (plan-prices), credits per
// output from tool_prices quotes, Long Form from tool_prices longform:*, plan
// credits from what the Stripe webhook grants. No counters, urgency or
// testimonials that aren't backed by real data.

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&display=swap";
function useDisplayFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

function BillingToggle({ billing, setBilling }) {
  const { prices } = usePricingData();
  const upTo = prices.status === "ready" ? maxSavingPercent(prices.prices) : null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex rounded-xl border border-white/[0.08] bg-[#0E1012] p-1" role="radiogroup" aria-label="Billing">
        {[["monthly", "Monthly"], ["yearly", "Yearly"]].map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={billing === id} onClick={() => setBilling(id)}
            className={cx("flex items-center gap-2 rounded-lg px-5 py-2 text-[13px] font-bold transition", FOCUS,
              billing === id ? "bg-white text-black" : "text-white/50 hover:bg-white/[0.06] hover:text-white/80")}>
            {label}
            {id === "yearly" && upTo != null && (
              <span className={cx("rounded-full px-1.5 py-0.5 text-[10px] font-black", billing === id ? "bg-lime-300 text-[#11150D]" : "bg-lime-300/15 text-lime-300")}>save up to {upTo}%</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmDowngrade({ planId, onCancel }) {
  if (!planId) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="downgrade-title">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl">
        <p id="downgrade-title" className="text-lg font-bold text-white">Confirm downgrade</p>
        <p className="mt-2 text-sm leading-relaxed text-white/50">Switch to <span className="font-semibold text-white">{PRICING_PLANS[planId]?.name}</span>? You keep your current plan until the end of the billing period.</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className={cx("flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/10", FOCUS)}>Cancel</button>
          <button type="button" onClick={() => { onCancel(); openBillingPortal({ flow: "change_plan", returnPath: "/pricing" }); }} className={cx("flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-gray-100", FOCUS)}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function PricingBody({ billing, setBilling }) {
  const { account } = usePricingData();
  const [askPlan, setAskPlan] = useState(null);
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-14 px-4 pb-28 pt-10 sm:px-6 md:gap-20 md:pb-20 md:pt-16">
      <header className="flex flex-col items-center gap-6 text-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Pricing</p>
          <h1 style={DISPLAY_FONT} className="mt-2 text-balance text-[44px] font-extrabold uppercase leading-[0.95] text-white sm:text-[64px]">
            Make more videos <span className="text-lime-300">every month.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-[14px] text-white/50">Every number on this page comes from today&apos;s live prices.</p>
          {/* Sign-ups (profiles) were 18,736 on 2026-09-30; a floor, so it stays true as it grows. */}
          <p className="mt-2 text-[12px] font-semibold text-white/35">18,700+ creators signed up</p>
        </div>
        <BillingToggle billing={billing} setBilling={setBilling} />
      </header>

      <div className="flex flex-col gap-5">
        <PlanCards onAskDowngrade={setAskPlan} />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="inline-flex items-center gap-2 text-[12.5px] text-white/50">
            <Shield className="h-4 w-4 text-lime-300" aria-hidden="true" />
            Not happy in 7 days? <span className="font-semibold text-white/80">Unused credits refunded.</span>
          </p>
          <p className="text-[11px] text-white/30">Quality tiers apply to Zyvo&apos;s templates and Long Form. Stripe-secured checkout · cancel anytime.</p>
        </div>
      </div>

      {!account.loading && account.isPaid && <Topups />}
      <PlanFinder />
      <WhatCanYouCreate />
      <CompareTable onAskDowngrade={setAskPlan} />
      <MadeWithZyvo />
      <EveryPlanIncludes />
      <FreePlan />
      <Faq />

      <footer className="flex justify-center border-t border-white/[0.05] pt-6">
        <Link to="/workspace/home" className={cx("rounded-xl bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/45 hover:text-white/70", FOCUS)}>← Back to workspace</Link>
      </footer>
      <ConfirmDowngrade planId={askPlan} onCancel={() => setAskPlan(null)} />
    </div>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState("yearly");
  useDisplayFont();
  useEffect(() => { document.title = "Pricing — Zyvo AI"; }, []);
  return (
    <PricingDataProvider billing={billing}>
      <section className="relative min-h-screen bg-[#0B0D0F] text-white">
        <PricingBody billing={billing} setBilling={setBilling} />
      </section>
    </PricingDataProvider>
  );
}
