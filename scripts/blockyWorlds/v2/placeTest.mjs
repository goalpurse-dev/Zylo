// IN THIS TOWN v2, NIGHT BUILD: THE TEST SHEET OF ANY PLACES (one RunPod job, one sheet per place, <= 1400 px wide).
// Free checks first (placeKit checkPlace) and a free LOCAL MOCK run of the python (mockSet.py: names, arguments, data),
// nothing renders while either fails.
//   node --env-file=.env.local scripts/blockyWorlds/v2/placeTest.mjs --places bright_city [--times day,night]
//        [--weathers clear] [--cams a,b] [--opt '{"rain_things":{...}}'] [--tag name] [--yes] [--cap 0.4]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { STAGE_A } from "./stageA.mjs";
import { STAGE_B } from "./stageB.mjs";
import { CHARACTERS, NEIGHBOURS } from "./characters.mjs";
import { allPlaces, loadPlace, checkPlace, placePayload } from "./placeKit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", "night-build");
const TAG = arg("tag", String(arg("places", "x")).replace(/,/g, "+"));
const OUT = path.join(ROOT, "runs", TAG);
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 0.4));
const L = ledger(path.join(ROOT, "ledger"), { capUsd: Number(arg("night_cap", 10)), agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };

const places = await allPlaces();
const ids = String(arg("places", "")).split(",").filter(Boolean);
const TIMES = String(arg("times", "day,night")).split(","), WEATHERS = String(arg("weathers", "clear")).split(",");
const OPT = JSON.parse(arg("opt", "{}"));
const payloads = {}, stills = [];
let bad = 0;
const { withBig } = await import("./places/bigthings.mjs");
for (const id of ids) {
  const P0 = id.includes("+") ? withBig(places[id.split("+")[0]], ...id.split("+")[1].split(".")) : places[id];
  if (!P0) { say(`unknown place ${id}`); process.exit(1); }
  let S = loadPlace(P0);
  if (has("cams")) S = { ...S, cameras: Object.fromEntries(Object.entries(S.cameras).filter(([c]) => String(arg("cams")).split(",").includes(c))), cams_filtered: true };
  const pr = checkPlace(S);
  if (pr.length) { say(`${id}: free check FAILED:\n- ${pr.join("\n- ")}`); bad++; continue; }
  payloads[id] = placePayload(S);
  const cams = has("cams") ? String(arg("cams")).split(",").filter((c) => S.cameras[c]) : Object.keys(S.cameras);
  const times = has("times") ? TIMES : (P0.kind === "side" ? P0.times : TIMES);
  if (!has("list")) for (const cam of cams) for (const time of times) for (const weather of WEATHERS) stills.push({ place: id, cam, time, weather });
  say(`${id}: free check ok (${S.prims.length} shapes, ${Object.keys(S.cameras).length} cameras)`);
}
if (has("list")) for (const x of JSON.parse(fs.readFileSync(arg("list"), "utf8"))) stills.push({ place: x.place, cam: x.cam, time: x.time ?? "day", weather: x.weather ?? "clear", opt: x.opt });
if (has("studio")) for (const x of JSON.parse(fs.readFileSync(arg("studio"), "utf8"))) stills.push({ place: TAG, cam: x.label, time: x.opt?.time ?? "day", weather: "clear", studio: x });
if (bad) process.exit(1);
const N = stills.length;
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const V2 = ["stage_v2.py", "char_v2.py", "set_v2.py", ...(fs.existsSync(path.join(HERE, "things_v2.py")) ? ["things_v2.py"] : [])].map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n\n");
const HEX = fs.readFileSync(path.join(HERE, "assets", "zyvo_badge96.hex"), "utf8").trim();
const extraSpecs = (await import("./characters.mjs")).EXTRA_SPECS ?? {};
// the prop library + props built on the spot (passed ones in props_built.json; a story's new ones via --recipes)
const RECIPES = { ...(await import("./places/props.mjs")).allProps(), ...(has("recipes") ? JSON.parse(fs.readFileSync(arg("recipes"), "utf8")) : {}) };
const B = 60;
const head = [`ZV_STAGES["A"] = ${py(STAGE_A)}`, `ZV_STAGES["B"] = ${py(STAGE_B)}`, `ZC_SPECS.update(${py({ ...CHARACTERS, ...NEIGHBOURS, ...extraSpecs })})`, `ZV_BADGE_HEX = ${JSON.stringify(HEX)}`, `ZV_RECIPES.update(${py(RECIPES)})`,
  ...Object.entries(payloads).map(([id, p]) => `ZV_PLACES[${py(id)}] = ${py(p)}`)];
const call = (x) => x.studio ? `zv_studio_test(${py(x.studio.what)}, t0, t1, ${py(x.studio.opt ?? {})})` : `zv_place_test(${py(x.place)}, ${py(x.cam)}, ${py(x.time)}, ${py(x.weather)}, t0, t1, ${py({ ...OPT, ...(x.opt ?? {}) })})`;
// ---- the free local mock run (python without Blender: every builder call checked for names and arguments)
fs.writeFileSync(path.join(OUT, "mock_head.py"), head.join("\n"));
fs.writeFileSync(path.join(OUT, "mock_calls.py"), stills.map((x) => `t0, t1 = 1.0, 2.0\n${call(x)}`).join("\n"));
const mk = spawnSync("python", ["-I", path.join(HERE, "mockSet.py"), path.join(OUT, "mock_head.py"), path.join(OUT, "mock_calls.py")], { encoding: "utf8" });
if (mk.status) { say(`mock run FAILED:\n${(mk.stderr || mk.stdout).slice(-1500)}`); process.exit(1); }
say(`mock run ok: ${mk.stdout.trim().split("\n").pop()}`);
if (has("mock")) process.exit(0);

const src = [`"""In This Town v2 night build: ${TAG}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector, Euler", "",
  "V = Video(__file__)", "story.bind(V)", "", LIB, "", V2, "", ...head, "",
  `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
  ...stills.map((x, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`${x.place} ${x.cam} ${x.time} ${x.weather}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n    ${call(x)}\n`)].join("\n");
const dir = path.join(OUT, "render");
fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
if (!sc.ok) { say(`static check FAILED: ${JSON.stringify(sc.problems.slice(0, 5))}`); process.exit(1); }
fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
fs.writeFileSync(path.join(dir, "video", "script.txt"), "place test\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
const limit = N * 90 + 300;     // suburb stills take ~50 s each (Stage A street)
say(`${N} stills; worst case $${((limit + BOOT_S) * RATE).toFixed(3)}; night spent so far $${L.total()}`);
if (!has("yes")) { say("dry run: checks ok, nothing sent (add --yes)"); process.exit(0); }
L.check("place test", (limit + BOOT_S) * RATE);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/v2-night-${TAG.replace(/[^a-z0-9_+-]/gi, "")}-${Date.now().toString(36)}`, log: say });
const t0 = Date.now();
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
const r = await R.job(`v2 night ${TAG} (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: stills.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 16, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_stage" });
if (!r.ok) { await R.cleanup().catch(() => {}); say(`render FAILED: ${String(r.error).slice(0, 600)}`); process.exit(1); }
await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
await R.cleanup().catch(() => {});
pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
const wall = ((Date.now() - t0) / 1000).toFixed(0);
const gate = (r.output.gate ?? []).map(String);
fs.writeFileSync(path.join(OUT, "gate.txt"), gate.join("\n"));
const rows = stills.map((x, k) => {
  const id = k + 2;
  const fails = gate.filter((g) => g.split("|")[1] === String(id) && g.split("|")[2] === "zv").map((g) => g.split("|").slice(3).join(" "));
  const png = path.join(dir, "preview", `shot_${String(id).padStart(2, "0")}.png`);
  const boxes = gate.filter((g) => g.split("|")[1] === String(id) && g.split("|")[2] === "zvbox").map((g) => g.split("|").slice(3, 7).map(Number));
  return { id, ...x, png: fs.existsSync(png) ? png : null, ok: fs.existsSync(png) && !fails.length, fails, boxes, crashed: r.output.failed?.[id] ?? null };
});
// THE DARKNESS CHECK (owner 2026-11-25): a subject too dark to read fails (darkCheck.py on the subjects' boxes)
{
  const lst = rows.filter((x) => x.png).map((x) => ({ png: x.png, boxes: x.boxes }));
  fs.writeFileSync(path.join(OUT, "dark_in.json"), JSON.stringify(lst));
  const dk = spawnSync("python", [path.join(HERE, "darkCheck.py"), path.join(OUT, "dark_in.json")], { encoding: "utf8" });
  for (const l of String(dk.stdout || "").split("\n").filter(Boolean)) {
    const [png, verdict, why] = l.split("|");
    const row = rows.find((x) => x.png === png);
    if (row && verdict === "dark") { row.fails.push(`dark: ${why}`); row.ok = false; }
  }
}
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ rows, failed: r.output.failed ?? {}, wallSec: Number(wall), spentNight: L.total() }, null, 1));
// one labelled sheet per place (7 across x 200 px = 1400 px wide)
const lab = path.join(OUT, "labelled"); fs.rmSync(lab, { recursive: true, force: true }); fs.mkdirSync(lab, { recursive: true });
const esc = (s) => s.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "").replace(/%/g, " pct").replace(/,/g, " ");
const TW = Number(arg("tile", 7)), TWW = Math.floor(1400 / TW), TWH = Math.round(TWW * 16 / 9 / 2) * 2;
for (const id of [...Object.keys(payloads), ...(has("studio") ? [TAG] : [])]) {
  const mine = rows.filter((x) => x.place === id && x.png);
  mine.forEach((x, j) => {
    const t1 = x.studio ? x.cam : `${x.cam} ${x.time}${x.weather !== "clear" ? " " + x.weather : ""}${x.opt?.label ? " " + x.opt.label : ""}`, t2 = x.ok ? "PASS" : `FAIL ${x.fails.join("; ")}`.slice(0, 44);
    spawnSync("ffmpeg", ["-v", "error", "-y", "-i", x.png, "-vf", `scale=${TWW}:${TWH},drawbox=y=0:w=iw:h=34:color=black@0.7:t=fill,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${esc(t1)}':x=4:y=4:fontsize=11:fontcolor=white,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${esc(t2)}':x=4:y=19:fontsize=10:fontcolor=${x.ok ? "0x7CFC00" : "0xFF6060"}`, path.join(lab, `${id}_${String(j).padStart(3, "0")}.png`)]);
  });
  const rowsN = Math.ceil(mine.length / TW);
  if (mine.length) spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "0", "-i", path.join(lab, `${id}_%03d.png`), "-vf", `tile=${TW}x${rowsN}:color=black`, "-frames:v", "1", path.join(ROOT, `sheet_${id}${has("tag") ? "_" + TAG : ""}.jpg`)]);
  say(`${id}: ${mine.filter((x) => x.ok).length}/${rows.filter((x) => x.place === id).length} stills pass; sheet ${path.join(ROOT, `sheet_${id}${has("tag") ? "_" + TAG : ""}.jpg`)}`);
}
const crashed = rows.filter((x) => !x.png).map((x) => `${x.place}/${x.cam}/${x.time}/${x.weather}: ${String(x.crashed ?? "no image").slice(0, 200)}`);
if (crashed.length) say(`no image for ${crashed.length}:\n- ${crashed.slice(0, 8).join("\n- ")}`);
say(`wall ${wall} s; RunPod exec ${r.execS ?? "?"} s; night spent $${L.total()}`);
