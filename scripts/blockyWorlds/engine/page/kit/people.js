// Blocky Worlds people: the locked look's townsfolk (look/scene.js person()) as a rigged, seeded kit.
// makePerson(spec) -> Group (origin at the feet, faces +z); posePerson(person, pose, t, opts); setFace(person, expr).
//
// Rig (nested pivots, unscaled units; the root is scaled per role):
//   root (engine sets position/rotation; scale = role scale)
//   └ rig (bob, lean, sit offset, sleep rotation)
//     └ pelvis (y 0.90: hip box, belt, skirt pivot)
//       ├ hip[i] (x ±0.11) -> knee[i] (y -0.42) -> shin + shoe
//       └ spine (y +0.17: torso, collar, tie, backpack)
//         ├ shoulder[i] (x ±0.315, y 0.49) -> elbow[i] (y -0.30) -> hand[i] (y -0.33)
//         └ head (y 0.60; kids' heads are scaled up)
// Index 0 = the person's RIGHT side (-x), index 1 = their LEFT (+x). Pointing, waving and single-hand props use the right.
import * as THREE from "three";
import { rng, hashSeed, cloth, fabric, skinMat, solid, darker, rbx, bx, addMesh, cachedGeo } from "./kitCommon.js";
import { EXPRS as FACE_EXPRS, faceMaterial } from "./faces.js";
import { makeHeld } from "./props.js";
import { SMALL_HELD } from "./heldMore.js";

// 2026-11-04 (OBJECTS agent): yell (lean forward, arms down and back, mouth wide), sneeze (wind-up "ah-" then the head
// snaps forward at t = 0.4 s, hand to the face), blow (the held prop, e.g. "whistle", at the mouth, cheeks puffed),
// cover_mouth (both hands over the mouth; also opts.hands = "mouth" on any pose, e.g. sit). Role "baby": ~0.55 m sitting,
// a big round head, a onesie, a tuft of hair; every pose except sleep sits on the floor (the upper body follows the
// pose). In a crib: put the baby at the crib's spot and raise its root by the crib's userData.bedH (the engine does).
// Carried: holdPerson(carrier, baby) after posing the carrier with pose "carry" and hold null.
export const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow", "cover_mouth"];
export const EXPRS = FACE_EXPRS;

// ---------- seeded looks ----------
const SKIN = ["#f3cba9", "#c98e6b", "#8a5a3c", "#e7b38e", "#5e3b28", "#f6d6bd", "#a86f4b", "#ffe0c7"];
const TOPS = ["#18b8a5", "#ff7a1a", "#ffd32a", "#c0392b", "#ff6fb5", "#273c75", "#ff3b6b", "#2e86de", "#6c5ce7", "#00b894", "#e84393", "#fdcb6e", "#0984e3", "#d63031", "#55efc4", "#a29bfe", "#f0932b", "#badc58", "#f5f6fa", "#2d3436"];
const ELDER_TOPS = ["#7f8c8d", "#a0522d", "#6d8a5a", "#8e7cc3", "#b5838d", "#c0392b", "#5d6d7e", "#d4a373", "#4a6fa5", "#e1c699"];
const PANTS = ["#2f4f86", "#3b5b8f", "#2d3436", "#57606f", "#d63031", "#c8a96a", "#1e272e", "#6d4c41", "#273c75", "#4b6584", "#00b894"];
const SHOES = ["#ffffff", "#ff3b5c", "#3742fa", "#3d2b1f", "#1e1e1e", "#00d2d3", "#f9ca24", "#ff9f43"];
const HAIR = ["#1b1410", "#2b1d14", "#3a2a1e", "#6b3e1f", "#b5651d", "#d9a441", "#8b2e16", "#20140e"];
const GREY = ["#d8d8d8", "#bfbfbf", "#efefef", "#9a9a9a"];
const HATS = ["#e74c3c", "#2d98da", "#6c5ce7", "#c8a96a", "#20bf6b", "#f7b731", "#2d3436", "#fd79a8"];
const ACC = ["#e84a5f", "#2e86de", "#00b894", "#ffd32a", "#6c5ce7", "#ff9f43"];
const ROLE = { kid: { scale: 0.62, head: 1.22 }, adult: { scale: 0.87, head: 1 }, elder: { scale: 0.85, head: 1, stoop: 0.13 }, baby: { scale: 0.36, head: 1.6, baby: true } };
const ONESIE = ["#ffd1dc", "#bfe3ff", "#fff1a8", "#c8f7c5", "#e3d1ff", "#ffd8b0"];
const wpick = (R, pairs) => { let x = R() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) { x -= w; if (x <= 0) return v; } return pairs[0][0]; };

