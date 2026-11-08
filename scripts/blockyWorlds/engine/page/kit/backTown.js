// Blocky Worlds CAPABILITIES (2026-11-06): a town or a city on ANY creature's back, scaled to the host (a turtle's
// shell, a wolf, a whale, an elephant, a snail, a bird, any generic giant): rows of houses on streets, landmark
// buildings with readable signs (SCHOOL, GROCERY, a hospital cross...), and for a villain the lit castle-city of the
// target (dark spired towers with window grids, skyscrapers, a crenellated wall round the edge). It rides the host's
// body joint, so it walks, bobs and pitches with it (no sliding).
//   planBackTown(region, surface, opts) -> { houses, landmarks, towers, wall, trees, lamps }   (pure, deterministic)
//   addBackTown(giant, opts)            -> Group (giant.userData.backTown; .userData.setLit(on))
//     opts: { style: village|town|city|castle, landmarks: [...], lit, seed, density (0.3-1.5), walls, replace, tex }
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { makeTown } from "./town.js";
import { giantSurface } from "./giants.js";
import { prng } from "../../lib/epic.js";
import { townTex } from "./townTex.js";

const SIGN = {
  school: { text: "SCHOOL", wall: "#f6c453", roof: "#c0392b", sign: "#1f6f8b", w: 16, d: 11, h: 9 },
  grocery: { text: "GROCERY", wall: "#d8f2d0", roof: "#2e7d4f", sign: "#2e7d4f", w: 14, d: 10, h: 7 },
  hospital: { text: "HOSPITAL", wall: "#fdfdf6", roof: "#9aa3ad", sign: "#e53935", w: 15, d: 12, h: 12, cross: true },
  bakery: { text: "BAKERY", wall: "#ffd9cc", roof: "#a8432b", sign: "#8e4a3a", w: 11, d: 9, h: 7 },
  townhall: { text: "TOWN HALL", wall: "#e8e0ff", roof: "#4f5d6e", sign: "#2c3e70", w: 16, d: 12, h: 11, clock: true },
  library: { text: "LIBRARY", wall: "#cfe8ff", roof: "#6d7a8a", sign: "#2c3e70", w: 13, d: 10, h: 8 },
  firehouse: { text: "FIRE", wall: "#e74c3c", roof: "#6d7a8a", sign: "#c0392b", w: 12, d: 10, h: 8 },
  tower: { text: "", wall: "#cfc6b0", roof: "#2c3550", sign: "#2c3550", w: 7, d: 7, h: 26, spire: true },
  castle: { text: "", wall: "#cfc6b0", roof: "#2c3550", sign: "#2c3550", w: 20, d: 18, h: 18, spire: true },
  // WORLD-LOOK: the clock / bell tower of a town square (tall, stone, a clock face, a pointed roof)
  clocktower: { text: "", wall: "#d8cfc0", roof: "#7a3a2a", sign: "#2c3550", w: 6, d: 6, h: 20, spire: true, clock: true },
  belltower: { text: "", wall: "#e0d6c4", roof: "#4f5d6e", sign: "#2c3550", w: 5.5, d: 5.5, h: 17, spire: true },
};

/** the back's flat-enough surface + its region (root metres, rest pose): the giant's own, else the body's top */
export function backSurface(g) {
  const u = g.userData.unit, p = g.userData.params, b = p.body;
  let surf = giantSurface(g);
  let region = { x0: -b.w * 0.6 * u, x1: b.w * 0.6 * u, z0: -b.len * 0.6 * u, z1: b.len * 0.6 * u };
  // ATTACH-2: kind "shaped" = the giant's own back (dome, spiral, deck, flat quadruped top: a real mesh top); "field" = a
  // blocky rig's raycast heightfield (a bird, a frog: a lumpy body); "box" = the body block's top. field / box get a
  // real walkable deck mesh (addBackTown: backDeck), the one surface people and crowds stand on
  let kind = g.userData.rigV2 && g.userData.surfaceFn && surf === g.userData.surfaceFn ? "field" : "shaped";
  if (surf(0, 0) == null) {
    kind = "box";
    // any other body (a standing wolf, a bird, an octopus): the top of the body block, as a flat deck
    const body = g.userData.joints.body; g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3();
    body.traverse((o) => { if (o.isMesh && o.parent === body) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); box.union(tmp); } });
    if (box.isEmpty()) box.setFromObject(g).applyMatrix4(inv);
    const y = box.max.y, hw = (box.max.x - box.min.x) * 0.44, hl = (box.max.z - box.min.z) * 0.44, cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
    surf = (x, z) => (Math.abs(x - cx) <= hw && Math.abs(z - cz) <= hl ? y : null);
    region = { x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl };
  }
  return { surf, region, kind };
}

/**
 * ATTACH-2 (owner: "Feet always on the ground"): a lumpy back (a bird's egg body, a frog's rounded block) has no clean
 * top to stand on: the heightfield the town sits on is a coarse raycast of the body, and people stood on feather /
 * skin bumps or in the air beside them. The deck is that same surface as a real mesh: a grid over the town region,
 * each vertex the surface smoothed over its neighbours (never above the surface itself: the streets stay on top), quads only where the back is there
 * at all four corners. Root space (rest pose), named "backDeck" (userData.walkDeck): the one surface people stand on.
 */
export function backDeckMesh(surf, region, { material, step = 1.25, lift = 0.02 } = {}) {
  const nx = Math.max(2, Math.round((region.x1 - region.x0) / step)), nz = Math.max(2, Math.round((region.z1 - region.z0) / step));
  const dx = (region.x1 - region.x0) / nx, dz = (region.z1 - region.z0) / nz;
  const raw = (i, k) => surf(region.x0 + i * dx, region.z0 + k * dz);
  const H = [];
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
    if (raw(i, k) == null) { H.push(null); continue; }
    let s = 0, n = 0;
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const y = raw(i + a, k + c); if (y != null) { s += y; n++; } }
    H.push(Math.min(s / n, raw(i, k)) + lift); // never above the town's own surface (the streets and house floors stand on it)
  }
  const at = (i, k) => H[i * (nz + 1) + k];
  const pos = [], idx = [], vid = new Map();
  const vert = (i, k) => { const key = i * (nz + 1) + k; if (!vid.has(key)) { vid.set(key, pos.length / 3); pos.push(region.x0 + i * dx, at(i, k), region.z0 + k * dz); } return vid.get(key); };
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (at(i, k) == null || at(i + 1, k) == null || at(i, k + 1) == null || at(i + 1, k + 1) == null) continue;
    const a = vert(i, k), b = vert(i + 1, k), c = vert(i, k + 1), d = vert(i + 1, k + 1);
    idx.push(a, c, b, b, c, d); // counter-clockwise seen from above: the normals point up
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material ?? std("#7a6a58", 0.95));
  m.name = "backDeck"; m.userData.walkDeck = true; m.receiveShadow = true; m.castShadow = false;
  // the surface as a function too (root space): bilinear over the same grid, null off the deck
  m.userData.deckY = (x, z) => {
    const fi = (x - region.x0) / dx, fk = (z - region.z0) / dz, i = Math.floor(fi), k = Math.floor(fk);
    if (i < 0 || k < 0 || i >= nx || k >= nz) return null;
    const c = [at(i, k), at(i + 1, k), at(i, k + 1), at(i + 1, k + 1)]; if (c.some((v) => v == null)) return null;
    const u = fi - i, w = fk - k;
    // the same triangle split as the mesh (a c b | b c d)
    return u + w <= 1 ? c[0] + (c[1] - c[0]) * u + (c[2] - c[0]) * w : c[3] + (c[2] - c[3]) * (1 - u) + (c[1] - c[3]) * (1 - w);
  };
  return m;
}

