// Blender kit engine (phase 1): the laptop's side. Sends jobs to the "zyvo-blender-kit" RunPod endpoint (endpoint.json),
// moves files through a private test folder in storage (bucket "generated", blocky-worlds-test/blender-kit/<ts>/,
// deleted at the end), keeps a spend ledger and refuses to start anything whose worst case would pass the cap.
//   node dispatch.mjs --probe  --out <dir> [--shot 1] [--diag-root] [--yes]
//   node dispatch.mjs --render --out <dir> [--chunks 6] [--s-per-frame 2] [--no-music] [--yes]
//   (--resume: the same --out again; chunks already rendered are not sent again)
// Without --yes it prints the plan and the estimate only. --ledger <file> (default <out>/../spend.jsonl), --cap 3.00.
// No paid retry of the same failure: a failed chunk stops the run (queued chunks are cancelled); only NO_GPU (a worker
// without graphics, which retires itself) is sent once more. A chunk running past its time limit is cancelled.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { shotFrames, splitShots } from "./plan.mjs";
import { storage, loadEnv } from "../engine/runpod/client.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const GO = has("yes"), OUT = arg("out"), SLUG = arg("video", "sneeze_teleport");
const KIT = path.resolve(arg("kit", path.join(repo, "reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit")));
const CAP = Number(arg("cap", 3.0));
// RunPod serverless 16 GB tier (RTX 4000 Ada / A4500 / A4000 / 2000 Ada), per second (as engine/runpod/client.mjs RATE)
export const RATE = 0.58 / 3600;
if (!OUT || !(has("probe") || has("render"))) { console.error("usage: node dispatch.mjs --probe|--render --out <dir> [--yes]"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const LEDGER = path.resolve(arg("ledger", path.join(OUT, "..", "spend.jsonl")));
const note = (...a) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${a.join(" ")}`; console.log(l); fs.appendFileSync(path.join(OUT, "dispatch.log"), l + "\n"); };
const spent = () => (fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd ?? 0), 0) : 0);
const book = (label, seconds, extra = {}) => fs.appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), label, seconds: +seconds.toFixed(1), usd: +(seconds * RATE).toFixed(5), ...extra }) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the video's shots (from the kit's own shots.py + words.json) ----------
const vdir = path.join(KIT, "engine", "videos", SLUG);
const shots = shotFrames(fs.readFileSync(path.join(vdir, "shots.py"), "utf8"), JSON.parse(fs.readFileSync(path.join(vdir, "audio", "words.json"), "utf8")));
const FRAMES = shots[shots.length - 1].f1;

// ---------- RunPod ----------
const ep = JSON.parse(fs.readFileSync(path.join(here, "endpoint.json"), "utf8"));
let env = null;
const keys = () => (env ??= loadEnv());
const rp = async (p, init = {}) => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`https://api.runpod.ai/v2/${ep.endpointId}${p}`, { ...init, headers: { Authorization: `Bearer ${keys().RUNPOD_API_KEY}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000) });
      const t = await r.text(); try { return JSON.parse(t); } catch { return { error: t.slice(0, 300), httpStatus: r.status }; }
    } catch (e) { if (i >= 4) throw e; await sleep(3000 * (i + 1)); }
  }
};
const balance = async () => {
  try {
    const r = await fetch("https://api.runpod.io/graphql", { method: "POST", headers: { Authorization: `Bearer ${keys().RUNPOD_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "query { myself { clientBalance currentSpendPerHr } }" }) });
    return (await r.json())?.data?.myself ?? null;
  } catch { return null; }
};
const workersSeen = new Map(); // workerId -> first job's delay (its boot, billed)

/** one job: submit, poll; the time limit counts from IN_PROGRESS (a queued job waits for free); books its seconds */
async function job(label, input, maxRunSec) {
  const sub = await rp("/run", { method: "POST", body: JSON.stringify({ input }) });
  if (!sub.id) throw new Error(`${label}: RunPod refused the job: ${JSON.stringify(sub).slice(0, 300)}`);
  note(`${label}: job ${sub.id} sent`);
  let started = null, st;
  for (;;) {
    await sleep(5000);
    st = await rp(`/status/${sub.id}`);
    if (st.status === "IN_PROGRESS" && !started) { started = Date.now(); note(`${label}: running${st.workerId ? ` on worker ${st.workerId}` : ""}`); }
    if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) break;
    if (started && Date.now() - started > maxRunSec * 1000) {
      await rp(`/cancel/${sub.id}`, { method: "POST" });
      note(`${label}: over ${maxRunSec} s running: cancelled`);
      st = { ...st, status: "TIMED_OUT", executionTime: maxRunSec * 1000 };
      break;
    }
  }
  const exec = (st.executionTime ?? 0) / 1000, delay = (st.delayTime ?? 0) / 1000;
  // billed: the run itself, plus a new worker's boot (its first job's delay, capped: a queued job's delay is mostly waiting)
  let boot = 0;
  const wid = st.workerId ?? `unknown-${sub.id}`;
  if (!workersSeen.has(wid)) { boot = Math.min(delay, 90) + 5; workersSeen.set(wid, boot); }
  book(`${label} (${st.status})`, exec + boot, { job: sub.id, worker: st.workerId ?? null, execS: +exec.toFixed(1), delayS: +delay.toFixed(1), bootS: +boot.toFixed(1) });
  const out = st.output ?? {};
  const ok = st.status === "COMPLETED" && out.ok !== false;
  return { ok, id: sub.id, status: st.status, output: out, execS: exec, delayS: delay, bootS: boot, worker: st.workerId ?? null, error: ok ? null : (out.error ?? st.error ?? st.status) };
}

const store = () => storage(keys(), STATE.prefix);
const statePath = path.join(OUT, "state.json");
const STATE = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { prefix: `blocky-worlds-test/blender-kit/${new Date().toISOString().replace(/[:.]/g, "-")}`, chunks: {} };
const save = () => fs.writeFileSync(statePath, JSON.stringify(STATE, null, 1));
const signPuts = async (name, n) => Promise.all(Array.from({ length: n }, (_, i) => store().signPut(`${name}.part${i}`)));
async function fetchParts(name, parts, dest) {
  const bufs = [];
  for (let i = 0; i < parts; i++) { const b = await store().get(`${name}.part${i}`); if (!b) throw new Error(`download ${name}.part${i} failed`); bufs.push(b); }
  fs.writeFileSync(dest, Buffer.concat(bufs));
  return fs.statSync(dest).size;
}

// ================= probe =================
if (has("probe")) {
  const shot = Number(arg("shot", 1)), s = shots.find((x) => x.id === shot);
  const estS = 90 + 6 * 25 + s.n * 3; // cold start + up to 6 GPU checks (3 sandboxed, 3 not) + the shot at a pessimistic 3 s/frame
  const worst = 1800 * RATE + 95 * RATE;
  console.log(`probe: GPU modes egl / vgl / vulkan${has("diag-root") ? " (+ unsandboxed)" : ""}, then shot ${shot} (${s.n} frames) at full quality`);
  console.log(`estimate ~${estS} s = ~$${(estS * RATE).toFixed(3)}; worst case (30 min limit) $${worst.toFixed(3)}; spent so far $${spent().toFixed(3)} of $${CAP.toFixed(2)}`);
  if (spent() + worst > CAP) throw new Error("the worst case would pass the cap");
  if (!GO) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
  const b0 = await balance();
  const frameUpload = await store().signPut("probe_frame.png");
  const r = await job("probe", { role: "probe", slug: SLUG, shot, diagRoot: has("diag-root"), frameUpload }, 1800);
  fs.writeFileSync(path.join(OUT, "probe.json"), JSON.stringify(r, null, 1));
  if (r.output?.shot?.frameUploaded) { const b = await store().get("probe_frame.png"); if (b) fs.writeFileSync(path.join(OUT, "probe_frame.png"), b); }
  await store().cleanup().catch(() => {});
  const b1 = await balance();
  note(`probe ${r.status}: exec ${r.execS.toFixed(1)} s, delay ${r.delayS.toFixed(1)} s; ledger total $${spent().toFixed(4)}; RunPod balance ${b0?.clientBalance} -> ${b1?.clientBalance} (whole account)`);
  console.log(JSON.stringify({ picked: r.output?.picked, sandbox: r.output?.sandbox?.name, network: r.output?.sandbox?.network, shot: r.output?.shot && { wallS: r.output.shot.wallS, frames: r.output.shot.frames, sPerFrame: r.output.shot.sPerFrame, gpuWatch: r.output.shot.gpuWatch }, error: r.error }, null, 1));
  process.exit(r.ok ? 0 : 1);
}

// ================= render + finish =================
const K = Number(arg("chunks", 6)), SPF = Number(arg("s-per-frame", 2)), MUSIC = !has("no-music");
const groups = splitShots(shots, K);
const chunkEst = (g) => g.n * SPF + 25 + g.ids.length * 2 + 60; // render + gpu check + per-shot scene build + encode/upload
const chunkMax = (g) => Math.round(chunkEst(g) * 2.5 + 300);
const FINISH_MAX = 1800, finishEst = 420;
const todo = groups.map((g, i) => ({ i, ...g })).filter((g) => !STATE.chunks[g.i]?.done);
const estS = groups.reduce((s, g) => s + chunkEst(g), 0) + Math.min(K, ep.workersMax) * 95 + finishEst;
const worst = todo.reduce((s, g) => s + chunkMax(g), 0) * RATE + (FINISH_MAX + Math.min(K, ep.workersMax) * 95) * RATE;
console.log(`plan: ${SLUG}, ${shots.length} shots, ${FRAMES} frames (${(FRAMES / 30).toFixed(1)} s) in ${K} chunks on ${ep.workersMax} workers: ${groups.map((g) => `${g.shots}:${g.n}`).join(" ")}`);
console.log(`estimate at ${SPF} s/frame: ~${estS.toFixed(0)} GPU-s = ~$${(estS * RATE).toFixed(3)}, wall ~${((FRAMES * SPF) / Math.min(K, ep.workersMax) / 60 + 10).toFixed(0)} min; worst case $${worst.toFixed(3)}; spent so far $${spent().toFixed(3)} of $${CAP.toFixed(2)}${todo.length < K ? `; resuming: ${K - todo.length} chunks already done` : ""}`);
if (spent() + worst > CAP) throw new Error(`the worst case ($${worst.toFixed(2)}) + spent ($${spent().toFixed(2)}) would pass the cap $${CAP}: lower --chunks risk or ask`);
if (!GO) { console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
if (STATE.chunks && Object.keys(STATE.chunks).length && STATE.K && STATE.K !== K) throw new Error(`this out dir was split in ${STATE.K} chunks; use --chunks ${STATE.K} or a new --out`);
STATE.K = K; save();

const b0 = await balance(), t0 = Date.now();
note(`render start; RunPod balance ${b0?.clientBalance} (whole account)`);
let stop = false;
const results = await Promise.all(todo.map(async (g) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (stop) return { i: g.i, ok: false, error: "stopped: another chunk failed" };
    const name = `seg${String(g.i).padStart(2, "0")}_${attempt}`;
    const input = { role: "render", slug: SLUG, shots: g.shots, f0: g.f0, f1: g.f1, upload: await signPuts(`${name}.mp4`, 4) };
    const r = await job(`chunk ${g.i} (shots ${g.shots}, ${g.n} frames)`, input, chunkMax(g));
    if (r.ok) {
      STATE.chunks[g.i] = { done: true, name: `${name}.mp4`, parts: r.output.upload.parts, job: r.id, worker: r.worker, execS: r.execS, bootS: r.bootS, out: r.output };
      save();
      note(`chunk ${g.i} done: ${r.output.frames} frames in ${r.output.renderS} s (${r.output.sPerFrame} s/frame), encode ${r.output.encodeS} s, ${(r.output.upload.bytes / 1e6).toFixed(1)} MB, GPU ${r.output.gpu?.renderer ?? "?"} via ${r.output.gpu?.mode}, util ${r.output.gpuWatch?.utilMeanPct}%`);
      return { i: g.i, ok: true };
    }
    note(`chunk ${g.i} FAILED (${r.status}): ${String(r.error).slice(0, 600)}`);
    if (r.output?.code !== "NO_GPU" || attempt === 2) {
      stop = true;
      return { i: g.i, ok: false, error: r.error };
    }
    note(`chunk ${g.i}: a worker without graphics (retired itself): sent once more`);
  }
}));
const bad = results.filter((r) => !r.ok);
if (bad.length) {
  note(`stopped: ${bad.length} chunk(s) not rendered; segments kept in storage (${STATE.prefix}) for a resume; ledger $${spent().toFixed(4)}`);
  process.exit(1);
}
const renderWall = (Date.now() - t0) / 1000;
note(`all ${K} chunks rendered (wall ${renderWall.toFixed(0)} s for this run)`);

// finish: the segments in order -> the kit's finish.py on a worker
const segments = [];
for (let i = 0; i < K; i++) { const c = STATE.chunks[i]; segments.push(await Promise.all(Array.from({ length: c.parts }, (_, p) => store().signGet(`${c.name}.part${p}`, 7200)))); }
const uploads = { "final.mp4": await signPuts("final.mp4", 4), "final_nocaptions.mp4": await signPuts("final_nocaptions.mp4", 4), "final_phone.mp4": await signPuts("final_phone.mp4", 2) };
const tf = Date.now();
const f = await job("finish", { role: "finish", slug: SLUG, frames: FRAMES, segments, uploads, music: MUSIC }, FINISH_MAX);
fs.writeFileSync(path.join(OUT, "finish.json"), JSON.stringify(f, null, 1));
if (!f.ok) { note(`finish FAILED: ${String(f.error).slice(0, 800)}; segments kept in storage for a resume`); process.exit(1); }
for (const [name, u] of Object.entries(f.output.uploads)) note(`${name}: ${(await fetchParts(name, u.parts, path.join(OUT, name)) / 1e6).toFixed(1)} MB`);
const wallS = (Date.now() - t0) / 1000;
const n = await store().cleanup().catch((e) => note("cleanup failed:", e.message));
note(`storage test folder deleted (${n} files)`);

// contact sheet: one frame per second of the real final encode, labelled
const sheet = path.join(OUT, "contact.jpg");
const c = spawnSync("python", [path.join(here, "contact.py"), path.join(OUT, "final.mp4"), sheet], { encoding: "utf8" });
note(c.status === 0 ? `contact sheet: ${sheet}` : `contact sheet failed: ${c.stderr.slice(-300)}`);

const b1 = await balance();
const chunksOut = Object.values(STATE.chunks).map((x) => x.out);
const gpuS = Object.values(STATE.chunks).reduce((s, x) => s + x.execS + (x.bootS ?? 0), 0) + f.execS + f.bootS;
const summary = {
  video: SLUG, frames: FRAMES, seconds: +(FRAMES / 30).toFixed(2), chunks: K, workers: ep.workersMax,
  wallS: +wallS.toFixed(0), renderWallS: +renderWall.toFixed(0), finishWallS: +((Date.now() - tf) / 1000).toFixed(0),
  renderS: +chunksOut.reduce((s, x) => s + x.renderS, 0).toFixed(1), sPerFrame: +(chunksOut.reduce((s, x) => s + x.renderS, 0) / FRAMES).toFixed(3),
  billedGpuS: +gpuS.toFixed(0), usd: +(gpuS * RATE).toFixed(4), ledgerTotalUsd: +spent().toFixed(4),
  balance: { before: b0?.clientBalance, after: b1?.clientBalance, note: "whole account (Cutaway's live jobs too)" },
  gpus: [...new Set(chunksOut.map((x) => x.gpu?.renderer))], modes: [...new Set(chunksOut.map((x) => x.gpu?.mode))], sandbox: f.output.sandbox,
  finish: { execS: f.execS, unpackS: f.output.unpackS, finishS: f.output.finishS, duration: f.output.duration },
  outputs: { final: path.join(OUT, "final.mp4"), phone: path.join(OUT, "final_phone.mp4"), noCaptions: path.join(OUT, "final_nocaptions.mp4"), contact: sheet },
};
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
