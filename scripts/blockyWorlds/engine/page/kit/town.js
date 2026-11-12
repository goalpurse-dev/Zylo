// Blocky Worlds EPIC (EPIC agent): a little town of blocky houses, instanced (a few draw calls for 10-300 houses), in
// the locked look's colours: pastel plaster walls, red/grey gable roofs, white frames, dark doors, windows that glow at
// night, chimneys, round blocky trees and street lamps. Used on a giant's back (page/kit/giants.js) and inside a
// creature (page/sets/creatureWorld.js).
//   makeTown(houses, { tex, seed, lit, scale, trees, lamps }) -> Group (userData.setLit(on), userData.details[])
//     houses: [{ x, y, z, ry, w, d, h }] metres (y = ground height under the house's centre)
//   townLayout({ surface(x, z) -> y | null, region: { x0, x1, z0, z1 }, count, seed, minGap, street }) -> houses
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { prng } from "../../lib/epic.js";
import { PLASTIC_LOOK, toyColour, plasticize } from "./plastic.js"; // PLASTIC-WORLD 2026-11-10
const tc = (x) => (PLASTIC_LOOK ? toyColour(x) : x);

const WALLS = ["#fff3d6", "#cfe8ff", "#ffd9cc", "#d8f2d0", "#f6e3b4", "#ffe0f0", "#e8e0ff", "#fdfdf6"];
const ROOFS = ["#c0392b", "#a8432b", "#6d7a8a", "#8e4a3a", "#d0603a", "#4f5d6e"];
const DOORS = ["#c0392b", "#1f6f8b", "#2c3e70", "#2e7d4f", "#8e44ad", "#e67e22"];
const TREES = ["#5f9e3a", "#4f8f34", "#79b347", "#6aa84f"];

/** a gable roof prism: width 1 (x), depth 1 (z), height 1 (y), ridge along x, base at y 0 */
function roofGeo() {
  const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); // ridge along x
  return g;
}

/**
 * townLayout(opts) -> [{ x, y, z, ry, w, d, h, kind }] deterministic house places.
 * surface(x, z) returns the ground height there, or null where no house may stand (off the shell, too steep).
 * street: { axis: "z" | "x", half } keeps a street free along the axis through 0 (houses face it).
 */
export function townLayout({ surface, region, count = 40, seed = 1, minGap = 1.2, street = null, size = [5, 8], tall = [3.6, 7] }) {
  const R = prng(seed * 131 + count), out = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = region.x0 + R() * (region.x1 - region.x0), z = region.z0 + R() * (region.z1 - region.z0);
    const w = size[0] + R() * (size[1] - size[0]), d = w * (0.75 + R() * 0.3), h = tall[0] + R() * (tall[1] - tall[0]);
    if (street) { const c = street.axis === "x" ? z : x; if (Math.abs(c) < street.half + d / 2) continue; }
    const y = surface(x, z); if (y == null) continue;
    // all four corners on the surface (no house hanging over an edge) and not too steep
    const ys = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([a, b]) => surface(x + a, z + b));
    if (ys.some((v) => v == null)) continue;
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo > h * 0.45) continue;
    const r = Math.hypot(w, d) / 2;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < r + Math.hypot(o.w, o.d) / 2 + minGap)) continue;
    // face the street if there is one, else face outward / toward +z with a little variety
    let ry = street ? (street.axis === "x" ? (z > 0 ? Math.PI : 0) : (x > 0 ? -Math.PI / 2 : Math.PI / 2)) : Math.atan2(x, z) + (R() - 0.5) * 0.5;
    if (!street && R() < 0.3) ry = (R() - 0.5) * 0.6;
    out.push({ x, y: lo, z, ry, w, d, h, kind: R() < 0.12 ? "tower" : "house", sink: hi - lo });
  }
  return out;
}

const MATS = new Map();
function mat(key, make) { if (!MATS.has(key)) MATS.set(key, make()); return MATS.get(key); }

