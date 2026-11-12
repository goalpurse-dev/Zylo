// Blocky Worlds builder: the FREE mock designer and mock vision check (no network, no cost, deterministic).
// Hand-written blueprints / world specs for a few demo needs ("a robot dentist", "a ladder", "inside a giant turtle"),
// a generic fallback for anything else (a labelled crate: the mock vision fails it, so it ends as a picture card, the
// same path a real failed design takes). Used by the tests, the dev demo and BLOCKY_WORLDS_BUILDER=mock runs.
//   mockProvider({ failVision: { "<name>": n }, delayMs, costUsd }) -> { name, designObject, designWorld, vision }
import { normName } from "./spec.js";

// ------------------------------------------------------------------------------------------ hand-written designs
export const MOCK_OBJECTS = {
  "robot dentist": {
    name: "robot dentist", aliases: ["robot dentist", "dentist robot", "dentist", "robo dentist"], height: 2.1,
    parts: [
      { id: "base", shape: "cylinder", size: [0.9, 0.18, 0.9], pos: [0, 0.09, 0], color: "#4a525c", material: "metal" },
      { id: "wheel_l", shape: "cylinder", size: [0.28, 0.22, 0.28], pos: [-0.36, 0.11, 0.2], rot: [0, 0, 90], color: "#26262b", material: "plastic" },
      { id: "wheel_r", shape: "cylinder", size: [0.28, 0.22, 0.28], pos: [0.36, 0.11, 0.2], rot: [0, 0, 90], color: "#26262b", material: "plastic" },
      { id: "leg", shape: "cylinder", size: [0.22, 0.45, 0.22], pos: [0, 0.4, 0], color: "#9aa4ad", material: "metal" },
      { id: "body", shape: "roundedBox", size: [0.86, 0.8, 0.56], pos: [0, 1.0, 0], color: "#ffffff", material: "plastic" },
      { id: "coat", shape: "box", size: [0.9, 0.5, 0.58], pos: [0, 0.82, 0.0], color: "#e9f6ff", material: "fabric", pattern: "none" },
      { id: "badge", shape: "box", size: [0.3, 0.12, 0.02], pos: [0.2, 1.18, 0.3], color: "#2e86de", material: "plastic" },
      { id: "cross", shape: "box", size: [0.1, 0.1, 0.03], pos: [-0.22, 1.2, 0.3], color: "#ff4d5e", material: "glow" },
      { id: "neck", shape: "cylinder", size: [0.16, 0.12, 0.16], pos: [0, 1.46, 0], color: "#9aa4ad", material: "metal" },
      { id: "head", shape: "roundedBox", size: [0.62, 0.48, 0.5], pos: [0, 1.74, 0], color: "#dfe3e8", material: "metal" },
      { id: "screen", shape: "box", size: [0.5, 0.32, 0.03], pos: [0, 1.74, 0.255], color: "#12202e", material: "plastic" },
      { id: "eye_l", shape: "box", size: [0.09, 0.09, 0.02], pos: [-0.11, 1.79, 0.275], color: "#7fffd4", material: "glow" },
      { id: "eye_r", shape: "box", size: [0.09, 0.09, 0.02], pos: [0.11, 1.79, 0.275], color: "#7fffd4", material: "glow" },
      { id: "smile", shape: "box", size: [0.22, 0.04, 0.02], pos: [0, 1.67, 0.275], color: "#7fffd4", material: "glow" },
      { id: "mirror_light", shape: "cylinder", size: [0.24, 0.05, 0.24], pos: [0, 2.03, 0.12], rot: [70, 0, 0], color: "#fff6c8", material: "glow" },
      { id: "band", shape: "box", size: [0.64, 0.06, 0.06], pos: [0, 2.0, 0], color: "#4a525c", material: "metal" },
      { id: "antenna", shape: "cylinder", size: [0.03, 0.22, 0.03], pos: [0.2, 2.08, -0.05], color: "#9aa4ad", material: "metal" },
      { id: "antenna_tip", shape: "sphere", size: [0.08, 0.08, 0.08], pos: [0.2, 2.2, -0.05], color: "#ff4d5e", material: "glow", parent: "antenna" },
      { id: "arm_l", shape: "roundedBox", size: [0.16, 0.62, 0.16], pos: [-0.54, 1.06, 0.05], rot: [0, 0, -12], color: "#dfe3e8", material: "metal", pivot: [-0.5, 1.34, 0.05] },
      { id: "hand_l", shape: "sphere", size: [0.18, 0.18, 0.18], pos: [-0.6, 0.74, 0.08], color: "#9aa4ad", material: "metal", parent: "arm_l" },
      // rot signs fixed 2026-11-09 (connect.js): +x tips the top toward the front (+z), -z toward +x; the old [-60, 0, 20]
      // pointed the raised arm and the drill backwards, the drill and its tip floated apart
      { id: "arm_r", shape: "roundedBox", size: [0.16, 0.62, 0.16], pos: [0.6, 1.36, 0.2], rot: [60, 0, -20], color: "#dfe3e8", material: "metal", pivot: [0.5, 1.34, 0.05] },
      { id: "drill", shape: "cylinder", size: [0.08, 0.36, 0.08], pos: [0.72, 1.62, 0.44], rot: [60, 0, 0], color: "#c0c8d0", material: "metal", parent: "arm_r" },
      { id: "drill_tip", shape: "cone", size: [0.07, 0.14, 0.07], pos: [0.72, 1.8, 0.55], rot: [60, 0, 0], color: "#ffd166", material: "metal", parent: "drill" },
      { id: "tooth_crown", shape: "roundedBox", size: [0.5, 0.36, 0.36], pos: [-0.62, 0.58, 0.42], color: "#fffdf5", material: "plastic" },
      { id: "tooth_root_l", shape: "cone", size: [0.16, 0.3, 0.16], pos: [-0.72, 0.28, 0.42], rot: [180, 0, 0], color: "#fffdf5", material: "plastic" },
      { id: "tooth_root_r", shape: "cone", size: [0.16, 0.3, 0.16], pos: [-0.52, 0.28, 0.42], rot: [180, 0, 0], color: "#fffdf5", material: "plastic" },
    ],
    labels: [{ part: "badge", text: "DENTIST", color: "#ffffff", face: "front" }],
    anims: [{ part: "arm_r", kind: "swing", axis: "x", amount: 12, speed: 1.2 }, { part: "drill", kind: "spin", axis: "y", speed: 3 }, { part: "antenna_tip", kind: "blink", speed: 1.5 }, { part: "head", kind: "wobble", amount: 6, speed: 0.7 }],
    focus: [0, 1.6, 0], footprint: [1.2, 1.0],
  },
  ladder: {
    name: "ladder", aliases: ["ladder", "ladders", "step ladder", "stepladder"], height: 2.6,
    parts: [
      { id: "rail_l", shape: "box", size: [0.08, 2.6, 0.08], pos: [-0.24, 1.3, 0], rot: [-8, 0, 0], color: "#c98b4a", material: "wood" },
      { id: "rail_r", shape: "box", size: [0.08, 2.6, 0.08], pos: [0.24, 1.3, 0], rot: [-8, 0, 0], color: "#c98b4a", material: "wood" },
      ...[0.3, 0.65, 1.0, 1.35, 1.7, 2.05, 2.4].map((y, i) => ({ id: `rung${i}`, shape: "box", size: [0.5, 0.05, 0.07], pos: [0, y, -Math.tan(8 * Math.PI / 180) * (y - 1.3)], color: "#b5793c", material: "wood" })),
      { id: "foot_l", shape: "box", size: [0.12, 0.05, 0.14], pos: [-0.24, 0.025, 0.18], color: "#2b2b2e", material: "plastic" },
      { id: "foot_r", shape: "box", size: [0.12, 0.05, 0.14], pos: [0.24, 0.025, 0.18], color: "#2b2b2e", material: "plastic" },
    ],
    labels: [], anims: [], focus: [0, 1.3, 0], footprint: [0.6, 0.5],
  },
};
MOCK_OBJECTS["giant heart"] = {
  name: "giant heart", aliases: ["heart", "giant heart"], height: 2.6,
  parts: [
    { id: "lobe_l", shape: "sphere", size: [1.3, 1.3, 1.0], pos: [-0.45, 1.75, 0], color: "#d92a4a", material: "glow" },
    { id: "lobe_r", shape: "sphere", size: [1.3, 1.3, 1.0], pos: [0.45, 1.75, 0], color: "#d92a4a", material: "glow" },
    { id: "point", shape: "cone", size: [1.9, 1.5, 1.0], pos: [0, 0.95, 0], rot: [180, 0, 0], color: "#d92a4a", material: "glow", parent: "lobe_l" },
    { id: "vein", shape: "cylinder", size: [0.22, 0.9, 0.22], pos: [0.2, 2.6, -0.1], rot: [0, 0, 20], color: "#7a1730", material: "plastic", parent: "lobe_r" },
  ],
  anims: [{ part: "lobe_l", kind: "bob", axis: "y", amount: 0.06, speed: 1.4 }], focus: [0, 1.4, 0],
};

