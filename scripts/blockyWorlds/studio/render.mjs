// STUDIO MODE: renders on RunPod, endpoint gm9eqdkuyc2ofs ONLY (asserted), through the image's simpleStills role with
// the studio bundle as the job's page code (no new role, no image rebuild). The keys stay here (engine/runpod/client.mjs
// reads .env.local when a job is sent); the agent never sees them.
//   renderSheets({ code, sheets, out, label, L })  one job: each sheet = a contact sheet of labelled frames -> JPEG files
//   renderFinal({ code, tl, out, jobs, L })          K jobs in parallel, each a range of 2 x 2 frame packs (full 1080x1920
//                                                     frames) -> local frames -> ffmpeg (encode + mux the mix): final.mp4
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "../engine");
const { rpClient, storage, loadEnv, billed, RATE, endpointInfo } = await import(pathToFileURL(path.join(ENGINE, "runpod/client.mjs")).href);
const { simpleFileNames } = await import(pathToFileURL(path.join(ENGINE, "runpod/simpleRole.mjs")).href);
export const ENDPOINT = "gm9eqdkuyc2ofs";
export { RATE };
const client = () => { if (endpointInfo().endpointId !== ENDPOINT) throw new Error(`runpod/endpoint.json points at ${endpointInfo().endpointId}, not ${ENDPOINT}: refusing`); return rpClient({ endpointId: ENDPOINT }); };

/** worst-case seconds of a stills job (the job is cancelled at maxSec, so this bounds the spend) */
export const sheetMaxSec = (frames) => Math.round(120 + frames * 1.2);

async function oneJob({ code, specs, out, prefix, maxSec, L, label, quality = 0.88 }) {
  if (code.length > 2_000_000) throw new Error(`the bundle is ${code.length} bytes (the role's limit is 2 MB)`);
  fs.mkdirSync(out, { recursive: true });
  const st = storage(loadEnv(), prefix), rp = client();
  const names = simpleFileNames(specs), uploads = {};
  await Promise.all(names.map(async (n) => { uploads[n] = await st.signPut(n); }));
  const t0 = Date.now();
  try {
    const id = await rp.submit({ job: { role: "simpleStills", mode: "gpu", simple: { code, shots: specs, quality, out: { uploads } } } });
    const s = await rp.wait(id, { maxSec, pollMs: 2000 });
    const b = billed(s);
    L?.add(`runpod_${label.split(":")[0]}`, b.usd);
    L?.log({ step: `runpod:${label}`, job: id, status: s.status, billedSec: b.seconds, usd: b.usd, wallSec: +((Date.now() - t0) / 1000).toFixed(1), loadMs: s.output?.loadMs, timing: s.output?.timing });
    if (!(s.status === "COMPLETED" && s.output?.ok)) return { ok: false, error: JSON.stringify({ status: s.status, error: s.error ?? s.output?.error ?? null }).slice(0, 1500), billed: b, files: [] };
    const files = [], pageErrors = [...(s.output.errors ?? [])];
    await Promise.all(s.output.stills.map(async (x, i) => {
      if (!x.file) { files[i] = { error: x.error }; return; }
      const buf = await st.get(x.file); const f = path.join(out, x.file);
      if (buf) fs.writeFileSync(f, buf);
      let rep = null; if (x.lut && x.lut !== false) { try { rep = JSON.parse(x.lut); } catch { /* not ours */ } }
      for (const e of rep?.errors ?? []) if (!pageErrors.includes(e)) pageErrors.push(e);
      files[i] = { file: f, mean: x.mean, ms: x.ms, tiles: rep?.tiles ?? [] };
    }));
    return { ok: true, job: id, files, pageErrors, billed: b, wallSec: +((Date.now() - t0) / 1000).toFixed(1), renderer: s.output.renderer, loadMs: s.output.loadMs };
  } finally { await st.cleanup().catch(() => 0); }
}

