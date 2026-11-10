// Blocky Worlds WORLD-LOOK (2026-11-06): the realistic outdoor world, promoted from the style test the owner liked
// (dev/styletest/world.js): PBR grass + forest-dirt terrain with far rolling hills, full CC0 trees near and cut-out
// (impostor) trees far, firs, ferns, mossy rocks, boulders, logs, stumps, instanced grass clumps, puffy grey dust clouds
// and leaf bursts. Used by every creature world (page/sets/creatureWorld.js) instead of the old pastel plane + triangle
// mountains + blocky trees.
//
// FOREGROUND RULE (owner): the foreground may frame the subject but never hide it. Every instanced plant / rock here
// carries a sight-line test in its vertex shader: an instance whose top rises above the line from the camera to the
// subject, inside a corridor around that line, collapses for that frame (GPU only; one uniform update per frame:
// nature.sight(camera, subject)). Aerials look over the trees (the line is above them), so nothing is cut out there.
//
//   const N = await makeNature(ctx, opts)   ctx: the sets' build ctx { THREE, renderer, gltf }
//     opts: { seed, center: {x, z} (the action), clear(x, z) -> bool (no trees: the creature's lane, the stage),
//             nearR (real trees inside), farR (impostors to), trees (count), grass (count), grassR, ferns, flatR
//             (ground kept at y 0 inside: the giants and people stand on 0), hills: true, water: false }
//   N.group, N.groundH(x, z), N.sight(camera, subject { pos: Vector3, height, radius } | null), N.update(t)
//   makeDust(THREE, bursts) / makeLeaves(THREE, bursts) -> { group, update(t) }   (deterministic in t)
//
// Assets (CC0, Poly Haven; listed in assets/SOURCES.json): /assets/styletest/<model>/<model>.gltf (island_tree_02,
// fir_sapling, fern_02, rock_moss_set_01, boulder_01, dead_tree_trunk, tree_stump_01), forest_ground_04 (dirt),
// /assets/leafy_grass (grass).
//
// PLASTIC-WORLD 2026-11-10 (owner: "Replace the realistic forest with clean stylised trees/bushes in the reference
// style ... terrain as bright clean green grass + clean paths"): with PLASTIC_LOOK (page/kit/plastic.js, the default)
// no Poly Haven model or photo texture is loaded here. The same instanced parts are built from clean shapes instead:
// round lollipop trees (stacked balls on a brown trunk), stacked-cone firs, blocky stacked-cube canopies, round bushes,
// smooth blue-grey stones, logs / stumps, little flowers; every canopy / flower takes a bright colour per instance.
// The ground is one smooth bright green (vertex colours: a gentle large-scale shade, never noise) with the creature's
// lane as a clean light stone path. Grass clumps are off (clean grass); the sight-line rule works unchanged.
//   TOY_GREENS / TOY_FLOWERS   the canopy / flower colours                                               (tested)
//   toyParts(THREE, kind, lod) -> [{ geometry, material, tint? }]  kind: round | fir | blocky | bush | rock | log | stump | flower
//   toyModelFor(THREE, url) -> Group | null   a stylised stand-in for a Poly Haven foliage model (sets/util.js model())
import { prng } from "../../lib/epic.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PLASTIC_LOOK, makePlastic } from "./plastic.js";

export const NATURE_MODELS = Object.freeze(["island_tree_02", "fir_sapling", "fern_02", "rock_moss_set_01", "boulder_01", "dead_tree_trunk", "tree_stump_01"]);
const A = "/assets/styletest";

