// Smooth style frames (?s=1|2|3): the look-frame moment on continuous ground.
// 1 smooth clay toy (closest to now) · 2 textured clay toy · 3 soft miniature diorama (closer to the creator's semi-real look)
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildGround, clumpGeometries, moundGeometry } from "./world.js";

const Q = new URLSearchParams(location.search);
const STYLES = {
  1: { name: "Smooth clay toy", noise: 0.05, speck: 0, wave: 0.55, rough: 0.92,
    colors: { sod: "#5a3d22", dirt: "#cf8a4e", deep: "#ad6b3c", clay: "#aaa5b6", gravel: "#cbbfa8", water: "#1d78ea", rock: "#8e8f9c" },
    grass: { base: "#5fc04c", alt: "#52b043", var: 0.04, fine: 0.04 }, propBevel: 0.18, sun: ["#fff6e8", 2.6, [14, 30, 20]], hemi: 1.0, exposure: 0.92, sat: 0.8, con: 1.12, dof: null },
  2: { name: "Textured clay toy", noise: 0.15, speck: 0.04, wave: 1.0, rough: 0.94,
    colors: { sod: "#553a20", dirt: "#c7854c", deep: "#a3663a", clay: "#a6a1b2", gravel: "#c6b9a0", water: "#1f76e4", rock: "#8a8b97" },
    grass: { base: "#5fbb4c", alt: "#4ea442", var: 0.07, fine: 0.11 }, propBevel: 0.2, sun: ["#fff3e2", 2.6, [14, 30, 20]], hemi: 1.0, exposure: 0.92, sat: 0.8, con: 1.12, dof: null },
  3: { name: "Soft miniature diorama", noise: 0.24, speck: 0.09, wave: 1.1, rough: 0.96,
    colors: { sod: "#4c3420", dirt: "#b97b47", deep: "#965f38", clay: "#a19caa", gravel: "#bfb29a", water: "#2a72d6", rock: "#858692" },
    grass: { base: "#68b24c", alt: "#54993e", var: 0.1, fine: 0.17, stripes: 1 }, propBevel: 0.22, sun: ["#ffe9cc", 2.8, [20, 24, 16]], hemi: 0.9, exposure: 0.95, sat: 0.74, con: 1.1,
    dof: { focus: 38, aperture: 0.0001, maxblur: 0.004 } },
};
const S = STYLES[Q.get("s") ?? "1"];

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = S.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
{ const c = document.createElement("canvas"); c.width = 2; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#2f93ea"); gr.addColorStop(0.16, "#a9dcff"); gr.addColorStop(1, "#a9dcff"); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; scene.fog = new THREE.Fog(new THREE.Color("#a9dcff"), 220, 520); }
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight("#e4f3ff", "#b08f66", S.hemi));
const sun = new THREE.DirectionalLight(S.sun[0], S.sun[1]); sun.position.set(...S.sun[2]); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 130 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun);

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rgb = (a) => new THREE.Color(`rgb(${a[0]},${a[1]},${a[2]})`);
const mat = (c, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: rgb(c), roughness: rough, ...extra });
const emis = (c, k) => new THREE.MeshStandardMaterial({ color: rgb(c), emissive: rgb(c), emissiveIntensity: k, roughness: 1 });
const M = {
  liner: mat([46, 54, 70], 0.38), cover: mat([92, 56, 34], 0.95), gravel: mat([190, 180, 162], 0.95), pipe: mat([242, 244, 246], 0.32), tank: mat([70, 176, 196], 0.42), tankCap: mat([52, 132, 150], 0.42),
  truck: mat([255, 146, 40], 0.4), bed: mat([236, 116, 30], 0.45), tyre: mat([36, 36, 40], 0.8), chassis: mat([70, 74, 84], 0.6), glass: mat([150, 214, 245], 0.12),
  trunk: mat([118, 80, 48]), leaf: mat([66, 168, 70]), leaf2: mat([92, 188, 80]), wall: mat([244, 240, 230], 0.8), roof: mat([220, 70, 50], 0.7), door: mat([126, 84, 52]), road: mat([170, 166, 160], 0.95),
  vest: mat([250, 140, 30], 0.7), helmet: mat([250, 210, 40], 0.4), skin: mat([236, 190, 150], 0.7), pants: mat([60, 86, 140], 0.8), metal: mat([150, 156, 164], 0.35, { metalness: 0.4 }),
  flame: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff6a10"), toneMapped: false, transparent: true, opacity: 0.5, depthWrite: false }), flameMid: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc232"), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false }), flameCore: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3a0"), toneMapped: false }),
};
const bagCols = [[56, 150, 72], [132, 86, 186], [58, 110, 214], [240, 236, 222], [214, 154, 86], [226, 64, 60], [246, 196, 52], [40, 168, 160], [250, 128, 40]];
const bagMats = bagCols.map((c) => mat(c, 0.55));
const geoCache = new Map();
function rbox(sx, sy, sz, bevel) { const r = Math.min(bevel * Math.min(sx, sy, sz, 1) * 1.6, Math.min(sx, sy, sz) * 0.45); const k = [sx, sy, sz, r].map((v) => v.toFixed(3)).join(","); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(sx, sy, sz, 4, r)); return geoCache.get(k); }
function piece(material, sx, sy, sz, x, y, z, parent = scene, bevel = S.propBevel) { const m = new THREE.Mesh(rbox(sx, sy, sz, bevel), material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function pipe(a, b, r = 0.26) { // round pipe between two points, with a ball joint at b
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), M.pipe); m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = m.receiveShadow = true; scene.add(m);
  const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 20, 14), M.pipe); j.position.copy(B); j.castShadow = true; scene.add(j);
}

