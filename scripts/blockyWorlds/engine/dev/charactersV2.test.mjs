// CHARACTERS-V2 2026-11-09 (owner: rig v2 with a ~1/3 head, a new face system, expressions from the line's emotion,
// layered outfits per role / era, distinct per named character). The free, pure checks (no GPU, no browser):
//   node --test dev/charactersV2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
const THREE = await import("three");
const F = await import("../page/kit/facesV2.js");
const E = await import("../lib/expressions.js");
const D = await import("../page/kit/outfitsData.js");
const O = await import("../page/kit/outfits.js");
const { makePerson, posePerson, setFace, EXPRS, lookFor } = await import("../page/kit/people.js");
const { EXPRS_N } = await import("../lib/director/vocab.js");
const { buildWorldBible } = await import("../lib/worldBible.js");

// ------------------------------------------------------------------------------------------------- faces
test("faces: the kit's faces = lib/expressions FACE_NAMES; every planner expr is a face; 18 mouths; all extras used", () => {
  assert.deepEqual([...F.FACES].sort(), [...E.FACE_NAMES].sort());
  assert.deepEqual([...EXPRS].sort(), [...F.FACES].sort(), "people.js EXPRS are the face kit's");
  for (const x of EXPRS_N) assert.ok(F.FACES.includes(x), `planner expr ${x}`);
  assert.ok(Object.keys(F.MOUTHS).length >= 12);
  for (const fx of ["sweat", "blush", "tears", "anger", "stream", "gloom"]) assert.ok(F.FACES.some((n) => F.faceParams(n).fx[fx] > 0), `some face uses ${fx}`); // CHARACTERS-V3: no sparkles by default
  const mouths = new Set(F.FACES.map((n) => JSON.stringify(F.faceParams(n).mouth)));
  assert.ok(mouths.size >= 12, `distinct mouths in use: ${mouths.size}`);
});

test("faces: every face x variant builds and draws (any look: glasses, beard, baby)", () => {
  const ctx = new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
  for (const n of F.FACES) for (const v of F.VARIANTS) {
    const P = F.faceParams(n, v);
    for (const part of ["eyeL", "eyeR", "browL", "browR", "mouth", "fx"]) assert.ok(P[part], `${n}/${v} ${part}`);
    for (const look of [{}, { glasses: "round", beard: "#ddd", hairColor: "#eee" }, { role: "baby" }]) F.drawFaceV2(ctx, P, F.faceLook(look));
    assert.ok(F.faceMaterialV2(n, v, { skin: "#e7b38e" }).map, `${n}/${v} material`);
  }
  // "blink" shuts open eyes, "talk" opens the mouth
  assert.ok(F.faceParams("happy", "blink").eyeL.open < 0.14);
  assert.ok(F.faceParams("happy", "talk").mouth.open >= 0.5);
  assert.ok(!F.FACES.filter((n) => n !== "neutral").some((n) => JSON.stringify(F.faceParams(n)) === JSON.stringify(F.faceParams("neutral"))), "no face is the neutral one");
});

test("faces: lerpFace blends (ends exact, numbers in between, switches at 0.5)", () => {
  const A = F.faceParams("calm"), B = F.faceParams("excited");
  assert.deepEqual(F.lerpFace(A, B, 0), A);
  assert.deepEqual(F.lerpFace(A, B, 1), B);
  const m = F.lerpFace(A, B, 0.5);
  assert.ok(m.eyeL.open > Math.min(A.eyeL.open, B.eyeL.open) - 1e-9 && m.eyeL.open < Math.max(A.eyeL.open, B.eyeL.open) + 1e-9);
  assert.equal(F.lerpFace(A, B, 0.4).eyeL.shape, A.eyeL.shape);
  assert.equal(F.lerpFace(A, B, 0.6).eyeL.shape, B.eyeL.shape);
});

test("faces: an expression change animates (blend canvas at the shot start, the sticker after 0.3 s; a still mid-shot is done)", () => {
  const p = makePerson({ id: "a", role: "adult", seed: 5 });
  posePerson(p, "stand", 0); setFace(p, "happy");
  posePerson(p, "stand", 0); const m0 = p.userData.joints.face.material;
  posePerson(p, "stand", 0.12); const m1 = p.userData.joints.face.material;
  assert.equal(m0, m1, "the person's own blend material during the blend");
  assert.notEqual(p.userData.faceBlend.key, undefined);
  posePerson(p, "stand", 0.5);
  assert.equal(p.userData.joints.face.material, F.faceMaterialV2("happy", p.userData.faceVariant, p.userData.look), "the cached sticker after the blend");
  // a still rendered straight at mid-shot: no half face
  const q = makePerson({ id: "b", role: "kid", seed: 6 });
  posePerson(q, "stand", 1.4); setFace(q, "angry"); posePerson(q, "stand", 1.4);
  assert.equal(q.userData.joints.face.material, F.faceMaterialV2("angry", q.userData.faceVariant, q.userData.look));
});

