// SOUND agent: re-mix the music + SFX of an existing render, with NO new voice and NO new render (free, local).
//   node dev/remix.mjs --run <dir> [--video <silent.mp4|final.mp4>] --music <A-E|loop.wav> --out <dir> [--no-sfx]
//                      [--under 9] [--stems]
// <dir> must hold timeline.json and voice.wav; the video is <dir>/silent.mp4, else <dir>/final.mp4 (its audio is
// dropped), or --video. Writes <out>/mix.m4a, final.mp4, final_720.mp4, sfx_cues.json, remix.json
// (+ stem_*.wav with --stems, to check the balance).
//   e.g. The Listener: node dev/remix.mjs --run out/paid1 --video out/paid1/runpod3/silent.mp4 --music A --out out/dev/remix_test
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mixAudio } from "../audio/mix.mjs";
import { sfxCues } from "../lib/sfx.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
  const k = args[i].replace(/^--/, "");
  if (["run", "video", "music", "out", "under"].includes(k)) opt[k] = args[++i]; else opt[k] = true;
}
if (!opt.run || !opt.music || !opt.out) { console.error("usage: node dev/remix.mjs --run <dir> [--video file] --music <A-E|loop.wav> --out <dir> [--no-sfx] [--under 9] [--stems]"); process.exit(2); }
const run = path.resolve(ENGINE, opt.run), out = path.resolve(ENGINE, opt.out);
const tlPath = path.join(run, "timeline.json"), voice = path.join(run, "voice.wav");
for (const f of [tlPath, voice]) if (!fs.existsSync(f)) { console.error(`remix: missing ${f}`); process.exit(1); }
const video = opt.video ? path.resolve(ENGINE, opt.video) : [path.join(run, "silent.mp4"), path.join(run, "final.mp4")].find((f) => fs.existsSync(f));
if (!video || !fs.existsSync(video)) { console.error("remix: no silent.mp4/final.mp4 (pass --video)"); process.exit(1); }

const ff = (a) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...a], { encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); };
const probe = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
const length = Math.min(tl.duration, probe(video));
fs.mkdirSync(out, { recursive: true });
const cues = opt["no-sfx"] ? [] : sfxCues(tl).filter((c) => c.t < length);
fs.writeFileSync(path.join(out, "sfx_cues.json"), JSON.stringify(cues, null, 1));
const music = /^[A-Ea-e]$/.test(opt.music) ? opt.music.toUpperCase() : path.resolve(ENGINE, opt.music);
const t0 = Date.now();
const mix = await mixAudio({ voice, out: path.join(out, "mix.m4a"), duration: length, musicLoop: music, sfxCues: cues, musicUnderVoiceDb: opt.under ? Number(opt.under) : 9, stemsDir: opt.stems ? out : null });
const final = path.join(out, "final.mp4"), web = path.join(out, "final_720.mp4");
ff(["-i", video, "-i", mix.out, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-t", length.toFixed(3), "-movflags", "+faststart", final]);
ff(["-i", final, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", web]);
const report = { run, video, music, length, mix, cues: cues.length, seconds: +((Date.now() - t0) / 1000).toFixed(1), files: { final, web } };
fs.writeFileSync(path.join(out, "remix.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
