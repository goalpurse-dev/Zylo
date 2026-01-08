import { useEffect, useState } from "react";
import { supabase } from "./../lib/supabaseClient";

export function useProfileCredits() {
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Not logged in → show 0 credits
      if (!user?.id) {
        mounted && setCredits(0);
        return;
      }

      // Initial fetch
      const { data } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .single();

      if (mounted) {
        setCredits(data?.credit_balance ?? 0);
      }

      // Realtime updates
      channel = supabase
        .channel(`credits_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const next = payload?.new?.credit_balance;
            if (typeof next === "number") {
              setCredits(next);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return credits;
}
