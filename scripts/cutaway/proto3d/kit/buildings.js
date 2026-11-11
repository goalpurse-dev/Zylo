// Kit: the building generator (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "buildings"). A "building"
// part is a cut-open building: its front wall taken away so its floors read from the camera, floors stacked with their
// slabs, a back wall with lit windows, side walls, a roof (flat, gable, dome or none), and shafts through the floors:
// an elevator (a car on its cables, a counterweight), an escalator (steps with tread and riser that run), stairs, a
// chimney. It covers a two-storey mall or station, a power station hall, a treatment works building, a factory, a tower.
// Channels: build (the floors rise one by one), lights (the windows glow), lift (the elevator car: 0 its first floor,
// 1 its top floor), run (the escalator steps move). Pure functions first (Node), the builder last.

import { realOr } from "../m2/materials.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const SLAB = 0.25;
export const USE_LOOK = Object.freeze({
  house: { walls: "#efe3cc", floor: "#b98b5a", roof: "#a4553a" }, mall: { walls: "#e9edf0", floor: "#d9d4cb", roof: "#9aa3ab" },
  station: { walls: "#d8dde2", floor: "#c9c3b8", roof: "#8f979f" }, plant: { walls: "#cfd3d6", floor: "#9ea3a6", roof: "#7d858c" },
  factory: { walls: "#c8c2b6", floor: "#8f8a80", roof: "#6f757b" }, tower: { walls: "#f2efe8", floor: "#b0a89c", roof: "#3b3f45" },
});

/** the building's settings with their defaults, and each floor's base height */
export function buildingSpec(p = {}) {
  const use = USE_LOOK[p.use] ? p.use : "station", look = USE_LOOK[use];
  const [x, y, z] = Array.isArray(p.pos) ? p.pos.map(Number) : [0, 0, -1];
  const floors = (Array.isArray(p.floors) && p.floors.length ? p.floors : [{ h: 4 }, { h: 4 }]).map((f) => ({ h: Math.max(2.2, num(f?.h, 4)), color: f?.color ?? look.floor }));
  const bases = []; let acc = y; for (const f of floors) { bases.push(acc); acc += f.h; }
  return {
    use, x, y, z, width: Math.max(2, num(p.width, 14)), depth: Math.max(2, num(p.depth, 6)), floors, bases, top: acc,
    roof: ["flat", "gable", "dome", "none"].includes(p.roof) ? p.roof : "flat", walls: p.walls ?? look.walls, roofColor: p.roofColor ?? look.roof,
    cutaway: p.cutaway === "none" ? "none" : "front", windows: p.windows !== false,
    shafts: (Array.isArray(p.shafts) ? p.shafts : []).map((s) => ({ type: ["elevator", "escalator", "stairs", "chimney"].includes(s?.type) ? s.type : "elevator", x: num(s?.x, 0), w: num(s?.w, s?.type === "escalator" ? 6 : 2.2), from: Math.max(0, Math.round(num(s?.from, 0))), to: Math.round(num(s?.to, floors.length - 1)), z: z + num(s?.z, -num(p.depth, 6) / 2) })) // (a shaft z is from the building front, z: its depth into the building),
  };
}

/**
 * The openings each floor slab needs: an escalator or stairs through the floor it rises to (where the steps come within
 * 2.3 m of its underside: the headroom), an elevator shaft through every floor above its first. [{floor, x0, x1, z0, z1}]
 */
export function slabHoles(s) {
  const out = [];
  for (const sh of s.shafts) {
    const f0 = Math.min(sh.from, s.floors.length - 1), f1 = Math.min(Math.max(sh.to, f0), s.floors.length - 1), sx = s.x + sh.x;
    if (f1 <= f0) continue;
    if (sh.type === "escalator" || sh.type === "stairs") { const rise = s.bases[f1] - s.bases[f0], x0 = sx - sh.w / 2, from = x0 + sh.w * Math.max(0, 1 - 2.3 / rise); out.push({ floor: f1, x0: from, x1: x0 + sh.w + 0.2, z0: sh.z - 0.85, z1: sh.z + 0.85 }); }
    if (sh.type === "elevator") { const d = Math.min(s.depth - 0.6, 2.4), zc = s.z - s.depth + 0.25 + d / 2 + 0.1; for (let i = f0 + 1; i <= f1; i++) out.push({ floor: i, x0: sx - sh.w / 2, x1: sx + sh.w / 2, z0: zc - d / 2, z1: zc + d / 2 }); }
  }
  return out;
}

