// Blocky Worlds look frames, round 2: a bus stop on a sunny suburban street, townsfolk waiting, a yellow bus pulling in.
//   A  realistic world (CC0 Poly Haven textures/models, HDRI sky, mountains) + simple flat blocky people
//   B  the same world + detailed blocky people (bevels, fabric, collars, belts, soles, layered hair) + depth of field
//   C  a clean stylised world (flat materials, Kenney houses/trees) + simple blocky people
//   An A at night (the horror look)
// People: our own design. Normal game-avatar proportions (head ~1/6 of the height), chest + hips, sticker faces with
// whites of the eyes, pupils and brows (never the classic two-dots-and-a-smile face). No logos.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { N8AOPass } from "n8ao";

const Q = new URLSearchParams(location.search);
const KEY = Q.get("look") ?? "L"; // L = the locked look (owner, 2026-11-03)
const NIGHT = KEY.endsWith("n");
const STYLE = { L: { world: "real", people: "cloth", dof: false }, A: { world: "real", people: "simple", dof: false }, B: { world: "real", people: "detailed", dof: true }, C: { world: "clean", people: "simple", dof: false } }[KEY[0]];
const REAL = STYLE.world === "real";
const W = 1080, H = 1920;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = NIGHT ? 0.95 : STYLE.people === "cloth" ? 0.86 : REAL ? 0.82 : 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const gltf = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