export const MOCK_WORLDS = {
  "inside a giant turtle": {
    name: "inside a giant turtle", aliases: ["inside a giant turtle", "inside the turtle", "giant turtle", "turtle belly", "inside a turtle"],
    kind: "enclosure",
    ground: { material: "flesh", color: "#e2a08e", shape: "wet" },
    enclosure: { type: "inside_creature", color: "#5e8f3c", color2: "#e8d6a8", pattern: "scales", opening: "mouth", glow: "#fff1c4" },
    palette: ["#5e8f3c", "#e8d6a8", "#d98a6a", "#9fd36a"],
    fog: { color: "#3a4a24", density: 0.35 }, particles: "spores",
    light: { base: "day", tint: "#ffe6c8", ambient: 1.1, practicals: [{ color: "#ffd9a0", pos: [0, 4.6, -3], intensity: 10 }] },
    props: [
      { blueprint: { name: "seaweed lump", height: 1.1, parts: [{ id: "a", shape: "roundedBox", size: [0.8, 0.5, 0.7], pos: [0, 0.25, 0], color: "#3f8f4a", material: "plastic" }, { id: "b", shape: "cone", size: [0.3, 0.9, 0.3], pos: [0.2, 0.9, 0], color: "#4fae5a", material: "plastic" }, { id: "c", shape: "cone", size: [0.25, 0.7, 0.25], pos: [-0.2, 0.8, 0.1], color: "#2f7a3a", material: "plastic" }] }, spot: "scatter", count: 6 },
      { blueprint: { name: "swallowed boot", height: 0.5, parts: [{ id: "leg", shape: "box", size: [0.3, 0.5, 0.3], pos: [0, 0.25, 0], color: "#6a4a32", material: "matte" }, { id: "toe", shape: "roundedBox", size: [0.3, 0.2, 0.45], pos: [0, 0.1, 0.25], color: "#6a4a32", material: "matte" }] }, spot: "side_left", count: 1 },
    ],
    landmark: MOCK_OBJECTS["giant heart"],
  },
};

