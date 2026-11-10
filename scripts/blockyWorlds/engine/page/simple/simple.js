// Blocky Worlds SIMPLE-STYLE TEST SCENE (2026-11-10, owner: "ART DIRECTION: SIMPLIFY"). A separate test page, not the
// production engine: one small bright town built from boxes, three of our own 6-block characters (head, torso, 2 arms,
// 2 legs, single boxes, no elbows / knees, solid colours, chunky hair), 15 drawn face decals + blink (canvas textures
// swapped on the head), simple poses. Lighting: ONE sun with soft shadows (PCF soft) + a hemisphere sky light; no fog;
// depth of field (BokehPass) on close-ups only; night = deep blue sky + glowing windows + street lamps. Optional mood
// LUT (lib/data/colourGrade.json, the same LUTPass as page/post.js) per shot.
// Lessons from the plastic-look gate kept here: big surfaces matte (roughness 0.9, no env map, nothing mirrors the
// sky), HDR clamped before post (no Inf / NaN glints), bloom only at night and only above emissive levels.
// API (runpod/simpleRole.mjs): window.ready, window.renderShot(spec) -> { data (jpeg data URL), mean, ms },
// window.renderSheet(spec) -> the 15 expressions + blink as one grid image.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";

const TUNE = {
  day: { sun: ["#fff6e6", 3.0], sunDir: [-18, 30, 22], hemi: ["#d6ecff", "#9ccf7a", 1.5], skyTop: "#3f8ef0", skyHor: "#bfe4ff", exposure: 1.0 },
  night: { sun: ["#9bb4ff", 0.7], sunDir: [14, 30, 16], hemi: ["#3b5cb8", "#16223f", 0.8], skyTop: "#071440", skyHor: "#22408a", exposure: 1.0 },
};
const U = 0.34; // one avatar unit in metres (6-block body = 5.2 units + hair ~ 1.85 m)

// ------------------------------------------------------------------------------------------------ renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 900);
const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
// HDR clamp before any post: a glint can never reach Inf / NaN in the half-float targets
const clamp = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = clamp(c.rgb, 0.0, 12.0); if (any(isnan(c.rgb))) c.rgb = vec3(0.0); gl_FragColor = vec4(c.rgb, 1.0); }",
});
composer.addPass(clamp);
const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.012, maxblur: 0.012 });
bokeh.enabled = false;
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 1.4);
bloom.enabled = false;
composer.addPass(bloom);
composer.addPass(new OutputPass());
const lutPass = new LUTPass({ intensity: 1 });
lutPass.enabled = false;
composer.addPass(lutPass);

let GRADE = null;
try { const r = await fetch("/lib/data/colourGrade.json"); if (r.ok) GRADE = await r.json(); } catch { /* no LUT */ }
const LUTS = new Map();
function lutTex(mood) {
  if (LUTS.has(mood)) return LUTS.get(mood);
  const m = GRADE?.moods?.[mood];
  let tex = null;
  if (m?.lut) {
    const N = GRADE.size, bin = atob(m.lut), n = N * N * N, data = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { data[i * 4] = bin.charCodeAt(i * 3); data[i * 4 + 1] = bin.charCodeAt(i * 3 + 1); data[i * 4 + 2] = bin.charCodeAt(i * 3 + 2); data[i * 4 + 3] = 255; }
    tex = new THREE.Data3DTexture(data, N, N, N);
    tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1; tex.needsUpdate = true;
  }
  LUTS.set(mood, tex);
  return tex;
}

// ------------------------------------------------------------------------------------------------ materials
const MATS = new Map();
/** matte for big surfaces (rough 0.9), "plastic" for props / characters (rough 0.55) */
function mat(color, { rough = 0.9, emissive = null, ei = 0, night = null } = {}) {
  const k = `${color}|${rough}|${emissive}|${ei}|${night}`;
  if (!MATS.has(k)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = ei; }
    m.userData.night = night; // { emissive, ei } switched on at night
    MATS.set(k, m);
  }
  return MATS.get(k);
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
function box(parent, [w, h, d], [x, y, z], m, { cast = true, receive = true, rot = null } = {}) {
  const b = new THREE.Mesh(BOX, m);
  b.scale.set(w, h, d); b.position.set(x, y, z);
  if (rot) b.rotation.set(...rot);
  b.castShadow = cast; b.receiveShadow = receive;
  parent.add(b);
  return b;
}
const RB = new Map();
function rbox(parent, [w, h, d], [x, y, z], m, r = 0.05) {
  const k = `${w}|${h}|${d}|${r}`;
  if (!RB.has(k)) RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
  const b = new THREE.Mesh(RB.get(k), m);
  b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true;
  parent.add(b);
  return b;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------------------------------------ sky, ground, clouds
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false,
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = pow(clamp(vP.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(hor, top, t), 1.0); }",
}));
sky.renderOrder = -1;
scene.add(sky);

const town = new THREE.Group();
scene.add(town);
box(town, [600, 0.2, 600], [0, -0.1, 0], mat("#5ccc45"), { cast: false });

// the road along x: asphalt, yellow dashed centre lines (double), white edges, a zebra crossing
const ROAD_W = 7.5;
box(town, [240, 0.06, ROAD_W], [0, 0.02, 0], mat("#4d525b"), { cast: false });
const yellow = mat("#ffcf2e", { rough: 0.7 }), white = mat("#f4f4f2", { rough: 0.8 });
for (let x = -118; x < 118; x += 4.5) { box(town, [2.6, 0.02, 0.14], [x, 0.06, -0.14], yellow, { cast: false }); box(town, [2.6, 0.02, 0.14], [x, 0.06, 0.14], yellow, { cast: false }); }
for (const s of [-1, 1]) box(town, [240, 0.02, 0.16], [0, 0.06, s * (ROAD_W / 2 - 0.35)], white, { cast: false });
for (let i = -3; i <= 3; i++) box(town, [0.6, 0.025, ROAD_W - 1.2], [6 + i * 1.1, 0.065, 0], white, { cast: false });
// sidewalks + curbs
const walk = mat("#d9dce0"), curb = mat("#b8bcc3");
for (const s of [-1, 1]) {
  box(town, [240, 0.18, 3], [0, 0.09, s * (ROAD_W / 2 + 1.5)], walk, { cast: false });
  box(town, [240, 0.2, 0.22], [0, 0.1, s * (ROAD_W / 2 + 0.11)], curb, { cast: false });
  for (let x = -118; x < 118; x += 2.4) box(town, [0.04, 0.005, 3], [x, 0.181, s * (ROAD_W / 2 + 1.5)], curb, { cast: false });
}

