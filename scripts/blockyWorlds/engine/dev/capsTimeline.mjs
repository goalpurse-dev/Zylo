// CAPABILITIES agent (2026-11-06): a hand-made proof timeline, one shot per new capability (lib/caps.js), on the
// turtle target's cast: the town turtle, a black wolf as long as it with a lit castle-city on its back, an elephant
// with a town, bird and deer giants. Free: no voice, synthetic word times. Render it with the normal renderer:
//   node dev/capsTimeline.mjs <out dir>          -> <out dir>/caps_demo.json (+ prints the shot list with times)
//   node render.mjs <out dir>/caps_demo.json <out dir>/caps.mp4 --stills 1.2,3.6,...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEpic } from "../lib/epic.js";
import { validateCaps } from "../lib/caps.js";

// a four-legged black wolf (the target's Fang): the same size class as the turtle
export const WOLF = { kind: "wolf", size: 130, params: { plan: "quadruped", fur: true, town: "none", body: { len: 6.2, w: 2.9, h: 2.5, y: 3.7, round: 0.45 }, neck: { len: 1.1, up: 0.55, w: 1.3 }, head: { size: 2.0, snout: 1.2, ears: "point", eyes: "menacing", teeth: true, jaw: true, brow: true }, legs: { n: 4, len: 3.5, thick: 0.85, foot: 1.0, toes: true, knee: true }, tail: { kind: "bush", len: 3.0 }, palette: { body: "#2b2d3a", belly: "#3a3d4f", accent: "#1c1d27", eye: "#ff3a1a", glow: "#ff3a1a", nose: "#111" } } };

