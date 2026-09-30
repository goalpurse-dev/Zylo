// Long Form tier prices and plan access, read from public.tool_prices
// (longform:v2 / v3 / v4: flat_credits = credits per minute of video,
// min_plan = lowest plan allowed). The same rows the server charges and gates
// with (supabase/functions/_shared/longFormTierAccess.ts), so the Setup page,
// the pricing page and the charge can never disagree.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { planTierIndex } from "./planGating";

export const LONG_FORM_TIERS = ["v2", "v3", "v4"];
const TTL_MS = 10 * 60 * 1000;
let cache = null; // { at, tiers }

/** Plan rank for Long Form; affiliates get the entry tier only (as on the server). */
export function longFormPlanRank(planCode) {
  return String(planCode ?? "").toLowerCase().trim() === "affiliate" ? 1 : planTierIndex(planCode);
}

/** { v2: { perMinute, minPlan }, ... } from tool_prices rows; null if any tier is missing. */
export function tiersFromRows(rows) {
  const tiers = {};
  for (const tier of LONG_FORM_TIERS) {
    const row = (rows ?? []).find((r) => r.tool_key === `longform:${tier}`);
    const perMinute = Number(row?.flat_credits);
    if (!row || !(perMinute > 0)) return null;
    tiers[tier] = { perMinute, minPlan: row.min_plan ?? null };
  }
  return tiers;
}

export function longFormTierAllowed(tiers, tier, planCode) {
  const t = tiers?.[tier];
  return Boolean(t) && longFormPlanRank(planCode) >= longFormPlanRank(t.minPlan ?? "free");
}

export function allowedLongFormTiers(tiers, planCode) {
  return LONG_FORM_TIERS.filter((tier) => longFormTierAllowed(tiers, tier, planCode));
}

/** The best (highest) tier the plan allows, or null when none is. */
export function bestLongFormTier(tiers, planCode) {
  const allowed = allowedLongFormTiers(tiers, planCode);
  return allowed.length ? allowed[allowed.length - 1] : null;
}

/** Credits for one video: ceil(perMinute × minutes), the server's formula. */
export function longFormVideoCredits(tiers, tier, minutes) {
  const perMinute = tiers?.[tier]?.perMinute;
  return perMinute ? Math.ceil(perMinute * minutes) : null;
}

export async function fetchLongFormTiers({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.tiers;
  const { data, error } = await supabase.from("tool_prices").select("tool_key, flat_credits, min_plan").in("tool_key", LONG_FORM_TIERS.map((t) => `longform:${t}`)).eq("active", true);
  if (error) throw new Error(error.message);
  const tiers = tiersFromRows(data);
  if (!tiers) throw new Error("NO_SERVER_PRICE");
  cache = { at: Date.now(), tiers };
  return tiers;
}

/** { status: "loading" | "ready" | "error", tiers, retry } */
export function useLongFormTiers() {
  const [state, setState] = useState(() => (cache && Date.now() - cache.at < TTL_MS ? { status: "ready", tiers: cache.tiers } : { status: "loading", tiers: null }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchLongFormTiers({ fresh: attempt > 0 })
      .then((tiers) => { if (!cancelled) setState({ status: "ready", tiers }); })
      .catch(() => { if (!cancelled) setState({ status: "error", tiers: null }); });
    return () => { cancelled = true; };
  }, [attempt]);
  const retry = useCallback(() => { setState({ status: "loading", tiers: null }); setAttempt((n) => n + 1); }, []);
  return { ...state, retry };
}
