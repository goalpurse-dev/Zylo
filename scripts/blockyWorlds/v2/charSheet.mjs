// IN THIS TOWN v2: THE MAIN CHARACTER'S REFERENCE SHEET (one RunPod job of stills + one labelled sheet).
//   node --env-file=.env.local scripts/blockyWorlds/v2/charSheet.mjs [--yes] [--reuse] [--cap 0.6] [--out <dir>]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { STAGE_A } from "./stageA.mjs";
import { CHARACTERS, EXPRESSIONS, POSES } from "./characters.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out", path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "character")));
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 0.6));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };

// ---- the stills (sec = sheet section, body = the shot's Python)
const P = (v) => `(${v.join(", ")})`;
const subj = (who = ["Me"]) => `ZV_SHOT.clear(); ZV_SHOT.update({"cam": "sheet", "subjects": [${who.map((w) => `(${py(w)}, ${w === "Me" ? "me" : "dad"})`).join(", ")}], "creature": None})`;
const me = (expr = "neutral", pose = "stand", rot = 0, badge = true, at = [0, 0, 0]) => `me = ZChar("Me", ZC_SPECS["me"], ${P(at)}, rot=${rot}, badge=${badge ? "True" : "False"})\nme.express(t0, ${py(expr)})\nme.pose(t0, ${py(pose)})`;
const cam = (loc, tgt, lens, focus = null, fstop = null) => `cam = Cam()\ncam.key(t0, ${P(loc)}, ${P(tgt)}, lens=${lens}${focus != null ? `, focus=${focus}, fstop=${fstop}` : ""})`;
const zcam = (dist, lens, side = 0, dz = 0) => `cam = zc_face_cam(t0, me, dist=${dist}, lens=${lens}, side=${side}, dz=${dz})`;
const S = [];
const add = (sec, label, body) => S.push({ sec, label, body });
const FRONT = [[0, -9.5, 1.7], [0, 0, 1.6], 55];
// 1 turnaround (+ the badge off)
for (const [lab, rot] of [["front", 0], ["three-quarter", 35], ["side", 90], ["back", 180]]) add("turnaround", lab, [`zc_studio(t0, t1)`, me("neutral", "stand", rot), cam(...FRONT)].join("\n"));
add("turnaround", "top", [`zc_studio(t0, t1)`, me("neutral", "stand", 0), cam([0, -1.4, 9], [0, 0, 1.2], 40)].join("\n"));
add("turnaround", "front, badge OFF", [`zc_studio(t0, t1)`, me("neutral", "stand", 0, false), cam(...FRONT)].join("\n"));
add("badge", "close, badge ON", [`zc_studio(t0, t1)`, me("happy", "stand", 0, true), zcam(3.4, 40, 10, -0.55)].join("\n"));
add("badge", "close, badge OFF", [`zc_studio(t0, t1)`, me("happy", "stand", 0, false), zcam(3.4, 40, 10, -0.55)].join("\n"));
// 2 the 12 expressions (close-ups, soft background blur)
for (const e of EXPRESSIONS) add("expressions", e, [`zc_studio(t0, t1)`, me(e, "stand", 0), zcam(3.6, 50)].join("\n"));
// 3 the 8 poses (full body, three-quarter)
const POSE_CAM = { walk: [[6.5, -5.5, 1.9], [0, 0, 1.5], 45], run: [[6.5, -5.5, 1.9], [0, 0, 1.4], 45], look_back: [[4.2, 6.5, 2.3], [0, 0, 1.8], 40] };
const POSE_EXPR = { walk: "happy", run: "scared", sit: "sleepy", crouch: "worried", point: "big_smile", hold_up: "happy", look_back: "worried" };
for (const p of POSES) {
  const pre = p === "sit" ? `box("zc_crate", (1.2, 1.1, 0.62), (0, 0.12, 0.31), mat("zc_cratem", zc_rgb("#B98A5A"), 0.85), 0.04)` : "";
  const prop = p === "hold_up" ? `me.hold(t0, zc_prop("phone", "zc_phone"), "R")` : "";
  const c = POSE_CAM[p] ?? [[3.2, -8.0, 1.9], [0, 0, 1.5], 45];
  add("poses", p, [`zc_studio(t0, t1)`, pre, me(POSE_EXPR[p] ?? "neutral", p, 0), prop, cam(...c)].filter(Boolean).join("\n"));
}
// 4 holding (phone in two hands looking down / a stick in one hand / a box in two hands)
add("holding", "phone, two hands, looks down", [`zc_studio(t0, t1)`, me("happy", "hold_phone", 0), `me.hold(t0, zc_prop("phone", "zc_phone"), "both")`, cam([2.4, -6.4, 2.4], [0, 0, 1.6], 45)].join("\n"));
add("holding", "stick, one hand", [`zc_studio(t0, t1)`, me("neutral", "hold_stick", 0), `me.hold(t0, zc_prop("stick", "zc_stick"), "R")`, cam([3.2, -8.0, 1.9], [0, 0, 1.5], 45)].join("\n"));
add("holding", "box, two hands", [`zc_studio(t0, t1)`, me("worried", "hold_box", 0), `me.hold(t0, zc_prop("box", "zc_box"), "both")`, cam([3.2, -8.0, 1.9], [0, 0, 1.5], 45)].join("\n"));
// 5 the base reused: an adult
const dad = (expr = "happy", pose = "stand", rot = 0, at = [0, 0, 0]) => `dad = ZChar("Dad", ZC_SPECS["dad"], ${P(at)}, rot=${rot}, badge=False)\ndad.express(t0, ${py(expr)})\ndad.pose(t0, ${py(pose)})`;
add("adult (same base)", "Me + Dad", [`zc_studio(t0, t1)`, me("happy", "stand", 0, true, [-1.5, 0, 0]), dad("happy", "stand", 0, [1.5, 0, 0]), cam([0, -14, 1.9], [0, 0, 1.75], 42)].join("\n"));
add("adult (same base)", "Dad three-quarter", [`zc_studio(t0, t1)`, dad("smug", "point", 30), cam([2.8, -9.5, 2.1], [0, 0, 1.8], 45)].join("\n"));
// 6 on Stage A (day / night): close front, side profile, from behind toward the house, low angle, over Dad's shoulder
const A = STAGE_A.spots, pm = A.pave_mid.at, pl = A.pave_left.at;
const onStage = [
  ["close, front", "happy", `me.face_to((0.5, -2.0, 2.0))`, cam([0.45, 4.4, 2.6], [0, 8, 2.5], 45, 3.6, 2.0)],
  ["side profile", "thinking", `me.face_to((0.0, 20.0, 2.0))`, cam([-4.0, 8.1, 2.4], [0, 8, 2.3], 40, 4.0, 2.8)],
  ["from behind, at the house", "neutral", `me.face_to((0.0, 20.0, 2.0))`, cam([0.7, 3.3, 2.7], [0, 16, 2.4], 26)],
  ["low angle", "worried", `me.face_to((0.6, -2.0, 3.0))`, cam([0.6, 4.6, 0.5], [0, 8, 3.0], 20)],
  ["over Dad's shoulder", "happy", `dad = ZChar("Dad", ZC_SPECS["dad"], ${P(pl)}, rot=0, badge=False)\ndad.express(t0, "neutral")\ndad.pose(t0, "stand")\ndad.face_to(${P(pm)})\nme.face_to(${P(pl)})`, cam([-5.0, 5.8, 3.4], [0, 8, 2.2], 35, 5.6, 2.8)],
];
for (const time of ["day", "night"]) for (const [lab, e, extra, c] of onStage) {
  const cl = c.match(/cam\.key\(t0, \(([^)]*)\)/)[1];
  add(`Stage A ${time}`, lab, [`zv_build("A", ${py(time)}, t0, t1)`, me(e, "stand", 0, true, pm), extra, c, `zc_char_light(me, (${cl}), ${py(time)})`, extra.includes("dad = ") ? `zc_char_light(dad, (${cl}), ${py(time)})` : "", subj()].filter(Boolean).join("\n"));
}
const N = S.length;

