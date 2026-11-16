// Blocky Worlds STUDIO ENGINE (soft launch, owner 2026-11-13): the shared, pure pieces of "Studio mode v3" as the app's
// video engine. One Sonnet director hand-writes the shot code of the whole story (scripts/blockyWorlds/studio/agent.mjs),
// preview stills on RunPod, ONE fixed Sonnet checker, ONE fix round, then the final renders in parallel on RunPod. The
// loop runs in a small CPU worker (scripts/blockyWorlds/studioWorker/), never in an edge function: it lives 10-30 min.
// No I/O here: blocky-worlds-api (start, the run view), the sweeper (blocky-worlds-render), the worker and the page all
// read this one file.
//
// THE SWITCH (a function secret of blocky-worlds-api and blocky-worlds-render): BLOCKY_WORLDS_ENGINE=studio. Anything
// else (unset, a typo) is "pipeline": the RunPod prepare/chunk/finish pipeline of render.js. Fast mode (the fixed
// storyboard path) is the pipeline engine with BLOCKY_WORLDS_STORYBOARD=auto: it stays OFF.

/** the two engines; a run row records the one that makes it (blocky_worlds_runs.engine) */
export const ENGINES = Object.freeze(["pipeline", "studio"]);
/** BLOCKY_WORLDS_ENGINE -> "studio" | "pipeline" (fail-safe: anything unknown is the old pipeline) */
export const engineFrom = (get = () => "") => (String(get("BLOCKY_WORLDS_ENGINE") ?? "").trim().toLowerCase() === "studio" ? "studio" : "pipeline");

/** Studio v3 as the owner chose it (2026-11-13) and the per-video limits the worker enforces. */
export const STUDIO = Object.freeze({
  model: "claude-sonnet-5-5",   // the director (studio/agent.mjs MODELS.sonnet)
  rounds: 1,                    // v3: ONE fix round after the first preview + check
  effort: "medium",
  narrator: "scruffy_duck",     // config.js NARRATORS: Scruffy Duck, voice 8VJBrRk4O7tFoB5kqxa6, eleven_v3
  voiceSpeed: 1.25,             // studio/pace.mjs PACE.speed (+ the pause cuts)
  agentCapUsd: 3,               // model use per video (director + checker): the Studio agent cap
  runCapUsd: 4,                 // everything per video (voice + model + RunPod): the hard cap, checked before every paid step
  directorMinutes: 25,          // the director's own clock (agent.mjs minutes)
  finalJobs: 3,                 // parallel RunPod jobs of the final (6 workers on the endpoint: two finals at once fit)
  // THE TIME LIMIT (owner 2026-11-16: run 2947e875 was failed at a fixed 45 min while its finish was 1 min from done):
  // studioLimitMin(run) = the soft limit, scaled with the video length, at least minLimitMin; past it a run is stopped
  // ONLY when its progress went quiet for progressStaleMin; hardMin is the backstop from the claim, progress or not
  hardMin: 120,                 // the hard max from the claim: then it is failed and refunded, progress or not
  minLimitMin: 75,              // the soft limit never under this
  progressStaleMin: 25,         // past the soft limit: no new pipeline line for this long = stuck (the longest quiet job, the finish, is ~15 min)
  heartbeatSec: 30,             // the worker's heartbeat while a run is going
  staleMin: 6,                  // no heartbeat for this long: the worker is gone, the run is failed and refunded
  maxWaitMin: 45,               // queued this long without a worker taking it: failed and refunded ("busy")
  workerSeenSec: 180,           // start refuses (before any charge) when no worker said hello in this window
  maxUploadBytes: 48e6,         // the storage upload limit is 50 MB a file: the final is re-encoded under this
  endpoint: "gm9eqdkuyc2ofs",   // the Blocky RunPod endpoint (studio/render.mjs asserts it too)
  forbiddenEndpoints: Object.freeze(["f66astc0vrus92"]), // Cutaway's endpoint: never
});

// the progress screen's stages, the time a run takes (in their own file: the page bundle imports only that one)
export * from "./studioStages.js";
import { MEASURED, realSeconds, studioEtaSec } from "./studioStages.js";

