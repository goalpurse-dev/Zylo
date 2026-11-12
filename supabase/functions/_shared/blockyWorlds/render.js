// Blocky Worlds: the production video pipeline's pure logic (docs/blocky-worlds-pipeline.md). No I/O: the chunk split
// (by frames and by expected size), the per-job events, the run's state machine (reconcile), retries, timeouts, storage
// paths, the callback token and the cost sums. renderRuntime.js carries out what this file decides; the edge function
// blocky-worlds-render and the free dry run (engine/dev/pipelineDryRun.mjs) both run it.
//
// THE RULE (docs/blocky-worlds-protocol.md, top): the prepare job runs checkTimeline + checkVisuals + checkSubjects
// before any chunk job exists. A miss is a NO_RETRY failure: the run fails and is refunded, nothing is rendered.

import { RATES } from "./pricing.js";

export const RENDER = Object.freeze({
  fps: 24,
  framesPerChunk: 270,          // ~27 s of GPU render a chunk at 0.1 s a frame, next to ~30 s of page load
  minChunks: 2,
  maxChunks: 12,
  chunkBytesTarget: 36e6,       // the storage upload limit is 50 MB a file; the worker squeezes anything over 48 MB
  crf: 21,
  snapShare: 0.06,              // a cut moves to a shot boundary within 6% of a chunk's length (chunks stay within ±12%)
  attempts: Object.freeze({ prepare: 2, chunk: 4, finish: 3 }),   // tries per piece, the first included
  noGpuRetries: 3,              // NO_GPU tries on top (handler.py retires that worker)
  noGpuDelaySec: 20,            // ... and the piece waits until it is gone (Cutaway: sent at once, the same slice took it)
  queueSec: 240,                // waiting in RunPod's queue longer than this: cancelled, counted as a failed try
  // prepare 420 s since 2026-11-06 (owner, option A): the builder keeps its old window (it ends 225 s after the start),
  // the shot review gets its own after it (worker.mjs: ends 70 s before the limit, the music + mix + uploads after it)
  runSec: Object.freeze({ prepare: 420, chunk: 420, finish: 300 }),
  hardMin: 25,                  // the whole run
  coldStartBillSec: 15,         // RunPod bills the start-up inside delayTime: up to this much of it is counted
  gpuUsdPerSec: RATES.gpuUsdPerSec,
  music: "A",
  // ---- the queue (2026-11-07; renderQueue.js): the endpoint's workers are shared by every video in flight
  workers: 6,                   // the endpoint's workersMax (gm9eqdkuyc2ofs; function secret BLOCKY_WORLDS_WORKERS overrides)
  queueSlack: 1,                // pieces sent beyond the free workers (renderQueue.js admission: hides the webhook round trip)
  // queue-aware chunking (chooseChunkCount): alone a video gets up to `workers` chunks (one wave), with others the fair
  // share, never fewer than chunkMinCount (the run limit) and raised until each chunk's expected size fits queueBytesTarget
  // (the estimate MB_PER_FRAME runs 1.25-2x the real files: 27 chunks of 3 runs on 2026-11-05/06 came out at 0.53-0.80 of
  // it per video; the worker still squeezes anything over 48 MB)
  queueBytesTarget: 56e6,
  chunkSafeSPerFrame: 0.25,     // planning rate for the biggest chunk (the measured mean is ~0.12 s a frame)
  chunkBudgetShare: 0.7,        // ... which must fit in this share of runSec.chunk
  chunkOverheadSafeSec: 45,     // start-up inside the job: GPU check + page load (14-33 s) + web copy + uploads
  chunkSecPerFrameLimit: 0.45,  // a big chunk's own run limit: overhead + frames x this (never below runSec.chunk)
  runSecChunkMax: 840,          // ... and never above this (the endpoint's executionTimeout is 900 s)
  maxWaitMin: 30,               // a run that waited this long in our own line without starting: failed + refunded (busy)
});

// ---------------------------------------------------------------- queue-aware chunking
/** the most frames one chunk may hold so it ends well inside its run limit even at chunkSafeSPerFrame */
export function maxFramesPerChunk(cfg = RENDER) {
  const share = cfg.chunkBudgetShare ?? 0.7, over = cfg.chunkOverheadSafeSec ?? 45, rate = cfg.chunkSafeSPerFrame ?? 0.25;
  return Math.max(100, Math.floor((cfg.runSec.chunk * share - over) / rate));
}
/** the fewest chunks a video of `frames` frames may have (90 s ~2,250 frames -> 3; 60 s -> 2; 3 min -> 5) */
export const chunkMinCount = (frames, cfg = RENDER) => Math.min(cfg.maxChunks, Math.max(cfg.minChunks, Math.ceil(frames / maxFramesPerChunk(cfg))));
/** a chunk job's own run limit by its frames (a bigger chunk may run longer; at least runSec.chunk) */
export function chunkRunSec(frames, cfg = RENDER) {
  const base = cfg.runSec.chunk, n = Number(frames);
  if (!(n > 0)) return base;
  return Math.min(cfg.runSecChunkMax ?? base, Math.max(base, Math.round((cfg.chunkOverheadSafeSec ?? 45) + n * (cfg.chunkSecPerFrameLimit ?? 0.45))));
}

/**
 * How many chunks a video gets, from the load when its plan is split (render.js chunkPlan then cuts at shot boundaries
 * and may add chunks for the size):
 *   activeRuns: our videos in flight that still have frames to render (this one included; the DB)
 *   health:     RunPod's GET /health ({ jobs: { inQueue, inProgress }, workers }) or null
 * alone -> up to `workers` chunks (one wave, fastest); 2 videos -> workers/2 each; 3+ -> the fewest the limits allow
 * (fewer page loads and start-ups: more videos per minute). RunPod already full (queued + running >= workers) -> the fewest.
 * -> { k, kMin, kMax, share, saturated, reason }
 */
