const SPEND_EVENT = "zylo:credit-spend";
const REFUND_EVENT = "zylo:credit-refund";

// Fires the global "credits spent" pop animation shown under the credit
// counter in the workspace header (see CreditSpendPopup.jsx). Called ONCE
// per "Generate" click with the full up-front cost — e.g. a 5-scene AI
// Fruit Story shows a single "-28 credits" pop, not one pop per underlying
// image/video job. Purely cosmetic: the real deduction happens server-side.
export function emitCreditSpend(amount, message) {
  const n = Number(amount);
  if (typeof window === "undefined" || !Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(
    new CustomEvent(SPEND_EVENT, {
      detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amount: Math.round(n), message: message ?? null },
    })
  );
}

export function onCreditSpend(handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(SPEND_EVENT, listener);
  return () => window.removeEventListener(SPEND_EVENT, listener);
}

// Green "+N credits" pop — fires when a generation fails (fully or
// partially) and its reserved credits get refunded, mirroring the same
// Roblox-style celebration already used for Footballer's tier-downgrade
// refunds, generalized for any template.
export function emitCreditRefund(amount, message) {
  const n = Number(amount);
  if (typeof window === "undefined" || !Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(
    new CustomEvent(REFUND_EVENT, {
      detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amount: Math.round(n), message: message ?? null },
    })
  );
}

export function onCreditRefund(handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(REFUND_EVENT, listener);
  return () => window.removeEventListener(REFUND_EVENT, listener);
}
