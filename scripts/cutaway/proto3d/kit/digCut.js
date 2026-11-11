// M2 kit: dig a box cut that opens on the cut face (a pit, a trench, a hole). The ground mesh already has the hole;
// a plug of lawn + soil face sinks while dirt clumps fly in arcs to a mound beside it, which grows as they land.
// refill() shrinks the mound again when the cut is backfilled.
//
// Options (defaults = the French drain trench; the landfill pit sets its own):
//   margin: how far from the cut's sides clumps start; endY / arc: where a clump lands and how high it flies
//     (arc null = 2 + depth / 2); uvFlip: the plug and floor texture direction of the landfill;
//   mound: {x, z, rx, rz, h, clumpScale, flat (its height squash), base, gain (its size law: base + gain * pop),
//     sx, sy, sz (the scale per axis; default rx, h, rz)}
import { span, eOut, eInOut, eBack, clamp01 } from "./verbs.js";

// ---------- the layered soil of a custom layout's cut face (owner's rules 16 and 18, 2026-11-11) ----------
// The competitors' section face is real soil: a dark topsoil with roots, brown loam, a band of gravel, brown clay, a
// darker deep layer, stones all through it, and soil that turns dark and glossy where it is wet (rain soaking down from
// the top, a flood, the fringe above the groundwater). Ours was orange stripes with black blobs. These are the changes
// m2/makePage.mjs makes to the page's soil (real.js soilMaterial) for a custom layout only (approved !== true); the cut
// floor and plug here, kit/terrain.js's face and every pit wall share that one soil material, so they all get it.
// Band colours: each texture divided by its own average and times the wanted colour (linear), so the texture only
// adds grain: sod #3b2a1e, loam #5c4029, gravel #6e665c, clay #7a5236, deep #4e3a2a, wet sand #8a7a62 (under the
// groundwater film); the bedrock stays. Band depths put the gravel at about 2.5 m, inside a typical 3-6 m cut.
// (about a third lighter and a little warmer than the first version: the re-planned storm drain's close-ups under the
// street were near black, the competitor's cut is a warm lit mid-brown, 2026-11-11)
export const SOIL_BANDS_REAL = '{ sod: ["roots", [0.34, 0.275, 0.29]], top: ["brown_mud_dry", [0.83, 0.66, 0.6]], deep: ["brown_mud_rocks_01", [1.25, 0.95, 0.84]], clay: ["excavated_soil_wall", [1.45, 1.3, 1.95]], grav: ["brown_mud_rocks_01", [1.856, 2.178, 3.148]], water: ["gravelly_sand", [0.867, 1.224, 1.745]], rock: ["dark_rock", "#c9c9cf"] }';
const OLD_BANDS = '{ sod: ["roots", "#ffffff"], top: ["brown_mud_dry", R === 1 ? "#ffd2a8" : "#ffffff"], deep: ["excavated_soil_wall", R === 1 ? "#ffc89a" : "#ffffff"], clay: ["excavated_soil_wall", "#b5b2bb"], grav: ["gravel", "#e6dccb"], water: ["brown_mud_rocks_01", "#7fb2ff"], rock: ["dark_rock", "#c9c9cf"] }';
const OLD_CHAIN = [
  "      vec3 c = s_rock;",
  "      c = mix(c, s_water, smoothstep(-14.2, -13.9, y));",
  "      c = mix(c, s_grav, smoothstep(-11.15, -10.85, y));",
  "      c = mix(c, s_clay, smoothstep(-10.15, -9.85, y));",
  "      c = mix(c, s_deep, smoothstep(-7.65, -7.35, y));",
  "      c = mix(c, s_top, smoothstep(-3.7, -3.3, y));",
  "      c = mix(c, s_sod, smoothstep(-0.95, -0.7, y));",
].join("\n");
const NEW_CHAIN = [
  "      vec3 c = s_rock;",
  "      c = mix(c, s_water, smoothstep(-14.2, -13.9, y));",
  "      c = mix(c, s_deep, smoothstep(-11.15, -10.85, y));",
  "      c = mix(c, s_clay, smoothstep(-5.7, -5.3, y));",
  "      c = mix(c, s_grav, smoothstep(-3.0, -2.8, y));",
  "      c = mix(c, s_top, smoothstep(-2.4, -2.2, y));",
  "      c = mix(c, s_sod, smoothstep(-0.65, -0.45, y));",
  // the deep layers a little darker the deeper they lie (the competitors' storm drain and well)
  "      c *= mix(1.0, 0.82, smoothstep(-2.0, -10.0, y));",
].join("\n");
// stones of every size all through the face (many in the gravel band, none in the sod), then the wet soil: darker and
// glossy where rain has soaked down from the top (deeper the longer it rains, m2/materials.js rainSoak) and in the fringe
// above the groundwater
const STONES_WET = [
  "      vec2 pc = vec2(vW.x + vW.z, vW.y) / 0.3; vec2 pci = floor(pc); vec2 pcf = fract(pc);",
  "      float ph = fract(sin(dot(pci, vec2(127.1, 311.7))) * 43758.5453), ph2 = fract(sin(dot(pci, vec2(269.5, 183.3))) * 43758.5453);",
  "      float pgrav = smoothstep(-3.0, -2.8, y) * (1.0 - smoothstep(-2.35, -2.15, y));",
  "      float pdens = mix(0.07, 0.8, pgrav) * (1.0 - smoothstep(-0.75, -0.45, y));",
  "      vec2 pcen = vec2(0.3 + 0.4 * ph2, 0.3 + 0.4 * ph);",
  "      float pd = length((pcf - pcen) * vec2(1.0, 1.35)) / (0.12 + 0.2 * ph2);",
  "      float pin = step(ph, pdens) * (1.0 - smoothstep(0.8, 1.0, pd));",
  "      vec3 pcol = mix(mix(vec3(0.12, 0.11, 0.1), vec3(0.26, 0.24, 0.21), ph2), c, 0.3) * (1.08 - 0.5 * pd * pd);",
  "      c = mix(c, pcol, pin);",
  "      float sw = max(uSoilWet, uWetLawn), front = 0.4 + 3.2 * sw;",
  "      float soilWetK = sw * (1.0 - smoothstep(front - 0.8, front, -vW.y));",
  "      soilWetK = max(soilWetK, 0.55 * smoothstep(-12.0, -10.9, y) * (1.0 - smoothstep(-10.7, -9.8, y)));",
  "      c *= 1.0 - 0.42 * soilWetK;",
].join("\n");
const J = JSON.stringify;
/**
 * the [from, to] text changes of the page for the real soil (m2/makePage.mjs applies them for a custom layout, all or
 * none). Each is gated in the page by M2_SURF (true unless ?look2=0 asks a custom page for the old look, side by side).
 */
