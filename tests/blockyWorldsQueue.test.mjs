// Blocky Worlds: the shared line for the GPU endpoint (2026-11-07): queue-aware chunk count, oldest-first admission,
// the runtime holding pieces while every worker is busy, rolling averages, the simulator (1/3/5 customers), the live
// place in line + ETA, and the page's words for each state. No network, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chooseChunkCount, chunkMinCount, chunkPlan, chunkProblems, chunkRunSec, maxFramesPerChunk, reconcile, RENDER } from "../supabase/functions/_shared/blockyWorlds/render.js";
import { activeRenderRuns, admission, DURATIONS, fixedChunkCount, forecast, measureDurations, queueStatus, queueStatuses, simulate, waitTable } from "../supabase/functions/_shared/blockyWorlds/renderQueue.js";
import { makeRuntime } from "../supabase/functions/_shared/blockyWorlds/renderRuntime.js";
import { fileStorage, memoryDb, scriptedRunPod } from "../scripts/blockyWorlds/engine/dev/pipelineFakes.mjs";
import { aboutTime, waitInfo } from "../src/components/viral-tools/blocky-worlds/queueText.js";

const T0 = Date.parse("2026-11-07T10:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const F90 = 2250, F60 = 1483, F30 = 742;

function timeline(sec = 90) {
  const shots = [];
  for (let t = 0, i = 0; t < sec; i++) { const end = Math.min(sec, +(t + 2.3 + (i % 3) * 0.4).toFixed(2)); shots.push({ start: t, end, set: i % 4 < 2 ? "street" : "bedroom", light: "day", camera: "medium" }); t = end; }
  return { version: 1, fps: 24, duration: sec, shots };
}

// ---------------------------------------------------------------- the chunk count
test("K: alone up to 6 chunks (one wave), 2 videos 3 each, 3+ the fewest the run limit allows; RunPod full -> the fewest", () => {
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 1 }).k, 6);
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 2 }).k, 3);
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 3 }).k, 3, "90 s: 2 chunks of ~1,125 frames would pass the safe size");
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 5 }).k, 3);
  assert.equal(chooseChunkCount({ frames: F60, activeRuns: 1 }).k, 6);
  assert.equal(chooseChunkCount({ frames: F60, activeRuns: 3 }).k, 2);
  assert.equal(chooseChunkCount({ frames: F30, activeRuns: 1 }).k, 3, "a short video never gets more chunks than the old rule");
  const full = chooseChunkCount({ frames: F90, activeRuns: 1, health: { jobs: { inQueue: 3, inProgress: 6 } } });
  assert.equal(full.k, full.kMin); assert.ok(full.saturated);
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 1, health: { jobs: { inQueue: 0, inProgress: 1 } } }).k, 6, "its own prepare job running is not 'full'");
  for (const frames of [F30, F60, F90, 4400]) for (const n of [1, 2, 3, 5, 10]) {
    const c = chooseChunkCount({ frames, activeRuns: n });
    assert.ok(c.k >= chunkMinCount(frames) && c.k <= RENDER.maxChunks, `${frames}/${n}: ${c.k}`);
    assert.ok(Math.ceil(frames / c.k) <= maxFramesPerChunk(), `${frames}/${n}: chunk of ${Math.ceil(frames / c.k)} frames`);
  }
  assert.equal(chooseChunkCount({ frames: F90, activeRuns: 2, cfg: { ...RENDER, workers: 10 } }).k, 5);
});

