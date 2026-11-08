// LOOK-FIX 2026-11-08 (owner's review of the step-2 stills): the free, pure parts of the five look fixes + winter.
//   camera never inside an object (page/cameraGuard.js), the night subject check (page/subjectLight.js), long held
//   props keep the face clear (kit/people.js grips), the new hand props (no purple fallback box), winter detection +
//   deterministic snow (page/winter.js). The stills proof: scratchpad lookfix/stills.mjs + winter.mjs (Chrome, free).
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
const THREE = await import("three");
const { exitAlong, keepOut, objectMargin } = await import("../page/cameraGuard.js");
const { boostFor, screenRect, NIGHT_MIN_LUM } = await import("../page/subjectLight.js");
const { isWinter, snowFlake } = await import("../page/winter.js");
const { makePerson, posePerson, heldFaceOverlap, gripOrder } = await import("../page/kit/people.js");
const { makeHeld } = await import("../page/kit/props.js");

test("exitAlong: 0 outside, the distance to the wall inside", () => {
  const box = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 4, z: 1 } };
  assert.equal(exitAlong(box, { x: 3, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }), 0);
  assert.ok(Math.abs(exitAlong(box, { x: 0, y: 1, z: 0.5 }, { x: 0, y: 0, z: 1 }) - 0.5) < 1e-9);
  assert.ok(Math.abs(exitAlong(box, { x: 0, y: 1, z: 0.5 }, { x: 0, y: 0, z: -1 }) - 1.5) < 1e-9);
});

test("keepOut: a camera inside a tower's box steps back out of it (+ margin) and still looks at the aim", () => {
  const cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 500);
  cam.position.set(0, 5, -1); cam.lookAt(0, 5, -10); cam.updateMatrixWorld();
  const box = new THREE.Box3(new THREE.Vector3(-2.5, 0, -6), new THREE.Vector3(2.5, 18, 0));
  const aim = new THREE.Vector3(0, 5, -3);
  const moved = keepOut(THREE, cam, [{ box, margin: 1.5 }], { aim });
  assert.ok(moved > 0);
  assert.ok(!box.clone().expandByScalar(1.5).containsPoint(cam.position), "outside box + margin");
  const dir = cam.getWorldDirection(new THREE.Vector3()), want = aim.clone().sub(cam.position).normalize();
  assert.ok(dir.dot(want) > 0.999, "looks at the aim");
  // already outside: nothing moves
  assert.equal(keepOut(THREE, cam, [{ box, margin: 1.5 }], { aim }), 0);
});

test("objectMargin: big things get more room than small ones", () => {
  assert.ok(objectMargin({ big: true, height: 18 }) >= 1.5);
  assert.ok(objectMargin({ height: 1.6 }) < objectMargin({ big: true, height: 18 }));
});

test("boostFor: a dark or flat night subject gets more key light; a readable one none", () => {
  assert.equal(boostFor({ lum: 120, contrast: 30 }), 1);
  assert.ok(boostFor({ lum: 12, contrast: 4 }) > 3);
  assert.ok(boostFor({ lum: NIGHT_MIN_LUM - 20, contrast: 30 }) > 1);
  assert.ok(boostFor({ lum: 5, contrast: 1 }) <= 5);
  assert.equal(boostFor(null), 1);
  assert.deepEqual(screenRect([[-0.5, 0.5], [0.5, -0.5]]), { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 });
  assert.equal(screenRect([[2, 2], [3, 3]]), null);
});

test("held props: the new kinds are real props (no purple fallback box)", () => {
  for (const n of ["spear", "bell", "coin", "hand_mirror", "feather_duster", "broom", "sign", "umbrella"]) {
    const h = makeHeld(n); assert.ok(h, n); assert.notEqual(h.userData.kind, "fallback", n);
  }
});

test("held long props: from the front, the chosen grip never hides the face (broom, sign, spear, umbrella, mop, duster)", () => {
  for (const hold of ["broom", "sign", "spear", "umbrella", "mop", "feather_duster"]) {
    for (const yaw of [0, 0.8, -0.8, Math.PI / 2]) {
      const p = makePerson({ id: "me", role: "kid", seed: 3 });
      p.rotation.y = yaw; p.updateMatrixWorld(true);
      const cam = new THREE.PerspectiveCamera(30, 9 / 16, 0.1, 100);
      cam.position.set(0, 1.0, 3.2); cam.lookAt(0, 0.9, 0); cam.updateMatrixWorld();
      let best = 1;
      posePerson(p, "carry", 0.5, { hold });
      assert.ok(p.userData.held?.userData.long, `${hold} is a long prop`);
      for (const g of gripOrder(p.userData.held.userData.kind)) {
        p.userData.grip = g; posePerson(p, "carry", 0.5, { hold });
        best = Math.min(best, heldFaceOverlap(cam, p));
      }
      assert.ok(best <= (hold === "umbrella" ? 0.35 : 0.12), `${hold} yaw ${yaw}: face cover ${best}`);
    }
  }
});

test("held small props stay one-hand props (coin, mirror)", () => {
  const p = makePerson({ id: "me", role: "kid", seed: 3 });
  posePerson(p, "carry", 0, { hold: "coin" });
  assert.equal(!!p.userData.held?.userData.long, false);
});

test("isWinter: the bible / the director / the script; never a plain story", () => {
  assert.equal(isWinter({ world: { kind: "town", town: { style: { text: "pale siding, dark roofs" } } }, lines: [{ text: "Never look out your window after dark." }] }), false);
  assert.equal(isWinter({ world: { weather: "snow" } }), true);
  assert.equal(isWinter({ world: { season: "winter" } }), true);
  assert.equal(isWinter({ world: { town: { style: { text: "snowy rooftops and frosted windows" } } } }), true);
  assert.equal(isWinter({ world: {}, shots: [{ weather: "blizzard" }] }), true);
  assert.equal(isWinter({ world: {}, lines: [{ text: "The snow came early that year." }] }), true);
  assert.equal(isWinter({ world: {}, lines: [{ text: "Her drink had ice in it." }] }), false);
});

test("snowFlake: deterministic in (i, t), inside the unit box, falling", () => {
  for (let i = 0; i < 50; i++) {
    const a = snowFlake(i, 3.2, 7), b = snowFlake(i, 3.2, 7);
    assert.deepEqual(a, b);
    for (const v of a) assert.ok(v >= 0 && v < 1);
  }
  const y0 = snowFlake(5, 1, 1)[1], y1 = snowFlake(5, 1.05, 1)[1];
  assert.ok(y1 < y0 || y0 < 0.02, "falls");
});
