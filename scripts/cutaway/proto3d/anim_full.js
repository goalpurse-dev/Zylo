
// ================= M1 full landfill video in R1: home world (above) + animated topic parts =================
// Every cue is a word time from the final voice (fullAudio.mjs -> times_full.json). ?endcard=0 drops the sign.
const TM = window.TIMES;
const END_CARD = new URLSearchParams(location.search).get("endcard") !== "0";
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const eOut = (x) => 1 - (1 - x) ** 3;
const eInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const pop = (t, a, d = 0.35) => (t <= a ? 0 : t >= a + d ? 1 : eBack((t - a) / d));
const U = soilM.userData.u;
const hemi = scene.children.find((o) => o.isHemisphereLight);
const BASE = { sun: sun.intensity, hemi: hemi?.intensity ?? 0, env: 1.0 };

// ---------- materials (R2 approach: simple shapes, real materials) ----------
const linerA = phys({ color: C("#272c34"), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: C("#8a96a8") });
const rimM = std({ color: C("#9aa3ad"), roughness: 0.4 });
const bagMatsA = ["#3b6a3c", "#2c4a2e", "#3d4047", "#344250", "#4a6e40"].map((c) => phys({ color: C(c), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: C("#b8c8bc") }));
const clayM = std({ map: tex("excavated_soil_wall", "diff", 0.5), color: C("#e9a46c"), roughness: 0.72, normalMap: tex("excavated_soil_wall", "nor", 0.5, false) });
const coverA = PBR("brown_mud_dry", 1, { color: C("#9a7656") });
const pipeA = phys({ color: C("#eef0f2"), roughness: 0.3, clearcoat: 0.5 });
const tankA = phys({ color: C("#4a9fb3"), roughness: 0.4, metalness: 0.15, clearcoat: 0.4 });
const metalA = std({ color: C("#9aa1aa"), roughness: 0.35, metalness: 0.5 });
const dirtM = PBR("brown_mud_dry", 0.6, { color: C("#e0b890") });

// ---------- the pit floor and the plug that sinks while the pit is dug ----------
{ const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 8, 20, 16), soilM); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -PIT.depth, -4); fl.receiveShadow = true; const uv = fl.geometry.attributes.uv, pp = fl.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 4, (pp.getY(i) - 4) / 4); scene.add(fl); }
const plugTop = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), grassM); plugTop.rotation.x = -Math.PI / 2; plugTop.receiveShadow = true; scene.add(plugTop);
{ const uv = plugTop.geometry.attributes.uv, p = plugTop.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, (p.getY(i) - 4) / 4); }
const plugFace = new THREE.Mesh(new THREE.PlaneGeometry(10, 1, 40, 24), soilM); scene.add(plugFace);
const DIG0 = TM.dig + 0.02, DIG1 = TM.dig + 1.0;
const digDepth = (t) => -PIT.depth * eInOut(span(t, DIG0, DIG1));
function setPlug(t) {
  const y = digDepth(t);
  plugTop.position.set(0, y + 0.001, -4); plugTop.visible = y > -PIT.depth + 0.01;
  const h = Math.max(0.001, y + PIT.depth); plugFace.scale.set(1, h, 1); plugFace.position.set(0, -PIT.depth + h / 2, 0.001); plugFace.visible = h > 0.01;
  const uv = plugFace.geometry.attributes.uv, p = plugFace.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, (-PIT.depth + (p.getY(i) + 0.5) * h) / 4); uv.needsUpdate = true;
}
const clumpGeo = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(0.5, 2)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 6) * Math.sin(v.y * 5 + 1) + 0.12 * Math.sin(v.z * 8)); p.setXYZ(i, v.x, v.y * 0.8, v.z); } g.computeVertexNormals(); return g; })();
const NC = 150, clumps = new THREE.InstancedMesh(clumpGeo, dirtM, NC); clumps.castShadow = true; scene.add(clumps);
const clumpData = Array.from({ length: NC }, () => ({ x: PIT.x0 + 0.6 + rnd() * 8.8, z: PIT.z0 + 0.6 + rnd() * 6.8, tx: 9.6 + (rnd() - 0.5) * 3.2, tz: -11.8 + (rnd() - 0.5) * 2.6, s: 0.2 + rnd() ** 1.5 * 0.45, r: rnd() }));
const mound = new THREE.Mesh((() => { const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = 1 + 0.07 * Math.sin(v.x * 7) * Math.cos(v.z * 6); p.setXYZ(i, v.x * f, v.y * 0.5 * f, v.z * f); } g.computeVertexNormals(); return g; })(), dirtM);
mound.position.set(9.6, 0, -11.8); mound.castShadow = mound.receiveShadow = true; scene.add(mound);

