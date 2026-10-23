// M1 preview (0-11.46 s of the landfill script) in look B "clay toy", tuned: more saturation and contrast,
// crisper sun shadows, saturated groundwater, distinct soil covers, dark liner, captions band kept clear.
// Words (voice_A_30s): Dig 0.30, Pit 0.57, Landfill 1.13, But 2.07, Leaks 2.95, Groundwater 3.76, So 4.81, Lay 5.12,
// Clay 5.74, Base 6.06, Not 6.71, Enough 6.99, You add 8.00, Plastic 8.41, Sheet 8.85, This is 9.83, Liner 10.77.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const Q = new URLSearchParams(location.search);
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; // A's crisper sun shadows
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
{ // deeper, clearer sky; the horizon matches the fog
  const c = document.createElement("canvas"); c.width = 2; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#2f93ea"); gr.addColorStop(0.16, "#a9dcff"); gr.addColorStop(1, "#a9dcff"); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  scene.fog = new THREE.Fog(new THREE.Color("#a9dcff"), 220, 520);
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight("#e4f3ff", "#b08f66", 1.0));
const sun = new THREE.DirectionalLight("#fff6e8", 2.6);
sun.position.set(14, 30, 20); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 130 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
scene.add(sun);

// ---------- materials (smooth matte, no textures) ----------
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rgb = (a) => new THREE.Color(`rgb(${a[0]},${a[1]},${a[2]})`);
const mat = (c, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: rgb(c), roughness: rough, ...extra });
const P = {
  grass: [104, 196, 84], dirt: [204, 136, 80], deep: [172, 108, 64], clay: [168, 166, 178], gravel: [196, 186, 168],
  aquifer: [28, 120, 236], stone: [146, 148, 160], cover: [92, 56, 34], liner: [46, 54, 70], clayBase: [150, 150, 164],
};
const M = {
  grass: mat(P.grass), dirt: mat(P.dirt), deep: mat(P.deep), clay: mat(P.clay), gravel: mat(P.gravel), stone: mat(P.stone),
  aquifer: mat(P.aquifer, 0.3, { emissive: rgb(P.aquifer), emissiveIntensity: 0.12 }),
  cover: mat(P.cover, 0.95), liner: mat(P.liner, 0.38), clayBase: mat(P.clayBase, 0.9),
  truck: mat([255, 146, 40], 0.4), bed: mat([236, 116, 30], 0.45), tyre: mat([36, 36, 40], 0.8), chassis: mat([70, 74, 84], 0.6),
  glass: mat([150, 214, 245], 0.12), trunk: mat([118, 80, 48]), leaf: mat([66, 168, 70]), leaf2: mat([92, 188, 80]),
  wall: mat([244, 240, 230], 0.8), roof: mat([220, 70, 50], 0.7), door: mat([126, 84, 52]), road: mat([168, 164, 158]),
};
const bagCols = [[56, 150, 72], [132, 86, 186], [58, 110, 214], [240, 236, 222], [214, 154, 86], [226, 64, 60], [246, 196, 52], [40, 168, 160], [250, 128, 40]];
const bagMats = bagCols.map((c) => mat(c, 0.55));