// ---------- ground ----------
const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 };
buildGround(scene, S, { pit: PIT });
// the dirt mound next to the pit
{ const m = new THREE.Mesh(moundGeometry(), new THREE.MeshStandardMaterial({ color: new THREE.Color(S.colors.dirt), roughness: 0.95 })); m.scale.set(2.6, 2.6, 2.2); m.position.set(10, 0, -11.5); m.castShadow = m.receiveShadow = true; scene.add(m);
  const cg = clumpGeometries(4, 7); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cg[i % 4], m.material); const s = 0.35 + rnd() * 0.4; c.scale.setScalar(s); c.position.set(10 + (rnd() - 0.5) * 5, s * 0.25, -11.5 + (rnd() - 0.5) * 4.5); c.rotation.set(rnd() * 3, rnd() * 3, 0); c.castShadow = true; scene.add(c); } }
piece(M.road, 4, 0.12, 80, 0, -0.05, -16 - 40, scene, 0.02);
for (const [x, z, w, h, d] of [[-42, -115, 30, 5, 14], [14, -130, 42, 7, 16], [52, -105, 24, 4, 12]]) { const m = new THREE.Mesh(moundGeometry(), new THREE.MeshStandardMaterial({ color: new THREE.Color(S.grass.base), roughness: 0.95 })); m.scale.set(w / 2, h * 1.6, d / 2); m.position.set(x, 0, z); scene.add(m); }
// trees: rounded, softer
function tree(x, z, s = 1) { piece(M.trunk, 0.8 * s, 3 * s, 0.8 * s, x, 1.5 * s, z, scene, 0.3); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1 * s, 2), M.leaf); l.position.set(x, 4.3 * s, z); l.scale.set(1, 0.85, 1); l.castShadow = l.receiveShadow = true; scene.add(l); const l2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 * s, 2), M.leaf2); l2.position.set(x + 0.5 * s, 5.6 * s, z - 0.3 * s); l2.castShadow = true; scene.add(l2); }
tree(-12, -11); tree(13.5, -2.8, 0.9); tree(-15, -27, 1.2); tree(17, -31, 1.3); tree(-4, -42, 1.1); tree(-22, -14, 1.05);
{ const g = new THREE.Group(); g.position.set(-9, 0, -31); scene.add(g);
  piece(M.wall, 7, 4, 5, 0, 2, 0, g); for (let s = 0; s < 3; s++) piece(M.roof, 7.6, 0.9, 5.6 - s * 1.8, 0, 4.45 + s * 0.9, 0, g);
  piece(M.door, 1.2, 2, 0.15, 0, 1, 2.52, g); for (const wx of [-2.3, 2.3]) piece(M.glass, 1.3, 1.1, 0.12, wx, 2.4, 2.53, g, 0.05); }
