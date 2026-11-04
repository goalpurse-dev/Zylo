// Blocky Worlds sets: the far backdrop of the locked look: snow-capped low-poly mountains and a rolling tree line,
// plus the big ground plane. Used by the outdoor sets (street, woods) and seen through the bedroom / school windows.
import { lcg } from "./util.js";

/**
 * The town's water tower (an original design): four splayed legs with X bracing, a ladder up the front leg, a catwalk
 * with railings at the top of the legs, a round tank with a painted band ("MAPLEWOOD"), a cone roof with a red light
 * that glows at night. Optional grassy hill under it. Returns the `tower` spot: on the catwalk at the tank's base, on the
 * camera (+z) side, where a monster can stand.
 */
export function waterTower(K, register, { x = 0, y = 0, z = 0, legH = 14, R = 3.2, hill = null, ry = 0 } = {}) {
  const { THREE, bx, cyl, mesh, solid } = K;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; K.root.add(g);
  if (hill) { // a low grassy mound (flattened sphere), the tower stands on its top
    const m = mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: hill.color ?? "#5f9444", roughness: 1 }), { parent: g, y: -0.05, shadow: true, keep: true });
    m.scale.set(hill.r, hill.h, hill.r * (hill.d ?? 1)); g.position.y += 0; g.userData.hillH = hill.h;
  }
  const base = hill ? hill.h - 0.1 : 0;
  const steel = solid("#7f8a96", { roughness: 0.55, metalness: 0.5 }), dark = solid("#4a525c", { roughness: 0.6, metalness: 0.4 });
  const spread = R * 0.95, topIn = R * 0.62;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) {
    const bot = new THREE.Vector3(sx * spread, base, sz * spread), top = new THREE.Vector3(sx * topIn, base + legH, sz * topIn);
    const mid = bot.clone().add(top).multiplyScalar(0.5), len = bot.distanceTo(top);
    const leg = bx(0.34, len, 0.34, steel, { x: mid.x, y: mid.y, z: mid.z, parent: g });
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
    bx(0.7, 0.4, 0.7, solid("#b8b2a6", { roughness: 0.9 }), { x: bot.x, y: base + 0.2, z: bot.z, parent: g });
  }
  // X bracing on each face, in 3 tiers, plus horizontal rings
  const tiers = 3;
  const at = (sx, sz, f) => new THREE.Vector3(sx * (spread + (topIn - spread) * f), base + legH * f, sz * (spread + (topIn - spread) * f));
  const strut = (a, b, w = 0.12) => { const mid = a.clone().add(b).multiplyScalar(0.5); const s = bx(w, a.distanceTo(b), w, dark, { x: mid.x, y: mid.y, z: mid.z, parent: g }); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); };
  for (let i = 0; i < 4; i++) {
    const [ax, az] = legs[i], [bx2, bz] = legs[(i + 1) % 4];
    for (let t = 0; t < tiers; t++) {
      const f0 = t / tiers + 0.04, f1 = (t + 1) / tiers - 0.02;
      strut(at(ax, az, f0), at(bx2, bz, f1)); strut(at(bx2, bz, f0), at(ax, az, f1));
      strut(at(ax, az, f1), at(bx2, bz, f1), 0.16);
    }
  }
  // the ladder: up the front (+z) face, centred
  const lz = topIn + 0.35, rail = solid("#9aa4ad", { metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) bx(0.06, legH + 1.2, 0.06, rail, { x: s * 0.24, y: base + (legH + 1.2) / 2, z: lz + (spread - topIn) * 0.5, rx: -Math.atan((spread - topIn) / legH), parent: g });
  for (let k = 0.6; k < legH + 1; k += 0.42) { const f = k / legH; bx(0.5, 0.04, 0.04, rail, { x: 0, y: base + k, z: lz + (spread - topIn) * (1 - f) * 1 - (spread - topIn) * 0.0, parent: g }); }
  // catwalk + railing at the top of the legs
  const deckY = base + legH;
  cyl(R + 1.0, R + 1.0, 0.18, 28, dark, { y: deckY, parent: g });
  for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; bx(0.06, 1.0, 0.06, rail, { x: Math.cos(t) * (R + 0.95), y: deckY + 0.55, z: Math.sin(t) * (R + 0.95), parent: g }); }
  const ring = mesh(new THREE.TorusGeometry(R + 0.95, 0.04, 6, 40), rail, { y: deckY + 1.05, rx: Math.PI / 2, parent: g });
  void ring;
  // the tank: painted body, the band with the town's name, a cone roof, a finial light
  const band = K.canvas(1024, 128, (p, w, h) => {
    p.fillStyle = "#d8473a"; p.fillRect(0, 0, w, h); p.fillStyle = "#ffffff"; p.fillRect(0, 8, w, 8); p.fillRect(0, h - 16, w, 8);
    p.font = "bold 74px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("MAPLEWOOD", w * 0.25, h / 2 + 3); p.fillText("MAPLEWOOD", w * 0.75, h / 2 + 3);
  });
  const tankH = 5.2, body = new THREE.MeshStandardMaterial({ color: "#c9d6df", roughness: 0.5, metalness: 0.25 });
  cyl(R, R, tankH, 40, body, { y: deckY + 0.1 + tankH / 2, parent: g, block: true });
  cyl(R + 0.02, R + 0.02, 1.2, 40, new THREE.MeshStandardMaterial({ map: band, roughness: 0.5, metalness: 0.15 }), { y: deckY + 0.1 + tankH * 0.62, parent: g, keep: true });
  mesh(new THREE.SphereGeometry(R, 40, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), body, { y: deckY + 0.1, parent: g });
  mesh(new THREE.ConeGeometry(R + 0.25, 2.2, 40), solid("#8e9aa6", { roughness: 0.45, metalness: 0.35 }), { y: deckY + 0.1 + tankH + 1.1, parent: g });
  const red = new THREE.MeshStandardMaterial({ color: "#ff3b2f", emissive: "#ff2a1a", emissiveIntensity: 0.2 });
  mesh(new THREE.SphereGeometry(0.22, 12, 8), red, { y: deckY + 0.1 + tankH + 2.35, parent: g, shadow: false, keep: true });
  register((mode) => { red.emissiveIntensity = mode === "night" ? 6 : mode === "warm" ? 1.5 : 0.2; });
  g.updateMatrixWorld(true);
  return g.localToWorld(new THREE.Vector3(0, deckY + 0.09, R + 0.6)).sub(K.root.position);
}

