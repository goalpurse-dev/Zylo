// Four clearly different looks of the same landfill moment (?r=1..4), all from CC0 assets (Poly Haven) and code.
// R1 creator match · R2 realistic materials on simple shapes · R3 stylised animated-film · R4 real miniature model
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

const Q = new URLSearchParams(location.search);
const R = Number(Q.get("r") ?? 1);
// render-cost options (M3, off by default so the locked look is unchanged): ?res=720 renders 720x1280 (for an upscale),
// ?lite=1 lighter shadows (2048 map), half-resolution ambient occlusion with 8 samples and 2x MSAA
const RES = Number(Q.get("res") ?? 1080), LITE = Q.get("lite") === "1";
const W = RES === 720 ? 720 : 1080, H = RES === 720 ? 1280 : 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const manager = new THREE.LoadingManager();
const tl = new THREE.TextureLoader(manager);
const texCache = {};
function tex(id, map, rep = 1, srgb = map === "diff") {
  const k = `${id}/${map}`;
  if (!texCache[k]) { const t = tl.load(`/assets/${id}/${map}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; texCache[k] = t; }
  if (rep === 1) return texCache[k];
  const c = texCache[k].clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c;
}
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const C = (h) => new THREE.Color(h);

// ---------------- look settings ----------------
const LOOK = {
  1: { tone: THREE.ACESFilmicToneMapping, exposure: 1.0, env: 1.0, bgHdri: Q.get("bg") !== "grad", sky: ["#4f95dd", "#cfe2f2"], sun: ["#fff1dc", 2.8, [16, 26, 14]], hemi: 0.15, sat: 1.12, con: 1.06, ao: 2.6, bloom: 0, dof: null, vig: 0.55 },
  2: { tone: THREE.NeutralToneMapping, exposure: 0.95, env: 0.9, bgHdri: false, sky: ["#cfe6fb", "#f4f8fc"], sun: ["#ffffff", 2.4, [10, 30, 22]], hemi: 0.35, sat: 0.92, con: 1.08, ao: 2.4, bloom: 0, dof: null, vig: 0.35 },
  3: { tone: THREE.ACESFilmicToneMapping, exposure: 1.05, env: 0.55, bgHdri: false, sky: ["#ff9e6b", "#ffd9a8"], sun: ["#ffc685", 3.2, [24, 13, 8]], rim: ["#7fb2ff", 1.6, [-18, 12, -24]], hemi: 0.55, hemiCols: ["#ffd6b0", "#4b3a6e"], sat: 1.0, con: 1.08, ao: 3.0, bloom: 0.35, dof: { focus: 40, aperture: 0.00006, maxblur: 0.003 }, vig: 0.8 },
  4: { tone: THREE.NeutralToneMapping, exposure: 1.0, env: 0.7, bgHdri: false, studio: true, sun: ["#fff8ef", 2.2, [-10, 26, 18]], hemi: 0.6, hemiCols: ["#ffffff", "#9a8f84"], sat: 0.85, con: 1.05, ao: 3.2, bloom: 0, dof: { focus: 34.5, aperture: 0.0011, maxblur: 0.016 }, vig: 0.6 },
}[R];
renderer.toneMapping = LOOK.tone; renderer.toneMappingExposure = LOOK.exposure;

// sky / environment
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load("/assets/hdri/sky.hdr", (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = LOOK.env;
  if (LOOK.bgHdri) { scene.background = hdr; scene.backgroundIntensity = 1.0; scene.backgroundRotation = new THREE.Euler(0, Number(Q.get("rot") ?? 4.6), 0); }
});
if (LOOK.sky && !LOOK.bgHdri) {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, LOOK.sky[0]); gr.addColorStop(0.2, LOOK.sky[1]); gr.addColorStop(1, LOOK.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
if (LOOK.studio) scene.background = C("#d9d4cd");
if (R === 1) scene.fog = new THREE.Fog(C("#cfe2f2"), 160, 600);
if (R === 2) scene.fog = new THREE.Fog(C("#f4f8fc"), 120, 400);
if (R === 3) scene.fog = new THREE.Fog(C("#ffd9a8"), 70, 300);
scene.add(new THREE.HemisphereLight(LOOK.hemiCols?.[0] ?? "#dfeeff", LOOK.hemiCols?.[1] ?? "#8a7258", LOOK.hemi));
const sun = new THREE.DirectionalLight(LOOK.sun[0], LOOK.sun[1]); sun.position.set(...LOOK.sun[2]); sun.castShadow = true;
sun.shadow.mapSize.set(LITE ? 2048 : 4096, LITE ? 2048 : 4096); Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; if (R === 4) sun.shadow.radius = 4; scene.add(sun);
if (LOOK.rim) { const rim = new THREE.DirectionalLight(LOOK.rim[0], LOOK.rim[1]); rim.position.set(...LOOK.rim[2]); scene.add(rim); }

// ---------------- materials ----------------
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const PBR = (id, rep, extra = {}) => std({ map: tex(id, "diff", rep), normalMap: tex(id, "nor", rep, false), roughnessMap: tex(id, "rough", rep, false), ...extra });
// painted-noise canvas texture for the film look (soft, hand-painted variation)
function painted(base, spread = 0.12, px = 256, cells = 6) {
  const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d");
  const col = C(base).convertLinearToSRGB(); g.fillStyle = base; g.fillRect(0, 0, px, px);
  for (let i = 0; i < 900; i++) { const r = 4 + rnd() * px / cells; const k = 1 + (rnd() - 0.5) * spread * 2; g.fillStyle = `rgba(${Math.min(255, col.r * 255 * k) | 0},${Math.min(255, col.g * 255 * k) | 0},${Math.min(255, col.b * 255 * k) | 0},0.18)`; g.beginPath(); g.arc(rnd() * px, rnd() * px, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// fine pore / flock noise for the miniature look
function fineNoise(base, amp = 0.18, px = 512) {
  const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"); const img = g.createImageData(px, px); const col = C(base).convertLinearToSRGB();
  for (let i = 0; i < px * px; i++) { const k = 1 + (rnd() - 0.5) * amp * 2; img.data[i * 4] = Math.min(255, col.r * 255 * k); img.data[i * 4 + 1] = Math.min(255, col.g * 255 * k); img.data[i * 4 + 2] = Math.min(255, col.b * 255 * k); img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------- ground: grass top with rounded lip, cut face + pit walls with textured strata ----------------
const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 }, LIP = 0.3, X = R === 4 ? 16 : 24, D = 18, BOTTOM = R === 4 ? -15.5 : -26;
function grid(xs, ys, keep, map) {
  const pos = [], uv = [], idx = [], id = new Map();
  const vid = (i, j) => { const k = i * 100000 + j; if (!id.has(k)) { id.set(k, pos.length / 3); const [a, b, c, u, v] = map(xs[i], ys[j]); pos.push(a, b, c); uv.push(u, v); } return id.get(k); };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) { if (!keep((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)) continue; const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1); idx.push(a, b, d, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const range = (a, b, s) => { const o = []; for (let v = a; v < b - 1e-6; v += s) o.push(+v.toFixed(4)); o.push(b); return o; };
const merge = (...a) => [...new Set(a.flat().map((v) => +v.toFixed(4)))].sort((p, q) => p - q);
const inPit = (x, z) => x > PIT.x0 && x < PIT.x1 && z > PIT.z0;
const edgeDist = (x, z) => Math.min(-z, inPit(x, z) ? 0 : Math.hypot(Math.max(PIT.x0 - x, 0, x - PIT.x1), Math.max(PIT.z0 - z, 0)));
const lip = (d) => (d >= LIP ? 0 : -(LIP - Math.sqrt(Math.max(0, LIP * LIP - (LIP - d) ** 2))));

// lawn: real grass detail re-tinted to a lush lawn, with mowing stripes (R1/R2), painted (R3), flock (R4)
function lawnMaterial() {
  if (R === 3) { const m = std({ map: painted("#7cbf3a", 0.18), roughness: 1, side: THREE.DoubleSide }); m.map.repeat.set(0.08, 0.08); return m; }
  if (R === 4) { const m = phys({ map: fineNoise("#6aa83c", 0.35), roughness: 1, sheen: 1, sheenColor: C("#b8e07a"), sheenRoughness: 0.6, side: THREE.DoubleSide }); m.map.repeat.set(0.6, 0.6); return m; }
  const m = std({ map: tex("leafy_grass", "diff"), normalMap: tex("leafy_grass", "nor", 1, false), roughness: 1, side: THREE.DoubleSide });
  m.normalScale.set(0.8, 0.8);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <map_fragment>", `
      vec4 tc = texture2D(map, vMapUv);
      float l = dot(tc.rgb, vec3(0.3, 0.55, 0.15));
      vec3 lawn = mix(vec3(0.07, 0.22, 0.03), vec3(0.17, 0.42, 0.05), smoothstep(0.08, 0.45, l));
      float stripe = step(0.5, fract(vW.x * 0.17 + 0.25));
      lawn *= ${R === 1 ? "0.9 + 0.2 * stripe" : "1.0"};
      lawn = mix(lawn, vec3(0.12, 0.08, 0.04), smoothstep(-0.1, -0.26, vW.y));
      diffuseColor.rgb = lawn;`);
  };
  return m;
}
// strata: band masks by height (wavy), each band its own texture; world-planar UVs from the geometry
function soilMaterial() {
  const bands = R === 4
    ? { sod: ["coast_sand_01", "#5b4a2e"], top: ["coast_sand_01", "#a07850"], deep: ["coast_sand_01", "#8c6040"], clay: ["coast_sand_01", "#9a96a0"], grav: ["coast_sand_01", "#c9b994"], water: ["coast_sand_01", "#5a8ad0"], rock: ["coast_sand_01", "#77787f"] }
    : R === 3
      ? { sod: [null, "#5a3a25"], top: [null, "#b46e3c"], deep: [null, "#8e5230"], clay: [null, "#b19aa6"], grav: [null, "#e0c08a"], water: [null, "#3f8fe8"], rock: [null, "#6c5f7c"] }
      : { sod: ["roots", "#ffffff"], top: ["brown_mud_dry", R === 1 ? "#ffd2a8" : "#ffffff"], deep: ["excavated_soil_wall", R === 1 ? "#ffc89a" : "#ffffff"], clay: ["excavated_soil_wall", "#b5b2bb"], grav: ["gravel", "#e6dccb"], water: ["brown_mud_rocks_01", "#7fb2ff"], rock: ["dark_rock", "#c9c9cf"] };
  const u = {}; let head = "varying vec3 vW;\n", fetch = "";
  for (const [k, [id, tint]] of Object.entries(bands)) {
    u[`t_${k}`] = { value: id ? tex(id, "diff") : painted(tint, 0.2) }; u[`c_${k}`] = { value: C(tint) };
    head += `uniform sampler2D t_${k}; uniform vec3 c_${k};\n`;
    const rep = id === "excavated_soil_wall" ? "0.22" : id === "dark_rock" ? "0.25" : R === 4 ? "0.5" : R === 3 ? "0.12" : "0.35";
    fetch += `vec3 s_${k} = texture2D(t_${k}, vMapUv * ${rep} / 0.25).rgb * ${id ? `c_${k}` : "vec3(1.0)"};\n`;
  }
  const m = std({ map: R === 3 ? u.t_deep.value : tex(R === 4 ? "coast_sand_01" : "excavated_soil_wall", "diff"), normalMap: R === 3 ? null : tex(R === 4 ? "coast_sand_01" : "excavated_soil_wall", "nor", 1, false), roughness: R === 4 ? 1 : 0.95, side: THREE.DoubleSide });
  if (m.normalMap) m.normalScale.set(R === 4 ? 0.4 : 1.2, R === 4 ? 0.4 : 1.2);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + head).replace("#include <map_fragment>", `
      ${fetch}
      float w = ${R === 3 ? "0.45" : "0.3"} * sin(vW.x * 0.42 + vW.z * 0.3) + 0.18 * sin(vW.x * 1.25 + 1.7);
      float y = vW.y + w;
      vec3 c = s_rock;
      c = mix(c, s_water, smoothstep(-14.2, -13.9, y));
      c = mix(c, s_grav, smoothstep(-11.15, -10.85, y));
      c = mix(c, s_clay, smoothstep(-10.15, -9.85, y));
      c = mix(c, s_deep, smoothstep(-7.65, -7.35, y));
      c = mix(c, s_top, smoothstep(-3.7, -3.3, y));
      c = mix(c, s_sod, smoothstep(-0.95, -0.7, y));
      diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "soil" + R;
  return m;
}
const grassM = lawnMaterial(), soilM = soilMaterial();
{
  const xs = merge(range(-X, X, 0.25), range(PIT.x0 - LIP, PIT.x0, LIP / 5), range(PIT.x1, PIT.x1 + LIP, LIP / 5));
  const zs = merge(range(-D, 0, 0.25), range(PIT.z0 - LIP, PIT.z0, LIP / 5), range(-LIP, 0, LIP / 5));
  const top = new THREE.Mesh(grid(xs, zs, (x, z) => !inPit(x, z), (x, z) => [x, lip(edgeDist(x, z)), z, x / 4, z / 4]), grassM); top.receiveShadow = true; scene.add(top);
  const fy = merge(range(BOTTOM, -PIT.depth, 0.5), range(-PIT.depth, -LIP, 0.25)), fx = merge(range(-X, X, 0.25), [PIT.x0, PIT.x1]);
  const face = new THREE.Mesh(grid(fx, fy, (x, y) => !(x > PIT.x0 && x < PIT.x1 && y > -PIT.depth), (x, y) => [x, y, 0, x / 4, y / 4]), soilM); face.receiveShadow = true; scene.add(face);
  const wy = range(-PIT.depth, -LIP, 0.25);
  for (const g of [grid(range(PIT.x0, PIT.x1, 0.25), wy, () => true, (x, y) => [x, y, PIT.z0, x / 4, y / 4]), grid(range(PIT.z0, 0, 0.25), wy, () => true, (z, y) => [PIT.x0, y, z, z / 4, y / 4]), grid(range(PIT.z0, 0, 0.25), wy, () => true, (z, y) => [PIT.x1, y, z, z / 4, y / 4])]) { const m = new THREE.Mesh(g, soilM); m.receiveShadow = true; scene.add(m); }
  if (R !== 4) for (const [w, d, x, z] of [[1600, 1200, 0, -D - 600], [800, D, -X - 400, -D / 2], [800, D, X + 400, -D / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassM); p.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? d : w) / 4; }); p.rotation.x = -Math.PI / 2; p.position.set(x, -0.002, z); p.receiveShadow = true; scene.add(p); }
}
// R4: the model sits on a base on a table in a studio; the world ends at the base
if (R === 4) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(2 * X + 1, 1.2, D + 1), std({ color: C("#22201e"), roughness: 0.5 })); base.position.set(0, BOTTOM - 0.6, -D / 2); scene.add(base);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std({ map: fineNoise("#b9a58a", 0.08), roughness: 0.7 })); table.rotation.x = -Math.PI / 2; table.position.y = BOTTOM - 1.2; table.receiveShadow = true; scene.add(table);
  // back and side of the block are plain painted foam
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, -BOTTOM), std({ color: C("#7a5a3e"), roughness: 1 })); back.position.set(0, BOTTOM / 2, -D); back.rotation.y = Math.PI; scene.add(back);
}
// R1: real stones and roots in the cut face
if (R === 1 || R === 3) {
  const rockM = R === 1 ? PBR("dark_rock", 0.5, { color: C("#b9b2a6") }) : std({ map: painted("#8a7f72", 0.2), roughness: 0.8 });
  const rockG = mergeVertices(new THREE.IcosahedronGeometry(0.5, 3)); { const p = rockG.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.22 * Math.sin(v.x * 7) * Math.sin(v.y * 6 + 1) + 0.1 * Math.sin(v.z * 9)); p.setXYZ(i, v.x, v.y * 0.75, v.z); } rockG.computeVertexNormals(); }
  const n = R === 1 ? 140 : 70, rocks = new THREE.InstancedMesh(rockG, rockM, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { let x, y; do { x = (rnd() - 0.5) * 2 * X; y = -0.8 - rnd() * 24; } while (x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3); const band = y < -10 && y > -11.2 ? 2.2 : 1; const sc = (0.12 + rnd() ** 2 * 0.45) * band ** 0.3; m4.compose(p.set(x, y, -sc * 0.15), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), s.set(sc, sc, sc * 0.6)); rocks.setMatrixAt(i, m4); }
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);
  const rootM = std({ color: C(R === 1 ? "#4a3626" : "#6b4a33"), roughness: 0.9 });
  for (let i = 0; i < (R === 1 ? 26 : 14); i++) { let x0 = (rnd() - 0.5) * 2 * X; if (x0 > PIT.x0 - 0.5 && x0 < PIT.x1 + 0.5) x0 += 11; const pts = []; let x = x0, y = -0.3; for (let k = 0; k < 6; k++) { pts.push(new THREE.Vector3(x, y, 0.02)); x += (rnd() - 0.5) * 0.6; y -= 0.25 + rnd() * 0.35; } const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035 + rnd() * 0.04, 6); scene.add(new THREE.Mesh(tg, rootM)); }
}
// groundwater: a glossy, see-through blue film over the stony band (R1, R2), painted water (R3), resin (R4)
{
  const wm = R === 3 ? std({ color: C("#3d8ff0"), transparent: true, opacity: 0.5, roughness: 0.15 }) : phys({ color: C(R === 4 ? "#3f7fe0" : "#2f7fe8"), transparent: true, opacity: R === 4 ? 0.55 : 0.48, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 });
  const g = new THREE.PlaneGeometry(2 * X, 3.0, 96, 6); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - 12.5; const w = (R === 3 ? 0.45 : 0.3) * Math.sin(x * 0.42) + 0.18 * Math.sin(x * 1.25 + 1.7); const yy = y < -12.5 ? -14.05 - w : -11.0 - w; p.setY(i, i % 97 === -1 ? y : yy + (p.getY(i) < 0 ? 0 : 0)); }
  // rebuild: top edge follows the gravel line, bottom edge the rock line
  for (let i = 0; i < p.count; i++) { const row = Math.floor(i / 97), x = p.getX(i); const w = (R === 3 ? 0.45 : 0.3) * Math.sin(x * 0.42) + 0.18 * Math.sin(x * 1.25 + 1.7); const yTop = -10.95 - w, yBot = -14.1 - w; p.setY(i, yTop + (yBot - yTop) * (row / 6)); }
  g.computeVertexNormals(); const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water);
}

