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
import { rng, hashSeed, cloth, fabric, skinMat, solid, darker, rbx, bx, addMesh, cachedGeo, cachedMat } from "./kitCommon.js";
import { EXPRS as FACE_EXPRS, faceMaterial } from "./faces.js";
import { makeHeld } from "./props.js";
import { SMALL_HELD } from "./heldMore.js";

// 2026-11-04 (OBJECTS agent): yell (lean forward, arms down and back, mouth wide), sneeze (wind-up "ah-" then the head
// snaps forward at t = 0.4 s, hand to the face), blow (the held prop, e.g. "whistle", at the mouth, cheeks puffed),
// cover_mouth (both hands over the mouth; also opts.hands = "mouth" on any pose, e.g. sit). Role "baby": ~0.55 m sitting,
// a big round head, a onesie, a tuft of hair; every pose except sleep sits on the floor (the upper body follows the
// pose). In a crib: put the baby at the crib's spot and raise its root by the crib's userData.bedH (the engine does).
// Carried: holdPerson(carrier, baby) after posing the carrier with pose "carry" and hold null.
// 2026-11-05 (GAPS agent): the actions the real stress run asked for most (lib/director ACTION_WORDS), each a motion
// over t that reads at phone size, some with their own small prop so the action is clear on any set:
//   hug (arms round the partner; the engine puts a hugging pair face to face, opts.partnerH bends to a shorter one),
//   climb (up a short ladder, rising ~0.35 m/s, best seen side-on), push (leaning in, arms straight, driving legs),
//   eat (food to the mouth, chewing; a sandwich when nothing is held), fall (a stumble, then down on the bottom at 0.6 s),
//   jump (crouch, leap ~0.45 m, land; 0.9 s cycle), ride (astride a mount: opts.seat = the saddle height, the engine
//   finds the mount), hide (crouched small, peeking left and right), throw (wind-up, release at 0.62 of a 1.4 s cycle,
//   the held thing flies off in an arc; a ball when nothing is held), fly (superhero: ~1 m up, body level, one fist
//   ahead), swim (front crawl in a patch of water), build (kneeling, hammering, a wall of blocks growing), dig (a
//   shovel, a hole and a growing dirt pile), dance (alternating arms, hips and knees on the beat), kick (one leg snaps
//   out), fight (fists up, jabs), drive (seated at a steering wheel)
export const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow", "cover_mouth",
  "hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"];
/** how high a pose lifts the person off the floor (metres, roughly, mid-shot): the engine frames the camera on it */
export const POSE_LIFT = Object.freeze({ fly: 1.0, climb: 0.55, jump: 0.15 });
/** how the engine frames a person doing an action on a medium / close-up: [vertical span, centre height] x the
 *  person's height, so the whole action (the ladder, the water, the wall of blocks, a kick) is in frame */
export const POSE_FRAME = Object.freeze({ hug: [1.9, 0.5], climb: [2.1, 0.75], push: [2.0, 0.45], fall: [1.9, 0.3], jump: [2.2, 0.55], hide: [1.6, 0.3],
  throw: [2.2, 0.55], fly: [2.4, 0.7], swim: [2.4, 0.15], build: [1.9, 0.35], dig: [2.0, 0.45], dance: [2.1, 0.5], kick: [2.0, 0.45], drive: [2.0, 0.5], ride: [2.4, 0.6] });
/** the hand prop a pose uses when the person holds nothing */
export const POSE_TOOL = Object.freeze({ eat: "sandwich", throw: "ball", dig: "shovel" });
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

/** spec.gender "f" | "m" (planner): a woman never gets a beard and reads as one (longer hair / bun, a skirt or dress
 *  half the time); a man never gets a ponytail, bun, skirt or dress. Its own rng, so nothing else about the look moves. */
