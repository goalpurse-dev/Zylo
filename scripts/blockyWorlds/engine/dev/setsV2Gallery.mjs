// SETS-V2 2026-11-09: the THEME x RIG gallery timelines for a RunPod stills job (the lead runs it; this only writes
// JSON, free). Each shot: one kid ("me") at the centre spot of a place, the place's theme preset (or an era theme put on
// a town place), one rig, one camera (wide / medium / low). Base: any planned town timeline (cast + world bible).
//   node dev/setsV2Gallery.mjs <base town timeline.json> <out dir> [--creature <base creature timeline.json>]
// -> <out>/gallery_town.json (+ gallery_creature.json) and <out>/gallery.md (the shot list: shot -> place / theme / rig / camera)
import fs from "node:fs";
import path from "node:path";
import { THEMES } from "../lib/setThemes.js";

const [baseFile, outDir] = process.argv.slice(2);
const crAt = process.argv.indexOf("--creature"), crFile = crAt > 0 ? process.argv[crAt + 1] : null;
fs.mkdirSync(outDir, { recursive: true });
const RIG_OF_LIGHT = (theme, light) => THEMES[theme].rigs[light];

function gallery(base, rows, name) {
  const tl = JSON.parse(JSON.stringify(base));
  const shots = [], md = [];
  let t = 0;
  rows.forEach(([spot, theme, light, camera, rigOverride], i) => {
    const sp = tl.world.spots.find((s) => s.id === spot);
    if (!sp) { console.warn(`${name}: no spot ${spot}`); return; }
    const rig = rigOverride ?? RIG_OF_LIGHT(theme, light);
    shots.push({ start: +t.toFixed(3), end: +(t + 1).toFixed(3), line: 0, lines: [0], part: "rule", set: sp.set, light, camera, focus: "me",
      actors: [{ id: "me", spot: "center", pose: "stand", expr: "happy", facing: "camera", hold: null }], monsterState: null, insert: null, marker: null,
      seed: 11 + i, text: rig === "alarm_red" ? "the alarm" : "", worldSpot: spot, ...(sp.place ? { place: sp.place } : {}), placeId: spot, theme, rig });
    md.push(`| ${shots.length - 1} | ${spot} | ${theme} | ${light} | ${rig} | ${camera} |`);
    t += 1;
  });
  tl.shots = shots; tl.duration = +t.toFixed(3); tl.captions = []; tl.title = `SETS-V2 gallery (${name})`;
  delete tl.needs; delete tl.critical; delete tl.lines; delete tl.visualReport; delete tl.propSense; delete tl.openingWorld; delete tl.criticalHosts; delete tl.production; delete tl.direction; delete tl.visualWorld; delete tl.giants; tl.monster = null;
  const me = tl.cast.me ?? Object.values(tl.cast)[0];
  tl.cast = { me };
  fs.writeFileSync(path.join(outDir, `gallery_${name}.json`), JSON.stringify(tl));
  return [`## ${name}: ${shots.length} stills`, "", "| shot | place | theme | light | rig | camera |", "|---|---|---|---|---|---|", ...md, ""].join("\n");
}

// the town: every place x its rigs (day, sunset, night) x two angles; era themes on the street / square; neon + alarm
const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
const places = new Map((base.world.places ?? []).map((p) => [p.id, p.theme]));
const rows = [];
for (const spot of ["main_street", "square", "park", "lane", "tower", "home", "kitchen", "school", "woods"]) {
  const theme = places.get(spot); if (!theme) continue;
  for (const light of ["day", "warm", "night"]) for (const cam of light === "day" ? ["wide", "medium", "low"] : ["wide", "medium"]) rows.push([spot, theme, light, cam]);
}
for (const [spot, theme] of [["main_street", "castle"], ["square", "castle"], ["main_street", "neon_city"], ["lane", "neon_city"], ["park", "desert_ruins"], ["main_street", "snowy_street"], ["park", "harbour"], ["woods", "cave_camp"], ["home", "workshop"], ["kitchen", "bakery"]])
  for (const light of ["day", "night"]) for (const cam of ["wide", "medium"]) rows.push([spot, theme, light, cam]);
rows.push(["main_street", "suburb", "night", "wide", "alarm_red"], ["main_street", "suburb", "night", "medium", "alarm_red"], ["home", "bedroom", "night", "medium", "alarm_red"]);
const out = [gallery(base, rows, "town")];
if (crFile) {
  const cb = JSON.parse(fs.readFileSync(crFile, "utf8"));
  const cp = new Map((cb.world.places ?? []).map((p) => [p.id, p.theme]));
  const cr = [];
  for (const spot of ["main_street", "square", "deck", "rooftop", "home"]) { const th = cp.get(spot); if (!th) continue; for (const light of ["day", "warm", "night"]) cr.push([spot, th, light, light === "day" ? "wide" : "medium"]); }
  out.push(gallery(cb, cr, "creature"));
}
fs.writeFileSync(path.join(outDir, "gallery.md"), out.join("\n"));
console.log(out.map((x) => x.split("\n")[0]).join("\n"));
