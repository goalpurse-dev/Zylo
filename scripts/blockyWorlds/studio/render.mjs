// STUDIO MODE: renders on RunPod, endpoint BLOCKY_WORLDS_STUDIO_ENDPOINT (default gm9eqdkuyc2ofs; never Cutaway's), through the image's simpleStills role with
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
// THE ENDPOINT (owner 2026-11-13): a setting, BLOCKY_WORLDS_STUDIO_ENDPOINT, default the Blocky endpoint gm9eqdkuyc2ofs;
// the Cutaway endpoint is refused whatever the setting says. Without the setting, runpod/endpoint.json must agree with
// the default (the image the endpoint runs is the one the bundle was made for).
export const DEFAULT_ENDPOINT = "gm9eqdkuyc2ofs";
export const FORBIDDEN_ENDPOINTS = Object.freeze(["f66astc0vrus92"]); // Cutaway
export function studioEndpoint(env = process.env) {
  const set = String(env.BLOCKY_WORLDS_STUDIO_ENDPOINT ?? "").trim();
  const id = set || DEFAULT_ENDPOINT;
  if (FORBIDDEN_ENDPOINTS.includes(id)) throw new Error(`the Studio endpoint is set to ${id}, the Cutaway endpoint: refusing`);
  if (!/^[a-z0-9]{8,40}$/.test(id)) throw new Error(`the Studio endpoint setting "${id.slice(0, 40)}" is not a RunPod endpoint id: refusing`);
  if (!set && endpointInfo().endpointId !== id) throw new Error(`runpod/endpoint.json points at ${endpointInfo().endpointId}, not ${id}: refusing (set BLOCKY_WORLDS_STUDIO_ENDPOINT to choose)`);
  return id;
}
export const ENDPOINT = studioEndpoint();
export { RATE };
const client = () => rpClient({ endpointId: studioEndpoint() });

/** worst-case seconds of a stills job (the job is cancelled at maxSec, so this bounds the spend) */
export const sheetMaxSec = (frames) => Math.round(120 + frames * 1.2);

// the storage calls (2026-11-13: 320 parallel signs / downloads hit Supabase 429 and a network outage cut a finished job's
// download): at most 16 at a time, each retried; a job whose frames did not all come back keeps its folder (no cleanup), so
// the uploaded frames can still be fetched (`kept` in the result)
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; };
const retry = async (fn, tries = 4) => { for (let t = 0; ; t++) { try { const v = await fn(); if (v != null) return v; if (t >= tries - 1) return null; } catch (e) { if (t >= tries - 1) throw e; } await new Promise((res) => setTimeout(res, [1500, 4000, 9000][t] ?? 9000)); } };
export async function oneJob({ code, specs, out, prefix, maxSec, L, label, quality = 0.88 }) {
  if (code.length > 2_000_000) throw new Error(`the bundle is ${code.length} bytes (the role's limit is 2 MB)`);
  fs.mkdirSync(out, { recursive: true });
  const st = storage(loadEnv(), prefix), rp = client();
  const names = simpleFileNames(specs), uploads = {};
  await pool(names, 16, async (n) => { uploads[n] = await retry(() => st.signPut(n)); });
  const t0 = Date.now();
  let keep = false;
  try {
    keep = true; // from the submit on, the job may upload: the folder is cleaned only when every frame is home
    const id = await rp.submit({ job: { role: "simpleStills", mode: "gpu", simple: { code, shots: specs, quality, out: { uploads } } } });
    const s = await rp.wait(id, { maxSec, pollMs: 2000 });
    const b = billed(s);
    L?.add(`runpod_${label.split(":")[0]}`, b.usd);
    L?.log({ step: `runpod:${label}`, job: id, status: s.status, billedSec: b.seconds, usd: b.usd, wallSec: +((Date.now() - t0) / 1000).toFixed(1), loadMs: s.output?.loadMs, timing: s.output?.timing });
    if (!(s.status === "COMPLETED" && s.output?.ok)) return { ok: false, error: JSON.stringify({ status: s.status, error: s.error ?? s.output?.error ?? null }).slice(0, 1500), billed: b, files: [] };
    const files = [], pageErrors = [...(s.output.errors ?? [])];
    const missing = [];
    await pool(s.output.stills, 16, async (x, i) => {
      if (!x.file) { files[i] = { error: x.error }; return; }
      const buf = await retry(() => st.get(x.file)).catch(() => null); const f = path.join(out, x.file);
      if (buf) fs.writeFileSync(f, buf); else missing.push(x.file);
      let rep = null; if (x.lut && x.lut !== false) { try { rep = JSON.parse(x.lut); } catch { /* not ours */ } }
      for (const e of rep?.errors ?? []) if (!pageErrors.includes(e)) pageErrors.push(e);
      files[i] = { file: f, mean: x.mean, ms: x.ms, tiles: rep?.tiles ?? [] };
    });
    if (missing.length) return { ok: false, error: `${missing.length} frame file(s) did not download (kept in ${prefix})`, kept: prefix, billed: b, files };
    keep = false;
    return { ok: true, job: id, files, pageErrors, billed: b, wallSec: +((Date.now() - t0) / 1000).toFixed(1), renderer: s.output.renderer, loadMs: s.output.loadMs };
  } finally { if (!keep) await st.cleanup().catch(() => 0); else L?.log({ step: `storage_kept:${label}`, prefix }); }
}

