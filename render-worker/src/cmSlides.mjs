// Content Machine slideshow renderer (one Fly machine per slideshow, image tag cm-slides; or locally).
//
// Draws every slide with the app's own templates (supabase/functions/_shared/contentMachine/slides/
// templates.js) in Chromium at 1080×1920, then:
//   slide-01.png … slide-NN.png   for TikTok / Instagram photo carousels
//   slides.zip                    the same PNGs in one download
//   slideshow.mp4                 ~2.5 s a slide, simple crossfades, a silent audio track, H.264 30 fps
// PUTs each file to the one-time signed upload URLs the worker made, and manifest.json LAST: the worker
// sees the manifest appear and settles the cost from the time it took. A failure uploads a manifest with
// ok: false, so the worker stops waiting at once.
//
//   CM_SLIDES_JOB='{…}' node src/cmSlides.mjs
//   node src/cmSlides.mjs --local job.json outDir        (local: no upload)

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FONT_CSS, SIZE, slideHtml } from "../../supabase/functions/_shared/contentMachine/slides/templates.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FONTS_DIR = process.env.CM_FONTS_DIR ?? path.resolve(HERE, "../assets/fonts");
const FPS = 30;
const FADE = 0.35;

export function slideDurations(n, secondsPerSlide = 2.5) {
  return Array.from({ length: n }, (_, i) => (i === 0 ? secondsPerSlide + 0.5 : i === n - 1 ? secondsPerSlide + 1 : secondsPerSlide));
}

/** ffmpeg arguments: each PNG held for its duration, crossfaded into the next, plus silence. */
export function mp4Args(pngs, durations, output) {
  const args = ["-y"];
  pngs.forEach((p, i) => args.push("-loop", "1", "-t", String(durations[i] + (i < pngs.length - 1 ? FADE : 0)), "-framerate", String(FPS), "-i", p));
  args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  const prep = pngs.map((_, i) => `[${i}:v]scale=${SIZE.width}:${SIZE.height},setsar=1,format=yuv420p,fps=${FPS}[v${i}]`);
  const chain = [];
  let last = "v0";
  let offset = 0;
  for (let i = 1; i < pngs.length; i++) {
    offset += durations[i - 1];
    const out = i === pngs.length - 1 ? "vout" : `x${i}`;
    chain.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${out}]`);
    last = out;
  }
  if (pngs.length === 1) chain.push("[v0]null[vout]");
  const total = durations.reduce((a, b) => a + b, 0);
  args.push("-filter_complex", [...prep, ...chain].join(";"), "-map", "[vout]", "-map", `${pngs.length}:a`,
    "-t", total.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output);
  return { args, durationSec: total };
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err}`))));
  });
}

/* ─── a stored ZIP (PNGs are already compressed): no zip tool needed ─── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zipStore(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name, "utf8"), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, n, data); central.push(cen, n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

async function put(url, bytes, type) {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: bytes }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return;
    last = String(res.status);
  }
  throw new Error(`upload failed (${last})`);
}

export class LayoutError extends Error {
  constructor(layout) { super(`layout check failed: ${layout.map((l) => `slide ${l.slide}: ${l.problems.join("; ")}`).join(" | ")}`); this.layout = layout; }
}

/**
 * Real runs take images only over https, and (when the job lists allowedHosts) only from those hosts: our own
 * bucket's signed links (generated pictures, approved library assets, logos, the Zyvo screenshot) and the
 * image provider. Never a local file, never a random address.
 */
export function assertRemoteImages(job) {
  const urls = [job.zyvoShot, job.images?.background, ...Object.values(job.images?.heroes ?? {}), ...Object.values(job.images?.illustrations ?? {}), ...Object.values(job.images?.collages ?? {}).flat(), ...Object.values(job.logos ?? {})].filter(Boolean);
  const bad = urls.filter((u) => !String(u).toLowerCase().startsWith("https://"));
  if (bad.length) throw new Error(`only https images may be used in a real render (got ${bad.length} other)`);
  const hosts = (job.allowedHosts ?? []).map((h) => String(h).toLowerCase());
  if (hosts.length) {
    const hostOf = (u) => new URL(u).hostname.toLowerCase();
    const allowed = (h) => hosts.some((a) => h === a || (a.startsWith(".") && h.endsWith(a)));
    const outside = urls.filter((u) => !allowed(hostOf(u)));
    if (outside.length) throw new Error(`an image comes from a host that isn't allowed (${[...new Set(outside.map(hostOf))].join(", ")})`);
  }
}

/**
 * Draws the PNGs, the ZIP and the MP4 into dir. Returns their paths. Every slide checks its own layout
 * (templates.js): one overlap, one word outside the safe zone or one missing image and NOTHING is drawn
 * into files: a LayoutError lists each slide's problems.
 * opts.local: file: images allowed (local checks only); opts.safeZones: draw the zones (previews only).
 */