/** the box the camera frames: the whole building (the roof's height included) */
export function buildingBox(p = {}) {
  const s = buildingSpec(p), roofH = s.roof === "gable" ? s.depth * 0.45 : s.roof === "dome" ? s.width * 0.3 : 0;
  return { min: [s.x - s.width / 2, s.y, s.z - s.depth], max: [s.x + s.width / 2, s.top + roofH, s.z + 0.3] };
}

// ---------------- the page ----------------
export function buildBuilding(ctx, p = {}) {
  const { THREE } = ctx, s = buildingSpec(p), group = new THREE.Group(); ctx.scene.add(group);
  const C = (c) => new THREE.Color(c);
  // (a custom layout's building: plaster walls, cast concrete slabs, a shingle roof on a gable, galvanised steel; m2/materials.js,
  // owner's rule 16 of 2026-11-11)
  const wallM = realOr(ctx, "plaster", s.walls, ctx.std({ color: C(s.walls), roughness: 0.8 })), slabM = realOr(ctx, "concrete", "#9a958c", ctx.std({ color: C("#9a958c"), roughness: 0.85 })), roofM = realOr(ctx, s.roof === "gable" ? "shingles" : "galvanised", s.roofColor, ctx.std({ color: C(s.roofColor), roughness: 0.7 }));
  const glassM = new THREE.MeshStandardMaterial({ color: C("#2c3e50"), emissive: C("#ffd98a"), emissiveIntensity: 0, roughness: 0.15 });
  const metalM = realOr(ctx, "brushed", "#b9c0c7", ctx.std({ color: C("#b9c0c7"), roughness: 0.35, metalness: 0.7 })), darkM = ctx.std({ color: C("#3a3f45"), roughness: 0.5, metalness: 0.4 });
  const box = (m, w, h, d, x, y, z, parent = group) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const W = s.width, D = s.depth, X = s.x, Z = s.z, T = 0.25;
  const holes = slabHoles(s);
  // a floor slab with its openings (an escalator rising through it, an elevator shaft): a shape in x and z, extruded down
  const slab = (m, i, parent) => { const y0 = s.bases[i], sh = new THREE.Shape([[X - W / 2, Z - D], [X + W / 2, Z - D], [X + W / 2, Z], [X - W / 2, Z]].map(([a, b]) => new THREE.Vector2(a, b))); for (const o of holes.filter((q) => q.floor === i)) sh.holes.push(new THREE.Path([[o.x0, o.z0], [o.x0, o.z1], [o.x1, o.z1], [o.x1, o.z0]].map(([a, b]) => new THREE.Vector2(a, b)))); const g = new THREE.ExtrudeGeometry(sh, { depth: SLAB, bevelEnabled: false }); g.rotateX(Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.y = y0 + SLAB; o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  // each floor in its own group, so "build" can raise them one by one
  const floorGroups = s.floors.map((f, i) => {
    const g = new THREE.Group(); group.add(g); const y0 = s.bases[i];
    slab(ctx.std({ color: C(f.color), roughness: 0.75 }), i, g); // the floor slab, with its openings
    box(wallM, W, f.h, T, X, y0 + f.h / 2, Z - D + T / 2, g); // the back wall
    for (const sx of [-1, 1]) box(wallM, T, f.h, D, X + sx * (W / 2 - T / 2), y0 + f.h / 2, Z - D / 2, g); // the side walls
    if (s.cutaway === "none") box(wallM, W, f.h, T, X, y0 + f.h / 2, Z - T / 2, g);
    // windows in the back wall (they glow on "lights")
    if (s.windows) for (let wx = X - W / 2 + 1.6; wx < X + W / 2 - 1; wx += 2.4) box(glassM, 1.3, Math.min(1.5, f.h * 0.4), 0.06, wx, y0 + f.h * 0.58, Z - D + T + 0.04, g);
    return g;
  });
  // the roof
  const topY = s.top;
  if (s.roof === "flat") box(slabM, W + 0.3, SLAB, D + 0.3, X, topY + SLAB / 2, Z - D / 2);
  else if (s.roof === "gable") { const sh = new THREE.Shape(); sh.moveTo(-D / 2 - 0.3, 0); sh.lineTo(0, D * 0.45); sh.lineTo(D / 2 + 0.3, 0); sh.lineTo(-D / 2 - 0.3, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: W + 0.4, bevelEnabled: false }); g.translate(0, 0, -(W + 0.4) / 2); g.rotateY(Math.PI / 2); const r = new THREE.Mesh(g, roofM); r.position.set(X, topY, Z - D / 2); r.castShadow = true; group.add(r); }
  else if (s.roof === "dome") { const g = new THREE.SphereGeometry(Math.min(W, D) / 2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); const r = new THREE.Mesh(g, roofM); r.position.set(X, topY, Z - D / 2); r.castShadow = true; group.add(r); }
  // shafts
  const movers = { cars: [], weights: [], steps: [] };
  for (const sh of s.shafts) {
    const f0 = Math.min(sh.from, s.floors.length - 1), f1 = Math.min(Math.max(sh.to, f0), s.floors.length - 1), y0 = s.bases[f0], y1 = s.bases[f1] + s.floors[f1].h, sx = X + sh.x;
    if (sh.type === "elevator") {
      // the shaft: glass on its front, a frame; the car rides between its floors on cables, the counterweight opposite
      const w = sh.w, d = Math.min(D - 0.6, 2.4), zc = Z - D + T + d / 2 + 0.1;
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) box(darkM, 0.12, y1 - y0, 0.12, sx + ex * w / 2, (y0 + y1) / 2, zc + ez * d / 2);
      const shaftGlass = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, 0.04), new THREE.MeshPhysicalMaterial({ color: C("#bfe3f2"), transparent: true, opacity: 0.18, roughness: 0.05 })); shaftGlass.position.set(sx, (y0 + y1) / 2, zc + d / 2); group.add(shaftGlass);
      box(darkM, w + 0.3, 0.6, d + 0.3, sx, y1 + 0.3, zc); // the machine room on top
      const car = new THREE.Group(); group.add(car);
      box(metalM, w - 0.35, 2.4, d - 0.4, 0, 1.2, 0, car); box(ctx.std({ color: C("#ffe9b0"), emissive: C("#ffe9b0"), emissiveIntensity: 0.4 }), w - 0.6, 0.06, d - 0.6, 0, 2.38, 0, car);
      const cable = box(darkM, 0.05, 1, 0.05, sx - 0.25, 0, zc); const wcable = box(darkM, 0.05, 1, 0.05, sx + w / 2 - 0.2, 0, zc - d / 2 + 0.25);
      const weight = box(darkM, 0.3, 1.4, 0.4, sx + w / 2 - 0.2, 0, zc - d / 2 + 0.25);
      movers.cars.push({ car, cable, wcable, weight, sx, zc, y0: y0 + SLAB, y1: s.bases[f1] + SLAB, top: y1 });
    } else if (sh.type === "escalator" || sh.type === "stairs") {
      // a run of steps from the floor `from` up to the floor `to` (along x, rising to +x): each step a tread and a riser;
      // an escalator's steps travel up its run while it runs, with its side panels and handrails
      const run = sh.w, rise = Math.max(0.5, s.bases[f1] - y0), n = Math.max(6, Math.round(rise / 0.25)), tread = run / n, wd = 1.1, zc = sh.z;
      const stepM = sh.type === "escalator" ? ctx.std({ color: C("#9aa1a8"), roughness: 0.4, metalness: 0.6 }) : slabM, edgeM = ctx.std({ color: C("#ffd23d"), roughness: 0.5 });
      const steps = new THREE.Group(); group.add(steps);
      const one = () => { const g = new THREE.Group(); box(stepM, tread, 0.06, wd, 0, 0, 0, g); box(stepM, 0.05, rise / n, wd, -tread / 2, -rise / n / 2, 0, g); box(edgeM, 0.06, 0.02, wd, tread / 2 - 0.03, 0.035, 0, g); return g; };
      const list = []; for (let i = 0; i < n; i++) { const g = one(); steps.add(g); list.push(g); }
      const x0 = sx - run / 2, yb = y0 + SLAB;
      const place = (u) => list.forEach((g, i) => { const k = ((i + u) % n + n) % n; g.position.set(x0 + (k + 0.5) * tread, yb + (k + 1) * (rise / n), zc); });
      place(0);
      if (sh.type === "escalator") {
        const side = new THREE.MeshPhysicalMaterial({ color: C("#cfe6f0"), transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }) /* (glass balustrades: an opaque panel hid the steps) */, rail = ctx.std({ color: C("#1d1f22"), roughness: 0.4 });
        const L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
        for (const ez of [-1, 1]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(L + 1.2, 0.9, 0.06), side); panel.position.set(sx, yb + rise / 2 + 0.2, zc + ez * (wd / 2 + 0.05)); panel.rotation.z = ang; panel.castShadow = true; group.add(panel);
          const hr = new THREE.Mesh(new THREE.BoxGeometry(L + 1.4, 0.08, 0.1), rail); hr.position.set(sx, yb + rise / 2 + 0.95, zc + ez * (wd / 2 + 0.05)); hr.rotation.z = ang; group.add(hr);
        }
        // the truss under the run
        const truss = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, wd), darkM); truss.position.set(sx, yb + rise / 2 - 0.3, zc); truss.rotation.z = ang; group.add(truss);
        movers.steps.push({ place, n });
      }
    } else if (sh.type === "chimney") {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(sh.w / 2 * 0.8, sh.w / 2, y1 - y0 + 6, 24), ctx.std({ color: C("#b2a59a"), roughness: 0.85 })); c.position.set(sx, (y0 + y1 + 6) / 2, sh.z); c.castShadow = true; group.add(c);
    }
  }
  return {
    group,
    update(t, ch = {}) {
      const b = ch.build == null ? 1 : ch.build, n = floorGroups.length;
      floorGroups.forEach((g, i) => { const k = Math.max(0, Math.min(1, b * n - i)); g.visible = k > 0.02; g.position.y = -(1 - k) * 1.2; });
      glassM.emissiveIntensity = 1.4 * Math.max(0, Math.min(1, ch.lights ?? 0));
      for (const m of movers.cars) {
        const u = Math.max(0, Math.min(1, ch.lift ?? 0)), y = m.y0 + (m.y1 - m.y0) * u;
        m.car.position.set(m.sx, y, m.zc);
        const cl = m.top - (y + 2.4); m.cable.scale.y = Math.max(0.01, cl); m.cable.position.y = y + 2.4 + cl / 2;
        const wy = m.y0 + (m.y1 - m.y0) * (1 - u) + 0.7; m.weight.position.y = wy; const wl = m.top - (wy + 0.7); m.wcable.scale.y = Math.max(0.01, wl); m.wcable.position.y = wy + 0.7 + wl / 2;
      }
      for (const st of movers.steps) st.place((ch.run ?? 0) > 0 ? (t * 1.6) % st.n : 0);
    },
  };
}

