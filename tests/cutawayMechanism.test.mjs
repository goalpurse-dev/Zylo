// Phase 1 of the any-topic plan (the owner's go of 2026-11-04): the mechanism kit. A rig can now hold the insides of
// appliances and cars (drums, flames, heating coils, fans, air bags, gears that turn together, pistons on a crank), and
// a machine indoors is built big and framed piece by piece.
import test from "node:test";
import assert from "node:assert/strict";
import { RIG_MOVES, RIG_SHAPES, rigBox, rigChannels, rigProblems, rigVerb } from "../scripts/cutaway/proto3d/m2/rig.js";
import { layoutRules } from "../scripts/cutaway/proto3d/m2/layoutRules.js";
import { catalogText } from "../scripts/cutaway/proto3d/m2/catalog.js";

const rig = (nodes, extra = {}) => ({ id: "m", kind: "rig", params: { name: "machine", pos: [0, 0.12, -1.8], nodes, ...extra } });
const base = { id: "body", at: [0, 0, 0], shapes: [{ shape: "box", size: [1, 0.1, 1], at: [0, 0.05, 0] }] };

test("mechanism kit: the new shapes and moves are known, sized and checked", () => {
  for (const s of ["drum", "cone", "sphere", "torus", "fan", "element", "flame", "bellows"]) assert.ok(RIG_SHAPES.includes(s), s);
  for (const m of ["heat", "chill", "burn", "pump", "shake", "follow", "crank"]) assert.ok(RIG_MOVES.includes(m), m);
  const ok = rig([base,
    { id: "drum", parent: "body", at: [0, 0.5, 0], shapes: [{ shape: "drum", r: 0.3, h: 0.4, axis: "z" }], moves: [{ name: "roll", type: "follow", of: "motor", ratio: 0.2, axis: "z" }, { name: "rattle", type: "shake" }] },
    { id: "motor", parent: "body", at: [0.3, 0.15, 0], shapes: [{ shape: "cylinder", r: 0.06, h: 0.15, axis: "z" }], moves: [{ name: "motorOn", type: "spin", axis: "z", turns: 3 }] },
    { id: "piston", parent: "body", at: [-0.3, 0.3, 0], shapes: [{ shape: "cylinder", r: 0.06, h: 0.2 }], moves: [{ name: "stroke", type: "crank", of: "motor", axis: "y", throw: 0.08 }] },
    { id: "burner", parent: "body", at: [0, 0.12, 0.3], shapes: [{ shape: "flame", r: 0.12 }, { shape: "element", r: 0.15 }], moves: [{ name: "ignite", type: "burn" }, { name: "glow", type: "heat" }] },
    { id: "bag", parent: "body", at: [-0.3, 0.1, 0.3], shapes: [{ shape: "bellows", r: 0.1, h: 0.2, at: [0, 0.1, 0] }], moves: [{ name: "inflate", type: "extend", axis: "y", k: 1.5 }] },
  ]);
  assert.deepEqual(rigProblems(ok, { floor: 0.12 }), []);
  assert.ok(rigChannels(ok.params).includes("ignite"));
  assert.equal(rigVerb(ok.params, "glow")[0].c, "glow");
  // a drum with a follow sweeps all the way round (the camera holds it turning)
  assert.ok(rigBox(ok.params));
});

test("mechanism kit: a link names a real node that turns, and a flame needs its burn", () => {
  const P = (nodes) => rigProblems(rig([base, ...nodes]), { floor: 0.12 }).join(" | ");
  assert.match(P([{ id: "g", parent: "body", at: [0, 0.2, 0], shapes: [{ shape: "gear", r: 0.1 }], moves: [{ name: "turn", type: "follow", of: "nope" }] }]), /names the node it copies in "of"/);
  assert.match(P([{ id: "g", parent: "body", at: [0, 0.2, 0], shapes: [{ shape: "gear", r: 0.1 }], moves: [{ name: "turn", type: "follow", of: "body" }] }]), /node body never turns/);
  assert.match(P([{ id: "g", parent: "body", at: [0, 0.2, 0], shapes: [{ shape: "gear", r: 0.1 }], moves: [{ name: "turn", type: "follow", of: "g" }] }]), /cannot copy its own node/);
  assert.match(P([{ id: "f", parent: "body", at: [0, 0.12, 0], shapes: [{ shape: "flame", r: 0.1 }] }]), /flame shape stays hidden without a burn move/);
});

