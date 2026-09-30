// Downloads every 3e clip and makes a frame strip per clip (2 fps, 5 per row)
// with a portable ffmpeg, so the clips can be judged frame by frame.
//   node scripts/fruit-story/frames3e.mjs <outDir> <ffmpegPath>
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT } from "./lib.mjs";

const [outDir, ffmpeg] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3e-results.json`, "utf8"));
const clips = [
  ...r.v2.map((c) => ({ key: `v2-scene${c.idx + 1}`, url: c.clipUrl })),
  ...(r.v4?.clipUrl ? [{ key: "v4-scene3", url: r.v4.clipUrl }] : []),
  ...r.bakeoff.filter((b) => b.clipUrl).map((b) => ({ key: `bakeoff-${b.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, url: b.clipUrl })),
];
fs.mkdirSync(path.join(outDir, "clips"), { recursive: true });
for (const c of clips) {
  const mp4 = path.join(outDir, "clips", `${c.key}.mp4`);
  if (!fs.existsSync(mp4)) fs.writeFileSync(mp4, Buffer.from(await (await fetch(c.url)).arrayBuffer()));
  const sheet = path.join(outDir, `${c.key}-frames.jpg`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=2,scale=200:-1,tile=5x2", "-frames:v", "1", sheet]);
  console.log(c.key, (fs.statSync(mp4).size / 1e6).toFixed(2) + " MB", sheet);
}
