// The moment the free preview stops: "level complete, unlock the next one". One big button to the recommended plan, the
// real next line of their video on the lock, and a proper way to look around for free: never pay or leave.
// Phones get the short version: the big button stays stuck to the bottom, the details wait in "Compare plans".
import { useCallback, useState } from "react";
import { Check, Compass, Gift, Loader2, Scale } from "lucide-react";
import { startCheckout } from "../../lib/payments";
import usePaymentAction from "../../hooks/usePaymentAction";
import { formatMoney, usePlanPrices } from "../../lib/planPrices";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
import { useSignupBonus } from "../../lib/useSignupBonus";
import { FIRST_VIDEO_PATH } from "../../lib/onboarding";
import { PRICES } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import { PREVIEW, cliffhangerLine } from "../../../supabase/functions/_shared/cutaway/freePreview.js";
import ComparePlansSheet from "./ComparePlansSheet.jsx";
import { RECOMMENDED_PLAN } from "./planChoice";
import "./onboarding.css";

export { RECOMMENDED_PLAN };
const OTHER_PLANS = ["pro", "generative"];
const videosFor = (planId) => Math.floor(PRICING_PLANS[planId].credits / PRICES.video.credits.premade[30]);
const QUIET = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-2 text-[14px] font-bold text-white/80 transition hover:border-white/35 hover:text-white";

export function usePlanCheckout(adminLook) {
  const pay = usePaymentAction();
  const [adminNote, setAdminNote] = useState(false);
  const choose = (planId) => (adminLook ? setAdminNote(true) : pay.run(planId, () => startCheckout({
    type: "subscription", planId, billing: "monthly",
    successUrl: `${window.location.origin}${FIRST_VIDEO_PATH}?paid=1`,
    cancelUrl: `${window.location.origin}${FIRST_VIDEO_PATH}?unlock=1`,
  })));
  return { choose, busy: pay.busy, adminNote };
}

export function ExploreButton({ onClick }) {
  return (
    <div className="mt-5 w-full">
      <button type="button" onClick={onClick} data-testid="first-video-explore" className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/[0.04] text-[16px] font-bold text-white transition hover:border-white/40 hover:bg-white/[0.08]">
        <Compass className="h-5 w-5" aria-hidden="true" /> Explore Zyvo first
      </button>
      <p className="mt-2 text-center text-[13px] leading-snug text-white/55">Free to look around: 5 free images, browse the templates.</p>
    </div>
  );
}

/** The cliffhanger on the lock: the video's real next line, cut off. */
export function lockLineFor(run) {
  const next = cliffhangerLine(run?.narration);
  return next ? `“${next.replace(/[.!?]+$/, "")}…”` : "";
}

function Tick() {
  return <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-300/20 text-lime-300"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /></span>;
}

