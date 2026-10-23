// Blocky landfill opening (10 s): pit dug -> truck dumps trash -> juice leaks -> liner unrolls.
// Everything is driven by window.renderAt(t) so every frame is deterministic.
import * as THREE from "three";

const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = 0x9fd8ff;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 45, 110);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x9a7a55, 1.25));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(14, 28, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0008;
scene.add(sun);

// ---------- pixel textures (16x16, nearest filter: the Minecraft look) ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function tex(base, spread, opts = {}) {
  const c = document.createElement("canvas"); c.width = c.height = 16;
  const g = c.getContext("2d");
  const [r0, g0, b0] = base;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let k = 1 + (rnd() - 0.5) * spread;
    let [r, gg, b] = [r0 * k, g0 * k, b0 * k];
    if (opts.topStrip && y < opts.topStrip + (rnd() < 0.4 ? 1 : 0)) { const s = opts.stripColor, kk = 1 + (rnd() - 0.5) * 0.18; [r, gg, b] = [s[0] * kk, s[1] * kk, s[2] * kk]; }
    if (opts.speckle && rnd() < opts.speckle.p) { const s = opts.speckle.c; [r, gg, b] = s; }
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GRASS = [106, 190, 70], DIRT = [150, 104, 64], DEEP = [122, 84, 54], STONE = [138, 140, 146];
const lam = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
const grassTop = lam(tex(GRASS, 0.22));
const grassSide = lam(tex(DIRT, 0.22, { topStrip: 4, stripColor: GRASS }));
const dirtM = lam(tex(DIRT, 0.24));
const deepM = lam(tex(DEEP, 0.22, { speckle: { p: 0.05, c: [100, 70, 45] } }));
const stoneM = lam(tex(STONE, 0.2, { speckle: { p: 0.08, c: [105, 108, 114] } }));
const gravelM = lam(tex([150, 146, 140], 0.35));
const box = new THREE.BoxGeometry(1, 1, 1);

// ---------- the ground block: x -16..15, z -14..-1 (front cut face at z = 0), 10 layers ----------
const XS = [-16, 16], ZS = [-14, 0], LAYERS = 10;
const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 }; // pit open to the cut face
const inPit = (x, z, k) => x >= PIT.x0 && x < PIT.x1 && z >= PIT.z0 && k < PIT.depth;
const isRoad = (x, z) => x >= -2 && x < 2 && z < -9;
const kinds = { grass: [], road: [], dirt: [], deep: [], stone: [] };
for (let k = 0; k < LAYERS; k++) for (let x = XS[0]; x < XS[1]; x++) for (let z = ZS[0]; z < ZS[1]; z++) {
  const kind = k === 0 ? (isRoad(x, z) ? "road" : "grass") : k <= 3 ? "dirt" : k <= 6 ? "deep" : "stone";
  kinds[kind].push({ x: x + 0.5, y: -0.5 - k, z: z + 0.5, k, pit: inPit(x, z, k), r: rnd() });
}
function inst(list, material) {
  const m = new THREE.InstancedMesh(box, material, list.length);
  m.castShadow = m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
  return m;
}
const meshes = {
  grass: inst(kinds.grass, [grassSide, grassSide, grassTop, dirtM, grassSide, grassSide]),
  road: inst(kinds.road, gravelM),
  dirt: inst(kinds.dirt, dirtM),
  deep: inst(kinds.deep, deepM),
  stone: inst(kinds.stone, stoneM),
};
const white = new THREE.Color(1, 1, 1);
for (const [kind, list] of Object.entries(kinds)) list.forEach((b, i) => meshes[kind].setColorAt(i, white));