/** like town.js townLayout, but a house may stand on a slope up to its own height (its walls go down to the low side) */
export function terraceLayout({ surface, region, count = 40, seed = 1, minGap = 1.2, street = null, size = [5, 8], tall = [3.6, 7] }) {
  const R = prng(seed * 131 + count + 7), out = [];
  for (let tries = 0; out.length < count && tries < count * 50; tries++) {
    const x = region.x0 + R() * (region.x1 - region.x0), z = region.z0 + R() * (region.z1 - region.z0);
    const w = size[0] + R() * (size[1] - size[0]), d = w * (0.75 + R() * 0.3), h = tall[0] + R() * (tall[1] - tall[0]);
    if (street && Math.abs(street.axis === "x" ? z : x) < street.half + d / 2) continue;
    if (surface(x, z) == null) continue;
    const ys = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([a, b]) => surface(x + a, z + b));
    if (ys.some((v) => v == null)) continue;
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo > h * 1.1) continue;
    const r = Math.hypot(w, d) / 2;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < r + Math.hypot(o.w, o.d) / 2 + minGap)) continue;
    const ry = street ? (street.axis === "x" ? (z > 0 ? Math.PI : 0) : (x > 0 ? -Math.PI / 2 : Math.PI / 2)) : (R() - 0.5) * 0.6;
    // the floor at the high side, the walls down to the low side (makeTown sinks them by `sink`)
    out.push({ x, y: hi, z, ry, w, d, h, kind: R() < 0.1 ? "tower" : "house", sink: hi - lo });
  }
  return out;
}

/** pure: what stands where (metres in the giant's root space) */
export function planBackTown(region, surface, { style = "town", landmarks = [], seed = 5, density = 1, walls = null, bible = null } = {}) {
  const W = region.x1 - region.x0, L = region.z1 - region.z0, area = W * L, R = prng(seed * 97 + 13);
  const city = style === "city" || style === "castle";
  const scale = Math.max(0.45, Math.min(1, Math.sqrt(area) / 90)); // small backs get smaller houses
  // landmarks first: along the street near the front (the head end, +z), alternating sides
  const lm = [], street = { axis: "z", half: Math.max(2.5, 3.6 * scale) };
  const want = landmarks.length ? landmarks : city ? ["castle", "tower", "tower"] : style === "village" ? ["school", "belltower"] : ["school", "grocery", "clocktower", "hospital"];
  let zc = region.z1 - L * 0.12;
  want.forEach((name, i) => {
    const S = SIGN[name] ?? SIGN.school, lk0 = city ? 1 : 0.72;
    // WORLD-FIX 2026-11-07: a walled town keeps its landmarks off the wall walkway (the castle stood across it: the
    // on-back camera stood inside it and saw its windows floating) - shrunk to fit inside the ring, else left out
    const inset = (walls ?? city) ? 6 * scale : 0, room = Math.min(region.x1, -region.x0) - inset - street.half - 0.6;
    const lk = Math.min(lk0, room > 0 ? room / (S.d * scale) : 0); if (lk < lk0 * 0.4) return;
    const w = S.w * scale * lk, d = S.d * scale * lk, h = S.h * scale * Math.max(lk, lk0 * 0.8) * (city && S.spire ? 1.6 : 1); // WORLD-LOOK: in scale with the small houses
    const side = i % 2 ? -1 : 1, x = side * (street.half + d / 2 + 0.6);
    const z = zc - w / 2; if (i % 2) zc -= w + 2 * scale;
    const y = [[-d / 2, -w / 2], [d / 2, -w / 2], [-d / 2, w / 2], [d / 2, w / 2]].map(([a, c]) => surface(x + a, z + c));
    if (y.some((v) => v == null)) return;
    lm.push({ name, x, z, y: Math.max(...y), w, d, h, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, sink: Math.max(...y) - Math.min(...y), ...S, text: S.text });
  });
  const free = (x, z, r) => lm.every((o) => Math.hypot(o.x - x, o.z - z) > r + Math.hypot(o.w, o.d) / 2);
  const surf2 = (x, z) => (free(x, z, 2) ? surface(x, z) : null);
  // towers + skyscrapers (city / castle): a dense skyline, tallest in the middle
  const towers = [];
  if (city) {
    const n = Math.round(Math.min(260, Math.max(28, (area / 16) * density))); // WORLD-LOOK: a dense skyline (was area / 70: 3-4 towers on a wolf)
    for (let tries = 0; towers.length < n && tries < n * 30; tries++) {
      const x = region.x0 + R() * W, z = region.z0 + R() * L; const y = surf2(x, z); if (y == null) continue;
      if (Math.abs(x) < street.half) continue;
      const round = style === "castle" ? R() < 0.5 : R() < 0.25; // castle: castle towers AND skyscrapers
      const rad = (round ? 1.6 + R() * 1.8 : 1.8 + R() * 2.2) * scale;
      if (towers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + rad + 0.3)) continue;
      if (walls !== false && (x - region.x0 < 6 * scale + rad || region.x1 - x < 6 * scale + rad || z - region.z0 < 6 * scale + rad || region.z1 - z < 6 * scale + rad)) continue; // the wall walkway stays free (WORLD-FIX: a wider gap, the on-back camera sees along it)
      const mid = 1 - Math.min(1, Math.hypot((x - (region.x0 + W / 2)) / (W / 2), (z - (region.z0 + L / 2)) / (L / 2)));
      const h = (14 + R() * 26 + mid * 34) * scale * (round ? 0.85 : 1.35);
      towers.push({ x, y, z, r: rad, h, round, spire: round || R() < 0.3, ry: R() * Math.PI });
    }
  }
  // houses on streets (village / town); a city keeps a few low houses between its towers
  const want2 = city ? Math.round(Math.min(60, area / 400)) : Math.round(Math.max(8, Math.min(300, (area / (style === "village" ? 420 : 210)) * density)));
  const occupied = (x, z, r) => towers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.5);
  const surf3 = (x, z) => (occupied(x, z, 1) ? null : surf2(x, z));
  // steep backs (a turtle's dome): houses step down the slope on deeper walls (sink), like terraces
  // WORLD-LOOK 2026-11-06 (owner: "2-3 plain white towers" -> a dense town over the whole back): village / town are
  // laid out on a street grid (lots facing every street, back to back), covering the whole surface
  const grid = city ? null : gridTown(region, surf3, { scale, seed, density, street, village: style === "village" });
  const houses = grid ? grid.houses : terraceLayout({ surface: surf3, region, count: want2, seed, street, minGap: 0.8 * scale, size: [6 * scale, 9.5 * scale], tall: [4.5 * scale, 8 * scale] });
  // trees and lamps along the street
  const trees = [], lamps = [];
  for (let k = 0; k < want2 * 0.35; k++) { const x = region.x0 + R() * W, z = region.z0 + R() * L, y = surf3(x, z); if (y == null || Math.abs(x) < street.half) continue; if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < Math.hypot(h.w, h.d) / 2 + 1)) continue; trees.push({ x, y, z, s: 0.7 + R() * 0.4 }); }
  for (let z = region.z0 + 6; z < region.z1 - 4; z += 11 * scale) for (const s of [-1, 1]) { const x = s * (street.half - 0.4), y = surface(x, z); if (y != null) lamps.push({ x, y, z }); }
  // the wall round the edge (castle / city, or asked)
  const wall = (walls ?? city) ? { region, h: (style === "castle" ? 7 : 5) * Math.max(0.6, scale), inset: 1.2, walk: Math.max(2, 3 * scale) } : null;
  if (grid) { lamps.length = 0; lamps.push(...grid.lamps); }
  if (grid && bible) applyBibleTown(houses, bible, region, lm);
  return { trim: bible?.style?.trim ?? null, houses, landmarks: lm, towers, wall, trees, lamps, scale, street, region, paths: grid?.paths ?? [], fences: grid?.fences ?? [] };
}