export function soilReps() {
  return [
    ["const WET_LAWN = { value: 0 };", 'const WET_LAWN = { value: 0 }, M2_WET = { value: 0 }, M2_SURF = typeof M2_LOOK2 === "undefined" ? true : M2_LOOK2;'],
    [`      : ${OLD_BANDS};`, `      : M2_SURF ? ${SOIL_BANDS_REAL} : ${OLD_BANDS};`],
    ["u[`c_${k}`] = { value: C(tint) };", "u[`c_${k}`] = { value: Array.isArray(tint) ? new THREE.Color(...tint) : C(tint) };"],
    ["uSoakOn: { value: 0 } };", "uSoakOn: { value: 0 }, uSoilWet: M2_WET, uWetLawn: WET_LAWN };"],
    ["uniform float uSoakOn;\\n", "uniform float uSoakOn;\\nuniform float uSoilWet, uWetLawn;\\n"],
    [OLD_CHAIN, "${M2_SURF ? " + J(NEW_CHAIN) + " : " + J(OLD_CHAIN) + "}"],
    ["      diffuseColor.rgb = c;`);", "${M2_SURF ? " + J(STONES_WET) + ' : ""}\n      diffuseColor.rgb = c;`).replace("#include <roughnessmap_fragment>", M2_SURF ? "#include <roughnessmap_fragment>\\n      roughnessFactor = mix(roughnessFactor, 0.3, soilWetK);" : "#include <roughnessmap_fragment>");'],
  ];
}
/** optional changes (the stones of the face are cut out of a thin-slab world): grey stones, not black blobs */
export function soilRepsOptional() {
  return [
    ['const rockM = R === 1 ? PBR("dark_rock", 0.5, { color: C("#b9b2a6") })', 'const rockM = R === 1 ? (M2_SURF ? PBR("concrete_wall_008", 0.35, { color: C("#8f887c") }) : PBR("dark_rock", 0.5, { color: C("#b9b2a6") }))'],
    // (the excavated wall's deep vertical grooves made the whole face read as a row of columns: a soil clod relief)
    ['normalMap: R === 3 ? null : tex(R === 4 ? "coast_sand_01" : "excavated_soil_wall", "nor", 1, false)', 'normalMap: R === 3 ? null : tex(R === 4 ? "coast_sand_01" : M2_SURF ? "brown_mud_dry" : "excavated_soil_wall", "nor", 1, false)'],
    ["if (m.normalMap) m.normalScale.set(R === 4 ? 0.4 : 1.2, R === 4 ? 0.4 : 1.2);", "if (m.normalMap) m.normalScale.set(R === 4 ? 0.4 : M2_SURF ? 0.8 : 1.2, R === 4 ? 0.4 : M2_SURF ? 0.8 : 1.2);"],
  ];
}

