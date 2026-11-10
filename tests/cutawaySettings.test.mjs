// The setting steer (owner, 2026-11-10): kitchen appliances to the kitchen, washers / dryers / water heaters to the
// laundry room (the kitchen with use "laundry"), other indoor topics to the room; layoutRules' free fallback.
import test from "node:test";
import assert from "node:assert/strict";
import { layoutRules, KITCHEN_APPLIANCE, LAUNDRY_APPLIANCE } from "../scripts/cutaway/proto3d/m2/layoutRules.js";
import { settingHint, topicSetting } from "../scripts/cutaway/proto3d/m2/planner.mjs";

const rig = (id, name, extra = {}) => ({ id, kind: "rig", main: true, params: { name, pos: [0, 0.12, -2], scale: 2.4, nodes: [{ id: "body", at: [0, 0, 0], shapes: [{ shape: "box", size: [0.6, 0.85, 0.6], at: [0, 0.43, 0] }] }], ...extra } });
const lay = (backdrop, parts) => ({ title: "t", world: { cut: { x0: 7, x1: 8.4, z0: -5, depth: 0.6 }, shallow: true, house: false, backdrop }, parts, beats: [{ s: "hook", do: [], shots: [] }] });

test("settings: which topics go to the kitchen, the laundry room and the room", () => {
  assert.equal(topicSetting("How a dishwasher works"), "kitchen");
  assert.equal(topicSetting("how a microwave heats food"), "kitchen");
  assert.equal(topicSetting("How a fridge stays cold"), "kitchen");
  assert.equal(topicSetting("how a washing machine works"), "laundry");
  assert.equal(topicSetting("how a water heater works"), "laundry");
  assert.equal(topicSetting("How a sump pump keeps a basement dry"), "room");
  assert.equal(topicSetting("How a car wash works"), null);
  assert.ok(!LAUNDRY_APPLIANCE.test("hair dryer") && !LAUNDRY_APPLIANCE.test("pressure washer") && !LAUNDRY_APPLIANCE.test("dish washer"));
  assert.ok(KITCHEN_APPLIANCE.test("dish washer"));
  assert.match(settingHint("How a dishwasher works"), /type: "kitchen"/);
  assert.match(settingHint("how a dryer works"), /use: "laundry"/);
});

test("settings: a kitchen appliance planned in the room gets the kitchen, a washer the laundry room (free fallback)", () => {
  const a = layoutRules(lay({ type: "room", x0: -9, x1: 9, back: -7, h: 4.2, windowX: 5.5 }, [rig("dw", "dishwasher")]));
  assert.equal(a.layout.world.backdrop.type, "kitchen");
  assert.ok(a.layout.world.backdrop.gap[0] < -0.7 && a.layout.world.backdrop.gap[1] > 0.7);
  assert.ok(a.notes.some((n) => /room became the kitchen/.test(n)));
  const b = layoutRules(lay({ type: "kitchen", gap: [-2.4, 2.4] }, [rig("washer", "washing machine")]));
  assert.equal(b.layout.world.backdrop.use, "laundry");
  // a room topic stays in the room, open-topped unless something hangs from its ceiling
  const c = layoutRules(lay({ type: "room" }, [rig("ac", "air conditioner")]));
  assert.equal(c.layout.world.backdrop.type, "room");
  assert.equal(c.layout.world.backdrop.ceiling, undefined);
  const d = layoutRules(lay({ type: "room" }, [rig("ac", "air conditioner"), { id: "lamp", kind: "prop", params: { type: "ceilingLight", pos: [2, 0.12, -3], h: 4.2 } }]));
  assert.equal(d.layout.world.backdrop.ceiling, true);
});
