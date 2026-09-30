// AI Fruit Story v2 final video (stage 3f) — one Fly machine per final.
//
// Started by fruit-story-api (buildFinal) through the Machines API with the
// job in FRUIT_FINAL_JOB (JSON). Holds no Supabase key: it downloads the
// public clip URLs, trims each clip's leading/trailing silence (keeping
// 0.25 s), normalizes size/fps/loudness, optionally burns in the known lines
// as captions, joins, uploads the MP4 to a one-time signed upload URL, then
// reports to fruit-worker with the job's HMAC token. Any failure is reported
// too (the final is free; the user just retries).
//
//   FRUIT_FINAL_JOB='{"callId":…,"storyId":…,"aspect":"9:16","captions":true,
//     "clips":[{"url":…,"line":…}],"uploadUrl":…,"callbackUrl":…,"token":…}'
//   node src/fruitFinal.mjs                    (on Fly)
//   node src/fruitFinal.mjs --local out.mp4    (local test: no upload, no callback)
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FRAME, parseSilences, segmentArgs, trimWindow } from "./fruitFinalPlan.mjs";
import { buildAss, coverAss, timedWords } from "./fruitCaptions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const FONT = process.env.FRUIT_FONT ?? path.resolve(HERE, "../../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
const USD_PER_SECOND = Number(process.env.MACHINE_USD_PER_SECOND ?? "0.0000478");
const CPUS = os.cpus().length;

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(bin)} exited ${code}: ${err.slice(-600)}`))));
  });
}

async function probe(file) {
  const { out } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file]);
  const j = JSON.parse(out);
  return { durationSec: Number(j.format?.duration ?? 0), hasAudio: (j.streams ?? []).some((s) => s.codec_type === "audio") };
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`download ${res.status} for clip`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

export async function buildFinal(job, dir) {
  await mkdir(dir, { recursive: true });
  const threads = Math.max(1, Math.floor(CPUS / Math.min(CPUS, job.clips.length)));
  const segments = await pool(job.clips, Math.max(1, Math.min(CPUS, 4)), async (clip, i) => {
    const input = path.join(dir, `in-${i}.mp4`);
    await download(clip.url, input);
    const { durationSec, hasAudio } = await probe(input);
    let win = { start: 0, end: durationSec, trimmedSec: 0 };
    if (hasAudio) {
      const { err } = await run(FFMPEG, ["-hide_banner", "-nostats", "-i", input, "-af", "silencedetect=noise=-35dB:d=0.15", "-vn", "-f", "null", "-"]);
      win = trimWindow(parseSilences(err, durationSec), durationSec);
    }
    // Captions: the exact line, timed by the clip's word timestamps (or spread
    // over the detected speech), shifted into the trimmed segment's time.
    // Series overlays: "Part N" on the first ~1.5 s, the end card on the last ~2 s.
    const [w, h] = FRAME[job.aspect] ?? FRAME["9:16"];
    const segSec = win.end - win.start;
    const overlays = [];
    if (i === 0 && job.overlays?.part) overlays.push({ kind: "part", text: job.overlays.part, start: 0, end: Math.min(1.5, segSec) });
    if (i === job.clips.length - 1 && job.overlays?.end) overlays.push({ kind: "end", text: job.overlays.end, start: Math.max(0, segSec - 2), end: segSec });
    let assFile = null;
    let captionSource = null;
    let words = [];
    if (job.captions && clip.line) {
      const timed = timedWords(clip.line, clip.words ?? null, win.speech ?? null, durationSec);
      words = timed.words.map((x) => ({ ...x, start: Math.max(0, x.start - win.start), end: Math.min(segSec, Math.max(0, x.end - win.start)) }));
      captionSource = timed.source;
    }
    if (words.length || overlays.length) {
      assFile = path.join(dir, `cap-${i}.ass`);
      await writeFile(assFile, buildAss({ words, width: w, height: h, durationSec: segSec, highlight: job.highlight !== false, overlays }), "utf8");
    }
    const output = path.join(dir, `seg-${i}.mp4`);
    await run(FFMPEG, segmentArgs({ input, output, start: win.start, end: win.end, aspect: job.aspect, assFile, fontsDir: path.dirname(FONT), hasAudio, threads }));
    return { output, trimmedSec: win.trimmedSec, keptSec: win.end - win.start, captionSource };
  });
  const list = path.join(dir, "list.txt");
  await writeFile(list, segments.map((s) => `file '${s.output.replace(/\\/g, "/")}'`).join("\n"));
  const final = path.join(dir, "final.mp4");
  await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", final]);
  const { durationSec } = await probe(final);
  return {
    file: final,
    durationSec: Math.round(durationSec * 100) / 100,
    trimmedPerClip: segments.map((s) => Math.round(s.trimmedSec * 100) / 100),
    captionSources: segments.map((s) => s.captionSource),
    trimmedSec: Math.round(segments.reduce((a, s) => a + s.trimmedSec, 0) * 100) / 100,
    sizeBytes: (await stat(final)).size,
  };
}

/** PUT to the signed upload URL; up to 3 tries (Storage answered 520 once on a 10 MB final). */
async function upload(url, body, contentType = "video/mp4") {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t = Date.now();
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body, signal: AbortSignal.timeout(90_000) });
      if (res.ok) return;
      last = `HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 160)}`;
    } catch (e) { last = String(e?.message ?? e); }
    console.error(`[fruit-final] upload try ${attempt} failed after ${((Date.now() - t) / 1000).toFixed(1)}s: ${last}`);
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  throw new Error(`upload ${last}`);
}

/**
 * The cover: the story's most dramatic scene picture with the title in a fixed
 * layout (identical across a series): a dark band at the top, "EPISODE N" in
 * lime, the title in white capitals under it. Drawn by ffmpeg, never by the AI.
 * 1080 × 1920 for 9:16 (1920 × 1080 for 16:9), JPG.
 */
export async function renderCover(cover, aspect, dir) {
  const [w, h] = aspect === "16:9" ? [1920, 1080] : [1080, 1920];
  const src = path.join(dir, "cover-src.jpg");
  await download(cover.imageUrl, src);
  const ass = path.join(dir, "cover.ass");
  await writeFile(ass, coverAss({ width: w, height: h, label: cover.label, title: cover.title }), "utf8");
  const out = path.join(dir, "cover.jpg");
  const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", src,
    "-vf", [
      `scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`,
      `drawbox=x=0:y=0:w=iw:h=ih*0.30:color=black@0.55:t=fill`,
      `ass='${esc(ass)}':fontsdir='${esc(path.dirname(FONT))}'`,
    ].join(","),
    "-frames:v", "1", "-q:v", "2", out,
  ]);
  return out;
}

async function report(job, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(job.callbackUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "final_done", callId: job.callId, storyId: job.storyId, token: job.token, ...body }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return;
      console.error(`[fruit-final] callback HTTP ${res.status}`);
    } catch (e) { console.error("[fruit-final] callback failed:", e?.message ?? e); }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

async function main() {
  const local = process.argv.indexOf("--local");
  const job = JSON.parse(process.env.FRUIT_FINAL_JOB ?? (local > -1 ? await readFile(process.argv[local + 2], "utf8") : "null"));
  if (!job?.clips?.length) throw new Error("FRUIT_FINAL_JOB missing");
  const t0 = Date.now();
  const dir = path.join(process.env.WORK_DIR ?? os.tmpdir(), `fruit-final-${job.callId ?? "local"}`);
  try {
    const out = await buildFinal(job, dir);
    if (local > -1) {
      await writeFile(process.argv[local + 1], await readFile(out.file));
      if (job.cover?.imageUrl) await writeFile(process.argv[local + 1].replace(/\.mp4$/, "") + "-cover.jpg", await readFile(await renderCover(job.cover, job.aspect, dir)));
      console.log(JSON.stringify({ ...out, file: process.argv[local + 1], ms: Date.now() - t0 }));
      return;
    }
    console.log(`[fruit-final] built ${out.durationSec}s, ${(out.sizeBytes / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await upload(job.uploadUrl, await readFile(out.file));
    // The cover image (optional): its own signed upload URL.
    let coverOk = false;
    if (job.cover?.imageUrl && job.cover?.uploadUrl) {
      try { await upload(job.cover.uploadUrl, await readFile(await renderCover(job.cover, job.aspect, dir)), "image/jpeg"); coverOk = true; } catch (e) { console.error("[fruit-final] cover failed:", e?.message ?? e); }
    }
    console.log(`[fruit-final] uploaded at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const seconds = (Date.now() - t0) / 1000;
    await report(job, { ok: true, durationSec: out.durationSec, trimmedSec: out.trimmedSec, trimmedPerClip: out.trimmedPerClip, captionSources: out.captionSources, cover: coverOk, sizeBytes: out.sizeBytes, seconds, costUsd: seconds * USD_PER_SECOND });
  } catch (e) {
    console.error("[fruit-final] failed:", e?.message ?? e);
    if (local > -1) throw e;
    const seconds = (Date.now() - t0) / 1000;
    await report(job, { ok: false, error: String(e?.message ?? e).slice(0, 500), seconds, costUsd: seconds * USD_PER_SECOND });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
