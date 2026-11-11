import test from "node:test";
import assert from "node:assert/strict";
import { varietyShots, HOLD } from "../scripts/cutaway/proto3d/m2/variety.js";

// a machine indoors: a spin starting in fix1, a long problem line with no motion, the hook and the end left alone
const rig = { id: "dw", kind: "rig", main: true, params: { pos: [0, 0, -2], nodes: [
  { id: "tub", at: [0, 0, 0], shapes: [{ shape: "box", size: [1.4, 2, 1.4], at: [0, 1, 0] }], moves: [{ name: "pool", type: "fill" }] },
  { id: "arm", parent: "tub", at: [0, 0.3, 0], shapes: [{ shape: "box", size: [1, 0.05, 0.1], at: [0, 0, 0] }], moves: [{ name: "arm", type: "appear" }, { name: "spin", type: "spin" }] },
  { id: "grime", parent: "tub", at: [0, 1, 0.5], shapes: [{ shape: "box", size: [0.1, 0.1, 0.02], at: [0, 0, 0] }], moves: [{ name: "dirty", type: "appear" }] },
] } };
const layout = (extra = {}) => ({ codeShots: true, world: { backdrop: { type: "kitchen" } }, parts: [rig], beats: [{ s: "problem", do: [{ p: "dw", v: "dirty" }] }], ...extra });
const sentences = [
  { role: "hook", t0: 0, t1: 4.5 }, { role: "problem", t0: 4.8, t1: 9.6 }, { role: "fix1", t0: 9.9, t1: 13.8 },
  { role: "name", t0: 14, t1: 15.2 }, { role: "congrats", t0: 15.5, t1: 17 },
];
const tracks = { "dw.spin": { base: 0, ramps: [{ t0: 11.6, t1: 12.8, amp: 1 }] }, "dw.arm": { base: 0, ramps: [{ t0: 10.1, t1: 10.5, amp: 1 }] } };
const shots = sentences.map((s) => ({ at: { s: s.role }, t: s.t0, focus: ["dw"], width: 0.94 }));

test("variety: a detail cut on the piece that starts moving, a close-up on a long still line, never the hook or the end", () => {
  const v = varietyShots(layout(), tracks, sentences, shots);
  const fix1 = v.shots.find((s) => s.at.s === "fix1");
  assert.deepEqual(fix1.focus, ["dw.arm"]);
  assert.equal(fix1.variety, "detail");
  assert.ok(Math.abs(fix1.t - 11.45) < 0.01);
  const problem = v.shots.find((s) => s.at.s === "problem");
  assert.equal(problem.variety, "close");
  assert.deepEqual(problem.focus, ["dw.grime"]);
  assert.ok(!v.shots.some((s) => ["hook", "name", "congrats"].includes(s.at.s)));
  assert.ok(HOLD <= 4);
  // (a tiny piece is framed with some of the machine round it: at least 40% of it each way)
  assert.ok(problem.box.max[0] - problem.box.min[0] >= 0.4 * 1.4 - 0.01);
});

test("variety: never a premade video, an outdoor world, a machine that is not a designed part, or a hand-made camera path", () => {
  assert.equal(varietyShots(layout({ approved: true, template: true }), tracks, sentences, shots).shots.length, 0);
  // (the machine's own detail cuts stay for a machine indoors; since the owner's rule 13 of 2026-11-11 every custom layout
  // also gets the close / wide rhythm shots, cameraRules.js, marked `rhythm`, so only the `variety` ones are counted here)
  const machine = (L) => varietyShots(L, tracks, sentences, shots).shots.filter((s) => s.variety).length;
  assert.equal(machine(layout({ world: { backdrop: { type: "street" } } })), 0);
  assert.equal(machine(layout({ parts: [{ ...rig, kind: "tank" }] })), 0);
  assert.equal(varietyShots(layout({ camera: { keys: [{ at: 0 }] } }), tracks, sentences, shots).shots.length, 0);
  // every planned layout carries template: true (plan.js); that alone is no premade video
  assert.ok(varietyShots(layout({ template: true }), tracks, sentences, shots).shots.length > 0);
});

// the owner's camera rules 12-14 of 2026-11-11 (cameraRules.js): a macro on each fix line, a new view every 2-4 s, a long
// part's macro is its near end, never on a premade video
test("camera rules: a fix line dives into its mechanism, long holds are broken, never a premade video", async () => {
  const { rhythmShots, macroRegion, sameView, cameraRulesOn } = await import("../scripts/cutaway/proto3d/m2/cameraRules.js");
  const L = layout({ beats: [{ s: "problem", shows: { p: "dw.grime" }, do: [{ p: "dw", v: "dirty" }] }, { s: "fix1", shows: { p: "dw" }, do: [{ p: "dw", v: "spin" }] }] });
  const own = shots.map((s) => ({ ...s })), r = rhythmShots(L, tracks, sentences, own);
  // (a dive of its own, or, with no room for a travel and a dive, the line's own shot made the macro)
  assert.ok([...r.shots, ...own].some((s) => s.at.s === "fix1" && s.rhythm === "macro"), "fix1 gets a macro");
  assert.ok(r.shots.some((s) => s.at.s === "problem" && s.rhythm), "the 4.8 s problem line gets a new view");
  assert.ok(!r.shots.some((s) => ["hook", "name", "congrats"].includes(s.at.s)));
  assert.equal(cameraRulesOn({ ...L, approved: true }), false);
  assert.equal(rhythmShots({ ...L, approved: true }, tracks, sentences, shots).shots.length, 0);
  // a 15 m pipe: the macro is a 3 m stretch at the end the water comes from
  const m = macroRegion({ min: [-5, -3, -0.5], max: [10, 0, 0.5] }, { min: [8, 0, -1], max: [12, 1, 1] }, 12);
  assert.ok(m.max[0] - m.min[0] <= 3.01 && m.max[0] === 10);
  // the hold's creep (10% in, 4 degrees) is the same framing; a 12 degree step is a new one
  const a = { pos: [0, 5, 20], tgt: [0, 0, 0] }, rot = (deg, k = 1) => ({ pos: [20 * k * Math.sin(deg * Math.PI / 180), 5 * k, 20 * k * Math.cos(deg * Math.PI / 180)], tgt: [0, 0, 0] });
  assert.equal(sameView(a, rot(4, 0.9)), true); assert.equal(sameView(a, rot(12)), false);
});
