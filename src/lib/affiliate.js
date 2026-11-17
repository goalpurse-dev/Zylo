// The affiliate program in the browser: the affiliate-api calls, and the ?ref=CODE a visitor arrived with
// (kept 60 days in localStorage + a cookie, so it survives the sign-up's redirects). Rules: supabase/functions/_shared/affiliate/config.js
import { supabase } from "./supabaseClient";
import { AFFILIATE } from "../../supabase/functions/_shared/affiliate/config.js";
import { cleanCode, codeProblem } from "../../supabase/functions/_shared/affiliate/rules.js";

export const AFFILIATE_PATH = "/affiliate";
const KEY = "zyvo:ref";
const COOKIE = "zyvo_ref";

export async function affiliateApi(action, body = {}) {
  const { data, error } = await supabase.functions.invoke("affiliate-api", { body: { action, ...body } });
  if (error) {
    let message = "Couldn't reach the server. Try again.";
    let code = null;
    try { const j = await error.context.json(); code = j?.code ?? null; if (j?.message && code !== "NOT_FOUND") message = j.message; } catch { /* no body */ }
    const e = new Error(message);
    e.status = error?.context?.status;
    e.code = code;
    throw e;
  }
  if (!data?.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data.data;
}

/** The stored ref code, or null when there is none or it is older than the window. */
export function readStoredRef() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { code, at } = JSON.parse(raw);
      if (code && Date.now() - at < AFFILIATE.refStorageDays * 86400_000) return code;
    }
  } catch { /* storage unavailable: try the cookie */ }
  const m = document.cookie.match(/(?:^|;\s*)zyvo_ref=([A-Z0-9]{3,20})/);
  return m ? m[1] : null;
}

export function clearStoredRef() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * A ?ref=CODE in the address: remember it (a newer link replaces an older one), count the click once, and
 * take it out of the address bar. Safe to call on every page.
 */
export function captureRefFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("ref");
  if (raw == null) return;
  const code = cleanCode(raw);
  params.delete("ref");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  if (!code || codeProblem(code)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* the cookie still holds it */ }
  document.cookie = `${COOKIE}=${code}; Max-Age=${AFFILIATE.refStorageDays * 86400}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  affiliateApi("click", { code, ua: navigator.userAgent }).catch(() => { /* a lost click never matters to the visitor */ });
}

// Answers that settle the stored link for good (anything else, e.g. a network error, tries again next time).
const FINAL = new Set(["claimed", "already_attributed", "self", "too_old", "already_paid", "unknown_code", "no_profile"]);

/** A new account that arrived through a link and didn't type a code: the link's creator. Once. */
export async function claimFromStoredRef() {
  const code = readStoredRef();
  if (!code) return null;
  try {
    const r = await affiliateApi("claim", { code, source: "link" });
    if (FINAL.has(r?.result)) clearStoredRef();
    return r;
  } catch {
    return null;
  }
}
