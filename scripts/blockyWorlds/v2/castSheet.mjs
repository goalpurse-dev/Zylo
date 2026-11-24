// IN THIS TOWN v2: THE CAST SHEET (one RunPod job of stills): the line-ups for scale, each character's strip
// (turnaround, 12 expressions, poses / the entities' states, size charts) and 4 test scenes on Stage A.
//   node --env-file=.env.local scripts/blockyWorlds/v2/castSheet.mjs [--yes] [--reuse] [--cap 0.6] [--only <strip,...>]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { STAGE_A } from "./stageA.mjs";
import { CHARACTERS, CRITTER_COLOURS, mimicOf, EXPRESSIONS, POSES } from "./characters.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out", path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "cast")));
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 0.8));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const P = (v) => `(${v.join(", ")})`;

const SPECS = { ...CHARACTERS, mimic_mom: mimicOf(CHARACTERS.mom) };
for (const [k, v] of Object.entries(CRITTER_COLOURS)) SPECS[`critter_${k}`] = { ...CHARACTERS.critter, id: `critter_${k}`, colors: v };
const NAME = { me: "Me", sister: "Sis", mom: "Mom", dad: "Dad", mayor: "Mayor", shadow: "Shadow", mimic_mom: "Mimic", critter: "Critter", critter_teal: "CritterT", critter_pink: "CritterP", critter_mustard: "CritterM" };
// a character in the shot (var = its Python name)
const ch = (v, id, { at = [0, 0, 0], rot = 0, expr = null, pose = "stand", badge = true } = {}) => {
  const s = SPECS[id];
  if (s.kind === "critter") return `${v} = ZCritter(${py(NAME[id] ?? id)}, ZC_SPECS[${py(id)}], ${P(at)}, rot=${rot})${expr ? `\n${v}.express(t0, ${py(expr)})` : ""}`;
  return `${v} = ZChar(${py(NAME[id] ?? id)}, ZC_SPECS[${py(id)}], ${P(at)}, rot=${rot}, badge=${badge && s.badge_ok ? "True" : "False"})\n${v}.pose(t0, ${py(pose)})${expr ? `\n${v}.express(t0, ${py(expr)})` : ""}`;
};
const cam = (loc, tgt, lens, focus = null, fstop = null) => `cam = Cam()\ncam.key(t0, ${P(loc)}, ${P(tgt)}, lens=${lens}${focus != null ? `, focus=${focus}, fstop=${fstop}` : ""})`;
const face = (v, dist, lens, side = 0, dz = 0) => `cam = zc_face_cam(t0, ${v}, dist=${dist}, lens=${lens}, side=${side}, dz=${dz})`;
const studio = (time = "day") => `zc_studio(t0, t1, ${py(time)})`;
const S = [];
const add = (strip, label, lines) => S.push({ strip, label, body: lines.filter(Boolean).join("\n") });
// full-body framing from a character's height (world units)
const full = (h, side = 0) => { const d = h * 3.1, a = (side * Math.PI) / 180; return cam([+(Math.sin(a) * d).toFixed(2), +(-Math.cos(a) * d).toFixed(2), +(h * 0.62).toFixed(2)], [0, 0, +(h * 0.5).toFixed(2)], 45); };

