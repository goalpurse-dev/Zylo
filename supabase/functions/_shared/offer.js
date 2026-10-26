// _shared/offer.js — the limited-time offer (owner, 2026-10-26): +50 bonus credits when someone
// buys or upgrades to a plan (Starter, Pro, Generative), once per account, until Sunday 1 Nov
// 23:59 Finnish time. ONE file read by everything: the Stripe webhook (the real limit, checked
// with the payment time), the pricing page, the home news bar, the success page and the emails.
// After endsAt everything turns itself off: no bonus, nothing shown. No deploy needed.
// Plain JS (no imports), so the website, the edge functions and the tests share it.

export const OFFER = {
  id: "bonus50_2026_10",
  bonusCredits: 50,
  // From when it went live (2026-10-26) …
  startsAt: "2026-10-26T22:00:00.000Z",
  // … until Sunday 1 Nov 2026 23:59:59 in Helsinki (EET, UTC+2 after 25 Oct) = 21:59:59.999 UTC.
  endsAt: "2026-11-01T21:59:59.999Z",
  plans: ["starter", "pro", "generative"],
};

const ms = (t) => (t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t));

/** Is the offer running at this moment (now, or a payment's time)? */
export function offerLive(at = Date.now(), offer = OFFER) {
  const t = ms(at);
  return Number.isFinite(t) && t >= ms(offer.startsAt) && t <= ms(offer.endsAt);
}

/** Milliseconds left (0 when over or not started). */
export function offerMsLeft(at = Date.now(), offer = OFFER) {
  return offerLive(at, offer) ? Math.max(0, ms(offer.endsAt) - ms(at)) : 0;
}

/** "3d 04h 12m 09s" / "4h 12m 09s" / "12m 09s". */
export function formatCountdown(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}h ${p(m)}m ${p(sec)}s`;
  if (h > 0) return `${h}h ${p(m)}m ${p(sec)}s`;
  return `${m}m ${p(sec)}s`;
}

const RANK = { free: 0, starter: 1, pro: 2, generative: 3 };

/**
 * Does this paid Stripe invoice earn the bonus? (The webhook asks; the database then makes sure
 * it is given once per account.) → { eligible: true } or { eligible: false, why }.
 *   billingReason   invoice.billing_reason: "subscription_create" (a plan bought),
 *                   "subscription_update" (a plan change), "subscription_cycle" (a renewal), …
 *   planAfter       the plan this invoice pays for
 *   planBefore      the account's plan before this payment
 *   paidAt          the payment time (invoice.status_transitions.paid_at), not "now"
 * A credit top-up is a one-off checkout payment, never a subscription invoice: it never gets here.
 */
export function offerBonusFor({ billingReason, planAfter, planBefore, paidAt }, offer = OFFER) {
  if (!offerLive(paidAt, offer)) return { eligible: false, why: "paid outside the offer window" };
  if (!offer.plans.includes(String(planAfter ?? ""))) return { eligible: false, why: "not a plan purchase" };
  if (billingReason === "subscription_create") return { eligible: true };
  if (billingReason === "subscription_update") {
    return (RANK[planAfter] ?? 0) > (RANK[String(planBefore ?? "free")] ?? 0)
      ? { eligible: true }
      : { eligible: false, why: "not an upgrade (same or smaller plan)" };
  }
  return { eligible: false, why: `not a purchase or an upgrade (${billingReason ?? "no billing reason"})` };
}

/** The line the warm-up emails carry while the offer is live (owner's words). */
export const OFFER_EMAIL_LINE = "This week only: get 50 bonus credits on top of any plan you upgrade to. Ends Sunday.";
