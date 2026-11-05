// Blocky Worlds production pipeline (docs/blocky-worlds-pipeline.md): the chunk split, the job events, the state machine,
// and the runtime end to end with fake RunPod + fake storage + memory tables. No network, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chunkPlan, chunkProblems, costSummary, estimate, NO_RETRY, onJobEvent, paths, reconcile, RENDER, retryOf, ROLES, sameToken, tokenFor } from "../supabase/functions/_shared/blockyWorlds/render.js";
import { makeRuntime } from "../supabase/functions/_shared/blockyWorlds/renderRuntime.js";
import { STATUSES } from "../supabase/functions/_shared/blockyWorlds/contract.js";
import { fileStorage, memoryDb, scriptedRunPod } from "../scripts/blockyWorlds/engine/dev/pipelineFakes.mjs";
import { checkFailure, preRenderChecks, prepare } from "../scripts/blockyWorlds/engine/runpod/worker.mjs";

const T0 = Date.parse("2026-11-05T10:00:00Z");
const SECRET = "test-secret-123";

/** a timeline of `sec` seconds: shots of ~2.5 s alternating street/bedroom */
function timeline(sec = 90, { set = null } = {}) {
  const shots = [];
  for (let t = 0, i = 0; t < sec; i++) { const end = Math.min(sec, +(t + 2.3 + (i % 3) * 0.4).toFixed(2)); shots.push({ start: t, end, set: set ?? (i % 4 < 2 ? "street" : "bedroom"), light: "day", camera: i ? "medium" : "wide" }); t = end; }
  return { version: 1, fps: 24, width: 1080, height: 1920, duration: sec, shots };
}

// ---------------------------------------------------------------- the chunk split
test("chunks: a 90 s video is 8 chunks of ~270 frames, contiguous, covering every frame, cut at shot boundaries", () => {
  const tl = timeline(90), N = 90 * 24, plan = chunkPlan(tl);
  assert.equal(plan.length, 8);
  assert.deepEqual(chunkProblems(plan, N), []);
  const cuts = tl.shots.map((s) => Math.round(s.start * 24)), win = (N / 8) * RENDER.snapShare;
  for (const c of plan.slice(1)) {
    const ideal = Math.round((N * c.index) / 8);
    if (cuts.some((x) => Math.abs(x - ideal) <= win)) assert.ok(cuts.includes(c.from), `chunk ${c.index} starts on the nearby shot cut (${c.from})`);
    else assert.equal(c.from, ideal);
  }
  for (const c of plan) assert.ok(Math.abs(c.to - c.from - N / 8) <= N / 8 * 0.13, `chunk ${c.index} is ${c.to - c.from} frames`);
  assert.equal(chunkPlan(timeline(60)).length, 6);
  assert.equal(chunkPlan(timeline(120)).length, 11);
});

test("chunks: the expected size raises the count until every chunk fits the upload limit", () => {
  const tl = timeline(90, { set: "street" });
  const small = { ...RENDER, chunkBytesTarget: 12e6 };
  const plan = chunkPlan(tl, { cfg: small });
  assert.ok(plan.length > 8, `${plan.length} chunks`);
  assert.ok(plan.every((c) => c.estBytes <= 12e6) || plan.length === RENDER.maxChunks);
  assert.deepEqual(chunkProblems(plan, 2160), []);
  // never more than maxChunks
  assert.ok(chunkPlan(tl, { cfg: { ...RENDER, chunkBytesTarget: 1 } }).length <= RENDER.maxChunks);
});

test("chunks: the dry run's short render (limitFrames, a forced count)", () => {
  const plan = chunkPlan(timeline(90), { limitFrames: 48, k: 2 });
  assert.deepEqual(plan.map((c) => [c.from, c.to]).flat().filter((_, i) => i === 0 || i === 3), [0, 48]);
  assert.deepEqual(chunkProblems(plan, 48), []);
  assert.match(chunkProblems([{ index: 0, from: 0, to: 10 }, { index: 1, from: 12, to: 20 }], 20).join(), /gap or overlap/);
});