/** everything about a person's looks from (role, seed); spec.look overrides any field */
export function lookFor(spec) {
  const role = ROLE[spec.role] ? spec.role : "adult";
  const seed = Number.isFinite(Number(spec.seed)) ? Number(spec.seed) : hashSeed(spec.name ?? spec.id ?? "x");
  const R = rng(seed * 7919 + (role === "kid" ? 11 : role === "elder" ? 23 : 37));
  const kid = role === "kid", elder = role === "elder";
  const o = { role, skin: R.pick(SKIN) };
  if (role === "baby") { // a footed onesie (top, legs and feet one colour and pattern), a tuft or a bald head, nothing else
    o.top = R.pick(ONESIE); o.pattern = R.pick(["cotton", "dots", "stripes", "cotton"]); o.sleeve = "long"; o.bottom = "pants";
    o.pants = o.top; o.pantsKind = o.pattern; o.shoes = o.top; o.hair = R() < 0.7 ? "tuft" : "bald"; o.hairColor = R.pick(HAIR);
    o.tieColor = "#ffffff"; o.hat = null; o.hatColor = "#ffffff"; o.capBack = false; o.glasses = false; o.beard = null; o.acc = [];
    o.packColor = o.bagColor = o.phonesColor = "#ffffff"; o.phase = R() * 10;
    return Object.assign(o, spec.look ?? {});
  }
  o.top = R.pick(elder ? ELDER_TOPS : TOPS);
  o.pattern = wpick(R, kid ? [["cotton", 3], ["stripes", 3], ["dots", 2], ["band", 2], ["plaid", 1]] : elder ? [["cotton", 4], ["plaid", 3], ["stripes", 1], ["pinstripe", 1]] : [["cotton", 4], ["stripes", 2], ["dots", 1], ["band", 1], ["plaid", 2], ["pinstripe", 1]]);
  o.sleeve = R() < (elder ? 0.1 : 0.4) ? "short" : "long";
  o.bottom = wpick(R, kid ? [["pants", 5], ["shorts", 3], ["skirt", 1], ["dress", 1]] : elder ? [["pants", 8], ["skirt", 1], ["dress", 1]] : [["pants", 13], ["shorts", 2], ["skirt", 2], ["dress", 2]]);
  if (o.bottom === "dress" && o.pattern === "pinstripe") o.pattern = "cotton";
  o.pants = R.pick(PANTS); while (o.pants === o.top) o.pants = R.pick(PANTS);
  o.pantsKind = ["#2f4f86", "#3b5b8f", "#4b6584"].includes(o.pants) ? "denim" : "cotton";
  o.shoes = R.pick(SHOES);
  o.hair = wpick(R, kid ? [["short", 3], ["spiky", 2], ["ponytail", 2], ["bun", 1], ["afro", 1], ["long", 2]] : elder ? [["short", 4], ["bald", 3], ["bun", 2], ["long", 1]] : [["short", 5], ["long", 3], ["ponytail", 2], ["bun", 1], ["afro", 2], ["bald", 1], ["spiky", 1]]);
  o.hairColor = elder ? R.pick(GREY) : R.pick(HAIR);
  o.tieColor = R.pick(["#ff5c8a", "#ffd32a", "#2e86de", "#00b894"]);
  const hatRoll = R();
  o.hat = hatRoll < (kid ? 0.35 : elder ? 0.3 : 0.22) ? wpick(R, kid ? [["cap", 6], ["beanie", 3], ["bucket", 1]] : elder ? [["bucket", 4], ["beanie", 3], ["cap", 1]] : [["cap", 4], ["beanie", 3], ["bucket", 2]]) : null;
  o.hatColor = R.pick(HATS); o.capBack = R() < 0.5;
  o.glasses = R() < (kid ? 0.12 : elder ? 0.6 : 0.22);
  const beardOk = ["short", "bald", "afro", "spiky"].includes(o.hair) && !kid && (o.bottom === "pants" || o.bottom === "shorts");
  o.beard = beardOk && R() < (elder ? 0.45 : 0.25) ? (elder ? R.pick(GREY) : o.hairColor) : null;
  o.acc = [];
  if (R() < (kid ? 0.4 : 0.1)) o.acc.push("backpack");
  if (R() < (kid ? 0.1 : 0.08) && !o.hat) o.acc.push("headphones");
  if (!kid && o.bottom === "pants" && (o.pattern === "cotton" || o.pattern === "pinstripe") && R() < 0.3) o.acc.push("tie");
  const handRoll = R();
  if (!kid && handRoll < 0.15) o.acc.push("bag"); else if (!kid && !elder && handRoll < 0.22 && o.acc.includes("tie")) o.acc.push("briefcase");
  o.packColor = R.pick(ACC); o.bagColor = R.pick(ACC); o.phonesColor = R.pick(ACC);
  o.phase = R() * 10; // so a crowd never moves in sync
  return Object.assign(o, spec.look ?? {});
}

// ---------- build ----------
const Rv = 0.012; // L keeps A's crisp blocks with a hairline bevel
const LT = 0.42, LS = 0.4875, LEG = LT + LS; // thigh, knee->sole

