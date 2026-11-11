// Kit: water bodies (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "water"). A "waterBody" part fills the
// ground (a terrain part's, or the flat yard's) up to its level between x0 and x1: the sea against a coast, a river in a
// gorge or a riverbed, a lake behind a dam, a pool. Its surface ripples (waves on the sea), and its section shows as a
// see-through band in the cut face down to the ground under it, so a river in a gorge or the sea at a cliff reads.
// Channels: level (rise / fall / flood, metres), dirty, freeze, flow. Pure functions first (Node), the builder last.
import { WORLD, terrainModel } from "./terrain.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const WATER_COLORS = Object.freeze({ sea: "#1f6fc2", river: "#2b86c9", lake: "#2f7fd0", pool: "#3fb4e6" });

/** the water's settings with their defaults; the sea reaches the horizon on its open side */
export function waterSpec(p = {}) {
  const body = ["sea", "river", "lake", "pool"].includes(p.body) ? p.body : "river";
  let x0 = num(p.x0, -6), x1 = num(p.x1, 6);
  if (body === "sea") { if (x0 <= -WORLD.X + 0.5) x0 = -WORLD.FAR; if (x1 >= WORLD.X - 0.5) x1 = WORLD.FAR; }
  return { body, x0, x1, level: num(p.level, -1), z0: num(p.z0, body === "sea" ? -WORLD.FAR : -WORLD.D), depth: num(p.depth, 3), waves: p.waves ?? body === "sea", color: p.color ?? WATER_COLORS[body], murky: !!p.murky, rise: num(p.rise, 1.5), flood: num(p.flood, 3) };
}

/** the box the camera frames: the section of the water at the face, from its bed (the terrain, or depth below) to its level */
export function waterBox(p = {}, terrain = null) {
  const s = waterSpec(p), T = terrain ? terrainModel(terrain) : null;
  const xa = Math.max(s.x0, -WORLD.X), xb = Math.min(s.x1, WORLD.X);
  let bed = s.level - s.depth;
  if (T) { bed = s.level; for (let x = xa; x <= xb; x += 0.5) bed = Math.min(bed, T.top(x)); }
  return { min: [xa, bed - 0.2, -6], max: [xb, s.level + Math.max(0, s.flood) * 0 + 0.3, 0.2] };
}

// ---------------- the one water look (custom layouts) ----------------
// The owner's rule 17 of 2026-11-11 (the competitor look round): ONE good water look everywhere water appears, like the
// competitor storm drain, sewer and well: tinted (clear blue-green; murky / brown / grey stay as tints), reflective (the
// environment with Fresnel), a moving surface (wave sines + noise, deterministic in t), foam where water falls in,
// ripples where drops land; moving water is streams and drops (translucent sheets with streaks running along them),
// never solid tubes or chains of balls; dirt spreads as a plume. Only for custom layouts: a premade (ctx.premade, set by
// m2/runtime.js from layout.approved === true) keeps every approved material exactly as it was.

/** true when the new look applies: ctx.premade is set false by m2/runtime.js for a custom layout before any part is
 *  built (a page or test without the flag keeps the old look, never the new one by accident) */
// (?water=0 on the page turns it off for a cost or look comparison on the same layout, a debug switch only)
export const waterNew = (ctx) => !!ctx && ctx.premade === false && !(typeof location !== "undefined" && /[?&]water=0(&|$)/.test(location.search ?? ""));

// the tints of the new look (the competitor's water is blue-green and clear, deeper parts darker)
export const WATER_TINTS = Object.freeze({ clean: "#2c93a8", pool: "#3db3c4", sea: "#1f7f9a", river: "#2a8a98", lake: "#2a86a0", deep: "#0f4f63", murky: "#6b5a3a", foam: "#eef4f2" });

/** the clock every water shader reads: one uniform per page, set from the timeline's t by each water part's update (the
 *  same t for all parts in a frame, so a still at t is the same every time) */
export function waterClock(ctx) {
  if (!ctx.__waterT) ctx.__waterT = { value: 0 };
  return { u: ctx.__waterT, set(t) { const v = Number(t); if (Number.isFinite(v)) ctx.__waterT.value = v; } };
}

