// Smooth diorama ground: one continuous grass surface with a rounded lip, a cut face and pit walls painted by
// a world-space strata shader (wavy, noisy bands), and irregular clay-crumb clumps. Shared by the style frames
// and the preview.
import * as THREE from "three";

const GLSL_NOISE = `
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
const lin = (hex) => new THREE.Color(hex); // THREE.Color stores linear values

function patch(material, uniforms, fragHead, colorCode) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\n" + GLSL_NOISE + fragHead)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + colorCode);
  };
  material.customProgramCacheKey = () => JSON.stringify(Object.keys(uniforms)) + fragHead.length;
  return material;
}

// S: { noise, speck, wave, colors:{sod,dirt,deep,clay,gravel,water,rock}, grass:{base,var,fine}, rough }
export function soilMaterial(S) {
  const C = S.colors;
  const u = {
    cSod: { value: lin(C.sod) }, cDirt: { value: lin(C.dirt) }, cDeep: { value: lin(C.deep) }, cClay: { value: lin(C.clay) },
    cGravel: { value: lin(C.gravel) }, cWater: { value: lin(C.water) }, cRock: { value: lin(C.rock) },
    uNoise: { value: S.noise }, uSpeck: { value: S.speck }, uWave: { value: S.wave },
    // leak: column half-width, front depth (y), strength; groundwater murk: centre x, radius, strength
    uLeak: { value: new THREE.Vector4(3.0, 0, 0, 0) }, uLeak2: { value: new THREE.Vector4(1.5, 0, 0, 0) }, uMurk: { value: new THREE.Vector3(0, 0, 0) },
    cLeak: { value: lin("#4b3b1a") }, cMurk: { value: lin("#6b6420") }, uTime: { value: 0 },
  };
  const head = `
uniform vec3 cSod, cDirt, cDeep, cClay, cGravel, cWater, cRock, cLeak, cMurk;
uniform float uNoise, uSpeck, uWave, uTime;
uniform vec4 uLeak, uLeak2; uniform vec3 uMurk;
vec3 strata(vec3 p, out float waterMask){
  float w = uWave * (0.32 * sin(p.x * 0.42 + p.z * 0.3) + 0.18 * sin(p.x * 1.25 + 1.7) + 0.5 * (vnoise(p * 0.35) - 0.5));
  float y = p.y + w;
  vec3 c = cRock;
  waterMask = smoothstep(-14.15, -13.9, y) * (1.0 - smoothstep(-11.12, -10.88, y));
  c = mix(c, cWater, smoothstep(-14.15, -13.9, y));
  c = mix(c, cGravel, smoothstep(-11.12, -10.88, y));
  c = mix(c, cClay, smoothstep(-10.12, -9.88, y));
  c = mix(c, cDeep, smoothstep(-7.62, -7.38, y));
  c = mix(c, cDirt, smoothstep(-3.62, -3.38, y));
  c = mix(c, cSod, smoothstep(-0.62, -0.42, y));
  float n = vnoise(p * 1.6) * 0.6 + vnoise(p * 4.5) * 0.4;
  c *= 1.0 + (n - 0.5) * uNoise;
  vec3 pc = p * 3.2; vec3 cellId = floor(pc); float dc = length(fract(pc) - 0.5 - 0.25 * (vec3(hash3(cellId), hash3(cellId + 7.1), hash3(cellId + 3.3)) - 0.5));
  float pebble = step(1.0 - uSpeck * 3.0 * (1.0 + 2.0 * step(-11.0, y) * (1.0 - step(-10.0, y))), hash3(cellId + 1.7)) * (1.0 - smoothstep(0.16, 0.22, dc));
  c *= 1.0 - pebble * 0.22;
  // groundwater: gentle lighter ripples
  c += waterMask * cWater * 0.12 * (0.5 + 0.5 * sin(p.x * 2.2 + sin(p.y * 3.0) * 1.5 + uTime * 1.5));
  return c;
}`;
  const code = `
