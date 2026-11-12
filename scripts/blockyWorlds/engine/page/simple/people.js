// Blocky Worlds SIMPLE LOOK people (production, owner 2026-11-10): the approved test's classic 6-block avatar (head,
// torso, 2 arms, 2 legs: single boxes, no elbows / knees, solid colours, chunky hair) as the engine's people kit, with
// the same API as page/kit/people.js (CONTRACT.md): POSES, EXPRS, POSE_LIFT, POSE_FRAME, makePerson, posePerson,
// setFace, personHeight, holdPerson, releasePerson, heldFaceOverlap, gripOrder.
// - Looks: the cast's look (lib/worldBible.js -> tl.cast[id].look; page/kit/people.js lookFor seeds the rest): skin, top,
//   pants, shoes, hair kind + colour, hat; patterns are dropped (solid colours).
// - COSTUMES (owner's list): costumeOf(look, role) from the bible's outfit (look.outfit) or look.costume: knight (armour
//   plates + cape + open helmet), scientist (lab coat + pens in a pocket), robe (wizard: + pointed hat; elder / royal /
//   mayor), apron (baker / cook: + chef hat), uniform (police / guard / postal: cap + a badge shape, clothing, no text).
//   Plain clothes stay the default.
// - Poses: page/kit/people.js posePerson drives the same joints (every pose, held props, grips, babies), then the limbs
//   are made straight (the elbow folded into the shoulder, the knee dropped) and the feet re-planted; scared / cheer /
//   wave / point / talk use the approved test's simple poses (hands beside the head, never in front of the face).
//   opts.blendFrom = { pose, t, k } blends from another pose (pose changes on words: ~0.25 s, the engine sets k).
// - Faces: the 15 decals + blink (page/simple/faces.js); faces swap (no blend) when setFace is called with a new name.
import * as THREE from "three";
import * as BASE from "/page/kit/people.js";
import { SIMPLE, mat, box, rbox, ball, cyl, canvasTex } from "./common.js";
import { faceTexture, simpleFaceOf, SIMPLE_FACES } from "./faces.js";
import { FACE_NAMES } from "/lib/expressions.js";

export const POSES = BASE.POSES;
export const POSE_LIFT = BASE.POSE_LIFT;
export const POSE_FRAME = BASE.POSE_FRAME;
export const POSE_TOOL = BASE.POSE_TOOL;
export const EXPRS = [...new Set([...BASE.EXPRS, ...FACE_NAMES, ...SIMPLE_FACES])];
export const holdPerson = BASE.holdPerson;
export const releasePerson = BASE.releasePerson;
export const heldFaceOverlap = BASE.heldFaceOverlap;
export const gripOrder = BASE.gripOrder;

const U = SIMPLE.U; // rig units per avatar unit
// the rig (the same pivots page/kit/people.js poses): pelvis at 0.9 (= the legs' length), spine 0.17 above it
const HIP_Y = 0.9, SPINE_Y = 0.17, SPINE_W = HIP_Y + SPINE_Y;
const SH_Y = 3.85 * U - SPINE_W, HEAD_Y = 4.05 * U - SPINE_W, TORSO_C = 3 * U - SPINE_W;
const LEG_LEN = 0.9, SHOE_H = 0.144, ARM_LEN = 1.6 * U;
const TOP_H = 4.05 * U + 1.2 * U + 0.2; // the rest height with hair, rig units
const METRES = { kid: 1.36, adult: 1.8, elder: 1.72, baby: 0.62 };

// ------------------------------------------------------------------------------------------------ costumes
export const COSTUMES = Object.freeze(["plain", "knight", "scientist", "robe", "apron", "uniform"]);
const OUTFIT_COSTUME = { knight: "knight", scientist: "scientist", doctor: "scientist", wizard: "robe", royal: "robe", mayor: "robe", baker: "apron", chef: "apron", police: "uniform", mail: "uniform", firefighter: "uniform", grandpa: "robe", grandma: "robe" };
/** the costume for a cast look (bible look.outfit / look.costume) -> { kind, variant } */
export function costumeOf(look = {}, role = "adult") {
  const c = look.costume ?? OUTFIT_COSTUME[look.outfit] ?? null;
  if (!c || !COSTUMES.includes(c) || c === "plain" || role === "baby") return { kind: "plain", variant: null };
  if (c === "robe" && !look.costume && (look.outfit === "grandpa" || look.outfit === "grandma") && role === "kid") return { kind: "plain", variant: null }; // an elder's robe never on a kid
  const v = look.costumeVariant ?? (look.outfit === "wizard" ? "wizard" : look.outfit === "chef" || look.outfit === "baker" ? "chef" : look.outfit === "mail" ? "postal" : look.outfit === "firefighter" ? "fire" : look.outfit === "police" ? "police" : look.outfit === "royal" ? "royal" : look.outfit === "mayor" ? "mayor" : look.outfit === "grandpa" || look.outfit === "grandma" ? "elder" : null);
  return { kind: c, variant: v };
}
// the simple hair families for the hair kit's kinds (page/kit/outfitsData.js HAIR_STYLES)
const HAIR_FAMILY = { short: "fringe", sidePart: "fringe", messy: "fringe", quiff: "spiky", slicked: "slick", curtains: "fringe", bowl: "fringe", buzz: "buzz",
  spiky: "spiky", mohawk: "spiky", afro: "afro", curly: "afro", bob: "bob", wavyBob: "bob", long: "long", bangs: "long", braids: "long",
  ponytail: "ponytail", pigtails: "buns", bun: "bun", topknot: "bun", receding: "buzz", bald: "bald", tuft: "tuft" };

