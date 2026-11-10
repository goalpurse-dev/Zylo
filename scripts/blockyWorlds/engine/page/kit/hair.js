// Blocky Worlds HAIR KIT + the shared body dimensions (CHARACTERS-V3, 2026-11-10; owner: "much closer to the reference's
// blocky avatar style: blocky avatar proportions (head sits on the torso, chunky limbs) ... chunky stylised HAIR on most
// characters instead of hats ... clean plastic materials"). Our own design: generic blocky-avatar proportions, chunky
// hair pieces built from rounded blocks, flat saturated plastic. No copied avatar items, no logos or names.
//
//   BODY                                the rig's numbers (people.js builds on them, crowd.js copies them)
//   toy(color, { rough, metal })       the clean plastic material (low roughness, light gloss, flat colour); PLASTIC-WORLD
//                                      ships its own helper for sets; this one matches it (roughness ~0.4, no texture)
//   buildHair(head, look, { underHat, spine, seed }) -> { kind, hb, n }
//                                      adds look.hair (HAIR_KINDS, outfitsData.js) in head units to the head group;
//                                      underHat: a hat sits on it (the top volume is left out); hb: where a head piece's
//                                      base sits (hats: 0.33; crown / bow / goggles: on top of the hair)
//   chinBeard(head, look)              the chunky chin block of a "full" beard (the rest of the facial hair is the face decal)
// Head units (people.js): the head box 0.30 x 0.32 x 0.30, y 0 .. 0.32, the face sticker at z 0.151. Nothing may enter
// outfits.js FACE_BOX (|x| < 0.135, y 0.02 .. 0.265, z > 0.145): fringes stay at y >= 0.265, side locks at |x| >= 0.135.
import * as THREE from "three";
import { rng, hashSeed, cachedMat, cachedGeo, rbx, addMesh } from "./kitCommon.js";
import { HAIR_KINDS } from "./outfitsData.js";

/**
 * The blocky avatar body, unscaled rig units (the root scale turns it into metres per role). Measured from the reference
 * frames (knight close-up g_017, full figure g_003, townsfolk g_010): legs : torso : head height ~ 2 : 2 : 1.2, the head
 * ~0.6 of the torso's width, arms half the torso's width, legs side by side as wide as the torso.
 */
export const BODY = Object.freeze({
  HIP_Y: 0.9, HIP_X: 0.175, SPINE_Y: 0.17,
  LEG: { w: 0.33, d: 0.34, thigh: 0.42, shin: 0.38 },
  SHOE: { w: 0.345, h: 0.13, d: 0.325, y: -0.423, z: 0.05 }, // the sole spans z -0.1125 .. 0.2125, its bottom at knee y -0.4875 (ground.js)
  PELVIS: { w: 0.7, h: 0.24, d: 0.36, y: 0.1 },
  TORSO: { w: 0.72, h: 0.6, d: 0.36, y: 0.3 },                      // spine space: y 0 .. 0.6, front at z 0.18
  SH: { x: 0.5, y: 0.47 },                                            // the shoulder pivot (the arm's top meets the torso top)
  ARM: { w: 0.28, d: 0.31, up: 0.13, upper: 0.3, fore: 0.24, handY: -0.33 },
  HAND: { w: 0.27, h: 0.2, d: 0.3, y: 0 },
  HEAD_Y: 0.6,                                                        // the head's bottom = the torso's top (no neck, no collar gap)
  HEAD: { w: 0.3, h: 0.32, d: 0.3, r: 0.035 },
});

/** clean plastic: flat colour, light gloss (PLASTIC-WORLD's range, page/kit/plastic.js: roughness 0.3 .. 0.55). A plain
 *  MeshStandardMaterial (no clearcoat: people fill the frame and stay cheap) and the caller's colour as is (skin tones
 *  are never toy-ified) */
