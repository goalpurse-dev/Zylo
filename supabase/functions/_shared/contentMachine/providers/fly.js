// Content Machine: the slide renderer on Fly (render-worker/src/cmSlides.mjs, image tag cm-slides).
// One machine per slideshow; it destroys itself when done. Cost = the seconds from start until its files
// appear × the machine's per-second price (settled later, from the worker). Needs a Budget Guard ticket.
import { assertTicket } from "../budgetGuard.js";

// shared-cpu-4x with 4 GB: Chromium draws the slides, ffmpeg makes the MP4. About a minute per slideshow.
export const MACHINE = Object.freeze({ cpu_kind: "shared", cpus: 4, memory_mb: 4096 });
export const USD_PER_SECOND = 0.0000135;
export const RENDER_ESTIMATE_USD = 0.01;   // a ceiling: ~12 minutes of the machine above
export const RENDER_TIMEOUT_MS = 12 * 60_000;

export function renderCostUsd(startedAtMs, doneAtMs, usdPerSecond = USD_PER_SECOND) {
  const seconds = Math.max(0, (doneAtMs - startedAtMs) / 1000);
  return Math.round(seconds * usdPerSecond * 1e6) / 1e6;
}

export async function startRender(ticket, { token, app, image, name, job, fetchImpl = fetch }) {
  assertTicket(ticket, "fly");
  if (!token) throw Object.assign(new Error("FLY_API_TOKEN is not set"), { actualUsd: 0 });
  const res = await fetchImpl(`https://api.machines.dev/v1/apps/${app}/machines`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      config: {
        image, guest: MACHINE, auto_destroy: true, restart: { policy: "no" },
        init: { cmd: ["node", "src/cmSlides.mjs"] },
        env: { CM_SLIDES_JOB: JSON.stringify(job), WORK_DIR: "/tmp/render" },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`fly ${res.status}: ${JSON.stringify(body).slice(0, 200)}`), { actualUsd: 0 });
  return { machineId: body?.id ?? null, startedAt: Date.now() };
}
