// M3: one Cutaway render job, on the GPU worker (RunPod serverless) or on the CPU fallback (a Fly machine).
// The job is a JSON file at a signed URL: { mode: "gpu" | "cpu", layout, words, roles, voiceUrl, secs?,
// uploads: { final, web, report } } (signed upload URLs). It checks the GPU (gpu mode: WebGL must report an NVIDIA
// renderer, else the job fails with NO_GPU so the dispatcher falls back), renders and mixes the video with the M2
// pipeline (make.mjs), uploads a 1080p copy and the web copy, and prints `RESULT {...}` (also uploaded as the report).
//   node m3/worker.mjs '{"jobUrl": "https://..."}'      (RunPod: the handler passes the job input)
//   JOB_URL=https://... node m3/worker.mjs               (Fly: the machine's env)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { useGpu, useSoftware } from "./gpu.mjs";
import { makeVideo } from "../m2/make.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WT = process.env.CUTAWAY_WT ?? path.resolve(here, "../../../..");
const PROTO = process.env.CUTAWAY_PROTO ?? "/app/proto", FONTS = process.env.CUTAWAY_FONTS ?? "/app/fonts", FF = process.env.FFMPEG ?? "ffmpeg";
const t0 = Date.now(), timing = {};
const lap = (k, t) => { timing[k] = +((Date.now() - t) / 1000).toFixed(2); };
const input = process.argv[2] ? JSON.parse(process.argv[2]) : process.env.JOB_FILE ? JSON.parse(fs.readFileSync(process.env.JOB_FILE, "utf8")) : { jobUrl: process.env.JOB_URL };

async function get(url, file) { if (url.startsWith("file://")) { const b = fs.readFileSync(fileURLToPath(url)); if (file) fs.writeFileSync(file, b); return b; } const r = await fetch(url); if (!r.ok) throw new Error(`download ${r.status}`); const b = Buffer.from(await r.arrayBuffer()); if (file) fs.writeFileSync(file, b); return b; }
async function put(url, file, type) { const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: fs.readFileSync(file) }); if (!r.ok) throw new Error(`upload ${path.basename(file)} ${r.status} ${(await r.text()).slice(0, 200)}`); }

let job = null, report = null;
try {
  job = input.jobUrl ? JSON.parse(String(await get(input.jobUrl))) : input;
  const mode = job.mode ?? "gpu", dir = fs.mkdtempSync(path.join(os.tmpdir(), "cutaway-"));
  let t = Date.now();
  // the GPU check (gpu.mjs): WebGL on the NVIDIA GPU, else NO_GPU; the CPU fallback renders with SwiftShader
  const renderer = mode === "gpu" ? await useGpu() : useSoftware();
  lap("gpuCheck", t);
  t = Date.now();
  const voice = path.join(dir, "voice.mp3"); await get(job.voiceUrl, voice);
  lap("download", t);
  t = Date.now();
  const r = await makeVideo({ layout: job.layout, voice, words: job.words, out: path.join(dir, "out"), proto: PROTO, ff: FF, roles: job.roles ?? [], secs: job.secs ?? null, wt: WT, fonts: FONTS });
  lap("makeVideo", t); Object.assign(timing, Object.fromEntries(Object.entries(r.timing).map(([k, v]) => [`make_${k}`, v])));
  // the delivered copy: 1080p at a size the test bucket takes (production uses a bucket without the 50 MB limit)
  t = Date.now();
  const final = path.join(dir, "final_1080.mp4");
  // (the test bucket takes 50 MB a file: over 48 MB, the copy is re-encoded a step smaller)
  for (const crf of [job.finalCrf ?? 22, 25, 28]) {
    execFileSync(FF, ["-v", "error", "-y", "-i", r.files.end, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", final]);
    if (fs.statSync(final).size < 48e6) break;
  }
  if (job.uploads?.final) await put(job.uploads.final, final, "video/mp4");
  if (job.uploads?.web) await put(job.uploads.web, r.files.web, "video/mp4");
  lap("upload", t);
  report = { ok: true, mode, renderer, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : process.env.FLY_MACHINE_ID ? `fly ${process.env.FLY_MACHINE_ID}` : os.hostname(), lengthSec: r.marks.lengthEnd, sizes: { final: fs.statSync(final).size, web: fs.statSync(r.files.web).size }, timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
} catch (e) {
  report = { ok: false, code: e.code ?? "RENDER_FAILED", error: String(e.message).slice(0, 1500), timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
}
if (job?.uploads?.report) { const f = path.join(os.tmpdir(), "report.json"); fs.writeFileSync(f, JSON.stringify(report)); await put(job.uploads.report, f, "application/json").catch(() => {}); }
console.log(`RESULT ${JSON.stringify(report)}`);
process.exit(report.ok ? 0 : 1);
