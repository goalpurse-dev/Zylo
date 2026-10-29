// M2: a comparison sheet of two still folders (m2/stills.mjs output, same times): pairs side by side, 4 pairs a row.
//   node m2/sheet.mjs <ffmpeg> <dirA> <dirB> <out.jpg> <t1,t2,...>   (the folders' times.json map times to files)
// With only <dirA> (dirB = "-") it makes a plain contact sheet of A, 6 a row.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function sheet(ff, A, B, out, times, { w = 270, perRow = null } = {}) {
  const pick = (dir, t) => { const T = JSON.parse(fs.readFileSync(path.join(dir, "times.json"), "utf8")); const i = T.reduce((b, x, k) => (Math.abs(x - t) < Math.abs(T[b] - t) ? k : b), 0); return path.join(dir, `f_${String(i).padStart(3, "0")}.png`); };
  const files = times.flatMap((t) => (B ? [pick(A, t), pick(B, t)] : [pick(A, t)]));
  const per = perRow ?? (B ? 8 : 6), h = Math.round((w * 16) / 9);
  while (files.length % per) files.push(null);
  const inputs = [], f = [];
  files.forEach((file, k) => {
    if (file) { inputs.push("-i", file); f.push(`[${inputs.length / 2 - 1}:v]scale=${w}:${h},pad=${w + 6}:${h + 6}:3:3:color=white[s${k}]`); }
    else f.push(`color=white:s=${w + 6}x${h + 6}:d=1[s${k}]`);
  });
  const rows = files.length / per;
  for (let r = 0; r < rows; r++) f.push(`${Array.from({ length: per }, (_, c) => `[s${r * per + c}]`).join("")}hstack=${per}[r${r}]`);
  f.push(rows > 1 ? `${Array.from({ length: rows }, (_, r) => `[r${r}]`).join("")}vstack=${rows}` : "[r0]null");
  execFileSync(ff, ["-v", "error", "-y", ...inputs, "-filter_complex", f.join(";"), "-frames:v", "1", "-q:v", "3", out]);
  return out;
}

if (/sheet\.mjs$/.test(process.argv[1] ?? "")) {
  const [ff, A, B, out, ts] = process.argv.slice(2);
  console.log(sheet(ff, A, B === "-" ? null : B, out, ts.split(",").map(Number)));
}
