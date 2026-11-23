// IN THIS TOWN v2: SOLVE A STAGE'S CAMERAS (free). Each camera keeps its direction (from its subjects toward its
// loc), its height and lens; the solver finds the distance and the aim height where every head is in frame above the
// captions, nothing blocks a head, the camera stands in the open, and (close / medium / two / low) the people are as
// big as that still allows. Wides keep their distance. Writes stageA.solved.json; stageTest reads it when present.
//   node scripts/blockyWorlds/v2/solveCams.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STAGE_A, H } from "./stageA.mjs";
import { checkStage, span } from "./stageCheck.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = STAGE_A;
const solved = {};
for (const [ck, c] of Object.entries(S.cameras)) {
  const heads = [...c.people.map((k) => { const a = S.spots[k].at; return [a[0], a[1], a[2] + H.kid - 0.45]; }),
    ...(c.creature ? [(() => { const a = S.creature_spots[c.creature].at; return [a[0], a[1], a[2] + 0.85 * H.creature]; })()] : [])];
  const hs = c.people.length ? heads.slice(0, c.people.length) : heads;   // the creature stays behind: aim on the people
  const C = [0, 1, 2].map((i) => hs.reduce((s, h) => s + h[i], 0) / hs.length);
  const az = [c.loc[0] - C[0], c.loc[1] - C[1]], al = Math.hypot(...az); az[0] /= al; az[1] /= al;
  const d0 = Math.hypot(c.loc[0] - C[0], c.loc[1] - C[1]);
  const ds = c.shot === "wide" || c.shot === "top" ? [d0] : Array.from({ length: 110 }, (_, i) => 2.5 + i * 0.25);
  let best = null;
  if (c.shot === "wide" || c.shot === "top" || c.fixed) { solved[ck] = c; console.log(`camera ${ck}: kept (wide / top / fixed)`); continue; }
  for (const d of ds) {
    for (let tz = -1; tz <= 12; tz += 0.25) {
      const cam = { ...c, loc: [C[0] + az[0] * d, C[1] + az[1] * d, c.loc[2]], tgt: [C[0], C[1], tz] };
      if (c.shot === "top") { cam.loc = c.loc; cam.tgt = [c.tgt[0], c.tgt[1], tz]; }
      const probs = checkStage({ ...S, cameras: { [ck]: cam } }).problems.filter((p) => p.startsWith(`camera ${ck}:`));
      if (probs.length) continue;
      // prefer heads in the upper-middle of the frame (v about 0.3), then the closest camera
      const vs = c.people.map((k) => span(cam, S.spots[k].at, 0.6, H.kid - 0.95, H.kid)).filter(Boolean).map((s) => (s[2] + s[3]) / 2);
      const vm = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0.3;
      const score = Math.abs(vm - 0.32) * 10 + (c.shot === "wide" || c.shot === "top" ? 0 : d * 0.15);
      if (!best || score < best.score) best = { score, cam };
    }
    if (best && c.shot !== "wide" && c.shot !== "top") break;   // the closest distance that works
  }
  if (!best) { console.log(`camera ${ck}: NO SOLUTION (keeps its old numbers)`); solved[ck] = c; continue; }
  const r = (v) => v.map((x) => +x.toFixed(2));
  solved[ck] = { ...c, loc: r(best.cam.loc), tgt: r(best.cam.tgt) };
  console.log(`camera ${ck}: loc ${solved[ck].loc.join(", ")}  tgt ${solved[ck].tgt.join(", ")}  lens ${c.lens}`);
}
fs.writeFileSync(path.join(HERE, "stageA.solved.json"), JSON.stringify(solved, null, 1));
const all = checkStage({ ...S, cameras: solved });
console.log(all.problems.length ? `still failing:\n- ${all.problems.join("\n- ")}` : "all cameras pass the free check");
