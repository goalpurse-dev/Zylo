// Blocky Worlds SETS-V2 (2026-11-09, owner D): the THEME DRESSER. Every bible place has a theme preset
// (lib/setThemes.js THEMES: palette, signature props, density); the dresser dresses the place a shot stands in with the
// theme's signature props (dense set dressing in the theme's saturated palette), tints the room walls of an indoor place
// with the palette (never all beige), and hands the rig layer (page/lighting.js) the dressing's practical lights.
//   attachDresser(S, ctx)   wraps S.setPlace(place, shot): after the set's own place switch, dress(shot)
//   makeDresser(S, ctx)     -> { dress(shot), groups }
// Deterministic: the props and their slots come from rng(hash(set, place, theme)); built once per (place, theme) and
// cached; only one dressing group is visible at a time. Props stay off the people's spots, out of the camera side's
// corridor (behind the group or wide at the sides), off the set's own solid things (box overlap) and on flat ground.
import { THEMES, DENSITY } from "../../lib/setThemes.js";
import { rng, hashSeed } from "../../lib/rng.js";
import { PLASTIC_LOOK, makePlastic } from "../kit/plastic.js";

// ------------------------------------------------------------------------------------------------ the props
// each maker(T, pal, R) -> THREE.Group, origin on the ground, faces +z; userData { r: footprint radius, h, glow: [{ y, colour }]? }
const MAT = new Map();
// PLASTIC-WORLD 2026-11-10: every dressing prop is smooth toy plastic in its toy colour (page/kit/plastic.js)
const mat = (T, color, o = {}) => { const k = `${color}|${JSON.stringify(o)}`; if (!MAT.has(k)) MAT.set(k, PLASTIC_LOOK ? makePlastic(T, color, o) : new T.MeshStandardMaterial({ color, roughness: 0.8, ...o })); return MAT.get(k); };
const GLOW = new Set();
const glowMat = (T, color) => { const m = mat(T, color, { emissive: color, emissiveIntensity: 1 }); m.userData.themeGlow = true; GLOW.add(m); return m; };
function box(T, g, w, h, d, m, x = 0, y = 0, z = 0, ry = 0) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; }
function cyl(T, g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 12) { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; }
function ball(T, g, r, m, x = 0, y = 0, z = 0) { const o = new T.Mesh(new T.SphereGeometry(r, 12, 8), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }
const pick = (arr, R) => arr[Math.floor(R() * arr.length) % arr.length];
const WOOD = "#7a4a28", DARK = "#3a2a1c", METAL = "#4a4e58";

export const PROP_MAKERS = {
  stall(T, P, R) { const g = new T.Group(); box(T, g, 2.4, 0.9, 1.1, mat(T, WOOD), 0, 0.45, 0); for (const x of [-1.1, 1.1]) box(T, g, 0.08, 2.2, 0.08, mat(T, DARK), x, 1.1, 0.5); box(T, g, 2.7, 0.08, 1.6, mat(T, pick(P.accents, R)), 0, 2.25, 0.2).rotation.x = 0.25; for (let q = 0; q < 5; q++) box(T, g, 0.25, 0.22, 0.25, mat(T, P.accents[(q + 1) % P.accents.length]), -0.8 + q * 0.4, 1.0, 0.1); g.userData = { r: 1.5, h: 2.4 }; return g; },
  crate(T, P, R) { const g = new T.Group(); const s = 0.5 + R() * 0.3; box(T, g, s, s, s, mat(T, "#a8784a"), 0, s / 2, 0, R()); if (R() < 0.5) box(T, g, s * 0.7, s * 0.7, s * 0.7, mat(T, "#9a6a3e"), 0.05, s + s * 0.35, 0, R()); g.userData = { r: 0.6, h: 1.2 }; return g; },
  barrel(T, P) { const g = new T.Group(); cyl(T, g, 0.36, 0.32, 0.9, mat(T, WOOD), 0, 0.45, 0); for (const y of [0.25, 0.7]) cyl(T, g, 0.37, 0.37, 0.05, mat(T, "#2e2a26"), 0, y, 0); g.userData = { r: 0.45, h: 0.9 }; return g; },
  bunting(T, P) { const g = new T.Group(); for (const x of [-3, 3]) cyl(T, g, 0.06, 0.08, 4.2, mat(T, DARK), x, 2.1, 0); for (let q = 0; q < 9; q++) { const x = -2.7 + q * 0.68; const f = new T.Mesh(new T.ConeGeometry(0.2, 0.36, 3), mat(T, P.accents[q % P.accents.length], { side: T.DoubleSide })); f.position.set(x, 3.75 - 0.35 * (1 - (x / 3) ** 2), 0); f.rotation.x = Math.PI; g.add(f); } g.userData = { r: 3.2, h: 4.2, thin: true }; return g; },
  lanternString(T, P) { const g = new T.Group(); for (const x of [-3, 3]) cyl(T, g, 0.06, 0.08, 4.5, mat(T, DARK), x, 2.25, 0); const lm = glowMat(T, "#ffc870"); for (let q = 0; q < 7; q++) { const x = -2.4 + q * 0.8; ball(T, g, 0.17, lm, x, 4.05 - 0.4 * (1 - (x / 3) ** 2), 0); } g.userData = { r: 3.2, h: 4.5, thin: true, glow: [{ y: 3.9, colour: "#ffc870" }] }; return g; },
  lantern(T) { const g = new T.Group(); cyl(T, g, 0.05, 0.06, 1.6, mat(T, DARK), 0, 0.8, 0); box(T, g, 0.28, 0.38, 0.28, glowMat(T, "#ffbf5a"), 0, 1.8, 0); g.userData = { r: 0.3, h: 2, glow: [{ y: 1.8, colour: "#ffbf5a" }] }; return g; },
  lamppost(T) { const g = new T.Group(); cyl(T, g, 0.07, 0.1, 3.6, mat(T, "#2a2e36"), 0, 1.8, 0); box(T, g, 0.4, 0.5, 0.4, glowMat(T, "#fff0c8"), 0, 3.8, 0); g.userData = { r: 0.35, h: 4.1, glow: [{ y: 3.8, colour: "#ffe0a0" }] }; return g; },
  banner(T, P, R) { const g = new T.Group(); cyl(T, g, 0.05, 0.06, 3.6, mat(T, DARK), 0, 1.8, 0); const c = pick(P.accents, R); box(T, g, 0.9, 1.6, 0.04, mat(T, c), 0.48, 2.6, 0); box(T, g, 0.9, 0.18, 0.05, mat(T, "#f7d038"), 0.48, 1.8, 0); g.userData = { r: 0.6, h: 3.6 }; return g; },
  flowerpot(T, P, R) { const g = new T.Group(); cyl(T, g, 0.28, 0.22, 0.45, mat(T, "#b8543a"), 0, 0.22, 0); for (let q = 0; q < 5; q++) ball(T, g, 0.12, mat(T, pick(["#e8384a", "#f06aa8", "#f4c430", "#ff7a2a", "#8a5ad8"], R)), (R() - 0.5) * 0.35, 0.55 + R() * 0.15, (R() - 0.5) * 0.35); ball(T, g, 0.25, mat(T, "#3e8a3a"), 0, 0.5, 0); g.userData = { r: 0.35, h: 0.8 }; return g; },
  cart(T, P, R) { const g = new T.Group(); box(T, g, 1.6, 0.5, 1.0, mat(T, pick(P.accents, R)), 0, 0.75, 0); for (const x of [-0.6, 0.6]) { const w = cyl(T, g, 0.38, 0.38, 0.08, mat(T, DARK), x, 0.38, 0.55, 14); w.rotation.x = Math.PI / 2; } for (let q = 0; q < 6; q++) ball(T, g, 0.14, mat(T, pick(["#f7d038", "#d63031", "#7bd148", "#e67e22"], R)), -0.5 + (q % 3) * 0.5, 1.1, -0.2 + Math.floor(q / 3) * 0.4); g.userData = { r: 1.0, h: 1.3 }; return g; },
  bench(T) { const g = new T.Group(); box(T, g, 1.6, 0.08, 0.45, mat(T, "#9a6a3e"), 0, 0.45, 0); box(T, g, 1.6, 0.4, 0.06, mat(T, "#9a6a3e"), 0, 0.75, -0.2); for (const x of [-0.7, 0.7]) box(T, g, 0.08, 0.45, 0.4, mat(T, METAL), x, 0.22, 0); g.userData = { r: 0.9, h: 0.9 }; return g; },
  bush(T, P, R) { const g = new T.Group(); const c = pick(["#2f7a34", "#3e8a3a", "#4a9a42"], R); for (let q = 0; q < 3; q++) ball(T, g, 0.45 + R() * 0.2, mat(T, c), (q - 1) * 0.45, 0.45, (R() - 0.5) * 0.3); g.userData = { r: 0.9, h: 0.9 }; return g; },
  flowers(T, P, R) { const g = new T.Group(); box(T, g, 1.6, 0.12, 0.8, mat(T, "#4a3a2a"), 0, 0.06, 0); for (let q = 0; q < 12; q++) ball(T, g, 0.1, mat(T, pick(["#e8384a", "#f06aa8", "#f4c430", "#8a5ad8", "#ffffff"], R)), -0.7 + (q % 6) * 0.28, 0.25, -0.2 + Math.floor(q / 6) * 0.4); g.userData = { r: 0.9, h: 0.3 }; return g; },
  mailbox(T, P, R) { const g = new T.Group(); cyl(T, g, 0.05, 0.05, 1.0, mat(T, DARK), 0, 0.5, 0); box(T, g, 0.25, 0.3, 0.45, mat(T, pick(P.accents, R)), 0, 1.1, 0); g.userData = { r: 0.3, h: 1.25 }; return g; },
  bin(T, P, R) { const g = new T.Group(); cyl(T, g, 0.3, 0.27, 0.9, mat(T, pick(["#2e7a4a", "#2e5ab0", "#4a4e58"], R)), 0, 0.45, 0); g.userData = { r: 0.35, h: 0.9 }; return g; },
  fountain(T) { const g = new T.Group(); cyl(T, g, 1.4, 1.5, 0.5, mat(T, "#8a94a4"), 0, 0.25, 0, 20); cyl(T, g, 1.25, 1.25, 0.06, mat(T, "#3a8ad0", { roughness: 0.1, metalness: 0.2 }), 0, 0.48, 0, 20); cyl(T, g, 0.15, 0.2, 1.4, mat(T, "#8a94a4"), 0, 1.0, 0); cyl(T, g, 0.5, 0.3, 0.2, mat(T, "#8a94a4"), 0, 1.7, 0); g.userData = { r: 1.6, h: 1.8 }; return g; },
  washingLine(T, P, R) { const g = new T.Group(); for (const x of [-2.2, 2.2]) cyl(T, g, 0.05, 0.05, 2.6, mat(T, DARK), x, 1.3, 0); for (let q = 0; q < 6; q++) box(T, g, 0.42, 0.55, 0.03, mat(T, pick([...P.accents, "#ffffff", "#7fc8f8"], R)), -1.7 + q * 0.68, 2.15, 0); g.userData = { r: 2.4, h: 2.6, thin: true }; return g; },
  ropeCoil(T) { const g = new T.Group(); const o = new T.Mesh(new T.TorusGeometry(0.35, 0.08, 8, 20), mat(T, "#b89a5a")); o.rotation.x = Math.PI / 2; o.position.y = 0.08; g.add(o); g.userData = { r: 0.45, h: 0.2 }; return g; },
  shield(T, P, R) { const g = new T.Group(); cyl(T, g, 0.05, 0.05, 1.2, mat(T, DARK), 0, 0.6, 0); const s = cyl(T, g, 0.45, 0.45, 0.08, mat(T, pick(P.accents, R)), 0, 1.3, 0, 16); s.rotation.x = Math.PI / 2; ball(T, g, 0.1, mat(T, "#d4a017", { metalness: 0.7, roughness: 0.3 }), 0, 1.3, 0.06); g.userData = { r: 0.5, h: 1.8 }; return g; },
  torch(T) { const g = new T.Group(); cyl(T, g, 0.05, 0.07, 1.8, mat(T, WOOD), 0, 0.9, 0); ball(T, g, 0.17, glowMat(T, "#ff9a2a"), 0, 1.95, 0); g.userData = { r: 0.3, h: 2.1, glow: [{ y: 1.95, colour: "#ff9a3a" }] }; return g; },
  campfire(T) { const g = new T.Group(); for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; ball(T, g, 0.18, mat(T, "#6a6a72"), Math.cos(a) * 0.6, 0.12, Math.sin(a) * 0.6); } for (const r of [0.3, -0.5, 1.2]) box(T, g, 0.9, 0.12, 0.12, mat(T, WOOD), 0, 0.12, 0, r); const f = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 7), glowMat(T, "#ff8a1a")); f.position.y = 0.45; g.add(f); g.userData = { r: 0.9, h: 0.9, glow: [{ y: 0.6, colour: "#ff8a3a" }] }; return g; },
  tent(T, P, R) { const g = new T.Group(); const t = new T.Mesh(new T.ConeGeometry(1.3, 1.8, 4), mat(T, pick(P.accents, R))); t.position.y = 0.9; t.rotation.y = Math.PI / 4; t.castShadow = true; g.add(t); g.userData = { r: 1.4, h: 1.8 }; return g; },
  rock(T, P, R) { const g = new T.Group(); const s = 0.4 + R() * 0.6; const o = new T.Mesh(new T.DodecahedronGeometry(s, 0), mat(T, "#6a6a72", { flatShading: true })); o.position.y = s * 0.6; o.rotation.set(R(), R(), R()); o.castShadow = o.receiveShadow = true; g.add(o); g.userData = { r: s + 0.1, h: s * 1.4 }; return g; },
  log(T) { const g = new T.Group(); const o = cyl(T, g, 0.25, 0.25, 1.8, mat(T, "#6a4428"), 0, 0.25, 0); o.rotation.z = Math.PI / 2; g.userData = { r: 1.0, h: 0.5 }; return g; },
  mushroom(T, P, R) { const g = new T.Group(); cyl(T, g, 0.08, 0.1, 0.4, mat(T, "#f4ecd8"), 0, 0.2, 0); const c = new T.Mesh(new T.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(T, pick(["#d63031", "#e67e22"], R))); c.position.y = 0.38; g.add(c); g.userData = { r: 0.3, h: 0.7 }; return g; },
  hieroglyphWall(T, P, R) { const g = new T.Group(); const cv = document.createElement("canvas"); cv.width = 256; cv.height = 256; const c = cv.getContext("2d"); c.fillStyle = "#d8a860"; c.fillRect(0, 0, 256, 256); c.strokeStyle = "#5a3a1a"; c.lineWidth = 5; const cols = ["#2e86de", "#d63031", "#20bf6b", "#1a1a1a"]; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = cols[(x + y) % 4]; const cx = 32 + x * 64, cy = 32 + y * 64; if ((x * 7 + y * 3 + Math.floor(R() * 3)) % 3 === 0) { c.beginPath(); c.arc(cx, cy, 16, 0, 7); c.fill(); } else if ((x + y) % 2) { c.fillRect(cx - 6, cy - 22, 12, 44); c.fillRect(cx - 18, cy - 6, 36, 10); } else { c.beginPath(); c.moveTo(cx, cy - 20); c.lineTo(cx + 18, cy + 18); c.lineTo(cx - 18, cy + 18); c.fill(); } c.strokeRect(cx - 30, cy - 30, 60, 60); } const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; box(T, g, 3.2, 3.2, 0.5, new T.MeshStandardMaterial({ map: tx, roughness: 0.9 }), 0, 1.6, 0); g.userData = { r: 1.7, h: 3.2, wall: true }; return g; },
  obelisk(T) { const g = new T.Group(); box(T, g, 0.7, 4, 0.7, mat(T, "#d8b070"), 0, 2, 0); const p = new T.Mesh(new T.ConeGeometry(0.5, 0.6, 4), mat(T, "#d4a017", { metalness: 0.6, roughness: 0.35 })); p.position.y = 4.3; p.rotation.y = Math.PI / 4; g.add(p); g.userData = { r: 0.6, h: 4.6 }; return g; },
  palm(T) { const g = new T.Group(); cyl(T, g, 0.14, 0.2, 4, mat(T, "#8a6a3a"), 0, 2, 0); for (let q = 0; q < 6; q++) { const l = box(T, g, 0.4, 0.06, 2.0, mat(T, "#2e9a3a"), 0, 4.0, 0); l.rotation.set(0.5, (q / 6) * Math.PI * 2, 0); l.translateZ(0.9); } g.userData = { r: 1.2, h: 4.6 }; return g; },
  pot(T, P, R) { const g = new T.Group(); ball(T, g, 0.35, mat(T, pick(["#b8543a", "#2e86de", "#d4a017"], R)), 0, 0.35, 0); cyl(T, g, 0.15, 0.2, 0.25, mat(T, "#b8543a"), 0, 0.75, 0); g.userData = { r: 0.4, h: 0.9 }; return g; },
  pyramid(T) { const g = new T.Group(); const p = new T.Mesh(new T.ConeGeometry(9, 9, 4), mat(T, "#e0b070", { flatShading: true })); p.position.y = 4.5; p.rotation.y = Math.PI / 4; p.castShadow = true; g.add(p); g.userData = { r: 7, h: 9, far: true }; return g; },
  neonSign(T, P, R) { const g = new T.Group(); for (const x of [-0.8, 0.8]) cyl(T, g, 0.05, 0.05, 3, mat(T, METAL), x, 1.5, 0); box(T, g, 2.0, 0.9, 0.12, mat(T, "#14141e"), 0, 3.0, 0); const c = pick(P.accents, R); box(T, g, 1.7, 0.12, 0.05, glowMat(T, c), 0, 3.25, 0.08); box(T, g, 1.2, 0.12, 0.05, glowMat(T, P.accents[(P.accents.indexOf(c) + 1) % P.accents.length]), 0, 2.85, 0.08); g.userData = { r: 1.1, h: 3.5, glow: [{ y: 3.0, colour: c }] }; return g; },
  neonStrip(T, P, R) { const g = new T.Group(); const c = pick(P.accents, R); box(T, g, 0.12, 3.2, 0.12, glowMat(T, c), 0, 1.6, 0); g.userData = { r: 0.2, h: 3.2, glow: [{ y: 2.2, colour: c }] }; return g; },
  holoPillar(T, P, R) { const g = new T.Group(); cyl(T, g, 0.5, 0.6, 0.3, mat(T, "#22222e"), 0, 0.15, 0, 16); const m = glowMat(T, pick(P.accents, R)); m.transparent = true; m.opacity = 0.55; cyl(T, g, 0.35, 0.35, 2.4, m, 0, 1.5, 0, 16); g.userData = { r: 0.6, h: 2.7, glow: [{ y: 1.5, colour: "#28e0ff" }] }; return g; },
  bollard(T) { const g = new T.Group(); cyl(T, g, 0.2, 0.25, 0.7, mat(T, "#2a2e36"), 0, 0.35, 0); g.userData = { r: 0.3, h: 0.7 }; return g; },
  nets(T) { const g = new T.Group(); for (const x of [-1, 1]) cyl(T, g, 0.05, 0.05, 2, mat(T, WOOD), x, 1, 0); box(T, g, 2, 1.4, 0.03, mat(T, "#5a8a8a", { transparent: true, opacity: 0.7 }), 0, 1.2, 0); g.userData = { r: 1.1, h: 2, thin: true }; return g; },
  anchor(T) { const g = new T.Group(); cyl(T, g, 0.07, 0.07, 1.4, mat(T, METAL), 0, 0.7, 0); const t = new T.Mesh(new T.TorusGeometry(0.45, 0.07, 6, 16, Math.PI), mat(T, METAL)); t.rotation.z = Math.PI; t.position.y = 0.45; g.add(t); g.userData = { r: 0.55, h: 1.4 }; return g; },
  snowman(T) { const g = new T.Group(); const w = mat(T, "#f4f8ff"); ball(T, g, 0.45, w, 0, 0.42, 0); ball(T, g, 0.32, w, 0, 1.05, 0); ball(T, g, 0.22, w, 0, 1.5, 0); box(T, g, 0.6, 0.08, 0.1, mat(T, "#d63031"), 0, 1.3, 0.2); g.userData = { r: 0.5, h: 1.7 }; return g; },
  // indoor
  rug(T, P, R) { const g = new T.Group(); const o = box(T, g, 2.2, 0.02, 1.5, mat(T, pick(P.accents, R)), 0, 0.012, 0); o.castShadow = false; box(T, g, 1.7, 0.022, 1.0, mat(T, pick(P.walls, R)), 0, 0.015, 0).castShadow = false; g.userData = { r: 0.2, h: 0.03, flat: true }; return g; },
  plant(T, P, R) { const g = new T.Group(); cyl(T, g, 0.22, 0.18, 0.4, mat(T, pick(P.accents, R)), 0, 0.2, 0); for (let q = 0; q < 4; q++) ball(T, g, 0.22, mat(T, "#3e8a3a"), (R() - 0.5) * 0.3, 0.6 + q * 0.15, (R() - 0.5) * 0.3); g.userData = { r: 0.3, h: 1.1 }; return g; },
  floorLamp(T) { const g = new T.Group(); cyl(T, g, 0.2, 0.2, 0.04, mat(T, DARK), 0, 0.02, 0); cyl(T, g, 0.03, 0.03, 1.5, mat(T, DARK), 0, 0.75, 0); cyl(T, g, 0.18, 0.3, 0.35, glowMat(T, "#ffd9a0"), 0, 1.6, 0); g.userData = { r: 0.3, h: 1.8, glow: [{ y: 1.6, colour: "#ffd29a" }] }; return g; },
  shelf(T, P, R) { const g = new T.Group(); box(T, g, 1.2, 1.6, 0.35, mat(T, WOOD), 0, 0.8, 0); for (let y = 0; y < 3; y++) for (let q = 0; q < 5; q++) box(T, g, 0.14, 0.3, 0.25, mat(T, pick([...P.accents, ...P.walls], R)), -0.45 + q * 0.22, 0.35 + y * 0.5, 0.05); g.userData = { r: 0.7, h: 1.6, wall: true }; return g; },
  picture(T, P, R) { const g = new T.Group(); box(T, g, 0.8, 0.6, 0.04, mat(T, DARK), 0, 1.6, 0); box(T, g, 0.68, 0.48, 0.05, mat(T, pick(P.accents, R)), 0, 1.6, 0.01); g.userData = { r: 0.2, h: 1.9, wall: true, hang: true }; return g; },
  poster(T, P, R) { const g = new T.Group(); box(T, g, 0.7, 0.95, 0.02, mat(T, pick(P.accents, R)), 0, 1.6, 0); box(T, g, 0.5, 0.3, 0.025, mat(T, "#ffffff"), 0, 1.75, 0.005); g.userData = { r: 0.2, h: 2.1, wall: true, hang: true }; return g; },
  stringLights(T, P) { const g = new T.Group(); for (let q = 0; q < 10; q++) ball(T, g, 0.06, glowMat(T, P.accents[q % P.accents.length]), -1.35 + q * 0.3, 2.3 - 0.15 * Math.sin((q / 9) * Math.PI), 0); g.userData = { r: 0.2, h: 2.4, wall: true, hang: true, glow: [{ y: 2.2, colour: "#ffd9a0" }] }; return g; },
  toyBox(T, P, R) { const g = new T.Group(); box(T, g, 0.8, 0.5, 0.5, mat(T, pick(P.accents, R)), 0, 0.25, 0); ball(T, g, 0.14, mat(T, "#f7d038"), 0.2, 0.62, 0); box(T, g, 0.2, 0.2, 0.2, mat(T, "#2e86de"), -0.2, 0.6, 0); g.userData = { r: 0.5, h: 0.75 }; return g; },
  workbench(T) { const g = new T.Group(); box(T, g, 2.0, 0.1, 0.8, mat(T, "#9a6a3e"), 0, 0.9, 0); for (const x of [-0.9, 0.9]) box(T, g, 0.1, 0.9, 0.7, mat(T, DARK), x, 0.45, 0); box(T, g, 0.3, 0.2, 0.2, mat(T, "#d63031"), -0.5, 1.05, 0); box(T, g, 0.5, 0.08, 0.1, mat(T, METAL), 0.3, 0.99, 0.1); g.userData = { r: 1.1, h: 1.1, wall: true }; return g; },
  toolWall(T, P, R) { const g = new T.Group(); box(T, g, 1.8, 1.2, 0.05, mat(T, "#c8a070"), 0, 1.6, 0); for (let q = 0; q < 7; q++) box(T, g, 0.08, 0.4 + R() * 0.3, 0.06, mat(T, q % 2 ? METAL : pick(P.accents, R)), -0.75 + q * 0.25, 1.6, 0.05); g.userData = { r: 0.2, h: 2.2, wall: true, hang: true }; return g; },
  gear(T, P, R) { const g = new T.Group(); const o = new T.Mesh(new T.TorusGeometry(0.35, 0.1, 6, 12), mat(T, pick(["#d4a017", METAL], R), { metalness: 0.6, roughness: 0.4 })); o.position.y = 0.45; g.add(o); g.userData = { r: 0.45, h: 0.9 }; return g; },
  breadShelf(T) { const g = new T.Group(); box(T, g, 1.6, 1.5, 0.4, mat(T, WOOD), 0, 0.75, 0); for (let y = 0; y < 3; y++) for (let q = 0; q < 4; q++) { const b = ball(T, g, 0.14, mat(T, "#c8803a"), -0.55 + q * 0.37, 0.35 + y * 0.45, 0.05); b.scale.set(1.6, 0.8, 1); } g.userData = { r: 0.9, h: 1.5, wall: true }; return g; },
  oven(T) { const g = new T.Group(); box(T, g, 1.2, 1.4, 0.9, mat(T, "#8a4a3a"), 0, 0.7, 0); box(T, g, 0.6, 0.4, 0.05, glowMat(T, "#ff7a2a"), 0, 0.7, 0.46); g.userData = { r: 0.8, h: 1.4, wall: true, glow: [{ y: 0.8, colour: "#ff8a3a" }] }; return g; },
};

