// src/hooks/useCredits.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup = () => {};

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) { setCredits(0); return; }

      // initial fetch
      const initial = await supabase
        .from("user_balances")
        .select("credits")
        .eq("user_id", uid)
        .maybeSingle();
      if (mounted) setCredits(initial.data?.credits ?? 0);

      // realtime: update when this user's balance changes
      const ch = supabase
        .channel("ubalance:" + uid)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_balances", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (!mounted) return;
            const next = (payload.new as any)?.credits ?? null;
            if (next !== null) setCredits(next);
          }
        )
        .subscribe();

      // optional: refresh when tab regains focus
      const onVis = async () => {
        if (document.visibilityState === "visible") {
          const r = await supabase
            .from("user_balances")
            .select("credits")
            .eq("user_id", uid)
            .maybeSingle();
          if (mounted) setCredits(r.data?.credits ?? 0);
        }
      };
      document.addEventListener("visibilitychange", onVis);

      cleanup = () => {
        supabase.removeChannel(ch);
        document.removeEventListener("visibilitychange", onVis);
      };
    })();

    return () => { mounted = false; cleanup(); };
  }, []);

  return credits;
}
