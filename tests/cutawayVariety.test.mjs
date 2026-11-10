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
  assert.equal(varietyShots(layout({ world: { backdrop: { type: "street" } } }), tracks, sentences, shots).shots.length, 0);
  assert.equal(varietyShots(layout({ parts: [{ ...rig, kind: "tank" }] }), tracks, sentences, shots).shots.length, 0);
  assert.equal(varietyShots(layout({ camera: { keys: [{ at: 0 }] } }), tracks, sentences, shots).shots.length, 0);
  // every planned layout carries template: true (plan.js); that alone is no premade video
  assert.ok(varietyShots(layout({ template: true }), tracks, sentences, shots).shots.length > 0);
});
