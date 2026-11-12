// CHARACTERS-V3 2026-11-10 (owner: "much closer to the reference's blocky avatar style: head on the torso, chunky limbs;
// bold simple decal faces (no lashes / sparkles / blush by default); chunky stylised hair on most characters, hats only
// when the story needs one; clean plastic outfits; crowds in the same style"). Free, pure checks (no GPU, no browser):
//   node --test dev/charactersV3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
const THREE = await import("three");
const F = await import("../page/kit/facesV2.js");
const D = await import("../page/kit/outfitsData.js");
const O = await import("../page/kit/outfits.js");
const Hk = await import("../page/kit/hair.js");
const C = await import("../page/kit/crowd.js");
const { makePerson, posePerson, lookFor } = await import("../page/kit/people.js");
const { dressLook } = await import("../lib/worldBible.js");
const { BODY } = Hk;

const sizeOf = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); };
const firstMesh = (g) => g.children.find((c) => c.isMesh);
const meshBox = (m) => { m.updateMatrixWorld(true); m.geometry.computeBoundingBox(); return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); };

// ------------------------------------------------------------------------------------------------- proportions
test("proportions: the blocky avatar body (boxy torso, chunky arms + legs, the head on the torso ~0.6 of its width)", () => {
  // the reference frames: legs : torso : head ~ 2 : 2 : 1.2; head ~0.6 of the torso's width; arms half the torso's width
  assert.ok(BODY.TORSO.w / BODY.TORSO.d >= 1.8 && BODY.TORSO.w / BODY.TORSO.d <= 2.2, "a boxy 2:1 torso");
  assert.ok(BODY.ARM.w / BODY.TORSO.w >= 0.35 && BODY.ARM.w / BODY.TORSO.w <= 0.5, "chunky arms");
  assert.ok((2 * BODY.LEG.w) / BODY.TORSO.w >= 0.85 && (2 * BODY.HIP_X + BODY.LEG.w) / BODY.TORSO.w <= 1.05, "the legs side by side as wide as the torso");
  for (const [role, lo, hi] of [["kid", 1.15, 1.6], ["adult", 1.65, 2.05], ["elder", 1.55, 1.95]]) {
    const p = makePerson({ role, seed: 9, look: { hair: "short" } });
    const j = p.userData.joints; p.updateMatrixWorld(true);
    const head = meshBox(firstMesh(j.head)), torso = meshBox(firstMesh(j.spine)), arm = meshBox(firstMesh(j.sh[0])), thigh = meshBox(firstMesh(j.hip[0]));
    const hw = head.max.x - head.min.x, tw = torso.max.x - torso.min.x, aw = arm.max.x - arm.min.x, lw = thigh.max.x - thigh.min.x;
    assert.ok(p.userData.height > lo && p.userData.height < hi, `${role} height ${p.userData.height.toFixed(2)}`);
    assert.ok(hw / tw > 0.5 && hw / tw < (role === "kid" ? 0.8 : 0.7), `${role}: head / torso width ${(hw / tw).toFixed(2)}`);
    assert.ok(aw / tw > 0.35, `${role}: arm / torso width ${(aw / tw).toFixed(2)}`);
    assert.ok(lw / tw > 0.42, `${role}: leg / torso width ${(lw / tw).toFixed(2)}`);
    // the head's bottom = the torso's top, in the spine's own frame (an elder's stoop tilts both)
    assert.ok(Math.abs(j.head.position.y - (BODY.TORSO.y + BODY.TORSO.h / 2)) < 1e-6 && Math.abs(firstMesh(j.head).position.y - BODY.HEAD.h / 2) < 1e-6, `${role}: the head rests on the torso`);
    if (role !== "elder") assert.ok(Math.abs(head.min.y - torso.max.y) < 0.01, `${role}: no gap (${(head.min.y - torso.max.y).toFixed(3)})`);
    const share = (head.max.y - head.min.y) / p.userData.height;
    assert.ok(share > 0.17 && share < 0.27, `${role}: head share ${share.toFixed(2)}`);
    // the arm's top meets the torso's top (shoulders square, no gap) and the arm hangs to about the hips
    assert.ok(Math.abs(arm.max.y - torso.max.y) < 0.02, `${role}: arm top ${arm.max.y.toFixed(3)} vs torso top ${torso.max.y.toFixed(3)}`);
    assert.ok(meshBox(firstMesh(j.hand[0])).min.y < torso.min.y, `${role}: the hands reach below the torso`);
  }
});