/**
 * makeTown(houses, opts) -> Group of InstancedMeshes (walls, roofs, doors, frames, windows, chimneys, trees, lamps).
 * opts: { tex(name, kind, srgb) (the engine's texture loader; optional), seed, lit (windows glowing), trees: [{x,y,z,s}],
 *         lamps: [{x,y,z}], detail: true (frames, chimneys; false for far-away towns) }
 */
export function makeTown(houses, opts = {}) {
  if (PLASTIC_LOOK && opts.tex) opts = { ...opts, tex: null }; // PLASTIC-WORLD: no photo walls / roofs
  const g = new THREE.Group(); g.name = "town";
  const R = prng((opts.seed ?? 7) * 17 + houses.length);
  const n = houses.length;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const wallMat = mat(`wall${!!opts.tex}`, () => opts.tex ? new THREE.MeshStandardMaterial({ map: (() => { const t = opts.tex("painted_plaster_wall", "diff", true); t.repeat.set(1.5, 1); return t; })(), normalMap: (() => { const t = opts.tex("painted_plaster_wall", "nor", false); t.repeat.set(1.5, 1); return t; })(), roughness: 0.9 }) : new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  const roofMat = mat(`roof${!!opts.tex}`, () => opts.tex ? new THREE.MeshStandardMaterial({ map: (() => { const t = opts.tex("roof_09", "diff", true); t.repeat.set(2, 2); return t; })(), roughness: 0.8 }) : new THREE.MeshStandardMaterial({ roughness: 0.75 }));
  const plain = mat("plain", () => new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const winMat = mat("win", () => new THREE.MeshStandardMaterial({ color: "#2a3a4c", roughness: 0.15, metalness: 0.2, emissive: "#ffc86a", emissiveIntensity: 0 }));
  const boxG = new RoundedBoxGeometry(1, 1, 1, 1, 0.04), roofG = roofGeo(), plainBox = new THREE.BoxGeometry(1, 1, 1);
  const inst = (geo, material, count, name) => { const im = new THREE.InstancedMesh(geo, material, Math.max(1, count)); im.count = count; im.name = name; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; g.add(im); return im; };
  const walls = inst(boxG, wallMat, n, "walls"), roofs = inst(roofG, roofMat, n, "roofs"), doors = inst(plainBox, plain, n, "doors");
  const nWin = n * 4, wins = inst(plainBox, winMat, nWin, "windows"); wins.castShadow = false;
  const detail = opts.detail !== false;
  const chim = detail ? inst(plainBox, plain, n, "chimneys") : null;
  const frames = detail ? inst(plainBox, plain, nWin, "frames") : null;
  let wi = 0;
  houses.forEach((h, i) => {
    const sink = (h.sink ?? 0) + 0.3, hh = h.h + sink, tower = h.kind === "tower";
    q.setFromAxisAngle(up, h.ry ?? 0);
    const place = (im, k, lx, ly, lz, sx, sy, sz, col) => {
      v.set(lx, ly, lz).applyQuaternion(q).add(s.set(h.x, h.y, h.z));
      m4.compose(v, q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(k, m4); if (col) im.setColorAt(k, c.set(tc(col)));
    };
    const W = tower ? h.w * 0.7 : h.w, D = tower ? h.w * 0.7 : h.d, H = tower ? hh * 1.7 : hh;
    place(walls, i, 0, -sink + H / 2, 0, W, H, D, WALLS[Math.floor(R() * WALLS.length)]);
    const rh = tower ? W * 0.9 : Math.min(D * 0.55, 3.2);
    place(roofs, i, 0, -sink + H, 0, W + 0.7, rh, D + 0.7, ROOFS[Math.floor(R() * ROOFS.length)]);
    place(doors, i, 0, 1.05, D / 2 + 0.03, 1.1, 2.1, 0.12, DOORS[Math.floor(R() * DOORS.length)]);
    if (chim) place(chim, i, -W * 0.25, -sink + H + rh * 0.55, -D * 0.15, 0.7, rh * 0.9, 0.7, "#9a5b45");
    // two windows on the front, two on the back (upper floor when tall enough)
    const wy = Math.min(H - sink - 1.2, 2.6);
    for (const [lx, lz] of [[-W * 0.28, D / 2 + 0.04], [W * 0.28, D / 2 + 0.04], [-W * 0.28, -D / 2 - 0.04], [W * 0.28, -D / 2 - 0.04]]) {
      place(wins, wi, lx, Math.max(1.6, wy), lz, 1.0, 1.15, 0.06, null);
      if (frames) place(frames, wi, lx, Math.max(1.6, wy), lz * 0.999, 1.25, 1.4, 0.06, "#fbfbf6");
      wi++;
    }
  });
  for (const im of g.children) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  // trees: a trunk + 2 stacked leafy blocks
  const trees = opts.trees ?? [];
  if (trees.length) {
    const leafMat = mat("leaf", () => new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    const trunk = inst(plainBox, plain, trees.length, "trunks"), leaf = inst(boxG, leafMat, trees.length * 2, "leaves");
    trees.forEach((t, i) => {
      const k = t.s ?? 1;
      m4.compose(v.set(t.x, t.y + 1.2 * k, t.z), q.identity(), s.set(0.5 * k, 2.4 * k, 0.5 * k)); trunk.setMatrixAt(i, m4); trunk.setColorAt(i, c.set(tc("#6b4a2e")));
      const col = tc(TREES[i % TREES.length]);
      m4.compose(v.set(t.x, t.y + 3.0 * k, t.z), q.setFromAxisAngle(up, i), s.set(2.6 * k, 2.0 * k, 2.6 * k)); leaf.setMatrixAt(i * 2, m4); leaf.setColorAt(i * 2, c.set(col));
      m4.compose(v.set(t.x, t.y + 4.4 * k, t.z), q.setFromAxisAngle(up, i + 0.7), s.set(1.7 * k, 1.4 * k, 1.7 * k)); leaf.setMatrixAt(i * 2 + 1, m4); leaf.setColorAt(i * 2 + 1, c.set(col).multiplyScalar(1.1));
    });
    trunk.instanceMatrix.needsUpdate = leaf.instanceMatrix.needsUpdate = true; trunk.instanceColor.needsUpdate = leaf.instanceColor.needsUpdate = true;
  }
  // street lamps: a dark post + a warm glowing head
  const lamps = opts.lamps ?? [];
  let lampHeads = null;
  if (lamps.length) {
    const post = inst(plainBox, plain, lamps.length, "lampPosts");
    const headMat = mat("lampHead", () => new THREE.MeshStandardMaterial({ color: "#fff1c4", emissive: "#ffc86a", emissiveIntensity: 0.4, roughness: 0.4 }));
    lampHeads = inst(boxG, headMat, lamps.length, "lampHeads"); lampHeads.castShadow = false;
    lamps.forEach((l, i) => {
      m4.compose(v.set(l.x, l.y + 2.0, l.z), q.identity(), s.set(0.16, 4, 0.16)); post.setMatrixAt(i, m4); post.setColorAt(i, c.set("#2b2f36"));
      m4.compose(v.set(l.x, l.y + 4.15, l.z), q.identity(), s.set(0.5, 0.5, 0.5)); lampHeads.setMatrixAt(i, m4);
    });
    post.instanceMatrix.needsUpdate = lampHeads.instanceMatrix.needsUpdate = true; post.instanceColor.needsUpdate = true;
  }
  g.userData.details = [frames, chim].filter(Boolean);
  g.userData.setLit = (on, k = 1) => { winMat.emissiveIntensity = on ? 1.6 * k : 0; winMat.color.set(on ? "#ffd892" : "#2a3a4c"); if (lampHeads) lampHeads.material.emissiveIntensity = on ? 3 * k : 0.4; };
  g.userData.setLit(!!opts.lit);
  g.userData.houses = houses;
  plasticize(g);
  return g;
}