const geoCache = new Map();
function rbox(sx, sy, sz, bevel) {
  const r = Math.min(bevel * Math.min(sx, sy, sz, 1) * 1.6, Math.min(sx, sy, sz) * 0.45);
  const k = [sx, sy, sz, r].map((v) => v.toFixed(3)).join(",");
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(sx, sy, sz, 3, r));
  return geoCache.get(k);
}
function piece(material, sx, sy, sz, x, y, z, parent = scene, bevel = 0.13) {
  const m = new THREE.Mesh(rbox(sx, sy, sz, bevel), material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

// ---------- easing ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

// ---------- ground with the pit (dug on "Dig") ----------
const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 };
const LAYER = (k) => (k === 0 ? "grass" : k <= 3 ? "dirt" : k <= 7 ? "deep" : k <= 9 ? "clay" : k === 10 ? "gravel" : k <= 13 ? "aquifer" : "stone");
const kinds = {};
for (let k = 0; k < 17; k++) for (let x = -18; x < 18; x++) for (let z = -15; z < 0; z++) {
  const kind = k === 0 && x >= -2 && x < 2 && z < -9 ? "road" : LAYER(k);
  (kinds[kind] ??= []).push({ x: x + 0.5, y: -0.5 - k, z: z + 0.5, k, r: rnd(), pit: x >= PIT.x0 && x < PIT.x1 && z >= PIT.z0 && k < PIT.depth });
}
const blockGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.06);
const meshes = {};
const white = new THREE.Color(1, 1, 1);
for (const [kind, list] of Object.entries(kinds)) {
  const im = new THREE.InstancedMesh(blockGeo, M[kind], list.length);
  im.castShadow = im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m0 = new THREE.Matrix4();
  list.forEach((b, i) => { im.setMatrixAt(i, m0.makeTranslation(b.x, b.y, b.z)); const j = 1 + (b.r - 0.5) * 0.12; im.setColorAt(i, new THREE.Color(j, j, j)); b.base = j; });
  scene.add(im); meshes[kind] = im;
}
{ const under = new THREE.Mesh(new THREE.BoxGeometry(36, 30, 15), M.stone); under.position.set(0, -17 - 15, -7.5); scene.add(under); }
for (const [w, d, x, z] of [[1600, 1200, 0, -615], [800, 600, -418, -300], [800, 600, 418, -300]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.grass); p.rotation.x = -Math.PI / 2; p.position.set(x, -0.001, z); p.receiveShadow = true; scene.add(p); }
piece(M.road, 4, 0.2, 80, 0, -0.09, -15 - 40, scene, 0.02);
for (const [x, z, w, h, d] of [[-42, -115, 30, 5, 14], [14, -130, 42, 7, 16], [52, -105, 24, 4, 12]]) for (let s = 0; s < 3; s++) piece(M.grass, w - s * w * 0.28, h / 3, d - s * d * 0.25, x, (h / 3) * (s + 0.5), z, scene, 0.3);
function tree(x, z, s = 1) { piece(M.trunk, 0.9 * s, 3 * s, 0.9 * s, x, 1.5 * s, z); piece(M.leaf, 3.8 * s, 2.6 * s, 3.8 * s, x, 3.9 * s, z, scene, 0.18); piece(M.leaf2, 2.4 * s, 1.5 * s, 2.4 * s, x + 0.2 * s, 5.7 * s, z - 0.2 * s, scene, 0.18); }
tree(-12, -11); tree(13.5, -2.8, 0.9); tree(-15, -27, 1.2); tree(17, -31, 1.3); tree(-4, -42, 1.1); tree(-22, -14, 1.05);
{ const g = new THREE.Group(); g.position.set(-9, 0, -31); scene.add(g);
  piece(M.wall, 7, 4, 5, 0, 2, 0, g); for (let s = 0; s < 3; s++) piece(M.roof, 7.6, 0.9, 5.6 - s * 1.8, 0, 4.45 + s * 0.9, 0, g);
  piece(M.door, 1.2, 2, 0.15, 0, 1, 2.52, g); for (const wx of [-2.3, 2.3]) piece(M.glass, 1.3, 1.1, 0.12, wx, 2.4, 2.53, g, 0.02); }

// dirt pile beside the pit (grows while digging)
const pileSpots = [];
for (const [lvl, n] of [[0, 5], [1, 3], [2, 1]]) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pileSpots.push({ x: 9.5 + i - (n - 1) / 2, y: 0.5 + lvl, z: -11.5 + j - (n - 1) / 2 });
const pile = new THREE.InstancedMesh(blockGeo, M.dirt, pileSpots.length); pile.castShadow = pile.receiveShadow = true; scene.add(pile);