export async function renderSlideshow(job, dir, { chromium, local = false, safeZones = false, keepGoing = false } = {}) {
  await mkdir(dir, { recursive: true });
  const browserType = chromium ?? (await import("playwright")).chromium;
  const browser = await browserType.launch({ args: ["--disable-dev-shm-usage", "--font-render-hinting=none"] });
  const pngs = [];
  const layoutProblems = [];
  const layoutWarnings = [];   // empty space: the slide renders, admin marks it
  try {
    const page = await browser.newPage({ viewport: { width: SIZE.width, height: SIZE.height }, deviceScaleFactor: 1 });
    const fontCss = FONT_CSS.local(pathToFileURL(FONTS_DIR).href);
    const slides = job.slideshow.slides;
    for (const [i, slide] of slides.entries()) {
      const html = slideHtml({
        slide, index: i, total: slides.length, style: job.style, zyvoShot: job.zyvoShot ?? null, fontCss, logos: job.logos ?? null, safeZones, allowFile: local,
        images: { background: job.images?.background ?? null, hero: job.images?.heroes?.[i] ?? job.images?.illustrations?.[i] ?? null, collage: job.images?.collages?.[i] ?? null },
      });
      const file = path.join(dir, `slide-${String(i + 1).padStart(2, "0")}.png`);
      await writeFile(path.join(dir, "page.html"), html, "utf8");   // file:// so local fonts load
      await page.goto(pathToFileURL(path.join(dir, "page.html")).href, { waitUntil: "load", timeout: 60_000 });
      await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
      const layout = JSON.parse(await page.evaluate(() => document.body.dataset.layout || "{}"));
      if (!layout.ok) layoutProblems.push({ slide: i + 1, problems: layout.problems ?? ["no layout result"] });
      if (layout.warnings?.length) layoutWarnings.push({ slide: i + 1, warnings: layout.warnings, empty: layout.empty });
      await page.screenshot({ path: file, type: "png" });
      pngs.push(file);
    }
    if (layoutProblems.length && !keepGoing) throw new LayoutError(layoutProblems);
  } finally {
    await browser.close();
  }
  const zip = path.join(dir, "slides.zip");
  await writeFile(zip, zipStore(await Promise.all(pngs.map(async (p) => ({ name: path.basename(p), data: await readFile(p) })))));
  const mp4 = path.join(dir, "slideshow.mp4");
  const { args, durationSec } = mp4Args(pngs.map((p) => path.basename(p)), slideDurations(pngs.length, job.secondsPerSlide ?? 2.5), path.basename(mp4));
  await run(FFMPEG, args, dir);
  return { pngs, zip, mp4, durationSec, layoutProblems, layoutWarnings };
}

async function main() {
  const local = process.argv.indexOf("--local");
  const job = JSON.parse(process.env.CM_SLIDES_JOB ?? (local > -1 ? await readFile(process.argv[local + 1], "utf8") : "null"));
  if (!job?.slideshow?.slides?.length) throw new Error("no job");
  const t0 = Date.now();
  const dir = local > -1 ? path.resolve(process.argv[local + 2] ?? "cm-slides-out") : path.join(process.env.WORK_DIR ?? os.tmpdir(), `cm-slides-${job.ideaId ?? "local"}`);
  try {
    if (local === -1) assertRemoteImages(job);
    const out = await renderSlideshow(job, dir, { local: local > -1 });
    const sizes = { zip: (await stat(out.zip)).size, mp4: (await stat(out.mp4)).size };
    if (local > -1) { console.log(JSON.stringify({ ok: true, dir, slides: out.pngs.length, durationSec: out.durationSec, sizes, seconds: (Date.now() - t0) / 1000 })); return; }
    for (const [i, p] of out.pngs.entries()) await put(job.uploads.pngs[i], await readFile(p), "image/png");
    await put(job.uploads.zip, await readFile(out.zip), "application/zip");
    await put(job.uploads.mp4, await readFile(out.mp4), "video/mp4");
    await put(job.uploads.manifest, Buffer.from(JSON.stringify({ ok: true, slides: out.pngs.length, durationSec: out.durationSec, sizes, warnings: out.layoutWarnings, seconds: (Date.now() - t0) / 1000 })), "application/json");
    console.log(`[cm-slides] done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    console.error("[cm-slides] failed:", e?.message ?? e);
    if (local === -1 && job.uploads?.manifest) await put(job.uploads.manifest, Buffer.from(JSON.stringify({ ok: false, error: String(e?.message ?? e).slice(0, 500), layout: e?.layout ?? null, seconds: (Date.now() - t0) / 1000 })), "application/json").catch(() => {});
    process.exitCode = 1;
  } finally {
    if (local === -1) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
