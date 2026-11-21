// ROUND 2 TEST, step 1 (owner 2026-11-21): two scripts with the new writer (writer2.js), on the round's own ledger.
//   node --env-file=.env.local scripts/blockyWorlds/round2/write.mjs --out <dir> [--yes]
// The round's money cap ($5, the owner's) is shared by every round-2 step through <out>/costs.json (studio/ledger.mjs).
import fs from "node:fs";
import path from "node:path";
import { ledger } from "../studio/ledger.mjs";
import { callJson } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { writeScript2 } from "../../../supabase/functions/_shared/blockyWorlds/writer2.js";

const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(OUT, { capUsd: 5, agentCapUsd: 5 });
export const TESTS = [
  { id: "day", topic: "In this town, every time you laugh, a flower grows where you stand", when: "day" },
  { id: "night", topic: "In this town, when the street lamps turn on at night, a monster climbs out of the storm drain", when: "night" },
];
console.log(`round 2 writer: ${TESTS.length} scripts; spent so far $${L.total()} of $5`);
if (!has("yes")) { console.log("dry run (add --yes): each script is one Opus call (+ at most one rewrite), worst case about $0.45 each"); process.exit(0); }
for (const t of TESTS) {
  const f = path.join(OUT, `script_${t.id}.json`);
  if (fs.existsSync(f)) { console.log(`${t.id}: already written`); continue; }
  L.check(`write ${t.id}`, 0.9);
  const r = await writeScript2({ callJson, apiKey: process.env.ANTHROPIC_API_KEY, topic: t.topic, when: t.when, recent: t.id === "night" ? [] : [] });
  L.add("writer", r.costUsd);
  fs.writeFileSync(f, JSON.stringify({ ...t, ...r }, null, 1));
  console.log(`${t.id}: "${r.script?.title}" ${r.opening} / ${r.storyType}, ${r.script?.lines?.length} lines, ${r.tries} tr${r.tries > 1 ? "ies" : "y"}, $${r.costUsd}; problems: ${r.problems.length ? r.problems.join(" | ") : "none"}`);
}
