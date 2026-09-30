import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * The signed-in user's plan from profiles.plan_code (the value every server
 * gate reads). { loading, signedIn, userId, plan, hasSub, isPaid }; guests get
 * plan "free" and signedIn false.
 */
export default function usePlanCode() {
  const [state, setState] = useState({ loading: true, signedIn: false, userId: null, plan: "free", hasSub: false, isPaid: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setState({ loading: false, signedIn: false, userId: null, plan: "free", hasSub: false, isPaid: false }); return; }
      const { data } = await supabase.from("profiles").select("plan_code, stripe_subscription_id").eq("id", user.id).maybeSingle();
      const plan = String(data?.plan_code || "free").toLowerCase().trim();
      const hasSub = Boolean(data?.stripe_subscription_id);
      if (!cancelled) setState({ loading: false, signedIn: true, userId: user.id, plan, hasSub, isPaid: hasSub || plan !== "free" });
    })().catch(() => { if (!cancelled) setState((s) => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, []);
  return state;
}