// ================= suburban houses and street trees (shapes only; their materials are in kit/backdrops.js) =================
// The owner's rules 5, 6 and 19 of 2026-11-11: a street or yard topic shows a real suburb from the first frame (the
// competitor's storm drain: stucco houses with tiled roofs, white windows with shutters, a door canopy, a chimney, a
// garage, hedges, neighbours along the street), never Kenney's cartoon city. Everything is built from flat faces into a
// few merged meshes (one per material for the whole street), so ten houses cost about the draw calls of one toy shop.
// UVs are in metres / tile, so a plaster or a roof-tile texture tiles at its real size on every house.

/** a seeded random (mulberry32): the suburb never shares the page's random numbers (the parts' stones stay as they are) */
export function seeded(seed) { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** a merged-face builder: quads, triangles and boxes in a stack of (translate, turn about y) frames; pure (Node) until
 * geometry(THREE). Faces are listed counter-clockwise seen from outside; normals are flat per face. */
export function shapeBuilder() {
  const pos = [], nor = [], uv = [], col = [], stack = [{ x: 0, y: 0, z: 0, ry: 0 }];
  const top = () => stack[stack.length - 1];
  const rot = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  const world = (p) => { const f = top(), r = rot(p, f.ry); return [r[0] + f.x, r[1] + f.y, r[2] + f.z]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const rgb = (c) => { if (Array.isArray(c)) return c; const n = parseInt(String(c ?? "#ffffff").replace("#", ""), 16) || 0; const s = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return [s((n >> 16) & 255), s((n >> 8) & 255), s(n & 255)]; };
  const B = {
    count: () => pos.length / 3,
    push(x = 0, y = 0, z = 0, ry = 0) { const f = top(), r = rot([x, y, z], f.ry); stack.push({ x: f.x + r[0], y: f.y + r[1], z: f.z + r[2], ry: f.ry + ry }); return B; },
    pop() { if (stack.length > 1) stack.pop(); return B; },
    /** a flat polygon (3 or 4 points, local), its colour, the texture's tile size in metres */
    poly(pts, c = "#ffffff", tile = 1) {
      const w = pts.map(world), n = unit(cross(sub(w[1], w[0]), sub(w[2], w[0])));
      // (the texture axes: along the first edge's level direction for walls, the slope for roofs, x/z for floors)
      let e1 = Math.abs(n[1]) > 0.95 ? [1, 0, 0] : unit(cross([0, 1, 0], n));
      if (Math.abs(n[1]) <= 0.95 && Math.abs(n[1]) > 0.2) e1 = unit(sub(w[1], w[0]));
      const e2 = unit(cross(n, e1)), k = rgb(c);
      const tris = w.length === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
      for (const t of tris) for (const i of t) { pos.push(...w[i]); nor.push(...n); uv.push(dot(w[i], e1) / tile, dot(w[i], e2) / tile); col.push(...k); }
      return B;
    },
    /** a box (centre, size), all six faces unless `skip` names some ("-y" for one standing on the ground) */
    box(cx, cy, cz, sx, sy, sz, c, tile = 1, skip = "") {
      const x = sx / 2, y = sy / 2, z = sz / 2, P = (a, b, d) => [cx + a, cy + b, cz + d];
      const F = { "+x": [P(x, -y, z), P(x, -y, -z), P(x, y, -z), P(x, y, z)], "-x": [P(-x, -y, -z), P(-x, -y, z), P(-x, y, z), P(-x, y, -z)], "+z": [P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z)], "-z": [P(x, -y, -z), P(-x, -y, -z), P(-x, y, -z), P(x, y, -z)], "+y": [P(-x, y, z), P(x, y, z), P(x, y, -z), P(-x, y, -z)], "-y": [P(-x, -y, -z), P(x, -y, -z), P(x, -y, z), P(-x, -y, z)] };
      for (const [k, f] of Object.entries(F)) if (!skip.includes(k)) B.poly(f, c, tile);
      return B;
    },
    arrays: () => ({ pos, nor, uv, col }),
    /** a BufferGeometry of everything added (null when empty) */
    geometry(THREE) {
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    },
  };
  return B;
}

// the competitor's suburb palette: warm stucco, terracotta or slate roofs, muted shutters (never toy colours)
export const SUBURB_LOOK = Object.freeze({
  walls: ["#efe5d3", "#f2ece0", "#e8dcc6", "#f0e2cb", "#e4ddd0", "#ead8c0"],
  roofs: ["#b4553a", "#a44a33", "#b8603f", "#6b6662", "#9b4a36"],
  shutters: ["#4d6a86", "#5f6f62", "#56606b", "#7a5a44", "#3f5670", "#eae6dc"],
  doors: ["#5a3a28", "#3d4b5c", "#6b2f2a", "#41503f"],
});
/** one house's look and size from a seed (pure): width, depth, storeys, roof (gable | hip), colours, garage, chimney */
export function houseSpec(seed, over = {}) {
  const r = seeded(seed * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length) % a.length];
  return {
    w: 8.4 + Math.round(r() * 4) * 0.6, d: 6.4 + Math.round(r() * 3) * 0.5, storeys: r() < 0.72 ? 2 : 1, roof: r() < 0.55 ? "hip" : "gable",
    wall: pick(SUBURB_LOOK.walls), roofColor: pick(SUBURB_LOOK.roofs), shutter: pick(SUBURB_LOOK.shutters), door: pick(SUBURB_LOOK.doors),
    garage: r() < 0.5 ? (r() < 0.5 ? -1 : 1) : 0, chimney: r() < 0.6, hedge: r() < 0.8, canopy: r() < 0.7, ...over,
  };
}
/** the house's footprint half-sizes in its own frame (with its garage and front garden): for keeping lots apart */
export function houseFootprint(h) { const gw = h.garage ? 3.6 : 0; return { x0: -h.w / 2 - (h.garage < 0 ? gw : 0) - 0.6, x1: h.w / 2 + (h.garage > 0 ? gw : 0) + 0.6, z0: -h.d / 2 - 0.6, z1: h.d / 2 + (h.hedge ? 3.9 : 0.8) }; }

