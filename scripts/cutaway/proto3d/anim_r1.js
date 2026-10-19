
// ================= M1 preview in R1: home world (above) + animated topic parts (R2 approach) =================
const TM = window.TIMES; // word times from the cut voice (voiceCut.mjs)
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const eOut = (x) => 1 - (1 - x) ** 3;
const eInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const U = soilM.userData.u;

// readable liner: a touch lighter with sheen, and a light rim along its edges; lighter bags
const linerA = phys({ color: C("#272c34"), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: C("#8a96a8") });
const rimM = std({ color: C("#9aa3ad"), roughness: 0.4 });
const bagMatsA = ["#3b6a3c", "#2c4a2e", "#3d4047", "#344250", "#4a6e40"].map((c) => phys({ color: C(c), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: C("#b8c8bc") }));
const clayM = std({ map: tex("excavated_soil_wall", "diff", 0.5), color: C("#e9a46c"), roughness: 0.72, normalMap: tex("excavated_soil_wall", "nor", 0.5, false) }); // brown-orange clay (owner, M1)
{ const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 20, 16), soilM); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -PIT.depth, -4); fl.receiveShadow = true; const uv = fl.geometry.attributes.uv, pp = fl.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 4, (pp.getY(i) - 4) / 4); scene.add(fl); } // the pit floor

// ---- the pit plug: lawn + soil face that sink as the pit is dug ----
const plugTop = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), grassM); plugTop.rotation.x = -Math.PI / 2; plugTop.receiveShadow = true; scene.add(plugTop);
{ const uv = plugTop.geometry.attributes.uv, p = plugTop.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, (p.getY(i) - 4) / 4); }
const plugFace = new THREE.Mesh(new THREE.PlaneGeometry(10, 1, 40, 24), soilM); scene.add(plugFace);
const DIG0 = TM.dig + 0.05, DIG1 = TM.dig + 1.15;
function digDepth(t) { return -PIT.depth * eInOut(span(t, DIG0, DIG1)); }
function setPlug(t) {
  const y = digDepth(t);
  plugTop.position.set(0, y + 0.001, -4); plugTop.visible = y > -PIT.depth + 0.01;
  const h = Math.max(0.001, y + PIT.depth); plugFace.scale.set(1, h, 1); plugFace.position.set(0, -PIT.depth + h / 2, 0.001); plugFace.visible = h > 0.01;
  { const uv = plugFace.geometry.attributes.uv, p = plugFace.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, (-PIT.depth + (p.getY(i) + 0.5) * h) / 4); uv.needsUpdate = true; }
}
// clumps (clay crumbs) fly from the dig to a mound
const clumpGeo = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(0.5, 2)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 6) * Math.sin(v.y * 5 + 1) + 0.12 * Math.sin(v.z * 8)); p.setXYZ(i, v.x, v.y * 0.8, v.z); } g.computeVertexNormals(); return g; })();
const dirtM = PBR("brown_mud_dry", 0.6, { color: C("#e0b890") });
const NC = 150, clumps = new THREE.InstancedMesh(clumpGeo, dirtM, NC); clumps.castShadow = true; scene.add(clumps);
const clumpData = Array.from({ length: NC }, () => ({ x: PIT.x0 + 0.6 + rnd() * 8.8, z: PIT.z0 + 0.6 + rnd() * 6.8, tx: 9.6 + (rnd() - 0.5) * 3.2, tz: -11.8 + (rnd() - 0.5) * 2.6, s: 0.2 + rnd() ** 1.5 * 0.45, r: rnd() }));
const mound = new THREE.Mesh((() => { const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 1 + 0.07 * Math.sin(v.x * 7) * Math.cos(v.z * 6); p.setXYZ(i, v.x * f, v.y * 0.5 * f, v.z * f); } g.computeVertexNormals(); return g; })(), dirtM);
mound.position.set(9.6, 0, -11.8); mound.castShadow = mound.receiveShadow = true; scene.add(mound);