// ------------------------------------------------------------------------------------------------ placing
const ROOM_WALL = /wall|plaster/i;
/** the solid boxes of a set (meshes not too big, not ground): where a prop may not stand */
function solidsOf(T, S, root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.themeProp) return;
    const b = new T.Box3().setFromObject(o), s = b.getSize(new T.Vector3());
    if (s.y < 0.25 || s.x > 40 || s.z > 40) return; // ground planes, roads, far landscape
    out.push(b);
  });
  return out;
}
const visibleChain = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };

/**
 * The dresser of one set. dress(shot): the shot's place + theme -> one cached dressing group visible (or none).
 * S.themePracticals: [{ pos: Vector3 (world), colour }] the rig layer's practical lights for this dressing.
 */
export function makeDresser(S, ctx) {
  const T = ctx.THREE;
  const groups = new Map();
  let cur = null, curKey = null, solidsCache = new Map();
  const holder = () => S.actorMount?.() ?? S.root; // a creature's town: the carrier (the spots are in its coordinates)
  const wallMats = [];
  S.root.traverse((o) => { if (o.isMesh && o.material?.userData?.themeWall) wallMats.push(o.material); });
  for (const m of wallMats) m.userData.baseColor ??= m.color.clone();

  function build(key, shot, theme) {
    const th = THEMES[theme], P = th.palette, R = rng(hashSeed(key) % 100000 + 7);
    const g = new T.Group(); g.name = `theme:${key}`;
    const par = holder(); par.add(g);
    const sp = S.spots, c = sp.center.clone();
    let d = sp.far.clone().sub(c).setY(0);
    if (d.lengthSq() < 1e-4) d = (S.camDir ?? new T.Vector3(0, 0, 1)).clone().negate().setY(0);
    d.normalize();
    const l = new T.Vector3(-d.z, 0, d.x);
    const indoor = !!S.indoor || th.indoor && !!S.bounds?.length && S.bounds[0].getSize(new T.Vector3()).x < 14;
    const n = (DENSITY[th.density] ?? DENSITY.normal)[indoor ? "indoor" : "outdoor"];
    // solids in the holder's coordinates (a creature's carrier: rest coordinates)
    const sk = `${S.name}|${c.toArray().map((x) => x.toFixed(1)).join()}`;
    if (!solidsCache.has(sk)) {
      const inv = new T.Matrix4().copy(par.matrixWorld).invert();
      solidsCache.set(sk, solidsOf(T, S, S.root).filter((b) => b.distanceToPoint(par.localToWorld(c.clone())) < 30).map((b) => b.clone().applyMatrix4(inv)));
    }
    const solids = solidsCache.get(sk);
    const people = ["center", "left", "right", "back", "door", "far"].map((k) => sp[k]).filter(Boolean);
    const placed = [], prac = [];
    const props = th.props.length ? th.props : [];
    const room = indoor ? S.bounds?.[0] ?? null : null;
    const groundY = (x, z) => (S.surface && S.actorMount?.() ? S.surface(x, z) : c.y);
    const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0);
    const targets = []; S.root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.themeProp) targets.push(o); });
    const blockedAt = (x, z, gy) => {
      const from = par.localToWorld(new T.Vector3(x, gy + (indoor ? 2.2 : 15), z)), gw = par.localToWorld(new T.Vector3(x, gy, z)).y;
      ray.set(from, down); ray.far = (indoor ? 2.2 : 15) + 1;
      const hit = ray.intersectObjects(targets, false).find((h) => visibleChain(h.object) && !(h.object.material?.transparent && h.object.material.opacity < 0.5));
      return !!hit && hit.point.y > gw + 0.35;
    };
    const tries = n * 14;
    for (let k = 0, made = 0; k < tries && made < n && props.length; k++) {
      const name = props[(made + Math.floor(R() * 2)) % props.length];
      const mk = PROP_MAKERS[name]; if (!mk) continue;
      let pos, ry;
      if (room) {
        // against the back or a side wall, inside the camera's room box
        const side = R() < 0.55 ? "back" : R() < 0.5 ? "left" : "right";
        const mn = room.min, mx = room.max, m = 0.15;
        if (side === "back") { pos = new T.Vector3(mn.x + 0.6 + R() * (mx.x - mn.x - 1.2), c.y, mn.z + m); ry = 0; }
        else { pos = new T.Vector3(side === "left" ? mn.x + m : mx.x - m, c.y, mn.z + 0.8 + R() * (mx.z - mn.z) * 0.55); ry = side === "left" ? Math.PI / 2 : -Math.PI / 2; }
        if (Math.abs(d.z) < 0.5) { ry += Math.PI / 2; } // a room seen along x: a rough turn (the walls guard below catches misses)
      } else {
        const behind = R() < 0.62;
        const dep = behind ? 3 + R() * 11 : -1.5 + R() * 4.5;
        const lat = (R() < 0.5 ? -1 : 1) * (behind ? 2.4 + R() * 6 : 4.6 + R() * 3.5);
        pos = c.clone().addScaledVector(d, dep).addScaledVector(l, lat);
        ry = Math.atan2(-d.x, -d.z) + (R() - 0.5) * 0.6; // faces the camera side
      }
      const obj = mk(T, P, R);
      const u = obj.userData;
      if (u.far) { pos = c.clone().addScaledVector(d, 40 + R() * 20).addScaledVector(l, (R() - 0.5) * 30); }
      const gy = groundY(pos.x, pos.z);
      if (gy == null || Math.abs(gy - c.y) > 0.6) continue; // on a roof / off the walkable ground
      pos.y = gy;
      const r = u.r ?? 0.5;
      if (!u.flat && people.some((p) => Math.hypot(p.x - pos.x, p.z - pos.z) < r + 0.9)) continue;
      if (placed.some((q) => Math.hypot(q.x - pos.x, q.z - pos.z) < q.r + r + 0.2)) continue;
      const fb = new T.Box3(new T.Vector3(pos.x - r * 0.8, pos.y + 0.15, pos.z - r * 0.8), new T.Vector3(pos.x + r * 0.8, pos.y + (u.h ?? 1), pos.z + r * 0.8));
      if (!u.far && !u.hang && solids.some((b) => b.intersectsBox(fb))) continue;
      // merged set geometry (houses, counters) is one big mesh the box test skips: a ray down at the prop's centre and two
      // corners must reach the ground first (never a roof, a counter or a bed)
      if (!u.far && !u.hang && !u.flat && [[0, 0], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7]].some(([dx, dz]) => blockedAt(pos.x + dx, pos.z + dz, pos.y))) continue;
      if (S.inBuilding?.(pos.x, pos.z)) continue;
      obj.position.copy(pos); obj.rotation.y = ry;
      obj.traverse((o) => { o.userData.themeProp = true; });
      g.add(obj); placed.push({ x: pos.x, z: pos.z, r }); made++;
      for (const gl of u.glow ?? []) prac.push({ local: pos.clone().setY(pos.y + gl.y), colour: gl.colour });
    }
    g.userData.practicals = prac;
    g.visible = false;
    return g;
  }

  function dress(shot) {
    const theme = shot?.theme && THEMES[shot.theme] ? shot.theme : null;
    const key = theme ? `${S.name}|${shot.placeId ?? shot.place ?? shot.worldSpot ?? ""}|${theme}` : null;
    // the glow (lanterns, neon, fire) follows the shot's light every frame (cheap)
    const k = { day: 0.25, warm: 1.2, dusk: 1.8, dawn: 0.8, night: 3.2 }[shot?.light] ?? 0.4;
    for (const m of GLOW) m.emissiveIntensity = THEMES[theme]?.neon ? Math.max(k, 1.6) : k;
    if (key === curKey) return;
    curKey = key;
    if (cur) cur.visible = false;
    cur = null; S.themePracticals = [];
    // wall tint (indoor places): the palette's first wall colour over the plaster texture; else the set's own colour
    const th = THEMES[theme];
    const h0 = hashSeed(key ?? "");
    wallMats.forEach((m, i) => m.color.copy(th?.indoor ? new T.Color(th.palette.walls[(h0 + i) % th.palette.walls.length]).lerp(new T.Color("#ffffff"), 0.2) : m.userData.baseColor));
    if (!theme) return;
    if (!groups.has(key)) { try { groups.set(key, build(key, shot, theme)); } catch (e) { console.warn(`themes: dressing ${key} failed: ${e.message}`); groups.set(key, null); } }
    cur = groups.get(key);
    if (!cur) return;
    cur.visible = true;
    cur.updateMatrixWorld(true);
    S.themePracticals = cur.userData.practicals.map((p) => ({ pos: cur.parent.localToWorld(p.local.clone()), colour: p.colour }));
  }
  return { dress, groups };
}

/** wrap S.setPlace so every shot's place is dressed with its theme (the engine calls setPlace every frame) */
export function attachDresser(S, ctx) {
  if (!S || S._dresser || !ctx?.THREE) return S;
  const D = makeDresser(S, ctx);
  S._dresser = D;
  const own = S.setPlace;
  S.setPlace = (place, shot = null, ...rest) => { const r = own ? own(place, shot, ...rest) : undefined; try { D.dress(shot); } catch (e) { console.warn(`themes: ${e.message}`); } return r; };
  return S;
}
export { ROOM_WALL, visibleChain };
