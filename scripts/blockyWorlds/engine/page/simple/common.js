// Blocky Worlds SIMPLE LOOK (production, owner 2026-11-10: "the simple test look is the production look"): the shared
// switches, materials and box helpers of the simple-look page modules (page/simple/people.js, sets.js, post.js,
// camera.js). The approved test page (page/simple/simple.js + index.html) stays as the reference; these modules port
// its look into the production engine (page/engine.js loads them when timeline.look === "simple").
//
// THE ONE SWITCH for the colour grade: SIMPLE.lut (false = the mood LUT is OFF for this look, owner 2026-11-10; set it
// to true, or a timeline's lookOptions.lut = true, once the LUT is re-fitted on the simple look).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const SIMPLE = Object.freeze({
  lut: false,              // the mood LUT (lib/data/colourGrade.json) on top of this look: OFF until re-fitted
  dofCloseups: true,       // depth of field on close-ups only
  bloomNight: true,        // bloom only at night, only above emissive levels
  U: 0.45,                 // one avatar unit in rig units (6-block body: legs 2, torso 2, head 1.2; root scale -> metres)
});

// the light tunes of the approved test (page/simple/simple.js TUNE) + the engine's other light names
export const TUNE = {
  day: { sun: ["#fff6e6", 3.0], sunDir: [-18, 30, 22], hemi: ["#d6ecff", "#9ccf7a", 1.5], skyTop: "#2f7fe8", skyHor: "#aad8ff", exposure: 1.0, cloud: ["#ffffff", 0.45] },
  night: { sun: ["#9bb4ff", 0.7], sunDir: [14, 30, 16], hemi: ["#3b5cb8", "#16223f", 0.8], skyTop: "#071440", skyHor: "#22408a", exposure: 1.0, cloud: ["#5a6ea8", 0.03], night: true },
  warm: { sun: ["#ffd7a0", 2.6], sunDir: [-30, 14, 18], hemi: ["#ffd9b0", "#8fbf6a", 1.3], skyTop: "#4f86e0", skyHor: "#ffc98f", exposure: 1.0, cloud: ["#fff0dc", 0.4] },
  dusk: { sun: ["#ffb98a", 1.6], sunDir: [-30, 10, 18], hemi: ["#8f8fd8", "#4a5a6a", 1.1], skyTop: "#3a4fa8", skyHor: "#ff9f7a", exposure: 1.0, cloud: ["#ffd0c0", 0.25], dusk: true },
  dawn: { sun: ["#ffe0b0", 2.0], sunDir: [30, 12, 18], hemi: ["#cfe0ff", "#8fbf6a", 1.25], skyTop: "#5b8fe0", skyHor: "#ffd6b0", exposure: 1.0, cloud: ["#fff4e8", 0.35] },
};
export const tuneOf = (name) => TUNE[name] ?? TUNE.day;

const MATS = new Map();
/** matte for big surfaces (rough 0.9), plastic for props / characters (rough 0.55); night: { emissive, ei } switched on at night */
export function mat(color, { rough = 0.9, emissive = null, ei = 0, night = null, side = null } = {}) {
  const k = `${color}|${rough}|${emissive}|${ei}|${night ? JSON.stringify(night) : ""}|${side ?? ""}`;
  if (!MATS.has(k)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = ei; }
    if (side === "double") m.side = THREE.DoubleSide;
    m.userData.night = night;
    MATS.set(k, m);
  }
  return MATS.get(k);
}
export const allMats = () => MATS.values();

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export function box(parent, [w, h, d], [x, y, z], m, { cast = true, receive = true, rot = null } = {}) {
  const b = new THREE.Mesh(BOX, m);
  b.scale.set(w, h, d); b.position.set(x, y, z);
  if (rot) b.rotation.set(...rot);
  b.castShadow = cast; b.receiveShadow = receive;
  parent.add(b);
  return b;
}
const RB = new Map();
export function rbox(parent, [w, h, d], [x, y, z], m, r = 0.05) {
  const k = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${r.toFixed(4)}`;
  if (!RB.has(k)) RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
  const b = new THREE.Mesh(RB.get(k), m);
  b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true;
  parent.add(b);
  return b;
}
const SPH = new Map();
/** a smooth ball (cloud-tree canopies, bushes): low-poly enough to stay cheap, round enough to read soft */
export function ball(parent, r, [x, y, z], m, { sx = 1, sy = 1, sz = 1, cast = true } = {}) {
  if (!SPH.has("u")) SPH.set("u", new THREE.SphereGeometry(1, 20, 14));
  const b = new THREE.Mesh(SPH.get("u"), m);
  b.scale.set(r * sx, r * sy, r * sz); b.position.set(x, y, z);
  b.castShadow = cast; b.receiveShadow = true;
  parent.add(b);
  return b;
}
const CYL = new Map();
export function cyl(parent, rTop, rBot, h, [x, y, z], m, { seg = 12, cast = true } = {}) {
  const k = `${rTop}|${rBot}|${seg}`;
  if (!CYL.has(k)) CYL.set(k, new THREE.CylinderGeometry(rTop, rBot, 1, seg));
  const c = new THREE.Mesh(CYL.get(k), m);
  c.scale.set(1, h, 1); c.position.set(x, y, z); c.castShadow = cast; c.receiveShadow = true;
  parent.add(c);
  return c;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** a small seeded random (mulberry32): the same seed, the same town (frames never depend on Math.random) */
export function seeded(seed) {
  let a = (Number(seed) >>> 0) || 1;
  const R = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  R.pick = (list) => list[Math.floor(R() * list.length) % list.length];
  R.range = (a0, b0) => a0 + R() * (b0 - a0);
  return R;
}
