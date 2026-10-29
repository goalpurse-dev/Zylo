// Cutaway Explainer: may this signed-in user see the template while it is off for customers (the owner's test
// mode)? The server's `access` action answers (contract.js: { enabled, tester, ... }). Asked at most once per user
// per browser session, and only when the build switch is off: with CUTAWAY_ENABLED on, everyone sees it anyway.
// Kept apart from cutawayApi.js so the Short Form menu (on every page) loads only this small file.
import { useEffect, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { CUTAWAY_ENABLED } from "../../../../data/cutawayExplainer";

const KEY = "zyvo_cutaway_access";
const pending = new Map(); // userId -> Promise<{ tester, enabled }>

function readCache(userId) {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return d && d.id === userId ? d : null;
  } catch {
    return null;
  }
}

function writeCache(userId, value) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ id: userId, ...value })); } catch { /* storage off: asks again next load */ }
}

/** One `access` call per user and session; a failed call means "not a tester" (and is not cached). */
export function fetchCutawayAccess(userId) {
  const cached = readCache(userId);
  if (cached) return Promise.resolve(cached);
  if (!pending.has(userId)) {
    pending.set(userId, (async () => {
      try {
        const { supabase } = await import("../../../../lib/supabaseClient");
        const { data, error } = await supabase.functions.invoke("cutaway-api", { body: { action: "access" } });
        if (error || !data) return { tester: false, enabled: false, failed: true };
        const value = { tester: data.tester === true, enabled: data.enabled === true };
        writeCache(userId, value);
        return value;
      } catch {
        return { tester: false, enabled: false, failed: true };
      } finally {
        window.setTimeout(() => pending.delete(userId), 0);
      }
    })());
  }
  return pending.get(userId);
}

/**
 * { checking, tester }: checking is true while the answer is not known yet (the page shows a quiet placeholder
 * then, never a redirect). With the build switch on there is nothing to ask: { checking: false, tester: false }.
 * skip: local dev overrides (?as=) never ask.
 */
export default function useCutawayAccess({ skip = false } = {}) {
  const { user, loading } = useAuth() ?? {};
  const userId = user?.id ?? null;
  const ask = !CUTAWAY_ENABLED && !skip;
  const [state, setState] = useState(() => {
    if (!ask) return { checking: false, tester: false };
    if (loading) return { checking: true, tester: false };
    if (!userId) return { checking: false, tester: false };
    const c = readCache(userId);
    return c ? { checking: false, tester: c.tester === true } : { checking: true, tester: false };
  });

  useEffect(() => {
    if (!ask) { setState({ checking: false, tester: false }); return undefined; }
    if (loading) { setState((s) => (s.checking ? s : { checking: true, tester: false })); return undefined; }
    if (!userId) { setState({ checking: false, tester: false }); return undefined; }
    let live = true;
    fetchCutawayAccess(userId).then((v) => { if (live) setState({ checking: false, tester: v.tester === true }); });
    return () => { live = false; };
  }, [ask, loading, userId]);

  return state;
}