const GLSL_NOISE = `
float wHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float wFbm(vec2 p) { return 0.55 * wNoise(p) + 0.3 * wNoise(p * 2.03 + 7.1) + 0.15 * wNoise(p * 4.1 + 3.7); }
`;
const VERT_WP = (sh) => {
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
    .replace("#include <project_vertex>", "#include <project_vertex>\n#ifdef USE_INSTANCING\nvWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif");
};
const C3 = (THREE, v, d) => new THREE.Color(typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d);

/**
 * A water surface / volume material: MeshPhysical (environment reflections) with a moving normal (waves + noise along
 * the flow), drop ripples, Fresnel opacity, foam, a dirt plume, and for a volume seen in section a deeper tint with
 * depth and a bright line at the surface. Its knobs: material.userData.water.set({ top, plume: [x, z, radius, amount],
 * foam, ripple }) each frame.
 */
export function waterMaterial(ctx, o = {}) {
  const { THREE } = ctx, clock = waterClock(ctx);
  const color = C3(THREE, o.color, WATER_TINTS.clean);
  const m = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: o.opacity ?? 0.62, roughness: o.roughness ?? 0.04, metalness: 0, ior: 1.33, envMapIntensity: o.env ?? 1.0, depthWrite: o.depthWrite ?? false, side: o.side ?? THREE.FrontSide });
  const U = {
    uWT: clock.u, uWaves: { value: o.waves ?? 1 }, uFlow: { value: new THREE.Vector2(...(o.flow ?? [0.15, 0.05])) }, uRipple: { value: o.ripple ?? 0 },
    uFoam: { value: o.foam ?? 0 }, uPlume: { value: new THREE.Vector4(0, 0, 0, 0) }, uDirtyC: { value: C3(THREE, o.dirtyColor, WATER_TINTS.murky) },
    uSection: { value: o.section ? 1 : 0 }, uTopY: { value: o.top ?? 0 }, uDeepC: { value: C3(THREE, o.deep, WATER_TINTS.deep) }, uDepth: { value: o.depthScale ?? 2.5 },
    uFresnel: { value: o.fresnel ?? 0.75 }, uScale: { value: o.scale ?? 1 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    VERT_WP(sh);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vWp;
uniform float uWT, uWaves, uRipple, uFoam, uSection, uTopY, uDepth, uFresnel, uScale; uniform vec2 uFlow; uniform vec4 uPlume; uniform vec3 uDirtyC, uDeepC;
${GLSL_NOISE}`).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{
  vec3 wN = inverseTransformDirection(normal, viewMatrix);
  float up = smoothstep(0.35, 0.8, abs(wN.y)), side = 1.0 - up;
  vec2 q = (vWp.xz - uFlow * uWT) / uScale;
  vec2 g = vec2(0.0);
  g += 0.9 * vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6)) * 2.1 + uWT * 1.3);
  g += 0.6 * vec2(-0.5, 0.85) * cos(dot(q, vec2(-0.5, 0.85)) * 3.3 + uWT * 1.7);
  g += 0.4 * vec2(0.95, -0.3) * cos(dot(q, vec2(0.95, -0.3)) * 5.9 + uWT * 2.3);
  vec2 nq = q * 1.7; float n0 = wFbm(nq);
  g += vec2(wFbm(nq + vec2(0.15, 0.0)) - n0, wFbm(nq + vec2(0.0, 0.15)) - n0) * 4.5;
  if (uRipple > 0.0) {
    // drops landing: one ring per 0.9 m cell, each on its own phase (a hash of the cell, so the same at the same t)
    vec2 P = vWp.xz / 0.9, b = floor(P - 0.5);
    for (int j = 0; j < 4; j++) {
      vec2 c = b + vec2(float(j - (j / 2) * 2), float(j / 2));
      float h = wHash(c), ph = fract(uWT * 0.85 + h * 7.0);
      vec2 ctr = c + 0.2 + 0.6 * vec2(h, wHash(c + 3.1));
      vec2 dv = P - ctr; float d = length(dv) + 1e-4, r = ph * 0.55;
      float ring = sin((d - r) * 38.0) * exp(-pow((d - r) * 11.0, 2.0)) * (1.0 - ph);
      g += dv / d * ring * 3.0 * uRipple;
    }
  }
  vec3 gw = vec3(-g.x, 0.0, -g.y) * up * uWaves * 0.22;
  normal = normalize(normal + (viewMatrix * vec4(gw, 0.0)).xyz);
  // a volume in section: darker with depth, light caustics drifting on the face, a bright line at the surface
  if (uSection > 0.5) {
    float dep = clamp((uTopY - vWp.y) / uDepth, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, uDeepC, dep * 0.65 * side);
    float ca = wFbm(vWp.xy * 1.3 + vec2(0.0, uWT * 0.25)); ca = pow(ca, 3.0) * 1.6;
    diffuseColor.rgb += vec3(0.55, 0.75, 0.8) * ca * 0.12 * side * (1.0 - dep);
    float line = (1.0 - smoothstep(0.0, 0.07, abs(uTopY - vWp.y))) * side;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.96, 1.0), line * 0.65); diffuseColor.a = max(diffuseColor.a, line * 0.9);
  }
  // dirt: a plume spreading from its source with a ragged, drifting edge
  if (uPlume.w > 0.001) {
    float pd = length(vWp.xz - uPlume.xy) + (wFbm(vWp.xz * 0.45 - uFlow * uWT * 0.6) - 0.5) * uPlume.z * 0.7;
    float pk = (1.0 - smoothstep(uPlume.z * 0.65, uPlume.z, pd)) * clamp(uPlume.w * 1.5, 0.0, 1.0);
    pk *= 0.8 + 0.2 * wFbm(vWp.xz * 1.2 + uWT * 0.2);
    diffuseColor.rgb = mix(diffuseColor.rgb, uDirtyC, pk); diffuseColor.a = mix(diffuseColor.a, 0.93, pk); roughnessFactor = mix(roughnessFactor, 0.3, pk);
  }
  if (uFoam > 0.0) {
    float fm = smoothstep(0.52, 0.72, wFbm(q * 2.6)) * uFoam * up;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.93), fm); diffuseColor.a = mix(diffuseColor.a, 0.97, fm); roughnessFactor = mix(roughnessFactor, 0.7, fm);
  }
  float fr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 4.0);
  diffuseColor.a = mix(diffuseColor.a, 1.0, fr * uFresnel);
}`);
  };
  m.customProgramCacheKey = () => "water2";
  m.userData.water = {
    U, clock,
    set({ top, plume, foam, ripple } = {}) {
      if (Number.isFinite(top)) U.uTopY.value = top;
      if (Array.isArray(plume)) U.uPlume.value.set(...[0, 1, 2, 3].map((i) => (Number.isFinite(plume[i]) ? plume[i] : 0)));
      if (Number.isFinite(foam)) U.uFoam.value = foam;
      if (Number.isFinite(ripple)) U.uRipple.value = ripple;
    },
  };
  return m;
}

