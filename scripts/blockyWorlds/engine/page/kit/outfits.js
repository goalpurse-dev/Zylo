// Blocky Worlds OUTFITS: the builder (CHARACTERS-V2 2026-11-09; CHARACTERS-V3 2026-11-10, owner: "detailed themed outfits
// with clean plastic materials (armour, coats, robes, suits)"). Layered blocks on the people.js rig (hair.js BODY): flat
// saturated plastic, crisp graphic prints only where a pattern is the point (stripes, plaid, dots, checks, stars, ermine),
// bold simple details (armour plates with trim and rivets, buttons, belts with buckles, coat panels, pockets). No fabric
// photo textures, no noise. Head pieces sit ABOVE the brows (y >= the hairline) or beside / behind the face, never over
// it (dev/charactersV3.test.mjs measures it for every outfit).
//   garment(color, kind)                  a clean plastic material for a garment kind (+ crisp prints)
//   dressPerson(joints, look, dims)       adds the look.parts + look.ohead meshes to the rig; returns { parts, head }
//   animateOutfit(joints)                 after posePerson: apron / tail flaps follow the thighs, the cape swings
//   HEAD_KINDS, PART_KINDS, FACE_BOX      what can be built; the face area nothing may cover
import * as THREE from "three";
import { rng, hashSeed, darker, rbx, bx, addMesh, cachedGeo, cachedMat } from "./kitCommon.js";
import { BODY, toy } from "./hair.js";

// ------------------------------------------------------------------------------------------------- materials
const PRINTS = new Set(["stripes", "plaid", "dots", "check", "stars", "ermine", "pinstripe", "band", "paint", "flour"]);
const ROUGH = { velvet: 0.55, leather: 0.32, fur: 0.55, denim: 0.5, knit: 0.55, canvas: 0.5, linen: 0.52, tweed: 0.55, quilt: 0.45, straw: 0.55, cotton: 0.45 };
function print(color, kind) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d");
  const R = rng(hashSeed(`${color}/${kind}/p3`));
  const base = new THREE.Color(color), tmp = new THREE.Color();
  const shade = (k) => `#${tmp.copy(base).multiplyScalar(k).getHexString()}`;
  p.fillStyle = kind === "ermine" ? "#f7f5ef" : color; p.fillRect(0, 0, 128, 128);
  switch (kind) {
    case "stripes": p.fillStyle = "#ffffff"; for (let y = 0; y < 128; y += 32) p.fillRect(0, y, 128, 13); break;
    case "pinstripe": p.fillStyle = shade(1.6); for (let x = 4; x < 128; x += 16) p.fillRect(x, 0, 2, 128); break;
    case "plaid": p.fillStyle = shade(0.68); for (let y = 0; y < 128; y += 64) p.fillRect(0, y, 128, 22); for (let x = 0; x < 128; x += 64) p.fillRect(x, 0, 22, 128); p.fillStyle = "rgba(255,255,255,0.55)"; for (let y = 40; y < 128; y += 64) p.fillRect(0, y, 128, 4); for (let x = 40; x < 128; x += 64) p.fillRect(x, 0, 4, 128); break;
    case "dots": p.fillStyle = "#ffffff"; for (let y = 16; y < 128; y += 32) for (let x = (y / 32) % 2 < 1 ? 16 : 32; x < 128; x += 32) { p.beginPath(); p.arc(x, y, 7, 0, Math.PI * 2); p.fill(); } break;
    case "check": p.fillStyle = "#f2f2f2"; for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < 128; x += 64) p.fillRect(x, y, 32, 32); break;
    case "band": p.fillStyle = "#ffffff"; p.fillRect(0, 48, 128, 16); p.fillStyle = shade(0.6); p.fillRect(0, 64, 128, 12); break;
    case "stars": for (let i = 0; i < 6; i++) { const x = 12 + (i % 3) * 44 + (i > 2 ? 22 : 0), y = i > 2 ? 90 : 30, r = 11; p.fillStyle = "#f7d038"; p.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.42 : r; p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } p.closePath(); p.fill(); } break;
    case "ermine": p.fillStyle = "#1e1e1e"; for (let i = 0; i < 12; i++) { const x = (i % 4) * 32 + ((i / 4) | 0) % 2 * 16 + 8, y = ((i / 4) | 0) * 42 + 12; p.beginPath(); p.moveTo(x, y); p.lineTo(x - 5, y + 16); p.lineTo(x + 5, y + 16); p.closePath(); p.fill(); } break;
    case "paint": { const pc = ["#e74c3c", "#2e86de", "#f7d038", "#20bf6b", "#8854d0", "#ff7a1a"]; for (let i = 0; i < 9; i++) { p.fillStyle = pc[i % pc.length]; p.beginPath(); p.arc(10 + R() * 108, 10 + R() * 108, 6 + R() * 5, 0, Math.PI * 2); p.fill(); } break; }
    case "flour": p.fillStyle = "#ffffff"; for (const [x, y, r] of [[30, 40, 12], [90, 80, 15], [60, 110, 9]]) { p.beginPath(); p.arc(x, y, r, 0, Math.PI * 2); p.fill(); } break;
    default: break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
