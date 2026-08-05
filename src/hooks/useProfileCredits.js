import { useEffect, useRef, useState } from "react";
import { supabase } from "./../lib/supabaseClient";
import { onCreditSpend, onCreditRefund } from "../lib/creditPopEvents";

export function useProfileCredits() {
  const [credits, setCredits] = useState(0);

  // Displayed value = last known server balance + pending (unconfirmed
  // optimistic spend/refund deltas). We never just overwrite the display
  // with whatever the server says — the realtime subscription fires on
  // ANY update to the profiles row, not only credit_balance changes, and
  // polling can land in the gap before a job's real charge has actually
  // committed server-side. Either one reporting the still-unchanged old
  // balance used to stomp the optimistic "-N" back to its pre-spend value
  // for a moment. Instead, only an ACTUAL change in the server balance
  // reconciles (shrinks) the pending amount, so an unrelated/stale update
  // that reports the same balance we already knew about is a no-op.
  const serverBalanceRef = useRef(0);
  const pendingRef = useRef(0);

  const applyServerBalance = (serverVal) => {
    if (typeof serverVal !== "number") return;
    const delta = serverVal - serverBalanceRef.current;
    if (delta < 0) {
      // A real charge landed — absorb up to |delta| of outstanding pending spend.
      pendingRef.current = Math.min(0, pendingRef.current - delta);
    } else if (delta > 0) {
      // A real grant/refund landed — absorb up to delta of outstanding pending refund.
      pendingRef.current = Math.max(0, pendingRef.current - delta);
    }
    serverBalanceRef.current = serverVal;
    setCredits(Math.max(0, serverVal + pendingRef.current));
  };

  useEffect(() => {
    const unsubSpend = onCreditSpend(({ amount }) => {
      pendingRef.current -= amount;
      setCredits(Math.max(0, serverBalanceRef.current + pendingRef.current));
    });
    const unsubRefund = onCreditRefund(({ amount }) => {
      pendingRef.current += amount;
      setCredits(Math.max(0, serverBalanceRef.current + pendingRef.current));
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
        applyServerBalance(data.credit_balance);
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
            applyServerBalance(payload.new?.credit_balance);
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
