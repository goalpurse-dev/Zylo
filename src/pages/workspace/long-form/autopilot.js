// Phase 6a — the Stickman "Generate video" autopilot (client side).
// The server chains story plan -> research-lite -> script with no clicks in
// between; the UI only starts it, polls its status and reviews the result.
import { supabase } from "../../../lib/supabaseClient";

export const AUTOPILOT_POLL_MS = 4000;

// The legacy Story / Research / Script pages never show for an autopilot
// (Stickman) project: they redirect to the one progress screen or the review.
// Legacy projects have no autopilot record and are untouched.
export function autopilotRedirectRoute(project) {
  const ap = project?.autopilot;
  if (!ap) return null;
  return ap.status === "done" ? "script-review" : "writing";
}

export async function startAutopilot(projectId, { retry = false } = {}) {
  const { data, error } = await supabase.functions.invoke("start-long-form-autopilot", { body: { projectId, retry } });
  if (error) return { ok: false, message: "Couldn't start writing your script. Try again." };
  watchProject(projectId);
  return { ok: true, autopilot: data?.autopilot ?? null };
}

// "Regenerate script": same plan and facts, a fresh script version.
export async function regenerateScript(projectId) {
  const { error } = await supabase.functions.invoke("start-long-form-autopilot", { body: { projectId, regenerateScript: true } });
  if (error) return { ok: false, message: "Couldn't start a new script. Try again." };
  watchProject(projectId);
  return { ok: true };
}

export async function fetchAutopilotStatus(projectId) {
  const { data, error } = await supabase.functions.invoke("get-long-form-autopilot-status", { body: { projectId } });
  if (error) return null;
  return data;
}

// "You can leave — we'll keep going": projects to notify about when their
// script is ready (per browser, best effort — the server state is the truth).
const WATCH_KEY = "zyvo.longform.autopilotWatch";
export function watchedProjects() {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]"); } catch { return []; }
}
export function watchProject(projectId) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify([...new Set([...watchedProjects(), projectId])])); } catch { /* storage unavailable */ }
}
export function unwatchProject(projectId) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchedProjects().filter((id) => id !== projectId))); } catch { /* storage unavailable */ }
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "About 4–7 min left" from the server's honest [typical, slow] range.
export function formatEta([lo, hi] = [0, 0]) {
  if (!hi) return null;
  const a = Math.max(1, Math.round(lo / 60)), b = Math.max(a, Math.round(hi / 60));
  if (hi < 60) return "Less than a minute left";
  return a === b ? `About ${a} min left` : `About ${a}–${b} min left`;
}