test("K: the split for a target is deterministic, covers every frame, and grows only for the size", () => {
  const tl = timeline(90), N = 90 * 24;
  for (const k of [2, 3, 6]) {
    const a = chunkPlan(tl, { target: k, bytesTarget: RENDER.queueBytesTarget }), b = chunkPlan(tl, { target: k, bytesTarget: RENDER.queueBytesTarget });
    assert.deepEqual(a, b, "same timeline + same K -> the same frame ranges (retries render the same frames)");
    assert.deepEqual(chunkProblems(a, N), []);
    assert.ok(a.length >= k && a.every((c) => c.estBytes <= RENDER.queueBytesTarget || a.length === RENDER.maxChunks));
  }
  assert.equal(chunkPlan(tl, { target: 3, bytesTarget: 1e12 }).length, 3);
  assert.ok(chunkPlan(tl, { target: 2, bytesTarget: 20e6 }).length > 2, "too big for the size target -> more chunks");
});

test("K: a bigger chunk gets a longer run limit (never under 420 s, never over 840 s); reconcile and dispatch use it", () => {
  assert.equal(chunkRunSec(250), RENDER.runSec.chunk);
  assert.equal(chunkRunSec(750), RENDER.runSec.chunk, "750 frames still fit the normal 420 s");
  assert.ok(chunkRunSec(1000) > RENDER.runSec.chunk && chunkRunSec(1000) < 840);
  assert.equal(chunkRunSec(5000), RENDER.runSecChunkMax);
  assert.ok(chunkRunSec(maxFramesPerChunk()) >= 45 + maxFramesPerChunk() * 0.45 - 1, "even at 0.45 s a frame (4x the mean) the biggest chunk fits");
  const run = { id: "r", status: "render", created_at: iso(T0), render: { chunks: [{ index: 0, from: 0, to: 1000 }] } };
  const prep = { id: "p", role: "prepare", idx: 0, attempt: 1, state: "done", dispatched_at: iso(T0) };
  const big = { id: "c", role: "chunk", idx: 0, attempt: 1, state: "running", from_frame: 0, to_frame: 1000, started_at: iso(T0), dispatched_at: iso(T0), provider_job_id: "rp" };
  assert.deepEqual(reconcile(run, [prep, big], T0 + 450000).jobs, [], "450 s is inside a 1000-frame chunk's limit");
  assert.equal(reconcile(run, [prep, big], T0 + (chunkRunSec(1000) + 1) * 1000).jobs[0].patch.error_code, "JOB_TIMEOUT");
});

test("reconcile: the hard limit counts from the first prepare try; a run that never got a worker in 30 min fails as busy", () => {
  const run = { id: "r", status: "queued", created_at: iso(T0), render: null };
  assert.equal(reconcile(run, [], T0 + (RENDER.maxWaitMin * 60 + 1) * 1000).actions[0].code, "QUEUE_TIMEOUT");
  assert.equal(reconcile(run, [], T0 + 10 * 60000).actions[0].type, "dispatch", "10 min in line: still waits");
  const late = { id: "p", role: "prepare", idx: 0, attempt: 1, state: "running", dispatched_at: iso(T0 + 20 * 60000), started_at: iso(T0 + 20 * 60000), heartbeat_at: iso(T0 + 26 * 60000) };
  assert.notEqual(reconcile(run, [late], T0 + 26 * 60000).actions[0]?.code, "TIMEOUT", "waited 20 min, ran 6: not over the 25 min");
});

