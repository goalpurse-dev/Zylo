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
 * Who is looking, their plan and their credit balance.
 *
 * Plan from profiles, balance from useProfileCredits: the one credit balance the
 * whole app shares. What a guest or the free plan may do is decided where the
 * buttons are (useBlockyFlow#guard) and again on the server.
 *
 * preview ({ plan, credits }), for tests: no sign-in, a local balance that
 * spend() lowers so "not enough credits" can be tested.
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

  useEffect(() => {
    if (preview || authLoading) return undefined;
    if (!user) {
      setPlanCode("guest");
      return undefined;
    }
    let active = true;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data, error }) => {
      if (!active) return;
      if (error) { setPlanCode(null); return; } // don't lock paid users out on a failed read
      const code = String(data?.plan_code || "free").toLowerCase();
      cachePlan(user.id, code);
      setPlanCode(code);
    });
    return () => { active = false; };
  }, [preview, authLoading, user]);

  const needsUpgrade = !preview && (planCode === "guest" || planCode === "free");
  // A guest and the free plan see V2 open and V3, V4 locked, like Starter: what stops them is the button
  // (sign up, or get a plan), not three locks. Paid plans: Starter V2, Pro V2 and V3, Generative all three.
  const allowedTiers = getAllowedVideoModels(needsUpgrade ? "starter" : planCode ?? "starter", MIN_PLAN);

  const spend = useCallback((amount) => {
    if (preview && Number.isFinite(amount)) setPreviewBalance((b) => Math.max(0, b - amount));
  }, [preview]);

  return {
    user,
    isPreview: Boolean(preview),
    /** Who is looking: "guest" | "noPlan" | "paid" (dev preview counts as paid; so does anyone until the sign-in is known). */
    viewer: preview ? (preview.viewer ?? "paid") : authLoading ? "paid" : !user ? "guest" : planCode === "free" ? "noPlan" : "paid",
    planCode,
    allowedTiers,
    needsUpgrade,
    balance: preview ? previewBalance : realBalance,
    spend,
  };
}