// ---------------------------------------------------------------- token, events
test("token: HMAC per run, constant-time compare", async () => {
  const a = await tokenFor(SECRET, "run-1"), b = await tokenFor(SECRET, "run-2");
  assert.equal(a.length, 64); assert.notEqual(a, b);
  assert.ok(sameToken(a, await tokenFor(SECRET, "run-1")));
  assert.ok(!sameToken(a, b)); assert.ok(!sameToken("", "")); assert.ok(!sameToken(a, a.slice(1)));
});

test("events: a finished job ignores later events (duplicates, late webhooks); its GPU cost still counts once by ref", () => {
  const job = { id: "j1", role: "chunk", idx: 2, attempt: 1, state: "running" };
  const done = onJobEvent(job, { event: "done", output: { ok: true } }, T0);
  assert.equal(done.job.state, "done");
  const again = onJobEvent({ ...job, state: "done" }, { event: "done" }, T0);
  assert.equal(again.job, null);
  const hook = onJobEvent({ ...job, state: "done" }, { event: "runpod", status: "COMPLETED", output: { ok: true }, executionTime: 70000, delayTime: 60000, providerJobId: "rp-9" }, T0);
  assert.equal(hook.job, null);
  assert.equal(hook.ledger.length, 1);
  assert.equal(hook.ledger[0].ref, "gpu:rp-9");
  assert.equal(hook.ledger[0].units.billedS, 70 + RENDER.coldStartBillSec, "start-up counted up to its cap, not the queue time");
});

test("events: NO_GPU (COMPLETED + ok:false) and a raised error (FAILED + JSON text) become failed tries with their codes", () => {
  const job = { id: "j", role: "chunk", idx: 0, attempt: 1, state: "sent" };
  assert.equal(onJobEvent(job, { event: "runpod", status: "COMPLETED", output: { ok: false, code: "NO_GPU", refresh_worker: true } }, T0).job.error_code, "NO_GPU");
  const f = onJobEvent(job, { event: "runpod", status: "FAILED", error: JSON.stringify({ code: "RENDER_FAILED", error: "page crashed" }) }, T0).job;
  assert.deepEqual([f.state, f.error_code, f.error_message], ["failed", "RENDER_FAILED", "page crashed"]);
  assert.equal(onJobEvent(job, { event: "runpod", status: "TIMED_OUT" }, T0).job.error_code, "JOB_TIMEOUT");
  const prog = onJobEvent(job, { event: "runpod", status: "IN_PROGRESS", delayTime: 4000, executionTime: 9000, providerJobId: "rp-1" }, T0);
  assert.equal(prog.job.state, "running");
  assert.deepEqual(prog.ledger, [], "a running job's numbers are not its cost yet (its ref would block the final row)");
  const v = onJobEvent({ ...job, role: "prepare" }, { event: "voiced", costUsd: 0.1914, billedChars: 957 }, T0);
  assert.deepEqual(v.run, { voice_ready: true });
  assert.equal(v.ledger[0].ref, "voice:j");
});

// ---------------------------------------------------------------- the state machine
const run = (f = {}) => ({ id: "r", status: "queued", pct: 0, created_at: new Date(T0).toISOString(), render: null, ...f });
const J = (role, idx, attempt, state, f = {}) => ({ id: `${role}${idx}a${attempt}`, role, idx, attempt, state, dispatched_at: new Date(T0).toISOString(), started_at: new Date(T0).toISOString(), ...f });
const chunks = (n) => Array.from({ length: n }, (_, i) => ({ index: i, from: i * 10, to: i * 10 + 10 }));

test("reconcile: a new run sends its prepare job; nothing else", () => {
  const r = reconcile(run(), [], T0);
  assert.deepEqual(r.actions, [{ type: "dispatch", role: "prepare", idx: 0, attempt: 1 }]);
});

test("reconcile: a check miss fails the run at once (no retry, no chunk ever sent)", () => {
  for (const code of ["VISUAL_CHECK", "SUBJECT_CHECK", "PLAN_FAILED"]) {
    assert.ok(NO_RETRY.has(code));
    const r = reconcile(run({ status: "plan" }), [J("prepare", 0, 1, "failed", { error_code: code, error_message: "x" })], T0 + 5000);
    assert.deepEqual(r.actions.map((a) => [a.type, a.code]), [["fail", code]]);
  }
});

