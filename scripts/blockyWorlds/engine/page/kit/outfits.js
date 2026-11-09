// Blocky Worlds OUTFITS: the builder (CHARACTERS-V2, 2026-11-09). Layered boxes on the people.js rig in our blocky
// style: rich colours, procedural canvas fabrics (velvet, chainmail, canvas, linen, knit, tweed, ermine, armour plate,
// straw, quilting, stars, checks), pockets, buttons, belts, fur, armour plates; head pieces sit ABOVE the brows (y >= the
// hairline) or beside / behind the face, never over it (dev/charactersV2.test.mjs measures it for every outfit).
//   garment(color, kind)                  a fabric material (the outfit kinds + kitCommon's own)
//   dressPerson(joints, look, dims)       adds the look.parts + look.ohead meshes to the rig; returns { flaps, cape }
//   animateOutfit(joints)                 after posePerson: apron / tail flaps follow the thighs, the cape swings
//   HEAD_KINDS, PART_KINDS                what can be built
import * as THREE from "three";
import { rng, hashSeed, fabric, solid, darker, rbx, bx, addMesh, cachedGeo, cachedMat } from "./kitCommon.js";

// ------------------------------------------------------------------------------------------------- fabrics
const OWN = new Set(["velvet", "chainmail", "check", "canvas", "linen", "knit", "stars", "tweed", "ermine", "plate", "straw", "quilt", "flour", "paint"]);
function tex(color, kind) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d");
  const R = rng(hashSeed(`${color}/${kind}/o`));
  const base = new THREE.Color(color), tmp = new THREE.Color();
  const shade = (k) => `#${tmp.copy(base).multiplyScalar(k).getHexString()}`;
  p.fillStyle = kind === "ermine" ? "#f7f5ef" : color; p.fillRect(0, 0, 128, 128);
  const speck = (n, a, b, w = 2, h = 2) => { for (let i = 0; i < n; i++) { p.fillStyle = shade(a + R() * (b - a)); p.fillRect(R() * 128, R() * 128, w, h); } };
  switch (kind) {
    case "velvet": { speck(900, 0.8, 1.1, 3, 3); const g = p.createLinearGradient?.(0, 0, 128, 128); if (g?.addColorStop) { g.addColorStop(0, "rgba(255,255,255,0.12)"); g.addColorStop(0.5, "rgba(0,0,0,0.1)"); g.addColorStop(1, "rgba(255,255,255,0.1)"); p.fillStyle = g; p.fillRect(0, 0, 128, 128); } break; }
    case "chainmail": { p.strokeStyle = shade(0.6); p.lineWidth = 1.6; for (let y = 0; y < 136; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 136; x += 8) { p.beginPath(); p.arc(x, y, 3.6, 0, Math.PI * 2); p.stroke(); } p.fillStyle = "rgba(255,255,255,0.18)"; for (let y = 0; y < 128; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 128; x += 8) p.fillRect(x - 2, y - 3, 2, 1.5); break; }
    case "check": { p.fillStyle = "#f2f2f2"; for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < 128; x += 32) p.fillRect(x, y, 16, 16); break; }
    case "canvas": case "linen": { speck(1400, 0.86, 1.08, kind === "canvas" ? 2 : 3, 1); p.strokeStyle = "rgba(0,0,0,0.07)"; for (let y = 0; y < 128; y += kind === "canvas" ? 3 : 4) { p.beginPath(); p.moveTo(0, y); p.lineTo(128, y); p.stroke(); } for (let x = 0; x < 128; x += 4) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x, 128); p.stroke(); } break; }
    case "knit": { p.strokeStyle = shade(0.72); p.lineWidth = 2; for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) { p.beginPath(); p.moveTo(x, y); p.lineTo(x + 4, y + 6); p.lineTo(x + 8, y); p.stroke(); } break; }
    case "stars": { speck(500, 0.85, 1.05, 3, 3); for (let i = 0; i < 9; i++) { const x = R() * 128, y = R() * 128, r = 4 + R() * 5; p.fillStyle = i % 3 ? "#f7d038" : "#ffffff"; p.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.42 : r; p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } p.closePath(); p.fill(); } break; }
    case "tweed": { speck(1800, 0.7, 1.25, 2, 1); for (let i = 0; i < 260; i++) { p.fillStyle = R() < 0.5 ? "rgba(255,240,200,0.35)" : "rgba(60,30,20,0.3)"; p.fillRect(R() * 128, R() * 128, 1.5, 1.5); } break; }
    case "ermine": { p.fillStyle = "#1e1e1e"; for (let i = 0; i < 18; i++) { const x = (i % 6) * 22 + ((i / 6) | 0) % 2 * 11 + 6, y = ((i / 6) | 0) * 42 + 12; p.beginPath(); p.moveTo(x, y); p.lineTo(x - 4, y + 14); p.lineTo(x + 4, y + 14); p.closePath(); p.fill(); } break; }
    case "plate": { speck(700, 0.85, 1.15, 4, 1); p.fillStyle = "rgba(255,255,255,0.22)"; p.fillRect(0, 10, 128, 6); p.fillStyle = "rgba(0,0,0,0.18)"; p.fillRect(0, 60, 128, 3); p.fillStyle = shade(0.55); for (const [x, y] of [[8, 8], [120, 8], [8, 120], [120, 120], [64, 8], [64, 120]]) { p.beginPath(); p.arc(x, y, 3.5, 0, Math.PI * 2); p.fill(); } break; }
    case "straw": { p.strokeStyle = shade(0.75); p.lineWidth = 2; for (let y = 0; y < 128; y += 6) { p.beginPath(); p.moveTo(0, y); p.lineTo(128, y + 2); p.stroke(); } p.strokeStyle = shade(1.15); p.lineWidth = 1; for (let x = 0; x < 128; x += 6) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x + 2, 128); p.stroke(); } break; }
    case "quilt": { speck(500, 0.9, 1.05, 2, 2); p.fillStyle = shade(0.72); for (let y = 0; y < 128; y += 21) p.fillRect(0, y, 128, 3); p.fillStyle = "rgba(255,255,255,0.18)"; for (let y = 5; y < 128; y += 21) p.fillRect(0, y, 128, 5); break; }
    case "flour": { speck(300, 0.92, 1.04, 2, 2); p.fillStyle = "rgba(255,255,255,0.75)"; for (let i = 0; i < 14; i++) { p.beginPath(); p.ellipse?.(R() * 128, R() * 128, 4 + R() * 7, 3 + R() * 4, R() * 3, 0, Math.PI * 2); p.fill(); } break; }
    case "paint": { speck(300, 0.92, 1.04, 2, 2); const pc = ["#e74c3c", "#2e86de", "#f7d038", "#20bf6b", "#8854d0", "#ff7a1a"]; for (let i = 0; i < 16; i++) { p.fillStyle = pc[i % pc.length]; p.beginPath(); p.arc(R() * 128, R() * 128, 3 + R() * 5, 0, Math.PI * 2); p.fill(); } break; }
    default: speck(900, 0.9, 1.08);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** a garment material: the outfit fabrics here, everything else kitCommon's fabric (cotton, stripes, plaid, denim, fur...) */
