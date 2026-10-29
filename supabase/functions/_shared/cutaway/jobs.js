// Cutaway Explainer: the worker jobs (m3/videoJob.mjs reads them) and where each run's files live.
// A job carries signed URLs and a callback token only: never a key. Storage: the private bucket cutaway-renders
// (1 GB a file), one folder a run: <env>/<user>/<run>/{plan/*, frames/*, chunks/*, final.mp4, web.mp4, poster.jpg}.

export const BUCKET = "cutaway-renders";
export const FRAMES = 8;              // preview frames the page shows while the video renders
export const CHUNK_FRAMES = 110;      // the CPU fallback: frames a machine renders (~6 min on performance-8x)
export const MAX_CHUNKS = 20;
export const PLAN_FILES = Object.freeze(["layout", "script", "words", "voice", "post"]);
const EXT = { layout: "json", script: "json", words: "json", voice: "mp3", post: "json" };

export const runDir = (run) => `${run.env ?? "prod"}/${run.user_id}/${run.id}`;
export const paths = (run) => ({
  plan: Object.fromEntries(PLAN_FILES.map((k) => [k, `${runDir(run)}/plan/${k}.${EXT[k]}`])),
  frames: Array.from({ length: FRAMES }, (_, i) => `${runDir(run)}/frames/${i}.jpg`),
  final: `${runDir(run)}/final.mp4`, web: `${runDir(run)}/web.mp4`, poster: `${runDir(run)}/poster.jpg`,
  chunk: (i) => `${runDir(run)}/chunks/seg_${i}.mp4`,
});

/** the CPU fallback's chunks for a video of `frames` frames: [{ index, from, to }] */
export function chunksFor(frames) {
  const n = Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(frames / CHUNK_FRAMES))), size = Math.ceil(frames / n), out = [];
  for (let i = 0; i < n; i++) { const from = i * size, to = Math.min(frames, from + size); if (to > from) out.push({ index: i, from, to }); }
  return out;
}

/** the callback token of a run: HMAC-SHA256(secret, run id), hex (Web Crypto: Deno and Node alike) */
export async function tokenFor(secret, runId) {
  const enc = new TextEncoder(), key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`cutaway:${runId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** constant-time compare of two hex tokens */
export function sameToken(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  if (!x || x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

/**
 * A job for the worker. urls: signed URLs the server made for this job ({ planPut, planGet, frames, final, web, poster,
 * segment, segments }); layout: an approved layout to reuse (premade), or null.
 */
// The most one attempt may spend on OPTIONAL paid calls: an emergency brake, not a budget (the owner's rule of 2026-10-29:
// the swimming pool was stopped by a $0.70 cap at its preview check, after everything costly was paid). Well under what
// customers pay (custom $2.72 / $3.90); the final steps (the voice, the first preview check, the post text) always run.
export const RUN_CAP_USD = Object.freeze({ premade: 0.6, custom30: 1.5, custom60: 2.2 });
export const runCapFor = (run) => (run.kind === "custom" ? (Number(run.length_sec) >= 60 ? RUN_CAP_USD.custom60 : RUN_CAP_USD.custom30) : RUN_CAP_USD.premade);

export function jobFor(run, { role, mode, urls, callback, layout = null, chunk = null, library = null }) {
  const job = {
    v: 1, runId: run.id, role, mode, attempt: run.attempt ?? 1, topic: run.topic, lengthSec: run.length_sec, kind: run.kind,
    endCard: run.end_card !== false, callback, capUsd: runCapFor(run),
  };
  if (role === "video" || role === "plan") {
    if (run.plan_ready && urls.planGet) job.plan = { get: urls.planGet };
    else { job.plan = { put: urls.planPut }; if (layout) job.layout = layout; if (library?.length) job.library = library; }
  } else job.plan = { get: urls.planGet };
  if (role === "video" || role === "plan") job.out = { frames: urls.frames ?? [] };
  if (role === "video" || role === "mix") job.out = { ...(job.out ?? {}), final: urls.final, web: urls.web, poster: urls.poster };
  if (role === "chunk") { job.chunk = chunk; job.out = { segment: urls.segment }; }
  if (role === "mix") job.segments = urls.segments;
  return job;
}
