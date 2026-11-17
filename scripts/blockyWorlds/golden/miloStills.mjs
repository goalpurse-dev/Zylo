// THE MILO GOLDEN STILLS TEST (owner 2026-11-18: "rerun it, stills only, cheap, after every big change to the director,
// checker or worlds"). Milo's OWN plan and shot code (the director's output of the loved run, no director call) is
// previewed again with TODAY's worlds.py, camera fix (camFix re-aim), checker and render gate, then the pipeline stops
// (--stop-after-check): ~$0.10 of previews + ~$0.07 of checker, hard cap $0.40. The verdict (flagged shots by kind, the
// gate's RENDER / BLOCK, the cut / weak shots) is in <out>/blender/golden-stills.json, the sheets next to it.
// The reference: Milo at its final round = 14 of 70 flagged, the gate RENDERs it (89%). A change that makes Milo's own
// shots fail more (or the gate BLOCK) is a regression. A director change needs the full golden run (miloGolden.mjs, $3).
//   node --env-file=.env.local scripts/blockyWorlds/golden/miloStills.mjs --milo <Milo run dir> --out <new folder>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const MILO = path.resolve(arg("milo")), OUT = path.resolve(arg("out"));
const cap = Number(arg("cap", "0.4"));
if (fs.existsSync(OUT)) throw new Error(`${OUT} exists: give a new folder`);
// the run folder without its media: the script, the words, the voice, the director's state
fs.mkdirSync(path.join(OUT, "blender"), { recursive: true });
for (const f of ["results.json", "words.json", "base-timeline.json"]) if (fs.existsSync(path.join(MILO, f))) fs.copyFileSync(path.join(MILO, f), path.join(OUT, f));
fs.cpSync(path.join(MILO, "voice"), path.join(OUT, "voice"), { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(MILO, "blender", "state.json"), "utf8"));
// keep the plan, the bodies (the director's final code), the approval; forget every preview, check, fix and final
for (const k of ["previewed", "round", "rounds", "failing", "seen", "rpPrefix", "chunks", "captions", "music", "roundShotLeft", "reaimed", "gate", "retries", "convo"]) delete state[k];
state.shotFixed = true;
fs.writeFileSync(path.join(OUT, "blender", "state.json"), JSON.stringify(state));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(HERE, "..", "blenderKit", "pipeline.mjs"), "--run", OUT, "--voice-dir", path.join(OUT, "voice"), "--worlds", "--rounds", "2", "--cap", String(cap), "--agent-cap", String(cap), "--stop-after-check", "--yes"], { stdio: "inherit", env: process.env });
const verdict = path.join(OUT, "blender", "golden-stills.json");
if (r.status !== 0 || !fs.existsSync(verdict)) { console.error(`the stills test did not finish (exit ${r.status})`); process.exit(1); }
console.log(fs.readFileSync(verdict, "utf8"));
