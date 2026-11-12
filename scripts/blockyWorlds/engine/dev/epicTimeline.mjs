// EPIC agent: writes the hand-made dev timeline dev/epic_turtle_wolf.json (the owner's test story: a town inside a
// massive turtle, the Big Bad Wolf and his army, the town fights back, the turtle swims away). Word timings are
// synthetic (no voice: free); ~215 words a minute with short gaps, like Little Dude II's pace.
//   node dev/epicTimeline.mjs           -> dev/epic_turtle_wolf.json (+ prints the shot list)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEpic } from "../lib/epic.js";

const DEV = path.dirname(fileURLToPath(import.meta.url));
const WPS = 3.6, GAP = 0.28;

// one entry per script line: the line, its part, and its shot (EPIC fields: CONTRACT.md addendum "EPIC stories")
export const LINES = [
  { text: "In this town, we live inside a massive turtle.", part: "rule",
    shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "world", giants: [{ id: "world", action: "walk" }], actors: [] } },
  { text: "Our streets run right down the middle of its shell.", part: "tour",
    shot: { set: "creature:turtle_in", light: "day", camera: "wide", focus: "me", actors: [{ id: "me", spot: "center", pose: "walk", expr: "happy", facing: "camera" }],
      crowds: [{ kind: "townsfolk", count: 40, formation: "scatter", action: "stand", spot: "back", spacing: 2.2 }] } },
  { text: "Sunlight pours in, and the whole town sways when it walks.", part: "tour",
    shot: { set: "creature:turtle_in", light: "day", camera: "aerial", focus: "crowd", actors: [],
      crowds: [{ kind: "townsfolk", count: 120, formation: "scatter", action: "wave", spot: "far", seed: 9 }], shake: "rumble" } },
  { text: "The Big Bad Wolf. Taller than our turtle.", part: "until",
    shot: { set: "creature:turtle_out", light: "day", camera: "hero_low", focus: "me", actors: [{ id: "me", spot: "center", pose: "scared", expr: "scared", facing: "wolf" }],
      giants: [{ id: "wolf", pos: [-14, 0, -46], action: "roar", facing: "camera" }, { id: "world", action: "idle" }], beat: { type: "roar" } } },
  { text: "And behind him marched an army of soldiers.", part: "until",
    shot: { set: "creature:turtle_out", light: "day", camera: "track", focus: "crowd", actors: [],
      giants: [{ id: "wolf", spot: "giant_left", action: "walk", facing: "right" }],
      crowds: [{ kind: "wolf_soldier", count: 300, formation: "block", action: "march", pos: [-40, 0, -30], facing: "right", faction: "wolf" }], beat: { type: "march" } } },
  { text: "They charged straight at our turtle.", part: "discovery",
    shot: { set: "creature:turtle_out", light: "day", camera: "behind_army", focus: "crowd", actors: [],
      giants: [{ id: "wolf", pos: [-32, 0, -40], action: "attack", facing: "world_turtle", role: "attacker" }, { id: "world", action: "hit", role: "target" }],
      crowds: [{ kind: "wolf_soldier", count: 500, formation: "wedge", action: "charge", pos: [-10, 0, 45], facing: "far", faction: "wolf" }], beat: { type: "attack" } } },
  { text: "Boom. The whole world shook.", part: "discovery",
    shot: { set: "creature:turtle_in", light: "day", camera: "wide", focus: "me", actors: [{ id: "me", spot: "center", pose: "scared", expr: "scared", facing: "camera" }],
      crowds: [{ kind: "townsfolk", count: 60, formation: "scatter", action: "flee", spot: "back", spacing: 2, seed: 4 }], beat: { type: "impact" } } },
  { text: "So the whole town fought back.", part: "climax",
    shot: { set: "creature:turtle_on", light: "day", camera: "aerial", focus: "crowd", actors: [],
      crowds: [{ kind: "knight", count: 150, formation: "block", action: "charge", spot: "tail", facing: "away", faction: "town", onWorld: true },
               { kind: "townsfolk", count: 60, formation: "scatter", action: "cheer", spot: "back", onWorld: true, seed: 6 }] } },
  { text: "And our turtle did what wolves never expect. It swam.", part: "climax",
    shot: { set: "creature:turtle_sea", light: "warm", camera: "establish", focus: "world", actors: [], giants: [{ id: "world", action: "swim" }], beat: { type: "swim_away" } } },
  { text: "In this town, we live inside a massive turtle. And it never stops moving.", part: "closer",
    shot: { set: "creature:turtle_in", light: "warm", camera: "medium", focus: "me", actors: [{ id: "me", spot: "center", pose: "wave", expr: "happy", facing: "camera" }],
      crowds: [{ kind: "townsfolk", count: 30, formation: "scatter", action: "cheer", spot: "back", spacing: 2.4, seed: 2 }] } },
];

export function buildTimeline() {
  const captions = [], shots = [];
  let t = 0.15;
  LINES.forEach((L, i) => {
    const start = shots.length ? shots[shots.length - 1].end : 0;
    const words = L.text.split(/\s+/);
    for (const w of words) { const d = Math.max(0.16, (w.replace(/[^a-z]/gi, "").length / 5) / WPS); captions.push({ word: w, start: +t.toFixed(3), end: +(t + d * 0.92).toFixed(3) }); t += d; if (/[.,]$/.test(w)) t += GAP; }
    t += 0.12;
    const end = i === LINES.length - 1 ? +(t + 0.4).toFixed(3) : +t.toFixed(3);
    shots.push({ start: +start.toFixed(3), end, line: i, part: L.part, monsterState: null, insert: null, marker: null, seed: 11 + i * 7, ...L.shot, visuals: [] });
  });
  // the attack's target: the world's turtle (a giant entry "world"); "world_turtle" facing resolves to the far spot
  for (const s of shots) for (const g of s.giants ?? []) if (g.facing === "world_turtle") g.facing = "far";
  return {
    version: 1, fps: 24, width: 1080, height: 1920, duration: shots[shots.length - 1].end, title: "The Turtle Town",
    script: LINES.map((l) => l.text),
    cast: { me: { role: "kid", name: "Pip", seed: 3 } },
    monster: null,
    giants: { wolf: { kind: "wolf", size: 75, armour: true } },
    worlds: {
      turtle_out: { creature: "turtle", view: "outside", size: 120, seed: 11 },
      turtle_in: { creature: "turtle", view: "inside", size: 120, seed: 11 },
      turtle_on: { creature: "turtle", view: "on", size: 120, seed: 11 },
      turtle_sea: { creature: "turtle", view: "outside", size: 120, seed: 11, water: true },
    },
    shots, captions,
    audio: { voice: null, music: null },
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const tl = buildTimeline();
  const bad = validateEpic(tl);
  if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
  fs.writeFileSync(path.join(DEV, "epic_turtle_wolf.json"), JSON.stringify(tl, null, 1));
  for (const s of tl.shots) console.log(`${s.start.toFixed(2)}-${s.end.toFixed(2)}  ${s.set.padEnd(20)} ${s.camera.padEnd(10)} ${tl.script[s.line]}`);
  console.log(`duration ${tl.duration} s -> dev/epic_turtle_wolf.json`);
}
