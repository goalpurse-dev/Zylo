// Long Form tier prices and plan access, read from public.tool_prices
// (longform:v2 / v3 / v4: flat_credits = credits per minute of video,
// min_plan = lowest plan allowed). The same rows the server charges and gates
// with (supabase/functions/_shared/longFormTierAccess.ts), so the Setup page,
// the pricing page and the charge can never disagree. The math is pure
// (lib/pricingMath); this file loads the rows.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { LONG_FORM_TIERS, tiersFromRows } from "./pricingMath";

export {
  LONG_FORM_TIERS, tiersFromRows, longFormPlanRank, longFormTierAllowed, allowedLongFormTiers, bestLongFormTier, defaultLongFormTier, longFormVideoCredits,
} from "./pricingMath";

const TTL_MS = 10 * 60 * 1000;
let cache = null; // { at, tiers }

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