test("reconcile: once planned, every chunk is sent; status render; the finish only after all chunks AND the mix", () => {
  const rr = run({ status: "plan", render: { chunks: chunks(3) } });
  const prepRunning = J("prepare", 0, 1, "running", { stage: "mix" });
  let r = reconcile(rr, [prepRunning], T0 + 1000);
  assert.deepEqual(r.actions.map((a) => `${a.role}${a.idx}`), ["chunk0", "chunk1", "chunk2"]);
  assert.equal(r.run.status, "render");
  const allDone = [0, 1, 2].map((i) => J("chunk", i, 1, "done"));
  r = reconcile({ ...rr, status: "render" }, [prepRunning, ...allDone], T0 + 2000);
  assert.deepEqual(r.actions, [], "the mix isn't up yet: no finish");
  r = reconcile({ ...rr, status: "render" }, [{ ...prepRunning, state: "done" }, ...allDone], T0 + 2000);
  assert.deepEqual(r.actions, [{ type: "dispatch", role: "finish", idx: 0, attempt: 1 }]);
  r = reconcile({ ...rr, status: "render" }, [{ ...prepRunning, state: "done" }, ...allDone, J("finish", 0, 1, "done", { output: { durationSec: 90 } })], T0 + 3000);
  assert.deepEqual(r.actions, [{ type: "done", output: { durationSec: 90 } }]);
});

test("reconcile: NO_GPU waits for that worker to go, then retries; up to 3 such retries on top of the normal tries", () => {
  const rr = run({ status: "render", render: { chunks: chunks(1) } }), prep = J("prepare", 0, 1, "done");
  const failedAt = new Date(T0 + 10000).toISOString();
  const nogpu = (a) => J("chunk", 0, a, "failed", { error_code: "NO_GPU", finished_at: failedAt });
  assert.deepEqual(reconcile(rr, [prep, nogpu(1)], T0 + 15000).actions, [], "waits 20 s");
  assert.deepEqual(reconcile(rr, [prep, nogpu(1)], T0 + 31000).actions, [{ type: "dispatch", role: "chunk", idx: 0, attempt: 2, from: 0, to: 10 }]);
  const four = [1, 2, 3, 4].map(nogpu);
  assert.equal(reconcile(rr, [prep, ...four], T0 + 60000).actions[0].type, "fail");
  assert.equal(retryOf([nogpu(1), nogpu(2), nogpu(3)], "chunk", T0 + 60000).do, "dispatch");
});

test("reconcile: a chunk that keeps failing gets 3 retries, then the run fails (CHUNK_FAILED)", () => {
  const rr = run({ status: "render", render: { chunks: chunks(2) } }), prep = J("prepare", 0, 1, "done");
  const bad = (a) => J("chunk", 1, a, "failed", { error_code: "RENDER_FAILED", error_message: "boom" });
  assert.equal(reconcile(rr, [prep, J("chunk", 0, 1, "running"), bad(1), bad(2), bad(3)], T0 + 1000).actions[0].attempt, 4);
  const r = reconcile(rr, [prep, J("chunk", 0, 1, "running"), bad(1), bad(2), bad(3), bad(4)], T0 + 1000);
  assert.deepEqual(r.actions.map((a) => [a.type, a.code]), [["fail", "CHUNK_FAILED"]]);
});

