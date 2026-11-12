// GAPS: the real run's 33 scripts planned WITH the mock director by a baseline copy (--base) and by today's code: the
// check failures of each, side by side (so a change never adds a failure).  node dev/gapsRealChecks.mjs --base <dir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = process.argv.slice(2), base = a[a.indexOf("--base") + 1];
const RS = path.join(ENGINE, "out/stress/real-script-haiku");
const scripts = JSON.parse(fs.readFileSync(path.join(RS, "scripts.json"), "utf8")), cards = JSON.parse(fs.readFileSync(path.join(RS, "cards.json"), "utf8"));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
async function run(root) {
  const P = await import(pathToFileURL(path.join(root, "plan.mjs")).href), Dm = await import(pathToFileURL(path.join(root, "lib/director/index.js")).href);
  const out = {};
  for (const [id, sc] of Object.entries(scripts)) {
    const script = { title: sc.title, lines: sc.lines }, idea = cards[id] ?? {};
    const direction = await Dm.directStory({ script, idea, provider: "mock", exists });
    const tl = P.planVideo({ script, words: P.estimateWords(script), idea, lengthSec: 90, direction, exists });
    out[id] = { timeline: P.checkTimeline(tl), visuals: P.checkVisuals(tl, script), subjects: P.checkSubjects(tl), production: P.checkProduction(tl) };
  }
  return out;
}
const A = await run(path.resolve(base)), B = await run(ENGINE);
let worse = 0;
for (const id of Object.keys(scripts)) {
  const f = (r) => Object.entries(r).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`).join(" ") || "clean";
  const na = Object.values(A[id]).reduce((s, v) => s + v.length, 0), nb = Object.values(B[id]).reduce((s, v) => s + v.length, 0);
  if (nb > na) worse++;
  if (na || nb) console.log(`${id}  before ${f(A[id]).padEnd(30)} after ${f(B[id])}${nb > na ? "   <-- WORSE" : ""}`);
  if (nb > na) for (const [k, v] of Object.entries(B[id])) for (const p of v.slice(0, 4)) if (!JSON.stringify(A[id][k]).includes(JSON.stringify(p).slice(1, 60))) console.log(`     ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`.slice(0, 300));
}
console.log(`\n${worse} scripts with more check failures than before`);
