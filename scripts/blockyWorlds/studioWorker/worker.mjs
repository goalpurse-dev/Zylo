// Blocky Worlds STUDIO WORKER (soft launch 2026-11-13): a small CPU process (one Fly machine, docs/blocky-worlds-launch.md)
// that pulls queued Studio runs from the database ONE at a time, runs the Studio v3 loop (runner.mjs + steps.mjs: the
// voice, the Sonnet director with its RunPod previews + checker + one fix round, the final on RunPod), uploads the video
// and moves the run's stage as it goes. More machines = more videos at once (each takes one run; the claim is atomic).
//   node scripts/blockyWorlds/studioWorker/worker.mjs            the loop (the container's command)
//   node ... worker.mjs --check                                  which secrets are set (names only) + a read-only DB ping
//   node ... worker.mjs --once                                   take at most one run, then exit
//   node ... worker.mjs --smoke                                  imports every module (the image build runs it): no key, no call
// It says hello every ~30 s (blocky_worlds_workers): blocky-worlds-api refuses a start (nothing charged) without one.
// It does not take a run while paid calls are off or the emergency cap is reached (the run waits; the sweeper fails and
// refunds it after maxWaitMin if nobody can take it).
// SIGTERM (a deploy, a stop): stops taking runs; a run in progress is failed and refunded at once (WORKER_RESTART), so
// deploy the worker while it is idle (the launch doc says how to check).
import fs from "node:fs";
import { decide } from "../../../supabase/functions/_shared/blockyWorlds/guard.js";
import { makeStudioRuns } from "../../../supabase/functions/_shared/blockyWorlds/studioRuns.js";
import { STUDIO } from "../../../supabase/functions/_shared/blockyWorlds/studio.js";
import { describeConfig, keysFromEnv, loadConfig } from "./config.mjs";
import { restDb, restStorage } from "./rest.mjs";
import { runStudioRun } from "./runner.mjs";

const argv = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`[studio-worker ${new Date().toISOString().slice(11, 19)}] ${m}`);

if (argv.includes("--smoke")) {
  // every module the loop can load, imported once (the Docker build fails on a missing file); no key is read
  keysFromEnv();
  await import("./steps.mjs");
  say(`smoke ok: steps, runner, config (engine ${STUDIO.endpoint}, model ${STUDIO.model}, ${STUDIO.rounds} fix round)`);
  process.exit(0);
}
if (argv.includes("--check")) {
  for (const [k, v] of Object.entries(describeConfig())) say(`${k}: ${v}`);
  let cfg;
  try { cfg = loadConfig(); } catch (e) { say(`NOT READY: ${e.message}`); process.exit(1); }
  const db = restDb({ url: cfg.supabaseUrl, key: cfg.serviceKey });
  const g = await db.gateState();
  const d = decide(g.settings, g.counts, 0, { kind: "studio" });
  say(`database: ${g.settings ? "reachable" : "NOT reachable"}; paid calls ${g.settings?.paid_calls === false ? "OFF" : "on"}; spent 24 h $${Number(g.counts?.spent_24h ?? 0).toFixed(2)} of $${g.settings?.daily_cap_usd ?? "?"}; would take runs: ${d.ok ? "yes" : `no (${d.reason})`}`);
  process.exit(0);
}

const cfg = loadConfig();
keysFromEnv();
const { makeSteps } = await import("./steps.mjs");
const { ledger } = await import("../studio/ledger.mjs");
const db = restDb({ url: cfg.supabaseUrl, key: cfg.serviceKey });
const storage = restStorage({ url: cfg.supabaseUrl, key: cfg.serviceKey });
const steps = makeSteps({ anthropicKey: cfg.anthropicKey, elevenKey: cfg.elevenKey });
// the Blender kit engine (blenderKit/workerSteps.mjs): OFF by default, owner-only. Used for a run only when
// BLOCKY_WORLDS_RENDER_ENGINE=blender AND the run's user is in BLOCKY_WORLDS_BLENDER_OWNER_IDS; everyone else keeps Studio
const { makeBlenderSteps, pickSteps } = await import("../blenderKit/workerSteps.mjs");
const blenderSteps = makeBlenderSteps({ base: steps, anthropicKey: cfg.anthropicKey, cfg: STUDIO });
if (String(process.env.BLOCKY_WORLDS_RENDER_ENGINE ?? "").trim().toLowerCase() === "blender") say(`Blender kit engine ON for ${String(process.env.BLOCKY_WORLDS_BLENDER_OWNER_IDS ?? "").split(",").filter((s) => s.trim()).length} owner id(s); every other run stays on Studio`);
fs.mkdirSync(cfg.workDir, { recursive: true });

const control = { stop: null };
let current = null, stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  say(`${signal}: no new runs${current ? `; run ${current.id} is failed and refunded (WORKER_RESTART)` : ""}`);
  if (current) {
    control.stop = { code: "WORKER_RESTART", message: `the worker was stopped (${signal}) while making it` };
    await makeStudioRuns({ db, log: say }).failRun(current, "WORKER_RESTART", control.stop.message, { worker: cfg.workerId }).catch((e) => say(`fail write: ${e?.message ?? e} (the sweeper refunds it)`));
  }
  await db.workerGone(cfg.workerId);
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

say(`worker ${cfg.workerId} (version ${cfg.version}) up; polling every ${cfg.pollSec} s`);
let hello = 0, idleNote = 0;
while (!stopping) {
  try {
    if (Date.now() - hello > STUDIO.heartbeatSec * 1000) { await db.workerSeen(cfg.workerId, { version: cfg.version, busyRun: null }); hello = Date.now(); }
    // the paid switch and the emergency cap: closed -> take nothing (the run waits in line)
    const g = await db.gateState();
    const d = decide(g.settings, g.counts, 0, { kind: "studio" });
    if (!d.ok) { if (Date.now() - idleNote > 600000) { say(`not taking runs: ${d.reason}`); idleNote = Date.now(); } await sleep(60000); continue; }
    const run = await db.claim(cfg.workerId);
    if (!run) { if (argv.includes("--once")) break; await sleep(cfg.pollSec * 1000); continue; }
    current = run;
    say(`took run ${run.id} ("${String(run.title).slice(0, 60)}", ${run.length_sec} s)`);
    await db.workerSeen(cfg.workerId, { version: cfg.version, busyRun: run.id }).catch(() => {});
    // the hello keeps going during the run (the heartbeat on the run row is the runner's)
    const keep = setInterval(() => { db.workerSeen(cfg.workerId, { version: cfg.version, busyRun: run.id }).catch(() => {}); }, STUDIO.heartbeatSec * 1000);
    try {
      const r = await runStudioRun(run, { db, steps: pickSteps(run, { studio: steps, blender: blenderSteps }), storage, makeLedger: ledger, workerId: cfg.workerId, workDir: cfg.workDir, control, keepWork: cfg.keepWork });
      say(`run ${run.id}: ${r.ok ? "done" : `failed ${r.code}`} ($${r.costUsd})`);
    } finally { clearInterval(keep); current = null; hello = 0; }
    if (argv.includes("--once")) break;
  } catch (e) {
    say(`loop error (retrying in 30 s): ${e?.message ?? e}`);
    await sleep(30000);
  }
}
if (!stopping) { await db.workerGone(cfg.workerId); process.exit(0); }