// ---- 0 the line-ups (scale): the family + the Mayor; the entities next to Me (front and side)
const FAM = [["dad", -5.6], ["mom", -2.9], ["me", -0.3], ["sister", 1.9], ["mayor", 4.6]];
const ENT = [["me", -3.2], ["mimic_mom", -0.6], ["critter", 1.4], ["shadow", 4.2]];
for (const [lab, grp, side] of [["family + Mayor, front", FAM, 0], ["family + Mayor, side", FAM, 90], ["entities next to Me, front", ENT, 0], ["entities next to Me, side", ENT, 90]]) {
  const tall = grp.some(([id]) => id === "shadow");
  add("lineup", lab, [studio(), ...grp.map(([id, x], i) => ch(`c${i}`, id, { at: [x, 0, 0], rot: side, expr: SPECS[id].mode === "shadow" ? "shadow_stare" : SPECS[id].mode === "mimic" ? "mimic_smile" : "happy", pose: SPECS[id].mode === "mimic" ? "tilt" : "stand" })),
    tall ? cam([0.5, -26, 4.4], [0.5, 0, 4.2], 26) : cam([-0.5, -26, 2.2], [-0.5, 0, 1.75], 26)]);
}
// ---- 1 the main character's fixes: features in profile, the ear, flowing hair, hold-up, a looser crouch
add("me (fixes)", "side close: happy", [studio(), ch("me", "me", { expr: "happy" }), face("me", 5.5, 45, 80)]);
add("me (fixes)", "side close: scared", [studio(), ch("me", "me", { expr: "terrified" }), face("me", 5.5, 45, 80)]);
add("me (fixes)", "side close: angry", [studio(), ch("me", "me", { expr: "angry" }), face("me", 5.5, 45, 65)]);
add("me (fixes)", "back", [studio(), ch("me", "me", { rot: 180 }), full(3.04)]);
add("me (fixes)", "back three-quarter, close", [studio(), ch("me", "me", {}), face("me", 5.8, 40, 150, 0.2)]);
add("me (fixes)", "top", [studio(), ch("me", "me", {}), cam([0, -1.4, 9], [0, 0, 1.2], 40)]);
add("me (fixes)", "hold up (phone)", [studio(), ch("me", "me", { expr: "happy", pose: "hold_up2" }), `me.hold(t0, zc_prop("phone", "zc_phone"), "R", upright=True)`, cam([-2.2, -8.2, 2.4], [0, 0, 1.9], 42)]);
add("me (fixes)", "crouch (looser)", [studio(), ch("me", "me", { expr: "worried", pose: "crouch2" }), full(3.04, 25)]);
// ---- 2 each cast member: turnaround, the 12 expressions, the poses
for (const id of ["sister", "mom", "dad", "mayor"]) {
  const h = SPECS[id].height, strip = id;
  for (const [lab, rot] of [["front", 0], ["three-quarter", 35], ["side", 90], ["back", 180]]) add(strip, lab, [studio(), ch("c", id, { rot }), full(h)]);
  for (const e of EXPRESSIONS) add(strip, e, [studio(), ch("c", id, { expr: e }), face("c", 4.6 * (h / 3.04) ** 0.5, 42)]);
  for (const p of POSES) {
    const pre = p === "sit" ? `box("zc_crate", (1.3, 0.9, ${(h * 0.2).toFixed(2)}), (0, 0.5, ${(h * 0.1).toFixed(2)}), mat("zc_cratem", zc_rgb("#B98A5A"), 0.85), 0.04)` : "";
    const pose = p === "hold" ? "hold_box" : p;
    const prop = p === "hold" ? `c.hold(t0, zc_prop("box", "zc_box"), "both")` : "";
    add(strip, p, [studio(), pre, ch("c", id, { pose, expr: { walk: "happy", run: "scared", sit: "neutral", point: "big_smile", hold: "worried" }[p] ?? "neutral" }), prop, full(h, p === "walk" || p === "run" ? 50 : 25)]);
  }
}
// ---- 3 the Shadow: turnaround, 6 states, size chart
{
  const h = 8.5;
  for (const [lab, rot] of [["front", 0], ["three-quarter", 35], ["side", 90], ["back", 180]]) add("shadow", lab, [studio(), ch("c", "shadow", { rot }), full(h)]);
  add("shadow", "standing", [studio(), ch("c", "shadow", { expr: "shadow_stare" }), cam([2, -22, 4], [0, 0, 4.3], 40)]);
  add("shadow", "leaning down", [studio(), ch("c", "shadow", { expr: "shadow_narrow", pose: "lean" }), cam([6, -20, 3], [0, 0, 4.0], 40)]);
  add("shadow", "reaching", [studio(), ch("c", "shadow", { expr: "shadow_wide", pose: "reach", rot: 25 }), cam([7, -20, 3.4], [0, 0, 4.0], 40)]);
  add("shadow", "peeking round a corner", [studio(), `box("zc_corner", (3.0, 3.0, 12.0), (-1.4, 0.4, 6.0), mat("zc_cornerm", zc_rgb("#6E7686"), 0.9), 0.05)`, ch("c", "shadow", { expr: "shadow_aside", pose: "peek", at: [0.9, 1.1, 0], rot: -20 }), cam([3.5, -15, 5.2], [0.3, 0, 5.6], 38)]);
  add("shadow", "eyes only, in the dark", [`zc_studio(t0, t1, "night")`, `bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.02`, ch("c", "shadow", { expr: "shadow_stare" }), cam([0, -14, 6.4], [0, 0, 7.2], 50)]);
  add("shadow", "narrow eyes, close", [studio("night"), ch("c", "shadow", { expr: "shadow_narrow" }), face("c", 5.0, 50)]);
  add("shadow", "size chart (next to Me)", [studio(), ch("m", "me", { at: [-2.4, 0, 0], expr: "scared" }), ch("c", "shadow", { at: [1.6, 0, 0], expr: "shadow_stare" }), cam([0, -26, 4.4], [0, 0, 4.2], 35)]);
}
// ---- 4 the Mimic (a wrong copy of Mom): turnaround, 6 states, size chart
{
  const h = 3.35;
  for (const [lab, rot] of [["front", 0], ["three-quarter", 35], ["side", 90], ["back", 180]]) add("mimic (of Mom)", lab, [studio(), ch("c", "mimic_mom", { rot, pose: "tilt" }), full(h)]);
  add("mimic (of Mom)", "smile too wide", [studio(), ch("c", "mimic_mom", { expr: "mimic_smile" }), face("c", 4.8, 42)]);
  add("mimic (of Mom)", "stare (never blinks)", [studio(), ch("c", "mimic_mom", { expr: "mimic_stare" }), face("c", 4.8, 42)]);
  add("mimic (of Mom)", "head tilted too far", [studio(), ch("c", "mimic_mom", { expr: "mimic_grin", pose: "tilt" }), face("c", 5.4, 40)]);
  add("mimic (of Mom)", "almost right", [studio(), ch("c", "mimic_mom", { expr: "mimic_copy" }), face("c", 4.8, 42)]);
  add("mimic (of Mom)", "too still", [studio("night"), ch("c", "mimic_mom", { expr: "mimic_stare", pose: "stand" }), `c.pose(t0, "stand", {"shoulderL": (0, 0, 0), "shoulderR": (0, 0, 0), "elbowL": (0, 0, 0), "elbowR": (0, 0, 0)})`, full(h, 10)]);
  add("mimic (of Mom)", "next to the real Mom", [studio(), ch("r", "mom", { at: [-1.5, 0, 0], expr: "worried" }), ch("c", "mimic_mom", { at: [1.5, 0, 0], expr: "mimic_smile", pose: "tilt" }), cam([0, -13, 2.4], [0, 0, 2.0], 42)]);
  add("mimic (of Mom)", "size chart (next to Me)", [studio(), ch("m", "me", { at: [-1.4, 0, 0], expr: "worried" }), ch("c", "mimic_mom", { at: [1.4, 0, 0], expr: "mimic_smile", pose: "tilt" }), cam([0, -12, 2.2], [0, 0, 1.9], 42)]);
}
// ---- 5 the little creature: turnaround, 6 faces, 3 colours, size chart
{
  for (const [lab, rot] of [["front", 0], ["three-quarter", 35], ["side", 90], ["back", 180]]) add("little creature", lab, [studio(), ch("c", "critter", { rot, expr: "happy" }), cam([0, -4.2, 0.9], [0, 0, 0.5], 45)]);
  for (const e of ["happy", "angry", "scared", "sleepy", "big_smile", "sad"]) add("little creature", { happy: "cute", angry: "grumpy", scared: "surprised", sleepy: "sleepy", big_smile: "laughing", sad: "sad" }[e], [studio(), ch("c", "critter", { expr: e }), cam([0, -3.6, 0.8], [0, 0, 0.6], 45, 3.6, 2.4)]);
  add("little creature", "3 colours", [studio(), ch("a", "critter_teal", { at: [-1.25, 0, 0], expr: "happy" }), ch("b", "critter_pink", { at: [0, 0, 0], expr: "big_smile" }), ch("d", "critter_mustard", { at: [1.25, 0, 0], expr: "angry" }), cam([0, -5.4, 1.0], [0, 0, 0.55], 45)]);
  add("little creature", "size chart (next to Me)", [studio(), ch("m", "me", { at: [-0.8, 0, 0], expr: "happy" }), ch("c", "critter", { at: [0.9, -0.2, 0], expr: "happy", rot: -20 }), cam([0, -9, 1.7], [0, 0, 1.4], 40)]);
}
// ---- 6 the 4 test scenes on Stage A
{
  const lit = (vs, cl, time) => vs.map((v) => `zc_char_light(${v}, ${P(cl)}, ${py(time)})`);
  const famCam = [0, 6.4, 3.6];
  add("Stage A scenes", "the family on the porch (day)", [`zv_build("A", "day", t0, t1)`,
    ch("d", "dad", { at: [-3.6, 16.2, 0.6], expr: "happy" }), ch("m", "mom", { at: [-1.2, 16.2, 0.6], expr: "happy" }), ch("k", "me", { at: [1.2, 16.2, 0.6], expr: "big_smile" }), ch("s", "sister", { at: [3.6, 16.2, 0.6], expr: "smug" }),
    ...["d", "m", "k", "s"].map((v) => `${v}.face_to((0.0, 4.0, 2.0))`), cam(famCam, [0, 16.2, 2.0], 13), ...lit(["d", "m", "k", "s"], famCam, "day")]);
  const kCam = [-6.0, 10.0, 2.9];
  add("Stage A scenes", "kid + sister see the Shadow across the street (night)", [`zv_build("A", "night", t0, t1)`,
    ch("k", "me", { at: [-1.2, 8, 0.25], expr: "scared" }), ch("s", "sister", { at: [-3.6, 8.4, 0.25], expr: "terrified" }), ch("x", "shadow", { at: [8.0, -8.8, 0.25], expr: "shadow_stare" }),
    `k.face_to((8.0, -8.8, 3.0))`, `s.face_to((8.0, -8.8, 3.0))`, `x.face_to((0.0, 8.0, 2.0))`, cam(kCam, [1.9, 3.8, 2.6], 19), ...lit(["k", "s"], kCam, "night")]);
  const wCam = [-1.7, 10.6, 3.0];
  add("Stage A scenes", "the Mimic-Mom at the door, the real Mom at the window (night)", [`zv_build("A", "night", t0, t1)`, `wc = zv_open_window(8, -4)`,
    ch("x", "mimic_mom", { at: [0, 16.8, 0.6], expr: "mimic_smile", pose: "tilt" }), `x.face_to(${P(wCam)})`,
    ch("m", "mom", { expr: "terrified" }), `m.root.location = (wc.x, wc.y + 1.1, wc.z - 0.88 * 3.35 - 0.05) if wc is not None else (-4.2, 19.2, 1.6)`, `m.face_to(${P(wCam)})`,
    cam(wCam, [-1.8, 17.4, 3.2], 13), ...lit(["x", "m"], wCam, "night")]);
  const yCam = [3.4, 1.4, 2.1];
  add("Stage A scenes", "the Mayor talks to the little creature (day)", [`zv_build("A", "day", t0, t1)`,
    ch("y", "mayor", { at: [0, 8, 0.25], expr: "smug", pose: "talk" }), ch("c", "critter", { at: [1.5, 7.4, 0.25], expr: "angry" }), `y.face_to((1.5, 7.4, 0.5))`, `c.face_to((0.0, 8.0, 3.0))`,
    cam(yCam, [0.6, 8, 1.8], 28), ...lit(["y", "c"], yCam, "day")]);
}
const ONLY = arg("only") ? String(arg("only")).split(",") : null;
const SS = ONLY ? S.filter((x) => ONLY.some((o) => x.strip.startsWith(o))) : S;
const N = SS.length;