/** a person from a cast entry { id, role: "kid"|"adult"|"elder", name, seed, look? } */
export function makePerson(spec = {}) {
  const o = lookFor(spec), role = ROLE[o.role];
  const root = new THREE.Group(); root.name = `person:${spec.id ?? spec.name ?? "x"}`;
  root.scale.setScalar(role.scale);
  const rig = new THREE.Group(); root.add(rig);
  const baby = !!role.baby;
  const skin = skinMat(o.skin), top = cloth(o.top, o.pattern), pants = cloth(o.pants, o.pantsKind ?? (o.bottom === "pants" ? "denim" : "cotton")), shoe = baby ? pants : cloth(o.shoes, "leather");
  const sole = baby ? pants : solid("#f7f7f2", { roughness: 0.7 });
  const bare = o.bottom === "skirt" || o.bottom === "dress";

  const pelvis = new THREE.Group(); pelvis.position.y = 0.9; rig.add(pelvis);
  const hip = [], knee = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const h = new THREE.Group(); h.position.set(s * 0.11, 0, 0); pelvis.add(h);
    const k = new THREE.Group(); k.position.y = -0.42; h.add(k);
    rbx(0.19, 0.42, 0.22, Rv * 0.7, bare ? skin : pants, { y: -0.21, parent: h });
    rbx(0.18, 0.38, 0.21, Rv * 0.7, bare || o.bottom === "shorts" ? skin : pants, { y: -0.19, parent: k });
    if (o.bottom === "shorts") bx(0.21, 0.08, 0.24, pants, { y: -0.36, parent: h });
    rbx(0.21, 0.11, 0.32, Rv, shoe, { y: -0.43, z: 0.05, parent: k });
    bx(0.215, 0.035, 0.325, sole, { y: -0.47, z: 0.05, parent: k });
    hip[i] = h; knee[i] = k;
  }
  let skirt = null;
  if (bare) {
    skirt = new THREE.Group(); skirt.position.y = 0.12; pelvis.add(skirt);
    rbx(0.5, 0.36, 0.3, Rv, cloth(o.bottom === "dress" ? o.top : o.pants, o.bottom === "dress" ? o.pattern : "cotton"), { y: -0.18, parent: skirt });
  }
  rbx(0.42, 0.2, 0.24, Rv, o.bottom === "dress" ? top : pants, { y: 0.09, parent: pelvis });
  if (o.bottom !== "dress" && !baby) { bx(0.43, 0.05, 0.25, solid("#2b2018", { roughness: 0.45 }), { y: 0.17, parent: pelvis }); bx(0.07, 0.05, 0.02, solid("#d8b45a", { metalness: 0.8, roughness: 0.3 }), { y: 0.17, z: 0.126, parent: pelvis }); }

  const spine = new THREE.Group(); spine.position.y = 0.17; pelvis.add(spine);
  rbx(0.48, 0.5, 0.26, Rv, top, { y: 0.27, parent: spine });
  bx(0.2, 0.06, 0.03, cloth(o.top, "cotton"), { y: 0.5, z: 0.13, parent: spine });
  if (!baby) bx(0.12, 0.1, 0.02, solid(darker(o.top, 0.85)), { x: 0.12, y: 0.33, z: 0.135, parent: spine });
  else bx(0.2, 0.16, 0.02, solid("#ffffff", { roughness: 0.7 }), { y: 0.36, z: 0.135, parent: spine }); // a bib
  if (o.acc.includes("tie")) { bx(0.07, 0.34, 0.02, solid("#c0392b", { roughness: 0.4 }), { y: 0.33, z: 0.137, parent: spine }); bx(0.16, 0.48, 0.02, solid("#f5f5f5"), { y: 0.27, z: 0.131, parent: spine }); }
  if (o.acc.includes("backpack")) {
    rbx(0.4, 0.46, 0.18, 0.04, cloth(o.packColor, "cotton"), { y: 0.25, z: -0.22, parent: spine });
    for (const s of [-1, 1]) bx(0.05, 0.42, 0.02, solid(darker(o.packColor, 0.6)), { x: s * 0.13, y: 0.3, z: 0.132, parent: spine });
  }

  const sh = [], el = [], hand = [], handAcc = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.Group(); a.position.set(s * 0.315, 0.49, 0); spine.add(a);
    const e = new THREE.Group(); e.position.y = -0.3; a.add(e);
    const shortSleeve = o.sleeve === "short";
    rbx(0.15, 0.3, 0.17, Rv * 0.6, top, { y: -0.15, parent: a });
    rbx(0.14, 0.27, 0.16, Rv * 0.5, shortSleeve ? skin : top, { y: -0.135, parent: e });
    if (!shortSleeve) bx(0.15, 0.04, 0.17, solid(darker(o.top, 0.75)), { y: -0.25, parent: e });
    const hd = new THREE.Group(); hd.position.y = -0.33; e.add(hd);
    rbx(0.13, 0.13, 0.14, Rv, skin, { parent: hd });
    if (s > 0 && o.acc.includes("bag")) handAcc.push(rbx(0.34, 0.28, 0.12, 0.03, cloth(o.bagColor, "leather"), { y: -0.2, parent: hd }));
    if (s > 0 && o.acc.includes("briefcase")) handAcc.push(rbx(0.42, 0.3, 0.1, 0.02, cloth("#5a3b24", "leather"), { y: -0.2, parent: hd }));
    sh[i] = a; el[i] = e; hand[i] = hd;
  }
  const finger = bx(0.04, 0.11, 0.045, skin, { y: -0.1, z: 0.035, parent: hand[0] }); finger.visible = false; // pointing finger

  bx(0.13, 0.09, 0.13, skin, { y: 0.56, parent: spine });
  const head = new THREE.Group(); head.position.y = 0.6; head.scale.setScalar(role.head); spine.add(head);
  rbx(0.3, 0.32, 0.3, baby ? 0.045 : 0.006, skin, { y: 0.16, parent: head });
  const face = addMesh(cachedGeo("facePlane", () => new THREE.PlaneGeometry(0.28, 0.28)), faceMaterial("neutral", "base", o), { y: 0.15, z: 0.151, parent: head, shadow: false });
  face.receiveShadow = true;
  const hm = cloth(o.hairColor, "cotton"), hair = o.hair;
  if (hair === "tuft") { // a baby's little curl on top
    rbx(0.07, 0.07, 0.07, 0.02, hm, { y: 0.335, z: 0.04, parent: head });
    rbx(0.05, 0.08, 0.05, 0.015, hm, { x: 0.025, y: 0.39, z: 0.06, rz: -0.6, parent: head });
  } else if (hair !== "bald") {
    rbx(0.32, 0.09, 0.32, Rv * 0.5, hm, { y: 0.335, parent: head });
    rbx(0.32, 0.22, 0.07, Rv * 0.5, hm, { y: 0.24, z: -0.13, parent: head });
    for (const s of [-1, 1]) rbx(0.05, 0.14, 0.26, 0.01, hm, { x: s * 0.155, y: 0.26, z: -0.01, parent: head });
    rbx(0.3, 0.06, 0.06, 0.01, hm, { y: 0.3, z: 0.14, parent: head });
  } else if (o.role === "elder") { for (const s of [-1, 1]) rbx(0.04, 0.1, 0.2, 0.01, hm, { x: s * 0.16, y: 0.2, z: -0.04, parent: head }); }
  if (hair === "long") { // falls behind the shoulders, never under the chin
    rbx(0.34, 0.3, 0.08, Rv * 0.5, hm, { y: 0.17, z: -0.15, parent: head });
    if (o.role !== "kid") rbx(0.4, 0.18, 0.07, Rv * 0.5, hm, { y: 0.49, z: -0.17, parent: spine });
  }
  if (hair === "ponytail") { rbx(0.12, 0.3, 0.1, Rv, hm, { y: 0.12, z: -0.2, parent: head }); bx(0.13, 0.05, 0.11, solid(o.tieColor), { y: 0.26, z: -0.2, parent: head }); }
  if (hair === "bun") rbx(0.16, 0.14, 0.16, 0.04, hm, { y: 0.44, z: -0.04, parent: head });
  // behind the face plane (z 0.16) and above the eyes: the deeper 0.42 box at z -0.03 stuck out over the face (2026-11-04)
  if (hair === "afro") rbx(0.44, 0.3, 0.38, 0.02, hm, { y: 0.37, z: -0.06, parent: head });
  if (hair === "spiky") for (const [sx, sz] of [[-0.08, 0.05], [0.06, -0.03], [0, 0.1], [0.1, 0.08]]) bx(0.08, 0.12, 0.08, hm, { x: sx, y: 0.41, z: sz, rz: sx * 3, parent: head });
  const hatMat = cloth(o.hatColor, "cotton"), hatY = hair === "afro" ? 0.12 : 0;
  if (o.hat === "cap") { rbx(0.33, 0.12, 0.33, Rv, hatMat, { y: 0.37 + hatY, parent: head }); bx(0.3, 0.025, 0.16, hatMat, { y: 0.32 + hatY, z: o.capBack ? -0.22 : 0.22, parent: head }); }
  if (o.hat === "beanie") { rbx(0.34, 0.16, 0.34, Rv + 0.02, hatMat, { y: 0.38 + hatY, parent: head }); bx(0.35, 0.05, 0.35, solid(darker(o.hatColor, 0.8)), { y: 0.31 + hatY, parent: head }); }
  if (o.hat === "bucket") { rbx(0.3, 0.14, 0.3, Rv, hatMat, { y: 0.39 + hatY, parent: head }); bx(0.46, 0.025, 0.46, hatMat, { y: 0.32 + hatY, parent: head }); }
  if (o.acc.includes("headphones")) { bx(0.36, 0.035, 0.07, solid("#202024", { roughness: 0.3 }), { y: 0.39, parent: head }); for (const s of [-1, 1]) rbx(0.06, 0.12, 0.11, 0.02, solid(o.phonesColor, { roughness: 0.3 }), { x: s * 0.175, y: 0.17, parent: head }); }

  if (baby) { for (let i = 0; i < 2; i++) { hip[i].scale.set(1.25, 0.6, 1.25); sh[i].scale.set(1.2, 0.68, 1.2); } } // short, chubby limbs

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.userData = {
    kind: "person", id: spec.id, name: spec.name, role: o.role, look: o, scale: role.scale, stoop: role.stoop ?? 0, baby,
    height: box.max.y, // metres, rest pose (root at the origin)
    joints: { rig, pelvis, spine, head, face, sh, el, hand, hip, knee, skirt, finger, handAcc },
    expr: "neutral", faceVariant: "base", held: null, heldName: null, heldCache: new Map(),
  };
  setFace(root, "neutral");
  posePerson(root, "stand", 0);
  if (baby) { root.updateMatrixWorld(true); root.userData.height = new THREE.Box3().setFromObject(root).max.y; } // sitting
  return root;
}

