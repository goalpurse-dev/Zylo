// RECIPES dev probe (free, local Chrome): one planned shot rendered with several camera / move variants, to learn which
// engine cameras frame a subject (and which give blank / inside-the-body frames).
//   node dev/recipesProbe.mjs <timeline.json> <variants.json> <outDir>
//   variants.json: [{ key, shot: <index>, set?: {camera, move, focus...} }]
import fs from "node:fs";
import path from "node:path";
import { makeShotStills } from "../lib/vision/stills.mjs";

const [tlFile, varFile, out] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlFile, "utf8"));
const vars = JSON.parse(fs.readFileSync(varFile, "utf8"));
const c = JSON.parse(JSON.stringify({ ...tl, shots: [] }));
let at = 0;
const picks = [];
for (const v of vars) {
  const s = { ...JSON.parse(JSON.stringify(tl.shots[v.shot])), ...(v.set ?? {}) };
  for (const k of Object.keys(v.set ?? {})) if (v.set[k] === null) delete s[k];
  const d = s.end - s.start; s.start = at; s.end = at + d;
  picks.push({ key: v.key, t: at + d / 2 }); at += d;
  c.shots.push(s);
}
c.duration = at; c.captions = [];
const r = await makeShotStills({ dir: out, size: 640, log: console.log });
try {
  const res = await r.renderTimeline(c, picks, { name: "probe" });
  for (const x of res.stills) console.log(x.key, x.error ?? `mean ${x.mean?.toFixed?.(1)}`, x.file ?? "");
} finally { await r.close(); }
