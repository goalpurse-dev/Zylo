// Blender kit engine: the RunPod jobs and the storage test folder for one run (the Studio pipeline, pipeline.mjs).
// Every job is priced worst-case on the run's ledger (studio/ledger.mjs) BEFORE it is sent, and booked after: its run
// time plus a new worker's boot. The time limit counts from IN_PROGRESS; over it the job is cancelled. Files move through
// signed URLs in bucket "generated" under blocky-worlds-test/blender-kit/<run>/ (<= 45 MB parts; deleted at the end).
//   const R = runpod({ L, endpoint, prefix, log })
//   await R.job(label, input, { maxRunSec, ledgerKey })  -> { ok, status, output, execS, bootS, usd, error }
//   await R.putFile(name, file) / R.signGet(name) / R.signPuts(name, n) / R.fetchParts(name, parts, dest) / R.cleanup()
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storage, loadEnv } from "../engine/runpod/client.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// RunPod serverless 16 GB tier (RTX 4000 Ada / A4500 / A4000 / 2000 Ada), per second (engine/runpod/client.mjs RATE)
export const RATE = 0.58 / 3600;
export const BOOT_S = 95; // a new worker's boot, billed (measured 53-72 s delay on this image + idle 5 s; rounded up)
const CUTAWAY = "f66astc0vrus92";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const endpointInfo = () => JSON.parse(fs.readFileSync(path.join(here, "endpoint.json"), "utf8"));

export function runpod({ L, endpoint = endpointInfo().endpointId, prefix, log = console.log, env = loadEnv() }) {
  if (endpoint === CUTAWAY) throw new Error("refusing the Cutaway endpoint");
  if (!prefix?.startsWith("blocky-worlds-test/blender-kit/")) throw new Error("the storage folder must be under blocky-worlds-test/blender-kit/");
  const st = storage(env, prefix);
  const seen = new Set();
  const rp = async (p, init = {}) => {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(`https://api.runpod.ai/v2/${endpoint}${p}`, { ...init, headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000) });
        const t = await r.text(); try { return JSON.parse(t); } catch { return { error: t.slice(0, 300), httpStatus: r.status }; }
      } catch (e) { if (i >= 4) throw e; await sleep(3000 * (i + 1)); }
    }
  };
  return {
    RATE,
    /** one job: priced worst-case first (run limit + a boot), polled every 5 s, cancelled past its limit, booked after */
    async job(label, input, { maxRunSec, ledgerKey }) {
      const worst = +((maxRunSec + BOOT_S) * RATE).toFixed(4);
      L.check(`${label} (RunPod)`, worst);
      const sub = await rp("/run", { method: "POST", body: JSON.stringify({ input }) });
      if (!sub.id) throw new Error(`${label}: RunPod refused the job: ${JSON.stringify(sub).slice(0, 300)}`);
      log(`${label}: job ${sub.id} sent (worst case $${worst})`);
      let started = null, s;
      const t0 = Date.now();
      for (;;) {
        await sleep(5000);
        s = await rp(`/status/${sub.id}`);
        if (s.status === "IN_PROGRESS" && !started) { started = Date.now(); log(`${label}: running${s.workerId ? ` on ${s.workerId}` : ""} after ${((started - t0) / 1000).toFixed(0)} s`); }
        if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) break;
        if ((started && Date.now() - started > maxRunSec * 1000) || Date.now() - t0 > (maxRunSec + 1800) * 1000) {
          await rp(`/cancel/${sub.id}`, { method: "POST" });
          log(`${label}: over its limit: cancelled`);
          s = { ...s, status: "TIMED_OUT", executionTime: Math.max(s.executionTime ?? 0, (started ? Date.now() - started : 0)) };
          break;
        }
      }
      const execS = (s.executionTime ?? 0) / 1000, delayS = (s.delayTime ?? 0) / 1000;
      const wid = s.workerId ?? `unknown-${sub.id}`;
      const bootS = seen.has(wid) ? 0 : Math.min(delayS, 90) + 5;
      seen.add(wid);
      const usd = +((execS + bootS) * RATE).toFixed(5);
      L.add(ledgerKey, usd);
      L.log({ step: "runpod_job", label, job: sub.id, worker: s.workerId ?? null, status: s.status, execS: +execS.toFixed(1), delayS: +delayS.toFixed(1), bootS: +bootS.toFixed(1), usd });
      const out = s.output ?? {};
      const ok = s.status === "COMPLETED" && out.ok !== false;
      return { ok, id: sub.id, status: s.status, output: out, execS, delayS, bootS, usd, worker: s.workerId ?? null, error: ok ? null : (out.error ?? s.error ?? s.status) };
    },
    putFile: (name, file, type = "application/octet-stream") => st.put(name, fs.readFileSync(file), type),
    signGet: (name) => st.signGet(name, 7200),
    signPuts: (name, n) => Promise.all(Array.from({ length: n }, (_, i) => st.signPut(`${name}.part${i}`))),
    async fetchParts(name, parts, dest) {
      const bufs = [];
      for (let i = 0; i < parts; i++) { const b = await st.get(`${name}.part${i}`); if (!b) throw new Error(`download ${name}.part${i} failed`); bufs.push(b); }
      fs.writeFileSync(dest, Buffer.concat(bufs));
      return fs.statSync(dest).size;
    },
    signGetParts: (name, parts) => Promise.all(Array.from({ length: parts }, (_, i) => st.signGet(`${name}.part${i}`, 7200))),
    cleanup: () => st.cleanup(),
  };
}