// soil continues below the block (no sky under the cut)
{ const under = new THREE.Mesh(box, stoneM.clone()); under.material.map = tex(DEEP, 0.22); under.scale.set(32, 30, 14); under.position.set(0, -LAYERS - 15, -7); under.material.map.wrapS = under.material.map.wrapT = THREE.RepeatWrapping; under.material.map.repeat.set(32, 30); scene.add(under); }
// lawn beyond the block, a road strip and distant hills
const lawn = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lam(tex(GRASS, 0.12)));
lawn.material.map.wrapS = lawn.material.map.wrapT = THREE.RepeatWrapping; lawn.material.map.repeat.set(400, 400);
lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, -0.002, -200 - 14 + 0.01); lawn.receiveShadow = true;
lawn.geometry.translate(0, 0, 0); scene.add(lawn);
const sideGeo = new THREE.PlaneGeometry(400, 200); const sideLawnL = new THREE.Mesh(sideGeo, lawn.material); sideLawnL.rotation.x = -Math.PI / 2; sideLawnL.receiveShadow = true; sideLawnL.position.set(-216, -0.002, -100); scene.add(sideLawnL);
const sideLawnR = sideLawnL.clone(); sideLawnR.position.x = 216; scene.add(sideLawnR);
const roadFar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 90), gravelM); roadFar.position.set(0, -0.08, -14 - 45); roadFar.receiveShadow = true; scene.add(roadFar);
const hillM = lam(tex([96, 176, 74], 0.15));
for (const [x, z, w, h, d] of [[-30, -70, 30, 8, 14], [8, -80, 40, 12, 16], [40, -66, 24, 7, 12], [-60, -90, 40, 14, 20]]) {
  for (let s = 0; s < 3; s++) { const m = new THREE.Mesh(box, hillM); m.scale.set(w - s * w * 0.28, h / 3, d - s * d * 0.25); m.position.set(x, (h / 3) * (s + 0.5), z); scene.add(m); }
}
// blocky trees
const trunkM = lam(tex([110, 78, 48], 0.2)), leafM = lam(tex([64, 150, 56], 0.3));
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(box, trunkM); t.scale.set(0.9 * s, 3 * s, 0.9 * s); t.position.y = 1.5 * s; g.add(t);
  const l = new THREE.Mesh(box, leafM); l.scale.set(3.6 * s, 2.6 * s, 3.6 * s); l.position.y = 3.9 * s; g.add(l);
  const l2 = new THREE.Mesh(box, leafM); l2.scale.set(2.2 * s, 1.4 * s, 2.2 * s); l2.position.y = 5.6 * s; g.add(l2);
  g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  g.position.set(x, 0, z); scene.add(g);
}
tree(-11, -11); tree(12.5, -3.5, 0.9); tree(-14, -26, 1.2); tree(16, -30, 1.3); tree(-4, -40, 1.1);
// a simple house far back
{
  const g = new THREE.Group();
  const wall = new THREE.Mesh(box, lam(tex([236, 232, 220], 0.06))); wall.scale.set(7, 4, 5); wall.position.y = 2; g.add(wall);
  const roofM = lam(tex([196, 72, 52], 0.15));
  for (let s = 0; s < 3; s++) { const r = new THREE.Mesh(box, roofM); r.scale.set(7.6, 0.9, 5.6 - s * 1.8); r.position.y = 4.45 + s * 0.9; g.add(r); }
  const door = new THREE.Mesh(box, lam(tex([120, 80, 50], 0.1))); door.scale.set(1.2, 2, 0.1); door.position.set(0, 1, 2.52); g.add(door);
  for (const wx of [-2.3, 2.3]) { const w = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x8fd0f0 })); w.scale.set(1.3, 1.1, 0.1); w.position.set(wx, 2.4, 2.52); g.add(w); }
  g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  g.position.set(-9, 0, -30); scene.add(g);
}

// dirt pile next to the pit (grows while digging)
const pileSpots = [];
for (const [lvl, n] of [[0, 5], [1, 3], [2, 1]]) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pileSpots.push({ x: 9.5 + i - (n - 1) / 2, y: 0.5 + lvl, z: -11.5 + j - (n - 1) / 2, lvl });
const pile = inst(pileSpots, dirtM);

