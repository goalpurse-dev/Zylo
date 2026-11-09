// SETS-V2 2026-11-09: a stills folder (j<job>_<k>_s<shot>.jpg) + its timeline -> the look measure per base light, per
// place and per rig (what the auto grade would do to each shot). Free (ffmpeg only).
//   node dev/setsV2Breakdown.mjs <timeline.json> <stills dir>
import fs from "node:fs";
import path from "node:path";
import { measureImage } from "./setsV2Measure.mjs";
import { gradeFor, rigFor } from "../lib/setThemes.js";

const [tlFile, dir] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlFile, "utf8"));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => /_s(\d+)\.jpg$/.test(x))) {
  const si = Number(f.match(/_s(\d+)\.jpg$/)[1]), s = tl.shots[si];
  if (!s) continue;
  const st = measureImage(path.join(dir, f));
  const rig = s.rig ?? rigFor({ theme: s.theme, light: s.light, text: s.text });
  rows.push({ si, light: s.light, place: s.placeId ?? s.worldSpot ?? s.place ?? s.set, set: s.set, rig, ...st, g: gradeFor(st, rig) });
}
const group = (key) => {
  const m = {};
  for (const r of rows) (m[r[key]] ??= []).push(r);
  for (const [k, rs] of Object.entries(m)) console.log(`  ${key} ${String(k).padEnd(28)} n ${String(rs.length).padStart(2)}  V ${med(rs.map((r) => r.bright)).toFixed(2)}  S ${med(rs.map((r) => r.sat)).toFixed(2)}  warm ${med(rs.map((r) => r.warm)).toFixed(3)}  clip ${med(rs.map((r) => r.clip)).toFixed(2)}  -> grade expo ${med(rs.map((r) => r.g.expo)).toFixed(2)} sat ${med(rs.map((r) => r.g.sat)).toFixed(2)} warm ${med(rs.map((r) => r.g.warm)).toFixed(3)}`);
};
console.log(`${tl.title}: ${rows.length} stills`);
group("light"); group("place");
if (process.argv.includes("--each")) for (const r of rows.sort((a, b) => a.si - b.si)) console.log(`  s${r.si} ${r.light} ${r.place} V ${r.bright.toFixed(2)} S ${r.sat.toFixed(2)} w ${r.warm.toFixed(2)} clip ${r.clip.toFixed(2)} dark ${r.dark.toFixed(2)} | ${String(r.g.expo)} ${String(r.g.sat)} ${String(r.g.warm)}`);