/**
 * WORLD-LOOK: a dense street grid over the whole back (pure, deterministic). Streets along z at x = 0, +-P, +-2P..., cross
 * streets along x every Q; lots on both sides of every z street, back to back; each house faces its street, wall /
 * roof materials varied (planks, plaster, half-timber; tiles, shingles), some with a porch deck; picket fences between
 * neighbours; lamps along the streets. -> { houses, paths: [{ x, z, len, w, axis, main }], fences, lamps }
 */
export function gridTown(region, surface, { scale: scale0 = 1, seed = 5, density = 1, street, village = false } = {}) {
  // WORLD-FIX-2 2026-11-07 (lead review: houses only on the top of the shell, the slopes bare): a house on a steep
  // slope is dug into it (its floor up to 40 % of the drop below the high side, at most 0.6 x its height) and its walls
  // go down to the low side, so the dome sides are covered in stepped terraces too
  const terrace = (lo, hi, h) => { const dig = Math.min((hi - lo) * 0.4, h * 0.6), y = hi - dig, sink = y - lo; return sink > h * 6 ? null : { y, sink }; };
  const scale = scale0 * (village ? 0.85 : 0.72); // many small houses read as a town (the target: ~300 on one shell)
  const R = prng(seed * 211 + 5);
  const sw = street.half * 2, lotD = (village ? 7 : 6) * scale, P = sw * 0.55 + 2 * lotD + 0.6 * scale, Q = (village ? 46 : 40) * scale;
  const houses = [], paths = [], fences = [], lamps = [];
  const xs = [0]; for (let k = 1; k * P < (region.x1 - region.x0); k++) { xs.push(k * P, -k * P); }
  const zc = (region.z0 + region.z1) / 2, zs = []; for (let z = zc - Math.ceil((zc - region.z0) / Q) * Q; z <= region.z1; z += Q) zs.push(z);
  const ok = (x, z) => surface(x, z) != null;
  const WALLK = village ? ["planks", "planks", "timber", "plaster"] : ["planks", "plaster", "timber", "planks", "plaster"];
  for (const sx of xs) {
    if (sx < region.x0 || sx > region.x1) continue;
    // the street strip (only where it lies on the back)
    for (let z = region.z0; z < region.z1; z += 3) if (ok(sx, z + 1.5)) paths.push({ y: surface(sx, z + 1.5), x: sx, z: z + 1.5, len: 3.05, w: sx === 0 ? sw : sw * 0.55, axis: "z", main: sx === 0, dy: (surface(sx, z + 3) ?? surface(sx, z + 1.5)) - (surface(sx, z) ?? surface(sx, z + 1.5)) });
    for (const side of [-1, 1]) {
      const hx = sx + side * ((sx === 0 ? sw / 2 : sw * 0.28) + lotD / 2 + 0.3 * scale);
      let z = region.z0 + R() * 3;
      while (z < region.z1) {
        const w = (5.5 + R() * 3.5) * scale, d = Math.min(lotD - 0.6, (5 + R() * 2) * scale), h = (4 + R() * 3.6 + (R() < 0.18 ? 3 : 0)) * scale;
        const cz = z + w / 2;
        z += w + (0.9 + R() * 1.4) * scale;
        if (zs.some((q) => Math.abs(q - cz) < sw * 0.4 + w / 2)) continue; // a cross street
        if (R() > Math.min(1, 0.92 * density + 0.1)) continue;
        const ys = [[-d / 2, -w / 2], [d / 2, -w / 2], [-d / 2, w / 2], [d / 2, w / 2], [0, 0]].map(([a, b]) => surface(hx + a, cz + b));
        if (ys.some((v) => v == null)) continue;
        const lo = Math.min(...ys), hi = Math.max(...ys);
        const tr = terrace(lo, hi, h); if (!tr) continue; // terraces down the dome (WORLD-FIX-2: steep slopes too, half dug into the slope)
        const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const wallK = WALLK[Math.floor(R() * WALLK.length)];
        const porch = R() < 0.35;
        houses.push({ x: hx, y: tr.y, z: cz, ry, w, d, h, sink: tr.sink, kind: "house", wall: wallK, wallCol: Math.floor(R() * 8), roof: R() < 0.55 ? "tiles" : "shingles", roofCol: Math.floor(R() * 6), porch, street: sx, side });
        // fence pieces at the front corners, toward the neighbours
        if (R() < 0.6) for (const e of [-1, 1]) fences.push({ x: hx - side * (d / 2 + 0.6 * scale), z: cz + e * (w / 2 + 0.5 * scale), y: surface(hx, cz) ?? hi, len: 1.1 * scale, axis: "z" });
      }
    }
    for (let z = region.z0 + 4; z < region.z1; z += 14 * scale) for (const side of [-1, 1]) { const x = sx + side * (sw / 2 - 0.3), y = surface(x, z); if (y != null && sx === 0) lamps.push({ x, y, z }); }
  }
  // infill: the rest of the back (between the rows, down the slopes) gets houses too, facing the nearest street
  const onPath = (x, z) => xs.some((sx) => Math.abs(x - sx) < (sx === 0 ? sw / 2 + 0.5 : sw * 0.3)) || zs.some((q) => Math.abs(z - q) < sw * 0.4 + 0.5);
  const freeAt = (x, z) => (onPath(x, z) || houses.some((o) => Math.hypot(o.x - x, o.z - z) < Math.hypot(o.w, o.d) / 2 + 1.2 * scale) ? null : surface(x, z));
  const area = (region.x1 - region.x0) * (region.z1 - region.z0);
  const want = Math.round((area / (village ? 90 : 55)) * density);
  for (let tries = 0, n = 0; n < want && tries < want * 60; tries++) {
    const x = region.x0 + R() * (region.x1 - region.x0), z = region.z0 + R() * (region.z1 - region.z0);
    const w = (5 + R() * 3) * scale, d = w * (0.75 + R() * 0.3), h = (4 + R() * 3.4) * scale;
    const ys = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([p, q]) => freeAt(x + p, z + q));
    if (ys.some((v) => v == null) || freeAt(x, z) == null) continue;
    const lo = Math.min(...ys), hi = Math.max(...ys); const tr = terrace(lo, hi, h); if (!tr) continue;
    if (houses.some((o) => Math.hypot(o.x - x, o.z - z) < Math.hypot(o.w, o.d) / 2 + Math.hypot(w, d) / 2 + 0.5 * scale)) continue;
    const near = xs.reduce((bb, sx) => (Math.abs(x - sx) < Math.abs(x - bb) ? sx : bb), 0);
    houses.push({ x, y: tr.y, z, w, d, h, sink: tr.sink, ry: x > near ? -Math.PI / 2 : Math.PI / 2, kind: "house", wall: WALLK[Math.floor(R() * WALLK.length)], wallCol: Math.floor(R() * 8), roof: R() < 0.55 ? "tiles" : "shingles", roofCol: Math.floor(R() * 6), porch: false, street: null, side: 0 }); n++;
  }
  for (const z of zs) for (let x = region.x0; x < region.x1; x += 3) if (ok(x + 1.5, z)) paths.push({ y: surface(x + 1.5, z), x: x + 1.5, z, len: 3.05, w: sw * 0.8, axis: "x", main: false, dy: (surface(x + 3, z) ?? surface(x + 1.5, z)) - (surface(x, z) ?? surface(x + 1.5, z)) });
  return { houses, paths, fences, lamps };
}

