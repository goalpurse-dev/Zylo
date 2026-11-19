// /billing/continue: where the unfinished-checkout emails' button lands (_shared/checkoutReminders.js continueLink).
// Counts the click (checkout_reminder_click), then straight to Stripe for the same plan. Signed out: the plan is kept
// and they sign in first (ResumeCheckout continues to checkout afterwards). The server applies the launch deal itself.
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { paymentErrorMessage, saveCheckoutIntent, startCheckout } from "../../lib/payments";
import { useAuth } from "../../context/AuthContext";

const PLANS = ["starter", "pro", "generative"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Continue() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const [error, setError] = useState(null);
  const started = useRef(false);
  const plan = PLANS.includes(params.get("plan")) ? params.get("plan") : null;
  const billing = params.get("billing") === "yearly" ? "yearly" : "monthly";

  useEffect(() => { document.title = "Back to checkout | Zyvo"; }, []);

  // the click, once per page load, before anything else (never waits, never fails the page)
  useEffect(() => {
    const token = params.get("t"), step = Number(params.get("s"));
    if (!UUID.test(token ?? "") || ![1, 2, 3].includes(step)) return;
    supabase.rpc("checkout_reminder_click", { p_token: token, p_step: step }).then(() => {}, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || started.current || !plan) return;
    started.current = true;
    const intent = { type: "subscription", planId: plan, billing };
    if (!user) { saveCheckoutIntent(intent); window.location.replace("/login"); return; }
    startCheckout(intent).catch((e) => setError(paymentErrorMessage(e)));
  }, [loading, user, plan, billing]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0D0F] px-4 text-center text-white" data-testid="billing-continue">
      <div className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#111314] p-7 sm:p-8">
        {plan && !error ? (
          <>
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-lime-300" />
            <h1 className="mt-4 text-[22px] font-extrabold leading-tight">Taking you back to checkout…</h1>
            <p className="mt-2 text-[14px] text-white/60">The plan you picked is ready.</p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold leading-tight">{error ? "We couldn't open checkout" : "Pick your plan"}</h1>
            <p className="mt-2 text-[14px] leading-6 text-white/65">{error ?? "That link didn't say which plan. You can pick one on the pricing page."}</p>
            <Link to="/pricing" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-lime-300 px-5 text-[14px] font-bold text-[#11150D] hover:bg-lime-200">See the plans</Link>
          </>
        )}
      </div>
    </div>
  );
}
