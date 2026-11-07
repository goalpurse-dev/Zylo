// Blocky Worlds: the shared line for the GPU endpoint (2026-11-07). Pure, no I/O: renderRuntime.js and blocky-worlds-api
// call it with rows they read; the simulator (engine/dev/queueSim.mjs) and the tests call it with made-up runs.
//
// The endpoint has `RENDER.workers` workers (6) for every video in flight. Three things live here:
//   admission()        oldest run first: how many of its waiting pieces each live run may send to RunPod now, so RunPod's
//                      own queue only ever holds pieces that are starting up (a piece that waits there over queueSec is
//                      cancelled as QUEUE_TIMEOUT: with 3+ videos and 9 chunks each that used to happen)
//   measureDurations() rolling averages from the newest finished job rows (prepare, chunk overhead + seconds a frame,
//                      finish, cold start)
//   simulate()         a 1-second step simulation of the workers: the wait table for N customers, and each live run's
//                      place in line + ETA (forecast(), queueStatus())
import { chooseChunkCount, reconcile, RENDER } from "./render.js";

/** what one piece takes on a worker when nothing was measured yet (the 3 paid runs of 2026-11-05/06, page load 14 s) */
export const DURATIONS = Object.freeze({
  prepareS: 120,        // voice + director + builder + shot review + plan + checks + music + mix (1620fc3e: 117 s)
  planTailS: 27,        // the part of it after "planned" (music + mix + uploads): the chunks start meanwhile
  chunkOverheadS: 20,   // inside a chunk job besides the frames: GPU check, timeline, page load (14 s), web copy, uploads
  chunkSPerFrame: 0.118,// GPU render seconds a frame (all chunks of 3 runs, outliers included: 72-608 ms)
  finishS: 12,          // download + join + mux + upload
  coldS: 30,            // a new worker's start-up (image cached, FlashBoot): RunPod's delayTime of the first wave
  warmS: 2,             // a worker that just finished a piece picks up the next one
  idleTimeoutS: 5,      // the endpoint's idleTimeout: a worker idle longer is gone (the next piece pays coldS)
  sweepLagS: 30,        // a piece over queueSec is noticed by the next sweep (every minute: ~30 s later on average)
});
const ROLE_ORDER = { prepare: 0, chunk: 1, finish: 2 };
const LIVE = new Set(["sent", "running"]);
const ms = (t) => (t == null ? null : typeof t === "number" ? t : Date.parse(t));
const median = (l) => { const s = l.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const byAge = (a, b) => (ms(a.created_at) ?? 0) - (ms(b.created_at) ?? 0) || String(a.id).localeCompare(String(b.id));

// ---------------------------------------------------------------- admission: oldest run first
/**
 * runs: the live runs; jobsByRun: Map(runId -> job rows). -> Map(runId -> how many of its waiting pieces it may send now).
 * The free workers (workers - live pieces of every run) go to the oldest run first; a run's own pieces in reconcile's
 * order (prepare, chunks by index, finish).
 */
export function admission(runs, jobsByRun, now = Date.now(), cfg = RENDER) {
  const W = Math.max(1, Number(cfg.workers) || 6);
  let live = 0;
  for (const r of runs) for (const j of jobsByRun.get(r.id) ?? []) if (LIVE.has(j.state)) live++;
  // + queueSlack: one piece more than the workers waits in RunPod's own queue, so a worker that ends a piece takes the
  // next one at once (warm) instead of waiting for the webhook -> send round trip (it waits one piece at most: < queueSec)
  let free = W + (Number(cfg.queueSlack) || 0) - live;
  const out = new Map();
  for (const r of [...runs].sort(byAge)) {
    let wanted = 0;
    try { wanted = reconcile(r, jobsByRun.get(r.id) ?? [], now, cfg).actions.filter((a) => a.type === "dispatch").length; } catch { wanted = 0; }
    const allow = Math.max(0, Math.min(wanted, free));
    out.set(r.id, allow);
    free -= allow;
  }
  return out;
}

/** our live runs that still have frames to render (the K choice's activeRuns): not all chunks done yet */
export function activeRenderRuns(runs, jobsByRun) {
  let n = 0;
  for (const r of runs) {
    const chunks = r.render?.chunks;
    if (!chunks?.length) { n++; continue; }
    const jobs = jobsByRun.get(r.id) ?? [];
    if (!chunks.every((c) => jobs.some((j) => j.role === "chunk" && j.idx === c.index && j.state === "done"))) n++;
  }
  return n;
}

// ---------------------------------------------------------------- rolling averages from the job rows
/**
 * The newest finished job rows (blocky_worlds_jobs: role, state, attempt, dispatched_at, started_at, finished_at,
 * from_frame, to_frame, output) -> DURATIONS measured (each value falls back to the default when there is no sample).
 */
export function measureDurations(jobs, base = DURATIONS) {
  const done = (jobs ?? []).filter((j) => j && j.state === "done");
  const span = (j) => (ms(j.started_at) && ms(j.finished_at) ? (ms(j.finished_at) - ms(j.started_at)) / 1000 : null);
  const out = { ...base }, samples = { prepare: 0, chunk: 0, finish: 0, cold: 0 };
  // prepare: whole tries only (a resumed retry only mixes)
  const preps = done.filter((j) => j.role === "prepare" && !j.output?.resumed);
  const prepS = median(preps.map((j) => Number(j.output?.totalS) || span(j)).filter((x) => x > 20 && x < 900));
  if (prepS) { out.prepareS = Math.round(prepS); samples.prepare = preps.length; }
  const tail = median(preps.map((j) => { const t = j.output?.timing ?? {}; const s = (Number(t.music) || 0) + (Number(t.mix) || 0); return s > 0 ? s + 5 : null; }));
  if (tail) out.planTailS = Math.round(Math.min(out.prepareS - 10, tail));
  // chunks: seconds a frame = sum(render - page load) / sum(frames) (slow chunks count by their weight)
  let renderS = 0, frames = 0;
  const over = [];
  for (const j of done.filter((x) => x.role === "chunk")) {
    const o = j.output ?? {}, t = o.timing ?? {}, f = Number(o.frames) || (j.to_frame - j.from_frame) || 0, load = Number(o.loadS) || 0;
    if (!(Number(t.render) > 0) || !(f > 0)) continue;
    renderS += Math.max(0, Number(t.render) - load); frames += f;
    over.push(load + (Number(t.gpuCheck) || 0) + (Number(t.web) || 0) + (Number(t.upload) || 0) + 2);
    samples.chunk++;
  }
  if (frames > 0) out.chunkSPerFrame = +(renderS / frames).toFixed(4);
  if (over.length) out.chunkOverheadS = Math.round(median(over));
  const fin = done.filter((j) => j.role === "finish").map((j) => { const t = j.output?.timing ?? {}; const s = (Number(t.download) || 0) + (Number(t.join) || 0) + (Number(t.upload) || 0); return s > 0 ? s + 2 : null; }).filter(Boolean);
  if (fin.length) { out.finishS = Math.round(median(fin)); samples.finish = fin.length; }
  // cold start: per run the quickest chunk start of the first wave, and each run's first prepare try
  const waits = [];
  const byRun = new Map();
  for (const j of jobs ?? []) { if (!j?.started_at || !j.dispatched_at) continue; const w = (ms(j.started_at) - ms(j.dispatched_at)) / 1000; if (!(w >= 0)) continue; if (j.role === "prepare" && j.attempt === 1) waits.push(w); if (j.role === "chunk" && j.attempt === 1) byRun.set(j.run_id, Math.min(byRun.get(j.run_id) ?? Infinity, w)); }
  waits.push(...byRun.values());
  const cold = median(waits);
  if (cold != null) { out.coldS = Math.round(Math.max(5, Math.min(120, cold))); samples.cold = waits.length; }
  return { ...out, samples };
}

// ---------------------------------------------------------------- the simulator
const chunkSec = (frames, dur) => Math.max(1, Math.round(dur.chunkOverheadS + frames * dur.chunkSPerFrame));
/** the chunk count without the queue (the old fixed rule: one chunk per framesPerChunk frames) */
export const fixedChunkCount = (frames, cfg = RENDER) => Math.min(cfg.maxChunks, Math.max(cfg.minChunks, Math.ceil(frames / cfg.framesPerChunk)));

/**
 * Simulates the workers second by second.
 *   runs: [{ id, t0 (s, when Generate was pressed; negative = before now), frames, jobs?: initial pieces (forecast) ,
 *            planned?, K? }]
 *   mode: "queue" (2026-11-07: oldest-first admission + queue-aware chunk count) | "fixed" (before: every piece sent
 *         to RunPod at once, first come first served, fixed chunk count, QUEUE_TIMEOUT after queueSec)
 * -> { runs: [{ id, startS, plannedS, K, doneS, failed, failCode, queueTimeouts }], endS }
 */
export function simulate({ runs: input, cfg = RENDER, dur = DURATIONS, mode = "queue", horizonS = 4 * 3600 } = {}) {
  const W = Math.max(1, Number(cfg.workers) || 6), queueMode = mode === "queue";
  const slots = Array.from({ length: W }, () => ({ job: null, warmUntil: -Infinity }));
  let seq = 0;
  const runs = input.map((r, order) => ({ id: r.id ?? `run${order + 1}`, order, t0: Number(r.t0) || 0, frames: r.frames, K: r.K ?? null, planned: Boolean(r.planned), present: false, failed: false, failCode: null, startS: null, plannedS: r.planned ? 0 : null, doneS: null, queueTimeouts: 0, jobs: [], init: r.jobs ?? null }));
  const jobs = [];
  const mk = (run, role, idx, extra = {}) => { const j = { run, role, idx, state: "wait", readyAt: -Infinity, attempt: 1, seq: seq++, left: 0, elapsed: 0, startLeft: 0, dispatchedAt: null, ...extra }; run.jobs.push(j); jobs.push(j); return j; };
  const prepareJob = (run) => mk(run, "prepare", 0, { left: dur.prepareS, planAt: dur.prepareS - dur.planTailS });
  const makeChunks = (run, t) => {
    const n = run.frames, K = run.K, base = Math.floor(n / K), rest = n % K;
    for (let i = 0; i < K; i++) { const f = base + (i < rest ? 1 : 0); mk(run, "chunk", i, { frames: f, left: chunkSec(f, dur), readyAt: t }); }
  };
  const cur = (run, role) => run.jobs.filter((j) => j.role === role && j.state !== "cancel");
  const live = () => jobs.filter((j) => j.state === "queued" || j.state === "start" || j.state === "run");
  const activeRuns = () => runs.filter((r) => r.present && !r.failed && r.doneS == null && !(r.planned && cur(r, "chunk").every((j) => j.state === "done"))).length;
  const plan = (run, t) => {
    if (run.planned) return;
    if (queueMode) {
      // what applyPlanned sees: our videos still rendering (this one included) and RunPod's queued / running pieces
      const l = live(), q = l.filter((j) => j.state !== "run").length, p = l.length - q;
      run.K = chooseChunkCount({ frames: run.frames, activeRuns: activeRuns(), health: { jobs: { inQueue: q, inProgress: p } }, cfg }).k;
    } else run.K = fixedChunkCount(run.frames, cfg);
    run.planned = true; run.plannedS = t;
    makeChunks(run, t);
  };
  const failRun = (run, code, t) => {
    run.failed = true; run.failCode = code; run.doneS = t;
    for (const j of run.jobs) { if (j.slot) { j.slot.job = null; j.slot.warmUntil = t + dur.idleTimeoutS; j.slot = null; } if (j.state !== "done") j.state = "cancel"; }
  };
  const take = (j, slot, t, startLeft) => { slot.job = j; j.slot = slot; j.state = startLeft > 0 ? "start" : "run"; j.startLeft = startLeft; if (j.state === "run") j.startedAt = t; };

  // live state: the pieces already on RunPod take their slots first (forecast)
  for (const run of runs) {
    if (!run.init) continue;
    run.present = run.t0 <= 0;
    for (const s of run.init) {
      const j = mk(run, s.role, s.idx ?? 0, { frames: s.frames, left: Math.max(1, Math.round(s.left ?? 0)), planAt: s.planAt ?? -1, readyAt: -Infinity, dispatchedAt: s.dispatchedAt ?? null, startLeft: s.startLeft ?? 0, state: s.state });
      if (s.role === "prepare" && (s.state === "run" || s.state === "done")) run.startS = s.state === "run" ? -(s.elapsed ?? 0) : -1;
      if (s.state === "run") { const slot = slots.find((x) => !x.job); if (slot) take(j, slot, 0, 0); else j.state = "queued"; }
      else if (s.state === "start") { const slot = slots.find((x) => !x.job); if (slot) take(j, slot, 0, Math.max(1, s.startLeft ?? dur.coldS)); else j.state = "queued"; }
    }
  }

  let t = 0;
  for (; t < horizonS; t++) {
    // 1. arrivals; the finish once the chunks and the mix are done
    for (const run of runs) {
      if (run.failed || run.doneS != null) continue;
      if (!run.present && run.t0 <= t) { run.present = true; if (!run.init) prepareJob(run).readyAt = run.t0; }
      if (!run.present) continue;
      const prep = cur(run, "prepare").at(-1);
      if (run.planned && prep?.state === "done" && !run.jobs.some((j) => j.role === "finish") && cur(run, "chunk").every((j) => j.state === "done")) mk(run, "finish", 0, { left: dur.finishS, readyAt: t });
      if (!run.planned && prep?.state === "done") plan(run, t);
    }
    if (runs.every((r) => r.failed || r.doneS != null)) break;
    // 2. sending: queue mode only while a worker is free (oldest run first); fixed mode everything at once
    const waiting = jobs.filter((j) => j.state === "wait" && j.readyAt <= t && !j.run.failed).sort((a, b) => a.run.t0 - b.run.t0 || a.run.order - b.run.order || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.idx - b.idx);
    let room = queueMode ? W + (Number(cfg.queueSlack) || 0) - live().length : Infinity;
    for (const j of waiting) { if (room <= 0) break; j.state = "queued"; j.dispatchedAt = t; room--; }
    // 3. RunPod's queue: over queueSec (noticed by the next sweep) -> cancelled, a failed try, sent again at the back
    for (const j of jobs) {
      if ((j.state !== "queued" && j.state !== "start") || j.dispatchedAt == null) continue;
      if (t - j.dispatchedAt < cfg.queueSec + dur.sweepLagS) continue;
      j.run.queueTimeouts++;
      if (j.slot) { j.slot.job = null; j.slot = null; }
      if (j.attempt >= cfg.attempts[j.role]) { failRun(j.run, j.role === "chunk" ? "CHUNK_FAILED" : j.role === "finish" ? "FINISH_FAILED" : "PREPARE_FAILED", t); continue; }
      j.state = "cancel";
      mk(j.run, j.role, j.idx, { frames: j.frames, left: j.role === "prepare" ? dur.prepareS : j.role === "finish" ? dur.finishS : chunkSec(j.frames, dur), planAt: j.planAt, attempt: j.attempt + 1, readyAt: t });
    }
    // 4. free workers take the oldest sent piece (a warm one first: no start-up)
    const queued = jobs.filter((j) => j.state === "queued").sort((a, b) => a.dispatchedAt - b.dispatchedAt || a.seq - b.seq);
    for (const j of queued) {
      const free = slots.filter((s) => !s.job);
      if (!free.length) break;
      const warm = free.find((s) => s.warmUntil >= t);
      take(j, warm ?? free[0], t, warm ? dur.warmS : (j.startLeft > 0 ? j.startLeft : dur.coldS));
    }
    // 5. one second of work
    for (const s of slots) {
      const j = s.job;
      if (!j) continue;
      if (j.state === "start") { if (--j.startLeft <= 0) { j.state = "run"; j.startedAt = t + 1; if (j.role === "prepare" && j.run.startS == null) j.run.startS = t + 1; } continue; }
      j.left--; j.elapsed++;
      if (j.role === "prepare" && !j.run.planned && j.planAt >= 0 && j.elapsed >= j.planAt) plan(j.run, t + 1);
      if (j.left <= 0) {
        j.state = "done"; s.job = null; j.slot = null; s.warmUntil = t + 1 + dur.idleTimeoutS;
        if (j.role === "finish") j.run.doneS = t + 1;
      }
    }
  }
  return { endS: t, runs: runs.map((r) => ({ id: r.id, startS: r.startS, plannedS: r.plannedS, K: r.K, doneS: r.doneS, failed: r.failed, failCode: r.failCode, queueTimeouts: r.queueTimeouts })) };
}

/** first / median / last finish (s from Generate) of N customers pressing Generate at the same time */
export function waitTable({ customers, frames = 2250, cfg = RENDER, dur = DURATIONS, mode = "queue", spreadS = 0 }) {
  const runs = Array.from({ length: customers }, (_, i) => ({ id: `c${i + 1}`, t0: i * spreadS, frames }));
  const sim = simulate({ runs, cfg, dur, mode });
  const fin = sim.runs.map((r) => (r.doneS == null ? null : r.doneS - runs.find((x) => x.id === r.id).t0));
  const ok = fin.filter((x) => x != null).sort((a, b) => a - b);
  const starts = sim.runs.map((r) => r.startS).filter((x) => x != null).sort((a, b) => a - b);
  return {
    customers, mode, first: ok[0] ?? null, median: median(ok), last: ok.at(-1) ?? null, failed: sim.runs.filter((r) => r.failed).length,
    queueTimeouts: sim.runs.reduce((a, r) => a + r.queueTimeouts, 0), chunks: [...new Set(sim.runs.map((r) => r.K))], lastStartS: starts.at(-1) ?? null, runs: sim.runs,
  };
}

// ---------------------------------------------------------------- the live forecast
const lastTry = (jobs, role, idx = 0) => jobs.filter((j) => j.role === role && (j.idx ?? 0) === idx).sort((a, b) => a.attempt - b.attempt).at(-1) ?? null;
/** a job row -> the simulator's piece ({ state, left, startLeft, dispatchedAt, elapsed }) or null (not sent: waits) */
function pieceOf(j, fullS, nowMs, dur) {
  if (!j || j.state === "failed") return null;
  if (j.state === "done") return { state: "done", left: 0 };
  if (j.state === "sent") {
    const waited = Math.max(0, (nowMs - (ms(j.dispatched_at ?? j.created_at) ?? nowMs)) / 1000);
    return { state: "start", left: fullS, startLeft: Math.max(dur.warmS, Math.round(dur.coldS - waited)), dispatchedAt: -waited };
  }
  const elapsed = Math.max(0, (nowMs - (ms(j.started_at ?? j.dispatched_at ?? j.created_at) ?? nowMs)) / 1000);
  return { state: "run", left: Math.max(3, Math.round(fullS - elapsed)), elapsed, dispatchedAt: -elapsed };
}

/**
 * The live runs (rows) and their job rows -> the simulator's runs, then simulate() in queue mode.
 * -> Map(runId -> { startS (s from now until its prepare runs; 0 = running), doneS (s from now until the video is ready) })
 */
export function forecast(runs, jobsByRun, nowMs = Date.now(), { cfg = RENDER, dur = DURATIONS } = {}) {
  const sorted = [...runs].sort(byAge);
  const simRuns = sorted.map((r) => {
    const jobs = jobsByRun.get(r.id) ?? [];
    const frames = Number(r.render?.frames) || Math.round((Number(r.length_sec) || 90) * 24 * 1.03);
    const chunks = r.planned_at && r.render?.chunks?.length ? r.render.chunks : null;
    const init = [];
    const p = lastTry(jobs, "prepare");
    let prep = pieceOf(p, dur.prepareS, nowMs, dur);
    if (prep?.state === "run") {
      if (chunks) prep.left = Math.max(3, Math.round(dur.planTailS - Math.max(0, (nowMs - ms(r.planned_at)) / 1000)));
      else prep.left = Math.max(dur.planTailS + 3, prep.left);
      prep.planAt = chunks ? -1 : prep.elapsed + (prep.left - dur.planTailS);
    } else if (prep) prep.planAt = chunks ? -1 : dur.prepareS - dur.planTailS;
    init.push(prep ? { role: "prepare", idx: 0, ...prep } : { role: "prepare", idx: 0, state: "wait", left: dur.prepareS, planAt: dur.prepareS - dur.planTailS });
    for (const c of chunks ?? []) {
      const f = c.to - c.from, full = chunkSec(f, dur);
      init.push({ role: "chunk", idx: c.index, frames: f, ...(pieceOf(lastTry(jobs, "chunk", c.index), full, nowMs, dur) ?? { state: "wait", left: full }) });
    }
    const fin = pieceOf(lastTry(jobs, "finish"), dur.finishS, nowMs, dur);
    if (fin) init.push({ role: "finish", idx: 0, ...fin });
    return { id: r.id, t0: -Math.max(0, (nowMs - (ms(r.created_at) ?? nowMs)) / 1000), frames, planned: Boolean(chunks), K: chunks?.length ?? null, jobs: init };
  });
  const sim = simulate({ runs: simRuns, cfg, dur, mode: "queue" });
  return new Map(sim.runs.map((r) => [r.id, { startS: r.startS == null ? null : Math.max(0, r.startS), doneS: r.doneS == null ? null : Math.max(0, r.doneS) }]));
}

/**
 * What the page shows for one run: its place in line while its prepare job hasn't started on a worker (oldest first),
 * the seconds until it starts, and the seconds until the video is ready.
 * -> { queuePosition: n | null, etaSec: s | null (until it starts; only while in line), doneEtaSec: s | null }
 */
export function queueStatus(runId, runs, jobsByRun, nowMs = Date.now(), opts = {}) {
  return queueStatuses([runId], runs, jobsByRun, nowMs, opts)[runId];
}
/** queueStatus for several runs from one simulation -> { [runId]: { queuePosition, etaSec, doneEtaSec } } */
export function queueStatuses(runIds, runs, jobsByRun, nowMs = Date.now(), opts = {}) {
  const none = { queuePosition: null, etaSec: null, doneEtaSec: null };
  const working = runs.filter((r) => !["done", "failed"].includes(r.status));
  const notStarted = (r) => { const p = lastTry(jobsByRun.get(r.id) ?? [], "prepare"); return !p || p.state === "sent" || (p.state === "failed" && !r.planned_at); };
  const line = working.filter(notStarted).sort(byAge);
  let f = new Map();
  if (runIds.some((id) => working.some((r) => r.id === id))) { try { f = forecast(working, jobsByRun, nowMs, opts); } catch { f = new Map(); } }
  const out = {};
  for (const id of runIds) {
    if (!working.some((r) => r.id === id)) { out[id] = none; continue; }
    const pos = line.findIndex((r) => r.id === id), e = f.get(id) ?? null;
    out[id] = {
      queuePosition: pos >= 0 ? pos + 1 : null,
      etaSec: pos >= 0 && e?.startS != null ? Math.round(e.startS) : null,
      doneEtaSec: e?.doneS != null ? Math.round(e.doneS) : null,
    };
  }
  return out;
}