/** a house's faces into the material builders M { wall, roof, trim, glass, paint, base, hedge }, its front facing local
 * +z, standing at (x, 0, z) turned rotY. Ground floor windows, an upper floor, a gable or hip roof with its eaves
 * meeting the wall line, a door with a canopy, shutters, a garage wing, a chimney, a hedge with a path through it. */
export function houseShapes(M, h, { x = 0, z = 0, rotY = 0, y = 0 } = {}) {
  const STOREY = 2.9, PLINTH = 0.35, H = PLINTH + STOREY * h.storeys, k = 0.68, o = 0.45, { w, d } = h;
  for (const b of new Set(Object.values(M))) b.push(x, y, z, rotY);
  // plinth and walls
  M.base.box(0, PLINTH / 2, 0, w + 0.14, PLINTH, d + 0.14, "#9a958c", 1.2, "-y");
  M.wall.box(0, PLINTH + (H - PLINTH) / 2, 0, w, H - PLINTH, d, h.wall, 1.6, "-y+y");
  // the roof: eaves at the wall line meet the wall top; the ridge along x
  roofShapes(M, { w, d, H, k, o, type: h.roof, color: h.roofColor, wall: h.wall });
  // windows, shutters and sills on every side (a camera may stand anywhere round a neighbour)
  const win = (u, v, ww = 1.1, hh = 1.35, shut = true) => {
    M.trim.box(u, v, 0.05, ww + 0.2, hh + 0.2, 0.1, "#f4f2ec", 1);
    M.glass.box(u, v, 0.075, ww, hh, 0.06, "#ffffff", 1);
    M.trim.box(u, v, 0.11, 0.06, hh, 0.03, "#f4f2ec", 1); M.trim.box(u, v + hh * 0.12, 0.11, ww, 0.05, 0.03, "#f4f2ec", 1);
    M.trim.box(u, v - hh / 2 - 0.13, 0.12, ww + 0.36, 0.08, 0.24, "#ece8de", 1);
    if (shut && h.shutter) for (const s of [-1, 1]) M.paint.box(u + s * (ww / 2 + 0.33), v, 0.06, 0.48, hh + 0.12, 0.06, h.shutter, 1);
  };
  const face = (fx, fz, ry, len, fn) => { for (const b of new Set(Object.values(M))) b.push(fx, 0, fz, ry); fn(len); for (const b of new Set(Object.values(M))) b.pop(); };
  const rows = Array.from({ length: h.storeys }, (_, i) => PLINTH + STOREY * i + 1.55);
  const cols = (len) => { const n = Math.max(2, Math.round((len - 1.2) / 2.6)); return Array.from({ length: n }, (_, i) => -len / 2 + (len / n) * (i + 0.5)); };
  // front: the door in the middle (a canopy over it), windows either side; the upper floor's windows over all
  face(0, d / 2, 0, w, (len) => {
    const cs = cols(len), mid = cs.reduce((a, c) => (Math.abs(c) < Math.abs(a) ? c : a), cs[0]);
    cs.forEach((c) => { if (c !== mid) win(c, rows[0]); });
    M.trim.box(mid, PLINTH + 1.15, 0.05, 1.35, 2.35, 0.1, "#f4f2ec", 1); M.paint.box(mid, PLINTH + 1.1, 0.09, 1.05, 2.2, 0.06, h.door, 1);
    M.trim.box(mid + 0.32, PLINTH + 1.1, 0.13, 0.06, 0.06, 0.06, "#c9b27a", 1);
    if (h.canopy) { M.roof.push(mid, PLINTH + 2.5, 0.85); roofShapes(M, { w: 1.9, d: 1.6, H: 0, k: 0.55, o: 0.15, type: "lean", color: h.roofColor, wall: "#f4f2ec" }); M.roof.pop(); M.base.box(mid, PLINTH / 2 - 0.05, 0.9, 1.9, 0.25, 1.6, "#a9a49b", 1.2); }
    for (const v of rows.slice(1)) cs.forEach((c) => win(c, v));
  });
  face(0, -d / 2, Math.PI, w, (len) => { for (const v of rows) cols(len).forEach((c) => win(c, v)); });
  for (const s of [-1, 1]) face(s * w / 2, 0, s * Math.PI / 2, d, (len) => { for (const v of rows) win(0, v, 0.9, 1.2, false); if (len > 7) for (const v of rows) win(len / 2 - 1.2, v, 0.7, 1.0, false); });
  // eave trim (white fascia under the roof edge)
  for (const s of [-1, 1]) M.trim.box(0, H - 0.08, s * (d / 2 + 0.02), w + 0.1, 0.16, 0.06, "#f4f2ec", 1);
  // the garage wing: one storey, a white sectional door, its own lower roof
  if (h.garage) {
    const gw = 3.6, gd = d - 1.2, gx = h.garage * (w / 2 + gw / 2), gz = 0.6, gh = PLINTH + 2.9;
    M.base.box(gx, PLINTH / 2, gz, gw + 0.1, PLINTH, gd + 0.1, "#9a958c", 1.2, "-y");
    M.wall.box(gx, PLINTH + (gh - PLINTH) / 2, gz, gw, gh - PLINTH, gd, h.wall, 1.6, "-y+y");
    for (const b of new Set(Object.values(M))) b.push(gx, 0, gz, 0);
    roofShapes(M, { w: gw, d: gd, H: gh, k: 0.5, o: 0.35, type: "gable", color: h.roofColor, wall: h.wall });
    M.trim.box(0, 1.25, gd / 2 + 0.05, 2.9, 2.3, 0.08, "#efede6", 1);
    for (let i = 1; i < 5; i++) M.base.box(0, 0.2 + i * 0.44, gd / 2 + 0.1, 2.8, 0.03, 0.02, "#c9c6be", 1);
    M.base.box(0, 0.03, gd / 2 + 2.6, 3.0, 0.06, 5.0, "#b3aea4", 1.4); // the driveway
    for (const b of new Set(Object.values(M))) b.pop();
  }
  // the chimney (brick-coloured render) through the roof's back slope
  if (h.chimney) M.base.box(w * 0.22, H + d * 0.25 * k + 0.5, -d * 0.18, 0.75, d * 0.5 * k + 1.4, 0.75, "#8a5e4a", 1);
  // the front garden: a trimmed hedge along the lot's front with a gap for the path, the path to the door
  if (h.hedge) {
    const hz = d / 2 + 3.3, half = (w + 1.6) / 2;
    for (const [a, b] of [[-half, -0.8], [0.8, half]]) M.hedge.box((a + b) / 2, 0.55, hz, b - a, 1.1, 0.75, "#5d7f3e", 1.5, "-y");
    M.base.box(0, 0.025, d / 2 + 1.7, 1.2, 0.05, 3.4, "#c8c2b6", 1.2, "-y");
  }
  for (const b of new Set(Object.values(M))) b.pop();
}
/** a roof over a w x d box: "gable" (ridge along x, the gable ends in the wall colour), "hip" (four slopes) or "lean"
 * (one slope down toward +z: a door canopy). H: the wall top; k: the slope (rise per run); o: the overhang */
