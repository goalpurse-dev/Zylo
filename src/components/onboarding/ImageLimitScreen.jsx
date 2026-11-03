// A free account has used its 5 images. With a video waiting: "Your video is still waiting", the same offer as the upgrade
// screen. Without one: the plans, with the same message about the free images. Never a dead end: "Maybe later" just closes.
import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Lock, Scale } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { formatMoney, usePlanPrices } from "../../lib/planPrices";
import { PRICING_PLANS } from "../../lib/pricingOutputs";
import { useSignupBonus } from "../../lib/useSignupBonus";
import { adminPreviewMode, fetchOnboardingStatus } from "../../lib/onboarding";
import { demoPreviewRun } from "../../lib/onboardingDemo";
import { cutawayServer } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import ComparePlansSheet from "./ComparePlansSheet.jsx";
import { RECOMMENDED_PLAN, lockLineFor, usePlanCheckout } from "./UpgradeScreen.jsx";
import "./onboarding.css";

const QUIET = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-2 text-[14px] font-bold text-white/80 transition hover:border-white/35 hover:text-white";

export default function ImageLimitScreen({ resetAt, onClose }) {
  const { user } = useAuth();
  const demo = adminPreviewMode() === "demo";
  const [run, setRun] = useState(() => (demo ? demoPreviewRun("landfill") : null));
  const [comparing, setComparing] = useState(false);
  const closeCompare = useCallback(() => setComparing(false), []);
  const prices = usePlanPrices();
  const bonus = useSignupBonus();
  const { choose, busy, adminNote } = usePlanCheckout(demo, { plain: !run });

  useEffect(() => {
    if (demo || !user?.id) return undefined;
    let live = true;
    fetchOnboardingStatus(user.id).then((status) => (status.enrolled ? cutawayServer.freePreviewState() : null)).then((s) => {
      if (live && s?.plan === "free" && s.preview?.step === "done" && !s.finish) setRun(s.preview);
    }).catch(() => {});
    return () => { live = false; };
  }, [demo, user?.id]);

  const days = resetAt ? Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 86400000)) : null;
  const comeBack = days ? `Your free images come back in ${days} ${days === 1 ? "day" : "days"}.` : "Your free images come back next month.";
  const plan = prices.status === "ready" ? prices.prices?.plans?.[RECOMMENDED_PLAN] : null;
  const price = plan ? formatMoney(plan.monthly, prices.prices.currency) : "…";

  return (
    <div className="ob-fade fixed inset-0 z-[9999] overflow-y-auto bg-[#090A0A] px-4 pb-32 pt-5 text-white md:flex md:items-center md:justify-center md:pb-8" role="dialog" aria-modal="true" aria-labelledby="image-limit-title" data-testid="image-limit">
      <div className={`mx-auto grid w-full items-center gap-4 ${run ? "max-w-[980px] md:grid-cols-[330px_minmax(0,1fr)] md:gap-12" : "max-w-[520px]"}`}>
        {run && (
          <div className="relative mx-auto aspect-[9/13] w-[46%] max-w-[176px] overflow-hidden rounded-3xl border-2 border-lime-300/55 bg-black shadow-[0_0_44px_rgba(190,242,100,0.28)] md:aspect-[9/16] md:w-full md:max-w-[330px]" data-testid="image-limit-video">
            {run.poster && <img src={run.poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-md brightness-50" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_0_7px_rgba(190,242,100,0.18)]"><Lock className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" /></span>
              <span className="text-[13px] font-black leading-snug [text-shadow:0_1px_8px_#000] md:text-[18px]">{lockLineFor(run)}</span>
            </div>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-center text-[13.5px] font-black text-amber-200 md:text-left">You've used your 5 free images</p>
          <h1 id="image-limit-title" className="mt-1 text-center text-[27px] font-black leading-[1.08] tracking-tight md:text-left md:text-[36px]">{run ? "Your video is still waiting" : "Keep creating with a plan"}</h1>
          <p className="mt-2 text-center text-[14.5px] leading-snug text-white/65 md:text-left">{comeBack} Or {run ? "finish your video now and keep creating today" : "start a plan and keep creating today"}.</p>
          {bonus.line && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-lime-300/45 bg-lime-300/[0.1] px-3 py-2.5 text-center text-[13.5px] font-black text-lime-200 md:justify-start md:text-left" data-testid="image-limit-bonus">
              <Gift className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /> <span>{bonus.head}<span className="whitespace-nowrap">{bonus.tail}</span></span>
            </div>
          )}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090A0A]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mt-4 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none" data-testid="image-limit-cta-bar">
            <button type="button" disabled={busy != null} onClick={() => choose(RECOMMENDED_PLAN)} data-testid="image-limit-cta"
              className="ob-cta-pulse block min-h-[68px] w-full rounded-[20px] bg-lime-300 px-3 py-2.5 text-center text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60">
              <span className="flex items-center justify-center gap-2 text-[22px] font-black leading-tight">{busy === RECOMMENDED_PLAN && <Loader2 className="h-5 w-5 animate-spin" />} {run ? "Finish my video" : `Get ${PRICING_PLANS[RECOMMENDED_PLAN].name}`}</span>
              <span className="mt-0.5 block text-[13.5px] font-bold">{PRICING_PLANS[RECOMMENDED_PLAN].name}: {price} a month</span>
            </button>
          </div>
          {adminNote && <p className="mt-3 text-center text-[13px] font-bold text-amber-200" role="status">Admin preview: a customer goes to Stripe here.</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setComparing(true)} data-testid="image-limit-compare" className={QUIET}><Scale className="h-4 w-4" aria-hidden="true" /> Compare plans</button>
            <button type="button" onClick={onClose} data-testid="image-limit-later" className={QUIET}>Maybe later</button>
          </div>
          {run && <p className="mt-2.5 text-center text-[12.5px] text-white/50 md:text-left">Your video finishes right after payment, free.</p>}
        </div>
      </div>
      {comparing && <ComparePlansSheet prices={prices} choose={choose} busy={busy} adminNote={adminNote} onClose={closeCompare} />}
    </div>
  );
}