export default function UpgradeScreen({ run, adminLook = false, onExplore }) {
  const prices = usePlanPrices();
  const bonus = useSignupBonus();
  const { choose, busy, adminNote } = usePlanCheckout(adminLook);
  const [comparing, setComparing] = useState(false);
  const closeCompare = useCallback(() => setComparing(false), []);
  const total = Number(run?.lengthSec) || 30, pct = Math.round((PREVIEW.seconds / total) * 100), rest = total - PREVIEW.seconds;
  const planOf = (id) => (prices.status === "ready" ? prices.prices?.plans?.[id] : null);
  const priceOf = (id) => { const p = planOf(id); return p ? formatMoney(p.monthly, prices.prices.currency) : "…"; };
  const main = PRICING_PLANS[RECOMMENDED_PLAN];

  return (
    <section className="ob-fade w-full" data-testid="first-video-upgrade" id="first-video-plans" data-run={run?.id ?? ""}>
      <div className="hidden md:block" data-testid="first-video-progress">
        <p className="mt-1 flex items-center gap-2 text-[13px] font-black text-lime-300">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span> Level 1 complete
        </p>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[14px] font-extrabold text-white"><span>Your video is {pct}% done</span><span className="text-[12.5px] font-bold text-white/55">{PREVIEW.seconds} of {total} seconds</span></div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,0.7)]" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <h1 className="text-center text-[26px] font-black leading-[1.08] tracking-tight text-white md:mt-4 md:text-left md:text-[36px]">Unlock the other {rest} seconds of your video</h1>
      {bonus.line && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-lime-300/45 bg-lime-300/[0.1] px-3 py-2.5 text-center text-[13.5px] font-black text-lime-200 md:justify-start md:text-left md:text-[14px]" data-testid="first-video-bonus">
          <Gift className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /> <span>{bonus.head}<span className="whitespace-nowrap">{bonus.tail}</span></span>
        </div>
      )}
      {/* Phones: stuck to the bottom of the screen while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090A0A]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mt-3 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none" data-testid="first-video-cta-bar">
        <button type="button" disabled={busy != null} onClick={() => choose(RECOMMENDED_PLAN)} data-testid="first-video-plan-button" data-plan={RECOMMENDED_PLAN}
          className="ob-cta-pulse block min-h-[68px] w-full rounded-[20px] bg-lime-300 px-3 py-2.5 text-center text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60 md:min-h-[72px]">
          <span className="flex items-center justify-center gap-2 text-[22px] font-black leading-tight md:text-[23px]">{busy === RECOMMENDED_PLAN && <Loader2 className="h-5 w-5 animate-spin" />} Finish my video</span>
          <span className="mt-0.5 block text-[13.5px] font-bold">{main.name}: {priceOf(RECOMMENDED_PLAN)} a month</span>
        </button>
      </div>
      <ul className="mt-3.5 grid gap-2 text-[14.5px] font-semibold leading-snug text-white/90">
        <li className="flex justify-center gap-2.5 md:justify-start"><Tick /><span><b className="text-lime-300">Your video finishes right after payment.</b> It's a gift: free, no credits used.</span></li>
        <li className="hidden gap-2.5 md:flex" data-testid="first-video-benefit-2"><Tick /><span><b className="text-lime-300">{main.credits.toLocaleString("en-US")} credits every month:</b> about {videosFor(RECOMMENDED_PLAN)} more videos like this one.</span></li>
      </ul>
      <p className="mt-3 hidden flex-wrap justify-center gap-x-2.5 gap-y-1 text-[12px] font-semibold text-white/55 md:flex" data-testid="first-video-trust"><span>Cancel anytime</span><span>·</span><span>Secure payment by Stripe</span><span>·</span><span>Apple Pay &amp; Google Pay</span></p>
      <div className="mt-4 hidden gap-2 border-t border-white/10 pt-3.5 md:grid md:grid-cols-2" data-testid="first-video-other-plans">
        {OTHER_PLANS.map((id) => (
          <button key={id} type="button" disabled={busy != null} onClick={() => choose(id)} data-testid="first-video-plan-button" data-plan={id}
            className="flex min-h-[48px] flex-col justify-center rounded-xl border border-white/15 px-3 py-2 text-left text-[13px] text-white/70 transition hover:border-white/30 disabled:opacity-60">
            <span className="flex items-center justify-between gap-2"><b className="text-white">{PRICING_PLANS[id].name}</b><span>{priceOf(id)} a month</span></span>
            <span className="text-[12px] text-white/50">about {videosFor(id)} videos a month</span>
          </button>
        ))}
      </div>
      {adminNote && <p className="mt-3 text-center text-[13px] font-bold text-amber-200" role="status">Admin preview: a customer goes to Stripe here.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setComparing(true)} data-testid="first-video-compare" className={QUIET}><Scale className="h-4 w-4" aria-hidden="true" /> Compare plans</button>
        <button type="button" onClick={onExplore} data-testid="first-video-explore" className={QUIET}><Compass className="h-4 w-4" aria-hidden="true" /> Explore Zyvo first</button>
      </div>
      <p className="mt-2 text-center text-[12.5px] leading-snug text-white/50">5 free images and every template to browse. Your video stays waiting on Home.</p>
      {comparing && <ComparePlansSheet prices={prices} choose={choose} busy={busy} adminNote={adminNote} onClose={closeCompare} />}
    </section>
  );
}