test("proportions: every pose keeps the feet on the floor or its planned lift (sit / ride / sleep use the chunky thigh)", () => {
  for (const role of ["kid", "adult", "elder"]) {
    const p = makePerson({ role, seed: 4 });
    for (const pose of ["stand", "walk", "run", "point", "wave", "talk", "cheer", "hug", "eat", "throw", "dance", "kick", "fight"]) { // (push leans the whole rig: page/ground.js snaps it per frame)
      posePerson(p, pose, 0.4); p.updateMatrixWorld(true);
      const low = Math.min(...p.userData.joints.knee.map((k) => new THREE.Box3().setFromObject(k).min.y));
      assert.ok(low > -0.03 && low < 0.2, `${role} ${pose}: lowest foot ${low.toFixed(3)}`);
    }
    posePerson(p, "sit", 0.4, { seat: 0.45 }); p.updateMatrixWorld(true);
    const thigh = meshBox(firstMesh(p.userData.joints.hip[0]));
    assert.ok(Math.abs(thigh.min.y - 0.45) < 0.05, `${role} sit: the thigh on the seat (${thigh.min.y.toFixed(3)})`);
  }
});

// ------------------------------------------------------------------------------------------------- faces
const BLUSH_OK = new Set(["embarrassed", "love"]);
test("faces: bold simple decals by default: no lashes, sparkles, star eyes; blush only embarrassed / love", () => {
  for (const n of F.FACES) {
    const P = F.faceParams(n);
    assert.equal(P.fx.sparkle, 0, `${n}: sparkle`);
    if (!BLUSH_OK.has(n)) assert.equal(P.fx.blush, 0, `${n}: blush`);
    for (const e of [P.eyeL, P.eyeR]) assert.notEqual(e.shape, "star", `${n}: star eyes`);
  }
  // big round eyes, small pupils: round (rw ~ rh), the pupil about a third of the eye
  assert.ok(Math.abs(F.EYE.rw - F.EYE.rh) <= 2 && F.EYE.rw >= 30);
  const pupil = F.PUPIL_R * F.faceParams("neutral").eyeL.pupil;
  assert.ok(pupil / F.EYE.rw < 0.42 && pupil / F.EYE.rw > 0.2, `pupil ${pupil} / eye ${F.EYE.rw}`);
  // the extras stay, used by emotion
  for (const [fx, face] of [["sweat", "nervous"], ["tears", "laugh"], ["stream", "cry"], ["anger", "angry"], ["blush", "embarrassed"]]) assert.ok(F.faceParams(face).fx[fx] > 0, `${face} uses ${fx}`);
  // >= 12 distinct mouths still in use
  assert.ok(new Set(F.FACES.map((n) => JSON.stringify(F.faceParams(n).mouth))).size >= 12);
});

