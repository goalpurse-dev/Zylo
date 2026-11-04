// Blocky Worlds: render one video on RunPod in K parallel chunks. PREPARED ONLY — DO NOT RUN without the owner's go
// (it spends money on RunPod and writes to Supabase storage). Without --yes it only prints the plan and the estimate.
//  1. reads a finished local run (make.mjs output: timeline.json, mix.m4a), splits its frames into K ranges
//  2. uploads the timeline to a private test folder in storage, signs one upload URL per chunk (+ a report each)
//  3. submits K RunPod jobs at once (/run), polls /status every 5 s; a FAILED chunk is retried once (NO_GPU too)
//  4. downloads the chunks, joins them by stream copy (render.mjs concat), muxes the local mix -> <out>/final.mp4
//  5. logs every billed second (delayTime + executionTime) and deletes the test folder
//   node runpod/dispatch.mjs --run out/example --out out/example/runpod [--chunks 4] [--pages 1] [--yes]
// Keys (read from C:\Users\Public\Zylo\.env.local only when run with --yes, never printed): RUNPOD_API_KEY,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. The endpoint id: runpod/endpoint.json { endpointId } (made at setup time).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { concat, frameCount } from "../render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const runDir = arg("run"), out = arg("out"), K = Number(arg("chunks", 4)), pages = Number(arg("pages", 1)), GO = argv.includes("--yes");
if (!runDir || !out) { console.error("usage: node runpod/dispatch.mjs --run <make.mjs out dir> --out <dir> [--chunks K] [--pages P] [--yes]"); process.exit(2); }
// the 16 GB tier (RTX A4000 / 4000 Ada / A4500 / 2000 Ada), per second, as Cutaway's m3/dispatch.mjs
export const RATE = 0.58 / 3600;
// estimates (README.md): seconds per frame on that tier, cold start + page load per chunk
export const EST = { sPerFrame: 0.08, coldS: 15, loadS: 10 };

const tl = JSON.parse(fs.readFileSync(path.join(runDir, "timeline.json"), "utf8")), N = frameCount(tl);
const ranges = Array.from({ length: K }, (_, i) => [Math.round((N * i) / K), Math.round((N * (i + 1)) / K)]);
const billed = N * EST.sPerFrame + K * (EST.coldS + EST.loadS);
console.log(`plan: ${N} frames (${tl.duration} s at ${tl.fps} fps) in ${K} chunks of ~${Math.round(N / K)} frames, ${pages} page(s) each`);
console.log(`estimate: ~${billed.toFixed(0)} GPU-seconds billed, ~$${(billed * RATE).toFixed(3)}; wall ~${(N * EST.sPerFrame / K + EST.coldS + EST.loadS).toFixed(0)} s`);
if (!GO) { console.log("dry run: nothing sent (add --yes after the owner's go)"); process.exit(0); }

const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const EP = JSON.parse(fs.readFileSync(path.join(here, "endpoint.json"), "utf8")).endpointId;
for (const k of ["RUNPOD_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!env[k]) throw new Error(`missing ${k} in .env.local`);
fs.mkdirSync(out, { recursive: true });
const note = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(line); fs.appendFileSync(path.join(out, "dispatch.log"), line + "\n"); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- storage (bucket generated, private test folder) ----------
const BUCKET = "generated", prefix = `blocky-worlds-test/render/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const sb = (p, init = {}) => fetch(`${env.SUPABASE_URL}/storage/v1${p}`, { ...init, headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, ...(init.headers ?? {}) } });
async function put(name, body, type) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "true" }, body }); if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${await r.text()}`); }
async function signGet(name) { const r = await sb(`/object/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 7200 }) }); const j = await r.json(); if (!r.ok) throw new Error(`sign ${name}`); return `${env.SUPABASE_URL}/storage/v1${j.signedURL}`; }
async function signPut(name) { const r = await sb(`/object/upload/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: "{}" }); const j = await r.json(); if (!r.ok) throw new Error(`sign upload ${name}`); return `${env.SUPABASE_URL}/storage/v1${j.url}`; }
async function fetchOut(name) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(path.join(out, name), b); return b; }
async function cleanup() {
  const list = await (await sb(`/object/list/${BUCKET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: `${prefix}/`, limit: 1000 }) })).json();
  const files = (Array.isArray(list) ? list : []).map((f) => `${prefix}/${f.name}`).filter((f) => f.startsWith("blocky-worlds-test/"));
  if (files.length) { const r = await sb(`/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: files }) }); note(`deleted ${files.length} test files (${r.status})`); }
}