// ---------- clay base, liner, covers, cap (anchored so they grow from one side) ----------
function anchored(m, sx, sy, sz, ax, ay, az, r = 0.04) { const g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(r, Math.min(sx, sy, sz) * 0.45)); g.translate(ax * sx / 2, ay * sy / 2, az * sz / 2); const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; o.visible = false; scene.add(o); return o; }
const CT = 0.5, LTA = 0.16;
const clay = { floor: anchored(clayM, 10, CT, 8, 0, 0, 1), back: anchored(clayM, 10, 6, CT, 0, 1, 0), l: anchored(clayM, CT, 6, 8, 0, 1, 0), r: anchored(clayM, CT, 6, 8, 0, 1, 0) };
clay.floor.position.set(0, -6 + CT / 2, -8); clay.back.position.set(0, -6, -8 + CT / 2); clay.l.position.set(-5 + CT / 2, -6, -4); clay.r.position.set(5 - CT / 2, -6, -4);
const liner = { back: anchored(linerA, 9, 5.5, LTA, 0, -1, 0), l: anchored(linerA, LTA, 5.5, 7.5, 0, -1, 0), r: anchored(linerA, LTA, 5.5, 7.5, 0, -1, 0), floor: anchored(linerA, 9, LTA, 7.5, 0, 0, 1),
  lipB: anchored(linerA, 10.6, LTA, 1.1, 0, 0, 1), lipL: anchored(linerA, 1.1, LTA, 8, -1, 0, 0), lipR: anchored(linerA, 1.1, LTA, 8, 1, 0, 0),
  rimB: anchored(rimM, 10.8, 0.06, 0.07, 0, 0, 0, 0.02), rimL: anchored(rimM, 0.07, 0.06, 8, 0, 0, 0, 0.02), rimR: anchored(rimM, 0.07, 0.06, 8, 0, 0, 0, 0.02) };
liner.back.position.set(0, 0, -7.5 + LTA / 2); liner.l.position.set(-4.5 + LTA / 2, 0, -3.75); liner.r.position.set(4.5 - LTA / 2, 0, -3.75); liner.floor.position.set(0, -5.5 + LTA / 2, -7.5);
liner.lipB.position.set(0, LTA / 2, -8.6); liner.lipL.position.set(-4.5, LTA / 2, -4); liner.lipR.position.set(4.5, LTA / 2, -4);
liner.rimB.position.set(0, LTA + 0.03, -8.62); liner.rimL.position.set(-5.62, LTA + 0.03, -4); liner.rimR.position.set(5.62, LTA + 0.03, -4);
const FLOOR = -5.5 + LTA, BAGH = 1.6, COVER = 0.32;
const L1 = FLOOR, C1 = L1 + BAGH, L2 = C1 + COVER, C2 = L2 + BAGH, CAP0 = C2 + COVER;
const IX0 = -4.5 + LTA, IX1 = 4.5 - LTA, IZ0 = -7.5 + LTA, IZ1 = 0;
const cover1 = anchored(coverA, IX1 - IX0, COVER, IZ1 - IZ0, 0, 0, 1, 0.06); cover1.position.set(0, C1 + COVER / 2, IZ0);
const cover2 = anchored(coverA, IX1 - IX0, COVER, IZ1 - IZ0, 0, 0, 1, 0.06); cover2.position.set(0, C2 + COVER / 2, IZ0);
const capSoil = anchored(coverA, 10, -CAP0 + 0.02, 8.4, 0, 0, 1, 0.08); capSoil.position.set(0, CAP0 / 2 + 0.01, -8.4);
const capGrass = anchored(grassM, 10.8, 0.28, 8.6, 0, 0, 1, 0.14); capGrass.position.set(0, 0.14, -8.6);
{ const uv = capGrass.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.7, uv.getY(i) * 2.2); }

// ---------- bags: layer 1 poured from the truck, layer 2 dropped in ----------
function bagLayer(y0, n0) {
  const out = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const cw = (IX1 - IX0) / 5, cd = (IZ1 - IZ0) / 4, w = cw * (0.98 + rnd() * 0.08), d = cd * (0.98 + rnd() * 0.08), h = BAGH * (0.9 + rnd() * 0.12);
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const m = bagMatsA[(i * 2 + j * 3 + n0) % bagMatsA.length];
    const b = new THREE.Mesh(bagGeo(w, h, d, rnd() * 10), m); b.castShadow = b.receiveShadow = true; g.add(b);
    if (rnd() < 0.5) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), m); k.position.set((rnd() - 0.5) * 0.3, h / 2 + 0.15, (rnd() - 0.5) * 0.3); k.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); k.castShadow = true; g.add(k); }
    out.push({ g, h, x: IX0 + cw * (i + 0.5), z: IZ0 + cd * (j + 0.5), n: out.length, spin: (rnd() - 0.5) * 2, y0 });
  }
  return out;
}
const bags1 = bagLayer(-6, 0), bags2 = bagLayer(L2, 3);

// ---------- dump truck ----------
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
const truckZ = (t) => -40 + (-12.6 + 40) * eOut(span(t, 0, 1.0)) - 36 * eInOut(span(t, TM.landfill + 0.6, TM.landfill + 2.8));
const tipAt = (t) => 0.75 * (eInOut(span(t, TM.throw + 0.02, TM.throw + 0.45)) - eInOut(span(t, TM.landfill - 0.1, TM.landfill + 0.5)));

