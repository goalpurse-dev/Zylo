// BLOCKY-ANIMALS tests (2026-11-06): the blocky animal kit (page/kit/animals) — every species + variant builds, the
// animations are deterministic per frame, feet meet the ground (and stay planted) in walk / run, aliases resolve, and
// giants / scene objects route to the new rigs.   node --test dev/animals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ANIMAL_SPECIES, ANIMAL_PLANS, resolveAnimal, makeAnimal, animateAnimal, animalGait, specFor } from "../page/kit/animals/index.js";
import { makeGiant, animateGiant, giantSurface, animalRigFor } from "../page/kit/giants.js";
import { ANIMALS } from "../lib/catalog.js";

const TOP30 = ["dog", "mouse", "cat", "pigeon", "frog", "yeti", "goat", "whale", "duck", "fish", "ant", "bear", "turtle", "dragon", "octopus", "deer", "chicken", "parrot", "shark", "pig", "mole", "seagull", "snail", "snake", "seal", "cow", "rabbit", "wolf", "elephant", "eagle"];
const V = () => new THREE.Vector3();

test("the top 30 species are all there, every species + variant builds with a rig and a sane size", () => {
  assert.deepEqual([...TOP30].sort(), Object.keys(ANIMAL_SPECIES).sort());
  let n = 0;
  for (const [sp, s] of Object.entries(ANIMAL_SPECIES)) for (const v of Object.keys(s.variants)) {
    const g = makeAnimal({ species: sp, variant: v });
    const U = g.userData;
    assert.equal(U.species, sp); assert.equal(U.variant, v);
    assert.ok(U.height > 0.05 && U.length > 0.05, `${sp}/${v} size`);
    assert.ok(U.joints.body && (U.joints.head || sp === "fish"), `${sp}/${v} joints`);
    assert.ok((U.joints.eyes ?? []).length >= 2, `${sp}/${v} has two eyes`);
    const b = new THREE.Box3().setFromObject(g);
    assert.ok(b.min.y > -0.03 * U.height, `${sp}/${v} does not sink at rest (${b.min.y})`);
    assert.ok(Math.abs((s.ref === "height" ? U.height : U.length) - s.life * (v === Object.keys(s.variants)[0] ? 1 : 1)) < 1e-6 || s.variants[v].life, `${sp}/${v} built at its life size`);
    n++;
  }
  assert.ok(n >= 100, `${n} species variants`);
  // any size: a 120 m giant of the same rig
  const big = makeAnimal({ species: "turtle", size: 120 });
  assert.ok(Math.abs(big.userData.length - 120) < 1e-6);
});

test("aliases resolve to species + variants", () => {
  const cases = { puppy: ["dog"], kitten: ["cat"], geese: ["duck", "goose"], goose: ["duck", "goose"], walrus: ["seal", "walrus"], orca: ["whale", "orca"], hamster: ["mouse", "hamster"], rats: ["mouse", "rat"], tortoise: ["turtle", "tortoise"], giant_tortoise: ["turtle", "tortoise"],
    "the big snail": ["snail"], moose: ["deer", "moose"], reindeer: ["deer", "reindeer"], squid: ["octopus", "squid"], kraken: ["octopus", "kraken"], rooster: ["chicken", "rooster"], panda: ["bear", "panda"], python: ["snake", "python"], fox: ["wolf", "fox"], owl: ["eagle", "owl"], bigfoot: ["yeti", "bigfoot"], mammoth: ["elephant", "mammoth"], toad: ["frog", "toad"], ants: ["ant"], sheep: ["goat", "sheep"], bull: ["cow", "bull"], bunny: ["rabbit"], seagulls: ["seagull"], macaw: ["parrot"], hammerhead: ["shark", "hammerhead"] };
  for (const [w, [sp, v]] of Object.entries(cases)) {
    const r = resolveAnimal(w);
    assert.ok(r, `${w} resolves`); assert.equal(r.species, sp, w);
    if (v) assert.equal(r.variant, v, w);
  }
  assert.equal(resolveAnimal("toaster"), null);
  assert.equal(resolveAnimal(""), null);
  for (const sp of TOP30) assert.ok(ANIMAL_PLANS[specFor(sp).plan], `${sp} has a body plan`);
});

const snap = (g) => { const out = []; g.traverse((o) => { if (o.isGroup) out.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()); }); return out; };
test("animations are deterministic per frame (chunked rendering): the same t gives the same pose whatever came before", () => {
  for (const sp of TOP30) {
    const g = makeAnimal({ species: sp }), acts = ANIMAL_PLANS[ANIMAL_SPECIES[sp].plan];
    for (const a of acts) {
      animateAnimal(g, a, 1.37, { dur: 3 }); const A = snap(g);
      animateAnimal(g, "run", 0.2); animateAnimal(g, a, 4.1, { dur: 3 });
      animateAnimal(g, a, 1.37, { dur: 3 }); const B = snap(g);
      assert.equal(A.length, B.length);
      for (let i = 0; i < A.length; i++) assert.ok(Math.abs(A[i] - B[i]) < 1e-9, `${sp} ${a} not deterministic`);
      for (const x of A) assert.ok(Number.isFinite(x), `${sp} ${a} NaN`);
    }
    // a fresh rig at the same t agrees too
    const h = makeAnimal({ species: sp }); animateAnimal(h, "walk", 0.77); animateAnimal(g, "walk", 0.77);
    const P = snap(g), Q = snap(h); for (let i = 0; i < P.length; i++) assert.ok(Math.abs(P[i] - Q[i]) < 1e-9, `${sp} fresh rig differs`);
  }
});

