// M2: the shot vocabulary, measured on the two hand-built camera paths (the approved landfill and French drain):
// for every key, its distance as a share of the home distance, its turn away from the home direction, and its
// pitch. The director's SHOTS and its limits (TURN_MAX, the closest and widest shot) come from this table.
//   node m2/shotStudy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sub = (a, b) => a.map((v, i) => v - b[i]), len = (a) => Math.hypot(...a), unit = (a) => a.map((v) => v / len(a));
const angle = (a, b) => (Math.acos(Math.min(1, a.reduce((s, v, i) => s + v * b[i], 0))) * 180) / Math.PI;

export function studyKeys(keys) {
  const k0 = keys[0], d0 = len(sub(k0.pos, k0.tgt)), u0 = unit(sub(k0.pos, k0.tgt));
  let prev = u0;
  return keys.map((k) => {
    const v = sub(k.pos, k.tgt), d = len(v), u = unit(v);
    const row = { at: k.at, dist: +(d / d0).toFixed(2), fromHome: +angle(u, u0).toFixed(1), turn: +angle(u, prev).toFixed(1), pitch: +((Math.asin(u[1]) * 180) / Math.PI).toFixed(0) };
    prev = u; return row;
  });
}

if (/shotStudy\.mjs$/.test(process.argv[1] ?? "")) {
  for (const key of ["french_drain", "landfill"]) {
    const L = JSON.parse(fs.readFileSync(path.join(here, "layouts", `${key}.json`), "utf8"));
    const rows = studyKeys(L.camera.keys);
    console.log(`\n${key}`);
    for (const r of rows) console.log(`${JSON.stringify(r.at).padEnd(34)} dist ${r.dist.toFixed(2)}  from home ${String(r.fromHome).padStart(5)}°  turn ${String(r.turn).padStart(5)}°  pitch ${r.pitch}°`);
    console.log("max turn", Math.max(...rows.map((r) => r.turn)), "max from home", Math.max(...rows.map((r) => r.fromHome)), "dist range", Math.min(...rows.map((r) => r.dist)), Math.max(...rows.map((r) => r.dist)));
  }
}