// ---------- drain pipe (grows along its path through the cut face) + tank ----------
const PZ = -0.06;
const drainPath = [[-4.3, -5.55, PZ], [4.7, -5.55, PZ], [7.6, -5.55, PZ], [7.6, 0.35, PZ], [8.7, 0.35, PZ]].map((p) => new THREE.Vector3(...p));
const drainSegs = []; let drainLen = 0;
for (let i = 0; i < drainPath.length - 1; i++) {
  const A = drainPath[i], B = drainPath[i + 1], len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(0.24, 0.24, 1, 24); g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, pipeA); m.position.copy(A); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; m.visible = false; scene.add(m);
  const j = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 12), pipeA); j.position.copy(B); j.visible = false; scene.add(j);
  drainSegs.push({ m, j, from: drainLen, len }); drainLen += len;
}
const tank = new THREE.Group(); tank.position.set(9.9, 0, -0.9); scene.add(tank); tank.scale.setScalar(0);
cyl(tankA, 1.3, 2.6, 0, 1.3, 0, tank, "y", 48); { const cap = new THREE.Mesh(new THREE.SphereGeometry(1.32, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), tankA); cap.scale.y = 0.3; cap.position.y = 2.6; tank.add(cap); for (const yy of [0.5, 2.0]) { const band = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 8, 48), P.chassis); band.rotation.x = Math.PI / 2; band.position.y = yy; tank.add(band); } }
const NJ = 14, juice = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), std({ color: C("#4a3b18"), roughness: 0.5 }), NJ); juice.renderOrder = 4; scene.add(juice);
function onDrain(d) { let acc = 0; for (let i = 0; i < drainPath.length - 1; i++) { const A = drainPath[i], B = drainPath[i + 1], len = A.distanceTo(B); if (d <= acc + len) return A.clone().lerp(B, (d - acc) / len); acc += len; } return drainPath.at(-1).clone(); }

// ---------- newspaper (pops out of the trash) ----------
const paperTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 680; const g = c.getContext("2d");
  g.fillStyle = "#efe6cf"; g.fillRect(0, 0, 512, 680); g.fillStyle = "#2a2622"; g.font = "bold 50px Georgia, serif"; g.textAlign = "center"; g.fillText("THE DAILY NEWS", 256, 74, 470);
  g.fillRect(28, 92, 456, 4); g.font = "bold 30px Georgia, serif"; g.fillText("JUNE 3, 1952", 256, 132, 440); g.font = "bold 38px Georgia, serif"; g.fillText("NEW HIGHWAY OPENS", 256, 196, 460);
  g.fillStyle = "#6b6358"; for (let col = 0; col < 3; col++) for (let r = 0; r < 26; r++) g.fillRect(34 + col * 154, 226 + r * 16, 136 - (r % 5 === 4 ? 50 : 0), 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.26, 8, 8), std({ map: paperTex, roughness: 0.9, side: THREE.DoubleSide }));
{ const p = paper.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getX(i) * 2.2) + 0.04 * Math.cos(p.getY(i) * 1.7)); paper.geometry.computeVertexNormals(); }
paper.castShadow = true; paper.visible = false; scene.add(paper);