test("reconcile: a job stuck in the queue or running too long is cancelled and retried; the run has a hard limit", () => {
  const rr = run({ status: "render", render: { chunks: chunks(1) } }), prep = J("prepare", 0, 1, "done");
  const queued = J("chunk", 0, 1, "sent", { provider_job_id: "rp-1", started_at: null });
  const r = reconcile(rr, [prep, queued], T0 + (RENDER.queueSec + 1) * 1000);
  assert.equal(r.jobs[0].patch.error_code, "QUEUE_TIMEOUT");
  assert.deepEqual(r.actions.map((a) => a.type), ["cancel", "dispatch"]);
  const long = J("chunk", 0, 1, "running", { provider_job_id: "rp-1" });
  assert.equal(reconcile(rr, [prep, long], T0 + (RENDER.runSec.chunk + 1) * 1000).jobs[0].patch.error_code, "JOB_TIMEOUT");
  assert.equal(reconcile(rr, [prep], T0 + (RENDER.hardMin * 60 + 1) * 1000).actions[0].code, "TIMEOUT");
});

test("reconcile: the page's status only moves forward through the contract's statuses", () => {
  const seen = [];
  let rr = run();
  for (const [jobs, at] of [[[J("prepare", 0, 1, "running", { stage: "voice" })], 1], [[J("prepare", 0, 1, "running", { stage: "plan" })], 2]]) {
    const r = reconcile(rr, jobs, T0 + at * 1000);
    rr = { ...rr, ...r.run }; seen.push(rr.status);
  }
  rr = { ...rr, render: { chunks: chunks(2) } };
  rr = { ...rr, ...reconcile(rr, [J("prepare", 0, 1, "running", { stage: "voice" })], T0 + 3000).run };
  seen.push(rr.status);
  assert.deepEqual(seen, ["voice", "plan", "render"]);
  for (const s of seen) assert.ok(STATUSES.includes(s));
  assert.ok(rr.pct >= 15 && rr.pct < 100);
});

test("reconcile: a failed run cancels whatever is still running on RunPod", () => {
  const r = reconcile(run({ status: "failed" }), [J("chunk", 0, 1, "running", { provider_job_id: "rp-5" }), J("chunk", 1, 1, "done")], T0);
  assert.deepEqual(r.actions, [{ type: "cancel", jobId: "chunk0a1", providerJobId: "rp-5" }]);
});

test("costs and the estimate", () => {
  assert.deepEqual(costSummary([{ stage: "voice", usd: 0.19 }, { stage: "gpu_chunk", usd: 0.01 }, { stage: "gpu_chunk", usd: 0.012 }]), { byStage: { voice: 0.19, gpu_chunk: 0.022 }, totalUsd: 0.212 });
  const e = estimate(90);
  assert.equal(e.chunks, 8);
  assert.ok(e.wallS >= 100 && e.wallS <= 180, `${e.wallS} s`);
  assert.ok(e.totalUsd > 0.2 && e.totalUsd < 0.45, `$${e.totalUsd}`);
});