export function chooseChunkCount({ frames, activeRuns = 1, health = null, cfg = RENDER } = {}) {
  const W = Math.max(1, Number(cfg.workers) || 6);
  // never more chunks than the endpoint has workers (2026-11-12: the account's 10 workers are shared with Cutaway, ours is 6): no second wave
  const fastK = Math.min(cfg.maxChunks, Number(cfg.workers) || cfg.maxChunks, Math.max(cfg.minChunks, Math.ceil(frames / cfg.framesPerChunk)));
  const kMin = chunkMinCount(frames, cfg);
  const kMax = Math.max(kMin, Math.min(W, cfg.maxChunks, fastK));
  const n = Math.max(1, Math.floor(Number(activeRuns) || 1));
  const q = Number(health?.jobs?.inQueue) || 0, p = Number(health?.jobs?.inProgress) || 0;
  const saturated = Boolean(health) && q > 0 && q + p >= W;
  const share = saturated ? kMin : Math.floor(W / n);
  const k = Math.max(kMin, Math.min(kMax, share));
  const reason = saturated ? `RunPod full (${q} queued + ${p} running >= ${W} workers): the fewest chunks` : n === 1 ? `alone: ${k} chunks` : `${n} videos in flight: ${k} chunks each (share ${share}, min ${kMin})`;
  return { k, kMin, kMax, share, saturated, reason };
}

const TERMINAL = new Set(["done", "failed"]);
const LIVE = new Set(["sent", "running"]);
export const ROLES = Object.freeze(["prepare", "chunk", "finish"]);
/** failures the video itself causes (or an empty balance / a missing config): a retry would fail the same way */
// (KIT_MISSING: an object the engine kit can't build; TIMELINE_INVALID: the engine page refused the timeline, on any GPU)
// (PRODUCTION_CHECK: a line misses an item the story director listed; the same plan misses it again, and a retry would
// pay the director and the builder twice)
// (CRITICAL_UNBUILT: the builder couldn't make a story-critical thing before the plan; worker.mjs criticalUnbuilt)
// (STILL_GATE, 2026-11-09: a shot still blank / wall / sky-only / camera-inside after every re-plan; the same plan would
// fail the same way: worker.mjs stillGateFailure)
// (STORYBOARD_FAILED / STORYBOARD_CHECKS / KIT_UNSUPPORTED, 2026-11-12: the automatic storyboard could not be written, failed
// its hard checks (the rule, the verbs, the places) or needs things the board kit cannot show: the same story fails the same way)
export const NO_RETRY = new Set(["STORYBOARD_FAILED", "STORYBOARD_CHECKS", "KIT_UNSUPPORTED", "VISUAL_CHECK", "SUBJECT_CHECK", "PRODUCTION_CHECK", "PLAN_FAILED", "CRITICAL_UNBUILT", "STILL_GATE", "KIT_MISSING", "TIMELINE_INVALID", "VOICE_CONFIG", "PROVIDER_BALANCE", "BAD_JOB", "NOT_CONFIGURED"]);
// a worker that can't run the job (no graphics; an older image than the job needs: worker.mjs staleBuild) is retired by
// handler.py and the piece is retried elsewhere: these tries don't count as failed ones (noGpuRetries caps them)
const NO_GPU = new Set(["NO_GPU", "STALE_WORKER"]);
const ORDER = ["queued", "voice", "plan", "render", "done"];
// THE PROGRESS STAGES (2026-11-12, the launch progress screen): the prepare job's stages (runpod/worker.mjs post("progress"))
// and the run's % at each; the chunks then take 15 -> 95, the finish 95 -> 100. The run's status stays one of ORDER.
export const STAGES = Object.freeze([
  { stage: "queued", label: "Waiting for a video machine", pct: 0 },
  { stage: "voice", label: "Recording the narration", pct: 3 },
  { stage: "storyboard", label: "Writing the storyboard", pct: 5 },
  { stage: "plan", label: "Planning every shot", pct: 7 },
  { stage: "prompts", label: "Directing each shot", pct: 9 },
  { stage: "checks", label: "Checking the story on screen", pct: 11 },
  { stage: "stills", label: "Test-shooting every frame", pct: 13 },
  { stage: "mix", label: "Mixing music and sound", pct: 15 },
  { stage: "render", label: "Rendering the video", pct: 15 },
  { stage: "finish", label: "Finishing up", pct: 95 },
]);
const STAGE_PCT = Object.fromEntries(STAGES.map((x) => [x.stage, x.pct]));
const PLAN_STAGES = new Set(["storyboard", "plan", "prompts", "checks", "stills", "mix"]);
const iso = (ms) => new Date(ms).toISOString();
const ms = (t) => (t == null ? null : typeof t === "number" ? t : Date.parse(t));

// ---------------------------------------------------------------- the chunk split
/**
 * Expected MB a frame at CRF 20 by set and light (the paid test of 2026-11-04: 0.038-0.096 MB a frame per chunk; the
 * leafy daytime street is the heaviest). Each CRF step up is ~11% smaller.
 */
export const MB_PER_FRAME = Object.freeze({ street: 0.1, woods: 0.1, school: 0.075, bedroom: 0.07, insert: 0.03 });
const LIGHT_FACTOR = Object.freeze({ day: 1, warm: 0.95, night: 0.6 });
export function bytesPerFrame(shot, crf = RENDER.crf) {
  const base = shot?.camera === "insert" ? MB_PER_FRAME.insert : MB_PER_FRAME[shot?.set] ?? 0.1;
  return base * (LIGHT_FACTOR[shot?.light] ?? 1) * 0.89 ** (crf - 20) * 1e6;
}
export const frameCountOf = (tl) => Math.round(Number(tl.duration) * (tl.fps ?? RENDER.fps));

/**
 * The chunks of a timeline: [{ index, from, to, estBytes }] covering [0, frames) (or [0, limitFrames), the dry run's
 * short render). K = ceil(frames / framesPerChunk) within [minChunks, maxChunks], raised until every chunk's expected
 * size is under the target; each cut moves to the nearest shot boundary within snapShare of a chunk.
 */