function solidOf(c, fallback) { try { return `#${new THREE.Color(c ?? fallback).getHexString()}`; } catch { return fallback; } }

/** a person from a cast entry { id, role, name, seed, look?, gender? } (origin at the feet, faces +z) */
export function makePerson(spec = {}) {
  const look = BASE.lookFor(spec), role = ["kid", "adult", "elder", "baby"].includes(look.role) ? look.role : "adult";
  const cos = costumeOf(look, role);
  const root = new THREE.Group(); root.name = `person:${spec.id ?? spec.name ?? "x"}`;
  const headK = role === "kid" ? 1.12 : role === "baby" ? 1.35 : 1;
  const scale = +(METRES[role] / (TOP_H + (headK - 1) * 1.2 * U)).toFixed(4);
  root.scale.setScalar(scale);
  const rig = new THREE.Group(); root.add(rig);
  const skinC = solidOf(look.skin, "#f5c89a");
  const C = {
    shirt: solidOf(look.top === "skin" ? look.skin : look.top, "#ff8a1f"),
    pants: solidOf(look.bottom === "dress" ? look.top : look.pants, "#2f4ea3"),
    shoes: solidOf(look.shoes === "skin" ? look.skin : look.shoes, "#2b2b33"),
    hair: solidOf(look.hairColor, "#6b3d1f"),
  };
  // a kid never has grey / white hair (an elder outfit's colour can reach a kid through the bible)
  if (role === "kid") { const hsl = {}; new THREE.Color(C.hair).getHSL(hsl); if (hsl.s < 0.18 && hsl.l > 0.45) C.hair = "#6b3d1f"; }
  if (cos.kind === "uniform") Object.assign(C, cos.variant === "postal" ? { shirt: "#5b9bd5", pants: "#1f3a6e" } : cos.variant === "fire" ? { shirt: "#c0392b", pants: "#2d3436" } : { shirt: "#24407a", pants: "#1b2440" }, { shoes: "#1e1e24" });
  if (cos.kind === "knight") Object.assign(C, { shirt: "#8b939c", pants: "#6f7780", shoes: "#4d5660" });
  const sig = look.signature && /^#[0-9a-f]{6}$/i.test(String(look.signature.color)) ? look.signature : null; // THE HERO (lib/simpleStory.js heroSignature)
  if (sig) Object.assign(C, { shirt: sig.color, pants: "#2f3b66", shoes: "#ffffff" });
  const shirt = mat(C.shirt, { rough: 0.55 }), pants = mat(C.pants, { rough: 0.6 }), skin = mat(skinC, { rough: 0.5 }), shoe = mat(C.shoes, { rough: 0.5 }), hair = mat(C.hair, { rough: 0.6 });
  const r = 0.035 * (U / 0.34);

  const pelvis = new THREE.Group(); pelvis.position.y = HIP_Y; rig.add(pelvis);
  const hip = [], knee = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const h = new THREE.Group(); h.position.set(s * 0.5 * U, 0, 0); pelvis.add(h);
    rbox(h, [0.98 * U, LEG_LEN - SHOE_H + 0.01, 0.98 * U], [0, -(LEG_LEN - SHOE_H) / 2 + 0.005, 0], pants, r);
    rbox(h, [1.0 * U, SHOE_H, 1.04 * U], [0, -LEG_LEN + SHOE_H / 2, 0.02 * U], shoe, r);
    const k = new THREE.Group(); k.position.y = -0.42; h.add(k); // the base rig's knee pivot: no geometry (straight legs)
    hip[i] = h; knee[i] = k;
  }
  const spine = new THREE.Group(); spine.position.y = SPINE_Y; pelvis.add(spine);
  rbox(spine, [2 * U, 2 * U, 1 * U], [0, TORSO_C, 0], shirt, r);
  const FZ = 0.5 * U;
  const sh = [], el = [], hand = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.Group(); a.position.set(s * 1.5 * U, SH_Y, 0); spine.add(a);
    rbox(a, [0.98 * U, 1.45 * U, 0.98 * U], [0, -0.62 * U, 0], shirt, r);
    rbox(a, [0.94 * U, 0.55 * U, 0.94 * U], [0, -1.6 * U, 0], skin, r);
    const e = new THREE.Group(); e.position.y = -ARM_LEN / 2; a.add(e);
    const hd = new THREE.Group(); hd.position.y = -ARM_LEN / 2; e.add(hd);
    sh[i] = a; el[i] = e; hand[i] = hd;
  }
  const finger = rbox(hand[0], [0.3 * U, 0.5 * U, 0.3 * U], [0, -0.35 * U, 0.2 * U], skin, 0.02); finger.visible = false;

  // the head: the classic rounded block, the face decal on its front
  const head = new THREE.Group(); head.position.y = HEAD_Y; head.scale.setScalar(headK); spine.add(head);
  rbox(head, [1.25 * U, 1.2 * U, 1.2 * U], [0, 0.62 * U, 0], skin, 0.08 * U);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture("neutral", false), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.12 * U, 1.12 * U), faceMat); face.position.set(0, 0.6 * U, 0.603 * U); face.renderOrder = 2; head.add(face);
  face.castShadow = false; face.receiveShadow = true;

  const fam = role === "baby" ? (look.hair === "bald" ? "bald" : "tuft") : HAIR_FAMILY[look.hair] ?? "fringe";
  const hat = cos.kind === "knight" ? "helmet" : cos.kind === "uniform" ? (cos.variant === "fire" ? "fireHelmet" : "peaked") : cos.kind === "apron" ? "chefhat" : cos.kind === "robe" && cos.variant === "wizard" ? "wizard" : ["cap", "beanie", "bucket"].includes(look.hat) ? "cap" : null;
  buildHair(head, fam, hair, { underHat: !!hat, elder: role === "elder" });
  if (hat) buildHat(head, hat, look);

  const joints = { rig, pelvis, spine, head, face: { material: null, isDummy: true }, sh, el, hand, hip, knee, skirt: null, finger, handAcc: [], flaps: [], cape: null };
  dressCostume({ spine, pelvis, sh, hip, head, joints }, cos, look, C);
  if (sig) dressSignature({ spine, sh, head }, sig, C);
  if (role === "baby") { for (let i = 0; i < 2; i++) { hip[i].scale.set(1.05, 0.55, 1.05); sh[i].scale.set(1, 0.7, 1); } }

  root.traverse((o) => { if (o.isMesh && o !== face) { o.castShadow = true; o.receiveShadow = true; } });
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root);
  root.userData = {
    kind: "person", id: spec.id, name: spec.name, role, look, scale, stoop: role === "elder" ? 0.06 : 0, baby: role === "baby",
    height: bb.max.y, joints, costume: cos, simple: true, faceMesh: face, faceMat,
    expr: "neutral", faceVariant: "base", faceFrom: "neutral", faceAt: null, faceBlend: {}, faceSet: true, held: null, heldName: null, heldCache: new Map(),
    sface: "neutral", sblink: false,
  };
  posePerson(root, "stand", 0);
  if (role === "baby") { root.updateMatrixWorld(true); root.userData.height = new THREE.Box3().setFromObject(root).max.y; }
  return root;
}