export const personHeight = (person) => person.userData.height;

// ---------- faces ----------
function applyFace(person) {
  const u = person.userData;
  u.joints.face.material = faceMaterial(u.expr, u.faceVariant, u.look);
}
/** swaps the face sticker (cached per expression + person look) */
export function setFace(person, expr) {
  const u = person.userData;
  if (expr === u.expr && u.faceSet) return; // called every frame by the engine: nothing to do
  u.faceSet = true;
  u.expr = EXPRS.includes(expr) ? expr : "neutral";
  faceMaterial(u.expr, "blink", u.look); faceMaterial(u.expr, "talk", u.look); // warm the variants (no hitch later)
  applyFace(person);
}

// ---------- poses ----------
const TAU = Math.PI * 2;
const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const vert = (h, k) => LT * Math.cos(h) + LS * Math.cos(h + k);

function rest(j, stoop) {
  j.rig.position.set(0, 0, 0); j.rig.rotation.set(0, 0, 0);
  j.pelvis.rotation.set(0, 0, 0);
  j.spine.rotation.set(stoop, 0, 0);
  j.head.rotation.set(-stoop * 0.7, 0, 0);
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    j.sh[i].rotation.set(stoop * 0.3, 0, s * 0.06); j.el[i].rotation.set(-0.15, 0, 0); j.hand[i].rotation.set(0, 0, 0);
    j.hip[i].rotation.set(0, 0, 0); j.knee[i].rotation.set(0, 0, 0);
  }
  if (j.skirt) j.skirt.rotation.set(0, 0, 0);
  j.finger.visible = false;
  for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = true;
}