// ---------- truck (reverses in along -z -> +z, bed tips toward the pit) ----------
const truck = new THREE.Group();
const orange = lam(tex([236, 128, 40], 0.12)), darkOrange = lam(tex([214, 108, 30], 0.12)), tyre = lam(tex([40, 40, 44], 0.2)), chassisM = lam(tex([70, 72, 78], 0.15));
const add = (parent, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(box, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
add(truck, chassisM, 2.6, 0.5, 7, 0, 0.9, 0);
add(truck, orange, 2.8, 2.2, 2.2, 0, 2.2, -2.6); // cab at -z
add(truck, new THREE.MeshLambertMaterial({ color: 0x9ad8f2 }), 2.4, 0.9, 0.08, 0, 2.7, -3.72);
for (const [x, z] of [[-1.35, -2.4], [1.35, -2.4], [-1.35, 1.2], [1.35, 1.2], [-1.35, 2.6], [1.35, 2.6]]) add(truck, tyre, 0.6, 1.2, 1.2, x, 0.6, z);
const bedPivot = new THREE.Group(); bedPivot.position.set(0, 1.15, 3.4); truck.add(bedPivot); // hinge at the rear
const bed = new THREE.Group(); bed.position.set(0, 0, -2.25); bedPivot.add(bed);
add(bed, darkOrange, 2.8, 0.25, 4.5, 0, 0.12, 0);
add(bed, orange, 0.2, 1.5, 4.5, -1.3, 0.9, 0); add(bed, orange, 0.2, 1.5, 4.5, 1.3, 0.9, 0); add(bed, orange, 2.8, 1.7, 0.2, 0, 0.95, -2.2);
scene.add(truck);

// ---------- trash: a few chunky bags and boxes ----------
const bagColors = [0x2f6f3a, 0x2a2a2e, 0x3d64b8, 0xe9e3d2, 0xb57d45, 0xc94242, 0x2f6f3a, 0x2a2a2e, 0xe0b23a];
const bagMat = (c) => { const col = new THREE.Color(c); return lam(tex([col.r * 255, col.g * 255, col.b * 255].map((v) => Math.max(30, v)), 0.14)); };
const targets = [[-2.2, -5.0], [0, -5.4], [2.3, -4.8], [-1.2, -2.6], [1.3, -2.4], [3.2, -2.2], [-3.3, -2.2], [-0.8, -4.1], [1.0, -3.8]];
const bags = bagColors.map((c, i) => {
  const s = 1.25 + rnd() * 0.45;
  const g = new THREE.Group();
  const body = add(g, bagMat(c), s, s * 0.85, s, 0, 0, 0);
  if (i % 3 !== 2) add(g, bagMat(c), s * 0.35, s * 0.3, s * 0.35, 0, s * 0.55, 0); // the knot
  const local = new THREE.Vector3((i % 3 - 1) * 0.85, 0.7 + Math.floor(i / 3) * 0.55, -1.5 + (i % 3) * 0.4 + Math.floor(i / 3) * 0.9);
  const lvl = i >= 7 ? 1 : 0;
  const tgt = new THREE.Vector3(targets[i][0], -PIT.depth + s * 0.425 + lvl * 1.15, targets[i][1]);
  scene.add(g);
  return { g, s, local, tgt, release: 5.25 + i * 0.13, spin: (rnd() - 0.5) * 2.2 };
});

// ---------- liner: back wall, two side walls, floor (unrolls) ----------
const linerM = lam(tex([62, 70, 82], 0.12));
function panel(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); return new THREE.Mesh(g, linerM); }
const linerBack = panel(PIT.x1 - PIT.x0, PIT.depth, 0.14); linerBack.geometry.translate(0, -PIT.depth / 2, 0); linerBack.position.set(0, 0.02, PIT.z0 + 0.08);
const linerL = panel(0.14, PIT.depth, -PIT.z0); linerL.geometry.translate(0, -PIT.depth / 2, 0); linerL.position.set(PIT.x0 + 0.08, 0.02, PIT.z0 / 2);
const linerR = linerL.clone(); linerR.position.x = PIT.x1 - 0.08;
const linerF = panel(PIT.x1 - PIT.x0, 0.14, -PIT.z0); linerF.geometry.translate(0, 0, -PIT.z0 / 2); linerF.position.set(0, -PIT.depth + 0.08, PIT.z0);
const lip = panel(PIT.x1 - PIT.x0 + 1.2, 0.14, 0.9); lip.position.set(0, 0.07, PIT.z0 - 0.4);
for (const m of [linerBack, linerL, linerR, linerF, lip]) { m.receiveShadow = true; m.castShadow = true; scene.add(m); }

// ---------- easing ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const span = (t, a, b) => clamp01((t - a) / (b - a));

// ---------- camera: one home angle, slow drifts, one quick push-in (ease in-out) ----------
const KEYS = [
  // t, position, target
  [0.0, [15, 15, 33], [0, -2.5, -6]],
  [2.8, [12.5, 12.5, 27.5], [0, -3, -5.5]],
  [4.4, [12, 13, 27], [0.5, -1.8, -7]],
  [7.6, [10, 10.5, 22.5], [0, -3.5, -5]],
  [8.6, [8.2, 6.4, 17.5], [0, -3.8, -4.4]],
  [10.0, [7.6, 5.8, 16.2], [-0.2, -4.0, -4.6]],
];
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => {
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = clamp01((x - xs[i]) / h);
    return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
  };
}
const T = KEYS.map((k) => k[0]);
const camF = [0, 1, 2].map((a) => monotone(T, KEYS.map((k) => k[1][a])));
const tgtF = [0, 1, 2].map((a) => monotone(T, KEYS.map((k) => k[2][a])));

