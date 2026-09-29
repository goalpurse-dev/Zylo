// notifyEvents.js — Phase 6c-polish / 6e. Pure helpers for the Long Form
// notifier: the ONE current event of a project's autopilot record, and whether
// the user is already on (or past) that step. Since 6e the run has no stops
// (script -> voice -> scenes), so the only good-news event is "scenes ready";
// a stopped stage says so and opens the generating screen with its free Retry.
// Tested in tests/stickmanPolish6c.test.mjs.
import { STICKMAN_PAGE_STEP, STICKMAN_STEP_ORDER } from "./projectStage.js";

export function autopilotEvent(ap) {
  if (!ap) return null;
  if (ap.phase === "scenes") {
    const sc = ap.scenes ?? {};
    if (sc.status === "done" && !sc.regenerating) return { id: "scenes_ready", at: sc.doneAt, step: "scenes", page: "scenes", kind: "success", title: "Your scenes are ready", final: true };
    if (sc.status === "failed") return { id: "scenes_failed", at: sc.retriedAt ?? sc.startedAt, step: "scenes", page: "generating", kind: "error", title: "Your video needs a retry", final: true };
    return null;
  }
  if (ap.status === "failed") {
    const voice = ap.phase === "narration";
    return { id: voice ? "voice_failed" : "script_failed", at: ap.retriedAt ?? ap.startedAt, step: "scenes", page: "generating", kind: "error", title: voice ? "Your voiceover needs a retry" : "Your script needs a retry", final: true };
  }
  return null;
}

// Is the user already on (or past) this event's step for this project?
export function alreadyThere(pathname, projectId, step) {
  const m = pathname.match(/\/long-form\/project\/([^/]+)\/([^/?#]+)/);
  if (!m || m[1] !== projectId) return false;
  const pageStep = STICKMAN_PAGE_STEP[m[2]] ?? null;
  return pageStep != null && STICKMAN_STEP_ORDER.indexOf(pageStep) >= STICKMAN_STEP_ORDER.indexOf(step);
}