// clouds: chunky white box clusters
const cloudM = mat("#ffffff", { rough: 1, emissive: "#ffffff", ei: 0.45 });
function cloud(x, y, z, s) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  for (const [w, h, d, px, py, pz] of [[8, 2.6, 4, 0, 0, 0], [5, 2.4, 3.6, -4.5, -0.3, 0.4], [5.5, 3.2, 3.8, 2.8, 0.9, -0.2], [4, 2, 3, 6, -0.4, 0.3], [3.6, 2.2, 3.2, -1.5, 1.4, 0.2]]) box(g, [w, h, d], [px, py, pz], cloudM, { cast: false, receive: false });
  scene.add(g);
  return g;
}
const clouds = [cloud(-60, 46, -150, 2.2), cloud(40, 58, -190, 2.8), cloud(-20, 38, -110, 1.6), cloud(90, 44, -120, 2), cloud(-120, 60, -60, 2.6), cloud(-90, 40, 40, 2), cloud(10, 52, 160, 2.4), cloud(120, 50, 60, 2.2)];

// ------------------------------------------------------------------------------------------------ houses + shops
const WINDOWS = [];
const glass = () => mat("#8fd3ff", { rough: 0.35, night: { emissive: "#ffc864", ei: 2.6 } });
function windowAt(g, x, y, z, w = 1.3, h = 1.4) {
  const frame = mat("#ffffff", { rough: 0.7 });
  box(g, [w + 0.24, h + 0.24, 0.12], [x, y, z + 0.04], frame, { cast: false });
  const gl = box(g, [w, h, 0.1], [x, y, z + 0.09], glass(), { cast: false });
  WINDOWS.push(gl);
  box(g, [0.09, h, 0.06], [x, y, z + 0.16], frame, { cast: false });
  box(g, [w, 0.09, 0.06], [x, y, z + 0.16], frame, { cast: false });
  box(g, [w + 0.5, 0.12, 0.3], [x, y - h / 2 - 0.16, z + 0.15], frame, { cast: false }); // sill
}
function doorAt(g, x, z, color, { w = 1.25, h = 2.35 } = {}) {
  const frame = mat("#ffffff", { rough: 0.7 });
  box(g, [w + 0.3, h + 0.2, 0.12], [x, h / 2 + 0.05, z + 0.04], frame, { cast: false });
  box(g, [w, h, 0.14], [x, h / 2, z + 0.08], mat(color, { rough: 0.6 }), { cast: false });
  box(g, [w - 0.36, 0.5, 0.05], [x, h - 0.45, z + 0.16], glass(), { cast: false });
  box(g, [0.12, 0.12, 0.12], [x + w / 2 - 0.22, h / 2, z + 0.2], mat("#ffd23a", { rough: 0.4 }), { cast: false });
  box(g, [w + 0.9, 0.16, 0.9], [x, 0.08, z + 0.5], mat("#c9ccd2"), { cast: false }); // step
}
function gableRoof(g, w, d, y, color, over = 0.45) {
  const hh = d * 0.38;
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - over, 0), new THREE.Vector2(d / 2 + over, 0), new THREE.Vector2(0, hh + over * 0.4)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + over * 2, bevelEnabled: false });
  geo.translate(0, 0, -(w + over * 2) / 2);
  const m = new THREE.Mesh(geo, mat(color, { rough: 0.85 }));
  m.rotation.y = Math.PI / 2; m.position.y = y; m.castShadow = m.receiveShadow = true;
  g.add(m);
  // the gable ends in the wall colour would need a second shape: a darker fascia strip reads cleaner
  return m;
}
function sign(g, text, [x, y, z], { w = 4, h = 0.95, bg = "#ffffff", fg = "#1f2a44", border = "#1f2a44" } = {}) {
  const tex = canvasTex(1024, Math.round(1024 * h / w), (c, W, H) => {
    c.fillStyle = border; c.fillRect(0, 0, W, H);
    c.fillStyle = bg; c.fillRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
    c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `900 ${Math.round(H * 0.62)}px "Arial Black", "Arial", sans-serif`;
    c.fillText(text, W / 2, H * 0.54);
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  m.userData.night = { emissive: "#ffffff", ei: 0.5, emissiveMap: tex };
  const b = new THREE.Mesh(BOX, [mat(border), mat(border), mat(border), mat(border), m, mat(border)]);
  b.scale.set(w, h, 0.18); b.position.set(x, y, z); b.castShadow = true;
  g.add(b);
  return b;
}
function awning(g, x, y, z, w, c1, c2) {
  const tex = canvasTex(512, 64, (c, W, H) => { const n = 10; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect((i * W) / n, 0, W / n + 1, H); } });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const a = new THREE.Mesh(BOX, m); a.scale.set(w, 0.12, 1.6); a.position.set(x, y, z + 0.75); a.rotation.x = 0.32; a.castShadow = true;
  g.add(a);
  const val = new THREE.Mesh(BOX, m); val.scale.set(w, 0.35, 0.06); val.position.set(x, y - 0.42, z + 1.52); g.add(val);
}

/** a house: front at local z = +d/2, faces +z; the group is placed + turned by the caller */
function house(x, z, face, { w = 7, d = 7, floors = 2, wall = "#ffd36b", roof = "#d9534f", door = "#3a7bd5", flat = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; town.add(g);
  const H = floors * 3.1 + 0.3;
  box(g, [w, H, d], [0, H / 2, 0], mat(wall));
  box(g, [w + 0.2, 0.3, d + 0.2], [0, 0.15, 0], mat("#e9e4da")); // foundation
  const fz = d / 2;
  if (flat) { box(g, [w + 0.3, 0.5, d + 0.3], [0, H + 0.25, 0], mat(roof)); }
  else { box(g, [w + 0.25, 0.25, d + 0.25], [0, H, 0], mat("#ffffff", { rough: 0.8 })); gableRoof(g, w, d, H + 0.1, roof); }
  doorAt(g, -w * 0.18, fz, door);
  windowAt(g, w * 0.24, 1.75, fz);
  for (let f = 1; f < floors; f++) { windowAt(g, -w * 0.22, 1.75 + f * 3.1, fz); windowAt(g, w * 0.24, 1.75 + f * 3.1, fz); }
  // path to the sidewalk
  box(g, [1.6, 0.05, 3.2], [-w * 0.18, 0.03, fz + 1.9], mat("#cfd2d6"), { cast: false });
  return { g, H, fz, w };
}

const HOUSES = [];
const FRONT = -10.5; // north row front line (z), south row mirrored
// north row (faces +z): the camera side of most shots
const PALETTE = [
  { wall: "#ffd36b", roof: "#e0524a", door: "#2f78d8" },
  { wall: "#8fd0ff", roof: "#3b5b9a", door: "#ffb02e" },
  { wall: "#ff9fb8", roof: "#7a4bb3", door: "#ffffff" },
  { wall: "#b6f08a", roof: "#c0472f", door: "#7a3fd1" },
  { wall: "#ffffff", roof: "#2f9e8f", door: "#e04848" },
  { wall: "#ffb26b", roof: "#4b5fc9", door: "#2fa86b" },
];
const north = [[-34, 0], [-22, 1], [-10, 2], [14, 3], [38, 5]];
for (const [x, p] of north) HOUSES.push(house(x, FRONT - 3.5, 0, PALETTE[p]));
// BAKERY (x = 2): pink, striped awning, big shop window
{
  const b = house(2, FRONT - 3.5, 0, { w: 8, d: 7, floors: 2, wall: "#ff8fb1", roof: "#8a4fd0", door: "#ffffff", flat: true });
  box(b.g, [3.2, 1.9, 0.1], [1.9, 1.55, b.fz + 0.06], mat("#ffffff"), { cast: false });
  const shop = box(b.g, [2.9, 1.6, 0.1], [1.9, 1.55, b.fz + 0.1], glass(), { cast: false }); WINDOWS.push(shop);
  awning(b.g, 0.4, 3.15, b.fz, 6.4, "#ffffff", "#ff4f7d");
  sign(b.g, "BAKERY", [0, 5.55, b.fz + 0.12], { w: 5.2, h: 1.15, bg: "#fff6e8", fg: "#d6336c", border: "#7a2a4a" });
}
// SCHOOL (x = 26): wide, brick red, flat roof, white sign, a little bell tower
{
  const s = house(26, FRONT - 5, 0, { w: 14, d: 10, floors: 2, wall: "#e2553f", roof: "#f1efe9", door: "#2f6fd6", flat: true });
  for (const wx of [-5, 3.8, 5.8]) windowAt(s.g, wx, 1.75, s.fz);
  for (const wx of [-5, -3, 1, 3.8, 5.8]) windowAt(s.g, wx, 4.85, s.fz);
  sign(s.g, "SCHOOL", [0, 7.1, s.fz + 0.12], { w: 6.4, h: 1.3, bg: "#ffffff", fg: "#1f4fbf", border: "#1f2a44" });
  box(s.g, [3, 2.6, 3], [0, s.H + 1.8, -1], mat("#f1efe9")); box(s.g, [3.6, 0.4, 3.6], [0, s.H + 3.3, -1], mat("#2f6fd6"));
  box(s.g, [1.1, 1.1, 0.1], [0, s.H + 1.9, 0.55], mat("#ffd23a", { rough: 0.5 }));
}
// south row (faces -z, behind the camera in the street shots; seen in the wides)
const south = [[-30, 4], [-18, 5], [-6, 0], [6, 1], [18, 2], [30, 3]];
for (const [x, p] of south) HOUSES.push(house(x, -(FRONT - 3.5), Math.PI, PALETTE[p]));

// fences + hedges between the north front yards (low, bright)
const hedge = mat("#3fae3a");
for (const x of [-28, -16, -4, 8, 20, 32]) box(town, [0.9, 0.9, 3.4], [x, 0.45, FRONT + 1.6], hedge);

// ------------------------------------------------------------------------------------------------ trees + lamps
const leaf = [mat("#43b83a"), mat("#58cc45"), mat("#36a332")], trunk = mat("#8a5a34");
function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = (x * 13.37 + z) % Math.PI; town.add(g);
  box(g, [0.55, 2.4, 0.55], [0, 1.2, 0], trunk);
  // a round blocky crown: a big cube + six smaller cubes poking out of its faces
  rbox(g, [2.8, 2.6, 2.8], [0, 3.6, 0], leaf[1], 0.18);
  for (const [px, py, pz, k] of [[1.3, 3.4, 0, 0], [-1.3, 3.5, 0, 2], [0, 3.3, 1.3, 2], [0, 3.6, -1.3, 0], [0.2, 4.9, 0.1, 1], [0.8, 4.3, 0.8, 0]]) rbox(g, [1.7, 1.6, 1.7], [px, py, pz], leaf[k], 0.16);
}
for (const x of [-40, -28, -16, -4, 8, 20, 46]) tree(x, FRONT - 1.2, 0.95 + ((x * 7) % 3) * 0.05);
for (const x of [-36, -24, -12, 0, 12, 24, 36]) tree(x, -(FRONT - 1.2), 1);
for (let i = 0; i < 70; i++) { const a = i * 2.39996, r = 38 + (i % 9) * 6; tree(Math.cos(a) * r * 1.4, -22 - Math.abs(Math.sin(a)) * 40 - (i % 5) * 3, 1.1); tree(Math.cos(a + 1) * r * 1.4, 22 + Math.abs(Math.sin(a)) * 40 + (i % 4) * 3, 1.1); }

const LAMPS = [];
const pole = mat("#3a3f4a", { rough: 0.6 }), bulbM = mat("#fff4c8", { rough: 0.5, night: { emissive: "#ffe9a8", ei: 6 } });
function lamp(x, z, face) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; town.add(g);
  box(g, [0.5, 0.3, 0.5], [0, 0.15, 0], pole);
  box(g, [0.18, 4.6, 0.18], [0, 2.4, 0], pole);
  box(g, [0.14, 0.14, 1.3], [0, 4.6, 0.55], pole);
  box(g, [0.75, 0.3, 0.75], [0, 4.5, 1.15], pole);
  box(g, [0.55, 0.16, 0.55], [0, 4.3, 1.15], bulbM, { cast: false });
  LAMPS.push(new THREE.Vector3(x + Math.sin(face) * 1.15, 4.1, z + Math.cos(face) * 1.15));
}
for (let x = -42; x <= 42; x += 14) { lamp(x + 3, -(ROAD_W / 2 + 0.6), 0); lamp(x - 4, ROAD_W / 2 + 0.6, Math.PI); }
// a red mailbox, a bench, a fire hydrant: small props for scale
box(town, [0.5, 0.6, 0.8], [-9, 1.3, FRONT + 0.4], mat("#e23b3b", { rough: 0.5 })); box(town, [0.12, 1.0, 0.12], [-9, 0.5, FRONT + 0.4], pole);
{ const b = new THREE.Group(); b.position.set(-5.5, 0.18, -(ROAD_W / 2 + 2.6)); town.add(b); box(b, [2.4, 0.15, 0.7], [0, 0.55, 0], mat("#c47a3d", { rough: 0.7 })); box(b, [2.4, 0.6, 0.12], [0, 0.95, -0.33], mat("#c47a3d", { rough: 0.7 })); for (const s of [-1, 1]) box(b, [0.12, 0.55, 0.6], [s * 1.0, 0.27, 0], pole); }
box(town, [0.45, 0.8, 0.45], [9.5, 0.58, -(ROAD_W / 2 + 0.7)], mat("#ffcc22", { rough: 0.5 }));