// ---------- RunPod ----------
const rp = async (p, init = {}) => (await fetch(`https://api.runpod.ai/v2/${EP}${p}`, { ...init, headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}`, "Content-Type": "application/json" } })).json();
async function chunk(i, timelineUrl, attempt) {
  const tag = `c${String(i).padStart(2, "0")}_${attempt}`;
  const job = { mode: "gpu", timelineUrl, pages, ranges: [{ from: ranges[i][0], to: ranges[i][1], upload: await signPut(`${tag}.mp4`) }], uploads: { report: await signPut(`${tag}_report.json`) } };
  const sub = await rp("/run", { method: "POST", body: JSON.stringify({ input: job }) });
  if (!sub.id) return { i, tag, outcome: "refused", error: JSON.stringify(sub).slice(0, 300), usd: 0 };
  note(`chunk ${i}: job ${sub.id} (frames ${ranges[i][0]}-${ranges[i][1]})`);
  const t0 = Date.now(); let st;
  for (;;) {
    await wait(5000);
    st = await rp(`/status/${sub.id}`);
    if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) break;
    if (Date.now() - t0 > 20 * 60_000) { await rp(`/cancel/${sub.id}`, { method: "POST" }); st = { status: "TIMED_OUT" }; break; }
  }
  const s = ((st.executionTime ?? 0) + (st.delayTime ?? 0)) / 1000, usd = s * RATE;
  fs.appendFileSync(path.join(out, "spend.jsonl"), JSON.stringify({ at: new Date().toISOString(), label: `Blocky Worlds render chunk ${tag} (${st.status})`, seconds: +s.toFixed(1), costUsd: +usd.toFixed(5) }) + "\n");
  return { i, tag, outcome: st.status === "COMPLETED" ? "done" : "failed", error: st.status === "COMPLETED" ? null : String(st.error ?? "").slice(0, 400), output: st.output, seconds: s, usd };
}

const t0 = Date.now(), results = [];
try {
  await put("timeline.json", fs.readFileSync(path.join(runDir, "timeline.json")), "application/json");
  const timelineUrl = await signGet("timeline.json");
  const first = await Promise.all(ranges.map((_, i) => chunk(i, timelineUrl, 1)));
  for (const r of first) {
    if (r.outcome === "done") { results[r.i] = r; continue; }
    note(`chunk ${r.i}: ${r.outcome} ${r.error ?? ""}, retrying once`);
    results[r.i] = await chunk(r.i, timelineUrl, 2);
  }
  const bad = results.filter((r) => r.outcome !== "done");
  if (bad.length) throw new Error(`chunks failed: ${bad.map((r) => `${r.i} (${r.error})`).join("; ")}`);
  const files = [];
  for (const r of results) { if (!(await fetchOut(`${r.tag}.mp4`))) throw new Error(`chunk ${r.i}: no mp4`); files.push(path.join(out, `${r.tag}.mp4`)); }
  const silent = path.join(out, "silent.mp4"), final = path.join(out, "final.mp4");
  await concat(files, silent);
  const p = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", path.join(runDir, "mix.m4a"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { encoding: "utf8" });
  if (p.status !== 0) throw new Error(`mux failed: ${p.stderr.slice(-300)}`);
  note(`final: ${final}`);
} finally {
  await cleanup().catch((e) => note("cleanup failed:", e.message));
  const usd = results.reduce((s, r) => s + (r?.usd ?? 0), 0);
  const summary = { chunks: K, pages, frames: N, wallS: +((Date.now() - t0) / 1000).toFixed(1), usd: +usd.toFixed(4), results: results.map((r) => r && { i: r.i, outcome: r.outcome, seconds: r.seconds, worker: r.output }) };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary));
}
