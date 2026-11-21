// In This Town THE CUSTOMER GATE (owner 2026-11-21): a video under 70% passing shots after the extra fix round is never
// delivered: the Blender pipeline stops with QUALITY_GATE (blender/stop.json), the worker's Blender step hands the code
// on, the runner fails the run ONCE with the full automatic refund and ONE owner alert (studioRuns.js failRun), the
// sweeper mails it once per run, the customer reads the honest "quality bar" text. Free: no network, no paid call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { memoryDb } from "../scripts/blockyWorlds/engine/dev/pipelineFakes.mjs";
import { runStudioRun } from "../scripts/blockyWorlds/studioWorker/runner.mjs";
import { makeBlenderSteps, readStop } from "../scripts/blockyWorlds/blenderKit/workerSteps.mjs";
import { ledger } from "../scripts/blockyWorlds/studio/ledger.mjs";
import { makeStudioRuns, studioFailAlert } from "../supabase/functions/_shared/blockyWorlds/studioRuns.js";
import { failReason } from "../supabase/functions/_shared/blockyWorlds/contract.js";

const T0 = Date.parse("2026-11-21T12:00:00Z");
const clone = (o) => JSON.parse(JSON.stringify(o));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bw-quality-gate-"));
const MESSAGE = "QUALITY_GATE: only 21% of the shots pass (11 of 52) after the fix rounds and one extra round for the failing shots; the bar for delivery is 70%: stopped before the final render, not delivered, refund. Top reasons: a line's key thing not on screen (30, e.g. shot 12: line 4 \"the bus\" is not shown literally); the view is blocked (8, e.g. shot 3: A tree blocks the view)";

function studioDb() {
  const db = memoryDb({ now: () => T0 });
  const base = db.updateRun.bind(db);
  db.updateRun = async (id, patch, guard = {}) => {
    const r = db.runs.get(id);
    if (!r) return null;
    if (guard.worker && r.worker_id !== guard.worker) return null;
    return base(id, patch, guard);
  };
  db.gateState = async () => ({ settings: { paid_calls: true, daily_cap_usd: 20 }, counts: { spent_24h: 1.2 } });
  return db;
}
const studioRun = (db) => db.addRun({ engine: "studio", status: "voice", studio_stage: "voice", worker_id: "w1", claimed_at: new Date(T0).toISOString(), heartbeat_at: new Date(T0).toISOString(), credits_charged: 108, length_sec: 60, title: "The Bus That Sang", lines: [{ part: "rule", text: "In this town, the bus sings." }, { part: "me", text: "I missed it." }] });

function fakeSteps(direct) {
  const dir = tmp();
  const f = (name, body) => { const p = path.join(dir, name); fs.writeFileSync(p, body); return p; };
  let finals = 0;
  const steps = {
    async voice() { return { wav: f("v.wav", "w"), words: [{ word: "In", start: 0, end: 0.2 }], duration: 60 }; },
    async plan() { return { tl0: { duration: 62, lines: [], shots: [] } }; },
    async mix() { return { file: f("mix.m4a", "m") }; },
    direct,
    async final() { finals++; return { final: f("final.mp4", "video") }; },
    async outputs({ final }) { return { final, web: final, poster: final, durationSec: 60, bytes: 5 }; },
  };
  const uploads = [];
  const storage = { async upload(p) { uploads.push(p); return { path: p }; } };
  return { steps, storage, uploads, dir, finals: () => finals };
}

