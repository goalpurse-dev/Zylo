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

// The owner's look at the whole flow on any account: /?onboarding=force is a walk-through with the example video (nothing
// saved, charged or rendered), /?onboarding=force&real=1 makes a real 10-second render. Asked of the server first: only the
// owner gets an answer from opsStatus. The mark in this tab only changes what this page shows; real=1 is refused by the
// server for anyone else.
const ADMIN_PREVIEW_KEY = "zyvo:onboarding-admin-preview";
export const DEMO_VIDEO = "/cutaway-explainer/example-french-drain-clean.mp4";
export const DEMO_POSTER = "/cutaway-explainer/example-french-drain.jpg";
export const DEMO_STATE = {
  on: true, plan: "free", preview: null, finish: null, demo: true,
  topics: [
    { key: "french_drain", topic: "How a French drain works", poster: DEMO_POSTER },
    { key: "landfill", topic: "What's inside a landfill", poster: "/cutaway-explainer/example-landfill.jpg" },
  ],
};
export function adminPreviewMode() {
  try { return sessionStorage.getItem(ADMIN_PREVIEW_KEY); } catch { return null; }
}
export function endAdminPreview() {
  try { sessionStorage.removeItem(ADMIN_PREVIEW_KEY); } catch { /* nothing kept */ }
}
export async function beginAdminPreview(mode) {
  const { data, error } = await supabase.functions.invoke("cutaway-api", { body: { action: "opsStatus" } }).catch(() => ({ error: true }));
  if (error || !data) return false;
  try { sessionStorage.setItem(ADMIN_PREVIEW_KEY, mode); } catch { return false; }
  return true;
}

/** One funnel event. Never throws and never waits: tracking must not get in anyone's way. */
export function trackFunnel(event, props = {}) {
  if (adminPreviewMode()) return; // the owner's look doesn't count in the numbers
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