export function genderLook(o, gender, seed, kid = false, elder = false) {
  if (gender !== "f" && gender !== "m") return o;
  const R = rng(seed * 104729 + 5);
  if (gender === "f") {
    o.beard = null;
    if (!["long", "ponytail", "bun"].includes(o.hair)) o.hair = elder ? (R() < 0.6 ? "bun" : "long") : R.pick(kid ? ["ponytail", "long", "bun"] : ["long", "ponytail", "bun"]);
    if (!kid && o.bottom === "shorts") o.bottom = "pants";
    if (!["skirt", "dress"].includes(o.bottom) && R() < 0.5) o.bottom = R() < 0.5 ? "skirt" : "dress";
    if (o.bottom === "dress" && o.pattern === "pinstripe") o.pattern = "cotton";
    o.acc = o.acc.filter((x) => x !== "tie" && x !== "briefcase");
  } else {
    if (["ponytail", "bun"].includes(o.hair) || (o.hair === "long" && R() < 0.7)) o.hair = elder ? (R() < 0.5 ? "bald" : "short") : "short";
    if (["skirt", "dress"].includes(o.bottom)) o.bottom = "pants";
  }
  return o;
}

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
  genderLook(o, spec.gender, seed, kid, elder);
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
  j.rig.rotation.order = "XYZ";
}

