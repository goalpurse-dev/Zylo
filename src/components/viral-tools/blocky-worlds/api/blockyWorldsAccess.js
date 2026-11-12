// Blocky Worlds: may this visitor see the template at all? The server's `access` action answers (blocky-worlds-api,
// the BLOCKY_WORLDS_ACCESS switch); the menu, the bottom nav, pinned tools and the route all use this one hook.
// Asked at most once per visitor (user id, or "guest") per browser session. FAILS CLOSED: loading = hidden, a failed
// call = hidden (and not cached, so the next page load asks again). Kept apart from blockyWorldsApi.js so the menu
// (on every page) loads only this small file.
import { useEffect, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { accessStatusFrom } from "../../../../data/blockyWorlds";

const KEY = "zyvo_bw_access";
const pending = new Map(); // visitor key -> Promise<"allowed" | "denied">
// local dev with ?mock=1 only (import.meta.env.DEV is false in every build): the free in-browser mock is always open
const DEV_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";

function readCache(who) {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return d && d.who === who && (d.status === "allowed" || d.status === "denied") ? d.status : null;
  } catch {
    return null;
  }
}
function writeCache(who, status) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ who, status })); } catch { /* storage off: asks again next load */ }
}

/** One `access` call per visitor and session. Anything but { visible: true } is "denied". */
export function fetchBlockyWorldsAccess(who) {
  const cached = readCache(who);
  if (cached) return Promise.resolve(cached);
  if (!pending.has(who)) {
    pending.set(who, (async () => {
      try {
        const { supabase } = await import("../../../../lib/supabaseClient");
        const { data, error } = await supabase.functions.invoke("blocky-worlds-api", { body: { action: "access" } });
        if (error || !data) return "denied";
        const status = accessStatusFrom(data);
        writeCache(who, status);
        return status;
      } catch {
        return "denied";
      } finally {
        window.setTimeout(() => pending.delete(who), 0);
      }
    })());
  }
  return pending.get(who);
}

/** "loading" | "allowed" | "denied" for the current visitor. */
export default function useBlockyWorldsAccess() {
  const { user, loading } = useAuth() ?? {};
  const who = user?.id ?? "guest";
  const [state, setState] = useState(() => {
    if (DEV_MOCK) return "allowed";
    if (loading) return "loading";
    return readCache(who) ?? "loading";
  });

  useEffect(() => {
    if (DEV_MOCK) { setState("allowed"); return undefined; }
    if (loading) { setState("loading"); return undefined; }
    let live = true;
    const cached = readCache(who);
    setState(cached ?? "loading");
    if (!cached) fetchBlockyWorldsAccess(who).then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [loading, who]);

  return state;
}