test("faces: the drawing has no lash strokes outside the eye and no nose (recorded canvas calls)", () => {
  // record every stroke's path points; an open eye's strokes stay within the eye's own box (+ the outline width)
  const pts = []; let cur = [];
  const ctx = new Proxy({}, { get: (_, k) => k === "moveTo" || k === "lineTo" ? (x, y) => cur.push([x, y]) : k === "stroke" ? () => { pts.push(cur); cur = []; } : k === "beginPath" ? () => { cur = []; } : () => ({ addColorStop() {} }), set: () => true });
  const P = F.faceParams("neutral");
  F.drawFaceV2(ctx, { ...P, browL: { ...P.browL, len: 0 }, browR: { ...P.browR, len: 0 }, mouth: { ...P.mouth, w: 0 } }, F.faceLook({}));
  for (const path of pts) for (const [x, y] of path) {
    const inEye = [F.EYE.lx, F.EYE.rx].some((cx) => Math.abs(x - cx) <= F.EYE.rw * 1.45 && Math.abs(y - F.EYE.y) <= F.EYE.rh + 6);
    const brow = y < F.EYE.y - F.EYE.rh, mouth = y > 170;
    assert.ok(inEye || brow || mouth, `a stroke point outside the eyes / brows / mouth: ${x.toFixed(0)},${y.toFixed(0)}`);
  }
  const src = String(F.drawFaceV2);
  assert.ok(!/roundRect\(118, 146/.test(src), "no nose");
});

test("faces: facial hair decals draw for every kind (adult / elder men only)", () => {
  const ctx = new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
  for (const facial of D.FACIAL_KINDS) F.drawFaceV2(ctx, F.faceParams("happy"), F.faceLook({ beard: "#5a3b25", facial }));
  for (let seed = 1; seed < 300; seed++) {
    for (const age of ["kid", "adult", "elder"]) for (const gender of ["f", "m", null]) {
      const h = D.hairFor({ seed, age, gender });
      if (h.facial) assert.ok(gender === "m" && age !== "kid", `${age} ${gender}: ${h.facial}`);
      if (age === "elder") assert.ok(D.HAIR_COLORS.grey.includes(h.hairColor), `elder hair ${h.hairColor}`);
    }
    const f = lookFor({ role: "adult", seed, gender: "f" });
    assert.equal(f.beard, null); assert.equal(f.facial, null);
  }
});

// ------------------------------------------------------------------------------------------------- hair
const AGES = ["kid", "adult", "elder"];
function coversFace(head) {
  head.updateMatrixWorld(true);
  const inv = head.matrixWorld.clone().invert(), FB = O.FACE_BOX, bad = [];
  head.traverse((m) => {
    if (!m.isMesh || m === head.children[0] || m.geometry.type === "PlaneGeometry") return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (b.max.z > FB.z && b.max.x > -FB.x && b.min.x < FB.x && b.max.y > FB.y0 && b.min.y < FB.y1) bad.push(`${m.parent?.name} y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)} x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}`);
  });
  return bad;
}
test("hair: 20+ chunky styles; every hair x age (x under a hat) builds, never over the face; deterministic", () => {
  assert.ok(D.HAIR_KINDS.length >= 20, `${D.HAIR_KINDS.length} styles`);
  assert.deepEqual([...Hk.BUILT_HAIR].sort(), [...D.HAIR_KINDS].sort(), "every style has a builder");
  for (const hair of D.HAIR_KINDS) for (const age of AGES) for (const hat of [null, "cap"]) {
    const look = { hair, hairColor: "#6b3e1f", hat, hatColor: "#2e86de" };
    const p = makePerson({ role: age, seed: 7, look });
    const g = p.userData.joints.head.children.find((c) => c.name === `hair:${hair}`);
    assert.ok(g, `${hair} ${age}: built`);
    if (!["bald", "tuft", "receding"].includes(hair) && !hat) assert.ok(g.children.length >= 3, `${hair} ${age}: chunky pieces (${g.children.length})`);
    assert.deepEqual(coversFace(p.userData.joints.head), [], `${hair} ${age} hat ${hat}`);
    const q = makePerson({ role: age, seed: 7, look });
    const count = (o) => { let k = 0; o.traverse((m) => { if (m.isMesh) k++; }); return k; };
    assert.equal(count(p), count(q), `${hair} ${age}: deterministic`);
    if (hat) assert.ok(!g.children.some((m) => meshBox(m).max.y > meshBox(p.userData.joints.head.children[0]).max.y + 0.2), `${hair} ${age}: no hair poking through the hat`);
  }
});

test("hair: most characters get hair (seeded, both genders, all ages), many different styles, natural + a few fun colours", () => {
  const styles = new Set(), fun = []; let bald = 0, n = 0;
  for (let seed = 0; seed < 400; seed++) for (const role of AGES) for (const gender of ["f", "m", null]) {
    const o = lookFor({ role, seed, gender }); n++;
    styles.add(o.hair); if (o.hair === "bald") bald++;
    if (D.HAIR_COLORS.fun.includes(o.hairColor)) fun.push(o.hairColor);
    assert.ok(D.HAIR_KINDS.includes(o.hair), o.hair);
    assert.equal(o.hat, null, "no seeded hats");
  }
  assert.ok(styles.size >= 18, `${styles.size} styles in use`);
  assert.ok(bald / n < 0.08, `bald ${(bald / n).toFixed(2)}`);
  assert.ok(fun.length > 0 && fun.length / n < 0.1, `fun colours ${fun.length}`);
});

// ------------------------------------------------------------------------------------------------- hats
test("hats only on the roles that need one (crown, helmet, chef hat...), the rest show hair; the story can ask for the role's hat", () => {
  const need = new Set(D.HAT_ROLES);
  for (const [id, def] of Object.entries(D.OUTFITS)) for (const age of AGES) for (const gender of ["f", "m"]) {
    for (const variant of def.variants?.map((v) => v.id) ?? [null]) {
      const l = D.outfitLook(id, { seed: 5, age, gender, variant });
      if (l.ohead && D.HAT_KINDS.includes(l.ohead.kind)) assert.ok(need.has(id), `${id} ${age} ${gender} ${variant}: a hat (${l.ohead.kind}) on a role that does not need one`);
    }
  }
  for (const id of D.HAT_ROLES) assert.ok(D.outfitLook(id, { seed: 5, age: "adult", gender: "m" }).ohead, `${id} keeps its hat`);
  // the story names a hat: the farmer gets the farmer's straw hat, a casual kid the variant's cap / beanie
  assert.equal(D.outfitLook("farmer", { seed: 5, withHat: true }).ohead?.kind, "strawhat");
  const look = { hat: "cap", hatColor: "#ff0000" };
  dressLook(look, { job: "farmer", name: "Old Jo", look: "farmer in a straw hat", role: "adult" }, 5, "modern", "adult", "m", { hat: true });
  assert.equal(look.ohead?.kind, "strawhat");
  const look2 = { hat: "cap", hatColor: "#ff0000" };
  dressLook(look2, { job: "", name: "Ann", look: "a red cap", role: "adult" }, 5, "modern", "adult", "f", { hat: true }, "jacket");
  assert.ok(look2.ohead === null && look2.hat === "cap", "no role hat: the named cap");
  // a hat flattens the hair (no top volume), a crown sits on it
  const knight = makePerson({ role: "adult", seed: 2, gender: "m", look: { outfit: "knight", hair: "spiky" } });
  assert.ok(!knight.userData.joints.head.children.find((c) => c.name === "hair:spiky").children.some((m) => m.geometry.type === "ConeGeometry"), "no spikes under the helmet");
  const king = makePerson({ role: "adult", seed: 2, gender: "m", look: { outfit: "royal", hair: "spiky" } });
  assert.ok(king.userData.joints.head.children.find((c) => c.name === "hair:spiky").children.some((m) => m.geometry.type === "ConeGeometry"), "the crown sits on the spikes");
});

test("outfits: clean plastic (no fabric noise textures): only print kinds carry a map, everything else is a flat colour", () => {
  for (const kind of ["cotton", "denim", "leather", "velvet", "canvas", "linen", "knit", "tweed", "fur", "plate", "chainmail", "quilt"]) assert.equal(O.garment("#3366aa", kind).map ?? null, null, kind);
  for (const kind of ["stripes", "plaid", "dots", "check", "stars", "ermine"]) assert.ok(O.garment("#3366aa", kind).map, kind);
  for (const id of Object.keys(D.OUTFITS)) {
    const p = makePerson({ role: "adult", seed: 3, look: { outfit: id } });
    p.traverse((x) => { if (x.isMesh && !x.material.transparent && x.material.roughness != null) assert.ok(x.material.roughness >= 0.3 && x.material.roughness <= 0.55, `${id}: roughness ${x.material.roughness} (PLASTIC-WORLD range)`); });
  }
  assert.ok(Object.keys(D.OUTFITS).length >= 29, "the 29 roles kept");
});

// ------------------------------------------------------------------------------------------------- crowds
test("crowds: the cast's style (same body numbers, the hair kit's pieces, adult height, hands in skin)", () => {
  const p = makePerson({ role: "adult", seed: 1, look: { hair: "short" } });
  assert.equal(C.CROWD_SCALE, p.userData.scale, "a crowd adult = a cast adult");
  for (const s of C.CROWD_HAIR) assert.ok(D.HAIR_KINDS.includes(s), s);
  const g = C.makeCrowd({ kind: "townsfolk", count: 60, seed: 3 });
  C.updateCrowd(g, 0.3, { action: "stand" });
  const P = g.userData.crowd.parts;
  const bb = (im) => { im.geometry.computeBoundingBox(); return im.geometry.boundingBox.getSize(new THREE.Vector3()); };
  assert.ok(Math.abs(bb(P.torso).x - BODY.TORSO.w) < 0.02, `torso width ${bb(P.torso).x}`);
  assert.ok(Math.abs(bb(P.head).x - BODY.HEAD.w * 1.45) < 0.02, `head width ${bb(P.head).x}`);
  assert.ok(Math.abs(bb(P.armL).x - BODY.ARM.w) < 0.02 && Math.abs(bb(P.legL).x - BODY.SHOE.w) < 0.02);
  assert.ok(P.handL && P.handR, "skin hands");
  const hairs = Object.keys(P).filter((k) => k.startsWith("hair_"));
  assert.ok(hairs.length >= 5, `hair styles in the crowd: ${hairs.join(",")}`);
  // the crowd hair piece = the cast's (the same bounding size as on a person's head, in head units x 1.45)
  const q = makePerson({ role: "adult", seed: 1, look: { hair: "bob" } }), hb = new THREE.Box3().setFromObject(q.userData.joints.head.children.find((c) => c.name === "hair:bob")).getSize(new THREE.Vector3());
  if (P.hair_bob) { const cb = bb(P.hair_bob).multiplyScalar(C.CROWD_SCALE); assert.ok(Math.abs(cb.x - hb.x) < 0.03 && Math.abs(cb.y - hb.y) < 0.03, `bob ${cb.x.toFixed(2)} vs ${hb.x.toFixed(2)}`); }
  // deterministic: the same crowd twice, the same colours and matrices
  const a = C.makeCrowd({ kind: "townsfolk", count: 30, seed: 9 }), b = C.makeCrowd({ kind: "townsfolk", count: 30, seed: 9 });
  C.updateCrowd(a, 1.2, { action: "cheer" }); C.updateCrowd(b, 1.2, { action: "cheer" });
  for (const k of Object.keys(a.userData.crowd.parts)) {
    assert.deepEqual([...a.userData.crowd.parts[k].instanceMatrix.array], [...b.userData.crowd.parts[k].instanceMatrix.array], k);
    if (a.userData.crowd.parts[k].instanceColor) assert.deepEqual([...a.userData.crowd.parts[k].instanceColor.array], [...b.userData.crowd.parts[k].instanceColor.array], k);
  }
  for (const kind of ["knight", "soldier", "wolf_soldier"]) { const k = C.makeCrowd({ kind, count: 24, seed: 2 }); C.updateCrowd(k, 0.5, { action: "march", camera: new THREE.PerspectiveCamera() }); assert.ok(k.userData.crowd.parts.helmet); }
});

test("determinism: the same spec twice -> the same look and meshes; a different seed -> a different look", () => {
  for (const role of AGES) for (let seed = 0; seed < 20; seed++) {
    const a = makePerson({ role, seed }), b = makePerson({ role, seed });
    assert.deepEqual(a.userData.look, b.userData.look);
    const sig = (o) => { const s = []; o.traverse((m) => { if (m.isMesh) s.push(`${m.geometry.uuid === undefined}|${m.position.toArray().map((v) => v.toFixed(4))}`); }); return s.join(";"); };
    assert.equal(sig(a), sig(b));
  }
  const looks = new Set(Array.from({ length: 30 }, (_, s) => JSON.stringify(lookFor({ role: "adult", seed: s }))));
  assert.equal(looks.size, 30);
});