/**
 * A ribbon along a path of points (a stream, a pour, the water in a pipe seen in section): u = metres along, v = 0..1
 * across (attribute wuv), normals bent out at the edges so it shines like a rounded stream. side(t, p) may give the
 * across vector, lift(t, p) a shift of the centre line. Returns { geo, length, curve }.
 */
export function ribbonGeometry(THREE, pts, width, { side = null, lift = null, samples = null, sharp = false } = {}) {
  const P = pts.length >= 2 ? pts : [pts[0], pts[0].clone().add(new THREE.Vector3(0.01, 0, 0))];
  // (sharp: a polyline kept straight between its points, a pipe's run; otherwise a smooth curve through them)
  const curve = sharp || P.length === 2 ? (() => { const c = new THREE.CurvePath(); for (let i = 0; i < P.length - 1; i++) c.add(new THREE.LineCurve3(P[i], P[i + 1])); return c; })() : new THREE.CatmullRomCurve3(P, false, "catmullrom", 0.1);
  const L = Math.max(0.01, curve.getLength()), n = samples ?? Math.max(8, Math.min(400, Math.round(L * 8)));
  const pos = [], nor = [], uv = [], idx = [], up = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= n; i++) {
    const u = Math.min(1, i / n), p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
    let s = side ? side(t, p) : null;
    if (!s) {
      // across: level for water running along the ground; facing the camera (+z) where it falls
      const a = new THREE.Vector3().crossVectors(t, up), b = new THREE.Vector3().crossVectors(t, Z);
      // (never quite flat: tilted half toward the viewer, a level stream seen from the side was a hairline, 2026-11-11)
      const k = Math.max(0.5, Math.min(1, Math.max(0, (Math.abs(t.y) - 0.45) / 0.4)));
      s = a.lengthSq() < 1e-6 ? b.normalize() : a.normalize().multiplyScalar(1 - k).add(b.lengthSq() < 1e-6 ? new THREE.Vector3() : b.normalize().multiplyScalar(k));
      if (s.lengthSq() < 1e-6) s.set(1, 0, 0);
      s.normalize();
    }
    const w = typeof width === "function" ? width(u) : width, f = new THREE.Vector3().crossVectors(s, t).normalize();
    if (f.y + f.z < 0) f.negate();
    const c = lift ? p.clone().add(lift(t, p)) : p;
    for (const e of [-1, 1]) {
      pos.push(c.x + s.x * w * 0.5 * e, c.y + s.y * w * 0.5 * e, c.z + s.z * w * 0.5 * e);
      const nn = f.clone().addScaledVector(s, e * 0.75).normalize(); nor.push(nn.x, nn.y, nn.z);
      uv.push(u * L, e < 0 ? 0 : 1);
    }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute("wuv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo, length: L, curve };
}

/** moving water on a ribbon: streaks running along it at `speed` m/s, ragged edges, a bright core; set({ on, reach,
 *  from }) shows it from `from` to `reach` metres along (a pour that has got so far, a pipe built so far) */
export function streamMaterial(ctx, o = {}) {
  const { THREE } = ctx, clock = waterClock(ctx);
  const m = new THREE.MeshPhysicalMaterial({ color: C3(THREE, o.color, WATER_TINTS.clean), transparent: true, opacity: o.opacity ?? 0.7, roughness: o.roughness ?? 0.05, ior: 1.33, envMapIntensity: o.env ?? 1.3, depthWrite: false, side: THREE.DoubleSide });
  const U = { uWT: clock.u, uOn: { value: 1 }, uReach: { value: 1e6 }, uFrom: { value: 0 }, uSpeed: { value: o.speed ?? 2.5 }, uStreak: { value: o.streak ?? 0.55 }, uFadeEnd: { value: o.fadeEnd ?? 0 }, uLen: { value: o.length ?? 1e6 }, uEdge: { value: o.edge ?? 0.62 }, uWhite: { value: C3(THREE, o.streakColor, "#eef7fa") } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 wuv;\nvarying vec2 vWuv;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWuv = wuv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec2 vWuv; uniform float uWT, uOn, uReach, uFrom, uSpeed, uStreak, uFadeEnd, uLen, uEdge; uniform vec3 uWhite;
${GLSL_NOISE}`).replace("#include <color_fragment>", `#include <color_fragment>
{
  float u = vWuv.x, v = vWuv.y, a = abs(v * 2.0 - 1.0), s = u - uWT * uSpeed;
  if (u > uReach || u < uFrom) discard;
  float st = smoothstep(0.42, 0.85, wNoise(vec2(v * 11.0, s * 0.9))) * 0.7 + smoothstep(0.6, 0.95, wNoise(vec2(v * 23.0 + 5.0, s * 2.3))) * 0.5;
  float edge = 1.0 - smoothstep(uEdge - 0.3 * wNoise(vec2(s * 2.7, v * 3.0)), 1.0, a);
  diffuseColor.rgb = mix(diffuseColor.rgb, uWhite, clamp(st, 0.0, 1.0) * uStreak);
  diffuseColor.rgb += 0.06 * (1.0 - a);
  float tip = uReach < 1e5 ? 1.0 - smoothstep(uReach - 0.35, uReach, u) : 1.0;
  float tail = uFadeEnd > 0.0 ? 1.0 - smoothstep(uLen - uFadeEnd, uLen, u) : 1.0;
  diffuseColor.a *= edge * uOn * (0.75 + 0.35 * st) * tip * tail;
  if (diffuseColor.a < 0.02) discard;
}`);
  };
  m.customProgramCacheKey = () => "stream2";
  m.userData.stream = { U, set({ on, reach, from } = {}) { if (Number.isFinite(on)) U.uOn.value = on; if (Number.isFinite(reach)) U.uReach.value = reach; if (Number.isFinite(from)) U.uFrom.value = from; } };
  return m;
}

/** foam where water falls in: a churning white patch with ripple rings spreading from it, on a flat disc of radius r
 *  at `at` (its y = the water or ground it lands on). set(on) */
export function foamPatch(ctx, { at = [0, 0, 0], r = 0.6, rings = true } = {}) {
  const { THREE } = ctx, clock = waterClock(ctx);
  const geo = new THREE.CircleGeometry(r * (rings ? 2.2 : 1.2), 40); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(WATER_TINTS.foam), roughness: 0.6, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const U = { uWT: clock.u, uOn: { value: 0 }, uC: { value: new THREE.Vector3(at[0], at[1], at[2]) }, uR: { value: r }, uRings: { value: rings ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U); VERT_WP(sh);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vWp; uniform float uWT, uOn, uR, uRings; uniform vec3 uC;
${GLSL_NOISE}`).replace("#include <color_fragment>", `#include <color_fragment>
{
  vec2 d = (vWp.xz - uC.xz) / uR; float r = length(d);
  float churn = wFbm(d * 3.0 + vec2(uWT * 1.7, -uWT * 1.3)) + 0.35 * wNoise(d * 9.0 - uWT * 4.0);
  float foam = smoothstep(0.7, 1.0, churn + 0.45 * (1.0 - r)) * (1.0 - smoothstep(0.75, 1.1, r));
  float rings = 0.0;
  for (int j = 0; j < 3; j++) { float ph = fract(uWT * 0.7 + float(j) / 3.0), rr = 0.6 + ph * 1.5; rings += exp(-pow((r - rr) * 4.0, 2.0)) * (1.0 - ph) * 0.16; }
  diffuseColor.a = clamp(foam * 0.8 + rings * uRings, 0.0, 0.8) * uOn;
  if (diffuseColor.a < 0.02) discard;
}`);
  };
  m.customProgramCacheKey = () => "foam2";
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(at[0], at[1] + 0.015, at[2]); mesh.renderOrder = 6; mesh.visible = false; ctx.scene.add(mesh);
  return { mesh, set(on) { const k = Math.min(1, Math.max(0, Number(on) || 0)); U.uOn.value = k; mesh.visible = k > 0.01; } };
}