/**
 * Sets every joint for `pose` at shot-local time t (seconds). Deterministic, allocation-free after the first call
 * with a given prop. opts: { hold: prop name | null, seat: seat height in metres (sit, default 0.45),
 * bed: surface height in metres (sleep, default 0) }.
 */
export function posePerson(person, pose, t = 0, opts = {}) {
  const u = person.userData, j = u.joints, st = u.stoop, s0 = u.scale;
  const tt = t + u.look.phase;
  rest(j, pose === "sleep" ? 0 : st);
  const { sh, el, hip, knee, spine, head, rig, hand } = j;
  let plant = true, talking = false, eyesShut = false;
  const held = ensureHeld(person, opts.hold ?? null);
  const oneHand = !!held && SMALL.has(held.userData.kind);
  const breathe = Math.sin(TAU * tt / 3.6);

  switch (pose) {
    case "walk": case "run": {
      const run = pose === "run";
      const ph = TAU * (run ? 1.6 : 1.0) * tt, sn = Math.sin(ph), cs = Math.cos(ph);
      const amp = run ? 0.78 : 0.42;
      hip[1].rotation.x = -amp * sn; hip[0].rotation.x = amp * sn;
      knee[1].rotation.x = (run ? 0.3 : 0.06) + (run ? 1.25 : 0.75) * Math.pow(clamp01(cs), 1.4);
      knee[0].rotation.x = (run ? 0.3 : 0.06) + (run ? 1.25 : 0.75) * Math.pow(clamp01(-cs), 1.4);
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        sh[i].rotation.x = -hip[i].rotation.x * (run ? 1.1 : 0.85) + st * 0.3;
        sh[i].rotation.z = s * (run ? 0.12 : 0.07);
        el[i].rotation.x = run ? -1.45 : -0.25 - 0.3 * clamp01(-sh[i].rotation.x * 2);
      }
      spine.rotation.x += run ? 0.2 : 0.03; spine.rotation.y = (run ? 0.1 : 0.06) * sn;
      head.rotation.y = -(run ? 0.08 : 0.05) * sn; head.rotation.x += run ? -0.14 : 0;
      if (run) rig.position.y += 0.05 * Math.abs(cs);
      if (j.skirt) j.skirt.rotation.x = -0.25 * Math.abs(sn);
      break;
    }
    case "point": {
      sh[0].rotation.set(-1.52, 0.05, 0.02); el[0].rotation.set(-0.05, 0, 0);
      hand[0].rotation.set(0, 0, 0); j.finger.visible = !opts.hold;
      spine.rotation.y = 0.16; head.rotation.y = -0.08;
      sh[1].rotation.x += 0.05 * breathe;
      break;
    }
    case "scared": {
      const tr = 0.03 * Math.sin(TAU * 11 * tt) + 0.015 * Math.sin(TAU * 7.3 * tt);
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        hip[i].rotation.x = -0.55; knee[i].rotation.x = 0.95; hip[i].rotation.z = s * 0.06;
        sh[i].rotation.set(-0.95 + tr, 0, s * 0.12); el[i].rotation.set(-1.35, 0, -s * 0.15); hand[i].rotation.set(-0.3, 0, s * 0.3);
      }
      spine.rotation.x = -0.24 + tr * 0.5; spine.rotation.z = tr;
      head.rotation.x = 0.12; head.rotation.z = -tr;
      rig.position.z = -0.04;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "sit": {
      plant = false;
      const seat = opts.seat ?? 0.45;
      for (let i = 0; i < 2; i++) {
        hip[i].rotation.x = -1.45; knee[i].rotation.x = 1.45;
        sh[i].rotation.x = -0.32 + st * 0.3; el[i].rotation.x = -0.95;
      }
      // thigh underside (at the hip) rests on the seat (0.02 cushion sink); thighs reach forward 0.42 so the knees
      // sit over the root
      rig.position.y = seat / s0 + 0.09 - 0.9;
      rig.position.z = -0.38;
      spine.rotation.x += 0.012 * breathe;
      if (j.skirt) j.skirt.rotation.x = -1.3;
      break;
    }
    case "carry": {
      if (oneHand) { // a small prop held up in front in the right hand, the left arm relaxed
        sh[0].rotation.set(-0.78, 0, 0.18); el[0].rotation.set(-1.12, 0, 0); hand[0].rotation.set(0, 0, 0);
        sh[1].rotation.x += 0.04 * breathe;
      } else for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        sh[i].rotation.set(-0.62, 0, -s * 0.22); el[i].rotation.set(-1.0, 0, 0); hand[i].rotation.set(0, 0, -s * 0.2);
      }
      spine.rotation.x += -0.05 + 0.01 * breathe;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "wave": {
      const w = Math.sin(TAU * 2.0 * tt);
      sh[0].rotation.set(-0.15, 0, -2.45); el[0].rotation.set(0, 0, -0.45 - 0.42 * w);
      spine.rotation.z = 0.04; head.rotation.z = -0.06 + 0.03 * w;
      sh[1].rotation.x += 0.04 * breathe;
      break;
    }
    case "look_up": {
      head.rotation.x = -0.62 + 0.02 * breathe; spine.rotation.x = -0.14;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; sh[i].rotation.set(0.12, 0, s * 0.12); el[i].rotation.x = -0.25; }
      break;
    }
    case "talk": {
      talking = true;
      const g1 = Math.sin(TAU * 0.9 * tt), g2 = Math.sin(TAU * 1.7 * tt + 1);
      sh[0].rotation.set(-0.42 + 0.14 * g1, 0, -0.1); el[0].rotation.set(-1.15 + 0.3 * g2, 0, 0); hand[0].rotation.set(0, 0.4 * g2, 0);
      sh[1].rotation.set(-0.18 + 0.06 * g2, 0, 0.12); el[1].rotation.set(-0.55 + 0.15 * g1, 0, 0);
      head.rotation.x += 0.05 * Math.sin(TAU * 1.3 * tt); head.rotation.y = 0.1 * Math.sin(TAU * 0.4 * tt);
      spine.rotation.y = 0.05 * g1;
      break;
    }
    case "sleep": {
      plant = false; eyesShut = true;
      rig.rotation.x = -Math.PI / 2;
      rig.position.y = 0.135 + (opts.bed ?? 0) / s0;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; sh[i].rotation.set(0, 0, s * 0.12); el[i].rotation.x = -0.1; hip[i].rotation.z = s * 0.04; }
      head.rotation.y = 0.35; spine.rotation.x = 0.015 * Math.sin(TAU * tt / 4.5);
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "cheer": {
      const ph = TAU * 2.0 * tt, up = clamp01(Math.sin(ph));
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        sh[i].rotation.set(-0.2, 0, s * (2.55 + 0.2 * Math.sin(ph + 0.6))); el[i].rotation.set(0, 0, s * 0.25);
        hip[i].rotation.x = -0.3 * (1 - up); knee[i].rotation.x = 0.6 * (1 - up);
      }
      rig.position.y += 0.09 * up; head.rotation.x = -0.15;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "yell": { // a scream: leaning in, arms down and back, fists, chin up
      const tr = 0.015 * Math.sin(TAU * 13 * tt);
      spine.rotation.x += 0.3; head.rotation.x = -0.42 + tr;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        sh[i].rotation.set(0.6 + tr, 0, s * 0.24); el[i].rotation.set(-0.2, 0, 0); hand[i].rotation.set(0.3, 0, 0);
        hip[i].rotation.set(-0.12, 0, s * 0.07); knee[i].rotation.x = 0.28;
      }
      rig.position.z = -0.03;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "sneeze": { // "ah-" (head back) for 0.38 s, then the head snaps forward, a hand at the face (shot-local t)
      const k1 = clamp01(t / 0.38), snap = clamp01((t - 0.38) / 0.07), rec = clamp01((t - 0.8) / 0.7);
      const hx = -0.36 * k1 * (1 - snap) + snap * (0.5 - 0.3 * rec);
      spine.rotation.x += -0.12 * k1 * (1 - snap) + snap * (0.4 - 0.22 * rec);
      head.rotation.x = hx;
      for (let i = 0; i < 2; i++) { hip[i].rotation.x = -0.22 * snap * (1 - rec * 0.6); knee[i].rotation.x = 0.42 * snap * (1 - rec * 0.6); }
      armTo(j, 0, faceTarget(j, -0.06, 0.03, 0.24, Math.round(hx / 0.04) * 0.04), clamp01(t / 0.25)); // hand at the mouth (the eyes stay visible)
      sh[1].rotation.set(0.2 * snap, 0, 0.2 + 0.15 * snap); el[1].rotation.x = -0.3;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "blow": { // the held prop at the mouth (holdProp puts it there), the right hand under it, chest puffed
      spine.rotation.x += -0.06 + 0.01 * breathe; head.rotation.x = -0.12;
      armTo(j, 0, faceTarget(j, -0.15, -0.04, 0.27, -0.12), 1); // the hand under / beside the whistle, never over it
      sh[1].rotation.z = 0.08;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "cover_mouth": { // standing, both hands over the mouth (opts.hands below does the arms)
      spine.rotation.x += 0.012 * breathe; head.rotation.x = 0.04;
      break;
    }
    default: { // stand: a subtle breathing idle
      spine.rotation.x += 0.012 * breathe;
      head.rotation.y = 0.06 * Math.sin(TAU * tt / 7.3); head.rotation.x += 0.02 * Math.sin(TAU * tt / 5.1);
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; sh[i].rotation.z = s * (0.06 + 0.012 * breathe); }
    }
  }
  // both hands over the mouth (pose cover_mouth, or opts.hands = "mouth" with any pose, e.g. sitting in the bleachers)
  if (pose === "cover_mouth" || opts.hands === "mouth") {
    const hx = Math.round(head.rotation.x / 0.04) * 0.04;
    armTo(j, 0, faceTarget(j, -0.03, 0.075, 0.225, hx), 1);
    armTo(j, 1, faceTarget(j, 0.05, 0.085, 0.29, hx), 1);
    for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
  }
  // a baby sits on the floor (legs out in front, splayed) whatever the pose; the upper body keeps the pose
  if (u.baby && pose !== "sleep") {
    plant = false;
    for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; hip[i].rotation.set(-1.45, 0, s * 0.3); knee[i].rotation.set(0.12, 0, 0); }
    rig.position.y = -0.9 + 0.14; rig.position.z = 0;
  }
  // plant the lowest foot on the floor (bent knees lower the body)
  if (plant) rig.position.y += Math.max(vert(hip[0].rotation.x, knee[0].rotation.x), vert(hip[1].rotation.x, knee[1].rotation.x)) - LEG;

  // face: blinks every few seconds, mouth flaps while talking, eyes shut while asleep; sneeze = "ah-" then "CHOO";
  // blow = puffed cheeks; yell never blinks
  const noBlink = u.expr === "sleepy" || u.expr === "cry" || u.expr === "yell" || u.expr === "sneeze" || pose === "sneeze" || pose === "blow";
  const blink = eyesShut || (!noBlink && (tt % 3.7) < 0.12);
  const mouth = talking && (Math.sin(TAU * 5.2 * tt) + 0.6 * Math.sin(TAU * 3.1 * tt)) > 0.15;
  let variant = blink ? "blink" : mouth ? "talk" : "base";
  if (pose === "blow") variant = "blow";
  else if (pose === "sneeze" || u.expr === "sneeze") variant = pose === "sneeze" ? (t < 0.38 ? "talk" : "base") : "base";
  if (variant !== u.faceVariant) { u.faceVariant = variant; applyFace(person); }

  holdProp(person, pose, oneHand);
}