// ---------- gas: bubbles, the gas well, the flare, the generator ----------
const GX = -2.6, GZ = -4.6;
const gasPipeG = new THREE.CylinderGeometry(0.2, 0.2, 1, 20); gasPipeG.translate(0, 0.5, 0);
const gasPipe = new THREE.Mesh(gasPipeG, metalA); gasPipe.position.set(GX, FLOOR, GZ); gasPipe.castShadow = true; gasPipe.visible = false; scene.add(gasPipe);
const wellhead = box(P.chassis, 0.85, 0.5, 0.85, GX, 3.2, GZ, scene, 0.1); wellhead.scale.setScalar(0);
const flameG = new THREE.Group(); flameG.position.set(GX, 3.45, GZ); scene.add(flameG); flameG.scale.setScalar(0);
{ const tear = (w, h) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * Math.pow(1 - t, 0.55), t * h)); } return new THREE.LatheGeometry(pts, 32); };
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: C(c), toneMapped: false, transparent: true, opacity: o, depthWrite: false });
  [[0.3, 0.9, "#fff1a0", 1, 1], [0.5, 1.6, "#ffb02a", 0.8, 2], [0.72, 2.4, "#ff6410", 0.5, 3]].forEach(([w, h, c, o, ord]) => { const f = new THREE.Mesh(tear(w, h), fm(c, o)); f.renderOrder = ord; flameG.add(f); });
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const gg = cv.getContext("2d"); const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, "rgba(255,200,90,1)"); rg.addColorStop(0.3, "rgba(255,150,40,0.5)"); rg.addColorStop(1, "rgba(255,120,30,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace; const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); halo.position.set(0, 0.9, 0); halo.scale.set(4.2, 4.2, 1); flameG.add(halo); }
const flareLight = new THREE.PointLight(0xffa040, 0, 12, 1.5); flareLight.position.set(GX, 4.3, GZ); scene.add(flareLight);
const NB = 46, bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), phys({ color: C("#d9f0a0"), transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1 }), NB); bubbles.renderOrder = 4; scene.add(bubbles);
const bubbleData = Array.from({ length: NB }, () => ({ x: IX0 + 0.4 + rnd() * (IX1 - IX0 - 0.8), z: -0.15, ph: rnd(), s: 0.07 + rnd() * 0.08, w: rnd() * 6 }));
const gen = new THREE.Group(); gen.position.set(-8.4, 0, -11.6); gen.rotation.y = 0.5; scene.add(gen); gen.scale.setScalar(0);
box(std({ color: C("#cfd4da"), roughness: 0.5, metalness: 0.3 }), 2.6, 1.7, 1.7, 0, 0.85, 0, gen, 0.1); box(std({ color: C("#f08a24"), roughness: 0.5 }), 2.62, 0.22, 1.72, 0, 1.25, 0, gen, 0.04); cyl(metalA, 0.12, 1.0, 0.8, 2.2, -0.3, gen, "y", 12);
const lineSegs = [[GX, 0.2, GZ - 0.6], [GX, 0.2, -10.4], [-7.2, 0.2, -11.0]].map((p) => new THREE.Vector3(...p));
const genLine = []; let genLen = 0;
for (let i = 0; i < lineSegs.length - 1; i++) { const A = lineSegs[i], B = lineSegs[i + 1], len = A.distanceTo(B); const g = new THREE.CylinderGeometry(0.15, 0.15, 1, 16); g.translate(0, 0.5, 0); const m = new THREE.Mesh(g, metalA); m.position.copy(A); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.visible = false; m.castShadow = true; scene.add(m); genLine.push({ m, from: genLen, len }); genLen += len; }

// ---------- finishing touches: fence, young trees; the end-card sign ----------
const postM = std({ color: C("#f4efe4"), roughness: 0.6 }), railM = std({ color: C("#f4efe4"), roughness: 0.6 });
const posts = [];
for (let x = -6.2; x <= 6.21; x += 1.55) posts.push([x, -9.6]);
for (let z = -8.05; z <= -0.6; z += 1.55) { posts.push([-6.2, z]); posts.push([6.2, z]); }
const fence = posts.map(([x, z], i) => { const o = box(postM, 0.16, 1.15, 0.16, x, 0.58, z, scene, 0.04); o.scale.setScalar(0); return { o, i, x, z }; });
const rails = [box(railM, 12.4, 0.1, 0.06, 0, 0.8, -9.6, scene, 0.02), box(railM, 12.4, 0.1, 0.06, 0, 0.45, -9.6, scene, 0.02), box(railM, 0.06, 0.1, 9.0, -6.2, 0.8, -5.1, scene, 0.02), box(railM, 0.06, 0.1, 9.0, 6.2, 0.8, -5.1, scene, 0.02), box(railM, 0.06, 0.1, 9.0, -6.2, 0.45, -5.1, scene, 0.02), box(railM, 0.06, 0.1, 9.0, 6.2, 0.45, -5.1, scene, 0.02)];
rails.forEach((r) => { r.visible = false; });
const young = [[-8.0, -3.6, 0.55], [8.2, -6.8, 0.6], [-7.4, -11.4, 0.5]].map(([x, z, s]) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); cyl(P.trunk, 0.16 * s * 2, 2.2 * s * 2, 0, 1.1 * s * 2, 0, g, "y", 10);
  for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(mergeVertices(new THREE.IcosahedronGeometry((0.8 + rnd() * 0.3) * s * 2, 3)), k % 2 ? P.leaf : P.leaf2); l.geometry.computeVertexNormals(); const a = rnd() * 6.28; l.position.set(Math.cos(a) * 0.4 * s * 2, (2.4 + rnd() * 0.6) * s * 2, Math.sin(a) * 0.4 * s * 2); l.castShadow = true; g.add(l); }
  g.scale.setScalar(0); return g; });
