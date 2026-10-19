// M1 look frames: the same landfill moment (liner, layered trash, drain pipe + tank, gas flare, truck dumping,
// a worker) at the home angle, in three lighting/material styles. ?look=A|B|C
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const LOOKS = {
  // A: Minecraft-like pixel blocks, polished: bright midday sun, crisp soft shadows, medium AO
  A: {
    name: "Sunny toy blocks", tex: "pixel", spread: 0.14, bevel: 0.05, groundBevel: 0.05, jitter: 0.05,
    sky: ["#5bb8ff", "#d4efff"], fog: [140, 320], sun: { color: "#fff3df", intensity: 3.0, pos: [16, 30, 18] },
    hemi: { sky: "#dbefff", ground: "#a68a62", intensity: 0.9 }, env: 0.35, tone: THREE.ACESFilmicToneMapping, exposure: 1.0,
    shadow: "pcf", ao: { radius: 0.9, intensity: 1.0 }, bloom: 0.25, dof: null,
    pal: { grass: [104, 196, 72], dirt: [156, 108, 66], deep: [126, 88, 56], clay: [150, 150, 158], stone: [128, 130, 138], liner: [56, 64, 76], pipe: [236, 240, 242], tank: [92, 170, 178], truck: [242, 132, 36], bed: [222, 110, 28], cover: [118, 82, 52], aquifer: [92, 140, 190], gravel: [170, 162, 150] },
  },
  // B: smooth clay/plastic toy: no textures, chunkier bevels, very soft shadows, strong AO, pastel-bright
  B: {
    name: "Clay toy diorama", tex: "none", spread: 0, bevel: 0.13, groundBevel: 0.06, jitter: 0.07,
    sky: ["#7ccaf5", "#e8f7ff"], fog: [150, 340], sun: { color: "#ffffff", intensity: 2.4, pos: [10, 32, 22] },
    hemi: { sky: "#eaf6ff", ground: "#b89a74", intensity: 1.25 }, env: 0.5, tone: THREE.NeutralToneMapping, exposure: 0.95,
    shadow: "vsm", ao: { radius: 1.3, intensity: 1.35 }, bloom: 0.2, dof: null,
    pal: { grass: [124, 188, 98], dirt: [196, 136, 86], deep: [170, 112, 72], clay: [176, 172, 182], stone: [150, 152, 162], liner: [70, 80, 96], pipe: [246, 246, 246], tank: [102, 192, 200], truck: [255, 150, 54], bed: [240, 126, 40], cover: [150, 104, 66], aquifer: [118, 168, 214], gravel: [196, 188, 176] },
  },
  // C: warm golden-hour diorama: soft painted textures, low warm sun with long shadows, cool fill, bloom, tilt-shift
  C: {
    name: "Golden-hour diorama", tex: "soft", spread: 0.16, bevel: 0.08, groundBevel: 0.07, jitter: 0.05,
    sky: ["#5d9fe0", "#ffd9a6"], fog: [120, 300], sun: { color: "#ffc98a", intensity: 3.9, pos: [30, 10, 4] },
    hemi: { sky: "#b9d8ff", ground: "#8a6a4c", intensity: 0.8 }, env: 0.3, tone: THREE.ACESFilmicToneMapping, exposure: 1.1,
    shadow: "vsm", shadowRadius: 5, ao: { radius: 1.0, intensity: 1.1 }, bloom: 0.55, dof: { focus: 34, aperture: 0.00012, maxblur: 0.006 },
    pal: { grass: [112, 186, 70], dirt: [164, 110, 64], deep: [132, 86, 52], clay: [156, 152, 160], stone: [130, 130, 136], liner: [52, 60, 72], pipe: [240, 238, 232], tank: [88, 160, 170], truck: [244, 128, 40], bed: [222, 106, 30], cover: [124, 84, 52], aquifer: [90, 136, 180], gravel: [176, 166, 150] },
  },
};
const Q = new URLSearchParams(location.search);
const L = { ...LOOKS[Q.get("look") ?? "A"] };
if (Q.has("nobloom")) L.bloom = 0;
if (Q.has("noao")) L.ao = null;

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = L.shadow === "vsm" ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = L.tone; renderer.toneMappingExposure = L.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
{ // sky gradient
  const c = document.createElement("canvas"); c.width = 2; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, L.sky[0]); gr.addColorStop(0.1, L.sky[1]); gr.addColorStop(1, L.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  scene.fog = new THREE.Fog(new THREE.Color(L.sky[1]), L.fog[0], L.fog[1]);
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = L.env;
scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
const sun = new THREE.DirectionalLight(L.sun.color, L.sun.intensity);
sun.position.set(...L.sun.pos); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = L.shadow === "vsm" ? -0.0004 : -0.0006; sun.shadow.normalBias = 0.02;
if (L.shadow === "vsm") { sun.shadow.radius = L.shadowRadius ?? 10; sun.shadow.blurSamples = 20; }
scene.add(sun);

// ---------- materials ----------
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function texFor(base, opts = {}) {
  if (L.tex === "none") return null;
  const px = L.tex === "pixel" ? 16 : 64;
  const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d");
  // soft: smooth value noise (4x4 cells, bilinear); pixel: per-pixel noise
  const cells = []; for (let i = 0; i < 25; i++) cells.push(rnd() - 0.5);
  const cell = (x, y) => cells[(y % 5) * 5 + (x % 5)];
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    let n;
    if (L.tex === "pixel") n = rnd() - 0.5;
    else { const fx = (x / px) * 4, fy = (y / px) * 4, ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy; n = (cell(ix, iy) * (1 - ax) + cell(ix + 1, iy) * ax) * (1 - ay) + (cell(ix, iy + 1) * (1 - ax) + cell(ix + 1, iy + 1) * ax) * ay; n = n * 0.8 + (rnd() - 0.5) * 0.25; }
    let col = base;
    if (opts.strip && y < (px * 4) / 16 + (L.tex === "pixel" && rnd() < 0.4 ? 1 : 0)) col = opts.strip;
    const k = 1 + n * L.spread * 2;
    g.fillStyle = `rgb(${Math.min(255, col[0] * k) | 0},${Math.min(255, col[1] * k) | 0},${Math.min(255, col[2] * k) | 0})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (L.tex === "pixel") { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; } else t.anisotropy = 8;
  return t;
}
const rgb = (a) => new THREE.Color(`rgb(${a[0]},${a[1]},${a[2]})`);
function mat(base, { rough = 0.9, metal = 0, strip = null, emissive = null } = {}) {
  const map = texFor(base, { strip });
  return new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : rgb(base), roughness: rough, metalness: metal, ...(emissive ? { emissive: rgb(emissive), emissiveIntensity: 2.2 } : {}) });
}
const P = L.pal;
const emis = (c, k) => new THREE.MeshStandardMaterial({ color: rgb(c), emissive: rgb(c), emissiveIntensity: k, roughness: 1 });
const M = {
  grassTop: mat(P.grass), grassSide: L.tex === "none" ? mat(P.grass) : mat(P.dirt, { strip: P.grass }), dirt: mat(P.dirt), deep: mat(P.deep), stone: mat(P.stone), clay: mat(P.clay, { rough: 0.8 }), aquifer: mat(P.aquifer, { rough: 0.35 }), gravel: mat(P.gravel),
  liner: mat(P.liner, { rough: 0.42 }), pipe: mat(P.pipe, { rough: 0.35 }), tank: mat(P.tank, { rough: 0.45 }), tankCap: mat(P.tank.map((v) => v * 0.75), { rough: 0.45 }),
  truck: mat(P.truck, { rough: 0.4 }), bed: mat(P.bed, { rough: 0.45 }), tyre: mat([38, 38, 42], { rough: 0.8 }), chassis: mat([70, 72, 80], { rough: 0.6 }), glass: new THREE.MeshStandardMaterial({ color: 0x9fd8f2, roughness: 0.1, metalness: 0.1 }),
  cover: mat(P.cover), trunk: mat([116, 82, 50]), leaf: mat([70, 158, 60]), leaf2: mat([92, 176, 70]), wall: mat([240, 236, 226], { rough: 0.8 }), roof: mat([204, 76, 54], { rough: 0.7 }), door: mat([124, 84, 52]), road: mat([152, 148, 142]),
  vest: mat([250, 140, 30], { rough: 0.7 }), helmet: mat([250, 210, 40], { rough: 0.4 }), skin: mat([236, 190, 150], { rough: 0.7 }), pants: mat([60, 86, 140], { rough: 0.8 }),
  flame: emis([255, 96, 20], 1.6), flameMid: emis([255, 150, 30], 1.5), flameCore: emis([255, 214, 90], 1.3), metal: mat([150, 156, 164], { rough: 0.35, metal: 0.4 }),
};
const bagCols = [[52, 116, 64], [44, 44, 50], [64, 104, 188], [236, 230, 214], [184, 128, 72], [204, 70, 66], [226, 182, 60], [52, 116, 64], [44, 44, 50]];
const bagMats = bagCols.map((c) => mat(c, { rough: 0.55 }));

const blockGeo = new RoundedBoxGeometry(1, 1, 1, 3, L.groundBevel);
const unit = (b = L.bevel) => new RoundedBoxGeometry(1, 1, 1, 3, b);
let PIECE_ID = 0;
function piece(material, sx, sy, sz, x, y, z, parent = scene, bevel = L.bevel) {
  const geo = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(bevel * Math.min(sx, sy, sz, 1) * 1.6, Math.min(sx, sy, sz) * 0.45));
  if (material.map && Math.max(sx, sy, sz) > 2) { material = material.clone(); material.map = material.map.clone(); material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping; material.map.repeat.set(Math.max(1, Math.round(sx)), Math.max(1, Math.round(Math.max(sy, sz)))); material.map.needsUpdate = true; }
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; m.userData.id = PIECE_ID++; parent.add(m); return m;
}

// ---------- ground block with the pit cut through it ----------
const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 };
const lists = { grass: [], road: [], dirt: [], deep: [], clay: [], gravel: [], aquifer: [], stone: [] };
for (let k = 0; k < 17; k++) for (let x = -18; x < 18; x++) for (let z = -15; z < 0; z++) {
  if (x >= PIT.x0 && x < PIT.x1 && z >= PIT.z0 && k < PIT.depth) continue;
  if (z === -1 && ((k === 5 && x >= 5 && x < 8) || (x === 7 && k <= 5))) continue; // groove for the drain pipe on the cut face
  const road = k === 0 && x >= -2 && x < 2 && z < -9;
  const kind = k === 0 ? (road ? "road" : "grass") : k <= 3 ? "dirt" : k <= 7 ? "deep" : k <= 9 ? "clay" : k === 10 ? "gravel" : k <= 13 ? "aquifer" : "stone";
  lists[kind].push([x + 0.5, -0.5 - k, z + 0.5]);
}
const tint = new THREE.Color();
for (const [kind, list] of Object.entries(lists)) {
  const material = kind === "grass" ? [M.grassSide, M.grassSide, M.grassTop, M.dirt, M.grassSide, M.grassSide] : M[kind];
  const im = new THREE.InstancedMesh(blockGeo, material, list.length);
  im.castShadow = im.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  list.forEach(([x, y, z], i) => { im.setMatrixAt(i, m4.makeTranslation(x, y, z)); const j = 1 + (rnd() - 0.5) * L.jitter * 2; im.setColorAt(i, tint.setRGB(j, j, j)); });
  if (!Q.has("noground")) scene.add(im);
}
{ const under = new THREE.Mesh(new THREE.BoxGeometry(36, 30, 15), M.stone); under.position.set(0, -17 - 15, -7.5); if (!Q.has("nounder")) scene.add(under); }
// lawn beyond the block, far road, hills
const lawnMat = mat(P.grass); if (lawnMat.map) { lawnMat.map = lawnMat.map.clone(); lawnMat.map.wrapS = lawnMat.map.wrapT = THREE.RepeatWrapping; lawnMat.map.repeat.set(1200, 1200); lawnMat.map.needsUpdate = true; }
for (const [w, d, x, z] of [[1600, 1200, 0, -615], [800, 600, -418, -300], [800, 600, 418, -300]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lawnMat); p.rotation.x = -Math.PI / 2; p.position.set(x, -0.001, z); p.receiveShadow = true; if (!Q.has("nolawn")) scene.add(p); }
piece(M.road, 4, 0.2, 80, 0, -0.09, -15 - 40, scene, 0.02);
for (const [x, z, w, h, d] of [[-42, -115, 30, 5, 14], [14, -130, 42, 7, 16], [52, -105, 24, 4, 12]]) for (let s = 0; s < 3; s++) piece(M.grassTop, w - s * w * 0.28, h / 3, d - s * d * 0.25, x, (h / 3) * (s + 0.5), z, scene, 0.3);

// ---------- props ----------
function tree(x, z, s = 1) {
  piece(M.trunk, 0.9 * s, 3 * s, 0.9 * s, x, 1.5 * s, z);
  piece(M.leaf, 3.8 * s, 2.6 * s, 3.8 * s, x, 3.9 * s, z, scene, 0.18);
  piece(M.leaf2, 2.4 * s, 1.5 * s, 2.4 * s, x + 0.2 * s, 5.7 * s, z - 0.2 * s, scene, 0.18);
}
tree(-12, -11); tree(13.5, -2.8, 0.9); tree(-15, -27, 1.2); tree(17, -31, 1.3); tree(-4, -42, 1.1); tree(-22, -14, 1.05);
{ // house
  const g = new THREE.Group(); g.position.set(-9, 0, -31); scene.add(g);
  piece(M.wall, 7, 4, 5, 0, 2, 0, g);
  for (let s = 0; s < 3; s++) piece(M.roof, 7.6, 0.9, 5.6 - s * 1.8, 0, 4.45 + s * 0.9, 0, g);
  piece(M.door, 1.2, 2, 0.15, 0, 1, 2.52, g);
  for (const wx of [-2.3, 2.3]) piece(M.glass, 1.3, 1.1, 0.12, wx, 2.4, 2.53, g, 0.02);
}
// liner: back, sides, floor, and the lip over the rim
const LT = 0.16;
piece(M.liner, PIT.x1 - PIT.x0, PIT.depth, LT, 0, -PIT.depth / 2 + 0.02, PIT.z0 + LT / 2, scene, 0.02);
piece(M.liner, LT, PIT.depth, -PIT.z0, PIT.x0 + LT / 2, -PIT.depth / 2 + 0.02, PIT.z0 / 2, scene, 0.02);
piece(M.liner, LT, PIT.depth, -PIT.z0, PIT.x1 - LT / 2, -PIT.depth / 2 + 0.02, PIT.z0 / 2, scene, 0.02);
piece(M.liner, PIT.x1 - PIT.x0, LT, -PIT.z0, 0, -PIT.depth + LT / 2, PIT.z0 / 2, scene, 0.02);
piece(M.liner, PIT.x1 - PIT.x0 + 1.4, LT, 1.0, 0, 0.08, PIT.z0 - 0.45, scene, 0.03);
for (const sx of [PIT.x0 - 0.45, PIT.x1 + 0.45]) piece(M.liner, 1.0, LT, -PIT.z0, sx, 0.08, PIT.z0 / 2, scene, 0.03);
// drain pipe along the floor, out through the right wall, up to a tank on the lawn
// gravel drainage layer on the liner floor, the pipe lying on it near the cut face
piece(M.road, PIT.x1 - PIT.x0 - 2 * LT, 0.54, -PIT.z0 - LT, 0, -PIT.depth + LT + 0.27, PIT.z0 / 2 + LT / 2, scene, 0.04);
const FY = -5.05, PZ = -0.6;
piece(M.pipe, 9.6, 0.5, 0.5, -0.2, FY, PZ, scene, 0.2);
piece(M.pipe, 3.3, 0.5, 0.5, 6.2, -5.5, PZ, scene, 0.2);
piece(M.pipe, 0.5, 0.5, 0.5, 4.7, -5.28, PZ, scene, 0.2);
piece(M.pipe, 0.5, 5.8, 0.5, 7.6, -2.55, PZ, scene, 0.2);
piece(M.pipe, 0.8, 0.8, 0.8, 7.6, -5.5, PZ, scene, 0.3);
piece(M.pipe, 0.8, 0.8, 0.8, 7.6, 0.35, PZ, scene, 0.3);
piece(M.pipe, 0.9, 0.5, 0.5, 8.15, 0.35, PZ, scene, 0.2);
{ const g = new THREE.Group(); g.position.set(9.7, 0, -1.9); scene.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.8, 28), M.tank); body.position.y = 1.4; body.castShadow = body.receiveShadow = true; g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.48, 0.3, 28), M.tankCap); cap.position.y = 2.95; cap.castShadow = true; g.add(cap);

}
// trash in layers with soil covers
const tagged = (tag, ...a) => { const m = piece(...a); m.userData.tag = tag; return m; };
// packed bag layers (4 across, 3 deep) with thin soil covers: reads as a layered landfill on the cut face
const IX0 = PIT.x0 + LT, IX1 = PIT.x1 - LT, IZ0 = PIT.z0 + LT, IZ1 = 0;
function bagLayer(y0, h, seedOff, rows = 3, skip = () => false, knots = false) {
  const nx = 4, cw = (IX1 - IX0) / nx, cd = (IZ1 - IZ0) / rows;
  for (let i = 0; i < nx; i++) for (let j = 0; j < rows; j++) {
    if (skip(i, j)) continue;
    const m = bagMats[(i * 3 + j * 5 + seedOff) % bagMats.length];
    const w = cw - 0.08 - rnd() * 0.12, d = cd - 0.08 - rnd() * 0.12, hh = h - rnd() * 0.15;
    const x = IX0 + cw * (i + 0.5) + (rnd() - 0.5) * 0.06, z = IZ0 + cd * (j + 0.5) + (rnd() - 0.5) * 0.06;
    tagged("bag" + seedOff, m, w, hh, d, x, y0 + hh / 2, z, scene, 0.28);
    if (knots && (i + j + seedOff) % 3 === 0) piece(m, 0.45, 0.32, 0.45, x, y0 + hh + 0.12, z, scene, 0.4);
  }
}
const cover = (y, t = 0.3) => tagged("cover", M.cover, IX1 - IX0, t, IZ1 - IZ0, 0, y + t / 2, (IZ0 + IZ1) / 2, scene, 0.03);
bagLayer(-5.3, 1.75, 0);
cover(-3.55);
bagLayer(-3.25, 1.75, 4);
cover(-1.5);
bagLayer(-1.2, 1.5, 7, 3, (i, j) => j === 2 || (j === 1 && i === 0), true); // the open working face at the front
// gas well: pipe up through the layers, wellhead, flare (left of the truck)
const GX = -2.9, GZ = -5.9;
piece(M.metal, 0.42, 8.6, 0.42, GX, -1.0, GZ, scene, 0.15);
piece(M.metal, 0.9, 0.6, 0.9, GX, 3.3, GZ, scene, 0.15);
piece(M.flame, 0.95, 0.75, 0.95, GX, 3.95, GZ, scene, 0.35);
piece(M.flameMid, 0.7, 0.7, 0.7, GX + 0.05, 4.55, GZ, scene, 0.35).rotation.y = 0.4;
piece(M.flameCore, 0.42, 0.55, 0.42, GX - 0.04, 5.05, GZ, scene, 0.3).rotation.y = 0.8;
piece(M.flameMid, 0.22, 0.32, 0.22, GX + 0.08, 5.42, GZ, scene, 0.3);
const glow = new THREE.PointLight(0xffa040, 22, 10, 1.6); glow.position.set(GX, 4.6, GZ); scene.add(glow);
// truck at the back, tipping, with two bags in the air
{
  const g = new THREE.Group(); g.position.set(0, 0, -12.1); scene.add(g);
  piece(M.chassis, 2.6, 0.5, 7, 0, 0.9, 0, g);
  piece(M.truck, 2.8, 2.2, 2.2, 0, 2.2, -2.6, g);
  piece(M.glass, 2.4, 0.9, 0.1, 0, 2.7, -3.72, g, 0.02);
  for (const [x, z] of [[-1.35, -2.4], [1.35, -2.4], [-1.35, 1.2], [1.35, 1.2], [-1.35, 2.6], [1.35, 2.6]]) piece(M.tyre, 0.6, 1.2, 1.2, x, 0.6, z, g, 0.25);
  const pivot = new THREE.Group(); pivot.position.set(0, 1.15, 3.4); pivot.rotation.x = 0.7; g.add(pivot);
  const bed = new THREE.Group(); bed.position.set(0, 0, -2.25); pivot.add(bed);
  piece(M.bed, 2.8, 0.25, 4.5, 0, 0.12, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, -1.3, 0.9, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, 1.3, 0.9, 0, bed); piece(M.truck, 2.8, 1.7, 0.2, 0, 0.95, -2.2, bed);
  piece(bagMats[0], 1.3, 1.1, 1.3, -0.4, 1.2, -1.2, bed, 0.3); piece(bagMats[4], 1.2, 1.0, 1.2, 0.6, 1.1, -0.2, bed, 0.3);
}
piece(bagMats[5], 1.3, 1.1, 1.3, 0.6, 1.4, -8.4, scene, 0.3).rotation.set(0.5, 0.3, 0.2);
piece(bagMats[2], 1.2, 1.0, 1.2, -0.7, 2.4, -9.2, scene, 0.3).rotation.set(-0.3, 0.6, 0.1);
// worker by the tank
{ const g = new THREE.Group(); g.position.set(12.2, 0, -5.2); g.rotation.y = -0.7; scene.add(g);
  piece(M.pants, 0.36, 0.9, 0.36, -0.2, 0.45, 0, g, 0.15); piece(M.pants, 0.36, 0.9, 0.36, 0.2, 0.45, 0, g, 0.15);
  piece(M.vest, 0.85, 1.0, 0.5, 0, 1.4, 0, g, 0.18); piece(M.skin, 0.25, 0.85, 0.25, -0.56, 1.4, 0, g, 0.1); piece(M.skin, 0.25, 0.85, 0.25, 0.56, 1.4, 0, g, 0.1);
  piece(M.skin, 0.55, 0.55, 0.55, 0, 2.2, 0, g, 0.15); piece(M.helmet, 0.66, 0.26, 0.66, 0, 2.55, 0, g, 0.25);
}

// ---------- camera + post ----------
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 400);
camera.position.set(16.5, 14.5, 37); camera.lookAt(0.6, 0.6, -7.5);
const rt = new THREE.WebGLRenderTarget(W, H, { samples: Q.has("nomsaa") ? 0 : 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
if (!L.ao) composer.addPass(new RenderPass(scene, camera)); // N8AOPass renders the scene itself
if (L.ao) {
  const ao = new N8AOPass(scene, camera, W, H);
  Object.assign(ao.configuration, { aoRadius: 2.2 * L.ao.radius, distanceFalloff: 1.0, intensity: 2.6 * L.ao.intensity, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false, gammaCorrection: false });
  if (Q.has("aodebug")) ao.setDisplayMode("AO");
  composer.addPass(ao);
}
if (L.dof) composer.addPass(new BokehPass(scene, camera, L.dof));
if (L.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), L.bloom, 0.5, 0.92));
composer.addPass(new OutputPass());
{ const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = 0.75; composer.addPass(v); }

if (Q.has("range")) { const [a, b] = Q.get("range").split("-").map(Number); scene.traverse((o) => { if (o.isMesh && o.userData.id >= a && o.userData.id < b) o.visible = false; }); console.log("pieces " + PIECE_ID); }
if (Q.has("hide")) { const want = Q.get("hide"); scene.traverse((o) => { if (o.isMesh && o.userData.tag === want) o.visible = false; }); }
window.renderAt = () => { composer.render(); return true; };
window.lookName = L.name;
window.ready = true;