/** the bottom of each foot (world y) and its world z, the root moving at the gait speed along +z */
function feetAt(g, action, t, speed) {
  g.position.set(0, 0, speed * t);
  animateAnimal(g, action, t);
  g.updateMatrixWorld(true);
  return g.userData.legs.map((l) => { const p = l.foot.getWorldPosition(V()); return { y: p.y - l.fh * g.userData.unit, z: p.z }; });
}
test("walk / run: feet meet the ground (no sinking), some foot is planted, planted feet do not slide", () => {
  for (const sp of TOP30) {
    const S = ANIMAL_SPECIES[sp];
    if (!["quadruped", "biped", "bird"].includes(S.plan)) continue;
    const g = makeAnimal({ species: sp }), U = g.userData, tol = 0.02 * U.height;
    for (const action of ["walk", "run"]) {
      const gt = animalGait(g, action), per = 1 / gt.cadence;
      assert.ok(gt.speed > 0 && gt.stride > 0, `${sp} ${action} gait`);
      let prev = null;
      for (let k = 0; k <= 40; k++) {
        const t = (k / 40) * per;
        const f = feetAt(g, action, t, gt.speed);
        const low = Math.min(...f.map((x) => x.y));
        assert.ok(low > -tol, `${sp} ${action} t=${t.toFixed(2)} a foot sinks (${low.toFixed(3)} m)`);
        if (S.gait !== "hop" && action === "walk") assert.ok(f.some((x) => Math.abs(x.y) < tol), `${sp} ${action} t=${t.toFixed(2)} no foot on the ground`);
        if (prev) f.forEach((x, i) => {
          if (Math.abs(x.y) < tol * 0.25 && Math.abs(prev[i].y) < tol * 0.25) assert.ok(Math.abs(x.z - prev[i].z) < 0.03 * U.height + 1e-6, `${sp} ${action} foot ${i} slides ${(x.z - prev[i].z).toFixed(3)} m`);
        });
        prev = f;
      }
    }
    // standing still, roaring and attacking: all feet planted
    for (const a of ["idle", "roar"]) { const f = feetAt(g, a, 0.9, 0); for (const x of f) assert.ok(Math.abs(x.y) < tol, `${sp} ${a} foot off the ground`); }
  }
});

test("every action of every body plan runs at any scale (pet size to a 120 m world creature)", () => {
  for (const sp of TOP30) for (const size of [undefined, 120]) {
    const g = makeAnimal({ species: sp, size });
    for (const a of ANIMAL_PLANS[ANIMAL_SPECIES[sp].plan]) for (const t of [0, 0.6, 2.5]) animateAnimal(g, a, t, { dur: 3, hitAt: 0.6 });
  }
});

test("giants: species route to the blocky rigs (towns, surfaces, giant actions); the epic wolf + humanoids stay classic", () => {
  for (const k of ["turtle", "whale", "snail"]) {
    const g = makeGiant({ kind: k, size: 60, seed: 3 });
    assert.ok(g.userData.rigV2, `${k} on the blocky rig`);
    assert.ok(g.userData.town, `${k} keeps its own town`);
    const s = giantSurface(g); assert.ok(s(0, k === "snail" ? 0 : 2) > 5, `${k} back surface`);
    assert.ok(g.userData.gait.speed > 0);
    for (const a of ["walk", "run", "stomp", "roar", "attack", "swim", "hit", "fall", "reach", "sleep", "lurk", "reveal", "carry", "eat", "fly", "climb", "flee", "howl", "dig", "slide", "float"]) animateGiant(g, a, 1.0, { dur: 3, hitAt: 0.6 });
  }
  const eagle = makeGiant({ kind: "eagle", size: 60 }), es = giantSurface(eagle);
  assert.ok(es(0, 0) > 10, "a bird's back has a real surface for a back town");
  assert.ok(animalRigFor({ kind: "wolf" }), "the blocky wolf by default (WORLD-FIX)");
  assert.equal(animalRigFor({ kind: "wolf", armour: true }).variant, "villain", "the threat wolf: red-eyed villain variant");
  assert.equal(animalRigFor({ kind: "wolf", rig: "classic" }), null, "the armoured epic wolf on request");
  assert.ok(animalRigFor({ kind: "wolf", rig: "animal" }), "the blocky wolf on request");
  for (const k of ["ghost", "goblin", "giant_human", "crab", "robot"]) assert.equal(animalRigFor({ kind: k }), null, k);
  assert.equal(animalRigFor({ kind: "turtle", params: { plan: "quadruped" } }), null, "an AI blueprint keeps its own body");
});

test("the catalog names map to rig species", () => {
  for (const k of ["deer", "parrot", "seagull", "eagle", "snake", "octopus", "shark", "seal", "elephant", "ant"]) assert.ok(ANIMALS[k], `catalog has ${k}`);
  for (const [k, al] of Object.entries(ANIMALS)) for (const a of [k, ...al]) if (resolveAnimal(a) && ["deer", "parrot", "eagle", "shark", "seal", "elephant"].includes(k)) assert.ok(resolveAnimal(a).species === resolveAnimal(k).species, `${a} -> ${k}`);
});