// ---------- pose props: the small things an action brings with it (a ladder, water, a dirt pile, blocks, a hammer...) ----------
// Built once per person on first use, in metres (a holder under the root with scale 1 / root scale), hidden otherwise.
const WOOD = () => solid("#a8743f", { roughness: 0.75 });
function poseProps(person) {
  const u = person.userData;
  if (u.poseProps) return u.poseProps;
  const holder = new THREE.Group(); holder.name = "poseProps"; holder.scale.setScalar(1 / u.scale); person.add(holder);
  const P = { holder };
  // a ladder 2.6 m high in front of the person (+z), leaning back a little
  P.ladder = new THREE.Group(); holder.add(P.ladder); P.ladder.position.set(0, 0, 0.36); P.ladder.rotation.x = -0.08;
  for (const s of [-1, 1]) rbx(0.06, 2.6, 0.06, 0.01, WOOD(), { x: s * 0.24, y: 1.3, parent: P.ladder });
  for (let k = 0; k < 8; k++) bx(0.5, 0.045, 0.05, WOOD(), { y: 0.25 + k * 0.32, parent: P.ladder });
  // a patch of water around a swimmer (translucent blue, two ripple rings)
  P.water = new THREE.Group(); holder.add(P.water);
  const wm = cachedMat("poseWater", () => new THREE.MeshStandardMaterial({ color: "#3fa7e0", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78 }));
  const disc = addMesh(cachedGeo("poseWaterDisc", () => new THREE.CylinderGeometry(1.25, 1.25, 0.05, 32)), wm, { y: 0.2, parent: P.water, shadow: false }); disc.scale.set(1.35, 1, 0.75); disc.receiveShadow = true;
  const rim = cachedMat("poseFoam", () => new THREE.MeshStandardMaterial({ color: "#e8f7ff", roughness: 0.4, transparent: true, opacity: 0.85 }));
  P.ripples = [0, 1].map(() => addMesh(cachedGeo("poseRipple", () => new THREE.TorusGeometry(0.5, 0.025, 6, 32)), rim, { y: 0.23, rx: Math.PI / 2, parent: P.water, shadow: false }));
  // digging: a hole in front, a dirt pile beside it
  P.dirt = new THREE.Group(); holder.add(P.dirt);
  addMesh(cachedGeo("poseHole", () => new THREE.CylinderGeometry(0.34, 0.34, 0.02, 20)), solid("#2a1b12", { roughness: 0.95 }), { y: 0.012, z: 0.62, parent: P.dirt, shadow: false });
  P.pile = rbx(0.6, 0.34, 0.5, 0.12, solid("#6b4528", { roughness: 0.95 }), { x: 0.62, y: 0.0, z: 0.5, parent: P.dirt });
  // building: a wall of bricks appearing in front of the builder
  P.blocks = new THREE.Group(); holder.add(P.blocks);
  const BR = ["#d35400", "#e67e22", "#c0392b", "#f1c40f", "#2e86de", "#16a085"];
  P.bricks = [];
  for (let k = 0; k < 9; k++) P.bricks.push(rbx(0.3, 0.16, 0.18, 0.02, solid(BR[k % BR.length], { roughness: 0.7 }), { x: -0.33 + (k % 3) * 0.32 + (Math.floor(k / 3) % 2) * 0.08, y: 0.08 + Math.floor(k / 3) * 0.165, z: 0.62, parent: P.blocks }));
  // driving: a seat block and a steering wheel on a post
  P.cart = new THREE.Group(); holder.add(P.cart);
  // a little go-kart round the seat: a red body, four fat wheels, a bumper
  rbx(0.78, 0.22, 1.5, 0.06, solid("#e74c3c", { roughness: 0.45 }), { y: 0.2, z: 0.15, parent: P.cart });
  rbx(0.82, 0.1, 0.12, 0.03, solid("#dfe4ea", { metalness: 0.5, roughness: 0.3 }), { y: 0.2, z: 0.92, parent: P.cart });
  for (const [x, z] of [[-0.45, 0.65], [0.45, 0.65], [-0.45, -0.4], [0.45, -0.4]]) addMesh(cachedGeo("poseKartWheel", () => new THREE.CylinderGeometry(0.17, 0.17, 0.14, 16)), solid("#1e1e24", { roughness: 0.8 }), { x, y: 0.17, z, rz: Math.PI / 2, parent: P.cart });
  rbx(0.5, 0.3, 0.45, 0.06, solid("#2d3436", { roughness: 0.6 }), { y: 0.42, z: -0.12, parent: P.cart });
  rbx(0.08, 0.6, 0.08, 0.02, solid("#57606f"), { y: 0.5, z: 0.42, rx: -0.4, parent: P.cart });
  P.wheel = addMesh(cachedGeo("poseWheel", () => new THREE.TorusGeometry(0.17, 0.03, 8, 24)), solid("#1e1e24", { roughness: 0.5 }), { y: 0.86, z: 0.33, rx: -0.9, parent: P.cart });
  // a hammer in the right hand (handle along the hand's -y, the head across)
  P.hammer = new THREE.Group();
  rbx(0.035, 0.3, 0.035, 0.01, WOOD(), { y: -0.1, parent: P.hammer });
  rbx(0.16, 0.06, 0.06, 0.01, solid("#7f8c8d", { metalness: 0.6, roughness: 0.35 }), { y: -0.24, parent: P.hammer });
  P.hammer.scale.setScalar(1 / u.scale);
  for (const k of ["ladder", "water", "dirt", "blocks", "cart", "hammer"]) P[k].visible = false;
  for (const g of [P.ladder, P.dirt, P.blocks, P.cart, P.hammer]) g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  u.poseProps = P;
  return P;
}
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

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
  let plant = true, talking = false, eyesShut = false, lift = 0;
  if (u.poseProps) { const P = u.poseProps; for (const k of ["ladder", "water", "dirt", "blocks", "cart", "hammer"]) P[k].visible = false; }
  const held = ensureHeld(person, opts.hold ?? (u.baby ? null : POSE_TOOL[pose] ?? null));
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
    // ---------------- 2026-11-05 (GAPS): the actions
    case "hug": { // arms round the partner's back, a slow side-to-side squeeze, the cheek turned (opts.partnerH: metres)
      const ratio = (opts.partnerH ?? 0) > 0 ? opts.partnerH / Math.max(0.3, u.height * s0) : 1;
      const low = ratio < 0.8, high = ratio > 1.25;
      const sway = Math.sin(TAU * 0.45 * tt);
      spine.rotation.x += low ? 0.42 : 0.12; spine.rotation.z = 0.05 * sway; head.rotation.x = low ? 0.25 : -0.05; head.rotation.z = 0.12;
      const hy = low ? 0.1 : high ? 0.38 : 0.26, hz = low ? 0.34 : 0.3;
      armTo(j, 0, v1.set(0.1, hy, hz), 1); armTo(j, 1, v2.set(-0.09, hy + 0.05, hz - 0.03), 1);
      if (low) for (let i = 0; i < 2; i++) { hip[i].rotation.x = -0.3; knee[i].rotation.x = 0.55; }
      if (oneHand) { sh[0].rotation.set(-0.9, 0, 0.25); el[0].rotation.set(-1.25, 0, 0); } // a small thing (a pet, a toy) hugged to the chest
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "climb": { // up a ladder in front: hands on the rungs, a leg stepping up, rising (best side-on)
      plant = false;
      const P = poseProps(person); P.ladder.visible = true;
      const rise = Math.min(1.25, 0.35 * t + 0.15);
      const ph = TAU * 0.9 * tt, a = Math.sin(ph);
      armTo(j, 0, v1.set(-0.16, 0.92 + 0.12 * a, 0.3), 1); armTo(j, 1, v2.set(0.16, 0.92 - 0.12 * a, 0.3), 1);
      hip[0].rotation.x = -0.75 - 0.45 * a; knee[0].rotation.x = 0.9 + 0.6 * a;
      hip[1].rotation.x = -0.75 + 0.45 * a; knee[1].rotation.x = 0.9 - 0.6 * a;
      spine.rotation.x += 0.08; head.rotation.x = -0.2;
      rig.position.z = -0.06;
      rig.position.y = rise / s0 + Math.max(vert(hip[0].rotation.x, knee[0].rotation.x), vert(hip[1].rotation.x, knee[1].rotation.x)) - LEG;
      P.ladder.position.y = 0; P.ladder.position.z = 0.36;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "push": { // leaning hard into something in front, arms straight, legs driving in short steps
      const ph = TAU * 0.8 * tt, a = Math.sin(ph);
      rig.rotation.x = 0.32; spine.rotation.x += 0.12; head.rotation.x = -0.35;
      armTo(j, 0, v1.set(-0.17, 0.4, 0.6), 1); armTo(j, 1, v2.set(0.17, 0.4, 0.6), 1);
      hip[0].rotation.x = 0.45 + 0.25 * a; knee[0].rotation.x = 0.25 + 0.2 * Math.max(0, a);
      hip[1].rotation.x = -0.35 + 0.25 * a; knee[1].rotation.x = 0.55 + 0.2 * Math.max(0, -a);
      rig.position.z = -0.12; rig.position.y += 0.02 * Math.abs(a);
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "eat": { // the food up to the mouth, a bite, chewing, down a little; again (1.7 s)
      const per = 1.7, c = tt % per;
      const up = c < 0.35 ? smooth(c / 0.35) : c < 1.1 ? 1 : 1 - smooth((c - 1.1) / 0.45);
      talking = c > 0.35 && c < 1.15;
      head.rotation.x = 0.08 * up;
      armTo(j, 0, faceTarget(j, -0.02, 0.06, 0.32, 0.08), 0.35 + 0.65 * up);
      sh[1].rotation.set(-0.35, 0, 0.12); el[1].rotation.x = -0.9;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "fall": { // shot-local: a stumble back (arms up), down on the bottom at ~0.6 s, a small bounce, then sitting stunned
      const k1 = smooth(t / 0.3), k2 = smooth((t - 0.25) / 0.35);
      const bounce = t > 0.6 ? 0.05 * Math.exp(-(t - 0.6) / 0.12) * Math.sin((t - 0.6) * 28) : 0;
      if (k2 <= 0) {
        rig.rotation.x = -0.35 * k1;
        for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; sh[i].rotation.set(-1.4 * k1, 0, s * (0.06 + 1.1 * k1)); el[i].rotation.x = -0.5 * k1; }
        hip[1].rotation.x = -0.7 * k1; knee[1].rotation.x = 0.4 * k1;
      } else {
        plant = false;
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1;
          hip[i].rotation.set(-1.45 * k2 - 0.7 * (1 - k2) * (i ? 1 : 0), 0, s * 0.18 * k2); knee[i].rotation.x = 0.15 + 0.25 * (1 - k2);
          sh[i].rotation.set(-1.4 * (1 - k2) + 0.75 * k2, 0, s * (1.16 * (1 - k2) + 0.32 * k2)); el[i].rotation.x = -0.5 * (1 - k2) - 0.1 * k2;
        }
        spine.rotation.x = -0.28 * k2 + bounce; head.rotation.x = 0.18 * k2;
        rig.rotation.x = -0.35 * (1 - k2);
        rig.position.y = -0.78 * k2 + bounce * 0.3; rig.position.z = 0.05 * k2;
      }
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "jump": { // crouch, leap (arms up), land: a 0.9 s cycle
      const per = 0.9, c = (tt % per) / per;
      // most of the cycle in the air (a short crouch to launch and to land)
      const air = c > 0.15 && c < 0.85 ? Math.sin(((c - 0.15) / 0.7) * Math.PI) : 0;
      const crouch = c <= 0.15 ? Math.sin((c / 0.15) * Math.PI * 0.5 + Math.PI * 0.5) : c >= 0.85 ? Math.sin(((c - 0.85) / 0.15) * Math.PI * 0.5) : 0;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        hip[i].rotation.x = -0.75 * crouch - 0.25 * air; knee[i].rotation.x = 1.3 * crouch + 0.4 * air;
        sh[i].rotation.set(0.5 * crouch - 0.3 * air, 0, s * (0.15 + 2.3 * air)); el[i].rotation.x = -0.3 - 0.2 * air;
      }
      spine.rotation.x += 0.3 * crouch; head.rotation.x = -0.2 * air;
      lift = 0.5 * air;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "ride": { // astride a mount (opts.seat: the saddle's height in metres), reins in front, a trot bounce
      plant = false;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; hip[i].rotation.set(-1.3, 0, s * 0.42); knee[i].rotation.x = 1.5; }
      armTo(j, 0, v1.set(-0.12, 0.12, 0.42), 1); armTo(j, 1, v2.set(0.12, 0.12, 0.42), 1);
      const trot = Math.abs(Math.sin(TAU * 1.6 * tt));
      rig.position.y = (opts.seat ?? 0.9) / s0 + 0.09 - 0.9 + 0.04 * trot; rig.position.z = -0.32;
      spine.rotation.x += 0.08 + 0.03 * trot; head.rotation.x = -0.08;
      if (j.skirt) j.skirt.rotation.x = -1.2;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "hide": { // crouched small, arms round the knees, the head peeking left, then right
      plant = false;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; hip[i].rotation.set(-2.0, 0, s * 0.12); knee[i].rotation.x = 2.35; }
      spine.rotation.x += 0.42;
      armTo(j, 0, v1.set(-0.1, -0.12, 0.42), 1); armTo(j, 1, v2.set(0.1, -0.12, 0.42), 1);
      const pk = Math.sin(TAU * 0.3 * tt), hold = Math.sign(pk) * Math.min(1, Math.abs(pk) * 1.6);
      head.rotation.set(-0.35, 0.55 * hold, 0.08 * hold);
      rig.position.y = vert(hip[0].rotation.x, knee[0].rotation.x) - LEG;
      rig.position.z = -0.12;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "throw": { // overarm: wind-up, release at 0.62 of the 1.4 s cycle, follow-through; the thing flies off
      const per = 1.4, c = (tt % per) / per;
      const wind = c < 0.5 ? smooth(c / 0.5) : 1 - smooth((c - 0.5) / 0.12);
      const fwd = c < 0.5 ? 0 : c < 0.75 ? smooth((c - 0.5) / 0.15) : 1 - smooth((c - 0.75) / 0.25);
      sh[0].rotation.set(0.5 * wind - 1.5 * fwd, 0, -(2.3 * wind + 0.3 * fwd)); el[0].rotation.x = -1.4 * wind - 0.2 * fwd;
      sh[1].rotation.set(-1.3 * wind - 0.3 * fwd, 0, 0.25); el[1].rotation.x = -0.2;
      spine.rotation.y = -0.45 * wind + 0.35 * fwd; spine.rotation.x += -0.12 * wind + 0.28 * fwd; head.rotation.y = 0.3 * wind - 0.2 * fwd;
      hip[1].rotation.x = -0.4 * fwd; knee[1].rotation.x = 0.2 * fwd; hip[0].rotation.x = 0.3 * fwd;
      // the thing: in the hand until the release, then flying out in an arc (in the person's own frame, metres)
      u.throwFly = held && c >= 0.62 ? (c - 0.62) / 0.38 : -1;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "fly": { // body level ~1 m up, one fist ahead, legs trailing, a slow bob (best side-on)
      plant = false;
      rig.rotation.x = 1.2; head.rotation.x = -1.0; spine.rotation.x = -0.05;
      sh[0].rotation.set(-2.95, 0, -0.1); el[0].rotation.x = -0.05;
      sh[1].rotation.set(0.25, 0, 0.15); el[1].rotation.x = -0.15;
      const fl = Math.sin(TAU * 1.2 * tt);
      hip[0].rotation.x = 0.06 * fl; hip[1].rotation.x = -0.06 * fl; knee[0].rotation.x = 0.12; knee[1].rotation.x = 0.2;
      rig.position.y = (1.0 + 0.08 * Math.sin(TAU * 0.5 * tt)) / s0; rig.position.z = -0.85;
      if (j.skirt) j.skirt.rotation.x = 0.3;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "swim": { // front crawl at the surface of a patch of water: arms windmill, legs flutter, a breath to the side
      plant = false;
      const P = poseProps(person); P.water.visible = true;
      const ph = TAU * 0.8 * tt;
      rig.rotation.x = 1.42; head.rotation.x = -0.75; head.rotation.y = 0.45 * Math.max(0, Math.sin(ph));
      sh[0].rotation.set(-ph % TAU, 0, -0.18); sh[1].rotation.set(-(ph + Math.PI) % TAU, 0, 0.18);
      el[0].rotation.x = -0.25; el[1].rotation.x = -0.25;
      const fk = Math.sin(TAU * 2.4 * tt);
      hip[0].rotation.x = 0.2 * fk; hip[1].rotation.x = -0.2 * fk; knee[0].rotation.x = 0.15; knee[1].rotation.x = 0.15;
      rig.position.y = 0.2 / s0 + 0.02 * Math.sin(ph); rig.position.z = -0.85;
      for (const [i, r] of P.ripples.entries()) { const k = ((t * 0.6 + i * 0.5) % 1); r.scale.setScalar(0.6 + 1.6 * k); r.material.opacity = 0.85 * (1 - k); }
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "build": { // kneeling on one knee, hammering (0.6 s), the wall of blocks in front growing
      plant = false;
      const P = poseProps(person); P.blocks.visible = true; P.hammer.visible = true;
      if (P.hammer.parent !== hand[0]) hand[0].add(P.hammer);
      P.hammer.position.set(0, -0.04, 0.04); P.hammer.rotation.set(1.45, 0, 0);
      hip[1].rotation.x = -1.55; knee[1].rotation.x = 1.55;          // the left foot planted, knee up
      hip[0].rotation.x = 0.1; knee[0].rotation.x = 1.62;            // the right knee on the ground
      rig.position.y = vert(hip[1].rotation.x, knee[1].rotation.x) - LEG; rig.position.z = -0.1;
      const c = (tt % 0.6) / 0.6, hit = c < 0.55 ? smooth(c / 0.55) : 1 - smooth((c - 0.55) / 0.45);
      sh[0].rotation.set(-0.6 - 1.4 * (1 - hit), 0, -0.12); el[0].rotation.x = -0.9 - 0.5 * (1 - hit);
      armTo(j, 1, v2.set(0.12, -0.05, 0.42), 1);
      spine.rotation.x += 0.32; head.rotation.x = 0.35;
      const n = Math.min(P.bricks.length, 2 + Math.floor(t / 0.7));
      P.bricks.forEach((b, k) => { b.visible = k < n; });
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "dig": { // a shovel: push in, lift, toss to the pile (1.5 s); a hole in front, the pile growing
      const P = poseProps(person); P.dirt.visible = true;
      const c = (tt % 1.5) / 1.5;
      const down = c < 0.4 ? smooth(c / 0.4) : 1 - smooth((c - 0.4) / 0.35);
      const toss = c > 0.6 ? Math.sin(((c - 0.6) / 0.4) * Math.PI) : 0;
      spine.rotation.x += 0.25 + 0.4 * down; spine.rotation.y = 0.35 * toss; head.rotation.x = 0.3;
      armTo(j, 0, v1.set(-0.05, 0.05 - 0.25 * down, 0.4), 1); armTo(j, 1, v2.set(0.08, 0.28 - 0.25 * down, 0.36), 1);
      hip[0].rotation.x = -0.35 * down; knee[0].rotation.x = 0.6 * down; hip[1].rotation.x = 0.15; knee[1].rotation.x = 0.25 * down;
      P.pile.scale.set(1, 0.6 + Math.min(1.2, t * 0.25), 1);
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "dance": { // on the beat (0.5 s): one arm up, then the other, hips swaying, knees bouncing
      const b = TAU * tt, sw = Math.sin(b), bob = Math.abs(Math.sin(b * 2));
      const L = clamp01(0.5 + sw * 1.5), Rr = 1 - L;
      sh[0].rotation.set(-0.3, 0, -(0.3 + 2.3 * L)); el[0].rotation.set(0, 0, -0.5 * L);
      sh[1].rotation.set(-0.3, 0, 0.3 + 2.3 * Rr); el[1].rotation.set(0, 0, 0.5 * Rr);
      for (let i = 0; i < 2; i++) { hip[i].rotation.x = -0.25 * bob; knee[i].rotation.x = 0.5 * bob; }
      rig.position.x = 0.07 * sw; spine.rotation.z = -0.12 * sw; head.rotation.z = 0.1 * sw; j.pelvis.rotation.z = 0.08 * sw;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "kick": { // the right leg snaps forward (1.2 s), arms out for balance
      const c = (tt % 1.2) / 1.2, k = c < 0.35 ? smooth(c / 0.35) * 0.35 : c < 0.5 ? 0.35 + 0.65 * smooth((c - 0.35) / 0.15) : 1 - smooth((c - 0.5) / 0.4);
      hip[0].rotation.x = -0.2 - 1.15 * k; knee[0].rotation.x = 1.3 * (1 - k) * (k > 0.05 ? 1 : 0) + 0.1;
      hip[1].rotation.x = 0.1 * k; knee[1].rotation.x = 0.15;
      spine.rotation.x += -0.2 * k;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; sh[i].rotation.set(-0.3, 0, s * (0.6 + 0.4 * k)); el[i].rotation.x = -0.3; }
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "fight": { // fists up by the chin, a jab with one, then the other, a bounce on the toes
      const c = (tt % 0.9) / 0.9, ja = c < 0.3 ? Math.sin((c / 0.3) * Math.PI) : 0, jb = c >= 0.5 && c < 0.8 ? Math.sin(((c - 0.5) / 0.3) * Math.PI) : 0;
      armTo(j, 0, v1.set(-0.1, 0.48, 0.3), 1 - ja * 0.0); if (ja > 0) armTo(j, 0, v1.set(-0.08, 0.5, 0.66), ja);
      armTo(j, 1, v2.set(0.1, 0.48, 0.3), 1); if (jb > 0) armTo(j, 1, v2.set(0.08, 0.5, 0.66), jb);
      spine.rotation.y = 0.25 * (ja - jb); spine.rotation.x += 0.1; head.rotation.x = 0.08;
      hip[0].rotation.x = 0.25; knee[0].rotation.x = 0.35; hip[1].rotation.x = -0.2; knee[1].rotation.x = 0.3;
      lift = 0.03 * Math.abs(Math.sin(TAU * 2.2 * tt));
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
      break;
    }
    case "drive": { // seated at a steering wheel (its own seat), turning it a little
      plant = false;
      const P = poseProps(person); P.cart.visible = true;
      const seat = 0.57;
      for (let i = 0; i < 2; i++) { hip[i].rotation.x = -1.45; knee[i].rotation.x = 1.45; }
      rig.position.y = seat / s0 + 0.09 - 0.9; rig.position.z = -0.38;
      const steer = 0.25 * Math.sin(TAU * 0.4 * tt);
      armTo(j, 0, v1.set(-0.17 + 0.03 * steer, 0.26 - 0.06 * steer, 0.5), 1); armTo(j, 1, v2.set(0.17 + 0.03 * steer, 0.26 + 0.06 * steer, 0.5), 1);
      P.wheel.rotation.z = -steer;
      if (j.skirt) j.skirt.rotation.x = -1.3;
      for (let q = 0; q < j.handAcc.length; q++) j.handAcc[q].visible = false;
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
  if (lift) rig.position.y += lift / s0;
  if (pose !== "throw") u.throwFly = -1;
  // the engine turns a hugger's face a little toward the lens (opts.headYaw, radians)
  if (opts.headYaw) head.rotation.y += opts.headYaw;

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
  } else if (pose === "throw" && u.throwFly >= 0) { // flying off in an arc, in the person's own frame (metres)
    const P = poseProps(person), k = u.throwFly, H = u.height;
    if (h.parent !== P.holder) P.holder.add(h);
    h.scale.setScalar(1.2);
    h.position.set(-0.18 + 0.1 * k, H * 0.95 + 1.1 * k - 2.2 * k * k, 0.35 + 4.2 * k); h.rotation.set(9 * k, 0, 0);
  } else if (pose === "dig") { // the shovel in the right hand, blade down in front
    if (h.parent !== j.hand[0]) j.hand[0].add(h);
    h.position.set(0, -0.04, 0.02); h.rotation.set(0.35, 0, 0);
  } else if (pose === "eat") { // the food at the fingers, toward the mouth
    if (h.parent !== j.hand[0]) j.hand[0].add(h);
    h.position.set(0, -0.09, 0.04); h.rotation.set(1.2, 0, 0);
  } else if ((pose === "carry" || pose === "hug") && oneHand) {
    if (h.parent !== j.hand[0]) j.hand[0].add(h);
    h.position.set(0, -0.08, 0.02); h.rotation.set(1.9, 0, -0.18); // upright in front of the chest
  } else if (pose === "carry" || pose === "hug") {
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
