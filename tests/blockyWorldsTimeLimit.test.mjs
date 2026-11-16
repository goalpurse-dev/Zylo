// THE TIME LIMIT + THE LATE-VIDEO RESCUE (owner 2026-11-16): run 2947e875 was failed TIMEOUT by a fixed 45 min while its
// finish was one minute from done, then the worker deleted the folder and the video was lost. Free: fakes only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STUDIO, studioLimitMin, studioProgressAt, studioSweepDecision } from "../supabase/functions/_shared/blockyWorlds/studio.js";
import { makeStudioRuns } from "../supabase/functions/_shared/blockyWorlds/studioRuns.js";
import { memoryDb } from "../scripts/blockyWorlds/engine/dev/pipelineFakes.mjs";
import { runStudioRun } from "../scripts/blockyWorlds/studioWorker/runner.mjs";
import { restDb } from "../scripts/blockyWorlds/studioWorker/rest.mjs";
import { ledger } from "../scripts/blockyWorlds/studio/ledger.mjs";
import { makeProgress } from "../scripts/blockyWorlds/blenderKit/progress.mjs";

const T0 = Date.parse("2026-11-16T08:00:00Z");
const iso = (t) => new Date(t).toISOString();
const m = (min) => iso(T0 - min * 60000);
const clone = (o) => JSON.parse(JSON.stringify(o));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bw-limit-test-"));

test("the limit: at least 75 min, scales with the length, never over the 2 h hard max", () => {
  assert.equal(STUDIO.hardMin, 120);
  assert.equal(studioLimitMin({ length_sec: 30 }), 75);
  assert.ok(studioLimitMin({ length_sec: 80 }) >= 75 && studioLimitMin({ length_sec: 80 }) < studioLimitMin({ length_sec: 120 }));
  assert.equal(studioLimitMin({ length_sec: 600 }), 120);
  // 2947e875 (99 s of voice, target 80 s) was done 47 min after the claim: far inside
  assert.ok(studioLimitMin({ length_sec: 80 }) > 47 + 15);
});

test("the sweeper never stops a run that still moves; a quiet run past the limit, the hard max and a dead worker are stopped", () => {
  const run = (f = {}) => ({ id: "r", engine: "studio", status: "rendering", worker_id: "w1", created_at: m(130), claimed_at: m(80), heartbeat_at: m(0.5), stage_at: m(40), length_sec: 60, ...f });
  // 80 min after the claim (past the 75 min limit), the pipeline printed a line 2 min ago: left alone
  assert.equal(studioSweepDecision(run({ progress: { lineAt: m(2) } }), T0), null);
  // 45 min after the claim (the old fixed limit): left alone even with no progress
  assert.equal(studioSweepDecision(run({ claimed_at: m(45), progress: { lineAt: m(30) } }), T0), null);
  // past the limit AND quiet for 30 min: TIMEOUT
  assert.equal(studioSweepDecision(run({ progress: { lineAt: m(30) } }), T0)?.code, "TIMEOUT");
  // the hard max: TIMEOUT even while it moves
  assert.equal(studioSweepDecision(run({ claimed_at: m(121), progress: { lineAt: m(1) } }), T0)?.code, "TIMEOUT");
  // no heartbeat: the worker is gone
  assert.equal(studioSweepDecision(run({ heartbeat_at: m(STUDIO.staleMin + 1), progress: { lineAt: m(1) } }), T0)?.code, "WORKER_LOST");
  // the unclaimed line keeps its own rule
  assert.equal(studioSweepDecision(run({ worker_id: null, claimed_at: null, created_at: m(STUDIO.maxWaitMin + 1) }), T0)?.code, "QUEUE_TIMEOUT");
  assert.equal(studioSweepDecision(run({ worker_id: null, claimed_at: null, created_at: m(10) }), T0), null);
  assert.equal(studioProgressAt({ render: { progress: { lineAt: m(3) } }, stage_at: m(9) }), T0 - 3 * 60000);
});