float wm; vec3 sc = strata(vWPos, wm);
// leak column(s) under the pit: darkens soil from the pit floor (-6) down to the front depth
float ax = abs(vWPos.x);
float col1 = (1.0 - smoothstep(uLeak.x - 0.6, uLeak.x + 0.4, ax + 0.4 * (vnoise(vWPos * 0.9) - 0.5))) * step(vWPos.y, -5.9) * smoothstep(uLeak.y - 0.6, uLeak.y + 0.3, vWPos.y) * step(-6.6, vWPos.z) * (1.0 - wm);
float col2 = (1.0 - smoothstep(uLeak2.x - 0.4, uLeak2.x + 0.3, ax + 0.3 * (vnoise(vWPos * 1.1) - 0.5))) * step(vWPos.y, -5.9) * smoothstep(uLeak2.y - 0.5, uLeak2.y + 0.3, vWPos.y) * step(-6.6, vWPos.z) * (1.0 - wm);
sc = mix(sc, cLeak, clamp(col1 * uLeak.z + col2 * uLeak2.z, 0.0, 0.9));
float md = length(vec2(vWPos.x - uMurk.x, (vWPos.z + 3.0) * 0.6)) + (-11.0 - vWPos.y) * 0.9 + vnoise(vWPos * 0.7) * 1.2;
sc = mix(sc, cMurk, wm * clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);
diffuseColor.rgb = sc;`;
  const m = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: S.rough ?? 0.92, side: THREE.DoubleSide }), u, head, code);
  m.userData.u = u;
  return m;
}

export function grassMaterial(S) {
  const g = S.grass;
  const u = { cGrass: { value: lin(g.base) }, cGrass2: { value: lin(g.alt) }, uVar: { value: g.var }, uFine: { value: g.fine }, uStripes: { value: g.stripes ?? 0 } };
  const head = `uniform vec3 cGrass, cGrass2; uniform float uVar, uFine, uStripes;`;
  const code = `