// ---------- a tiny arm solver (hand to a point in spine space), cached ----------
// Spine-space point on the face: head origin + Rx(head pitch) * (dx, fy, fz) * head scale (face plane at z 0.151;
// the mouth is ~y 0.078, the nose ~0.11 in head units).
const _ft = new THREE.Vector3();
function faceTarget(j, dx, fy, fz, pitch) {
  const hs = j.head.scale.x, c = Math.cos(pitch), s = Math.sin(pitch);
  const y = fy * hs, z = fz * hs;
  return _ft.set(dx * hs, j.head.position.y + y * c - z * s, y * s + z * c);
}
const IK = new Map();
/** sets shoulder (x, z) and elbow (x) of arm i so the hand reaches `target` (spine space); blend 0..1 from rest */
function armTo(j, i, target, blend = 1) {
  const S = j.sh[i].position, sc = j.sh[i].scale, side = i ? 1 : -1;
  const key = `${i}|${S.x.toFixed(3)}|${S.y.toFixed(3)}|${sc.y.toFixed(2)}|${target.x.toFixed(2)},${target.y.toFixed(2)},${target.z.toFixed(2)}`;
  let sol = IK.get(key);
  if (!sol) {
    const U = 0.3 * sc.y, F = 0.33 * sc.y, tx = target.x - S.x, ty = target.y - S.y, tz = target.z - S.z;
    const cost = (ax, az, ex) => {
      // hand = Rx(ax) * Rz(az) * (0, -U - F cos ex, -F sin ex); elbow = Rx(ax) * Rz(az) * (0, -U, 0)
      const ly = -U - F * Math.cos(ex), lz = -F * Math.sin(ex);
      const sz = Math.sin(az), cz = Math.cos(az), sx = Math.sin(ax), cx = Math.cos(ax);
      const hx = -ly * sz, hy0 = ly * cz, hy = hy0 * cx - lz * sx, hz = hy0 * sx + lz * cx;
      const ey = -U * cz * cx, ex2 = U * sz;
      let c = (hx - tx) ** 2 + (hy - ty) ** 2 + (hz - tz) ** 2;
      if (ey > -0.05) c += (ey + 0.05) ** 2 * 0.5;           // elbow below the shoulder
      if (side * ex2 < -0.12) c += (side * ex2 + 0.12) ** 2;   // elbow not across the body
      return c + 0.0004 * az * az;
    };
    let best = [0, 0, 0], bc = Infinity;
    for (let ax = -3.1; ax <= 0.8; ax += 0.1) for (let az = -1.6; az <= 1.6; az += 0.1) for (let ex = -2.7; ex <= 0; ex += 0.1) { const c = cost(ax, az, ex); if (c < bc) { bc = c; best = [ax, az, ex]; } }
    const [a0, z0, e0] = best;
    for (let ax = a0 - 0.1; ax <= a0 + 0.1; ax += 0.02) for (let az = z0 - 0.1; az <= z0 + 0.1; az += 0.02) for (let ex = Math.max(-2.8, e0 - 0.1); ex <= Math.min(0, e0 + 0.1); ex += 0.02) { const c = cost(ax, az, ex); if (c < bc) { bc = c; best = [ax, az, ex]; } }
    sol = best; IK.set(key, sol);
  }
  const b = blend, r = 1 - b;
  j.sh[i].rotation.set(j.sh[i].rotation.x * r + sol[0] * b, 0, j.sh[i].rotation.z * r + sol[1] * b);
  j.el[i].rotation.set(j.el[i].rotation.x * r + sol[2] * b, 0, 0);
  j.hand[i].rotation.set(0, 0, 0);
}

