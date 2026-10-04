import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Subscription states that pay (or still owe) for the plan. "paid" is what the
// webhook stores after a paid invoice; no status at all is an older row.
const LIVE_STATUSES = ["active", "paid", "trialing", "past_due"];
// A subscription that ended or never started: the account buys a new one in checkout.
const LAPSED_STATUSES = ["unpaid", "incomplete_expired", "canceled"];

const GUEST = { loading: false, signedIn: false, userId: null, plan: "free", hasSub: false, isPaid: false, pastDue: false, lapsed: false };

/**
 * The signed-in user's plan from profiles.plan_code (the value every server
 * gate reads). { loading, signedIn, userId, plan, hasSub, isPaid, pastDue, lapsed };
 * guests get plan "free" and signedIn false.
 *   hasSub   a live subscription: plan changes go through the billing portal
 *   pastDue  the last payment of that subscription failed
 *   lapsed   the last subscription ended or was never paid: plans are bought new
 * refresh: change the number to read the profile again.
 */
export default function usePlanCode(refresh = 0) {
  const [state, setState] = useState({ ...GUEST, loading: true });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setState(GUEST); return; }
      const { data } = await supabase.from("profiles").select("plan_code, stripe_subscription_id, stripe_subscription_status").eq("id", user.id).maybeSingle();
      const plan = String(data?.plan_code || "free").toLowerCase().trim();
      const status = data?.stripe_subscription_status ?? null;
      const lapsed = LAPSED_STATUSES.includes(status);
      const hasSub = Boolean(data?.stripe_subscription_id) && (status == null || LIVE_STATUSES.includes(status));
      if (!cancelled) setState({ loading: false, signedIn: true, userId: user.id, plan, hasSub, isPaid: hasSub || plan !== "free", pastDue: hasSub && status === "past_due", lapsed });
    })().catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, [refresh]);
  return state;
}
