// The appliance look round (the owner, 2026-11-10: "plates look like white plates with food stains, a dish rack, a door
// that opens, water as spray streams and droplets instead of balls"): the household shapes, the water looks of a flow,
// the old plans' white wheels drawn as plates, and the planner told about all of it.
import test from "node:test";
import assert from "node:assert/strict";
import { RIG_SHAPES, rigBox, rigProblems, flowLook, plateFromWheel, wateryColor } from "../scripts/cutaway/proto3d/m2/rig.js";
import { partFieldProblems, RIG_SHAPE_FIELDS, RIG_MOVE_FIELDS } from "../scripts/cutaway/proto3d/m2/fields.js";
import { catalogText } from "../scripts/cutaway/proto3d/m2/catalog.js";

const rig = (nodes, extra = {}) => ({ id: "dw", kind: "rig", params: { name: "dishwasher", pos: [0, 0.12, -2], nodes, ...extra } });
const tub = { id: "tub", at: [0, 0, 0], shapes: [{ shape: "box", size: [0.6, 0.1, 0.6], at: [0, 0.05, 0] }] };

test("look parts: plates, bowls, cups, glasses, smears, a rack and a nozzle are rig shapes the checks pass", () => {
  for (const s of ["plate", "bowl", "cup", "glass", "smear", "rack", "nozzle"]) { assert.ok(RIG_SHAPES.includes(s), s); assert.ok(RIG_SHAPE_FIELDS[s], s); }
  const ok = rig([tub,
    { id: "rack", parent: "tub", at: [0, 0.12, 0], shapes: [{ shape: "rack", size: [0.5, 0.12, 0.5], at: [0, 0.06, 0], tines: 4 }] },
    { id: "plates", parent: "rack", at: [0, 0, 0], shapes: [{ shape: "plate", r: 0.11, axis: "z", at: [0, 0.12, 0.1], stain: 0.5, stainColor: "#8b5a2b" }, { shape: "bowl", r: 0.08, at: [0.15, 0.05, -0.1], stain: true }, { shape: "cup", r: 0.04, at: [-0.15, 0.05, -0.1] }, { shape: "glass", at: [-0.2, 0.06, 0.15] }] },
    { id: "grime", parent: "plates", at: [0, 0, 0], shapes: [{ shape: "smear", r: 0.07, axis: "z", at: [0, 0.12, 0.103], color: "#8b5a2b", amount: 0.6 }], moves: [{ name: "dirty", type: "appear" }] },
    { id: "jet", parent: "tub", at: [0, 0.1, 0], shapes: [{ shape: "nozzle", r: 0.012, h: 0.03, at: [0, 0.015, 0] }], moves: [{ name: "jet", type: "flow", path: [[0, 0.03, 0], [0, 0.3, 0]], color: "#6fc3ff", look: "spray", size: 0.05 }] },
    { id: "door", parent: "tub", at: [0, 0.1, 0.3], shapes: [{ shape: "panel", size: [0.58, 0.74], thick: 0.035, at: [0, 0.37, 0.0175], look: "metal" }], moves: [{ name: "open", type: "swing", axis: "x", angle: 85 }] },
  ]);
  assert.deepEqual(rigProblems(ok, { floor: 0.12 }), []);
  assert.deepEqual(partFieldProblems(ok, "dw"), []);
  // the door swings out toward the camera: the swept box reaches in front of the tub
  assert.ok(rigBox(ok.params).max[2] > rigBox(ok.params, { swept: false }).max[2] + 0.5);
  // a plate's box is thin along its axis, a rack's is its size
  const one = (s) => rigBox({ pos: [0, 0, 0], nodes: [{ id: "a", at: [0, 0, 0], shapes: [s] }] }, { swept: false });
  const pb = one({ shape: "plate", r: 0.1, axis: "z" }); assert.ok(pb.max[2] - pb.min[2] < 0.05 && pb.max[0] - pb.min[0] > 0.19);
  const rb = one({ shape: "rack", size: [0.5, 0.12, 0.4] }); assert.deepEqual(rb.max.map((x, i) => +(x - rb.min[i]).toFixed(3)), [0.5, 0.12, 0.4]);
  // a bad field value is refused by name, never a crash
  assert.ok(partFieldProblems(rig([tub, { id: "p", parent: "tub", at: [0, 0.1, 0], shapes: [{ shape: "plate", stain: "lots" }] }]), "dw").some((p) => /stain/.test(p.at)));
});