// ------------------------------------------------------------------------------------------------- the rig
test("rig: the head sits on the torso (no neck gap); heights stay real (CHARACTERS-V3: the blocky avatar head, ~1/5 of the height)", () => {
  for (const [role, lo, hi] of [["kid", 1.15, 1.55], ["adult", 1.65, 2.0], ["elder", 1.55, 1.9]]) {
    const p = makePerson({ role, seed: 9 });
    p.updateMatrixWorld(true);
    const H = p.userData.height, hb = new THREE.Box3().setFromObject(p.userData.joints.head.children[0]);
    const share = (hb.max.y - hb.min.y) / H;
    assert.ok(H > lo && H < hi, `${role} height ${H.toFixed(2)}`);
    assert.ok(share > 0.17 && share < 0.27, `${role} head share ${share.toFixed(2)}`);
    // the torso top (spine y 0.6, hair.js BODY.HEAD_Y) meets the head bottom
    const torsoTop = new THREE.Vector3(0, 0.6, 0).applyMatrix4(p.userData.joints.spine.matrixWorld).y;
    assert.ok(Math.abs(hb.min.y - torsoTop) < 0.01, `${role}: the head on the collar (${hb.min.y.toFixed(3)} vs ${torsoTop.toFixed(3)})`);
  }
});

// ------------------------------------------------------------------------------------------------- outfits
const AGES = ["kid", "adult", "elder"];
function faceCover(p) {
  // any head-attached mesh (hair, hat, outfit head piece) in front of the face region (head units, FACE_BOX)
  p.updateMatrixWorld(true);
  const head = p.userData.joints.head, inv = head.matrixWorld.clone().invert(), bad = [];
  head.traverse((m) => {
    if (!m.isMesh || m === p.userData.joints.face || m === head.children[0]) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const FB = O.FACE_BOX;
    if (b.max.z > FB.z && b.max.x > -FB.x && b.min.x < FB.x && b.max.y > FB.y0 && b.min.y < FB.y1) bad.push(`${m.parent?.name || m.parent?.parent?.name || "head"} [${b.min.x.toFixed(2)},${b.min.y.toFixed(2)},${b.min.z.toFixed(2)}..${b.max.x.toFixed(2)},${b.max.y.toFixed(2)},${b.max.z.toFixed(2)}]`);
  });
  return bad;
}

test("outfits: every outfit (and variant) x age builds, its parts and head piece are real, nothing covers the face", () => {
  let n = 0;
  for (const [id, def] of Object.entries(D.OUTFITS)) {
    for (const p of def.parts) assert.ok(O.PART_KINDS.includes(p.part), `${id}: part ${p.part}`);
    for (const h of [def.head, def.femaleHead, def.kidHead, ...(def.variants ?? []).map((v) => v.head)]) if (h) assert.ok(O.HEAD_KINDS.includes(h.kind), `${id}: head ${h.kind}`);
    for (const v of def.variants ?? []) for (const p of v.parts ?? []) assert.ok(O.PART_KINDS.includes(p.part), `${id}/${v.id}: part ${p.part}`);
    const variants = def.variants?.map((v) => v.id) ?? [null];
    for (const age of AGES) for (const gender of ["f", "m"]) for (const variant of variants) {
      const look = D.outfitLook(id, { seed: 11, age, gender, variant });
      const p = makePerson({ id: `${id}_${age}`, role: age, seed: 11, gender, look });
      for (const pose of ["stand", "walk", "sit", "run", "cheer"]) posePerson(p, pose, 0.4);
      posePerson(p, "stand", 0);
      const bad = faceCover(p);
      assert.deepEqual(bad, [], `${id}/${variant ?? "-"} ${age} ${gender}: covers the face: ${bad.join("; ")}`);
      n++;
    }
  }
  assert.ok(n > 100);
});