/** contact sheets: [{ name, frames: [{ t, label, sub }], cols, tw, th }] in ONE job */
export async function renderSheets({ code, sheets, out, L, label = "preview" }) {
  fs.mkdirSync(out, { recursive: true });
  const frames = sheets.reduce((n, s) => n + s.frames.length, 0), maxSec = sheetMaxSec(frames);
  L?.check(`runpod ${label}`, +(maxSec * RATE).toFixed(4));
  const specs = sheets.map((s) => ({ label: s.name, sheet: true, frames: s.frames, cols: s.cols ?? 5, tw: s.tw ?? 216, th: s.th ?? 384, labels: true, stats: true }));
  return oneJob({ code, specs, out, prefix: `blocky-worlds-test/studio/${path.basename(path.dirname(out))}-${label}-${Date.now()}`, maxSec, L, label });
}

/** the final's per-job limit (measured 2026-11-13: ~0.13 s a frame incl. the upload, plus start-up; x1.5 margin) and the
 *  worst case of K jobs: jobs x maxSec x RATE (a job is cancelled at maxSec) */
export function finalLimits(tl, jobs, fps = 24) {
  const packs = Math.ceil(Math.round(tl.duration * fps) / 4), per = Math.ceil(packs / jobs), maxSec = Math.round(100 + per * 4 * 0.2);
  return { per, maxSec, worstUsd: +(jobs * maxSec * RATE).toFixed(4) };
}

/** the final: frame packs of 4 (2 x 2 at full size), split over `jobs` parallel jobs; then local split + encode + mux */
export async function renderFinal({ code, tl, out, mix, jobs = 6, L, fps = 24 }) {
  fs.mkdirSync(out, { recursive: true });
  const n = Math.round(tl.duration * fps), packs = [];
  for (let i = 0; i < n; i += 4) packs.push({ label: `p${String(i / 4).padStart(4, "0")}`, sheet: true, frames: [0, 1, 2, 3].map((j) => ({ t: Math.min(tl.duration - 1e-3, (i + j) / fps) })), cols: 2, tw: 1080, th: 1920, labels: false, quality: 0.86 });
  // the per-job limit from the measured final (run 1: ~21 s render + ~28 s upload for ~280 frames, plus start-up): 100 s +
  // 0.3 s a frame; a job is cancelled there, so jobs x maxSec bounds the spend
  const { maxSec, per } = finalLimits(tl, jobs, fps);
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