test("the progress tracker keeps the time of the pipeline's last line", () => {
  let now = T0;
  const t = makeProgress({ now: () => now });
  t.feed("[08:00:00] plan: 90 shots in 5 locations");
  now += 60000;
  assert.equal(t.snapshot().lineAt, T0);
  t.feed("");
  assert.equal(t.snapshot().lineAt, T0);
});

// ---------------------------------------------------------------- the runner
function db0() {
  const db = memoryDb({ now: () => T0 });
  const base = db.updateRun.bind(db);
  db.updateRun = async (id, patch, guard = {}) => { const r = db.runs.get(id); if (!r || (guard.worker && r.worker_id !== guard.worker)) return null; return base(id, patch, guard); };
  db.rescueRun = async (id, patch, { worker }) => { const r = db.runs.get(id); if (!r || r.status !== "failed" || r.worker_id !== worker) return null; Object.assign(r, patch); return { id }; };
  db.liveStudioRuns = async () => [...db.runs.values()].filter((r) => r.engine === "studio" && !["done", "failed"].includes(r.status)).map(clone);
  db.gateState = async () => ({ settings: { paid_calls: true, daily_cap_usd: 20 }, counts: { spent_24h: 1 } });
  return db;
}
const addRun = (db, f = {}) => db.addRun({ engine: "studio", status: "voice", studio_stage: "voice", worker_id: "w1", claimed_at: iso(T0), heartbeat_at: iso(T0), credits_charged: 313, length_sec: 80, title: "The Yawn", lines: [{ part: "rule", text: "In this town, every yawn puts you to sleep." }], ...f });
function deps0(db, { now = () => T0, direct, upload } = {}) {
  const dir = tmp(), uploads = [], cleaned = [];
  const f = (name, body) => { const p = path.join(dir, name); fs.writeFileSync(p, body); return p; };
  const steps = {
    async voice() { return { wav: f("v.wav", "w"), words: [{ word: "In", start: 0, end: 0.2 }], duration: 99 }; },
    async plan() { return { tl0: { duration: 99, lines: [], shots: [] } }; },
    async mix() { return { file: f("mix.m4a", "m") }; },
    direct,
    async final({ dir: d }) { return { final: path.join(d, "blender", "final.mp4") }; },
    async outputs({ final }) { return { final, web: f("web.mp4", "web"), poster: f("poster.jpg", "jpg"), durationSec: 99.2, bytes: 5 }; },
    async cleanup({ dir: d }) { cleaned.push(d); },
  };
  const storage = { async upload(p, file) { if (upload) await upload(p); uploads.push(p); return { path: p }; } };
  return { deps: { db, steps, storage, makeLedger: ledger, workerId: "w1", workDir: path.join(dir, "work"), now, log: () => {}, timers: { set: () => 0, clear: () => {} } }, uploads, cleaned };
}
/** a Blender `direct`: the pipeline made blender/final.mp4 (the runner's shape check: plan.shots + plan.bible.homes) */
const blenderDirect = (during = async () => {}) => async ({ dir }) => {
  fs.mkdirSync(path.join(dir, "blender"), { recursive: true });
  fs.writeFileSync(path.join(dir, "blender", "final.mp4"), "video");
  await during();
  return { plan: { shots: [{ id: 1 }], bible: { homes: { blender: true } } }, report: { shots: 1 }, blender: { shots: 1 } };
};

