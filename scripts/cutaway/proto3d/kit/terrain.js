// Kit: the terrain generator (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3). A "terrain" part replaces the
// yard's fixed ground (real.js: a flat lawn with one box cut) with ground made from blocks laid left to right: flat,
// hill, mountain (with a crater and a magma chamber), cliff, gorge, coast, riverbed, pit (today's cut, several allowed)
// and tunnel (a bore seen in section). The cut face z = 0 follows the surface, so a cliff, a gorge or a volcano reads in
// section; the soil bands follow the surface too.
// Units are metres; y is up; the camera looks at the face z = 0 from +z. The part's surface at (x, z) is terrainModel().h.
// Pure functions first (Node: the camera's boxes, the checks, the tests), the three.js builder last (the page).

import { realOr } from "../m2/materials.js";

export const WORLD = Object.freeze({ X: 24, D: 18, BOTTOM: -26, FAR: 90 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * The terrain of a part's params ({blocks: [...]}): h(x, z) the surface height, top(x) the cut face's top edge (the
 * surface at z = 0 less the pits that open on the face), holes (tunnels and chambers in the face), sea and beach x
 * ranges, rocky x ranges, its box, and the depth the surface grid needs (a mountain reaches back further).
 */
export function terrainModel(params = {}) {
  const blocks = Array.isArray(params.blocks) ? params.blocks : [];
  const line = [], radial = [], pits = [], tunnels = [], chambers = [], rocky = [], sandy = [], rockZones = [];
  for (const b of blocks) {
    const t = b?.type;
    // (a block that reaches the world's edge goes on past it: no drop at x = +-24)
    const edge = (v, d) => { const n = num(v, d); return n <= -WORLD.X + 0.5 ? -1e9 : n >= WORLD.X - 0.5 ? 1e9 : n; };
    if (t === "flat") line.push((x, y) => (x >= edge(b.x0, -1e9) && x <= edge(b.x1, 1e9) ? num(b.y, 0) : y));
    else if (t === "cliff") {
      const at = num(b.at, 0), top = num(b.top, 6), bot = num(b.bottom, 0), high = b.high === "right" ? 1 : -1, w = num(b.width, 1.4);
      line.push((x) => (high < 0 ? bot + (top - bot) * (1 - smooth(at - w / 2, at + w / 2, x)) : bot + (top - bot) * smooth(at - w / 2, at + w / 2, x)));
      if (b.face !== "earth") rocky.push([at - w, at + w]);
    } else if (t === "gorge") {
      const x0 = num(b.x0, -4), x1 = num(b.x1, 4), d = num(b.depth, 10), w = Math.min(num(b.wall, 1.6), (x1 - x0) / 3);
      line.push((x, y) => (x <= x0 || x >= x1 ? y : y - d * smooth(x0, x0 + w, x) * (1 - smooth(x1 - w, x1, x))));
      if (b.walls !== "earth") rocky.push([x0 - 0.3, x0 + w + 0.3], [x1 - w - 0.3, x1 + 0.3]);
      sandy.push([x0 + w * 0.6, x1 - w * 0.6]);
    } else if (t === "coast") {
      const at = num(b.at, 0), sea = b.sea === "right" ? 1 : -1, beach = num(b.beach, 5), depth = num(b.depth, 8);
      // land at its own height, a beach falling 1.2 m over its width, then the seabed shelving down to depth
      line.push((x, y) => { const s = sea * (x - at); if (s <= 0) return y; if (s <= beach) return y - 1.2 * smooth(0, beach, s); return y - 1.2 - (depth - 1.2) * smooth(beach, beach + 6, s); });
      // (the beach and the whole seabed beyond it: sand, never lawn under the sea)
      sandy.push(sea < 0 ? [-1e4, at + 0.5] : [at - 0.5, 1e4]);
    } else if (t === "riverbed") {
      const x0 = num(b.x0, -3), x1 = num(b.x1, 3), d = num(b.depth, 2.5), c = (x0 + x1) / 2, hw = (x1 - x0) / 2;
      line.push((x, y) => (x <= x0 || x >= x1 ? y : y - d * (1 - ((x - c) / hw) ** 4)));
      sandy.push([x0 + 0.3, x1 - 0.3]);
    } else if (t === "hill" || t === "mountain") {
      const at = num(b.at, 0), z = num(b.z, t === "mountain" ? 0 : -6), H = num(b.height, t === "mountain" ? 12 : 3), R = num(b.width, t === "mountain" ? 22 : 10) / 2;
      const crater = b.crater ? { r: num(b.crater.r, R * 0.18), d: num(b.crater.depth, H * 0.18) } : null;
      radial.push((x, zz) => {
        const r = Math.hypot(x - at, zz - z);
        if (r >= R) return 0;
        // a hill is a soft bump; a mountain a cone with a rounded foot (and its crater a bowl in the top)
        let h = t === "hill" ? H * 0.5 * (1 + Math.cos(Math.PI * r / R)) : H * (1 - r / R) ** 1.15 * smooth(R, R * 0.82, r);
        // (a crater: a bowl cut into the top, its rim at the cone height at the crater radius, its floor depth below the rim)
        if (crater && r < crater.r) { const rim = H * (1 - crater.r / R) ** 1.15; h = Math.min(h, rim - crater.d * (1 - (r / crater.r) ** 2)); }
        return h;
      });
      if (t === "mountain") { rockZones.push({ at, z, r: R * 0.78 }); if (b.chamber) chambers.push({ x: at + num(b.chamber.dx, 0), y: num(b.chamber.y, -6), rx: num(b.chamber.rx, R * 0.25), ry: num(b.chamber.ry, 2.5), color: b.chamber.color ?? "#ff5a1a", vent: b.chamber.vent !== false, top: H - (crater?.d ?? 0) }); }
    } else if (t === "pit") pits.push({ x0: num(b.x0, -3), x1: num(b.x1, 3), z0: num(b.z0, -6), depth: num(b.depth, 4) });
    else if (t === "tunnel") tunnels.push({ x0: num(b.x0, -6), x1: num(b.x1, 6), y: num(b.y, -6), r: num(b.r, 1.6), lining: b.lining !== false });
  }
  const base = (x) => line.reduce((y, f) => f(x, y), 0);
  const h = (x, z) => base(x) + radial.reduce((s, f) => s + f(x, z), 0);
  const inPit = (x, z) => pits.some((p) => x > p.x0 && x < p.x1 && z > p.z0);
  // the face's top edge: the surface at z = 0, down to a pit's floor where the pit opens on the face
  const top = (x) => { let y = h(x, 0); for (const p of pits) if (x > p.x0 && x < p.x1) y = Math.min(y, h(x, 0) - p.depth); return y; };
  const holes = [...tunnels.map((t) => ({ type: "tunnel", ...t })), ...chambers.map((c) => ({ type: "chamber", ...c }))];
  // a chamber's vent: a slot in the face from the chamber's top up to just under the crater floor (seen in section)
  for (const c of chambers) if (c.vent) { const y0 = c.y + c.ry + 0.04, y1 = h(c.x, 0) - 0.12; if (y1 - y0 > 0.6) holes.push({ type: "tunnel", x0: c.x - 0.45, x1: c.x + 0.45, y: (y0 + y1) / 2, r: (y1 - y0) / 2, vent: true, color: c.color }); }
  // rock: steep cliffs and gorge walls (x ranges) and the upper slopes of a mountain
  const rockAt = (x, z) => rockZones.some((m) => Math.hypot(x - m.at, z - m.z) < m.r);
  // the grid reaches back as far as a mountain or a hill does
  const deep = Math.max(WORLD.D, ...blocks.filter((b) => b?.type === "mountain" || b?.type === "hill").map((b) => Math.abs(num(b.z, 0)) + num(b.width, 22) / 2 + 2));
  const inside = (x, y) => y < top(x) && !holes.some((o) => (o.type === "tunnel" ? x > o.x0 && x < o.x1 && Math.abs(y - o.y) < o.r : ((x - o.x) / o.rx) ** 2 + ((y - o.y) / o.ry) ** 2 < 1));
  return { blocks, h, top, base, pits, tunnels, chambers, holes, rocky, sandy, deep, inside, inPit, rockAt };
}

/** the box the camera frames for a terrain: the face section from its lowest feature up to its highest point */
export function terrainBox(params = {}) {
  const T = terrainModel(params), X = WORLD.X;
  let lo = 0, hi = 0, x0 = -X, x1 = X;
  for (let x = -X; x <= X; x += 0.5) { lo = Math.min(lo, T.top(x)); hi = Math.max(hi, T.h(x, 0), T.h(x, -6)); }
  for (const o of T.holes) lo = Math.min(lo, o.type === "tunnel" ? o.y - o.r : o.y - o.ry);
  // a terrain that is mostly flat frames its interesting stretch: where it leaves y = 0
  const xs = []; for (let x = -X; x <= X; x += 0.5) if (Math.abs(T.h(x, 0)) > 0.3 || T.top(x) < -0.3) xs.push(x);
  if (xs.length) { x0 = Math.max(-X, Math.min(...xs) - 2); x1 = Math.min(X, Math.max(...xs) + 2); }
  return { min: [x0, lo - 0.5, -6], max: [x1, hi + 0.5, 0.2] };
}

// ---------------- the page: three.js meshes ----------------
const range = (a, b, s) => { const o = []; for (let v = a; v < b - 1e-6; v += s) o.push(+v.toFixed(4)); o.push(b); return o; };
const merge = (...a) => [...new Set(a.flat().map((v) => +v.toFixed(4)))].sort((p, q) => p - q);

/**
 * Builds the terrain in the page (makePage calls it before the parts, in place of the yard's ground): the surface (grass,
 * rock on steep or rocky ground, sand on beaches and riverbeds), the cut face with its holes, pit walls and floors,
 * tunnel linings, magma chambers, stones in the face, trees on the grass. ctx: the page's objects (THREE, scene, tex,
 * soilM, grassM, std, P, rnd). Returns { group, model, chamberMats, update(t, k) }.
 */
export function buildTerrain(ctx, params = {}) {
  const { THREE, scene, rnd } = ctx, T = terrainModel(params), { X, BOTTOM, FAR } = WORLD;
  const group = new THREE.Group(); scene.add(group);
  const isIn = (x, list) => list.some(([a, b]) => x >= a && x <= b);
  // ---- the surface: a height grid, fine near the face, coarse far away; skipped inside pits
  const xs = merge(range(-FAR, -X, 3), range(-X, X, 0.25), range(X, FAR, 3), ...T.pits.map((p) => [p.x0, p.x1]));
  const zs = merge(range(-FAR, -T.deep, 3), range(-T.deep, 0, 0.25), ...T.pits.map((p) => [p.z0]));
  const pos = [], uv = [], rock = [], sand = [], idx = [], id = new Map();
  const slope = (x, z) => { const e = 0.3; return Math.hypot(T.h(x + e, z) - T.h(x - e, z), T.h(x, z + e) - T.h(x, z - e)) / (2 * e); };
  const vid = (i, j) => {
    const k = i * 100000 + j;
    if (!id.has(k)) {
      const x = xs[i], z = zs[j], y = T.h(x, z);
      id.set(k, pos.length / 3); pos.push(x, y, z); uv.push(x / 4, z / 4);
      const s = slope(x, z);
      rock.push(Math.max(clamp((s - 0.75) / 0.5, 0, 1), isIn(x, T.rocky) && s > 0.35 ? 1 : 0, T.rockAt(x, z) ? 1 : 0));
      sand.push(isIn(x, T.sandy) ? 1 : 0); // (a bed under water is sand even on its steep banks; rock still wins where rocky)
    }
    return id.get(k);
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (T.inPit(cx, cz)) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1); idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aRock", new THREE.Float32BufferAttribute(rock, 1)); g.setAttribute("aSand", new THREE.Float32BufferAttribute(sand, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const top = new THREE.Mesh(g, surfaceMaterial(ctx)); top.receiveShadow = true; group.add(top);

  // ---- the cut face: the soil section under the surface, with its holes (tunnels, chambers)
  // (a grid whose columns run from the bottom up to the face's top edge, so the edge is exact; cells inside a hole are
  // left out and the vertices near a hole snap onto its edge, so a chamber stays round. A triangulated outline with
  // holes broke on the chamber and its vent: a triangle covered half the chamber, 2026-11-08)
  const fg = faceGrid(THREE, T);
  const soilM = faceMaterial(ctx, T);
  const face = new THREE.Mesh(fg, soilM); face.receiveShadow = true; group.add(face);

  // ---- pits: back wall, side walls and floor, from the floor up to the surface
  const wall = (pts) => { const gg = new THREE.BufferGeometry(); const P2 = [], I = [], U = []; pts.forEach(([a, b], k) => { P2.push(...a, ...b); U.push(a[0] / 4 + a[2] / 4, a[1] / 4, b[0] / 4 + b[2] / 4, b[1] / 4); if (k) { const n = k * 2; I.push(n - 2, n - 1, n, n - 1, n + 1, n); } }); gg.setAttribute("position", new THREE.Float32BufferAttribute(P2, 3)); gg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); gg.setIndex(I); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, soilM); m.material.side = THREE.DoubleSide; m.receiveShadow = true; group.add(m); return m; };
  for (const p of T.pits) {
    const floorY = (x, z) => T.h(x, z) - p.depth;
    wall(range(p.x0, p.x1, 0.25).map((x) => [[x, floorY(x, p.z0), p.z0], [x, T.h(x, p.z0), p.z0]]));
    for (const x of [p.x0, p.x1]) wall(range(p.z0, 0, 0.25).map((z) => [[x, floorY(x, z), z], [x, T.h(x, z), z]]));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, -p.z0), soilM); fl.rotation.x = -Math.PI / 2; fl.position.set((p.x0 + p.x1) / 2, floorY((p.x0 + p.x1) / 2, p.z0 / 2) + 0.01, p.z0 / 2); fl.receiveShadow = true; group.add(fl);
  }
  // ---- tunnels: a lined half-bore behind the face (concrete rings), its floor flat
  // (a custom layout's tunnel lining and rings are cast concrete, m2/materials.js, 2026-11-11)
  const lining = realOr(ctx, "concrete", "#8e897f", ctx.std({ color: new THREE.Color("#8e897f"), roughness: 0.9, side: THREE.BackSide }), true); lining.side = THREE.BackSide;
  const ringM = realOr(ctx, "concrete", "#7d786f", ctx.std({ color: new THREE.Color("#7d786f"), roughness: 0.8 }));
  for (const t of T.tunnels.filter((q) => !q.vent)) {
    const L = t.x1 - t.x0, cg = new THREE.CylinderGeometry(t.r, t.r, L, 32, 1, true, Math.PI, Math.PI); cg.rotateZ(Math.PI / 2); cg.rotateX(Math.PI / 2); // (the back half, z <= 0: the face cuts the front half away)
    const bore = new THREE.Mesh(cg, t.lining ? lining : soilM); bore.position.set((t.x0 + t.x1) / 2, t.y, 0); bore.receiveShadow = true; group.add(bore);
    if (t.lining) for (let x = t.x0 + 0.6; x < t.x1; x += 1.8) { const rg = new THREE.TorusGeometry(t.r - 0.04, 0.07, 6, 24, Math.PI); rg.rotateY(Math.PI / 2); rg.rotateX(-Math.PI / 2); const r = new THREE.Mesh(rg, ringM); r.position.set(x, t.y, 0); group.add(r); }
    // a rim round the bore on the face (it hides the face grid's stepped edge)
    for (const [w, h, x, y] of [[t.x1 - t.x0 + 0.4, 0.22, (t.x0 + t.x1) / 2, t.y + t.r + 0.08], [t.x1 - t.x0 + 0.4, 0.22, (t.x0 + t.x1) / 2, t.y - t.r - 0.08], [0.22, 2 * t.r + 0.4, t.x0 - 0.08, t.y], [0.22, 2 * t.r + 0.4, t.x1 + 0.08, t.y]]) {
      if (x < -WORLD.X || x > WORLD.X) continue;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), ringM); rim.position.set(Math.max(-WORLD.X, Math.min(WORLD.X, x)), y, 0.03); rim.castShadow = true; group.add(rim);
    }
  }
  // ---- magma chambers: a glowing half-shell behind the face, and a vent up to the crater
  const chamberMats = [];
  for (const c of T.chambers) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.color), emissive: new THREE.Color(c.color), emissiveIntensity: 1.2, roughness: 0.6, side: THREE.BackSide });
    chamberMats.push(m);
    const sg = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI); const sh = new THREE.Mesh(sg, m); sh.scale.set(c.rx, c.ry, Math.min(c.rx, 3)); sh.position.set(c.x, c.y, 0); group.add(sh);
    // (the face cut at z = 0 shows the front half open; the back half is the lit shell)
    for (const v of T.holes.filter((o) => o.vent && Math.abs((o.x0 + o.x1) / 2 - c.x) < 0.01)) { const vb = new THREE.Mesh(new THREE.BoxGeometry(v.x1 - v.x0, 2 * v.r + 0.2, 0.9), m); vb.position.set((v.x0 + v.x1) / 2, v.y, -0.45); group.add(vb); }
    // a dark crust ring round the chamber on the face (it hides the face grid's stepped edge)
    { const k = 0.28 / Math.min(c.rx, c.ry), rg = new THREE.RingGeometry(1, 1 + k, 72); const ring = new THREE.Mesh(rg, ctx.std({ color: new THREE.Color("#3b1d12"), roughness: 0.9 })); ring.scale.set(c.rx, c.ry, 1); ring.position.set(c.x, c.y, 0.02); group.add(ring); }
    const light = new THREE.PointLight(new THREE.Color(c.color), 40, Math.max(c.rx, c.ry) * 4, 1.6); light.position.set(c.x, c.y, 0.8); group.add(light); m.userData.light = light;
  }
  // ---- stones and roots in the face (inside the soil, never in a hole or the air)
  {
    const rockM = ctx.PBR ? ctx.PBR("dark_rock", 0.5, { color: new THREE.Color("#b9b2a6") }) : ctx.std({ color: new THREE.Color("#8a8278"), roughness: 0.8 });
    const rg = new THREE.IcosahedronGeometry(0.5, 2), n = 140, im = new THREE.InstancedMesh(rg, rockM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let k = 0;
    for (let tries = 0; k < n && tries < 4000; tries++) {
      const x = (rnd() - 0.5) * 2 * X, y = BOTTOM + 1 + rnd() * (40);
      if (!T.inside(x, y) || y > T.top(x) - 0.8 || T.holes.some((o) => (o.type === "tunnel" ? x > o.x0 - 0.6 && x < o.x1 + 0.6 && Math.abs(y - o.y) < o.r + 0.6 : ((x - o.x) / (o.rx + 0.6)) ** 2 + ((y - o.y) / (o.ry + 0.6)) ** 2 < 1))) continue;
      const sc = 0.12 + rnd() ** 2 * 0.45; m4.compose(v.set(x, y, -sc * 0.15), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), s.set(sc, sc * 0.75, sc * 0.6)); im.setMatrixAt(k++, m4);
    }
    im.count = k; im.castShadow = im.receiveShadow = true; group.add(im);
  }
  // ---- trees on the grass: params.trees [[x, z, scale?]] (they stand on the surface)
  if (Array.isArray(params.trees) && ctx.P) for (const [x, z, sc = 1] of params.trees) {
    const y = T.h(x, z), t = new THREE.Group(); t.position.set(x, y, z); group.add(t);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * sc, 0.34 * sc, 3.2 * sc, 10), ctx.P.trunk); trunk.position.y = 1.6 * sc; trunk.castShadow = true; t.add(trunk);
    for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 + rnd() * 0.6) * sc, 2), i % 2 ? ctx.P.leaf : ctx.P.leaf2); const a = rnd() * 6.28, r = rnd() * 1.4 * sc; l.position.set(Math.cos(a) * r, (4.0 + rnd() * 1.6) * sc, Math.sin(a) * r); l.castShadow = true; t.add(l); (ctx.leaves ??= []).push(l); }
  }
  // the chambers glow (k: 0..1 more on an "erupt" or "glow" verb) and flicker
  const update = (t, k = 0) => { for (const m of chamberMats) { const f = 1 + 0.12 * Math.sin(t * 7) + 0.08 * Math.sin(t * 13.3); m.emissiveIntensity = (0.9 + 1.6 * k) * f; if (m.userData.light) m.userData.light.intensity = (30 + 60 * k) * f; } };
  return { group, model: T, chamberMats, update };
}

