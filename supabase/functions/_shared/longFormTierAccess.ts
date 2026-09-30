// deno-lint-ignore-file no-explicit-any
// Long Form tier prices and plan access, from public.tool_prices (longform:v2
// / v3 / v4: flat_credits = credits per minute, min_plan = lowest plan that
// may use the tier). quote-long-form-project, create-long-form-production-
// setup and save-long-form-scene-tier all go through loadLongFormTier, so the
// price a user sees, the price reserved and the pricing page share one row,
// and a tier above the user's plan is refused before anything is saved.
import type { RenderTier } from "./longFormProjectQuote.ts";

export const LONG_FORM_TIERS: RenderTier[] = ["v2", "v3", "v4"];
export const longFormTierToolKey = (tier: RenderTier) => `longform:${tier}`;

const PLAN_ORDER = ["free", "starter", "pro", "generative"];
export const PLAN_NAMES: Record<string, string> = { starter: "Starter", pro: "Pro", generative: "Generative" };

/** Plan rank; affiliates get the entry tier only (same as planGating.js). */
export function planRank(planCode: string | null | undefined): number {
  const code = String(planCode ?? "free").toLowerCase().trim();
  if (code === "affiliate") return 1;
  const idx = PLAN_ORDER.indexOf(code);
  return idx === -1 ? 0 : idx;
}

export function planAllows(planCode: string | null | undefined, minPlan: string | null | undefined): boolean {
  return planRank(planCode) >= planRank(minPlan ?? "free");
}

export type LongFormTierAccess =
  | { ok: true; creditsPerMinute: number; minPlan: string | null; userPlan: string }
  | { ok: false; code: "PLAN_UPGRADE_REQUIRED" | "NO_SERVER_PRICE"; minPlan?: string | null; userPlan?: string; message: string };

/** Decides access from an already-loaded price row and plan (pure; tested). */
export function tierAccessFrom(tier: RenderTier, row: { flat_credits?: number | null; min_plan?: string | null } | null, userPlan: string): LongFormTierAccess {
  const perMinute = Number(row?.flat_credits);
  if (!row || !(perMinute > 0)) return { ok: false, code: "NO_SERVER_PRICE", message: "Long Form prices couldn't be loaded. Please try again." };
  const minPlan = row.min_plan ?? null;
  if (!planAllows(userPlan, minPlan)) {
    return {
      ok: false, code: "PLAN_UPGRADE_REQUIRED", minPlan, userPlan,
      message: `${tier.toUpperCase()} needs the ${PLAN_NAMES[minPlan ?? ""] ?? minPlan} plan. Upgrade to use it, or pick a lower quality.`,
    };
  }
  return { ok: true, creditsPerMinute: perMinute, minPlan, userPlan };
}

/** Loads the tier's price row and the user's plan, then decides access. */
export async function loadLongFormTier(admin: any, userId: string, tier: RenderTier): Promise<LongFormTierAccess> {
  const [{ data: row }, { data: profile }] = await Promise.all([
    admin.from("tool_prices").select("flat_credits, min_plan").eq("tool_key", longFormTierToolKey(tier)).eq("active", true).maybeSingle(),
    admin.from("profiles").select("plan_code").eq("id", userId).maybeSingle(),
  ]);
  const userPlan = String(profile?.plan_code ?? "free").toLowerCase().trim();
  return tierAccessFrom(tier, row ?? null, userPlan);
}