// ------------------------------------------------------------------------------------------------ PLASTIC-WORLD toy nature
export const TOY_GREENS = Object.freeze(["#3cbf3a", "#58d03e", "#2fb24c", "#7ad43a", "#45c95a"]);
export const TOY_FLOWERS = Object.freeze(["#ff4a5a", "#ffd23a", "#ff7ad0", "#ffffff", "#9a6aff", "#ff8a2a"]);
export const TOY_GROUND = Object.freeze({ grass: "#56c63e", grass2: "#4cba3c", hills: "#46b04a", path: "#aeb8c8" }); // GATE-V3: a light-mid cool grey (the near-white lane clipped under the plastic sun)
const TOY_MATS = new Map();
const toyMat = (THREE, key, colour, o = {}) => { let m = TOY_MATS.get(key); if (!m) { m = makePlastic(THREE, colour, { keepColour: true, ...o }); m.name = key; TOY_MATS.set(key, m); } return m; };
const TOY_GEO = new Map();
/** clean toy shapes as instanced parts (lod 1 near, 0 far: fewer segments). tint: the part takes a colour per instance */
export function toyParts(THREE, kind, lod = 1) {
  const key = `${kind}|${lod}`;
  if (TOY_GEO.has(key)) return TOY_GEO.get(key);
  const seg = lod ? 12 : 7, rings = lod ? 9 : 5;
  const ball = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, seg, rings); g.translate(x, y, z); return g; };
  const cone = (r, h, y) => { const g = new THREE.ConeGeometry(r, h, lod ? 14 : 7); g.translate(0, y, 0); return g; };
  const cube = (s, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(s, s, s); g.rotateY(ry); g.translate(x, y, z); return g; };
  const cyl = (rt, rb, h, y = h / 2) => { const g = new THREE.CylinderGeometry(rt, rb, h, lod ? 10 : 6); g.translate(0, y, 0); return g; };
  const bark = toyMat(THREE, "toyBark", "#9a5a2c"), canopy = toyMat(THREE, "toyCanopy", "#ffffff"), stone = toyMat(THREE, "toyStone", "#8e9cb4"), wood = toyMat(THREE, "toyWood", "#b0682c"), cut = toyMat(THREE, "toyCut", "#f2b64a");
  const merge = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  let parts;
  if (kind === "round") parts = [{ geometry: cyl(0.32, 0.42, 3.6), material: bark }, { geometry: merge([ball(2.3, 0, 5.0, 0), ball(1.7, 1.35, 4.4, 0.3), ball(1.6, -1.2, 4.5, -0.4), ball(1.5, 0.3, 6.5, -0.2)]), material: canopy, tint: true }];
  else if (kind === "fir") parts = [{ geometry: cyl(0.25, 0.32, 2.2), material: bark }, { geometry: merge([cone(2.4, 3.0, 3.2), cone(1.9, 2.6, 4.9), cone(1.3, 2.2, 6.4)]), material: canopy, tint: true }];
  else if (kind === "blocky") parts = [{ geometry: cyl(0.3, 0.36, 3.2), material: bark }, { geometry: merge([cube(3.2, 0, 4.6, 0, 0.2), cube(2.3, 0.4, 6.4, -0.2, 0.7), cube(1.8, -1.2, 4.2, 1.0, 1.1)]), material: canopy, tint: true }];
  else if (kind === "bush") parts = [{ geometry: merge([ball(0.75, 0, 0.6, 0), ball(0.6, 0.6, 0.45, 0.2), ball(0.55, -0.55, 0.45, -0.15), ball(0.5, 0.1, 1.05, 0)]), material: canopy, tint: true }];
  else if (kind === "rock") { const g = new THREE.IcosahedronGeometry(1, lod ? 1 : 0); g.scale(1.25, 0.75, 1); g.translate(0, 0.45, 0); parts = [{ geometry: g, material: stone }]; }
  else if (kind === "log") { const g = new THREE.CylinderGeometry(0.42, 0.42, 3.2, lod ? 12 : 6); g.rotateZ(Math.PI / 2); g.translate(0, 0.42, 0); const c1 = new THREE.CylinderGeometry(0.36, 0.36, 3.24, lod ? 12 : 6); c1.rotateZ(Math.PI / 2); c1.translate(0, 0.42, 0); parts = [{ geometry: g, material: wood }, { geometry: c1, material: cut }]; }
  else if (kind === "stump") parts = [{ geometry: cyl(0.55, 0.65, 0.7), material: wood }, { geometry: cyl(0.48, 0.48, 0.04, 0.71), material: cut }];
  else if (kind === "flower") parts = [{ geometry: cyl(0.025, 0.03, 0.32), material: toyMat(THREE, "toyStem", "#2fae3a") }, { geometry: (() => { const h = new THREE.IcosahedronGeometry(0.13, 0); h.scale(1, 0.6, 1); h.translate(0, 0.36, 0); return h; })(), material: canopy, tint: true }];
  else throw new Error(`toyParts: unknown kind "${kind}"`);
  TOY_GEO.set(key, parts);
  return parts;
}
// the Poly Haven foliage models the sets used -> a toy kind (+ a fixed canopy colour)
const TOY_FOR_URL = [[/jacaranda_tree|island_tree/, "round", "#3cbf3a"], [/fir_sapling/, "fir", "#2fb24c"], [/shrub_0?2/, "bush", "#58d03e"], [/shrub_0?4|fern/, "bush", "#45c95a"]];
/** a stylised stand-in for a Poly Haven foliage model (a fresh Group; shared geometry), or null */
export function toyModelFor(THREE, url) {
  const hit = TOY_FOR_URL.find(([re]) => re.test(String(url)));
  if (!hit) return null;
  const g = new THREE.Group(); g.name = `toy:${hit[1]}`;
  for (const p of toyParts(THREE, hit[1], 1)) {
    const mesh = new THREE.Mesh(p.geometry, p.tint ? toyMat(THREE, `toyCanopy${hit[2]}`, hit[2]) : p.material);
    mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ pure helpers (tested)
/** the terrain height: flat (0) inside flatR, gentle undulation outside, rolling hills rising toward the horizon */
export function terrainHeight(x, z, { flatR = 220, hills = true, cx = 0, cz = 0 } = {}) {
  const r = Math.hypot(x - cx, z - cz);
  const ss = (a, b, v) => { const u = Math.min(1, Math.max(0, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
  const near = (0.9 * Math.sin(x * 0.031 + 1) * Math.sin(z * 0.027) + 0.5 * Math.sin(x * 0.09 + z * 0.07)) * ss(flatR, flatR * 1.6, r);
  if (!hills) return near;
  const n = 0.5 + 0.5 * Math.sin(x * 0.0047 + 1.3) * Math.sin(z * 0.0061 + 0.4) + 0.25 * Math.sin(x * 0.011 - z * 0.009);
  return near + ss(600, 1500, r) * (40 + 110 * n);
}
/**
 * sightBlocks(p, top, cam, subj, r0, r1): does a thing standing at p (x, z on the ground, its top at height `top`)
 * hide the subject from the camera? (the same test as the vertex shader, for tests and for CPU-side props)
 */
export function sightBlocks(p, top, cam, subj, r0 = 1.5, r1 = 4) {
  const dx = subj.x - cam.x, dz = subj.z - cam.z, L2 = dx * dx + dz * dz;
  if (L2 < 1e-6) return false;
  const s = ((p.x - cam.x) * dx + (p.z - cam.z) * dz) / L2;
  if (s <= 0 || s >= 1) return false;
  const qx = cam.x + dx * s, qz = cam.z + dz * s, d = Math.hypot(p.x - qx, p.z - qz);
  const lineY = cam.y + (subj.y - cam.y) * s;
  return d < r0 + (r1 - r0) * s && top > lineY - 0.3;
}

// ------------------------------------------------------------------------------------------------ the sight-line shader
// uClip (FRAMING-FIX 2026-11-08): a region whose plants collapse (the coast stage's hill + sea stand on the forest):
// (x > uClip.x && |z - uClip.y| < uClip.z) || x > uClip.w, while uClipOn is 1
const SIGHT_UNIFORMS = () => ({ uCam: { value: null }, uSubj: { value: null }, uR: { value: null }, uSightOn: { value: 0 }, uClip: { value: null }, uClipOn: { value: 0 } });
/** patch an instanced material: collapse instances that rise above the camera->subject line inside the corridor */
function sightPatch(THREE, mat, uniforms, topH) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
uniform vec3 uCam; uniform vec3 uSubj; uniform vec2 uR; uniform float uSightOn; uniform vec4 uClip; uniform float uClipOn;`).replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
if (uClipOn > 0.5) {
  vec4 ic = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  if ((ic.x > uClip.x && abs(ic.z - uClip.y) < uClip.z) || ic.x > uClip.w) transformed *= 0.0;
}
if (uSightOn > 0.5) {
  vec4 io = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sy = length(vec3(instanceMatrix[1].xyz)); float sx = length(vec3(instanceMatrix[0].xyz));
  vec2 d = uSubj.xz - uCam.xz; float L2 = max(dot(d, d), 1e-4);
  float s = dot(io.xz - uCam.xz, d) / L2;
  vec2 q = uCam.xz + d * s; float dist = length(io.xz - q);
  float lineY = mix(uCam.y, uSubj.y, s);
  float top = io.y + ${topH.toFixed(3)} * sy;
  if (s > 0.0 && s < 1.0 && dist < mix(uR.x, uR.y, s) + ${(topH * 0.25).toFixed(3)} * sx && top > lineY - 0.3) transformed *= 0.0;
  ${topH < 2.5 ? `// GATE 2026-11-09 (#3: a fern beside Tobin spread its fronds over his close-up face): a low plant whose own spread
  // reaches the subject collapses (the corridor test above only sees a plant whose ROOT stands between lens and subject)
  if (length(io.xz - uSubj.xz) < ${(topH * 0.6).toFixed(3)} * sx + 0.6 && top > uSubj.y - 0.2) transformed *= 0.0;` : ""}
  // WORLD-FIX: never a lens inside a crown (a track / low camera beside a giant stood in a tree)
  if (length(io.xz - uCam.xz) < ${(topH * 0.7).toFixed(3)} * sx + 3.0 && top > uCam.y - 1.0) transformed *= 0.0; // (GATE 2026-11-09: was 0.4 / 2.0: a wide crown reached over the lens)
}
#endif`);
  };
  mat.customProgramCacheKey = () => `sight${topH.toFixed(2)}${mat.name ?? ""}`;
}

// ------------------------------------------------------------------------------------------------ models -> instanced parts
const CACHE = new Map(); // url -> Promise<{ parts, bounds }>
function partsOf(THREE, root, fix = {}) {
  root.updateMatrixWorld(true); const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const mat = o.material.clone();
    if (mat.transparent || mat.alphaMap || /leaves|leaf|branches|twigs|fern|grass/i.test(mat.name)) { mat.transparent = false; mat.alphaTest = 0.45; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
    if (fix.tint) mat.color.multiply(new THREE.Color(fix.tint));
    parts.push({ geometry: g, material: mat });
  });
  return parts;
}
function boundsOf(THREE, parts) { const b = new THREE.Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox); } return b; }