test("look parts: water draws as spray or a stream, air, gas and carried things keep their dots", () => {
  assert.ok(RIG_MOVE_FIELDS.flow.look && RIG_MOVE_FIELDS.flow.size);
  const L = (name, color, node = "", p = {}, look) => flowLook({ name, type: "flow", color, ...(look ? { look } : {}) }, node, p);
  // the real dishwasher's flows (2026-11-10)
  assert.equal(L("drizzle", "#6fc3ff", "head", { name: "dishwasher" }), "spray");
  assert.equal(L("jet", "#6fc3ff", "jetL", { name: "dishwasher" }), "spray");
  assert.equal(L("circulate", "#6fc3ff", "pump", { name: "dishwasher" }), "stream");
  // the saved plans' other flows: a drain or a pour is a stream (a grey one too), air, gas, soot, a chain, a belt, a
  // fridge's refrigerant and a pale air hose keep the dots
  assert.equal(L("drain", "#8a8a7a", "pump", { name: "washing machine" }), "stream");
  assert.equal(L("siphon", "#4aa8e0", "trap", { name: "toilet" }), "stream");
  for (const [n, c, id, part] of [["gas", "#7fd1ff", "gasPipe", "stove"], ["air", "#9fd8ff", "hoseA", "ride"], ["sootRise", "#1c1c1c", "soot", "stove"], ["run", "#ffb347", "chain", "saw"], ["runs", "#ffffff", "belt", "escalator"], ["circulate", "#7fd0ff", "pipes", "fridge"], ["fills", "#e8f6ff", "tank", "kit"], ["blood", "#ff2a2a", "frame", "artery"], ["leak", "#d6f55a", "head", "stove"]]) assert.equal(L(n, c, id, { name: part }), "dots", `${n} ${part}`);
  // the planner's own look wins, and the flow kind's liquid words work
  assert.equal(L("air", "#ffffff", "duct", {}, "spray"), "spray");
  assert.equal(L("drain", "#6fc3ff", "pump", {}, "dots"), "dots");
  assert.equal(L("ooze", null, "pan", {}, "oil"), "stream");
  assert.equal(L("spray", null, "hose", {}, "water"), "spray");
  assert.ok(wateryColor("#6fc3ff") && wateryColor(undefined) && !wateryColor("#e8f6ff") && !wateryColor("#8a8a7a") && !wateryColor("nonsense"));
});

test("look parts: an old plan's white wheels on its plates node are drawn as plates, a car's wheels stay wheels", () => {
  const plate = { shape: "wheel", r: 0.11, w: 0.015, axis: "z", at: [-0.14, 0.275, 0.2], look: "paint", color: "#f4f1ea" };
  const up = plateFromWheel(plate, "plates", { name: "dishwasher", synonyms: ["dish washer"] });
  assert.equal(up.shape, "plate"); assert.equal(up.axis, "z"); assert.equal(up.r, 0.11); assert.equal(up.w, undefined);
  assert.ok(plateFromWheel(plate, "dishes", { name: "dishwasher" }));
  assert.equal(plateFromWheel(plate, "wheelFL", { name: "car" }), null);
  assert.equal(plateFromWheel({ ...plate, color: "#24262a" }, "plates", { name: "dishwasher" }), null);
  assert.equal(plateFromWheel({ ...plate, w: 0.2 }, "plates", { name: "dishwasher" }), null);
  // a satellite "dish" is not a plate
  assert.equal(plateFromWheel(plate, "dish", { name: "satellite" }), null);
  assert.equal(plateFromWheel({ shape: "box" }, "plates", {}), null);
});

test("look parts: the planner is told about the household shapes, the water looks and the hinged door", () => {
  const t = catalogText();
  assert.match(t, /plate \{r, axis, stain,/);
  assert.match(t, /rack \{size \[w,h,d\], gap, wire, tines\}/);
  assert.match(t, /look "spray"/);
  assert.match(t, /"type":"swing","axis":"x","angle":85/);
});