test("runner: a QUALITY_GATE stop -> failed once as QUALITY_GATE, refunded once (full), ONE owner alert with the run, title, share and reasons; no final, no video", async () => {
  const db = studioDb();
  const run = studioRun(db);
  const { steps, storage, uploads, dir, finals } = fakeSteps(async ({ L, log }) => {
    L.add("agent", 0.4); L.add("runpod_preview", 0.1);
    log(`stopping: the quality gate: ${MESSAGE}`);
    return { plan: null, report: { finished: { code: "QUALITY_GATE", reason: MESSAGE } } };
  });
  const r = await runStudioRun(clone(run), { db, steps, storage, makeLedger: ledger, workerId: "w1", workDir: path.join(dir, "work"), now: () => T0, log: () => {}, timers: { set: () => 0, clear: () => {} } });
  assert.equal(r.ok, false);
  assert.equal(r.code, "QUALITY_GATE");
  const row = db.runs.get(run.id);
  assert.equal(row.status, "failed");
  assert.equal(row.error_code, "QUALITY_GATE");
  assert.match(row.error_message, /^QUALITY_GATE: only 21% of the shots pass \(11 of 52\)/);
  assert.equal(db.refunds.filter((x) => x === run.id).length, 1, "refunded once");
  assert.equal(row.credits_refunded, 108, "the full charge comes back");
  assert.equal(finals(), 0, "the final step never ran");
  assert.equal(uploads.filter((p) => /final\.mp4|web\.mp4|poster/.test(p)).length, 0, "nothing delivered");
  const alerts = db.alerts.filter((a) => /QUALITY_GATE/.test(a.key));
  assert.equal(alerts.length, 1, "one alert");
  assert.equal(db.alerts.length, 1, "and no other alert");
  assert.equal(alerts[0].key, `blocky-worlds-studio-QUALITY_GATE-${run.id}`);
  assert.match(alerts[0].subject, /NOT delivered/);
  assert.ok(alerts[0].text.includes(run.id) && alerts[0].text.includes("The Bus That Sang"));
  assert.match(alerts[0].text, /21% of the shots pass/);
  assert.match(alerts[0].text, /Top reasons: a line's key thing not on screen \(30/);
  assert.match(alerts[0].text, /Refunded 108 credits automatically/);
  // what was spent is still booked
  assert.ok(db.ledgerRows.some((l) => l.stage === "director") && db.ledgerRows.some((l) => l.stage === "previews"));
  // the sweeper (or a restart) can't fail or refund it again
  const runs = makeStudioRuns({ db, now: () => T0, log: () => {} });
  assert.equal(await runs.failRun(run, "WORKER_LOST", "again"), false);
  assert.equal(db.refunds.filter((x) => x === run.id).length, 1);
  // the customer reads the honest quality text
  assert.deepEqual(failReason(row.error_code, row.error_message), { kind: "quality", text: "Some shots didn't meet our quality bar, so we stopped before the final render and refunded you." });
});

test("the sweeper's email: one per QUALITY_GATE run (its own key), other codes stay one per code an hour", () => {
  const a = studioFailAlert({ id: "run-a", title: "A", error_code: "QUALITY_GATE", error_message: MESSAGE, credits_refunded: 108 });
  const b = studioFailAlert({ id: "run-b", title: "B", error_code: "QUALITY_GATE", error_message: MESSAGE, credits_refunded: 54 });
  assert.notEqual(a.key, b.key);
  assert.equal(a.key, "blocky-worlds-studio-QUALITY_GATE-run-a");
  assert.match(a.text, /^Run run-a "A" was stopped by the customer gate before the final render/);
  assert.doesNotMatch(a.text, /QUALITY_GATE: only/, "the code prefix is not repeated");
  const c = studioFailAlert({ id: "run-c", title: "C", error_code: "RENDER_FAILED", error_message: "job 1", credits_refunded: 10 });
  assert.equal(c.key, "blocky-worlds-studio-RENDER_FAILED");
  assert.equal(c.text, "Run run-c (C) failed in the worker: RENDER_FAILED job 1. Refunded 10 credits.");
  const sweeper = fs.readFileSync("supabase/functions/_shared/blockyWorlds/studioSupabase.ts", "utf8");
  assert.match(sweeper, /const m = studioFailAlert\(r\);\s+await alertOnce\(admin, m\.key, 3600, m\.subject, m\.text\);/);
});

test("the worker's Blender step hands the pipeline's QUALITY_GATE stop to the runner; an old stop note never counts", async () => {
  const dir = tmp();
  // stand-ins for pipeline.mjs: at the customer gate it writes the stop note, then throws; any other failure writes none
  const fakeOf = (name, { note }) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, [
      "import fs from 'node:fs'; import path from 'node:path';",
      "const a = process.argv.slice(2), run = a[a.indexOf('--run') + 1];",
      "fs.mkdirSync(path.join(run, 'blender'), { recursive: true });",
      note ? `fs.writeFileSync(path.join(run, 'blender', 'stop.json'), JSON.stringify({ code: 'QUALITY_GATE', message: ${JSON.stringify(MESSAGE)} }));` : "",
      "fs.appendFileSync(path.join(run, 'blender', 'pipeline.log'), 'the last log line');",
      `throw Object.assign(new Error(${JSON.stringify(note ? MESSAGE : "something else broke")}), { code: ${JSON.stringify(note ? "QUALITY_GATE" : "X")} });`,
    ].join("\n"));
    return file;
  };
  const cfg = { runCapUsd: 4, agentCapUsd: 3, blenderModel: "sonnet", blenderChunks: 6 };
  const call = async (pipeline, oldNote = false) => {
    const runDir = fs.mkdtempSync(path.join(dir, "run-"));
    if (oldNote) { fs.mkdirSync(path.join(runDir, "blender"), { recursive: true }); fs.writeFileSync(path.join(runDir, "blender", "stop.json"), JSON.stringify({ code: "QUALITY_GATE", message: "an old run's verdict" })); }
    const steps = makeBlenderSteps({ base: {}, anthropicKey: "test-key", cfg, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, pipeline });
    const logs = [];
    const out = await steps.direct({ script: { title: "t", lines: [] }, dir: runDir, L: { costs: {} }, log: (m) => logs.push(m) });
    return { out, logs };
  };
  const g = await call(fakeOf("gate.mjs", { note: true }));
  assert.equal(g.out.plan, null);
  assert.equal(g.out.report.finished.code, "QUALITY_GATE");
  assert.equal(g.out.report.finished.reason, MESSAGE);
  assert.ok(g.logs.some((l) => /^stopping: the quality gate: QUALITY_GATE: only 21%/.test(l)));
  // a Try again's restored parts carry the failed run's stop note: removed before the pipeline starts, never this run's
  const p = await call(fakeOf("plain.mjs", { note: false }), true);
  assert.equal(p.out.plan, null);
  assert.equal(p.out.report.finished.code, undefined);
  assert.match(p.out.report.finished.reason, /^something else broke \|\| the last log line/);
  assert.equal(readStop(path.join(dir, "nowhere")), null);
});
