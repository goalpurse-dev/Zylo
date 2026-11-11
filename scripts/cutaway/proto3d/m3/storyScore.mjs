// M3: the story rules scoreboard (the owner's competitor study, 2026-11-11; m2/storyRules.js). Free, no render: each
// benchmark topic's first saved plan through storyRuleProblems, and how many topics pass each rule.
//   node m3/storyScore.mjs [--dir m3/sweep/plans] [--json OUT.json] [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BENCH } from "./bench.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const DIR = path.resolve(a.dir ?? path.join(here, "sweep", "plans"));
const { storyRuleProblems } = await import(pathToFileURL(path.join(here, "../m2/storyRules.js")).href);

const RULES = ["rule 1", "rule 2", "rule 3", "rule 4", "rule 6", "rule 7", "rule 8", "rule 9"];
const rows = [];
for (const t of BENCH) {
  const file = t.plans.map((k) => path.join(DIR, `${k}.json`)).find((f) => fs.existsSync(f));
  if (!file) { rows.push({ name: t.name, cat: t.cat, plan: null }); continue; }
  const P = JSON.parse(fs.readFileSync(file, "utf8")), S = P.sentences ?? [];
  const words = S.reduce((k, s) => k + String(s.text).split(/\s+/).filter(Boolean).length, 0);
  const lengthSec = P.lengthSec ?? (words > 150 ? 60 : 30);
  const r = storyRuleProblems(P.layout, P.story ?? {}, S, lengthSec);
  const failed = RULES.filter((x) => r.problems.some((p) => p.startsWith(x)));
  rows.push({ name: t.name, cat: t.cat, plan: path.basename(file, ".json"), lengthSec, words, lines: S.length, ...r.stats, failed, problems: r.problems });
}
const have = rows.filter((r) => r.plan);
console.log(`topic | len | lines | loops | max gap s | hook returns | meters | names | rules failed`);
for (const r of rows) console.log(r.plan ? `${r.name} | ${r.lengthSec} | ${r.lines} | ${r.loops} | ${r.maxGap ?? "-"} | ${r.hookReturns ? "yes" : "no"} | ${r.meters} | ${r.names} | ${r.failed.join(", ") || "none"}` : `${r.name} | no plan`);
console.log(`\nper rule (topics passing, of ${have.length}):`);
for (const x of RULES) console.log(`  ${x}: ${have.filter((r) => !r.failed.includes(x)).length}`);
console.log(`  all rules: ${have.filter((r) => !r.failed.length).length}`);
if (a.verbose) for (const r of have) if (r.problems.length) console.log(`\n${r.name}:\n- ${r.problems.join("\n- ")}`);
if (a.json) fs.writeFileSync(path.resolve(a.json), JSON.stringify(rows, null, 1));