// WORLD-LOOK + WORLD BIBLE (CONTRACT.md addendum 2026-11-06 (d)): tl.world.town drives the town in every view.
const STYLE_WALL = { cottage: "plaster", timber: "timber", painted: "planks", stone: "stone" };
const LANDMARK_KIND = { school: "school", shop: "grocery", grocery: "grocery", market: "grocery", hospital: "hospital", bakery: "bakery", hall: "townhall", townhall: "townhall", library: "library", fire: "firehouse", firehouse: "firehouse", clock: "clocktower", clocktower: "clocktower", tower: "clocktower", bell: "belltower", belltower: "belltower", castle: "castle" };
/** the bible's landmarks (and its school / shop buildings) as backTown landmark kinds, or null without a bible */
export function bibleLandmarks(bible) {
  if (!bible) return null;
  const out = [];
  for (const l of [...(bible.landmarks ?? []), ...(bible.buildings ?? []).filter((b) => /^(school|hospital|hall|townhall|library|fire|firehouse)$/.test(String(b.kind ?? "")))]) { // shops stay houses with their own name sign
    const k = LANDMARK_KIND[String(l.kind ?? "").toLowerCase()] ?? Object.entries(LANDMARK_KIND).find(([w]) => String(l.name ?? "").toLowerCase().includes(w))?.[1];
    if (k && !out.includes(k)) out.push(k);
  }
  return out.length ? out.slice(0, 5) : ["school", "grocery", "clocktower"];
}
/**
 * dress the grid's houses in the bible's style (walls / roofs / trim colours, the wall material of its style id) and
 * put each named building (pos in [-1, 1]: x across the back, z along it, +z toward the head) on the nearest lot, with
 * its sign. Pure; mutates houses.
 */
export function applyBibleTown(houses, bible, region, landmarks = []) {
  const st = bible.style ?? {}, walls = st.walls?.length ? st.walls : null, roofs = st.roofs?.length ? st.roofs : null;
  const wk = STYLE_WALL[st.id] ?? null;
  houses.forEach((h, i) => {
    if (walls) h.wallHex = walls[(i * 7 + 3) % walls.length];
    if (roofs) h.roofHex = roofs[(i * 5 + 1) % roofs.length];
    if (wk) h.wall = i % 5 === 4 && wk !== "planks" ? "planks" : wk;
  });
  const cx = (region.x0 + region.x1) / 2, cz = (region.z0 + region.z1) / 2, hx = (region.x1 - region.x0) / 2, hz = (region.z1 - region.z0) / 2;
  const taken = new Set();
  for (const b of bible.buildings ?? []) {
    if (!Array.isArray(b.pos)) continue;
    if (landmarks.some((l) => l.name === LANDMARK_KIND[String(b.kind ?? "").toLowerCase()])) continue; // drawn as a landmark
    const x = cx + b.pos[0] * hx * 0.85, z = cz + b.pos[1] * hz * 0.85;
    let best = -1, bd = Infinity;
    houses.forEach((h, i) => { if (taken.has(i)) return; const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = i; } });
    if (best < 0) continue;
    taken.add(best);
    const h = houses[best];
    h.bibleId = b.id; if (b.wall) h.wallHex = b.wall; if (b.roof) h.roofHex = b.roof;
    if (b.floors) h.h = Math.max(h.h, (b.floors >= 2 ? 6.8 : 4.4) * (h.h / Math.max(1, h.h)));
    const sign = b.sign ?? (b.kind && b.kind !== "house" ? String(b.name ?? b.kind).replace(/^(the|my|our) /i, "").toUpperCase().slice(0, 12) : null);
    if (sign) h.sign = sign;
  }
  return houses;
}