// ------------------------------------------------------------------------------------------------ hair + hats (head units: the head block is 1.25U x 1.2U x 1.2U, y 0.02U .. 1.22U)
function buildHair(head, fam, hair, { underHat = false, elder = false } = {}) {
  const top = (h = 0.42) => { if (!underHat) rbox(head, [1.4 * U, h * U, 1.36 * U], [0, (1.11 + h / 2) * U, -0.02 * U], hair, 0.06 * U); };
  const back = (h = 1.0, y = 0.9) => rbox(head, [1.4 * U, h * U, 0.3 * U], [0, y * U, -0.58 * U], hair, 0.05 * U);
  const sides = (h = 0.7, y = 0.98) => { for (const s of [-1, 1]) rbox(head, [0.22 * U, h * U, 1.1 * U], [s * 0.66 * U, y * U, -0.06 * U], hair, 0.04 * U); };
  const fringe = () => { if (!underHat) for (const [x, w, h] of [[-0.45, 0.5, 0.24], [0.02, 0.55, 0.18], [0.46, 0.46, 0.27]]) rbox(head, [w * U, h * U, 0.3 * U], [x * U, (1.24 - h / 2) * U, 0.56 * U], hair, 0.05 * U); };
  switch (fam) {
    case "bald": if (elder) sides(0.45, 0.85); break;
    case "tuft": rbox(head, [0.35 * U, 0.3 * U, 0.35 * U], [0, 1.3 * U, 0.1 * U], hair, 0.08 * U); break;
    case "buzz": top(0.16); back(0.7, 0.9); sides(0.5, 0.9); break;
    case "slick": top(0.3); back(1.0); sides(0.6); break;
    case "spiky": top(0.3); back(); sides(); if (!underHat) for (const [x, z, rz, rx] of [[-0.45, 0.2, 0.35, 0.2], [0, 0.25, 0, 0.3], [0.45, 0.2, -0.35, 0.2], [-0.25, -0.3, 0.2, -0.3], [0.25, -0.3, -0.2, -0.3]]) { const t = rbox(head, [0.42 * U, 0.55 * U, 0.42 * U], [x * U, 1.55 * U, z * U], hair, 0.04 * U); t.rotation.set(rx, 0, rz); } break;
    case "afro": if (!underHat) rbox(head, [1.75 * U, 0.95 * U, 1.7 * U], [0, 1.35 * U, -0.1 * U], hair, 0.3 * U); back(1.1, 0.85); sides(0.8, 0.95); break;
    case "bob": top(); back(1.25, 0.72); for (const s of [-1, 1]) rbox(head, [0.26 * U, 1.0 * U, 1.2 * U], [s * 0.68 * U, 0.8 * U, -0.04 * U], hair, 0.05 * U); fringe(); break;
    case "long": top(); back(1.9, 0.4); for (const s of [-1, 1]) rbox(head, [0.26 * U, 1.35 * U, 1.0 * U], [s * 0.68 * U, 0.62 * U, -0.1 * U], hair, 0.05 * U); fringe(); break;
    case "ponytail": top(); back(); sides(); fringe(); rbox(head, [0.45 * U, 1.1 * U, 0.4 * U], [0, 0.75 * U, -0.85 * U], hair, 0.12 * U); break;
    case "buns": top(0.36); back(1.05, 0.85); rbox(head, [1.3 * U, 0.22 * U, 0.3 * U], [0, 1.12 * U, 0.56 * U], hair, 0.04 * U); if (!underHat) for (const s of [-1, 1]) rbox(head, [0.7 * U, 0.7 * U, 0.7 * U], [s * 0.52 * U, 1.72 * U, -0.15 * U], hair, 0.12 * U); sides(0.75, 0.95); break;
    case "bun": top(); back(); sides(); fringe(); if (!underHat) rbox(head, [0.7 * U, 0.6 * U, 0.7 * U], [0, 1.65 * U, -0.25 * U], hair, 0.14 * U); break;
    default: // fringe (the approved Pip): a cap of hair, the back, side locks, a fringe above the brows, chunky tufts
      top(); back(); sides(); fringe();
      if (!underHat) for (const [x, z, rz] of [[-0.3, 0.1, 0.4], [0.25, -0.2, -0.3], [0.05, 0.35, 0.1]]) { const t = rbox(head, [0.5 * U, 0.4 * U, 0.5 * U], [x * U, 1.55 * U, z * U], hair, 0.05 * U); t.rotation.z = rz; }
  }
}
function buildHat(head, kind, look) {
  const m = (c, r = 0.55) => mat(c, { rough: r });
  switch (kind) {
    case "cap": { const c = solidOf(look.hatColor, "#ffd23a"); rbox(head, [1.42 * U, 0.5 * U, 1.38 * U], [0, 1.36 * U, -0.02 * U], m(c), 0.08 * U); rbox(head, [1.3 * U, 0.12 * U, 0.7 * U], [0, 1.16 * U, 0.85 * U], m(c), 0.04 * U); rbox(head, [0.3 * U, 0.16 * U, 0.3 * U], [0, 1.66 * U, 0], m("#e04848"), 0.05 * U); break; }
    case "peaked": { // police / guard / postal cap: crown, dark band, a shiny peak, a small gold badge shape on the front
      const c = look.outfit === "mail" ? "#1f3a6e" : "#1b2440";
      rbox(head, [1.5 * U, 0.42 * U, 1.46 * U], [0, 1.42 * U, -0.02 * U], m(c), 0.06 * U);
      rbox(head, [1.38 * U, 0.2 * U, 1.36 * U], [0, 1.2 * U, -0.02 * U], m("#111318"), 0.04 * U);
      rbox(head, [1.28 * U, 0.1 * U, 0.6 * U], [0, 1.12 * U, 0.84 * U], m("#111318", 0.3), 0.03 * U);
      box(head, [0.36 * U, 0.3 * U, 0.06 * U], [0, 1.4 * U, 0.72 * U], mat("#f2c230", { rough: 0.35 }), { cast: false });
      break;
    }
    case "fireHelmet": rbox(head, [1.6 * U, 0.6 * U, 1.6 * U], [0, 1.42 * U, -0.05 * U], m("#d63031", 0.45), 0.25 * U); rbox(head, [1.9 * U, 0.1 * U, 1.9 * U], [0, 1.16 * U, -0.1 * U], m("#d63031", 0.45), 0.04 * U); box(head, [0.4 * U, 0.36 * U, 0.06 * U], [0, 1.45 * U, 0.82 * U], mat("#f2c230", { rough: 0.35 }), { cast: false }); break;
    case "chefhat": rbox(head, [1.36 * U, 0.3 * U, 1.32 * U], [0, 1.28 * U, -0.02 * U], m("#ffffff", 0.7), 0.06 * U); ball(head, 0.62 * U, [0, 1.75 * U, -0.02 * U], m("#ffffff", 0.7), { sy: 0.8 }); break;
    case "wizard": { // a pointed hat with a wide brim (our own simple shape)
      const c = solidOf(look.top, "#4b3fb8");
      rbox(head, [1.9 * U, 0.12 * U, 1.9 * U], [0, 1.2 * U, -0.02 * U], m(c), 0.04 * U);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.72 * U, 1.7 * U, 4), m(c)); cone.rotation.y = Math.PI / 4; cone.position.set(0, 2.08 * U, -0.02 * U); cone.castShadow = true; head.add(cone);
      box(head, [1.45 * U, 0.2 * U, 1.45 * U], [0, 1.33 * U, -0.02 * U], mat("#ffd23a", { rough: 0.4 }));
      break;
    }
    case "helmet": { // an open-face knight helmet: top, back and side guards, a crest; the face stays clear
      const steel = mat("#c9ced4", { rough: 0.35 });
      rbox(head, [1.5 * U, 0.42 * U, 1.46 * U], [0, 1.36 * U, -0.02 * U], steel, 0.1 * U);
      rbox(head, [1.5 * U, 1.1 * U, 0.3 * U], [0, 0.82 * U, -0.62 * U], steel, 0.05 * U);
      for (const s of [-1, 1]) rbox(head, [0.24 * U, 0.95 * U, 1.2 * U], [s * 0.72 * U, 0.85 * U, -0.04 * U], steel, 0.05 * U);
      rbox(head, [0.26 * U, 0.55 * U, 1.1 * U], [0, 1.78 * U, -0.1 * U], mat("#e23b3b", { rough: 0.6 }), 0.08 * U);
      break;
    }
    default: break;
  }
}
// ------------------------------------------------------------------------------------------------ the costume layer (2-3 extra boxes / decals each)
function badgeTex(color = "#f2c230") {
  return canvasTex(128, 128, (c, S) => { c.fillStyle = color; c.strokeStyle = "#7a5a10"; c.lineWidth = 8; c.beginPath(); c.moveTo(S / 2, 8); c.lineTo(S - 14, S * 0.28); c.lineTo(S - 22, S * 0.72); c.lineTo(S / 2, S - 8); c.lineTo(22, S * 0.72); c.lineTo(14, S * 0.28); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(S / 2, S * 0.48, S * 0.14, 0, 7); c.fill(); });
}
const BADGE = new Map();
function dressCostume({ spine, pelvis, sh, hip, head, joints }, cos, look, C) {
  const FZ = 0.5 * U;
  const deco = (parent, m, w, h, x, y, z = FZ + 0.004) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); parent.add(p); return p; };
  switch (cos.kind) {
    case "knight": { // armour plates (chest, shoulders) + a cape
      const steel = mat("#d3d8de", { rough: 0.35 }), trim = mat("#ffd23a", { rough: 0.4 });
      rbox(spine, [2.1 * U, 1.5 * U, 0.22 * U], [0, TORSO_C + 0.2 * U, FZ + 0.06 * U], steel, 0.06 * U);
      box(spine, [0.5 * U, 0.5 * U, 0.06 * U], [0, TORSO_C + 0.25 * U, FZ + 0.19 * U], mat("#e23b3b", { rough: 0.5 }), { cast: false });
      for (const a of sh) rbox(a, [1.15 * U, 0.55 * U, 1.15 * U], [0, 0.0 * U, 0], steel, 0.12 * U);
      rbox(spine, [2.1 * U, 0.2 * U, 1.1 * U], [0, TORSO_C - 0.9 * U, 0], trim, 0.04 * U);
      const cape = new THREE.Group(); cape.position.set(0, SH_Y + 0.1 * U, -0.55 * U); spine.add(cape);
      rbox(cape, [2.1 * U, 3.3 * U, 0.12 * U], [0, -1.65 * U, 0], mat(solidOf(look.oc?.a, "#c0392b"), { rough: 0.7 }), 0.03 * U);
      joints.cape = cape;
      break;
    }
    case "scientist": { // a white lab coat (torso shell + tails over the upper legs) + pens in a chest pocket
      const coat = mat("#f7f8fa", { rough: 0.6 });
      rbox(spine, [2.08 * U, 2.06 * U, 1.08 * U], [0, TORSO_C - 0.02 * U, 0], coat, 0.04 * U);
      box(spine, [0.5 * U, 2.0 * U, 0.04 * U], [0, TORSO_C, FZ + 0.06 * U], mat(C.shirt, { rough: 0.55 }), { cast: false }); // the shirt between the lapels
      for (const [i, s] of [[0, -1], [1, 1]]) { const f = new THREE.Group(); hip[i].add(f); rbox(f, [1.06 * U, 0.9 * U, 1.06 * U], [0, -0.42 * U, 0], coat, 0.04 * U); }
      box(spine, [0.62 * U, 0.42 * U, 0.06 * U], [0.52 * U, TORSO_C + 0.35 * U, FZ + 0.07 * U], mat("#e6e8ec", { rough: 0.6 }), { cast: false });
      for (const [x, c] of [[0.36, "#2e86de"], [0.5, "#e23b3b"], [0.64, "#1e1e24"]]) box(spine, [0.08 * U, 0.42 * U, 0.08 * U], [x * U, TORSO_C + 0.58 * U, FZ + 0.1 * U], mat(c, { rough: 0.4 }));
      break;
    }
    case "robe": { // a long robe: the torso shell + a skirt to the shins (wizard / royal: deep colours, a gold trim)
      const col = cos.variant === "royal" ? "#7a2a8a" : cos.variant === "mayor" ? "#2c3e70" : cos.variant === "wizard" ? solidOf(look.top, "#4b3fb8") : "#7a6a5a";
      const robe = mat(col, { rough: 0.7 }), trim = mat(cos.variant === "royal" || cos.variant === "wizard" ? "#ffd23a" : "#d8cfc0", { rough: 0.5 });
      rbox(spine, [2.08 * U, 2.06 * U, 1.08 * U], [0, TORSO_C - 0.02 * U, 0], robe, 0.04 * U);
      const skirt = new THREE.Group(); skirt.position.y = 0.05; pelvis.add(skirt);
      rbox(skirt, [2.2 * U, 1.55 * U, 1.25 * U], [0, -0.75 * U, 0], robe, 0.06 * U);
      box(skirt, [2.24 * U, 0.16 * U, 1.29 * U], [0, -1.5 * U, 0], trim);
      box(spine, [0.24 * U, 2.0 * U, 0.04 * U], [0, TORSO_C, FZ + 0.07 * U], trim, { cast: false });
      for (const a of sh) rbox(a, [1.12 * U, 0.4 * U, 1.12 * U], [0, -1.25 * U, 0], robe, 0.05 * U); // wide sleeve cuffs
      joints.skirt = skirt;
      break;
    }
    case "apron": { // a white apron (bib + skirt panel) with a pocket; the chef hat is the hat
      const ap = mat("#fbfbf7", { rough: 0.7 });
      box(spine, [1.5 * U, 1.3 * U, 0.06 * U], [0, TORSO_C + 0.25 * U, FZ + 0.03 * U], ap);
      for (const s of [-1, 1]) box(spine, [0.16 * U, 0.7 * U, 0.06 * U], [s * 0.62 * U, TORSO_C + 1.0 * U, FZ + 0.03 * U], ap, { cast: false });
      const panel = new THREE.Group(); panel.position.y = 0.0; pelvis.add(panel);
      box(panel, [1.9 * U, 1.3 * U, 0.06 * U], [0, -0.55 * U, FZ + 0.06 * U], ap);
      box(panel, [0.8 * U, 0.4 * U, 0.04 * U], [0, -0.55 * U, FZ + 0.1 * U], mat("#ff9fb8", { rough: 0.6 }), { cast: false });
      break;
    }
    case "uniform": { // the uniform shirt colours (makePerson) + a badge shape on the chest (clothing, no text) + a belt
      const k = cos.variant === "postal" ? "#e8eef6" : "#f2c230";
      if (!BADGE.has(k)) BADGE.set(k, new THREE.MeshStandardMaterial({ map: badgeTex(k), transparent: true, roughness: 0.35, metalness: 0.2 }));
      deco(spine, BADGE.get(k), 0.48 * U, 0.48 * U, 0.52 * U, TORSO_C + 0.45 * U, FZ + 0.006);
      box(spine, [2.04 * U, 0.22 * U, 1.04 * U], [0, TORSO_C - 0.85 * U, 0], mat("#1e1e24", { rough: 0.45 }));
      for (const s of [-1, 1]) box(spine, [0.5 * U, 0.06 * U, 0.04 * U], [s * 0.52 * U, TORSO_C + 0.2 * U, FZ + 0.03 * U], mat("#111318", { rough: 0.5 }), { cast: false }); // pocket flaps
      if (cos.variant === "postal") { const bag = new THREE.Group(); bag.position.set(0.9 * U, TORSO_C - 0.7 * U, 0.2 * U); spine.add(bag); rbox(bag, [0.5 * U, 0.8 * U, 0.9 * U], [0.3 * U, 0, 0], mat("#8a5a32", { rough: 0.6 }), 0.06 * U); }
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------------------------------------ the hero's signature
/** a hoodie in the signature colour (hood, pocket, drawstrings, ribbed cuffs + hem) + the signature item */
function dressSignature({ spine, sh, head }, sig, C) {
  const FZ = 0.5 * U, dk = new THREE.Color(sig.color).multiplyScalar(0.72), dkHex = `#${dk.getHexString()}`, rib = mat(dkHex, { rough: 0.6 });
  rbox(spine, [1.6 * U, 0.55 * U, 0.6 * U], [0, SH_Y - 0.05 * U, -0.62 * U], mat(sig.color, { rough: 0.6 }), 0.1 * U); // the hood down on the back
  rbox(spine, [1.3 * U, 0.6 * U, 0.08 * U], [0, TORSO_C - 0.45 * U, FZ + 0.03 * U], rib, 0.04 * U); // the front pocket
  for (const s of [-1, 1]) { box(spine, [0.08 * U, 0.6 * U, 0.06 * U], [s * 0.28 * U, TORSO_C + 0.6 * U, FZ + 0.04 * U], mat("#ffffff", { rough: 0.5 }), { cast: false }); box(spine, [0.14 * U, 0.14 * U, 0.08 * U], [s * 0.28 * U, TORSO_C + 0.28 * U, FZ + 0.05 * U], mat("#ffffff", { rough: 0.5 }), { cast: false }); }
  box(spine, [2.04 * U, 0.2 * U, 1.04 * U], [0, TORSO_C - 0.9 * U, 0], rib); // the ribbed hem
  for (const a of sh) box(a, [1.02 * U, 0.16 * U, 1.02 * U], [0, -1.3 * U, 0], rib); // the cuffs
  switch (sig.item) {
    case "sock": { // a striped sock pinned on the left sleeve (the story's own sock)
      const t = canvasTex(64, 128, (c, W, Hh) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#e8323f"; c.fillRect(0, (i * Hh) / 8, W, Hh / 8 + 1); } });
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
      const g = new THREE.Group(); g.position.set(0.0, -0.5 * U, 0.51 * U); sh[1].add(g); // on the front of the left sleeve
      const leg = new THREE.Mesh(BOX_GEO, m); leg.scale.set(0.42 * U, 0.7 * U, 0.07 * U); g.add(leg);
      const foot = new THREE.Mesh(BOX_GEO, m); foot.scale.set(0.6 * U, 0.26 * U, 0.07 * U); foot.position.set(0.09 * U, -0.46 * U, 0); g.add(foot);
      break;
    }
    case "scarf": rbox(spine, [2.1 * U, 0.32 * U, 1.12 * U], [0, SH_Y + 0.12 * U, 0], mat("#ffd23a", { rough: 0.7 }), 0.08 * U); box(spine, [0.36 * U, 0.9 * U, 0.1 * U], [0.45 * U, SH_Y - 0.4 * U, FZ + 0.08 * U], mat("#ffd23a", { rough: 0.7 })); break;
    case "goggles": box(head, [1.32 * U, 0.16 * U, 1.26 * U], [0, 1.16 * U, 0], mat("#2b2b33", { rough: 0.5 })); for (const s of [-1, 1]) rbox(head, [0.42 * U, 0.34 * U, 0.12 * U], [s * 0.3 * U, 1.18 * U, 0.62 * U], mat("#7fd4ff", { rough: 0.2 }), 0.06 * U); break;
    case "backpack": rbox(spine, [1.4 * U, 1.4 * U, 0.6 * U], [0, TORSO_C, -0.8 * U], mat("#ffd23a", { rough: 0.6 }), 0.1 * U); break;
    case "cap": rbox(head, [1.42 * U, 0.5 * U, 1.38 * U], [0, 1.36 * U, -0.02 * U], mat("#ffd23a", { rough: 0.55 }), 0.08 * U); rbox(head, [1.3 * U, 0.12 * U, 0.7 * U], [0, 1.16 * U, 0.85 * U], mat("#ffd23a", { rough: 0.55 }), 0.04 * U); break;
    default: { // a star badge on the chest
      const t = canvasTex(128, 128, (c, S) => { c.fillStyle = "#ffd23a"; c.strokeStyle = "#1b1b22"; c.lineWidth = 6; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r2 = i % 2 ? S * 0.2 : S * 0.45; c.lineTo(S / 2 + Math.cos(a) * r2, S / 2 + Math.sin(a) * r2); } c.closePath(); c.fill(); c.stroke(); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * U, 0.7 * U), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 })); m.position.set(0.45 * U, TORSO_C + 0.45 * U, FZ + 0.01); spine.add(m);
    }
  }
}
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);

