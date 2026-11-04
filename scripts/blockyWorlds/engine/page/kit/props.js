// Props for Blocky Worlds: story inserts (a town sign, a taped note), markers that float above heads, and small
// hand props. Everything faces +z, y is up, metres. Canvas text uses Lilita One (awaited at import).
import * as THREE from "three";
import { rng, hashSeed, boxGeo, cachedGeo, cachedMat, solid, fabric, rbx, bx, addMesh, canvasTex, loadKitFonts, kitFont, fitText } from "./kitCommon.js";

await loadKitFonts(); // so the first sign/note/marker is drawn in Lilita, not a fallback

// =====================================================================================================
// Inserts: origin on the ground, the board faces +z with its centre at userData.focus (y 1.4), ~1.2 x 0.8 m.
// =====================================================================================================
const SIGN_STYLES = [
  { bg: "#1f6b45", ink: "#ffffff", rim: "#ffffff" },   // town green
  { bg: "#f3e7c9", ink: "#7a1c1c", rim: "#7a1c1c" },   // cream, painted red
  { bg: "#f4c430", ink: "#1b1b1b", rim: "#1b1b1b" },   // warning yellow
  { bg: "#ffffff", ink: "#c0262d", rim: "#c0262d" },   // white with red
  { bg: "#24447a", ink: "#ffffff", rim: "#ffffff" },   // town blue
];
function wear(p, w, h, R, { spots = 70, ink = "rgba(60,40,20,0.18)", chips = "rgba(255,255,255,0.22)" } = {}) {
  for (let i = 0; i < spots; i++) { // grime and chipped paint
    p.fillStyle = R() < 0.5 ? ink : chips;
    const x = R() * w, y = R() * h, r = 2 + R() * (R() < 0.15 ? 14 : 5);
    p.beginPath(); p.ellipse(x, y, r * (0.6 + R()), r, R() * 3, 0, Math.PI * 2); p.fill();
  }
  for (let i = 0; i < 18; i++) { // scratches
    p.strokeStyle = "rgba(255,255,255,0.18)"; p.lineWidth = 1 + R() * 1.5; const x = R() * w, y = R() * h;
    p.beginPath(); p.moveTo(x, y); p.lineTo(x + (R() - 0.5) * 120, y + (R() - 0.5) * 30); p.stroke();
  }
  const g = p.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7); // weathered edges
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(40,25,10,0.28)"); p.fillStyle = g; p.fillRect(0, 0, w, h);
}
function signTexture(text, seed) {
  const W = 1024, H = 683, c = document.createElement("canvas"); c.width = W; c.height = H; const p = c.getContext("2d");
  const R = rng(seed), st = SIGN_STYLES[seed % SIGN_STYLES.length];
  p.fillStyle = st.bg; p.fillRect(0, 0, W, H);
  p.strokeStyle = st.rim; p.lineWidth = 16; p.beginPath(); p.roundRect(30, 30, W - 60, H - 60, 28); p.stroke();
  p.lineWidth = 4; p.beginPath(); p.roundRect(52, 52, W - 104, H - 104, 18); p.stroke();
  const { lines, size } = fitText(p, String(text).toUpperCase(), W - 170, H - 170, { maxSize: 190, maxLines: 4, lineGap: 1.02 });
  p.font = kitFont(size); p.fillStyle = st.ink; p.textAlign = "center"; p.textBaseline = "middle";
  const lh = size * 1.02, y0 = H / 2 - ((lines.length - 1) * lh) / 2 + size * 0.04;
  lines.forEach((l, i) => p.fillText(l, W / 2, y0 + i * lh));
  wear(p, W, H, R);
  for (const [x, y] of [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70]]) { // bolts
    p.fillStyle = "#b8b8b0"; p.beginPath(); p.arc(x, y, 11, 0, Math.PI * 2); p.fill(); p.fillStyle = "rgba(0,0,0,0.35)"; p.beginPath(); p.arc(x + 2, y + 2, 5, 0, Math.PI * 2); p.fill();
  }
  return canvasTex(c);
}
function noteTexture(text, seed) {
  const W = 640, H = 760, c = document.createElement("canvas"); c.width = W; c.height = H; const p = c.getContext("2d");
  const R = rng(seed);
  p.fillStyle = "#fbf6e6"; p.fillRect(0, 0, W, H);
  p.strokeStyle = "rgba(70,130,210,0.45)"; p.lineWidth = 3; for (let y = 120; y < H - 20; y += 56) { p.beginPath(); p.moveTo(0, y); p.lineTo(W, y); p.stroke(); }
  p.strokeStyle = "rgba(220,60,60,0.55)"; p.beginPath(); p.moveTo(70, 0); p.lineTo(70, H); p.stroke();
  const { lines, size } = fitText(p, text, W - 150, H - 170, { maxSize: 112, maxLines: 6, lineGap: 1.12 });
  p.font = kitFont(size); p.fillStyle = "#1d2b6b"; p.textAlign = "left"; p.textBaseline = "middle";
  const lh = size * 1.12, y0 = H / 2 - ((lines.length - 1) * lh) / 2 + 10;
  lines.forEach((l, i) => { p.save(); p.translate(96 + (R() - 0.5) * 14, y0 + i * lh); p.rotate((R() - 0.5) * 0.06); p.fillText(l, 0, 0); p.restore(); });
  wear(p, W, H, R, { spots: 25, ink: "rgba(120,90,40,0.08)", chips: "rgba(255,255,255,0.1)" });
  p.strokeStyle = "rgba(120,100,60,0.25)"; p.lineWidth = 2; p.beginPath(); p.moveTo(0, H * 0.48); p.lineTo(W, H * 0.5); p.stroke(); // a fold
  return canvasTex(c);
}
const woodMat = () => fabric("#7a5534", "cotton");
function postsAndBoard(g, w, h, boardMat) {
  const wood = woodMat();
  for (const s of [-1, 1]) {
    rbx(0.1, 1.95, 0.1, 0.012, wood, { x: s * (w / 2 - 0.12), y: 0.975, z: -0.07, parent: g });
    rbx(0.12, 0.05, 0.12, 0.01, solid("#4a3420"), { x: s * (w / 2 - 0.12), y: 1.97, z: -0.07, parent: g });
  }
  const side = solid("#5a3d24", { roughness: 0.8 });
  const board = new THREE.Mesh(boxGeo(w, h, 0.05), [side, side, side, side, boardMat, side]);
  board.position.set(0, 1.4, 0); board.castShadow = board.receiveShadow = true; g.add(board);
  return board;
}
/** a story insert: { kind: "sign" | "note", text }. Origin on the ground; board centre at userData.focus. */
export function makeInsert({ kind = "sign", text = "" } = {}) {
  const g = new THREE.Group(); g.name = `insert:${kind}`;
  const seed = hashSeed(`${kind}|${text}`);
  if (kind === "note") {
    const wood = fabric("#9a6b43", "pinstripe");
    // a little notice board of planks on two posts, the note taped on
    postsAndBoard(g, 1.3, 1.0, wood);
    for (let i = -2; i <= 2; i++) bx(0.012, 1.0, 0.004, solid("#5a3d24"), { x: i * 0.26, y: 1.4, z: 0.027, parent: g, shadow: false });
    const R = rng(seed);
    const paper = new THREE.Group(); paper.position.set(0.02, 1.4, 0.032); paper.rotation.z = (R() - 0.5) * 0.08; g.add(paper);
    const pm = new THREE.MeshStandardMaterial({ map: noteTexture(text, seed), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
    addMesh(new THREE.PlaneGeometry(0.62, 0.74), pm, { parent: paper, shadow: false }).receiveShadow = true;
    const tape = cachedMat("kitTape", () => new THREE.MeshStandardMaterial({ color: "#f1e6c0", roughness: 0.5, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }));
    for (const s of [-1, 1]) addMesh(new THREE.PlaneGeometry(0.2, 0.06), tape, { x: s * 0.29, y: 0.36, z: 0.002, rz: s * -0.6, parent: paper, shadow: false });
    addMesh(cachedGeo("pinHead", () => new THREE.SphereGeometry(0.022, 12, 8)), solid("#e53935", { roughness: 0.3 }), { y: 0.33, z: 0.012, parent: paper });
    g.userData.size = [1.3, 1.0];
  } else {
    const face = new THREE.MeshStandardMaterial({ map: signTexture(text, seed), roughness: 0.55, metalness: 0.05 });
    postsAndBoard(g, 1.2, 0.8, face);
    g.userData.size = [1.2, 0.8];
  }
  g.userData.focus = new THREE.Vector3(0, 1.4, 0);
  g.userData.kind = kind;
  return g;
}

// =====================================================================================================
// Markers: origin at the bottom (put it ~0.15 m above the head top), userData.billboard = true.
// =====================================================================================================
function tagTexture(text) {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const p = c.getContext("2d");
  p.translate(S / 2, S / 2 + 30); p.rotate(-0.16); p.translate(-S / 2, -S / 2);
  // string loop from the hole up out of the card
  p.strokeStyle = "#f3efe2"; p.lineWidth = 9; p.lineCap = "round";
  p.beginPath(); p.moveTo(120, 230); p.bezierCurveTo(60, 120, 140, 30, 190, 40); p.stroke();
  p.strokeStyle = "rgba(0,0,0,0.25)"; p.lineWidth = 3; p.stroke();
  // the card: a rectangle with a notched left end
  p.beginPath(); p.moveTo(80, 256); p.lineTo(150, 170); p.lineTo(450, 170); p.lineTo(450, 342); p.lineTo(150, 342); p.closePath();
  p.fillStyle = "#ffd84a"; p.fill(); p.lineWidth = 10; p.strokeStyle = "#2a1d24"; p.lineJoin = "round"; p.stroke();
  p.fillStyle = "#2a1d24"; p.beginPath(); p.arc(125, 256, 16, 0, Math.PI * 2); p.fill(); p.fillStyle = "#fff6c8"; p.beginPath(); p.arc(125, 256, 9, 0, Math.PI * 2); p.fill();
  const { size } = fitText(p, text, 270, 140, { maxSize: 130, maxLines: 1 });
  p.font = kitFont(size); p.fillStyle = "#2a1d24"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText(text, 305, 262);
  return canvasTex(c);
}
function iconTexture(text) {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S; const p = c.getContext("2d");
  p.fillStyle = "#2a1d24"; p.beginPath(); p.arc(256, 256, 250, 0, Math.PI * 2); p.fill();
  p.fillStyle = "#ffffff"; p.beginPath(); p.arc(256, 256, 232, 0, Math.PI * 2); p.fill();
  p.fillStyle = "#ff4d6d"; p.beginPath(); p.arc(256, 256, 206, 0, Math.PI * 2); p.fill();
  p.fillStyle = "rgba(255,255,255,0.25)"; p.beginPath(); p.ellipse(200, 150, 120, 60, -0.5, 0, Math.PI * 2); p.fill();
  const emoji = /\p{Extended_Pictographic}/u.test(text);
  if (emoji) { p.font = `230px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText(text, 256, 270); }
  else {
    const { size } = fitText(p, text, 330, 300, { maxSize: 220, maxLines: 2 });
    p.font = kitFont(size); p.textAlign = "center"; p.textBaseline = "middle"; p.lineJoin = "round";
    p.lineWidth = size * 0.14; p.strokeStyle = "#2a1d24"; p.strokeText(text, 256, 268); p.fillStyle = "#fff"; p.fillText(text, 256, 268);
  }
  return canvasTex(c);
}
/** { kind: "tag" | "ring" | "icon", text } -> a billboard (userData.billboard = true); origin at its bottom */
export function makeMarker({ kind = "tag", text = "" } = {}) {
  const g = new THREE.Group(); g.name = `marker:${kind}`;
  const inner = new THREE.Group(); g.add(inner); g.userData.inner = inner;
  if (kind === "ring") {
    const glow = new THREE.MeshStandardMaterial({ color: "#fff3b0", emissive: "#ffd34d", emissiveIntensity: 3.2, roughness: 0.3 });
    const ring = addMesh(cachedGeo("haloRing", () => new THREE.TorusGeometry(0.2, 0.032, 12, 48)), glow, { y: 0.08, rx: Math.PI / 2 - 0.42, parent: inner, shadow: false });
    ring.castShadow = false; g.userData.height = 0.2;
  } else {
    const t = kind === "icon" ? iconTexture(text || "!") : tagTexture(text || "$");
    const size = kind === "icon" ? 0.42 : 0.5;
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.6, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.3 });
    const geo = kind === "icon" ? cachedGeo("iconDisc", () => new THREE.CircleGeometry(0.21, 40)) : cachedGeo("tagPlane", () => new THREE.PlaneGeometry(0.5, 0.5));
    addMesh(geo, m, { y: size / 2, parent: inner, shadow: false });
    g.userData.height = size;
  }
  g.userData.billboard = true; g.userData.kind = kind;
  return g;
}
/** optional: a gentle deterministic bob/spin for a marker at time t */
export function animateMarker(m, t) {
  const inner = m.userData.inner; if (!inner) return;
  inner.position.y = 0.03 * Math.sin(t * 2.4);
  inner.rotation.z = m.userData.kind === "tag" ? 0.08 * Math.sin(t * 1.7) : 0;
}

// =====================================================================================================
// Held props: origin at the grip, up = +y, front = +z (a flashlight shines along +z). Real-world sizes.
// =====================================================================================================
const HELD_ALIASES = [
  [/sock/, "sock"], [/flash|torch/, "flashlight"], [/candle/, "candle"], [/book|diary|journal/, "book"], [/phone|mobile/, "phone"],
  [/bag|purse|sack/, "bag"], [/key/, "key"], [/ball/, "ball"], [/box|package|parcel|gift|present/, "box"], [/sign|placard|poster/, "sign"],
  [/bread|loaf|sandwich|food/, "bread"], [/cup|mug|coffee|tea/, "cup"], [/lantern|lamp/, "lantern"], [/rope/, "rope"], [/umbrella/, "umbrella"],
  [/note|letter|paper|map|envelope/, "paper"],
];
const PROTO = new Map();
const glowMat = (color, k) => cachedMat(`glow${color}${k}`, () => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: color, emissiveIntensity: k, roughness: 0.4 }));
const cyl = (r1, r2, h, seg = 14) => cachedGeo(`cyl${r1},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const BUILD = {
  sock(g) {
    const m = fabric("#e84a5f", "stripes");
    rbx(0.1, 0.24, 0.05, 0.015, m, { y: -0.13, parent: g });
    rbx(0.1, 0.08, 0.16, 0.02, m, { y: -0.27, z: 0.05, parent: g });
    rbx(0.11, 0.035, 0.06, 0.01, solid("#ffffff"), { y: -0.015, parent: g });
  },
  flashlight(g) {
    const body = solid("#2d3436", { roughness: 0.35, metalness: 0.5 });
    addMesh(cyl(0.028, 0.028, 0.18), body, { z: -0.02, rx: Math.PI / 2, parent: g });
    addMesh(cyl(0.048, 0.032, 0.07), solid("#f9ca24", { roughness: 0.4 }), { z: 0.1, rx: Math.PI / 2, parent: g });
    addMesh(cachedGeo("lens", () => new THREE.CircleGeometry(0.042, 20)), glowMat("#fff2c0", 4), { z: 0.136, parent: g, shadow: false });
    const beamMat = cachedMat("beam", () => new THREE.MeshBasicMaterial({ color: "#fff1c4", transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const beamGeo = cachedGeo("beamGeo", () => { const c = new THREE.ConeGeometry(0.42, 1.8, 20, 1, true); c.translate(0, -0.9, 0); return c; });
    const beam = addMesh(beamGeo, beamMat, { z: 0.14, rx: -Math.PI / 2, parent: g, shadow: false }); beam.castShadow = beam.receiveShadow = false; beam.name = "beam";
  },
  candle(g) {
    addMesh(cyl(0.065, 0.075, 0.025, 18), solid("#c9a94a", { metalness: 0.8, roughness: 0.3 }), { y: 0, parent: g });
    addMesh(cyl(0.028, 0.028, 0.15), solid("#fff4dc", { roughness: 0.7 }), { y: 0.085, parent: g });
    const flame = addMesh(cachedGeo("flame", () => { const s = new THREE.SphereGeometry(0.02, 10, 8); s.scale(1, 1.9, 1); return s; }), glowMat("#ffae3b", 6), { y: 0.19, parent: g, shadow: false });
    flame.castShadow = false;
  },
  book(g) {
    rbx(0.17, 0.23, 0.045, 0.006, fabric("#2e86de", "leather"), { parent: g });
    bx(0.155, 0.215, 0.047, solid("#f6f0dd"), { x: 0.012, parent: g });
    bx(0.06, 0.02, 0.002, solid("#ffd84a"), { y: 0.06, z: 0.0235, parent: g });
  },
  phone(g) {
    rbx(0.075, 0.15, 0.012, 0.005, solid("#151517", { roughness: 0.25, metalness: 0.4 }), { parent: g });
    bx(0.066, 0.135, 0.002, glowMat("#7fc8ff", 0.9), { z: 0.0065, parent: g, shadow: false });
  },
  bag(g) {
    const m = fabric("#e84a5f", "leather");
    rbx(0.32, 0.26, 0.12, 0.03, m, { y: -0.2, parent: g });
    addMesh(cachedGeo("bagHandle", () => new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI)), solid("#3a2a1e"), { y: -0.07, parent: g });
  },
  key(g) {
    const gold = solid("#d8b45a", { metalness: 0.85, roughness: 0.3 });
    addMesh(cachedGeo("keyRing", () => new THREE.TorusGeometry(0.022, 0.008, 6, 16)), gold, { y: 0.03, parent: g });
    bx(0.012, 0.07, 0.008, gold, { y: -0.025, parent: g });
    bx(0.022, 0.012, 0.008, gold, { x: 0.012, y: -0.05, parent: g });
  },
  ball(g) {
    addMesh(cachedGeo("ball", () => new THREE.SphereGeometry(0.11, 18, 12)), solid("#e74c3c", { roughness: 0.45 }), { parent: g });
    addMesh(cachedGeo("ballBand", () => new THREE.TorusGeometry(0.11, 0.012, 6, 30)), solid("#ffffff", { roughness: 0.45 }), { rx: Math.PI / 2, parent: g });
  },
  box(g) {
    rbx(0.34, 0.26, 0.28, 0.01, fabric("#b88a57", "cotton"), { parent: g });
    bx(0.08, 0.262, 0.282, solid("#d9c7a0", { roughness: 0.5 }), { parent: g });
  },
  sign(g) {
    bx(0.03, 0.55, 0.03, woodMat(), { y: 0.1, parent: g });
    const t = signTexture("HELP", 3);
    const side = solid("#5a3d24");
    const b = new THREE.Mesh(boxGeo(0.46, 0.32, 0.02), [side, side, side, side, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), side]);
    b.position.y = 0.48; b.castShadow = true; g.add(b);
  },
  bread(g) {
    rbx(0.3, 0.11, 0.13, 0.04, fabric("#d9963f", "cotton"), { parent: g });
    for (const x of [-0.08, 0, 0.08]) bx(0.02, 0.012, 0.1, solid("#f2cf8a"), { x, y: 0.054, rz: 0.4, parent: g });
  },
  cup(g) {
    addMesh(cyl(0.045, 0.036, 0.11), solid("#ffffff", { roughness: 0.5 }), { parent: g });
    addMesh(cyl(0.047, 0.042, 0.045), solid("#a0522d"), { y: -0.005, parent: g });
    addMesh(cyl(0.048, 0.048, 0.015), solid("#f2f2f2"), { y: 0.062, parent: g });
  },
  lantern(g) {
    const metal = solid("#2b2f33", { metalness: 0.6, roughness: 0.4 });
    addMesh(cachedGeo("lantHandle", () => new THREE.TorusGeometry(0.06, 0.008, 6, 14, Math.PI)), metal, { y: -0.06, parent: g });
    bx(0.16, 0.03, 0.16, metal, { y: -0.08, parent: g });
    bx(0.17, 0.03, 0.17, metal, { y: -0.32, parent: g });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(0.015, 0.22, 0.015, metal, { x: x * 0.07, y: -0.2, z: z * 0.07, parent: g });
    const glass = cachedMat("lantGlass", () => new THREE.MeshStandardMaterial({ color: "#fff1c8", emissive: "#ffb347", emissiveIntensity: 2.6, roughness: 0.3, transparent: true, opacity: 0.85 }));
    bx(0.12, 0.2, 0.12, glass, { y: -0.2, parent: g, shadow: false });
    addMesh(cachedGeo("flame", () => { const s = new THREE.SphereGeometry(0.02, 10, 8); s.scale(1, 1.9, 1); return s; }), glowMat("#ffd27a", 7), { y: -0.2, parent: g, shadow: false });
  },
  rope(g) {
    const m = fabric("#b08850", "denim");
    addMesh(cachedGeo("ropeCoil", () => new THREE.TorusGeometry(0.12, 0.026, 8, 24)), m, { parent: g });
    addMesh(cachedGeo("ropeCoil2", () => new THREE.TorusGeometry(0.1, 0.026, 8, 24)), m, { z: 0.03, parent: g });
    bx(0.04, 0.3, 0.04, m, { x: 0.1, y: -0.2, rz: 0.2, parent: g });
  },
  umbrella(g) {
    bx(0.02, 0.8, 0.02, solid("#2d3436"), { y: 0.35, parent: g });
    addMesh(cachedGeo("umbHook", () => new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI)), solid("#5a3d24"), { y: -0.05, rz: Math.PI, parent: g });
    const canopy = addMesh(cachedGeo("canopy", () => new THREE.ConeGeometry(0.55, 0.28, 8, 1, true)), cachedMat("umbMat", () => new THREE.MeshStandardMaterial({ color: "#e84393", roughness: 0.5, side: THREE.DoubleSide })), { y: 0.68, parent: g });
    canopy.castShadow = true;
  },
  paper(g) {
    bx(0.21, 0.28, 0.003, solid("#fbf6e6", { roughness: 0.9 }), { parent: g });
    for (let i = 0; i < 6; i++) bx(0.15, 0.008, 0.004, solid("#3c5aa8"), { x: -0.01, y: 0.09 - i * 0.035, parent: g, shadow: false });
  },
  fallback(g) { rbx(0.18, 0.18, 0.18, 0.02, fabric("#8e7cc3", "cotton"), { parent: g }); },
};
/** a small hand prop by keyword (sock, flashlight, candle, book, phone, bag, key, ball, box, sign, bread, cup, lantern,
 *  rope, umbrella, paper/letter/note; anything else -> a small box). Origin at the grip. */
export function makeHeld(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  const kind = HELD_ALIASES.find(([re]) => re.test(n))?.[1] ?? "fallback";
  let proto = PROTO.get(kind);
  if (!proto) { proto = new THREE.Group(); proto.name = `held:${kind}`; BUILD[kind](proto); PROTO.set(kind, proto); }
  const o = proto.clone(); // shares geometry and materials
  o.userData.kind = kind;
  o.userData.beam = o.getObjectByName("beam") ?? null;
  return o;
}
