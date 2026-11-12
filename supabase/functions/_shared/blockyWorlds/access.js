// Blocky Worlds: who may do what. One rule for the page (button states, the upgrade popup) and blocky-worlds-api
// (which enforces it on every action, before anything is charged). The same plan rules as Cutaway's (a copy, so the
// two templates stay independent):
//   ideas: everyone signed in (the free plan a few batches a day, a taste of what a plan makes)
//   scripts and videos: paid plans (Starter and above, affiliates like Starter)
//   end card: on below Pro; Pro and above may remove it
export const PAID_PLANS = Object.freeze(["starter", "pro", "generative", "affiliate"]);
export const PLAN_TIER_ORDER = Object.freeze(["free", "starter", "pro", "generative"]);

const norm = (code) => String(code ?? "").toLowerCase().trim();

export const canWrite = (planCode) => PAID_PLANS.includes(norm(planCode));
export const canGenerate = canWrite;

/** True when this plan may remove the end card (Pro and above; affiliates get entry-level features). */
export function canRemoveEndCard(planCode) {
  const code = norm(planCode);
  if (code === "affiliate") return false;
  return PLAN_TIER_ORDER.indexOf(code) >= PLAN_TIER_ORDER.indexOf("pro");
}
/** Whether the video gets the end card: always, unless the plan allows removing it AND the user asked to. */
export const endCardFor = (planCode, removeRequested) => !(removeRequested === true && canRemoveEndCard(planCode));

/**
 * What the page shows for a viewer: "guest" (signed out: "Sign up to generate"), "free" (ideas only; Write/Generate
 * open the upgrade popup), "paid" or "unknown" (the plan is still loading: the server decides).
 */
export function accessFor({ signedIn, planCode }) {
  if (!signedIn) return "guest";
  if (planCode == null) return "unknown";
  return canWrite(planCode) ? "paid" : "free";
}