// ---------------------------------------------------------------- admission
test("admission: free workers go to the oldest run first; a full endpoint sends nothing; one piece of slack", () => {
  const cfg = { ...RENDER, workers: 6, queueSlack: 0 };
  const mkRun = (id, min, f = {}) => ({ id, status: "queued", created_at: iso(T0 + min * 60000), render: null, ...f });
  const J = (run, role, idx, state) => ({ id: `${run}${role}${idx}`, run_id: run, role, idx, attempt: 1, state, dispatched_at: iso(T0), started_at: iso(T0) });
  // A rendering (3 chunks wanted, its prepare still mixing), B and C new
  const A = mkRun("A", 0, { status: "render", planned_at: iso(T0), render: { chunks: [0, 1, 2].map((i) => ({ index: i, from: i * 10, to: i * 10 + 10 })) } });
  const B = mkRun("B", 1), C = mkRun("C", 2);
  const jobs = new Map([["A", [J("A", "prepare", 0, "running")]], ["B", []], ["C", []]]);
  let room = admission([C, B, A], jobs, T0 + 1000, cfg);
  assert.deepEqual([room.get("A"), room.get("B"), room.get("C")], [3, 1, 1]);
  jobs.set("X", [J("X", "prepare", 0, "done"), J("X", "chunk", 0, "running"), J("X", "chunk", 1, "running"), J("X", "chunk", 2, "sent")]);
  const X = { id: "X", status: "render", created_at: iso(T0 - 60000), render: { chunks: [] } };
  room = admission([A, B, C, X], jobs, T0 + 1000, cfg);
  assert.deepEqual([room.get("A"), room.get("B"), room.get("C")], [2, 0, 0], "2 workers left: both to the oldest run's chunks");
  room = admission([A, B, C, X], jobs, T0 + 1000, { ...cfg, queueSlack: 1 });
  assert.equal(room.get("A") + room.get("B") + room.get("C"), 3, "slack 1: one piece more than the free workers");
  assert.equal(activeRenderRuns([A, B, C], jobs), 3);
});