// ---------- clay base (on "Lay") and liner (on "add a plastic sheet") ----------
const CT = 0.5, LT = 0.16;
function anchored(material, sx, sy, sz, ax, ay, az) { // geometry shifted so scaling grows from one side
  const geo = rbox(sx, sy, sz, 0.05).clone(); geo.translate(ax * sx / 2, ay * sy / 2, az * sz / 2);
  const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; m.visible = false; scene.add(m); return m;
}
const clay = {
  floor: anchored(M.clayBase, 10, CT, 8, 0, 0, 1), back: anchored(M.clayBase, 10, 6, CT, 0, 1, 0), l: anchored(M.clayBase, CT, 6, 8, 0, 1, 0), r: anchored(M.clayBase, CT, 6, 8, 0, 1, 0),
};
clay.floor.position.set(0, -6 + CT / 2, -8); clay.back.position.set(0, -6, -8 + CT / 2); clay.l.position.set(-5 + CT / 2, -6, -4); clay.r.position.set(5 - CT / 2, -6, -4);
const liner = {
  back: anchored(M.liner, 9, 5.5, LT, 0, -1, 0), l: anchored(M.liner, LT, 5.5, 7.5, 0, -1, 0), r: anchored(M.liner, LT, 5.5, 7.5, 0, -1, 0), floor: anchored(M.liner, 9, LT, 7.5, 0, 0, 1),
  lipB: anchored(M.liner, 10.6, LT, 1.1, 0, 0, 1), lipL: anchored(M.liner, 1.1, LT, 8, -1, 0, 0), lipR: anchored(M.liner, 1.1, LT, 8, 1, 0, 0),
};
liner.back.position.set(0, 0.0, -7.5 + LT / 2); liner.l.position.set(-4.5 + LT / 2, 0, -3.75); liner.r.position.set(4.5 - LT / 2, 0, -3.75);
liner.floor.position.set(0, -5.5 + LT / 2, -7.5); liner.lipB.position.set(0, LT / 2, -8.6); liner.lipL.position.set(-4.5, LT / 2, -4); liner.lipR.position.set(4.5, LT / 2, -4);

// ---------- trash bags: one packed layer, poured from the truck ----------
const IX0 = -4.5 + LT, IX1 = 4.5 - LT, IZ0 = -7.5 + LT, IZ1 = 0;
const bags = [];
for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
  const cw = (IX1 - IX0) / 4, cd = (IZ1 - IZ0) / 3;
  const w = cw - 0.1 - rnd() * 0.12, d = cd - 0.1 - rnd() * 0.12, h = 1.65 - rnd() * 0.15;
  const m = bagMats[(i * 3 + j * 5) % bagMats.length];
  const g = new THREE.Group(); scene.add(g);
  piece(m, w, h, d, 0, 0, 0, g, 0.28);
  if ((i + j) % 3 === 0) piece(m, 0.45, 0.32, 0.45, 0, h / 2 + 0.12, 0, g, 0.4);
  bags.push({ g, h, x: IX0 + cw * (i + 0.5), z: IZ0 + cd * (j + 0.5), n: bags.length, spin: (rnd() - 0.5) * 2 });
}