export function digCut(ctx, { x0, x1, z0, z1 = 0, depth, mound, clumps = 150, dirtMat, margin = 0.2, endY = 0.6, arc = null, uvFlip = false }) {
  const { THREE, scene, grassM, soilM, rnd, mergeVertices } = ctx;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const flyArc = arc ?? 2.0 + depth * 0.5;
  const uvPlanar = (mesh, fx, fy) => { const uv = mesh.geometry.attributes.uv, p = mesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, fx(p, i), fy(p, i)); };
  const planeV = uvFlip ? (p, i) => (p.getY(i) + cz) / 4 : (p, i) => (-p.getY(i) + cz) / 4;
  // the floor of the cut
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d, Math.ceil(w * 2), Math.ceil(d * 2)), soilM);
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -depth, cz); floor.receiveShadow = true; scene.add(floor);
  uvPlanar(floor, (p, i) => (p.getX(i) + cx) / 4, planeV);
  // the plug: lawn top + its front face, sinking
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassM); top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);
  uvPlanar(top, (p, i) => (p.getX(i) + cx) / 4, planeV);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, 1, Math.ceil(w * 4), 24), soilM); scene.add(face);
  const clumpGeo = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(0.5, 2)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 6) * Math.sin(v.y * 5 + 1) + 0.12 * Math.sin(v.z * 8)); p.setXYZ(i, v.x, v.y * 0.8, v.z); } g.computeVertexNormals(); return g; })();
  const NC = clumps, im = new THREE.InstancedMesh(clumpGeo, dirtMat, NC); im.castShadow = true; scene.add(im);
  const M = { x: mound.x, z: mound.z, rx: mound.rx ?? 1.6, rz: mound.rz ?? 1.3, h: mound.h ?? 1.3 };
  const law = { base: mound.base ?? 0.03, gain: mound.gain ?? 1, sx: mound.sx ?? M.rx, sy: mound.sy ?? M.h, sz: mound.sz ?? M.rz, flat: mound.flat ?? 1 };
  const data = Array.from({ length: NC }, () => ({ x: x0 + margin + rnd() * (w - 2 * margin), z: z0 + margin + rnd() * (d - 2 * margin), tx: M.x + (rnd() - 0.5) * M.rx * 1.6, tz: M.z + (rnd() - 0.5) * M.rz * 1.6, s: (0.2 + rnd() ** 1.5 * 0.45) * (mound.clumpScale ?? 1), r: rnd() }));
  const moundMesh = new THREE.Mesh((() => { const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 1 + 0.07 * Math.sin(v.x * 7) * Math.cos(v.z * 6); p.setXYZ(i, v.x * f, v.y * law.flat * f, v.z * f); } g.computeVertexNormals(); return g; })(), dirtMat);
  moundMesh.position.set(M.x, 0, M.z); moundMesh.castShadow = moundMesh.receiveShadow = true; scene.add(moundMesh);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), AX = new THREE.Vector3(1, 0.4, 0.2).normalize();
  return {
    /** dig between t0 and t1; refill (optional [a, b]) shrinks the mound back to nothing */
    update(t, t0, t1, refill = null) {
      const dd = (tt) => -depth * eInOut(span(tt, t0, t1));
      const y = dd(t);
      top.position.set(cx, y + 0.001, cz); top.visible = y > -depth + 0.01;
      const h = Math.max(0.001, y + depth); face.scale.set(1, h, 1); face.position.set(cx, -depth + h / 2, z1 + 0.001); face.visible = h > 0.01;
      const uv = face.geometry.attributes.uv, p = face.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + cx) / 4, (-depth + (p.getY(i) + 0.5) * h) / 4);
      uv.needsUpdate = true;
      let flown = 0;
      data.forEach((c, i) => {
        const a = t0 + c.r * 0.85 * (t1 - t0), u = span(t, a, a + 0.6);
        if (u <= 0 || u >= 1) { if (u >= 1) flown++; m4.makeScale(0, 0, 0); }
        else { const y0 = dd(a), e = eOut(u); v4.set(c.x + (c.tx - c.x) * e, y0 + (endY - y0) * e + Math.sin(u * Math.PI) * flyArc, c.z + (c.tz - c.z) * e); q4.setFromAxisAngle(AX, u * 4 * (c.r - 0.5)); const s = c.s * (1 - u * 0.4); m4.compose(v4, q4, s4.set(s, s, s)); }
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      const back = refill ? 1 - eInOut(span(t, refill[0], refill[1])) : 1;
      const k = (law.base + law.gain * eBack(clamp01(flown / NC))) * back;
      moundMesh.scale.set(law.sx * k, law.sy * k, law.sz * k); moundMesh.visible = k > 0.005;
    },
  };
}