// ---------------- props ----------------
const geoCache = new Map();
function rbox(sx, sy, sz, r, seg = 4) { const k = [sx, sy, sz, r, seg].join(","); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(sx, sy, sz, seg, Math.min(r, Math.min(sx, sy, sz) * 0.48))); return geoCache.get(k); }
function box(m, sx, sy, sz, x, y, z, parent = scene, r = 0.04) { const o = new THREE.Mesh(rbox(sx, sy, sz, r), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function cyl(m, r, h, x, y, z, parent = scene, axis = "y", seg = 28) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); if (axis === "x") o.rotation.z = Math.PI / 2; if (axis === "z") o.rotation.x = Math.PI / 2; o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function prismRoof(m, w, d, h, over = 0.4) { // gable roof along x
  const sh = new THREE.Shape(); sh.moveTo(-d / 2 - over, 0); sh.lineTo(0, h); sh.lineTo(d / 2 + over, 0); sh.lineTo(-d / 2 - over, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: w + 2 * over, bevelEnabled: false }); g.translate(0, 0, -(w + 2 * over) / 2); g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o;
}
const paint = (c, r = 0.35, cc = 0.6) => phys({ color: C(c), roughness: r, metalness: 0.15, clearcoat: cc, clearcoatRoughness: 0.15 });
const satin = (c) => std({ color: C(c), roughness: 0.55 });
const P = R === 3 ? {
  wall: std({ map: painted("#ffe6c4", 0.08), roughness: 0.9 }), trim: std({ color: C("#fff7ec"), roughness: 0.7 }), roof: std({ map: painted("#c4523a", 0.2), roughness: 0.75 }), glass: phys({ color: C("#8fd0ff"), roughness: 0.05, metalness: 0, clearcoat: 1, emissive: C("#ffcf7a"), emissiveIntensity: 0.25 }),
  door: std({ map: painted("#4f7cc0", 0.1), roughness: 0.6 }), truck: paint("#ff8a2a", 0.45, 0.3), bed: paint("#f47a1c", 0.5, 0.2), tyre: std({ color: C("#2b2830"), roughness: 0.85 }), rim: std({ color: C("#d9d4cc"), roughness: 0.4 }),
  chassis: std({ color: C("#4a4656"), roughness: 0.6 }), trunk: std({ map: painted("#7a4a2a", 0.2), roughness: 0.9 }), leaf: std({ map: painted("#5cae3a", 0.25), roughness: 0.8 }), leaf2: std({ map: painted("#86c94a", 0.2), roughness: 0.8 }),
} : R === 4 ? {
  wall: satin("#efe9dc"), trim: satin("#ffffff"), roof: std({ map: fineNoise("#5f6670", 0.12), roughness: 0.7 }), glass: std({ color: C("#9fb8c8"), roughness: 0.2 }), door: satin("#7a4e32"),
  truck: satin("#f0821e"), bed: satin("#e06e14"), tyre: std({ color: C("#1f1f22"), roughness: 0.8 }), rim: satin("#b8b8b8"), chassis: satin("#3c3e44"),
  trunk: std({ map: fineNoise("#5d4330", 0.2), roughness: 1 }), leaf: phys({ map: fineNoise("#4f8a34", 0.45), roughness: 1, sheen: 1, sheenColor: C("#a6d86a") }), leaf2: phys({ map: fineNoise("#679f3c", 0.45), roughness: 1, sheen: 1, sheenColor: C("#b8e07a") }),
} : {
  wall: PBR("painted_plaster_wall", 1, { color: C(R === 1 ? "#f3e6cf" : "#f6f1e6") }), trim: std({ color: C("#fbfbf8"), roughness: 0.55 }), roof: R === 1 ? PBR("roof_09", 1, { color: C("#e0a080") }) : PBR("grey_roof_01", 1, { color: C("#8d8a86") }),
  glass: phys({ color: C("#203040"), roughness: 0.02, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 }), door: paint("#3b2a1e", 0.4, 0.4),
  truck: paint("#f07818"), bed: paint("#dc6a12", 0.45), tyre: std({ color: C("#151515"), roughness: 0.9 }), rim: phys({ color: C("#c8c8c8"), metalness: 0.9, roughness: 0.25 }), chassis: std({ color: C("#2a2c30"), roughness: 0.55, metalness: 0.4 }),
  trunk: PBR("dark_rock", 1, { color: C("#8a6a4c") }), leaf: std({ color: C("#3f7a2c"), roughness: 0.85, normalMap: tex("leafy_grass", "nor", 3, false) }), leaf2: std({ color: C("#4f8f34"), roughness: 0.85, normalMap: tex("leafy_grass", "nor", 3, false) }),
};
const linerM = R === 3 ? std({ color: C("#2c2f3e"), roughness: 0.35 }) : R === 4 ? satin("#2a2d33") : phys({ color: C("#16181c"), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3, normalMap: tex("roots", "nor", 2, false), normalScale: new THREE.Vector2(0.12, 0.12) });
const coverM = R === 3 ? std({ map: painted("#6b4128", 0.2), roughness: 1 }) : R === 4 ? std({ map: fineNoise("#5e4330", 0.25), roughness: 1 }) : PBR("brown_mud_dry", 1, { color: C("#8a6a52") });
const gravelM = R === 3 ? std({ map: painted("#d8c9a6", 0.15), roughness: 1 }) : R === 4 ? std({ map: fineNoise("#cfc3a8", 0.4), roughness: 1 }) : PBR("gravel", 1, { color: C("#d9d2c4") });
const pipeM = R === 4 ? satin("#f2f2f0") : phys({ color: C("#eef0f2"), roughness: 0.3, clearcoat: 0.5 });
const tankM = R === 3 ? std({ map: painted("#3fb0c8", 0.1), roughness: 0.5 }) : R === 4 ? satin("#6aa9b8") : paint("#4a9fb3", 0.4, 0.4);