/**
 * K: the set's kit; onLight: register(mode => ...) for night colours.
 * opts: { peaksAt (z shift), treeLine: { z0, z1, x0, x1, n }, ground: colour }
 */
export function backdrop(K, register, { shiftZ = 0, treeLine = { x0: -160, x1: 160, z0: -150, z1: -210, n: 260 }, ground = "#6f9a4e", groundY = -0.02 } = {}) {
  const { THREE } = K;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const peaks = [[-260, -820, 170, 150], [-60, -900, 220, 190], [160, -860, 190, 165], [360, -800, 160, 125], [-420, -760, 150, 115], [60, -760, 130, 95]];
  const geos = [];
  for (const [x, z, r, h] of peaks) {
    const geo = new THREE.ConeGeometry(r, h, 9, 6); geo.translate(0, h / 2, 0);
    const pos = geo.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), jit = Math.sin(i * 12.9898) * 0.5 + 0.5;
      if (y > 0.5 && y < h - 1) { pos.setX(i, pos.getX(i) * (0.85 + jit * 0.3)); pos.setZ(i, pos.getZ(i) * (0.85 + jit * 0.3)); }
      const t = y / h, c = t > 0.8 ? new THREE.Color("#ffffff") : t > 0.5 ? new THREE.Color("#6d7f96") : new THREE.Color("#4c7a52");
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    geo.translate(x, -2, z + shiftZ);
    geos.push(geo.toNonIndexed());
  }
  for (const g of geos) K.mesh(g, mat, { shadow: false, keep: true });
  // the tree line
  const treeGeo = new THREE.ConeGeometry(2.6, 9, 7); treeGeo.translate(0, 4.5, 0);
  const tlMat = new THREE.MeshStandardMaterial({ color: "#3f7a3a", roughness: 1, flatShading: true });
  const { x0, x1, z0, z1, n } = treeLine;
  const inst = new THREE.InstancedMesh(treeGeo, tlMat, n);
  const m4 = new THREE.Matrix4(), rnd = lcg(3);
  for (let i = 0; i < n; i++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0) + shiftZ, k = 0.8 + rnd() * 0.8; m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(k, k * (0.8 + rnd() * 0.5), k)); inst.setMatrixAt(i, m4); }
  inst.computeBoundingSphere();
  K.root.add(inst);
  register((mode) => { tlMat.color.set(mode === "night" ? "#16261c" : mode === "warm" ? "#3c6a34" : "#3f7a3a"); });
  // the big ground
  K.plane(1800, 1800, new THREE.MeshStandardMaterial({ color: ground, roughness: 1 }), { y: groundY, z: -300 + shiftZ, shadow: false, keep: true });
}
