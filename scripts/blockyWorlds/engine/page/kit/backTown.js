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
};

/** the back's flat-enough surface + its region (root metres, rest pose): the giant's own, else the body's top */
export function backSurface(g) {
  const u = g.userData.unit, p = g.userData.params, b = p.body;
  let surf = giantSurface(g);
  let region = { x0: -b.w * 0.6 * u, x1: b.w * 0.6 * u, z0: -b.len * 0.6 * u, z1: b.len * 0.6 * u };
  if (surf(0, 0) == null) {
    // any other body (a standing wolf, a bird, an octopus): the top of the body block, as a flat deck
    const body = g.userData.joints.body; g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3();
    body.traverse((o) => { if (o.isMesh && o.parent === body) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); box.union(tmp); } });
    if (box.isEmpty()) box.setFromObject(g).applyMatrix4(inv);
    const y = box.max.y, hw = (box.max.x - box.min.x) * 0.44, hl = (box.max.z - box.min.z) * 0.44, cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
    surf = (x, z) => (Math.abs(x - cx) <= hw && Math.abs(z - cz) <= hl ? y : null);
    region = { x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl };
  }
  return { surf, region };
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
export function planBackTown(region, surface, { style = "town", landmarks = [], seed = 5, density = 1, walls = null } = {}) {
  const W = region.x1 - region.x0, L = region.z1 - region.z0, area = W * L, R = prng(seed * 97 + 13);
  const city = style === "city" || style === "castle";
  const scale = Math.max(0.45, Math.min(1, Math.sqrt(area) / 90)); // small backs get smaller houses
  // landmarks first: along the street near the front (the head end, +z), alternating sides
  const lm = [], street = { axis: "z", half: Math.max(2.5, 3.6 * scale) };
  const want = landmarks.length ? landmarks : city ? ["castle", "tower", "tower"] : style === "village" ? [] : ["school", "grocery", "hospital"];
  let zc = region.z1 - L * 0.12;
  want.forEach((name, i) => {
    const S = SIGN[name] ?? SIGN.school, w = S.w * scale, d = S.d * scale, h = S.h * scale * (city && S.spire ? 1.6 : 1);
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
    const n = Math.round(Math.min(220, (area / 70) * density));
    for (let tries = 0; towers.length < n && tries < n * 30; tries++) {
      const x = region.x0 + R() * W, z = region.z0 + R() * L; const y = surf2(x, z); if (y == null) continue;
      if (Math.abs(x) < street.half) continue;
      const round = style === "castle" ? R() < 0.7 : R() < 0.25;
      const rad = (round ? 2.2 + R() * 2.6 : 2.6 + R() * 3.2) * scale;
      if (towers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + rad + 0.6)) continue;
      const mid = 1 - Math.min(1, Math.hypot((x - (region.x0 + W / 2)) / (W / 2), (z - (region.z0 + L / 2)) / (L / 2)));
      const h = (14 + R() * 26 + mid * 34) * scale * (style === "castle" ? 1 : 1.25);
      towers.push({ x, y, z, r: rad, h, round, spire: round || R() < 0.3, ry: R() * Math.PI });
    }
  }
  // houses on streets (village / town); a city keeps a few low houses between its towers
  const want2 = city ? Math.round(Math.min(60, area / 400)) : Math.round(Math.max(8, Math.min(300, (area / (style === "village" ? 420 : 210)) * density)));
  const occupied = (x, z, r) => towers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.5);
  const surf3 = (x, z) => (occupied(x, z, 1) ? null : surf2(x, z));
  // steep backs (a turtle's dome): houses step down the slope on deeper walls (sink), like terraces
  const houses = terraceLayout({ surface: surf3, region, count: want2, seed, street, minGap: 0.8 * scale, size: [6 * scale, 9.5 * scale], tall: [4.5 * scale, 8 * scale] });
  // trees and lamps along the street
  const trees = [], lamps = [];
  for (let k = 0; k < want2 * 0.35; k++) { const x = region.x0 + R() * W, z = region.z0 + R() * L, y = surf3(x, z); if (y == null || Math.abs(x) < street.half) continue; if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < Math.hypot(h.w, h.d) / 2 + 1)) continue; trees.push({ x, y, z, s: 0.7 + R() * 0.4 }); }
  for (let z = region.z0 + 6; z < region.z1 - 4; z += 11 * scale) for (const s of [-1, 1]) { const x = s * (street.half - 0.4), y = surface(x, z); if (y != null) lamps.push({ x, y, z }); }
  // the wall round the edge (castle / city, or asked)
  const wall = (walls ?? city) ? { region, h: (style === "castle" ? 7 : 5) * Math.max(0.6, scale), inset: 1.2 } : null;
  return { houses, landmarks: lm, towers, wall, trees, lamps, scale, street };
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
  const wall = new THREE.Mesh(new RoundedBoxGeometry(L.d, H, L.w, 1, 0.2), std(L.wall)); wall.position.y = H / 2 - (L.sink ?? 0); g.add(wall);
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
  g.position.set(L.x, L.y, L.z); g.rotation.y = L.ry;
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

