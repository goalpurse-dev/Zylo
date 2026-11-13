// STUDIO MODE (dev driver): a SIDE-BY-SIDE contact sheet of our finals and a reference video at the same frame spacing
// (one frame every --every seconds, each pair / triple labelled with the time), for study only. The reference is read,
// never copied or committed; the sheet goes to --out (a scratch folder). Local ffmpeg, free.
//   node dev/studio/sideBySide.mjs --ours <final.mp4> --ref <reference.mp4> --out <sheet.jpg> [--every 1.5] [--cols 6]
//   node dev/studio/sideBySide.mjs --videos <a.mp4>,<b.mp4>,<ref.mp4> --labels v3,v4,ref --out <sheet.jpg> [--every 1.5] [--cols 4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const videos = arg("videos") ? arg("videos").split(",") : [arg("ours"), arg("ref")];
const labels = arg("labels") ? arg("labels").split(",") : arg("videos") ? videos.map((_, i) => `#${i + 1}`) : ["ours", "ref"];
const out = arg("out"), every = Number(arg("every", 1.5)), cols = Number(arg("cols", videos.length > 2 ? 4 : 6));
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const n = Math.floor(Math.min(...videos.map(dur)) / every);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbs-"));
const frame = (src, t, f, label) => {
  const txt = path.join(dir, `${path.basename(f)}.txt`); fs.writeFileSync(txt, label);
  const tf = txt.replace(/\\/g, "/").replace(":", "\\:");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", src, "-frames:v", "1", "-vf", `scale=180:320,pad=180:344:0:0:#111111,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':textfile='${tf}':fontcolor=white:fontsize=13:x=5:y=326`, f]);
};
const groups = [];
for (let i = 0; i < n; i++) {
  const t = i * every + 0.2, p = path.join(dir, `p${String(i).padStart(3, "0")}.jpg`);
  const fs_ = videos.map((v, k) => { const f = path.join(dir, `f${i}_${k}.jpg`); frame(v, t, f, `${labels[k]} ${t.toFixed(1)} s`); return f; });
  execFileSync("ffmpeg", ["-v", "error", "-y", ...fs_.flatMap((f) => ["-i", f]), "-filter_complex", `${fs_.map((_, k) => `[${k}]`).join("")}hstack=inputs=${fs_.length},pad=iw+12:ih:0:0:#333333`, p]);
  groups.push(p);
}
const rows = Math.ceil(groups.length / cols);
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", path.join(dir, "p%03d.jpg"), "-vf", `tile=${cols}x${rows}:color=#111111`, "-frames:v", "1", out]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${groups.length} groups of ${videos.length} (one every ${every} s) -> ${out}`);
