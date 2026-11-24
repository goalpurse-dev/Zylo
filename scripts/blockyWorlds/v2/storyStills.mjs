// IN THIS TOWN v2, step 2: A STORY'S STILLS from its shot rows (one still per row), the free checks first (nothing
// renders while any fails), the Blender checks per still, one sheet with each line's words.
//   node --env-file=.env.local scripts/blockyWorlds/v2/storyStills.mjs --story round10 [--yes] [--cap 0.3]
//   ... --fix 7 --set '{"cam":{"type":"close","subject":["grandpa"]}}'   = ONE FIX: re-render only row 7 (its own job),
//                                                                         measured: wait in seconds, cold or warm, cost
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
import { CHARACTERS } from "./characters.mjs";
import { checkRows, rowPython } from "./shots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const NAME = arg("story", "round10");
import { stickerFilter } from "./stickers.mjs";
import { mimicOf } from "./characters.mjs";
import { NEIGHBOURS } from "./characters.mjs";
const STORY = fs.existsSync(path.join(HERE, "stories", `${NAME}.json`)) ? JSON.parse(fs.readFileSync(path.join(HERE, "stories", `${NAME}.json`), "utf8")) : (await import(`./stories/${NAME}.mjs`)).STORY;
const OUT = path.resolve(arg("out", path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${NAME}`)));
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 0.3));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const S = { ...STAGE_A, cameras: {} };

// ---- one fix: change one row, check, re-render that row alone
const FIX = has("fix") ? Number(arg("fix")) : null;
if (FIX) { const patch = JSON.parse(arg("set", "{}")); Object.assign(STORY.rows[FIX - 1], patch); }
// --rows 3,7,9 = only these rows (the automatic fixes re-render just them)
const ONLY = has("rows") ? String(arg("rows")).split(",").map(Number) : null;
const t0c = Date.now();
const problems = checkRows(S, STORY);
say(`free checks: ${STORY.rows.length} rows, ${problems.length} problem(s) (${((Date.now() - t0c) / 1000).toFixed(1)} s)${problems.length ? ":\n- " + problems.join("\n- ") : ""}`);
if (problems.length && !has("force")) process.exit(1);
const rows = FIX ? [{ r: STORY.rows[FIX - 1], k: FIX - 1 }] : STORY.rows.map((r, k) => ({ r, k })).filter(({ k }) => !ONLY || ONLY.includes(k + 1));
const N = rows.length;
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py"].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const B = 60;
const src = [`"""In This Town v2: ${STORY.title} (stills)"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", `ZV_STAGES["A"] = ${py(STAGE_A)}`, `ZV_STAGES["B"] = ${py(STAGE_B)}`, `ZC_SPECS.update(${py({ ...CHARACTERS, ...NEIGHBOURS, mimic_mom: mimicOf(CHARACTERS.mom), mimic_dad: mimicOf(CHARACTERS.dad) })})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`, "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...rows.map(({ r, k }, j) => `@S(${j + 2}, ${2 * j + 1}, ${j + 1 < N ? 2 * j + 3 : "None"}, ${JSON.stringify(`row ${k + 1} line ${r.line}`)})\ndef s${String(j + 2).padStart(3, "0")}(t0, t1):\n${ind(rowPython(S, STORY, r))}\n`)].join("\n");
const tag = FIX ? `fix_row${FIX}_${Date.now().toString(36)}` : ONLY ? `rows_${Date.now().toString(36)}` : "all";
const dir = path.join(OUT, `render_${tag}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 6))}`); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "stills\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 30 + 300;
say(`${N} still(s); worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; spent so far $${L.total()}`);
if (!has("yes")) { say("dry run (add --yes)"); process.exit(0); }
L.check(FIX ? "one fix" : "story stills", (limit + BOOT_S) * RATE);
const tStart = Date.now();
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-${NAME}-${tag}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
const r = await R.job(`v2 ${NAME} ${tag} (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: rows.map((_, j) => j + 2).join(","), perSheet: 90, cols: 10, samples: 32, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: FIX ? "runpod_fix" : "runpod_stills" });
if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 400)}`); process.exit(1); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
await R.cleanup().catch(() => {});
pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
const wall = (Date.now() - tStart) / 1000;
const gate = (r.output.gate ?? []).map(String);
fs.writeFileSync(path.join(dir, "gate.txt"), gate.join("\n"));
// the job's own numbers (the ledger's step line): queue delay, boot, run, cost
const steps = fs.existsSync(path.join(OUT, "steps.jsonl")) ? fs.readFileSync(path.join(OUT, "steps.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const job = steps.filter((x) => x.step === "runpod_job").at(-1) ?? {};
// the sheet: each still with its line's words and what the Blender checks said
const lab = path.join(dir, "labelled"); fs.mkdirSync(lab, { recursive: true });
const esc = (s) => s.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, " pct").replace(/,/g, "\\,");
const wrap = (t, n) => { const w = t.split(" "), o = [""]; for (const x of w) { if ((o.at(-1) + " " + x).trim().length > n) o.push(x); else o[o.length - 1] = (o.at(-1) + " " + x).trim(); } return o; };
let made = 0, fails = 0;
rows.forEach(({ r, k }, j) => {
  const id = j + 2, png = path.join(dir, "preview", `shot_${String(id).padStart(2, "0")}.png`);
  if (!fs.existsSync(png)) return;
  const bad = gate.filter((g) => g.split("|")[1] === String(id) && g.split("|")[2] === "zv").map((g) => g.split("|").slice(3).join(" "));
  if (bad.length) fails++;
  const words = wrap(`${r.line}. ${STORY.lines[r.line - 1].text}`, 34);
  const stk = r.sticker ? `,${stickerFilter(r.sticker, { W: 360, H: 640, side: (r._cam?.type === "insert" ? "right" : "right") })}` : "";
  const dt = words.map((w, i) => `drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(w)}':x=8:y=${8 + i * 22}:fontsize=18:fontcolor=white`).join(",");
  const ck = `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${esc((bad.length ? "check: " + bad.join("; ") : `checks pass (${r._cam?.type ?? ""})`).slice(0, 64))}':x=8:y=616:fontsize=12:fontcolor=${bad.length ? "0xFF7070" : "0x7CFC00"}:box=1:boxcolor=black@0.6`;
  made++;
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=360:640${stk},drawbox=y=0:w=iw:h=${16 + words.length * 22}:color=black@0.72:t=fill,${dt},${ck}`, path.join(lab, `l_${String(made).padStart(3, "0")}.png`)]);
});
// per row: the still and what the Blender checks said (the latest render of a row wins)
const RES = path.join(OUT, "rows.json");
const res = fs.existsSync(RES) && !(!FIX && !ONLY) ? JSON.parse(fs.readFileSync(RES, "utf8")) : {};
rows.forEach(({ r, k }, j) => {
  const id = j + 2, png = path.join(dir, "preview", `shot_${String(id).padStart(2, "0")}.png`);
  res[k + 1] = { png: fs.existsSync(png) ? png : null, fails: gate.filter((g) => g.split("|")[1] === String(id) && g.split("|")[2] === "zv").map((g) => g.split("|").slice(3).join(" ")), label: path.join(lab, `l_${String(j + 1).padStart(3, "0")}.png`) };
});
fs.writeFileSync(RES, JSON.stringify(res, null, 1));
const sheet = path.join(OUT, FIX ? `fix_row${FIX}.jpg` : ONLY ? "fixed_rows.jpg" : "storyboard.jpg");
spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "1", "-i", path.join(lab, "l_%03d.png"), "-vf", `tile=${Math.min(6, made)}x${Math.ceil(made / 6)}:color=0x15171c`, "-frames:v", "1", "-q:v", "3", sheet]);
say(`${made}/${N} still(s), Blender checks failed on ${fails}; wait ${wall.toFixed(0)} s (queue ${job.delayS ?? "?"} s, boot ${job.bootS ?? "?"} s, run ${job.execS ?? "?"} s); this job $${job.usd ?? "?"}; spent $${L.total()}`);
say(`sheet: ${sheet}`);
