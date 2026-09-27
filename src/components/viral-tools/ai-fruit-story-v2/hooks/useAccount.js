import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { supabase } from "../../../../lib/supabaseClient";
import { useProfileCredits } from "../../../../hooks/useProfileCredits";
import { getAllowedVideoModels } from "../../../../lib/planGating";
import { TIERS, TIER_IDS } from "../pricing/fruitV2Estimates";

const PLAN_CACHE_KEY = "zyvo_fruit_plan"; // shared with the current tool
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
 * Plan, paywall and credit balance for v2.
 *
 * Real mode: plan from profiles (paywall for guests and free plans, like the
 * current tool), balance from useProfileCredits. The mock backend charges
 * nothing, so spend() only moves the balance in preview mode.
 *
 * Dev preview mode ({ plan, credits }): no sign-in, no paywall, a local
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
      setPaywall({ open: true, guest: true });
      return undefined;
    }
    let active = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error }) => {
      if (!active) return;
      if (error) { setPlanCode(null); return; } // don't lock paid users out on a failed read
      const code = String(data?.plan_code || "free").toLowerCase();
      cachePlan(user.id, code);
      setPlanCode(code);
      // Same rule as the current tool: only guests and the free plan are gated.
      setPaywall({ open: code === "free", guest: false });
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