// ---------- materials ----------
const TEX = new Map();
function tex(name, kind, srgb) {
  const k = `${name}/${kind}`;
  if (!TEX.has(k)) { const t = texLoader.load(`/assets/${name}/${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; TEX.set(k, t); }
  const t = TEX.get(k).clone(); t.needsUpdate = true; return t;
}
/** a real-world material from a Poly Haven texture set (the clean world: its flat average colour instead) */
function pbr(name, { repeat = [1, 1], tint = "#ffffff", rough = 1, flat = "#888888", normal = 1 } = {}) {
  if (!REAL) return new THREE.MeshStandardMaterial({ color: flat, roughness: 0.85 });
  const m = new THREE.MeshStandardMaterial({ color: tint, map: tex(name, "diff", true), normalMap: tex(name, "nor", false), roughnessMap: tex(name, "rough", false), roughness: rough });
  m.normalScale.set(normal, normal);
  for (const t of [m.map, m.normalMap, m.roughnessMap]) t.repeat.set(...repeat);
  return m;
}
const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const glass = () => new THREE.MeshPhysicalMaterial({ color: "#20303f", roughness: 0.06, metalness: 0.1, envMapIntensity: 1.6, clearcoat: 1 });
function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = scene, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = shadow; parent.add(m); return m;
}
const bx = (w, h, d, mat, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), mat, o);
const rbx = (w, h, d, r, mat, o = {}) => mesh(r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d), mat, o);
const plane = (w, d, mat, o = {}) => mesh(new THREE.PlaneGeometry(w, d), mat, { rx: -Math.PI / 2, ...o });

// ---------- models (CC0) ----------
async function model(url, { height = null, length = null, alongZ = true, first = false } = {}) {
  const g = (await gltf.loadAsync(url)).scene;
  if (first) { let root = g; while (root.children.length === 1 && root.children[0].children.length) root = root.children[0]; root.children.slice(1).forEach((c) => root.remove(c)); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material?.map) o.material.map.anisotropy = 8; } });
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(g);
  let s = 1;
  if (height) s = height / size.y;
  if (length) { s = length / Math.max(size.x, size.z); if (alongZ && size.x > size.z) g.rotation.y = Math.PI / 2; }
  g.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(g), c = b2.getCenter(new THREE.Vector3());
  g.position.set(-c.x, -b2.min.y, -c.z);
  return holder;
}
const place = (proto, x, y, z, ry = 0, s = 1) => { const m = proto.clone(); m.position.set(x, y, z); m.rotation.y = ry; m.scale.multiplyScalar(s); scene.add(m); return m; };

// ---------- the street ----------
const SIDE = 4.5, WALK = 3.0, CURB = 0.15;
plane(9, 320, pbr("asphalt_02", { repeat: [3, 106], flat: "#3b3d44", tint: "#b8b8bc" }), { y: 0, z: -120 });
const paint = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
for (const x of [-0.11, 0.11]) plane(0.1, 320, paint("#f2c230"), { x, y: 0.004, z: -120, shadow: false });
for (const x of [-4.2, 4.2]) plane(0.12, 320, paint("#f4f4f0"), { x, y: 0.004, z: -120, shadow: false });
plane(2.6, 3.2, paint(NIGHT ? "#d8c070" : "#f4f4f0"), { x: 2.2, y: 0.005, z: -2, shadow: false }); // "BUS" box marking
for (const sx of [-1, 1]) {
  bx(0.3, CURB + 0.05, 320, pbr("concrete_pavement", { repeat: [0.2, 100], flat: "#b9b4ac", tint: "#e6e2dc" }), { x: sx * (SIDE + 0.15), y: (CURB + 0.05) / 2 - 0.05, z: -120 });
  bx(WALK, CURB, 320, pbr("concrete_pavement", { repeat: [1.5, 160], flat: "#cfc9bf", tint: "#f2eee8" }), { x: sx * (SIDE + 0.3 + WALK / 2), y: CURB / 2, z: -120 });
  bx(60, 0.1, 320, pbr("leafy_grass", { repeat: [20, 100], flat: "#5cc44a", tint: "#9fe06a", normal: 0.6 }), { x: sx * (SIDE + 0.3 + WALK + 30), y: 0.05, z: -120 });
}
plane(900, 900, new THREE.MeshStandardMaterial({ color: REAL ? "#6f9a4e" : "#79c25a", roughness: 1 }), { y: -0.02, z: -300, shadow: false });

// ---------- houses ----------
const WALLS = [["painted_plaster_wall", "#fff3d6"], ["painted_plaster_wall", "#cfe8ff"], ["brick_wall_02", "#ffffff"], ["painted_plaster_wall", "#d8f2d0"], ["painted_plaster_wall", "#ffd9cc"], ["beige_wall_001", "#ffffff"]];
const FLAT = ["#f6e7c4", "#bcdcf7", "#d98a6a", "#c8eabf", "#f7c6b6", "#e9dcc4"];
const DOORS = ["#c0392b", "#1f6f8b", "#2c3e70", "#2e7d4f", "#8e44ad", "#e67e22"];
const ROOFS = [["roof_09", "#ffffff", "#b5563a"], ["grey_roof_01", "#ffffff", "#5b6170"]];
function house(x, z, side, i, { lit = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0.1, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(g);
  const w = 9 + (i % 3), d = 7, h = i % 2 ? 5.6 : 3.4;
  const [wn, wt] = WALLS[i % WALLS.length], wallMat = pbr(wn, { repeat: [w / 3, h / 3], tint: wt, flat: FLAT[i % FLAT.length] });
  bx(w, h, d, wallMat, { y: h / 2, parent: g });
  // gable roof: two slopes + gable ends
  const [rn, rt, rflat] = ROOFS[i % 2], rh = 2.4, half = d / 2 + 0.5, slope = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  const roofMat = pbr(rn, { repeat: [w / 2.5, slope / 2.5], tint: rt, flat: rflat });
  for (const s of [-1, 1]) bx(w + 0.8, 0.16, slope, roofMat, { y: h + rh / 2, z: s * half / 2, rx: s * ang, parent: g });
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh - 0.1)]);
  for (const s of [-1, 1]) { const gm = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), wallMat, { x: s * (w / 2) - (s > 0 ? 0.1 : 0), y: h, ry: Math.PI / 2, parent: g }); void gm; }
  // windows: frame, glass, muntins, shutters (lit at night)
  const frame = solid("#fbfbf6", { roughness: 0.5 }), shutter = solid(DOORS[(i + 2) % DOORS.length], { roughness: 0.55 });
  const winGlass = NIGHT && lit ? new THREE.MeshStandardMaterial({ color: "#ffd38a", emissive: "#ffb257", emissiveIntensity: 1.8 }) : glass();
  const rows = h > 4 ? [1.6, 4.1] : [1.7];
  for (const wy of rows) for (const wx of [-w / 2 + 1.8, w / 2 - 1.8, ...(w > 10 ? [0] : [])]) {
    if (wy < 3 && Math.abs(wx) < 0.5) continue;
    bx(1.35, 1.55, 0.12, frame, { x: wx, y: wy, z: d / 2 + 0.03, parent: g });
    bx(1.15, 1.35, 0.06, winGlass, { x: wx, y: wy, z: d / 2 + 0.08, parent: g, shadow: false });
    bx(0.05, 1.35, 0.1, frame, { x: wx, y: wy, z: d / 2 + 0.1, parent: g }); bx(1.15, 0.05, 0.1, frame, { x: wx, y: wy, z: d / 2 + 0.1, parent: g });
    for (const s of [-1, 1]) bx(0.4, 1.55, 0.06, shutter, { x: wx + s * 0.9, y: wy, z: d / 2 + 0.04, parent: g });
  }
  // door, porch, porch light
  bx(1.1, 2.2, 0.12, solid(DOORS[i % DOORS.length], { roughness: 0.4 }), { x: 0, y: 1.1, z: d / 2 + 0.04, parent: g });
  bx(1.5, 2.45, 0.08, frame, { x: 0, y: 1.2, z: d / 2 + 0.01, parent: g });
  bx(3.2, 0.25, 1.8, pbr("concrete_pavement", { repeat: [1, 0.6], tint: "#f0ece6", flat: "#d6d0c6" }), { y: 0.12, z: d / 2 + 0.9, parent: g });
  bx(3.4, 0.14, 2.0, roofMat, { y: 2.75, z: d / 2 + 0.95, parent: g });
  for (const s of [-1, 1]) bx(0.16, 2.6, 0.16, frame, { x: s * 1.5, y: 1.4, z: d / 2 + 1.7, parent: g });
  const pl = bx(0.18, 0.26, 0.12, new THREE.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffcf7a", emissiveIntensity: NIGHT ? 3 : 0.2 }), { x: 0.85, y: 2.0, z: d / 2 + 0.1, parent: g });
  if (NIGHT && lit) { const l = new THREE.PointLight("#ffbe6b", 14, 9, 2); l.position.set(0, 2.2, d / 2 + 1.3); g.add(l); void pl; }
  // garage and driveway, chimney, walkway, picket fence, mailbox
  if (i % 3 !== 1) {
    const gw = 3.6; bx(gw, 3.0, 6, wallMat, { x: w / 2 + gw / 2, y: 1.5, parent: g });
    bx(3.0, 2.4, 0.1, solid("#f3f1ea", { roughness: 0.5 }), { x: w / 2 + gw / 2, y: 1.2, z: 3.02, parent: g });
    for (let k = 0; k < 4; k++) bx(3.0, 0.03, 0.12, solid("#d9d6cd"), { x: w / 2 + gw / 2, y: 0.3 + k * 0.6, z: 3.06, parent: g });
    bx(gw + 0.4, 0.14, 6.4, roofMat, { x: w / 2 + gw / 2, y: 3.07, parent: g });
    bx(3.4, 0.06, 4.4, pbr("concrete_pavement", { repeat: [1, 1.5], tint: "#ebe7e0", flat: "#d9d3c9" }), { x: w / 2 + gw / 2, y: 0.0, z: 5.2, parent: g });
  }
  bx(0.8, 2.2, 0.8, pbr("brick_wall_02", { repeat: [0.3, 0.8], flat: "#a85a44" }), { x: -w / 2 + 1.4, y: h + 1.6, z: -0.8, parent: g });
  bx(1.3, 0.05, 1.9, pbr("concrete_pavement", { repeat: [0.4, 0.6], tint: "#ebe7e0", flat: "#d9d3c9" }), { y: 0.0, z: d / 2 + 2.75, parent: g });
  const picket = solid("#ffffff", { roughness: 0.6 });
  for (let px = -w / 2 - 1; px < w / 2 + 2; px += 0.32) if (Math.abs(px) > 0.8) bx(0.08, 0.9, 0.04, picket, { x: px, y: 0.45, z: d / 2 + 3.6, parent: g });
  for (const fy of [0.75, 0.3]) for (const s2 of [-1, 1]) bx(w / 2 + 0.2, 0.06, 0.05, picket, { x: s2 * (w / 4 + 0.85) + (s2 > 0 ? 0.5 : 0), y: fy, z: d / 2 + 3.6, parent: g });
  bx(0.1, 1.1, 0.1, solid("#5b4636"), { x: 1.2, y: 0.55, z: d / 2 + 3.9, parent: g });
  rbx(0.32, 0.3, 0.5, 0.08, solid(DOORS[(i + 4) % DOORS.length], { roughness: 0.35 }), { x: 1.2, y: 1.2, z: d / 2 + 3.9, parent: g });
  return g;
}

// ---------- the yellow bus (built in code) ----------
function bus() {
  const g = new THREE.Group(); scene.add(g);
  const L = 11, Wd = 2.55, Hh = 3.05;
  const paintMat = new THREE.MeshPhysicalMaterial({ color: "#ffb30f", roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35, metalness: 0, envMapIntensity: 0.55 });
  const black = solid("#1b1c20", { roughness: 0.5 }), chrome = new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 1, roughness: 0.2 });
  rbx(Wd, Hh - 0.45, L, 0.18, paintMat, { y: 0.45 + (Hh - 0.45) / 2, parent: g });
  rbx(Wd - 0.1, 0.12, L - 0.4, 0.05, solid("#f4f1e6", { roughness: 0.4 }), { y: Hh + 0.02, parent: g });
  const win = NIGHT ? new THREE.MeshStandardMaterial({ color: "#ffe3a8", emissive: "#ffd28a", emissiveIntensity: 0.9 }) : glass();
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) bx(0.06, 0.95, 1.2, win, { x: s * (Wd / 2 + 0.005), y: 2.15, z: -L / 2 + 1.0 + k * 1.38, parent: g, shadow: false });
    bx(0.05, 0.14, L - 0.6, black, { x: s * (Wd / 2 + 0.01), y: 1.45, parent: g });
    bx(0.05, 0.08, L - 0.6, black, { x: s * (Wd / 2 + 0.01), y: 1.15, parent: g });
  }
  bx(Wd - 0.3, 1.25, 0.06, win, { y: 2.05, z: L / 2 + 0.005, parent: g, shadow: false }); // windshield
  { // destination sign (original): route 7, Maple Ave
    const c = document.createElement("canvas"); c.width = 512; c.height = 96; const x = c.getContext("2d");
    x.fillStyle = "#101010"; x.fillRect(0, 0, 512, 96); x.fillStyle = "#ffb43a"; x.font = "bold 62px sans-serif"; x.textBaseline = "middle"; x.fillText("7  MAPLE AVE", 22, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    bx(Wd - 0.5, 0.32, 0.05, new THREE.MeshStandardMaterial({ map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.9 }), { y: 2.87, z: L / 2 + 0.01, parent: g, shadow: false });
  }
  bx(Wd + 0.05, 0.42, 0.2, black, { y: 0.55, z: L / 2 + 0.06, parent: g });
  bx(1.2, 0.5, 0.05, chrome, { y: 1.1, z: L / 2 + 0.01, parent: g });
  const lampMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6dd", emissiveIntensity: NIGHT ? 2.5 : 1.2 });
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), lampMat, { x: s * 0.85, y: 1.05, z: L / 2 + 0.02, rx: Math.PI / 2, parent: g });
    bx(0.22, 0.12, 0.05, new THREE.MeshStandardMaterial({ color: "#ffa21a", emissive: "#ff9a10", emissiveIntensity: 1 }), { x: s * 1.1, y: 1.32, z: L / 2 + 0.02, parent: g });
    bx(0.04, 0.6, 0.04, black, { x: s * (Wd / 2 + 0.3), y: 2.35, z: L / 2 - 0.1, parent: g });
    bx(0.1, 0.42, 0.24, black, { x: s * (Wd / 2 + 0.42), y: 2.05, z: L / 2 - 0.1, parent: g });
    for (const wz of [L / 2 - 2.0, -L / 2 + 2.2]) {
      mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 28), black, { x: s * (Wd / 2 - 0.12), y: 0.52, z: wz, rz: Math.PI / 2, parent: g });
      mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.36, 20), chrome, { x: s * (Wd / 2 - 0.12), y: 0.52, z: wz, rz: Math.PI / 2, parent: g });
    }
  }
  bx(0.06, 1.9, 0.95, win, { x: Wd / 2 + 0.01, y: 1.45, z: L / 2 - 1.05, parent: g, shadow: false }); // the door
  { // side lettering (original)
    const c = document.createElement("canvas"); c.width = 512; c.height = 80; const x = c.getContext("2d");
    x.fillStyle = "#1b1c20"; x.font = "bold 56px sans-serif"; x.textBaseline = "middle"; x.fillText("MAPLEWOOD TOWN BUS", 10, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4 });
    mesh(new THREE.PlaneGeometry(4.6, 0.72), m, { x: Wd / 2 + 0.02, y: 0.85, z: -0.5, ry: Math.PI / 2, parent: g, shadow: false });
  }
  if (NIGHT) for (const s of [-1, 1]) {
    const sp = new THREE.SpotLight("#fff1d0", 30, 30, 0.4, 0.6, 1.8); sp.position.set(s * 0.85, 1.05, L / 2 + 0.2); sp.target.position.set(s * 0.6, 0, L / 2 + 14); g.add(sp, sp.target);
  }
  return g;
}

// ---------- the bus shelter and the stop sign (original designs) ----------
function shelter(x, z) {
  const g = new THREE.Group(); g.position.set(x, CURB, z); scene.add(g);
  const alu = new THREE.MeshStandardMaterial({ color: "#c7ccd3", metalness: 0.8, roughness: 0.3 });
  const pane = new THREE.MeshPhysicalMaterial({ color: "#d9f0ff", roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.22, metalness: 0 });
  for (const pz of [-1.8, 1.8]) for (const px of [-0.7, 0.7]) bx(0.08, 2.6, 0.08, alu, { x: px, y: 1.3, z: pz, parent: g });
  bx(1.7, 0.12, 4.0, alu, { y: 2.65, parent: g });
  bx(0.04, 2.0, 3.5, pane, { x: 0.7, y: 1.35, parent: g, shadow: false });
  bx(1.3, 2.0, 0.04, pane, { y: 1.35, z: -1.8, parent: g, shadow: false });
  { // the ad panel: an original poster, lit from inside
    const c = document.createElement("canvas"); c.width = 360; c.height = 540; const p = c.getContext("2d");
    const gr = p.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, "#ff5e7e"); gr.addColorStop(1, "#ffb347"); p.fillStyle = gr; p.fillRect(0, 0, 360, 540);
    p.fillStyle = "#fff"; p.font = "bold 70px sans-serif"; p.textAlign = "center"; p.fillText("SUMMER", 180, 160); p.fillText("FAIR", 180, 240);
    p.font = "bold 34px sans-serif"; p.fillText("SAT • TOWN SQUARE", 180, 330); p.beginPath(); p.arc(180, 440, 60, 0, Math.PI * 2); p.fillStyle = "#ffe66d"; p.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    bx(1.25, 1.85, 0.06, new THREE.MeshStandardMaterial({ map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: NIGHT ? 0.9 : 0.25, roughness: 0.3 }), { y: 1.35, z: 1.8, parent: g });
  }
  return g;
}
function stopSign(x, z) {
  bx(0.08, 2.9, 0.08, new THREE.MeshStandardMaterial({ color: "#9aa1aa", metalness: 0.7, roughness: 0.35 }), { x, y: CURB + 1.45, z });
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const p = c.getContext("2d");
  p.fillStyle = "#1f6fd6"; p.beginPath(); p.arc(128, 128, 124, 0, Math.PI * 2); p.fill(); p.fillStyle = "#fff"; p.beginPath(); p.arc(128, 128, 100, 0, Math.PI * 2); p.fill();
  p.fillStyle = "#1f6fd6"; p.font = "bold 82px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("BUS", 128, 132);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 32), [solid("#1f6fd6"), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: (() => { const f = t.clone(); f.wrapS = THREE.RepeatWrapping; f.repeat.set(-1, -1); f.offset.set(1, 1); f.needsUpdate = true; return f; })(), roughness: 0.4 })], { x, y: CURB + 2.6, z, rz: Math.PI / 2, ry: -Math.PI / 2 + 0.3 });
}

// ---------- the townsfolk ----------
const DETAILED = STYLE.people === "detailed";
const CLOTH = DETAILED || STYLE.people === "cloth"; // B's clothing: patterns, belts, soles, collars
const LOCKED = STYLE.people === "cloth";
const fabricCache = new Map();
function fabric(color, kind = "cotton") { // B: a procedural fabric texture
  const k = `${color}/${kind}`;
  if (fabricCache.has(k)) return fabricCache.get(k);
  const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d");
  p.fillStyle = color; p.fillRect(0, 0, 128, 128);
  const base = new THREE.Color(color);
  for (let i = 0; i < 1600; i++) { const k2 = 0.88 + Math.random() * 0.24; p.fillStyle = `#${base.clone().multiplyScalar(k2).getHexString()}`; p.fillRect(Math.random() * 128, Math.random() * 128, kind === "denim" ? 3 : 2, kind === "denim" ? 1 : 2); }
  if (kind === "denim") { p.strokeStyle = "rgba(255,255,255,0.08)"; for (let y = 0; y < 128; y += 3) { p.beginPath(); p.moveTo(0, y); p.lineTo(128, y + 6); p.stroke(); } }
  if (kind === "stripes") { p.fillStyle = "rgba(255,255,255,0.85)"; for (let y = 0; y < 128; y += 22) p.fillRect(0, y, 128, 9); }
  if (kind === "plaid") { p.fillStyle = "rgba(20,20,40,0.28)"; for (let y = 0; y < 128; y += 32) p.fillRect(0, y, 128, 12); for (let x = 0; x < 128; x += 32) p.fillRect(x, 0, 12, 128); p.fillStyle = "rgba(255,230,120,0.5)"; for (let y = 6; y < 128; y += 32) p.fillRect(0, y, 128, 2); }
  if (kind === "dots") { p.fillStyle = "rgba(255,255,255,0.9)"; for (let y = 8; y < 128; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < 128; x += 24) { p.beginPath(); p.arc(x, y, 5, 0, Math.PI * 2); p.fill(); } }
  if (kind === "pinstripe") { p.fillStyle = "rgba(255,255,255,0.18)"; for (let x = 0; x < 128; x += 10) p.fillRect(x, 0, 1.5, 128); }
  if (kind === "band") { p.fillStyle = "#ffffff"; p.fillRect(0, 50, 128, 14); p.fillStyle = "#1e90ff"; p.fillRect(0, 64, 128, 10); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: kind === "leather" ? 0.4 : 0.85 });
  fabricCache.set(k, m); return m;
}
const cloth = (color, kind) => (CLOTH ? fabric(color, kind) : new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
const skinMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
const R = DETAILED ? 0.05 : LOCKED ? 0.012 : 0; // bevel (L keeps A's crisp blocks)

function faceTexture(expr, { glasses = false, beard = null } = {}) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const p = c.getContext("2d");
  const ink = "#2a1d24"; p.lineCap = p.lineJoin = "round";
  if (LOCKED) { p.translate(128, 136); p.scale(1.2, 1.2); p.translate(-128, -136); }
  const big = DETAILED ? 1.32 : LOCKED ? 1.12 : 1;
  const eye = (x, y, open = 1, look = [0, 0]) => {
    if (open < 0.2) { p.strokeStyle = ink; p.lineWidth = 7; p.beginPath(); p.arc(x, y + 4, 16 * big, Math.PI * 0.15, Math.PI * 0.85); p.stroke(); return; }
    p.fillStyle = "#fff"; p.strokeStyle = ink; p.lineWidth = 5;
    p.beginPath(); p.ellipse(x, y, 17 * big, 22 * big * open, 0, 0, Math.PI * 2); p.fill(); p.stroke();
    p.fillStyle = ink; p.beginPath(); p.ellipse(x + look[0], y + look[1] + 2, 9 * big, 11 * big * Math.min(1, open + 0.2), 0, 0, Math.PI * 2); p.fill();
    p.fillStyle = "#fff"; p.beginPath(); p.arc(x + look[0] + 4, y + look[1] - 3, 3.5, 0, Math.PI * 2); p.fill();
    if (open < 1) { p.fillStyle = "rgba(0,0,0,0)"; }
  };
  const brow = (x, y, tilt) => { p.strokeStyle = ink; p.lineWidth = 8; p.beginPath(); p.moveTo(x - 16, y + tilt); p.lineTo(x + 16, y - tilt); p.stroke(); };
  const L = { x: 88, y: 116 }, Rr = { x: 168, y: 116 };
  const look = expr === "phone" ? [0, 8] : expr === "lookleft" ? [-8, 0] : [0, 0];
  const open = expr === "bored" || expr === "phone" ? 0.6 : expr === "sleepy" ? 0 : 1;
  eye(L.x, L.y, open, look); eye(Rr.x, Rr.y, open, look);
  if (expr === "excited" || expr === "happy") { brow(L.x, 78, -3); brow(Rr.x, 78, 3); } else if (expr === "bored") { brow(L.x, 86, 0); brow(Rr.x, 86, 0); } else { brow(L.x, 82, 2); brow(Rr.x, 82, -2); }
  if (DETAILED || expr === "excited" || expr === "happy") { p.fillStyle = "rgba(255,110,120,0.35)"; p.beginPath(); p.ellipse(66, 160, 18, 10, 0, 0, Math.PI * 2); p.ellipse(190, 160, 18, 10, 0, 0, Math.PI * 2); p.fill(); }
  p.strokeStyle = ink; p.fillStyle = ink; p.lineWidth = 7;
  if (expr === "excited") { p.beginPath(); p.moveTo(98, 168); p.quadraticCurveTo(128, 214, 158, 168); p.closePath(); p.fill(); p.fillStyle = "#ff8fa0"; p.beginPath(); p.ellipse(128, 188, 14, 8, 0, 0, Math.PI * 2); p.fill(); }
  else if (expr === "happy") { p.beginPath(); p.moveTo(104, 172); p.quadraticCurveTo(128, 194, 152, 172); p.stroke(); }
  else if (expr === "sleepy") { p.beginPath(); p.ellipse(128, 182, 9, 7, 0, 0, Math.PI * 2); p.fill(); }
  else { p.beginPath(); p.moveTo(110, 180); p.lineTo(146, 178); p.stroke(); }
  if (glasses) { p.strokeStyle = "#3b2f2f"; p.lineWidth = 6; p.strokeRect(L.x - 26, L.y - 24, 52, 46); p.strokeRect(Rr.x - 26, Rr.y - 24, 52, 46); p.beginPath(); p.moveTo(L.x + 26, L.y - 4); p.lineTo(Rr.x - 26, Rr.y - 4); p.stroke(); }
  if (beard) { p.fillStyle = beard; p.fillRect(56, 196, 144, 60); p.fillRect(46, 150, 22, 80); p.fillRect(188, 150, 22, 80); p.fillStyle = ink; p.beginPath(); p.moveTo(110, 206); p.lineTo(146, 206); p.lineWidth = 6; p.strokeStyle = "#3a2a22"; p.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/**
 * One townsperson. Proportions in metres (adult ~1.8 m): legs 0.82, hips 0.2, chest 0.5, neck 0.08, head 0.32.
 * o: { skin, top, sleeve ("short"|"long"), bottom ("pants"|"shorts"|"skirt"|"dress"), pants, shoes, hair, hairColor, hat,
 *      hatColor, expr, glasses, beard, acc (["backpack","phone","bag","briefcase","tie","headphones"]), pose, scale }
 */
function person(o) {
  const g = new THREE.Group(); g.scale.setScalar(o.scale ?? 0.94); scene.add(g);
  const skin = skinMat(o.skin), top = cloth(o.top, CLOTH ? o.pattern ?? o.topKind : o.topKind), pants = cloth(o.pants ?? "#3b5b8f", o.pantsKind ?? (o.bottom === "pants" ? "denim" : "cotton")), shoe = cloth(o.shoes ?? "#f2f2f2", "leather");
  const pose = o.pose ?? "idle", sitting = pose === "sit", running = pose === "run";
  const sole = solid("#f7f7f2", { roughness: 0.7 });
  // legs: hip -> thigh (0.42) -> knee -> shin (0.38) -> shoe
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.11, 0.9, 0); g.add(hip);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    if (sitting) { hip.rotation.x = -1.5; knee.rotation.x = 1.5; }
    if (running) { hip.rotation.x = s > 0 ? -0.75 : 0.45; knee.rotation.x = s > 0 ? 0.5 : 1.1; }
    const bare = o.bottom === "skirt" || o.bottom === "dress";
    rbx(0.19, 0.42, 0.22, R * 0.7, bare ? skin : pants, { y: -0.21, parent: hip });
    rbx(0.18, 0.38, 0.21, R * 0.7, bare || o.bottom === "shorts" ? skin : pants, { y: -0.19, parent: knee });
    if (o.bottom === "shorts") rbx(0.21, 0.08, 0.24, 0, pants, { y: -0.36, parent: hip });
    rbx(0.21, 0.11, 0.32, R, shoe, { y: -0.43, z: 0.05, parent: knee });
    if (CLOTH) bx(0.215, 0.035, 0.325, sole, { y: -0.47, z: 0.05, parent: knee });
  }
  if (o.bottom === "skirt" || o.bottom === "dress") rbx(0.5, 0.36, 0.3, R, cloth(o.bottom === "dress" ? o.top : o.pants, CLOTH ? o.pattern ?? o.topKind : o.topKind), { y: 0.84, parent: g });
  rbx(0.42, 0.2, 0.24, R, o.bottom === "dress" ? top : pants, { y: 0.99, parent: g });
  if (CLOTH && o.bottom !== "dress") { bx(0.43, 0.05, 0.25, solid("#2b2018", { roughness: 0.45 }), { y: 1.07, parent: g }); bx(0.07, 0.05, 0.02, solid("#d8b45a", { metalness: 0.8, roughness: 0.3 }), { y: 1.07, z: 0.126, parent: g }); }
  rbx(0.48, 0.5, 0.26, R, top, { y: 1.34, parent: g });
  if (CLOTH) { bx(0.2, 0.06, 0.03, cloth(o.top, o.topKind), { y: 1.57, z: 0.13, parent: g }); bx(0.12, 0.1, 0.02, solid(new THREE.Color(o.top).multiplyScalar(0.85).getHex()), { x: 0.12, y: 1.4, z: 0.135, parent: g }); }
  if (o.acc?.includes("tie")) { bx(0.07, 0.34, 0.02, solid("#c0392b", { roughness: 0.4 }), { y: 1.4, z: 0.135, parent: g }); bx(0.16, 0.5, 0.02, solid("#f5f5f5"), { y: 1.34, z: 0.131, parent: g }); }
  // arms: shoulder -> upper arm (0.3) -> elbow -> forearm (0.27) -> hand
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.315, 1.56, 0); g.add(sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    let shr = [0, 0, s * 0.06], elr = [-0.15, 0, 0];
    if (pose === "wave" && s > 0) { shr = [0, 0, 2.35]; elr = [0, 0, 0.55]; }
    if (pose === "phone" && s > 0) { shr = [-0.35, 0, -0.08]; elr = [-1.45, 0, 0]; }
    if (pose === "watch" && s < 0) { shr = [-0.25, 0, 0.18]; elr = [-1.5, 0, 0]; }
    if (sitting) { shr = [-0.3, 0, s * 0.05]; elr = [-0.95, 0, 0]; }
    if (running) { shr = [s > 0 ? 0.6 : -0.7, 0, s * 0.08]; elr = [-1.2, 0, 0]; }
    sh.rotation.set(...shr); el.rotation.set(...elr);
    const shortSleeve = o.sleeve === "short";
    rbx(0.15, 0.3, 0.17, R * 0.6, top, { y: -0.15, parent: sh });
    rbx(0.14, 0.27, 0.16, R * 0.5, shortSleeve ? skin : top, { y: -0.135, parent: el });
    if (CLOTH && !shortSleeve) bx(0.15, 0.04, 0.17, solid(new THREE.Color(o.top).multiplyScalar(0.75).getHex()), { y: -0.25, parent: el });
    const hand = new THREE.Group(); hand.position.y = -0.33; el.add(hand);
    rbx(0.13, 0.13, 0.14, R, skin, { parent: hand });
    if (s > 0 && o.acc?.includes("phone")) bx(0.08, 0.15, 0.02, solid("#151517", { roughness: 0.25, metalness: 0.4 }), { y: -0.05, z: 0.08, rx: 0.4, parent: hand });
    if (s < 0 && o.acc?.includes("bag")) rbx(0.34, 0.28, 0.12, 0.03, cloth(o.bagColor ?? "#e84a5f", "leather"), { y: -0.2, parent: hand });
    if (s > 0 && o.acc?.includes("briefcase")) rbx(0.42, 0.3, 0.1, 0.02, cloth("#5a3b24", "leather"), { y: -0.2, parent: hand });
    if (pose === "watch" && s < 0) bx(0.15, 0.05, 0.17, solid("#c9a94a", { metalness: 0.8, roughness: 0.3 }), { y: -0.22, parent: el });
  }
  if (o.acc?.includes("backpack")) rbx(0.4, 0.46, 0.18, 0.04, cloth(o.packColor ?? "#2e86de", "cotton"), { y: 1.32, z: -0.22, parent: g });
  // neck and head (head turns)
  bx(0.13, 0.09, 0.13, skin, { y: 1.63, parent: g });
  const head = new THREE.Group(); head.position.y = 1.67; head.rotation.y = o.headTurn ?? 0; head.rotation.x = o.headTilt ?? 0; g.add(head);
  rbx(0.3, 0.32, 0.3, DETAILED ? 0.035 : 0.006, skin, { y: 0.16, parent: head });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshStandardMaterial({ map: faceTexture(o.expr ?? "happy", o), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.set(0, 0.15, 0.151); head.add(face);
  const hm = cloth(o.hairColor ?? "#3a2a1e", "cotton");
  const hair = o.hair ?? "short";
  if (hair !== "bald") {
    rbx(0.32, 0.09, 0.32, R * 0.5, hm, { y: 0.335, parent: head });
    rbx(0.32, 0.22, 0.07, R * 0.5, hm, { y: 0.24, z: -0.13, parent: head });
    if (CLOTH) { for (const s of [-1, 1]) rbx(0.05, 0.14, 0.26, 0.01, hm, { x: s * 0.155, y: 0.26, z: -0.01, parent: head }); rbx(0.3, 0.06, 0.06, 0.01, hm, { y: 0.3, z: 0.14, parent: head }); }
  }
  if (hair === "long") rbx(0.34, 0.42, 0.08, R * 0.5, hm, { y: 0.06, z: -0.14, parent: head });
  if (hair === "ponytail") { rbx(0.12, 0.3, 0.1, R, hm, { y: 0.12, z: -0.2, parent: head }); bx(0.13, 0.05, 0.11, solid(o.tieColor ?? "#ff5c8a"), { y: 0.26, z: -0.2, parent: head }); }
  if (hair === "bun") rbx(0.16, 0.14, 0.16, 0.04, hm, { y: 0.44, z: -0.04, parent: head });
  if (hair === "afro") rbx(0.44, 0.34, 0.42, DETAILED ? 0.1 : 0.02, hm, { y: 0.33, z: -0.03, parent: head });
  if (hair === "spiky") for (const [sx, sz] of [[-0.08, 0.05], [0.06, -0.03], [0, 0.1], [0.1, 0.08]]) bx(0.08, 0.12, 0.08, hm, { x: sx, y: 0.41, z: sz, rz: sx * 3, parent: head });
  const hatMat = cloth(o.hatColor ?? "#e74c3c", "cotton");
  if (o.hat === "cap") { rbx(0.33, 0.12, 0.33, R, hatMat, { y: 0.37, parent: head }); bx(0.3, 0.025, 0.16, hatMat, { y: 0.32, z: o.capBack ? -0.22 : 0.22, parent: head }); }
  if (o.hat === "beanie") { rbx(0.34, 0.16, 0.34, R + 0.02, hatMat, { y: 0.38, parent: head }); bx(0.35, 0.05, 0.35, solid(new THREE.Color(o.hatColor).multiplyScalar(0.8).getHex()), { y: 0.31, parent: head }); }
  if (o.hat === "bucket") { rbx(0.3, 0.14, 0.3, R, hatMat, { y: 0.39, parent: head }); bx(0.46, 0.025, 0.46, hatMat, { y: 0.32, parent: head }); }
  if (o.acc?.includes("headphones")) { bx(0.36, 0.035, 0.07, solid("#202024", { roughness: 0.3 }), { y: 0.39, parent: head }); for (const s of [-1, 1]) rbx(0.06, 0.12, 0.11, 0.02, solid(o.phonesColor ?? "#ff4757", { roughness: 0.3 }), { x: s * 0.175, y: 0.17, parent: head }); }
  return g;
}

// ---------- sky, light, fog ----------
async function lighting() {
  if (!NIGHT) {
    const sky = await new RGBELoader().loadAsync((Q.get("sky") === "cloudy" ? "/ph/hdri/kloofendal_38d_partly_cloudy_puresky.hdr" : "/ph/hdri/kloofendal_43d_clear_puresky.hdr"));
    sky.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = sky;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { zen: { value: new THREE.Color(LOCKED ? "#0b52d0" : REAL ? "#1f6fd8" : "#2a86f0") }, hor: { value: new THREE.Color(LOCKED ? "#4ea6f2" : REAL ? "#9fd2ff" : "#b5e2ff") }, k: { value: REAL ? 1.0 : 1.1 } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 zen, hor; uniform float k; varying vec3 vP;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.8));
          vec2 uv = d.xz / (h + 0.12) * 1.6;
          float c = fbm(uv + vec2(3.1, 7.7)); float m = smoothstep(0.52, 0.72, c) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.55, 0.9, h));
          float shade = fbm(uv * 1.7 + vec2(9.0, 2.0));
          vec3 cloud = mix(vec3(0.78, 0.82, 0.9), vec3(1.05), smoothstep(0.35, 0.7, shade));
          gl_FragColor = vec4(mix(col, cloud, m) * k, 1.0);
        }`,
    }));
    dome.renderOrder = -1; scene.add(dome);
    scene.backgroundIntensity = 0.62; scene.environmentIntensity = REAL ? 0.55 : 0.7;
    scene.backgroundRotation = new THREE.Euler(0, 2.2, 0); scene.environmentRotation = new THREE.Euler(0, 2.2, 0);
    scene.fog = LOCKED ? new THREE.Fog("#6aa6e0", 220, 3200) : new THREE.Fog("#8fb8e2", 120, 1500);
    const sun = new THREE.DirectionalLight("#ffe2b0", 4.3); sun.position.set(30, 40, 34); sun.target.position.set(4, 0, -8);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight("#cfe6ff", "#8a7a52", 0.45));
  } else {
    const env = await new RGBELoader().loadAsync("/ph/hdri/moonlit_golf.hdr"); env.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = env; scene.environmentIntensity = 0.35;
    const c = document.createElement("canvas"); c.width = 2; c.height = 512; const p = c.getContext("2d");
    const gr = p.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#040817"); gr.addColorStop(0.6, "#0e1d45"); gr.addColorStop(1, "#253a6e"); p.fillStyle = gr; p.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
    scene.fog = new THREE.Fog("#16244c", 30, 260);
    const n = 1200, pos = new Float32Array(n * 3); let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = 0.12 + rnd() * 1.3; pos.set([Math.cos(th) * Math.cos(ph) * 400, Math.sin(ph) * 400, Math.sin(th) * Math.cos(ph) * 400 - 100], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false })));
    const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: "#e8ecff", fog: false })); moonDisc.position.set(-120, 210, -360); moonDisc.lookAt(0, 0, 0); scene.add(moonDisc);
    const moon = new THREE.DirectionalLight("#9fb6ff", 0.7); moon.position.set(-30, 50, -20); moon.target.position.set(4, 0, -6);
    moon.castShadow = true; moon.shadow.mapSize.set(4096, 4096); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 }); scene.add(moon, moon.target);
    scene.add(new THREE.HemisphereLight("#33457a", "#0b0a14", 0.35));
  }
}

// ---------- mountains, tree line ----------
function mountains() {
  const mat = REAL ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const peaks = [[-260, -820, 170, 150], [-60, -900, 220, 190], [160, -860, 190, 165], [360, -800, 160, 125], [-420, -760, 150, 115], [60, -760, 130, 95]];
  for (const [x, z, r, h] of peaks) {
    const geo = new THREE.ConeGeometry(r, h, 9, 6); geo.translate(0, h / 2, 0);
    const pos = geo.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), jit = Math.sin(i * 12.9898) * 0.5 + 0.5;
      if (y > 0.5 && y < h - 1) { pos.setX(i, pos.getX(i) * (0.85 + jit * 0.3)); pos.setZ(i, pos.getZ(i) * (0.85 + jit * 0.3)); }
      const t = y / h, c = t > 0.8 ? new THREE.Color("#ffffff") : t > 0.5 ? new THREE.Color("#6d7f96") : new THREE.Color(NIGHT ? "#203024" : "#4c7a52");
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    mesh(geo, mat, { x, y: -2, z, shadow: false });
  }
  // a rolling tree line between the town and the mountains
  const treeGeo = new THREE.ConeGeometry(2.6, 9, 7); treeGeo.translate(0, 4.5, 0);
  const inst = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: NIGHT ? "#16261c" : "#3f7a3a", roughness: 1, flatShading: true }), 260);
  const m4 = new THREE.Matrix4(); let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { const x = -160 + rnd() * 320, z = -150 - rnd() * 60, k = 0.8 + rnd() * 0.8; m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(k, k * (0.8 + rnd() * 0.5), k)); inst.setMatrixAt(i, m4); }
  scene.add(inst);
}

// ---------- build ----------
await lighting();
mountains();
const [lampP, hydrantP, binP, benchP, shrubA, shrubB, treeP, planterP] = await Promise.all([
  model("/ph/street_lamp_01/street_lamp_01.gltf", { height: 6.2 }),
  model("/ph/fire_hydrant/fire_hydrant.gltf", { height: 0.85, first: true }),
  model("/ph/metal_trash_can/metal_trash_can.gltf", { height: 1.0 }),
  model("/ph/modular_street_seating/modular_street_seating.gltf", { length: 2.2 }),
  model("/ph/shrub_02/shrub_02.gltf", { height: 1.2 }),
  model("/ph/shrub_04/shrub_04.gltf", { height: 1.0 }),
  REAL ? model("/ph/jacaranda_tree/jacaranda_tree.gltf", { height: 8.5 }) : model("/assets/kenney/suburban/tree-large.glb", { height: 7.5 }),
  model("/ph/planter_box_01/planter_box_01.gltf", { length: 1.4 }),
]);
const kenney = (kit, name, opts) => model(`/assets/kenney/${kit}/${name}.glb`, opts);
const [sedan, suv, van, taxi, kTreeS] = await Promise.all([kenney("car", "sedan", { length: 4.6 }), kenney("car", "suv", { length: 4.8 }), kenney("car", "van", { length: 5.2 }), kenney("car", "taxi", { length: 4.6 }), kenney("suburban", "tree-small", { height: 5 })]);

// houses: code-built with real materials (A, B); Kenney's suburban houses (C)
const HZ = [10, -8, -26, -44, -62, -80];
if (REAL) {
  HZ.forEach((z, k) => { house(15.5, z, 1, k, { lit: k % 2 === 0 }); house(-15.5, z + 6, -1, k + 3, { lit: k % 3 === 0 }); });
} else {
  const names = ["building-type-a", "building-type-c", "building-type-e", "building-type-h", "building-type-k", "building-type-n"];
  const protos = await Promise.all(names.map((n) => kenney("suburban", n, { length: 11, alongZ: false })));
  HZ.forEach((z, k) => { place(protos[k % protos.length], 14, 0.1, z, -Math.PI / 2); place(protos[(k + 3) % protos.length], -14, 0.1, z + 6, Math.PI / 2); });
}
// trees, shrubs, lamps, props
for (const [x, z, k] of [[9.3, -7, 0.95], [9.6, -24, 0.9], [-9.6, -2, 1.05], [-9.8, -30, 0.95], [9.4, -36, 1.1], [-9.4, -52, 1]]) place(treeP, x, 0.1, z, z * 0.7, k);
if (!REAL) for (const [x, z] of [[9.4, -8], [-9.6, -14], [9.8, -26]]) place(kTreeS, x, 0.1, z, z);
for (const [x, z] of [[8.6, -5], [8.8, -6.4], [-8.7, 1], [8.7, -22], [-8.6, -20], [8.8, -40]]) place(z % 2 ? shrubA : shrubB, x, 0.1, z, z);
for (const z of [-14, -36, -58]) { place(lampP, 4.95, CURB, z, -Math.PI / 2); place(lampP, -4.95, CURB, z - 10, Math.PI / 2); }
place(hydrantP, 7.35, CURB, 5.4, 0.4);
place(binP, 7.25, CURB, 2.4, 0.3);
place(planterP, 7.3, CURB, -4.6, 0);
shelter(7.15, -0.4);
place(benchP, 7.0, CURB, -0.4, -Math.PI / 2);
stopSign(4.95, 2.6);
// vehicles
const theBus = bus(); theBus.position.set(2.15, 0, -10.5); theBus.rotation.y = -0.07;
place(sedan, -3.2, 0, -4, 0); place(suv, -3.2, 0, -20, 0); place(van, 3.25, 0, -34, Math.PI); place(taxi, -1.8, 0, -46, Math.PI);
if (NIGHT) { // streetlamps on, a pool of light at the stop
  for (const z of [-14, -36]) { const l = new THREE.SpotLight("#ffc77a", 140, 24, 0.9, 0.6, 1.6); l.position.set(3.6, 6.0, z); l.target.position.set(4.5, 0, z); l.castShadow = z === -14; scene.add(l, l.target); }
  const sl = new THREE.PointLight("#bfe2ff", 10, 6, 2); sl.position.set(6.6, 2.4, -0.4); scene.add(sl);
}

// the townsfolk at the stop
const SKIN = ["#f3cba9", "#c98e6b", "#8a5a3c", "#e7b38e", "#5e3b28", "#f6d6bd"];
const FOLK = [
  { at: [5.35, 3.4], ry: -0.55, skin: SKIN[0], top: "#18b8a5", pattern: "stripes", sleeve: "long", bottom: "pants", pants: "#2f4f86", shoes: "#ffffff", hair: "ponytail", hairColor: "#6b3e1f", tieColor: "#ff5c8a", expr: "phone", acc: ["phone"], pose: "phone", headTilt: 0.25 },
  { at: [6.35, 2.2], ry: -0.95, skin: SKIN[2], top: "#ff7a1a", pattern: "band", topKind: "cotton", sleeve: "long", bottom: "shorts", pants: "#2d3436", shoes: "#ff3b5c", hair: "short", hairColor: "#1b1410", hat: "cap", hatColor: "#2d98da", capBack: true, expr: "happy", acc: ["headphones"], phonesColor: "#ffd32a" },
  { at: [5.25, 0.4], ry: -1.9, skin: SKIN[3], top: "#ffd32a", pattern: "dots", sleeve: "long", bottom: "pants", pants: "#d63031", shoes: "#3742fa", hair: "short", hairColor: "#b5651d", hat: "beanie", hatColor: "#6c5ce7", expr: "excited", acc: ["backpack"], packColor: "#00b894", pose: "wave", headTurn: 0.2, scale: 0.7 },
  { at: [6.95, -0.7], ry: -Math.PI / 2 - 0.25, sit: true, skin: SKIN[5], top: "#c0392b", pattern: "plaid", topKind: "cotton", sleeve: "long", bottom: "pants", pants: "#57606f", shoes: "#3d2b1f", hair: "bald", hat: "bucket", hatColor: "#c8a96a", expr: "sleepy", glasses: true, beard: "#e8e8e8", pose: "sit" },
  { at: [5.6, -2.0], ry: -2.25, skin: SKIN[4], top: "#ff6fb5", pattern: "dots", sleeve: "short", bottom: "dress", pants: "#ff6fb5", shoes: "#ffffff", hair: "afro", hairColor: "#20140e", expr: "happy", acc: ["bag"], bagColor: "#ffd32a", headTurn: 0.6 },
  { at: [6.4, -3.6], ry: -1.35, skin: SKIN[1], top: "#273c75", pattern: "pinstripe", sleeve: "long", bottom: "pants", pants: "#273c75", pantsKind: "cotton", shoes: "#1e1e1e", hair: "short", hairColor: "#2b1d14", expr: "bored", acc: ["tie", "briefcase"], pose: "watch" },
];
if (LOCKED) FOLK.push({ at: [8.3, -7.5], ry: Math.PI, skin: SKIN[1], top: "#ff3b6b", pattern: "stripes", sleeve: "short", bottom: "shorts", pants: "#1e272e", shoes: "#00d2d3", hair: "bun", hairColor: "#2b1a12", expr: "happy", pose: "run" });
for (const f of FOLK) {
  const p = person(f);
  p.position.set(f.at[0], CURB + (f.sit ? 0.0 : 0), f.at[1]); p.rotation.y = f.ry;
  if (f.sit) p.position.y = CURB - 0.42;
}

// ---------- camera: eye level on the sidewalk, a phone at street level ----------
const camera = new THREE.PerspectiveCamera(Number(Q.get("fov") ?? 60), W / H, 0.1, 1500);
const cp = (Q.get("cam") ?? "5.25,1.55,7.6,5.9,2.0,-8").split(",").map(Number);
camera.position.set(cp[0], cp[1], cp[2]); camera.lookAt(cp[3], cp[4], cp[5]);

// ---------- post: AO, bloom, depth of field (B), the punchy grade ----------
const composer = new EffectComposer(renderer); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const ao = new N8AOPass(scene, camera, W, H); ao.configuration.aoRadius = 1.2; ao.configuration.intensity = NIGHT ? 1.2 : 2.0; ao.configuration.distanceFalloff = 1; ao.configuration.halfRes = false; composer.addPass(ao);
if (STYLE.dof) composer.addPass(new BokehPass(scene, camera, { focus: 9.0, aperture: 0.0012, maxblur: 0.009 }));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), NIGHT ? 0.5 : 0.22, 0.45, NIGHT ? 0.85 : 1.6));
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: NIGHT ? 1.15 : LOCKED ? 1.58 : REAL ? 1.42 : 1.32 }, con: { value: NIGHT ? 1.08 : LOCKED ? 1.24 : 1.16 }, warm: { value: NIGHT ? -0.02 : 0.035 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat, con, warm; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, sat); col = (col - 0.5) * con + 0.5; col *= vec3(1.0 + warm, 1.0 + warm * 0.3, 1.0 - warm); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }",
});
composer.addPass(grade);

// ---------- our caption ----------
function caption(p, word) {
  const size = 124, y = Math.round(H * 0.7);
  p.font = `${size}px Lilita, sans-serif`; p.textAlign = "center"; p.textBaseline = "middle"; p.lineJoin = "round";
  p.shadowColor = "rgba(0,0,0,0.5)"; p.shadowBlur = 18; p.shadowOffsetY = 8;
  p.lineWidth = 22; p.strokeStyle = "#0b0a12"; p.strokeText(word, W / 2, y);
  p.shadowColor = "transparent"; p.fillStyle = "#ffffff"; p.fillText(word, W / 2, y);
}
window.snapshot = () => {
  composer.render();
  const out = document.createElement("canvas"); out.width = W; out.height = H; const p = out.getContext("2d");
  p.drawImage(renderer.domElement, 0, 0);
  if (!Q.has("nocap")) caption(p, Q.get("word") ?? "everyone");
  return out.toDataURL("image/jpeg", 0.92);
};
window.timeFrames = (n) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return (performance.now() - t0) / n;
};
await document.fonts.load('124px "Lilita"');
await new Promise((r) => setTimeout(r, 1500)); // textures finish decoding
for (let i = 0; i < 3; i++) composer.render();
window.ready = true;
