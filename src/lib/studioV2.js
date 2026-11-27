// Studio v2 in the browser: is the new UI on for this account? (owner 2026-11-27: owner-only, decided on the SERVER)
// The answer is maestro-api's { action: "access" } (supabase/functions/_shared/studioV2/access.js). The browser only
// remembers it for 10 minutes. Anything but a clear "yes" (signed out, still loading, an error, an old answer for
// another account) shows today's site. A signed-out visitor never asks.
// Localhost with ?mock=1 (the pages' mock mode, never in a production build) shows it without asking.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "./supabaseClient";

const KEY = "zyvo_studio_v2_v1";
export const STUDIO_V2_TTL_MS = 10 * 60 * 1000;
export const STUDIO_V2_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";
const asking = new Map(); // userId -> Promise<boolean>

/** the remembered answer for this account, if it is fresh: true / false, or null */
export function rememberedStudioV2(userId, now = Date.now()) {
  if (!userId) return false;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!c || c.userId !== userId || !(now - Number(c.at) < STUDIO_V2_TTL_MS)) return null;
    return c.allowed === true;
  } catch { return null; }
}

/** asks the server (once at a time per account); an error is "no" and is not remembered */
export function askStudioV2(userId) {
  if (!userId) return Promise.resolve(false);
  if (!asking.has(userId)) {
    asking.set(userId, (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("maestro-api", { body: { action: "access" } });
        if (error) return false;
        const allowed = data?.studioV2 === true;
        try { localStorage.setItem(KEY, JSON.stringify({ userId, allowed, at: Date.now() })); } catch { /* no storage */ }
        return allowed;
      } catch { return false; } finally { setTimeout(() => asking.delete(userId), 1000); }
    })());
  }
  return asking.get(userId);
}

/** { on, ready }: on = show the new UI; ready = the server has answered (or there is nothing to ask) */
export function useStudioV2() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const start = () => {
    if (STUDIO_V2_MOCK) return { on: true, ready: true };
    if (!userId) return { on: false, ready: !loading };
    const r = rememberedStudioV2(userId);
    return r == null ? { on: false, ready: false } : { on: r, ready: true };
  };
  const [state, setState] = useState(start);
  useEffect(() => {
    if (STUDIO_V2_MOCK) return undefined;
    if (!userId) { setState({ on: false, ready: !loading }); return undefined; }
    let live = true;
    const r = rememberedStudioV2(userId);
    if (r != null) setState({ on: r, ready: true });
    else askStudioV2(userId).then((on) => { if (live) setState({ on, ready: true }); });
    return () => { live = false; };
  }, [userId, loading]);
  return state;
}
