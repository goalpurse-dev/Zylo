// Feature flags: a global switch in the database, a per-user flag, and an
// optional build-time emergency override.
//
// A flag is on when:
//   - the build override is not "false" (VITE_FRUIT_V2=false turns fruit_v2
//     off for everyone in that build; unset = follow the database), AND
//   - the global switch public.global_feature_flags[<flag>] is on (everyone,
//     guests included), OR the user's own public.user_feature_flags row has
//     { "<flag>": true } (testers keep the feature when the switch is off).
//
// Both tables are read-only from the browser; flip them with SQL
// (supabase/migrations/20261001120000_global_feature_flags.sql and
// 20261012150000_user_feature_flags.sql). The global switch is read on page
// load, so a flip reaches every user on their next page load, no redeploy.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/** Build-time overrides (Vite env): only an explicit "false" does anything. */
export const BUILD_OFF = {
  fruit_v2: import.meta.env.VITE_FRUIT_V2 === "false",
};

const CACHE_KEY = "zyvo_feature_flags_v1";
const GLOBAL_CACHE_KEY = "zyvo_global_flags_v1";
const GLOBAL_TTL_MS = 30 * 1000;
const memory = new Map(); // userId -> Promise<flags>
let globalMemory = null; // { at, promise }

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

function readGlobalCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(GLOBAL_CACHE_KEY) || "null");
    return cached && typeof cached === "object" ? cached : null;
  } catch {
    return null;
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

/**
 * The global switches { fruit_v2: true, ... } (fresh every 30 s). On a failure
 * the last known value is used, else {} (every switch off).
 */
export function fetchGlobalFlags() {
  if (!globalMemory || Date.now() - globalMemory.at > GLOBAL_TTL_MS) {
    globalMemory = {
      at: Date.now(),
      promise: (async () => {
        const { data, error } = await supabase.from("global_feature_flags").select("key, enabled");
        if (error || !Array.isArray(data)) throw new Error(error?.message || "GLOBAL_FLAGS_UNAVAILABLE");
        const flags = Object.fromEntries(data.map((r) => [r.key, r.enabled === true]));
        try { localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify(flags)); } catch { /* non-fatal */ }
        return flags;
      })().catch(() => readGlobalCache() ?? {}),
    };
  }
  return globalMemory.promise;
}

/** Pure check (tested): build override, then global switch OR the user's flag. */
export function isFeatureEnabled(name, userFlags, globalFlags = {}) {
  if (BUILD_OFF[name] === true) return false;
  return globalFlags?.[name] === true || userFlags?.[name] === true;
}

/** AI Fruit Story v2 for this user (see isFeatureEnabled). */
export function isFruitV2Enabled(userFlags, globalFlags) {
  return isFeatureEnabled("fruit_v2", userFlags, globalFlags);
}

/**
 * { enabled, loading } for one flag and the given user (or a guest, userId
 * null). The last known values are used immediately (no flash), then
 * refreshed from the server.
 */
export function useFeatureFlag(name, userId) {
  const [state, setState] = useState(() => {
    if (BUILD_OFF[name] === true) return { enabled: false, loading: false };
    const cachedGlobal = readGlobalCache();
    const cachedUser = userId ? readCache(userId) : {};
    if (!cachedGlobal || !cachedUser) return { enabled: false, loading: true };
    return { enabled: isFeatureEnabled(name, cachedUser, cachedGlobal), loading: false };
  });

  useEffect(() => {
    if (BUILD_OFF[name] === true) {
      setState({ enabled: false, loading: false });
      return undefined;
    }
    let cancelled = false;
    Promise.all([fetchGlobalFlags(), fetchUserFlags(userId)]).then(([globalFlags, userFlags]) => {
      if (!cancelled) setState({ enabled: isFeatureEnabled(name, userFlags, globalFlags), loading: false });
    });
    return () => { cancelled = true; };
  }, [name, userId]);

  return state;
}