function wallMesh(w, surface) {
  const g = new THREE.Group(); g.name = "townWall";
  const { region, h, inset } = w, m = std("#cfc6b0", 0.9), dark = std("#aaa08a", 0.9);
  const x0 = region.x0 + inset, x1 = region.x1 - inset, z0 = region.z0 + inset, z1 = region.z1 - inset;
  const segs = [];
  const step = 3;
  const edge = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) { const s = (i + 0.5) / n; segs.push({ x: ax + (bx - ax) * s, z: az + (bz - az) * s, ry: Math.atan2(bx - ax, bz - az), len: L / n }); } };
  edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
  const ok = segs.map((s) => { let y = surface(s.x, s.z); if (y == null) { y = surface(s.x * 0.92, s.z * 0.92); } return y == null ? null : { ...s, y }; }).filter(Boolean);
  const blk = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.08), m, ok.length), mer = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dark, ok.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  ok.forEach((p, i) => {
    q.setFromAxisAngle(up, p.ry);
    m4.compose(v.set(p.x, p.y + h / 2 - 1, p.z), q, s.set(1.4, h + 2, p.len * 1.02)); blk.setMatrixAt(i, m4);
    m4.compose(v.set(p.x, p.y + h + 1.5 - 1, p.z), q, s.set(1.5, 1.2, p.len * 0.5)); mer.setMatrixAt(i, m4);
  });
  for (const im of [blk, mer]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.needsUpdate = true; g.add(im); }
  // round corner towers
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
    const y = surface(cx, cz) ?? surface(cx * 0.9, cz * 0.9); if (y == null) continue;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, h + 5, 12), m); t.position.set(cx, y + (h + 5) / 2 - 1, cz); t.castShadow = true; g.add(t);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 12), dark); c.position.set(cx, y + h + 4.2, cz); g.add(c);
  }
  return g;
}

export function addBackTown(g, opts = {}) {
  const spec = opts === true ? {} : opts;
  const style = spec.style ?? "town", seed = spec.seed ?? 5;
  const { surf, region } = backSurface(g);
  const plan = planBackTown(region, surf, { style, landmarks: spec.landmarks ?? [], seed, density: spec.density ?? 1, walls: spec.walls ?? null });
  const town = new THREE.Group(); town.name = `backTown:${style}`;
  const litMats = [];
  if (plan.houses.length) { const t = makeTown(plan.houses, { seed, lit: !!spec.lit, trees: plan.trees, lamps: plan.lamps, tex: spec.tex ?? null }); town.add(t); town.userData.houses = t; }
  for (const L of plan.landmarks) town.add(landmarkMesh(L, litMats));
  town.add(towersMesh(plan.towers, { seed, style, litMats }));
  if (plan.wall) town.add(wallMesh(plan.wall, surf));
  // the street: a darker strip down the middle (a few blocks following the surface)
  const st = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.25, 1), std("#8d8478", 0.95), 200); let n = 0;
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let z = region.z0; z < region.z1 && n < 200; z += 2) { const y = surf(0, z); if (y == null) continue; m4.compose(v.set(0, y + 0.02, z + 1), q, s.set(plan.street.half * 2 - 0.6, 1, 2.05)); st.setMatrixAt(n++, m4); }
  st.count = n; st.receiveShadow = true; st.frustumCulled = false; st.instanceMatrix.needsUpdate = true; town.add(st);
  // ride the body joint (metres, root-space rest pose), like page/kit/giants.js buildGiantTown
  const u = g.userData.unit, J = g.userData.joints;
  const holder = new THREE.Group(); holder.name = "backTownHolder"; holder.scale.setScalar(1 / u);
  holder.position.set(0, -J.body.position.y, 0);
  // bodies offset along z / x too (bipeds): undo the body joint's rest offset fully
  holder.position.x = -J.body.position.x; holder.position.z = -J.body.position.z;
  holder.add(town); J.body.add(holder);
  // an asked back town supersedes the kind's own little town (replace: false keeps both)
  if ((spec.replace ?? true) && g.userData.town) g.userData.town.visible = false;
  town.userData.plan = plan;
  town.userData.setLit = (on, k = 1) => { for (const m of litMats) m.emissiveIntensity = on ? 1.8 * k : 0; town.userData.houses?.userData.setLit?.(on, k); };
  town.userData.setLit(!!spec.lit);
  g.userData.backTown = town;
  return town;
}
