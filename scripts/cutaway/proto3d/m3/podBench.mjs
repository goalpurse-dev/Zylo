// M3, on the GPU machine: the render speed with the flags gpuCheck picked. 60 frames (seconds per frame, after the
// page load), then the whole video (its timeline length, end card included), each timed. Writes bench.json.
//   CHROME_PATH=... node m3/podBench.mjs <page key> <length s> <gpucheck.json> <out.json>
import fs from "node:fs";
import { spawn } from "node:child_process";
import { FLAG_SETS } from "./flags.mjs";

const [key, lengthSec, checkFile, out] = process.argv.slice(2);
const check = JSON.parse(fs.readFileSync(checkFile, "utf8"));
const args = FLAG_SETS[check.pick ?? "default"];
const run = (secs, file) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, ["render.mjs", "ffmpeg", file, String(secs), "30"], { env: { ...process.env, PAGE: `m2_${key}.html`, CHROME_ARGS: JSON.stringify(args) }, stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (code) => (code === 0 ? resolve((Date.now() - t0) / 1000) : reject(new Error(`render exited ${code}`))));
});
const rows = {};
// the page load is in each run: a 1-frame run measures it, then 60 frames and the whole video
rows.load = await run(1 / 30, "/tmp/one.mp4");
rows.frames60 = await run(2, "/tmp/sixty.mp4");
rows.perFrame = +((rows.frames60 - rows.load) / 59).toFixed(4);
// the whole video only on the GPU (in software it would take an hour)
if (check.pick) {
  rows.fullSeconds = await run(Number(lengthSec), "/work/full.mp4");
  rows.fullFrames = Math.round(Number(lengthSec) * 30);
  rows.fullPerFrame = +((rows.fullSeconds - rows.load) / rows.fullFrames).toFixed(4);
}
const res = { flags: check.pick, renderer: check.rows.find((r) => r.name === check.pick)?.renderer ?? null, ...rows };
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