// trash bags: wrinkled plastic (R1/R2), squishy glossy (R3), putty (R4)
const bagColors = R === 4 ? ["#2e4a2c", "#1f2023", "#3a3f46"] : R === 3 ? ["#2f6b3a", "#26303a", "#3e7f46", "#1f2a30"] : ["#1d3a22", "#121315", "#2a4a2c", "#18191c", "#24402a"];
const bagMats = bagColors.map((c) => R === 4 ? std({ color: C(c), roughness: 0.6 }) : phys({ color: C(c), roughness: R === 3 ? 0.25 : 0.32, clearcoat: R === 3 ? 0.8 : 0.7, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: C("#9fb3a8") }));
function bagGeo(w, h, d, s) {
  const g = new RoundedBoxGeometry(w, h, d, 8, Math.min(w, h, d) * (R === 3 ? 0.45 : 0.32)); const p = g.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  g.computeVertexNormals(); const nn = g.attributes.normal;
  const amp = R === 1 || R === 2 ? 0.06 : R === 3 ? 0.035 : 0.02;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); n.fromBufferAttribute(nn, i);
    const f = Math.sin(v.x * 9 + s) * Math.sin(v.y * 11 + s * 2) + 0.6 * Math.sin((v.x + v.z) * 15 + s * 3) * Math.sin(v.y * 7) + 0.5 * Math.sin(v.z * 13 + s);
    const sag = v.y > 0 ? -0.08 * (v.x * v.x + v.z * v.z) : 0;
    v.addScaledVector(n, f * amp); v.y += sag; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