/** a garment material: clean plastic in the garment's colour; patterns as crisp prints (no fabric noise) */
export function garment(color, kind = "cotton") {
  if (kind === "plate") return toy(color, { rough: 0.26, metal: 0.45 });
  if (kind === "chainmail") return toy(color, { rough: 0.32, metal: 0.4 });
  if (!PRINTS.has(kind)) return toy(color, { rough: ROUGH[kind] ?? 0.45 });
  return cachedMat(`og3${color}/${kind}`, () => new THREE.MeshStandardMaterial({ map: print(color, kind), roughness: 0.42 }));
}
const metal = (c) => toy(c, { rough: 0.3, metal: 0.55 });
const shiny = (c) => toy(c, { rough: 0.3 });
const flat = (c, rough = 0.45) => toy(c, { rough });
const sph = (r) => cachedGeo(`osph${r}`, () => new THREE.SphereGeometry(r, 12, 9));
const cyl = (r1, r2, h, s = 16) => cachedGeo(`ocyl${r1},${r2},${h},${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const cone = (r, h, s = 12) => cachedGeo(`ocone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const R0 = 0.02;

// ------------------------------------------------------------------------------------------------- body parts
// rig numbers (hair.js BODY): torso 0.72 x 0.6 x 0.36 at spine y 0.3 (front z 0.18); pelvis 0.7 x 0.24 x 0.36 at y 0.1,
// belt y 0.2; upper arm 0.28 x 0.43 x 0.31 at sh y -0.085; forearm 0.27 x 0.24 at el y -0.12; thigh 0.33 x 0.44 x 0.34
// at hip y -0.2; shin at knee y -0.19; the shoulder pivot at x +-0.5, y 0.47
const T = BODY.TORSO, TW = T.w, TH = T.h, TY = T.y, FZ = T.d / 2, PW = BODY.PELVIS.w, PD = BODY.PELVIS.d, AW = BODY.ARM.w, AD = BODY.ARM.d, LW = BODY.LEG.w, LD = BODY.LEG.d;
const BELT_Y = 0.2;
function flap(j, side, y = 0.17) { const g = new THREE.Group(); g.position.set(0, y, side === "front" ? PD / 2 : -PD / 2); g.userData.flap = side; j.pelvis.add(g); j.flaps.push(g); return g; }
/** a jacket / coat shell over the torso (open: two front panels with a gap showing the shirt) */
function torsoShell(j, mat, { open = false, front = true, grow = 0.03, h = TH + 0.01, y = TY, gap = 0.16 } = {}) {
  const w = TW + grow * 2, d = T.d + grow * 2;
  rbx(w, h, 0.05, 0.015, mat, { y, z: -d / 2 + 0.025, parent: j.spine });
  for (const s of [-1, 1]) rbx(0.05, h, d, 0.015, mat, { x: s * (w / 2 - 0.025), y, parent: j.spine });
  if (front) for (const s of [-1, 1]) rbx(open ? (w - gap) / 2 : w / 2, h, 0.045, 0.015, mat, { x: s * (open ? (w + gap) / 4 : w / 4), y, z: d / 2 - 0.022, parent: j.spine });
  rbx(w, 0.05, d, 0.015, mat, { y: y + h / 2 - 0.025, parent: j.spine }); // the shoulders
}
function sleeves(j, mat, { cuff = null, wide = false } = {}) {
  for (let i = 0; i < 2; i++) {
    rbx(AW + 0.03, 0.44, AD + 0.03, R0, mat, { y: -0.085, parent: j.sh[i] });
    rbx(wide ? AW + 0.1 : AW + 0.025, wide ? 0.28 : 0.22, wide ? AD + 0.1 : AD + 0.025, R0, mat, { y: wide ? -0.15 : -0.11, parent: j.el[i] });
    if (cuff) rbx(wide ? AW + 0.11 : AW + 0.04, 0.06, wide ? AD + 0.11 : AD + 0.04, 0.015, cuff, { y: wide ? -0.27 : -0.21, parent: j.el[i] });
  }
}
function buttonsCol(j, color, { x = 0, n = 4, z = FZ + 0.03, y0 = 0.5, dy = 0.12, clasp = false } = {}) {
  const m = shiny(color);
  for (let k = 0; k < n; k++) clasp ? rbx(0.1, 0.035, 0.03, 0.01, m, { x, y: y0 - k * dy, z, parent: j.spine }) : addMesh(cyl(0.026, 0.026, 0.02, 12), m, { x, y: y0 - k * dy, z, rx: Math.PI / 2, parent: j.spine, shadow: false });
}
function bandAround(parent, y, w, d, mat, h = 0.06) { rbx(w, h, d, 0.015, mat, { y, parent }); }
/** a heraldic shield badge (our own simple shape: a rounded plate + a diamond), facing +z at (x, y, z) on the spine */
function shieldBadge(j, color, inner, { x = 0, y = 0.4, z = FZ + 0.04, s = 1 } = {}) {
  rbx(0.2 * s, 0.22 * s, 0.02, 0.03, flat("#ffffff", 0.35), { x, y, z, parent: j.spine });
  addMesh(cone(0.1 * s, 0.08 * s, 4), flat("#ffffff", 0.35), { x, y: y - 0.14 * s, z, rz: Math.PI, rx: 0, parent: j.spine, shadow: false });
  rbx(0.09 * s, 0.09 * s, 0.02, 0.01, flat(inner, 0.35), { x, y: y - 0.01 * s, z: z + 0.008, rz: Math.PI / 4, parent: j.spine });
  rbx(0.22 * s, 0.025, 0.022, 0.006, metal(color), { x, y: y + 0.11 * s, z: z + 0.002, parent: j.spine });
}

export const PART_BUILD = {
  jacket(j, p) {
    const m = garment(p.color, p.casual ? "canvas" : "cotton");
    torsoShell(j, m, { open: true });
    for (const s of [-1, 1]) rbx(0.1, 0.3, 0.025, 0.008, flat(darker(p.color, 0.78)), { x: s * 0.12, y: 0.46, z: FZ + 0.05, rz: s * 0.32, parent: j.spine }); // lapels
    for (const s of [-1, 1]) bx(0.14, 0.03, 0.02, flat(darker(p.color, 0.75)), { x: s * 0.2, y: 0.18, z: FZ + 0.05, parent: j.spine }); // pocket flaps
    sleeves(j, m, { cuff: flat(darker(p.color, 0.8)) });
    if (!p.casual) buttonsCol(j, "#2d3436", { x: 0.11, n: 2, y0: 0.28, z: FZ + 0.06 });
  },
  coatLong(j, p) {
    const m = garment(p.color, "velvet"), tr = p.trim ? metal(p.trim) : flat(darker(p.color, 0.75));
    torsoShell(j, m, { open: true });
    sleeves(j, m, { cuff: tr });
    const back = flap(j, "back", 0.12); rbx(TW + 0.04, 0.56, 0.05, 0.015, m, { y: -0.28, z: -0.03, parent: back });
    for (const s of [-1, 1]) rbx(0.05, 0.52, PD + 0.04, 0.015, m, { x: s * (PW / 2 + 0.03), y: -0.16, parent: j.pelvis });
    for (const s of [-1, 1]) rbx(0.04, TH, 0.04, 0.01, tr, { x: s * 0.1, y: TY, z: FZ + 0.06, parent: j.spine });
    rbx(TW + 0.04, 0.04, 0.055, 0.01, tr, { y: -0.55, z: -0.03, parent: back });
    buttonsCol(j, p.trim ?? "#d4a017", { x: 0.2, n: 4, z: FZ + 0.065 }); buttonsCol(j, p.trim ?? "#d4a017", { x: -0.2, n: 4, z: FZ + 0.065 });
  },
  labcoat(j, p) {
    const m = garment(p.color, "canvas");
    torsoShell(j, m, { open: true, grow: 0.035 });
    for (const s of [-1, 1]) rbx(0.11, 0.28, 0.025, 0.008, m, { x: s * 0.12, y: 0.47, z: FZ + 0.06, rz: s * 0.3, parent: j.spine });
    sleeves(j, m, {});
    const back = flap(j, "back", 0.12); rbx(TW + 0.06, 0.6, 0.05, 0.015, m, { y: -0.29, z: -0.03, parent: back });
    for (const s of [-1, 1]) { const f = flap(j, "front", 0.12); f.position.x = s * 0.24; rbx(0.25, 0.6, 0.045, 0.015, m, { y: -0.29, z: 0.035, parent: f }); rbx(0.15, 0.12, 0.02, 0.008, flat(darker(p.color, 0.88)), { y: -0.22, z: 0.065, parent: f }); }
    for (const s of [-1, 1]) rbx(0.05, 0.58, PD + 0.04, 0.015, m, { x: s * (PW / 2 + 0.035), y: -0.17, parent: j.pelvis });
    rbx(0.15, 0.13, 0.02, 0.008, flat(darker(p.color, 0.9)), { x: -0.2, y: 0.42, z: FZ + 0.06, parent: j.spine }); // chest pocket
    buttonsCol(j, "#c8ced4", { x: 0.12, n: 3, y0: 0.4, z: FZ + 0.065 });
  },
  apron(j, p) {
    const kind = p.flour ? "flour" : p.paint ? "paint" : p.stripes ? "stripes" : "canvas", m = garment(p.color, kind);
    if (!p.half) rbx(0.44, 0.34, 0.025, 0.01, m, { y: 0.38, z: FZ + 0.013, parent: j.spine });
    if (!p.half) for (const s of [-1, 1]) bx(0.04, 0.26, 0.02, m, { x: s * 0.2, y: 0.62, z: 0.08, rx: -0.5, parent: j.spine });
    bandAround(j.spine, 0.06, TW + 0.02, T.d + 0.02, m, 0.05); // the ties round the waist
    const f = flap(j, "front", 0.17); rbx(0.56, p.long ? 0.68 : 0.5, 0.03, 0.01, m, { y: p.long ? -0.32 : -0.24, z: 0.02, parent: f });
    if (p.pocket) rbx(0.28, 0.12, 0.02, 0.008, flat(darker(p.color, 0.85)), { y: -0.16, z: 0.04, parent: f });
    if (p.long) { const b = flap(j, "back", 0.17); rbx(0.6, 0.56, 0.03, 0.01, m, { y: -0.27, z: -0.02, parent: b }); }
  },
  robe(j, p) {
    const m = garment(p.color, "stars");
    torsoShell(j, m, { grow: 0.03 });
    sleeves(j, m, { wide: true, cuff: p.stars ? metal(p.stars) : null });
    if (j.skirt) { rbx(0.84, 0.9, 0.46, R0, m, { y: -0.45, parent: j.skirt }); if (p.stars) rbx(0.85, 0.06, 0.47, 0.015, metal(p.stars), { y: -0.88, parent: j.skirt }); }
    rbx(0.3, 0.05, 0.03, 0.01, metal(p.stars ?? "#d4a017"), { y: 0.56, z: FZ + 0.04, parent: j.spine });
    for (const s of [-1, 1]) rbx(0.07, 0.07, 0.03, 0.015, metal(p.stars ?? "#d4a017"), { x: s * 0.09, y: 0.5, z: FZ + 0.05, parent: j.spine });
  },
  cape(j, p) {
    const g = new THREE.Group(); g.position.set(0, TH - 0.02, -FZ - 0.02); j.spine.add(g); j.cape = g;
    const L = p.tall ? 1.15 : 1.08;
    rbx(TW + 0.1, L, 0.04, 0.01, garment(p.color, "velvet"), { y: -L / 2, z: -0.02, parent: g });
    if (p.lining) bx(TW + 0.06, L - 0.04, 0.01, flat(p.lining, 0.4), { y: -L / 2, z: 0.003, parent: g });
    if (p.trim === "ermine") { rbx(TW + 0.12, 0.12, 0.05, 0.015, garment("#ffffff", "ermine"), { y: -L + 0.05, z: -0.02, parent: g }); rbx(TW + 0.14, 0.13, T.d + 0.12, 0.04, garment("#ffffff", "ermine"), { y: 0.03, z: FZ + 0.02, parent: g }); }
    if (p.collar) { // an upright collar behind the head (never in front of the face)
      const cm = p.lining ? flat(p.lining, 0.4) : garment(p.color, "velvet");
      for (const s of [-1, 1]) rbx(0.28, p.tall ? 0.36 : 0.22, 0.035, 0.01, cm, { x: s * 0.17, y: p.tall ? 0.18 : 0.11, z: -0.02, ry: s * 0.5, rx: -0.25, parent: g });
    }
  },
  armor(j, p) { // our own knight's plate: a rounded breastplate with a trim rim and rivets, layered pauldrons, bracers, knee cops
    const pl = garment(p.color, "plate"), trim = metal(p.trim ?? "#e0b84a");
    rbx(TW + 0.06, TH - 0.04, T.d + 0.06, 0.05, pl, { y: TY + 0.01, parent: j.spine });
    rbx(TW - 0.12, 0.26, 0.06, 0.07, pl, { y: 0.44, z: FZ + 0.035, parent: j.spine }); // the chest dome
    rbx(TW + 0.07, 0.035, T.d + 0.07, 0.012, trim, { y: TH - 0.03, parent: j.spine }); // the neck rim
    rbx(TW + 0.07, 0.03, T.d + 0.07, 0.01, trim, { y: 0.05, parent: j.spine });
    for (const s of [-1, 1]) for (const y of [0.16, 0.3]) addMesh(sph(0.022), trim, { x: s * (TW / 2 + 0.02), y, z: FZ + 0.02, parent: j.spine, shadow: false });
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      rbx(AW + 0.12, 0.13, AD + 0.12, 0.05, pl, { y: 0.1, parent: j.sh[i] }); rbx(AW + 0.1, 0.07, AD + 0.1, 0.03, pl, { y: 0.0, parent: j.sh[i] });
      rbx(AW + 0.13, 0.025, AD + 0.13, 0.01, trim, { y: 0.045, parent: j.sh[i] });
      addMesh(sph(0.055), trim, { x: -s * 0.0, y: 0.17, z: 0.0, parent: j.sh[i] }); // the round shoulder boss
      rbx(AW + 0.04, 0.16, AD + 0.04, 0.03, pl, { y: -0.14, parent: j.el[i] });
      rbx(AW + 0.05, 0.025, AD + 0.05, 0.008, trim, { y: -0.06, parent: j.el[i] });
      rbx(LW + 0.04, 0.3, LD + 0.04, 0.03, pl, { y: -0.22, parent: j.knee[i] }); rbx(LW - 0.06, 0.12, 0.08, 0.04, pl, { y: 0.0, z: LD / 2, parent: j.knee[i] });
      rbx(LW + 0.05, 0.025, LD + 0.05, 0.008, trim, { y: -0.08, parent: j.knee[i] });
    }
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.12); rbx(PW - 0.06, 0.22, 0.04, 0.015, pl, { y: -0.1, z: side === "front" ? 0.03 : -0.03, parent: f }); rbx(PW - 0.05, 0.025, 0.045, 0.008, trim, { y: -0.21, z: side === "front" ? 0.03 : -0.03, parent: f }); }
  },
  tabard(j, p) {
    const m = garment(p.color, "canvas"), tr = metal(p.emblem ?? "#e0b84a");
    rbx(0.36, TH - 0.06, 0.025, 0.008, m, { y: TY, z: FZ + 0.075, parent: j.spine }); rbx(0.36, TH - 0.06, 0.025, 0.008, m, { y: TY, z: -FZ - 0.075, parent: j.spine });
    for (const s of [-1, 1]) bx(0.02, TH - 0.06, 0.03, tr, { x: s * 0.18, y: TY, z: FZ + 0.08, parent: j.spine });
    const f = flap(j, "front", 0.12); rbx(0.36, 0.38, 0.025, 0.008, m, { y: -0.19, z: 0.08, parent: f }); bx(0.37, 0.02, 0.03, tr, { y: -0.38, z: 0.08, parent: f });
    const b = flap(j, "back", 0.12); rbx(0.36, 0.38, 0.025, 0.008, m, { y: -0.19, z: -0.08, parent: b });
    if (p.emblem) shieldBadge(j, p.emblem, p.color, { y: 0.38, z: FZ + 0.1, s: 1 });
  },
  tunic(j, p) {
    const m = garment(p.color, "linen");
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.15); rbx(PW - 0.02, 0.36, 0.035, 0.012, m, { y: -0.18, z: side === "front" ? 0.02 : -0.02, parent: f }); }
    for (const s of [-1, 1]) rbx(0.035, 0.32, PD - 0.02, 0.01, m, { x: s * (PW / 2), y: -0.03, parent: j.pelvis });
    rbx(0.16, 0.18, 0.02, 0.006, flat("#f5ecd7"), { y: 0.5, z: FZ + 0.01, parent: j.spine }); // the lacing panel
    for (let k = 0; k < 3; k++) bx(0.13, 0.016, 0.014, flat("#5a3b24"), { y: 0.45 + k * 0.045, z: FZ + 0.022, rz: 0.4 * (k % 2 ? 1 : -1), parent: j.spine });
  },
  pelt(j, p) { // a chunky fur wrap with bold darker spots (plastic, no fur texture)
    const m = flat(p.color, 0.62), spot = flat(darker(p.color, 0.62), 0.62);
    if (p.shoulders) { // a fur mantle over both shoulders
      rbx(TW + 0.16, 0.14, T.d + 0.12, 0.05, m, { y: TH - 0.03, parent: j.spine });
      for (let i = 0; i < 2; i++) rbx(AW + 0.1, 0.12, AD + 0.1, 0.05, m, { y: 0.1, parent: j.sh[i] });
      for (const x of [-0.25, 0, 0.25]) rbx(0.08, 0.05, 0.02, 0.02, spot, { x, y: TH - 0.03, z: FZ + 0.07, parent: j.spine });
      return;
    }
    rbx(TW + 0.06, 0.26, T.d + 0.05, 0.04, m, { y: 0.4, rz: 0.5, parent: j.spine }); // one-shoulder wrap, diagonally
    rbx(TW + 0.04, 0.3, T.d + 0.04, 0.04, m, { y: 0.15, parent: j.spine });
    for (const [x, y] of [[-0.2, 0.18], [0.15, 0.1], [0.22, 0.24], [-0.05, 0.42]]) rbx(0.08, 0.06, 0.02, 0.02, spot, { x, y, z: FZ + 0.03, parent: j.spine });
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.15); rbx(PW - 0.02, 0.24, 0.05, 0.02, m, { y: -0.14, z: side === "front" ? 0.02 : -0.02, parent: f }); for (const x of [-0.22, 0, 0.22]) rbx(0.14, 0.11, 0.05, 0.02, m, { x, y: -0.29, z: side === "front" ? 0.02 : -0.02, rz: 0.785, parent: f }); }
  },
  overalls(j, p) {
    const m = garment(p.color, "denim"), btn = metal("#d4a017");
    rbx(0.44, 0.3, 0.025, 0.008, m, { y: 0.16, z: FZ + 0.012, parent: j.spine }); rbx(0.2, 0.1, 0.02, 0.006, flat(darker(p.color, 0.8)), { y: 0.2, z: FZ + 0.027, parent: j.spine });
    for (const s of [-1, 1]) { bx(0.07, 0.42, 0.02, m, { x: s * 0.16, y: 0.4, z: FZ + 0.01, parent: j.spine }); bx(0.07, 0.56, 0.02, m, { x: s * 0.16, y: 0.33, z: -FZ - 0.01, parent: j.spine }); bx(0.07, 0.03, T.d + 0.02, m, { x: s * 0.16, y: TH - 0.005, parent: j.spine }); addMesh(cyl(0.03, 0.03, 0.02, 12), btn, { x: s * 0.16, y: 0.29, z: FZ + 0.03, rx: Math.PI / 2, parent: j.spine, shadow: false }); }
  },
  hivis(j, p) {
    const m = garment(p.color, "canvas"), strip = toy("#e8eef2", { rough: 0.2, metal: 0.3 });
    torsoShell(j, m, { open: true, h: TH - 0.06, y: TY - 0.02 });
    for (const y of [0.16, 0.34]) { bx(TW + 0.08, 0.05, 0.05, strip, { y, z: -FZ - 0.04, parent: j.spine }); for (const s of [-1, 1]) bx(0.24, 0.05, 0.012, strip, { x: s * 0.24, y, z: FZ + 0.045, parent: j.spine }); }
  },
  cardigan(j, p) {
    const m = garment(p.color, "knit");
    torsoShell(j, m, { open: true, grow: 0.025 });
    sleeves(j, m, { cuff: flat(darker(p.color, 0.82)) });
    rbx(TW + 0.06, 0.06, T.d + 0.06, 0.015, flat(darker(p.color, 0.82)), { y: 0.03, parent: j.spine });
    if (p.buttons) buttonsCol(j, "#f5f5f0", { x: 0.1, n: 4, z: FZ + 0.05 });
    if (p.patches) for (let i = 0; i < 2; i++) rbx(0.14, 0.12, 0.02, 0.02, flat("#7b4a2a", 0.6), { y: -0.07, z: -AD / 2 - 0.02, parent: j.el[i] });
  },
  hoodie(j, p) {
    const m = garment(p.color, "cotton"), dk = flat(darker(p.color, 0.82));
    rbx(0.52, 0.2, 0.2, 0.06, m, { y: TH - 0.02, z: -FZ - 0.06, parent: j.spine }); // the hood, down at the back
    rbx(0.44, 0.16, 0.025, 0.01, dk, { y: 0.14, z: FZ + 0.012, parent: j.spine }); // pocket
    for (const s of [-1, 1]) bx(0.022, 0.16, 0.014, flat("#f5f5f0"), { x: s * 0.07, y: 0.48, z: FZ + 0.01, parent: j.spine });
    bandAround(j.spine, 0.03, TW + 0.015, T.d + 0.015, dk, 0.05);
    for (let i = 0; i < 2; i++) rbx(AW + 0.012, 0.05, AD + 0.012, 0.012, dk, { y: -0.21, parent: j.el[i] });
  },
  overshirt(j, p) {
    const m = garment(p.color, "plaid");
    torsoShell(j, m, { open: true, grow: 0.02 });
    sleeves(j, m, { cuff: flat(darker(p.color, 0.8)) });
    for (const s of [-1, 1]) rbx(0.09, 0.2, 0.025, 0.008, m, { x: s * 0.13, y: 0.5, z: FZ + 0.04, rz: s * 0.3, parent: j.spine });
  },
  vest(j, p) {
    const kind = p.leather ? "leather" : p.tweed ? "tweed" : p.puffer ? "quilt" : "cotton";
    const m = garment(p.color, kind);
    torsoShell(j, m, { open: !!p.leather, grow: p.puffer ? 0.045 : 0.025, h: p.puffer ? TH + 0.01 : TH - 0.06, y: p.puffer ? TY : TY - 0.02 });
    if (!p.leather) for (const s of [-1, 1]) rbx(0.08, 0.18, 0.02, 0.006, flat(darker(p.color, 0.8)), { x: s * 0.09, y: 0.5, z: FZ + 0.04, rz: s * 0.35, parent: j.spine });
    if (p.puffer) { for (const y of [0.15, 0.3, 0.45]) bx(TW + 0.1, 0.02, T.d + 0.1, flat(darker(p.color, 0.8)), { y, parent: j.spine }); for (let i = 0; i < 2; i++) rbx(AW + 0.06, 0.08, AD + 0.06, 0.03, m, { y: 0.1, parent: j.sh[i] }); }
    if (p.leather) for (const s of [-1, 1]) addMesh(sph(0.02), metal("#d4a017"), { x: s * 0.2, y: 0.35, z: FZ + 0.05, parent: j.spine, shadow: false });
  },
  sash(j, p) {
    const m = garment(p.color, "velvet");
    if (p.waist) { bandAround(j.pelvis, 0.15, PW + 0.03, PD + 0.03, m, 0.11); rbx(0.11, 0.28, 0.025, 0.01, m, { x: 0.24, y: 0.0, z: PD / 2 + 0.02, rz: 0.15, parent: j.pelvis }); return; }
    const w = p.thin ? 0.06 : 0.12, L = Math.hypot(TW, TH) + 0.04, a = Math.atan2(TW, TH) * 0.9;
    rbx(w, L, 0.025, 0.008, m, { y: TY, z: FZ + 0.06, rz: a, parent: j.spine }); rbx(w, L, 0.025, 0.008, m, { y: TY, z: -FZ - 0.06, rz: -a, parent: j.spine });
  },
  shawl(j, p) {
    const m = garment(p.color, p.knit ? "knit" : "cotton");
    rbx(TW + 0.1, 0.22, T.d + 0.08, 0.05, m, { y: TH - 0.06, parent: j.spine });
    rbx(0.56, 0.36, 0.035, 0.012, m, { y: 0.36, z: -FZ - 0.03, rx: 0.08, parent: j.spine });
    for (const s of [-1, 1]) rbx(0.14, 0.3, 0.03, 0.01, m, { x: s * 0.13, y: 0.38, z: FZ + 0.03, rz: s * 0.3, parent: j.spine });
    rbx(0.09, 0.09, 0.04, 0.02, flat(darker(p.color, 0.8)), { y: 0.28, z: FZ + 0.05, parent: j.spine });
  },
  scarf(j, p) {
    const m = garment(p.color, p.knit ? "knit" : "stripes");
    rbx(0.46, 0.09, T.d + 0.04, 0.035, m, { y: TH - 0.03, parent: j.spine });
    rbx(0.11, 0.32, 0.035, 0.012, m, { x: 0.12, y: 0.42, z: FZ + 0.03, rz: 0.08, parent: j.spine });
  },
  neckerchief(j, p) {
    const m = garment(p.color, "cotton");
    bandAround(j.spine, TH - 0.035, 0.42, T.d - 0.02, m, 0.06);
    rbx(0.17, 0.17, 0.025, 0.01, m, { y: 0.5, z: FZ + 0.01, rz: Math.PI / 4, parent: j.spine });
  },
  bowtie(j, p) {
    const m = shiny(p.color);
    for (const s of [-1, 1]) rbx(0.09, 0.08, 0.03, 0.012, m, { x: s * 0.055, y: 0.53, z: FZ + 0.02, rz: s * 0.25, parent: j.spine });
    rbx(0.04, 0.045, 0.035, 0.01, flat(darker(p.color, 0.75)), { y: 0.53, z: FZ + 0.025, parent: j.spine });
  },
  collar(j, p) {
    if (p.ring) { addMesh(cachedGeo("ocollarRing3", () => new THREE.TorusGeometry(0.2, 0.04, 8, 24)), metal(p.color), { y: TH, rx: Math.PI / 2, parent: j.spine }); return; }
    if (p.zip) { rbx(0.42, 0.08, T.d + 0.01, 0.02, flat(p.color), { y: TH - 0.02, parent: j.spine }); bx(0.016, TH - 0.08, 0.014, metal("#c8ced4"), { y: TY, z: FZ + 0.006, parent: j.spine }); return; }
    if (p.lace) { rbx(0.44, 0.06, T.d + 0.01, 0.02, flat(p.color), { y: TH - 0.02, parent: j.spine }); return; }
    const m = flat(p.color, 0.5);
    for (const s of [-1, 1]) rbx(0.13, p.round ? 0.07 : 0.08, 0.025, 0.008, m, { x: s * 0.085, y: TH - 0.05, z: FZ + 0.01, rz: p.round ? 0 : s * 0.5, parent: j.spine });
  },
  pearls(j, p) { const m = toy(p.color, { rough: 0.15 }); for (let k = 0; k < 11; k++) { const a = -0.9 + (k / 10) * 1.8; addMesh(sph(0.026), m, { x: Math.sin(a) * 0.19, y: TH - 0.02 - Math.cos(a) * 0.11 + 0.02, z: FZ + 0.015, parent: j.spine, shadow: false }); } },
  bones(j, p) { const m = flat(p.color, 0.6); for (let k = 0; k < 5; k++) { const a = -0.7 + (k / 4) * 1.4; rbx(0.035, 0.09, 0.03, 0.01, m, { x: Math.sin(a) * 0.17, y: TH - 0.06 - Math.cos(a) * 0.08 + 0.04, z: FZ + 0.015, rz: a, parent: j.spine }); } bandAround(j.spine, TH - 0.01, 0.36, T.d - 0.04, flat("#6b4a2b"), 0.03); },
  medal(j, p) {
    rbx(0.06, 0.15, 0.015, 0.005, flat("#c0392b"), { x: -0.2, y: 0.47, z: FZ + 0.008, parent: j.spine });
    addMesh(cyl(0.05, 0.05, 0.02, 18), metal(p.color), { x: -0.2, y: 0.37, z: FZ + 0.015, rx: Math.PI / 2, parent: j.spine, shadow: false });
  },
  chain(j, p) {
    const m = metal(p.color);
    for (let k = 0; k < 13; k++) { const a = -1.1 + (k / 12) * 2.2; rbx(0.05, 0.03, 0.025, 0.008, m, { x: Math.sin(a) * 0.25, y: TH - 0.02 - Math.cos(a) * 0.2 + 0.04, z: FZ + 0.015, rz: a, parent: j.spine }); }
    addMesh(cyl(0.065, 0.065, 0.025, 20), m, { y: 0.36, z: FZ + 0.02, rx: Math.PI / 2, parent: j.spine, shadow: false });
    addMesh(sph(0.03), shiny("#c0392b"), { y: 0.36, z: FZ + 0.035, parent: j.spine, shadow: false });
  },
  whistle(j, p) { for (const s of [-1, 1]) bx(0.02, 0.24, 0.014, flat("#2d3436"), { x: s * 0.07, y: 0.47, z: FZ + 0.008, rz: -s * 0.25, parent: j.spine }); rbx(0.1, 0.05, 0.05, 0.012, metal(p.color), { y: 0.35, z: FZ + 0.03, parent: j.spine }); },
  lanyard(j, p) { for (const s of [-1, 1]) bx(0.024, 0.26, 0.014, flat(p.color), { x: s * 0.07, y: 0.46, z: FZ + 0.008, rz: -s * 0.25, parent: j.spine }); rbx(0.12, 0.14, 0.015, 0.006, flat("#ffffff"), { y: 0.3, z: FZ + 0.012, parent: j.spine }); bx(0.12, 0.035, 0.016, flat(p.color), { y: 0.355, z: FZ + 0.014, parent: j.spine }); },
  stethoscope(j, p) {
    const m = toy(p.color, { rough: 0.35 });
    rbx(0.42, 0.04, T.d - 0.02, 0.015, m, { y: TH - 0.02, parent: j.spine });
    for (const s of [-1, 1]) rbx(0.03, 0.28, 0.03, 0.01, m, { x: s * 0.12, y: 0.45, z: FZ + 0.01, rz: s * 0.15, parent: j.spine });
    addMesh(cyl(0.045, 0.045, 0.03, 16), metal("#c8ced4"), { x: 0.14, y: 0.3, z: FZ + 0.02, rx: Math.PI / 2, parent: j.spine, shadow: false });
  },
  belt(j, p) {
    const m = p.rope ? flat(p.color, 0.7) : flat(p.color, 0.32);
    rbx(PW + 0.03, p.rope ? 0.045 : 0.08, PD + 0.03, 0.012, m, { y: BELT_Y, parent: j.pelvis });
    if (p.rope) rbx(0.05, 0.16, 0.025, 0.01, m, { x: 0.16, y: 0.11, z: PD / 2 + 0.02, parent: j.pelvis });
    else { rbx(0.12, 0.09, 0.03, 0.01, metal(p.buckle ?? "#e0b84a"), { y: BELT_Y, z: PD / 2 + 0.02, parent: j.pelvis }); bx(0.06, 0.04, 0.032, flat(p.color, 0.32), { y: BELT_Y, z: PD / 2 + 0.022, parent: j.pelvis }); }
    if (p.pouches) for (const s of [-1, 1]) rbx(0.12, 0.13, 0.09, 0.02, flat(p.color, 0.32), { x: s * 0.27, y: 0.11, z: 0.08, parent: j.pelvis });
  },
  toolbelt(j, p) {
    const lm = flat(p.color, 0.32);
    rbx(PW + 0.03, 0.09, PD + 0.03, 0.012, lm, { y: BELT_Y, parent: j.pelvis });
    for (const s of [-1, 1]) { rbx(0.17, 0.18, 0.11, 0.02, lm, { x: s * 0.28, y: 0.08, z: 0.1, parent: j.pelvis }); rbx(0.045, 0.16, 0.04, 0.01, flat("#c08a4f"), { x: s * 0.3, y: 0.22, z: 0.12, parent: j.pelvis }); }
    rbx(0.13, 0.055, 0.055, 0.015, metal("#7f8c8d"), { x: -0.3, y: 0.31, z: 0.12, parent: j.pelvis }); // the hammer head
    rbx(0.04, 0.18, 0.02, 0.008, metal("#c8ced4"), { x: 0.26, y: 0.22, z: 0.16, rz: 0.3, parent: j.pelvis }); // a wrench
  },
  satchel(j, p) {
    const lm = flat(p.color, 0.32), L = Math.hypot(TW, TH) + 0.04, a = Math.atan2(TW, TH) * 0.9;
    rbx(0.07, L, 0.025, 0.008, lm, { y: TY, z: FZ + 0.015, rz: -a, parent: j.spine }); rbx(0.07, L, 0.025, 0.008, lm, { y: TY, z: -FZ - 0.015, rz: a, parent: j.spine });
    rbx(0.12, 0.3, 0.36, 0.03, lm, { x: PW / 2 + 0.06, y: 0.02, z: 0.02, parent: j.pelvis });
    rbx(0.125, 0.13, 0.365, 0.02, flat(darker(p.color, 0.78), 0.32), { x: PW / 2 + 0.06, y: 0.12, z: 0.02, parent: j.pelvis });
    if (p.letter) bx(0.02, 0.12, 0.2, flat("#ffffff"), { x: PW / 2 + 0.05, y: 0.2, z: 0.03, parent: j.pelvis });
  },
  badge(j, p) {
    const m = metal(p.color);
    if (p.star) { for (const r of [0, Math.PI / 5 * 2.5]) rbx(0.085, 0.085, 0.015, 0.006, m, { x: -0.2, y: 0.44, z: FZ + 0.01, rz: r + Math.PI / 4, parent: j.spine }); }
    else rbx(0.085, 0.1, 0.015, 0.01, m, { x: -0.2, y: 0.44, z: FZ + 0.008, parent: j.spine });
  },
  pockets(j, p) { const m = flat(darker(p.color, 0.85)); for (const s of [-1, 1]) { rbx(0.16, 0.14, 0.02, 0.006, m, { x: s * 0.18, y: 0.4, z: FZ + 0.008, parent: j.spine }); rbx(0.17, 0.04, 0.025, 0.006, flat(darker(p.color, 0.7)), { x: s * 0.18, y: 0.47, z: FZ + 0.012, parent: j.spine }); } },
  buttons(j, p) { buttonsCol(j, p.color, { x: p.double ? -0.1 : 0, n: 4, clasp: !!p.clasps, z: FZ + 0.012 }); if (p.double) buttonsCol(j, p.color, { x: 0.1, n: 4, z: FZ + 0.012 }); },
  gloves(j, p) { const m = flat(p.color, 0.35); for (let i = 0; i < 2; i++) { rbx(BODY.HAND.w + 0.02, BODY.HAND.h + 0.02, BODY.HAND.d + 0.02, 0.03, m, { y: BODY.HAND.y, parent: j.hand[i] }); rbx(BODY.HAND.w + 0.04, 0.06, BODY.HAND.d + 0.04, 0.02, m, { y: 0.11, parent: j.hand[i] }); } },
  boots(j, p) { const m = flat(p.color, 0.32); for (let i = 0; i < 2; i++) { rbx(LW + 0.025, 0.28, LD + 0.025, 0.02, m, { y: -0.28, parent: j.knee[i] }); rbx(BODY.SHOE.w + 0.015, 0.14, BODY.SHOE.d + 0.01, 0.02, m, { y: -0.415, z: BODY.SHOE.z, parent: j.knee[i] }); rbx(LW + 0.04, 0.04, LD + 0.04, 0.012, flat(darker(p.color, 0.75), 0.32), { y: -0.14, parent: j.knee[i] }); } },
  stripes(j, p) {
    const m = toy(p.color, { rough: 0.35, metal: p.sport ? 0 : 0.25 });
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      if (p.sport) { bx(0.02, 0.44, 0.06, m, { x: s * (AW / 2 + 0.003), y: -0.085, parent: j.sh[i] }); bx(0.02, 0.24, 0.06, m, { x: s * (AW / 2), y: -0.12, parent: j.el[i] }); if (p.where === "all") { bx(0.02, 0.44, 0.06, m, { x: s * (LW / 2 + 0.003), y: -0.2, parent: j.hip[i] }); bx(0.02, 0.38, 0.06, m, { x: s * (LW / 2), y: -0.19, parent: j.knee[i] }); } }
      else { bx(AW + 0.012, 0.05, AD + 0.012, m, { y: -0.2, parent: j.sh[i] }); if (p.where === "all") { bx(AW + 0.008, 0.05, AD + 0.008, m, { y: -0.17, parent: j.el[i] }); bx(LW + 0.012, 0.06, LD + 0.012, m, { y: -0.26, parent: j.knee[i] }); } }
    }
    if (p.where === "all" && !p.sport) { bx(TW + 0.012, 0.06, T.d + 0.012, m, { y: 0.14, parent: j.spine }); }
  },
  patches(j, p) { rbx(0.14, 0.1, 0.015, 0.006, flat(p.color), { x: -0.2, y: 0.45, z: FZ + 0.008, parent: j.spine }); rbx(0.08, 0.06, 0.015, 0.006, flat("#ffffff"), { x: 0.2, y: 0.45, z: FZ + 0.008, parent: j.spine }); rbx(0.02, 0.1, 0.1, 0.006, flat(p.color), { x: -AW / 2 - 0.006, y: -0.08, parent: j.sh[0] }); rbx(0.02, 0.1, 0.1, 0.006, flat("#2e86de"), { x: AW / 2 + 0.006, y: -0.08, parent: j.sh[1] }); },
  epaulettes(j, p) { for (let i = 0; i < 2; i++) rbx(AW + 0.02, 0.04, AD + 0.02, 0.01, flat(p.color), { y: 0.135, parent: j.sh[i] }); },
  pack(j, p) { rbx(0.56, 0.56, 0.22, 0.05, garment(p.color, "canvas"), { y: TY, z: -FZ - 0.11, parent: j.spine }); for (const s of [-1, 1]) addMesh(cyl(0.05, 0.05, 0.1, 14), metal("#c8ced4"), { x: s * 0.16, y: TH + 0.02, z: -FZ - 0.11, parent: j.spine }); rbx(0.26, 0.1, 0.02, 0.006, flat("#2e86de"), { y: 0.4, z: -FZ - 0.225, parent: j.spine }); },
  pen(j, p) { rbx(0.024, 0.12, 0.024, 0.006, flat(p.color), { x: -0.2, y: 0.47, z: FZ + 0.02, parent: j.spine }); },
};
export const PART_KINDS = Object.freeze(Object.keys(PART_BUILD));

