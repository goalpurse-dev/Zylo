// IN THIS TOWN v2, OVERNIGHT BUILD 2: SHORT LOW-QUALITY TEST CLIPS (camera moves, acting) from a list of place-test
// rows, silent, ~2.5 s each, 30 % resolution, 6 samples; one RunPod render job; one mp4 + a strip sheet (3 frames per
// clip). Free mock first. Never opened on the owner's screen.
//   node --env-file=.env.local scripts/blockyWorlds/v2/clipTest.mjs --list <json> --tag moves --yes [--sec 2.5]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
import { CHARACTERS, NEIGHBOURS, EXTRA_SPECS } from "./characters.mjs";
import { allPlaces, loadPlace, placePayload } from "./placeKit.mjs";
import { allProps } from "./places/props.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "night-build");
const TAG = arg("tag", "clips"), OUT = path.join(ROOT, "..", "overnight2", "clips", TAG);
fs.mkdirSync(OUT, { recursive: true });
const L = ledger(path.join(ROOT, "ledger"), { capUsd: Number(arg("night_cap", 18.6)), agentCapUsd: Number(arg("cap", 0.4)) });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const list = JSON.parse(fs.readFileSync(arg("list"), "utf8"));
const SEC = Number(arg("sec", 2.5)), N = list.length;
// one word per clip start (the shots run word to word): a silent track of N * SEC seconds
const words = Array.from({ length: N + 1 }, (_, i) => ({ word: `w${i}`, start: i * SEC, end: i * SEC + 0.4 }));
const places = await allPlaces(), payloads = {};
for (const s of list) if (!payloads[s.place]) payloads[s.place] = placePayload(loadPlace(places[s.place]));
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py", "set_v2.py", "things_v2.py", "giants_v2.py", "acting_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const head = [`ZV_STAGES["A"] = ${py(STAGE_A)}`, `ZV_STAGES["B"] = ${py(STAGE_B)}`, `ZC_SPECS.update(${py({ ...CHARACTERS, ...NEIGHBOURS, ...EXTRA_SPECS })})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`, `ZV_RECIPES.update(${py(allProps())})`,
  ...Object.entries(payloads).map(([id, p]) => `ZV_PLACES[${py(id)}] = ${py(p)}`)];
const call = (s) => `zv_place_test(${py(s.place)}, ${py(s.cam)}, ${py(s.time ?? "night")}, ${py(s.weather ?? "clear")}, t0, t1, ${py(s.opt ?? {})})`;
// the free mock
fs.writeFileSync(path.join(OUT, "mock_head.py"), head.join("\n"));
fs.writeFileSync(path.join(OUT, "mock_calls.py"), list.map((s) => `t0, t1 = 1.0, 2.0\n${call(s)}`).join("\n"));
const mk = spawnSync("python", ["-I", path.join(HERE, "mockSet.py"), path.join(OUT, "mock_head.py"), path.join(OUT, "mock_calls.py")], { encoding: "utf8" });
if (mk.status) { say(`mock FAILED:\n${(mk.stderr || mk.stdout).slice(-1200)}`); process.exit(1); }
say(`mock ok: ${mk.stdout.trim().split("\n").pop()}`);
const src = [`"""In This Town v2: test clips ${TAG}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", ...head, "ZW_PREVIEW.update(pct=30, samples=6)", "",
  ...list.map((s, k) => `@S(${k + 1}, ${k}, ${k + 1 < N ? k + 1 : "None"}, ${JSON.stringify(s.opt?.label ?? s.cam)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n    ${call(s)}\n`)].join("\n");
const PV = path.join(OUT, "render");
fs.mkdirSync(path.join(PV, "video", "audio"), { recursive: true });
const segs = path.join(PV, "segments"); fs.mkdirSync(segs, { recursive: true });
const sc = staticCheck(src, path.join(PV, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 5))}`); process.exit(1); }
fs.writeFileSync(path.join(PV, "video", "shots.py"), src);
fs.writeFileSync(path.join(PV, "video", "audio", "words.json"), JSON.stringify(words));
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(N * SEC + 0.5), path.join(PV, "video", "audio", "voice.wav")]);
fs.writeFileSync(path.join(PV, "video", "script.txt"), "clips\n");
const frames = shotFrames(src, words);
const groups = splitShots(frames, 1);
const vlimit = (g) => Math.ceil(g.n * 0.7) + 60 * g.ids.length + 300;
const worst = groups.reduce((a, g) => a + (vlimit(g) + BOOT_S) * RATE, 0);
say(`${N} clips, ${groups.reduce((a, g) => a + g.n, 0)} frames; worst case $${worst.toFixed(3)}; spent $${L.total()}`);
if (!has("yes")) process.exit(0);
L.check("test clips", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-clips-${TAG}-${Date.now().toString(36)}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(PV, "v.tgz"), path.join(PV, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(PV, "v.tgz"), "application/gzip");
const url = await R.signGet("v.tgz");
const g = groups[0];
const r = await R.job(`clips ${TAG} (${g.n} frames)`, { role: "render", slug: "preview", videoUrl: url, shots: g.ids.join(","), f0: g.f0, f1: g.f1, samples: 6, upload: await R.signPuts("seg0.mp4", 4) }, { maxRunSec: vlimit(g), ledgerKey: "runpod_clips" });
if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 500)}`); process.exit(1); }
await R.fetchParts("seg0.mp4", r.output.upload.parts, path.join(segs, "seg0.mp4"));
await R.cleanup().catch(() => {});
const mp4 = path.join(OUT, `${TAG}_lowq.mp4`);
fs.copyFileSync(path.join(segs, "seg0.mp4"), mp4);
// the strip sheet: 3 frames per clip (start, middle, end), one row per clip
const fr = path.join(OUT, "frames"); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
let n = 0;
list.forEach((s, k) => [0.15, 0.5, 0.88].forEach((p) => { spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(k * SEC + p * SEC), "-i", mp4, "-frames:v", "1", "-vf", "scale=150:-2", path.join(fr, `f_${String(n++).padStart(3, "0")}.png`)]); }));
spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "0", "-i", path.join(fr, "f_%03d.png"), "-vf", `tile=9x${Math.ceil(n / 9)}:color=black`, "-frames:v", "1", path.join(ROOT, "..", "overnight2", `sheet_clips_${TAG}.jpg`)]);
say(`clips: ${mp4} (exec ${r.execS} s); sheet overnight2/sheet_clips_${TAG}.jpg; spent $${L.total()}`);
