// WORLD-LOOK tests (pure parts): terrain, the foreground (sight-line) rule, the fog guard, the dense town plan, the
// world-bible town, places, lights.   node --test dev/worldlook.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
const { terrainHeight, sightBlocks } = await import("../page/kit/nature.js");
const { planBackTown, gridTown, applyBibleTown, bibleLandmarks } = await import("../page/kit/backTown.js");
const { fogGuard } = await import("../page/sets/creatureWorld.js");
const { placeFor, SPOT_PLACE, PLACES } = await import("../page/sets/backStreet.js");
const { LIGHT_MODES, timeLook } = await import("../page/lighting.js");
const { LIGHTS } = await import("../plan.mjs");
const { MOVES, LANDMARKS } = await import("../lib/caps.js");
const { WORLD_VIEWS } = await import("../lib/epic.js");

const dome = (a = 38, c = 44, h = 18, base = 23) => (x, z) => { const q = 1 - (x / a) ** 2 - (z / c) ** 2; return q <= 0.02 ? null : base + h * Math.sqrt(q); };
const region = { x0: -46, x1: 46, z0: -53, z1: 53 };

test("terrain: flat where giants and people stand, hills toward the horizon", () => {
  assert.equal(terrainHeight(0, 0, { flatR: 220 }), 0);
  assert.equal(terrainHeight(150, -100, { flatR: 220 }), 0);
  assert.ok(terrainHeight(0, -1500, { flatR: 220 }) > 30, "far hills rise");
});

test("foreground rule: a tree on the line hides the subject, beside it or above the line it does not", () => {
  const cam = { x: 0, y: 2, z: 0 }, subj = { x: 0, y: 30, z: -200 };
  assert.ok(sightBlocks({ x: 0.5, z: -20 }, 15, cam, subj, 1.5, 30));
  assert.ok(!sightBlocks({ x: 40, z: -20 }, 15, cam, subj, 1.5, 30), "off the corridor");
  assert.ok(!sightBlocks({ x: 0, z: 20 }, 15, cam, subj), "behind the camera");
  const air = { x: 0, y: 150, z: 0 };
  assert.ok(!sightBlocks({ x: 0, z: -20 }, 15, air, subj), "an aerial looks over the trees");
  assert.ok(sightBlocks({ x: 0.2, z: -1 }, 0.8, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0.5, z: -6 }), "low grass in front of a person");
});

test("fog guard: the subject is never inside the haze", () => {
  const fog = { near: 300, far: 900 };
  const r = fogGuard(fog, 500, { near: 300, far: 900 });
  assert.ok(r.near >= 700 && r.far >= r.near * 3);
  const f2 = { near: 300, far: 2000 }; fogGuard(f2, 100, { near: 300, far: 2000 });
  assert.deepEqual(f2, { near: 300, far: 2000 }, "near subjects leave the fog as it was");
});

test("dense town: a street grid of many textured houses + landmarks over a turtle dome, deterministic", () => {
  const p = planBackTown(region, dome(), { style: "town", seed: 11 });
  assert.ok(p.houses.length >= 40, `houses ${p.houses.length}`);
  assert.ok(p.houses.every((h) => ["planks", "plaster", "timber"].includes(h.wall)));
  assert.ok(new Set(p.houses.map((h) => h.wall)).size >= 3, "varied walls");
  assert.ok(p.landmarks.map((l) => l.name).includes("school"));
  assert.ok(p.paths.length > 50 && p.paths.some((x) => x.main));
  const p2 = planBackTown(region, dome(), { style: "town", seed: 11 });
  assert.deepEqual(p2.houses.map((h) => h.x.toFixed(3)), p.houses.map((h) => h.x.toFixed(3)));
  const g = gridTown(region, dome(), { street: { half: 3.6 }, seed: 3 });
  for (const h of g.houses.filter((h) => h.street === 0)) assert.ok(Math.abs(h.x) > 3.6, "the main street stays free");
});

test("castle city: a dense skyline of skyscrapers AND castle towers inside a wall with a walkway", () => {
  const flat = (x, z) => (Math.abs(x) < 12 && Math.abs(z) < 30 ? 40 : null);
  const p = planBackTown({ x0: -12, x1: 12, z0: -30, z1: 30 }, flat, { style: "castle", seed: 13 });
  assert.ok(p.towers.length >= 20, `towers ${p.towers.length}`);
  assert.ok(p.towers.some((t) => t.round) && p.towers.some((t) => !t.round));
  assert.ok(p.wall && p.wall.walk >= 2);
});

test("world bible: the town's style and named buildings (with signs) drive the town", () => {
  const bible = { seed: 77, style: { id: "painted", walls: ["#7fc8c4", "#f6d365"], roofs: ["#5f6b73"], trim: "#ffffff" }, buildings: [{ id: "bakery", name: "the Crumb Bakery", kind: "shop", pos: [0.2, 0.3], wall: "#f28b82", roof: "#5f6b73", floors: 2 }], landmarks: [{ id: "clock", name: "the clock tower", kind: "clocktower", pos: [0, 0] }] };
  const lms = bibleLandmarks(bible);
  assert.ok(lms.includes("clocktower"));
  const p = planBackTown(region, dome(), { style: "town", seed: 77, bible, landmarks: lms });
  assert.ok(p.houses.every((h) => ["#7fc8c4", "#f6d365", "#f28b82"].includes(h.wallHex)));
  assert.ok(p.houses.some((h) => h.sign && /CRUMB BAKERY|BAKERY/.test(h.sign)));
  assert.equal(p.trim, "#ffffff");
  const hs = [{ x: 0, z: 0, w: 5, d: 4, h: 4 }];
  applyBibleTown(hs, { style: {}, buildings: [{ id: "a", kind: "house", pos: [0, 0], wall: "#123456" }] }, region);
  assert.equal(hs[0].wallHex, "#123456");
});

test("places: bible spot ids and line words map to street-level places in the town", () => {
  for (const v of Object.values(SPOT_PLACE)) assert.ok(PLACES.includes(v));
  assert.equal(SPOT_PLACE.home, "room");
  assert.equal(placeFor("Grandpa ran up the stairs"), "stairs");
  assert.equal(placeFor("in class the teacher smiled"), "classroom");
  assert.equal(placeFor("I woke up in bed"), "room");
  assert.equal(placeFor("we walked down the road"), "street");
});

test("lights: dusk and dawn exist everywhere; night is dark navy with stars; one source per time", () => {
  for (const l of ["day", "night", "warm", "dusk", "dawn"]) { assert.ok(LIGHT_MODES.includes(l)); assert.ok(LIGHTS.includes(l)); }
  const n = timeLook("night");
  const lum = (h) => { const v = parseInt(h.slice(1), 16); return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255); };
  assert.ok(lum(n.sky.zen) < 20 && lum(n.sky.hor) < 50, "night sky is dark");
  assert.equal(n.stars, 1); assert.equal(timeLook("day").stars, 0); assert.equal(timeLook("day").windows, 0);
  assert.ok(timeLook("dusk").windows > 0 && timeLook("night").windows === 1);
  assert.ok(MOVES.includes("on_back") && LANDMARKS.includes("clocktower") && WORLD_VIEWS.includes("street"));
});
