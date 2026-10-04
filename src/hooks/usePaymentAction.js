import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { paymentErrorMessage } from "../lib/payments";

/**
 * Runs a checkout / billing-portal call for a button:
 *   const pay = usePaymentAction();
 *   <KeyButton busy={pay.busy === "pro"} disabled={pay.busy != null}
 *     onClick={() => pay.run("pro", () => startCheckout({ ... }))} />
 *
 *   busy   the key of the action in flight, or null: spinner on that button,
 *          every other payment button disabled
 *   run    ignores clicks while one is in flight (no double checkout), shows a
 *          toast when it fails, and stays busy while the browser leaves for
 *          Stripe (the action resolved true)
 */
export default function usePaymentAction() {
  const [busy, setBusy] = useState(null);
  const lock = useRef(false);
  const timer = useRef(null);

  const release = useCallback(() => {
    clearTimeout(timer.current);
    lock.current = false;
    setBusy(null);
  }, []);

  // Coming back from Stripe with the browser's Back button can restore this
  // page exactly as it was left: unlock the buttons again.
  useEffect(() => {
    const onShow = (e) => { if (e.persisted) release(); };
    window.addEventListener("pageshow", onShow);
    return () => { window.removeEventListener("pageshow", onShow); clearTimeout(timer.current); };
  }, [release]);

  const run = useCallback(async (key, action) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    try {
      const leaving = await action();
      // Leaving for Stripe: keep the spinner until the page goes, but never forever.
      if (leaving) { timer.current = setTimeout(release, 15000); return; }
    } catch (e) {
      console.error("payment action failed:", e);
      toast.error(paymentErrorMessage(e));
    }
    release();
  }, [release]);

  return { busy, run };
}
