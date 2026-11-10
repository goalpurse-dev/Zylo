// Blocky Worlds PLASTIC-WORLD (2026-11-10, owner: "The stills still look dull ('washed out') next to the reference ...
// we mix realistic photo textures (Poly Haven forest, grass, noisy cobbles) with blocky characters, plus beige/brown
// everywhere and flat light. The reference is a clean toy-plastic game look. Switch the whole engine to that style:
// smooth plastic everywhere, solid saturated colours, light specular gloss, no photo textures, no noisy cobbles ...
// Kill beige: no beige floors/walls/ground as defaults.")
//
// The ONE material system of the sets, props, buildings, terrain, trees and creatures:
//   PLASTIC_LOOK              true: the toy-plastic look (false = the old photo-texture look, kept for an A/B)
//   PLASTIC                   the plastic constants (roughness range, clearcoat)
//   hsvOf(hex) / hexOfHsv     sRGB hex <-> HSV (h degrees, s, v 0..1)                                   (pure, tested)
//   isBeige(hex)              the look gate's beige (hue 20-50, s 0.12-0.6, v >= 0.5)                  (pure, tested)
//   toyColour(hex, o)         any colour -> its toy-plastic version: beige -> clean cool grey or a saturated warm
//                             accent, weak colours saturated, muddy darks lifted; whites / greys stay neutral (tested)
//   plasticRough(r)           a roughness clamped into the plastic range (0.3..0.55)                    (pure, tested)
//   plasticParams(color, o)   the material parameters (no texture maps unless o.map is given)          (pure, tested)
//   makePlastic(THREE, c, o)  a NEW MeshPhysicalMaterial (low roughness, a light clearcoat)
//   plastic(c, o)             the same, cached (never mutate a cached one)
//   flatFor(name, tint)       a Poly Haven texture name (+ its old tint) -> the flat toy colour replacing it (tested)
//   TILE_KIND[name]           which clean procedural pattern (tiles / bricks / planks) a surface keeps, or none
//   cleanPattern(THREE, kind, colour)  a CLEAN canvas pattern (flat colour + thin grout lines, no noise)
//   isPhotoMap(texture)       a photo (jpg) texture?
//   plasticize(root, o)       the safety net: every MeshStandard / Physical material below root loses its photo maps
//                             (colour = the photo's average, toy-ified), its roughness goes into the plastic range,
//                             beige turns into a toy colour. Idempotent; o.skip(obj) leaves a subtree alone.
import * as THREE from "three";

export const PLASTIC_LOOK = true;
export const PLASTIC = Object.freeze({ roughness: 0.42, minRough: 0.3, maxRough: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.22, envMapIntensity: 1 });

