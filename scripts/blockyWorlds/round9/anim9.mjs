// ROUND 9b: A SHORT LOW-QUALITY CLIP OF ONLY THE NEW ANIMATIONS (owner: "dad's run, the kid's chalk run, the drawing,
// the wash-away, the monster's walk, the invisible wall"), each ~2 s on the same street, one GPU chunk (~$0.05).
//   node --env-file=.env.local scripts/blockyWorlds/round9/anim9.mjs --out reference/blocky-worlds/round9/replica/anim --yes
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { compileTakes, lockLooks, applyCard, initialState } from "../blenderKit/takes.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: 0.25, agentCapUsd: 0.25 });
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
if (!has("yes")) { say("anim: dry run (add --yes)"); process.exit(0); }

const LABELS = ["dad's panic run in the rain", "dad draws the house line (crouched)", "the line washes away in the rain", "the monster's walk", "the kid's bent-over chalk run", "the invisible wall", "the kid's sprint"];
const DUR = 2.3;
const lines = LABELS.map((t, i) => { const ws = Array.from({ length: 8 }, (_, j) => ({ word: `w${i}_${j}`, start: +(i * DUR + j * (DUR / 8)).toFixed(3) })); return { text: ws.map((w) => w.word).join(" "), speaker: "narrator", start: i * DUR, end: i * DUR + DUR - 0.05, next: (i + 1) * DUR, w0: i * 8, words: ws }; });
const plan = {
  title: "new animations", house_rings: true, low_houses: true,
  cast: [{ name: "Me", kid: true, hair: "spiky", hair_color: "#d4381c", shirt: "#d62a1e", pants: "#c42a1c" }, { name: "Dad", kid: false, hair: "short", shirt: "#f4f4f4", pants: "#7fa8e0", style: "dad" }],
  monster: { present: true, style: "shadow", size: 4 },
  stage: { suburb_street: { camera_side: "front", marks: { Me: "@-3,7", Dad: "@-5,12", "chalk#dad": "@-5,12", "chalk#me": "@-3,7" } } },
  scenes: [[1, 1, "storm"], [2, 2, "night"], [3, 3, "storm"], [4, 7, "night"]].map(([a, b, t], i) => ({ id: i + 1, lines: [a, b], place: "suburb_street", time: t, busy: "empty" })),
  props: [{ kind: "chalk", size: 0.8 }],
};
const A_ = (who, d, o = {}) => ({ who, do: d, target: "", to: "", text: "", on_word: 0, ...o });
const CARDS = [
  { actions: [A_("dad", "run_to", { to: "@6,11", text: "panic" })], cuts: [{ from_word: 0, shot: "medium", show: ["dad"], move: "track" }] },
  { actions: [A_("dad", "draw_line", { target: "chalk_line#house" })], cuts: [{ from_word: 0, shot: "medium", show: ["dad"], move: "push_in" }] },
  { actions: [A_("chalk_line#house", "wash_away", { target: "chalk_line#house" })], cuts: [{ from_word: 0, shot: "high", show: ["chalk_line#house"], move: "push_in" }] },
  { actions: [A_("monster", "enter", { to: "@4,1.5" })], cuts: [{ from_word: 0, shot: "low", show: ["monster"], move: "track" }] },
  { actions: [A_("me", "draw_around", { target: "monster" })], cuts: [{ from_word: 0, shot: "wide", show: ["monster", "me"], move: "push_in" }] },
  { actions: [A_("monster", "hit_wall", { on_word: 3 })], cuts: [{ from_word: 0, shot: "legs", show: ["monster", "chalk_line#monster"], move: "push_in" }] },
  { actions: [A_("me", "run_to", { to: "@-6,6", text: "sprint" })], cuts: [{ from_word: 0, shot: "medium", show: ["me"], move: "track" }] },
];
const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);
let S = initialState(plan);
const states = [], cards = [];
CARDS.forEach((c, i) => { states[i + 1] = S; const r = applyCard(S, { ...c, line: i + 1 }, { place: sceneOf(i + 1).place, line: lines[i], plan }); if (r.problems.length) throw new Error(`card ${i + 1}: ${r.problems.join(" | ")}`); cards.push({ ...c, line: i + 1, faces: {}, actions: r.applied }); S = r.state; });
states[cards.length + 1] = S;
const T = compileTakes({ plan, cards, states, lines, looks: lockLooks(plan.cast) });
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py", "worlds/stage9.py", "worlds/stage9b.py", "worlds/stage9c.py", "worlds/stage9d.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const tw = lines.flatMap((l) => l.words.map((w) => ({ word: w.word, start: w.start, end: w.start + 0.2 })));
const src = ['"""Round 9b new animations"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "", "ZW_PREVIEW.update(pct=30, samples=6)", "", ...Object.values(T.takes), "",
  ...T.shots.map((s) => `@S(${s.id}, ${s.w0}, ${s.w1 ?? "None"}, ${JSON.stringify(LABELS[s.line - 1])})\ndef s${String(s.id).padStart(3, "0")}(t0, t1):\n    H = take_${s.scene}(0.0)\n    ${T.cutCall(s)}\n`)].join("\n");
const dir = path.join(OUT, "video"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "shots.py"));
if (!sc.ok) throw new Error(JSON.stringify(sc.problems.slice(0, 5)));
fs.writeFileSync(path.join(dir, "shots.py"), src);
fs.writeFileSync(path.join(dir, "audio", "words.json"), JSON.stringify(tw));
fs.writeFileSync(path.join(dir, "script.txt"), "anim\n");
const total = lines.length * DUR;
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(total + 0.5), path.join(dir, "audio", "voice.wav")]);
if (has("check-only")) { say(`anim: static check ok (${T.shots.length} shots), not sent`); process.exit(0); }
const frames = shotFrames(src, tw);
const g = splitShots(frames, 1)[0];
const limit = Math.ceil(g.n * 0.7) + 60 * g.ids.length + 300;
L.check("anim", (limit + BOOT_S) * RATE);
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round9b-anim-${Date.now().toString(36)}`, log: say });
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), dir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
const r = await R.job(`anim (${g.n} frames)`, { role: "render", slug: "preview", videoUrl: await R.signGet("v.tgz"), shots: g.ids.join(","), f0: g.f0, f1: g.f1, samples: 6, upload: await R.signPuts("anim.mp4", 4) }, { maxRunSec: limit, ledgerKey: "runpod_anim" });
if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`anim failed: ${String(r.error).slice(0, 800)}`); }
await R.fetchParts("anim.mp4", r.output.upload.parts, path.join(OUT, "anim_raw.mp4"));
await R.cleanup().catch(() => {});
// a label on each part
const draw = LABELS.map((t, i) => `drawtext=text='${t.replace(/'/g, "")}':x=(w-text_w)/2:y=h*0.08:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6:enable='between(t,${(i * DUR).toFixed(2)},${((i + 1) * DUR).toFixed(2)})'`).join(",");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(OUT, "anim_raw.mp4"), "-vf", `scale=540:960,${draw}`, "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-an", path.join(OUT, "new_animations.mp4")]);
say(`anim: ${path.join(OUT, "new_animations.mp4")}; spent $${L.total()}`);
