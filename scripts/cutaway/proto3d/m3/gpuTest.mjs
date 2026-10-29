// M3: the one GPU test on RunPod (an NVIDIA L4 pod, Secure Cloud). It uploads the render bundle (the finished car wash
// page) to a private test folder in storage, starts one pod that sets up headless Chrome on the GPU (m3/podSetup.sh),
// checks that WebGL uses the GPU (m3/gpuCheck.mjs), measures the render (m3/podBench.mjs) and uploads the results,
// then DELETES the pod: when the results arrive, on any error, or at the time limit. The cost is logged.
//   node m3/gpuTest.mjs --proto PROTO --key how_a_car_wash_works --length 32.6 --out DIR [--limit-min 25] [--dry]
// Needs RUNPOD_API_KEY in C:/Users/Public/Zylo/.env.local (with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const proto = arg("proto"), key = arg("key"), lengthSec = arg("length"), out = arg("out"), limitMin = Number(arg("limit-min", 25)), dry = argv.includes("--dry"), mode = arg("mode", "bench"), stillTimes = arg("times", "2,8"), gpus = arg("gpus", "NVIDIA L4").split(",");
const LOG = "C:/Users/Public/Zylo/research/seamless-niche/work/m2spend.jsonl";
const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const RP = env.RUNPOD_API_KEY, SB = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!RP && !dry) throw new Error("no RUNPOD_API_KEY in .env.local");
fs.mkdirSync(out, { recursive: true });
const note = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(line); fs.appendFileSync(path.join(out, "controller.log"), line + "\n"); };