const SIGN_S = 1.5;
const sign = new THREE.Group(); sign.position.set(0.0, 0.25, -2.2); sign.rotation.y = 0.3; scene.add(sign); sign.scale.setScalar(0); sign.visible = END_CARD;
{ const c = document.createElement("canvas"); c.width = 1024; c.height = 560; const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 1024, 560); g.fillStyle = "#22c55e"; g.fillRect(0, 0, 1024, 26); g.fillRect(0, 534, 1024, 26);
  g.textAlign = "center"; g.fillStyle = "#14181c"; g.font = "900 92px 'Arial Black', Arial, sans-serif"; g.fillText("Make videos", 512, 168); g.fillText("like this with", 512, 272);
  g.fillStyle = "#16a34a"; g.font = "900 112px 'Arial Black', Arial, sans-serif"; g.fillText("Zyvo", 512, 392);
  g.fillStyle = "#3a434c"; g.font = "700 64px Arial, sans-serif"; g.fillText("tryzyvo.com", 512, 488);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const face = std({ map: t, roughness: 0.55 }), edge = std({ color: C("#e9e4d8"), roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.06, 0.18), [edge, edge, edge, edge, face, edge]); board.position.y = 3.2; board.castShadow = true; sign.add(board);
  for (const x of [-2.1, 2.1]) cyl(std({ color: C("#7a5236"), roughness: 0.8 }), 0.14, 2.0, x, 1.0, -0.05, sign, "y", 12); }

// ---------- overlays: seep arrows, murky flow, liner outline ----------
const arrowGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.16, 0.5); s.lineTo(0.16, 0.5); s.lineTo(0.16, 0.0); s.lineTo(0.38, 0.0); s.lineTo(0, -0.5); s.lineTo(-0.38, 0.0); s.lineTo(-0.16, 0.0); s.lineTo(-0.16, 0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.scale(1.25, 1.25, 1); return g; })();
const arrows = [-2.0, 0, 2.0].flatMap((x) => [0, 1].map((k) => { const m = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: C("#ffffff"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); m.position.set(x, 0, 0.35); m.renderOrder = 5; scene.add(m); return { m, x, k }; }));
const NF = 70, flow = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), std({ color: C("#4a3b18"), roughness: 0.6 }), NF); flow.renderOrder = 4; scene.add(flow);
const flowData = Array.from({ length: NF }, () => ({ x: (rnd() - 0.5) * 4.4, ph: rnd(), side: rnd() < 0.5 ? -1 : 1, spread: 2 + rnd() * 8, s: 0.08 + rnd() * 0.09 }));
const hl = (() => { const pts = [new THREE.Vector3(-4.92, 0.1, 0.06), new THREE.Vector3(-4.92, -5.92, 0.06), new THREE.Vector3(4.92, -5.92, 0.06), new THREE.Vector3(4.92, 0.1, 0.06)];
  const path = new THREE.CurvePath(); for (let i = 0; i < 3; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.11, 10, false), new THREE.MeshBasicMaterial({ color: C("#ffd34d"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 6; scene.add(m); return m; })();
waterMesh.material.onBeforeCompile = (sh) => { sh.uniforms.uMurk = U.uMurk; sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW2 = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW2; uniform vec3 uMurk;").replace("#include <color_fragment>", "#include <color_fragment>\nfloat md = abs(vW2.x - uMurk.x) + (-11.0 - vW2.y) * 0.6; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.24, 0.07), clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);"); };

// ---------- camera: one home angle, slow drift, moves between sentences; named parts kept off the caption band ----------
const HOME = [[13.0, 10.8, 33.5], [0.2, 2.3, -9.0]];
const KEYS = [
  [0.0, ...HOME],
  [TM.landfill + 0.3, [12.6, 10.4, 32.2], [0.2, 2.0, -8.8]],
  [TM.leaks + 0.2, [11.6, 1.6, 28.5], [0.0, -9.6, -4.0]], //                 groundwater below the caption
  [TM.drink + 0.25, [11.3, 1.3, 27.6], [0.0, -9.9, -4.0]],
  [TM.lay + 0.4, [12.8, 10.2, 31.0], [0.2, 1.9, -8.4]],
  [TM.not + 0.25, [11.8, 3.6, 28.8], [0.0, -7.4, -4.0]], //                  dip for the second seep
  [TM.add + 0.35, [12.4, 9.8, 30.0], [0.2, 1.7, -8.2]],
  [TM.this - 0.12, [12.0, 9.5, 29.0], [0.2, 1.6, -8.0]],
  [TM.this + 0.6, [5.6, 4.6, 27.5], [-0.2, -2.6, -4.4]], //                  the lined pit, the U outline on "liner"
  [TM.pipe - 0.05, [5.4, 4.4, 26.8], [-0.2, -2.7, -4.5]],
  [TM.drains + 0.5, [14.5, 4.6, 28.5], [5.4, -1.8, -3.0]], //                pipe and tank (whole tank in frame)
  [TM.tank + 0.9, [14.7, 4.8, 28.0], [5.6, -1.7, -3.0]],
  [TM.sealed + 0.6, [10.5, 6.8, 27.0], [0.0, -2.4, -5.0]], //                 layers and covers
  [TM.buried + 0.4, [10.2, 6.6, 26.2], [0.0, -2.2, -5.0]],
  [TM.newspaper + 0.5, [3.8, 2.4, 14.8], [0.2, -3.0, -2.4]], //              the newspaper high in the frame: above the card (30%) and the caption (52%)
  [TM.readable + 0.9, [3.6, 2.3, 14.2], [0.2, -3.0, -2.4]],
  [TM.but2 + 0.5, [12.6, 10.2, 31.0], [0.0, 1.2, -8.2]], //                  gas: bubbles, pipe, flare
  [TM.flame + 0.4, [9.6, 9.4, 28.5], [-1.6, 1.4, -8.6]],
  [TM.electricity + 0.5, [7.4, 10.2, 29.0], [-3.2, 1.0, -9.6]], //           the generator
  [TM.add2 + 0.2, [12.4, 11.0, 32.0], [0.2, 1.6, -8.8]], //                  the cap, fence, trees
  [TM.congrats + 0.1, [13.6, 12.0, 34.5], [0.3, 1.5, -9.0]],
  [TM.lengthNoEnd, [16.0, 15.2, 41.0], [0.4, 1.4, -9.4]], //                  pull back to the calm, finished scene
  ...(END_CARD ? [[TM.lengthEnd, [10.5, 9.6, 30.0], [0.0, 2.6, -4.0]]] : []), // end card: a gentle push toward the sign
];
function monotone(xs, ys) { const n = xs.length, d = [], m = new Array(n).fill(0); for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])); for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]); return (x) => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], u = clamp01((x - xs[i]) / h); return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1]; }; }
const KT = KEYS.map((k) => k[0]), camF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[1][a]))), tgtF = [0, 1, 2].map((a) => monotone(KT, KEYS.map((k) => k[2][a])));