/**
 * The surface the soil bands are measured from, N samples over x in [-X, X]: the face's surface with its narrow valleys
 * filled in (a closing, radius 8 m: a gorge, a riverbed or a pit cuts THROUGH the layers, as a real one does), while a
 * mountain or a cliff keeps its shape (the bands arch under a volcano).
 */
export function bandSurface(T, N = 512, radius = 8) {
  const X = WORLD.X, xs = Array.from({ length: N }, (_, i) => -X + (2 * X * i) / (N - 1)), h = xs.map((x) => T.h(x, 0));
  const k = Math.round((radius / (2 * X)) * (N - 1));
  const win = (a, f) => a.map((_, i) => { let v = a[i]; for (let j = Math.max(0, i - k); j <= Math.min(N - 1, i + k); j++) v = f(v, a[j]); return v; });
  return win(win(h, Math.max), Math.min);
}

/** the nearest point on a hole's edge (an ellipse, or a tunnel's rectangle) */
export function holeEdge(o, x, y) {
  if (o.type === "tunnel") {
    const d = [[x - o.x0, [o.x0, y]], [o.x1 - x, [o.x1, y]], [y - (o.y - o.r), [x, o.y - o.r]], [o.y + o.r - y, [x, o.y + o.r]]].map(([dd, p]) => [Math.abs(dd), p]).sort((a, b) => a[0] - b[0]);
    const [px, py] = d[0][1]; return [clamp(px, o.x0, o.x1), clamp(py, o.y - o.r, o.y + o.r)];
  }
  const u = (x - o.x) / o.rx, v = (y - o.y) / o.ry, k = Math.hypot(u, v) || 1;
  return [o.x + (u / k) * o.rx, o.y + (v / k) * o.ry];
}
const inHole = (o, x, y) => (o.type === "tunnel" ? x > o.x0 && x < o.x1 && Math.abs(y - o.y) < o.r : ((x - o.x) / o.rx) ** 2 + ((y - o.y) / o.ry) ** 2 < 1);

