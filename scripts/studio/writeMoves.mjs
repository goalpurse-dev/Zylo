// Writes <work>/moves.json from <work>/timing.json (the camera plan, for the whooshes in audio.py) and checks it.
//   node writeMoves.mjs <work dir>
import fs from "node:fs";
import { planFor, planProblems } from "./timeline.js";
const [work] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(`${work}/timing.json`, "utf8"));
const p = planFor(T);
fs.writeFileSync(`${work}/moves.json`, JSON.stringify(p.filter((s) => s.type === "move"), null, 1));
for (const s of p) console.log(`${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.type === "hold" ? `hold ${s.at}` : `${s.kind} ${s.from} -> ${s.to}`}`);
const probs = planProblems(p, T);
console.log(probs.length ? `PLAN PROBLEMS: ${probs.join("; ")}` : "plan ok: every hold >= 1.2 s, no hard cuts");
