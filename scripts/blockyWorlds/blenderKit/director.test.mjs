// node --test scripts/blockyWorlds/blenderKit/director.test.mjs   (pure helpers only: no model call, no key)
import test from "node:test";
import assert from "node:assert/strict";
import { planLocations, tileShots, salvageJson, planProblems, MIN_LOCATIONS } from "./director.mjs";

const shotsAt = (locs) => locs.map((location, i) => ({ id: i + 1, w0: i, desc: "x", location }));
const good = {
  shots: shotsAt([...Array(25).fill("hero room"), ...Array(15).fill("main street"), ...Array(14).fill("big hall"), ...Array(6).fill("hero room")]),
  style_sheet: [{ name: "Mo", hero: true, outfit: "yellow-black stripes", colors: "yellow and black stripes" }, { name: "Pip", hero: false, outfit: "orange", colors: "orange shirt" }],
  anchors: ["Hero room"],
};

test("the plan check passes a plan with 3+ locations, ~50 cuts a minute, one hero, distinct colours and a returning anchor", () => {
  assert.deepEqual(planProblems(good, 72), []);
});

test("the plan check names every broken rule", () => {
  const p = planProblems({ shots: shotsAt(Array(30).fill("cabin")), style_sheet: [{ name: "A", hero: true, colors: "red" }, { name: "B", hero: true, colors: "Red" }], anchors: [] }, 72);
  assert.ok(p.some((x) => /location/.test(x)));
  assert.ok(p.some((x) => /cuts a minute/.test(x)));
  assert.ok(p.some((x) => /2 hero/.test(x)));
  assert.ok(p.some((x) => /share the colours/.test(x)));
  assert.ok(p.some((x) => /no anchors/.test(x)));
});

test("an anchor that never comes back in the last 15% fails", () => {
  const plan = { ...good, shots: shotsAt([...Array(30).fill("hero room"), ...Array(15).fill("main street"), ...Array(15).fill("big hall")]) };
  assert.ok(planProblems(plan, 72).some((x) => /comes back in the ending/.test(x)));
});

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
