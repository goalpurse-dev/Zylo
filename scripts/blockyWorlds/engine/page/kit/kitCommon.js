// Shared bits for the kit (people, monsters, props): geometry/material caches, the locked look's fabric textures
// (seeded instead of Math.random), and the Lilita font for canvas text. Everything is cached so 6-10 people share
// geometries and materials.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { rng, hashSeed } from "../../lib/rng.js";
import { PLASTIC_LOOK, PLASTIC, plasticRough } from "./plastic.js"; // PLASTIC-WORLD

export { rng, hashSeed };

// ---------- geometry cache ----------
const GEO = new Map();
const r3 = (v) => Math.round(v * 1000) / 1000;
/** a (rounded) box geometry, cached by size and bevel */
export function boxGeo(w, h, d, r = 0) {
  const k = `b${r3(w)},${r3(h)},${r3(d)},${r3(r)}`;
  let g = GEO.get(k);
  if (!g) {
    g = r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d);
    GEO.set(k, g);
  }
  return g;
}
export function cachedGeo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}

// ---------- material cache ----------
const MAT = new Map();
export function cachedMat(key, make) {
  let m = MAT.get(key);
  if (!m) { m = make(); MAT.set(key, m); }
  return m;
}
// PLASTIC-WORLD 2026-11-10: every kit solid is smooth plastic (roughness into 0.3..0.55, page/kit/plastic.js); the colour
// is the caller's (people / faces keep theirs), o.matte keeps a high roughness
export const solid = (color, o = {}) => cachedMat(`s${new THREE.Color(color).getHexString()}|${JSON.stringify(o)}`, () => { const { matte, ...p } = o; return new THREE.MeshStandardMaterial({ color, ...p, roughness: PLASTIC_LOOK && !matte ? plasticRough(p.roughness ?? PLASTIC.roughness) : p.roughness ?? 0.6 }); });
export const skinMat = (c) => cachedMat(`skin${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
export const darker = (c, k) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

/** B's procedural fabric (the locked look), seeded so frames are deterministic */
export function fabric(color, kind = "cotton") {
  return cachedMat(`f${color}/${kind}`, () => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d");
    const R = rng(hashSeed(`${color}/${kind}`));
    p.fillStyle = color; p.fillRect(0, 0, 128, 128);
    const base = new THREE.Color(color), tmp = new THREE.Color();
    for (let i = 0; i < 1600; i++) { const k2 = 0.88 + R() * 0.24; p.fillStyle = `#${tmp.copy(base).multiplyScalar(k2).getHexString()}`; p.fillRect(R() * 128, R() * 128, kind === "denim" ? 3 : 2, kind === "denim" ? 1 : 2); }
    if (kind === "denim") { p.strokeStyle = "rgba(255,255,255,0.08)"; for (let y = 0; y < 128; y += 3) { p.beginPath(); p.moveTo(0, y); p.lineTo(128, y + 6); p.stroke(); } }
    if (kind === "stripes") { p.fillStyle = "rgba(255,255,255,0.85)"; for (let y = 0; y < 128; y += 22) p.fillRect(0, y, 128, 9); }
    if (kind === "plaid") { p.fillStyle = "rgba(20,20,40,0.28)"; for (let y = 0; y < 128; y += 32) p.fillRect(0, y, 128, 12); for (let x = 0; x < 128; x += 32) p.fillRect(x, 0, 12, 128); p.fillStyle = "rgba(255,230,120,0.5)"; for (let y = 6; y < 128; y += 32) p.fillRect(0, y, 128, 2); }
    if (kind === "dots") { p.fillStyle = "rgba(255,255,255,0.9)"; for (let y = 8; y < 128; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < 128; x += 24) { p.beginPath(); p.arc(x, y, 5, 0, Math.PI * 2); p.fill(); } }
    if (kind === "pinstripe") { p.fillStyle = "rgba(255,255,255,0.18)"; for (let x = 0; x < 128; x += 10) p.fillRect(x, 0, 1.5, 128); }
    if (kind === "band") { p.fillStyle = "#ffffff"; p.fillRect(0, 50, 128, 14); p.fillStyle = "#1e90ff"; p.fillRect(0, 64, 128, 10); }
    if (kind === "fur") { p.strokeStyle = "rgba(0,0,0,0.25)"; p.lineWidth = 2; for (let i = 0; i < 260; i++) { const x = R() * 128, y = R() * 128; p.beginPath(); p.moveTo(x, y); p.lineTo(x + (R() - 0.5) * 6, y + 6 + R() * 8); p.stroke(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: kind === "leather" ? 0.4 : kind === "fur" ? 0.95 : 0.85 });
  });
}
export const cloth = (color, kind) => fabric(color, kind);

/** a mesh from the cache: box (w,h,d,r) + material, placed under a parent */
export function rbx(w, h, d, r, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = null, shadow = true } = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, r), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
export const bx = (w, h, d, mat, o = {}) => rbx(w, h, d, 0, mat, o);
export function addMesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = null, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
export function canvasTex(c, { aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}

// ---------- font (Lilita One, our caption font) for signs, notes, markers ----------
export const KIT_FONT = "BWKit";
export const kitFont = (px) => `${px}px ${KIT_FONT}, "Arial Black", "Segoe UI", sans-serif`;
let fontPromise = null;
/** loads /assets/LilitaOne-Regular.ttf as the "BWKit" font-face; props.js awaits it at import */
export function loadKitFonts() {
  if (fontPromise) return fontPromise;
  if (typeof document === "undefined" || typeof FontFace === "undefined") return (fontPromise = Promise.resolve(false));
  const ff = new FontFace(KIT_FONT, "url(/assets/LilitaOne-Regular.ttf)");
  fontPromise = Promise.race([
    ff.load().then((f) => { document.fonts.add(f); return true; }),
    new Promise((r) => setTimeout(() => r(false), 8000)),
  ]).catch(() => false);
  return fontPromise;
}

/** wraps and fits text into a box; returns { lines, size } for ctx with font kitFont(size) */
export function fitText(p, text, maxW, maxH, { maxSize = 200, minSize = 20, lineGap = 1.05, maxLines = 4 } = {}) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  for (let size = maxSize; size >= minSize; size -= 4) {
    p.font = kitFont(size);
    // greedy wrap at this size
    const lines = []; let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (p.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const widest = Math.max(...lines.map((l) => p.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW && lines.length * size * lineGap <= maxH) return { lines, size };
  }
  p.font = kitFont(minSize);
  return { lines: [words.join(" ")], size: minSize };
}
