// "Join 21,000+ creators": the real number of accounts, rounded down to the thousand by the database (public_creator_count).
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// What the database said on 2026-11-02 (21,606 accounts). Used until the answer comes, or if it never does.
const LAST_KNOWN = 21000;
let cached = null;

export function useCreatorCount() {
  const [count, setCount] = useState(cached ?? LAST_KNOWN);
  useEffect(() => {
    if (cached) return undefined;
    let live = true;
    supabase.rpc("public_creator_count").then(({ data, error }) => {
      const n = Number(data);
      if (error || !(n >= LAST_KNOWN)) return;
      cached = n;
      if (live) setCount(n);
    }, () => {});
    return () => { live = false; };
  }, []);
  return count;
}