// WORLD-LOOK: the dense town's meshes: one InstancedMesh per (part, material); textures from page/kit/townTex.js
// WORLD-FIX-2 (owner: washed-out town): saturated storybook walls (planks, plaster, the infill between the timbers)
const WALL_COLS = { planks: ["#b0683a", "#4f82b4", "#5f9e5a", "#b4503e", "#d49a3a", "#7a68b0", "#8a5a36", "#3f8f8a"], plaster: ["#f2bd48", "#e8806a", "#78b4dc", "#94cc82", "#f2a0b6", "#c4a0e0", "#f4d27e", "#ec9a58"], timber: ["#f4d898", "#f0c49a", "#d4e6a8", "#f6dcb0", "#c8dcec", "#f4c8c0", "#e8d48c", "#f2e0a8"] };
const SHUT = ["#2f6fa8", "#3a8a4a", "#b83a2e", "#2f8a86", "#6a4aa0", "#d08a2a"], FLOW = ["#e8384a", "#f06aa8", "#f4c430", "#ff7a2a", "#b04ae0"], AWN = ["#d0342c", "#2f78c0", "#2f9a50", "#e8a020", "#8a3ab0"], PROD = ["#e84a2a", "#f4a020", "#6ab040", "#c03050", "#f0d040"];
const ROOF_COLS = { tiles: ["#b8442c", "#c8603a", "#a83a2a", "#d07040", "#9a4a32", "#c05030"], shingles: ["#6a5a4a", "#4f5d6e", "#7a4a3a", "#5a6a5a", "#3e4a5e", "#80664a"] };
function denseTownMesh(plan, { seed = 5 } = {}) {
  const g = new THREE.Group(); g.name = "denseTown";
  const houses = plan.houses, sc = plan.scale ?? 1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const box = new THREE.BoxGeometry(1, 1, 1), roofG = (() => { const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]); const ge = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); ge.translate(0, 0, -0.5); ge.rotateY(Math.PI / 2); return ge; })();
  // roof uvs: the extrude's side faces get world-ish uvs; scale them so a tile texture repeats a few times
  { const uv = roofG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3); }
  const buckets = new Map();
  const bucket = (key, geo, make) => { if (!buckets.has(key)) buckets.set(key, { geo, mat: make(), list: [] }); return buckets.get(key); };
  const winMat = new THREE.MeshStandardMaterial({ color: "#2a3a4c", roughness: 0.15, metalness: 0.2, emissive: "#ffc070", emissiveIntensity: 0 });
  const frameMat = new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.7 });
  const deckMat = new THREE.MeshStandardMaterial({ map: townTex(THREE, "planks", { color: "#a07850", seed: 3 }), roughness: 0.85 });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#5a3e28", roughness: 0.8 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: "#efe8da", roughness: 0.8 });
  const chimMat = new THREE.MeshStandardMaterial({ map: townTex(THREE, "stone", { color: "#9a6a52", seed: 4 }), roughness: 0.9 });
  const push = (b, lx, ly, lz, sx, sy, sz, h) => { q.setFromAxisAngle(up, h.ry ?? 0); v.set(lx, ly, lz).applyQuaternion(q).add(s.set(h.x, h.y, h.z)); b.list.push(new THREE.Matrix4().compose(v.clone(), q.clone(), new THREE.Vector3(sx, sy, sz))); };
  const wins = [], frames = [], doors = [], decks = [], posts = [], chims = [], signs = [], det = [], props = [], lanterns = [], barrels = [];
  const DR = (x) => { const t = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453; return t - Math.floor(t); };
  if (plan.trim) frameMat.color.set(plan.trim);
  for (const h of houses) {
    const sink = (h.sink ?? 0) + 0.3, H = h.h + sink, W = h.w, D = h.d;
    const wk = h.wall ?? "plaster", wc = h.wallHex ?? (WALL_COLS[wk] ?? WALL_COLS.plaster)[(h.wallCol ?? 0) % 8];
    const wb = bucket(`w:${wk}:${wc}`, box, () => new THREE.MeshStandardMaterial({ map: townTex(THREE, wk, { color: wc, seed: 7 }), roughness: 0.88 }));
    push(wb, 0, -sink + H / 2, 0, W, H, D, h);
    const rk = h.roof ?? "tiles", rc = h.roofHex ?? (ROOF_COLS[rk] ?? ROOF_COLS.tiles)[(h.roofCol ?? 0) % 6];
    const rb = bucket(`r:${rk}:${rc}`, roofG, () => new THREE.MeshStandardMaterial({ map: townTex(THREE, rk, { color: rc, seed: 9 }), roughness: 0.8 }));
    const rh = Math.min(D * 0.6, 3.6 * sc);
    push(rb, 0, -sink + H, 0, W + 0.8 * sc, rh, D + 0.8 * sc, h);
    // front door, windows (2 floors when tall), side windows
    doors.push([0, 1.1 * sc, D / 2 + 0.04, 1.1 * sc, 2.1 * sc, 0.12, h]);
    const floors = h.h > 6.2 * sc ? [1.9, 4.6] : [2.0];
    for (const fy of floors) for (const fx of fy < 3 ? [-0.3, 0.3] : [-0.32, 0, 0.32]) {
      const lx = fx * W; if (fy < 3 && Math.abs(lx) < 1.0 * sc) continue;
      wins.push([lx, fy * sc, D / 2 + 0.05, 0.95 * sc, 1.15 * sc, 0.06, h]); frames.push([lx, fy * sc, D / 2 + 0.03, 1.2 * sc, 1.4 * sc, 0.06, h]);
      wins.push([lx, fy * sc, -D / 2 - 0.05, 0.95 * sc, 1.15 * sc, 0.06, h]);
    }
    for (const e of [-1, 1]) wins.push([e * (W / 2 + 0.05), 2.0 * sc, 0, 0.06, 1.1 * sc, 0.9 * sc, h]);
    if (h.porch) { decks.push([0, 0.35 * sc, D / 2 + 1.1 * sc, W * 0.9, 0.25 * sc, 2.2 * sc, h]); for (const e of [-1, 1]) posts.push([e * W * 0.43, 1.4 * sc, D / 2 + 2.1 * sc, 0.18 * sc, 2.4 * sc, 0.18 * sc, h]); }
    chims.push([W * 0.25, -sink + H + rh * 0.5, -D * 0.15, 0.7 * sc, rh * 1.0, 0.7 * sc, h]);
    if (h.sign) signs.push(h);
    // WORLD-FIX-2 2026-11-07 (owner: "the town scenes look EMPTY and WASHED-OUT"): street-level detail on every front:
    // coloured shutters + flower boxes at the ground-floor windows, a wall lantern by the door, on some houses an awning,
    // crates and barrels; on the main street a market stall now and then (counter, striped canopy, produce)
    const hr = DR(h.x * 7.1 + h.z * 3.3), sh = SHUT[Math.floor(hr * SHUT.length) % SHUT.length];
    for (const fx of [-0.3, 0.3]) {
      const lx = fx * W; if (Math.abs(lx) < 1.0 * sc) continue;
      for (const e of [-1, 1]) det.push([lx + e * 0.66 * sc, 2.0 * sc, D / 2 + 0.08, 0.36 * sc, 1.25 * sc, 0.07, h, sh]);
      det.push([lx, 1.3 * sc, D / 2 + 0.2 * sc, 1.15 * sc, 0.26 * sc, 0.36 * sc, h, "#6a4426"]);
      det.push([lx, 1.5 * sc, D / 2 + 0.2 * sc, 1.0 * sc, 0.22 * sc, 0.3 * sc, h, FLOW[Math.floor(DR(lx + h.x) * FLOW.length) % FLOW.length]]);
    }
    lanterns.push([0.85 * sc, 2.1 * sc, D / 2 + 0.16, 0.26 * sc, 0.4 * sc, 0.26 * sc, h]);
    if (hr < 0.4 && !h.porch) { const ac = AWN[Math.floor(hr * 97) % AWN.length]; props.push([0, 2.55 * sc, D / 2 + 0.6 * sc, 2.0 * sc, 0.14 * sc, 1.2 * sc, h, ac]); props.push([0, 2.38 * sc, D / 2 + 1.18 * sc, 2.0 * sc, 0.3 * sc, 0.06, h, "#f6f0e4"]); }
    if (hr > 0.55) { props.push([W * 0.36, 0.35 * sc, D / 2 + 0.5 * sc, 0.7 * sc, 0.7 * sc, 0.7 * sc, h, "#a8743e"]); props.push([W * 0.36 + 0.15 * sc, 0.95 * sc, D / 2 + 0.45 * sc, 0.5 * sc, 0.5 * sc, 0.5 * sc, h, "#8e5e30"]); barrels.push([-W * 0.36, 0.5 * sc, D / 2 + 0.55 * sc, 0.62 * sc, 1.0 * sc, 0.62 * sc, h]); }
    if (h.street === 0 && !h.porch && hr > 0.2 && hr < 0.42) {
      const z0 = D / 2 + 1.05 * sc, cc = AWN[Math.floor(hr * 53) % AWN.length];
      props.push([0, 0.5 * sc, z0, 2.2 * sc, 1.0 * sc, 0.8 * sc, h, "#8a5a32"]);
      for (let k = 0; k < 3; k++) props.push([(k - 1) * 0.7 * sc, 1.12 * sc, z0, 0.6 * sc, 0.24 * sc, 0.6 * sc, h, PROD[(k + Math.floor(hr * 10)) % PROD.length]]);
      for (const e of [-1, 1]) props.push([e * 1.05 * sc, 1.25 * sc, z0 + 0.3 * sc, 0.12 * sc, 2.5 * sc, 0.12 * sc, h, "#5a3e28"]);
      for (let k = 0; k < 4; k++) props.push([(k - 1.5) * 0.62 * sc, 2.5 * sc, z0 + 0.1 * sc, 0.62 * sc, 0.14 * sc, 1.5 * sc, h, k % 2 ? "#f6f0e4" : cc]);
    }
  }
  // the detail pieces: one instanced mesh with a colour per piece; the lanterns glow at night; barrels
  for (const [list, nm] of [[det, "streetDetail"], [props, "streetProps"]]) if (list.length) { const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }), list.length), col = new THREE.Color(); im.userData.placeProp = nm === "streetProps"; list.forEach((r, i) => { const [lx, ly, lz, sx, sy, sz, h, c] = r; q.setFromAxisAngle(up, h.ry ?? 0); v.set(lx, ly - (h.sinkFix ?? 0), lz).applyQuaternion(q).add(s.set(h.x, h.y, h.z)); m4.compose(v, q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c)); }); im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = nm; g.add(im); }
  const lanternMat = new THREE.MeshStandardMaterial({ color: "#ffe6a8", emissive: "#ffb347", emissiveIntensity: 0.4, roughness: 0.4 });
  const inst = (geo, mat, rows, name, cast = true) => { if (!rows.length) return null; const im = new THREE.InstancedMesh(geo, mat, rows.length); rows.forEach((r, i) => { const [lx, ly, lz, sx, sy, sz, h] = r; q.setFromAxisAngle(up, h.ry ?? 0); v.set(lx, ly, lz).applyQuaternion(q).add(s.set(h.x, h.y, h.z)); m4.compose(v, q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; im.name = name; g.add(im); return im; };
  for (const [k, b] of buckets) { const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length); b.list.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.name = k; g.add(im); }
  inst(box, lanternMat, lanterns, "lanterns", false); { const bar = inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), new THREE.MeshStandardMaterial({ color: "#7a4e2a", roughness: 0.8 }), barrels, "barrels"); if (bar) bar.userData.placeProp = true; }
  inst(box, winMat, wins, "windows", false); inst(box, frameMat, frames, "frames", false); inst(box, darkWood, doors, "doors"); inst(box, deckMat, decks, "porches"); inst(box, darkWood, posts, "porchPosts"); inst(box, chimMat, chims, "chimneys");
  // fences (pickets as thin boxes) and the streets (cobbles on the main street, packed dirt on the others)
  const fr = []; for (const f of plan.fences ?? []) for (let k = 0; k < 4; k++) fr.push([0, 0.45 * sc, (k - 1.5) * f.len / 4, 0.08 * sc, 0.9 * sc, 0.1 * sc, { x: f.x, y: f.y, z: f.z, ry: 0 }]);
  inst(box, fenceMat, fr, "fences");
  const cob = new THREE.MeshStandardMaterial({ map: townTex(THREE, "cobbles", { color: "#8c7f6c", seed: 2 }), roughness: 0.95 }), dirtM = new THREE.MeshStandardMaterial({ map: townTex(THREE, "dirt", { color: "#8a7458", seed: 2 }), roughness: 1 });
  const pm = [], pd = [];
  for (const p of plan.paths ?? []) { const y = p.y ?? null; (p.main ? pm : pd).push(p); void y; }
  const surfY = plan.surfY ?? (() => 0);
  const pathRows = (list) => list.map((p) => [0, 0, 0, p.axis === "z" ? p.w : p.len, 0.22, p.axis === "z" ? p.len : p.w, { x: p.x, y: (p.y ?? surfY(p.x, p.z)) + 0.04, z: p.z, ry: 0 }]);
  // WORLD-FIX-2 2026-11-07 (lead review: "a plank between the camera and the person" in street day / night): the flat
  // 3 m street blocks stepped up and down the dome, each step edge a plank across the frame at a kid's knees. Each block
  // now follows the slope (pitched along its street) and reaches down 1 m, so the street is one smooth ramp
  const pathMesh = (list, mat, name) => { if (!list.length) return; const im = new THREE.InstancedMesh(box, mat, list.length), e = new THREE.Euler(); list.forEach((p, i) => { const y = (p.y ?? surfY(p.x, p.z)) + 0.04, a = Math.atan2(p.dy ?? 0, p.len), t = 1.2; e.set(p.axis === "z" ? -a : 0, 0, p.axis === "x" ? a : 0); q.setFromEuler(e); const dn = new THREE.Vector3(0, -(t - 0.22) / 2, 0).applyQuaternion(q); m4.compose(v.set(p.x + dn.x, y + dn.y, p.z + dn.z), q, new THREE.Vector3(p.axis === "z" ? p.w : p.len / Math.cos(a) + 0.1, t, p.axis === "z" ? p.len / Math.cos(a) + 0.1 : p.w)); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; im.frustumCulled = false; im.name = name; g.add(im); };
  pathMesh(pm, cob, "mainStreet"); pathMesh(pd, dirtM, "sideStreets"); void pathRows; void inst;
  // the bible's named places: a sign board over the door
  for (const h of signs) { const sw = Math.min(h.w * 0.9, 1.2 + h.sign.length * 0.55 * sc), sh = sw / 4; const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: signTex(h.sign, "#2c3e70"), roughness: 0.6 })); q.setFromAxisAngle(up, h.ry ?? 0); m.position.set(0, Math.min(h.h - 0.4, 3.3 * sc), h.d / 2 + 0.12).applyQuaternion(q).add(s.set(h.x, h.y, h.z)); m.quaternion.copy(q); m.castShadow = true; g.add(m); }
  g.userData.setLit = (on, k = 1) => { lanternMat.emissiveIntensity = on ? 2.4 * k : 0.4; winMat.emissiveIntensity = on ? 1.7 * k : 0; winMat.color.set(on ? "#ffd892" : "#2a3a4c"); };
  return g;
}

