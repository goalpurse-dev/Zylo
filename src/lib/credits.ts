// src/lib/credits.ts
import { supabase } from "./supabaseClient";

export async function getMyCredits(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return 0;

  const { data, error } = await supabase
    .from("user_balances")
    .select("credits")
    .eq("user_id", uid)
    .single();

  if (error || !data) return 0;
  return data.credits ?? 0;
}

// Lightweight realtime subscription to keep a badge fresh.
export function subscribeCredits(onChange: (credits: number) => void) {
  const ch = supabase
    .channel("credits-self")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_balances" },
      (payload) => {
        const row = payload.new as { credits?: number } | null;
        if (row?.credits != null) onChange(row.credits);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}