export function chunkPlan(tl, { cfg = RENDER, limitFrames = null, k: forceK = null, target = null, bytesTarget = null } = {}) {
  const fps = tl.fps ?? cfg.fps, N = Math.min(frameCountOf(tl), limitFrames ?? Infinity);
  if (!(N > 0)) throw new Error("chunkPlan: no frames");
  // expected bytes up to each frame (prefix sums over the shots)
  const shots = tl.shots ?? [];
  const per = new Float64Array(N);
  let si = 0;
  for (let f = 0; f < N; f++) {
    const t = (f + 0.5) / fps;
    while (si < shots.length - 1 && shots[si].end <= t) si++;
    per[f] = bytesPerFrame(shots[si], cfg.crf);
  }
  const pre = new Float64Array(N + 1);
  for (let f = 0; f < N; f++) pre[f + 1] = pre[f] + per[f];
  const cuts = [...new Set(shots.map((s) => Math.round(s.start * fps)).filter((f) => f > 0 && f < N))].sort((a, b) => a - b);
  const snap = (f, size) => {
    let best = f, d = Math.round(size * cfg.snapShare) + 1;
    for (const c of cuts) if (Math.abs(c - f) < d) { d = Math.abs(c - f); best = c; }
    return best;
  };
  const build = (K) => {
    const size = N / K, b = [0];
    for (let i = 1; i < K; i++) b.push(Math.max(b[i - 1] + 1, Math.min(N - (K - i), snap(Math.round(size * i), size))));
    b.push(N);
    return b.slice(0, -1).map((from, index) => ({ index, from, to: b[index + 1], estBytes: Math.round(pre[b[index + 1]] - pre[from]) }));
  };
  if (forceK) return build(Math.max(1, Math.min(forceK, N)));
  // target: the queue-aware count (chooseChunkCount); its size check uses bytesTarget (RENDER.queueBytesTarget)
  const kMax = Math.min(cfg.maxChunks, Number(cfg.workers) || cfg.maxChunks); // never a second wave of chunks
  let K = target ? Math.min(kMax, Math.max(1, Math.round(target))) : Math.min(kMax, Math.max(cfg.minChunks, Math.ceil(N / cfg.framesPerChunk)));
  const maxBytes = bytesTarget ?? cfg.chunkBytesTarget;
  K = Math.min(K, N);
  let plan = build(K);
  while (plan.some((c) => c.estBytes > maxBytes) && K < Math.min(cfg.maxChunks, N)) plan = build(++K);
  return plan;
}

/** problems with a chunk plan (contiguous, covering [0, frames), non-empty); empty = fine */
export function chunkProblems(chunks, frames) {
  const out = [];
  if (!Array.isArray(chunks) || !chunks.length) return ["no chunks"];
  if (chunks[0].from !== 0) out.push("the first chunk must start at frame 0");
  if (chunks.at(-1).to !== frames) out.push(`the last chunk must end at frame ${frames}`);
  chunks.forEach((c, i) => {
    if (c.index !== i) out.push(`chunk ${i}: index ${c.index}`);
    if (!(c.to > c.from)) out.push(`chunk ${i}: empty`);
    if (i && c.from !== chunks[i - 1].to) out.push(`chunk ${i}: gap or overlap`);
  });
  return out;
}

// ---------------------------------------------------------------- storage paths, the token
export const BUCKET = "blocky-worlds-renders";
export const runDir = (run) => `${run.env ?? "prod"}/${run.user_id}/${run.id}`;
export function paths(run) {
  const d = runDir(run), pad = (i) => String(i).padStart(3, "0");
  return {
    voiceMp3: `${d}/voice/voice.mp3`, take: `${d}/voice/take.json`,
    timeline: `${d}/timeline.json`, visualCheck: `${d}/visual-check.json`, production: `${d}/production.json`, direction: `${d}/direction.json`, shotReview: `${d}/shot-review.json`, mix: `${d}/mix.m4a`,
    seg: (i, a) => `${d}/chunks/seg_${pad(i)}_a${a}.mp4`, web: (i, a) => `${d}/chunks/web_${pad(i)}_a${a}.mp4`,
    final: `${d}/final.mp4`, webFinal: `${d}/web.mp4`, poster: `${d}/poster.jpg`,
  };
}