// ---------------------------------------------------------------- the runtime, end to end, with fakes
function harness({ configured = true, voiceReady = false } = {}) {
  let now = T0;
  const db = memoryDb({ now: () => now }), root = fs.mkdtempSync(path.join(os.tmpdir(), "bw-pipe-test-"));
  const storage = fileStorage(root), runpod = scriptedRunPod();
  runpod.configured = configured;
  const rt = makeRuntime({ db, storage, runpod, secret: SECRET, callbackUrl: "https://example.test/functions/v1/blocky-worlds-render", now: () => now, log: () => {} });
  const r = db.addRun({ lines: [{ part: "rule", text: "In this town, hi." }], voice_ready: voiceReady });
  const P = paths(r);
  const tick = (s) => { now += s * 1000; };
  /** RunPod's webhook for a sent job */
  const hook = (s, status, output, extra = {}) => rt.handleCallback({ query: runpod.query(s), body: { id: s.id, status, output, executionTime: 60000, delayTime: 8000, ...extra } });
  /** a worker event, with the job's own token */
  const ev = (s, event, data = {}) => rt.handleCallback({ body: { runId: s.job.runId, jobId: s.job.jobId, token: s.job.callback.token, event, ...data } });
  /** the prepare worker's good path: uploads + events */
  const planOk = async (s, tl = timeline(20)) => {
    storage.write(P.visualCheck, JSON.stringify({ passed: true, timeline: [], missing: [], subjects: [] }));
    storage.write(P.timeline, JSON.stringify(tl));
    await ev(s, "planned", { frames: tl.duration * 24 });
  };
  return { db, storage, runpod, rt, run: r, P, tick, hook, ev, planOk, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("runtime: Generate -> prepare -> plan -> K chunks -> finish -> done; costs in the ledger; chunk files cleaned up", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const prep = h.runpod.last("prepare");
  assert.ok(prep.job.prepare.voice.put, "a first try buys the voice (upload URLs, no download)");
  assert.ok(!JSON.stringify(prep).match(/service_role|SERVICE_ROLE|xi-api-key/), "no key in the job");
  assert.match(prep.webhook, /src=runpod&run=.*&job=.*&token=[0-9a-f]{64}$/);
  await h.ev(prep, "progress", { stage: "voice" });
  assert.equal((await h.db.getRun(h.run.id)).status, "voice");
  await h.ev(prep, "voiced", { costUsd: 0.16, billedChars: 800 });
  await h.ev(prep, "progress", { stage: "plan" });
  assert.equal((await h.db.getRun(h.run.id)).status, "plan");
  await h.planOk(prep);
  let r = await h.db.getRun(h.run.id);
  assert.equal(r.status, "render");
  assert.ok(r.voice_ready);
  const K = r.render.chunks.length;
  assert.equal(K, chunkPlan(timeline(20)).length);
  const sentChunks = h.runpod.sent.filter((s) => s.job.role === "chunk");
  assert.equal(sentChunks.length, K, "every chunk sent at once");
  assert.ok(!h.runpod.last("finish"), "no finish before the chunks");
  for (const s of sentChunks) {
    await h.ev(s, "progress", { stage: "render", pct: 40 });
    h.storage.write(h.P.seg(s.job.chunk.index, 1), "seg"); h.storage.write(h.P.web(s.job.chunk.index, 1), "web");
    await h.hook(s, "COMPLETED", { ok: true, role: "chunk" });
  }
  assert.ok(!h.runpod.last("finish"), "the mix isn't up yet");
  h.storage.write(h.P.mix, "mix");
  await h.hook(prep, "COMPLETED", { ok: true, role: "prepare" });
  const fin = h.runpod.last("finish");
  assert.ok(fin, "finish sent once the chunks and the mix are up");
  assert.equal(fin.job.finish.segs.length, K);
  assert.ok(fin.job.finish.segs.every(Boolean) && fin.job.finish.mix);
  await h.ev(fin, "done", { output: { ok: true, durationSec: 20, bytes: 1234 } });
  r = await h.db.getRun(h.run.id);
  assert.equal(r.status, "done");
  assert.equal(r.pct, 100);
  assert.deepEqual(r.files, { final: h.P.final, web: h.P.webFinal, poster: h.P.poster, durationSec: 20, bytes: 1234 });
  assert.equal(r.refunded_at, null);
  // the finish's webhook arrives later: its GPU cost is added, nothing else changes
  await h.hook(fin, "COMPLETED", { ok: true });
  const sum = costSummary(h.db.ledgerRows);
  assert.equal(sum.byStage.voice, 0.16);
  assert.equal(h.db.ledgerRows.filter((l) => l.provider === "runpod").length, K + 2);
  assert.ok(!h.storage.exists(h.P.seg(0, 1)), "chunk files removed after done");
  h.cleanup();
});

test("runtime: a duplicate callback / webhook is ignored (one finish, one ledger row each)", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const prep = h.runpod.last("prepare");
  await h.planOk(prep);
  await h.planOk(prep); // "planned" twice
  const firstSplit = (await h.db.getRun(h.run.id)).render;
  assert.equal(h.runpod.sent.filter((s) => s.job.role === "chunk").length, firstSplit.chunks.length, "chunks sent once");
  h.storage.write(h.P.mix, "m");
  await h.hook(prep, "COMPLETED", { ok: true });
  for (const s of h.runpod.sent.filter((x) => x.job.role === "chunk")) {
    await h.hook(s, "COMPLETED", { ok: true });
    const again = await h.hook(s, "COMPLETED", { ok: true });
    assert.equal(again.body.ignored, "the job had already ended");
    await h.ev(s, "done", { output: { ok: true } });
  }
  assert.equal(h.runpod.sent.filter((s) => s.job.role === "finish").length, 1, "one finish");
  const refs = h.db.ledgerRows.map((l) => l.ref);
  assert.equal(new Set(refs).size, refs.length, "no ledger row twice");
  h.cleanup();
});

