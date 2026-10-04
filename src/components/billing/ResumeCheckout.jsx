import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { paymentErrorMessage, startCheckout, takeCheckoutIntent } from "../../lib/payments";

/**
 * A visitor who picked a plan while logged out is sent to sign-up; their choice
 * waits in this browser (lib/payments saveCheckoutIntent). The moment they are
 * signed in, on whatever page sign-up lands them, this continues to checkout
 * with the same plan and billing. Renders nothing.
 */
export default function ResumeCheckout() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (loading || !userId) return;
    const intent = takeCheckoutIntent(); // read once: a second run finds nothing
    if (!intent) return;
    toast.info("Taking you to checkout for the plan you picked…");
    startCheckout(intent, { resumed: true }).catch((e) => {
      console.error("resume checkout failed:", e);
      toast.error(paymentErrorMessage(e));
    });
  }, [loading, userId]);
  return null;
}
