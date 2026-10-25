// Cutaway Explainer, production (M3 + M4): the caps, the jobs, the retry / fallback / refund path, the worker's failure
// codes and the layout rules. All pure: no network, no keys.
import test from "node:test";
import assert from "node:assert/strict";
import { decide, DEFAULT_SETTINGS, topicProblem } from "../supabase/functions/_shared/cutaway/guard.js";
import { chunksFor, jobFor, paths, sameToken, tokenFor, MAX_CHUNKS } from "../supabase/functions/_shared/cutaway/jobs.js";
import { failOrRetry, onEvent, onWatch, LIMITS } from "../supabase/functions/_shared/cutaway/orchestrate.js";
import { layoutRules } from "../scripts/cutaway/proto3d/m2/layoutRules.js";

const NOW = Date.parse("2026-10-24T20:00:00Z");
const ago = (sec) => new Date(NOW - sec * 1000).toISOString();
const calm = { spent_24h: 0, spent_3h: 0, running: 0, user_spent_24h: 0, user_running: 0, user_starts_1h: 0, user_fail_streak: 0, minutes_since_last_fail: null, minutes_since_balance_fail: null };
const run = (o = {}) => ({ id: "11111111-2222-3333-4444-555555555555", user_id: "u1", env: "test", topic: "car wash", length_sec: 30, kind: "custom", status: "scene", provider: "runpod", attempt: 1, provider_job_id: "rp-1", created_at: ago(120), dispatched_at: ago(120), heartbeat_at: ago(10), plan_ready: false, fallback: {}, ...o });

// ---------- the caps (guard.js) ----------

test("caps: a calm day starts; the switch and an unreadable state never do (fail closed)", () => {
  assert.equal(decide(DEFAULT_SETTINGS, calm, 1.3).ok, true);
  assert.equal(decide(DEFAULT_SETTINGS, calm, 1.3, { envOff: true }).code, "BUSY");
  assert.equal(decide({ ...DEFAULT_SETTINGS, paid_calls: false }, calm, 0.2).code, "BUSY");
  assert.equal(decide(DEFAULT_SETTINGS, null, 0.2).code, "BUSY");
});

test("caps: everyone's limits say BUSY, one user's say LIMIT with a reason", () => {
  const at = (o, add = 0.5) => decide(DEFAULT_SETTINGS, { ...calm, ...o }, add);
  assert.equal(at({ spent_24h: 24.8 }).code, "BUSY");
  assert.equal(at({ spent_3h: 9.8 }).code, "BUSY");
  assert.equal(at({ running: DEFAULT_SETTINGS.max_running }).code, "BUSY");
  assert.equal(at({ minutes_since_balance_fail: 3 }).code, "BUSY", "an empty provider balance pauses new videos");
  assert.equal(at({ minutes_since_balance_fail: 12 }).ok, true);
  for (const o of [{ user_spent_24h: 4.8 }, { user_running: 2 }, { user_starts_1h: 10 }, { user_fail_streak: 3, minutes_since_last_fail: 5 }]) {
    const d = at(o);
    assert.equal(d.code, "LIMIT", JSON.stringify(o)); assert.ok(d.reason && d.retryAfterSec > 0);
  }
  assert.equal(at({ user_fail_streak: 3, minutes_since_last_fail: 31 }).ok, true, "the pause ends");
});