// ------------------------------------------------------------------------------------------------ lights
const hemi = new THREE.HemisphereLight("#ffffff", "#ffffff", 1); scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffffff", 1);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
scene.add(sun, sun.target);
const POINTS = Array.from({ length: 8 }, () => { const p = new THREE.PointLight("#ffd98a", 0, 16, 1.6); scene.add(p); return p; });

function setLight(name, focus = new THREE.Vector3()) {
  const T = TUNE[name] ?? TUNE.day, night = name === "night";
  skyU.top.value.set(T.skyTop); skyU.hor.value.set(T.skyHor);
  hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
  sun.color.set(T.sun[0]); sun.intensity = T.sun[1];
  sun.target.position.copy(focus); sun.position.copy(focus).add(new THREE.Vector3(...T.sunDir).normalize().multiplyScalar(70));
  sun.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = T.exposure;
  for (const m of [...MATS.values(), ...signMats()]) {
    const n = m.userData.night;
    if (!n) continue;
    if (m.userData.day === undefined) m.userData.day = { emissive: m.emissive.getHex(), ei: m.emissiveIntensity, map: m.emissiveMap };
    if (night) { m.emissive.set(n.emissive); m.emissiveIntensity = n.ei; if (n.emissiveMap) m.emissiveMap = n.emissiveMap; }
    else { m.emissive.setHex(m.userData.day.emissive); m.emissiveIntensity = m.userData.day.ei; m.emissiveMap = m.userData.day.map; }
    m.needsUpdate = true;
  }
  cloudM.emissiveIntensity = night ? 0.03 : 0.45; cloudM.color.set(night ? "#5a6ea8" : "#ffffff");
  // the nearest street lamps light up at night
  const near = [...LAMPS].sort((a, b) => a.distanceToSquared(focus) - b.distanceToSquared(focus));
  POINTS.forEach((p, i) => { p.intensity = night && near[i] ? 22 : 0; if (near[i]) p.position.copy(near[i]); });
  bloom.enabled = night; bloom.threshold = 1.4; bloom.strength = 0.6;
}
function signMats() { const out = []; town.traverse((o) => { if (o.isMesh && Array.isArray(o.material)) out.push(...o.material.filter((m) => m.userData.night && !MATS.has(m))); }); return out; }

