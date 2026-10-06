// Frame sheets for the lip-sync test clips, with a portable ffmpeg, so each
// clip can be judged frame by frame: a strip of the whole frame every 0.5 s,
// and a sheet of the top half of the frame (the faces) every 0.2 s.
//   node scripts/blocky/framesTest1.mjs <ffmpegPath>
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT } from "../fruit-story/lib.mjs";

const [ffmpeg] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/test1");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
for (const row of Object.values(r.items)) {
  if (!row.clip?.file) continue;
  const mp4 = path.join(dir, row.clip.file);
  const run = (vf, name) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", mp4, "-vf", vf, "-frames:v", "1", "-q:v", "3", path.join(dir, "frames", name)]);
  run("fps=2,scale=200:-1,tile=5x2", `${row.key}-strip.jpg`);
  run("fps=5,crop=iw:ih*0.55:0:0,scale=288:-1,tile=5x5", `${row.key}-faces.jpg`);
  console.log(row.key, (fs.statSync(mp4).size / 1e6).toFixed(2) + " MB");
}