// ------------------------------------------------------------------------------------------------ building pieces
const MATS = new Map();
const mat = (k, f) => (MATS.has(k) ? MATS.get(k) : (MATS.set(k, f()), MATS.get(k)));
const std = (c, r = 0.85) => mat(`b:${c}:${r}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: r }));

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signTex(text, bg) {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = "#ffffff"; x.fillRect(8, 8, w - 16, 6); x.fillRect(8, h - 14, w - 16, 6);
    x.font = `900 ${text.length > 7 ? 64 : 80}px Arial Black, Arial, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.fillText(text, w / 2, h / 2 + 4);
  });
}
/** a window grid (rows x cols), some lit: map + emissive map (lit windows glow at night) */
function windowTex(seed, base = "#2a3350", cols = 4, rows = 10) {
  const R = prng(seed);
  const lit = [];
  const map = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const on = R() < 0.55; lit.push(on); x.fillStyle = on ? "#ffd892" : "#1a2033"; x.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.2, cw * 0.56, rh * 0.55); }
  });
  let i = 0;
  const em = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (lit[i++]) { x.fillStyle = "#ffc86a"; x.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.2, cw * 0.56, rh * 0.55); } }
  });
  return { map, em };
}

function landmarkMesh(L, litMats) {
  const g = new THREE.Group(); g.name = `landmark:${L.name}`;
  const H = L.h + (L.sink ?? 0);
  const wall = new THREE.Mesh(new RoundedBoxGeometry(L.d, H, L.w, 1, 0.2), mat(`lmwall:${L.wall}`, () => new THREE.MeshStandardMaterial({ map: townTex(THREE, L.spire ? "stone" : "plaster", { color: L.wall, seed: 13 }), roughness: 0.88 }))); wall.position.y = H / 2 - (L.sink ?? 0); g.add(wall);
  if (L.spire) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.max(L.d, L.w) * 0.62, L.h * 0.6, 4), std(L.roof, 0.7)); cone.position.y = L.h + L.h * 0.3 - (L.sink ?? 0); cone.rotation.y = Math.PI / 4; g.add(cone);
  } else {
    const roof = new THREE.Mesh(new RoundedBoxGeometry(L.d + 1, 1.2, L.w + 1, 1, 0.2), std(L.roof, 0.7)); roof.position.y = L.h + 0.6 - (L.sink ?? 0); g.add(roof);
  }
  // windows: a lit band on the front, glowing at night
  const wm = mat(`lmw`, () => { const m = new THREE.MeshStandardMaterial({ color: "#2a3a4c", roughness: 0.2, emissive: "#ffc86a", emissiveIntensity: 0 }); litMats.push(m); return m; });
  for (let i = 0; i < Math.max(2, Math.round(L.w / 3.2)); i++) for (const fy of [0.38, 0.72]) {
    if (L.h * fy > L.h - 1.2) continue;
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.1), wm); w.position.set(L.d / 2 + 0.05, L.h * fy, -L.w / 2 + 1.6 + i * ((L.w - 3.2) / Math.max(1, Math.round(L.w / 3.2) - 1))); g.add(w);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 2.0), std("#5a3a22")); door.position.set(L.d / 2 + 0.06, 1.2, 0); g.add(door);
  if (L.text) {
    const sw = Math.min(L.w * 0.9, 1.0 + L.text.length * 1.25), sh = sw / 4;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: signTex(L.text, L.sign), roughness: 0.6, emissive: "#ffffff", emissiveMap: null, emissiveIntensity: 0 }));
    sign.position.set(L.d / 2 + 0.12, Math.min(L.h - sh * 0.6 - 0.2, Math.max(3.2, L.h * 0.86)), 0); sign.rotation.y = Math.PI / 2; g.add(sign);
    // the sign also sits on the roof edge, so it reads from above (the aerials)
    const top = sign.clone(); top.position.set(L.d / 2 - 0.4, L.h + 1.2 + sh / 2, 0); top.rotation.set(-0.5, Math.PI / 2, 0, "YXZ"); g.add(top);
  }
  if (L.cross) {
    const cm = std("#e53935", 0.5);
    for (const [w, h] of [[0.4, 3.2], [0.4, 1.0]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, h === 3.2 ? 1.0 : 3.2), cm); c.position.set(L.d / 2 + 0.25, L.h * 0.62, 0); g.add(c); }
    for (const [a, b] of [[3.6, 1.1], [1.1, 3.6]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(a, 0.3, b), cm); c.position.set(0, L.h + 1.3, 0); g.add(c); }
  }
  if (L.clock) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), std("#fdfdf6", 0.4)); c.rotation.z = Math.PI / 2; c.position.set(L.d / 2 + 0.15, L.h * 0.86, 0); g.add(c); }
  // WORLD-FIX-2 2026-11-07 (owner: "school day" a blank yellow wall): the landmark's front is its local +x, the plan's ry
  // is the houses' convention (front +z). Turned by ry alone, the building lay across the street (its length w spanned
  // x) and its front faced along the street; now its depth d spans x (as planned) and the door + sign face the street
  g.position.set(L.x, L.y, L.z); g.rotation.y = L.ry - Math.PI / 2;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function towersMesh(towers, { seed, style, litMats }) {
  const g = new THREE.Group(); g.name = "skyline";
  if (!towers.length) return g;
  const base = style === "castle" ? "#2c3550" : "#3a4258";
  const variants = [0, 1, 2].map((i) => windowTex(seed * 7 + i, base));
  const mats = variants.map((v) => { const m = new THREE.MeshStandardMaterial({ map: v.map, emissive: "#ffffff", emissiveMap: v.em, emissiveIntensity: 0, roughness: 0.55, metalness: 0.15 }); litMats.push(m); return m; });
  const spireM = std(style === "castle" ? "#283048" : "#4a5470", 0.6), capM = std("#cfc6b0", 0.8), tipM = mat("tip", () => new THREE.MeshStandardMaterial({ color: "#ff5a3a", emissive: "#ff3a1a", emissiveIntensity: 1.5 }));
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), cube = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(1, 1, 12), ring = new THREE.CylinderGeometry(1, 1, 1, 12);
  towers.forEach((t, i) => {
    const m = mats[i % 3];
    if (m.map) { m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.emissiveMap.wrapS = m.emissiveMap.wrapT = THREE.RepeatWrapping; m.map.repeat.set(t.round ? 3 : 1, Math.max(1, t.h / 24)); m.emissiveMap.repeat.copy(m.map.repeat); }
    const body = new THREE.Mesh(t.round ? cyl : cube, m); body.scale.set(t.r * (t.round ? 1 : 1.7), t.h, t.r * (t.round ? 1 : 1.7)); body.position.set(t.x, t.y + t.h / 2 - 1, t.z); body.rotation.y = t.ry; g.add(body);
    const cap = new THREE.Mesh(ring, capM); cap.scale.set(t.r * (t.round ? 1.12 : 1.85), 0.9, t.r * (t.round ? 1.12 : 1.85)); cap.position.set(t.x, t.y + t.h - 1, t.z); cap.rotation.y = t.ry; g.add(cap);
    if (t.spire) { const sp = new THREE.Mesh(cone, spireM); sp.scale.set(t.r * 1.15, t.r * 3.2, t.r * 1.15); sp.position.set(t.x, t.y + t.h - 0.5 + t.r * 1.6, t.z); g.add(sp); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), tipM); tip.position.set(t.x, t.y + t.h - 0.5 + t.r * 3.2, t.z); g.add(tip); }
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/**
 * WORLD-LOOK 2026-11-06: the city wall round the back: a thick stone wall with a WALKWAY on top (planks between a low
 * inner parapet and the outer battlements), round corner towers with battlement rings. w.walk = the walkway width.
 * The walkway's path (root metres) is kept in g.userData.walkway: [{ x, y, z, ry, out: [x, z] }] (the on-back camera
 * stands on it).
 */