// liner
const LT = 0.16;
piece(M.liner, 10, PIT.depth, LT, 0, -PIT.depth / 2 + 0.02, PIT.z0 + LT / 2, scene, 0.05);
piece(M.liner, LT, PIT.depth, 8, PIT.x0 + LT / 2, -PIT.depth / 2 + 0.02, -4, scene, 0.05);
piece(M.liner, LT, PIT.depth, 8, PIT.x1 - LT / 2, -PIT.depth / 2 + 0.02, -4, scene, 0.05);
piece(M.liner, 10, LT, 8, 0, -PIT.depth + LT / 2, -4, scene, 0.05);
piece(M.liner, 11.4, LT, 1.0, 0, 0.06, PIT.z0 - 0.45, scene, 0.06);
for (const sx of [PIT.x0 - 0.45, PIT.x1 + 0.45]) piece(M.liner, 1.0, LT, 8, sx, 0.06, -4, scene, 0.06);
// gravel drain layer + round drain pipe, half sunk in the cut face, up to the tank
piece(M.gravel, 10 - 2 * LT, 0.54, 8 - LT, 0, -PIT.depth + LT + 0.27, -4 + LT / 2, scene, 0.1);
const PZ = -0.12;
pipe([-4.6, -5.05, PZ], [4.7, -5.05, PZ]); pipe([4.7, -5.05, PZ], [5.2, -5.5, PZ]); pipe([5.2, -5.5, PZ], [7.6, -5.5, PZ]); pipe([7.6, -5.5, PZ], [7.6, 0.35, PZ]); pipe([7.6, 0.35, PZ], [8.5, 0.35, PZ]);
{ const g = new THREE.Group(); g.position.set(9.7, 0, -1.9); scene.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.8, 40), M.tank); body.position.y = 1.4; body.castShadow = body.receiveShadow = true; g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.45, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.tankCap); cap.position.y = 2.8; cap.scale.y = 0.35; cap.castShadow = true; g.add(cap); }
// packed bag layers with soil covers
const IX0 = PIT.x0 + LT, IX1 = PIT.x1 - LT, IZ0 = PIT.z0 + LT, IZ1 = 0;
function bagLayer(y0, h, seedOff, skip = () => false, knots = false) {
  const cw = (IX1 - IX0) / 4, cd = (IZ1 - IZ0) / 3;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    if (skip(i, j)) continue;
    const m = bagMats[(i * 3 + j * 5 + seedOff) % bagMats.length];
    const w = cw - 0.08 - rnd() * 0.12, d = cd - 0.08 - rnd() * 0.12, hh = h - rnd() * 0.15;
    const x = IX0 + cw * (i + 0.5), z = IZ0 + cd * (j + 0.5);
    piece(m, w, hh, d, x, y0 + hh / 2, z, scene, 0.32);
    if (knots && (i + j + seedOff) % 3 === 0) piece(m, 0.45, 0.32, 0.45, x, y0 + hh + 0.12, z, scene, 0.45);
  }
}
const cover = (y, t = 0.32) => piece(M.cover, IX1 - IX0, t, IZ1 - IZ0, 0, y + t / 2, (IZ0 + IZ1) / 2, scene, 0.12);
bagLayer(-5.3, 1.72, 0); cover(-3.58); bagLayer(-3.26, 1.72, 4); cover(-1.54); bagLayer(-1.22, 1.5, 7, (i, j) => j === 2 || (j === 1 && i === 0), true);
// gas well + a bright flare with a glow
const GX = -2.9, GZ = -5.9;
pipe([GX, -5.3, GZ], [GX, 3.0, GZ], 0.22);
piece(M.metal, 0.9, 0.55, 0.9, GX, 3.25, GZ, scene, 0.25);
{ const tear = (w, h) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * Math.pow(1 - t, 0.55), t * h)); } return new THREE.LatheGeometry(pts, 32); };
  const fl = (m, r, y, sx = 1, sy = 1.6, order = 0) => { const s = new THREE.Mesh(tear(r, r * 2 * sy), m); s.position.set(GX, y - r * 0.9, GZ); s.renderOrder = order; scene.add(s); };
  fl(M.flameCore, 0.32, 4.0, 1, 1.5, 1); fl(M.flameMid, 0.52, 4.05, 1, 1.6, 2); fl(M.flame, 0.76, 4.12, 1, 1.75, 3);
  const glow = new THREE.PointLight(0xffa040, 30, 12, 1.5); glow.position.set(GX, 4.4, GZ); scene.add(glow);
  const gc = document.createElement("canvas"); gc.width = gc.height = 128; const gg = gc.getContext("2d"); const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, "rgba(255,200,90,1)"); rg.addColorStop(0.3, "rgba(255,150,40,0.55)"); rg.addColorStop(1, "rgba(255,120,30,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); halo.position.set(GX, 4.35, GZ); halo.scale.set(4.4, 4.4, 1); scene.add(halo); }
// truck tipping, two bags in the air
{ const g = new THREE.Group(); g.position.set(0, 0, -12.1); scene.add(g);
  piece(M.chassis, 2.6, 0.5, 7, 0, 0.9, 0, g); piece(M.truck, 2.8, 2.2, 2.2, 0, 2.2, -2.6, g); piece(M.glass, 2.4, 0.9, 0.1, 0, 2.7, -3.72, g, 0.05);
  for (const [x, z] of [[-1.35, -2.4], [1.35, -2.4], [-1.35, 1.2], [1.35, 1.2], [-1.35, 2.6], [1.35, 2.6]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.55, 28), M.tyre); w.rotation.z = Math.PI / 2; w.position.set(x, 0.6, z); w.castShadow = true; g.add(w); }
  const pivot = new THREE.Group(); pivot.position.set(0, 1.15, 3.4); pivot.rotation.x = 0.7; g.add(pivot);
  const bed = new THREE.Group(); bed.position.set(0, 0, -2.25); pivot.add(bed);
  piece(M.bed, 2.8, 0.25, 4.5, 0, 0.12, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, -1.3, 0.9, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, 1.3, 0.9, 0, bed); piece(M.truck, 2.8, 1.7, 0.2, 0, 0.95, -2.2, bed);
  piece(bagMats[0], 1.3, 1.1, 1.3, -0.4, 1.2, -1.2, bed, 0.32); piece(bagMats[4], 1.2, 1.0, 1.2, 0.6, 1.1, -0.2, bed, 0.32); }