/** arm i (0 = right, 1 = left) reaches a point in the person's spine space (x right-left, y up, z front); call after
 *  posePerson. Solutions are cached per target (rounded to 1 cm), so keep animated targets on a coarse grid. */
export function reach(person, i, target, blend = 1) { armTo(person.userData.joints, i, target, blend); }

/**
 * Puts `person` (a baby, or any small person) in the carrier's arms: re-parents it to the carrier's spine at the
 * midpoint of the hands, facing the carrier's front. Pose the carrier first ("carry", hold null), then call this, then
 * pose the carried person (a baby's "stand" sits it on the forearms). releasePerson(person, parent) undoes it.
 */
export function holdPerson(carrier, person) {
  const j = carrier.userData.joints;
  if (person.parent !== j.spine) j.spine.add(person);
  for (let i = 0; i < 2; i++) {
    j.sh[i].updateMatrix(); j.el[i].updateMatrix(); j.hand[i].updateMatrix();
    m1.multiplyMatrices(j.sh[i].matrix, j.el[i].matrix); m2.multiplyMatrices(m1, j.hand[i].matrix);
    (i ? v2 : v1).setFromMatrixPosition(m2);
  }
  // on the carrier's left forearm, a little low and to the side, so both faces stay visible
  person.position.addVectors(v1, v2).multiplyScalar(0.5);
  person.position.x += 0.2; person.position.y -= 0.16; person.position.z += 0.02;
  person.rotation.set(0, 0.35, 0);
  person.scale.setScalar(person.userData.scale / carrier.userData.scale);
  person.visible = true;
  person.userData.carriedBy = carrier.userData.id ?? true;
}
export function releasePerson(person, parent) {
  if (!person.userData.carriedBy) return;
  parent.add(person);
  person.scale.setScalar(person.userData.scale);
  person.userData.carriedBy = null;
}

