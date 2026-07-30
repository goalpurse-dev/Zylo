const EVENT_NAME = "zylo:credit-spend";

// Fires the global "credits spent" pop animation shown under the credit
// counter in the workspace header (see CreditSpendPopup.jsx). Called from
// jobs.ts whenever a credit-charging job is created — one event per job, so
// multi-scene generations pop once per scene/job rather than one aggregate
// number. Purely cosmetic: the real deduction happens server-side.
export function emitCreditSpend(amount) {
  const n = Number(amount);
  if (typeof window === "undefined" || !Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amount: Math.round(n) },
    })
  );
}

export function onCreditSpend(handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