test("outfits: deterministic (same spec -> same look and the same meshes)", () => {
  for (const id of Object.keys(D.OUTFITS)) {
    const a = D.outfitLook(id, { seed: 42, age: "adult", gender: "m" }), b = D.outfitLook(id, { seed: 42, age: "adult", gender: "m" });
    assert.deepEqual(a, b, id);
    const count = (p) => { let k = 0; p.traverse((m) => { if (m.isMesh) k++; }); return k; };
    assert.equal(count(makePerson({ role: "adult", seed: 42, look: { outfit: id } })), count(makePerson({ role: "adult", seed: 42, look: { outfit: id } })), id);
    assert.deepEqual(lookFor({ role: "adult", seed: 42, look: { outfit: id } }), lookFor({ role: "adult", seed: 42, look: { outfit: id } }));
  }
});

test("outfits: role words + era pick the costume", () => {
  const f = (c, era = "modern") => D.outfitFor(c, era, 3);
  assert.equal(f({ name: "King Bram", role: "adult" }, "medieval"), "royal");
  assert.equal(f({ name: "Sir Tom", job: "knight", role: "adult" }, "medieval"), "knight");
  assert.equal(f({ name: "Pell", job: "baker", role: "adult" }), "baker");
  assert.equal(f({ name: "Mo", job: "mail carrier", role: "adult" }), "mail");
  assert.equal(f({ name: "Mayor Gubbins", role: "adult" }), "mayor");
  assert.equal(f({ name: "Old Jo", job: "farmer", role: "elder" }), "farmer");
  assert.equal(f({ name: "Granny Wren", role: "elder", gender: "f" }), "grandma");
  assert.equal(f({ name: "Dr. Vex", job: "villain", role: "adult" }), "villain");
  assert.equal(f({ name: "Ada", job: "scientist", role: "adult" }), "scientist");
  assert.equal(f({ name: "Ug", role: "adult" }, "stoneage"), "caveman");
  assert.equal(f({ name: "Pip", role: "kid" }), "kid_casual");
  assert.equal(f({ name: "Pip", role: "kid" }, "medieval"), "peasant");
  assert.equal(f({ name: "the guard", job: "guard", role: "adult" }, "medieval"), "knight");
  assert.equal(f({ name: "Officer Kay", job: "police officer", role: "adult" }), "police");
  assert.equal(D.eraOf("Ug the caveman hunted a mammoth"), "stoneage");
  assert.equal(D.eraOf("the knight rode to the castle"), "medieval");
  assert.equal(D.eraOf("a quiet street with a bakery"), "modern");
});

test("bible: every named character wears an outfit from its role, all distinct; townsfolk wear the era's clothes", () => {
  const production = {
    summary: "a kingdom where the castle bell rang backwards", worlds: [{ id: "town", name: "the castle town", kind: "outdoor", description: "a medieval village under a castle" }],
    cast: [
      { id: "me", name: "Pip", role: "narrator", kind: "human", look: "", job: "" },
      { id: "king", name: "King Bram", role: "adult", kind: "human", look: "", job: "king" },
      { id: "sir_tom", name: "Sir Tom", role: "adult", kind: "human", look: "", job: "knight" },
      { id: "baker_a", name: "Bo", role: "adult", kind: "human", look: "", job: "baker" },
      { id: "baker_b", name: "Bea", role: "adult", kind: "human", look: "", job: "baker" },
      { id: "granny", name: "Granny Wren", role: "elder", kind: "human", look: "", job: "" },
      { id: "vex", name: "Baron Vex", role: "adult", kind: "human", look: "green cape", job: "villain" },
      { id: "dog", name: "Biscuit", role: "adult", kind: "animal", look: "", job: "", species: "dog" },
    ],
    lines: [],
  };
  const B = buildWorldBible({ production, script: { lines: [{ text: "In this kingdom, the bell rings backwards." }] }, title: "bell" });
  assert.equal(B.outfitEra, "medieval");
  const want = { me: "peasant", king: "royal", sir_tom: "knight", baker_a: "baker", baker_b: "baker", granny: "grandma", vex: "villain" };
  for (const [id, o] of Object.entries(want)) assert.equal(B.cast[id].look.outfit, o, id);
  assert.ok(!B.cast.dog.look.outfit && B.cast.dog.look.animal, "pets unchanged");
  const sig = (l) => `${l.outfit}|${l.outfitVariant ?? ""}|${l.oc?.a}|${l.oc?.c}|${l.top}`;
  const sigs = Object.entries(B.cast).filter(([, b]) => !b.look.animal).map(([, b]) => sig(b.look));
  assert.equal(new Set(sigs).size, sigs.length, `distinct: ${sigs.join(" / ")}`);
  for (const t of B.townsfolk) assert.ok(["peasant", "grandma", "grandpa"].includes(t.look.outfit), `townsfolk ${t.look.outfit}`);
  // the same story twice: the same looks
  assert.deepEqual(buildWorldBible({ production, script: { lines: [{ text: "In this kingdom, the bell rings backwards." }] }, title: "bell" }).cast, B.cast);
});