// ------------------------------------------------------------------------------------------------ faces (our own design)
// Bold simple decals: chunky black brows, black rounded eyes with two white shines, filled mouths with a tongue /
// teeth. Not the classic default face (that is two plain ovals + a thin smile line): ours always has brows and shines.
const INK = "#1b1b22", MOUTH = "#5a1a22", TONGUE = "#ff7d8e", TEETH = "#ffffff";
const EXPR = {
  neutral:   { eyes: "open", brows: [0, 0, 0], mouth: "flat" },
  happy:     { eyes: "open", brows: [-0.1, -0.1, -0.05], mouth: "smile" },
  grin:      { eyes: "happy", brows: [-0.15, -0.15, -0.08], mouth: "grin" },
  laugh:     { eyes: "squint", brows: [-0.2, -0.2, -0.1], mouth: "laugh" },
  sad:       { eyes: "open", brows: [0.45, 0.45, 0.02], mouth: "frown", small: true },
  crying:    { eyes: "closedSad", brows: [0.5, 0.5, 0], mouth: "wail", tears: true },
  angry:     { eyes: "open", brows: [-0.55, -0.55, 0.12], mouth: "teeth" },
  surprised: { eyes: "wide", brows: [0.15, 0.15, -0.22], mouth: "o" },
  shocked:   { eyes: "tiny", brows: [0.1, 0.1, -0.3], mouth: "bigO" },
  scared:    { eyes: "wide", brows: [0.55, 0.55, -0.14], mouth: "wavy", sweat: true },
  smirk:     { eyes: "half", brows: [-0.2, 0.25, 0], mouth: "smirk" },
  wink:      { eyes: "wink", brows: [-0.1, 0.1, -0.05], mouth: "grin" },
  thinking:  { eyes: "side", brows: [0.3, -0.1, -0.06], mouth: "side" },
  sleepy:    { eyes: "sleepy", brows: [0.1, 0.1, 0.08], mouth: "smallO", zzz: true },
  worried:   { eyes: "open", brows: [0.4, 0.4, -0.05], mouth: "wavy", small: true, sweat: true },
};
export const EXPRESSIONS = Object.keys(EXPR);

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); }
function drawFace(c, S, name, blink) {
  const e = EXPR[name] ?? EXPR.neutral;
  c.clearRect(0, 0, S, S);
  c.lineCap = "round"; c.lineJoin = "round";
  const ex = S * 0.2, ey = S * 0.44; // eye offsets from centre, eye height
  const eye = (side) => {
    const x = S / 2 + side * ex, y = ey;
    let kind = blink ? "closed" : e.eyes;
    if (kind === "wink") kind = side < 0 ? "open" : "happy";
    c.fillStyle = INK; c.strokeStyle = INK;
    if (kind === "open" || kind === "side" || kind === "half") {
      rr(c, x, y, S * 0.1, S * 0.17, S * 0.05); c.fill();
      c.fillStyle = "#fff"; const off = kind === "side" ? S * 0.022 : 0;
      c.beginPath(); c.arc(x + S * 0.018 + off, y - S * 0.04, S * 0.022, 0, 7); c.fill();
      c.beginPath(); c.arc(x - S * 0.015 + off, y + S * 0.035, S * 0.01, 0, 7); c.fill();
      if (kind === "half") { c.fillStyle = "rgba(0,0,0,0)"; c.globalCompositeOperation = "destination-out"; c.fillRect(x - S * 0.07, y - S * 0.1, S * 0.14, S * 0.08); c.globalCompositeOperation = "source-over"; c.fillStyle = INK; c.fillRect(x - S * 0.065, y - S * 0.03, S * 0.13, S * 0.025); }
    } else if (kind === "wide") {
      c.fillStyle = "#fff"; c.lineWidth = S * 0.025; c.beginPath(); c.ellipse(x, y, S * 0.075, S * 0.095, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x, y + S * 0.01, S * 0.035, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x + S * 0.012, y - S * 0.004, S * 0.011, 0, 7); c.fill();
    } else if (kind === "tiny") {
      c.fillStyle = "#fff"; c.lineWidth = S * 0.022; c.beginPath(); c.arc(x, y, S * 0.08, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x, y, S * 0.018, 0, 7); c.fill();
    } else if (kind === "happy" || kind === "squint") {
      c.lineWidth = S * 0.035; c.beginPath();
      if (kind === "happy") c.arc(x, y + S * 0.03, S * 0.055, Math.PI * 1.1, Math.PI * 1.9);
      else { c.moveTo(x - side * S * 0.06, y - S * 0.04); c.lineTo(x + side * S * 0.04, y); c.lineTo(x - side * S * 0.06, y + S * 0.04); }
      c.stroke();
    } else if (kind === "closedSad") {
      c.lineWidth = S * 0.032; c.beginPath(); c.arc(x, y - S * 0.03, S * 0.055, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    } else if (kind === "sleepy") {
      c.lineWidth = S * 0.03; c.beginPath(); c.moveTo(x - S * 0.06, y + S * 0.01); c.lineTo(x + S * 0.06, y + S * 0.01); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(x, y + S * 0.025, S * 0.045, S * 0.022, 0, 0, Math.PI); c.fill();
    } else { // closed (blink)
      c.lineWidth = S * 0.032; c.beginPath(); c.arc(x, y - S * 0.012, S * 0.055, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
    }
  };
  eye(-1); eye(1);
  // brows: thick rounded bars; angle > 0 lifts the inner end (sad / worried), < 0 drops it (angry)
  c.strokeStyle = INK; c.lineWidth = S * 0.042;
  for (const side of [-1, 1]) {
    const a = e.brows[side < 0 ? 0 : 1], x = S / 2 + side * ex, y = ey - S * 0.15 + e.brows[2] * S * 0.25;
    const dx = S * 0.065, L = Math.sin(a) * S * 0.05; // inner end (towards the nose) up by L, outer end down by L
    c.beginPath(); c.moveTo(x - side * dx, y - L); c.lineTo(x + side * dx, y + L); c.stroke();
  }
  // mouths
  const mx = S / 2, my = S * 0.72, k = e.small ? 0.75 : 1;
  c.lineWidth = S * 0.03; c.strokeStyle = INK; c.fillStyle = MOUTH;
  const tongue = (cx, cy, w, h) => { c.save(); c.clip(); c.fillStyle = TONGUE; c.beginPath(); c.ellipse(cx, cy, w, h, 0, 0, 7); c.fill(); c.restore(); };
  switch (e.mouth) {
    case "flat": c.beginPath(); c.moveTo(mx - S * 0.07, my); c.lineTo(mx + S * 0.07, my); c.stroke(); break;
    case "smile": c.beginPath(); c.arc(mx, my - S * 0.07, S * 0.1 * k, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); break;
    case "grin": c.beginPath(); c.moveTo(mx - S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx, my - S * 0.02, mx + S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx + S * 0.1, my + S * 0.12, mx, my + S * 0.12); c.quadraticCurveTo(mx - S * 0.1, my + S * 0.12, mx - S * 0.13, my - S * 0.04); c.closePath(); c.fill(); tongue(mx, my + S * 0.12, S * 0.07, S * 0.05); c.fillStyle = TEETH; c.fillRect(mx - S * 0.1, my - S * 0.035, S * 0.2, S * 0.03); c.beginPath(); c.moveTo(mx - S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx, my - S * 0.02, mx + S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx + S * 0.1, my + S * 0.12, mx, my + S * 0.12); c.quadraticCurveTo(mx - S * 0.1, my + S * 0.12, mx - S * 0.13, my - S * 0.04); c.stroke(); break;
    case "laugh": c.beginPath(); c.ellipse(mx, my + S * 0.01, S * 0.13, S * 0.12, 0, 0, Math.PI); c.closePath(); c.fill(); tongue(mx, my + S * 0.11, S * 0.08, S * 0.05); c.beginPath(); c.ellipse(mx, my + S * 0.01, S * 0.13, S * 0.12, 0, 0, Math.PI); c.closePath(); c.stroke(); break;
    case "frown": c.beginPath(); c.arc(mx, my + S * 0.08, S * 0.09 * k, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); break;
    case "wail": c.beginPath(); c.moveTo(mx - S * 0.1, my + S * 0.09); c.quadraticCurveTo(mx, my - S * 0.08, mx + S * 0.1, my + S * 0.09); c.closePath(); c.fill(); c.stroke(); break;
    case "teeth": rr(c, mx, my + S * 0.02, S * 0.22, S * 0.09, S * 0.03); c.fillStyle = TEETH; c.fill(); c.stroke(); c.lineWidth = S * 0.015; c.beginPath(); c.moveTo(mx - S * 0.1, my + S * 0.02); c.lineTo(mx + S * 0.1, my + S * 0.02); for (let i = -2; i <= 2; i++) { c.moveTo(mx + i * S * 0.037, my - S * 0.02); c.lineTo(mx + i * S * 0.037, my + S * 0.06); } c.stroke(); break;
    case "o": c.beginPath(); c.ellipse(mx, my + S * 0.02, S * 0.05, S * 0.065, 0, 0, 7); c.fill(); c.stroke(); break;
    case "bigO": c.beginPath(); c.ellipse(mx, my + S * 0.03, S * 0.075, S * 0.1, 0, 0, 7); c.fill(); tongue(mx, my + S * 0.11, S * 0.05, S * 0.035); c.beginPath(); c.ellipse(mx, my + S * 0.03, S * 0.075, S * 0.1, 0, 0, 7); c.stroke(); break;
    case "smallO": c.beginPath(); c.ellipse(mx + S * 0.02, my + S * 0.02, S * 0.03, S * 0.035, 0, 0, 7); c.fill(); c.stroke(); break;
    case "wavy": { const w = S * 0.13 * k; c.beginPath(); for (let i = 0; i <= 8; i++) { const x = mx - w + (i * 2 * w) / 8, y = my + S * 0.02 + (i % 2 ? -1 : 1) * S * 0.018; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); break; }
    case "smirk": c.beginPath(); c.moveTo(mx - S * 0.08, my + S * 0.02); c.quadraticCurveTo(mx + S * 0.04, my + S * 0.04, mx + S * 0.1, my - S * 0.04); c.stroke(); break;
    case "side": c.beginPath(); c.moveTo(mx - S * 0.02, my + S * 0.03); c.lineTo(mx + S * 0.09, my + S * 0.0); c.stroke(); break;
    default: break;
  }
  if (e.tears) { c.fillStyle = "#5ec8ff"; for (const side of [-1, 1]) { c.beginPath(); c.roundRect(S / 2 + side * ex - S * 0.025, ey + S * 0.02, S * 0.05, S * 0.2, S * 0.025); c.fill(); } }
  if (e.sweat) { c.fillStyle = "#7fd4ff"; c.strokeStyle = INK; c.lineWidth = S * 0.012; c.beginPath(); c.moveTo(S * 0.83, S * 0.2); c.quadraticCurveTo(S * 0.88, S * 0.3, S * 0.83, S * 0.32); c.quadraticCurveTo(S * 0.78, S * 0.3, S * 0.83, S * 0.2); c.fill(); c.stroke(); }
  if (e.zzz) { c.fillStyle = INK; c.font = `900 ${Math.round(S * 0.1)}px Arial`; c.fillText("z", S * 0.78, S * 0.2); c.font = `900 ${Math.round(S * 0.07)}px Arial`; c.fillText("z", S * 0.86, S * 0.12); }
  if (name === "happy" || name === "grin" || name === "laugh") { c.fillStyle = "rgba(255,110,130,0.35)"; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(S / 2 + side * S * 0.3, S * 0.6, S * 0.06, S * 0.035, 0, 0, 7); c.fill(); } }
}
const FACE_TEX = new Map();
function faceTex(name, blink) {
  const k = `${name}|${blink ? 1 : 0}`;
  if (!FACE_TEX.has(k)) FACE_TEX.set(k, canvasTex(512, 512, (c, S) => drawFace(c, S, name, blink)));
  return FACE_TEX.get(k);
}

// ------------------------------------------------------------------------------------------------ the 6-block avatar
const CHARS = {
  pip:  { skin: "#f5c89a", shirt: "#ff8a1f", pants: "#2f4ea3", shoes: "#2b2b33", hair: "#6b3d1f", style: "fringe", extra: "pocket" },
  juno: { skin: "#a8673f", shirt: "#18b5a8", pants: "#6a3fb8", shoes: "#ffffff", hair: "#1e1a1f", style: "buns", extra: "star" },
  bram: { skin: "#ffd9b8", shirt: "#3fae4a", pants: "#c9a36a", shoes: "#5a3a22", hair: "#e0552b", style: "cap", cap: "#ffd23a", extra: "zip" },
};
function avatar(id) {
  const D = CHARS[id], root = new THREE.Group(); root.name = id;
  const body = new THREE.Group(); root.add(body);
  const shirt = mat(D.shirt, { rough: 0.55 }), pants = mat(D.pants, { rough: 0.6 }), skin = mat(D.skin, { rough: 0.5 }), shoe = mat(D.shoes, { rough: 0.5 }), hair = mat(D.hair, { rough: 0.6 });
  const u = U, r = 0.035;
  // legs: pivot at the hip
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.5 * u, 2 * u, 0); body.add(p); rbox(p, [0.98 * u, 1.72 * u, 0.98 * u], [0, -0.86 * u, 0], pants, r); rbox(p, [1.0 * u, 0.32 * u, 1.04 * u], [0, -1.84 * u, 0.02 * u], shoe, r); return p; });
  // torso
  const torso = rbox(body, [2 * u, 2 * u, 1 * u], [0, 3 * u, 0], shirt, r);
  if (D.extra === "pocket") rbox(body, [1.1 * u, 0.5 * u, 0.06 * u], [0, 2.45 * u, 0.52 * u], mat("#e2721a", { rough: 0.55 }), 0.01);
  if (D.extra === "zip") { box(body, [0.08 * u, 1.9 * u, 0.04 * u], [0, 3 * u, 0.51 * u], mat("#2b2b33", { rough: 0.5 }), { cast: false }); box(body, [2.02 * u, 0.22 * u, 1.02 * u], [0, 2.1 * u, 0], mat("#2b2b33", { rough: 0.5 })); }
  if (D.extra === "star") {
    const t = canvasTex(256, 256, (c, S) => { c.fillStyle = "#ffd23a"; c.strokeStyle = "#1b1b22"; c.lineWidth = 10; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? S * 0.2 : S * 0.45; c.lineTo(S / 2 + Math.cos(a) * rr2, S / 2 + Math.sin(a) * rr2); } c.closePath(); c.fill(); c.stroke(); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0 * u, 1.0 * u), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }));
    m.position.set(0, 3.1 * u, 0.505 * u); body.add(m);
  }
  // arms: pivot at the shoulder; shirt sleeve box + the hand as its lower end (still one straight limb)
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 1.5 * u, 3.85 * u, 0); body.add(p); rbox(p, [0.98 * u, 1.45 * u, 0.98 * u], [0, -0.62 * u, 0], shirt, r); rbox(p, [0.94 * u, 0.55 * u, 0.94 * u], [0, -1.6 * u, 0], skin, r); return p; });
  // head + face decal + hair
  const head = new THREE.Group(); head.position.set(0, 4.05 * u, 0); body.add(head);
  rbox(head, [1.25 * u, 1.2 * u, 1.2 * u], [0, 0.62 * u, 0], skin, 0.08 * u);
  // lit like the skin (a basic material would glow at night): MeshStandard with the decal as map
  const faceL = new THREE.MeshStandardMaterial({ map: faceTex("neutral", false), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.12 * u, 1.12 * u), faceL); face.position.set(0, 0.6 * u, 0.603 * u); face.renderOrder = 2; head.add(face);
  if (D.style === "fringe") {
    rbox(head, [1.4 * u, 0.42 * u, 1.36 * u], [0, 1.32 * u, -0.02 * u], hair, 0.06 * u);
    rbox(head, [1.4 * u, 1.0 * u, 0.3 * u], [0, 0.9 * u, -0.58 * u], hair, 0.05 * u);
    for (const [x, w, h] of [[-0.45, 0.5, 0.42], [0.02, 0.55, 0.32], [0.46, 0.46, 0.48]]) rbox(head, [w * u, h * u, 0.3 * u], [x * u, (1.18 - h / 2 + 0.05) * u, 0.56 * u], hair, 0.05 * u);
    for (const s of [-1, 1]) rbox(head, [0.22 * u, 0.7 * u, 1.1 * u], [s * 0.66 * u, 0.98 * u, -0.06 * u], hair, 0.04 * u);
    for (const [x, z, rz] of [[-0.3, 0.1, 0.4], [0.25, -0.2, -0.3], [0.05, 0.35, 0.1]]) { const t = rbox(head, [0.5 * u, 0.4 * u, 0.5 * u], [x * u, 1.55 * u, z * u], hair, 0.05 * u); t.rotation.z = rz; }
  } else if (D.style === "buns") {
    rbox(head, [1.38 * u, 0.36 * u, 1.36 * u], [0, 1.3 * u, -0.02 * u], hair, 0.06 * u);
    rbox(head, [1.38 * u, 1.05 * u, 0.32 * u], [0, 0.85 * u, -0.6 * u], hair, 0.05 * u);
    rbox(head, [1.3 * u, 0.22 * u, 0.3 * u], [0, 1.12 * u, 0.56 * u], hair, 0.04 * u);
    for (const s of [-1, 1]) { rbox(head, [0.7 * u, 0.7 * u, 0.7 * u], [s * 0.52 * u, 1.72 * u, -0.15 * u], hair, 0.12 * u); rbox(head, [0.2 * u, 0.75 * u, 1.0 * u], [s * 0.66 * u, 0.95 * u, -0.1 * u], hair, 0.04 * u); }
    rbox(head, [0.5 * u, 0.14 * u, 0.5 * u], [0.52 * u, 2.1 * u, -0.15 * u], mat("#ff5ca8", { rough: 0.5 }), 0.04 * u);
  } else if (D.style === "cap") {
    const capM = mat(D.cap, { rough: 0.55 });
    for (const s of [-1, 1]) rbox(head, [0.24 * u, 0.6 * u, 0.9 * u], [s * 0.66 * u, 0.95 * u, -0.1 * u], hair, 0.04 * u);
    rbox(head, [1.3 * u, 0.5 * u, 0.3 * u], [0, 0.95 * u, -0.6 * u], hair, 0.05 * u);
    rbox(head, [1.42 * u, 0.5 * u, 1.38 * u], [0, 1.36 * u, -0.02 * u], capM, 0.08 * u);
    rbox(head, [1.3 * u, 0.12 * u, 0.7 * u], [0, 1.16 * u, 0.85 * u], capM, 0.04 * u);
    rbox(head, [0.3 * u, 0.16 * u, 0.3 * u], [0, 1.66 * u, 0], mat("#e04848", { rough: 0.5 }), 0.05 * u);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  face.castShadow = false;
  const api = {
    root, body, head, arms, legs, faceMat: faceL,
    setFace(name, blink = false) { faceL.map = faceTex(name, blink); faceL.needsUpdate = true; },
    pose(name) {
      const [R, L] = arms, [RL, LL] = legs; // index 0 = x < 0 = the avatar's right (it faces +z)
      for (const p of [R, L, RL, LL, head, body]) p.rotation.set(0, 0, 0);
      body.position.y = 0;
      const P = {
        idle: () => { R.rotation.z = -0.07; L.rotation.z = 0.07; },
        wave: () => { R.rotation.set(-0.15, 0, -2.65); L.rotation.z = 0.07; head.rotation.z = 0.08; },
        walk: () => { RL.rotation.x = 0.5; LL.rotation.x = -0.5; R.rotation.x = -0.45; L.rotation.x = 0.45; },
        point: () => { R.rotation.set(-1.55, 0, -0.12); L.rotation.z = 0.07; head.rotation.y = -0.1; },
        cheer: () => { R.rotation.set(-0.2, 0, -2.75); L.rotation.set(-0.2, 0, 2.75); body.position.y = 0.06; head.rotation.x = -0.12; },
        scared: () => { R.rotation.set(-2.25, 0, 0.45); L.rotation.set(-2.25, 0, -0.45); body.rotation.x = -0.08; head.rotation.x = 0.05; },
        talk: () => { R.rotation.set(-0.7, 0, -0.35); L.rotation.z = 0.07; head.rotation.z = -0.05; },
        shrug: () => { R.rotation.set(-0.5, 0, -0.9); L.rotation.set(-0.5, 0, 0.9); head.rotation.z = 0.12; },
      };
      (P[name] ?? P.idle)();
    },
  };
  api.pose("idle");
  return api;
}
const AV = Object.fromEntries(Object.keys(CHARS).map((id) => [id, avatar(id)]));
for (const a of Object.values(AV)) { a.root.visible = false; scene.add(a.root); }

