// WORLD-LOOK proof stills (free, local GPU): creature wide / close at day, dusk, night, dawn; the wolf's castle city
// and the on-back camera; street-level places in the town on the turtle with people; the forest with the creature
// unobstructed. Writes a timeline, renders one still per shot, a contact sheet, and the render ms per frame.
//   node dev/worldlook.mjs <outDir> [--only 0,3,8] [--w 540 --h 960]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderStills, parseArgs, ENGINE } from "../render.mjs";

const { pos, opt } = parseArgs(process.argv.slice(2), ["only", "w", "h"]);
const out = path.resolve(pos[0] ?? "out/dev/worldlook");
fs.mkdirSync(out, { recursive: true });
const W = Number(opt.w ?? 1080), H = Number(opt.h ?? 1920);

const A = (id, spot, pose, expr = "happy", facing = "camera") => ({ id, spot, pose, expr, facing, hold: null });
export const PROOF = [
  { label: "turtle wide day", set: "creature:turtle_out", light: "day", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "turtle wide dusk", set: "creature:turtle_out", light: "dusk", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "turtle wide night", set: "creature:turtle_out", light: "night", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "turtle wide dawn", set: "creature:turtle_out", light: "dawn", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "turtle close day", set: "creature:turtle_out", light: "day", camera: "giant_close", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "forest track (unobstructed)", set: "creature:turtle_out", light: "day", camera: "track", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "forest low hero", set: "creature:turtle_out", light: "day", camera: "hero_low", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "wolf wide day", set: "creature:wolf_out", light: "day", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "wolf wide night", set: "creature:wolf_out", light: "night", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }] },
  { label: "wolf on-back night", set: "creature:wolf_out", light: "night", camera: "medium", focus: "world", move: "on_back", giants: [{ id: "world", action: "walk" }] },
  { label: "wolf on-back day", set: "creature:wolf_out", light: "day", camera: "medium", focus: "world", move: "on_back", giants: [{ id: "world", action: "walk" }] },
  { label: "street day", set: "creature:turtle_town", light: "day", camera: "medium", focus: "me", place: "street", actors: [A("me", "center", "walk"), A("gramps", "left", "talk", "happy", "me")] },
  { label: "deck day", set: "creature:turtle_town", light: "day", camera: "medium", focus: "gramps", place: "deck", actors: [A("gramps", "center", "wave"), A("me", "right", "cheer", "excited")] },
  { label: "stairs day", set: "creature:turtle_town", light: "day", camera: "wide", focus: "me", place: "stairs", actors: [A("me", "center", "run", "scared", "away")] },
  { label: "rooftop day", set: "creature:turtle_town", light: "day", camera: "medium", focus: "me", place: "rooftop", actors: [A("me", "center", "run", "excited")] },
  { label: "school day", set: "creature:turtle_town", light: "day", camera: "wide", focus: "group", place: "school", actors: [A("me", "center", "run", "happy"), A("kid2", "left", "run", "excited"), A("kid3", "right", "walk", "happy")] },
  { label: "room day", set: "creature:turtle_town", light: "day", camera: "medium", focus: "me", place: "room", actors: [A("me", "center", "talk", "surprised")] },
  { label: "classroom day", set: "creature:turtle_town", light: "day", camera: "wide", focus: "group", place: "classroom", actors: [A("me", "center", "point", "happy"), A("kid2", "left", "cheer", "excited"), A("kid3", "right", "talk", "happy")] },
  { label: "street night", set: "creature:turtle_town", light: "night", camera: "medium", focus: "me", place: "street", actors: [A("me", "center", "walk", "scared"), A("gramps", "left", "point", "surprised")] },
  { label: "deck dusk", set: "creature:turtle_town", light: "dusk", camera: "medium", focus: "gramps", place: "deck", actors: [A("gramps", "center", "talk"), A("me", "right", "talk", "happy", "gramps")] },
];

const only = opt.only ? String(opt.only).split(",").map(Number) : null;
const list = PROOF.map((s, i) => ({ ...s, i })).filter((s) => !only || only.includes(s.i));
const tl = {
  version: 1, fps: 24, width: W, height: H, duration: list.length, title: "World look proof",
  cast: { me: { role: "kid", name: "Pip", seed: 3 }, gramps: { role: "elder", name: "Grandpa", seed: 21 }, kid2: { role: "kid", name: "Ada", seed: 7 }, kid3: { role: "kid", name: "Bo", seed: 12 } },
  worlds: {
    turtle_out: { creature: "turtle", view: "outside", size: 120, seed: 11 },
    turtle_town: { creature: "turtle", view: "street", size: 120, seed: 11 },
    wolf_out: { creature: "wolf", view: "outside", size: 110, seed: 13, villain: true, backTown: { style: "castle" } },
  },
  shots: list.map((s, k) => ({ start: k, end: k + 1, line: 0, part: "proof", set: s.set, light: s.light, camera: s.camera, focus: s.focus, actors: s.actors ?? [], giants: s.giants ?? [], move: s.move, place: s.place, monsterState: null, insert: null, marker: null, seed: 7 + k })),
  captions: [], audio: null,
};
for (const s of tl.shots) if (!s.move) delete s.move;
const tlPath = path.join(out, "timeline.json");
fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
const t0 = Date.now();
const files = await renderStills({ timelinePath: tlPath, times: list.map((_, k) => k + 0.5), outPrefix: path.join(out, "s"), raw: true });
console.log(`stills: ${list.length} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// contact sheet: 5 per row, labelled
const cols = 5, tw = 270, th = 480, rows = Math.ceil(files.length / cols);
const args = ["-v", "error", "-y"];
files.forEach((f) => args.push("-i", f));
const lab = (t) => t.replace(/[:'\\]/g, "").replace(/,/g, " ");
let fc = files.map((_, k) => `[${k}:v]scale=${tw}:${th},drawtext=fontfile=assets/LilitaOne-Regular.ttf:text='${k}. ${lab(list[k].label)}':fontcolor=white:fontsize=16:box=1:boxcolor=black@0.6:x=6:y=6[v${k}]`).join(";");
const lay = files.map((_, k) => `${(k % cols) * tw}_${Math.floor(k / cols) * th}`).join("|");
fc += `;${files.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${files.length}:layout=${lay}:fill=black`;
if (files.length > 1) { execFileSync("ffmpeg", [...args, "-filter_complex", fc, path.join(out, "sheet.jpg")], { cwd: ENGINE }); console.log(`sheet: ${path.join(out, "sheet.jpg")} (${rows} rows)`); }
