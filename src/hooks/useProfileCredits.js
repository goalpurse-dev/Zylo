import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { onCreditSpend, onCreditRefund } from "../lib/creditPopEvents";

export function useProfileCredits() {
  const [credits, setCredits] = useState(0);

  // Applies the full "-N" the moment the spend popup fires, instead of
  // waiting for the underlying jobs to charge one at a time server-side —
  // a 5-scene generation used to visibly drain the counter as -2 -2 -2 -6
  // -6 -6 while the popup already said the full total up front. This is
  // purely optimistic: every real server-side charge/refund still lands via
  // realtime/poll below and overwrites this with the authoritative value,
  // so it can never drift permanently even if the real total differs.
  useEffect(() => {
    const unsubSpend = onCreditSpend(({ amount }) => {
      setCredits((prev) => Math.max(0, prev - amount));
    });
    const unsubRefund = onCreditRefund(({ amount }) => {
      setCredits((prev) => prev + amount);
    });
    return () => { unsubSpend(); unsubRefund(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel = null;
    let pollTimer = null;
    let uid = null;

    const fetchCredits = async () => {
      if (!uid || !mounted) return;
      const { data } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", uid)
        .single();
      if (mounted && data?.credit_balance != null) {
        setCredits(data.credit_balance);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCredits();
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { if (mounted) setCredits(0); return; }
      uid = user.id;

      // Initial fetch
      await fetchCredits();

      // Realtime — filter in callback so it works without REPLICA IDENTITY FULL
      channel = supabase
        .channel(`credits_${uid}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles" },
          (payload) => {
            if (!mounted || payload.new?.id !== uid) return;
            const next = payload.new?.credit_balance;
            if (typeof next === "number") setCredits(next);
          }
        )
        .subscribe();

      // Poll every 10s — catches deductions from Edge Functions that
      // run under the service role key and may not fire Realtime events
      pollTimer = setInterval(fetchCredits, 10_000);

      document.addEventListener("visibilitychange", onVisibility);
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return credits;
}