function bag(w, h, d, x, y, z, m, knot = true) {
  const o = new THREE.Mesh(bagGeo(w, h, d, rnd() * 10), m); o.position.set(x, y + h / 2, z); o.rotation.y = (rnd() - 0.5) * 0.3; o.castShadow = o.receiveShadow = true; scene.add(o);
  if (knot) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), m); k.position.set(x + (rnd() - 0.5) * 0.3, y + h - 0.02, z + (rnd() - 0.5) * 0.3); k.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); k.castShadow = true; scene.add(k);
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16), m); ear.position.set(k.position.x, k.position.y + 0.3, k.position.z); ear.rotation.set(rnd() * 2, rnd() * 2, 0); scene.add(ear); }
  return o;
}

// ---------------- the scene ----------------
const LT = 0.16;
// liner (back, sides, floor, lip)
box(linerM, 10, PIT.depth, LT, 0, -PIT.depth / 2, PIT.z0 + LT / 2, scene, 0.03); box(linerM, LT, PIT.depth, 8, PIT.x0 + LT / 2, -PIT.depth / 2, -4, scene, 0.03); box(linerM, LT, PIT.depth, 8, PIT.x1 - LT / 2, -PIT.depth / 2, -4, scene, 0.03);
box(linerM, 10, LT, 8, 0, -PIT.depth + LT / 2, -4, scene, 0.03); box(linerM, 11.4, LT, 1.0, 0, 0.06, PIT.z0 - 0.45, scene, 0.05); for (const sx of [PIT.x0 - 0.45, PIT.x1 + 0.45]) box(linerM, 1.0, LT, 8, sx, 0.06, -4, scene, 0.05);
box(gravelM, 10 - 2 * LT, 0.54, 8 - LT, 0, -PIT.depth + LT + 0.27, -4 + LT / 2, scene, 0.06);
// drain pipe (round), half in the cut face, up to the tank
function pipe(a, b, r = 0.24) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 24), pipeM); o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); o.castShadow = o.receiveShadow = true; scene.add(o); const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 20, 12), pipeM); j.position.copy(B); scene.add(j); }
const PZ = -0.1; pipe([-4.6, -5.05, PZ], [4.7, -5.05, PZ]); pipe([4.7, -5.05, PZ], [5.2, -5.5, PZ]); pipe([5.2, -5.5, PZ], [7.6, -5.5, PZ]); pipe([7.6, -5.5, PZ], [7.6, 0.35, PZ]); pipe([7.6, 0.35, PZ], [8.6, 0.35, PZ]);
{ const g = new THREE.Group(); g.position.set(9.9, 0, -1.9); scene.add(g); cyl(tankM, 1.4, 2.8, 0, 1.4, 0, g, "y", 48); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.42, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), tankM); cap.scale.y = 0.3; cap.position.y = 2.8; g.add(cap); if (R !== 3) for (const yy of [0.6, 2.2]) { const band = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 8, 48), P.chassis); band.rotation.x = Math.PI / 2; band.position.y = yy; g.add(band); } }
// trash: three packed layers of bags with soil covers between them
const IX0 = PIT.x0 + LT, IX1 = PIT.x1 - LT, IZ0 = PIT.z0 + LT, IZ1 = 0;
function bagLayer(y0, h, off, skip = () => false) {
  const nx = R === 3 ? 4 : 5, nz = R === 3 ? 3 : 4, cw = (IX1 - IX0) / nx, cd = (IZ1 - IZ0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { if (skip(i, j, nz)) continue; const w = cw * (0.98 + rnd() * 0.1), d = cd * (0.98 + rnd() * 0.1), hh = h * (0.9 + rnd() * 0.12); bag(w, hh, d, IX0 + cw * (i + 0.5) + (rnd() - 0.5) * 0.12, y0, IZ0 + cd * (j + 0.5) + (rnd() - 0.5) * 0.12, bagMats[(i * 2 + j * 3 + off) % bagMats.length], rnd() < 0.5); }
}
const cover = (y, t = 0.34) => box(coverM, IX1 - IX0, t, IZ1 - IZ0, 0, y + t / 2, (IZ0 + IZ1) / 2, scene, 0.08);
bagLayer(-5.3, 1.7, 0); cover(-3.6); bagLayer(-3.26, 1.7, 2); cover(-1.56); bagLayer(-1.22, 1.45, 4, (i, j, nz) => j === nz - 1 || (j === nz - 2 && i === 0));
// gas well + flare (layered flame + halo)
const GX = -2.9, GZ = -5.9;
pipe([GX, -5.3, GZ], [GX, 3.0, GZ], 0.2); box(P.chassis, 0.85, 0.5, 0.85, GX, 3.2, GZ, scene, 0.1);
{ const tear = (w, h) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * Math.pow(1 - t, 0.55), t * h)); } return new THREE.LatheGeometry(pts, 32); };
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: C(c), toneMapped: false, transparent: true, opacity: o, depthWrite: false });
  [[0.3, 0.9, "#fff1a0", 1, 1], [0.5, 1.6, "#ffb02a", 0.8, 2], [0.72, 2.4, "#ff6410", 0.5, 3]].forEach(([w, h, c, o, ord]) => { const f = new THREE.Mesh(tear(w, h), fm(c, o)); f.position.set(GX, 3.45, GZ); f.renderOrder = ord; scene.add(f); });
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const gg = cv.getContext("2d"); const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, "rgba(255,200,90,1)"); rg.addColorStop(0.3, "rgba(255,150,40,0.5)"); rg.addColorStop(1, "rgba(255,120,30,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace; const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); halo.position.set(GX, 4.3, GZ); halo.scale.set(4.4, 4.4, 1); scene.add(halo);
  const pl = new THREE.PointLight(0xffa040, 30, 12, 1.5); pl.position.set(GX, 4.3, GZ); scene.add(pl); }

