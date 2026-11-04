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
  runSec: Object.freeze({ prepare: 300, chunk: 420, finish: 300 }),
  hardMin: 25,                  // the whole run
  coldStartBillSec: 15,         // RunPod bills the start-up inside delayTime: up to this much of it is counted
  gpuUsdPerSec: RATES.gpuUsdPerSec,
  music: "A",
});

const TERMINAL = new Set(["done", "failed"]);
const LIVE = new Set(["sent", "running"]);
export const ROLES = Object.freeze(["prepare", "chunk", "finish"]);
/** failures the video itself causes (or an empty balance / a missing config): a retry would fail the same way */
// (KIT_MISSING: an object the engine kit can't build; TIMELINE_INVALID: the engine page refused the timeline, on any GPU)
export const NO_RETRY = new Set(["VISUAL_CHECK", "SUBJECT_CHECK", "PLAN_FAILED", "KIT_MISSING", "TIMELINE_INVALID", "VOICE_CONFIG", "PROVIDER_BALANCE", "BAD_JOB", "NOT_CONFIGURED"]);
const NO_GPU = new Set(["NO_GPU"]);
const ORDER = ["queued", "voice", "plan", "render", "done"];
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
export function chunkPlan(tl, { cfg = RENDER, limitFrames = null, k: forceK = null } = {}) {
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
  let K = Math.min(cfg.maxChunks, Math.max(cfg.minChunks, Math.ceil(N / cfg.framesPerChunk)));
  K = Math.min(K, N);
  let plan = build(K);
  while (plan.some((c) => c.estBytes > cfg.chunkBytesTarget) && K < Math.min(cfg.maxChunks, N)) plan = build(++K);
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
    timeline: `${d}/timeline.json`, visualCheck: `${d}/visual-check.json`, mix: `${d}/mix.m4a`,
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

// ---------------------------------------------------------------- one event on one job
/**
 * A worker's event or RunPod's webhook on one job row -> { job: patch | null, run: patch | null, ledger: rows[] }.
 * A job already done or failed takes no patch (duplicates, late webhooks of a timed-out try); its costs still count
 * once (ledger refs are unique).
 *   worker: { event: "progress", stage?, pct? } | { event: "voiced", costUsd, billedChars, chars }
 *           | { event: "planned", frames, duration, shots } | { event: "done", output } | { event: "failed", code, message }
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
    case "planned": return { job: { state: "running", ...started, heartbeat_at: t, stage: "mix" }, run: null, ledger };
    case "done": return { job: { state: "done", pct: 100, finished_at: t, output: ev.output ?? null }, run: null, ledger };
    case "failed": return { job: { state: "failed", finished_at: t, error_code: String(ev.code ?? "RENDER_FAILED").slice(0, 40), error_message: String(ev.message ?? "").slice(0, 1500) }, run: null, ledger };
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
  if (now - ms(run.created_at) > cfg.hardMin * 60000) return fail("TIMEOUT", `not done after ${cfg.hardMin} minutes`);

  // 1. live jobs past their limits: cancelled, counted as a failed try
  for (const j of jobs) {
    if (!LIVE.has(j.state)) continue;
    const queued = j.state === "sent";
    const since = queued ? ms(j.dispatched_at ?? j.created_at) : ms(j.heartbeat_at ?? j.started_at ?? j.dispatched_at ?? j.created_at);
    const startedAt = ms(j.started_at ?? j.dispatched_at ?? j.created_at);
    const over = queued ? now - since > cfg.queueSec * 1000 : now - startedAt > cfg.runSec[j.role] * 1000;
    if (!over) continue;
    const patch = { state: "failed", finished_at: iso(now), error_code: queued ? "QUEUE_TIMEOUT" : "JOB_TIMEOUT", error_message: queued ? `waited in RunPod's queue over ${cfg.queueSec} s` : `${j.role} ran over ${cfg.runSec[j.role]} s` };
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
  const want = chunks?.length ? "render" : stage === "plan" || stage === "mix" ? "plan" : stage === "voice" ? "voice" : "queued";
  const status = ORDER.indexOf(want) > ORDER.indexOf(run.status ?? "queued") ? want : run.status ?? "queued";
  const pct = status === "render" ? Math.round(15 + (chunksDone ? 80 + (prepDone ? 2 : 0) : renderPct * 0.8)) : status === "plan" ? 12 : status === "voice" ? 5 : 0;
  if (status !== run.status) Object.assign(out.run, { status, stage_at: iso(now) });
  if (pct > (Number(run.pct) || 0)) out.run.pct = Math.min(99, pct);
  return out;
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
