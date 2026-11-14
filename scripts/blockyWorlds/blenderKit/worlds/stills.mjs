// Blender kit engine: TEST every place of the world library from every camera spot (and the dressing system) with stills
// on the Blender endpoint: one shot per place x spot (+ dressing demos) in a generated shots.py, the kit's preview mode
// (middle frame, 25 %), the kit's contact sheets. Priced first on its own ledger (--cap, default $1.50).
//   node worlds/stills.mjs --out <dir> [--only downtown,suburb] [--cap 1.5] [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../rp.mjs";
import { staticCheck } from "../director.mjs";
import { LOCATIONS } from "./locations.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: Number(arg("cap", 1.5)), agentCapUsd: 0 });
const only = arg("only") ? arg("only").split(",") : null;
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "stills.log"), l + "\n"); };

// the shots: every place x spot, a kid standing at the close-up target (scale), + the dressing demos
const shots = [];
for (const loc of LOCATIONS) {
  if (only && !only.some((o) => loc.id.startsWith(o))) continue;
  for (const spot of loc.spots) shots.push({ desc: `${loc.id} ${spot}`, place: loc.id, spot, dress: {} });
}
if (!only || only.includes("dress")) {
  shots.push({ desc: "dress: city hall + blimp, sunset", place: "downtown_landmark", spot: "wide", dress: { landmark: "city_hall", landmark_text: "CITY HALL", time: "sunset", props: ["cars", "blimp"], blimp_text: "VOTE" } });
  shots.push({ desc: "dress: clock tower at night", place: "downtown_landmark", spot: "wide", dress: { landmark: "tower", landmark_text: "1890", time: "night" } });
  shots.push({ desc: "dress: giant screen + rain", place: "downtown_landmark", spot: "wide", dress: { landmark: "screen", landmark_text: "PRICES UP", weather: "rain", time: "day" } });
  shots.push({ desc: "dress: story signs + billboard", place: "downtown_street", spot: "wide", dress: { signs: ["LAUGH LAB", "GIGGLE BANK", "JOKES 4 SALE"], billboard: "SMILE PAYS", people: 18 } });
}
const lib = fs.readFileSync(path.join(HERE, "worlds.py"), "utf8");
const body = (s) => {
  const lines = [`ZW_INFO = zw_build(${JSON.stringify(s.place)}, t0, t1, ${JSON.stringify(s.dress).replace(/true/g, "True").replace(/false/g, "False")})`, "cam = Cam()", `loc, tgt = zw_spot(cam, ${JSON.stringify(s.place)}, ${JSON.stringify(s.spot)}, t0, t1)`];
  if (!/^sky_/.test(s.place)) lines.push(`k = chars.kid(3)`, `k.pose(t0, loc=(tgt[0], tgt[1], ${s.place === "big_hall" && s.spot === "close" ? 2.4 : 0}), rot=0)`);
  return lines.map((l) => `    ${l}`).join("\n");
};
const N = shots.length;
const src = [`"""World library stills: every place x tested camera spot (+ dressing demos)."""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", lib, "",
  ...shots.map((s, i) => `@S(${i + 1}, ${i}, ${i + 1 < N ? i + 1 : "None"}, ${JSON.stringify(s.desc)})\ndef s${String(i + 1).padStart(2, "0")}(t0, t1):\n${body(s)}\n`)].join("\n");
const vdir = path.join(OUT, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
const sc = staticCheck(src, path.join(vdir, "shots.py"));
if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 10), null, 1)); process.exit(1); }
const words = Array.from({ length: N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }));
fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(vdir, "script.txt"), "stills\n");
spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(N + 1), path.join(vdir, "audio", "voice.wav")]);
const groups = N > 24 ? [0, 1, 2].map((g) => shots.map((_, i) => i + 1).filter((id) => id % 3 === g)) : [shots.map((_, i) => i + 1)];
const limit = (g) => g.length * 12 + 240;
const worst = groups.reduce((a, g) => a + (limit(g) + BOOT_S) * RATE, 0);
say(`stills: ${N} shots (${new Set(shots.map((s) => s.place)).size} places) in ${groups.length} jobs; static check ok; worst case $${worst.toFixed(3)}; spent $${L.total()} of $${L.capUsd}`);
if (!has("yes")) { say("dry run: nothing sent (add --yes)"); process.exit(0); }
L.check("stills (all jobs)", worst);
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/stills-${Date.now().toString(36)}`, log: say });
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(OUT, "v.tgz"), vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await R.putFile("v.tgz", path.join(OUT, "v.tgz"), "application/gzip");
const url = await R.signGet("v.tgz");
const res = await Promise.all(groups.map(async (g, gi) => {
  const r = await R.job(`stills ${gi} (${g.length})`, { role: "preview", slug: "worlds", videoUrl: url, shots: g.join(","), perSheet: 12, cols: 6, upload: await R.signPuts(`p${gi}.tgz`, 2) }, { maxRunSec: limit(g), ledgerKey: "runpod_preview" });
  if (!r.ok) return { gi, ok: false, error: r.error };
  const dir = path.join(OUT, "jobs", String(gi)); fs.mkdirSync(dir, { recursive: true });
  await R.fetchParts(`p${gi}.tgz`, r.output.upload.parts, path.join(dir, "p.tgz"));
  py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  return { gi, ok: true, failed: r.output.failed, renderS: r.output.renderS, shotS: r.output.shotS };
}));
await R.cleanup().catch(() => {});
// one labelled sheet per place group, from the tiles
const all = path.join(OUT, "tiles"); fs.mkdirSync(all, { recursive: true });
for (const g of res.filter((r) => r.ok)) { const d = path.join(OUT, "jobs", String(g.gi), "preview"); for (const f of fs.readdirSync(d)) fs.copyFileSync(path.join(d, f), path.join(all, f)); }
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(shots.map((s, i) => ({ id: i + 1, ...s })), null, 1));
spawnSync("python", ["-P", path.join(HERE, "sheet.py"), all, path.join(OUT, "shots.json"), OUT], { stdio: "inherit" });
const failed = Object.assign({}, ...res.map((r) => r.failed ?? {}));
say(`done: ${res.filter((r) => r.ok).length}/${groups.length} jobs ok, ${Object.keys(failed).length} shots failed${Object.keys(failed).length ? `: ${Object.entries(failed).map(([k, v]) => `${k} (${shots[k - 1]?.desc}): ${String(v).split("\n").pop()}`).join(" | ")}` : ""}; build+render ${res.map((r) => r.renderS).join(" / ")} s; spent $${L.total()}`);
fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ res, failed, total: L.total() }, null, 1));