test("runtime: callbacks without the run's token are refused", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const prep = h.runpod.last("prepare");
  const bad = await h.rt.handleCallback({ body: { runId: prep.job.runId, jobId: prep.job.jobId, token: "0".repeat(64), event: "done" } });
  assert.equal(bad.status, 403);
  const other = await tokenFor(SECRET, "11111111-1111-1111-1111-111111111111");
  assert.equal((await h.rt.handleCallback({ query: { ...h.runpod.query(prep), token: other }, body: { id: prep.id, status: "COMPLETED", output: { ok: true } } })).status, 403);
  assert.equal((await h.db.getJob(prep.job.jobId)).state, "sent");
  h.cleanup();
});

test("runtime drill: a visual-check miss fails and refunds BEFORE any render", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const prep = h.runpod.last("prepare");
  await h.ev(prep, "voiced", { costUsd: 0.16 });
  await h.ev(prep, "failed", { code: "VISUAL_CHECK", message: "#3 piano" });
  const r = await h.db.getRun(h.run.id);
  assert.deepEqual([r.status, r.error_code, Boolean(r.refunded_at)], ["failed", "VISUAL_CHECK", true]);
  assert.equal(h.runpod.sent.length, 1, "only the prepare job was ever sent");
  await h.hook(prep, "COMPLETED", { ok: false, code: "VISUAL_CHECK" });
  await h.rt.sweep();
  assert.deepEqual(h.db.refunds, [h.run.id], "refunded once");
  assert.equal(h.db.alerts[0].key, "blocky-worlds-VISUAL_CHECK");
  h.cleanup();
});

test("runtime drill: the server re-checks the report; a 'planned' with misses in visual-check.json fails, nothing renders", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const prep = h.runpod.last("prepare");
  h.storage.write(h.P.visualCheck, JSON.stringify({ passed: false, timeline: [], missing: [], subjects: [{ shot: 4, problem: "me off screen" }] }));
  h.storage.write(h.P.timeline, JSON.stringify(timeline(20)));
  await h.ev(prep, "planned", {});
  const r = await h.db.getRun(h.run.id);
  assert.deepEqual([r.status, r.error_code, Boolean(r.refunded_at), r.render], ["failed", "SUBJECT_CHECK", true, null]);
  assert.equal(h.runpod.sent.filter((s) => s.job.role === "chunk").length, 0);
  h.cleanup();
});

test("runtime drill: NO_GPU on a chunk -> that piece again on another worker after 20 s (the sweeper sends it)", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  await h.planOk(h.runpod.last("prepare"));
  const c0 = h.runpod.last("chunk", 0);
  await h.hook(c0, "COMPLETED", { ok: false, code: "NO_GPU", refresh_worker: true });
  assert.equal(h.runpod.sent.filter((s) => s.job.role === "chunk" && s.job.chunk.index === 0).length, 1, "not at once");
  h.tick(RENDER.noGpuDelaySec + 1);
  await h.rt.sweep();
  const again = h.runpod.last("chunk", 0);
  assert.notEqual(again.id, c0.id);
  assert.equal(again.job.attempt, 2);
  assert.notEqual(again.job.chunk.out.seg, c0.job.chunk.out.seg, "each try uploads to its own file");
  assert.equal((await h.db.getRun(h.run.id)).status, "render");
  h.cleanup();
});

