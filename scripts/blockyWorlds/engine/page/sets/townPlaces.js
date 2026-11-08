// PLANNER-FIX 2026-11-07 (dog run: a bell festival shot in a school hallway): the plain town's own places on the street
// set, picked per shot by shot.place (lib/worldBible.js town spots; the engine calls S.setPlace(shot.place ?? worldSpot)):
//   "square"  the town square: cobbles, market stalls, lantern strings (lit at night), bunting and the bell tower; the
//             street's houses behind it (it stands past the street's near end, the camera looks down the street)
//   "belfry"  the top of the bell tower: a plank floor, four posts, the great bell hanging, the town far below
//   anything else (main_street, null): the street as it was
// Both are built once, beside the street (never in its frame), always visible; only the spots / camera side / bounds move.
import { townTex } from "../kit/townTex.js"; // LOOK-FIX 2026-11-08: the town's own textures
export function addTownPlaces(S, K, THREE, glow, onLight) {
  const { bx, plane, cyl, solid, pbr, mesh } = K;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const root = new THREE.Group(); root.name = "townPlaces"; S.root.add(root);
  const o = (extra = {}) => ({ parent: root, keep: true, ...extra });
  const lanternMat = glow.add(new THREE.MeshStandardMaterial({ color: "#ffcf6a", emissive: "#ffb347" }), { day: 0.15, night: 4.5, warm: 1.6 });
  const lights = [];

  // ---------- the square (centre 0, 0, 140) ----------
  const SZ = 140;
  // LOOK-FIX 2026-11-08 (owner: "town shots are back on the OLD pastel look"): the town's own textures
  // (page/kit/townTex.js, as the dense town on a creature): grey-brown cobbles, stone, plaster / timber walls, tiled roofs
  const TT = (kind, color, seed, rep = null) => { let t = townTex(THREE, kind, { color, seed }); if (rep) { t = t.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; } return new THREE.MeshStandardMaterial({ map: t, roughness: kind === "cobbles" ? 0.95 : 0.88 }); };
  plane(44, 40, TT("cobbles", "#8c7f6c", 2, [11, 10]), o({ x: 0, y: 0.06, z: SZ })); // above the belfry's town lawn (it reaches x -10)
  // the bell tower (left, behind the people): stone shaft, open belfry with the bell, a pointed red roof
  const stone = TT("stone", "#c8b89c", 5, [2, 5]);
  const TX = -6.5, TZ = SZ - 9;
  bx(3.6, 14, 3.6, stone, o({ x: TX, y: 7, z: TZ }));
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) bx(0.6, 3.2, 0.6, stone, o({ x: TX + dx, y: 15.6, z: TZ + dz }));
  bx(4.0, 0.4, 4.0, stone, o({ x: TX, y: 17.4, z: TZ }));
  mesh(new THREE.ConeGeometry(3.0, 4.2, 4), solid("#b5452c"), o({ x: TX, y: 19.7, z: TZ, ry: Math.PI / 4 }));
  const brass = new THREE.MeshStandardMaterial({ color: "#c9962f", metalness: 0.85, roughness: 0.32 });
  const bellProf = [0.05, 0.5, 0.62, 0.75, 0.95, 1.1, 1.15].map((r, i) => new THREE.Vector2(r, 1.4 - i * 0.23));
  mesh(new THREE.LatheGeometry(bellProf, 24), brass, o({ x: TX, y: 14.2, z: TZ }));
  bx(1.2, 1.0, 0.1, solid("#f4ecd8"), o({ x: TX, y: 11.2, z: TZ + 1.83 })); // the clock face
  // market stalls with striped awnings (right side and back)
  const stripes = ["#d63031", "#2e86de", "#20bf6b", "#f7b731"];
  for (const [k, [x, z, ry]] of [[5.5, SZ - 3, -0.4], [7.5, SZ - 8, -0.2], [2, SZ - 12, 0], [-2.5, SZ - 13, 0.1]].entries()) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    bx(2.4, 0.9, 1.1, solid("#8a5a3a"), { parent: g, y: 0.45, keep: true });
    for (const sx of [-1.1, 1.1]) bx(0.08, 2.2, 0.08, solid("#6b4a2b"), { parent: g, x: sx, y: 1.1, z: 0.5, keep: true });
    bx(2.7, 0.08, 1.6, solid(stripes[k % 4]), { parent: g, y: 2.25, z: 0.2, rx: 0.25, keep: true });
    for (let q = 0; q < 5; q++) bx(0.25, 0.22, 0.25, solid(["#f7d038", "#e67e22", "#7bd148", "#d63031"][(q + k) % 4]), { parent: g, x: -0.8 + q * 0.4, y: 1.0, z: 0.1, keep: true });
  }
  // lantern strings across the square + bunting flags
  for (const [z, y] of [[SZ - 2.5, 4.4], [SZ - 6.5, 4.8], [SZ - 10.5, 5.2]]) {
    for (const sx of [-9, 9]) cyl(0.08, 0.1, y + 0.4, 8, solid("#5a3d24"), o({ x: sx, y: (y + 0.4) / 2, z }));
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 18, 4), solid("#2d2d2d")); wire.rotation.z = Math.PI / 2; wire.position.set(0, y + 0.3, z); root.add(wire);
    for (let q = 0; q < 9; q++) {
      const x = -8 + q * 2, sag = -0.5 * (1 - ((x / 9) ** 2));
      mesh(new THREE.SphereGeometry(0.2, 12, 8), lanternMat, o({ x, y: y + 0.05 + sag, z, shadow: false }));
      mesh(new THREE.ConeGeometry(0.22, 0.35, 3), solid(stripes[q % 4], { side: THREE.DoubleSide }), o({ x: x + 1, y: y + 0.1 + sag, z, rx: Math.PI, shadow: false }));
    }
  }
  for (const [x, z] of [[-4, SZ - 6], [4, SZ - 6], [0, SZ - 10]]) { const l = new THREE.PointLight("#ffbf6b", 0, 16, 1.6); l.position.set(x, 4.2, z); root.add(l); lights.push(l); }
  // a few houses closing the square at its sides
  // LOOK-FIX 2026-11-08: the houses round the square in the back-town style: textured walls in storybook colours, timber
  // corner posts, framed windows with shutters and flower boxes (lit at night), a door with a lantern, a tiled gable roof
  const walls = [["plaster", "#f2bd48"], ["timber", "#f0c49a"], ["plaster", "#78b4dc"], ["planks", "#b4503e"], ["plaster", "#94cc82"], ["timber", "#f4d898"]];
  const shutC = ["#2f6fa8", "#3a8a4a", "#b83a2e", "#2f8a86", "#6a4aa0", "#d08a2a"], flowC = ["#e8384a", "#f06aa8", "#f4c430", "#ff7a2a"];
  const winGlow = glow.add(Object.assign(new THREE.MeshStandardMaterial({ color: "#2a3a4c", roughness: 0.2 }), { emissive: new THREE.Color("#ffc070") }), { day: 0, night: 1.7, warm: 0.3, dusk: 1.2 }, { day: "#2a3a4c", night: "#ffd892", warm: "#2a3a4c" });
  const frameM = solid("#f4efe4", { roughness: 0.7 }), beamM = solid("#5a3e28", { roughness: 0.8 });
  const roofShape = (w) => { const sh = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.5, 0), new THREE.Vector2(w / 2 + 0.5, 0), new THREE.Vector2(0, 3.0)]); const g = new THREE.ExtrudeGeometry(sh, { depth: 6.8, bevelEnabled: false }); g.translate(0, 0, -3.4); return g; };
  for (const [k, [x, z, w]] of [[-14, SZ - 4, 6], [-14, SZ - 12, 6], [14, SZ - 4, 6], [14, SZ - 12, 6], [-8, SZ - 19, 7], [8, SZ - 19, 7]].entries()) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = x < -10 ? Math.PI / 2 : x > 10 ? -Math.PI / 2 : 0; root.add(g); // front (+z local) faces the square
    const [wk, wc] = walls[k % walls.length], D = 6;
    bx(w, 6, D, TT(wk, wc, 7 + k, [w / 4, 1.5]), { parent: g, y: 3, keep: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.2, 6, 0.2, beamM, { parent: g, x: sx * w / 2, y: 3, z: sz * D / 2, keep: true });
    bx(w + 0.2, 0.22, D + 0.2, beamM, { parent: g, y: 3.0, keep: true });
    mesh(roofShape(w), TT("tiles", ["#b8442c", "#c8603a", "#a83a2a"][k % 3], 9, [w / 3, 1]), { parent: g, y: 6, keep: true });
    bx(0.6, 1.6, 0.6, TT("stone", "#9a6a52", 4), { parent: g, x: w * 0.25, y: 7.6, z: -1, keep: true });
    const sh = solid(shutC[k % shutC.length]);
    for (const wy of [1.8, 4.4]) for (const wx of [-w / 4 - 0.2, w / 4 + 0.2]) {
      if (wy < 3 && Math.abs(wx) < 1.2) continue;
      bx(1.1, 1.3, 0.08, frameM, { parent: g, x: wx, y: wy, z: D / 2 + 0.04, keep: true });
      bx(0.9, 1.1, 0.08, winGlow, { parent: g, x: wx, y: wy, z: D / 2 + 0.07, keep: true });
      for (const e of [-1, 1]) bx(0.4, 1.25, 0.06, sh, { parent: g, x: wx + e * 0.78, y: wy, z: D / 2 + 0.06, keep: true });
      bx(1.0, 0.22, 0.3, solid("#6a4426"), { parent: g, x: wx, y: wy - 0.75, z: D / 2 + 0.17, keep: true });
      for (let q = 0; q < 4; q++) bx(0.18, 0.18, 0.18, solid(flowC[(q + k) % 4]), { parent: g, x: wx - 0.33 + q * 0.22, y: wy - 0.57, z: D / 2 + 0.2, keep: true });
    }
    bx(1.2, 2.2, 0.1, beamM, { parent: g, x: 0, y: 1.1, z: D / 2 + 0.05, keep: true });
    bx(0.25, 0.38, 0.25, lanternMat, { parent: g, x: 0.95, y: 2.3, z: D / 2 + 0.2, keep: true });
  }

  // ---------- the belfry (the top of the bell tower, floor at y 22, x 60, z 140) ----------
  const BX = 60, BY = 22, BZ = 140;
  const plank = solid("#9a7048", { roughness: 0.85 }), post = solid("#6b4a2b");
  bx(8, 0.3, 8, plank, o({ x: BX, y: BY - 0.15, z: BZ }));
  bx(8, BY - 0.3, 8, stone, o({ x: BX, y: (BY - 0.3) / 2, z: BZ })); // the tower under it
  for (const [dx, dz] of [[-3.7, -3.7], [3.7, -3.7], [-3.7, 3.7], [3.7, 3.7]]) bx(0.5, 3.6, 0.5, post, o({ x: BX + dx, y: BY + 1.8, z: BZ + dz }));
  bx(8.4, 0.3, 8.4, post, o({ x: BX, y: BY + 3.7, z: BZ }));
  mesh(new THREE.ConeGeometry(6.2, 3.4, 4), solid("#b5452c"), o({ x: BX, y: BY + 5.5, z: BZ, ry: Math.PI / 4 }));
  bx(0.25, 1.0, 8, post, o({ x: BX - 3.9, y: BY + 0.5, z: BZ })); bx(0.25, 1.0, 8, post, o({ x: BX + 3.9, y: BY + 0.5, z: BZ })); bx(8, 1.0, 0.25, post, o({ x: BX, y: BY + 0.5, z: BZ - 3.9 }));
  bx(0.35, 0.35, 7.6, post, o({ x: BX, y: BY + 3.3, z: BZ - 1.4 })); // the beam the bell hangs from
  const greatBell = mesh(new THREE.LatheGeometry(bellProf.map((v) => new THREE.Vector2(v.x * 1.25, v.y * 1.25)), 28), brass, o({ x: BX, y: BY + 1.25, z: BZ - 1.4 }));
  greatBell.name = "greatBell";
  // the town far below (roof tops around the tower's foot) so the openings show where we are
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2, r = 14 + (k % 4) * 5, x = BX + Math.cos(a) * r, z = BZ + Math.sin(a) * r; bx(5, 5, 5, solid(walls[k % 4]), o({ x, y: 2.5, z })); mesh(new THREE.ConeGeometry(4, 2.2, 4), solid(["#b5452c", "#a63d2a", "#c4573a"][k % 3]), o({ x, y: 6.1, z, ry: Math.PI / 4 })); }
  plane(140, 140, pbr("leafy_grass", { repeat: [30, 30], tint: "#9fe06a" }), o({ x: BX, y: 0.03, z: BZ }));
  const bl = new THREE.PointLight("#ffc77a", 0, 10, 1.6); bl.position.set(BX + 1.5, BY + 2.6, BZ + 1.5); root.add(bl); lights.push(bl);

  onLight.push((mode) => { for (const l of lights) l.intensity = { day: 0, night: 26, warm: 8, dusk: 12, dawn: 4 }[mode] ?? 0; });

  // ---------- the places ----------
  const spotsAt = (c, far) => ({ center: c.clone(), left: c.clone().add(V(-1.2, 0, 0.3)), right: c.clone().add(V(1.2, 0, 0.3)), back: c.clone().add(V(0, 0, -2.4)), far: c.clone().add(V(0, 0, -far)), door: c.clone().add(V(3.5, 0, -2)) });
  const base = { spots: Object.fromEntries(Object.entries(S.spots).map(([k, v]) => [k, v.clone()])), camDir: S.camDir.clone(), bounds: S.bounds.map((b) => b.clone()), views: { ...(S.views ?? {}) } };
  const P = {
    street: base,
    square: { spots: spotsAt(V(0.5, 0.08, SZ + 1), 14), camDir: V(0.12, 0, 1).normalize(), bounds: [new THREE.Box3(V(-10, 0.4, SZ - 10), V(10, 9, SZ + 16)), new THREE.Box3(V(-12, 0.4, SZ + 2), V(12, 34, SZ + 46))], views: {} }, // LOOK-FIX: room to step back and up for a wide on the tall stacked towers
    belfry: { spots: spotsAt(V(BX, BY + 0.02, BZ + 1.2), 2.4), camDir: V(0.15, 0, 1).normalize(), bounds: [new THREE.Box3(V(BX - 3.4, BY + 0.4, BZ - 3.0), V(BX + 3.4, BY + 3.3, BZ + 9))], views: {} },
  };
  P.belfry.spots.door = V(BX + 2.5, BY + 0.02, BZ - 0.5);
  const keep = S.spots.tower;
  let cur = "street";
  S.places = P;
  S.setPlace = (name0) => {
    const name = name0 === "square" || name0 === "belfry" ? name0 : name0 === "tower" ? "belfry" : "street";
    if (name === cur && S._placeApplied) return;
    cur = name; S._placeApplied = true;
    const p = P[name];
    for (const [k, v] of Object.entries(p.spots)) { if (S.spots[k]) S.spots[k].copy(v); else S.spots[k] = v.clone(); }
    if (keep) S.spots.tower = keep;
    S.camDir.copy(p.camDir);
    S.bounds.length = 0; S.bounds.push(...p.bounds);
    S.views = { ...p.views };
  };
  return P;
}