// ---------------------------------------------------------------- the sweeper's rules (a worker that died, a stuck line)
const ms = (t) => (t == null ? null : typeof t === "number" ? t : Date.parse(t));
/**
 * What the sweeper does with one live Studio run: null (leave it) or { code, message } (fail it and refund). Pure.
 *   queued, no worker took it within maxWaitMin                  QUEUE_TIMEOUT ("busy": try again)
 *   claimed, no heartbeat for staleMin                            WORKER_LOST
 *   claimed longer than hardMin (the hard max)                    TIMEOUT
 *   past studioLimitMin AND no progress for progressStaleMin      TIMEOUT (never while it still moves)
 */
export function studioSweepDecision(run, now = Date.now(), cfg = STUDIO) {
  if (!run || run.engine !== "studio" || ["done", "failed"].includes(run.status)) return null;
  if (!run.worker_id) {
    const waited = now - ms(run.created_at);
    return waited > cfg.maxWaitMin * 60000 ? { code: "QUEUE_TIMEOUT", message: `waited ${Math.round(waited / 60000)} min for a Studio worker` } : null;
  }
  const claimed = ms(run.claimed_at) ?? ms(run.created_at), beat = ms(run.heartbeat_at) ?? claimed;
  if (now - claimed > cfg.hardMin * 60000) return { code: "TIMEOUT", message: `not done ${cfg.hardMin} min after the worker took it (the hard max)` };
  const limit = studioLimitMin(run, cfg), moved = studioProgressAt(run) ?? claimed;
  if (now - claimed > limit * 60000 && now - moved > cfg.progressStaleMin * 60000) return { code: "TIMEOUT", message: `past its ${limit} min limit with no progress for ${Math.round((now - moved) / 60000)} min` };
  if (now - beat > cfg.staleMin * 60000) return { code: "WORKER_LOST", message: `no heartbeat from worker ${run.worker_id} for ${Math.round((now - beat) / 60000)} min` };
  return null;
}

/** THE SOFT LIMIT in minutes for a run of lengthSec (the target; the real voice runs up to ~35% longer): the director +
 *  previews + 2 fix rounds (~30 min), the final at up to ~1.15 s a frame over 6 chunks + queueing (10 min), the finish
 *  (~8 s a video second: 800 s for 99 s), x1.25; at least minLimitMin, at most hardMin */
export function studioLimitMin(run, cfg = STUDIO) {
  const sec = Math.max(30, Number(run?.length_sec) || 90) * 1.35;
  const est = 30 + (sec * 30 * 1.15) / 6 / 60 + 10 + (sec * 8) / 60;
  return Math.round(Math.min(cfg.hardMin, Math.max(cfg.minLimitMin, est * 1.25)));
}
/** when the run last moved: the pipeline's last line (render.progress.lineAt), else its progress write, else the stage */
export function studioProgressAt(run) {
  const p = run?.progress ?? run?.render?.progress ?? null;
  return Math.max(ms(p?.lineAt) ?? 0, ms(run?.stage_at) ?? 0, ms(run?.claimed_at) ?? 0) || null;
}

/** start refuses before any charge unless a worker said hello lately (blocky_worlds_workers.seen_at) */
export const workerAlive = (rows = [], now = Date.now(), cfg = STUDIO) => (rows ?? []).some((w) => now - ms(w.seen_at) <= cfg.workerSeenSec * 1000);

/** The place in the Studio line (oldest queued first) and the time until ready, for the run view. */
export function studioQueue(run, queuedRuns = [], now = Date.now()) {
  const eta = studioEtaSec(run.length_sec ?? 60);
  if (run.status !== "queued" || run.worker_id) {
    const started = ms(run.claimed_at) ?? ms(run.created_at);
    return { queuePosition: null, etaSec: 0, doneEtaSec: Math.max(30, Math.round(eta - (now - started) / 1000)) };
  }
  const line = [...queuedRuns].filter((r) => r.status === "queued" && !r.worker_id).sort((a, b) => ms(a.created_at) - ms(b.created_at));
  const pos = Math.max(1, line.findIndex((r) => r.id === run.id) + 1);
  return { queuePosition: pos, etaSec: (pos - 1) * Math.round(eta / 2), doneEtaSec: (pos - 1) * Math.round(eta / 2) + eta };
}

