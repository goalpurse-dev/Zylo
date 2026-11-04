// Blocky Worlds RunPod worker: one render job on the GPU (or CPU for tests). Prepared only, never deployed.
// The job (inline, or a JSON file at a signed URL: { jobUrl }):
//   { mode: "gpu" | "cpu",
//     timelineUrl,                                   // the timeline JSON (plan.mjs output)
//     pages: 1,                                      // parallel Chrome pages on this GPU (renderParallel)
//     ranges: [{ from, to, upload }],                // chunk role: frames [from, to) -> an mp4 PUT to `upload`
//     whole: { mixUrl, upload } | null,              // video role: every frame, muxed with the mix, PUT to `upload`
//     uploads: { report } }                          // optional: the RESULT JSON is PUT here too
// GPU mode first checks WebGL is on the NVIDIA GPU (gpu.mjs), else fails with NO_GPU so the dispatcher retries.
// Prints `RESULT {...}` (handler.py returns it).
//   node runpod/worker.mjs '{"jobUrl": "https://..."}'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { useGpu, useSoftware } from "./gpu.mjs";
import { renderParallel } from "../render.mjs";

const FF = process.env.FFMPEG ?? "ffmpeg";
const MAX_UPLOAD = 48 * 1024 * 1024;
// chunk quality: a job may lower it so each chunk fits the storage bucket (50 MB a file)
const t0 = Date.now(), timing = {};
const lap = (k, t) => { timing[k] = +((Date.now() - t) / 1000).toFixed(2); };
const input = process.argv[2] ? JSON.parse(process.argv[2]) : process.env.JOB_FILE ? JSON.parse(fs.readFileSync(process.env.JOB_FILE, "utf8")) : { jobUrl: process.env.JOB_URL };

async function get(url, file) {
  const b = url.startsWith("file://") ? fs.readFileSync(fileURLToPath(url)) : await fetch(url).then(async (r) => { if (!r.ok) throw new Error(`download ${r.status} ${url.split("?")[0]}`); return Buffer.from(await r.arrayBuffer()); });
  if (file) fs.writeFileSync(file, b); return b;
}
async function put(url, file, type) {
  if (url.startsWith("file://")) { fs.copyFileSync(file, fileURLToPath(url)); return; }
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: fs.readFileSync(file) });
  if (!r.ok) throw new Error(`upload ${path.basename(file)} ${r.status} ${(await r.text()).slice(0, 200)}`);
}

let job = null, report = null;
try {
  job = input.jobUrl ? JSON.parse(String(await get(input.jobUrl))) : input;
  if (job.crf) process.env.RENDER_CRF = String(job.crf);
  const mode = job.mode ?? "gpu", dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-"));
  let t = Date.now();
  const renderer = mode === "gpu" ? await useGpu() : useSoftware();
  lap("gpuCheck", t);
  t = Date.now();
  const tlPath = path.join(dir, "timeline.json");
  await get(job.timelineUrl, tlPath);
  lap("download", t);
  const chunks = [];
  t = Date.now();
  for (const [i, r] of (job.ranges ?? []).entries()) {
    const out = path.join(dir, `chunk${i}.mp4`);
    const res = await renderParallel({ timelinePath: tlPath, out, from: r.from, to: r.to, workers: job.pages ?? 1 });
    // the storage bucket takes 50 MB a file: a busy chunk (the leafy daytime street) can pass it at CRF 20, so it is
    // squeezed again (higher CRF, same frames) until it fits (2026-11-04: chunk 0 came out too big)
    for (let crf = Number(job.crf ?? 20) + 4; fs.statSync(out).size > MAX_UPLOAD && crf <= 36; crf += 4) {
      const smaller = out.replace(/.mp4$/, `_crf${crf}.mp4`);
      execFileSync(FF, ["-v", "error", "-y", "-i", out, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", smaller]);
      fs.renameSync(smaller, out);
    }
    if (r.upload) await put(r.upload, out, "video/mp4");
    chunks.push({ from: r.from, to: r.to, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(out).size });
  }
  if (job.whole) {
    const silent = path.join(dir, "silent.mp4"), mix = path.join(dir, "mix.m4a"), final = path.join(dir, "final.mp4");
    const res = await renderParallel({ timelinePath: tlPath, out: silent, workers: job.pages ?? 1 });
    await get(job.whole.mixUrl, mix);
    const p = spawnSync(FF, ["-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { encoding: "utf8" });
    if (p.status !== 0) throw new Error(`mux failed: ${p.stderr.slice(-400)}`);
    if (job.whole.upload) await put(job.whole.upload, final, "video/mp4");
    chunks.push({ whole: true, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(final).size });
  }
  lap("render", t);
  report = { ok: true, mode, renderer, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : os.hostname(), chunks, timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
} catch (e) {
  report = { ok: false, code: e.code ?? "RENDER_FAILED", error: String(e.message).slice(0, 1500), timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
}
if (job?.uploads?.report) { const f = path.join(os.tmpdir(), "bw-report.json"); fs.writeFileSync(f, JSON.stringify(report)); await put(job.uploads.report, f, "application/json").catch(() => {}); }
console.log(`RESULT ${JSON.stringify(report)}`);
process.exit(report.ok ? 0 : 1);