// ---- clay base and liner (anchored so they grow from one side) ----
const CT = 0.5;
function anchored(m, sx, sy, sz, ax, ay, az, r = 0.04) { const g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(r, Math.min(sx, sy, sz) * 0.45)); g.translate(ax * sx / 2, ay * sy / 2, az * sz / 2); const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; o.visible = false; scene.add(o); return o; }
const clay = { floor: anchored(clayM, 10, CT, 8, 0, 0, 1), back: anchored(clayM, 10, 6, CT, 0, 1, 0), l: anchored(clayM, CT, 6, 8, 0, 1, 0), r: anchored(clayM, CT, 6, 8, 0, 1, 0) };
clay.floor.position.set(0, -6 + CT / 2, -8); clay.back.position.set(0, -6, -8 + CT / 2); clay.l.position.set(-5 + CT / 2, -6, -4); clay.r.position.set(5 - CT / 2, -6, -4);
const LTA = 0.16;
const liner = { back: anchored(linerA, 9, 5.5, LTA, 0, -1, 0), l: anchored(linerA, LTA, 5.5, 7.5, 0, -1, 0), r: anchored(linerA, LTA, 5.5, 7.5, 0, -1, 0), floor: anchored(linerA, 9, LTA, 7.5, 0, 0, 1),
  lipB: anchored(linerA, 10.6, LTA, 1.1, 0, 0, 1), lipL: anchored(linerA, 1.1, LTA, 8, -1, 0, 0), lipR: anchored(linerA, 1.1, LTA, 8, 1, 0, 0),
  rimB: anchored(rimM, 10.8, 0.06, 0.07, 0, 0, 0, 0.02), rimL: anchored(rimM, 0.07, 0.06, 8, 0, 0, 0, 0.02), rimR: anchored(rimM, 0.07, 0.06, 8, 0, 0, 0, 0.02) };
liner.back.position.set(0, 0, -7.5 + LTA / 2); liner.l.position.set(-4.5 + LTA / 2, 0, -3.75); liner.r.position.set(4.5 - LTA / 2, 0, -3.75); liner.floor.position.set(0, -5.5 + LTA / 2, -7.5);
liner.lipB.position.set(0, LTA / 2, -8.6); liner.lipL.position.set(-4.5, LTA / 2, -4); liner.lipR.position.set(4.5, LTA / 2, -4);
liner.rimB.position.set(0, LTA + 0.03, -8.62); liner.rimL.position.set(-5.62, LTA + 0.03, -4); liner.rimR.position.set(5.62, LTA + 0.03, -4);

// ---- bags: one packed layer poured from the truck ----
const IX0 = -4.5 + LTA, IX1 = 4.5 - LTA, IZ0 = -7.5 + LTA, IZ1 = 0;
const bags = [];
for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
  const cw = (IX1 - IX0) / 5, cd = (IZ1 - IZ0) / 4, w = cw * (0.98 + rnd() * 0.08), d = cd * (0.98 + rnd() * 0.08), h = 1.55 * (0.9 + rnd() * 0.12);
  const g = new THREE.Group(); scene.add(g);
  const m = bagMatsA[(i * 2 + j * 3) % bagMatsA.length];
  const b = new THREE.Mesh(bagGeo(w, h, d, rnd() * 10), m); b.castShadow = b.receiveShadow = true; g.add(b);
  if (rnd() < 0.5) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), m); k.position.set((rnd() - 0.5) * 0.3, h / 2 + 0.15, (rnd() - 0.5) * 0.3); k.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); k.castShadow = true; g.add(k); }
  bags.push({ g, h, x: IX0 + cw * (i + 0.5), z: IZ0 + cd * (j + 0.5), n: bags.length, spin: (rnd() - 0.5) * 2 });
}

// ---- dump truck (R1 detail), reverses in while digging, tips on "throw", drives off ----
const truck = new THREE.Group(); scene.add(truck);
box(P.chassis, 2.4, 0.5, 7.2, 0, 1.0, 0, truck, 0.08);
{ const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.6, 0); sh.lineTo(2.6, 1.3); sh.lineTo(2.1, 2.4); sh.lineTo(0, 2.4); sh.lineTo(0, 0);
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }); cg.translate(0, 0, -1.3); cg.rotateY(Math.PI / 2);
  const cab = new THREE.Mesh(cg, P.truck); cab.position.set(0, 1.25, -1.4); cab.castShadow = true; truck.add(cab);
  box(P.glass, 2.3, 0.95, 0.06, 0, 3.15, -3.75, truck, 0.02).rotation.x = -0.42; for (const x of [-1.33, 1.33]) box(P.glass, 0.05, 0.85, 1.5, x, 3.05, -2.4, truck, 0.02);
  box(P.chassis, 2.2, 0.8, 0.1, 0, 1.75, -4.02, truck, 0.03); box(P.rim, 2.7, 0.3, 0.3, 0, 1.1, -4.15, truck, 0.08); }
