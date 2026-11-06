// Blocky Worlds shot review, FREE end to end on a planned timeline: the real stills (this laptop's Chrome), the real
// re-plan + the real pre-render checks, the MOCK judge (it reads the planned shots, it cannot see: the verdicts are not
// evidence, the timings, the batching, the fixes and the checks are). No paid call of any kind.
//   node dev/visionDryRun.mjs --dir <folder with timeline.json [+ script.json]> [--premise "..."] [--out dir] [--no-stills]
//   prints per pass: lines, stills, page load, stills, judge, fixes; writes <out>/shot-review.json + the timeline after
import fs from "node:fs";
import path from "node:path";
import { reviewShots } from "../lib/vision/shotReview.js";
import { mockJudge } from "../lib/vision/mock.js";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../plan.mjs";

const args = process.argv.slice(2), opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt("--dir", "."));
const tl = JSON.parse(fs.readFileSync(path.join(dir, "timeline.json"), "utf8"));
const sf = path.join(dir, "script.json");
const script = fs.existsSync(sf) ? (JSON.parse(fs.readFileSync(sf, "utf8")).script ?? JSON.parse(fs.readFileSync(sf, "utf8"))) : { lines: tl.lines };
const out = path.resolve(opt("--out", path.join(dir, "vision")));
const check = (t) => [...(checkTimeline(t) ?? []), ...(checkVisuals(t, script) ?? []).map((m) => `visual ${m.line}: ${m.missing?.join(", ")}`), ...(checkSubjects(t) ?? []).map((x) => `subject ${x.shot}: ${x.problem}`), ...(t.production ? (checkProduction(t) ?? []).map((x) => JSON.stringify(x)) : [])];
const before = check(tl).length;

// a fake renderer that only times nothing (--no-stills), else the real one
const stills = args.includes("--no-stills")
  ? { renderTimeline: async (t, picks) => ({ stills: picks.map((p) => ({ ...p, jpeg: Buffer.from("x"), w: 432, h: 768, file: null, ms: 0 })), loadMs: 0, ms: 0 }), close: async () => {} }
  : async () => (await import("../lib/vision/stills.mjs")).makeShotStills({ dir: path.join(out, "stills"), log: console.log });

const T0 = Date.now();
const { tl: after, report } = await reviewShots({ tl, script, premise: opt("--premise"), judge: mockJudge(), stills, check, budget: { maxMs: 600000, loadMs: 0 }, outDir: out, log: console.log });
fs.writeFileSync(path.join(out, "timeline.reviewed.json"), JSON.stringify(after));
console.log(`\n${((Date.now() - T0) / 1000).toFixed(1)} s total; check problems before ${before}, after ${check(after).length}`);
for (const p of report.passes) console.log(`pass ${p.pass}: ${p.lines} lines, ${p.stills} stills, load ${(p.loadMs / 1000).toFixed(1)} s, stills ${(p.stillsMs / 1000).toFixed(1)} s, judge ${(p.judgeMs / 1000).toFixed(1)} s (${p.calls} calls), fixes ${p.fixes ?? 0} (applied ${p.applied ?? 0}, reverted ${p.reverted ?? 0})${p.skipped ? `, skipped: ${p.skipped}` : ""}; ${JSON.stringify(p.counts)}`);
const ops = (l) => Object.entries(l.reduce((c, f) => ((c[f.op] = (c[f.op] ?? 0) + 1), c), {})).map(([k, v]) => `${k} ${v}`).join(", ");
console.log(`fixes applied: ${ops(report.fixes.applied) || "none"}; reverted by the checks: ${ops(report.fixes.reverted) || "none"}; not applicable: ${ops(report.fixes.unapplied) || "none"}`);
console.log(`cards ${report.cards.length}, unresolved ${report.unresolved.length}; final ${JSON.stringify(report.counts)}; stopped: ${report.stopped ?? "-"} -> ${out}`);
