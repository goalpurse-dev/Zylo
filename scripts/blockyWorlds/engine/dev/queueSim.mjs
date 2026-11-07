// Blocky Worlds: how long N customers wait when they press Generate at the same time (the shared endpoint's workers;
// supabase/functions/_shared/blockyWorlds/renderQueue.js simulate). Free and read-only: the durations come from the
// newest finished job rows (blocky_worlds_jobs, service key from C:\Users\Public\Zylo\.env.local, never printed).
//   node scripts/blockyWorlds/engine/dev/queueSim.mjs                       90 s videos, 1/2/3/5/8 customers, measured
//   node scripts/blockyWorlds/engine/dev/queueSim.mjs --len 60 --workers 6 --spread 20 --defaults --json
// "now": the old way (every piece sent to RunPod at once, first come first served, ~9 chunks a 90 s video, a piece that
// waits over 4 min cancelled as QUEUE_TIMEOUT); "new": the shared line (oldest run first, pieces sent only while a
// worker is free) + the queue-aware chunk count (chooseChunkCount).
import fs from "node:fs";
import { RENDER } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";
import { DURATIONS, measureDurations, waitTable } from "../../../../supabase/functions/_shared/blockyWorlds/renderQueue.js";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const lenS = Number(opt("len", 90)), workers = Number(opt("workers", RENDER.workers)), spreadS = Number(opt("spread", 0));
const counts = String(opt("customers", "1,2,3,5,8")).split(",").map(Number).filter((n) => n > 0);

async function measured() {
  const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, ""), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  const r = await fetch(`${url}/rest/v1/blocky_worlds_jobs?select=run_id,role,idx,attempt,state,from_frame,to_frame,dispatched_at,started_at,finished_at,output&state=eq.done&order=finished_at.desc&limit=120`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`jobs: ${r.status}`);
  return measureDurations(await r.json());
}

const dur = args.includes("--defaults") ? { ...DURATIONS, samples: null } : await measured().catch((e) => { console.error(`(measured durations unavailable: ${e.message}; using the defaults)`); return { ...DURATIONS, samples: null }; });
const cfg = { ...RENDER, workers };
const frames = Math.round(lenS * 24 * 1.03);
const rows = [];
for (const n of counts) {
  const now = waitTable({ customers: n, frames, cfg, dur, mode: "fixed", spreadS });
  const neu = waitTable({ customers: n, frames, cfg, dur, mode: "queue", spreadS });
  rows.push({ customers: n, now, new: neu });
}
if (args.includes("--json")) { console.log(JSON.stringify({ lenS, frames, workers, spreadS, dur, rows: rows.map((r) => ({ customers: r.customers, now: { ...r.now, runs: undefined }, new: { ...r.new, runs: undefined } })) }, null, 1)); process.exit(0); }

const mmss = (s) => (s == null ? "  -  " : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
console.log(`${lenS} s videos (${frames} frames), ${workers} workers, customers ${spreadS ? `${spreadS} s apart` : "at the same moment"}`);
console.log(`durations: prepare ${dur.prepareS} s (chunks start ${dur.planTailS} s before its end), chunk ${dur.chunkOverheadS} s + ${dur.chunkSPerFrame} s a frame, finish ${dur.finishS} s, cold start ${dur.coldS} s, warm ${dur.warmS} s${dur.samples ? `  [samples: ${JSON.stringify(dur.samples)}]` : "  [defaults]"}`);
console.log("");
console.log("customers |        NOW (fixed chunks, all sent at once)        |        NEW (shared line + queue-aware chunks)");
console.log("          | chunks  first  median  last   timeouts  failed    | chunks  first  median  last   timeouts  failed");
for (const r of rows) {
  const c = (w) => `${String(w.chunks.join("/")).padEnd(6)}  ${mmss(w.first).padStart(5)}  ${mmss(w.median).padStart(6)}  ${mmss(w.last).padStart(5)}  ${String(w.queueTimeouts).padStart(8)}  ${String(w.failed).padStart(6)}`;
  console.log(`${String(r.customers).padStart(9)} | ${c(r.now)}    | ${c(r.new)}`);
}
console.log("\n(time from Generate to the finished video, m:ss; timeouts = pieces that waited in RunPod's queue over 4 min and were cancelled + sent again)");
