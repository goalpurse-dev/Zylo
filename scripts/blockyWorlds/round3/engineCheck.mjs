// ROUND 3: a tiny GPU check of the living world before any paid story step (4 stills, ~$0.01): a busy day, dusk with
// people hurrying home + headlights, the empty "nobody outside" night, a threat reaction with faces at windows.
//   node --env-file=.env.local scripts/blockyWorlds/round3/engineCheck.mjs --out <dir> [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { compileScene } from "../blenderKit/cards.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); const dir = path.join(OUT, "engine_check"); fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const L = ledger(OUT, { capUsd: 2, agentCapUsd: 2 });
const plan = { cast: [{ name: "Mia", kid: true, skin: "#f1dfc6", shirt: "#ff6fa8", pants: "#2f3f7a", hair: "bun", hair_color: "#3a2418", face: "girl" }, { name: "Mom", kid: false, skin: "#f1dfc6", shirt: "#2ab3a8", pants: "#3a3a4a", hair: "bob", hair_color: "#e2581f", face: "girl" }], monster: { present: false } };
const P = (who, mark, pose, face) => ({ who, mark, pose, face, looks_at: "camera" });
const fr = (place, time, cam, people) => ({ place, time, camera: { type: cam, side: "front" }, people, props: [] });
const W = (o) => ({ busy: "busy", walkers: "walking", extras: [], cars: "driving", windows: "lit", curtains: "open", threat: "none", outside: ["Mia", "Mom"], ...o });
const tests = [
  { name: "day busy", card: { start: fr("suburb_street", "day", "wide", [P("Mia", "center", "wave", "happy")]), end: fr("suburb_street", "day", "wide", [P("Mia", "center", "wave", "happy")]), motion: [] }, world: { time: "day", ...W({ extras: ["pairs", "bags", "kids_playing", "dogs", "birds"] }) } },
  { name: "dusk hurrying", card: { start: fr("downtown_street", "sunset", "wide", [P("Mom", "center", "walk", "scared")]), end: fr("downtown_street", "sunset", "wide", [P("Mom", "right", "walk", "scared")]), motion: [] }, world: { time: "sunset", ...W({ busy: "normal", walkers: "hurrying", windows: "some" }) } },
  { name: "night empty", card: { start: fr("suburb_street", "night", "wide", [P("Mia", "center", "stand", "scared")]), end: fr("suburb_street", "night", "medium", [P("Mia", "center", "stand", "terrified")]), motion: [] }, world: { time: "night", ...W({ busy: "empty", walkers: "none", cars: "parked", windows: "dark", curtains: "closed", outside: ["Mia"] }) } },
  { name: "night react + windows", card: { start: fr("suburb_street", "night", "wide", [P("Mia", "center", "stand", "shocked")]), end: fr("suburb_street", "night", "wide", [P("Mia", "left", "run", "terrified")]), motion: [{ on_word: 0, who: "Mia", action: "run_away", target: "" }] }, world: { time: "night", ...W({ busy: "normal", walkers: "walking", extras: ["people_at_windows"], cars: "driving", windows: "some", threat: "react" }) } },
];
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const N = tests.length;
const src = ['"""Round 3 engine check"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
  ...tests.map((x, k) => `@S(${k + 1}, ${2 * k}, ${k + 1 < N ? 2 * (k + 1) : "None"}, ${JSON.stringify(x.name)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${compileScene(x.card, { plan, scene: { start: 0, end: 2, wordList: [{ word: "x", start: 0 }] }, world: x.world }).split("\n").map((l) => `    ${l}`).join("\n")}\n`)].join("\n");
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 5))); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "engine check\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 40 + 300;
console.log(`engine check: ${N} stills, worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; spent $${L.total()}`);
if (!has("yes")) process.exit(0);
L.check("engine check", (limit + BOOT_S) * RATE);
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round3-check-${Date.now().toString(36)}`, log: console.log });
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
const r = await R.job(`round3 engine check`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: tests.map((_, k) => k + 1).join(","), perSheet: 10, cols: 4, samples: 12, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_preview" });
if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(String(r.error).slice(0, 600)); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
await R.cleanup().catch(() => {});
py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ failed: r.output.failed ?? {}, gate: r.output.gate ?? [] }, null, 1));
console.log(JSON.stringify({ failed: Object.fromEntries(Object.entries(r.output.failed ?? {}).map(([k, v]) => [k, String(v).split("\n").filter(Boolean).slice(-3).join(" ").slice(0, 400)])), spent: L.total() }, null, 1));