// ------------------------------------------------------------------------------------------------- head pieces
// head units (people.js): the head box 0.30 x 0.32 x 0.30 from y 0 to 0.32; the face sticker covers x +-0.14, y 0.01..0.29
// at z 0.151; hair reaches y ~0.40. hb: a hat's base (0.33 on the flattened hair) or the top of the hair for a piece that
// sits on it (crown, tiara, bow, bone, goggles; hair.js). Everything stands above the brows or beside / behind the face.
export const FACE_BOX = Object.freeze({ x: 0.135, y0: 0.02, y1: 0.265, z: 0.145 }); // the part of the face nothing may cover
export const HEAD_BUILD = {
  crown(h, c, hb) { const m = metal(c.color); for (const [x, z, w, d] of [[0, 0.17, 0.36, 0.035], [0, -0.17, 0.36, 0.035], [0.17, 0, 0.035, 0.36], [-0.17, 0, 0.035, 0.36]]) rbx(w, 0.11, d, 0.01, m, { x, y: hb + 0.055, z, parent: h }); for (const [x, z] of [[-0.12, 0.17], [0, 0.17], [0.12, 0.17], [-0.17, 0], [0.17, 0], [-0.12, -0.17], [0, -0.17], [0.12, -0.17]]) addMesh(cone(0.035, 0.09, 4), m, { x, y: hb + 0.15, z, parent: h }); for (const [x, col] of [[-0.08, "#e8365d"], [0.08, "#2e86de"], [0, "#20bf6b"]]) rbx(0.045, 0.045, 0.02, 0.01, shiny(col), { x, y: hb + 0.055, z: 0.19, parent: h }); },
  tiara(h, c, hb) { const m = metal(c.color), y = Math.max(hb, 0.33); rbx(0.35, 0.04, 0.03, 0.01, m, { y: y + 0.005, z: 0.19, parent: h }); addMesh(cone(0.05, 0.1, 4), m, { y: y + 0.07, z: 0.19, parent: h }); addMesh(sph(0.028), shiny("#e8365d"), { y: y + 0.045, z: 0.205, parent: h }); }, // in front of the hair's fringe
  tophat(h, c, hb) { const m = garment(c.color, "velvet"); rbx(0.46, 0.03, 0.44, 0.01, m, { y: hb + 0.01, parent: h }); rbx(0.3, 0.3, 0.29, 0.02, m, { y: hb + 0.17, parent: h }); if (c.band) rbx(0.305, 0.055, 0.295, 0.01, flat(c.band), { y: hb + 0.055, parent: h }); },
  chefhat(h, c, hb) { const m = flat(c.color, 0.5); rbx(0.34, 0.1, 0.34, 0.02, m, { y: hb + 0.045, parent: h }); rbx(0.42, 0.26, 0.42, 0.11, m, { y: hb + 0.22, parent: h }); },
  bakerhat(h, c, hb) { const m = flat(c.color, 0.5); rbx(0.34, 0.08, 0.34, 0.02, m, { y: hb + 0.035, parent: h }); rbx(0.4, 0.13, 0.4, 0.06, m, { y: hb + 0.13, parent: h }); },
  helmetKnight(h, c, hb) { // an open-face helmet: dome, brow band, cheek guards beside the face, a crest
    const pl = garment(c.color, "plate"), tr = metal(c.trim ?? "#e0b84a");
    rbx(0.38, 0.2, 0.38, 0.09, pl, { y: hb + 0.06, parent: h });
    rbx(0.38, 0.3, 0.06, 0.02, pl, { y: 0.19, z: -0.17, parent: h });
    for (const s of [-1, 1]) rbx(0.045, 0.27, 0.28, 0.015, pl, { x: s * 0.178, y: 0.17, z: -0.02, parent: h }); // cheek guards beside the face
    rbx(0.39, 0.045, 0.06, 0.012, tr, { y: hb - 0.005, z: 0.16, parent: h }); // the brow band, above the brows
    rbx(0.05, 0.05, 0.36, 0.015, tr, { y: hb + 0.17, parent: h });
    if (c.plume) for (let k = 0; k < 4; k++) rbx(0.07, 0.11, 0.09, 0.03, flat(c.plume, 0.55), { y: hb + 0.2 + k * 0.03, z: 0.05 - k * 0.065, rx: -0.4, parent: h });
  },
  hardhat(h, c, hb) { const m = shiny(c.color); rbx(0.36, 0.15, 0.36, 0.07, m, { y: hb + 0.065, parent: h }); rbx(0.43, 0.025, 0.46, 0.01, m, { y: hb, z: 0.02, parent: h }); rbx(0.05, 0.035, 0.37, 0.01, m, { y: hb + 0.15, parent: h }); },
  fireHelmet(h, c, hb) { const m = shiny(c.color); rbx(0.36, 0.16, 0.36, 0.07, m, { y: hb + 0.065, parent: h }); rbx(0.43, 0.025, 0.51, 0.01, m, { y: hb, z: -0.06, parent: h }); rbx(0.05, 0.05, 0.39, 0.012, m, { y: hb + 0.155, parent: h }); if (c.badge) rbx(0.12, 0.12, 0.025, 0.012, metal(c.badge), { y: hb + 0.085, z: 0.19, parent: h }); },
  peakedCap(h, c, hb) { const m = flat(c.color); rbx(0.34, 0.08, 0.34, 0.02, m, { y: hb + 0.035, parent: h }); rbx(0.39, 0.06, 0.39, 0.02, m, { y: hb + 0.1, parent: h }); rbx(0.29, 0.025, 0.13, 0.008, toy("#1e1e1e", { rough: 0.25 }), { y: hb, z: 0.21, rx: 0.15, parent: h }); if (c.badge) rbx(0.06, 0.06, 0.02, 0.01, metal(c.badge), { y: hb + 0.045, z: 0.175, parent: h }); },
  strawhat(h, c, hb) { const m = flat(c.color, 0.55); addMesh(cyl(0.32, 0.32, 0.025, 24), m, { y: hb, parent: h }); rbx(0.31, 0.14, 0.31, 0.05, m, { y: hb + 0.075, parent: h }); if (c.band) rbx(0.315, 0.04, 0.315, 0.01, flat(c.band), { y: hb + 0.035, parent: h }); },
  cowboy(h, c, hb) { const m = flat(c.color, 0.4); rbx(0.52, 0.025, 0.48, 0.01, m, { y: hb, parent: h }); for (const s of [-1, 1]) rbx(0.09, 0.025, 0.48, 0.01, m, { x: s * 0.28, y: hb + 0.035, rz: s * 0.6, parent: h }); rbx(0.31, 0.17, 0.28, 0.04, m, { y: hb + 0.085, parent: h }); rbx(0.315, 0.04, 0.285, 0.01, flat("#2d1f14"), { y: hb + 0.035, parent: h }); },
  tricorn(h, c, hb) { const m = garment(c.color, "velvet"); rbx(0.31, 0.11, 0.31, 0.035, m, { y: hb + 0.055, parent: h }); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const g = new THREE.Group(); g.rotation.y = a; g.position.y = hb + 0.065; h.add(g); rbx(0.42, 0.11, 0.035, 0.012, m, { z: 0.18, rx: -0.35, parent: g }); if (c.trim) bx(0.42, 0.02, 0.04, metal(c.trim), { y: 0.055, z: 0.163, rx: -0.35, parent: g }); } },
  wizard(h, c, hb) { const m = garment(c.color, "stars"); rbx(0.52, 0.025, 0.52, 0.01, m, { y: hb, parent: h }); for (let k = 0; k < 4; k++) rbx(0.3 - k * 0.065, 0.14, 0.3 - k * 0.065, 0.03, m, { y: hb + 0.075 + k * 0.125, z: -k * 0.025, rx: -0.08 * k, parent: h }); if (c.band) rbx(0.305, 0.045, 0.305, 0.01, metal(c.band), { y: hb + 0.035, parent: h }); },
  beret(h, c, hb) { const m = flat(c.color, 0.55); rbx(0.39, 0.09, 0.37, 0.04, m, { x: 0.02, y: hb + 0.025, rz: 0.18, parent: h }); rbx(0.035, 0.05, 0.035, 0.01, m, { y: hb + 0.09, parent: h }); },
  flatcap(h, c, hb) { const m = flat(c.color, 0.55); rbx(0.35, 0.085, 0.36, 0.035, m, { y: hb + 0.025, z: -0.005, parent: h }); rbx(0.29, 0.03, 0.11, 0.01, m, { y: hb - 0.005, z: 0.2, rx: 0.2, parent: h }); },
  sunhat(h, c, hb) { const m = flat(c.color, c.fisher ? 0.35 : 0.55); addMesh(cyl(c.fisher ? 0.27 : 0.34, c.fisher ? 0.31 : 0.34, 0.03, 24), m, { y: hb, z: c.fisher ? -0.03 : 0, parent: h }); rbx(0.31, 0.13, 0.31, 0.055, m, { y: hb + 0.075, parent: h }); if (c.band) rbx(0.315, 0.04, 0.315, 0.01, flat(c.band), { y: hb + 0.035, parent: h }); },
  pirateBandana(h, c, hb) { const m = garment(c.color, "dots"); rbx(0.34, 0.11, 0.34, 0.045, m, { y: hb + 0.015, parent: h }); rbx(0.08, 0.07, 0.07, 0.025, m, { y: hb - 0.02, z: -0.19, parent: h }); for (const s of [-1, 1]) rbx(0.05, 0.13, 0.025, 0.01, m, { x: s * 0.035, y: hb - 0.1, z: -0.2, rz: s * 0.3, parent: h }); },
  vikingHelmet(h, c, hb) { const m = garment(c.color, "plate"); rbx(0.36, 0.17, 0.36, 0.08, m, { y: hb + 0.055, parent: h }); rbx(0.37, 0.045, 0.37, 0.012, metal("#c08a3a"), { y: hb - 0.005, parent: h }); for (const s of [-1, 1]) addMesh(cone(0.04, 0.17, 10), flat("#f2ead6", 0.4), { x: s * 0.21, y: hb + 0.13, rz: -s * 0.6, parent: h }); },
  safari(h, c, hb) { const m = flat(c.color, 0.5); rbx(0.35, 0.15, 0.37, 0.075, m, { y: hb + 0.065, parent: h }); rbx(0.47, 0.025, 0.49, 0.01, m, { y: hb, parent: h }); if (c.band) rbx(0.355, 0.035, 0.375, 0.01, flat(c.band), { y: hb + 0.03, parent: h }); },
  bone(h, c, hb) { const m = flat(c.color, 0.5); hb = Math.max(hb, 0.33) + 0.06; rbx(0.27, 0.05, 0.05, 0.02, m, { y: hb + 0.045, rz: 0.4, parent: h }); for (const s of [-1, 1]) for (const d of [-1, 1]) addMesh(sph(0.03), m, { x: s * 0.135 * Math.cos(0.4), y: hb + 0.045 + s * 0.135 * Math.sin(0.4) + d * 0.018, parent: h }); },
  bow(h, c, hb) { const m = shiny(c.color), y = Math.max(hb, 0.33) + 0.075; for (const s of [-1, 1]) rbx(0.1, 0.08, 0.04, 0.015, m, { x: 0.1 + s * 0.055, y, z: 0.08, rz: s * 0.3, parent: h }); rbx(0.045, 0.05, 0.05, 0.01, flat(darker(c.color, 0.75)), { x: 0.1, y, z: 0.08, parent: h }); }, // on top of the hair
  goggles(h, c, hb) { // ON the forehead / hair, above the brows
    const strap = flat("#3d2b1f", 0.5);
    rbx(0.36, 0.04, 0.36, 0.01, strap, { y: hb + 0.005, parent: h });
    for (const s of [-1, 1]) { addMesh(cyl(0.055, 0.055, 0.04, 18), metal(c.color), { x: s * 0.07, y: hb + 0.035, z: 0.19, rx: Math.PI / 2, parent: h }); addMesh(cyl(0.042, 0.042, 0.042, 18), cachedMat("ogoggleLens3", () => new THREE.MeshStandardMaterial({ color: "#9fd8ff", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 })), { x: s * 0.07, y: hb + 0.035, z: 0.193, rx: Math.PI / 2, parent: h, shadow: false }); }
  },
  cap(h, c, hb) { const m = flat(c.color); rbx(0.34, 0.13, 0.34, 0.035, m, { y: hb + 0.05, parent: h }); rbx(0.3, 0.03, 0.17, 0.01, m, { y: hb, z: 0.23, parent: h }); rbx(0.045, 0.035, 0.045, 0.01, flat(darker(c.color, 0.7)), { y: hb + 0.12, parent: h }); },
  beanie(h, c, hb) { const m = flat(c.color, 0.55); rbx(0.35, 0.17, 0.35, 0.06, m, { y: hb + 0.065, parent: h }); rbx(0.36, 0.055, 0.36, 0.02, flat(darker(c.color, 0.8), 0.55), { y: hb, parent: h }); addMesh(sph(0.05), m, { y: hb + 0.17, parent: h }); },
};
export const HEAD_KINDS = Object.freeze(Object.keys(HEAD_BUILD));

