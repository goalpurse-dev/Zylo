// SETS-V2 2026-11-09: re-plans the lead's 5 step-3 scripts (stored Sonnet directions, $0, no library / builder: the
// places do not depend on them) and prints the places per script, the biggest place's share of the time, the theme
// and the rigs per place. Optional --out <dir>: writes <n>/timeline.json (for a RunPod stills job).
//   node dev/setsV2Step3.mjs <scratchpad dir with step2/, step2b/, hybrid/> [--out <dir>]
import fs from "node:fs";
import path from "node:path";
import * as plan from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { placeShares, placeKey } from "./setsV2Places.mjs";

const ENGINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const SP = process.argv[2];
const outAt = process.argv.indexOf("--out"), OUT = outAt > 0 ? process.argv[outAt + 1] : null;
const H = JSON.parse(fs.readFileSync(path.join(SP, "hybrid/results.json"), "utf8"));
const F = JSON.parse(fs.readFileSync(path.join(SP, "step2/final.json"), "utf8"));
const fromH = (i) => ({ title: H.results[i].script.title, recipe: H.results[i].recipe?.id ?? H.results[i].recipe, script: { title: H.results[i].script.title, lines: H.results[i].script.lines }, card: H.results[i].card });
const b4 = F.results[3].best;
const s4 = { title: b4.script.title, lines: b4.script.lines.map((L, k) => (k === 0 && !/^In this town, /.test(L.text) ? { ...L, text: "In this town, " + L.text.replace(/^In this world, /i, "") } : L)) };
const SCRIPTS = [{ n: 1, ...fromH(0) }, { n: 2, ...fromH(1) }, { n: 3, ...fromH(2) }, { n: 4, title: s4.title, recipe: F.results[3].recipe.id, script: s4, card: b4.card }, { n: 5, ...fromH(4) }];

const summary = [];
for (const s of SCRIPTS) {
  const st = JSON.parse(fs.readFileSync(path.join(SP, `step2b/out/${s.n}-sonnet/direction.json`), "utf8"));
  const provider = { model: st.model, async direct() { return { data: st.raw, costUsd: 0, model: st.model }; } };
  const direction = await directStory({ script: s.script, idea: s.card, provider, exists, log: () => {} });
  const words = plan.estimateWords(s.script, 212);
  const tl = plan.planVideo({ script: s.script, words, idea: s.card, lengthSec: 90, direction, exists, recipe: s.recipe, criticalMode: "report" });
  const checks = { timeline: plan.checkTimeline(tl).length, visuals: plan.checkVisuals(tl, s.script).length, subjects: plan.checkSubjects(tl).length };
  const { rows, biggest } = placeShares(tl);
  const rigs = {};
  for (const sh of tl.shots) { const k = placeKey(sh); (rigs[k] ??= new Set()).add(sh.rig ?? sh.light); }
  console.log(`\n#${s.n} ${s.title}: ${rows.length} places | biggest ${(biggest * 100).toFixed(0)}% | checks ${JSON.stringify(checks)}`);
  for (const [k, v] of rows) { const p = (tl.world?.places ?? []).find((x) => x.id === k); console.log(`  ${(v * 100).toFixed(0).padStart(3)}%  ${k.padEnd(24)} ${p ? `${p.theme} [${p.density}]` : ""}  rigs: ${[...rigs[k]].join(",")}`); }
  summary.push({ n: s.n, title: s.title, places: rows.length, biggest: +biggest.toFixed(3), rows: rows.map(([k, v]) => [k, +v.toFixed(3)]), checks });
  if (OUT) { fs.mkdirSync(path.join(OUT, String(s.n)), { recursive: true }); fs.writeFileSync(path.join(OUT, String(s.n), "timeline.json"), JSON.stringify(tl)); }
}
if (OUT) fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify(summary, null, 1));