function wallMesh(w, surface) {
  const g = new THREE.Group(); g.name = "townWall";
  const { region, h, inset } = w, walk = w.walk ?? 2.4;
  const stone = mat("wallStone", () => new THREE.MeshStandardMaterial({ map: townTex(THREE, "stone", { color: "#b8ae98", seed: 5 }), roughness: 0.92 }));
  const dark = mat("wallDark", () => new THREE.MeshStandardMaterial({ map: townTex(THREE, "stone", { color: "#9a907c", seed: 6 }), roughness: 0.92 }));
  const plank = mat("wallWalk", () => new THREE.MeshStandardMaterial({ map: townTex(THREE, "planks", { color: "#8a6a48", seed: 8 }), roughness: 0.85 }));
  const x0 = region.x0 + inset + walk / 2, x1 = region.x1 - inset - walk / 2, z0 = region.z0 + inset + walk / 2, z1 = region.z1 - inset - walk / 2;
  const cx0 = (x0 + x1) / 2, cz0 = (z0 + z1) / 2;
  const segs = [], step = 3;
  const edge = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; segs.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, ry: Math.atan2(bx - ax, bz - az), len: L / n }); } };
  edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
  const ok = segs.map((p) => { let y = surface(p.x, p.z); if (y == null) y = surface(cx0 + (p.x - cx0) * 0.9, cz0 + (p.z - cz0) * 0.9); return y == null ? null : { ...p, y }; }).filter(Boolean);
  const N = Math.max(1, ok.length);
  const blk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, N), deck = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), plank, N);
  const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dark, N * 2), par = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dark, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const walkway = [];
  ok.forEach((p, i) => {
    q.setFromAxisAngle(up, p.ry);
    // local x is across the wall; which side is outside (away from the town's centre)?
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q), outS = Math.sign((p.x - cx0) * ax.x + (p.z - cz0) * ax.z) || 1;
    const top = p.y + h - 1;
    m4.compose(v.set(p.x, p.y + (h - 1) / 2 - 1, p.z), q, s.set(walk + 0.6, h + 1, p.len * 1.02)); blk.setMatrixAt(i, m4);
    m4.compose(v.set(p.x, top + 0.1, p.z), q, s.set(walk, 0.2, p.len * 1.03)); deck.setMatrixAt(i, m4);
    // battlements on the outer edge (two merlons per segment), a low parapet on the inner edge
    for (const k of [0, 1]) { const o = new THREE.Vector3(outS * (walk / 2 + 0.15), 0, (k - 0.5) * p.len * 0.5).applyQuaternion(q); m4.compose(v.set(p.x + o.x, top + 0.9, p.z + o.z), q, s.set(0.5, 1.6, p.len * 0.3)); mer.setMatrixAt(i * 2 + k, m4); }
    const o2 = new THREE.Vector3(-outS * (walk / 2 + 0.1), 0, 0).applyQuaternion(q); m4.compose(v.set(p.x + o2.x, top + 0.45, p.z + o2.z), q, s.set(0.35, 0.7, p.len * 1.02)); par.setMatrixAt(i, m4);
    walkway.push({ x: p.x, y: top + 0.2, z: p.z, ry: p.ry, out: [ax.x * outS, ax.z * outS] });
  });
  for (const im of [blk, deck, mer, par]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.needsUpdate = true; g.add(im); }
  // round corner towers with a battlement ring and a pointed roof
  const roofM = std("#3a3550", 0.7);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
    const y = surface(cx, cz) ?? surface(cx0 + (cx - cx0) * 0.88, cz0 + (cz - cz0) * 0.88); if (y == null) continue;
    const r = walk * 1.1 + 1;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h + 6, 16), stone); t.position.set(cx, y + (h + 6) / 2 - 1, cz); t.castShadow = true; g.add(t);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 1.4, 16), dark); c.position.set(cx, y + h + 5.6, cz); g.add(c);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.2, r * 2.2, 16), roofM); cone.position.set(cx, y + h + 6.3 + r * 1.1, cz); g.add(cone);
  }
  g.userData.walkway = walkway;
  return g;
}