/** contact sheets: [{ name, frames: [{ t, label, sub }], cols, tw, th }] in ONE job */
export async function renderSheets({ code, sheets, out, L, label = "preview" }) {
  fs.mkdirSync(out, { recursive: true });
  const frames = sheets.reduce((n, s) => n + s.frames.length, 0), maxSec = sheetMaxSec(frames);
  L?.check(`runpod ${label}`, +(maxSec * RATE).toFixed(4));
  const specs = sheets.map((s) => ({ label: s.name, sheet: true, frames: s.frames, cols: s.cols ?? 5, tw: s.tw ?? 216, th: s.th ?? 384, labels: true, stats: true }));
  return oneJob({ code, specs, out, prefix: `blocky-worlds-test/studio/${path.basename(path.dirname(out))}-${label}-${Date.now()}`, maxSec, L, label });
}

/** the final: frame packs of 4 (2 x 2 at full size), split over `jobs` parallel jobs; then local split + encode + mux */
export async function renderFinal({ code, tl, out, mix, jobs = 6, L, fps = 24 }) {
  fs.mkdirSync(out, { recursive: true });
  const n = Math.round(tl.duration * fps), packs = [];
  for (let i = 0; i < n; i += 4) packs.push({ label: `p${String(i / 4).padStart(4, "0")}`, sheet: true, frames: [0, 1, 2, 3].map((j) => ({ t: Math.min(tl.duration - 1e-3, (i + j) / fps) })), cols: 2, tw: 1080, th: 1920, labels: false, quality: 0.86 });
  // the per-job limit from the measured final (run 1: ~21 s render + ~28 s upload for ~280 frames, plus start-up): 100 s +
  // 0.3 s a frame; a job is cancelled there, so jobs x maxSec bounds the spend
  const per = Math.ceil(packs.length / jobs), maxSec = Math.round(100 + per * 4 * 0.3);
  L?.check("runpod final", +(jobs * maxSec * RATE).toFixed(4));
  const t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: jobs }, (_, j) => packs.slice(j * per, (j + 1) * per)).filter((x) => x.length).map((specs, j) =>
    // every job is awaited to its end and billed, even when another one fails (no orphaned jobs)
    oneJob({ code, specs, out: path.join(out, `job${j}`), prefix: `blocky-worlds-test/studio/${path.basename(path.dirname(out))}-final${j}-${Date.now()}`, maxSec, L, label: `final:${j}`, quality: 0.86 }).then((r) => ({ ...r, j }), (e) => ({ ok: false, error: String(e.message ?? e).slice(0, 400), j, files: [], pageErrors: [], billed: { usd: 0 } }))));
  const wall = +((Date.now() - t0) / 1000).toFixed(1);
  const bad = parts.filter((p) => !p.ok);
  if (bad.length) return { ok: false, error: bad.map((b) => `job ${b.j}: ${b.error}`).join(" | "), parts, wallSec: wall };
  // the packs in order -> one image sequence -> untile 2x2 -> 24 fps -> x264 + the mix
  const list = parts.sort((a, b) => a.j - b.j).flatMap((p) => p.files.map((f) => f.file));
  if (list.some((f) => !f || !fs.existsSync(f))) return { ok: false, error: "a frame pack is missing", parts, wallSec: wall };
  const seq = path.join(out, "packs"); fs.mkdirSync(seq, { recursive: true });
  list.forEach((f, i) => fs.copyFileSync(f, path.join(seq, `${String(i).padStart(5, "0")}.jpg`)));
  const silent = path.join(out, "silent.mp4"), final = path.join(out, "final.mp4");
  const e1 = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(fps / 4), "-i", path.join(seq, "%05d.jpg"), "-vf", `untile=2x2,setpts=N/(${fps}*TB),fps=${fps}`, "-frames:v", String(n), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", silent], { encoding: "utf8" });
  if (e1.status !== 0) return { ok: false, error: `encode: ${e1.stderr.slice(-600)}`, parts, wallSec: wall };
  const e2 = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", final], { encoding: "utf8" });
  if (e2.status !== 0) return { ok: false, error: `mux: ${e2.stderr.slice(-600)}`, parts, wallSec: wall };
  return { ok: true, final, frames: n, packs: packs.length, jobs: parts.length, wallSec: wall, pageErrors: [...new Set(parts.flatMap((p) => p.pageErrors))], billed: parts.reduce((a, p) => a + p.billed.usd, 0) };
}