test("THE LATE VIDEO: swept (failed + refunded) while the finish ran -> still uploaded, Ready, refund kept, no re-charge, the ready email due", async () => {
  const db = db0();
  const run = addRun(db);
  const sweeper = makeStudioRuns({ db, now: () => T0 + 50 * 60000 });
  const { deps, uploads, cleaned } = deps0(db, { direct: blenderDirect(async () => { await sweeper.failRun(clone(db.runs.get(run.id)), "TIMEOUT", "not done 45 min after the worker took it"); }) });
  const before = db.runs.get(run.id);
  const r = await runStudioRun(clone(run), deps);
  const row = db.runs.get(run.id);
  assert.equal(r.ok, true);
  assert.equal(r.late, true);
  assert.equal(row.status, "done");
  assert.ok(row.files?.final && uploads.some((p) => /final\.mp4$/.test(p)));
  assert.equal(row.refunded_at != null || Number(row.credits_refunded) > 0, true, "the refund is kept");
  assert.equal(row.credits_charged, before.credits_charged ?? 313, "no re-charge");
  assert.match(row.error_message, /late video: .*TIMEOUT.*refund .* kept/);
  assert.equal(row.notified_at ?? null, null, "the ready email goes out as usual");
  assert.equal(row.render?.late?.after, "TIMEOUT");
  assert.equal(cleaned.length, 1, "the stored parts go only after delivery");
  assert.equal(fs.existsSync(path.join(deps.workDir, run.id)), false, "the folder goes after delivery");
});

test("the folder of a made video is KEPT when the delivery fails; a run with no video still cleans up", async () => {
  {
    const db = db0();
    const run = addRun(db);
    const { deps, cleaned } = deps0(db, { direct: blenderDirect(), upload: async () => { throw new Error("storage down"); } });
    const r = await runStudioRun(clone(run), deps);
    assert.equal(r.ok, false);
    assert.ok(fs.existsSync(path.join(deps.workDir, run.id, "blender", "final.mp4")), "the video is not lost");
    assert.equal(cleaned.length, 0, "the stored parts stay");
  }
  {
    const db = db0();
    const run = addRun(db);
    const { deps } = deps0(db, { direct: async () => ({ plan: null, report: { finished: { reason: "plan check" } } }) });
    const r = await runStudioRun(clone(run), deps);
    assert.equal(r.code, "DIRECTOR_FAILED");
    assert.equal(fs.existsSync(path.join(deps.workDir, run.id)), false);
  }
});

test("the runner: past the soft limit but still moving -> it goes on; quiet past the limit -> TIMEOUT; the hard max -> TIMEOUT", async () => {
  // the three.js engine (no blender flag): the limits are checked before its final
  const plain = (advanceMin, lineAgoMin) => async ({ onProgress }) => {
    now += advanceMin * 60000;
    if (lineAgoMin != null) await onProgress({ stage: "fixing", pct: 50, ceil: 60, detail: "x", lineAt: now - lineAgoMin * 60000 });
    return { plan: { shots: [{ id: 1 }], bible: { homes: { me: 0 } } }, report: {} };
  };
  let now = T0;
  for (const [adv, ago, want] of [[90, 1, true], [90, 40, "TIMEOUT"], [125, 0, "TIMEOUT"]]) {
    now = T0;
    const db = db0();
    const run = addRun(db, { length_sec: 60 });
    const { deps } = deps0(db, { now: () => now, direct: plain(adv, ago) });
    deps.steps.final = async ({ dir }) => { fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, "f.mp4"); fs.writeFileSync(p, "v"); return { final: p }; };
    const r = await runStudioRun(clone(run), deps);
    if (want === true) assert.equal(r.ok, true, `${adv} min, last line ${ago} min ago: goes on`);
    else assert.equal(r.code, want, `${adv} min, last line ${ago} min ago`);
  }
});

test("rest: the rescue only turns THIS worker's failed run into done", async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return { ok: true, text: async () => JSON.stringify([{ id: "r1", status: "done", worker_id: "w1" }]) }; };
  const db = restDb({ url: "https://x.supabase.co", key: "k", fetchFn });
  assert.equal(await db.rescueRun("r1", { status: "done" }, { worker: null }), null);
  assert.deepEqual(await db.rescueRun("r1", { status: "done" }, { worker: "w1" }), { id: "r1", status: "done", worker_id: "w1" });
  assert.match(calls[0].url, /status=eq\.failed&worker_id=eq\.w1&deleted_at=is\.null/);
  assert.doesNotMatch(calls[0].init.body, /refund/);
});
