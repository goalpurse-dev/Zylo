// M3 STAGING: render a finished M2 run on the RunPod staging endpoint, with the Fly CPU fallback.
//  1. upload the voice and the job (layout, words, signed upload URLs) to a private test folder in storage
//  2. RunPod: /run, then /status every 5 s. FAILED: retried once (a NO_GPU failure goes straight to the fallback).
//     Still waiting in the queue after --gpu-wait s (no GPU free, the endpoint down): cancelled, then the fallback.
//  3. the fallback: one Fly machine on the staging app (same image, mode "cpu": SwiftShader), auto-destroyed;
//     it uploads its report when done. A second failure there is recorded as the outcome (refunds are M4).
//  4. the results are downloaded, every paid second is logged (label "M3 staging ..."), the test folder is deleted.
//   node m3/dispatch.mjs --run RUNDIR --out DIR [--secs N] [--gpu-wait 300] [--bad-input] [--fly-cpus 8] [--log FILE]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const runDir = arg("run"), out = arg("out"), secs = arg("secs", null), gpuWait = Number(arg("gpu-wait", 300)), bad = argv.includes("--bad-input");
const flyCpus = Number(arg("fly-cpus", 8)), LOG = arg("log", "C:/Users/Public/Zylo/research/seamless-niche/work/m2spend.jsonl");
const S = JSON.parse(fs.readFileSync(path.join(here, "staging.json"), "utf8"));
// --endpoint ID: another endpoint (a test points it at one that does not exist, to see the fallback when RunPod is down)
if (argv.includes("--endpoint")) S.endpointId = arg("endpoint");
const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
// prices: the RunPod serverless 24 GB tier (L4 / A5000 / 3090) per second; Fly performance CPUs per second (list price)
export const RATE = { runpod: 0.58 / 3600, // the 16 GB tier (A4000, RTX 4000 Ada, A4500, RTX 2000 Ada)
  fly: { 8: 0.0000957, 16: 0.0001914 } };
fs.mkdirSync(out, { recursive: true });
const note = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(line); fs.appendFileSync(path.join(out, "dispatch.log"), line + "\n"); };
const spend = (label, usd, extra = {}) => fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), label: `M3 staging ${label}`, model: extra.model ?? "render", status: 200, costUsd: +usd.toFixed(5), ...extra }) + "\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- storage (bucket generated, private test folder) ----------
const BUCKET = "generated", prefix = `cutaway-test/m3/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const sb = (p, init = {}) => fetch(`${env.SUPABASE_URL}/storage/v1${p}`, { ...init, headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, ...(init.headers ?? {}) } });
async function put(name, body, type) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "true" }, body }); if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${await r.text()}`); }
async function signGet(name) { const r = await sb(`/object/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 7200 }) }); const j = await r.json(); if (!r.ok) throw new Error(`sign ${name}`); return `${env.SUPABASE_URL}/storage/v1${j.signedURL}`; }
async function signPut(name) { const r = await sb(`/object/upload/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: "{}" }); const j = await r.json(); if (!r.ok) throw new Error(`sign upload ${name}`); return `${env.SUPABASE_URL}/storage/v1${j.url}`; }
async function fetchOut(name) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(path.join(out, name), b); return b; }
async function cleanup() {
  const list = await (await sb(`/object/list/${BUCKET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: `${prefix}/`, limit: 1000 }) })).json();
  const files = (Array.isArray(list) ? list : []).map((f) => `${prefix}/${f.name}`).filter((f) => f.startsWith("cutaway-test/m3/"));
  if (files.length) { const r = await sb(`/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: files }) }); note(`deleted ${files.length} test files (${r.status})`); }
}