export const toy = (color, { rough = 0.42, metal = 0 } = {}) => { const r = Math.min(0.55, Math.max(0.3, rough)); return cachedMat(`toy${new THREE.Color(color).getHexString()}|${r}|${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: metal })); };
const sph = (r) => cachedGeo(`hsph${r}`, () => new THREE.SphereGeometry(r, 12, 9));
const pyr = (r, h) => cachedGeo(`hpyr${r},${h}`, () => { const g = new THREE.ConeGeometry(r, h, 4); g.rotateY(Math.PI / 4); return g; });

// where an on-the-hair piece (crown, tiara, bow, bone, goggles) sits per hair kind; hats sit at 0.33 on any hair
const ON_HAIR = { afro: 0.43, spiky: 0.36, mohawk: 0.36, quiff: 0.37, bun: 0.36, topknot: 0.36, bowl: 0.36, curly: 0.37, buzz: 0.32, bald: 0.315, receding: 0.315, tuft: 0.33 };

// the shared pieces (all in head units). top: left out under a hat
function cap(P, m, h = 0.12, w = 0.345) { P.push({ top: true, f: (g) => rbx(w, h, w, 0.04, m, { y: 0.395 - h / 2, parent: g }) }); }
function back(P, m, yb = 0.14, d = 0.07) { P.push({ f: (g) => rbx(0.335, 0.335 - yb, d, 0.025, m, { y: (yb + 0.335) / 2, z: -0.15 + d / 2 - 0.02, parent: g }) }); }
function sides(P, m, yb = 0.2, w = 0.04, d = 0.25) { for (const s of [-1, 1]) P.push({ f: (g) => rbx(w, 0.335 - yb, d, 0.02, m, { x: s * (0.138 + w / 2), y: (yb + 0.335) / 2, z: -0.025, parent: g }) }); }
function fringe(P, m, h = 0.06) { P.push({ f: (g) => rbx(0.335, h, 0.05, 0.02, m, { y: 0.268 + h / 2, z: 0.158, parent: g }) }); }
function chunks(P, m, n = 5, y = 0.318) { // the lumpy front edge of a chunky hairdo
  for (let k = 0; k < n; k++) P.push({ f: (g) => rbx(0.085, 0.08, 0.09, 0.03, m, { x: -0.135 + (k * 0.27) / (n - 1), y: y + (k % 2) * 0.014, z: 0.13, rz: (k - (n - 1) / 2) * -0.12, parent: g }) });
}
function band(P, color, o) { P.push({ f: (g) => rbx(o.w ?? 0.1, o.h ?? 0.04, o.d ?? 0.1, 0.012, toy(color, { rough: 0.35 }), { ...o, parent: g }) }); }

/** the pieces of each hair kind: (P, m, ctx) -> pushes { f(group), top? } */
const STYLE = {
  short(P, m) { cap(P, m, 0.11); back(P, m, 0.14); sides(P, m, 0.2); fringe(P, m, 0.05); chunks(P, m, 5); },
  sidePart(P, m) {
    cap(P, m, 0.12); back(P, m, 0.13); sides(P, m, 0.19); fringe(P, m, 0.05);
    P.push({ f: (g) => rbx(0.24, 0.085, 0.09, 0.035, m, { x: 0.04, y: 0.336, z: 0.135, rz: -0.18, parent: g }) });
    P.push({ f: (g) => rbx(0.1, 0.06, 0.08, 0.025, m, { x: -0.12, y: 0.31, z: 0.14, parent: g }) });
  },
  spiky(P, m) {
    cap(P, m, 0.1); back(P, m, 0.16); sides(P, m, 0.22); fringe(P, m, 0.045);
    const sp = [[-0.1, 0.06, 0.25, -0.35], [0, 0.08, 0.3, 0], [0.1, 0.06, 0.25, 0.35], [-0.06, -0.05, 0.2, -0.5], [0.07, -0.06, 0.2, 0.5], [0, -0.11, 0.18, 0], [-0.12, 0.13, 0.65, -0.2], [0.02, 0.14, 0.7, 0.05], [0.13, 0.12, 0.6, 0.25]];
    for (const [x, z, rx, rz] of sp) P.push({ top: true, f: (g) => addMesh(pyr(0.065, 0.16), m, { x, y: 0.43, z, rx: rx * (z > 0.1 ? 1 : -0.4), rz, parent: g }) });
  },
  messy(P, m, c) {
    cap(P, m, 0.11); back(P, m, 0.13); sides(P, m, 0.18); fringe(P, m, 0.05);
    const R = rng(c.seed * 31 + 7);
    for (let k = 0; k < 8; k++) { const x = -0.13 + (k % 4) * 0.087, z = k < 4 ? 0.09 : -0.05, rz = (R() - 0.5) * 1.1, rx = (R() - 0.5) * 0.8; P.push({ top: true, f: (g) => rbx(0.1, 0.09, 0.1, 0.035, m, { x, y: 0.41 + R() * 0.03, z, rx, rz, parent: g }) }); }
    for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.08, 0.08, 0.08, 0.03, m, { x: s * 0.16, y: 0.33, z: 0.1, rz: s * 0.5, parent: g }) });
  },
  quiff(P, m) {
    cap(P, m, 0.1); back(P, m, 0.14); sides(P, m, 0.21, 0.05);
    P.push({ top: true, f: (g) => rbx(0.27, 0.13, 0.17, 0.055, m, { y: 0.415, z: 0.075, rx: -0.35, parent: g }) });
    fringe(P, m, 0.045);
  },
  slicked(P, m) {
    cap(P, m, 0.1, 0.33); back(P, m, 0.08, 0.08); sides(P, m, 0.18, 0.05); fringe(P, m, 0.045);
    P.push({ top: true, f: (g) => rbx(0.3, 0.05, 0.28, 0.02, m, { y: 0.41, z: -0.02, parent: g }) });
  },
  bowl(P, m) {
    P.push({ top: true, f: (g) => rbx(0.35, 0.16, 0.35, 0.06, m, { y: 0.347, parent: g }) });
    back(P, m, 0.12, 0.08); sides(P, m, 0.17, 0.065); fringe(P, m, 0.07);
  },
  buzz(P, m) {
    P.push({ top: true, f: (g) => rbx(0.315, 0.05, 0.315, 0.02, m, { y: 0.33, parent: g }) });
    P.push({ f: (g) => rbx(0.315, 0.2, 0.025, 0.01, m, { y: 0.225, z: -0.155, parent: g }) });
    for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.025, 0.11, 0.22, 0.01, m, { x: s * 0.155, y: 0.265, z: -0.03, parent: g }) });
    P.push({ f: (g) => rbx(0.3, 0.035, 0.02, 0.01, m, { y: 0.3, z: 0.155, parent: g }) });
  },
  mohawk(P, m) {
    STYLE.buzz(P, m);
    for (let k = 0; k < 4; k++) P.push({ top: true, f: (g) => rbx(0.07, 0.14 + (k === 1 ? 0.03 : 0), 0.085, 0.025, m, { y: 0.41 + (k === 1 ? 0.015 : 0), z: 0.11 - k * 0.075, rx: -0.15 * k, parent: g }) });
  },
  afro(P, m) {
    P.push({ top: true, f: (g) => rbx(0.46, 0.32, 0.4, 0.13, m, { y: 0.38, z: -0.06, parent: g }) });
    P.push({ f: (g) => rbx(0.4, 0.1, 0.06, 0.04, m, { y: 0.322, z: 0.148, parent: g }) });
    for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.09, 0.2, 0.3, 0.045, m, { x: s * 0.19, y: 0.24, z: -0.03, parent: g }) });
    back(P, m, 0.1, 0.1);
  },
  curly(P, m) {
    cap(P, m, 0.1); back(P, m, 0.12, 0.08); sides(P, m, 0.17);
    const at = [[-0.12, 0.338, 0.14], [-0.04, 0.345, 0.15], [0.04, 0.338, 0.15], [0.12, 0.345, 0.14], [-0.1, 0.43, 0.06], [0.0, 0.45, 0.07], [0.1, 0.43, 0.06], [-0.12, 0.43, -0.07], [0.0, 0.46, -0.06], [0.12, 0.43, -0.07], [-0.17, 0.3, -0.09], [0.17, 0.3, -0.09], [-0.17, 0.22, 0.0], [0.17, 0.22, 0.0], [0, 0.32, -0.17], [-0.1, 0.22, -0.16], [0.1, 0.22, -0.16]];
    for (const [x, y, z] of at) P.push({ top: y > 0.4, f: (g) => addMesh(sph(0.065), m, { x, y, z, parent: g }) });
  },
  curtains(P, m) {
    cap(P, m, 0.12); back(P, m, 0.12); sides(P, m, 0.17);
    for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.16, 0.09, 0.06, 0.03, m, { x: s * 0.08, y: 0.336, z: 0.15, rz: -s * 0.3, parent: g }) });
  },
  bob(P, m) { cap(P, m, 0.12); back(P, m, 0.06, 0.09); sides(P, m, 0.07, 0.07, 0.27); fringe(P, m, 0.07); },
  wavyBob(P, m) {
    STYLE.bob(P, m);
    for (const s of [-1, 1]) for (const [y, z] of [[0.09, 0.06], [0.07, -0.06]]) P.push({ f: (g) => rbx(0.08, 0.09, 0.11, 0.035, m, { x: s * 0.19, y, z, rz: s * 0.35, parent: g }) });
    for (const x of [-0.1, 0.1]) P.push({ f: (g) => rbx(0.13, 0.09, 0.08, 0.035, m, { x, y: 0.05, z: -0.15, rx: 0.3, parent: g }) });
  },
  long(P, m, c) {
    cap(P, m, 0.12); fringe(P, m, 0.055); sides(P, m, -0.02, 0.065, 0.27);
    P.push({ f: (g) => rbx(0.345, 0.36, 0.09, 0.03, m, { y: 0.15, z: -0.14, parent: g }) });
    if (c.spine && c.role !== "kid") P.push({ spine: true, f: (sp) => rbx(0.42, 0.24, 0.07, 0.03, m, { y: BODY.HEAD_Y - 0.1, z: -BODY.TORSO.d / 2 - 0.04, parent: sp }) });
  },
  bangs(P, m, c) {
    STYLE.long(P, m, c);
    P.push({ f: (g) => rbx(0.34, 0.075, 0.06, 0.03, m, { y: 0.307, z: 0.162, parent: g }) });
  },
  ponytail(P, m, c) {
    cap(P, m, 0.12); back(P, m, 0.13); sides(P, m, 0.18); fringe(P, m, 0.05); chunks(P, m, 4);
    P.push({ f: (g) => rbx(0.14, 0.11, 0.12, 0.045, m, { y: 0.29, z: -0.2, parent: g }) });
    P.push({ f: (g) => rbx(0.12, 0.3, 0.1, 0.045, m, { y: 0.12, z: -0.22, rx: 0.12, parent: g }) });
    band(P, c.tie, { w: 0.13, h: 0.045, d: 0.11, y: 0.235, z: -0.215 });
  },
  pigtails(P, m, c) {
    cap(P, m, 0.12); back(P, m, 0.12); sides(P, m, 0.19); fringe(P, m, 0.055);
    for (const s of [-1, 1]) {
      P.push({ f: (g) => rbx(0.11, 0.27, 0.11, 0.045, m, { x: s * 0.23, y: 0.15, z: -0.03, rz: s * 0.22, parent: g }) });
      band(P, c.tie, { w: 0.12, h: 0.045, d: 0.12, x: s * 0.2, y: 0.275, z: -0.03, rz: s * 0.22 });
    }
  },
  bun(P, m, c) {
    cap(P, m, 0.12); back(P, m, 0.13); sides(P, m, 0.18); fringe(P, m, 0.05);
    P.push({ top: true, f: (g) => rbx(0.18, 0.15, 0.18, 0.065, m, { y: 0.45, z: -0.06, parent: g }) });
    P.push({ top: true, f: (g) => rbx(0.15, 0.03, 0.15, 0.01, toy(c.tie, { rough: 0.35 }), { y: 0.39, z: -0.06, parent: g }) });
  },
  topknot(P, m, c) {
    cap(P, m, 0.12); back(P, m, 0.14); sides(P, m, 0.19); fringe(P, m, 0.05);
    P.push({ top: true, f: (g) => rbx(0.13, 0.12, 0.13, 0.05, m, { y: 0.47, parent: g }) });
    P.push({ top: true, f: (g) => rbx(0.1, 0.03, 0.1, 0.01, toy(c.tie, { rough: 0.35 }), { y: 0.405, parent: g }) });
  },
  braids(P, m, c) {
    cap(P, m, 0.12); back(P, m, 0.1, 0.08); sides(P, m, 0.13);
    for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.16, 0.08, 0.06, 0.03, m, { x: s * 0.08, y: 0.328, z: 0.15, rz: -s * 0.2, parent: g }) });
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) P.push({ f: (g) => rbx(0.085, 0.09, 0.085, 0.032, m, { x: s * 0.19, y: 0.1 - k * 0.085, z: 0.15, rz: (k % 2 ? 1 : -1) * 0.2, parent: g }) });
      band(P, c.tie, { w: 0.07, h: 0.035, d: 0.07, x: s * 0.19, y: -0.21, z: 0.15 });
    }
  },
  receding(P, m) {
    back(P, m, 0.12, 0.08); sides(P, m, 0.17, 0.07);
    P.push({ top: true, f: (g) => rbx(0.12, 0.03, 0.14, 0.012, m, { y: 0.33, z: -0.06, parent: g }) });
  },
  bald(P, m, c) { if (c.role === "elder") for (const s of [-1, 1]) P.push({ f: (g) => rbx(0.05, 0.1, 0.2, 0.015, m, { x: s * 0.165, y: 0.2, z: -0.04, parent: g }) }); },
  tuft(P, m) {
    P.push({ top: true, f: (g) => rbx(0.07, 0.07, 0.07, 0.02, m, { y: 0.335, z: 0.04, parent: g }) });
    P.push({ top: true, f: (g) => rbx(0.05, 0.08, 0.05, 0.015, m, { x: 0.025, y: 0.39, z: 0.06, rz: -0.6, parent: g }) });
  },
};
export const BUILT_HAIR = Object.freeze(Object.keys(STYLE));

/** look.hair (unknown -> short) in look.hairColor; returns { kind, hb, n } */
export function buildHair(head, look, { underHat = false, spine = null, seed = null } = {}) {
  const kind = HAIR_KINDS.includes(look.hair) && STYLE[look.hair] ? look.hair : "short";
  const g = new THREE.Group(); g.name = `hair:${kind}`; head.add(g);
  const m = toy(look.hairColor ?? "#3a2a1e", { rough: kind === "slicked" ? 0.28 : 0.5 });
  const P = [];
  STYLE[kind](P, m, { seed: seed ?? hashSeed(`${look.hairColor}/${kind}`), spine, role: look.role, tie: look.tieColor ?? "#ff5c8a" });
  let n = 0;
  for (const p of P) {
    if (underHat && p.top) continue;
    if (p.spine) { if (spine) { p.f(spine).name = "hair:spine"; n++; } continue; }
    p.f(g); n++;
  }
  return { kind, n, hb: underHat ? 0.33 : ON_HAIR[kind] ?? 0.33 };
}

/** a full beard's chunky chin block (under the face sticker: below y 0.02, never over the mouth) */
export function chinBeard(head, look) {
  if (look.facial !== "full" || !look.beard) return null;
  return rbx(0.3, 0.08, 0.16, 0.03, toy(look.beard, { rough: 0.5 }), { y: -0.025, z: 0.08, parent: head });
}