// ---------- the timeline ----------
const DIG0 = 0.9, LAYER_DT = 0.34, FLY = 0.55;
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
const leakColor = new THREE.Color(0x4a3a1c);
window.renderAt = (t) => {
  // dig: pit blocks fly to the pile layer by layer, top first
  let flown = 0, total = 0;
  for (const [kind, list] of Object.entries(kinds)) {
    const mesh = meshes[kind];
    list.forEach((b, i) => {
      if (b.pit) {
        total++;
        const t0 = DIG0 + b.k * LAYER_DT + b.r * 0.28, u = span(t, t0, t0 + FLY);
        if (u >= 1) { flown++; mtx.makeScale(0, 0, 0); }
        else {
          const to = pileSpots[Math.floor(b.r * 9)];
          const e = easeOutCubic(u);
          v.set(b.x + (to.x - b.x) * e, b.y + (to.y + 1 - b.y) * e + Math.sin(u * Math.PI) * 4, b.z + (to.z - b.z) * e);
          const s = 1 - u * 0.75; sc.set(s, s, s);
          q.setFromAxisAngle(new THREE.Vector3(1, 0.4, 0.2).normalize(), u * 3 * (b.r - 0.5));
          mtx.compose(v, q, sc);
        }
      } else {
        mtx.makeTranslation(b.x, b.y, b.z);
        // juice leaking down under the pit floor (6.8-7.9 s)
        if (kind !== "grass" && kind !== "road") {
          const inside = b.x > -3.5 && b.x < 3.5 && b.z > -6.5 && b.z < 0 && b.k >= PIT.depth && b.k <= PIT.depth + 2;
          if (inside) {
            const tl = 6.7 + (b.k - PIT.depth) * 0.38 + b.r * 0.25 + Math.abs(b.x) * 0.04;
            const u = span(t, tl, tl + 0.35);
            mesh.setColorAt(i, white.clone().lerp(leakColor, u * 0.85));
          }
        }
      }
      mesh.setMatrixAt(i, mtx);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  // pile grows with the dig (pop with a little overshoot)
  const prog = flown / total;
  pileSpots.forEach((p, i) => {
    const at = (i / pileSpots.length) * 0.9;
    const u = span(prog, at, at + 0.08), s = u > 0 ? easeOutBack(u) : 0;
    mtx.compose(v.set(p.x, p.y - 0.5 + 0.5 * s, p.z), q.identity(), sc.set(s, s, s));
    pile.setMatrixAt(i, mtx);
  });
  pile.instanceMatrix.needsUpdate = true;

  // truck: reverse in (3.0-4.6, eases to a stop), tip the bed (4.9-5.8), lower it (8.4-9.4)
  const drive = easeOutCubic(span(t, 3.0, 4.6));
  truck.position.set(0, 0, -36 + (-12.1 + 36) * drive - 30 * easeInOutCubic(span(t, 9.3, 11.5)) ** 2);
  const tip = easeInOutCubic(span(t, 4.9, 5.8)) - easeInOutCubic(span(t, 8.6, 9.6));
  bedPivot.rotation.x = -0.85 * tip * -1; // rear down, front up
  for (const c of truck.children) if (c.geometry && c.scale.x === 0.6) c.rotation.x = -drive * 9; // wheels roll

  // trash: rides in the bed, slides out when tipped, falls into the pit, squashes on landing
  truck.updateMatrixWorld(true);
  for (const b of bags) {
    const DUR = 0.75;
    if (t < b.release) {
      b.g.position.copy(bed.localToWorld(b.local.clone()));
      b.g.quaternion.copy(bed.getWorldQuaternion(new THREE.Quaternion()));
      b.g.scale.set(1, 1, 1);
      continue;
    }
    // where it left the bed (the bed's pose at release time)
    const keep = bedPivot.rotation.x;
    bedPivot.rotation.x = -0.85 * easeInOutCubic(span(b.release, 4.9, 5.8)) * -1;
    truck.updateMatrixWorld(true);
    const p0 = bed.localToWorld(new THREE.Vector3(b.local.x, b.local.y, 2.6));
    bedPivot.rotation.x = keep; truck.updateMatrixWorld(true);
    const u = span(t, b.release, b.release + DUR);
    const ex = easeOutCubic(u), ey = u * u; // horizontal glide, gravity-like drop
    b.g.position.set(p0.x + (b.tgt.x - p0.x) * ex, p0.y + (b.tgt.y - p0.y) * ey + Math.sin(u * Math.PI) * 0.9, p0.z + (b.tgt.z - p0.z) * ex);
    b.g.rotation.set(b.spin * (1 - easeOutCubic(u)) * 0.6, b.spin * u * 0.5, 0);
    const land = span(t, b.release + DUR, b.release + DUR + 0.28);
    const sq = land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.18 : 0;
    b.g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
  }

  // liner unrolls: back wall top-down, sides, then the floor back-to-front, then the lip
  const lb = easeOutCubic(span(t, 7.95, 8.65)), ls = easeOutCubic(span(t, 8.15, 8.85)), lf = easeOutCubic(span(t, 8.6, 9.35)), ll = easeOutBack(span(t, 9.2, 9.55));
  linerBack.scale.set(1, Math.max(0.001, lb), 1); linerBack.visible = t > 7.95;
  linerL.scale.set(1, Math.max(0.001, ls), 1); linerR.scale.set(1, Math.max(0.001, ls), 1); linerL.visible = linerR.visible = t > 8.15;
  linerF.scale.set(1, 1, Math.max(0.001, lf)); linerF.visible = t > 8.6;
  lip.scale.set(1, 1, Math.max(0.001, ll)); lip.visible = t > 9.2;
  // the trash sits on the liner once it is in
  for (const b of bags) if (t > 8.6) b.g.position.y = Math.max(b.g.position.y, b.tgt.y + 0.14 * lf);

  camera.position.set(...camF.map((f) => f(t)));
  camera.lookAt(...tgtF.map((f) => f(t)));
  renderer.render(scene, camera);
  return true;
};
window.ready = true;
