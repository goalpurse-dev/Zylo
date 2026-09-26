// Feature flags: a build-time global switch plus a per-user flag stored
// server-side in public.user_feature_flags (readable by its owner only, never
// writable from the browser; see supabase/migrations/20261012100000).
//
// A flag is on for a user only when BOTH are true:
//   1. the global switch for that feature is on in this build, and
//   2. the user's own row has { "<flag>": true }.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/** Build-time global switches (Vite env). */
export const GLOBAL_FLAGS = {
  fruit_v2: import.meta.env.VITE_FRUIT_V2 === "true",
};

const CACHE_KEY = "zyvo_feature_flags_v1";
const memory = new Map(); // userId -> Promise<flags>

function readCache(userId) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return cached && cached.userId === userId ? cached.flags : null;
  } catch {
    return null;
  }
}

function writeCache(userId, flags) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, flags }));
  } catch {
    // Storage unavailable — the network value is still used.
  }
}

/**
 * The signed-in user's server-side flags. Any failure (no row, table not
 * migrated yet, offline) resolves to {} so every flag reads as off.
 */
export function fetchUserFlags(userId) {
  if (!userId) return Promise.resolve({});
  if (!memory.has(userId)) {
    memory.set(userId, (async () => {
      const { data, error } = await supabase
        .from("user_feature_flags")
        .select("flags")
        .eq("user_id", userId)
        .maybeSingle();
      const flags = !error && data?.flags && typeof data.flags === "object" ? data.flags : {};
      writeCache(userId, flags);
      return flags;
    })().catch(() => ({})));
  }
  return memory.get(userId);
}

/** Pure check: global switch on AND the user's flag set. */
export function isFeatureEnabled(name, userFlags) {
  return GLOBAL_FLAGS[name] === true && userFlags?.[name] === true;
}

/** AI Fruit Story v2 is shown only when VITE_FRUIT_V2=true AND the user's fruit_v2 flag is true. */
export function isFruitV2Enabled(userFlags) {
  return isFeatureEnabled("fruit_v2", userFlags);
}

/**
 * { enabled, loading } for one flag and the given user. When the global
 * switch is off this never touches the network and reports loading=false.
 * The last known value for this user is used immediately (no flash), then
 * refreshed from the server.
 */
export function useFeatureFlag(name, userId) {
  const globalOn = GLOBAL_FLAGS[name] === true;
  const [state, setState] = useState(() => {
    if (!globalOn || !userId) return { enabled: false, loading: false };
    const cached = readCache(userId);
    return cached ? { enabled: cached[name] === true, loading: false } : { enabled: false, loading: true };
  });

  useEffect(() => {
    if (!globalOn || !userId) {
      setState({ enabled: false, loading: false });
      return undefined;
    }
    let cancelled = false;
    fetchUserFlags(userId).then((flags) => {
      if (!cancelled) setState({ enabled: isFeatureEnabled(name, flags), loading: false });
    });
    return () => { cancelled = true; };
  }, [globalOn, name, userId]);

  return state;
}
