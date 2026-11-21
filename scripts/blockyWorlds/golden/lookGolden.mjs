// THE LOOK GOLDEN STILLS (owner 2026-11-21): the 3 golden look stories (lookShots.mjs) as preview stills on the Blender
// endpoint, with a chosen world library: --lib <worlds.py> (default: the working copy). One GPU job, the kit's preview
// mode (middle frame, 25 %); priced first on its own ledger (--cap, default $0.30). Also saves each shot's Blender log
// lines (the ZW_GATE framing / monster verdicts) in gate.json.
//   node --env-file=.env.local scripts/blockyWorlds/golden/lookGolden.mjs --variant before|after --out <new dir> [--lib <worlds.py>] [--samples 16] [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { goldenShots } from "./lookShots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const variant = arg("variant", "after");
const OUT = path.resolve(arg("out"));
if (fs.existsSync(path.join(OUT, "result.json"))) throw new Error(`${OUT} already has a result: give a new folder`);
fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: Number(arg("cap", 0.3)), agentCapUsd: 0 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "golden.log"), l + "\n"); };
const lib0 = fs.readFileSync(path.resolve(arg("lib", path.join(HERE, "..", "blenderKit", "worlds", "worlds.py"))), "utf8");
// --gate-lib <file>: the round-1 measuring functions appended to an OLD library (a before run measured by the new gate)
const lib = has("gate-lib") ? `${lib0}
${fs.readFileSync(path.resolve(arg("gate-lib")), "utf8")}` : lib0;
fs.writeFileSync(path.join(OUT, "worlds.py"), lib);
// + one REPORT shot per golden shot (free: it raises before rendering): the same body, then the framing gate's lines in
// its error text, because the kit's render log keeps only the error text of a shot (the worker's output.gate needs an
// image rebuild)
const gold = goldenShots(variant);
const reportBody = (s, i) => [s.body, ...(s.story === "monster" ? [`ZW_MON["Monster"] = m`] : []), `raise RuntimeError("ZW_REPORT " + " || ".join(zw_gate(dict(id=${i + 1}, t0=t0, t1=t1))))`].join("\n");
const shots = [...gold, ...gold.map((s, i) => ({ ...s, report: i + 1, desc: `report ${i + 1}`, body: reportBody(s, i) }))];
const N = shots.length;
const indent = (b) => b.split("\n").map((l) => `    ${l}`).join("\n");
const src = [`"""Look golden stills (${variant})."""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", lib, "",
  ...shots.map((s, i) => `@S(${i + 1}, ${i}, ${i + 1 < N ? i + 1 : "None"}, ${JSON.stringify(s.desc)})\ndef s${String(i + 1).padStart(2, "0")}(t0, t1):\n${indent(s.body)}\n`)].join("\n");
const vdir = path.join(OUT, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
const sc = staticCheck(src, path.join(vdir, "shots.py"));
if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 10), null, 1)); process.exit(1); }
// each shot 2 s of silence (a word a second): the preview is the middle frame
const words = Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }));
fs.writeFileSync(path.join(vdir, "shots.py"), src.replace(/@S\((\d+), (\d+), (\w+),/g, (_, id, a, b) => `@S(${id}, ${2 * Number(a)}, ${b === "None" ? "None" : 2 * Number(b)},`));
fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(vdir, "script.txt"), "golden look stills\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(vdir, "audio", "voice.wav")]);
const limit = N * 20 + 240;
const worst = (limit + BOOT_S) * RATE;
say(`look golden (${variant}): ${N} shots in 1 job; static check ok; worst case $${worst.toFixed(3)}; spent $${L.total()} of $${L.capUsd}`);
if (!has("yes")) { say("dry run: nothing sent (add --yes)"); process.exit(0); }
L.check("look golden stills", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/look-${variant}-${Date.now().toString(36)}`, log: say });
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
const url = await R.signGet("v.tgz");
const r = await R.job(`look ${variant} (${N})`, { role: "preview", slug: "golden", videoUrl: url, shots: shots.map((_, i) => i + 1).filter((id) => !has("reports-only") || id > gold.length).join(","), perSheet: 9, cols: 9, samples: Number(arg("samples", 16)), upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_preview" });
if (!r.ok) { await R.cleanup().catch(() => {}); say(`job failed: ${String(r.error).slice(0, 600)}`); process.exit(1); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(OUT, "p.tgz"));
await R.cleanup().catch(() => {});
py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(OUT, "p.tgz"), OUT);
// the gate lines per shot from the kit's log (printed by worlds.py's after-build hook)
const log = fs.existsSync(path.join(OUT, "render_log_preview.txt")) ? fs.readFileSync(path.join(OUT, "render_log_preview.txt"), "utf8").split("\n") : [];
const gate = [...log.filter((l) => l.startsWith("ZW_GATE|") || l.startsWith("ZW_LOOK|")), ...(r.output.gate ?? []),
  ...Object.values(r.output.failed ?? {}).flatMap((t) => (String(t).match(/RuntimeError: ZW_REPORT (.*)/)?.[1] ?? "").split(" || ").filter(Boolean))];
fs.writeFileSync(path.join(OUT, "gate.json"), JSON.stringify(gate, null, 1));
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(gold.map((s, i) => ({ id: i + 1, story: s.story, kind: s.kind, desc: s.desc })), null, 1));
const failed = Object.fromEntries(Object.entries(r.output.failed ?? {}).filter(([k]) => Number(k) <= gold.length));
say(`done: ${gold.length - Object.keys(failed).length}/${gold.length} rendered${Object.keys(failed).length ? `; failed: ${Object.entries(failed).map(([k, v]) => `${k}: ${String(v).split("\n").pop()}`).join(" | ")}` : ""}; build+render ${r.output.renderS} s; spent $${L.total()}`);
for (const g of gate) say(g);
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ failed, renderS: r.output.renderS, total: L.total(), gate }, null, 1));