const SMALL = new Set(["sock", "key", "phone", "candle", "cup", "ball", "bread", "book", "paper", "flashlight", "whistle", "camera", "tissues", "string", ...SMALL_HELD]);
function ensureHeld(person, name) {
  const u = person.userData;
  if (name !== u.heldName) {
    if (u.held) u.held.removeFromParent();
    u.held = null; u.heldName = name;
    if (name) {
      let h = u.heldCache.get(name);
      if (!h) { h = makeHeld(name); if (h) { h.scale.setScalar(1 / u.scale); h.traverse((m) => { if (m.isMesh && m.name !== "beam") m.castShadow = true; }); u.heldCache.set(name, h); } }
      u.held = h ?? null;
    }
  }
  return u.held;
}
function holdProp(person, pose, oneHand) {
  const u = person.userData, j = u.joints;
  const h = u.held; if (!h) return;
  h.scale.setScalar(1 / u.scale);
  if (pose === "blow") { // at the mouth, pointing out of it (props: a whistle's origin is its mouthpiece tip)
    if (h.parent !== j.head) j.head.add(h);
    const hs = j.head.scale.x; h.scale.setScalar(1.35 / (u.scale * hs)); // a touch bigger, so it reads at the mouth
    h.position.set(0, 0.075, 0.148); h.rotation.set(0.1, 0, 0);
    if (h.userData.kind !== "whistle") { h.position.z += 0.06; h.rotation.set(Math.PI / 2, 0, 0); }
  } else if (pose === "carry" && oneHand) {
    if (h.parent !== j.hand[0]) j.hand[0].add(h);
    h.position.set(0, -0.08, 0.02); h.rotation.set(1.9, 0, -0.18); // upright in front of the chest
  } else if (pose === "carry") {
    if (h.parent !== j.spine) j.spine.add(h);
    // the midpoint between the two hands, in spine space
    for (let i = 0; i < 2; i++) {
      j.sh[i].updateMatrix(); j.el[i].updateMatrix(); j.hand[i].updateMatrix();
      m1.multiplyMatrices(j.sh[i].matrix, j.el[i].matrix); m2.multiplyMatrices(m1, j.hand[i].matrix);
      (i ? v2 : v1).setFromMatrixPosition(m2);
    }
    h.position.addVectors(v1, v2).multiplyScalar(0.5); h.position.z += 0.04;
    h.rotation.set(0, 0, 0);
  } else {
    if (h.parent !== j.hand[0]) j.hand[0].add(h);
    if (pose === "point") { h.position.set(0, -0.07, 0.0); h.rotation.set(Math.PI / 2, 0, 0); } // front along the arm
    else { h.position.set(0, -0.06, 0.03); h.rotation.set(0, 0, 0); }
  }
}
