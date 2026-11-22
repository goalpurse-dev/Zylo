// THE REPLICA TEST runner (owner 2026-11-22, INTERNAL ONLY; the reference + its frames stay in the git-ignored local
// folder and are never uploaded: only our own shot code and our own renders go to the GPU).
//   node --env-file=.env.local scripts/blockyWorlds/replica/run.mjs --dir <replica dir> --stills [--tag r0] [--cards 3,7] [--yes]
//   node scripts/blockyWorlds/replica/run.mjs --dir <replica dir> --compare --tag r0        (free, local)
// One GPU job per stills round (all cards' start + end still, the kit's preview mode, low samples). Hard cap: $3 total
// for the whole test on <dir>/costs.json (voice + stills + final).
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { PREAMBLE, placeCards } from "./cards.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = path.resolve(arg("dir"));
const L = ledger(DIR, { capUsd: 3, agentCapUsd: 3 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(DIR, "run.log"), l + "\n"); };
const words = JSON.parse(fs.readFileSync(path.join(DIR, "voice", "words.json"), "utf8"));
const P = placeCards(words);
const TAG = arg("tag", "r0");
const only = arg("cards") ? arg("cards").split(",").map(Number) : null;
export const LIB_FILES = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py"];
const LIB = LIB_FILES.map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n") + "\n\n" + PREAMBLE;
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const indent = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");