// ---------------------------------------------------------------- the runtime holds pieces while every worker is busy
function harness(cfg) {
  let now = T0;
  const db = memoryDb({ now: () => now }), root = fs.mkdtempSync(path.join(os.tmpdir(), "bw-queue-test-"));
  const storage = fileStorage(root), runpod = scriptedRunPod();
  const rt = makeRuntime({ db, storage, runpod, secret: "s3cret", callbackUrl: "https://example.test/functions/v1/blocky-worlds-render", now: () => now, log: () => {}, cfg });
  const hook = (s, status, output) => rt.handleCallback({ query: runpod.query(s), body: { id: s.id, status, output, executionTime: 30000, delayTime: 2000 } });
  return { db, storage, runpod, rt, hook, tick: (s) => { now += s * 1000; }, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("runtime: with every worker busy a new run waits in our line (no RunPod job) and starts when a piece ends", async () => {
  const h = harness({ ...RENDER, workers: 2, queueSlack: 0 });
  const runs = [];
  for (let i = 0; i < 3; i++) { runs.push(h.db.addRun({ title: `R${i}` })); h.tick(1); await h.rt.start(runs[i].id); }
  assert.equal(h.runpod.sent.length, 2, "two workers: two prepare jobs, the third run waits");
  assert.deepEqual(h.runpod.sent.map((s) => s.job.runId), [runs[0].id, runs[1].id]);
  assert.equal((await h.db.jobs(runs[2].id)).length, 0, "no job row, so no QUEUE_TIMEOUT can hit it");
  // the oldest run's prepare fails for a moment (a crash): its retry comes first, the third run still waits
  await h.hook(h.runpod.sent[0], "FAILED", { ok: false, code: "CRASH" });
  assert.equal(h.runpod.sent.length, 3);
  assert.equal(h.runpod.sent[2].job.runId, runs[0].id, "oldest run first: run 1's retry takes the free worker");
  // run 2's prepare ends: the free worker goes to run 3
  h.storage.write(`test/${runs[1].user_id}/${runs[1].id}/mix.m4a`, "m");
  await h.hook(h.runpod.sent[1], "COMPLETED", { ok: true, role: "prepare" });
  assert.equal(h.runpod.sent.at(-1).job.runId, runs[2].id, "pump: run 3's prepare is sent when a piece ends");
  // the sweeper keeps the line moving too (a lost webhook): nothing is sent twice
  const before = h.runpod.sent.length;
  await h.rt.sweep();
  assert.equal(h.runpod.sent.length, before);
  h.cleanup();
});

test("runtime: the split records the queue choice; alone a 90 s plan gets 6 chunks, with 2 others in flight 3", async () => {
  // slack 6: nothing waits in line here (this test is about the K choice)
  const h = harness({ ...RENDER, queueSlack: 6 });
  const plan = async (r) => {
    await h.rt.start(r.id);
    const s = h.runpod.sent.filter((x) => x.job.runId === r.id && x.job.role === "prepare").at(-1);
    const dir = `test/${r.user_id}/${r.id}`;
    h.storage.write(`${dir}/visual-check.json`, JSON.stringify({ passed: true, timeline: [], missing: [], subjects: [] }));
    h.storage.write(`${dir}/timeline.json`, JSON.stringify(timeline(90)));
    await h.rt.handleCallback({ body: { runId: r.id, jobId: s.job.jobId, token: s.job.callback.token, event: "planned", frames: 2160 } });
    return h.db.getRun(r.id);
  };
  const a = await plan(h.db.addRun({ title: "alone" }));
  assert.equal(a.render.chunks.length, 6);
  assert.equal(a.render.queue.k, 6);
  assert.match(a.render.queue.reason, /alone/);
  h.db.addRun({ title: "b" }); h.tick(1);
  const c = await plan(h.db.addRun({ title: "c" }));
  assert.equal(c.render.chunks.length, 3, `3 videos in flight: ${c.render.queue.reason}`);
  assert.equal(c.render.queue.activeRuns, 3);
  assert.deepEqual(chunkProblems(c.render.chunks, 2160), []);
  h.cleanup();
});

// ---------------------------------------------------------------- rolling averages
test("measureDurations: prepare, chunk overhead + seconds a frame (slow chunks weigh in), finish, cold start", () => {
  const at = (s) => iso(T0 + s * 1000);
  const rows = [
    { run_id: "a", role: "prepare", idx: 0, attempt: 1, state: "done", dispatched_at: at(0), started_at: at(11), finished_at: at(128), output: { totalS: 117, timing: { music: 8.6, mix: 12.2 } } },
    { run_id: "a", role: "prepare", idx: 0, attempt: 2, state: "done", dispatched_at: at(0), started_at: at(1), finished_at: at(25), output: { resumed: true, totalS: 24 } },
    ...[0, 1, 2].map((i) => ({ run_id: "a", role: "chunk", idx: i, attempt: 1, state: "done", from_frame: i * 250, to_frame: i * 250 + 250, dispatched_at: at(100), started_at: at(129 + i), finished_at: at(180), output: { frames: 250, loadS: 14, timing: { gpuCheck: 1.2, render: i === 2 ? 164 : 39, web: 1, upload: 2 } } })),
    { run_id: "a", role: "finish", idx: 0, attempt: 1, state: "done", dispatched_at: at(300), finished_at: at(312), output: { timing: { download: 1.3, join: 1.7, upload: 6 } } },
    { run_id: "a", role: "chunk", idx: 3, attempt: 1, state: "failed", output: null },
  ];
  const d = measureDurations(rows);
  assert.equal(d.prepareS, 117, "the resumed (mix-only) retry is not a prepare sample");
  assert.equal(d.planTailS, 26);
  assert.equal(d.chunkSPerFrame, +((25 + 25 + 150) / 750).toFixed(4));
  assert.equal(d.chunkOverheadS, 20);
  assert.equal(d.finishS, 11);
  assert.equal(d.coldS, 20, "median of the first prepare try's wait (11) and the run's quickest chunk start (29)");
  assert.deepEqual(measureDurations([]), { ...DURATIONS, samples: { prepare: 0, chunk: 0, finish: 0, cold: 0 } });
});

// ---------------------------------------------------------------- the simulator
test("simulate: 1, 3 and 5 customers at once finish sooner with the shared line, and nothing waits out RunPod's queue", () => {
  const dur = { ...DURATIONS };
  for (const n of [1, 3, 5]) {
    const now = waitTable({ customers: n, frames: F90, dur, mode: "fixed" }), neu = waitTable({ customers: n, frames: F90, dur, mode: "queue" });
    assert.equal(now.failed + neu.failed, 0);
    assert.ok(neu.last <= now.last, `${n}: last ${neu.last} vs ${now.last}`);
    assert.ok(neu.median <= now.median, `${n}: median ${neu.median} vs ${now.median}`);
    assert.equal(neu.queueTimeouts, 0, `${n}: the line keeps RunPod's queue short`);
  }
  assert.ok(waitTable({ customers: 5, frames: F90, dur, mode: "fixed" }).queueTimeouts > 0, "the old way: 45 chunks at once wait out the 4 min");
  assert.deepEqual(waitTable({ customers: 1, frames: F90, dur, mode: "queue" }).chunks, [6]);
  assert.deepEqual(waitTable({ customers: 1, frames: F90, dur, mode: "fixed" }).chunks, [fixedChunkCount(F90)]);
  // oldest first: the customers finish in the order they pressed Generate
  const order = waitTable({ customers: 4, frames: F90, dur, mode: "queue", spreadS: 5 }).runs.map((r) => r.doneS);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // one customer alone: about 4 minutes (the paid runs of 2026-11-05/06 took 5:17-5:38 with 4 workers and 9 chunks)
  const one = waitTable({ customers: 1, frames: F90, dur, mode: "queue" });
  assert.ok(one.first > 180 && one.first < 300, `${one.first} s`);
  const sim = simulate({ runs: [{ id: "x", frames: F90 }], dur });
  assert.equal(sim.runs[0].startS, dur.coldS, "a cold worker's start-up before the prepare job runs");
});

// ---------------------------------------------------------------- the live place in line + ETA
function busyEndpoint(nowMs) {
  // 2 older runs fill all 6 workers (A: 3 chunks + its prepare mixing; B: its prepare + 1 chunk sent); C and D wait
  const at = (s) => iso(nowMs + s * 1000);
  const ch = (n, len = 750) => Array.from({ length: n }, (_, i) => ({ index: i, from: i * len, to: (i + 1) * len }));
  const runs = [
    { id: "A", status: "render", created_at: at(-200), planned_at: at(-20), length_sec: 90, render: { frames: 2250, chunks: ch(3) } },
    { id: "B", status: "render", created_at: at(-150), planned_at: at(-5), length_sec: 90, render: { frames: 2250, chunks: ch(3) } },
    { id: "C", status: "queued", created_at: at(-60), planned_at: null, length_sec: 90, render: null },
    { id: "D", status: "queued", created_at: at(-30), planned_at: null, length_sec: 90, render: null },
  ];
  const J = (run, role, idx, state, f = {}) => ({ id: `${run}${role}${idx}`, run_id: run, role, idx, attempt: 1, state, dispatched_at: at(-20), started_at: state === "running" ? at(-15) : null, ...f });
  const jobsByRun = new Map([
    ["A", [J("A", "prepare", 0, "running", { started_at: at(-190) }), J("A", "chunk", 0, "running"), J("A", "chunk", 1, "running"), J("A", "chunk", 2, "running")]],
    ["B", [J("B", "prepare", 0, "running", { started_at: at(-100) }), J("B", "chunk", 0, "sent")]],
    ["C", []], ["D", []],
  ]);
  return { runs, jobsByRun };
}

test("queue status: each waiting run gets its place (oldest first) and a start ETA; a started run only its ready ETA", () => {
  const now = T0, { runs, jobsByRun } = busyEndpoint(now);
  const all = queueStatuses(["A", "B", "C", "D"], runs, jobsByRun, now);
  assert.equal(all.A.queuePosition, null); assert.equal(all.A.etaSec, null);
  assert.ok(all.A.doneEtaSec > 0);
  assert.equal(all.C.queuePosition, 1); assert.equal(all.D.queuePosition, 2);
  assert.ok(all.C.etaSec > 0 && all.D.etaSec >= all.C.etaSec, `C ${all.C.etaSec} s, D ${all.D.etaSec} s`);
  assert.ok(all.D.doneEtaSec >= all.C.doneEtaSec && all.C.doneEtaSec > all.B.doneEtaSec && all.B.doneEtaSec > all.A.doneEtaSec);
  assert.deepEqual(queueStatus("C", runs, jobsByRun, now), all.C);
  assert.deepEqual(queueStatus("zzz", runs, jobsByRun, now), { queuePosition: null, etaSec: null, doneEtaSec: null });
  // an empty endpoint: a new run is #1 and starts within a cold start
  const solo = queueStatus("C", [runs[2]], new Map([["C", []]]), now);
  assert.equal(solo.queuePosition, 1);
  assert.ok(solo.etaSec <= DURATIONS.coldS + 1, `${solo.etaSec} s`);
  const f = forecast(runs, jobsByRun, now);
  assert.ok(f.get("B").doneS > f.get("A").doneS);
});

// ---------------------------------------------------------------- the page's words
test("page: 'You're #2 in line — starts in about 3 minutes', counting down; a passed ETA says almost there; then the progress", () => {
  const now = T0;
  const q = { status: "queued", queuePosition: 2, etaSec: 180, doneEtaSec: 420 };
  let w = waitInfo(q, now, now);
  assert.deepEqual([w.inLine, w.position, w.title, w.sub], [true, 2, "You're #2 in line", "Starts in about 3 minutes"]);
  w = waitInfo(q, now + 100000, now);
  assert.equal(w.sub, "Starts in about 1 minute", "counts down between polls");
  w = waitInfo(q, now + 175000, now);
  assert.deepEqual([w.title, w.sub], ["You're #2 in line", "Starting in a moment"]);
  w = waitInfo(q, now + 400000, now);
  assert.deepEqual([w.inLine, w.title, w.sub], [true, "Almost there", "Your video starts any moment now"], "never 0 or negative minutes");
  assert.equal(waitInfo({ ...q, queuePosition: 1, etaSec: 20 }, now, now).inLine, false, "#1 and starting within ~40 s: the normal progress");
  w = waitInfo({ status: "render", queuePosition: null, etaSec: null, doneEtaSec: 150 }, now, now);
  assert.deepEqual([w.inLine, w.done], [false, "Ready in about 3 minutes"]);
  assert.equal(waitInfo({ status: "render", doneEtaSec: 150 }, now + 200000, now).done, "Almost there");
  assert.deepEqual(waitInfo({ status: "plan" }, now, now), { inLine: false, position: null, title: null, sub: null, done: null }, "no forecast: the old text");
  assert.equal(waitInfo({ status: "done", queuePosition: 2, etaSec: 100 }).inLine, false);
  assert.deepEqual([aboutTime(30), aboutTime(61), aboutTime(150)], ["less than a minute", "about 1 minute", "about 3 minutes"]);
});

test("page: ResultPanel shows the line from waitInfo, the dev mock has ?queue=N, the API exposes the fields", () => {
  const panel = fs.readFileSync(new URL("../src/components/viral-tools/blocky-worlds/ResultPanel.jsx", import.meta.url), "utf8");
  assert.match(panel, /waitInfo\(run, Date\.now\(\), seenAt\)/);
  assert.match(panel, /wait\.inLine \?/);
  assert.doesNotMatch(panel, /All our video machines are busy[^<]*credits/i);
  const mock = fs.readFileSync(new URL("../src/components/viral-tools/blocky-worlds/dev/devApi.js", import.meta.url), "utf8");
  assert.match(mock, /Q\.get\("queue"\)/);
  assert.match(mock, /queuePosition: pos/);
  const api = fs.readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  for (const k of ["queuePosition", "etaSec", "doneEtaSec", "etaAt", "queueInfo(admin"]) assert.ok(api.includes(k), k);
});
