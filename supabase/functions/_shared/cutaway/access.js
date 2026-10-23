// Cutaway Explainer: who may generate. One rule for the page (button state, the upgrade popup) and the
// cutaway-api server (which enforces it on every action, before anything is charged).
// Starter and above generate (Starter keeps the end card, Pro and above may remove it: endCard.js); affiliates
// get entry-level access like Starter. Free, unknown and unread plans may not generate.
export const PAID_PLANS = Object.freeze(["starter", "pro", "generative", "affiliate"]);

const norm = (code) => String(code ?? "").toLowerCase().trim();

/** True when this plan may generate Cutaway videos. */
export function canGenerate(planCode) {
  return PAID_PLANS.includes(norm(planCode));
}

/**
 * What the page shows for a viewer: "guest" (signed out: "Sign up to generate"), "free" (Generate opens the upgrade
 * popup), "paid" (Generate runs) or "unknown" (the plan is still loading or could not be read: Generate runs and the
 * server decides, so a paid user is never blocked by a failed read).
 */
export function accessFor({ signedIn, planCode }) {
  if (!signedIn) return "guest";
  if (planCode == null) return "unknown";
  return canGenerate(planCode) ? "paid" : "free";
}