// ---------- the timeline ----------
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), AX = new THREE.Vector3(1, 0.4, 0.2).normalize();
function placeBag(b, t, rel, from, DUR, settle) {
  if (t < rel) { b.g.visible = false; return; }
  b.g.visible = true;
  const rest = b.y0 + b.h / 2, u = span(t, rel, rel + DUR);
  let x = b.x, y = rest, z = b.z, rx = 0, ry = 0;
  if (u < 1) { const ex = eOut(u), ey = u * u; x = from.x + (b.x - from.x) * ex; z = from.z + (b.z - from.z) * ex; y = from.y + (rest - from.y) * ey + Math.sin(u * Math.PI) * 1.0; rx = b.spin * (1 - u) * 0.6; ry = b.spin * u * 0.4; }
  else y = rest + settle(t);
  let sq = 0; const k = span(t, rel + DUR, rel + DUR + 0.25); if (k > 0 && k < 1) sq = Math.sin(k * Math.PI) * 0.15;
  b.g.position.set(x, y, z); b.g.rotation.set(rx, ry, 0); b.g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
}
window.renderAt = (t) => {
  setPlug(t);
  let flown = 0;
  clumpData.forEach((c, i) => { const t0 = DIG0 + c.r * 0.85 * (DIG1 - DIG0), u = span(t, t0, t0 + 0.6);
    if (u <= 0 || u >= 1) { if (u >= 1) flown++; m4.makeScale(0, 0, 0); } else { const y0 = digDepth(t0), e = eOut(u); v4.set(c.x + (c.tx - c.x) * e, y0 + (1.0 - y0) * e + Math.sin(u * Math.PI) * 4.2, c.z + (c.tz - c.z) * e); q4.setFromAxisAngle(AX, u * 4 * (c.r - 0.5)); const s = c.s * (1 - u * 0.4); m4.compose(v4, q4, s4.set(s, s, s)); }
    clumps.setMatrixAt(i, m4); });
  clumps.instanceMatrix.needsUpdate = true;
  const ms = 0.05 + eBack(clamp01(flown / NC)) * 2.6; mound.scale.set(ms * 1.15, ms, ms);
  truck.position.set(0, 0, truckZ(t)); pivot.rotation.x = tipAt(t); wheels.forEach((w) => { w.rotation.x = -truckZ(t) * 1.6; });
  load.forEach((b) => { b.visible = t < TM.throw + 0.25; });

  // leaks: seep 1 to the groundwater (cleared by the clay), seep 2 on "not enough" (cleared by the liner)
  const c1 = 1 - span(t, TM.so + 0.05, TM.lay + 0.6);
  U.uLeak.value.set(3.0, -6 - eOut(span(t, TM.leaks, TM.groundwater + 0.1)) * 5.3, t > TM.leaks ? 0.9 * c1 : 0, 0);
  U.uLeak2.value.set(1.4, -6 - eOut(span(t, TM.not, TM.add)) * 3.6, t > TM.not ? 0.85 * (1 - span(t, TM.plastic, TM.sheet + 0.3)) : 0, 0);
  U.uMurk.value.set(0, Math.max(0, (t - TM.groundwater + 0.1) * 9), t > TM.groundwater - 0.1 ? 0.9 * c1 : 0);
  const arrOn = span(t, TM.leaks - 0.05, TM.leaks + 0.2) * (1 - span(t, TM.so - 0.1, TM.so + 0.25)) + 0.8 * span(t, TM.not, TM.not + 0.2) * (1 - span(t, TM.add - 0.1, TM.add + 0.2));
  arrows.forEach((a) => { const ph = (t * 0.9 + a.k * 0.5 + (a.x === 0 ? 0.25 : 0)) % 1; a.m.position.y = -6.6 - ph * 3.6; a.m.material.opacity = clamp01(arrOn) * Math.sin(ph * Math.PI) * 0.95; a.m.visible = arrOn > 0.01; });
  const flowOn = span(t, TM.leaks + 0.1, TM.leaks + 0.5) * (1 - span(t, TM.so, TM.lay + 0.3));
  flowData.forEach((d, i) => { const ph = (t * 0.55 + d.ph) % 1; let x = d.x * (1 - ph * 0.2), y = -6.2 - ph * 6.2; if (y < -11.2) { const k = (-11.2 - y) / 1.2; y = -11.2 - k * 0.6; x = d.x + d.side * d.spread * k; } const s = flowOn > 0.01 ? d.s * (0.6 + 0.4 * Math.sin(ph * Math.PI)) * flowOn : 0; flow.setMatrixAt(i, m4.compose(v4.set(x, y, 0.12), q4.identity(), s4.set(s, s, s))); });
  flow.instanceMatrix.needsUpdate = true;

  // clay base on "lay"; liner on "plastic sheet"; outline on "liner"
  const cf = eOut(span(t, TM.lay + 0.02, TM.lay + 0.45)), cw = eOut(span(t, TM.lay + 0.25, TM.lay + 0.8));
  clay.floor.visible = cf > 0; clay.floor.scale.set(1, 1, Math.max(0.001, cf)); for (const w of [clay.back, clay.l, clay.r]) { w.visible = cw > 0; w.scale.set(1, Math.max(0.001, cw), 1); }
  const L0 = TM.plastic - 0.35, lb = eOut(span(t, L0, L0 + 0.45)), ls = eOut(span(t, L0 + 0.15, L0 + 0.6)), lf = eOut(span(t, L0 + 0.4, L0 + 0.85)), ll = eBack(span(t, L0 + 0.75, L0 + 1.05));
  liner.back.visible = lb > 0; liner.back.scale.set(1, Math.max(0.001, lb), 1); for (const s of [liner.l, liner.r]) { s.visible = ls > 0; s.scale.set(1, Math.max(0.001, ls), 1); }
  liner.floor.visible = lf > 0; liner.floor.scale.set(1, 1, Math.max(0.001, lf));
  for (const k of ["lipB", "lipL", "lipR", "rimB", "rimL", "rimR"]) liner[k].visible = ll > 0.001;
  liner.lipB.scale.z = Math.max(0.001, ll); liner.lipL.scale.x = Math.max(0.001, ll); liner.lipR.scale.x = Math.max(0.001, ll);
  const hlOn = span(t, TM.liner - 0.05, TM.liner + 0.15) * (1 - span(t, TM.liner + 0.6, TM.pipe + 0.2)); hl.visible = hlOn > 0.01; hl.material.opacity = hlOn * (0.85 + 0.15 * Math.sin(t * 9));

  // bags: layer 1 poured on "throw", lifted for the clay and the liner; layer 2 dropped on "rots"
  const LIFT = 2.6, truckRear = new THREE.Vector3(0, 2.8, truckZ(TM.throw + 0.2) + 3.8);
  for (const b of bags1) placeBag(b, t, TM.throw + 0.2 + b.n * 0.035, truckRear, 0.6, (tt) => {
    const up1 = eOut(span(tt, TM.so + 0.02 + b.n * 0.008, TM.so + 0.35)), dn1 = span(tt, TM.lay + 0.8 + b.n * 0.012, TM.lay + 1.2) ** 2;
    const up2 = eOut(span(tt, TM.add + b.n * 0.008, TM.add + 0.35)), dn2 = span(tt, L0 + 1.05 + b.n * 0.012, L0 + 1.45) ** 2;
    return LIFT * (up1 - dn1 + up2 - dn2) + CT * dn1 + LTA * dn2;
  });
  for (const b of bags2) placeBag(b, t, TM.rots - 0.25 + b.n * 0.03, new THREE.Vector3(b.x * 0.6, 7, b.z), 0.55, () => 0);
  // covers and the cap wipe in back-to-front
  const cv1 = eOut(span(t, TM.sealed, TM.sealed + 0.6)), cv2 = eOut(span(t, TM.buried - 0.3, TM.buried + 0.3));
  cover1.visible = cv1 > 0; cover1.scale.z = Math.max(0.001, cv1); cover2.visible = cv2 > 0; cover2.scale.z = Math.max(0.001, cv2);
  const capS = eOut(span(t, TM.cap - 0.35, TM.cap + 0.3)), capG = eOut(span(t, TM.cap - 0.15, TM.cap + 0.5));
  capSoil.visible = capS > 0; capSoil.scale.z = Math.max(0.001, capS); capGrass.visible = capG > 0; capGrass.scale.z = Math.max(0.001, capG);

  // drain pipe grows on "pipe drains", juice flows to the tank, which pops in on "tank"
  const grow = eInOut(span(t, TM.pipe - 0.05, TM.drains + 0.55)) * drainLen;
  drainSegs.forEach((sg) => { const f = clamp01((grow - sg.from) / sg.len); sg.m.visible = f > 0; sg.m.scale.set(1, Math.max(0.001, f) * sg.len, 1); sg.j.visible = f >= 1; });
  tank.scale.setScalar(pop(t, TM.tank - 0.1, 0.4));
  const jOn = span(t, TM.drains + 0.3, TM.drains + 0.6) * (1 - span(t, TM.tank + 1.6, TM.tank + 2.0));
  for (let i = 0; i < NJ; i++) { const d = ((t * 3.2 + i / NJ * drainLen) % drainLen); const p = onDrain(d); p.z += 0.22; const s = jOn > 0.01 && d < grow ? jOn : 0; juice.setMatrixAt(i, m4.compose(p, q4.identity(), s4.setScalar(s))); }
  juice.instanceMatrix.needsUpdate = true;

  // newspaper rises on "newspaper", time passes ("decades": two quick light dips), sinks back on "But"
  const pu = eOut(span(t, TM.newspaper - 0.1, TM.newspaper + 0.6)), pd = span(t, TM.but2 - 0.1, TM.but2 + 0.4) ** 2;
  paper.visible = pu > 0 && pd < 1;
  paper.position.set(0.3, (L2 + 0.6) + (1.0 - (L2 + 0.6)) * pu - 3.4 * pd, -1.4 + 0.3 * pu);
  paper.rotation.set(-0.25 + 0.15 * Math.sin(t * 1.3), 0.25 * (1 - pu) + 0.06 * Math.sin(t * 0.9), 0.08 * Math.sin(t * 1.1));
  paper.scale.setScalar(Math.max(0.001, pop(t, TM.newspaper - 0.1, 0.45) * (1 - pd)));
  const dip = Math.max(Math.sin(Math.PI * span(t, TM.decades - 0.05, TM.decades + 0.35)), Math.sin(Math.PI * span(t, TM.decades + 0.4, TM.decades + 0.8)));
  sun.intensity = BASE.sun * (1 - 0.75 * dip); if (hemi) hemi.intensity = BASE.hemi * (1 - 0.55 * dip); scene.environmentIntensity = BASE.env * (1 - 0.6 * dip);

  // gas: bubbles rise from "But trapped trash"; the gas pipe grows on "pipe carries"; the flare lights on "flame"
  const bOn = span(t, TM.but2 + 0.2, TM.but2 + 0.6) * (1 - span(t, TM.cap - 0.4, TM.cap));
  bubbleData.forEach((d, i) => { const ph = (t * 0.35 + d.ph) % 1; const y = L1 + 0.3 + ph * (C2 - L1); const x = d.x + 0.15 * Math.sin(t * 2 + d.w); const s = bOn > 0.01 ? d.s * Math.sin(ph * Math.PI) * bOn : 0; bubbles.setMatrixAt(i, m4.compose(v4.set(x, y, d.z), q4.identity(), s4.setScalar(s))); });
  bubbles.instanceMatrix.needsUpdate = true;
  const gp = eInOut(span(t, TM.pipe2 - 0.05, TM.carries + 0.6)); gasPipe.visible = gp > 0; gasPipe.scale.set(1, Math.max(0.001, gp * (3.0 - FLOOR)), 1);
  wellhead.scale.setScalar(pop(t, TM.carries + 0.55, 0.3));
  const fl = pop(t, TM.flame - 0.05, 0.4); flameG.scale.set(fl * (1 + 0.06 * Math.sin(t * 13)), fl * (1 + 0.1 * Math.sin(t * 9 + 1)), fl); flareLight.intensity = 30 * Math.min(1, fl);
  // generator + its gas line on "electricity"
  const gl = eInOut(span(t, TM.electricity - 0.5, TM.electricity + 0.3)) * genLen;
  genLine.forEach((sg) => { const f = clamp01((gl - sg.from) / sg.len); sg.m.visible = f > 0; sg.m.scale.set(1, Math.max(0.001, f) * sg.len, 1); });
  gen.scale.setScalar(pop(t, TM.electricity + 0.15, 0.4));

  // finishing touches: fence posts pop one after another, rails, young trees
  fence.forEach((p) => p.o.scale.setScalar(pop(t, TM.fence - 0.1 + p.i * 0.025, 0.3)));
  rails.forEach((r) => { r.visible = t > TM.fence + 0.45; });
  young.forEach((g, i) => g.scale.setScalar(pop(t, TM.trees - 0.25 + i * 0.12, 0.45)));
  // end card: the sign pops into the diorama
  if (END_CARD) sign.scale.setScalar(SIGN_S * pop(t, TM.signPop, 0.45));

  camera.position.set(...camF.map((f) => f(t))); camera.lookAt(...tgtF.map((f) => f(t)));
  composer.render(); return true;
};