piece(bagMats[5], 1.3, 1.1, 1.3, 0.6, 1.4, -8.4, scene, 0.32).rotation.set(0.5, 0.3, 0.2);
piece(bagMats[2], 1.2, 1.0, 1.2, -0.7, 2.4, -9.2, scene, 0.32).rotation.set(-0.3, 0.6, 0.1);
{ const g = new THREE.Group(); g.position.set(12.2, 0, -5.2); g.rotation.y = -0.7; scene.add(g);
  piece(M.pants, 0.36, 0.9, 0.36, -0.2, 0.45, 0, g, 0.3); piece(M.pants, 0.36, 0.9, 0.36, 0.2, 0.45, 0, g, 0.3);
  piece(M.vest, 0.85, 1.0, 0.5, 0, 1.4, 0, g, 0.3); piece(M.skin, 0.25, 0.85, 0.25, -0.56, 1.4, 0, g, 0.3); piece(M.skin, 0.25, 0.85, 0.25, 0.56, 1.4, 0, g, 0.3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), M.skin); head.position.set(0, 2.2, 0); head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet); hat.position.set(0, 2.32, 0); hat.castShadow = true; g.add(hat); }

// ---------- camera + post ----------
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 900);
camera.position.set(16.5, 14.5, 37); camera.lookAt(0.6, 0.6, -7.5);
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const ao = new N8AOPass(scene, camera, W, H);
Object.assign(ao.configuration, { aoRadius: 2.8, distanceFalloff: 1.0, intensity: 3.4, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false, gammaCorrection: false });
composer.addPass(ao);
if (S.dof) composer.addPass(new BokehPass(scene, camera, S.dof));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.6, 2.6));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: Number(Q.get("sat") ?? S.sat) }, con: { value: S.con } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat; uniform float con; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * con + 0.5; gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }",
}));
{ const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = 0.7; composer.addPass(v); }
window.renderAt = () => { composer.render(); return true; };
window.ready = true;
