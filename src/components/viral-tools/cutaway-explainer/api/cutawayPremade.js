// Cutaway Explainer: which premade topics are on sale now. Only topics with an owner-approved layout are premade (the
// server's rule, cutaway-api serverQuote); the `access` action lists them. Asked once per browser session.
// While unknown: null. If it can't be read: [] (every topic quotes as custom, the higher price, so the page never
// shows less than the server charges). The demo and the local runner use the catalog's ready topics.
// The same answer says whether custom topics are open (customOpen): "Coming soon" until the owner switches them on
// (the launch is premade only, 2026-10-26); unknown or unreadable counts as closed, as the server refuses them anyway.
import { useEffect, useState } from "react";
import { KIT_TOPICS } from "../../../../data/cutawayTopics";

const KEY = "zyvo_cutaway_premade_v2";
let pending = null;

function fetchAccess() {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (d && Array.isArray(d.keys)) return Promise.resolve(d);
  } catch { /* storage off: ask */ }
  pending ??= (async () => {
    try {
      const { supabase } = await import("../../../../lib/supabaseClient");
      const { data, error } = await supabase.functions.invoke("cutaway-api", { body: { action: "access" } });
      if (error || !Array.isArray(data?.premade)) return { keys: [], customOpen: false };
      const value = { keys: data.premade.map((p) => p.key).filter(Boolean), customOpen: data.customOpen === true };
      try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* not kept */ }
      return value;
    } catch {
      return { keys: [], customOpen: false };
    } finally {
      pending = null;
    }
  })();
  return pending;
}

function useAccess(mode) {
  const [value, setValue] = useState(() => (mode === "server" ? null : { keys: KIT_TOPICS.filter((t) => t.ready).map((t) => t.key), customOpen: true }));
  useEffect(() => {
    if (mode !== "server") return undefined;
    let live = true;
    fetchAccess().then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, [mode]);
  return value;
}

/** The approved premade keys: null while loading, then an array. mode "server" asks; "mock"/"local" use the catalog. */
export default function useCutawayPremade(mode = "server") {
  return useAccess(mode)?.keys ?? null;
}

/** Custom topics open for this user: null while loading, then true or false ("Coming soon"). */
export function useCutawayCustomOpen(mode = "server") {
  const v = useAccess(mode);
  return v ? v.customOpen : null;
}
