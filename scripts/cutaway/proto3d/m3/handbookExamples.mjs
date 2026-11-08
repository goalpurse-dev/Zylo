// M3: one worked example per part kind for the handbook (scene language v2, phase 1c), picked from the saved plans.
// For each kind: the shortest params that pass the validator with no error, from a plan whose part passed; at most
// MAX characters (a long panel list or rig is not an example, the rig has its own worked recipe). Writes
// m2/handbookExamples.json (committed: the worker has m2/ but not m3/). Free. Re-run after plans or field lists change.
//   node m3/handbookExamples.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY, validateScene } from "../m2/language.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS = path.join(ROOT, "m3/sweep/plans"), OUT = path.join(ROOT, "m2/handbookExamples.json");
const MAX = 220;
// numbers to 2 decimals so an example reads cleanly
const tidy = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(tidy) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) : v);

const best = {};
for (const f of fs.readdirSync(PLANS).sort()) {
  const L = JSON.parse(fs.readFileSync(path.join(PLANS, f), "utf8")).layout;
  const bad = new Set(validateScene(L).map((e) => /^parts\[(\d+)\]/.exec(e.at)?.[1]).filter(Boolean).map(Number));
  L.parts.forEach((p, i) => {
    if (bad.has(i) || p.kind === "rig" || !REGISTRY.kinds[p.kind]) return;
    const params = tidy(Object.fromEntries(Object.entries(p.params ?? {}).filter(([k]) => k !== "main")));
    const s = JSON.stringify(params);
    if (s.length > MAX || s === "{}") return;
    // (prefer the example that shows the most fields within the limit, then the shorter one)
    const n = Object.keys(params).length, cur = best[p.kind];
    if (!cur || n > cur.n || (n === cur.n && s.length < cur.s.length)) best[p.kind] = { n, s, from: f.replace(/\.json$/, ""), params };
  });
}
const out = Object.fromEntries(Object.keys(REGISTRY.kinds).filter((k) => best[k]).map((k) => [k, { from: best[k].from, params: best[k].params }]));
fs.writeFileSync(OUT, `{\n${Object.entries(out).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n}\n`);
const missing = Object.keys(REGISTRY.kinds).filter((k) => !best[k]);
console.log(`${Object.keys(out).length} kinds with an example; none for: ${missing.join(", ") || "-"}`);