// ---------------------------------------------------------------- the customer's text is DATA
const CTRL = new RegExp("[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]", "g");
/**
 * The script the worker hands to the voice, the planner and the director: the customer's text, cleaned so it can never
 * break out of the director's <story_script> data block (no angle brackets, no control characters, bounded sizes). The
 * director's system prompt and tools are fixed in studio/prompt.mjs + agent.mjs; nothing here can add to them.
 */
export function sanitizeScript(script = {}) {
  const clean = (s, n) => String(s ?? "").replace(CTRL, " ").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const lines = (Array.isArray(script.lines) ? script.lines : []).slice(0, 200)
    .map((l) => ({ part: /^[a-z_]{1,24}$/.test(String(l?.part ?? "")) ? l.part : "own", text: clean(l?.text, 400) }))
    .filter((l) => l.text);
  return { title: clean(script.title, 120), lines };
}

// ---------------------------------------------------------------- "your video is ready" (an account email)
export const APP_URL = "https://www.tryzyvo.com";
export const APP_PATH = "/workspace/in-this-town"; // = src/data/blockyWorlds.js BLOCKY_WORLDS_PATH (a test holds them equal)
/** BLOCKY_WORLDS_READY_EMAIL=on sends it (default off: the owner switches it on at launch) */
export const readyEmailOn = (get = () => "") => ["on", "true", "1", "yes"].includes(String(get("BLOCKY_WORLDS_READY_EMAIL") ?? "").trim().toLowerCase());
/** the email gate's kind: once per run (claim_email_send dedups on it) */
export const readyEmailKind = (runId) => `blocky_worlds_ready_${runId}`;
/** a done Studio run whose email is due: not sent yet, finished within the last day (an old one is never mailed late) */
export function notifyDue(run, now = Date.now()) {
  return Boolean(run) && run.engine === "studio" && run.status === "done" && !run.notified_at && !run.deleted_at && now - ms(run.finished_at ?? run.updated_at ?? run.created_at) < 86400000;
}
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const READY_WHY = "You got this email because you made a In This Town video on Zyvo.";
/** -> { subject, render(footer) -> { html, text } } (the footer comes from emailRules.js emailFooter via userEmail.ts) */
export function readyEmail({ title }) {
  const t = String(title ?? "").replace(CTRL, " ").trim().slice(0, 90) || "Your story";
  const url = `${APP_URL}${APP_PATH}`;
  return {
    subject: `Your In This Town video is ready: ${t}`,
    url,
    render: (footer) => ({
      html: `<div style="max-width:520px;margin:0 auto;padding:24px 16px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;">
  <p style="margin:0 0 12px 0;font-size:20px;font-weight:800;">Your video is ready</p>
  <p style="margin:0 0 16px 0;">&ldquo;${esc(t)}&rdquo; has been directed, rendered and narrated. Watch it, download it and copy the upload text.</p>
  <p style="margin:0 0 8px 0;"><a href="${esc(url)}" style="display:inline-block;background:#BEF264;color:#11150D;font-weight:800;text-decoration:none;padding:12px 18px;border-radius:12px;">Open my video</a></p>
  <p style="margin:16px 0 0 0;font-size:13px;color:#555;">In This Town is in beta. Reply to this email if something looks off.</p>
</div>${footer?.html ?? ""}`,
      text: `Your video is ready\n\n"${t}" has been directed, rendered and narrated.\nOpen it: ${url}\n\nIn This Town is in beta. Reply to this email if something looks off.\n\n${footer?.text ?? ""}`,
    }),
  };
}