test("runtime drill: a chunk that keeps failing fails the run, cancels the rest, refunds once", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  await h.planOk(h.runpod.last("prepare"));
  for (let a = 1; a <= RENDER.attempts.chunk; a++) {
    const s = h.runpod.last("chunk", 1);
    assert.equal(s.job.attempt, a);
    await h.hook(s, "FAILED", null, { error: JSON.stringify({ code: "RENDER_FAILED", error: "the page crashed" }) });
  }
  const r = await h.db.getRun(h.run.id);
  assert.deepEqual([r.status, r.error_code, r.credits_refunded], ["failed", "CHUNK_FAILED", 62]);
  const live = h.runpod.sent.filter((s) => s.job.role !== "chunk" || s.job.chunk.index !== 1);
  for (const s of live) assert.ok(h.runpod.cancelled.includes(s.id), `${s.job.role} ${s.job.chunk?.index ?? ""} cancelled`);
  // late events change nothing
  await h.hook(h.runpod.last("chunk", 0), "COMPLETED", { ok: true });
  assert.equal((await h.db.getRun(h.run.id)).status, "failed");
  assert.deepEqual(h.db.refunds, [h.run.id]);
  h.cleanup();
});

test("runtime: RunPod not configured -> failed and refunded at start (NOT_CONFIGURED), never stuck", async () => {
  const h = harness({ configured: false });
  await h.rt.start(h.run.id);
  const r = await h.db.getRun(h.run.id);
  assert.deepEqual([r.status, r.error_code, Boolean(r.refunded_at)], ["failed", "NOT_CONFIGURED", true]);
  h.cleanup();
});

test("runtime: a retried prepare job gets the paid take back and never buys it again", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  const p1 = h.runpod.last("prepare");
  h.storage.write(h.P.voiceMp3, "mp3"); h.storage.write(h.P.take, "{}");
  await h.ev(p1, "voiced", { costUsd: 0.16 });
  await h.hook(p1, "FAILED", null, { error: JSON.stringify({ code: "VOICE_FAILED", error: "ffmpeg trim" }) });
  const p2 = h.runpod.last("prepare");
  assert.equal(p2.job.attempt, 2);
  assert.ok(p2.job.prepare.voice.get?.mp3 && p2.job.prepare.voice.get?.take, "download URLs of the take");
  assert.equal(p2.job.prepare.voice.put, undefined, "no upload URLs: nothing to buy");
  h.cleanup();
});

test("runtime: the sweeper finds a job whose webhook was lost (RunPod says FAILED) and retries it", async () => {
  const h = harness();
  await h.rt.start(h.run.id);
  await h.planOk(h.runpod.last("prepare"));
  const c0 = h.runpod.last("chunk", 0);
  h.runpod.statuses.set(c0.id, { id: c0.id, status: "FAILED", error: "worker lost", executionTime: 30000 });
  h.tick(40);
  await h.rt.sweep();
  assert.equal(h.runpod.last("chunk", 0).job.attempt, 2);
  assert.ok(h.db.ledgerRows.some((l) => l.ref === `gpu:${c0.id}`), "its GPU time is in the ledger");
  h.cleanup();
});

// ---------------------------------------------------------------- the worker's prepare role (no voice call, no render)
const KIT = { OBJECTS: { car: { state: "parked", states: ["parked", "alarm"] } }, resolveObject: (n) => (n === "car" || n === "automobile" ? "car" : null) };
test("worker: the pre-render checks never skip; a planner (or kit) without one of them is a failure", () => {
  const tl = {};
  assert.throws(() => preRenderChecks({ checkTimeline: () => [], checkVisuals: () => [] }, tl, {}, KIT), (e) => e.code === "PLAN_FAILED");
  assert.throws(() => preRenderChecks({ checkTimeline: () => [], checkVisuals: () => [], checkSubjects: () => [] }, tl, {}, null), (e) => e.code === "PLAN_FAILED");
  const miss = preRenderChecks({ checkTimeline: () => [], checkVisuals: () => [{ line: 3, missing: ["piano"] }], checkSubjects: () => [] }, tl, {}, KIT);
  assert.equal(miss.passed, false);
  assert.equal(checkFailure(miss).code, "VISUAL_CHECK");
  assert.equal(checkFailure(preRenderChecks({ checkTimeline: () => [], checkVisuals: () => [], checkSubjects: () => [{ shot: 1, problem: "x" }] }, tl, {}, KIT)).code, "SUBJECT_CHECK");
  assert.equal(checkFailure(preRenderChecks({ checkTimeline: () => ["gap"], checkVisuals: () => [], checkSubjects: () => [] }, tl, {}, KIT)).code, "PLAN_FAILED");
});