// ------------------------------------------------------------------------------------------ the generic fallback
/** anything else: a crate with the thing's name on it (honest, but not "the thing": the mock vision fails it) */
export function genericBlueprint(name) {
  return {
    name, aliases: [name], height: 1.0,
    parts: [
      { id: "crate", shape: "box", size: [1, 0.9, 0.9], pos: [0, 0.45, 0], color: "#b5793c", material: "wood" },
      { id: "plate", shape: "box", size: [0.8, 0.4, 0.02], pos: [0, 0.5, 0.46], color: "#fff6e3", material: "plastic" },
    ],
    labels: [{ part: "plate", text: String(name).toUpperCase().slice(0, 24), color: "#2a1d24", face: "front" }],
    anims: [], generic: true,
  };
}
export function genericWorld(name) {
  return { name, aliases: [name], kind: "outdoor", ground: { material: "grass", color: "#8fd062", shape: "flat" }, enclosure: { type: "sky" }, palette: ["#6aa84f", "#a9d18e"], particles: "none", light: { base: "day" }, props: [], landmark: null, generic: true };
}

const find = (table, name) => {
  const n = normName(name);
  for (const [k, v] of Object.entries(table)) if (normName(k) === n || (v.aliases ?? []).some((a) => normName(a) === n)) return v;
  return null;
};
const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * The mock provider. Same interface as design.js/vision.js's real provider:
 *   designObject({ need, feedback, attempt }) -> { data: blueprint, costUsd, usage, ms }
 *   designWorld({ need, feedback, attempt })  -> { data: worldSpec, costUsd, usage, ms }
 *   vision({ need, kind, still, spec, attempt }) -> { data: { ok, confidence, reads_as, fix }, costUsd, usage, ms }
 * opts.failVision: { "<need name>": n } -> the vision check fails the first n attempts of that need (then passes);
 * a generic design always fails. opts.delayMs simulates the wait; opts.costUsd a fake per-call cost (for cap tests).
 */
export function mockProvider({ failVision = {}, delayMs = 0, costUsd = 0, throwOn = [] } = {}) {
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : null);
  const calls = { design: 0, vision: 0 };
  const usage = { input_tokens: 0, output_tokens: 0 };
  return {
    name: "mock", calls,
    async designObject({ need }) {
      calls.design++; await wait();
      if (throwOn.includes(normName(need.name))) throw new Error("mock design failure");
      const bp = find(MOCK_OBJECTS, need.name) ?? find(MOCK_OBJECTS, need.phrase ?? "") ?? genericBlueprint(need.name);
      return { data: clone(bp), costUsd, usage, ms: delayMs };
    },
    async designWorld({ need }) {
      calls.design++; await wait();
      if (throwOn.includes(normName(need.name))) throw new Error("mock design failure");
      const w = find(MOCK_WORLDS, need.name) ?? find(MOCK_WORLDS, need.phrase ?? "") ?? genericWorld(need.name);
      return { data: clone(w), costUsd, usage, ms: delayMs };
    },
    async vision({ need, spec, attempt }) {
      calls.vision++; await wait();
      const n = normName(need.name), fails = failVision[n] ?? failVision[need.name] ?? 0;
      if (spec?.generic) return { data: { ok: false, confidence: 0.9, reads_as: "a wooden crate with a label", fix: `build the ${need.name} itself from shapes, not a labelled crate` }, costUsd, usage, ms: delayMs };
      if (attempt <= fails) return { data: { ok: false, confidence: 0.7, reads_as: "an unclear blocky shape", fix: `(mock) make the ${need.name}'s key feature bigger and higher-contrast` }, costUsd, usage, ms: delayMs };
      return { data: { ok: true, confidence: 0.9, reads_as: need.name, fix: "" }, costUsd, usage, ms: delayMs };
    },
  };
}