// house: R1 detailed suburban two-storey; R2 simple box + gable; R3 bulgy storybook; R4 painted model
{
  const g = new THREE.Group(); g.position.set(-8, 0, -30); scene.add(g);
  const Wd = R === 1 ? 11 : 8, Hh = R === 1 ? 6.4 : 4.4, Dd = 6.5;
  const wall = box(P.wall, Wd, Hh, Dd, 0, Hh / 2, 0, g, R === 3 ? 0.6 : 0.05);
  if (R === 3) { const p = wall.geometry.clone(); const a = p.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i); const k = 1 + 0.06 * Math.cos((y / Hh) * Math.PI); a.setXYZ(i, x * k, y, z * k); } p.computeVertexNormals(); wall.geometry = p; }
  const roof = prismRoof(P.roof, Wd, Dd, R === 3 ? 4.2 : R === 1 ? 3.0 : 2.4, R === 3 ? 0.9 : 0.55); roof.position.y = Hh; g.add(roof);
  if (R === 3) { roof.scale.set(1.04, 1.1, 1.04); }
  const win = (x, y, w = 1.3, h = 1.5) => { box(P.trim, w + 0.24, h + 0.24, 0.12, x, y, Dd / 2 + 0.03, g, 0.03); box(P.glass, w, h, 0.08, x, y, Dd / 2 + 0.08, g, 0.01); if (R === 1 || R === 3) { box(P.trim, 0.08, h, 0.05, x, y, Dd / 2 + 0.13, g, 0.01); box(P.trim, w, 0.08, 0.05, x, y, Dd / 2 + 0.13, g, 0.01); } if (R === 1) box(P.trim, w + 0.5, 0.12, 0.22, x, y - h / 2 - 0.16, Dd / 2 + 0.1, g, 0.02); };
  if (R === 1) { const shut = std({ color: C("#2f5a8a"), roughness: 0.6 }); for (const x of [-3.8, -1.6, 1.6, 3.8]) { win(x, 4.6); for (const sx of [-1.0, 1.0]) box(shut, 0.5, 1.6, 0.08, x + sx, 4.6, Dd / 2 + 0.06, g, 0.02); } win(-3.8, 1.8); win(3.8, 1.8); for (const x of [-3.8, 3.8]) for (const sx of [-1.0, 1.0]) box(shut, 0.5, 1.6, 0.08, x + sx, 1.8, Dd / 2 + 0.06, g, 0.02); box(P.trim, 1.6, 2.6, 0.12, 0, 1.3, Dd / 2 + 0.03, g, 0.03); box(P.door, 1.2, 2.3, 0.1, 0, 1.2, Dd / 2 + 0.09, g, 0.02); box(P.trim, 3.2, 0.18, 1.4, 0, 2.9, Dd / 2 + 0.7, g, 0.03); for (const x of [-1.4, 1.4]) cyl(P.trim, 0.09, 2.8, x, 1.4, Dd / 2 + 1.3, g); box(std({ color: C("#9a8f86"), roughness: 0.9 }), 1.0, 2.6, 1.0, 3.6, Hh + 2.0, -1.2, g, 0.03);
    for (const x of [-Wd / 2, Wd / 2]) box(P.trim, 0.18, Hh, 0.18, x, Hh / 2, Dd / 2, g, 0.02); box(P.trim, Wd + 0.4, 0.2, 0.2, 0, Hh, Dd / 2 + 0.05, g, 0.02); }
  else { win(-2.3, R === 3 ? 2.6 : 2.5); win(2.3, R === 3 ? 2.6 : 2.5); box(P.door, 1.2, 2.1, 0.12, 0, 1.05, Dd / 2 + 0.05, g, R === 3 ? 0.25 : 0.03); }
}
// trees
function tree(x, z, s = 1) {
  const t = cyl(P.trunk, 0.32 * s, 3.2 * s, x, 1.6 * s, z, scene, "y", 12); if (R === 3) t.geometry = new THREE.CylinderGeometry(0.22 * s, 0.42 * s, 3.2 * s, 14);
  const n = R === 1 ? 14 : R === 3 ? 7 : R === 4 ? 9 : 3;
  for (let i = 0; i < n; i++) { const r = (R === 2 ? 1.9 : 1.15 + rnd() * 0.7) * s; const lg = mergeVertices(new THREE.IcosahedronGeometry(r, R === 2 ? 4 : 3)); lg.deleteAttribute("uv"); if (R !== 2) { const p = lg.attributes.position, v = new THREE.Vector3(); for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); v.multiplyScalar(1 + (R === 4 ? 0.12 : 0.08) * Math.sin(v.x * 4 + i) * Math.sin(v.y * 5 + i)); p.setXYZ(k, v.x, v.y, v.z); } lg.computeVertexNormals(); } else lg.computeVertexNormals();
    const l = new THREE.Mesh(lg, i % 2 ? P.leaf : P.leaf2); const a = rnd() * Math.PI * 2, rr = n === 3 ? 0.6 * s : rnd() * 1.6 * s; l.position.set(x + Math.cos(a) * rr, (4.2 + rnd() * 1.8) * s, z + Math.sin(a) * rr); l.castShadow = l.receiveShadow = true; scene.add(l); }
}
tree(-13, -11.5); tree(14, -3.4, 0.9); tree(-16, -27, 1.2); tree(18, -31, 1.3); tree(-3, -44, 1.1); tree(-23, -15, 1.05);
// road
{ const rm = R === 3 ? std({ map: painted("#b0a49a", 0.08), roughness: 1 }) : R === 4 ? std({ map: fineNoise("#8d8a86", 0.2), roughness: 0.9 }) : PBR("asphalt_02", 1, { color: C("#bcbcbc") });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 90), rm); road.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? 22 : 1.2); }); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -D - 45 + 9.5); road.receiveShadow = true; scene.add(road); }
// dump truck tipping, two bags in the air
{
  const g = new THREE.Group(); g.position.set(0, 0, -12.6); scene.add(g);
  box(P.chassis, 2.4, 0.5, 7.2, 0, 1.0, 0, g, 0.08);
  if (R === 1) { // cab with a raked windscreen, grille, bumper, lights, mirrors
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.6, 0); sh.lineTo(2.6, 1.3); sh.lineTo(2.1, 2.4); sh.lineTo(0, 2.4); sh.lineTo(0, 0);
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }); cg.translate(0, 0, -1.3); cg.rotateY(Math.PI / 2);
    const cab = new THREE.Mesh(cg, P.truck); cab.position.set(0, 1.25, -1.4); cab.castShadow = true; g.add(cab);
    box(P.glass, 2.3, 0.95, 0.06, 0, 3.15, -3.75, g, 0.02).rotation.x = -0.42; for (const x of [-1.33, 1.33]) box(P.glass, 0.05, 0.85, 1.5, x, 3.05, -2.4, g, 0.02);
    box(P.chassis, 2.2, 0.8, 0.1, 0, 1.75, -4.02, g, 0.03); box(P.rim, 2.7, 0.3, 0.3, 0, 1.1, -4.15, g, 0.08);
    for (const x of [-0.9, 0.9]) { const l = box(phys({ color: C("#fffbe8"), emissive: C("#fff3c0"), emissiveIntensity: 0.6, roughness: 0.1 }), 0.4, 0.25, 0.06, x, 1.75, -4.08, g, 0.05); }
    for (const x of [-1.5, 1.5]) box(P.chassis, 0.1, 0.4, 0.25, x, 3.0, -3.3, g, 0.03);
  } else { box(P.truck, 2.7, 2.3, 2.4, 0, 2.35, -2.6, g, R === 3 ? 0.6 : 0.15); box(P.glass, 2.3, 0.9, 0.08, 0, 2.95, -3.82, g, 0.03); }
  for (const [x, z] of [[-1.3, -2.5], [1.3, -2.5], [-1.3, 1.4], [1.3, 1.4], [-1.3, 2.8], [1.3, 2.8]]) { const rr = R === 3 ? 0.8 : 0.62; cyl(P.tyre, rr, 0.55, x, rr, z, g, "x", 32); cyl(P.rim, rr * 0.55, 0.57, x, rr, z, g, "x", 24); }
  const pivot = new THREE.Group(); pivot.position.set(0, 1.3, 3.6); pivot.rotation.x = 0.7; g.add(pivot);
  const bed = new THREE.Group(); bed.position.set(0, 0, -2.3); pivot.add(bed);
  box(P.bed, 2.7, 0.22, 4.6, 0, 0.11, 0, bed, 0.05); for (const x of [-1.3, 1.3]) box(P.bed, 0.14, 1.5, 4.6, x, 0.85, 0, bed, 0.05); box(P.bed, 2.7, 1.8, 0.14, 0, 0.95, -2.25, bed, 0.05);
  if (R === 1) for (let k = -1.5; k <= 1.6; k += 0.75) for (const x of [-1.39, 1.39]) box(P.bed, 0.06, 1.3, 0.12, x, 0.85, k, bed, 0.02);
  { const b = new THREE.Mesh(bagGeo(1.3, 1.0, 1.3, 2), bagMats[0]); b.position.set(-0.4, 0.75, -1.2); bed.add(b); const b2 = new THREE.Mesh(bagGeo(1.2, 0.95, 1.2, 5), bagMats[1]); b2.position.set(0.55, 0.7, -0.1); bed.add(b2); }
}
bag(1.3, 1.05, 1.25, 0.6, 1.0, -8.6, bagMats[1]).rotation.set(0.5, 0.3, 0.2);
bag(1.2, 1.0, 1.2, -0.8, 2.0, -9.4, bagMats[0]).rotation.set(-0.3, 0.6, 0.1);
// worker
{ const g = new THREE.Group(); g.position.set(12.4, 0, -5.4); g.rotation.y = -0.7; scene.add(g); const vest = R === 4 ? satin("#ff8a1e") : std({ color: C("#ff7a1a"), roughness: 0.7 }); const skin = std({ color: C("#e2b48e"), roughness: 0.7 }); const pants = std({ color: C("#34405a"), roughness: 0.85 });
  box(pants, 0.34, 0.95, 0.34, -0.19, 0.47, 0, g, 0.12); box(pants, 0.34, 0.95, 0.34, 0.19, 0.47, 0, g, 0.12); box(vest, 0.8, 1.0, 0.45, 0, 1.42, 0, g, 0.18); box(skin, 0.22, 0.85, 0.22, -0.52, 1.4, 0, g, 0.1); box(skin, 0.22, 0.85, 0.22, 0.52, 1.4, 0, g, 0.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), skin); head.position.y = 2.2; g.add(head); const hat = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: C("#ffd23a"), roughness: 0.35 })); hat.position.y = 2.3; g.add(hat); }
