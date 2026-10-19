// Cutaway Explainer final video (one Fly machine per video, or locally).
//
// Downloads the clips and the voice, joins them with cutawayFinalPlan.mjs,
// and PUTs the MP4 to the one-time signed upload URL the edge function made.
// The edge function sees the file appear in storage; there is no callback.
//
//   CUTAWAY_FINAL_JOB='{"clips":[{"url":…,"speed":1.02,"dropFirstFrame":false}],"voice":{"url":…,"tempo":1.3},
//                       "captions":[{"w":…,"s":…,"e":…}],"lengthSec":15.2,"uploadUrl":…}' node src/cutawayFinal.mjs
//   node src/cutawayFinal.mjs --local job.json out.mp4     (local: no upload)

import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAss, finalArgs, gainFor } from "./cutawayFinalPlan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FONT = process.env.CUTAWAY_FONT ?? path.resolve(HERE, "../../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
// The fixed two-tone chime (scripts/cutaway/makeChime.mjs): the same file in every video.
const CHIME = process.env.CUTAWAY_CHIME ?? path.resolve(HERE, "../assets/sfx/chime.wav");
const USD_PER_SECOND = Number(process.env.MACHINE_USD_PER_SECOND ?? "0.0000478");

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err}`))));
  });
}

async function download(url, file) {
  if (!/^https?:\/\//i.test(url)) { await copyFile(url.replace(/^file:\/\//i, ""), file); return file; } // local runner
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) { await writeFile(file, Buffer.from(await res.arrayBuffer())); return file; }
    if (attempt === 3) throw new Error(`download failed (${res.status}): ${url.slice(0, 80)}`);
  }
}

async function upload(url, bytes) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return;
    if (attempt === 3) throw new Error(`upload failed (${res.status})`);
  }
}

export async function renderCutaway(job, dir, outName = "final.mp4") {
  await mkdir(dir, { recursive: true });
  const clipFiles = [];
  for (const [i, c] of job.clips.entries()) clipFiles.push(path.basename(await download(c.url, path.join(dir, `clip-${i}.mp4`))));
  const voiceFile = job.voice?.url ? path.basename(await download(job.voice.url, path.join(dir, "voice.mp3"))) : null;
  let assFile = null;
  let fontsDir = null;
  if (job.captions?.length || job.cards?.length) {
    fontsDir = "fonts";
    await mkdir(path.join(dir, fontsDir), { recursive: true });
    await copyFile(FONT, path.join(dir, fontsDir, path.basename(FONT)));
    assFile = "captions.ass";
    await writeFile(path.join(dir, assFile), buildAss({ words: job.captions ?? [], cards: job.cards ?? [], width: job.width ?? 1080, height: job.height ?? 1920 }), "utf8");
  }
  let chimeFile = null;
  if (job.chimes?.length) {
    chimeFile = "chime.wav";
    await copyFile(CHIME, path.join(dir, chimeFile));
  }
  const { sfx, chimeGainDb, measured } = await mixInputs(job, dir, voiceFile, chimeFile);
  const args = finalArgs({
    clipFiles, speeds: job.clips.map((c) => c.speed), voiceFile, tempo: job.voice?.tempo ?? 1,
    assFile, fontsDir, chimeFile, chimes: job.chimes ?? [], chimeGainDb, sfx,
    lengthSec: job.lengthSec, width: job.width ?? 1080, height: job.height ?? 1920, fps: job.fps ?? 24, output: outName,
  });
  await run(FFMPEG, args, dir);
  job.measured = measured;
  return path.join(dir, outName);
}

/** Integrated loudness (EBU R128, LUFS) of a file; silence is gated out, so short effects measure fairly. */
export function loudness(file, cwd) {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"], { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", () => {
      const m = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
      const v = m ? Number(m[1]) : NaN;
      resolve(Number.isFinite(v) && v > -70 ? v : NaN);
    });
  });
}

/** Downloads the effects and works out every gain from the voice's measured loudness. */
export async function mixInputs(job, dir, voiceFile, chimeFile) {
  const levels = job.levels ?? { sfxDb: -20, chimeDb: -20 };
  const voiceLufs = voiceFile ? await loudness(voiceFile, dir) : NaN;
  const chimeLufs = chimeFile ? await loudness(chimeFile, dir) : NaN;
  const chimeGainDb = gainFor({ voiceLufs, soundLufs: chimeLufs, levelDb: levels.chimeDb });
  const sfx = [];
  for (const [i, c] of (job.sfx ?? []).entries()) {
    const ext = path.extname(String(c.url).split("?")[0]) || ".mp3";
    const file = path.basename(await download(c.url, path.join(dir, `sfx-${i}${ext}`)));
    const soundLufs = await loudness(file, dir);
    sfx.push({ file, start: c.start, duration: c.duration ?? null, soft: Boolean(c.soft), gainDb: gainFor({ voiceLufs, soundLufs, levelDb: levels.sfxDb }), soundLufs });
  }
  return { sfx, chimeGainDb, measured: { voiceLufs, chimeLufs, chimeGainDb, sfx: sfx.map((s) => ({ file: s.file, lufs: s.soundLufs, gainDb: s.gainDb })) } };
}

/** The audio mix alone (voice + chime + effects) as an mp3, for listening tests. */
export async function renderMix(job, dir, outName = "mix.mp3") {
  await mkdir(dir, { recursive: true });
  const voiceFile = job.voice?.url ? path.basename(await download(job.voice.url, path.join(dir, "voice.mp3"))) : null;
  let chimeFile = null;
  if (job.chimes?.length) { chimeFile = "chime.wav"; await copyFile(CHIME, path.join(dir, chimeFile)); }
  const { sfx, chimeGainDb, measured } = await mixInputs(job, dir, voiceFile, chimeFile);
  await run(FFMPEG, finalArgs({ voiceFile, chimeFile, chimes: job.chimes ?? [], chimeGainDb, sfx, lengthSec: job.lengthSec, output: outName, audioOnly: true }), dir);
  return { file: path.join(dir, outName), measured };
}

async function main() {
  const local = process.argv.indexOf("--local");
  const job = JSON.parse(process.env.CUTAWAY_FINAL_JOB ?? (local > -1 ? await readFile(process.argv[local + 1], "utf8") : "null"));
  if (!job?.clips?.length) throw new Error("no job");
  const t0 = Date.now();
  const dir = path.join(process.env.WORK_DIR ?? os.tmpdir(), `cutaway-final-${job.runId ?? "local"}`);
  const out = await renderCutaway(job, dir);
  if (local > -1) {
    const target = path.resolve(process.argv[local + 2] ?? "cutaway-final.mp4");
    await copyFile(out, target);
    console.log(JSON.stringify({ ok: true, file: target, sizeBytes: (await stat(target)).size, seconds: (Date.now() - t0) / 1000 }));
    return;
  }
  await upload(job.uploadUrl, await readFile(out));
  const seconds = (Date.now() - t0) / 1000;
  console.log(JSON.stringify({ ok: true, seconds, costUsd: Number((seconds * USD_PER_SECOND).toFixed(5)) }));
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error("[cutaway-final]", e?.message ?? e); process.exit(1); });
}