vec3 p = vWPos;
float big = vnoise(p * 0.08) * 0.6 + vnoise(p * 0.25) * 0.4;
vec3 gc = mix(cGrass, cGrass2, smoothstep(0.35, 0.75, big) * uVar * 4.0);
gc *= 1.0 + (vnoise(p * 3.0) - 0.5) * uFine + (vnoise(p * 9.0) - 0.5) * uFine * 0.6;
gc *= 1.0 + uStripes * (step(0.5, fract(p.x * 0.18)) - 0.5) * 0.08;
// the rounded lip turns to sod where it bends down
gc = mix(gc, vec3(0.16, 0.09, 0.04), smoothstep(-0.12, -0.32, p.y));
diffuseColor.rgb = gc;`;
  return patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), u, head, code);
}

// grid helper: xs, ys arrays; keep(cx, cy) filters cells; map(x, y) -> [X, Y, Z]
function grid(xs, ys, keep, map) {
  const pos = [], idx = [], id = new Map();
  const vid = (i, j) => { const k = i * 100000 + j; if (!id.has(k)) { id.set(k, pos.length / 3); pos.push(...map(xs[i], ys[j])); } return id.get(k); };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    if (!keep(cx, cy)) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const range = (a, b, step) => { const out = []; for (let v = a; v < b - 1e-6; v += step) out.push(+v.toFixed(4)); out.push(b); return out; };
const merge = (...arrs) => [...new Set(arrs.flat().map((v) => +v.toFixed(4)))].sort((p, q) => p - q);

// The ground: x -X..X, z -D..0 (cut face at z = 0), pit x0..x1, z0..0, depth. Rounded lip radius r.
export function buildGround(scene, S, { X = 22, D = 16, BOTTOM = -26, pit = { x0: -5, x1: 5, z0: -8, depth: 6 }, r = 0.35 } = {}) {
  const soil = soilMaterial(S), grass = grassMaterial(S);
  const inPit = (x, z) => x > pit.x0 && x < pit.x1 && z > pit.z0;
  // distance from a top-surface point to the nearest open edge (front edge or pit rim)
  const edgeDist = (x, z) => {
    const df = -z;
    const dx = Math.max(pit.x0 - x, 0, x - pit.x1), dz = Math.max(pit.z0 - z, 0);
    const dp = inPit(x, z) ? 0 : Math.hypot(dx, dz);
    return Math.min(df, dp);
  };
  const lip = (d) => (d >= r ? 0 : -(r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)))));
  const xs = merge(range(-X, X, 0.2), range(pit.x0 - r, pit.x0 + 0.01, r / 6), range(pit.x1 - 0.01, pit.x1 + r, r / 6), [pit.x0, pit.x1]);
  const zs = merge(range(-D, 0, 0.2), range(pit.z0 - r, pit.z0, r / 6), range(-r, 0, r / 6));
  const top = new THREE.Mesh(grid(xs, zs, (x, z) => !inPit(x, z), (x, z) => [x, lip(edgeDist(x, z)), z]), grass);
  top.receiveShadow = true; scene.add(top);
  // cut face (z = 0) with the pit notch, and the pit's back and side walls
  const fy = merge(range(BOTTOM, -pit.depth, 0.5), range(-pit.depth, -r, 0.25));
  const fx = merge(range(-X, X, 0.25), [pit.x0, pit.x1]);
  const face = new THREE.Mesh(grid(fx, fy, (x, y) => !(x > pit.x0 && x < pit.x1 && y > -pit.depth), (x, y) => [x, y, 0]), soil);
  face.receiveShadow = true; scene.add(face);
  const wy = range(-pit.depth, -r, 0.25);
  const back = new THREE.Mesh(grid(range(pit.x0, pit.x1, 0.25), wy, () => true, (x, y) => [x, y, pit.z0]), soil);
  const left = new THREE.Mesh(grid(range(pit.z0, 0, 0.25), wy, () => true, (z, y) => [pit.x0, y, z]), soil);
  const right = new THREE.Mesh(grid(range(pit.z0, 0, 0.25), wy, () => true, (z, y) => [pit.x1, y, z]), soil);
  // the soil and grass materials are double-sided, so wall winding does not matter

  const floor = new THREE.Mesh(grid(range(pit.x0, pit.x1, 0.25), range(pit.z0, 0, 0.25), () => true, (x, z) => [x, -pit.depth, z]), soil);
  for (const m of [back, left, right, floor]) { m.receiveShadow = true; m.castShadow = false; scene.add(m); }

  // lawn beyond, same grass shader (world-space) so it is continuous
  for (const [w, d, x, z] of [[1600, 1200, 0, -D - 600], [800, D, -X - 400, -D / 2], [800, D, X + 400, -D / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grass); p.rotation.x = -Math.PI / 2; p.position.set(x, -0.001, z); p.receiveShadow = true; scene.add(p);
  }
  return { soil, grass, top, face, walls: { back, left, right, floor } };
}

// irregular rounded clumps (clay crumbs): a few icosphere variants with noisy radii
export function clumpGeometries(n = 4, seed = 3) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.IcosahedronGeometry(0.5, 2);
    const p = g.attributes.position, v = new THREE.Vector3();
    const a = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const f = 1 + 0.18 * Math.sin(v.x * 5 + a[0]) * Math.sin(v.y * 4 + a[1]) + 0.12 * Math.sin(v.z * 6 + a[2]);
      v.multiplyScalar(f); v.y *= 0.82; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); out.push(g);
  }
  return out;
}

// a smooth mound (the dirt pile), scaled with the dig progress
export function moundGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 1 + 0.08 * Math.sin(v.x * 7) * Math.cos(v.z * 6); p.setXYZ(i, v.x * f, v.y * 0.55 * f, v.z * f); }
  g.computeVertexNormals(); return g;
}
