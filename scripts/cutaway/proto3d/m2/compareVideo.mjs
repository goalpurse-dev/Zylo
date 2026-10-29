// M2: frames of a finished video every few seconds, beside the hand-built video's stills at the same times
// (free: ffmpeg only). With no hand folder, a contact sheet of the video alone.
//   node m2/compareVideo.mjs <video.mp4> <outDir> --ff FFMPEG [--hand <dir with f_NNN.png + times.json>] [--every 3]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { sheet } from "./sheet.mjs";

const [video, out] = process.argv.slice(2), arg = (k, d) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const ff = arg("ff"), hand = arg("hand", null), every = Number(arg("every", 3));
// the length: ffmpeg -i with no output exits 1 and prints the duration
const dur = (() => { try { execFileSync(ff, ["-i", video], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(String(e.stderr)); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 30; } return 30; })();
const times = hand ? JSON.parse(fs.readFileSync(path.join(hand, "times.json"), "utf8")).filter((t) => t < dur - 0.1) : Array.from({ length: Math.floor((dur - 0.3) / every) + 1 }, (_, i) => +(0.3 + i * every).toFixed(2));
const dir = path.join(out, "frames"); fs.mkdirSync(dir, { recursive: true });
times.forEach((t, i) => execFileSync(ff, ["-y", "-loglevel", "error", "-ss", String(t), "-i", video, "-frames:v", "1", path.join(dir, `f_${String(i).padStart(3, "0")}.png`)]));
fs.writeFileSync(path.join(dir, "times.json"), JSON.stringify(times));
const file = path.join(out, hand ? "compare.jpg" : "sheet.jpg");
sheet(ff, hand ?? dir, hand ? dir : null, file, times);
console.log(file);