/** a run's callback token: HMAC-SHA256(secret, "blocky-worlds:<run id>"), hex (Web Crypto: Deno and Node alike) */
export async function tokenFor(secret, runId) {
  if (!secret) throw new Error("no callback secret");
  const enc = new TextEncoder(), key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`blocky-worlds:${runId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** constant-time compare */
export function sameToken(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  if (!x || x.length !== y.length) return false;
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ---------------------------------------------------------------- the prepare job's story director + builder
/**
 * Function secrets (read by renderSupabase.ts; the defaults are what a missing or unknown value means):
 *   BLOCKY_WORLDS_DIRECTOR          off | mock | haiku | sonnet   (mock: free, the old behaviour)
 *   BLOCKY_WORLDS_BUILDER           off | on                       (off: the kit + the shared library only, never a paid call)
 *   BLOCKY_WORLDS_BUILDER_MAX_USD   the builder's money cap per video (0.60; clamped to 0..2)
 *   BLOCKY_WORLDS_REVIEW            haiku | sonnet | mock | off    (the shot review, engine lib/vision; unset = haiku: ON)
 *   BLOCKY_WORLDS_REVIEW_MAX_USD    the review's money cap per prepare try (0.10; clamped to 0..1)
 * The worker reads job.prepare.review = { provider: "off" | "mock" | "anthropic", model?, budget: { maxUsd } } too.
 * The worker (engine/runpod/worker.mjs prepare) reads job.prepare.director = { provider: "off" | "mock" | "anthropic",
 * model? } and job.prepare.builder = { provider: "off" | "anthropic", library: [asset], budget: { maxUsd } }; both paid
 * paths need ANTHROPIC_KEY in the worker (the RunPod secret blocky_anthropic, runpod/setup.mjs).
 */
export const PRODUCTION_DEFAULTS = Object.freeze({ director: "mock", builder: "off", builderMaxUsd: 0.6, review: "haiku", reviewMaxUsd: 0.1 });
export const REVIEW_MAX_USD_CEILING = 1;
export const DIRECTOR_MODELS = Object.freeze({ haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" });
/**
 * The most ONE director call can cost (a copy of engine/lib/director/design.js anthropicDirector().worstCase(): every
 * one of its 16,000 first-try output tokens + 12,000 input tokens written to the cache; tests keep the two equal; 2026-11-07:
 * the plain-JSON system prompt + a roomier first try, the turtle retry was cut off at 12,000). directStory makes
 * at most 2 calls (one retry) per prepare try.
 */
export const DIRECTOR_WORST_USD = Object.freeze({ "claude-haiku-5-5": 0.0095, "claude-sonnet-5-5": 0.19 });
export const BUILDER_MAX_USD_CEILING = 2;
export const LIBRARY_SNAPSHOT = Object.freeze({ rows: 150, bytes: 2e6 });

/** the settings from a getter of the function secrets (k) -> string */
export function productionSettings(get = () => "") {
  const v = (k) => String(get(k) ?? "").trim().toLowerCase();
  const director = ["off", "mock", "haiku", "sonnet"].includes(v("BLOCKY_WORLDS_DIRECTOR")) ? v("BLOCKY_WORLDS_DIRECTOR") : PRODUCTION_DEFAULTS.director;
  const builder = ["on", "true", "1", "anthropic"].includes(v("BLOCKY_WORLDS_BUILDER")) ? "on" : "off";
  const raw = v("BLOCKY_WORLDS_BUILDER_MAX_USD"), n = raw === "" ? NaN : Number(raw);
  const builderMaxUsd = Number.isFinite(n) && n >= 0 ? Math.min(BUILDER_MAX_USD_CEILING, n) : PRODUCTION_DEFAULTS.builderMaxUsd;
  // the shot review is ON (haiku) unless the secret says off (owner, 2026-11-06); an unknown value keeps the default
  const review = ["off", "mock", "haiku", "sonnet"].includes(v("BLOCKY_WORLDS_REVIEW")) ? v("BLOCKY_WORLDS_REVIEW") : PRODUCTION_DEFAULTS.review;
  const rraw = v("BLOCKY_WORLDS_REVIEW_MAX_USD"), rn = rraw === "" ? NaN : Number(rraw);
  const reviewMaxUsd = Number.isFinite(rn) && rn >= 0 ? Math.min(REVIEW_MAX_USD_CEILING, rn) : PRODUCTION_DEFAULTS.reviewMaxUsd;
  // THE AUTOMATIC STORYBOARD (2026-11-12): "auto" = the director writes a storyboard + every shot's prompts (runpod/worker.mjs);
  // off until the owner switches the launch on (secret BLOCKY_WORLDS_STORYBOARD=auto)
  const storyboard = v("BLOCKY_WORLDS_STORYBOARD") === "auto" ? "auto" : "off";
  // the voice waits for the storyboard (no paid take for a story the storyboard can't film): off by default (the voice is made
  // alongside, faster); switched on if the soft launch shows > ~5 % of runs failing after the voice (voiceFailureStats)
  const voiceAfterStoryboard = ["on", "true", "1"].includes(v("BLOCKY_WORLDS_VOICE_AFTER_STORYBOARD"));
  return { director, builder, builderMaxUsd, review, reviewMaxUsd, storyboard, voiceAfterStoryboard };
}
export const REVIEW_MODELS = Object.freeze({ haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" });
/** job.prepare.review for the worker (engine lib/vision/index.js judgeFromConfig) */
export function prepareReview(s = PRODUCTION_DEFAULTS) {
  const r = s.review ?? PRODUCTION_DEFAULTS.review, maxUsd = Number(s.reviewMaxUsd ?? PRODUCTION_DEFAULTS.reviewMaxUsd) || 0;
  if (r === "off" || (maxUsd <= 0 && r !== "mock")) return { provider: "off" };
  if (r === "mock") return { provider: "mock", budget: { maxUsd: 0 } };
  return { provider: "anthropic", model: REVIEW_MODELS[r] ?? REVIEW_MODELS.haiku, budget: { maxUsd } };
}

/**
 * The most the AI part of one video can cost (USD), enforced by the worker: the builder's purse reserves each call's
 * worst case before it starts (lib/builder/resolve.js makePurse); the cap is for the whole video, so a prepare retry
 * designs only with what the earlier tries left of it (prepareProduction builderSpentUsd), and the library holds what
 * they built; the director makes at most 2 calls per prepare try, RENDER.attempts.prepare tries (a retry reuses the
 * list a try stored: direction.json). The voice and the GPU come on top (estimate(), docs).
 */
export function aiCeilingUsd(s = PRODUCTION_DEFAULTS, cfg = RENDER) {
  const model = DIRECTOR_MODELS[s.director] ?? null;
  const directorMaxUsd = model ? +(DIRECTOR_WORST_USD[model] * 2 * cfg.attempts.prepare).toFixed(4) : 0;
  const builderMaxUsd = s.builder === "on" ? Number(s.builderMaxUsd) || 0 : 0;
  // the shot review: its cap per prepare try (a retry plans and reviews again), RENDER.attempts.prepare tries
  const rv = prepareReview(s);
  const reviewMaxUsd = rv.provider === "anthropic" ? +(rv.budget.maxUsd * cfg.attempts.prepare).toFixed(4) : 0;
  return { directorMaxUsd, builderMaxUsd, reviewMaxUsd, aiMaxUsd: +(directorMaxUsd + builderMaxUsd + reviewMaxUsd).toFixed(4) };
}

/** a prepare retry designs only when at least this much of the builder's cap is left (one design + its check) */
export const BUILDER_MIN_LEFT_USD = 0.05;
/**
 * job.prepare.director + job.prepare.builder for one prepare try (attempt), with the library snapshot rows.
 * builderSpentUsd: what the earlier tries of this run spent on the builder (builderSpentOf). A retry keeps the builder
 * on with the rest of the per-video cap (run 707609b1: try 1 crashed after the plan, try 2 had the builder "off (no
 * provider)" and every missing thing became a card).
 */
export function prepareProduction(s = PRODUCTION_DEFAULTS, { attempt = 1, library = [], builderSpentUsd = 0 } = {}) {
  const model = DIRECTOR_MODELS[s.director] ?? null;
  const director = s.director === "off" ? { provider: "off" } : model ? { provider: "anthropic", model } : { provider: "mock" };
  const left = +Math.max(0, (Number(s.builderMaxUsd) || 0) - (attempt > 1 ? Math.max(0, Number(builderSpentUsd) || 0) : 0)).toFixed(5);
  const designs = s.builder === "on" && left >= (attempt > 1 ? BUILDER_MIN_LEFT_USD : 1e-9);
  const builder = { provider: designs ? "anthropic" : "off", library: s.builder === "on" ? library : [], budget: { maxUsd: designs ? left : 0 } };
  return { director, builder, review: prepareReview(s), limits: { ...aiCeilingUsd(s), prepareSec: RENDER.runSec.prepare }, ...(s.storyboard === "auto" ? { storyboard: { auto: true, capUsd: 0.25, promptsCapUsd: 0.3, ...(s.voiceAfterStoryboard ? { voiceAfter: true } : {}) } } : {}) };
}

/** what the earlier prepare tries of a run spent on the builder (their job rows: the done output's or the failed
 * event's spend, else what "planned" reported) */
export function builderSpentOf(jobs, beforeAttempt = Infinity) {
  let sum = 0;
  for (const j of jobs ?? []) {
    if (j.role !== "prepare" || !(j.attempt < beforeAttempt)) continue;
    const o = j.output ?? {};
    sum += Math.max(Number(o.spend?.builderUsd) || 0, Number(o.planned?.builder?.costUsd) || 0, 0);
  }
  return +sum.toFixed(5);
}

/** a library row (blocky_worlds_assets) as the worker's snapshotCache reads it */
export function snapshotRows(rows, { max = LIBRARY_SNAPSHOT.rows, bytes = LIBRARY_SNAPSHOT.bytes } = {}) {
  const out = [];
  let size = 0;
  for (const r of rows ?? []) {
    if (out.length >= max || !r || (r.kind !== "object" && r.kind !== "world") || !r.name || !r.blueprint) continue;
    const a = { id: r.id, kind: r.kind, name: r.name, name_key: r.name_key, aliases: r.aliases ?? [], keys: r.keys ?? [], blueprint: r.blueprint, still_path: r.still_path ?? null, status: r.status ?? "live", uses: Number(r.uses) || 0 };
    const n = JSON.stringify(a).length;
    if (size + n > bytes) continue;
    size += n; out.push(a);
  }
  return out;
}

/**
 * The worker's "built" event -> a blocky_worlds_assets row, or null when it isn't one. The worker validated the
 * blueprint (lib/builder/spec.js) and the vision check passed it; here only the shape and the size are checked. The
 * still stays on the worker (it has no upload URL for it): still_path null.
 */
export function assetRow(a, runId = null) {
  if (!a || typeof a !== "object" || (a.kind !== "object" && a.kind !== "world")) return null;
  const name = String(a.name ?? "").trim().slice(0, 60), key = String(a.name_key ?? "").trim().toLowerCase().slice(0, 80);
  if (!name || !key || !a.blueprint || typeof a.blueprint !== "object") return null;
  if (JSON.stringify(a.blueprint).length > 190000) return null;
  const strs = (l, n) => (Array.isArray(l) ? l : []).map((x) => String(x ?? "").slice(0, 80)).filter(Boolean).slice(0, n);
  const cost = Number(a.cost_usd ?? a.costUsd);
  return {
    kind: a.kind, name, name_key: key, aliases: strs(a.aliases, 12), keys: [...new Set([key, ...strs(a.keys, 16)])],
    blueprint: a.blueprint, still_path: null, verdict: a.verdict && typeof a.verdict === "object" ? a.verdict : null,
    model: a.model == null ? null : String(a.model).slice(0, 60), cost_usd: Number.isFinite(cost) && cost >= 0 ? +Math.min(cost, 50).toFixed(5) : 0,
    status: "live", run_id: runId ?? null,
  };
}

const usd = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? +Math.min(n, 50).toFixed(6) : 0; };
/**
 * The story director's and the builder's spend as ledger rows. "planned" carries what was spent by then (refs
 * director:<job> and builder:<job>); the job's end (done output.spend, failed spend) carries the totals and what
 * "planned" reported, so anything spent after it (or everything, when the job failed before planning) is added under
 * director_end:<job> / builder_end:<job>. Every ref once: a repeated event never bills twice.
 */
function aiLedger(job, ev) {
  const rows = [];
  if (job.role !== "prepare") return rows;
  if (ev.event === "planned") {
    const b = usd(ev.builder?.costUsd), d = usd(ev.director?.costUsd);
    if (d) rows.push({ stage: "director", provider: "anthropic", model: ev.director?.model ?? null, ref: `director:${job.id}`, usd: d, units: { ms: Number(ev.director?.ms) || null, fellBack: Boolean(ev.director?.fellBack), attempt: job.attempt } });
    if (b) rows.push({ stage: "builder", provider: "anthropic", model: null, ref: `builder:${job.id}`, usd: b, units: { built: Number(ev.builder?.built) || 0, cards: Number(ev.builder?.cards) || 0, ms: Number(ev.builder?.ms) || null, attempt: job.attempt } });
    const r = usd(ev.review?.costUsd);
    if (r) rows.push({ stage: "review", provider: "anthropic", model: ev.review?.model ?? null, ref: `review:${job.id}`, usd: r, units: { passes: Number(ev.review?.passes) || 0, fixes: Number(ev.review?.fixes) || 0, cards: Number(ev.review?.cards) || 0, ms: Number(ev.review?.ms) || null, attempt: job.attempt } });
    return rows;
  }
  const s = ev.event === "failed" ? ev.spend : ev.output?.spend;
  if (!s || typeof s !== "object") return rows;
  const d = usd(usd(s.directorUsd) - usd(s.plannedDirectorUsd)), b = usd(usd(s.builderUsd) - usd(s.plannedBuilderUsd)), r = usd(usd(s.reviewUsd) - usd(s.plannedReviewUsd));
  if (d) rows.push({ stage: "director", provider: "anthropic", model: s.directorModel ?? null, ref: `director_end:${job.id}`, usd: d, units: { totalUsd: usd(s.directorUsd), attempt: job.attempt } });
  if (b) rows.push({ stage: "builder", provider: "anthropic", model: null, ref: `builder_end:${job.id}`, usd: b, units: { totalUsd: usd(s.builderUsd), attempt: job.attempt } });
  if (r) rows.push({ stage: "review", provider: "anthropic", model: s.reviewModel ?? null, ref: `review_end:${job.id}`, usd: r, units: { totalUsd: usd(s.reviewUsd), attempt: job.attempt } });
  return rows;
}

/** the builder's per-need lines from a worker (worker.mjs builderLines), bounded for the job row: why each thing was
 * built, found in the library or the kit, or shown as a card */
export function needLines(list) {
  if (!Array.isArray(list)) return [];
  const s = (v, k) => (v == null ? null : String(v).slice(0, k));
  return list.slice(0, 30).filter((x) => x && typeof x === "object").map((x) => ({
    name: s(x.name, 60), kind: s(x.kind, 10), source: s(x.source, 10), reason: s(x.reason, 160), attempts: Number(x.attempts) || 0, costUsd: usd(x.costUsd),
    ...(Array.isArray(x.verdicts) && x.verdicts.length ? { verdicts: x.verdicts.slice(-3).map((v) => (v && typeof v === "object" ? { error: s(v.error, 120), ok: v.ok == null ? null : Boolean(v.ok), confidence: Number.isFinite(Number(v.confidence)) ? Number(v.confidence) : null, reads_as: s(v.reads_as, 60) } : null)).filter(Boolean) } : {}),
  }));
}

/** the shot review's summary from "planned" (engine lib/vision/index.js reviewForPrepare summary), bounded */
export function reviewSummary(r) {
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  const counts = (c) => (c && typeof c === "object" ? { match: n(c.match), partial: n(c.partial), miss: n(c.miss), unjudged: n(c.unjudged), ...(c.matchPct != null ? { matchPct: n(c.matchPct) } : {}) } : null);
  return { provider: String(r.provider ?? "").slice(0, 20), model: r.model == null ? null : String(r.model).slice(0, 40), first: counts(r.first), final: counts(r.final), passes: n(r.passes), fixes: n(r.fixes), reverted: n(r.reverted), cards: n(r.cards), unresolved: n(r.unresolved), costUsd: usd(r.costUsd), ms: n(r.ms), stopped: r.stopped == null ? null : String(r.stopped).slice(0, 160), ...(r.error ? { error: String(r.error).slice(0, 160) } : {}) };
}

/** what "planned" leaves on the prepare job's row (output.planned; the job's "done" output replaces it with its own) */
export function plannedSummary(ev) {
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  return {
    frames: n(ev.frames), duration: n(ev.duration), shots: n(ev.shots),
    builder: ev.builder ? { costUsd: usd(ev.builder.costUsd), built: n(ev.builder.built), cards: n(ev.builder.cards), ms: n(ev.builder.ms), needs: needLines(ev.builder.needs) } : null,
    director: ev.director ? { provider: String(ev.director.provider ?? "").slice(0, 20), model: ev.director.model ?? null, fellBack: Boolean(ev.director.fellBack), reused: Boolean(ev.director.reused), costUsd: usd(ev.director.costUsd), ms: n(ev.director.ms) } : null,
    review: ev.review && typeof ev.review === "object" ? reviewSummary(ev.review) : null,
    timing: ev.timing && typeof ev.timing === "object" ? Object.fromEntries(Object.entries(ev.timing).filter(([, v]) => Number.isFinite(Number(v))).slice(0, 12).map(([k, v]) => [String(k).slice(0, 20), Number(v)])) : null,
    gaps: Array.isArray(ev.gaps) ? ev.gaps.length : 0,
  };
}

// ---------------------------------------------------------------- one event on one job
/**
 * A worker's event or RunPod's webhook on one job row -> { job: patch | null, run: patch | null, ledger: rows[] }.
 * A job already done or failed takes no patch (duplicates, late webhooks of a timed-out try); its costs still count
 * once (ledger refs are unique).
 *   worker: { event: "progress", stage?, pct? } | { event: "voiced", costUsd, billedChars, chars }
 *           | { event: "planned", frames, duration, shots, builder, director, timing, gaps } | { event: "done", output }
 *           | { event: "failed", code, message, spend? }   (prepare: director/builder spend -> ledger rows, aiLedger)
 *   ("built", a new library asset, is handled by the runtime: renderRuntime.js saveAsset)
 *   RunPod: { event: "runpod", status, output, executionTime, delayTime, providerJobId }
 */
export function onJobEvent(job, ev, now = Date.now(), cfg = RENDER) {
  const ledger = [];
  const live = !TERMINAL.has(job.state);
  // only a finished RunPod job's numbers are final (an IN_PROGRESS status already carries delayTime: written then, its
  // ref would block the real row; found by the dry run of 2026-11-05)
  const ended = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(String(ev.status ?? "").toUpperCase());
  if (ev.event === "runpod" && ended && ev.providerJobId && (Number(ev.executionTime) > 0 || Number(ev.delayTime) > 0)) {
    const execS = (Number(ev.executionTime) || 0) / 1000, coldS = Math.min(cfg.coldStartBillSec, (Number(ev.delayTime) || 0) / 1000);
    ledger.push({ stage: `gpu_${job.role}`, provider: "runpod", ref: `gpu:${ev.providerJobId}`, usd: +((execS + coldS) * cfg.gpuUsdPerSec).toFixed(6), units: { executionS: +execS.toFixed(2), delayS: +(((Number(ev.delayTime) || 0) / 1000)).toFixed(2), billedS: +(execS + coldS).toFixed(2), role: job.role, idx: job.idx, attempt: job.attempt } });
  }
  if (ev.event === "voiced" && Number(ev.costUsd) > 0) ledger.push({ stage: "voice", provider: "elevenlabs", ref: `voice:${job.id}`, usd: +Number(ev.costUsd).toFixed(6), units: { billedChars: ev.billedChars ?? null, chars: ev.chars ?? null } });
  ledger.push(...aiLedger(job, ev));
  if (!live) return { job: null, run: null, ledger };
  const t = iso(now), started = job.started_at ? {} : { started_at: t };
  switch (ev.event) {
    case "progress": {
      const p = { state: "running", ...started, heartbeat_at: t };
      if (typeof ev.stage === "string") p.stage = ev.stage.slice(0, 20);
      if (Number.isFinite(Number(ev.pct))) p.pct = Math.max(0, Math.min(100, Math.round(Number(ev.pct))));
      return { job: p, run: null, ledger };
    }
    case "voiced": return { job: { state: "running", ...started, heartbeat_at: t, stage: "voice" }, run: { voice_ready: true }, ledger };
    case "planned": return { job: { state: "running", ...started, heartbeat_at: t, stage: "mix", output: { planned: plannedSummary(ev) } }, run: null, ledger };
    case "done": return { job: { state: "done", pct: 100, finished_at: t, output: ev.output ?? null }, run: null, ledger };
    case "failed": {
      // a prepare try keeps what it spent and why each needed thing was built or carded (the next try's builder budget
      // is the cap minus this spend: builderSpentOf; the owner's Details read the reasons)
      const keep = job.role === "prepare" && (ev.spend || ev.builder) ? { output: { ...(job.output ?? {}), ...(ev.spend && typeof ev.spend === "object" ? { spend: { builderUsd: usd(ev.spend.builderUsd), directorUsd: usd(ev.spend.directorUsd) } } : {}), ...(ev.builder && typeof ev.builder === "object" ? { builder: { built: Number(ev.builder.built) || 0, cards: Number(ev.builder.cards) || 0, costUsd: usd(ev.builder.costUsd), needs: needLines(ev.builder.needs) } } : {}) } } : {};
      return { job: { state: "failed", finished_at: t, error_code: String(ev.code ?? "RENDER_FAILED").slice(0, 40), error_message: String(ev.message ?? "").slice(0, 1500), ...keep }, run: null, ledger };
    }
    case "runpod": {
      const st = String(ev.status ?? "").toUpperCase(), out = ev.output ?? null;
      if (st === "COMPLETED" && out?.ok) return { job: { state: "done", pct: 100, finished_at: t, output: out }, run: null, ledger };
      if (st === "COMPLETED" || ["FAILED", "CANCELLED", "TIMED_OUT"].includes(st)) {
        // handler.py: an ok:false RESULT (NO_GPU) comes back COMPLETED; a raised error comes back FAILED with its text
        let code = out?.code ?? null, message = out?.error ?? null;
        if (!code && typeof ev.error === "string") { try { const e = JSON.parse(ev.error); code = e.code ?? null; message = e.error ?? ev.error; } catch { message = ev.error; } }
        return { job: { state: "failed", finished_at: t, error_code: String(code ?? (st === "TIMED_OUT" ? "JOB_TIMEOUT" : st === "CANCELLED" ? "CANCELLED" : "RENDER_FAILED")).slice(0, 40), error_message: String(message ?? `RunPod says ${st}`).slice(0, 1500) }, run: null, ledger };
      }
      if (st === "IN_PROGRESS" && job.state === "sent") return { job: { state: "running", ...started }, run: null, ledger };
      return { job: null, run: null, ledger };
    }
    default: return { job: null, run: null, ledger };
  }
}

// ---------------------------------------------------------------- the run's state machine
const tries = (jobs, role, idx = 0) => jobs.filter((j) => j.role === role && (j.idx ?? 0) === idx).sort((a, b) => a.attempt - b.attempt);

/** the next try of a piece whose last try failed: { do: "dispatch", attempt } | { do: "wait", until } | { do: "fail", code, message } */
export function retryOf(list, role, now, cfg = RENDER) {
  const last = list.at(-1);
  if (NO_RETRY.has(last.error_code)) return { do: "fail", code: last.error_code, message: last.error_message };
  const noGpu = list.filter((j) => j.state === "failed" && NO_GPU.has(j.error_code)).length;
  const other = list.filter((j) => j.state === "failed" && !NO_GPU.has(j.error_code)).length;
  if (other >= cfg.attempts[role] || noGpu > cfg.noGpuRetries) {
    return { do: "fail", code: role === "chunk" ? "CHUNK_FAILED" : role === "finish" ? "FINISH_FAILED" : last.error_code === "NO_GPU" ? "NO_GPU" : "PREPARE_FAILED", message: `${role}${role === "chunk" ? ` ${last.idx}` : ""} failed ${list.length} times; last: ${last.error_code} ${String(last.error_message ?? "").slice(0, 300)}` };
  }
  if (NO_GPU.has(last.error_code)) {
    const until = (ms(last.finished_at) ?? now) + cfg.noGpuDelaySec * 1000;
    if (now < until) return { do: "wait", until };
  }
  return { do: "dispatch", attempt: last.attempt + 1 };
}

/**
 * What a run needs now, from the run and all its job rows: { run: patch, jobs: [{ id, patch }], actions }.
 * actions: { type: "dispatch", role, idx, attempt, from?, to? } | { type: "cancel", jobId, providerJobId }
 *          | { type: "fail", code, message } | { type: "done", output (the finish job's) }
 * Pure and idempotent: run it after every event and from the sweeper; it only ever adds what is missing.
 */
export function reconcile(run, jobsIn, now = Date.now(), cfg = RENDER) {
  const out = { run: {}, jobs: [], actions: [] };
  const jobs = jobsIn.map((j) => ({ ...j }));
  if (TERMINAL.has(run.status)) {
    // a failed run leaves nothing running on RunPod
    for (const j of jobs) if (LIVE.has(j.state)) { out.jobs.push({ id: j.id, patch: { state: "failed", finished_at: iso(now), error_code: "CANCELLED", error_message: `the run is ${run.status}` } }); if (j.provider_job_id) out.actions.push({ type: "cancel", jobId: j.id, providerJobId: j.provider_job_id }); }
    return out;
  }
  const fail = (code, message) => { out.actions.push({ type: "fail", code, message: String(message ?? code).slice(0, 2000) }); return out; };
  // the hard limit counts from the first prepare try (2026-11-07: a run may wait in our own line first, renderQueue.js);
  // a run that never got a worker within maxWaitMin is failed and refunded as "busy"
  const firstSent = jobs.filter((j) => j.role === "prepare").map((j) => ms(j.dispatched_at ?? j.created_at)).filter(Number.isFinite);
  const since0 = firstSent.length ? Math.min(...firstSent) : null;
  if (since0 == null && cfg.maxWaitMin && now - ms(run.created_at) > cfg.maxWaitMin * 60000) return fail("QUEUE_TIMEOUT", `waited in line over ${cfg.maxWaitMin} minutes without a free worker`);
  if (now - (since0 ?? ms(run.created_at)) > cfg.hardMin * 60000) return fail("TIMEOUT", `not done after ${cfg.hardMin} minutes`);

  // 1. live jobs past their limits: cancelled, counted as a failed try
  for (const j of jobs) {
    if (!LIVE.has(j.state)) continue;
    const queued = j.state === "sent";
    const since = queued ? ms(j.dispatched_at ?? j.created_at) : ms(j.heartbeat_at ?? j.started_at ?? j.dispatched_at ?? j.created_at);
    const startedAt = ms(j.started_at ?? j.dispatched_at ?? j.created_at);
    // a chunk's limit grows with its frames (queue-aware chunking makes bigger chunks when the endpoint is busy)
    const limit = j.role === "chunk" && j.to_frame > j.from_frame ? chunkRunSec(j.to_frame - j.from_frame, cfg) : cfg.runSec[j.role];
    const over = queued ? now - since > cfg.queueSec * 1000 : now - startedAt > limit * 1000;
    if (!over) continue;
    const patch = { state: "failed", finished_at: iso(now), error_code: queued ? "QUEUE_TIMEOUT" : "JOB_TIMEOUT", error_message: queued ? `waited in RunPod's queue over ${cfg.queueSec} s` : `${j.role} ran over ${limit} s` };
    Object.assign(j, patch);
    out.jobs.push({ id: j.id, patch });
    if (j.provider_job_id) out.actions.push({ type: "cancel", jobId: j.id, providerJobId: j.provider_job_id });
  }

  // 2. the prepare job (voice, plan + checks, mix)
  const P = tries(jobs, "prepare");
  let prepDone = false;
  if (!P.length) out.actions.push({ type: "dispatch", role: "prepare", idx: 0, attempt: 1 });
  else {
    const last = P.at(-1);
    if (last.state === "failed") {
      const r = retryOf(P, "prepare", now, cfg);
      if (r.do === "fail") return fail(r.code, r.message);
      if (r.do === "dispatch") out.actions.push({ type: "dispatch", role: "prepare", idx: 0, attempt: r.attempt });
    }
    prepDone = last.state === "done";
  }

  // 3. the chunks (once the plan passed its checks and the server split it)
  const chunks = run.render?.chunks ?? null;
  let renderPct = 0, chunksDone = false;
  if (chunks?.length) {
    let done = 0, pctSum = 0;
    for (const c of chunks) {
      const C = tries(jobs, "chunk", c.index);
      if (!C.length) { out.actions.push({ type: "dispatch", role: "chunk", idx: c.index, attempt: 1, from: c.from, to: c.to }); continue; }
      const last = C.at(-1);
      if (last.state === "done") { done++; pctSum += 100; continue; }
      pctSum += Number(last.pct) || 0;
      if (last.state === "failed") {
        const r = retryOf(C, "chunk", now, cfg);
        if (r.do === "fail") return fail(r.code, r.message);
        if (r.do === "dispatch") out.actions.push({ type: "dispatch", role: "chunk", idx: c.index, attempt: r.attempt, from: c.from, to: c.to });
      }
    }
    chunksDone = done === chunks.length;
    renderPct = pctSum / chunks.length;
  }

  // 4. the finish (all chunks + the mix), then done
  if (chunksDone && prepDone) {
    const F = tries(jobs, "finish");
    if (!F.length) out.actions.push({ type: "dispatch", role: "finish", idx: 0, attempt: 1 });
    else {
      const last = F.at(-1);
      if (last.state === "done") { out.actions.push({ type: "done", output: last.output ?? null }); return out; }
      if (last.state === "failed") {
        const r = retryOf(F, "finish", now, cfg);
        if (r.do === "fail") return fail(r.code, r.message);
        if (r.do === "dispatch") out.actions.push({ type: "dispatch", role: "finish", idx: 0, attempt: r.attempt });
      }
    }
  }

  // 5. what the page shows (only ever forward)
  const stage = P.at(-1)?.stage;
  const want = chunks?.length ? "render" : PLAN_STAGES.has(stage) ? "plan" : stage === "voice" ? "voice" : "queued";
  const status = ORDER.indexOf(want) > ORDER.indexOf(run.status ?? "queued") ? want : run.status ?? "queued";
  const pct = status === "render" ? Math.round(15 + (chunksDone ? 80 + (prepDone ? 2 : 0) : renderPct * 0.8)) : status === "plan" || status === "voice" ? STAGE_PCT[stage] ?? (status === "plan" ? 12 : 5) : 0;
  if (status !== run.status) Object.assign(out.run, { status, stage_at: iso(now) });
  if (pct > (Number(run.pct) || 0)) out.run.pct = Math.min(99, pct);
  return out;
}