/** the face's geometry (z = 0): columns from BOTTOM up to the top edge, cells in holes dropped, vertices snapped to holes */
export function faceGrid(THREE, T, step = 0.2) {
  const { X, BOTTOM } = WORLD;
  const xs = merge(range(-X, X, step), ...T.pits.map((p) => [p.x0, p.x1]), ...T.holes.flatMap((o) => (o.type === "tunnel" ? [o.x0, o.x1] : [o.x - o.rx, o.x + o.rx])));
  const tops = xs.map((x) => T.top(x)), maxH = Math.max(...tops) - BOTTOM, rows = Math.ceil(maxH / step);
  const pos = [], uv = [], idx = [], id = new Map();
  // the vertex at column i, row j (row 0 the bottom, row `rows` the top edge), snapped onto a hole's edge when close
  const vert = (i, j) => {
    const k = i * 100000 + j;
    if (id.has(k)) return id.get(k);
    const x = xs[i], y = BOTTOM + ((tops[i] - BOTTOM) * j) / rows;
    let px = x, py = y;
    for (const o of T.holes) { const [ex, ey] = holeEdge(o, x, y); if (Math.hypot(ex - x, ey - y) < step * 0.75) { px = ex; py = ey; } }
    id.set(k, pos.length / 3); pos.push(px, py, 0); uv.push(px / 4, py / 4);
    return id.get(k);
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < rows; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = BOTTOM + (((tops[i] + tops[i + 1]) / 2 - BOTTOM) * (j + 0.5)) / rows;
    if (T.holes.some((o) => inHole(o, cx, cy))) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1); idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the surface: the yard's lawn, rock where it is steep or rocky, sand on beaches and riverbeds
function surfaceMaterial(ctx) {
  const { THREE } = ctx;
  const m = ctx.std({ map: ctx.tex("leafy_grass", "diff"), normalMap: ctx.tex("leafy_grass", "nor", 1, false), roughness: 1, side: THREE.DoubleSide });
  const rockT = ctx.tex("dark_rock", "diff"), sandT = ctx.tex("coast_sand_01", "diff");
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tRock = { value: rockT }; sh.uniforms.tSand = { value: sandT };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aRock; attribute float aSand; varying float vRock; varying float vSand; varying vec3 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRock = aRock; vSand = aSand; vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D tRock; uniform sampler2D tSand; varying float vRock; varying float vSand; varying vec3 vW;")
      .replace("#include <map_fragment>", `
      vec4 tc = texture2D(map, vMapUv);
      float l = dot(tc.rgb, vec3(0.3, 0.55, 0.15));
      vec3 lawn = mix(vec3(0.07, 0.22, 0.03), vec3(0.17, 0.42, 0.05), smoothstep(0.08, 0.45, l));
      lawn *= 0.9 + 0.2 * step(0.5, fract(vW.x * 0.17 + 0.25));
      vec3 rk = texture2D(tRock, vMapUv * 0.6).rgb * vec3(0.78, 0.74, 0.7);
      vec3 sd = texture2D(tSand, vMapUv * 0.8).rgb * vec3(1.0, 0.94, 0.82);
      vec3 col = mix(lawn, rk, smoothstep(0.2, 0.8, vRock));
      col = mix(col, sd, vSand * (1.0 - smoothstep(0.2, 0.8, vRock)));
      diffuseColor.rgb = col;`);
  };
  m.customProgramCacheKey = () => "terrainTop";
  return m;
}

// the face: the page's soil (its bands, leaks and wet patches), with the bands measured down from the surface above
// (a 1-D texture of the face's top edge), so a mountain or a gorge has its sod at its own surface
function faceMaterial(ctx, T) {
  const { THREE } = ctx, X = WORLD.X, N = 512;
  const data = new Float32Array(N * 4);
  const band = bandSurface(T, N);
  for (let i = 0; i < N; i++) { data[i * 4] = band[i]; data[i * 4 + 3] = 1; }
  const surf = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType); surf.magFilter = surf.minFilter = THREE.LinearFilter; surf.needsUpdate = true;
  const m = ctx.soilM.clone();
  const base = ctx.soilM.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.uniforms.uSurf = { value: surf };
    sh.fragmentShader = sh.fragmentShader.replace("varying vec3 vW;", `varying vec3 vW;\nuniform sampler2D uSurf;`)
      .replace("float y = vW.y + w;", `float y = vW.y - texture2D(uSurf, vec2(clamp((vW.x + ${X.toFixed(1)}) / ${(2 * X).toFixed(1)}, 0.0, 1.0), 0.5)).r + w;`);
  };
  m.customProgramCacheKey = () => "soilTerrain";
  return m;
}