export const personHeight = (person) => person.userData.height;

// ------------------------------------------------------------------------------------------------ faces
/** the face decal (any engine face name -> one of the 15); swaps at once (faces change on words, no blend) */
export function setFace(person, expr) {
  const u = person.userData;
  const f = simpleFaceOf(expr);
  if (f === u.sface && u.faceMat.map === faceTexture(f, u.sblink)) return;
  u.sface = f;
  u.faceMat.map = faceTexture(f, u.sblink); u.faceMat.needsUpdate = true;
}
function applyBlink(person, blink) {
  const u = person.userData;
  if (blink === u.sblink) return;
  u.sblink = blink;
  u.faceMat.map = faceTexture(u.sface, blink); u.faceMat.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ poses
const NO_PLANT = new Set(["sit", "sleep", "climb", "ride", "hide", "fly", "swim", "build", "drive", "fall"]);
const LT = 0.42, LS = 0.4875;
const baseDrop = (h, k) => { const a = h + k; return LT * Math.cos(h) + LS * Math.cos(a) + Math.max(BASE.SOLE_Z[0] * Math.sin(a), BASE.SOLE_Z[1] * Math.sin(a)); };
const myDrop = (h) => LEG_LEN * Math.cos(h) + Math.max(-0.22 * Math.sin(h), 0.25 * Math.sin(h));
const TAU = Math.PI * 2;
/** the approved test's simple poses (page/simple/simple.js): hands beside the head for scared, never over the face */
function simpleArms(j, pose, tt) {
  const [R, L] = j.sh;
  switch (pose) {
    case "scared": { const tr = 0.03 * Math.sin(TAU * 11 * tt); R.rotation.set(-0.55 + tr, 0, -2.15); L.rotation.set(-0.55 - tr, 0, 2.15); j.spine.rotation.set(-0.08, 0, 0); j.head.rotation.set(0.05, 0, 0); j.rig.position.z = 0; for (const h of j.hip) h.rotation.set(0, 0, 0); return true; }
    case "cheer": { const w = 0.18 * Math.sin(TAU * 2 * tt); R.rotation.set(-0.2, 0, -2.75 + w); L.rotation.set(-0.2, 0, 2.75 - w); j.head.rotation.x = -0.12; for (const h of j.hip) h.rotation.set(0, 0, 0); return true; }
    case "wave": { const w = Math.sin(TAU * 2 * tt); R.rotation.set(-0.15, 0, -2.65 + 0.25 * w); L.rotation.set(0, 0, 0.07); j.head.rotation.z = 0.08; return true; }
    case "point": { R.rotation.set(-1.55, 0, -0.12); L.rotation.set(0, 0, 0.07); j.head.rotation.y = -0.1; return true; }
    case "talk": { const g = Math.sin(TAU * 0.9 * tt); R.rotation.set(-0.7 + 0.15 * g, 0, -0.35); L.rotation.set(0, 0, 0.07); j.head.rotation.z = -0.05; return true; }
    default: return false;
  }
}
const JOINT_KEYS = ["rig", "pelvis", "spine", "head"];
function snapshot(j) {
  const s = [];
  for (const k of JOINT_KEYS) s.push(j[k].rotation.x, j[k].rotation.y, j[k].rotation.z, j[k].position.x, j[k].position.y, j[k].position.z);
  for (const a of [...j.sh, ...j.hip, ...j.hand]) s.push(a.rotation.x, a.rotation.y, a.rotation.z);
  return s;
}
function blendTo(j, s, k) { // joints = lerp(snapshot s, current, k)
  let i = 0;
  const L = (o, p) => { o[p] = s[i] + (o[p] - s[i]) * k; i++; };
  for (const key of JOINT_KEYS) { const o = j[key]; L(o.rotation, "x"); L(o.rotation, "y"); L(o.rotation, "z"); L(o.position, "x"); L(o.position, "y"); L(o.position, "z"); }
  for (const a of [...j.sh, ...j.hip, ...j.hand]) { L(a.rotation, "x"); L(a.rotation, "y"); L(a.rotation, "z"); }
}
function poseOnce(person, pose, t, opts) {
  const u = person.userData, j = u.joints;
  BASE.posePerson(person, pose, t, opts);
  const plant = !NO_PLANT.has(pose) && !u.baby;
  const bd = Math.max(baseDrop(j.hip[0].rotation.x, j.knee[0].rotation.x), baseDrop(j.hip[1].rotation.x, j.knee[1].rotation.x));
  // straight limbs: the elbow folds into the shoulder (the hand ends up near where the bent arm put it), the knee drops
  if (!simpleArms(j, pose, t + (u.look.phase ?? 0))) for (let i = 0; i < 2; i++) j.sh[i].rotation.x += j.el[i].rotation.x * 0.55;
  for (let i = 0; i < 2; i++) { j.el[i].rotation.set(0, 0, 0); j.knee[i].rotation.set(0, 0, 0); }
  if (plant) j.rig.position.y += Math.max(myDrop(j.hip[0].rotation.x), myDrop(j.hip[1].rotation.x)) - bd;
  else if (pose === "sit" || pose === "drive") j.rig.position.y += 0.22 - 0.19; // the thicker simple thigh on the seat
  else if (pose === "hide") { for (let i = 0; i < 2; i++) j.hip[i].rotation.x = -1.4; j.rig.position.y = -0.9 + 0.24; }
}
/**
 * Sets every joint for `pose` at shot-local time t (page/kit/people.js posePerson + straight limbs). opts as people.js,
 * plus opts.blendFrom = { pose, t, k } (k 0..1: 0 = still the old pose) and opts.blink (a forced blink).
 */
export function posePerson(person, pose, t = 0, opts = {}) {
  const u = person.userData, j = u.joints;
  const bf = opts.blendFrom;
  if (bf && bf.pose && bf.pose !== pose && bf.k < 1) {
    poseOnce(person, bf.pose, bf.t ?? t, { ...opts, blendFrom: null });
    const s = snapshot(j);
    poseOnce(person, pose, t, { ...opts, blendFrom: null });
    const k = Math.max(0, Math.min(1, bf.k)), e = k * k * (3 - 2 * k);
    blendTo(j, s, e);
  } else poseOnce(person, pose, t, opts);
  if (j.cape) j.cape.rotation.x = 0.08 + Math.max(0, j.hip[0].rotation.x, j.hip[1].rotation.x) * 0.5;
  // blink every ~3.7 s for 0.12 s (never while asleep: eyes shut)
  const tt = t + (u.look.phase ?? 0);
  const noBlink = ["sleepy", "laugh", "crying"].includes(u.sface);
  applyBlink(person, pose === "sleep" || !!opts.blink || (!noBlink && tt % 3.7 < 0.12));
}