// ------------------------------------------------------------------------------------------------ shots
const v3 = (a) => new THREE.Vector3(...a);
function frameData(q = 0.9) { return renderer.domElement.toDataURL("image/jpeg", q); }
function meanOf() {
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const x = c.getContext("2d"); x.drawImage(renderer.domElement, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return +(s / (d.length / 4)).toFixed(1);
}
function setSize(w, h) {
  renderer.setSize(w, h, false); composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
/**
 * spec: { w, h, light: "day"|"night", cam: [x,y,z], look: [x,y,z], fov, dof: { focus?, aperture?, maxblur? } | null,
 *         chars: [{ id, at: [x,z], rot, pose, face, blink }], lut: false | "day" | "night" }
 */
function setup(spec) {
  setSize(spec.w ?? 1080, spec.h ?? 1920);
  for (const a of Object.values(AV)) a.root.visible = false;
  for (const c of spec.chars ?? []) {
    const a = AV[c.id]; if (!a) continue;
    a.root.visible = true; a.root.position.set(c.at[0], 0.18 + (c.y ?? 0), c.at[1]); a.root.rotation.y = c.rot ?? 0;
    a.pose(c.pose ?? "idle"); a.setFace(c.face ?? "neutral", !!c.blink);
  }
  camera.fov = spec.fov ?? 40; camera.position.copy(v3(spec.cam)); camera.lookAt(v3(spec.look)); camera.updateProjectionMatrix();
  const focus = v3(spec.look); focus.y = 0;
  setLight(spec.light ?? "day", spec.shadowAt ? v3(spec.shadowAt) : focus);
  // shadow box size: tight around close shots (sharper), wide for the wides
  const S = spec.shadowSize ?? 40; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S }); sun.shadow.camera.updateProjectionMatrix();
  bokeh.enabled = !!spec.dof;
  if (spec.dof) {
    const f = spec.dof.focus ?? camera.position.distanceTo(v3(spec.look));
    bokeh.uniforms.focus.value = f; bokeh.uniforms.aperture.value = spec.dof.aperture ?? 0.005; bokeh.uniforms.maxblur.value = spec.dof.maxblur ?? 0.012;
    bokeh.uniforms.aspect.value = camera.aspect;
  }
  const tex = spec.lut ? lutTex(spec.lut) : null;
  lutPass.enabled = !!tex; if (tex) lutPass.lut = tex;
}
window.renderShot = (spec) => {
  const t0 = performance.now();
  setup(spec);
  composer.render(); composer.render(); // the second pass: shadows + bokeh depth settled
  return { data: frameData(spec.quality ?? 0.9), mean: meanOf(), ms: Math.round(performance.now() - t0), lut: lutPass.enabled };
};
/** the expression sheet: one close-up per expression (+ blink) in a grid -> one jpeg */
window.renderSheet = (spec) => {
  const t0 = performance.now(), names = [...EXPRESSIONS, "blink"], cols = spec.cols ?? 4, cw = spec.cell ?? 400, ch = Math.round(cw * 1.25);
  const rows = Math.ceil(names.length / cols), out = document.createElement("canvas"); out.width = cols * cw; out.height = rows * (ch + 44);
  const x = out.getContext("2d"); x.fillStyle = "#14161c"; x.fillRect(0, 0, out.width, out.height);
  names.forEach((n, i) => {
    const c = { ...spec.char, face: n === "blink" ? "neutral" : n, blink: n === "blink", pose: spec.char.pose ?? "idle" };
    setup({ ...spec, w: cw, h: ch, chars: [c] });
    composer.render(); composer.render();
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * (ch + 44);
    x.drawImage(renderer.domElement, cx, cy);
    x.fillStyle = "#ffffff"; x.font = "700 26px Arial"; x.textAlign = "center"; x.fillText(n, cx + cw / 2, cy + ch + 31);
  });
  return { data: out.toDataURL("image/jpeg", 0.9), mean: null, ms: Math.round(performance.now() - t0), lut: false };
};
window.simpleInfo = () => ({ expressions: EXPRESSIONS, chars: Object.keys(CHARS), grade: !!GRADE, three: THREE.REVISION });
window.ready = true;