/** the model's albedo seen from the side, on 3 crossed quads (a far tree: 3 quads instead of ~10k triangles) */
function makeImpostor(THREE, renderer, parts, res = 512) {
  const b = boundsOf(THREE, parts), size = new THREE.Vector3(); b.getSize(size);
  const w = Math.max(size.x, size.z), h = size.y;
  const sc = new THREE.Scene();
  for (const p of parts) sc.add(new THREE.Mesh(p.geometry, new THREE.MeshBasicMaterial({ map: p.material.map, color: p.material.color, alphaTest: 0.45, side: THREE.DoubleSide })));
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const rt = new THREE.WebGLRenderTarget(res, Math.round((res * h) / w), { samples: 4 });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, b.max.y, b.min.y, 0.1, 1000);
  cam.position.set(cx, 0, cz + 500); cam.lookAt(cx, 0, cz);
  const prevTM = renderer.toneMapping, prevRT = renderer.getRenderTarget(), prevCol = new THREE.Color(), prevA = renderer.getClearAlpha(); renderer.getClearColor(prevCol);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevRT); renderer.toneMapping = prevTM; renderer.setClearColor(prevCol, prevA);
  const geos = [0, 1, 2].map((k) => { const pg = new THREE.PlaneGeometry(w, h); pg.translate(0, (b.min.y + b.max.y) / 2, 0); pg.rotateY((k * Math.PI) / 3); return pg; });
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of geos) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor.map((v, i) => (i % 3 === 1 ? 0.6 : v * 0.6)), 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  return [{ geometry: geo, material: new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0.82, 0.86, 0.8) }) }];
}