export function garment(color, kind = "cotton") {
  if (!OWN.has(kind)) return fabric(color, kind);
  return cachedMat(`og${color}/${kind}`, () => new THREE.MeshStandardMaterial({ map: tex(color, kind), roughness: kind === "plate" ? 0.35 : kind === "velvet" ? 0.95 : kind === "chainmail" ? 0.5 : 0.85, metalness: kind === "plate" ? 0.65 : kind === "chainmail" ? 0.45 : 0 }));
}
const metal = (c) => solid(c, { metalness: 0.75, roughness: 0.3 });
const shiny = (c) => solid(c, { roughness: 0.35 });
const sph = (r) => cachedGeo(`osph${r}`, () => new THREE.SphereGeometry(r, 10, 8));
const cyl = (r1, r2, h, s = 14) => cachedGeo(`ocyl${r1},${r2},${h},${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const cone = (r, h, s = 12) => cachedGeo(`ocone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const R0 = 0.01;

// ------------------------------------------------------------------------------------------------- body parts
// rig numbers (people.js): torso 0.48 x 0.5 x 0.26 at spine y 0.27; pelvis box 0.42 x 0.2 x 0.24 at y 0.09, belt y 0.17;
// upper arm 0.15 x 0.3 x 0.17 at sh y -0.15; forearm 0.14 x 0.27 x 0.16 at el y -0.135; thigh at hip y -0.21; shin at knee y -0.19
function flap(j, side, y = 0.17) { const g = new THREE.Group(); g.position.set(0, y, side === "front" ? 0.13 : -0.13); g.userData.flap = side; j.pelvis.add(g); j.flaps.push(g); return g; }
function torsoShell(j, mat, { open = false, front = true, w = 0.52, d = 0.3, h = 0.5, y = 0.27 } = {}) {
  bx(w, h, 0.05, mat, { y, z: -d / 2 + 0.025, parent: j.spine });
  for (const s of [-1, 1]) bx(0.05, h, d, mat, { x: s * (w / 2 - 0.025), y, parent: j.spine });
  if (front) for (const s of [-1, 1]) bx(open ? 0.15 : w / 2, h, 0.04, mat, { x: s * (open ? w / 2 - 0.075 : w / 4), y, z: d / 2 - 0.02, parent: j.spine });
}
function sleeves(j, mat, { cuff = null, wide = false } = {}) {
  for (let i = 0; i < 2; i++) {
    rbx(0.172, 0.31, 0.192, R0, mat, { y: -0.15, parent: j.sh[i] });
    rbx(wide ? 0.22 : 0.162, 0.25, wide ? 0.24 : 0.182, R0, mat, { y: wide ? -0.16 : -0.12, parent: j.el[i] });
    if (cuff) bx(wide ? 0.23 : 0.17, 0.05, wide ? 0.25 : 0.19, cuff, { y: -0.25, parent: j.el[i] });
  }
}
function buttonsCol(j, color, { x = 0, n = 4, z = 0.152, y0 = 0.44, dy = 0.1, clasp = false } = {}) {
  const m = shiny(color);
  for (let k = 0; k < n; k++) clasp ? bx(0.07, 0.025, 0.02, m, { x, y: y0 - k * dy, z, parent: j.spine }) : addMesh(cyl(0.018, 0.018, 0.012, 10), m, { x, y: y0 - k * dy, z, rx: Math.PI / 2, parent: j.spine, shadow: false });
}
function bandAround(parent, y, w, d, mat, h = 0.05) { bx(w, h, d, mat, { y, parent }); }

export const PART_BUILD = {
  jacket(j, p, o) {
    const m = garment(p.color, p.casual ? "canvas" : "cotton");
    torsoShell(j, m, { open: true });
    for (const s of [-1, 1]) rbx(0.07, 0.24, 0.02, 0.005, solid(darker(p.color, 0.8)), { x: s * 0.085, y: 0.38, z: 0.165, rz: s * 0.32, parent: j.spine }); // lapels
    sleeves(j, m, { cuff: solid(darker(p.color, 0.8)) });
    if (!p.casual) buttonsCol(j, "#2d3436", { x: 0.12, n: 2, y0: 0.24, z: 0.155 });
  },
  coatLong(j, p, o) {
    const m = garment(p.color, "velvet");
    torsoShell(j, m, { open: true });
    sleeves(j, m, { cuff: p.trim ? metal(p.trim) : solid(darker(p.color, 0.75)) });
    const back = flap(j, "back", 0.1); bx(0.5, 0.52, 0.04, m, { y: -0.26, z: -0.03, parent: back });
    for (const s of [-1, 1]) bx(0.04, 0.5, 0.24, m, { x: s * 0.25, y: -0.16, parent: j.pelvis });
    if (p.trim) { for (const s of [-1, 1]) bx(0.03, 0.5, 0.03, metal(p.trim), { x: s * 0.13, y: 0.27, z: 0.155, parent: j.spine }); bx(0.5, 0.03, 0.045, metal(p.trim), { y: -0.51, z: -0.03, parent: back }); }
    buttonsCol(j, p.trim ?? "#d4a017", { x: 0.18, n: 4 });
  },
  labcoat(j, p) {
    const m = garment(p.color, "canvas");
    torsoShell(j, m, { open: true, w: 0.53, d: 0.31 });
    for (const s of [-1, 1]) rbx(0.08, 0.22, 0.02, 0.005, m, { x: s * 0.09, y: 0.39, z: 0.168, rz: s * 0.3, parent: j.spine });
    sleeves(j, m, {});
    const back = flap(j, "back", 0.12); bx(0.52, 0.56, 0.04, m, { y: -0.27, z: -0.03, parent: back });
    for (const s of [-1, 1]) { const f = flap(j, "front", 0.12); f.position.x = s * 0.19; bx(0.13, 0.56, 0.035, m, { y: -0.27, z: 0.025, parent: f }); bx(0.1, 0.09, 0.02, solid(darker(p.color, 0.88)), { y: -0.2, z: 0.045, parent: f }); }
    for (const s of [-1, 1]) bx(0.04, 0.54, 0.25, m, { x: s * 0.255, y: -0.17, parent: j.pelvis });
    bx(0.11, 0.1, 0.02, solid(darker(p.color, 0.9)), { x: -0.16, y: 0.36, z: 0.17, parent: j.spine }); // chest pocket
    buttonsCol(j, "#c8ced4", { x: 0.2, n: 3, y0: 0.36, z: 0.162 });
  },
  apron(j, p) {
    const kind = p.flour ? "flour" : p.paint ? "paint" : p.stripes ? "stripes" : "canvas", m = garment(p.color, kind);
    if (!p.half) bx(0.3, 0.26, 0.02, m, { y: 0.34, z: 0.145, parent: j.spine });
    if (!p.half) for (const s of [-1, 1]) bx(0.03, 0.2, 0.02, m, { x: s * 0.13, y: 0.55, z: 0.06, rx: -0.5, parent: j.spine });
    bx(0.5, 0.04, 0.28, m, { y: 0.06, parent: j.spine }); // the ties round the waist
    const f = flap(j, "front", 0.17); bx(0.4, p.long ? 0.62 : 0.46, 0.025, m, { y: p.long ? -0.31 : -0.23, z: 0.025, parent: f });
    if (p.pocket) bx(0.2, 0.09, 0.02, solid(darker(p.color, 0.85)), { y: -0.15, z: 0.045, parent: f });
    if (p.long) { const b = flap(j, "back", 0.17); bx(0.44, 0.5, 0.025, m, { y: -0.25, z: -0.02, parent: b }); }
  },
  robe(j, p, o) {
    const m = garment(p.color, "stars");
    torsoShell(j, m, { w: 0.52, d: 0.3 });
    sleeves(j, m, { wide: true, cuff: p.stars ? metal(p.stars) : null });
    if (j.skirt) { rbx(0.56, 0.86, 0.34, R0, m, { y: -0.44, parent: j.skirt }); if (p.stars) bx(0.57, 0.05, 0.35, metal(p.stars), { y: -0.85, parent: j.skirt }); }
    for (const s of [-1, 1]) rbx(0.06, 0.06, 0.03, 0.01, metal(p.stars ?? "#d4a017"), { x: s * 0.06, y: 0.48, z: 0.16, parent: j.spine });
  },
  cape(j, p, o) {
    const g = new THREE.Group(); g.position.set(0, 0.5, -0.15); j.spine.add(g); j.cape = g;
    const L = p.tall ? 1.05 : 0.98;
    rbx(0.58, L, 0.035, 0.008, garment(p.color, "velvet"), { y: -L / 2, z: -0.02, parent: g });
    if (p.lining) bx(0.54, L - 0.04, 0.01, solid(p.lining, { roughness: 0.4 }), { y: -L / 2, z: 0.002, parent: g });
    if (p.trim === "ermine") { bx(0.6, 0.1, 0.045, garment("#ffffff", "ermine"), { y: -L + 0.04, z: -0.02, parent: g }); rbx(0.6, 0.12, 0.36, 0.03, garment("#ffffff", "ermine"), { y: 0.03, z: 0.13, parent: g }); }
    if (p.collar) { // an upright collar behind the neck (never in front of the face)
      const cm = p.lining ? solid(p.lining, { roughness: 0.4 }) : garment(p.color, "velvet");
      for (const s of [-1, 1]) bx(0.2, p.tall ? 0.3 : 0.18, 0.03, cm, { x: s * 0.12, y: p.tall ? 0.16 : 0.1, z: -0.02, ry: s * 0.5, rx: -0.25, parent: g });
    }
  },
  armor(j, p) {
    const pl = garment(p.color, "plate");
    rbx(0.54, 0.44, 0.31, 0.03, pl, { y: 0.3, parent: j.spine });
    rbx(0.3, 0.07, 0.24, 0.02, pl, { y: 0.55, parent: j.spine }); // gorget
    for (let i = 0; i < 2; i++) {
      rbx(0.24, 0.12, 0.24, 0.04, pl, { y: -0.01, parent: j.sh[i] }); rbx(0.22, 0.05, 0.22, 0.02, pl, { y: -0.09, parent: j.sh[i] });
      rbx(0.17, 0.17, 0.19, 0.02, pl, { y: -0.16, parent: j.el[i] });
      rbx(0.21, 0.3, 0.24, 0.02, pl, { y: -0.21, parent: j.knee[i] }); rbx(0.17, 0.1, 0.1, 0.03, pl, { y: 0.0, z: 0.1, parent: j.knee[i] });
    }
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.12); rbx(0.42, 0.2, 0.03, 0.01, pl, { y: -0.1, z: side === "front" ? 0.03 : -0.03, parent: f }); }
  },
  tabard(j, p) {
    const m = garment(p.color, "canvas");
    bx(0.3, 0.46, 0.02, m, { y: 0.28, z: 0.168, parent: j.spine }); bx(0.3, 0.46, 0.02, m, { y: 0.28, z: -0.168, parent: j.spine });
    const f = flap(j, "front", 0.12); bx(0.3, 0.32, 0.02, m, { y: -0.16, z: 0.055, parent: f });
    const b = flap(j, "back", 0.12); bx(0.3, 0.32, 0.02, m, { y: -0.16, z: -0.055, parent: b });
    if (p.emblem) { const e = shiny(p.emblem); bx(0.05, 0.2, 0.012, e, { y: 0.3, z: 0.18, parent: j.spine }); bx(0.16, 0.05, 0.012, e, { y: 0.34, z: 0.18, parent: j.spine }); }
  },
  tunic(j, p) {
    const m = garment(p.color, "linen");
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.15); bx(0.46, 0.34, 0.03, m, { y: -0.17, z: side === "front" ? 0.02 : -0.02, parent: f }); }
    for (const s of [-1, 1]) bx(0.03, 0.3, 0.24, m, { x: s * 0.235, y: -0.02, parent: j.pelvis });
    bx(0.12, 0.14, 0.02, solid("#f5ecd7"), { y: 0.46, z: 0.137, parent: j.spine }); // the lacing panel
    for (let k = 0; k < 3; k++) bx(0.1, 0.012, 0.012, solid("#5a3b24"), { y: 0.42 + k * 0.035, z: 0.15, rz: 0.4 * (k % 2 ? 1 : -1), parent: j.spine });
  },
  pelt(j, p) {
    const m = fabric(p.color, "fur");
    if (p.shoulders) { // a fur mantle over both shoulders
      rbx(0.62, 0.12, 0.36, 0.04, m, { y: 0.5, parent: j.spine });
      for (let i = 0; i < 2; i++) rbx(0.22, 0.1, 0.24, 0.04, m, { y: 0.0, parent: j.sh[i] });
      return;
    }
    rbx(0.58, 0.22, 0.3, 0.03, m, { y: 0.3, rz: 0.62, parent: j.spine }); // one-shoulder wrap, diagonally
    rbx(0.52, 0.28, 0.3, 0.03, m, { y: 0.13, parent: j.spine });
    for (const side of ["front", "back"]) { const f = flap(j, side, 0.15); bx(0.46, 0.22, 0.04, m, { y: -0.13, z: side === "front" ? 0.02 : -0.02, parent: f }); for (const x of [-0.15, 0, 0.15]) bx(0.1, 0.08, 0.04, m, { x, y: -0.27, z: side === "front" ? 0.02 : -0.02, rz: 0.785, parent: f }); }
  },
  overalls(j, p) {
    const m = fabric(p.color, "denim");
    bx(0.3, 0.24, 0.02, m, { y: 0.14, z: 0.137, parent: j.spine }); bx(0.14, 0.08, 0.02, solid(darker(p.color, 0.8)), { y: 0.18, z: 0.149, parent: j.spine });
    for (const s of [-1, 1]) { bx(0.05, 0.36, 0.02, m, { x: s * 0.11, y: 0.38, z: 0.137, parent: j.spine }); bx(0.05, 0.5, 0.02, m, { x: s * 0.11, y: 0.3, z: -0.137, parent: j.spine }); bx(0.05, 0.03, 0.27, m, { x: s * 0.11, y: 0.535, parent: j.spine }); addMesh(cyl(0.022, 0.022, 0.012, 10), metal("#d4a017"), { x: s * 0.11, y: 0.25, z: 0.152, rx: Math.PI / 2, parent: j.spine, shadow: false }); }
  },
  hivis(j, p) {
    const m = garment(p.color, "canvas"), strip = solid("#e8eef2", { metalness: 0.4, roughness: 0.25 });
    torsoShell(j, m, { open: true, w: 0.52, d: 0.29, h: 0.46, y: 0.26 });
    for (const y of [0.14, 0.3]) { bx(0.535, 0.035, 0.05, strip, { y, z: -0.13, parent: j.spine }); for (const s of [-1, 1]) bx(0.155, 0.035, 0.012, strip, { x: s * 0.185, y, z: 0.148, parent: j.spine }); }
  },
  cardigan(j, p) {
    const m = garment(p.color, "knit");
    torsoShell(j, m, { open: true, w: 0.52, d: 0.29 });
    sleeves(j, m, { cuff: solid(darker(p.color, 0.82)) });
    if (p.buttons) buttonsCol(j, "#f5f5f0", { x: 0.09, n: 4, z: 0.15 });
    if (p.patches) for (let i = 0; i < 2; i++) rbx(0.1, 0.1, 0.02, 0.02, solid("#7b4a2a", { roughness: 0.9 }), { y: -0.05, z: -0.095, parent: j.el[i] });
  },
  hoodie(j, p, o) {
    const m = garment(p.color, "cotton");
    rbx(0.38, 0.17, 0.16, 0.05, m, { y: 0.56, z: -0.18, parent: j.spine }); // the hood, down at the back
    bx(0.3, 0.13, 0.02, solid(darker(p.color, 0.85)), { y: 0.12, z: 0.137, parent: j.spine }); // pocket
    for (const s of [-1, 1]) bx(0.018, 0.13, 0.012, solid("#f5f5f0"), { x: s * 0.05, y: 0.43, z: 0.14, parent: j.spine });
    bandAround(j.spine, 0.03, 0.49, 0.27, solid(darker(p.color, 0.8)), 0.04);
  },
  overshirt(j, p) {
    const m = fabric(p.color, "plaid");
    torsoShell(j, m, { open: true, w: 0.515, d: 0.285 });
    sleeves(j, m, { cuff: solid(darker(p.color, 0.8)) });
    for (const s of [-1, 1]) rbx(0.07, 0.16, 0.02, 0.005, m, { x: s * 0.1, y: 0.44, z: 0.16, rz: s * 0.3, parent: j.spine });
  },
  vest(j, p) {
    const kind = p.leather ? "leather" : p.tweed ? "tweed" : p.puffer ? "quilt" : "cotton";
    const m = kind === "leather" ? fabric(p.color, "leather") : garment(p.color, kind);
    torsoShell(j, m, { open: !!p.leather, w: 0.515, d: 0.29, h: p.puffer ? 0.5 : 0.46, y: p.puffer ? 0.27 : 0.25 });
    if (!p.leather) for (const s of [-1, 1]) rbx(0.06, 0.14, 0.015, 0.004, solid(darker(p.color, 0.8)), { x: s * 0.07, y: 0.44, z: 0.152, rz: s * 0.35, parent: j.spine });
    if (p.puffer) for (let i = 0; i < 2; i++) bx(0.17, 0.06, 0.19, m, { y: 0.02, parent: j.sh[i] });
  },
  sash(j, p) {
    const m = garment(p.color, "velvet");
    if (p.waist) { bandAround(j.pelvis, 0.15, 0.45, 0.27, m, 0.09); bx(0.08, 0.22, 0.02, m, { x: 0.17, y: 0.02, z: 0.13, rz: 0.15, parent: j.pelvis }); return; }
    const w = p.thin ? 0.05 : 0.1;
    bx(w, 0.72, 0.02, m, { y: 0.28, z: 0.152, rz: 0.62, parent: j.spine }); bx(w, 0.72, 0.02, m, { y: 0.28, z: -0.152, rz: -0.62, parent: j.spine });
  },
  shawl(j, p) {
    const m = garment(p.color, p.knit ? "knit" : "cotton");
    rbx(0.56, 0.2, 0.32, 0.04, m, { y: 0.45, parent: j.spine });
    bx(0.4, 0.32, 0.03, m, { y: 0.3, z: -0.16, rx: 0.08, parent: j.spine });
    for (const s of [-1, 1]) bx(0.1, 0.24, 0.025, m, { x: s * 0.09, y: 0.32, z: 0.155, rz: s * 0.3, parent: j.spine });
    rbx(0.07, 0.07, 0.04, 0.02, solid(darker(p.color, 0.8)), { y: 0.24, z: 0.17, parent: j.spine });
  },
  scarf(j, p) {
    const m = garment(p.color, p.knit ? "knit" : "stripes");
    rbx(0.3, 0.08, 0.3, 0.03, m, { y: 0.55, parent: j.spine });
    bx(0.08, 0.26, 0.03, m, { x: 0.08, y: 0.4, z: 0.155, rz: 0.08, parent: j.spine });
  },
  neckerchief(j, p) {
    const m = garment(p.color, "cotton");
    bandAround(j.spine, 0.54, 0.24, 0.24, m, 0.05);
    bx(0.13, 0.13, 0.02, m, { y: 0.47, z: 0.14, rz: Math.PI / 4, parent: j.spine });
  },
  bowtie(j, p) {
    const m = shiny(p.color);
    for (const s of [-1, 1]) bx(0.07, 0.06, 0.025, m, { x: s * 0.045, y: 0.49, z: 0.15, rz: s * 0.25, parent: j.spine });
    bx(0.03, 0.035, 0.03, solid(darker(p.color, 0.75)), { y: 0.49, z: 0.155, parent: j.spine });
  },
  collar(j, p) {
    if (p.ring) { addMesh(cachedGeo("ocollarRing", () => new THREE.TorusGeometry(0.12, 0.03, 8, 20)), metal(p.color), { y: 0.56, rx: Math.PI / 2, parent: j.spine }); return; }
    if (p.zip) { rbx(0.26, 0.07, 0.26, 0.02, solid(p.color), { y: 0.53, parent: j.spine }); bx(0.012, 0.42, 0.012, metal("#c8ced4"), { y: 0.3, z: 0.137, parent: j.spine }); return; }
    if (p.lace) { rbx(0.28, 0.05, 0.27, 0.02, solid(p.color), { y: 0.52, parent: j.spine }); return; }
    const m = solid(p.color, { roughness: 0.7 });
    for (const s of [-1, 1]) bx(0.09, p.round ? 0.05 : 0.06, 0.02, m, { x: s * 0.06, y: 0.5, z: 0.145, rz: p.round ? 0 : s * 0.5, parent: j.spine });
  },
  pearls(j, p) { const m = solid(p.color, { roughness: 0.2, metalness: 0.1 }); for (let k = 0; k < 9; k++) { const a = -0.9 + (k / 8) * 1.8; addMesh(sph(0.018), m, { x: Math.sin(a) * 0.13, y: 0.5 - Math.cos(a) * 0.08 + 0.02, z: 0.14, parent: j.spine, shadow: false }); } },
  bones(j, p) { const m = solid(p.color, { roughness: 0.8 }); for (let k = 0; k < 5; k++) { const a = -0.7 + (k / 4) * 1.4; bx(0.025, 0.06, 0.02, m, { x: Math.sin(a) * 0.12, y: 0.47 - Math.cos(a) * 0.06 + 0.04, z: 0.14, rz: a, parent: j.spine }); } bandAround(j.spine, 0.54, 0.22, 0.22, solid("#6b4a2b"), 0.02); },
  medal(j, p) {
    bx(0.04, 0.12, 0.012, solid("#c0392b"), { x: -0.12, y: 0.4, z: 0.15, parent: j.spine });
    addMesh(cyl(0.035, 0.035, 0.015, 16), metal(p.color), { x: -0.12, y: 0.32, z: 0.152, rx: Math.PI / 2, parent: j.spine, shadow: false });
  },
  chain(j, p) {
    const m = metal(p.color);
    for (let k = 0; k < 11; k++) { const a = -1.1 + (k / 10) * 2.2; bx(0.035, 0.022, 0.02, m, { x: Math.sin(a) * 0.17, y: 0.52 - Math.cos(a) * 0.14 + 0.04, z: 0.15, rz: a, parent: j.spine }); }
    addMesh(cyl(0.045, 0.045, 0.018, 18), m, { y: 0.34, z: 0.155, rx: Math.PI / 2, parent: j.spine, shadow: false });
    addMesh(sph(0.02), shiny("#c0392b"), { y: 0.34, z: 0.168, parent: j.spine, shadow: false });
  },
  whistle(j, p) { for (const s of [-1, 1]) bx(0.015, 0.2, 0.012, solid("#2d3436"), { x: s * 0.05, y: 0.43, z: 0.14, rz: -s * 0.25, parent: j.spine }); rbx(0.07, 0.035, 0.035, 0.01, metal(p.color), { y: 0.33, z: 0.155, parent: j.spine }); },
  lanyard(j, p) { for (const s of [-1, 1]) bx(0.018, 0.22, 0.012, solid(p.color), { x: s * 0.05, y: 0.42, z: 0.14, rz: -s * 0.25, parent: j.spine }); bx(0.08, 0.1, 0.012, solid("#ffffff"), { y: 0.29, z: 0.148, parent: j.spine }); bx(0.08, 0.025, 0.013, solid(p.color), { y: 0.325, z: 0.149, parent: j.spine }); },
  stethoscope(j, p) {
    const m = solid(p.color, { roughness: 0.4 });
    rbx(0.26, 0.03, 0.26, 0.012, m, { y: 0.54, parent: j.spine });
    for (const s of [-1, 1]) bx(0.02, 0.22, 0.02, m, { x: s * 0.08, y: 0.42, z: 0.145, rz: s * 0.15, parent: j.spine });
    addMesh(cyl(0.03, 0.03, 0.02, 14), metal("#c8ced4"), { x: 0.1, y: 0.3, z: 0.15, rx: Math.PI / 2, parent: j.spine, shadow: false });
  },
  belt(j, p) {
    const m = p.rope ? solid(p.color, { roughness: 0.95 }) : fabric(p.color, "leather");
    bx(0.445, p.rope ? 0.035 : 0.065, 0.265, m, { y: 0.17, parent: j.pelvis });
    if (p.rope) bx(0.04, 0.12, 0.02, m, { x: 0.12, y: 0.1, z: 0.135, parent: j.pelvis });
    else rbx(0.08, 0.06, 0.02, 0.006, metal(p.buckle ?? "#d4a017"), { y: 0.17, z: 0.135, parent: j.pelvis });
    if (p.pouches) for (const s of [-1, 1]) rbx(0.08, 0.09, 0.07, 0.01, fabric(p.color, "leather"), { x: s * 0.2, y: 0.12, z: 0.06, parent: j.pelvis });
  },
  toolbelt(j, p) {
    const lm = fabric(p.color, "leather");
    bx(0.45, 0.07, 0.27, lm, { y: 0.17, parent: j.pelvis });
    for (const s of [-1, 1]) { rbx(0.12, 0.14, 0.09, 0.01, lm, { x: s * 0.2, y: 0.08, z: 0.08, parent: j.pelvis }); bx(0.035, 0.12, 0.03, solid("#a8743f"), { x: s * 0.22, y: 0.2, z: 0.09, parent: j.pelvis }); }
    rbx(0.09, 0.04, 0.04, 0.01, metal("#7f8c8d"), { x: -0.22, y: 0.27, z: 0.09, parent: j.pelvis }); // the hammer head
    bx(0.03, 0.14, 0.015, metal("#c8ced4"), { x: 0.19, y: 0.2, z: 0.12, rz: 0.3, parent: j.pelvis }); // a wrench
  },
  satchel(j, p) {
    const lm = fabric(p.color, "leather");
    bx(0.05, 0.74, 0.02, lm, { y: 0.27, z: 0.152, rz: -0.62, parent: j.spine }); bx(0.05, 0.74, 0.02, lm, { y: 0.27, z: -0.152, rz: 0.62, parent: j.spine });
    rbx(0.1, 0.24, 0.28, 0.02, lm, { x: 0.27, y: 0.02, z: 0.02, parent: j.pelvis });
    bx(0.105, 0.1, 0.285, solid(darker(p.color, 0.8)), { x: 0.27, y: 0.1, z: 0.02, parent: j.pelvis });
    if (p.letter) bx(0.02, 0.1, 0.16, solid("#ffffff"), { x: 0.26, y: 0.17, z: 0.03, parent: j.pelvis });
  },
  badge(j, p) {
    const m = metal(p.color);
    if (p.star) { for (const r of [0, Math.PI / 5 * 2.5]) bx(0.06, 0.06, 0.012, m, { x: -0.13, y: 0.38, z: 0.15, rz: r + Math.PI / 4, parent: j.spine }); }
    else rbx(0.06, 0.07, 0.012, 0.01, m, { x: -0.13, y: 0.38, z: 0.148, parent: j.spine });
  },
  pockets(j, p) { const m = solid(darker(p.color, 0.85)); for (const s of [-1, 1]) { bx(0.11, 0.1, 0.015, m, { x: s * 0.12, y: 0.35, z: 0.137, parent: j.spine }); bx(0.12, 0.03, 0.02, solid(darker(p.color, 0.7)), { x: s * 0.12, y: 0.4, z: 0.14, parent: j.spine }); } },
  buttons(j, p) { buttonsCol(j, p.color, { x: p.double ? -0.07 : 0, n: 4, clasp: !!p.clasps, z: 0.152 }); if (p.double) buttonsCol(j, p.color, { x: 0.07, n: 4, z: 0.152 }); },
  gloves(j, p) { const m = fabric(p.color, "leather"); for (let i = 0; i < 2; i++) { rbx(0.145, 0.145, 0.155, 0.015, m, { parent: j.hand[i] }); bx(0.16, 0.05, 0.17, m, { y: 0.08, parent: j.hand[i] }); } },
  boots(j, p) { const m = fabric(p.color, "leather"); for (let i = 0; i < 2; i++) { rbx(0.205, 0.26, 0.235, 0.01, m, { y: -0.27, parent: j.knee[i] }); rbx(0.225, 0.12, 0.34, 0.012, m, { y: -0.43, z: 0.05, parent: j.knee[i] }); } },
  stripes(j, p) {
    const m = solid(p.color, { roughness: 0.4, metalness: p.sport ? 0 : 0.3 });
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      if (p.sport) { bx(0.012, 0.3, 0.04, m, { x: s * 0.08, y: -0.15, parent: j.sh[i] }); bx(0.012, 0.26, 0.04, m, { x: s * 0.075, y: -0.13, parent: j.el[i] }); if (p.where === "all") { bx(0.012, 0.42, 0.04, m, { x: s * 0.1, y: -0.21, parent: j.hip[i] }); bx(0.012, 0.36, 0.04, m, { x: s * 0.095, y: -0.19, parent: j.knee[i] }); } }
      else { bx(0.165, 0.035, 0.185, m, { y: -0.2, parent: j.sh[i] }); if (p.where === "all") { bx(0.155, 0.035, 0.175, m, { y: -0.18, parent: j.el[i] }); bx(0.2, 0.04, 0.23, m, { y: -0.25, parent: j.knee[i] }); } }
    }
    if (p.where === "all" && !p.sport) { bx(0.5, 0.04, 0.28, m, { y: 0.12, parent: j.spine }); }
  },
  patches(j, p) { bx(0.1, 0.07, 0.012, solid(p.color), { x: -0.12, y: 0.4, z: 0.137, parent: j.spine }); bx(0.06, 0.04, 0.012, solid("#ffffff"), { x: 0.13, y: 0.4, z: 0.137, parent: j.spine }); bx(0.02, 0.07, 0.07, solid(p.color), { x: -0.08, y: -0.08, parent: j.sh[0] }); bx(0.02, 0.07, 0.07, solid("#2e86de"), { x: 0.08, y: -0.08, parent: j.sh[1] }); },
  epaulettes(j, p) { for (let i = 0; i < 2; i++) bx(0.16, 0.03, 0.19, solid(p.color), { y: 0.01, parent: j.sh[i] }); },
  pack(j, p) { rbx(0.42, 0.5, 0.2, 0.04, garment(p.color, "canvas"), { y: 0.27, z: -0.24, parent: j.spine }); for (const s of [-1, 1]) addMesh(cyl(0.035, 0.035, 0.08, 12), metal("#c8ced4"), { x: s * 0.12, y: 0.55, z: -0.24, parent: j.spine }); bx(0.2, 0.08, 0.02, solid("#2e86de"), { y: 0.36, z: -0.345, parent: j.spine }); },
  pen(j, p) { bx(0.018, 0.09, 0.018, solid(p.color), { x: -0.14, y: 0.42, z: 0.16, parent: j.spine }); },
};
export const PART_KINDS = Object.freeze(Object.keys(PART_BUILD));