// ---------------------------------------------------------------- the cost model (measured, 2026-11-13)
/**
 * Our cost of one Studio video, by part (USD), for a SELECTED length, from the measured Studio runs (run1, run2, testA,
 * testA2, testB: scratchpad studio/<run>/steps.jsonl + costs.json). Not wired to the prices: pricing.js keeps the old
 * numbers until the owner applies the table (docs/blocky-worlds-launch.md, "Price").
 *   writing   the script before the charge (~$0.15 the hybrid writer at 60 s, + ~$0.05 of Fix it / rewrites)
 *   voice     ElevenLabs eleven_v3, ~0.44 credits a character, $0.0002 a credit: measured $0.000466 a word (254 words $0.117)
 *   director  Sonnet 5.5, one conversation: ~$0.04 (the cached prompt) + ~$0.0077 a cut (testA $0.583 / 69 cuts, testA2
 *             $0.545 / 68 cuts), the fix round included
 *   checker   Sonnet 5.5 low effort, two passes: ~$0.01 + $0.0007 a cut (testA $0.053, testA2 $0.066)
 *   previews  RunPod 16 GB at $0.58/h: ~30 s + ~1 s a cut over the two rounds (testA 141 s, testA2 71 s, testB 19 s)
 *   final     RunPod: ~23 s a job + 0.149 s a frame (fitted on run2, testA x2, testA2, testB: 286-343 s for 64-72 s)
 *   worker    the CPU worker (Fly shared-cpu-2x, ~15 min) + storage
 * A failed run is refunded, so its spend is shared by the delivered ones: PASS_RATE 0.9, a failure costs ~ the voice +
 * the director + the checker + the previews (it usually stops before the final).
 */
export const STUDIO_RATES = Object.freeze({
  writingBaseUsd: 0.1, writingPerSecUsd: 0.1 / 120, rewritesUsd: 0.05,
  voicePerWordUsd: 0.000466,
  directorBaseUsd: 0.04, directorPerCutUsd: 0.0077,
  checkerBaseUsd: 0.01, checkerPerCutUsd: 0.0007,
  runpodPerSecUsd: 0.58 / 3600,
  previewBaseSec: 30, previewPerCutSec: 1.0,
  finalPerJobSec: 23, finalPerFrameSec: 0.149, fps: 24,
  workerUsd: 0.01, storageUsd: 0.003,
  passRate: 0.9,
});
const r4 = (x) => +x.toFixed(4);
export function studioAttemptCost(lengthSec, R = STUDIO_RATES, jobs = STUDIO.finalJobs) {
  const words = (lengthSec * MEASURED.scriptWpm) / 60, real = realSeconds(lengthSec), cuts = (real / 60) * MEASURED.cutsPerMin, frames = real * R.fps;
  return {
    writing: r4(R.writingBaseUsd + lengthSec * R.writingPerSecUsd + R.rewritesUsd),
    voice: r4(words * R.voicePerWordUsd),
    director: r4(R.directorBaseUsd + cuts * R.directorPerCutUsd),
    checker: r4(R.checkerBaseUsd + cuts * R.checkerPerCutUsd),
    previews: r4((R.previewBaseSec + cuts * R.previewPerCutSec) * R.runpodPerSecUsd),
    final: r4((jobs * R.finalPerJobSec + frames * R.finalPerFrameSec) * R.runpodPerSecUsd),
    worker: R.workerUsd, storage: R.storageUsd,
  };
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
/** our full cost of one DELIVERED Studio video (USD): its attempt + its share of the refunded failures */
export function studioFullCostUsd(lengthSec, R = STUDIO_RATES) {
  const a = studioAttemptCost(lengthSec, R), failed = a.voice + a.director + a.checker + a.previews;
  return r4(sum(a) + (failed * (1 - R.passRate)) / R.passRate);
}
/** the credits the table proposes: 1 credit = $0.01 of our full cost (the user pays $0.02 a credit: 2x our cost) */
export const studioCredits = (lengthSec, R = STUDIO_RATES) => Math.ceil(studioFullCostUsd(lengthSec, R) / 0.01 - 1e-9);
/** the table for the owner: { lengthSec, realSec, cuts, parts, attemptUsd, fullUsd, credits } */
export function studioPriceTable(lengths = [30, 60, 90], R = STUDIO_RATES) {
  return lengths.map((s) => {
    const parts = studioAttemptCost(s, R);
    return { lengthSec: s, realSec: realSeconds(s), cuts: Math.round((realSeconds(s) / 60) * MEASURED.cutsPerMin), parts, attemptUsd: r4(sum(parts)), fullUsd: studioFullCostUsd(s, R), credits: studioCredits(s, R) };
  });
}
