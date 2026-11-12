// Plan one script into a SIMPLE-LOOK timeline, free: the mock story director (no AI call) + estimated word timings
// (no voice). For the look checks on RunPod (dev/simple/runEngineStills.mjs) and the pacing / director comparisons.
//   node dev/simple/planScript.mjs --script <file.json> [--pick n] --out <timeline.json> [--wpm 222]
// --script: a script JSON ({ title, lines: [{ part, text }] }) or a beats results.json (--pick n = its result n,
// 1-based: results[n - 1].script + .card as the idea).
import fs from "node:fs";
import path from "node:path";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { estimateWords } from "../../lib/planText.js";
import { directStory } from "../../lib/director/index.js";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
export async function planScript({ script, idea = {}, wpm = 222, words = null } = {}) {
  const direction = await directStory({ script, idea, provider: "mock" });
  const W = words ?? estimateWords(script, wpm);
  const tl = planVideo({ script, words: W, idea, direction });
  const checks = { timeline: checkTimeline(tl), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
  return { tl, checks, direction };
}
export function loadScript(file, pick = null) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(j.results)) { const r = j.results[(Number(pick) || 1) - 1]; return { script: r.script, idea: { ...(r.card ?? {}), title: r.script.title, mood: r.card?.mood ?? r.plan?.mood ?? null } }; }
  return { script: j.script ?? j, idea: j.idea ?? {} };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const file = arg("script"), out = arg("out");
  if (!file || !out) { console.error("usage: node dev/simple/planScript.mjs --script <file> [--pick n] --out <timeline.json>"); process.exit(2); }
  const { script, idea } = loadScript(file, arg("pick"));
  const { tl, checks } = await planScript({ script, idea, wpm: Number(arg("wpm", 222)) });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(tl, null, 1));
  console.log(`${tl.title}: ${tl.shots.length} shots, ${tl.duration.toFixed(1)} s, look ${tl.look}; checks ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
  for (const [k, v] of Object.entries(checks)) for (const p of v.slice(0, 5)) console.log(`  ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
}
