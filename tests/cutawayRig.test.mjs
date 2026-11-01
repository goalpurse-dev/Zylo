import test from "node:test";
import assert from "node:assert/strict";
import { RIG_SHAPES, RIG_MOVES, rigChannels, rigVerb, rigBox, rigProblems } from "../scripts/cutaway/proto3d/m2/rig.js";
import { focusOfId } from "../scripts/cutaway/proto3d/m2/focus.js";
import { modelMatches, modelCatalog } from "../scripts/cutaway/proto3d/m2/models.js";
import { libraryMatches } from "../scripts/cutaway/proto3d/m2/planner.mjs";
import { KIND_CHANNELS, KINDS } from "../scripts/cutaway/proto3d/m2/parts.js";
import { kitCheck } from "../supabase/functions/_shared/cutaway/topics.js";

// a small part the planner designed (a toilet: bowl, tank, a flapper on a hinge, a handle that swings 25 degrees)
const toilet = () => ({ id: "toilet", kind: "rig", main: true, params: { name: "toilet", synonyms: ["flush toilet"], pos: [0, 0.12, -2.4], nodes: [
  { id: "bowl", at: [0, 0, 0], shapes: [{ shape: "cylinder", r: 0.17, h: 0.3, axis: "y", at: [0, 0.15, 0.05] }, { shape: "cylinder", r: 0.26, h: 0.18, axis: "y", at: [0, 0.39, 0.12], look: "glass" }, { shape: "box", size: [0.3, 0.26, 0.12], at: [0, 0.6, -0.3] }],
    moves: [{ name: "swirl", type: "flow", path: [[0.2, 0.47, 0.12], [0, 0.45, 0.32], [-0.2, 0.43, 0.12]] }, { name: "dirty", type: "fill", box: { size: [0.4, 0.16, 0.4], at: [0, 0.39, 0.12] } }] },
  { id: "tank", parent: "bowl", at: [0, 0.93, -0.27], shapes: [{ shape: "box", size: [0.56, 0.42, 0.2], at: [0, 0, 0], look: "glass" }],
    moves: [{ name: "water", type: "fill", box: { size: [0.52, 0.36, 0.16], at: [0, -0.02, 0] } }] },
  { id: "flapper", parent: "tank", at: [0, -0.19, 0], shapes: [{ shape: "cylinder", r: 0.06, h: 0.025, axis: "y", at: [0.06, 0.01, 0] }, { shape: "hinge", r: 0.012, h: 0.08, axis: "z", at: [0, 0.01, 0] }],
    moves: [{ name: "addFlapper", type: "appear" }, { name: "lift", type: "swing", axis: "z", angle: 70 }] },
  { id: "handle", parent: "tank", at: [-0.24, 0.14, 0.11], shapes: [{ shape: "box", size: [0.12, 0.03, 0.03], at: [-0.06, 0, 0] }, { shape: "cable", path: [[0.2, 0, -0.1], [0.3, -0.32, -0.11]], r: 0.008 }],
    moves: [{ name: "press", type: "swing", axis: "z", angle: -25 }] },
] } });
const edit = (f) => { const t = toilet(); f(t.params); return t; };

test("rig: a registered kind with the shapes and moves the owner listed", () => {
  assert.ok(KINDS.rig, "rig is a kind"); assert.deepEqual(KIND_CHANNELS.rig, ["pop"]);
  for (const s of ["panel", "box", "tube", "cylinder", "wheel", "rail", "track", "spring", "chain", "belt", "gear", "cable", "hinge", "button", "light", "screen", "model"]) assert.ok(RIG_SHAPES.includes(s), s);
  for (const m of ["slide", "swing", "track", "spin", "extend", "fill", "flow", "light", "blink", "count", "appear"]) assert.ok(RIG_MOVES.includes(m), m);
});

test("rig: each move name is one channel and a kit verb (name and nameBack), plus show and hide", () => {
  const p = toilet().params;
  assert.deepEqual(rigChannels(p), ["pop", "swirl", "dirty", "water", "addFlapper", "lift", "press"]);
  assert.equal(rigVerb(p, "lift")[0].c, "lift"); assert.equal(rigVerb(p, "lift")[0].amp, 1);
  assert.equal(rigVerb(p, "liftBack")[0].amp, -1);
  assert.equal(rigVerb(p, "show")[0].c, "pop"); assert.equal(rigVerb(p, "hide")[0].e, "in2");
  assert.equal(rigVerb(p, "addFlapper")[0].e, "back");
  assert.equal(rigVerb(p, "explode"), null, "an unknown move is not a verb");
});

test("rig checks: a sound recipe passes; floating, unknown, clashing, airborne and giant recipes are refused (free, before paying)", () => {
  assert.deepEqual(rigProblems(toilet(), { floor: 0.12 }), []);
  assert.match(rigProblems(edit((p) => { p.nodes[1].at = [0, 3, -0.27]; }), { floor: 0.12 }).join(), /tank floats apart from its parent bowl/);
  assert.match(rigProblems(edit((p) => { p.nodes[0].shapes[0].shape = "blob"; }), { floor: 0.12 }).join(), /unknown shape blob/);
  assert.match(rigProblems(edit((p) => { p.nodes[2].moves[1] = { name: "press", type: "slide", to: [0, 0.1, 0] }; }), { floor: 0.12 }).join(), /one name, one type/);
  assert.match(rigProblems(edit((p) => { p.pos = [0, 1.5, -2.4]; }), { floor: 0.12 }).join(), /not on the floor/);
  assert.match(rigProblems(edit((p) => { p.nodes[0].shapes[0].h = 30; }), { floor: 0.12 }).join(), /sizes are in metres/);
});

