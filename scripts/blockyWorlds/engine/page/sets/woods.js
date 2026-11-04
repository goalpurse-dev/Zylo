// Set "woods": the edge of the woods above town. A dirt path winds from the camera into the trees; grass, ferny shrubs,
// broad leafy trees at the edge, then dense dark low-poly pines (instanced) that close in toward the back,
// boulders, a split-rail fence, a stump and a log, a wooden trail arch with a sign and a lantern (the "door" spot), the
// town's water tower on a hill behind the trees (the "tower" spot: on its catwalk), fog that sells the depth.
// The camera stands on the path (+z) looking into the woods (-z).
import { makeKit, mergeStatic, glowList, lcg } from "./util.js";
import { backdrop, waterTower } from "./backdrop.js";

const pathX = (z) => Math.sin(z * 0.09) * 1.2 + (z < -10 ? (z + 10) * 0.04 : 0); // the path's centre line

export async function build(ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = "set:woods";
  const K = makeKit(ctx, root), { bx, mesh, pbr, solid, cyl } = K;
  const glow = glowList(), onLight = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- ground, path ----------
  K.plane(90, 110, pbr("leafy_grass", { repeat: [30, 36], tint: "#8fd062", normal: 0.7 }), { y: 0, z: -35 });
  {
    const len = 70, segs = 140, w = 2.3;
    const g = new THREE.PlaneGeometry(w, len, 4, segs); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i) - 22; p.setZ(i, z); p.setX(i, p.getX(i) * (1 + 0.15 * Math.sin(z * 0.7)) + pathX(z)); p.setY(i, 0.012); }
    g.computeVertexNormals();
    const m = pbr("brown_mud_dry", { repeat: [1, 30], tint: "#b89c78" }); m.polygonOffset = true; m.polygonOffsetFactor = -2;
    mesh(g, m, { keep: true, cast: false });
    // soft dirt edges: a wider, darker strip under the path
    const g2 = g.clone(); const p2 = g2.attributes.position; for (let i = 0; i < p2.count; i++) { const z = p2.getZ(i); p2.setX(i, (p2.getX(i) - pathX(z)) * 1.35 + pathX(z)); p2.setY(i, 0.006); }
    const m2 = pbr("grass_path_2", { repeat: [1, 25], tint: "#d9c9a8" }); m2.polygonOffset = true; m2.polygonOffsetFactor = -1;
    mesh(g2, m2, { keep: true, cast: false });
  }
  backdrop(K, (f) => onLight.push(f), { treeLine: { x0: -160, x1: 160, z0: -90, z1: -170, n: 300 }, ground: "#4f7a3e" });

  // ---------- the water tower on its hill, behind the trees ----------
  const TOWER = { x: 7.5, z: -40 };
  const towerSpot = waterTower(K, (f) => onLight.push(f), { x: TOWER.x, z: TOWER.z, legH: 15, R: 3.4, hill: { r: 16, h: 4.5, color: "#5a8a40" } });

  // ---------- pines (instanced, code-built low-poly, per-tree colour variation) ----------
  const rnd = lcg(77);
  const pines = [];
  const clearOfPath = (x, z, s) => Math.abs(x - pathX(z)) > (z > -16 ? 3.6 : 2.6) + s * 1.3;
  // keep a sight line open from the path (z -18) up to the tower
  const VIEW = { x: pathX(-18), z: -18 };
  const segDist = (x, z) => { const ax = TOWER.x - VIEW.x, az = TOWER.z - VIEW.z, t = Math.max(0, Math.min(1, ((x - VIEW.x) * ax + (z - VIEW.z) * az) / (ax * ax + az * az))); return Math.hypot(x - VIEW.x - ax * t, z - VIEW.z - az * t); };
  const free = (x, z, s) => clearOfPath(x, z, s) && Math.hypot(x - TOWER.x, z - TOWER.z) > 9.5 && segDist(x, z) > 2.2 + s * 1.6;
  for (let i = 0; i < 900 && pines.length < 320; i++) {
    const z = 16 - rnd() * 80, spread = z > -6 ? 16 : 28, x = (rnd() * 2 - 1) * spread;
    const s = 0.75 + rnd() * 0.7 + (z < -20 ? 0.3 : 0);
    if (!free(x, z, s)) continue;
    pines.push({ x, z, s, ry: rnd() * 6, k: rnd(), dark: z < -14 });
  }
  {
    const trunkG = new THREE.CylinderGeometry(0.14, 0.24, 3.0, 6).translate(0, 1.5, 0);
    const layers = [[1.75, 3.0, 1.6], [1.45, 2.8, 3.2], [1.15, 2.5, 4.7], [0.85, 2.2, 6.0], [0.5, 1.8, 7.2]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 8).translate(0, y + h / 2, 0));
    const trunkM = new THREE.MeshStandardMaterial({ color: "#6a4a32", roughness: 1, flatShading: true });
    const needleM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, flatShading: true });
    const base = { day: ["#2f7a3a", "#1f5a30"], night: ["#1b4026", "#0e2618"], warm: ["#3f7a34", "#2a5a2a"] };
    const ims = [];
    const geos = [trunkG, ...layers];
    geos.forEach((geo, gi) => {
      const im = new THREE.InstancedMesh(geo, gi === 0 ? trunkM : needleM, pines.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      pines.forEach((p, i) => { q.setFromAxisAngle(V(0, 1, 0), p.ry + gi * 0.4); im.setMatrixAt(i, m4.compose(V(p.x, 0, p.z), q, V(p.s, p.s * (1.05 + p.k * 0.3), p.s))); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im); if (gi) ims.push(im);
    });
    const c = new THREE.Color(), c2 = new THREE.Color();
    const tint = (mode) => { const [a, b] = base[mode] ?? base.day; for (const im of ims) { pines.forEach((p, i) => { c.set(p.dark ? b : a); c2.set(b); c.lerp(c2, p.k * 0.5).multiplyScalar(0.9 + p.k * 0.2); im.setColorAt(i, c); }); im.instanceColor.needsUpdate = true; } };
    tint("day"); onLight.push(tint);
  }

  // ---------- models: leafy trees, shrubs, rocks, fence, stump, log ----------
  const S = (n, o) => K.model(`/assets/kenney/survival/${n}.glb`, o);
  const [kTree, shrubA, shrubB, fence, stump, log] = await Promise.all([
    K.model("/assets/kenney/suburban/tree-large.glb", { height: 8 }),
    K.model("/assets/ph/shrub_02/shrub_02.gltf", { height: 1.1 }), K.model("/assets/ph/shrub_04/shrub_04.gltf", { height: 0.9 }),
    S("fence", { length: 2.0, alongZ: false }), S("tree-trunk", { height: 0.7 }), S("tree-log", { length: 2.4 }),
  ]);
  // a few broad leafy trees at the woods' edge (lighter than the jacaranda)
  K.instance(kTree, [{ x: -6.4, z: 3.5, ry: 0.4 }, { x: 7.0, z: -2.5, ry: 2.0, s: 1.1 }, { x: -7.2, z: -9, ry: 1.2, s: 1.05 }, { x: 6.5, z: 8, ry: 2.6, s: 0.9 }]);
  const sh = []; for (let i = 0; i < 26; i++) { const z = 10 - rnd() * 30, side = rnd() < 0.5 ? -1 : 1, x = pathX(z) + side * (1.9 + rnd() * 3); sh.push({ x, z, ry: rnd() * 6, s: 0.7 + rnd() * 0.6 }); }
  K.instance(shrubA, sh.filter((_, i) => i % 2)); K.instance(shrubB, sh.filter((_, i) => !(i % 2)));
  // boulders: dark rock texture on chunky low-poly stones
  const rockM = pbr("dark_rock", { repeat: [1, 1], tint: "#c9c4bc" });
  for (const [x, z, s] of [[-3.0, -3.6, 0.9], [3.6, -6.5, 1.3], [-4.4, 0.8, 0.7], [2.9, -19, 1.5], [2.6, -1.4, 0.55], [-3.3, -12, 1.1], [3.4, 2.6, 0.7]]) { const m = mesh(new THREE.IcosahedronGeometry(s, 0), rockM, { x, y: s * 0.35, z, ry: x, rz: z * 0.1 }); m.scale.set(1.2, 0.75, 1); }
  // split-rail fence along the left of the path, a stump, a log
  K.instance(fence, [0, 1, 2, 3].map((i) => ({ x: pathX(2 - i * 2.0) - 2.2, z: 3 - i * 2.0, ry: Math.PI / 2 + 0.06 * i })));
  K.place(stump, 2.2, 0, 0.9, 0.5); K.place(log, -2.8, 0, -1.2, 1.2);

  // ---------- the trail arch with its sign and a lantern ----------
  const DZ = -7, dx = pathX(DZ);
  const logM = solid("#6b4a30", { roughness: 0.9 }), logD = solid("#4e3523", { roughness: 0.9 });
  for (const s of [-1, 1]) cyl(0.14, 0.17, 3.2, 8, logM, { x: dx + s * 1.5, y: 1.6, z: DZ, block: false });
  cyl(0.13, 0.13, 3.6, 8, logD, { x: dx, y: 3.1, z: DZ, rz: Math.PI / 2 });
  const signT = K.canvas(512, 160, (p, w, h) => { p.fillStyle = "#8a5a32"; p.fillRect(0, 0, w, h); p.strokeStyle = "#5a3a20"; p.lineWidth = 6; for (let y = 30; y < h; y += 40) { p.beginPath(); p.moveTo(0, y); p.lineTo(w, y + 4); p.stroke(); } p.fillStyle = "#ffe9b0"; p.font = "bold 62px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("PINE HOLLOW", w / 2, 62); p.font = "bold 40px sans-serif"; p.fillText("TRAIL", w / 2, 122); });
  bx(2.1, 0.66, 0.08, new THREE.MeshStandardMaterial({ map: signT, roughness: 0.8 }), { x: dx, y: 2.62, z: DZ + 0.06, keep: true });
  for (const s of [-1, 1]) cyl(0.012, 0.012, 0.3, 4, solid("#333"), { x: dx + s * 0.85, y: 3.0, z: DZ + 0.06 });
  const lanternM = glow.add(new THREE.MeshStandardMaterial({ color: "#ffe2a0", emissive: "#ffb24a" }), { day: 0.1, night: 4, warm: 1.2 });
  bx(0.2, 0.28, 0.2, solid("#2b2b2e", { metalness: 0.6, roughness: 0.4 }), { x: dx + 1.5, y: 2.55, z: DZ + 0.28 });
  bx(0.15, 0.2, 0.15, lanternM, { x: dx + 1.5, y: 2.55, z: DZ + 0.28, shadow: false });
  const LANTERN = V(dx + 1.5, 2.5, DZ + 0.5);

  mergeStatic(THREE, root);

  return {
    root, indoor: false,
    spots: { center: V(pathX(0), 0, 0), left: V(pathX(0) - 1.3, 0, 0.3), right: V(pathX(0) + 1.3, 0, 0.3), back: V(pathX(-2.4) + 0.2, 0, -2.4), far: V(pathX(-20), 0, -20), door: V(dx, 0, DZ + 0.4), tower: towerSpot },
    camDir: V(0, 0, 1),
    views: { tower: V(VIEW.x - TOWER.x, 0, VIEW.z - TOWER.z).normalize() },
    bounds: [new THREE.Box3(V(-3.4, 0.3, -24), V(3.4, 7, 13))],
    rig: {
      shadow: { center: [0, 0, -6], half: 22, far: 160, map: 2048 },
      fog: { day: ["#b5d2e6", 18, 140], night: ["#0c1736", 6, 60], warm: ["#eaa77a", 16, 130] },
      sunScale: { night: 1.3 },
      practicals(mode) {
        if (mode !== "night") return [];
        const l = new THREE.PointLight("#ffb050", 9, 9, 2); l.position.copy(LANTERN);
        return [l];
      },
      onLight(mode) { glow.apply(mode); onLight.forEach((f) => f(mode)); },
    },
  };
}
