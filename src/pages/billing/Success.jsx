import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { SUPPORT_EMAIL, clearPendingCheckout, readPendingCheckout } from "../../lib/payments";
import { purchaseArrived } from "../../lib/purchaseArrived";

// Where Stripe Checkout returns after a payment (?session_id=cs_…). The plan
// and credits are added by the Stripe webhook a few seconds later, so this page
// watches the profile until they show up instead of claiming it up front.
const POLL_MS = 2000;
const SLOW_AFTER_MS = 30000;      // then: "taking longer than usual" + support contact
const GIVE_UP_AFTER_MS = 5 * 60000; // keeps checking quietly until here
const PLAN_NAMES = { starter: "Starter", pro: "Pro", generative: "Generative" };

const PRIMARY = "inline-flex h-11 items-center justify-center rounded-xl bg-lime-300 px-5 text-[14px] font-bold text-[#11150D] hover:bg-lime-200";
const SECONDARY = "inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-[14px] font-bold text-white/75 hover:text-white";

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [pending] = useState(() => readPendingCheckout());
  // phase: "checking" | "slow" | "active" | "received" (nothing to compare with) | "guest"
  const [state, setState] = useState({ phase: "checking", profile: null });

  useEffect(() => {
    document.title = "Payment received | Zyvo";
    let stopped = false;
    let timer;
    const started = Date.now();
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (stopped) return;
      if (!session?.user) { setState({ phase: "guest", profile: null }); return; }
      const { data: profile } = await supabase.from("profiles").select("plan_code, credit_balance").eq("id", session.user.id).maybeSingle();
      if (stopped) return;
      const arrived = profile ? purchaseArrived(profile, pending) : false;
      if (arrived) { clearPendingCheckout(); setState({ phase: "active", profile }); return; }
      if (arrived === null) { setState({ phase: "received", profile }); return; }
      const waited = Date.now() - started;
      if (waited >= SLOW_AFTER_MS) setState({ phase: "slow", profile });
      if (waited < GIVE_UP_AFTER_MS) timer = setTimeout(check, waited >= SLOW_AFTER_MS ? POLL_MS * 2 : POLL_MS);
    };
    check().catch(() => { if (!stopped) timer = setTimeout(check, POLL_MS); });
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending]);

  const isPack = pending?.kind === "topup";
  const { phase, profile } = state;
  const planName = PLAN_NAMES[String(profile?.plan_code || "").toLowerCase()];
  const credits = Number(profile?.credit_balance ?? 0).toLocaleString("en-US");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0D0F] px-4 text-center text-white" data-testid="billing-success" data-phase={phase}>
      <div className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#111314] p-7 sm:p-8">
        {phase === "checking" && (
          <div role="status" aria-live="polite">
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-lime-300/25 border-t-lime-300 motion-reduce:animate-none" aria-hidden="true" />
            <h1 className="mt-5 text-[24px] font-extrabold leading-tight">Payment received</h1>
            <p className="mt-2 text-[14.5px] leading-6 text-white/65">{isPack ? "Adding your credits…" : "Activating your plan…"} This usually takes a few seconds.</p>
          </div>
        )}

        {phase === "active" && (
          <div role="status" aria-live="polite">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-6 w-6" aria-hidden="true" /></span>
            <h1 className="mt-5 text-[24px] font-extrabold leading-tight">You&apos;re all set</h1>
            <p className="mt-2 text-[14.5px] leading-6 text-white/65">
              {isPack || !planName ? <>Your credits are in. You now have <span className="font-bold text-white">{credits} credits</span>.</>
                : <><span className="font-bold text-white">{planName}</span> is active and you have <span className="font-bold text-white">{credits} credits</span>.</>}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className={PRIMARY}>Start creating</Link>
              <Link to="/settings?tab=billing" className={SECONDARY}>View billing</Link>
            </div>
          </div>
        )}

        {phase === "received" && (
          <div role="status" aria-live="polite">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-6 w-6" aria-hidden="true" /></span>
            <h1 className="mt-5 text-[24px] font-extrabold leading-tight">Payment received</h1>
            <p className="mt-2 text-[14.5px] leading-6 text-white/65">Thank you. Your purchase shows up in your account within a minute.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className={PRIMARY}>Go to the app</Link>
              <Link to="/settings?tab=billing" className={SECONDARY}>View billing</Link>
            </div>
          </div>
        )}

        {phase === "slow" && (
          <div role="status" aria-live="polite">
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-lime-300/25 border-t-lime-300 motion-reduce:animate-none" aria-hidden="true" />
            <h1 className="mt-5 text-[24px] font-extrabold leading-tight">Your payment went through</h1>
            <p className="mt-2 text-[14.5px] leading-6 text-white/65">
              {isPack ? "Adding your credits" : "Activating your plan"} is taking longer than usual. We keep checking, and you don&apos;t need to pay again.
            </p>
            <p className="mt-3 text-[13.5px] leading-6 text-white/55">
              If nothing has changed in a few minutes, write to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Payment made, plan not active")}${sessionId ? `&body=${encodeURIComponent(`Checkout reference: ${sessionId}`)}` : ""}`} className="font-semibold text-lime-300 underline underline-offset-2">{SUPPORT_EMAIL}</a>
              {" "}and we&apos;ll sort it out.
            </p>
            {sessionId && <p className="mt-3 break-all text-[11px] text-white/30">Reference: {sessionId}</p>}
            <div className="mt-6 flex justify-center">
              <Link to="/" className={SECONDARY}>Go to the app</Link>
            </div>
          </div>
        )}

        {phase === "guest" && (
          <div>
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-6 w-6" aria-hidden="true" /></span>
            <h1 className="mt-5 text-[24px] font-extrabold leading-tight">Payment received</h1>
            <p className="mt-2 text-[14.5px] leading-6 text-white/65">Log in to see your plan and credits.</p>
            <div className="mt-6 flex justify-center">
              <Link to="/login" className={PRIMARY}>Log in</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