// ---------- truck: reverses in while the pit is dug, tips on "Landfill", drives off ----------
const truck = new THREE.Group(); scene.add(truck);
piece(M.chassis, 2.6, 0.5, 7, 0, 0.9, 0, truck); piece(M.truck, 2.8, 2.2, 2.2, 0, 2.2, -2.6, truck); piece(M.glass, 2.4, 0.9, 0.1, 0, 2.7, -3.72, truck, 0.02);
const wheels = [[-1.35, -2.4], [1.35, -2.4], [-1.35, 1.2], [1.35, 1.2], [-1.35, 2.6], [1.35, 2.6]].map(([x, z]) => piece(M.tyre, 0.6, 1.2, 1.2, x, 0.6, z, truck, 0.25));
const pivot = new THREE.Group(); pivot.position.set(0, 1.15, 3.4); truck.add(pivot);
const bed = new THREE.Group(); bed.position.set(0, 0, -2.25); pivot.add(bed);
piece(M.bed, 2.8, 0.25, 4.5, 0, 0.12, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, -1.3, 0.9, 0, bed); piece(M.truck, 0.2, 1.5, 4.5, 1.3, 0.9, 0, bed); piece(M.truck, 2.8, 1.7, 0.2, 0, 0.95, -2.2, bed);
const load = [piece(bagMats[1], 1.3, 1.1, 1.3, -0.5, 0.95, -1.0, bed, 0.3), piece(bagMats[5], 1.2, 1.0, 1.2, 0.55, 0.9, 0.2, bed, 0.3), piece(bagMats[6], 1.1, 0.9, 1.1, -0.2, 1.6, -0.3, bed, 0.3)];
const tipAt = (t) => 0.75 * (easeInOutCubic(span(t, 1.0, 1.45)) - easeInOutCubic(span(t, 2.3, 2.9)));
const truckZ = (t) => -36 + (-12.1 + 36) * easeOutCubic(span(t, 0, 1.0)) - 34 * easeInOutCubic(span(t, 3.1, 5.2));

// ---------- the leak: juice seeps down through the soil, then into the groundwater ----------
const leakColor = new THREE.Color("#4b3b1a"), murk = new THREE.Color("#6b6420");
function leakAt(b, t) {
  if (b.pit || b.k < PIT.depth) return 0;
  // seep 1 (Leaks 2.95 -> groundwater by 3.8), cleared 5.0-5.6 when the clay goes in
  const ax = Math.abs(b.x), inZ = b.z > -6.5;
  let a = 0;
  if (inZ && ax < 3.2 && b.k <= 10) { const reach = PIT.depth + (t - 2.95) / 0.85 * 5; a = Math.max(a, clamp01(reach - b.k - ax * 0.12 - b.r * 0.4) * (1 - span(t, 5.0, 5.6))); }
  if (b.k >= 11 && b.k <= 13) { const rad = (t - 3.7) * 12; const dist = Math.hypot(b.x, (b.z + 3) * 0.6) + (b.k - 11) * 1.2 + b.r * 0.8; a = Math.max(a, clamp01((rad - dist) / 2) * 0.9 * (1 - span(t, 5.0, 5.8))); }
  // seep 2 (Not enough 6.75): thinner, slower, stops short of the groundwater; cleared by the liner 8.9-9.5
  if (inZ && ax < 1.6 && b.k <= 10) { const reach = PIT.depth + (t - 6.8) / 1.1 * 4; a = Math.max(a, clamp01(reach - b.k - ax * 0.2 - b.r * 0.5) * (1 - span(t, 8.9, 9.5))); }
  return a;
}

// ---------- camera: home angle, slow drift; moves between beats ----------
const KEYS = [
  // t, position, target         (named parts kept out of the caption band at y 0.48-0.56)
  [0.0, [16.5, 16.0, 37.0], [0.6, 2.6, -7.5]], //   "Dig a pit": pit low in the frame, below the caption
  [2.0, [16.0, 15.2, 35.5], [0.5, 2.2, -7.2]],
  [3.3, [13.0, 4.5, 31.0], [0.0, -8.6, -4.0]], //   "Leaks down into groundwater": leak column, blue band below the caption
  [4.55, [12.6, 4.1, 30.0], [0.0, -8.9, -4.0]],
  [5.35, [13.5, 13.2, 30.5], [0.4, 1.6, -6.5]], //  "So you lay a thick clay base": back up to the pit
  [9.55, [12.2, 12.2, 27.5], [0.3, 1.2, -6.2]], //  slow push while the liner goes in
  [10.35, [8.2, 4.6, 16.5], [-0.5, -2.2, -6.0]], //  "This is a landfill liner": quick push, the lined back wall above the caption
  [11.5, [7.7, 4.3, 15.6], [-0.6, -2.3, -6.1]],
];
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], u = clamp01((x - xs[i]) / h); return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1]; };
}
const KT = KEYS.map((k) => k[0]);
const camF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[1][a])));
const tgtF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[2][a])));
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 900);

