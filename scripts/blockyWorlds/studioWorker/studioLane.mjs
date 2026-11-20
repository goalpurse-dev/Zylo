// THE STUDIO LANE (owner 2026-11-20: "a full In This Town video must never wait behind a Studio finish"): a Zyvo
// connector job (a voice or finish_my_video) runs in its OWN child process at the lowest CPU priority (nice 19; its
// ffmpeg runs inherit it), next to the video loop on the same machine. So:
//   - the worker keeps claiming video runs while a finish runs (a video starts within one poll, never after it);
//   - the finish's blocking ffmpeg calls (spawnSync) can't freeze the video loop's heartbeats and RunPod polling;
//   - when both want the CPU, the video run gets it (nice 0 vs 19 = ~98 % of the shares); the finish just slows down.
// $0 extra: no second Fly machine (a second always-on shared-cpu-2x / 4 GB is about $20+ a month).
// One lane per worker machine (one finish at a time each).
//   parent: startLane(job, { workerId, workDir, log }) -> { promise: { ok, code?, usd }, kill(), pid }
//   child:  node studioLane.mjs <job.json> <workerId>   (runs runStudioJob, prints "ZYVO_LANE_RESULT {json}")
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const MARK = "ZYVO_LANE_RESULT ";
export const LANE_NICE = 19;

export function startLane(job, { workerId, workDir, log = () => {}, entry = HERE, env = process.env, nice = LANE_NICE } = {}) {
  fs.mkdirSync(workDir, { recursive: true });
  const jobFile = path.join(workDir, `lane-${job.id}.json`);
  fs.writeFileSync(jobFile, JSON.stringify(job));
  const child = spawn(process.execPath, [entry, jobFile, String(workerId)], { env, stdio: ["ignore", "pipe", "pipe"] });
  try { os.setPriority(child.pid, nice); } catch (e) { log(`lane: could not lower the priority (${e?.message ?? e}); it still runs beside the video loop`); }
  let result = null, killed = false, buf = "";
  const onLine = (line) => {
    if (line.startsWith(MARK)) { try { result = JSON.parse(line.slice(MARK.length)); } catch { /* a broken line: failed below */ } }
    else if (line.trim()) log(`[lane] ${line}`);
  };
  child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  child.stderr.on("data", (d) => String(d).split("\n").forEach((l) => l.trim() && log(`[lane] ${l}`)));
  const promise = new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      if (buf) onLine(buf);
      fs.rmSync(jobFile, { force: true });
      if (result) resolve(result);
      else resolve({ ok: false, code: killed ? "KILLED" : "LANE_CRASH", usd: 0, exit: code, signal });
    });
  });
  return { promise, pid: child.pid, kill() { killed = true; try { child.kill("SIGKILL"); } catch { /* gone */ } } };
}

// ---------------------------------------------------------------- the child
if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  const [jobFile, workerId] = process.argv.slice(2);
  const say = (m) => console.log(`[studio-lane ${new Date().toISOString().slice(11, 19)}] ${m}`);
  let out = { ok: false, code: "LANE_CRASH", usd: 0 };
  try {
    const job = JSON.parse(fs.readFileSync(jobFile, "utf8"));
    const { keysFromEnv, loadConfig } = await import("./config.mjs");
    const cfg = loadConfig();
    keysFromEnv();
    const { makeSteps } = await import("./steps.mjs");
    const { ledger } = await import("../studio/ledger.mjs");
    const { restStudio, runStudioJob } = await import("./studioJobs.mjs");
    const db = restStudio({ url: cfg.supabaseUrl, key: cfg.serviceKey });
    const steps = makeSteps({ anthropicKey: cfg.anthropicKey, elevenKey: cfg.elevenKey });
    // the parent's worker id: the job row was claimed under it (every write checks it)
    out = await runStudioJob(job, { db, steps, makeLedger: ledger, workDir: cfg.workDir, workerId, anthropicKey: cfg.anthropicKey, keepWork: cfg.keepWork, log: say });
  } catch (e) {
    say(`lane failed before the job could run: ${e?.message ?? e} (the sweep refunds it)`);
  }
  console.log(`${MARK}${JSON.stringify(out)}`);
  process.exit(0);
}
