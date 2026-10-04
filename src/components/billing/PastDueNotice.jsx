import { CreditCard } from "lucide-react";
import usePlanCode from "../../hooks/usePlanCode";
import usePaymentAction from "../../hooks/usePaymentAction";
import { openBillingPortal } from "../../lib/payments";

/**
 * Shown across the app while the user's subscription is past due (the last
 * payment failed and Stripe is retrying): says so plainly and opens the card
 * update screen of the billing portal. Nothing for everyone else.
 */
export default function PastDueNotice() {
  const account = usePlanCode();
  const pay = usePaymentAction();
  if (!account.pastDue) return null;
  const busy = pay.busy != null;
  return (
    <div role="alert" data-testid="past-due-notice" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-amber-300/25 bg-[#2A2110] px-4 py-2.5 text-center text-[13px] text-amber-100">
      <span><span className="font-bold">Your last payment didn&apos;t go through.</span> Update your card to keep your plan and credits coming.</span>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => pay.run("card", () => openBillingPortal({ flow: "payment_method", returnPath: "/settings?tab=billing&from=portal" }))}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-[12.5px] font-bold text-[#1B1403] hover:bg-amber-200 disabled:opacity-60"
      >
        {busy
          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" aria-hidden="true" />
          : <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
        Update card
      </button>
    </div>
  );
}