/**
 * Dresses a person: look.parts (each { part, color, ... }) and look.ohead ({ kind, color, ... }) onto the rig joints
 * (people.js makePerson's joints + flaps / cape slots). hb: where the head piece's base sits (hair.js buildHair).
 * -> { parts: n, head: kind | null }
 */
export function dressPerson(j, look, { hb = 0.33 } = {}) {
  j.flaps ??= []; j.cape ??= null;
  let n = 0;
  for (const p of look.parts ?? []) { const f = PART_BUILD[p.part]; if (f) { f(j, p, look); n++; } }
  const hk = look.ohead?.kind;
  if (hk && HEAD_BUILD[hk]) {
    const g = new THREE.Group(); g.name = `ohead:${hk}`; j.head.add(g); j.ohead = g;
    HEAD_BUILD[hk](g, look.ohead, hb);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  }
  return { parts: n, head: hk ?? null };
}

/** after the pose: the front flaps follow the most forward thigh, the back flaps the most backward one, the cape swings */
export function animateOutfit(j) {
  if (!j.flaps?.length && !j.cape) return;
  const a = j.hip[0].rotation.x, b = j.hip[1].rotation.x;
  const fwd = Math.min(0, a, b), back = Math.max(0, a, b);
  for (const f of j.flaps) f.rotation.x = f.userData.flap === "front" ? Math.max(-1.5, fwd * 0.95) : Math.min(1.2, back * 0.95);
  if (j.cape) j.cape.rotation.x = 0.06 + back * 0.6 + Math.max(0, -j.spine.rotation.x) * 0.5 + (fwd < -1 ? 0.5 : 0);
}
