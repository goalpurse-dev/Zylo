// IN THIS TOWN v2: a background music bed under a finished video (owner 2026-11-24). Our own music, made in code
// (engine/audio/music.mjs: our notes, no samples, nothing copyrighted), ducked under the voice, cut with the picture at
// the cut to black (the black is silent), loudness -14 LUFS. Free, local. The video file without music is kept.
//   node scripts/blockyWorlds/v2/addMusic.mjs --name curtains [--mood horror] [--seed 7] [--level -20]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeMusic } from "../engine/audio/music.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${arg("name", "curtains")}`);
const SRC = path.join(OUT, arg("in", "final_1080p.mp4"));
const DST = path.join(OUT, arg("out", "final_1080p_music.mp4"));
const V = JSON.parse(fs.readFileSync(path.join(OUT, "voice.json"), "utf8"));
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC]).toString());
const cut = +(V.words.at(-1).end + 0.6).toFixed(2);   // the cut to black (previewVideo: the last word + 0.6 s)
const music = path.join(OUT, `music_${arg("mood", "horror")}.wav`);
await makeMusic({ out: music, seconds: cut + 1, mood: arg("mood", "horror"), seed: Number(arg("seed", 7)) });
const level = Number(arg("level", -20));   // the bed under the voice (dB)
// the bed: its level, ducked by the voice (sidechain), a 1.5 s fade in, a 0.08 s cut at the black; the voice on top
const fc = [
  `[1:a]volume=${level}dB,atrim=0:${cut},afade=t=in:d=1.5,afade=t=out:st=${(cut - 0.08).toFixed(2)}:d=0.08,apad,atrim=0:${dur.toFixed(2)}[bed]`,
  `[0:a]asplit=2[v][sc]`,
  `[bed][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]`,
  `[v][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
].join(";");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", SRC, "-i", music, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", DST]);
console.log(`music: ${DST} (bed ${arg("mood", "horror")} at ${level} dB, ducked under the voice, silent from the cut at ${cut} s)`);
