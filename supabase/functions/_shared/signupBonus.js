// _shared/signupBonus.js: every new account gets +50 bonus credits on its first plan, if it pays within 3 days of its OWN
// sign-up (owner, 2026-11-02). The end time is stored per account (signup_bonuses, set by the database when the account is
// created). ONE file read by the Stripe webhook (the real limit, checked with the payment time) and by the pages. Replaces
// nothing in _shared/offer.js, the old global offer, which has ended and stays ended.
// Plain JS (no imports), so the website, the edge functions and the tests share it.

export const SIGNUP_BONUS = Object.freeze({
  id: "signup_bonus",
  credits: 50,
  days: 3, // the migration's interval '3 days' must match (tests/onboardingFlow.test.mjs)
  plans: Object.freeze(["starter", "pro", "generative"]),
});

const ms = (t) => (t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t));

/** Milliseconds left; 0 when over, unknown or unreadable. */
export function signupBonusMsLeft(expiresAt, at = Date.now()) {
  const end = ms(expiresAt), now = ms(at);
  return Number.isFinite(end) && Number.isFinite(now) ? Math.max(0, end - now) : 0;
}

/** "2 days 14 h" / "1 day 3 h" / "5 h 12 min" / "12 min"; null when over. */
export function signupBonusTimeLeft(expiresAt, at = Date.now()) {
  const left = signupBonusMsLeft(expiresAt, at);
  if (left <= 0) return null;
  const mins = Math.max(1, Math.floor(left / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `${d} ${d === 1 ? "day" : "days"} ${h} h`;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** What the upgrade screen and the Home card say; null when over. */
export function signupBonusLine(expiresAt, at = Date.now()) {
  const left = signupBonusTimeLeft(expiresAt, at);
  return left ? `Your sign-up bonus: +${SIGNUP_BONUS.credits} credits, ends in ${left}` : null;
}

/** For the emails to come. Nothing sends this yet; signup_bonuses.reminder_sent_at is there to send it once. */
export function signupBonusEmailLine(expiresAt, at = Date.now()) {
  const left = signupBonusTimeLeft(expiresAt, at);
  return left ? `Your +${SIGNUP_BONUS.credits} bonus credits are still waiting: start your first plan within ${left}.` : null;
}

/**
 * Does this paid Stripe invoice earn the bonus? (The webhook asks; the database then makes sure it is given once per
 * account.) → { eligible: true } or { eligible: false, why }.
 *   billingReason  invoice.billing_reason: "subscription_create" or "subscription_update" (from free) count
 *   planAfter      the plan this invoice pays for
 *   planBefore     the account's plan before this payment: their FIRST plan only
 *   paidAt         the payment time, not "now"
 *   expiresAt      signup_bonuses.expires_at; none = an account older than the bonus
 */
export function signupBonusFor({ billingReason, planAfter, planBefore, paidAt, expiresAt }, bonus = SIGNUP_BONUS) {
  if (!expiresAt) return { eligible: false, why: "no sign-up bonus on this account" };
  if (signupBonusMsLeft(expiresAt, paidAt) <= 0) return { eligible: false, why: "paid after the bonus ended" };
  if (!bonus.plans.includes(String(planAfter ?? ""))) return { eligible: false, why: "not a plan purchase" };
  if (String(planBefore ?? "free").toLowerCase().trim() !== "free") return { eligible: false, why: "not their first plan" };
  if (billingReason !== "subscription_create" && billingReason !== "subscription_update") return { eligible: false, why: `not a purchase (${billingReason ?? "no billing reason"})` };
  return { eligible: true };
}
