import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { paymentErrorMessage, startCheckout, takeCheckoutIntent } from "../../lib/payments";

/**
 * A visitor who picked a plan while logged out is sent to sign-up; their choice
 * waits in this browser (lib/payments saveCheckoutIntent). The moment they are
 * signed in, on whatever page sign-up lands them, this continues to checkout
 * with the same plan and billing. Renders nothing.
 *
 * A reset-password link signs the visitor in too: checkout then waits until
 * they have chosen the new password and left those pages.
 */
const HOLD_ON = ["/auth/confirm", "/auth/reset"];
export default function ResumeCheckout() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const onHold = HOLD_ON.includes(useLocation().pathname);
  useEffect(() => {
    if (loading || !userId || onHold) return;
    const intent = takeCheckoutIntent(); // read once: a second run finds nothing
    if (!intent) return;
    toast.info("Taking you to checkout for the plan you picked…");
    startCheckout(intent, { resumed: true }).catch((e) => {
      console.error("resume checkout failed:", e);
      toast.error(paymentErrorMessage(e));
    });
  }, [loading, userId, onHold]);
  return null;
}