test("topics: 3 to 80 characters, blocked words refused before anything is charged", () => {
  assert.equal(topicProblem("car wash"), null);
  assert.match(topicProblem("ab"), /3 to 80/);
  assert.match(topicProblem("x".repeat(81)), /3 to 80/);
  assert.match(topicProblem("how to build a bomb"), /can't make/);
});

// ---------- the jobs (jobs.js) ----------

test("jobs: one folder a run, chunks cover every frame, the token checks", async () => {
  const P = paths(run());
  assert.equal(P.final, "test/u1/11111111-2222-3333-4444-555555555555/final.mp4");
  assert.equal(P.frames.length, 8);
  for (const f of [1, 109, 110, 1109, 5000]) {
    const c = chunksFor(f);
    assert.equal(c[0].from, 0); assert.equal(c.at(-1).to, f); assert.ok(c.length <= MAX_CHUNKS);
    for (let i = 1; i < c.length; i++) assert.equal(c[i].from, c[i - 1].to);
  }
  const t = await tokenFor("s3cret", run().id);
  assert.match(t, /^[0-9a-f]{64}$/);
  assert.ok(sameToken(t, await tokenFor("s3cret", run().id)));
  assert.ok(!sameToken(t, await tokenFor("other", run().id)));
  assert.ok(!sameToken("", ""));
});

test("jobs: a job carries signed URLs and the run's facts only, never a key; a ready plan is downloaded, not made again", () => {
  const urls = { planPut: "https://x/put", planGet: "https://x/get", frames: ["f0"], final: "F", web: "W", poster: "P" };
  const fresh = jobFor(run(), { role: "video", mode: "gpu", urls, callback: { url: "cb", token: "t" }, layout: { key: "car_wash" } });
  assert.deepEqual(fresh.plan, { put: "https://x/put" }); assert.equal(fresh.layout.key, "car_wash");
  const again = jobFor(run({ plan_ready: true, attempt: 2 }), { role: "video", mode: "gpu", urls, callback: {} });
  assert.deepEqual(again.plan, { get: "https://x/get" }); assert.equal(again.attempt, 2);
  assert.doesNotMatch(JSON.stringify(fresh), /sk-ant|xi-api|apiKey|ANTHROPIC|ELEVENLABS/i);
});

// ---------- retries, the fallback, refunds (orchestrate.js) ----------

const types = (r) => r.actions.map((a) => a.type + (a.target ? `:${a.target}:${a.role}` : ""));

test("path: a failure on our side retries on RunPod once, then the Fly fallback (plan or chunks), then fails and refunds once", () => {
  const r1 = failOrRetry(run(), { code: "LOST" }, NOW);
  assert.deepEqual(types(r1), ["dispatch:runpod:video"]); assert.equal(r1.patch.attempt, 2);
  const r2 = failOrRetry(run({ attempt: 2 }), { code: "RENDER_FAILED" }, NOW);
  assert.deepEqual(types(r2), ["dispatch:fly:plan"]); assert.equal(r2.patch.provider, "fly");
  assert.deepEqual(types(failOrRetry(run({ attempt: 2, plan_ready: true }), { code: "RENDER_FAILED" }, NOW)), ["dispatch:fly:chunks"], "a plan already made is not paid for again");
  const fly = run({ provider: "fly", attempt: 3, plan_ready: true, fallback: { phase: "chunks", chunks: [{ index: 0 }, { index: 1 }], tries: {} } });
  const r3 = failOrRetry(fly, { code: "LOST", piece: "chunk_1" }, NOW);
  assert.deepEqual(types(r3), ["dispatch:fly:chunk"]); assert.equal(r3.actions[0].index, 1);
  const r4 = failOrRetry({ ...fly, fallback: r3.patch.fallback }, { code: "LOST", piece: "chunk_1" }, NOW);
  assert.equal(r4.patch.status, "failed");
  assert.deepEqual(types(r4).filter((t) => t === "refund"), ["refund"], "refunded once");
  assert.ok(types(r4).includes("alert"), "an alert: it failed on our side");
});

test("path: the video's own failures and an empty balance are not retried: failed and refunded at once", () => {
  for (const code of ["GATE_FAILED", "PLAN_FAILED", "VOICE_FAILED", "PROVIDER_BALANCE", "BAD_JOB"]) {
    const r = failOrRetry(run(), { code }, NOW);
    assert.equal(r.patch.status, "failed", code);
    assert.ok(types(r).includes("refund"), code);
    assert.ok(!types(r).some((t) => t.startsWith("dispatch")), code);
  }
  assert.ok(failOrRetry(run(), { code: "PROVIDER_BALANCE" }, NOW).actions.some((a) => a.key === "cutaway-provider-balance"));
  assert.ok(!failOrRetry(run(), { code: "GATE_FAILED" }, NOW).actions.some((a) => a.type === "alert"), "no alert for a topic that didn't pass");
});

test("events: progress moves forward only; a stale attempt can't move the run; done saves the layout; a finished run stays finished", () => {
  const p = onEvent(run({ status: "render" }), { event: "progress", stage: "scene", pct: 40 }, NOW);
  assert.equal(p.patch.status, undefined, "never back from render to scene");
  assert.deepEqual(onEvent(run({ attempt: 2 }), { event: "failed", attempt: 1, code: "LOST" }, NOW).patch, {});
  const d = onEvent(run(), { event: "done", files: { final: "x" }, costs: { gpu: 0.05 } }, NOW);
  assert.equal(d.patch.status, "done");
  assert.deepEqual(d.actions.map((a) => a.type), ["ledger", "settle", "saveLayout"]);
  const after = onEvent(run({ status: "done" }), { event: "failed", code: "LOST", costs: { voice: 0.01 } }, NOW);
  assert.deepEqual(after.patch, {}); assert.deepEqual(after.actions.map((a) => a.type), ["ledger"], "late costs still counted");
  const pl = onEvent(run({ provider: "fly", fallback: { phase: "plan" } }), { event: "planned", frames: 1109, previewFrames: 8 }, NOW);
  assert.equal(pl.patch.plan_ready, true); assert.deepEqual(types(pl), ["dispatch:fly:chunks"]);
});

test("watchdog: 45 minutes is the hard limit, a quiet worker is lost, a long queue goes to the next step", () => {
  const old = onWatch(run({ created_at: ago(LIMITS.hardMin * 60 + 5) }), { status: "IN_PROGRESS" }, NOW);
  assert.equal(old.patch.status, "failed"); assert.equal(old.patch.error_code, "TIMEOUT"); assert.ok(types(old).includes("refund"));
  const quiet = onWatch(run({ heartbeat_at: ago(LIMITS.staleSec + 5) }), { status: "IN_PROGRESS" }, NOW);
  assert.deepEqual(types(quiet), ["cancel", "dispatch:runpod:video"]);
  const queued = onWatch(run({ status: "queued", heartbeat_at: null, dispatched_at: ago(LIMITS.queueSec + 5) }), { status: "IN_QUEUE" }, NOW);
  assert.deepEqual(types(queued), ["cancel", "dispatch:fly:plan"], "no GPU slot: straight to the CPU fallback");
  assert.deepEqual(onWatch(run(), { status: "IN_PROGRESS" }, NOW).actions, [], "a healthy run is left alone");
});

test("events: an earlier attempt's RunPod webhook never fails or retries the run again (the production test of 2026-10-25)", () => {
  const retrying = run({ attempt: 2, provider_job_id: null });
  assert.deepEqual(onEvent(retrying, { event: "runpod", jobId: "rp-1", status: "FAILED" }, NOW).patch, {});
  assert.deepEqual(onEvent(run({ attempt: 2, provider_job_id: "rp-2" }), { event: "runpod", jobId: "rp-1", status: "FAILED" }, NOW).patch, {});
  assert.equal(onEvent(run({ provider_job_id: "rp-1" }), { event: "runpod", jobId: "rp-1", status: "FAILED" }, NOW).patch.attempt, 2, "the current job's failure still retries");
});

// ---------- the worker's failure codes (m3/videoJob.mjs) ----------

test("worker: an empty balance (Anthropic's real 400 of 2026-10-24) is PROVIDER_BALANCE, never retried", async () => {
  const { classify } = await import("../scripts/cutaway/proto3d/m3/videoJob.mjs");
  const real = new Error('anthropic 400 {"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}');
  assert.deepEqual(classify(real), { code: "PROVIDER_BALANCE", retryable: false });
  assert.deepEqual(classify(new Error("elevenlabs 401 quota_exceeded")), { code: "PROVIDER_BALANCE", retryable: false });
  assert.deepEqual(classify(new Error("anthropic 529 overloaded")), { code: "PROVIDER_BUSY", retryable: true });
  assert.deepEqual(classify(new Error("voice check failed twice")), { code: "VOICE_FAILED", retryable: false });
  assert.deepEqual(classify(Object.assign(new Error("no gpu"), { code: "NO_GPU" })), { code: "NO_GPU", retryable: true });
  assert.equal(classify(new Error("chrome crashed")).code, "RENDER_FAILED");
});

// ---------- the layout rules (m2/layoutRules.js) ----------

test("layout rules: a pipe's water rides in front of it, a thin pipe gets thicker, a spray starts at its hose", () => {
  const L = {
    world: { backdrop: { type: "yard" } },
    parts: [
      { id: "hose", kind: "pipeRun", params: { mat: "hose", path: [[0, 0.1, 0], [2, 0.1, 0]], r: 0.06 } },
      { id: "jet", kind: "flow", params: { path: [[2.5, 1.2, 0], [3.5, 0.2, 0]], look: "water" } },
      { id: "pipe", kind: "pipeRun", params: { path: [[0, -1, 0], [4, -1.4, 0]], r: 0.12 } },
      { id: "pipeFlow", kind: "pipeRunFlow", params: { pipe: "pipe", dz: 0 } },
    ],
    beats: [],
  };
  const { layout, notes } = layoutRules(L);
  const by = Object.fromEntries(layout.parts.map((p) => [p.id, p]));
  assert.ok(by.pipe.params.r >= 0.16);
  assert.ok(by.pipeFlow.params.dz >= by.pipe.params.r + 0.05);
  assert.deepEqual(by.jet.params.path[0].slice(0, 1), [2]); assert.equal(by.jet.params.look, "spray");
  assert.ok(notes.length >= 2);
  assert.equal(L.parts[2].params.r, 0.12, "the input layout is not changed");
});