if (has("stills")) {
  const out = path.join(DIR, `stills_${TAG}`);
  fs.mkdirSync(path.join(out, "video", "audio"), { recursive: true });
  const cards = P.filter((x) => !only || only.includes(x.k));
  const stills = cards.flatMap((x) => [{ x, which: "start" }, { x, which: "end" }]);
  const N = stills.length;
  const body = (s) => {
    const D = Math.max(0.3, s.x.t1 - s.x.t0).toFixed(3);
    const shift = s.which === "start" ? `tm = (t0 + t1) / 2.0\nt0, t1 = tm, tm + ${D}` : `tm = (t0 + t1) / 2.0\nt0, t1 = tm - ${D}, tm - 0.02`;
    return indent(`${shift}\n${s.x.py}`);
  };
  const src = [`"""Replica stills ${TAG}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
    ...stills.map((s, k) => `@S(${k + 1}, ${2 * k}, ${k + 1 < N ? 2 * (k + 1) : "None"}, ${JSON.stringify(`card ${s.x.k} ${s.which}`)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${body(s)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(out, "video", "shots.py"));
  if (!sc.ok) { console.error(JSON.stringify(sc.problems.slice(0, 6), null, 1)); process.exit(1); }
  fs.writeFileSync(path.join(out, "video", "shots.py"), src);
  fs.writeFileSync(path.join(out, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }))));
  fs.writeFileSync(path.join(out, "video", "script.txt"), "replica stills\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(out, "video", "audio", "voice.wav")]);
  const limit = N * 26 + 300;
  const worst = (limit + BOOT_S) * RATE;
  say(`stills ${TAG}: ${cards.length} cards = ${N} stills in ONE job; static check ok; worst case $${worst.toFixed(3)}; spent $${L.total()} of $3`);
  if (!has("yes")) process.exit(0);
  L.check(`stills ${TAG}`, worst);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/replica-${TAG}-${Date.now().toString(36)}`, log: say });
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(out, "v.tgz"), path.join(out, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(out, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  const r = await R.job(`replica stills ${TAG} (${N})`, { role: "preview", slug: "replica", videoUrl: url, shots: stills.map((_, k) => k + 1).join(","), perSheet: 90, cols: 10, samples: 8, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_stills" });
  if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`stills job: ${String(r.error).slice(0, 400)}`); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(out, "p.tgz"));
  await R.cleanup().catch(() => {});
  py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(out, "p.tgz"), out);
  const map = {};
  for (const f of fs.existsSync(path.join(out, "preview")) ? fs.readdirSync(path.join(out, "preview")) : []) { const m = f.match(/^shot_(\d+)\.png$/); if (m) { const s = stills[Number(m[1]) - 1]; map[`${s.x.k}.${s.which}`] = path.join(out, "preview", f); } }
  const failed = Object.fromEntries(Object.entries(r.output.failed ?? {}).map(([k, v]) => [`${stills[Number(k) - 1].x.k}.${stills[Number(k) - 1].which}`, String(v).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300)]));
  // the measured frames (zr_match prints ZW_FRAMED|card|meas|h u v|target h u v; the worker returns them as output.gate)
  const meas = (r.output.gate ?? []).filter((l) => l.includes("|meas|")).map((l) => { const [, card, , m, t] = l.split("|"); const [h, u, v] = m.split(" ").map(Number), [th, tu, tv] = t.replace("target ", "").split(" ").map(Number); return { card: Number(card), h, u, v, th, tu, tv, off: +Math.max(Math.abs(h - th) / th, Math.abs(u - tu) / 0.5, Math.abs(v - tv) / 0.5).toFixed(3) }; });
  fs.writeFileSync(path.join(out, "stills.json"), JSON.stringify({ map, failed, meas }, null, 1));
  fs.writeFileSync(path.join(out, "gate.txt"), (r.output.gate ?? []).join("\n"));
  const bad = meas.filter((m) => m.off > 0.1);
  if (meas.length) say(`measured ${meas.length} framings: ${bad.length} off by more than 10%${bad.length ? `: ${[...new Set(bad.map((m) => m.card))].join(", ")}` : ""}`);
  say(`stills ${TAG}: ${Object.keys(map).length}/${N} rendered, ${Object.keys(failed).length} crashed${Object.keys(failed).length ? `: ${Object.entries(failed).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(" | ")}` : ""}; spent $${L.total()} of $3`);
}

if (has("compare")) {
  // the reference frames at the same moments (the reference's own word timing: Whisper), ours next to them
  const ref = JSON.parse(fs.readFileSync(path.join(DIR, "ref_words.json"), "utf8"));
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, "");
  const refStart = [];
  let j = 0;
  for (const x of P) {
    const n = norm(x.card.cut);
    let i = j; while (i < Math.min(ref.length, j + 14) && norm(ref[i].word) !== n) i++;
    if (i >= Math.min(ref.length, j + 14)) i = Math.min(ref.length - 1, j);
    refStart.push(ref[i].start); j = i + 1;
  }
  const rows = P.map((x, k) => {
    const a = refStart[k] + 0.25, b = (k + 1 < P.length ? refStart[k + 1] : 61.3) - 0.1;
    return { k: x.k, words: words.slice(x.w0, x.w1 ?? words.length).map((w) => w.word).join(" "), what: x.card.what, refA: +Math.max(0, a).toFixed(2), refB: +Math.max(a, b).toFixed(2) };
  });
  const cmp = path.join(DIR, `compare_${TAG}`); fs.mkdirSync(cmp, { recursive: true });
  for (const r of rows) for (const [key, t] of [["refA", r.refA], ["refB", r.refB]]) {
    const f = path.join(cmp, `ref_${r.k}_${key}.jpg`);
    if (!fs.existsSync(f)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", path.join(DIR, "reference.mp4"), "-frames:v", "1", "-vf", "scale=270:480", f]);
  }
  const stills = {};
  // newest round last (by when its stills.json was written; NOT by name: "r2" sorted after "c0" and hid the new stills)
  const mt = (d) => { try { return fs.statSync(path.join(DIR, d, "stills.json")).mtimeMs; } catch { return 0; } };
  for (const d of fs.readdirSync(DIR).filter((d) => d.startsWith("stills_")).sort((a, b) => mt(a) - mt(b))) {
    const sj = path.join(DIR, d, "stills.json");
    if (fs.existsSync(sj)) Object.assign(stills, JSON.parse(fs.readFileSync(sj, "utf8")).map);   // later rounds replace earlier
  }
  fs.writeFileSync(path.join(cmp, "compare.json"), JSON.stringify({ rows: rows.map((r) => ({ ...r, refStart: path.join(cmp, `ref_${r.k}_refA.jpg`), refEnd: path.join(cmp, `ref_${r.k}_refB.jpg`), ourStart: stills[`${r.k}.start`] ?? null, ourEnd: stills[`${r.k}.end`] ?? null })) }, null, 1));
  spawnSync("python", [path.join(HERE, "compareSheet.py"), path.join(cmp, "compare.json"), path.join(cmp, "compare.jpg")], { stdio: "inherit" });
}