export function roofShapes(M, { w, d, H, k, o, type, color, wall }) {
  const R = M.roof, W2 = w / 2 + o, D2 = d / 2 + o, base = H - o * k, top = base + D2 * k, T = 0.12, tile = 2.2;
  const slope = (pts) => { R.poly(pts, color, tile); R.poly(pts.map((p) => [p[0], p[1] - T, p[2]]).reverse(), "#d9d3c7", tile); };
  if (type === "lean") { slope([[-W2, H, D2], [W2, H, D2], [W2, H + D2 * k, -D2], [-W2, H + D2 * k, -D2]]); return; }
  if (type === "hip" && w > d) {
    const rx = W2 - D2;
    slope([[-W2, base, D2], [W2, base, D2], [rx, top, 0], [-rx, top, 0]]);
    slope([[W2, base, -D2], [-W2, base, -D2], [-rx, top, 0], [rx, top, 0]]);
    slope([[W2, base, D2], [W2, base, -D2], [rx, top, 0]]);
    slope([[-W2, base, -D2], [-W2, base, D2], [-rx, top, 0]]);
  } else {
    slope([[-W2, base, D2], [W2, base, D2], [W2, top, 0], [-W2, top, 0]]);
    slope([[W2, base, -D2], [-W2, base, -D2], [-W2, top, 0], [W2, top, 0]]);
    // the gable ends (the wall's plaster up to the ridge) and the verge boards
    const gt = H + (d / 2) * k;
    M.wall.poly([[-w / 2, H, -d / 2], [-w / 2, H, d / 2], [-w / 2, gt, 0]], wall, 1.6);
    M.wall.poly([[w / 2, H, d / 2], [w / 2, H, -d / 2], [w / 2, gt, 0]], wall, 1.6);
  }
  // the ridge cap
  R.box(0, top + 0.03, 0, type === "hip" && w > d ? 2 * (W2 - D2) + 0.1 : 2 * W2, 0.1, 0.22, color, tile);
}
/** a street tree's crown blobs (pure): [{ at: [x, y, z] (from the trunk top), r }]; s scales the tree */
export function treeBlobs(seed, s = 1) {
  const r = seeded(seed * 104729 + 7), n = 7 + Math.floor(r() * 4), out = [{ at: [0, 1.2 * s, 0], r: 1.7 * s }];
  for (let i = 1; i < n; i++) { const a = r() * Math.PI * 2, rr = (0.9 + r() * 0.9) * s; out.push({ at: [Math.cos(a) * rr, (0.4 + r() * 1.9) * s, Math.sin(a) * rr], r: (0.95 + r() * 0.6) * s }); }
  return out;
}