test("rig framing: a shot of one piece frames that piece; a 25 degree swing sweeps its arc, not a whole circle", () => {
  const t = toilet(), parts = new Map([["toilet", t]]);
  const whole = focusOfId(parts, "toilet", null), tank = focusOfId(parts, "toilet.tank", null), handle = rigBox(t.params, { node: "handle" });
  assert.ok(tank.min[1] > whole.min[1] + 0.4, "the tank shot leaves the bowl's foot out");
  const w = (b) => b.max[0] - b.min[0];
  assert.ok(w(handle) < 0.75, `the handle's box is ${w(handle).toFixed(2)} m wide (a full circle would be ~0.9)`);
  assert.ok(handle.max[2] - handle.min[2] < 0.3, "a swing about z keeps the piece's depth");
  assert.equal(focusOfId(parts, "toilet.nothing", null), null);
});

test("CC0 models: the catalog finds a kit model by plain words", { skip: !modelCatalog().length && "no model catalog here" }, () => {
  const m = modelMatches("a cardboard box gets crushed");
  assert.ok(m.some((x) => /cardboardBox/i.test(x.file ?? x)), JSON.stringify(m.slice(0, 3)));
});

test("saved parts: the kit's learned parts are offered by name or synonym", () => {
  const lib = [{ name: "garage door", synonyms: ["roll up door"], recipe: {} }, { name: "rain barrel", synonyms: ["water butt"], recipe: {} }];
  assert.deepEqual(libraryMatches(lib, "how a roll up door opens").map((e) => e.name), ["garage door"]);
  assert.deepEqual(libraryMatches(lib, "how a water butt fills").map((e) => e.name), ["rain barrel"]);
  assert.deepEqual(libraryMatches(lib, "how a toaster works"), []);
});

test("topic policy: new machines are built, only what the format cannot show is refused", () => {
  for (const t of ["garage door", "rain barrel", "how a toilet flushes", "microwave", "traffic light"]) assert.equal(kitCheck(t).verdict, "yes", t);
  for (const t of ["how the heart pumps blood", "a black hole", "the solar system"]) assert.equal(kitCheck(t).verdict, "no", t);
});

test("code decides HOW a shot is framed: the plan's camera box, view and width are dropped; a car is seen with its signal; the finish shows the build and what it adds; the hook's thing is the subject", async () => {
  const { layoutRules } = await import("../scripts/cutaway/proto3d/m2/layoutRules.js");
  const L = {
    world: { cut: { x0: -3, x1: 3, z0: -3, depth: 0.6 }, shallow: true },
    parts: [{ id: "tl", kind: "trafficLight", params: { pos: [-4, 0.12, -6] } }, { id: "lone", kind: "car", params: { pos: [2, 0.12, -6] } }, { id: "bench", kind: "prop", params: { type: "bench", pos: [4, 0.12, -6] } }],
    beats: [
      { s: "hook", shows: { p: "tl" }, do: [{ p: "tl", v: "show" }], shots: [{ focus: ["tl"], type: "close" }] },
      { s: "problem2", shows: { p: "lone" }, do: [{ p: "lone", v: "arrive" }], shots: [{ box: { min: [1, 0, -7], max: [3, 2, -5] }, view: "low" }] },
      { s: "finish", do: [{ p: "bench", v: "show" }], shots: [{ focus: ["bench"], width: 0.8 }] },
    ],
  };
  const out = layoutRules(L).layout, B = Object.fromEntries(out.beats.map((b) => [b.s, b]));
  assert.equal(out.codeShots, true);
  assert.deepEqual(B.problem2.shots, [{ focus: ["lone", "tl"], width: 0.94 }], "no box, no view: the car and its signal, with the main subject filling the frame");
  assert.deepEqual(B.hook.shots, [{ focus: ["tl"], width: 0.94 }], "no type: the code's width");
  // (the finish frames the build and what it adds, close enough to read them: 2026-10-29)
  assert.deepEqual(B.finish.shots, [{ focus: ["tl", "bench"], width: 0.85 }]);
  assert.equal(out.parts.find((p) => p.id === "tl").main, true, "the hook builds the subject");
});

test("the writer may only promise what the setting holds: both roads, turning and people are caught before the scene is paid for", async () => {
  const { KIT_CANNOT } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const caught = (t) => KIT_CANNOT.some(([re]) => re.test(t));
  for (const t of ["But it never changes, so cars pile up down both roads.", "So cars jam the cross street.", "The car turns left.", "But pedestrians wait forever."]) assert.equal(caught(t), true, t);
  for (const t of ["But it never changes, so cars pile up at the red.", "So drivers can stop or clear the crossing.", "One car waits at an empty red."]) assert.equal(caught(t), false, t);
});