// R3: grass tufts and flowers for richness
if (R === 3) {
  const tuft = new THREE.ConeGeometry(0.06, 0.45, 5); const tm = std({ color: C("#6fbf3a"), roughness: 0.9 }); const n = 6000; const im = new THREE.InstancedMesh(tuft, tm, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { let x, z; do { x = (rnd() - 0.5) * 2 * X; z = -rnd() * D; } while (edgeDist(x, z) < 0.5 || (x > -2.6 && x < 2.6 && z < -9)); m4.compose(p.set(x, 0.18, z), q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5)), s.setScalar(0.6 + rnd() * 0.8)); im.setMatrixAt(i, m4); im.setColorAt(i, C(rnd() < 0.5 ? "#7cc63e" : "#5aa832")); }
  scene.add(im);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), std({ color: C("#fff4f0"), roughness: 0.6 }), 160); for (let i = 0; i < 160; i++) { let x, z; do { x = (rnd() - 0.5) * 2 * X; z = -rnd() * D; } while (edgeDist(x, z) < 0.6); m4.compose(p.set(x, 0.32, z), q.identity(), s.setScalar(1)); fl.setMatrixAt(i, m4); fl.setColorAt(i, C(["#ffd2e0", "#fff2a8", "#ffffff", "#d8c2ff"][i % 4])); } scene.add(fl);
}