// ------------------------------------------------------------------------------------------------- head pieces
// head units (people.js): the head box 0.30 x 0.32 x 0.30 from y 0 to 0.32; the face sticker covers x +-0.14, y 0.01..0.29
// at z 0.151; hair reaches y ~0.38. A piece starts at hb (the top of the hair line) or stands beside / behind the face.
export const FACE_BOX = Object.freeze({ x: 0.135, y0: 0.02, y1: 0.265, z: 0.145 }); // the part of the face nothing may cover
export const HEAD_BUILD = {
  crown(h, c, hb) { const m = metal(c.color); for (const [x, z, w, d] of [[0, 0.16, 0.34, 0.03], [0, -0.16, 0.34, 0.03], [0.16, 0, 0.03, 0.34], [-0.16, 0, 0.03, 0.34]]) bx(w, 0.1, d, m, { x, y: hb + 0.05, z, parent: h }); for (const [x, z] of [[-0.12, 0.16], [0, 0.16], [0.12, 0.16], [-0.16, 0], [0.16, 0], [-0.12, -0.16], [0, -0.16], [0.12, -0.16]]) addMesh(cone(0.03, 0.08, 4), m, { x, y: hb + 0.14, z, parent: h }); for (const [x, col] of [[-0.07, "#e8365d"], [0.07, "#2e86de"], [0, "#20bf6b"]]) bx(0.035, 0.035, 0.02, shiny(col), { x, y: hb + 0.05, z: 0.178, parent: h }); },
  tiara(h, c, hb) { const m = metal(c.color); bx(0.32, 0.03, 0.03, m, { y: hb + 0.02, z: 0.12, parent: h }); addMesh(cone(0.04, 0.08, 4), m, { y: hb + 0.07, z: 0.125, parent: h }); addMesh(sph(0.02), shiny("#e8365d"), { y: hb + 0.05, z: 0.14, parent: h }); },
  tophat(h, c, hb) { const m = garment(c.color, "velvet"); bx(0.44, 0.025, 0.42, m, { y: hb + 0.01, parent: h }); rbx(0.29, 0.3, 0.28, 0.01, m, { y: hb + 0.17, parent: h }); if (c.band) bx(0.295, 0.05, 0.285, solid(c.band), { y: hb + 0.05, parent: h }); },
  chefhat(h, c, hb) { const m = garment(c.color, "canvas"); bx(0.33, 0.09, 0.33, m, { y: hb + 0.04, parent: h }); rbx(0.4, 0.26, 0.4, 0.1, m, { y: hb + 0.21, parent: h }); },
  bakerhat(h, c, hb) { const m = garment(c.color, "canvas"); bx(0.33, 0.07, 0.33, m, { y: hb + 0.03, parent: h }); rbx(0.38, 0.12, 0.38, 0.05, m, { y: hb + 0.12, parent: h }); },
  helmetKnight(h, c, hb) {
    const pl = garment(c.color, "plate");
    rbx(0.37, 0.18, 0.37, 0.06, pl, { y: hb + 0.05, parent: h });
    bx(0.37, 0.3, 0.05, pl, { y: 0.19, z: -0.175, parent: h });
    for (const s of [-1, 1]) bx(0.04, 0.27, 0.27, pl, { x: s * 0.175, y: 0.17, z: -0.02, parent: h }); // cheek guards beside the face
    bx(0.38, 0.04, 0.05, pl, { y: hb - 0.005, z: 0.165, parent: h }); // the brow band, above the brows
    if (c.plume) for (let k = 0; k < 4; k++) rbx(0.06, 0.1, 0.08, 0.02, solid(c.plume, { roughness: 0.9 }), { y: hb + 0.17 + k * 0.03, z: 0.05 - k * 0.06, rx: -0.4, parent: h });
  },
  hardhat(h, c, hb) { const m = shiny(c.color); rbx(0.35, 0.14, 0.35, 0.06, m, { y: hb + 0.06, parent: h }); bx(0.42, 0.02, 0.45, m, { y: hb, z: 0.02, parent: h }); bx(0.04, 0.03, 0.36, m, { y: hb + 0.14, parent: h }); },
  fireHelmet(h, c, hb) { const m = shiny(c.color); rbx(0.35, 0.15, 0.35, 0.06, m, { y: hb + 0.06, parent: h }); bx(0.42, 0.02, 0.5, m, { y: hb, z: -0.06, parent: h }); bx(0.04, 0.04, 0.38, m, { y: hb + 0.15, parent: h }); if (c.badge) rbx(0.11, 0.11, 0.02, 0.01, metal(c.badge), { y: hb + 0.08, z: 0.185, parent: h }); },
  peakedCap(h, c, hb) { const m = garment(c.color, "canvas"); bx(0.33, 0.07, 0.33, m, { y: hb + 0.03, parent: h }); rbx(0.38, 0.05, 0.38, 0.015, m, { y: hb + 0.09, parent: h }); bx(0.28, 0.02, 0.12, solid("#1e1e1e", { roughness: 0.3 }), { y: hb, z: 0.2, rx: 0.15, parent: h }); if (c.badge) bx(0.05, 0.05, 0.02, metal(c.badge), { y: hb + 0.04, z: 0.17, parent: h }); },
  strawhat(h, c, hb) { const m = garment(c.color, "straw"); addMesh(cyl(0.31, 0.31, 0.02, 20), m, { y: hb, parent: h }); rbx(0.3, 0.13, 0.3, 0.04, m, { y: hb + 0.07, parent: h }); if (c.band) bx(0.305, 0.035, 0.305, solid(c.band), { y: hb + 0.03, parent: h }); },
  cowboy(h, c, hb) { const m = fabric(c.color, "leather"); bx(0.5, 0.02, 0.46, m, { y: hb, parent: h }); for (const s of [-1, 1]) bx(0.08, 0.02, 0.46, m, { x: s * 0.27, y: hb + 0.03, rz: s * 0.6, parent: h }); rbx(0.3, 0.16, 0.27, 0.03, m, { y: hb + 0.08, parent: h }); bx(0.31, 0.03, 0.28, solid("#2d1f14"), { y: hb + 0.03, parent: h }); },
  tricorn(h, c, hb) { const m = garment(c.color, "velvet"); rbx(0.3, 0.1, 0.3, 0.03, m, { y: hb + 0.05, parent: h }); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const g = new THREE.Group(); g.rotation.y = a; g.position.y = hb + 0.06; h.add(g); bx(0.4, 0.1, 0.03, m, { z: 0.17, rx: -0.35, parent: g }); if (c.trim) bx(0.4, 0.015, 0.035, metal(c.trim), { y: 0.05, z: 0.155, rx: -0.35, parent: g }); } },
  wizard(h, c, hb) { const m = garment(c.color, "stars"); bx(0.5, 0.02, 0.5, m, { y: hb, parent: h }); for (let k = 0; k < 4; k++) rbx(0.28 - k * 0.06, 0.13, 0.28 - k * 0.06, 0.01, m, { y: hb + 0.07 + k * 0.12, z: -k * 0.025, rx: -0.08 * k, parent: h }); if (c.band) bx(0.29, 0.04, 0.29, metal(c.band), { y: hb + 0.03, parent: h }); },
  beret(h, c, hb) { const m = garment(c.color, "velvet"); rbx(0.38, 0.08, 0.36, 0.035, m, { x: 0.02, y: hb + 0.02, rz: 0.18, parent: h }); bx(0.03, 0.04, 0.03, m, { y: hb + 0.08, parent: h }); },
  flatcap(h, c, hb) { const m = garment(c.color, "tweed"); rbx(0.34, 0.08, 0.35, 0.03, m, { y: hb + 0.02, z: -0.005, parent: h }); bx(0.28, 0.025, 0.1, m, { y: hb - 0.01, z: 0.19, rx: 0.2, parent: h }); },
  sunhat(h, c, hb) { const m = garment(c.color, c.fisher ? "canvas" : "straw"); addMesh(cyl(c.fisher ? 0.26 : 0.33, c.fisher ? 0.3 : 0.33, 0.025, 20), m, { y: hb, z: c.fisher ? -0.03 : 0, parent: h }); rbx(0.3, 0.12, 0.3, 0.05, m, { y: hb + 0.07, parent: h }); if (c.band) bx(0.305, 0.035, 0.305, solid(c.band), { y: hb + 0.03, parent: h }); },
  pirateBandana(h, c, hb) { const m = fabric(c.color, "dots"); rbx(0.33, 0.1, 0.33, 0.04, m, { y: hb + 0.01, parent: h }); rbx(0.07, 0.06, 0.06, 0.02, m, { y: hb - 0.02, z: -0.18, parent: h }); for (const s of [-1, 1]) bx(0.04, 0.12, 0.02, m, { x: s * 0.03, y: hb - 0.09, z: -0.19, rz: s * 0.3, parent: h }); },
  vikingHelmet(h, c, hb) { const m = garment(c.color, "plate"); rbx(0.35, 0.16, 0.35, 0.07, m, { y: hb + 0.05, parent: h }); bx(0.36, 0.04, 0.36, metal("#8a6a2a"), { y: hb - 0.005, parent: h }); for (const s of [-1, 1]) addMesh(cone(0.035, 0.16, 8), solid("#f2ead6", { roughness: 0.6 }), { x: s * 0.2, y: hb + 0.12, rz: -s * 0.6, parent: h }); },
  safari(h, c, hb) { const m = garment(c.color, "canvas"); rbx(0.34, 0.14, 0.36, 0.07, m, { y: hb + 0.06, parent: h }); bx(0.46, 0.02, 0.48, m, { y: hb, parent: h }); if (c.band) bx(0.345, 0.03, 0.365, solid(c.band), { y: hb + 0.025, parent: h }); },
  bone(h, c, hb) { const m = solid(c.color, { roughness: 0.8 }); bx(0.26, 0.04, 0.04, m, { y: hb + 0.04, rz: 0.4, parent: h }); for (const s of [-1, 1]) for (const d of [-1, 1]) addMesh(sph(0.025), m, { x: s * 0.13 * Math.cos(0.4), y: hb + 0.04 + s * 0.13 * Math.sin(0.4) + d * 0.015, parent: h }); },
  bow(h, c, hb) { const m = shiny(c.color); for (const s of [-1, 1]) bx(0.09, 0.07, 0.03, m, { x: 0.09 + s * 0.05, y: hb + 0.02, z: 0.06, rz: s * 0.3, parent: h }); bx(0.035, 0.04, 0.035, solid(darker(c.color, 0.75)), { x: 0.09, y: hb + 0.02, z: 0.06, parent: h }); },
  goggles(h, c, hb) { // ON the forehead, above the brows
    const strap = solid("#3d2b1f", { roughness: 0.6 });
    bx(0.32, 0.035, 0.32, strap, { y: hb + 0.005, parent: h });
    for (const s of [-1, 1]) { addMesh(cyl(0.048, 0.048, 0.035, 16), metal(c.color), { x: s * 0.065, y: hb + 0.03, z: 0.165, rx: Math.PI / 2, parent: h }); addMesh(cyl(0.036, 0.036, 0.037, 16), cachedMat("ogoggleLens", () => new THREE.MeshStandardMaterial({ color: "#9fd8ff", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 })), { x: s * 0.065, y: hb + 0.03, z: 0.168, rx: Math.PI / 2, parent: h, shadow: false }); }
  },
  cap(h, c, hb) { const m = fabric(c.color, "cotton"); rbx(0.33, 0.12, 0.33, R0, m, { y: hb + 0.05, parent: h }); bx(0.3, 0.025, 0.16, m, { y: hb, z: 0.22, parent: h }); bx(0.04, 0.03, 0.04, solid(darker(c.color, 0.7)), { y: hb + 0.115, parent: h }); },
  beanie(h, c, hb) { const m = garment(c.color, "knit"); rbx(0.34, 0.16, 0.34, R0 + 0.02, m, { y: hb + 0.06, parent: h }); bx(0.35, 0.05, 0.35, solid(darker(c.color, 0.8)), { y: hb, parent: h }); addMesh(sph(0.04), m, { y: hb + 0.16, parent: h }); },
};
export const HEAD_KINDS = Object.freeze(Object.keys(HEAD_BUILD));

/**
 * Dresses a person: look.parts (each { part, color, ... }) and look.ohead ({ kind, color, ... }) onto the rig joints
 * (people.js makePerson's joints + flaps / cape slots). hb: the hairline height in head units (the hats' base).
 * -> { parts: n, head: kind | null }
 */
export function dressPerson(j, look, { hb = 0.31 } = {}) {
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
