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
import { FRAME, parseSilences, segmentArgs, trimWindow, wrapCaption } from "./fruitFinalPlan.mjs";

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
    const captionFiles = [];
    if (job.captions && clip.line) {
      const [w] = FRAME[job.aspect] ?? FRAME["9:16"];
      const lines = wrapCaption(clip.line, w >= 1280 ? 34 : 20);
      for (const [n, text] of lines.entries()) {
        const f = path.join(dir, `cap-${i}-${n}.txt`);
        await writeFile(f, text, "utf8");
        captionFiles.push(f);
      }
    }
    const output = path.join(dir, `seg-${i}.mp4`);
    await run(FFMPEG, segmentArgs({ input, output, start: win.start, end: win.end, aspect: job.aspect, captionFiles, fontFile: FONT, hasAudio, threads }));
    return { output, trimmedSec: win.trimmedSec, keptSec: win.end - win.start };
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
    trimmedSec: Math.round(segments.reduce((a, s) => a + s.trimmedSec, 0) * 100) / 100,
    sizeBytes: (await stat(final)).size,
  };
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
      console.log(JSON.stringify({ ...out, file: process.argv[local + 1], ms: Date.now() - t0 }));
      return;
    }
    const up = await fetch(job.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "false" }, body: await readFile(out.file), signal: AbortSignal.timeout(120_000) });
    if (!up.ok) throw new Error(`upload HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
    const seconds = (Date.now() - t0) / 1000;
    await report(job, { ok: true, durationSec: out.durationSec, trimmedSec: out.trimmedSec, trimmedPerClip: out.trimmedPerClip, sizeBytes: out.sizeBytes, seconds, costUsd: seconds * USD_PER_SECOND });
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