// ---- the shot file + the render (the character sheet's machinery)
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const SOLVED = path.join(HERE, "stageA.solved.json");
const STAGE = fs.existsSync(SOLVED) ? { ...STAGE_A, cameras: JSON.parse(fs.readFileSync(SOLVED, "utf8")) } : STAGE_A;
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const B = 60;
const src = [`"""In This Town v2: the cast sheet"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES["A"] = ${py(STAGE)}`, `ZC_SPECS.update(${py(SPECS)})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`, "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...SS.map((x, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`${x.strip}: ${x.label}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n${ind(x.body)}\n`)].join("\n");
const dir = path.join(OUT, "render");
fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 6))}`); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "cast sheet\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 30 + 300;
say(`${N} stills; shots.py ${(src.length / 1024).toFixed(0)} KB; worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; cap $${CAP}; spent so far $${L.total()}`);
let r;
if (has("reuse")) r = JSON.parse(fs.readFileSync(path.join(dir, "output.json"), "utf8"));
else {
  if (!has("yes")) { say("dry run: static check ok, nothing sent (add --yes)"); process.exit(0); }
  L.check("cast sheet", (limit + BOOT_S) * RATE);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-cast-${Date.now().toString(36)}`, log: say });
  const t0 = Date.now();
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  r = await R.job(`v2 cast (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: SS.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 32, upload: await R.signPuts("p.tgz", 4) }, { maxRunSec: limit, ledgerKey: "runpod_cast" });
  if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 500)}`); process.exit(1); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  r.wallSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(dir, "output.json"), JSON.stringify(r));
}
// ---- the sheets: one per strip (6 across), plus the cast sheet (line-ups + the Stage A scenes)
const esc = (s) => s.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "").replace(/%/g, " pct").replace(/,/g, "\\,");
const tileDir = path.join(OUT, "tiles"); fs.rmSync(tileDir, { recursive: true, force: true }); fs.mkdirSync(tileDir, { recursive: true });
const byStrip = {};
const missing = [];
SS.forEach((x, k) => {
  const id = k + 2, png = path.join(dir, "preview", `shot_${String(id).padStart(id >= 100 ? 3 : 2, "0")}.png`);
  if (!fs.existsSync(png)) { missing.push(`${x.strip}/${x.label}: ${String(r.output.failed?.[id] ?? r.output.failed?.[String(id)] ?? "no still").split("\n").slice(-2).join(" ").slice(0, 160)}`); return; }
  const list = (byStrip[x.strip] ??= []);
  const out = path.join(tileDir, `${x.strip.replace(/[^a-z0-9]+/gi, "_")}_${String(list.length + 1).padStart(3, "0")}.png`);
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=360:640,drawbox=y=0:w=iw:h=58:color=black@0.72:t=fill,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(x.strip.toUpperCase())}':x=8:y=6:fontsize=14:fontcolor=0xFFC266,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(x.label.slice(0, 34))}':x=8:y=26:fontsize=17:fontcolor=white`, out]);
  list.push(out);
});
const sheets = [];
for (const [strip, files] of Object.entries(byStrip)) {
  const base = path.join(tileDir, `${strip.replace(/[^a-z0-9]+/gi, "_")}_%03d.png`);
  const f = path.join(OUT, `strip_${strip.replace(/[^a-z0-9]+/gi, "_")}.jpg`);
  spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "1", "-i", base, "-vf", `tile=6x${Math.ceil(files.length / 6)}:color=0x15171c`, "-frames:v", "1", "-q:v", "3", f]);
  sheets.push(f);
}
// the cast sheet: the line-ups then the Stage A scenes (4 + 4 across)
const castList = [...(byStrip["lineup"] ?? []), ...(byStrip["Stage A scenes"] ?? [])];
if (castList.length) {
  const tmp = path.join(tileDir, "cast_%03d.png");
  castList.forEach((f, i) => fs.copyFileSync(f, tmp.replace("%03d", String(i + 1).padStart(3, "0"))));
  spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "1", "-i", tmp, "-vf", `tile=4x${Math.ceil(castList.length / 4)}:color=0x15171c`, "-frames:v", "1", "-q:v", "3", path.join(OUT, "cast_sheet.jpg")]);
}
say(`cast sheet: ${N - missing.length}/${N} stills${missing.length ? `; MISSING: ${missing.slice(0, 8).join(" | ")}` : ""}; spent $${L.total()}`);
say(`folder: ${OUT}`);