// ------------------------------------------------------------------------------------------------ colour (pure)
function hexOf(c) {
  if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (typeof c === "string" && /^#[0-9a-f]{3}$/i.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join("")}`.toLowerCase();
  return `#${new THREE.Color(c).getHexString()}`;
}
export function hsvOf(c) {
  const h6 = hexOf(c), n = parseInt(h6.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return { h, s: mx > 0 ? d / mx : 0, v: mx };
}
export function hexOfHsv(h, s, v) {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); v = Math.min(1, Math.max(0, v));
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((k) => Math.round((k + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}
/** the look gate's beige (lookgate/measure.py, lib/setThemes.js frameStats) */
export function isBeige(c) { const { h, s, v } = hsvOf(c); return h >= 20 && h <= 50 && s >= 0.12 && s <= 0.6 && v >= 0.5; }

/**
 * a colour's toy-plastic version. o: { minSat (0.45), minVal (0.42) }
 *   neutral (s < 0.12): stays neutral (white stays white, a grey a hint cooler), never below v 0.16
 *   beige: pale -> a clean light cool grey; stronger -> a saturated warm accent (golden / orange)
 *   colour: saturation at least minSat, value at least minVal (no muddy brown / olive)
 */
export function toyColour(c, { minSat = 0.45, minVal = 0.42 } = {}) {
  const hex = hexOf(c), { h, s, v } = hsvOf(hex);
  if (s < 0.12) {
    if (v > 0.95 && s < 0.04) return hex;
    return hexOfHsv(215, Math.min(s, 0.07), Math.max(v, 0.16));
  }
  if (isBeige(hex)) return s < 0.3 ? hexOfHsv(215, 0.07, Math.max(v, 0.86)) : hexOfHsv(h, 0.68, Math.max(v, 0.9));
  if (h >= 10 && h <= 50 && v < 0.6) return hexOfHsv(h, Math.max(s, 0.62), Math.max(v, 0.55)); // muddy brown -> a clean toy brown
  return hexOfHsv(h, Math.max(s, minSat), Math.max(v, minVal));
}
export const plasticRough = (r) => Math.min(PLASTIC.maxRough, Math.max(PLASTIC.minRough, Number.isFinite(r) ? r : PLASTIC.roughness));

/**
 * the plastic material parameters. o: any material params (+ matte: keep a high roughness, keepColour: no toyColour).
 * No texture maps unless the caller passes one (a clean pattern / a sign's canvas).
 */
export function plasticParams(color, o = {}) {
  const { matte = false, keepColour = false, ...rest } = o;
  const p = { clearcoat: PLASTIC.clearcoat, clearcoatRoughness: PLASTIC.clearcoatRoughness, metalness: 0, envMapIntensity: PLASTIC.envMapIntensity, ...rest };
  p.color = keepColour || color == null ? (color ?? "#ffffff") : toyColour(color);
  p.roughness = matte ? (rest.roughness ?? 0.8) : plasticRough(rest.roughness);
  return p;
}
export function makePlastic(T, color, o = {}) {
  const m = new T.MeshPhysicalMaterial(plasticParams(color, o));
  m.userData.plastic = true;
  return m;
}
const CACHE = new Map();
export function plastic(color, o = {}) {
  const k = `${hexOf(color ?? "#ffffff")}|${JSON.stringify(o, (key, val) => (val?.isTexture ? val.uuid : val))}`;
  let m = CACHE.get(k);
  if (!m) { m = makePlastic(THREE, color, o); CACHE.set(k, m); }
  return m;
}

// ------------------------------------------------------------------------------------------------ photo textures -> flat
// the flat toy colour of every Poly Haven surface the sets used (the old tint is honoured when it is a real colour)
export const TEX_FLAT = Object.freeze({
  leafy_grass: "#52c43c", forest_ground_04: "#52c43c", grass_path_2: "#d6dce6", brown_mud_dry: "#d6dce6", coast_sand_01: "#ffd64f",
  asphalt_02: "#4a5466", concrete_pavement: "#d9dfe8", dark_rock: "#8e9aae",
  painted_plaster_wall: "#f4f6fa", beige_wall_001: "#ffcf4a", brick_wall_02: "#d9503f",
  roof_09: "#e04a3a", grey_roof_01: "#3d64b0", laminate_floor_02: "#e3852f", interior_tiles: "#e9eef6",
});
const GRASSY = /^(leafy_grass|forest_ground)|moss/;
const PATHY = /mud|path|dirt|gravel|cobble/;
/** which clean pattern a surface keeps (flat colour + thin lines; never noise) */
export const TILE_KIND = Object.freeze({ concrete_pavement: "tiles", interior_tiles: "tiles", grass_path_2: "tiles", brown_mud_dry: "tiles", brick_wall_02: "bricks", laminate_floor_02: "planks" });
/** a Poly Haven texture name + its old tint -> the flat toy colour */
export function flatFor(name, tint = "#ffffff") {
  const base = TEX_FLAT[name] ?? "#d9dfe8";
  const t = hsvOf(tint ?? "#ffffff");
  if (GRASSY.test(name) && !PATHY.test(name)) {
    if (t.s < 0.15) return base;
    const h = Math.min(132, Math.max(92, t.h)); // always a clean grass green, whatever olive / yellow the old tint was
    return hexOfHsv(h, Math.max(0.62, Math.min(0.8, t.s)), Math.max(0.72, Math.min(0.85, t.v)));
  }
  if (PATHY.test(name) || name === "coast_sand_01") return base; // paths / sand: the old tints were all beige
  if (t.s >= 0.18 && !isBeige(tint)) return toyColour(tint);
  if (isBeige(tint) && t.s >= 0.3) return toyColour(tint); // a strong warm tint becomes a warm accent wall
  return base;
}

/** a clean canvas pattern (browser only; null in Node): tiles / bricks / planks, flat colour + thin lines */
export function cleanPattern(T, kind, colour) {
  if (typeof document === "undefined" || !kind) return null;
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const p = c.getContext("2d");
  const line = (k) => `#${new T.Color(colour).multiplyScalar(k).getHexString()}`;
  p.fillStyle = colour; p.fillRect(0, 0, S, S);
  if (kind === "tiles") { p.fillStyle = line(0.84); for (let i = 0; i <= 2; i++) { p.fillRect(i * 64 - 1.5, 0, 3, S); p.fillRect(0, i * 64 - 1.5, S, 3); } }
  if (kind === "bricks") { p.fillStyle = "#f2f4f8"; for (let r = 0; r <= 4; r++) p.fillRect(0, r * 32 - 2, S, 4); for (let r = 0; r < 4; r++) for (let k = 0; k <= 2; k++) p.fillRect(k * 64 + (r % 2 ? 32 : 0) - 2, r * 32, 4, 32); }
  if (kind === "planks") { p.fillStyle = line(0.8); for (let r = 0; r <= 4; r++) p.fillRect(0, r * 32 - 1, S, 2); for (let r = 0; r < 4; r++) p.fillRect(((r * 53) % 96) + 16, r * 32, 2, 32); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  t.userData.clean = true;
  return t;
}

// ------------------------------------------------------------------------------------------------ the safety net
const PHOTO_URL = /\/assets\/(ph|styletest|leafy_grass|[a-z]+_[a-z_]*\d*)\//i;
export function isPhotoMap(t) {
  if (!t || t.userData?.clean || t.isCanvasTexture || t.isDataTexture || t.isRenderTargetTexture) return false;
  if (t.userData?.photo) return true;
  if (t.userData?.mimeType === "image/jpeg") return true; // GLTFLoader (Poly Haven models are jpg; Kenney's are png)
  const src = String(t.image?.currentSrc || t.image?.src || t.source?.data?.src || "");
  return /\.(jpe?g)(\?|$)/i.test(src) && !/kenney/i.test(src) && (PHOTO_URL.test(src) || /\/assets\//.test(src));
}
/** a texture's average colour (sRGB hex), from a 4 x 4 downsample; null when it cannot be read */
export function avgColour(t) {
  const img = t?.image;
  if (!img || typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas"); c.width = c.height = 4; const p = c.getContext("2d", { willReadFrequently: true });
    p.drawImage(img, 0, 0, 4, 4);
    const d = p.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return `#${[r, g, b].map((x) => Math.round(x / 16).toString(16).padStart(2, "0")).join("")}`;
  } catch { return null; }
}
const DONE = new WeakSet();
/** one material into plastic (in place, idempotent). Returns true when it changed something. */
export function plasticizeMaterial(m, { deBeige = true } = {}) {
  if (!m || DONE.has(m) || !m.isMeshStandardMaterial || m.userData?.keepLook) return false;
  DONE.add(m);
  if (isPhotoMap(m.map) || (m.userData?.photo && m.map && !m.map.isCanvasTexture)) {
    const foliage = m.alphaTest > 0 || m.transparent || /leaf|leaves|branch|twig|fern|grass/i.test(m.name ?? "");
    const avg = avgColour(m.map);
    const base = new THREE.Color(avg ?? "#9aa4b4").multiply(m.color);
    if (foliage) { m.color.set(toyColour(`#${base.getHexString()}`, { minSat: 0.6, minVal: 0.55 })); } // the cut-out stays (no leaf cards turning into squares)
    else { m.color.set(toyColour(`#${base.getHexString()}`)); m.map = null; }
    m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null; m.aoMap = null; m.bumpMap = null;
  } else if (deBeige && !m.map && isBeige(`#${m.color.getHexString()}`)) m.color.set(toyColour(`#${m.color.getHexString()}`));
  if (!m.userData?.matte) m.roughness = plasticRough(m.roughness);
  m.userData.plastic = true;
  m.needsUpdate = true;
  return true;
}
// people and crowds keep their own look (skin tones are "beige" by the measure; CHARACTERS owns them); a giant made its
// own plastic (page/kit/giants.js: toy palette, kit solids) and its town plasticizes itself (town.js / backTown.js)
const isPeople = (o) => !!(o.userData?.isPerson || o.userData?.crowd || /^(person|crowd|giant):/.test(o.name ?? ""));
export function plasticize(root, { skip = null, deBeige = true } = {}) {
  if (!PLASTIC_LOOK || !root) return 0;
  let n = 0;
  const walk = (o) => {
    if (isPeople(o) || skip?.(o)) return;
    if (o.isMesh || o.isInstancedMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (plasticizeMaterial(m, { deBeige })) n++;
    for (const ch of o.children) walk(ch);
  };
  walk(root);
  return n;
}
