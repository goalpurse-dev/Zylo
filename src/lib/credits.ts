// src/lib/credits.ts
import { supabase } from "./supabaseClient";

export async function getMyCredits(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return 0;

  const { data, error } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", uid)
    .single();

  if (error || !data) return 0;

  return data.credit_balance ?? 0;
}

// realtime updates
export function subscribeCredits(onChange: (credits: number) => void) {
  const ch = supabase
    .channel("credits-self")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles"
      },
      (payload) => {
        const row = payload.new as { credit_balance?: number } | null;
        if (row?.credit_balance != null) onChange(row.credit_balance);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(ch);
}