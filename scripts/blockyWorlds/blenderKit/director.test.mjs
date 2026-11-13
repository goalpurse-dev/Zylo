// node --test scripts/blockyWorlds/blenderKit/director.test.mjs   (pure helpers only: no model call, no key)
import test from "node:test";
import assert from "node:assert/strict";
import { planLocations, tileShots, salvageJson, MIN_LOCATIONS } from "./director.mjs";

const words = Array.from({ length: 12 }, (_, i) => ({ word: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));

test("the plan check counts distinct locations (case and spacing ignored, empty ignored)", () => {
  assert.equal(MIN_LOCATIONS, 3);
  const r = planLocations([{ location: "Cabin aisle" }, { location: "cabin  AISLE" }, { location: "Cockpit" }, { location: "" }, {}]);
  assert.deepEqual(r, { n: 2, list: ["cabin aisle", "cockpit"] });
  assert.equal(planLocations([{ location: "cabin" }, { location: "cockpit" }, { location: "wing" }]).n, 3);
});

test("tiling keeps each shot's location, starts at word 0, and merges shots under 0.35 s", () => {
  const t = tileShots([{ id: 1, w0: 2, desc: "a", location: "wing" }, { id: 2, w0: 4, desc: "b", location: "cockpit" }, { id: 3, w0: 5, desc: "c", location: "cabin" }], words);
  assert.equal(t.shots[0].w0, 0);
  assert.deepEqual(t.shots.map((s) => s.location), ["wing", "cockpit", "cabin"]);
  const short = tileShots([{ id: 1, w0: 0, desc: "a" }, { id: 2, w0: 1, desc: "b" }], [{ word: "a", start: 0, end: 0.1 }, { word: "b", start: 0.2, end: 0.3 }, { word: "c", start: 1, end: 1.2 }]);
  assert.deepEqual(short.merged, [2]);
});

test("a cut-off JSON answer keeps every complete shot", () => {
  const v = salvageJson('{"shots":[{"id":1,"body":"a"},{"id":2,"body":"b"},{"id":3,"bo');
  assert.deepEqual(v.shots.map((s) => s.id), [1, 2]);
});
