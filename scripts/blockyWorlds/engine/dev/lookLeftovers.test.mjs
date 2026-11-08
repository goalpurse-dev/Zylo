// LOOK-LEFTOVERS 2026-11-08 (lead's review of after_sheet / winter_sheet): the free, pure parts of the five fixes.
//   rich square cobbles (page/kit/townTex.js cobblesRich), no bus stop / SUMMER FAIR poster (page/sets/street.js), a
//   giant framed whole after the bounds clamp (page/cameraGuard.js giantFitDist + pickBoundsPoint), no glare on snow
//   (page/winter.js practicalScale + snowBloom), snow from the story (lib/worldBible.js weatherOf), no builder world id
//   for the bible's own street (plan.mjs bibleTownPlace). The stills proof: the step-3 RunPod render after the rebuild.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const calls = [];
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.document ??= { createElement: () => ({ getContext: () => ctx2d }) };
const THREE = await import("three");
const { giantFitDist, pickBoundsPoint } = await import("../page/cameraGuard.js");
const { practicalScale, snowBloom, isWinter } = await import("../page/winter.js");
const { townTex, TOWN_TEX_KINDS } = await import("../page/kit/townTex.js");
const { weatherOf, buildWorldBible } = await import("../lib/worldBible.js");
const { bibleTownPlace } = await import("../plan.mjs");
const src = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("cobblesRich: a 512 px texture of many stones with moss in the grout", () => {
  assert.ok(TOWN_TEX_KINDS.includes("cobblesRich"));
  calls.length = 0;
  const t = townTex(THREE, "cobblesRich", { color: "#a0603c", seed: 2 });
  assert.equal(t.image.width, 512);
  assert.ok(calls.filter((k) => k === "fill").length > 300, "hundreds of stones drawn");
  assert.match(src("../page/sets/townPlaces.js"), /TT\("cobblesRich", "#a0603c"/);
  assert.doesNotMatch(src("../page/sets/townPlaces.js"), /TT\("cobbles", "#8c7f6c"/, "the pale beige cobbles are gone from the square");
});

test("street: no bus shelter, no SUMMER FAIR poster, no BUS stop sign; the bus only when a line names one", () => {
  const s = src("../page/sets/street.js").split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join("\n"); // code only
  assert.doesNotMatch(s, /SUMMER|"BUS"|fillText\("BUS"|busBox|bus shelter and the stop sign/);
  assert.match(s, /if \(ctx\.bus\) \{/);
  assert.match(src("../page/engine.js"), /bus: busNamed/);
});

test("giantFitDist + pickBoundsPoint: the #2 Watcher (30 m) on the square is framed from the wide box, not 13 m off", () => {
  const cam = { fov: 50, aspect: 9 / 16 };
  const fit = giantFitDist({ height: 30, length: 10, width: 8 }, cam);
  assert.ok(fit > 30 && fit < 45, `fit ${fit}`);
  const SZ = 140, focus = { x: 0.5, y: 0, z: SZ - 13 };
  const want = { x: 0.5, y: 22, z: SZ + 48 }; // the establish camera, just past the wide box
  const boxes = [new THREE.Box3(new THREE.Vector3(-10, 0.4, SZ - 10), new THREE.Vector3(10, 9, SZ + 16)), new THREE.Box3(new THREE.Vector3(-12, 0.4, SZ + 2), new THREE.Vector3(12, 34, SZ + 46))];
  const cands = boxes.map((b) => b.clampPoint(new THREE.Vector3(want.x, want.y, want.z), new THREE.Vector3()));
  const old = cands[0]; // the old clamp: bounds[0] only
  assert.ok(Math.hypot(old.x - focus.x, old.z - focus.z) < fit, "the old clamp stood too close");
  const q = pickBoundsPoint(cands, want, { focus, minDist: fit });
  assert.ok(Math.hypot(q.x - focus.x, q.z - focus.z) >= fit, "the new pick fits the giant");
  assert.equal(pickBoundsPoint(cands, { x: 0, y: 1, z: SZ }), cands[0], "no giant: the nearest box point");
  assert.equal(pickBoundsPoint([cands[0]], want, { focus, minDist: 999 }), cands[0], "nothing fits: the farthest");
});

test("winter: practicals dimmed and bloom tamed at night (no glare blobs on snow), day untouched", () => {
  assert.equal(practicalScale("day"), 1);
  assert.ok(practicalScale("night") < 0.5);
  const [s, r, th] = snowBloom([0.5, 0.45, 0.85], "night");
  assert.ok(s < 0.5 && r === 0.45 && th >= 1.2);
  assert.match(src("../page/winter.js"), /roughnessFactor = mix\(roughnessFactor, 0\.97, gSnowAmt\)/);
});

test("weatherOf: snow from the director's list or the script, never from ice cream", () => {
  assert.deepEqual(weatherOf({ production: { bible: { building_style: "snow-capped timber houses" } } }), { weather: "snow", season: "winter" });
  assert.deepEqual(weatherOf({ production: { worlds: [{ name: "street", description: "a blizzard over the town" }] } }), { weather: "snow", season: "winter" });
  assert.deepEqual(weatherOf({ script: { lines: [{ text: "Frost crept across the glass." }] } }), { weather: "snow", season: "winter" });
  assert.equal(weatherOf({ script: { lines: [{ text: "We ate ice cream in the sun." }, { text: "Then everyone froze." }] } }), null);
  assert.equal(weatherOf({ production: { bible: { building_style: "painted wooden houses" } }, script: { lines: [{ text: "The bell rang." }] } }), null);
  const b = buildWorldBible({ production: { bible: { building_style: "snow-capped timber houses with dark slate roofs" } }, script: { title: "W", lines: [{ text: "In this town, there's one rule." }] } });
  assert.equal(b.weather, "snow");
  assert.ok(isWinter({ world: b, shots: [], lines: [] }), "the page switches winter on from the bible alone");
  assert.equal(buildWorldBible({ script: { title: "S", lines: [{ text: "In this town, it is always summer." }] } }).weather, undefined);
});

test("bibleTownPlace: the bible's own street is never a builder world; real worlds still are", () => {
  const world = { town: { name: "Hushfrost", streets: [{ name: "Lantern Lane" }, { name: "Frostmarket Street" }], landmarks: [{ kind: "square", name: "the town square" }] }, creature: null };
  assert.equal(bibleTownPlace(world, { name: "lantern lane", fallbackSet: "street", hint: { kind: "outdoor" } }), true);
  assert.equal(bibleTownPlace(world, { name: "the town square", fallbackSet: "street" }), true);
  assert.equal(bibleTownPlace(world, { name: "the old mill road", fallbackSet: "street", hint: { kind: "outdoor" } }), true);
  assert.equal(bibleTownPlace(world, { name: "inside the whale", fallbackSet: "street", hint: { kind: "indoor" } }), false);
  assert.equal(bibleTownPlace(world, { name: "upstairs hall and wren's room", fallbackSet: "bedroom", hint: { kind: "indoor" } }), false);
  assert.equal(bibleTownPlace(world, { name: "the moon base", fallbackSet: "street", hint: { kind: "outdoor" } }), false);
  assert.equal(bibleTownPlace({ ...world, creature: { townView: "on" } }, { name: "lantern lane", fallbackSet: "street" }), false, "a town on a creature is its own world");
});

test("EPIC layer: a leftover builder world id (string shot.world) is no creature world", () => {
  const s = src("../page/epicLayer.js");
  assert.match(s, /typeof s\.world === "string" \? \{ \.\.\.s, world: undefined \} : s/);
  assert.match(s, /\(s\.world && typeof s\.world === "object"\)/);
});