// ------------------------------------------------------------------------------------------------- expressions
test("expressions: the classifier reads the line (lexicon, negation, intensity, ! and ?)", () => {
  const c = (t) => E.classifyEmotion(t).face;
  assert.equal(c("Mrs. Pell was furious."), "angry");
  assert.equal(c("I was so happy!"), "excited");
  assert.equal(c("Ew, the soup smelled rotten."), "disgusted");
  assert.equal(c("We finally made it home, phew."), "relieved");
  assert.equal(c("I cried all night."), "cry");
  assert.equal(c("Nobody laughed."), "grumpy");
  assert.equal(c("Why would the bell ring backwards?"), "confused");
  assert.equal(c("He blushed, so embarrassed."), "embarrassed");
  assert.equal(c("I was terrified."), "scared");
  assert.equal(c("In this town, every house has a bell."), null);
});

test("expressions: faceForActor never returns neutral; pose-bound faces win; director's emotion first; bystanders react", () => {
  for (const part of ["rule", "tour", "me", "until", "discovery", "climax", "closer", null]) for (const pose of ["stand", "walk", "talk"]) {
    const r = E.faceForActor({ text: "The bell rang.", part, pose, plannedExpr: "neutral" });
    assert.notEqual(r.face, "neutral", `${part}/${pose}`);
    assert.ok(E.FACE_NAMES.includes(r.face));
  }
  assert.equal(E.faceForActor({ text: "I was so happy", plannedExpr: "sneeze", pose: "sneeze" }).face, "sneeze");
  assert.equal(E.faceForActor({ text: "the quiet room", plannedExpr: "shush" }).face, "shush");
  assert.equal(E.faceForActor({ text: "the bell rang", directorEmotion: "triumphant" }).face, "proud");
  assert.equal(E.faceForActor({ text: "Mrs. Pell was furious", subject: false }).face, "worried");
  assert.equal(E.faceForActor({ text: "I was so happy", pose: "scared" }).face, "scared", "a scared body never smiles");
});

test("expressions: exprPass gives every actor a face from its line (deterministic, a.expr untouched)", () => {
  const tl = {
    cast: { me: { name: "Pip" }, pell: { name: "Mrs. Pell" } },
    shots: [
      { line: 0, part: "rule", text: "In this town, nobody rings the bell.", actors: [{ id: "me", pose: "stand", expr: "neutral" }] },
      { line: 1, part: "until", text: "Mrs. Pell was furious.", actors: [{ id: "pell", pose: "talk", expr: "angry" }, { id: "me", pose: "stand", expr: "neutral" }] },
      { line: 2, part: "closer", text: "We all laughed.", actors: [{ id: "me", pose: "cheer", expr: "excited" }] },
      { line: 3, part: "tour", text: "Shh, whisper.", actors: [{ id: "me", pose: "stand", expr: "shush" }] },
    ],
  };
  const a = JSON.parse(JSON.stringify(tl));
  const r = E.exprPass(tl, { production: { lines: [{ line: 0, emotion: "curious" }] } });
  E.exprPass(a, { production: { lines: [{ line: 0, emotion: "curious" }] } });
  assert.deepEqual(a, tl, "deterministic");
  assert.equal(r.set, 5);
  assert.equal(tl.shots[0].actors[0].face, "curious");
  assert.equal(tl.shots[1].actors[0].face, "angry");
  assert.equal(tl.shots[1].actors[1].face, "worried");
  assert.equal(tl.shots[2].actors[0].face, "laugh");
  assert.equal(tl.shots[3].actors[0].face, "shush");
  assert.equal(tl.shots[1].actors[1].expr, "neutral", "the planner's expr stays");
  for (const s of tl.shots) for (const x of s.actors) assert.notEqual(x.face, "neutral");
});
