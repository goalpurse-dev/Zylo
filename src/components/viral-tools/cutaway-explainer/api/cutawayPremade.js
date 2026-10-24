// Cutaway Explainer: which premade topics are on sale now. Only topics with an owner-approved layout are premade (the
// server's rule, cutaway-api serverQuote); the `access` action lists them. Asked once per browser session.
// While unknown: null. If it can't be read: [] (every topic quotes as custom, the higher price, so the page never
// shows less than the server charges). The demo and the local runner use the catalog's ready topics.
import { useEffect, useState } from "react";
import { KIT_TOPICS } from "../../../../data/cutawayTopics";

const KEY = "zyvo_cutaway_premade";
let pending = null;

function fetchPremade() {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (Array.isArray(d)) return Promise.resolve(d);
  } catch { /* storage off: ask */ }
  pending ??= (async () => {
    try {
      const { supabase } = await import("../../../../lib/supabaseClient");
      const { data, error } = await supabase.functions.invoke("cutaway-api", { body: { action: "access" } });
      if (error || !Array.isArray(data?.premade)) return [];
      const keys = data.premade.map((p) => p.key).filter(Boolean);
      try { sessionStorage.setItem(KEY, JSON.stringify(keys)); } catch { /* not kept */ }
      return keys;
    } catch {
      return [];
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** The approved premade keys: null while loading, then an array. mode "server" asks; "mock"/"local" use the catalog. */
export default function useCutawayPremade(mode = "server") {
  const [keys, setKeys] = useState(() => (mode === "server" ? null : KIT_TOPICS.filter((t) => t.ready).map((t) => t.key)));
  useEffect(() => {
    if (mode !== "server") return undefined;
    let live = true;
    fetchPremade().then((k) => { if (live) setKeys(k); });
    return () => { live = false; };
  }, [mode]);
  return keys;
}
