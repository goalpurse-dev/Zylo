import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { supabase } from "../../../../lib/supabaseClient";
import { useProfileCredits } from "../../../../hooks/useProfileCredits";
import { getAllowedVideoModels } from "../../../../lib/planGating";
import { TIERS, TIER_IDS } from "../pricing/blockyEstimates";

const PLAN_CACHE_KEY = "zyvo_blocky_plan";
const MIN_PLAN = Object.fromEntries(TIER_IDS.map((id) => [id, TIERS[id].minPlan]));

function cachedPlan(userId) {
  try {
    const d = JSON.parse(localStorage.getItem(PLAN_CACHE_KEY) || "{}");
    return d.id === userId ? d.code : null;
  } catch {
    return null;
  }
}

function cachePlan(userId, code) {
  try { localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ id: userId, code })); } catch { /* storage off */ }
}

/**
 * Plan, paywall and credit balance.
 *
 * Plan from profiles (the paywall opens when a guest or free plan tries to
 * make something), balance from useProfileCredits: the one credit balance the
 * whole app shares.
 *
 * preview ({ plan, credits }), for tests: no sign-in, no paywall, a local
 * balance that spend() lowers so "not enough credits" can be tested.
 */
export default function useAccount(preview) {
  const { user, loading: authLoading } = useAuth();
  const realBalance = useProfileCredits();
  const [previewBalance, setPreviewBalance] = useState(preview?.credits ?? 0);
  const [planCode, setPlanCode] = useState(() => {
    if (preview) return preview.plan;
    if (authLoading) return null;
    if (!user) return "guest";
    return cachedPlan(user.id) ?? null;
  });
  const [paywall, setPaywall] = useState({ open: false, guest: false });

  useEffect(() => {
    if (preview || authLoading) return undefined;
    if (!user) {
      setPlanCode("guest");
      setPaywall({ open: false, guest: true });   // guests see the example first; the paywall opens on an action
      return undefined;
    }
    let active = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error }) => {
      if (!active) return;
      if (error) { setPlanCode(null); return; } // don't lock paid users out on a failed read
      const code = String(data?.plan_code || "free").toLowerCase();
      cachePlan(user.id, code);
      setPlanCode(code);
      // Only guests and the free plan are gated.
      setPaywall({ open: false, guest: false });   // free plan: the example + "Get a plan"; opens on an action
    });
    return () => { active = false; };
  }, [preview, authLoading, user]);

  const needsUpgrade = !preview && (planCode === "guest" || planCode === "free");
  const allowedTiers = getAllowedVideoModels(planCode ?? "starter", MIN_PLAN);

  const spend = useCallback((amount) => {
    if (preview && Number.isFinite(amount)) setPreviewBalance((b) => Math.max(0, b - amount));
  }, [preview]);

  return {
    user,
    isPreview: Boolean(preview),
    /** Who is looking: "guest" | "noPlan" | "paid" (dev preview counts as paid). */
    viewer: preview ? (preview.viewer ?? "paid") : !user ? "guest" : planCode === "free" ? "noPlan" : "paid",
    planCode,
    allowedTiers,
    needsUpgrade,
    balance: preview ? previewBalance : realBalance,
    spend,
    paywall: {
      ...paywall,
      show: () => setPaywall({ open: true, guest: planCode === "guest" }),
      close: () => setPaywall((p) => ({ ...p, open: false })),
    },
  };
}