const D = 2.6;
export const SHOTS = [
  { name: "castle_city_night", text: "His city glows on his back.", shot: { set: "creature:turtle_out", light: "night", camera: "establish", focus: "giant:wolf", giants: [{ id: "wolf", pos: [-40, 0, -330], action: "walk", facing: "right" }] } },
  { name: "tilt_up_city", text: "From his paws up to his towers.", shot: { set: "creature:turtle_out", light: "day", camera: "giant_close", focus: "giant:wolf", move: "tilt_up", giants: [{ id: "wolf", pos: [-30, 0, -300], action: "walk", facing: "right" }], tethers: [{ from: "giant:wolf.leg0", to: [-30, 0, -240], kind: "chain", state: "slack" }] } },
  { name: "orbit_turtle", text: "Every town lives on a turtle.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "world", move: "orbit", giants: [{ id: "world", action: "walk" }] } },
  { name: "cannons_fire", text: "Fire the cannons!", shot: { set: "creature:turtle_out", light: "day", camera: "behind_army", focus: "crowd", giants: [{ id: "wolf", pos: [-60, 0, -190], action: "roar", facing: "camera", role: "target" }], crowds: [{ kind: "soldier", count: 30, formation: "line", action: "stand", pos: [-20, 0, 10], facing: "far" }], siege: [{ kind: "cannon", at: [-20, 0, 2], aim: "giant:wolf.body", count: 3, fireAt: 0.15, scale: 2.2 }] } },
  { name: "ballista_hook", text: "They fired hooks at his legs.", shot: { set: "creature:turtle_out", light: "day", camera: "behind_army", focus: "crowd", giants: [{ id: "wolf", pos: [-50, 0, -170], action: "walk", facing: "left", role: "target" }], crowds: [{ kind: "knight", count: 24, formation: "block", action: "stand", pos: [-10, 0, 10], facing: "far" }], siege: [{ kind: "ballista", at: [-10, 0, 0], aim: "giant:wolf.leg0", payload: "hook", chain: true, count: 2, fireAt: 0.1, scale: 2.4 }, { kind: "catapult", at: [-36, 0, -8], aim: "giant:wolf.body", fireAt: 0.3, scale: 2 }] } },
  { name: "soldiers_lines", text: "The soldiers pulled the lines tight.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "giant:wolf", giants: [{ id: "wolf", pos: [-80, 0, -150], action: "idle", facing: "camera" }], crowds: [{ kind: "wolf_soldier", count: 40, formation: "block", action: "march", pos: [-30, 0, -40], facing: "camera", faction: "wolf" }], tethers: [{ from: "crowd:0", to: "giant:wolf.leg0", kind: "rope", state: "fire", at: 0.05, until: 0.5 }, { from: [-50, 0, -50], to: "giant:wolf.leg1", kind: "rope", state: "taut" }, { from: [-10, 0, -50], to: "giant:wolf.neck", kind: "chain", state: "taut" }] } },
  { name: "chain_snap", text: "Then the chain snapped.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "giant:wolf", giants: [{ id: "wolf", pos: [-30, 0, -230], action: "roar", facing: "camera" }], tethers: [{ from: "giant:wolf.leg0", to: [-100, 0, -150], kind: "chain", state: "snap", at: 0.4, thick: 1.6 }, { from: "giant:wolf.leg1", to: [40, 0, -150], kind: "chain", state: "taut", thick: 1.6 }] } },
  { name: "fpv_town", text: "We flew down our own street.", shot: { set: "creature:turtle_out", light: "day", camera: "aerial", focus: "world", move: "fpv", giants: [{ id: "world", action: "walk" }] } },
  { name: "top_down_bed", text: "I was asleep when it began.", shot: { set: "bedroom", light: "day", camera: "medium", focus: "me", move: "top_down", actors: [{ id: "me", spot: "center", pose: "sleep", expr: "sleepy", facing: "camera" }] } },
  { name: "eat_tree", text: "The deer eat whole trees.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "giant:deer", giants: [{ id: "deer", pos: [35, 0, -25], action: "eat", facing: "left" }], acts: [{ kind: "eat_tree", giant: "deer", at: 0.5 }] } },
  { name: "bird_deer", text: "Birds and deer as big as hills.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "giant:deer", giants: [{ id: "deer", pos: [60, 0, -120], action: "walk", facing: "left" }, { id: "bird", pos: [20, 40, -150], action: "fly", facing: "right" }] } },
  { name: "horn_rings", text: "I blew the horn as hard as I could.", shot: { set: "creature:turtle_out", light: "day", camera: "hero_low", focus: "me", actors: [{ id: "me", spot: "center", pose: "blow", expr: "yell", facing: "wolf" }], giants: [{ id: "wolf", pos: [-30, 0, -120], action: "idle", facing: "camera" }], fx: [{ kind: "sound_rings", at: { at: "actor:me", off: [0, 0.4, -0.6] }, to: "giant:wolf.head", t0: 0.1, size: 1.2 }] } },
  { name: "shield_dome", text: "A shield went up over the shell.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "world", giants: [{ id: "world", action: "idle" }], fx: [{ kind: "shield_dome", at: "world.body", t0: 0.1, hitAt: 0.6 }] } },
  { name: "flashback", text: "Long ago, he was just a pup.", shot: { set: "creature:turtle_out", light: "day", camera: "establish", focus: "giant:pup", grade: "flashback", giants: [{ id: "pup", pos: [20, 0, -60], action: "walk", facing: "right" }] } },
  { name: "nuzzle", text: "He pressed his head to her shell.", shot: { set: "creature:turtle_out", light: "warm", camera: "duel", focus: "world", giants: [{ id: "world", action: "idle" }, { id: "wolf", pos: [-220, 0, -160], action: "idle" }], acts: [{ kind: "nuzzle", giant: "wolf", to: "world", part: "shell" }], tethers: [{ from: "giant:wolf.neck", to: { at: "giant:wolf.neck", off: [0, -40, 0] }, kind: "chain", state: "swing" }] } },
  { name: "tilted_street", text: "The whole street tipped, and we slid.", shot: { set: "creature:turtle_on", light: "day", camera: "aerial", focus: "crowd", crowds: [{ kind: "townsfolk", count: 40, formation: "scatter", action: "flee", spot: "center", onWorld: true }], tilt: { deg: 16, at: 0.1, slide: true }, giants: [{ id: "world", action: "idle" }] } },
  { name: "bridge", text: "Now a bridge joins our two towns.", shot: { set: "creature:turtle_out", light: "warm", camera: "duel", focus: "world", giants: [{ id: "world", action: "idle" }, { id: "elephant", pos: [110, 0, -150], action: "idle", facing: "world_turtle" }], tethers: [{ from: "world.back", to: "giant:elephant.back", kind: "bridge", state: "slack", sag: 0.06 }] } },
  { name: "flyover_elephant", text: "And the elephant carries a school.", shot: { set: "creature:turtle_out", light: "day", camera: "aerial", focus: "giant:elephant", move: "flyover", giants: [{ id: "elephant", pos: [60, 0, -120], action: "walk", facing: "left" }] } },
];

export function buildCapsTimeline() {
  const shots = [], captions = [];
  SHOTS.forEach((S, i) => {
    const start = +(i * D).toFixed(3), end = +((i + 1) * D).toFixed(3);
    const words = S.text.split(/\s+/); words.forEach((w, k) => captions.push({ word: w, start: +(start + 0.15 + k * 0.32).toFixed(3), end: +(start + 0.15 + k * 0.32 + 0.28).toFixed(3) }));
    const shot = { start, end, line: i, part: "tour", monsterState: null, insert: null, marker: null, seed: 11 + i * 7, actors: [], ...S.shot, visuals: [] };
    for (const g of shot.giants ?? []) if (g.facing === "world_turtle") g.facing = "far";
    shots.push(shot);
  });
  return {
    version: 1, fps: 24, width: 1080, height: 1920, duration: shots[shots.length - 1].end, title: "Capabilities proof",
    script: SHOTS.map((s) => s.text),
    cast: { me: { role: "kid", name: "Pip", seed: 3 } },
    monster: null,
    giants: {
      wolf: { ...WOLF, backTown: { style: "castle", lit: true, seed: 4 } },
      pup: { ...WOLF, size: 40, params: { ...WOLF.params, palette: { ...WOLF.params.palette, body: "#eef1f5", belly: "#ffffff", accent: "#cfd8e3", eye: "#1b1b1f", glow: null } } },
      elephant: { kind: "elephant", size: 110, backTown: { style: "town", landmarks: ["school", "grocery", "hospital"], seed: 9 } },
      deer: { kind: "deer", size: 70, params: {} },
      bird: { kind: "eagle", size: 60, params: {} },
    },
    worlds: {
      turtle_out: { creature: "turtle", view: "outside", size: 120, seed: 11, backTown: { style: "town", landmarks: ["school", "grocery", "hospital"], seed: 11 } },
      turtle_on: { creature: "turtle", view: "on", size: 120, seed: 11 },
    },
    shots, captions,
    audio: { voice: null, music: null },
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out", "caps");
  fs.mkdirSync(out, { recursive: true });
  const tl = buildCapsTimeline();
  const bad = [...validateEpic(tl), ...validateCaps(tl)];
  if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
  fs.writeFileSync(path.join(out, "caps_demo.json"), JSON.stringify(tl, null, 1));
  SHOTS.forEach((s, i) => console.log(`${String(i).padStart(2)} ${s.name.padEnd(20)} ${(i * D).toFixed(1)}-${((i + 1) * D).toFixed(1)}  mid ${(i * D + D / 2).toFixed(2)}`));
}