/** small clear droplets flying from a point (a splash where a pour lands, a spray): each one stretched along its flight;
 *  deterministic in t (a hash per drop, never the shared random numbers). set(t, on) */
export function droplets(ctx, { at = [0, 0, 0], n = 18, size = 0.035, spread = 0.7, height = 0.9, color = "#d6eef5", speed = 1.3, opacity = 0.8 } = {}) {
  const { THREE } = ctx;
  const mat = new THREE.MeshPhysicalMaterial({ color: C3(THREE, color, "#d6eef5"), roughness: 0.05, transparent: true, opacity, envMapIntensity: 1.5, depthWrite: false });
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat, n); im.renderOrder = 6; im.frustumCulled = false; ctx.scene.add(im);
  const h = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const D = Array.from({ length: n }, (_, i) => ({ a: h(i, 1) * Math.PI * 2, sp: 0.4 + h(i, 2) * 0.6, up: 0.5 + h(i, 3) * 0.5, ph: h(i, 4), s: size * (0.6 + h(i, 5) * 0.8) }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), vel = new THREE.Vector3();
  return {
    mesh: im,
    set(t, on) {
      const k = Math.min(1, Math.max(0, Number(on) || 0));
      D.forEach((d, i) => {
        if (k < 0.02) { im.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
        const f = (t * speed + d.ph) % 1, hx = Math.cos(d.a) * spread * d.sp, hz = Math.sin(d.a) * spread * d.sp * 0.6, vy = height * d.up * 2.2, gy = height * 2.2;
        v.set(at[0] + hx * f, at[1] + vy * f - gy * f * f, at[2] + hz * f);
        vel.set(hx, vy - 2 * gy * f, hz); if (vel.lengthSq() < 1e-6) vel.set(0, 1, 0); q.setFromUnitVectors(Y, vel.normalize());
        // (each drop grows out of the water and shrinks as it falls back: no drops lying on the ground)
        const s = d.s * k * Math.sin(Math.PI * f); im.setMatrixAt(i, m4.compose(v, q, sc.set(s, s * 2.6, s)));
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

/** the tint for a flow drawn with a named material: water is the clean blue-green; the dirty liquids (juice = leachate,
 *  seep dots, sludge, mud, sewage) keep a murky brown; any other material keeps its own colour */
export function flowTint(name, fallback) {
  const n = String(name ?? "water");
  if (n === "water" || n === "puddle") return WATER_TINTS.clean;
  if (/juice|seep|sludge|mud|sewage|dirt/i.test(n)) return "#6b5530";
  return fallback ?? WATER_TINTS.clean;
}

/**
 * The water running in a pipe seen in section (rule 17, 2026-11-11): a translucent band along the pipe's run, just on
 * the viewer's side of it (offset), in the lower part of a level run as water lies in a pipe, streaks moving along it at
 * `speed`; it shows only where the pipe is built. Replaces the blue balls of pipeRunFlow / pipeFlow for custom layouts.
 * update(t, on, grown)
 */
export function pipeWater(ctx, { path, r = 0.24, offset = [0, 0, 0.22], color = null, speed = 3, width = null } = {}) {
  const { THREE } = ctx, clock = waterClock(ctx), Z = new THREE.Vector3(0, 0, 1);
  const R = Math.max(0.03, Number(r) || 0.24), w = Number(width) > 0 ? Number(width) : R * 1.45;
  // (the band sits just in front of the pipe's near side: the dots' offset put their centres inside a kit pipe, where a
  // flat band would be hidden)
  const off = new THREE.Vector3(...[0, 1, 2].map((i) => Number(offset?.[i]) || 0)); off.z = Math.max(off.z, R + 0.03);
  const pts =(Array.isArray(path) ? path : []).filter((q) => Array.isArray(q) && q.length === 3 && q.every(Number.isFinite)).map((q) => new THREE.Vector3(...q).add(off));
  if (pts.length < 2) return { mesh: null, update() {} };
  const { geo, length } = ribbonGeometry(THREE, pts, w, {
    sharp: true,
    side: (t) => { const s = new THREE.Vector3().crossVectors(t, Z); return s.lengthSq() < 1e-6 ? new THREE.Vector3(0, 1, 0) : s.normalize(); },
    // (the water lies low in a level run: its band sits a quarter radius down; a falling run is full)
    lift: (t) => new THREE.Vector3(0, -R * 0.25 * (1 - Math.min(1, Math.abs(t.y) * 1.5)), 0),
  });
  const mat = streamMaterial(ctx, { color: color ?? "#2c9fc0", opacity: 0.9, speed: Math.max(0.5, Number(speed) || 3) * 0.6, streak: 0.45, edge: 0.88, env: 0.6, roughness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 4; mesh.visible = false; ctx.scene.add(mesh);
  return {
    mesh, length,
    update(t, on, grown = length) {
      clock.set(t);
      const k = Math.min(1, Math.max(0, Number(on) || 0)), g = Math.max(0, Math.min(length, Number(grown) || 0));
      mesh.visible = k > 0.01 && g > 0.02; mat.userData.stream.set({ on: k, reach: g >= length - 1e-3 ? 1e6 : g });
    },
  };
}

/** the world's groundwater film (real.js, ctx.waterMesh) in the one water look for a custom layout: the saturated blue
 *  band read as paint (rule 17, 2026-11-11). Left alone when a part already shades it (soilLeak's murk) or on a premade.
 *  Called once by m2/runtime.js after the parts are built; returns { update(t) } or null. */
export function restyleGroundwater(ctx, layout) {
  const w = ctx?.waterMesh;
  if (!waterNew(ctx) || !w?.isMesh || (layout?.parts ?? []).some((p) => p.kind === "soilLeak")) return null;
  w.material = waterMaterial(ctx, { color: "#2a7f95", opacity: 0.5, section: true, top: -11.0, depthScale: 3.2, deep: "#123f4e", fresnel: 0.2 });
  const clock = waterClock(ctx);
  return { update(t) { clock.set(t); } };
}

// ---------------- the page ----------------
/**
 * Builds a water body. ctx.terrain (kit/terrain.js buildTerrain) gives the ground it fills; without one the ground is flat
 * at y 0 and the water fills a basin `depth` deep. Returns { group, update(t, ch) } with ch = { level, dirty, freeze, flow }.
 */
export function buildWater(ctx, p = {}) {
  const { THREE } = ctx, s = waterSpec(p), T = ctx.terrain?.model ?? null, group = new THREE.Group(); ctx.scene.add(group);
  const ground = (x) => (T ? T.top(x) : s.level - s.depth);
  const base = new THREE.Color(s.color), dirtyC = new THREE.Color(s.murky ? "#6b5a32" : "#7a6438"), iceC = new THREE.Color("#e8f4fb");
  // the surface: a grid that ripples (waves on the sea)
  const W = s.x1 - s.x0, D = -s.z0, sx = Math.max(8, Math.min(240, Math.round(W / (s.body === "sea" ? 1.5 : 0.5)))), sz = Math.max(4, Math.min(120, Math.round(D / (s.body === "sea" ? 1.5 : 0.5))));
  const sg = new THREE.PlaneGeometry(W, D, sx, sz); sg.rotateX(-Math.PI / 2); sg.translate((s.x0 + s.x1) / 2, 0, s.z0 / 2);
  const topM = new THREE.MeshPhysicalMaterial({ color: base.clone(), transparent: true, opacity: s.murky ? 0.92 : 0.78, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
  const surf = new THREE.Mesh(sg, topM); surf.receiveShadow = true; surf.renderOrder = 3; group.add(surf);
  const sp = sg.attributes.position, rest = Float32Array.from(sp.array);
  // the section: a band in the face from the ground up to the level (columns, so its lower edge follows the ground)
  const fxs = []; for (let x = Math.max(s.x0, -WORLD.X); x <= Math.min(s.x1, WORLD.X) + 1e-6; x += 0.2) fxs.push(+x.toFixed(3));
  const fpos = [], fidx = [];
  fxs.forEach((x, i) => { fpos.push(x, ground(x), 0.025, x, 0, 0.025); if (i) { const k = i * 2; fidx.push(k - 2, k, k - 1, k, k + 1, k - 1); } });
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3)); fgeo.setIndex(fidx); fgeo.computeVertexNormals();
  const faceM = new THREE.MeshPhysicalMaterial({ color: base.clone(), transparent: true, opacity: s.murky ? 0.85 : 0.55, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMapIntensity: 1.4 });
  const face = new THREE.Mesh(fgeo, faceM); face.renderOrder = 4; group.add(face);
  const fp = fgeo.attributes.position;
  const setLevel = (lv) => {
    for (let i = 0; i < fxs.length; i++) { const g = ground(fxs[i]); fp.setY(i * 2, Math.min(g, lv)); fp.setY(i * 2 + 1, Math.max(lv, Math.min(g, lv))); }
    fp.needsUpdate = true;
  };
  setLevel(s.level);
  // (the new look for custom layouts, rule 17 of 2026-11-11: the same grid and band, drawn with the one water material: a
  // blue-green tint unless the plan gave a colour, a moving reflective surface, the section darker with depth, dirt as a
  // plume spreading from the land side; a premade keeps the materials above)
  const nu = waterNew(ctx);
  if (nu) {
    const tint = new THREE.Color(typeof p.color === "string" ? s.color : WATER_TINTS[s.body] ?? WATER_TINTS.clean);
    if (s.murky) tint.lerp(new THREE.Color("#6b6446"), 0.65);
    base.copy(tint);
    const flowDir = s.body === "river" ? 0.7 : 0.15;
    surf.material = waterMaterial(ctx, { color: tint, opacity: s.murky ? 0.9 : 0.7, depthWrite: true, flow: [flowDir, 0.05], dirtyColor: s.murky ? "#5a4a2a" : "#6e5530", scale: s.body === "sea" ? 1.6 : 1 });
    face.material = waterMaterial(ctx, { color: tint, opacity: s.murky ? 0.88 : 0.62, section: true, top: s.level, depthScale: Math.max(1, s.depth), dirtyColor: s.murky ? "#5a4a2a" : "#6e5530" });
  }
  const clock = nu ? waterClock(ctx) : null;
  // the plume's source: the end of the water nearer the middle of the scene (the land, where an outfall or a spill is)
  const xa = Math.max(s.x0, -WORLD.X), xb = Math.min(s.x1, WORLD.X), src = Math.abs(xa) < Math.abs(xb) ? xa : xb, reach = (xb - xa) * 1.25 + 4;
  return {
    group, mesh: surf,
    update(t, ch = {}) {
      const lv = s.level + (ch.level ?? 0);
      if (nu) {
        clock.set(t);
        const amp = s.waves ? 0.12 : 0.03, sp2 = 0.6 + 2.2 * (ch.flow ?? 0) + (s.body === "river" ? 0.8 : 0), fr = Math.min(1, Math.max(0, ch.freeze ?? 0));
        for (let i = 0; i < sp.count; i++) { const x = rest[i * 3], z = rest[i * 3 + 2]; sp.setY(i, lv + amp * Math.sin(x * 0.7 - t * sp2) * Math.cos(z * 0.5 + t * 0.4) * (1 - fr)); }
        sp.needsUpdate = true; sg.computeVertexNormals();
        setLevel(lv);
        const d = Math.min(1, Math.max(0, ch.dirty ?? 0)), plume = [src, -1, Math.max(0.01, d * reach), d];
        for (const m of [surf.material, face.material]) {
          m.color.copy(base).lerp(iceC, fr);
          m.userData.water.set({ top: lv, plume });
          m.userData.water.U.uWaves.value = 1 - fr; m.userData.water.U.uFlow.value.x = (s.body === "river" ? 0.7 : 0.15) + 1.2 * (ch.flow ?? 0);
        }
        surf.material.opacity = Math.min(1, (s.murky ? 0.9 : 0.7) + 0.25 * fr); surf.material.roughness = 0.04 + 0.5 * fr;
        face.material.opacity = Math.min(0.95, (s.murky ? 0.88 : 0.62) + 0.3 * fr);
        return;
      }
      // ripples drift with the flow; the sea's waves are taller
      const amp = s.waves ? 0.12 : 0.03, sp2 = 0.6 + 2.2 * (ch.flow ?? 0) + (s.body === "river" ? 0.8 : 0);
      for (let i = 0; i < sp.count; i++) { const x = rest[i * 3], z = rest[i * 3 + 2]; sp.setY(i, lv + amp * Math.sin(x * 0.7 - t * sp2) * Math.cos(z * 0.5 + t * 0.4) * (1 - (ch.freeze ?? 0))); }
      sp.needsUpdate = true; sg.computeVertexNormals();
      setLevel(lv);
      const d = Math.min(1, Math.max(0, ch.dirty ?? 0)), f = Math.min(1, Math.max(0, ch.freeze ?? 0));
      for (const m of [topM, faceM]) { m.color.copy(base).lerp(dirtyC, d).lerp(iceC, f); }
      topM.opacity = Math.min(1, (s.murky ? 0.92 : 0.78) + 0.2 * f + 0.15 * d); topM.roughness = 0.08 + 0.5 * f;
      faceM.opacity = Math.min(0.95, (s.murky ? 0.85 : 0.55) + 0.3 * d + 0.3 * f);
    },
  };
}