const wheels = [];
for (const [x, z] of [[-1.3, -2.5], [1.3, -2.5], [-1.3, 1.4], [1.3, 1.4], [-1.3, 2.8], [1.3, 2.8]]) { const w = new THREE.Group(); w.position.set(x, 0.62, z); truck.add(w); cyl(P.tyre, 0.62, 0.55, 0, 0, 0, w, "x", 32); cyl(P.rim, 0.34, 0.57, 0, 0, 0, w, "x", 24); box(P.chassis, 0.6, 0.12, 0.5, 0, 0, 0, w, 0.03); wheels.push(w); }
const pivot = new THREE.Group(); pivot.position.set(0, 1.3, 3.6); truck.add(pivot);
const bed = new THREE.Group(); bed.position.set(0, 0, -2.3); pivot.add(bed);
box(P.bed, 2.7, 0.22, 4.6, 0, 0.11, 0, bed, 0.05); for (const x of [-1.3, 1.3]) box(P.bed, 0.14, 1.5, 4.6, x, 0.85, 0, bed, 0.05); box(P.bed, 2.7, 1.8, 0.14, 0, 0.95, -2.25, bed, 0.05);
for (let k = -1.5; k <= 1.6; k += 0.75) for (const x of [-1.39, 1.39]) box(P.bed, 0.06, 1.3, 0.12, x, 0.85, k, bed, 0.02);
const load = [[-0.45, 0.8, -1.1, 0], [0.55, 0.75, -0.1, 1], [0, 1.4, -0.6, 2]].map(([x, y, z, k]) => { const b = new THREE.Mesh(bagGeo(1.25, 0.95, 1.25, k * 3), bagMatsA[k]); b.position.set(x, y, z); b.castShadow = true; bed.add(b); return b; });
const truckZ = (t) => -40 + (-12.6 + 40) * eOut(span(t, 0, 1.1)) - 36 * eInOut(span(t, TM.landfill + 0.5, TM.landfill + 2.6));
const tipAt = (t) => 0.75 * (eInOut(span(t, TM.throw + 0.02, TM.throw + 0.45)) - eInOut(span(t, TM.landfill - 0.1, TM.landfill + 0.5)));

// ---- overlays: seep arrows, murky flow, liner highlight (clean, white/amber, in front of the cut face) ----
const arrowGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.16, 0.5); s.lineTo(0.16, 0.5); s.lineTo(0.16, 0.0); s.lineTo(0.38, 0.0); s.lineTo(0, -0.5); s.lineTo(-0.38, 0.0); s.lineTo(-0.16, 0.0); s.lineTo(-0.16, 0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.scale(1.25, 1.25, 1); return g; })();
const arrows = [-2.0, 0, 2.0].flatMap((x) => [0, 1].map((k) => { const m = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: C("#ffffff"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); m.position.set(x, 0, 0.35); m.renderOrder = 5; scene.add(m); return { m, x, k }; }));
const NF = 70, flowM = std({ color: C("#4a3b18"), roughness: 0.6, transparent: true, opacity: 0.9 }), flow = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), flowM, NF); flow.renderOrder = 4; scene.add(flow);
const flowData = Array.from({ length: NF }, () => ({ x: (rnd() - 0.5) * 4.4, ph: rnd(), side: rnd() < 0.5 ? -1 : 1, spread: 2 + rnd() * 8, s: 0.08 + rnd() * 0.09 }));
const hl = (() => { const pts = [new THREE.Vector3(-4.92, 0.1, 0.06), new THREE.Vector3(-4.92, -5.92, 0.06), new THREE.Vector3(4.92, -5.92, 0.06), new THREE.Vector3(4.92, 0.1, 0.06)];
  const path = new THREE.CurvePath(); for (let i = 0; i < 3; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.11, 10, false), new THREE.MeshBasicMaterial({ color: C("#ffd34d"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 6; scene.add(m); return m; })();
// the groundwater film turns murky near the leak
waterMesh.material.onBeforeCompile = (sh) => { sh.uniforms.uMurk = U.uMurk; sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW2 = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2; uniform vec3 uMurk;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat md = abs(vW2.x - uMurk.x) + (-11.0 - vW2.y) * 0.6; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.24, 0.07), clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);"); };

// ---- camera: R1's lower home angle; tilt to the groundwater, back, one quick push to the liner ----
const KEYS = [
  [0.0, [13.0, 10.8, 33.5], [0.2, 2.3, -9.0]],
  [TM.landfill + 0.4, [12.6, 10.4, 32.2], [0.2, 2.0, -8.8]],
  [TM.leaks + 0.2, [11.6, 1.6, 28.5], [0.0, -9.6, -4.0]],
  [TM.drink + 0.2, [11.3, 1.3, 27.6], [0.0, -9.9, -4.0]],
  [TM.lay + 0.5, [12.8, 10.2, 31.0], [0.2, 1.9, -8.4]],
  [TM.this - 0.1, [11.8, 9.6, 28.8], [0.2, 1.6, -8.0]],
  [TM.this + 0.65, [5.6, 4.6, 27.5], [-0.2, -2.6, -4.4]],
  [TIMES.lengthSec, [5.3, 4.4, 26.6], [-0.2, -2.7, -4.5]],
];
function monotone(xs, ys) { const n = xs.length, d = [], m = new Array(n).fill(0); for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])); for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]); return (x) => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], u = clamp01((x - xs[i]) / h); return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1]; }; }
const KT = KEYS.map((k) => k[0]), camF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[1][a]))), tgtF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[2][a])));

