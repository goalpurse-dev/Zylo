// Kit: the building generator (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "buildings"). A "building"
// part is a cut-open building: its front wall taken away so its floors read from the camera, floors stacked with their
// slabs, a back wall with lit windows, side walls, a roof (flat, gable, dome or none), and shafts through the floors:
// an elevator (a car on its cables, a counterweight), an escalator (steps with tread and riser that run), stairs, a
// chimney. It covers a two-storey mall or station, a power station hall, a treatment works building, a factory, a tower.
// Channels: build (the floors rise one by one), lights (the windows glow), lift (the elevator car: 0 its first floor,
// 1 its top floor), run (the escalator steps move). Pure functions first (Node), the builder last.

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
  const wallM = ctx.std({ color: C(s.walls), roughness: 0.8 }), slabM = ctx.std({ color: C("#9a958c"), roughness: 0.85 }), roofM = ctx.std({ color: C(s.roofColor), roughness: 0.7 });
  const glassM = new THREE.MeshStandardMaterial({ color: C("#2c3e50"), emissive: C("#ffd98a"), emissiveIntensity: 0, roughness: 0.15 });
  const metalM = ctx.std({ color: C("#b9c0c7"), roughness: 0.35, metalness: 0.7 }), darkM = ctx.std({ color: C("#3a3f45"), roughness: 0.5, metalness: 0.4 });
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
