// Blender kit engine: tiny MOTION CLIPS of world-library places (proof that background people walk / talk / sit and cars
// drive; stills cannot show it). One `render` job on the Blender endpoint: a generated shots.py (the world library +
// one shot per place spot, 2 s each), the kit's final render (full 1080x1920), one x264 segment downloaded. Priced
// worst-case on its own ledger first (--cap).
//   node worlds/motion.mjs --out <dir> --shots downtown_street:wide,downtown_plaza:wide [--secs 2] [--samples 12] [--cap 0.15] [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../rp.mjs";
import { staticCheck } from "../director.mjs";
import { shotFrames } from "../plan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: Number(arg("cap", 0.15)), agentCapUsd: 0 });
const SECS = Number(arg("secs", 2)), SAMPLES = Number(arg("samples", 12));
const shots = arg("shots", "downtown_street:wide,downtown_plaza:wide").split(",").map((x) => { const [place, spot] = x.split(":"); return { place, spot: spot ?? "wide" }; });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "motion.log"), l + "\n"); };

const lib = fs.readFileSync(path.join(HERE, "worlds.py"), "utf8");
const N = shots.length;
const body = (s) => [`ZW_INFO = zw_build(${JSON.stringify(s.place)}, t0, t1, {})`, "cam = Cam()", `loc, tgt = zw_spot(cam, ${JSON.stringify(s.place)}, ${JSON.stringify(s.spot)}, t0, t1)`,
  "k = chars.kid(3)", "k.pose(t0, loc=(tgt[0], tgt[1], 0), rot=0)", "k.blink(t0, t1)", "k.idle()"].map((l) => `    ${l}`).join("\n");
const src = [`"""World library motion clips."""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", lib, "",
  ...shots.map((s, i) => `@S(${i + 1}, ${i}, ${i + 1 < N ? i + 1 : "None"}, ${JSON.stringify(`${s.place} ${s.spot} motion`)})\ndef s${String(i + 1).padStart(2, "0")}(t0, t1):\n${body(s)}\n`)].join("\n");
const vdir = path.join(OUT, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
const sc = staticCheck(src, path.join(vdir, "shots.py"));
if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 10), null, 1)); process.exit(1); }
const words = Array.from({ length: N }, (_, i) => ({ word: `w${i}`, start: i * SECS, end: i * SECS + SECS - 0.25 }));
fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(vdir, "script.txt"), "motion\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(N * SECS), path.join(vdir, "audio", "voice.wav")]);
const fr = shotFrames(src, words);
const f0 = fr[0].f0, f1 = fr.at(-1).f1, frames = f1 - f0 + 1;
// the limit: 2 s a frame (our heavier worlds; measured 0.66 s on the kit's own scenes) + 60 s a shot build + 120 s encode
const limit = Math.round(frames * 2 + N * 60 + 120);
const worst = (limit + BOOT_S) * RATE;
say(`motion: ${N} shots x ${SECS} s = ${frames} frames (${f0}-${f1}), samples ${SAMPLES}; static check ok; worst case $${worst.toFixed(3)}; spent $${L.total()} of $${L.capUsd}`);
if (!has("yes")) { say("dry run: nothing sent (add --yes)"); process.exit(0); }
L.check("motion (render job)", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/motion-${Date.now().toString(36)}`, log: say });
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
const r = await R.job(`motion (${N} shots)`, { role: "render", slug: "worlds", videoUrl: await R.signGet("v.tgz"), shots: `1-${N}`, f0, f1, samples: SAMPLES, upload: await R.signPuts("motion.mp4", 2) }, { maxRunSec: limit, ledgerKey: "runpod_render" });
if (r.ok) await R.fetchParts("motion.mp4", r.output.upload.parts, path.join(OUT, "motion.mp4"));
await R.cleanup().catch(() => {});
say(r.ok ? `done: ${path.join(OUT, "motion.mp4")} (render ${r.output.renderS} s, ${r.output.sPerFrame} s a frame); spent $${L.total()}` : `FAILED: ${String(r.error).slice(0, 600)}; spent $${L.total()}`);
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ ok: r.ok, output: r.output, error: r.error, total: L.total() }, null, 1));
