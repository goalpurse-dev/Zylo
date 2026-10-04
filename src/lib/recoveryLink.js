import { supabase } from "./supabaseClient";

// A reset link can be used once. Opening the same email link a second time
// (a double click, or coming back to the email before choosing a password) must
// not look like a broken link: the browser remembers the link it already used,
// for as long as a reset link lives.
const USED_KEY = "zyvo:recovery-link";
const LINK_LIFETIME_MS = 60 * 60 * 1000;

export function rememberRecoveryLink(tokenHash) {
  try { localStorage.setItem(USED_KEY, JSON.stringify({ tokenHash, at: Date.now() })); } catch { /* no storage: a second open asks for a new link */ }
}
export function isRememberedRecoveryLink(tokenHash) {
  try {
    const saved = JSON.parse(localStorage.getItem(USED_KEY) ?? "null");
    return Boolean(saved) && saved.tokenHash === tokenHash && Date.now() - Number(saved.at) < LINK_LIFETIME_MS;
  } catch { return false; }
}
export function forgetRecoveryLink() {
  try { localStorage.removeItem(USED_KEY); } catch { /* nothing to forget */ }
}

// One request per link, however often the page mounts (React StrictMode mounts twice in dev).
const inFlight = new Map();
/** Checks an emailed link with Supabase and signs the browser in. → { data, error } */
export function verifyEmailLink(tokenHash, type) {
  const key = `${type}:${tokenHash}`;
  if (!inFlight.has(key)) inFlight.set(key, supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  return inFlight.get(key);
}
