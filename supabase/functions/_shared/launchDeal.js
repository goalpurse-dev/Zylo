// _shared/launchDeal.js — the "In This Town" launch deal (owner, 2026-11-19): the Starter plan is 20% off the first
// month, for new paying customers only (never paid Zyvo before), applied by itself at checkout (no code), until
// Sunday 22 Nov 23:59 Finnish time. ONE file read by everything: create-checkout-session (the real limit: it adds
// the Stripe coupon only while the deal runs, only to Starter monthly, only for someone who never paid), the
// pricing page, the In This Town page and the email. The Stripe coupon itself also stops at the same moment
// (redeem_by) and applies once (duration "once" = the first invoice only). After endsAt everything turns itself
// off: no discount, nothing shown. No deploy needed. Plain JS (no imports): the website, the edge functions and the
// tests share it.

export const LAUNCH_DEAL = {
  id: "town_launch_starter20_2026_11",
  // The Stripe coupon (live): percent_off 20, duration once, redeem_by = endsAt, only the Starter product.
  coupon: "TOWN_LAUNCH_STARTER20",
  percentOff: 20,
  plan: "starter",
  billing: "monthly",
  // From Thursday 19 Nov 2026 00:00 in Helsinki …
  startsAt: "2026-11-18T22:00:00.000Z",
  // … until Sunday 22 Nov 2026 23:59:59 in Helsinki (EET, UTC+2) = 21:59:59.999 UTC.
  endsAt: "2026-11-22T21:59:59.999Z",
};

const ms = (t) => (t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t));

/** Is the deal running at this moment? */
export function launchDealLive(at = Date.now(), deal = LAUNCH_DEAL) {
  const t = ms(at);
  return Number.isFinite(t) && t >= ms(deal.startsAt) && t <= ms(deal.endsAt);
}

/** Milliseconds left (0 when over or not started). */
export function launchDealMsLeft(at = Date.now(), deal = LAUNCH_DEAL) {
  return launchDealLive(at, deal) ? Math.max(0, ms(deal.endsAt) - ms(at)) : 0;
}

/** The first month's price for a monthly price (in the same unit), e.g. 18 → 14.4, 1800 cents → 1440. */
export function launchDealPrice(amount, deal = LAUNCH_DEAL) {
  return Math.round(amount * (100 - deal.percentOff)) / 100;
}

/**
 * Does this checkout get the deal? → { apply: true } or { apply: false, why }.
 *   plan, billing   what is being bought ("starter", "monthly")
 *   at              the checkout time (now)
 *   paidBefore      true if this account (or its email) ever paid Zyvo: a plan, a renewal or a top-up
 *                   (null = couldn't be checked: no deal, so "new customers only" always holds)
 */
export function launchDealFor({ plan, billing, at = Date.now(), paidBefore }, deal = LAUNCH_DEAL) {
  if (!launchDealLive(at, deal)) return { apply: false, why: "outside the deal window" };
  if (plan !== deal.plan || billing !== deal.billing) return { apply: false, why: "not Starter monthly" };
  if (paidBefore == null) return { apply: false, why: "could not check earlier payments" };
  if (paidBefore) return { apply: false, why: "paid before" };
  return { apply: true };
}

/**
 * When an open Stripe checkout with the deal stops working (unix seconds): the deal's end, but Stripe wants 30 min
 * to 24 h from now. So a checkout opened in the last half hour can be finished up to 30 minutes after the end.
 */
export function launchDealCheckoutExpiry(at = Date.now(), deal = LAUNCH_DEAL) {
  const now = Math.floor(ms(at) / 1000);
  const end = Math.floor(ms(deal.endsAt) / 1000) + 1;
  return Math.min(now + 23 * 3600, Math.max(now + 31 * 60, end));
}

/** The email line (owner's words). */
export const LAUNCH_DEAL_EMAIL_LINE = "Launch deal: Starter is 20% off your first month, until Sunday.";
