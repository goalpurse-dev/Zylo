// stickman/renderRetry.ts — what the render watchdog does with a job (2026-10-07). Pure: tested offline.
//
// A render never just stops:
//   - a job the worker put back in the queue after a temporary error gets a NEW
//     machine at once (machines run one job and exit; the old watchdog called
//     that "the server couldn't start" and failed the render);
//   - a machine that never claimed its job (died at boot) is replaced, up to
//     RENDER_BOOT_TRIES machines, then the job fails;
//   - a job whose machine died mid-render gets a new one, which resumes from the
//     finished segments; on its last attempt it is FAILED (it used to stay
//     "rendering" for ever, because nothing was left to claim it).
// A render that failed for good (3 attempts, or an error a retry can't fix):
// the owner is alerted by email, the user reads RENDER_FIXING_COPY, and the
// render is started again by itself: after 10 minutes, then after an hour.
export const RENDER_FIXING_COPY = "We're fixing your render, it will continue automatically.";
export const STALE_S = 300;
export const QUEUED_NO_MACHINE_S = 150;
export const RENDER_BOOT_TRIES = 3;
// Automatic restarts of a failed render, per project per day, and the wait before each.
export const RENDER_AUTO_RESTARTS = 2;
export const RENDER_RESTART_AFTER_S = [600, 3600];
export const RENDER_RESTART_WINDOW_S = 24 * 3600;
// Put in front of a failed job's error code when its automatic restart was refused (it is tried once, not every minute).
export const RESTART_REFUSED = "RESTART_REFUSED:";

const BOOT_RETRY = /^WORKER_BOOT_RETRY_(\d+)$/;
export type RenderJobLite = { status: string; attempt: number; max_attempts: number; machine_id: string | null; heartbeat_at: string | null; dispatched_at: string | null; created_at: string; updated_at: string | null; error_code: string | null };
export type RenderWatch =
  | { kind: "none" }
  | { kind: "dispatch"; why: "requeued" | "stale" | "no_machine" | "boot_retry"; errorCode?: string }
  | { kind: "fail"; code: "WORKER_BOOT_FAILED" | "ATTEMPTS_EXHAUSTED" };

export function decideRenderWatch(j: RenderJobLite, nowMs: number): RenderWatch {
  const dispatched = Date.parse(j.dispatched_at ?? j.created_at);
  if (j.status === "queued") {
    // Claimed after its last dispatch and queued again: the worker hit a temporary error and exited.
    const requeued = !!j.machine_id && j.attempt > 0 && !!j.updated_at && Date.parse(j.updated_at) > dispatched;
    if (requeued) return j.attempt < j.max_attempts ? { kind: "dispatch", why: "requeued" } : { kind: "fail", code: "ATTEMPTS_EXHAUSTED" };
    if (nowMs - dispatched <= QUEUED_NO_MACHINE_S * 1000) return { kind: "none" };
    if (!j.machine_id) return { kind: "dispatch", why: "no_machine" };
    // A machine was started and never claimed the job: it died at boot. Another one, a few times at most.
    const boots = 1 + Number(BOOT_RETRY.exec(String(j.error_code ?? ""))?.[1] ?? 0);
    return boots < RENDER_BOOT_TRIES ? { kind: "dispatch", why: "boot_retry", errorCode: `WORKER_BOOT_RETRY_${boots}` } : { kind: "fail", code: "WORKER_BOOT_FAILED" };
  }
  if (j.status === "rendering") {
    const stale = !j.heartbeat_at || nowMs - Date.parse(j.heartbeat_at) > STALE_S * 1000;
    if (!stale) return { kind: "none" };
    return j.attempt < j.max_attempts ? { kind: "dispatch", why: "stale" } : { kind: "fail", code: "ATTEMPTS_EXHAUSTED" };
  }
  return { kind: "none" };
}

// A project whose NEWEST render failed: is it started again now, later, or left for a person?
// failedToday = its failed renders in the last 24 h (this one included).
export type RenderRestart = { kind: "restart"; number: number } | { kind: "wait"; inS: number } | { kind: "exhausted" };
export function decideRenderRestart(failedToday: number, lastFinishedAt: string, nowMs: number): RenderRestart {
  if (failedToday > RENDER_AUTO_RESTARTS) return { kind: "exhausted" };
  const number = Math.max(1, failedToday);
  const waitS = RENDER_RESTART_AFTER_S[number - 1] ?? RENDER_RESTART_AFTER_S.at(-1)!;
  const sinceS = (nowMs - Date.parse(lastFinishedAt)) / 1000;
  return sinceS >= waitS ? { kind: "restart", number } : { kind: "wait", inS: Math.ceil(waitS - sinceS) };
}

// The email the owner gets when a render failed for good.
export function renderAlert(a: { projectId: string; jobId: string; errorCode: string; workerReason: string | null; attempt: number; maxAttempts: number; failedToday: number }): { subject: string; text: string } {
  const next = decideRenderRestart(a.failedToday, new Date(0).toISOString(), 0);
  const restartsLeft = next.kind === "exhausted" ? 0 : RENDER_AUTO_RESTARTS - a.failedToday + 1;
  return {
    subject: `Zyvo: a render failed for good (${a.errorCode})${restartsLeft ? "" : " — needs you"}`,
    text: [
      `A Long Form render failed for good.`,
      ``,
      `Project: ${a.projectId}`,
      `Job: ${a.jobId}`,
      `Error: ${a.errorCode}`,
      a.workerReason ? `Worker said: ${a.workerReason}` : null,
      `Attempts: ${a.attempt} of ${a.maxAttempts}`,
      `Failed renders for this project in the last 24 h: ${a.failedToday}`,
      ``,
      restartsLeft
        ? `It is started again automatically (${restartsLeft} automatic restart${restartsLeft === 1 ? "" : "s"} left: after 10 minutes, then after an hour).`
        : `The automatic restarts are used up. It will NOT start again by itself: it needs you.`,
      `The user sees: "${RENDER_FIXING_COPY}"`,
      `Their credits are kept on the project; nothing is charged for the failed render.`,
    ].filter((l) => l != null).join("\n"),
  };
}
