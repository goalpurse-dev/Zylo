// Has a purchase arrived on the profile? Used by the checkout success page,
// which watches the profile until the Stripe webhook has added the plan and
// the credits.

export const PAID_PLANS = ["starter", "pro", "generative"];

/**
 * profile: { plan_code, credit_balance } as it is now.
 * pending: what the account looked like before paying ({ kind: "subscription" |
 *   "topup", credits }), stored by lib/payments when checkout starts; null when
 *   this browser has no record of it.
 * Returns true (arrived), false (not yet: keep checking) or null (nothing to
 * compare with: say "payment received" without claiming more).
 */
export function purchaseArrived(profile, pending) {
  const plan = String(profile?.plan_code || "free").toLowerCase();
  const credits = Number(profile?.credit_balance ?? 0);
  const paid = PAID_PLANS.includes(plan);
  if (!pending) return paid ? true : null;
  if (pending.kind === "topup") return pending.credits == null ? null : credits > pending.credits;
  // A plan: the webhook sets the plan first and adds the credits right after.
  return paid && (pending.credits == null || credits > pending.credits);
}