// one job file per attempt (fresh upload URLs; the fallback's mode is "cpu")
async function makeJob(tag, mode) {
  const L = JSON.parse(fs.readFileSync(path.join(runDir, "layout.json"), "utf8"));
  const words = JSON.parse(fs.readFileSync(path.join(runDir, "voice", "voice.words.json"), "utf8"));
  const job = { mode, layout: bad ? { key: L.key, parts: "broken" } : L, words, roles: L.roles, voiceUrl: await signGet("voice.mp3"), secs: secs == null ? null : Number(secs),
    uploads: { final: await signPut(`${tag}_final.mp4`), web: await signPut(`${tag}_web.mp4`), report: await signPut(`${tag}_report.json`) } };
  await put(`${tag}_job.json`, JSON.stringify(job), "application/json");
  return signGet(`${tag}_job.json`);
}

// ---------- RunPod ----------
const rp = async (p, init = {}) => { const r = await fetch(`https://api.runpod.ai/v2/${S.endpointId}${p}`, { ...init, headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}`, "Content-Type": "application/json" } }); return r.json(); };
async function onRunpod(tag) {
  const jobUrl = await makeJob(tag, "gpu"), t0 = Date.now();
  const sub = await rp("/run", { method: "POST", body: JSON.stringify({ input: { jobUrl } }) });
  // RunPod refusing the job (the endpoint down or gone) counts as no GPU: the fallback takes it
  if (!sub.id) return { outcome: "no_gpu", error: `submit refused: ${JSON.stringify(sub).slice(0, 300)}` };
  note(`runpod ${tag}: job ${sub.id}`);
  let st = sub, inQueueSince = Date.now(), last = "";
  for (;;) {
    await wait(5000);
    st = await rp(`/status/${sub.id}`);
    if (st.status !== last) { note(`runpod ${tag}: ${st.status}`); last = st.status; }
    if (st.status !== "IN_QUEUE") inQueueSince = Infinity;
    if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) break;
    if (st.status === "IN_QUEUE" && Date.now() - inQueueSince > gpuWait * 1000) { await rp(`/cancel/${sub.id}`, { method: "POST" }); note(`runpod ${tag}: still queued after ${gpuWait} s, cancelled`); return { outcome: "no_gpu_in_time", waitedS: gpuWait }; }
    if (Date.now() - t0 > 20 * 60_000) { await rp(`/cancel/${sub.id}`, { method: "POST" }); return { outcome: "timeout" }; }
  }
  // billed from the worker's start (cold start included) to its stop: delayTime holds the queue wait and the cold start
  const billedS = ((st.executionTime ?? 0) + (st.delayTime ?? 0)) / 1000, usd = billedS * RATE.runpod;
  spend(`RunPod GPU ${tag} (${st.status})`, usd, { model: "runpod-serverless", seconds: +billedS.toFixed(1), delayMs: st.delayTime, executionMs: st.executionTime });
  const output = st.output ?? null;
  if (st.status === "COMPLETED") return { outcome: "done", host: "runpod", output, delayMs: st.delayTime, executionMs: st.executionTime, usd };
  const err = String(st.error ?? JSON.stringify(output ?? "")).slice(0, 800);
  return { outcome: /NO_GPU/.test(err) ? "no_gpu" : "failed", error: err, delayMs: st.delayTime, executionMs: st.executionTime, usd };
}

// ---------- Fly CPU fallback ----------
const fly = async (p, init = {}) => { const r = await fetch(`https://api.machines.dev/v1/apps/${S.app}${p}`, { ...init, headers: { Authorization: env.FLY_CUTAWAY_STAGING_TOKEN, "Content-Type": "application/json" } }); const t = await r.text(); try { return { ok: r.ok, status: r.status, j: JSON.parse(t) }; } catch { return { ok: r.ok, status: r.status, j: t }; } };
async function onFly(tag) {
  const jobUrl = await makeJob(tag, "cpu"), t0 = Date.now();
  const m = await fly("/machines", { method: "POST", body: JSON.stringify({ region: "fra", config: { image: S.image, guest: { cpu_kind: "performance", cpus: flyCpus, memory_mb: flyCpus * 2048 }, auto_destroy: true, restart: { policy: "no" }, env: { JOB_URL: jobUrl }, init: { cmd: ["node", "/app/wt/scripts/cutaway/proto3d/m3/worker.mjs"] } } }) });
  if (!m.ok) return { outcome: "fly_start_failed", detail: JSON.stringify(m.j).slice(0, 400) };
  const id = m.j.id; note(`fly ${tag}: machine ${id} (performance-${flyCpus}x)`);
  let report = null;
  for (;;) {
    await wait(10000);
    const b = await fetchOut(`${tag}_report.json`); if (b) { report = JSON.parse(String(b)); break; }
    const s = await fly(`/machines/${id}`);
    if (s.status === 404 || ["destroyed", "stopped", "failed"].includes(s.j?.state)) { note(`fly ${tag}: machine ${s.j?.state ?? "gone"} without a report`); break; }
    if (Date.now() - t0 > 25 * 60_000) { note(`fly ${tag}: time limit`); break; }
  }
  await fly(`/machines/${id}?force=true`, { method: "DELETE" });
  const s = (Date.now() - t0) / 1000, usd = s * (RATE.fly[flyCpus] ?? RATE.fly[8] * (flyCpus / 8));
  spend(`Fly CPU fallback ${tag}`, usd, { model: `fly-performance-${flyCpus}x`, seconds: +s.toFixed(1) });
  return report?.ok ? { outcome: "done", host: "fly", output: report, usd } : { outcome: "failed", host: "fly", error: report?.error ?? "no report", usd };
}

// ---------- the dispatch ----------
const t0 = Date.now(), attempts = [];
let result = null;
try {
  await put("voice.mp3", fs.readFileSync(path.join(runDir, "voice", "voice.mp3")), "audio/mpeg");
  for (const tag of ["gpu1", "gpu2"]) {
    const a = await onRunpod(tag); attempts.push({ tag, ...a, output: undefined }); result = a;
    // a NO_GPU worker (a graphics-less GPU slice) is retried once on RunPod too: another worker usually has the GPU
    if (a.outcome === "done" || a.outcome === "no_gpu_in_time" || (a.outcome === "no_gpu" && tag === "gpu2")) break;
    note(`runpod ${tag}: ${a.outcome}${a.error ? ` (${a.error.slice(0, 200)})` : ""}${tag === "gpu1" ? ", retrying once" : ""}`);
  }
  // staging guard: one CPU machine takes 2+ hours on a whole video (production splits it over 10 machines, not built here),
  // so a full-length fallback runs only with --allow-full-cpu
  if ((result.outcome === "no_gpu" || result.outcome === "no_gpu_in_time") && secs == null && !argv.includes("--allow-full-cpu")) { note("fallback skipped: a whole video on one CPU machine (use --secs or --allow-full-cpu)"); result = { ...result, outcome: `${result.outcome} (fallback skipped)` }; }
  else if (result.outcome === "no_gpu" || result.outcome === "no_gpu_in_time") {
    note("falling back to the Fly CPU render");
    for (const tag of ["cpu1", "cpu2"]) { const a = await onFly(tag); attempts.push({ tag, ...a, output: undefined }); result = a; if (a.outcome === "done") break; note(`fly ${tag}: ${a.outcome}${tag === "cpu1" ? ", retrying once" : ""}`); }
  }
  if (result.outcome === "done") {
    const tag = attempts.at(-1).tag;
    for (const f of [`${tag}_final.mp4`, `${tag}_web.mp4`]) await fetchOut(f);
  }
} finally {
  await cleanup().catch((e) => note("cleanup failed:", e.message));
}
const summary = { run: path.basename(runDir), outcome: result?.outcome === "done" ? "done" : "failed (would be refunded in M4)", host: result?.host ?? null, attempts, worker: result?.output ?? null, seconds: +((Date.now() - t0) / 1000).toFixed(1), usd: +attempts.reduce((s, a) => s + (a.usd ?? 0), 0).toFixed(4) };
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
