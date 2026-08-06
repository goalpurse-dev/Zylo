// src/lib/planGating.js
// Shared plan-tier gating for premium video model tiers (Clay Rescue, AI Fruit
// Story, etc). The UI uses this to lock/unlock pills; the real enforcement
// lives server-side in supabase/functions/job-worker/index.ts, which has its
// own copy of this same tier ordering (Deno functions can't import from src/lib
// at runtime the same way, so keep both in sync if the tier order ever changes).

export const PLAN_TIER_ORDER = ["free", "starter", "pro", "generative"];
export const PLAN_LABELS = { starter: "Starter", pro: "Pro", generative: "Generative" };

export function planTierIndex(planCode) {
  const idx = PLAN_TIER_ORDER.indexOf(String(planCode ?? "").toLowerCase().trim());
  return idx === -1 ? 0 : idx;
}

/**
 * Returns the list of model ids allowed for a given plan.
 * @param {string} planCode - the user's plan_code ("starter", "pro", "generative", "affiliate", ...)
 * @param {Record<string,string>} minPlanMap - modelId -> minimum required plan tier
 */
export function getAllowedVideoModels(planCode, minPlanMap) {
  const code = String(planCode ?? "").toLowerCase().trim();
  // Affiliates get every template, but only its entry-level ("v2") tier —
  // every tool's *-v2 model is gated to "starter" by convention, so this
  // mirrors job-worker's PLAN_GATED_TOOLS enforcement, where every v2
  // tool_key is simply absent from the map (unconditionally allowed) and
  // every v3/v4 tool_key requires pro/generative, both above affiliate.
  if (code === "affiliate") {
    return Object.keys(minPlanMap).filter((id) => minPlanMap[id] === "starter");
  }

  const userTier = planTierIndex(code);
  return Object.keys(minPlanMap).filter(
    (id) => planTierIndex(minPlanMap[id]) <= userTier,
  );
}
