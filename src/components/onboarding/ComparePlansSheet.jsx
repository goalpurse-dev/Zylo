// "Compare plans": a sheet from the bottom on phones, a dialog on larger screens. Live data only: prices from Stripe
// (plan-prices), credits from the table the Stripe webhook grants from, long-form minutes from tool_prices.
import { useEffect, useRef } from "react";
import { Check, Loader2, X } from "lucide-react";
import { formatMoney } from "../../lib/planPrices";
import { PLAN_ORDER, PRICING_PLANS } from "../../lib/pricingOutputs";
import { useLongFormTiers } from "../../lib/longFormTiers";
import { PRICES } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import { RECOMMENDED_PLAN } from "./planChoice";

const LONG_FORM_TIER = "v2";

export default function ComparePlansSheet({ prices, choose, busy, adminNote, onClose }) {
  const lf = useLongFormTiers();
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const rowsFor = (id) => {
    const plan = PRICING_PLANS[id], perMinute = lf.tiers?.[LONG_FORM_TIER]?.perMinute;
    return [
      ["Monthly credits", plan.credits.toLocaleString("en-US")],
      ["Videos like this one", `about ${Math.floor(plan.credits / PRICES.video.credits.premade[30])}`],
      ["Max quality", plan.modelAccess[plan.modelAccess.length - 1]],
      ["Templates and tools", "All included"],
      ["Long-form minutes", perMinute ? `about ${Math.floor(plan.credits / perMinute)} min at ${LONG_FORM_TIER.toUpperCase()}` : lf.status === "error" ? "—" : "…"],
      ["Cancel anytime", <Check key="yes" className="ml-auto h-4 w-4 text-lime-300" strokeWidth={3} aria-label="Yes" />],
    ];
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="compare-plans-title" data-testid="compare-plans">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-[980px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#121412] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 md:rounded-3xl md:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 id="compare-plans-title" className="text-[22px] font-black tracking-tight text-white">Compare plans</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" data-testid="compare-plans-close" className="grid h-10 w-10 place-items-center rounded-full text-white/60 transition hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-0.5 text-[13.5px] text-white/60">Your video finishes free with any plan. Monthly prices, cancel anytime.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PLAN_ORDER.filter((id) => PRICING_PLANS[id]).map((id) => {
            const best = id === RECOMMENDED_PLAN, money = prices.status === "ready" ? prices.prices?.plans?.[id]?.monthly : null;
            return (
              <section key={id} data-testid="compare-plan" data-plan={id} className={`flex flex-col rounded-2xl border p-4 ${best ? "border-lime-300/70 bg-lime-300/[0.07]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[17px] font-black text-white">{PRICING_PLANS[id].name}</h3>
                  <p className="text-[13px] text-white/55"><span className="text-[22px] font-black text-white">{money != null ? formatMoney(money, prices.prices.currency) : "…"}</span> / month</p>
                </div>
                {/* The empty line keeps every card's rows level on desktop. */}
                <p className={`mt-0.5 text-[11.5px] font-black uppercase tracking-wide text-lime-300 ${best ? "" : "invisible hidden md:block"}`}>Most popular</p>
                <dl className="mb-4 mt-3 grid gap-1.5 text-[13.5px]">
                  {rowsFor(id).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-1.5">
                      <dt className="text-white/55">{label}</dt>
                      <dd className="text-right font-bold text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" disabled={busy != null} onClick={() => choose(id)} data-testid="compare-plan-button" data-plan={id}
                  className={`mt-auto inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15.5px] font-black transition disabled:opacity-60 ${best ? "bg-lime-300 text-[#11150D] hover:bg-lime-200" : "border border-lime-300/45 text-lime-200 hover:bg-lime-300/10"}`}>
                  {busy === id && <Loader2 className="h-4 w-4 animate-spin" />} Get {PRICING_PLANS[id].name}
                </button>
              </section>
            );
          })}
        </div>
        {adminNote && <p className="mt-3 text-center text-[13px] font-bold text-amber-200" role="status">Admin preview: a customer goes to Stripe here.</p>}
      </div>
    </div>
  );
}