// ---- the shot file
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const SOLVED = path.join(HERE, "stageA.solved.json");
const STAGE = fs.existsSync(SOLVED) ? { ...STAGE_A, cameras: JSON.parse(fs.readFileSync(SOLVED, "utf8")) } : STAGE_A;
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const B = 60;
const src = [`"""In This Town v2: the main character's reference sheet"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES["A"] = ${py(STAGE)}`, `ZC_SPECS.update(${py(CHARACTERS)})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`, "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...S.map((x, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`${x.sec}: ${x.label}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n${ind(x.body)}\n`)].join("\n");
const dir = path.join(OUT, "render");
fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 6))}`); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "character sheet\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 30 + 300;
say(`${N} stills; shots.py ${(src.length / 1024).toFixed(0)} KB; worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; cap $${CAP}`);
let r;
if (has("reuse")) r = JSON.parse(fs.readFileSync(path.join(dir, "output.json"), "utf8"));
else {
  if (!has("yes")) { say("dry run: static check ok, nothing sent (add --yes)"); process.exit(0); }
  L.check("character sheet", (limit + BOOT_S) * RATE);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-char-${Date.now().toString(36)}`, log: say });
  const t0 = Date.now();
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  r = await R.job(`v2 character (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: S.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 32, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_char" });
  if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 500)}`); process.exit(1); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  r.wallSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(dir, "output.json"), JSON.stringify(r));
}
const gate = (r.output.gate ?? []).map(String);
fs.writeFileSync(path.join(OUT, "gate.txt"), gate.join("\n"));
// ---- the sheet: 6 across, each tile labelled with its section and name (+ a check line)
const lab = path.join(OUT, "labelled"); fs.rmSync(lab, { recursive: true, force: true }); fs.mkdirSync(lab, { recursive: true });
const esc = (s) => s.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "").replace(/%/g, " pct").replace(/,/g, "\\,");
let made = 0;
const rows = S.map((x, k) => {
  const id = k + 2, png = path.join(dir, "preview", `shot_${String(id).padStart(2, "0")}.png`);
  const fails = gate.filter((g) => g.split("|")[1] === String(id) && g.split("|")[2] === "zv").map((g) => g.split("|").slice(3).join(" "));
  const crashed = r.output.failed?.[id] ?? r.output.failed?.[String(id)] ?? null;
  if (fs.existsSync(png)) {
    made++;
    spawnSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=360:640,drawbox=y=0:w=iw:h=58:color=black@0.72:t=fill,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(x.sec.toUpperCase())}':x=8:y=6:fontsize=14:fontcolor=0xFFC266,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(x.label)}':x=8:y=26:fontsize=19:fontcolor=white${fails.length ? `,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${esc(("check: " + fails.join("; ")).slice(0, 60))}':x=8:y=612:fontsize=12:fontcolor=0xFF7070:box=1:boxcolor=black@0.6` : ""}`, path.join(lab, `l_${String(made).padStart(3, "0")}.png`)]);
  }
  return { id, ...x, body: undefined, png: fs.existsSync(png) ? png : null, fails, crashed };
});
spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "1", "-i", path.join(lab, "l_%03d.png"), "-vf", `tile=6x${Math.ceil(made / 6)}:color=0x15171c`, "-frames:v", "1", "-q:v", "3", path.join(OUT, "reference_sheet.jpg")]);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ rows, failed: r.output.failed ?? {}, wallSec: r.wallSec, spent: L.total() }, null, 1));
const crashed = rows.filter((x) => !x.png);
say(`character sheet: ${made}/${N} stills${crashed.length ? `; MISSING ${crashed.map((x) => `${x.sec}/${x.label}: ${String(x.crashed ?? "no still").split("\n").slice(-2).join(" ").slice(0, 160)}`).join(" | ")}` : ""}; checks failed on ${rows.filter((x) => x.fails.length).length}; spent $${L.total()}`);
say(`sheet: ${path.join(OUT, "reference_sheet.jpg")}`);