test("mechanism kit: indoors a small machine is built big and its pieces are framed in the middle", () => {
  const L = { key: "t", world: { cut: { x0: 10, x1: 12, z0: -3, depth: 0.6 }, shallow: true, house: false, road: false, worker: false, moreTrees: false, backdrop: { type: "kitchen" } },
    parts: [rig([base, { id: "top", parent: "body", at: [0, 0.8, 0], shapes: [{ shape: "box", size: [1, 0.05, 0.6] }] }])],
    beats: [{ s: "hook", do: [{ p: "m", v: "show" }], shots: [{ focus: ["m"] }], shows: { p: "m", does: "the machine" } }, { s: "how", do: [], shots: [{ focus: ["m.top"] }], shows: { p: "m", does: "its top" } }], roles: ["hook", "how"] };
  const { layout, notes } = layoutRules(L);
  const m = layout.parts.find((p) => p.id === "m");
  assert.ok(m.params.scale > 2 && m.params.scale <= 3, String(m.params.scale));
  assert.ok(notes.some((n) => /built at/.test(n)));
  assert.equal(layout.beats[1].shots[0].zone, "center");
  // a yard topic is untouched
  const yard = layoutRules({ ...L, world: { ...L.world, backdrop: undefined } }).layout.parts.find((p) => p.id === "m");
  assert.equal(yard.params.scale, undefined);
});

test("mechanism kit: the planner is told about the machine parts", () => {
  const t = catalogText();
  assert.match(t, /drum \{r, h, axis, holes\}/);
  assert.match(t, /follow \{of, ratio\}/);
  assert.match(t, /crank \{of, axis, throw\}/);
});

test("a hole being dug keeps lawn on both sides (the real bunker run's hook read as a wall of dirt)", () => {
  const L = { key: "t", world: { cut: { x0: -6, x1: 6, z0: -5, depth: 5.5 } }, parts: [{ id: "dig", kind: "dig", params: { mound: { x: 9, z: -4, rx: 1.6, rz: 1.3, h: 0.9 } } }],
    beats: [{ s: "hook", do: [{ p: "dig", v: "dig" }], shots: [{ focus: ["dig"], type: "mid" }], shows: { p: "dig", does: "dig the hole" } }], roles: ["hook"] };
  const shot = layoutRules(L).layout.beats[0].shots[0];
  assert.ok(shot.width <= 0.68, String(shot.width));
});

test("indoors, what the plan put around a small machine grows with it (the real stove run's outline sat in the oven)", () => {
  const L = { key: "t", world: { cut: { x0: -3, x1: 3, z0: -4, depth: 0.6 }, shallow: true, house: false, road: false, worker: false, moreTrees: false, backdrop: { type: "kitchen" } },
    parts: [{ id: "m", kind: "rig", main: true, params: { name: "m", pos: [0, 0.12, -1.8], nodes: [base, { id: "top", parent: "body", at: [0, 0.8, 0], shapes: [{ shape: "box", size: [1, 0.05, 0.6] }] }] } },
      { id: "ring", kind: "outline", params: { points: [[-0.2, 0.9, -1.8], [0.2, 0.9, -1.8], [0.2, 1.1, -1.8]], opts: { r: 0.02 } } },
      { id: "far", kind: "boxPop", params: { pos: [8, 0.12, -3], size: [1, 1, 1] } }],
    beats: [{ s: "hook", do: [{ p: "m", v: "show" }], shots: [{ focus: ["m"] }], shows: { p: "m", does: "it" } }], roles: ["hook"] };
  const out = layoutRules(L).layout, k = out.parts[0].params.scale;
  assert.ok(Math.abs(out.parts[1].params.points[0][1] - (0.12 + (0.9 - 0.12) * k)) < 0.01);
  assert.deepEqual(out.parts[2].params.pos, [8, 0.12, -3]);
});
