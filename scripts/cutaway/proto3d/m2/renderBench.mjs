// M3: the render cost of a finished run's page, per option, measured on this machine (free): seconds per frame with
// the GPU and with software WebGL (SwiftShader, what a CPU-only server runs), at 1080p and 720p, full and lite
// quality, one Chrome or several in parallel.
//   node m2/renderBench.mjs <runDir> --proto PROTO --ff FFMPEG [--secs 2] [--parallel 4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compile } from "./compile.mjs";
import { preparePage, runProcess } from "./make.mjs";
import { speechEnd } from "../speechEnd.mjs";

const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const run = argv[0], proto = arg("proto"), ff = arg("ff"), secs = Number(arg("secs", 2)), par = Number(arg("parallel", 4));
const acc = path.join(run, "steps", "accepted_layout.json"), layout = JSON.parse(fs.readFileSync(fs.existsSync(acc) ? acc : path.join(run, "layout.json"), "utf8"));
const voice = path.join(run, "voice", "voice.mp3"), words = JSON.parse(fs.readFileSync(path.join(run, "voice", "voice.words.json"), "utf8"));
const tl = compile(layout, words, speechEnd(ff, voice), { roles: layout.roles });
preparePage({ layout, tl, proto });
const out = path.join(os.tmpdir(), "m2bench"); fs.mkdirSync(out, { recursive: true });
const frames = Math.round(secs * 30);
async function one(name, query, soft, n = 1) {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: n }, (_, i) => runProcess(process.execPath, [path.join(proto, "render.mjs"), ff, path.join(out, `${name}_${i}.mp4`), String(secs), "30"], { cwd: proto, env: { ...process.env, PAGE: `m2_${layout.key}.html${query}`, ...(soft ? { SOFTWARE_GL: "1" } : {}) } })));
  const s = (Date.now() - t0) / 1000;
  // the page load (about 3-6 s) is in the time: measured once per Chrome, so per frame is (total - load) / frames
  return { name, chromes: n, frames: frames * n, seconds: +s.toFixed(1), perFrame: +(s / (frames * n)).toFixed(3) };
}
const rows = [];
for (const [name, q, soft] of [["gpu_1080", "", false], ["cpu_1080", "", true], ["cpu_1080_lite", "?lite=1", true], ["cpu_720", "?res=720", true], ["cpu_720_lite", "?res=720&lite=1", true]]) { rows.push(await one(name, q, soft)); console.log(JSON.stringify(rows.at(-1))); }
rows.push(await one(`cpu_1080_x${par}`, "", true, par)); console.log(JSON.stringify(rows.at(-1)));
rows.push(await one(`cpu_720_lite_x${par}`, "?res=720&lite=1", true, par)); console.log(JSON.stringify(rows.at(-1)));
fs.writeFileSync(path.join(run, "render_bench.json"), JSON.stringify({ cpus: os.cpus().length, cpu: os.cpus()[0]?.model, secs, rows }, null, 1));
console.log(os.cpus()[0]?.model, os.cpus().length, "threads");
