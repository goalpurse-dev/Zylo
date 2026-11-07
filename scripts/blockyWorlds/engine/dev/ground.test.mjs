// ATTACH 2026-11-07 (owner: "FLOATING PEOPLE: everything on a creature must be attached to it and move with it when it
// walks. Feet always on the ground."): the free, pure parts of the ground-contact work. The per-world render check is
// dev/groundProbe.mjs (Chrome, free): node dev/groundProbe.mjs --sheets
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
const THREE = await import("three");
const { makePerson, posePerson } = await import("../page/kit/people.js");
const { groundUnder, personFeet, measureContact } = await import("../page/ground.js");
const { makeGiant, animateGiant } = await import("../page/kit/giants.js");
const { addBackTown } = await import("../page/kit/backTown.js");

const lowestFoot = (p) => Math.min(...personFeet(THREE, p).map((v) => v.y));

test("ground: a walking / running / standing person keeps the lowest sole edge on the floor (no toe in the street)", () => {
  for (const role of ["kid", "adult"]) {
    const p = makePerson({ role, seed: 4 });
    for (const pose of ["stand", "walk", "run", "wave", "talk", "point", "cheer"]) {
      for (let t = 0; t < 2; t += 0.07) {
        posePerson(p, pose, t, {});
        const y = lowestFoot(p);
        // run and cheer hop (the body leaves the floor on purpose): never below, at most the hop above
        assert.ok(y > -0.004, `${role} ${pose} t ${t.toFixed(2)}: foot ${y.toFixed(3)} m below the floor`);
        assert.ok(y < (pose === "run" || pose === "cheer" ? 0.25 : 0.004), `${role} ${pose} t ${t.toFixed(2)}: foot ${y.toFixed(3)} m above the floor`);
      }
    }
  }
});

test("ground: groundUnder finds the surface nearest the feet, never a roof above, never a person", () => {
  const scene = new THREE.Scene(), mat = new THREE.MeshStandardMaterial();
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); scene.add(m); return m; };
  box(20, 1, 20, 0, -0.5, 0);           // the street, top at 0
  box(1, 0.4, 1, 0, 0.2, 0);            // a low crate, top at 0.4 (under the feet)
  box(4, 0.2, 4, 0, 2.6, 0);            // an awning above
  const person = makePerson({ role: "kid", seed: 2 }); person.position.set(0, 0.5, 0); scene.add(person);
  scene.updateMatrixWorld(true);
  assert.equal(groundUnder(THREE, scene, new THREE.Vector3(0, 0.05, 0)).y.toFixed(3), "0.000", "the street, not the crate top");
  assert.equal(groundUnder(THREE, scene, new THREE.Vector3(0, 0.38, 0)).y.toFixed(3), "0.400", "standing on the crate: the crate");
  assert.equal(groundUnder(THREE, scene, new THREE.Vector3(3, -0.3, 0)).y.toFixed(3), "0.000", "sunk 0.3: the street above");
  assert.equal(groundUnder(THREE, scene, new THREE.Vector3(30, 0, 0)), null, "off the street: nothing");
});

test("ground: measureContact reports a sinking and a floating person", () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20), new THREE.MeshStandardMaterial()); floor.position.y = -0.5; scene.add(floor);
  const a = makePerson({ role: "adult", seed: 1 }), b = makePerson({ role: "kid", seed: 2 });
  a.position.set(-1, -0.2, 0); b.position.set(1, 0.3, 0); scene.add(a, b);
  posePerson(a, "stand", 0, {}); posePerson(b, "stand", 0, {});
  scene.updateMatrixWorld(true);
  const rows = measureContact(THREE, scene, { root: scene }).rows.filter((r) => r.kind === "person");
  const gaps = rows.map((r) => +r.gap.toFixed(2)).sort((x, y) => x - y);
  assert.deepEqual(gaps, [-0.2, 0.3]);
});

for (const kind of ["turtle", "snail", "elephant", "wolf"]) {
  test(`ground: the town on a walking ${kind} rides its back joint (houses at a constant offset from the shell / back)`, () => {
    const g = makeGiant({ kind, size: 100, town: false, seed: 3 });
    const town = addBackTown(g, { style: kind === "wolf" ? "castle" : "town", seed: 3 });
    const J = g.userData.joints, surfJ = J.shell && J.shell !== J.body ? J.shell : J.body;
    assert.equal(g.userData.townJoint, surfJ, "the town rides the joint that carries the walkable back");
    const h = town.userData.plan.houses[0] ?? town.userData.plan.towers[0];
    const at = () => { g.updateMatrixWorld(true); return surfJ.worldToLocal(town.localToWorld(new THREE.Vector3(h.x, h.y, h.z))); };
    // rest pose: the plan's root-space coordinates are where the town really is
    g.updateMatrixWorld(true);
    const w0 = town.localToWorld(new THREE.Vector3(h.x, h.y, h.z)).applyMatrix4(new THREE.Matrix4().copy(g.matrixWorld).invert());
    assert.ok(w0.distanceTo(new THREE.Vector3(h.x, h.y, h.z)) < 1e-3, `rest: the house is where the plan put it (${w0.toArray().map((v) => v.toFixed(2))})`);
    const ref = at();
    let moved = 0;
    for (let t = 0; t < 4; t += 0.37) {
      animateGiant(g, kind === "snail" ? "walk" : "walk", t);
      const p = at(); assert.ok(p.distanceTo(ref) < 1e-4, `${kind} t ${t.toFixed(2)}: the house moved on its back by ${p.distanceTo(ref)}`);
      g.updateMatrixWorld(true); moved = Math.max(moved, town.localToWorld(new THREE.Vector3(h.x, h.y, h.z)).distanceTo(new THREE.Vector3(h.x, h.y, h.z).applyMatrix4(g.matrixWorld)));
    }
    assert.ok(moved > 1e-3, `${kind}: the back does move while walking (the test means something)`);
  });
}