// ---------- post: AO (B's soft occlusion), bloom for the bright bits, grade, vignette ----------
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const ao = new N8AOPass(scene, camera, W, H);
Object.assign(ao.configuration, { aoRadius: 2.8, distanceFalloff: 1.0, intensity: 3.4, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false, gammaCorrection: false });
composer.addPass(ao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.55, 2.2));
composer.addPass(new OutputPass());
const Grade = {
  uniforms: { tDiffuse: { value: null }, sat: { value: Number(Q.get("sat") ?? 0.85) }, con: { value: Number(Q.get("con") ?? 1.12) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat; uniform float con; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * con + 0.5; gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }",
};
composer.addPass(new ShaderPass(Grade));
{ const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = 0.7; composer.addPass(v); }

// ---------- the timeline ----------
const DIG0 = 0.3, LAYER_DT = 0.11, FLY = 0.42;
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), tmpC = new THREE.Color();
const AXIS = new THREE.Vector3(1, 0.4, 0.2).normalize();
window.renderAt = (t) => {
  // dig + leak tint
  let flown = 0, total = 0;
  for (const [kind, list] of Object.entries(kinds)) {
    const im = meshes[kind]; let colorDirty = false;
    list.forEach((b, i) => {
      if (b.pit) {
        total++;
        const t0 = DIG0 + b.k * LAYER_DT + b.r * 0.22, u = span(t, t0, t0 + FLY);
        if (u >= 1) { flown++; mtx.makeScale(0, 0, 0); }
        else if (u <= 0) mtx.makeTranslation(b.x, b.y, b.z);
        else {
          const to = pileSpots[Math.floor(b.r * 9)], e = easeOutCubic(u), s = 1 - u * 0.75;
          v.set(b.x + (to.x - b.x) * e, b.y + (to.y + 1 - b.y) * e + Math.sin(u * Math.PI) * 4, b.z + (to.z - b.z) * e);
          q.setFromAxisAngle(AXIS, u * 3 * (b.r - 0.5)); mtx.compose(v, q, sc.set(s, s, s));
        }
        im.setMatrixAt(i, mtx);
      } else if (kind !== "grass" && kind !== "road" && kind !== "stone") {
        const a = leakAt(b, t);
        if (a > 0 || b.tinted) { tmpC.setRGB(b.base, b.base, b.base).lerp(kind === "aquifer" ? murk : leakColor, a * 0.95); im.setColorAt(i, tmpC); b.tinted = a > 0; colorDirty = true; }
      }
    });

    if (colorDirty) im.instanceColor.needsUpdate = true;
  }
  for (const im of Object.values(meshes)) im.instanceMatrix.needsUpdate = true;
  const prog = flown / Math.max(1, total);
  pileSpots.forEach((p, i) => { const at = (i / pileSpots.length) * 0.9, u = span(prog, at, at + 0.08), s = u > 0 ? easeOutBack(u) : 0; pile.setMatrixAt(i, mtx.compose(v.set(p.x, p.y - 0.5 + 0.5 * s, p.z), q.identity(), sc.set(s, s, s))); });
  pile.instanceMatrix.needsUpdate = true;

  // truck
  truck.position.set(0, 0, truckZ(t)); pivot.rotation.x = tipAt(t);
  wheels.forEach((w) => { w.rotation.x = -truckZ(t) * 0.9; });
  for (const l of load) l.visible = t < 1.25;

  // clay base: floor wipes back-to-front, walls rise from the floor
  const cf = easeOutCubic(span(t, 5.15, 5.6)), cw = easeOutCubic(span(t, 5.4, 5.95));
  clay.floor.visible = t > 5.15; clay.floor.scale.set(1, 1, Math.max(0.001, cf));
  for (const w of [clay.back, clay.l, clay.r]) { w.visible = t > 5.4; w.scale.set(1, Math.max(0.001, cw), 1); }
  // liner: back wall unrolls top-down, then sides, then the floor back-to-front, then the lip folds over the rim
  const lb = easeOutCubic(span(t, 8.35, 8.85)), ls = easeOutCubic(span(t, 8.5, 9.0)), lf = easeOutCubic(span(t, 8.8, 9.3)), ll = easeOutBack(span(t, 9.2, 9.5));
  liner.back.visible = t > 8.35; liner.back.scale.set(1, Math.max(0.001, lb), 1);
  for (const s of [liner.l, liner.r]) { s.visible = t > 8.5; s.scale.set(1, Math.max(0.001, ls), 1); }
  liner.floor.visible = t > 8.8; liner.floor.scale.set(1, 1, Math.max(0.001, lf));
  for (const s of [liner.lipB, liner.lipL, liner.lipR]) { s.visible = t > 9.2; s.scale.set(1, 1, 1); }
  liner.lipB.scale.z = Math.max(0.001, ll); liner.lipL.scale.x = Math.max(0.001, ll); liner.lipR.scale.x = Math.max(0.001, ll);

  // bags: poured from the truck on "Landfill", lifted for the clay and for the liner, settle with a squash
  truck.updateMatrixWorld(true);
  const floorY = -6 + (t > 5.95 ? CT : 0) + (t > 9.3 ? LT : 0);
  for (const b of bags) {
    const rel = 1.2 + b.n * 0.045, DUR = 0.6;
    const restY = -6 + b.h / 2;
    let y, x = b.x, z = b.z, rx = 0, ry = 0;
    if (t < rel) { b.g.visible = false; continue; }
    b.g.visible = true;
    const u = span(t, rel, rel + DUR);
    if (u < 1) { // from the tipped bed's rear to its slot
      const p0 = new THREE.Vector3(0, 2.6, truckZ(rel) + 3.6);
      const ex = easeOutCubic(u), ey = u * u;
      x = p0.x + (b.x - p0.x) * ex; z = p0.z + (b.z - p0.z) * ex; y = p0.y + (restY - p0.y) * ey + Math.sin(u * Math.PI) * 1.2;
      rx = b.spin * (1 - u) * 0.6; ry = b.spin * u * 0.4;
    } else y = restY;
    // lifts: up on "So you" (4.95) and "You add" (8.05); down once the clay (5.95) and the liner (9.3) are in
    const lift = 2.6 * (easeOutCubic(span(t, 4.95 + b.n * 0.01, 5.3)) - span(t, 5.98 + b.n * 0.02, 6.4) ** 2 + easeOutCubic(span(t, 8.05 + b.n * 0.01, 8.4)) - span(t, 9.32 + b.n * 0.02, 9.75) ** 2);
    const rise = (t > 5.95 ? CT : 0) * span(t, 5.98, 6.4) + (t > 9.3 ? LT : 0) * span(t, 9.32, 9.75);
    if (u >= 1) y = restY + lift + rise;
    // squash when landing (first pour and both settles)
    let sq = 0;
    for (const land of [rel + DUR, 6.4, 9.75]) { const k = span(t, land, land + 0.25); if (k > 0 && k < 1) sq = Math.max(sq, Math.sin(k * Math.PI) * 0.16); }
    b.g.position.set(x, y, z); b.g.rotation.set(rx, ry, 0); b.g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
  }

  camera.position.set(...camF.map((f) => f(t)));
  camera.lookAt(...tgtF.map((f) => f(t)));
  composer.render();
  return true;
};
window.ready = true;