async function loadModels(ctx) {
  const { THREE } = ctx;
  const out = {};
  await Promise.all(NATURE_MODELS.map(async (n) => {
    const url = `${A}/${n}/${n}.gltf`;
    if (!CACHE.has(url)) CACHE.set(url, ctx.gltf(url).then((root) => { const parts = partsOf(THREE, root, n === "fir_sapling" ? { tint: "#c8d8b0" } : {}); return { parts, bounds: boundsOf(THREE, parts) }; }));
    out[n] = await CACHE.get(url);
  }));
  return out;
}
let IMPOSTORS = null;

// ------------------------------------------------------------------------------------------------ grass clumps
function grassClumpGeometry(THREE, R) {
  const pos = [], col = [], idx = []; let v = 0;
  for (let b = 0; b < 9; b++) {
    const a = R() * Math.PI * 2, r = R() * 0.18, h = 0.35 + R() * 0.45, lean = 0.15 + R() * 0.35, wdt = 0.025 + R() * 0.02;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, dir = R() * Math.PI * 2, dx = Math.cos(dir), dz = Math.sin(dir), px = -dz, pz = dx;
    const base = new THREE.Color().setHSL(0.22 + R() * 0.06, 0.55, 0.12 + R() * 0.05, THREE.SRGBColorSpace), tip = new THREE.Color().setHSL(0.2 + R() * 0.06, 0.5, 0.32 + R() * 0.12, THREE.SRGBColorSpace);
    for (let s = 0; s <= 4; s++) {
      const f = s / 4, w = wdt * (1 - f * 0.92), y = h * f, off = lean * f * f, cx = bx + dx * off, cz = bz + dz * off, c = base.clone().lerp(tip, f);
      pos.push(cx - px * w, y, cz - pz * w, cx + px * w, y, cz + pz * w); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (s < 4) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  return g;
}

// ------------------------------------------------------------------------------------------------ the world
export async function makeNature(ctx, opts = {}) {
  if (PLASTIC_LOOK && opts.style !== "photo") return makeToyNature(ctx, opts);
  const { THREE, renderer } = ctx;
  const seed = opts.seed ?? 3, R = prng(seed * 7919 + 11);
  const center = opts.center ?? { x: 0, z: 0 };
  const flatR = opts.flatR ?? 220, hills = opts.hills !== false;
  const H = (x, z) => terrainHeight(x, z, { flatR, hills, cx: center.x, cz: center.z });
  const clear = opts.clear ?? (() => false);
  const nearR = opts.nearR ?? 230, farR = opts.farR ?? 1500;
  const M = await loadModels(ctx);
  if (!IMPOSTORS) IMPOSTORS = { tree: makeImpostor(THREE, renderer, M.island_tree_02.parts), fir: makeImpostor(THREE, renderer, M.fir_sapling.parts) };
  const group = new THREE.Group(); group.name = "nature";
  const uniforms = SIGHT_UNIFORMS(); uniforms.uCam.value = new THREE.Vector3(); uniforms.uSubj.value = new THREE.Vector3(); uniforms.uR.value = new THREE.Vector2(1.5, 4); uniforms.uClip.value = new THREE.Vector4(1e9, 0, 0, 1e9);
  const hOf = (n) => M[n].bounds.max.y - M[n].bounds.min.y;
  const treeH = hOf("island_tree_02"), firH = hOf("fir_sapling");

  // ground: one big displaced plane, grass and forest dirt mixed by a noise mask (+ a dirt lane where the creature walks)
  const size = Math.max(3200, farR * 2.4), seg = 300;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, mask = new Float32Array(p.count);
  const dirtLane = opts.dirt ?? (() => 0);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + center.x, z = p.getZ(i) + center.z; p.setX(i, x); p.setZ(i, z); p.setY(i, H(x, z) - 0.03);
    const n = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.13 + Math.sin(x * 0.05) * 2);
    mask[i] = Math.min(1, Math.max(0, dirtLane(x, z) + (n - 0.62) * 1.6));
  }
  g.setAttribute("mask", new THREE.BufferAttribute(mask, 1)); g.computeVertexNormals();
  const tl = new THREE.TextureLoader();
  const tx = (url, srgb, rep) => { const t = tl.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rep = size / (opts.groundTile ?? 6);
  const groundMat = new THREE.MeshStandardMaterial({ map: tx("/assets/leafy_grass/diff.jpg", true, rep), normalMap: tx("/assets/leafy_grass/nor.jpg", false, rep), roughness: 1, color: new THREE.Color("#b8d08a") });
  const dirt = tx(`${A}/forest_ground_04/forest_ground_04_diff_1k.jpg`, true, rep * 0.8);
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.dirtMap = { value: dirt };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float mask; varying float vMask; varying vec2 vUv2;").replace("#include <uv_vertex>", `#include <uv_vertex>\nvMask = mask; vUv2 = uv * ${(rep * 0.8).toFixed(2)};`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D dirtMap; varying float vMask; varying vec2 vUv2;").replace("#include <map_fragment>", "#include <map_fragment>\nvec4 dc = texture2D(dirtMap, vUv2); diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb * 1.15, smoothstep(0.2, 0.8, vMask));");
  };
  groundMat.customProgramCacheKey = () => "natureGround";
  const ground = new THREE.Mesh(g, groundMat); ground.receiveShadow = true; ground.name = "ground"; group.add(ground);
  if (opts.water) ground.visible = false;

  // instanced helpers
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  const place = (x, z, s, rot, tilt = 0) => { q.setFromEuler(e.set((R() - 0.5) * tilt, rot, (R() - 0.5) * tilt)); return new THREE.Matrix4().compose(v.set(x, H(x, z) - 0.15 * s, z), q, sv.set(s, s * (0.9 + R() * 0.25), s)).clone(); };
  const sightMats = [];
  const instanced = (parts, mats, { cast = true, receive = true, topH = 1, name = "" } = {}) => {
    const grp = new THREE.Group(); grp.name = name;
    if (!mats.length) return grp;
    for (const part of parts) {
      const mat = part.material.clone(); sightPatch(THREE, mat, uniforms, topH); sightMats.push(mat);
      const im = new THREE.InstancedMesh(part.geometry, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false; grp.add(im);
    }
    group.add(grp); return grp;
  };

  // trees: real ones near the action, impostors far (density thins with distance), never in clear() places
  const near = [], firNear = [], far = [], firFar = [];
  const nTrees = opts.trees ?? 5200;
  for (let i = 0; i < nTrees; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * farR, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (clear(x, z)) continue;
    const isFir = R() < 0.38;
    const s = (isFir ? (10 + R() * 9) / firH : (11 + R() * 8) / treeH) * (opts.treeScale ?? 1); // WORLD-FIX: trees in scale with a giant (a forest, not a savanna)
    const m = place(x, z, s, R() * 6.28, 0.08);
    (r < nearR ? (isFir ? firNear : near) : (isFir ? firFar : far)).push(m);
  }
  instanced(M.island_tree_02.parts, near, { topH: treeH, name: "treesNear" });
  instanced(M.fir_sapling.parts, firNear, { topH: firH, name: "firsNear" });
  instanced(IMPOSTORS.tree, far, { cast: false, topH: treeH, name: "treesFar" });
  instanced(IMPOSTORS.fir, firFar, { cast: false, topH: firH, name: "firsFar" });
  // undergrowth near the action: ferns, mossy rocks, boulders, logs, stumps
  const L = { rock: [], boulder: [], fern: [], log: [], stump: [] };
  const nUnder = opts.ferns ?? 1400, uR = opts.underR ?? Math.min(nearR, 160);
  for (let i = 0; i < nUnder; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * uR, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (clear(x, z) && R() < 0.85) continue;
    if (opts.hardClear?.(x, z)) continue; // GATE 2026-11-09 (#3: a 3 m fern between the lens and Tobin's face): none at all here
    const k = R();
    if (k < 0.07) L.rock.push(place(x, z, 0.8 + R() * 1.4, R() * 6.28, 0.3));
    else if (k < 0.1) L.boulder.push(place(x, z, 0.4 + R() * 0.7, R() * 6.28, 0.3));
    else if (k < 0.12) L.log.push(place(x, z, 1.5 + R(), R() * 6.28));
    else if (k < 0.14) L.stump.push(place(x, z, 1.5 + R(), R() * 6.28));
    else L.fern.push(place(x, z, 1.6 + R() * 1.8, R() * 6.28, 0.2));
  }
  instanced(M.rock_moss_set_01.parts, L.rock, { topH: hOf("rock_moss_set_01"), name: "rocks" });
  instanced(M.boulder_01.parts, L.boulder, { topH: hOf("boulder_01"), name: "boulders" });
  instanced(M.fern_02.parts, L.fern, { topH: hOf("fern_02"), name: "ferns", cast: false });
  instanced(M.dead_tree_trunk.parts, L.log, { topH: hOf("dead_tree_trunk"), name: "logs" });
  instanced(M.tree_stump_01.parts, L.stump, { topH: hOf("tree_stump_01"), name: "stumps" });
  // grass clumps around the action (the camera's ground)
  const nGrass = opts.grass ?? 90000, gR = opts.grassR ?? 90;
  if (nGrass > 0 && !opts.water) {
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    sightPatch(THREE, gm, uniforms, 0.8); sightMats.push(gm);
    const im = new THREE.InstancedMesh(grassClumpGeometry(THREE, prng(seed + 5)), gm, nGrass); let n = 0;
    const gc = opts.grassCenter ?? center;
    for (let i = 0; i < nGrass * 3 && n < nGrass; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * gR, x = gc.x + Math.cos(a) * r, z = gc.z + Math.sin(a) * r;
      if ((opts.noGrass ?? clear)(x, z)) continue;
      if (R() < (r / gR) ** 2) continue; // thins out toward the edge (no hard-edged grass carpet)
      // GATE 2026-11-09 (#3 turtle: knee-high clumps between the lens and a close-up face): opts.lawn(x, z) -> 0..1 scales
      // the clumps (0 = none) where people stand
      const lk = opts.lawn ? opts.lawn(x, z) : 1;
      if (!(lk > 0)) continue;
      const s = (0.7 + R() * 0.9) * (1 - (r / gR) * 0.4) * lk;
      im.setMatrixAt(n++, new THREE.Matrix4().compose(v.set(x, H(x, z) - 0.02, z), q.setFromEuler(e.set(0, R() * 6.28, 0)), sv.set(s, s, s)));
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; im.name = "grass";
    group.add(im);
  }

  return {
    group, groundH: H, uniforms,
    counts: { trees: near.length + firNear.length, impostors: far.length + firFar.length, under: Object.values(L).reduce((s, a) => s + a.length, 0) },
    /** the foreground rule for this frame: subject { pos, height, radius } (or null: everything shows) */
    sight(camera, subject) {
      if (!subject?.pos) { uniforms.uSightOn.value = 0; return; }
      const inv = group.parent ? new THREE.Matrix4().copy(group.parent.matrixWorld) : null; // the shader works in world space
      void inv;
      camera.updateMatrixWorld(); const c = camera.getWorldPosition(new THREE.Vector3());
      const hgt = Math.max(0.5, subject.height ?? 1.7), rad = Math.max(0.4, subject.radius ?? hgt * 0.3);
      // aim at the lower third of the subject (its feet and body stay clear, the town on top always is)
      uniforms.uCam.value.copy(c); uniforms.uSubj.value.set(subject.pos.x, subject.pos.y + hgt * (subject.close ? 0.8 : 0.3), subject.pos.z); // (close: the face, GATE 2026-11-09)
      uniforms.uR.value.set((subject.close ? 1.6 : 1.2) + Math.min(4, c.distanceTo(subject.pos) * 0.01), rad * 0.9 + (subject.close ? 1.8 : 1.5));
      uniforms.uSightOn.value = 1;
    },
    /** FRAMING-FIX: no plants in a region (null: all back). { xMin, zc, halfZ, seaX } */
    clip(r) { if (!r) { uniforms.uClipOn.value = 0; return; } uniforms.uClip.value.set(r.xMin, r.zc, r.halfZ, r.seaX); uniforms.uClipOn.value = 1; },
    update() {},
  };
}

// ------------------------------------------------------------------------------------------------ PLASTIC-WORLD toy nature
/** the toy world (same options + return shape as the photo one): clean shapes, bright colours, no texture */
async function makeToyNature(ctx, opts = {}) {
  const { THREE } = ctx;
  const seed = opts.seed ?? 3, R = prng(seed * 7919 + 11);
  const center = opts.center ?? { x: 0, z: 0 };
  const flatR = opts.flatR ?? 220, hills = opts.hills !== false;
  const H = (x, z) => terrainHeight(x, z, { flatR, hills, cx: center.x, cz: center.z });
  const clear = opts.clear ?? (() => false);
  const nearR = opts.nearR ?? 230, farR = opts.farR ?? 1500;
  const group = new THREE.Group(); group.name = "nature";
  const uniforms = SIGHT_UNIFORMS(); uniforms.uCam.value = new THREE.Vector3(); uniforms.uSubj.value = new THREE.Vector3(); uniforms.uR.value = new THREE.Vector2(1.5, 4); uniforms.uClip.value = new THREE.Vector4(1e9, 0, 0, 1e9);
  const topOf = (parts) => { const b = new THREE.Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox); } return b.max.y; };

  // ground: one smooth bright green, a gentle large-scale shade (never noise), hills a deeper green, the lane a clean path
  const size = Math.max(3200, farR * 2.4), seg = 300;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const dirtLane = opts.dirt ?? (() => 0);
  const cG = new THREE.Color(TOY_GROUND.grass), cG2 = new THREE.Color(TOY_GROUND.grass2), cH = new THREE.Color(TOY_GROUND.hills), cP = new THREE.Color(TOY_GROUND.path), c = new THREE.Color();
  const ss = (a, b, v) => { const u = Math.min(1, Math.max(0, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + center.x, z = p.getZ(i) + center.z, y = H(x, z); p.setX(i, x); p.setZ(i, z); p.setY(i, y - 0.03);
    const n = 0.5 + 0.5 * Math.sin(x * 0.012 + 1.7) * Math.sin(z * 0.01 + 0.3);
    c.copy(cG).lerp(cG2, ss(0.3, 0.8, n)).lerp(cH, ss(6, 40, y)).lerp(cP, ss(0.35, 0.65, dirtLane(x, z)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const groundMat = makePlastic(THREE, "#ffffff", { keepColour: true, vertexColors: true, roughness: 0.55, clearcoat: 0 });
  const ground = new THREE.Mesh(g, groundMat); ground.receiveShadow = true; ground.name = "ground"; group.add(ground);
  if (opts.water) ground.visible = false;

  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  const place = (x, z, s, rot, tilt = 0, sink = 0.15) => { q.setFromEuler(e.set((R() - 0.5) * tilt, rot, (R() - 0.5) * tilt)); return new THREE.Matrix4().compose(v.set(x, H(x, z) - sink * s, z), q, sv.set(s, s * (0.9 + R() * 0.25), s)).clone(); };
  const sightMats = [];
  const instanced = (parts, list, { cast = true, receive = true, topH = 1, name = "", palette = TOY_GREENS } = {}) => {
    const grp = new THREE.Group(); grp.name = name;
    if (!list.length) return grp;
    for (const part of parts) {
      const mat = part.material.clone(); sightPatch(THREE, mat, uniforms, topH); sightMats.push(mat);
      const im = new THREE.InstancedMesh(part.geometry, mat, list.length);
      list.forEach((m, i) => { im.setMatrixAt(i, m.m ?? m); if (part.tint) im.setColorAt(i, c.set(palette[(m.k ?? i) % palette.length])); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false; grp.add(im);
    }
    group.add(grp); return grp;
  };

  // trees: round lollipops, firs and blocky canopies; full detail near the action, low detail far
  const KINDS = ["round", "fir", "blocky"];
  const T = Object.fromEntries(KINDS.map((k) => [k, { near: [], far: [], h: topOf(toyParts(THREE, k, 1)) }]));
  const nTrees = opts.trees ?? 5200;
  for (let i = 0; i < nTrees; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * farR, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (clear(x, z)) continue;
    const kr = R(), kind = kr < 0.5 ? "round" : kr < 0.82 ? "fir" : "blocky";
    const s = ((10 + R() * 8) / T[kind].h) * (opts.treeScale ?? 1);
    T[kind][r < nearR ? "near" : "far"].push({ m: place(x, z, s, R() * 6.28, 0.06, 0.05), k: Math.floor(R() * 97) });
  }
  for (const k of KINDS) {
    instanced(toyParts(THREE, k, 1), T[k].near, { topH: T[k].h, name: `${k}Near` });
    instanced(toyParts(THREE, k, 0), T[k].far, { cast: false, topH: T[k].h, name: `${k}Far` });
  }
  // undergrowth near the action: bushes, stones, logs, stumps
  const L = { rock: [], boulder: [], bush: [], log: [], stump: [] };
  const nUnder = opts.ferns ?? 1400, uR = opts.underR ?? Math.min(nearR, 160);
  for (let i = 0; i < nUnder; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * uR, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (clear(x, z) && R() < 0.85) continue;
    if (opts.hardClear?.(x, z)) continue;
    const k = R(), it = (s, tilt, sink = 0.15) => ({ m: place(x, z, s, R() * 6.28, tilt, sink), k: Math.floor(R() * 97) });
    if (k < 0.07) L.rock.push(it(0.6 + R() * 0.9, 0.2));
    else if (k < 0.1) L.boulder.push(it(1.4 + R() * 1.4, 0.2));
    else if (k < 0.12) L.log.push(it(0.8 + R() * 0.5, 0, 0));
    else if (k < 0.14) L.stump.push(it(0.9 + R() * 0.6, 0, 0));
    else L.bush.push(it(1.2 + R() * 1.3, 0.1, 0.1));
  }
  const tp = (k) => toyParts(THREE, k, 1);
  instanced(tp("rock"), L.rock, { topH: topOf(tp("rock")), name: "rocks" });
  instanced(tp("rock"), L.boulder, { topH: topOf(tp("rock")), name: "boulders" });
  instanced(tp("bush"), L.bush, { topH: topOf(tp("bush")), name: "bushes" });
  instanced(tp("log"), L.log, { topH: topOf(tp("log")), name: "logs" });
  instanced(tp("stump"), L.stump, { topH: topOf(tp("stump")), name: "stumps" });
  // flowers instead of photo grass clumps: little bright dots on the lawn round the action (none where people stand)
  const nFl = opts.flowers ?? Math.min(3000, Math.round((opts.grass ?? 90000) / 15)), gR = opts.grassR ?? 90, fl = [];
  if (nFl > 0 && !opts.water) {
    const gc = opts.grassCenter ?? center;
    for (let i = 0; i < nFl * 3 && fl.length < nFl; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * gR, x = gc.x + Math.cos(a) * r, z = gc.z + Math.sin(a) * r;
      if ((opts.noGrass ?? clear)(x, z) || dirtLane(x, z) > 0.3) continue;
      const lk = opts.lawn ? opts.lawn(x, z) : 1;
      if (!(lk > 0.5)) continue;
      fl.push({ m: place(x, z, 0.8 + R() * 0.7, R() * 6.28, 0.2, 0), k: Math.floor(R() * 97) });
    }
    instanced(tp("flower"), fl, { cast: false, topH: 0.45, name: "flowers", palette: TOY_FLOWERS });
  }

  return {
    group, groundH: H, uniforms,
    counts: { trees: KINDS.reduce((s, k) => s + T[k].near.length, 0), impostors: KINDS.reduce((s, k) => s + T[k].far.length, 0), under: Object.values(L).reduce((s, a) => s + a.length, 0), flowers: fl.length },
    sight(camera, subject) {
      if (!subject?.pos) { uniforms.uSightOn.value = 0; return; }
      camera.updateMatrixWorld(); const cw = camera.getWorldPosition(new THREE.Vector3());
      const hgt = Math.max(0.5, subject.height ?? 1.7), rad = Math.max(0.4, subject.radius ?? hgt * 0.3);
      uniforms.uCam.value.copy(cw); uniforms.uSubj.value.set(subject.pos.x, subject.pos.y + hgt * (subject.close ? 0.8 : 0.3), subject.pos.z);
      uniforms.uR.value.set((subject.close ? 1.6 : 1.2) + Math.min(4, cw.distanceTo(subject.pos) * 0.01), rad * 0.9 + (subject.close ? 1.8 : 1.5));
      uniforms.uSightOn.value = 1;
    },
    clip(r) { if (!r) { uniforms.uClipOn.value = 0; return; } uniforms.uClip.value.set(r.xMin, r.zc, r.halfZ, r.seaX); uniforms.uClipOn.value = 1; },
    update() {},
  };
}

// ------------------------------------------------------------------------------------------------ dust and leaves
function puffTexture(THREE) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), R = prng(11);
  for (let i = 0; i < 40; i++) {
    const px = 64 + (R() - 0.5) * 64, py = 64 + (R() - 0.5) * 56, r = 16 + R() * 30;
    const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, "rgba(255,255,255,0.26)"); gr.addColorStop(0.6, "rgba(235,235,235,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let PUFF = null;
/**
 * puffy grey dust: bursts [{ t0, pos: Vector3, n, spread, rise, size, dur, alpha, color, dir }] -> { group, update(t) }
 * (owner: "puffier, greyer" than the style test: more and bigger lobes, a grey-beige, slower to fade)
 */
export function makeDust(THREE, bursts, { seed = 5, max = 600 } = {}) {
  PUFF ??= puffTexture(THREE);
  const group = new THREE.Group(); group.name = "dust"; const sprites = []; const R = prng(seed);
  for (const b of bursts) for (let i = 0; i < b.n && sprites.length < max; i++) {
    const mat = new THREE.SpriteMaterial({ map: PUFF, color: new THREE.Color(b.color ?? (PLASTIC_LOOK ? "#d4d8e2" : "#a49d93")), transparent: true, depthWrite: false, opacity: 0, fog: true });
    const s = new THREE.Sprite(mat); s.visible = false; s.raycast = () => {}; group.add(s); // camera.js ray checks skip dust (a Sprite needs raycaster.camera)
    const a = R() * Math.PI * 2, sp = (0.4 + R()) * b.spread;
    sprites.push({ s, b, dt: R() * (b.dur ?? 0.8), vx: Math.cos(a) * sp + (b.dir?.x ?? 0), vz: Math.sin(a) * sp + (b.dir?.z ?? 0), vy: (0.3 + R()) * b.rise, size: b.size * (0.7 + R() * 0.9), life: 2.8 + R() * 2.2, rot: R() * 6 });
  }
  return {
    group,
    update(t) {
      for (const p of sprites) {
        const age = t - p.b.t0 - p.dt;
        if (age < 0 || age > p.life) { p.s.visible = false; continue; }
        const k = 1 - Math.exp(-age * 1.1);
        p.s.visible = true;
        p.s.position.set(p.b.pos.x + p.vx * k * 2.4, p.b.pos.y + p.vy * k * 2.4 + 0.3, p.b.pos.z + p.vz * k * 2.4);
        const sc = p.size * (0.6 + 1.9 * k); p.s.scale.set(sc, sc * 0.85, 1);
        p.s.material.rotation = p.rot + age * 0.15;
        p.s.material.opacity = Math.min(1, age * 4) * (1 - age / p.life) ** 1.3 * (p.b.alpha ?? 0.7);
      }
    },
  };
}
/** leaves and twigs flying from a smashed / eaten tree: bursts [{ t0, pos, n, h, dir }] -> { group, update(t) } */
export function makeLeaves(THREE, bursts, { seed = 9 } = {}) {
  const total = Math.max(1, bursts.reduce((s, b) => s + b.n, 0));
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshStandardMaterial({ color: "#ffffff", side: THREE.DoubleSide, roughness: 0.8 }), total);
  im.frustumCulled = false; im.name = "leaves";
  const R = prng(seed), P = [];
  for (const b of bursts) for (let i = 0; i < b.n; i++) { const a = R() * 6.28; P.push({ b, vx: Math.cos(a) * (2 + R() * 5) + (b.dir?.x ?? 0), vz: Math.sin(a) * (2 + R() * 5) + (b.dir?.z ?? 0), vy: 3 + R() * 8, y0: (b.h ?? 8) * (0.4 + R() * 0.6), spin: R() * 10, c: PLASTIC_LOOK ? new THREE.Color(TOY_GREENS[Math.floor(R() * TOY_GREENS.length)]) : new THREE.Color().setHSL(0.2 + R() * 0.1, 0.6, 0.18 + R() * 0.2, THREE.SRGBColorSpace), s: 0.6 + R() * 1.6 }); }
  P.forEach((p, i) => im.setColorAt(i, p.c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  return {
    group: im,
    update(t) {
      P.forEach((p, i) => {
        const age = t - p.b.t0;
        if (age < 0 || age > 4) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); return; }
        const drag = 1 - Math.exp(-age * 1.5);
        v.set(p.b.pos.x + (p.vx * drag) / 1.5, Math.max(p.b.pos.y + 0.05, p.b.pos.y + p.y0 + (p.vy * drag) / 1.5 - 2.2 * age * age), p.b.pos.z + (p.vz * drag) / 1.5);
        q.setFromEuler(e.set(p.spin * age, p.spin * age * 0.7, 0)); sc.setScalar(p.s);
        m.compose(v, q, sc); im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