export function addBackTown(g, opts = {}) {
  const spec = opts === true ? {} : opts;
  const style = spec.style ?? "town", seed = spec.seed ?? 5;
  const { surf, region, kind: surfKind } = backSurface(g);
  const bible = spec.bible?.buildings ? spec.bible : null;
  const plan = planBackTown(region, surf, { style, landmarks: spec.landmarks ?? bibleLandmarks(bible) ?? [], seed: bible?.seed ?? seed, density: spec.density ?? 1, walls: spec.walls ?? null, bible });
  const town = new THREE.Group(); town.name = `backTown:${style}`;
  const litMats = [];
  // WORLD-LOOK: grid towns (village / town) get the dense textured houses; the trees and lamps still come from makeTown
  const dense = plan.houses.length && plan.houses[0].wall ? denseTownMesh(plan, { seed }) : null;
  if (dense) { town.add(dense); const t = makeTown([], { seed, lit: !!spec.lit, trees: plan.trees, lamps: plan.lamps }); town.add(t); town.userData.houses = { userData: { setLit: (on, k) => { dense.userData.setLit(on, k); t.userData.setLit(on, k); } } }; }
  else if (plan.houses.length) { const t = makeTown(plan.houses, { seed, lit: !!spec.lit, trees: plan.trees, lamps: plan.lamps, tex: spec.tex ?? null }); town.add(t); town.userData.houses = t; }
  for (const L of plan.landmarks) town.add(landmarkMesh(L, litMats));
  town.add(towersMesh(plan.towers, { seed, style, litMats }));
  if (plan.wall) { const wm = wallMesh(plan.wall, surf); town.add(wm); town.userData.walkway = wm.userData.walkway; }
  // the street: a darker strip down the middle (a few blocks following the surface)
  const st = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.25, 1), std("#8d8478", 0.95), 200); let n = 0;
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let z = region.z0; z < region.z1 && n < 200 && !dense; z += 2) { const y = surf(0, z); if (y == null) continue; m4.compose(v.set(0, y + 0.02, z + 1), q, s.set(plan.street.half * 2 - 0.6, 1, 2.05)); st.setMatrixAt(n++, m4); }
  st.count = n; st.name = "backStreet"; st.receiveShadow = true; st.frustumCulled = false; st.instanceMatrix.needsUpdate = true; town.add(st);
  // ATTACH-2: a lumpy back (field) or a body block's top (box) gets the walkable deck, in the body's own colour
  if (surfKind !== "shaped") {
    const bm = g.userData.joints.body.children.find((o) => o.isMesh && o.material?.color)?.material;
    const deck = backDeckMesh(surf, region, { material: new THREE.MeshStandardMaterial({ color: bm ? bm.color.clone() : new THREE.Color("#7a6a58"), map: bm?.map ?? null, roughness: 0.9 }), step: Math.max(1, Math.min(2, (region.x1 - region.x0) / 36)) });
    town.add(deck); town.userData.deck = deck;
  }
  // ride the body joint (metres, root-space rest pose), like page/kit/giants.js buildGiantTown
  // ATTACH 2026-11-07 (owner: "everything on a creature must be attached to it and move with it"): the town rides the
  // joint that carries the walkable back: the shell when it has its own joint (a snail's shell rocks and bobs on its
  // body: the town on the body slid off it), else the body. The holder is the exact inverse of that joint's rest
  // transform in the giant's root space (was: the body's rest position only, any rest rotation / nested pivot ignored)
  const J = g.userData.joints, carrierJ = J.shell && J.shell !== J.body && J.shell.isObject3D ? J.shell : J.body;
  g.updateMatrixWorld(true);
  const restInRoot = new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(carrierJ.matrixWorld);
  const holder = new THREE.Group(); holder.name = "backTownHolder";
  restInRoot.invert().decompose(holder.position, holder.quaternion, holder.scale);
  holder.add(town); carrierJ.add(holder);
  g.userData.townJoint = carrierJ;
  // an asked back town supersedes the kind's own little town (replace: false keeps both)
  if ((spec.replace ?? true) && g.userData.town) g.userData.town.visible = false;
  town.userData.plan = plan;
  town.userData.setLit = (on, k = 1) => { for (const m of litMats) m.emissiveIntensity = on ? 1.8 * k : 0; town.userData.houses?.userData.setLit?.(on, k); };
  town.userData.setLit(!!spec.lit);
  g.userData.backTown = town;
  return town;
}