// ---------------- camera + post ----------------
const camera = new THREE.PerspectiveCamera(R === 4 ? 24 : 35, W / H, 0.1, 1200);
if (R === 4) { camera.position.set(30, 26, 64); camera.lookAt(0.0, -5.0, -7); } else if (R === 1) { camera.position.set(13, 9.5, 33); camera.lookAt(0.2, 0.2, -9); } else { camera.position.set(16.5, 14.5, 37); camera.lookAt(0.6, 0.6, -7.5); }
const rt = new THREE.WebGLRenderTarget(W, H, { samples: LITE ? 2 : 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const ao = new N8AOPass(scene, camera, W, H);
Object.assign(ao.configuration, { aoRadius: 2.6, distanceFalloff: 1.0, intensity: LOOK.ao, aoSamples: LITE ? 8 : 16, denoiseSamples: LITE ? 4 : 8, denoiseRadius: 12, halfRes: LITE, gammaCorrection: false });
composer.addPass(ao);
if (LOOK.dof) composer.addPass(new BokehPass(scene, camera, LOOK.dof));
if (LOOK.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), LOOK.bloom, 0.6, 1.4));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: Number(Q.get("sat") ?? LOOK.sat) }, con: { value: LOOK.con } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat; uniform float con; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * con + 0.5; gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }" }));
{ const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = LOOK.vig; composer.addPass(v); }
window.renderAt = () => { const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };
manager.onLoad = () => { window.ready = true; };