/** THE VOICE-FAILURE METRIC (soft launch): of the finished runs, how many failed AFTER their paid voice was made (the take
 *  is paid and lost), as a count, a % and by failure code. runs: [{ status, voice_ready, error_code }] (the runs table).
 *  Over ~5 %: switch BLOCKY_WORLDS_VOICE_AFTER_STORYBOARD on. */
export function voiceFailureStats(runs = []) {
  const ended = runs.filter((r) => r.status === "done" || r.status === "failed");
  const after = ended.filter((r) => r.status === "failed" && r.voice_ready);
  const byCode = {}; for (const r of after) byCode[r.error_code ?? "UNKNOWN"] = (byCode[r.error_code ?? "UNKNOWN"] ?? 0) + 1;
  return { runs: ended.length, failedAfterVoice: after.length, pct: ended.length ? +((100 * after.length) / ended.length).toFixed(1) : 0, byCode, switchOn: ended.length >= 20 && after.length / ended.length > 0.05 };
}
/** every ledger row's usd by stage, and the total */
export function costSummary(rows) {
  const by = {};
  for (const r of rows ?? []) by[r.stage] = +((by[r.stage] ?? 0) + Number(r.usd || 0)).toFixed(6);
  return { byStage: by, totalUsd: +Object.values(by).reduce((a, b) => a + b, 0).toFixed(6) };
}

/** the expected wall time and cost of one video (docs/blocky-worlds-pipeline.md), from the paid test's numbers */
export function estimate(lengthSec, { sPerFrame = 0.1, loadS = 30, startS = 10, voiceS = 15, finishS = 20, chars = null } = {}) {
  const frames = Math.round(lengthSec * RENDER.fps), K = Math.min(RENDER.maxChunks, Math.max(RENDER.minChunks, Math.ceil(frames / RENDER.framesPerChunk)));
  const chunkS = startS + 2 + loadS + (frames / K) * sPerFrame + 6;
  const wallS = 8 + voiceS + 3 + chunkS + finishS;
  const gpuS = 60 + K * chunkS + finishS;
  const voiceChars = chars ?? Math.round(((lengthSec * 220) / 60) * RATES.charsPerWord);
  const voiceUsd = voiceChars * RATES.voiceUsdPerChar;
  return { frames, chunks: K, wallS: Math.round(wallS), gpuS: Math.round(gpuS), gpuUsd: +(gpuS * RENDER.gpuUsdPerSec).toFixed(3), voiceUsd: +voiceUsd.toFixed(3), totalUsd: +(gpuS * RENDER.gpuUsdPerSec + voiceUsd + RATES.storageUsd).toFixed(3) };
}