// storage: a private test folder (bucket "generated", prefix cutaway-test/gpu/<stamp>/), signed URLs for the pod
const BUCKET = "generated", stamp = new Date().toISOString().replace(/[:.]/g, "-"), prefix = `cutaway-test/gpu/${stamp}`;
const sb = (p, init = {}) => fetch(`${SB}/storage/v1${p}`, { ...init, headers: { Authorization: `Bearer ${SK}`, apikey: SK, ...(init.headers ?? {}) } });
async function put(name, file, type) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "true" }, body: fs.readFileSync(file) }); if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${await r.text()}`); }
async function signGet(name) { const r = await sb(`/object/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) }); const j = await r.json(); if (!r.ok) throw new Error(`sign ${name}: ${JSON.stringify(j)}`); return `${SB}/storage/v1${j.signedURL}`; }
async function signPut(name) { const r = await sb(`/object/upload/sign/${BUCKET}/${prefix}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: "{}" }); const j = await r.json(); if (!r.ok) throw new Error(`sign upload ${name}: ${JSON.stringify(j)}`); return `${SB}/storage/v1${j.url}`; }
async function fetchOut(name) { const r = await sb(`/object/${BUCKET}/${prefix}/${name}`); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(path.join(out, name), b); return b; }

// the bundle: what the page needs to render, plus the pod scripts
const files = ["render.mjs", "package.json", "package-lock.json", "kit", "m2", "m3", "assets", `m2_${key}.html`, `m2_${key}.js`, ...fs.readdirSync(path.join(proto, "m2run")).filter((f) => f.startsWith(`${key}.`)).map((f) => `m2run/${f}`)];
fs.mkdirSync(path.join(proto, "m3"), { recursive: true });
for (const f of fs.readdirSync(here)) if (/\.(mjs|sh)$/.test(f)) fs.copyFileSync(path.join(here, f), path.join(proto, "m3", f));
fs.copyFileSync(path.join(here, "..", "render.mjs"), path.join(proto, "render.mjs"));
const tgz = path.join(out, "bundle.tgz");
execFileSync("tar", ["-czf", tgz.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (m, d) => `/${d.toLowerCase()}`), ...files], { cwd: proto, stdio: "inherit" });
note(`bundle ${(fs.statSync(tgz).size / 1e6).toFixed(1)} MB:`, files.length, "entries");
if (dry) { note("dry run: no upload, no pod"); process.exit(0); }

// storage takes files up to 50 MB: the bundle goes up in 40 MB parts that the pod joins again
const whole = fs.readFileSync(tgz), PART = 40e6, parts = [];
for (let i = 0; i * PART < whole.length; i++) { const f = path.join(out, `bundle.part${i}`); fs.writeFileSync(f, whole.subarray(i * PART, (i + 1) * PART)); await put(`bundle.part${i}`, f, "application/octet-stream"); parts.push(`bundle.part${i}`); }
await put("podSetup.sh", path.join(here, "podSetup.sh"), "text/plain");
const podEnv = {
  NVIDIA_DRIVER_CAPABILITIES: "all", NVIDIA_VISIBLE_DEVICES: "all",
  SETUP_URL: await signGet("podSetup.sh"), BUNDLE_URLS: (await Promise.all(parts.map(signGet))).join(" "),
  UP_LOG: await signPut("setup.log"), UP_CHECK: await signPut("gpucheck.json"), UP_BENCH: await signPut("bench.json"), UP_VIDEO: await signPut("full.mp4"),
  PAGE_KEY: key, LENGTH_SEC: String(lengthSec), MODE: mode, STILL_TIMES: stillTimes,
};
note("uploaded the bundle and the setup script to", `${BUCKET}/${prefix}`);

// the pod
const rp = (p, init = {}) => fetch(`https://rest.runpod.io/v1${p}`, { ...init, headers: { Authorization: `Bearer ${RP}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const created = Date.now();
const res = await rp("/pods", { method: "POST", body: JSON.stringify({ name: "zyvo-cutaway-gpu-test", imageName: "node:22-trixie", computeType: "GPU", cloudType: "SECURE", gpuTypeIds: gpus, gpuCount: 1, containerDiskInGb: 30, volumeInGb: 0, env: podEnv, dockerStartCmd: ["bash", "-c", "curl -fsSL \"$SETUP_URL\" -o /setup.sh && bash /setup.sh"], ports: [], interruptible: false }) });
const pod = await res.json();
fs.writeFileSync(path.join(out, "pod_created.json"), JSON.stringify(pod, null, 1));
if (!res.ok || !pod.id) { note("pod create failed:", res.status, JSON.stringify(pod).slice(0, 400)); process.exit(1); }
const rate = Number(pod.costPerHr ?? pod.adjustedCostPerHr ?? 0.59);
note(`pod ${pod.id} created at $${rate}/h`);
let deleted = false;
async function stop(why) {
  if (deleted) return; deleted = true;
  for (let i = 0; i < 3; i++) { const r = await rp(`/pods/${pod.id}`, { method: "DELETE" }); note(`delete (${why}): ${r.status}`); if (r.ok || r.status === 404) break; }
  const sec = (Date.now() - created) / 1000, usd = +((sec / 3600) * rate).toFixed(4);
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), label: "GPU render test (RunPod L4 pod)", model: "runpod-l4", costUsd: usd, seconds: Math.round(sec), status: 200, ratePerHr: rate }) + "\n");
  note(`pod ran ${sec.toFixed(0)} s, about $${usd}`);
}
process.on("SIGINT", async () => { await stop("interrupted"); process.exit(1); });
try {
  let last = "";
  for (;;) {
    if (Date.now() - created > limitMin * 60_000) { note("time limit"); break; }
    await new Promise((r) => setTimeout(r, 15000));
    const s = await (await rp(`/pods/${pod.id}`)).json().catch(() => ({}));
    const st = `${s.desiredStatus ?? "?"} ${s.lastStatusChange ?? ""}`.trim();
    if (st !== last) { note("pod:", st); last = st; }
    const log = await fetchOut("setup.log");
    if (log) { note("results arrived"); for (const f of ["gpucheck.json", "bench.json", "full.mp4"]) await fetchOut(f);
      if (mode === "stills") fs.renameSync(path.join(out, "full.mp4"), path.join(out, "stills.tgz")); break; }
  }
} catch (e) { note("error:", e.message); }
finally { await stop("finished"); }
