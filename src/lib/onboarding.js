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
// What this browser just answered: the first card can say it was picked for them.
const SURVEY_GOALS_KEY = "zyvo:onboarding-goals";
export function rememberSurveyGoals(goals) {
  try { sessionStorage.setItem(SURVEY_GOALS_KEY, JSON.stringify(goals)); } catch { /* the badge just doesn't show */ }
}
export function lastSurveyGoals() {
  try { return JSON.parse(sessionStorage.getItem(SURVEY_GOALS_KEY)) ?? []; } catch { return []; }
}
// Localhost only: VITE_ONBOARDING_LOCAL_TEST=1 in .env.local gives ANY account signed in here that same walk-through, and
// never a real render. DEV is false in every build, so the build drops this: Vercel's previews and production can't have it.
export function localOnboardingTest() {
  return import.meta.env.DEV && import.meta.env.VITE_ONBOARDING_LOCAL_TEST === "1" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}
export function adminPreviewMode() {
  if (localOnboardingTest()) return "demo";
  try { return sessionStorage.getItem(ADMIN_PREVIEW_KEY); } catch { return null; }
}
export function endAdminPreview() {
  try { sessionStorage.removeItem(ADMIN_PREVIEW_KEY); } catch { /* nothing kept */ }
}
export async function beginAdminPreview(mode) {
  if (localOnboardingTest()) return true;
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

/** The welcome email: when "Building your plan" finishes or the survey is skipped. The server decides whether it goes. Never waits, never throws. */
export function requestWelcomeEmail() {
  if (adminPreviewMode()) return;
  try { supabase.functions.invoke("send-welcome-email", { method: "POST", body: { trigger: "plan_finished" } }).catch(() => {}); } catch { /* the flow goes on */ }
}

// Asked once per account per page load. A failed read means "not in the new flow": the old Welcome screen still works.
let cached = { userId: null, promise: null };
export function fetchOnboardingStatus(userId, { fresh = false } = {}) {
  if (!userId) return Promise.resolve({ enrolled: false });
  if (localOnboardingTest()) return Promise.resolve({ enrolled: true, surveyDone: true }); // the real survey, which saves, stays away
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