test("worker: an object the engine's kit can't build stops the run before any render (KIT_MISSING, no retry)", () => {
  const ok = { checkTimeline: () => [], checkVisuals: () => [], checkSubjects: () => [] };
  const tl = { shots: [{ line: 0, objects: [{ name: "automobile", state: "alarm" }] }, { line: 1, objects: [{ name: "ladder" }, { name: "car", state: "flying" }] }] };
  const c = preRenderChecks(ok, tl, {}, KIT);
  assert.deepEqual(c.kit, ['shot 1 (#1): the kit has no object "ladder"', 'shot 1 (#1): object "car" has no state "flying"']);
  assert.equal(checkFailure(c).code, "KIT_MISSING");
  assert.ok(NO_RETRY.has("KIT_MISSING") && NO_RETRY.has("TIMELINE_INVALID"));
});

test("worker: the real kit catalog loads in node (the prepare role checks against it)", async () => {
  const { loadKit } = await import("../scripts/blockyWorlds/engine/runpod/worker.mjs");
  const kit = await loadKit();
  assert.equal(typeof kit.resolveObject, "function");
  assert.ok(Object.keys(kit.OBJECTS).length > 0);
  assert.deepEqual(preRenderChecks({ checkTimeline: () => [], checkVisuals: () => [], checkSubjects: () => [] }, { shots: [{ objects: [{ name: Object.keys(kit.OBJECTS)[0] }] }] }, {}, kit).kit, []);
});

test("worker: prepare stops on a visual miss before the timeline is uploaded; the bought take is uploaded first", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bw-prep-test-")), storage = fileStorage(root), events = [];
  const url = (p) => storage.signPut(p);
  const job = { role: "prepare", prepare: { script: { lines: [{ part: "rule", text: "In this town, a piano." }] }, voice: { put: { mp3: await url("v/voice.mp3"), take: await url("v/take.json") } }, out: { timeline: await url("timeline.json"), visualCheck: await url("visual-check.json"), mix: await url("mix.m4a") } } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-prep-dir-"));
  const voiceFn = async ({ outDir }) => { fs.writeFileSync(path.join(outDir, "voice.mp3"), "mp3"); fs.writeFileSync(path.join(outDir, "take.json"), JSON.stringify({ costUsd: 0.01, billedChars: 50, chars: 23 })); return { wav: "x.wav", words: [] }; };
  const planModule = { planVideo: () => ({ duration: 2, fps: 24, shots: [] }), checkTimeline: () => [], checkVisuals: () => [{ line: 0, missing: ["piano"] }], checkSubjects: () => [] };
  await assert.rejects(prepare(job, dir, async (e, d) => events.push([e, d]), { planModule, voiceFn, kitModule: KIT }), (e) => e.code === "VISUAL_CHECK");
  assert.ok(storage.exists("v/voice.mp3") && storage.exists("v/take.json"), "the paid take is kept");
  assert.ok(storage.exists("visual-check.json"), "the report is up for the owner");
  assert.ok(!storage.exists("timeline.json"), "no timeline: nothing can render");
  assert.deepEqual(events.map((e) => e[0]), ["progress", "voiced", "progress"]);
  assert.equal(JSON.parse(await storage.readText("visual-check.json")).passed, false);
  fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true });
});

test("the migration matches the code: roles, states, the once-per-try key, the ledger ref", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261202200000_blocky_worlds_render.sql", import.meta.url), "utf8");
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, new RegExp(`role IN \\(${ROLES.map((r) => `'${r}'`).join(", ")}\\)`));
  assert.match(sql, /state IN \('sent', 'running', 'done', 'failed'\)/);
  assert.match(sql, /UNIQUE \(run_id, role, idx, attempt\)/);
  assert.match(sql, /UNIQUE \(run_id, ref\)/);
  assert.match(sql, /x-blocky-cron/);
});
