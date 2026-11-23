// IN THIS TOWN v2, step 1: THE STAGE TEST SHEET. Every named camera of a stage x day / night, its spots filled with two
// dummy people (+ its creature), rendered as stills on RunPod; the v2 checks (stage_v2.py zv_gate) per still; one
// labelled contact sheet for the owner. Free code check first (stageCheck.mjs): nothing renders if it fails.
//   node --env-file=.env.local scripts/blockyWorlds/v2/stageTest.mjs --out <dir> [--yes] [--cap 0.5] [--times day,night]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { STAGE_A } from "./stageA.mjs";
import { checkStage } from "./stageCheck.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out", path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "step1")));
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 0.5));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };

const SOLVED = path.join(HERE, "stageA.solved.json");
const S = fs.existsSync(SOLVED) ? { ...STAGE_A, cameras: JSON.parse(fs.readFileSync(SOLVED, "utf8")) } : STAGE_A;
const free = checkStage(S);
if (free.problems.length) { say(`free check FAILED: ${free.problems.join(" | ")}`); process.exit(1); }
say(`free check: ok (${Object.keys(S.spots).length} spots, ${Object.keys(S.cameras).length} cameras)`);

const TIMES = String(arg("times", "day,night")).split(",");
const LOOKS = { Kid: { kid: true, skin: "#F2C9A0", shirt: "#FF3B30", pants: "#1E3A8A", hair: "messy", hair_color: "#3B2314", face: "hero" },
  Dad: { kid: false, skin: "#C68642", shirt: "#FFD60A", pants: "#2F4F4F", hair: "short", hair_color: "#1A1A1A", face: "mustache" } };
const stills = Object.keys(S.cameras).flatMap((cam) => TIMES.map((time) => ({ cam, time })));
const N = stills.length;
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = fs.readFileSync(path.join(HERE, "stage_v2.py"), "utf8");
const B = 60;
const src = [`"""In This Town v2 step 1: stage ${S.id} test sheet"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES[${py(S.id)}] = ${py(S)}`, `ZV_LOOKS = ${py(LOOKS)}`, "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...stills.map((x, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`${x.cam} ${x.time}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n    zv_test_shot(${py(S.id)}, ${py(x.cam)}, ${py(x.time)}, t0, t1, ZV_LOOKS)\n`)].join("\n");
const dir = path.join(OUT, "render");
fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 5))}`); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "stage test\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 30 + 300;
say(`${N} stills; worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; cap $${CAP}`);
let r, wall;
if (has("reuse")) { r = JSON.parse(fs.readFileSync(path.join(dir, "output.json"), "utf8")); wall = r.wallSec; }
else {
if (!has("yes")) { say("dry run: static check ok, nothing sent (add --yes)"); process.exit(0); }
L.check("stage test", (limit + BOOT_S) * RATE);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-stage${S.id}-${Date.now().toString(36)}`, log: say });
const t0 = Date.now();
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
r = await R.job(`v2 stage ${S.id} (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: stills.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 16, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_stage" });
if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 400)}`); process.exit(1); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
await R.cleanup().catch(() => {});
pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
wall = ((Date.now() - t0) / 1000).toFixed(0);
fs.writeFileSync(path.join(dir, "output.json"), JSON.stringify({ ...r, wallSec: Number(wall) }));
}
// the checks per still
const gate = (r.output.gate ?? []).map(String);
fs.writeFileSync(path.join(OUT, "gate.txt"), gate.join("\n"));
const rows = stills.map((x, k) => {
  const id = k + 2;
  const mine = gate.filter((g) => g.split("|")[1] === String(id));
  const fails = mine.filter((g) => g.split("|")[2] === "zv").map((g) => g.split("|").slice(3).join(" "));
  const png = path.join(dir, "preview", `shot_${String(id).padStart(2, "0")}.png`);
  return { id, ...x, png: fs.existsSync(png) ? png : null, ok: fs.existsSync(png) && !fails.length, fails, crashed: r.output.failed?.[id] ?? null };
});
const dims = gate.filter((g) => g.includes("|zv_dim|")).map((g) => g.split("|").slice(3));
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ rows, dims, failed: r.output.failed ?? {}, wallSec: Number(wall), spent: L.total() }, null, 1));
// the labelled sheet (5 across): camera, time, PASS / what failed
const lab = path.join(OUT, "labelled"); fs.mkdirSync(lab, { recursive: true });
const esc = (s) => s.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "").replace(/%/g, " pct");
for (const x of rows) {
  if (!x.png) continue;
  const t1 = `${x.id - 1}. ${x.cam} / ${x.time}`, t2 = x.ok ? "CHECKS PASS" : `FAIL: ${x.fails.join("; ")}`.slice(0, 70);
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", x.png, "-vf", `scale=360:640,drawbox=y=0:w=iw:h=64:color=black@0.7:t=fill,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(t1)}':x=8:y=8:fontsize=18:fontcolor=white,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${esc(t2)}':x=8:y=36:fontsize=13:fontcolor=${x.ok ? "0x7CFC00" : "0xFF6060"}`, path.join(lab, `l_${String(x.id).padStart(3, "0")}.png`)]);
}
spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "2", "-i", path.join(lab, "l_%03d.png"), "-vf", "tile=5x4", "-frames:v", "1", path.join(OUT, `sheet_stage${S.id}.jpg`)]);
const pass = rows.filter((x) => x.ok).length;
say(`stage ${S.id}: ${pass}/${N} stills pass the v2 checks; wall ${wall} s (upload to stills back); RunPod job exec ${r.execS ?? "?"} s; spent $${L.total()}`);
say(`sheet: ${path.join(OUT, `sheet_stage${S.id}.jpg`)}`);