// ---- the timeline ----
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), AX = new THREE.Vector3(1, 0.4, 0.2).normalize();
window.renderAt = (t) => {
  setPlug(t);
  let flown = 0;
  clumpData.forEach((c, i) => {
    const t0 = DIG0 + (c.r * 0.85) * (DIG1 - DIG0), u = span(t, t0, t0 + 0.6);
    if (u <= 0 || u >= 1) { if (u >= 1) flown++; m4.makeScale(0, 0, 0); }
    else { const y0 = digDepth(t0), e = eOut(u); v4.set(c.x + (c.tx - c.x) * e, y0 + (1.0 - y0) * e + Math.sin(u * Math.PI) * 4.2, c.z + (c.tz - c.z) * e); q4.setFromAxisAngle(AX, u * 4 * (c.r - 0.5)); const s = c.s * (1 - u * 0.4); m4.compose(v4, q4, s4.set(s, s, s)); }
    clumps.setMatrixAt(i, m4);
  });
  clumps.instanceMatrix.needsUpdate = true;
  const ms = 0.05 + eBack(clamp01(flown / NC)) * 2.6; mound.scale.set(ms * 1.15, ms, ms);

  truck.position.set(0, 0, truckZ(t)); pivot.rotation.x = tipAt(t); wheels.forEach((w) => { w.rotation.x = -truckZ(t) * 1.6; });
  load.forEach((b) => { b.visible = t < TM.throw + 0.25; });

  // leak 1 ("leaks" -> groundwater), groundwater murk, both cleared when the clay goes in; leak 2 on "not enough", cleared by the liner
  const f1 = -6 - eOut(span(t, TM.leaks, TM.groundwater + 0.1)) * 5.3, c1 = 1 - span(t, TM.so + 0.05, TM.lay + 0.6);
  U.uLeak.value.set(3.0, f1, t > TM.leaks ? 0.9 * c1 : 0, 0);
  const f2 = -6 - eOut(span(t, TM.not, TM.add)) * 3.6, c2 = 1 - span(t, TM.plastic, TM.sheet + 0.3);
  U.uLeak2.value.set(1.4, f2, t > TM.not ? 0.85 * c2 : 0, 0);
  U.uMurk.value.set(0, Math.max(0, (t - TM.groundwater + 0.1) * 9), t > TM.groundwater - 0.1 ? 0.9 * c1 : 0);
  // seep arrows: pulse down the column from "leaks" until the clay goes in
  const arrOn = clamp01(span(t, TM.leaks - 0.05, TM.leaks + 0.2)) * (1 - span(t, TM.so - 0.1, TM.so + 0.25));
  arrows.forEach((a) => { const ph = ((t * 0.9 + a.k * 0.5 + (a.x === 0 ? 0.25 : 0)) % 1); a.m.position.y = -6.6 - ph * 3.6; a.m.material.opacity = arrOn * Math.sin(ph * Math.PI) * 0.95; a.m.visible = arrOn > 0.01; });
  // murky flow: drops sink down the column and spread into the groundwater
  const flowOn = clamp01(span(t, TM.leaks + 0.1, TM.leaks + 0.5)) * (1 - span(t, TM.so, TM.lay + 0.3));
  flowData.forEach((d, i) => { const ph = ((t * 0.55 + d.ph) % 1); let x = d.x * (1 - ph * 0.2), y = -6.2 - ph * 6.2; if (y < -11.2) { const k = (-11.2 - y) / 1.2; y = -11.2 - k * 0.6; x = d.x + d.side * d.spread * k; } const s = flowOn > 0.01 ? d.s * (0.6 + 0.4 * Math.sin(ph * Math.PI)) * flowOn : 0; flow.setMatrixAt(i, m4.compose(v4.set(x, y, 0.12), q4.identity(), s4.set(s, s, s))); });
  flow.instanceMatrix.needsUpdate = true;

  // clay base on "lay": floor back-to-front, walls rise
  const cf = eOut(span(t, TM.lay + 0.02, TM.lay + 0.45)), cw = eOut(span(t, TM.lay + 0.25, TM.lay + 0.8));
  clay.floor.visible = cf > 0; clay.floor.scale.set(1, 1, Math.max(0.001, cf)); for (const w of [clay.back, clay.l, clay.r]) { w.visible = cw > 0; w.scale.set(1, Math.max(0.001, cw), 1); }
  // liner on "plastic sheet": back wall top-down, sides, floor, lip + rim
  const L0 = TM.plastic - 0.35, lb = eOut(span(t, L0, L0 + 0.45)), ls = eOut(span(t, L0 + 0.15, L0 + 0.6)), lf = eOut(span(t, L0 + 0.4, L0 + 0.85)), ll = eBack(span(t, L0 + 0.75, L0 + 1.05));
  liner.back.visible = lb > 0; liner.back.scale.set(1, Math.max(0.001, lb), 1); for (const s of [liner.l, liner.r]) { s.visible = ls > 0; s.scale.set(1, Math.max(0.001, ls), 1); }
  liner.floor.visible = lf > 0; liner.floor.scale.set(1, 1, Math.max(0.001, lf));
  for (const k of ["lipB", "lipL", "lipR", "rimB", "rimL", "rimR"]) liner[k].visible = ll > 0.001;
  liner.lipB.scale.z = Math.max(0.001, ll); liner.lipL.scale.x = Math.max(0.001, ll); liner.lipR.scale.x = Math.max(0.001, ll);
  // highlight on "liner"
  const hlOn = span(t, TM.liner - 0.05, TM.liner + 0.15) * (1 - 0.35 * span(t, TM.liner + 0.4, TM.liner + 0.9)); hl.visible = hlOn > 0.01; hl.material.opacity = hlOn * (0.85 + 0.15 * Math.sin(t * 9));

  // bags: poured on "throw", lifted for the clay and the liner, settle with a squash
  const LIFT = 2.6;
  for (const b of bags) {
    const rel = TM.throw + 0.2 + b.n * 0.035, DUR = 0.6, rest = -6 + b.h / 2;
    if (t < rel) { b.g.visible = false; continue; }
    b.g.visible = true;
    const u = span(t, rel, rel + DUR);
    let x = b.x, y = rest, z = b.z, rx = 0, ry = 0;
    if (u < 1) { const p0 = new THREE.Vector3(0, 2.8, truckZ(rel) + 3.8), ex = eOut(u), ey = u * u; x = p0.x + (b.x - p0.x) * ex; z = p0.z + (b.z - p0.z) * ex; y = p0.y + (rest - p0.y) * ey + Math.sin(u * Math.PI) * 1.2; rx = b.spin * (1 - u) * 0.6; ry = b.spin * u * 0.4; }
    else {
      const up1 = eOut(span(t, TM.so + 0.02 + b.n * 0.008, TM.so + 0.35)), dn1 = span(t, TM.lay + 0.8 + b.n * 0.012, TM.lay + 1.2) ** 2;
      const up2 = eOut(span(t, TM.add + b.n * 0.008, TM.add + 0.35)), dn2 = span(t, L0 + 1.05 + b.n * 0.012, L0 + 1.45) ** 2;
      y = rest + LIFT * (up1 - dn1 + up2 - dn2) + CT * dn1 + LTA * dn2;
    }
    let sq = 0; for (const land of [rel + DUR, TM.lay + 1.2, L0 + 1.45]) { const k = span(t, land, land + 0.25); if (k > 0 && k < 1) sq = Math.max(sq, Math.sin(k * Math.PI) * 0.15); }
    b.g.position.set(x, y, z); b.g.rotation.set(rx, ry, 0); b.g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
  }
  camera.position.set(...camF.map((f) => f(t))); camera.lookAt(...tgtF.map((f) => f(t)));
  composer.render(); return true;
};
