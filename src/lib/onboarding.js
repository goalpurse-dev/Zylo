// The new-user flow's small helpers: the account's place in it (onboarding_status), the funnel, the sign-up route.
import { supabase } from "./supabaseClient";

export const FIRST_VIDEO_PATH = "/welcome/first-video";
export const EMAIL_CONSENT_TEXT = "Get tips, templates and offers by email";

// Which door a sign-up came through. Kept in this browser until the account exists (Google leaves the page on the way).
const ROUTE_KEY = "zyvo:signup-route";
export function rememberSignupRoute(route) {
  try { localStorage.setItem(ROUTE_KEY, route); } catch { /* no storage: the route is reported as unknown */ }
}
export function takeSignupRoute() {
  try { const route = localStorage.getItem(ROUTE_KEY); localStorage.removeItem(ROUTE_KEY); return route; } catch { return null; }
}

/** One funnel event. Never throws and never waits: tracking must not get in anyone's way. */
export function trackFunnel(event, props = {}) {
  try { supabase.rpc("track_funnel_event", { p_event: event, p_props: props }).then(() => {}, () => {}); } catch { /* tracking must never break the page */ }
}

// Asked once per account per page load. A failed read means "not in the new flow": the old Welcome screen still works.
let cached = { userId: null, promise: null };
export function fetchOnboardingStatus(userId, { fresh = false } = {}) {
  if (!userId) return Promise.resolve({ enrolled: false });
  if (fresh || cached.userId !== userId || !cached.promise) {
    cached = { userId, promise: supabase.rpc("onboarding_status").then(({ data, error }) => (error || !data ? { enrolled: false, failed: true } : data), () => ({ enrolled: false, failed: true })) };
  }
  return cached.promise;
}

/** A random id for this browser: a weak signal for the free preview's limit (the server stores only its hash). */
export function browserId() {
  const key = "zyvo:browser-id";
  try {
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  } catch { return ""; }
}
