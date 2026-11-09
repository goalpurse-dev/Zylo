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
  const TT = (kind, color, seed, rep = null) => { let t = townTex(THREE, kind, { color, seed }); if (rep) { t = t.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; } return new THREE.MeshStandardMaterial({ map: t, roughness: /^cobbles/.test(kind) ? 0.92 : 0.88 }); };
  // LOOK-LEFTOVERS 2026-11-08 (lead: "the square's ground is pale beige cobbles"): rich warm cobbles with moss in the
  // grout, a worn flagstone path to the bell tower, grass verges in front of the houses, rain puddles, barrels + crates
  plane(44, 40, TT("cobblesRich", "#a0603c", 2, [9, 8]), o({ x: 0, y: 0.06, z: SZ })); // above the belfry's town lawn (it reaches x -10)
  {
    const flags = TT("stone", "#9c8466", 11, [1.2, 6]);
    plane(3.0, 26, flags, o({ x: -3.2, y: 0.066, z: SZ - 2, rz: 0.12 })); // the worn path to the tower
    const grassM = pbr("leafy_grass", { repeat: [1, 8], tint: "#7cc24e", normal: 0.6 }), verge = solid("#5d4a36", { roughness: 0.9 });
    for (const sx of [-1, 1]) {
      plane(1.4, 22, grassM, o({ x: sx * 10.2, y: 0.075, z: SZ - 6 }));
      bx(0.14, 0.12, 22, verge, o({ x: sx * 9.45, y: 0.1, z: SZ - 6 })); // the kerb stones of the verge
    }
    plane(5.6, 5.6, pbr("leafy_grass", { repeat: [2, 2], tint: "#7cc24e", normal: 0.6 }), o({ x: -6.5, y: 0.072, z: SZ - 9 })); // round the tower foot
    const pud = new THREE.MeshStandardMaterial({ color: "#24303c", roughness: 0.04, metalness: 0.35, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const [x, z, rx, rz] of [[-5.5, SZ + 6, 1.3, 0.7], [6.5, SZ + 3.5, 0.9, 0.55], [-7.5, SZ - 3, 1.1, 0.6], [3.5, SZ - 15, 1.4, 0.8], [8.2, SZ + 9, 0.7, 0.45]]) {
      const m = mesh(new THREE.CircleGeometry(1, 24), pud, o({ x, y: 0.072, z, rx: -Math.PI / 2, shadow: true, cast: false })); m.scale.set(rx, rz, 1);
    }
    const barrelM = solid("#7a4a28", { roughness: 0.8 }), band = solid("#2e2a26", { roughness: 0.5 }), crateM = TT("planks", "#a8784a", 6, [1, 1]);
    for (const [x, z] of [[8.3, SZ - 4.5], [8.9, SZ - 5.6], [4.0, SZ - 13.5], [-8.8, SZ + 2]]) { cyl(0.38, 0.34, 0.95, 14, barrelM, o({ x, y: 0.55, z })); for (const by of [0.3, 0.8]) cyl(0.39, 0.39, 0.06, 14, band, o({ x, y: by, z })); }
    for (const [x, z, s] of [[7.8, SZ - 9.6, 0.7], [8.4, SZ - 10.3, 0.55], [-1.0, SZ - 14.2, 0.6], [-8.6, SZ + 3.1, 0.6]]) bx(s, s, s, crateM, o({ x, y: 0.06 + s / 2, z, ry: x * 0.3 }));
  }
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
  const walls = [["plaster", "#f0a42a"], ["timber", "#f2a86e"], ["plaster", "#4f96d8"], ["planks", "#b8402e"], ["plaster", "#6cbf62"], ["timber", "#f4c450"]]; // LOOK-LEFTOVERS: saturated
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
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2, r = 14 + (k % 4) * 5, x = BX + Math.cos(a) * r, z = BZ + Math.sin(a) * r; bx(5, 5, 5, solid(walls[k % 4][1]), o({ x, y: 2.5, z })); mesh(new THREE.ConeGeometry(4, 2.2, 4), solid(["#b5452c", "#a63d2a", "#c4573a"][k % 3]), o({ x, y: 6.1, z, ry: Math.PI / 4 })); }
  plane(140, 140, pbr("leafy_grass", { repeat: [30, 30], tint: "#9fe06a" }), o({ x: BX, y: 0.03, z: BZ }));
  const bl = new THREE.PointLight("#ffc77a", 0, 10, 1.6); bl.position.set(BX + 1.5, BY + 2.6, BZ + 1.5); root.add(bl); lights.push(bl);

  onLight.push((mode) => { for (const l of lights) l.intensity = { day: 0, night: 26, warm: 8, dusk: 12, dawn: 4 }[mode] ?? 0; });

  // SETS-V2 2026-11-09 (lead: "the bell tower asset reads as a dark slab"): out of the day sun the tower's front faces
  // the camera unlit against a bright sky. A wash light from the square's camera side keeps its stone, clock and bell
  // readable at sunset / dusk / night (no shadows: cheap); the clock face glows a little at night
  {
    const wash = new THREE.SpotLight("#ffe2b8", 0, 40, 0.42, 0.6, 1.2); wash.position.set(TX + 3, 3, TZ + 16); wash.target.position.set(TX, 12, TZ); root.add(wash, wash.target);
    const wash2 = new THREE.PointLight("#ffc878", 0, 9, 1.6); wash2.position.set(TX, 14.6, TZ + 2.6); root.add(wash2);
    onLight.push((mode) => { wash.intensity = { day: 0, night: 900, warm: 500, dusk: 700, dawn: 350 }[mode] ?? 0; wash2.intensity = { day: 0, night: 18, warm: 6, dusk: 10, dawn: 4 }[mode] ?? 0; });
  }

  // ---------- SETS-V2: the PARK (centre -60, 0, 140) and the BACK LANE (centre 60, 0, 235) ----------
  // owner D: "a story moves through 3-6 different places" (step-3: #1 one place, #4 / #5 the belfry 62% / 92%): two more
  // outdoor places of the plain town, each with its own palette; the theme dresser adds the theme's props on top
  const PK = V(-60, 0, 140), LN = V(60, 0, 235);
  const pLights = [];
  {
    const o2 = (x, y, z, extra = {}) => o({ x: PK.x + x, y, z: PK.z + z, ...extra });
    plane(46, 42, pbr("leafy_grass", { repeat: [12, 11], tint: "#6cc04a", normal: 0.6 }), o2(0, 0.06, -4));
    const path = TT("stone", "#b08a6a", 13, [1, 7]);
    plane(2.6, 30, path, o2(0.6, 0.07, -2, { rz: 0.18 })); plane(2.4, 16, path, o2(-5, 0.071, -9, { rz: Math.PI / 2 - 0.2 }));
    // the fountain (back centre): a stone basin, blue water, a two-tier column
    const st = solid("#9aa4b4", { roughness: 0.8 });
    cyl(2.2, 2.4, 0.6, 24, st, o2(0, 0.3, -11)); cyl(2.0, 2.0, 0.08, 24, solid("#3a8ad0", { roughness: 0.08, metalness: 0.2 }), o2(0, 0.58, -11));
    cyl(0.25, 0.32, 1.8, 12, st, o2(0, 1.2, -11)); cyl(0.9, 0.5, 0.25, 16, st, o2(0, 2.1, -11)); cyl(0.12, 0.12, 0.6, 8, solid("#7fc8f8", { transparent: true, opacity: 0.7 }), o2(0, 2.5, -11));
    // a bandstand (left back): red roof, white posts, a blue deck
    cyl(3.0, 3.0, 0.4, 8, solid("#2e6ab0"), o2(-11, 0.2, -12)); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cyl(0.1, 0.1, 3, 8, solid("#ffffff"), o2(-11 + Math.cos(a) * 2.7, 1.9, -12 + Math.sin(a) * 2.7)); }
    mesh(new THREE.ConeGeometry(3.6, 1.8, 8), solid("#d63031"), o2(-11, 4.3, -12));
    // trees: round crowns in three greens, a few blossoming pink
    const trunk = solid("#6a4428", { roughness: 0.9 });
    const crowns = ["#2f8a3a", "#3ea04a", "#4ab04e", "#f08ab0"].map((c) => solid(c, { roughness: 0.85 }));
    for (const [k, [x, z, s]] of [[-17, -2, 1.2], [-15, 8, 1.0], [16, -3, 1.3], [17, 7, 1.0], [8, -18, 1.4], [-6, -20, 1.2], [18, -15, 1.1], [-19, -14, 1.0]].entries()) {
      cyl(0.25 * s, 0.35 * s, 3 * s, 8, trunk, o2(x, 1.5 * s, z));
      for (let q = 0; q < 3; q++) mesh(new THREE.SphereGeometry((1.5 + q * 0.2) * s, 12, 10), crowns[(k + q) % (k % 3 === 0 ? 4 : 3)], o2(x + (q - 1) * 0.7 * s, (3.4 + (q % 2) * 0.8) * s, z + (q - 1) * 0.4));
    }
    // flower beds with saturated flowers and low hedges along the path
    const fl = ["#e8384a", "#f06aa8", "#f4c430", "#8a5ad8", "#ff7a2a"].map((c) => solid(c));
    for (const [x, z] of [[-4.5, 2], [5.5, 1], [-6.5, -5], [6.5, -8]]) { bx(3.2, 0.25, 1.4, solid("#5a3e28"), o2(x, 0.13, z)); for (let q = 0; q < 14; q++) mesh(new THREE.SphereGeometry(0.13, 8, 6), fl[q % 5], o2(x - 1.4 + (q % 7) * 0.47, 0.4, z - 0.35 + Math.floor(q / 7) * 0.7, { shadow: false })); }
    const hedge = solid("#2e7a34", { roughness: 0.9 });
    for (const sx of [-1, 1]) bx(0.8, 0.8, 9, hedge, o2(sx * 9.5, 0.4, 2));
    // lamp posts (glow at night) and their lights
    const lampM = glow.add(new THREE.MeshStandardMaterial({ color: "#fff4d8", emissive: "#ffd28a" }), { day: 0, night: 4.5, warm: 1.4 });
    for (const [x, z] of [[-3, 4], [4, -4], [-3, -14]]) { cyl(0.08, 0.1, 3.6, 8, solid("#2a2e36"), o2(x, 1.8, z)); mesh(new THREE.SphereGeometry(0.28, 12, 8), lampM, o2(x, 3.75, z, { shadow: false })); const l = new THREE.PointLight("#ffc77a", 0, 14, 1.6); l.position.set(PK.x + x, 3.6, PK.z + z); root.add(l); pLights.push(l); }
  }
  {
    // the lane: cobbles between two rows of tall narrow houses in strong colours, washing lines across, an arch at the end
    const o3 = (x, y, z, extra = {}) => o({ x: LN.x + x, y, z: LN.z + z, ...extra });
    plane(9, 44, TT("cobblesRich", "#6a6a7a", 17, [2, 10]), o3(0, 0.06, -6));
    plane(60, 60, pbr("leafy_grass", { repeat: [15, 15], tint: "#7cc24e", normal: 0.6 }), o3(0, 0.03, -6));
    const lw = [["plaster", "#3a7ab8"], ["timber", "#d85a4a"], ["plaster", "#2e9a8a"], ["planks", "#7a5ab0"], ["plaster", "#f0a42a"], ["timber", "#5aa04a"], ["plaster", "#e84a7a"], ["planks", "#3a8ad0"]];
    const winL = glow.add(Object.assign(new THREE.MeshStandardMaterial({ color: "#24303c", roughness: 0.2 }), { emissive: new THREE.Color("#ffc070") }), { day: 0, night: 1.9, warm: 0.4, dusk: 1.3 }, { day: "#24303c", night: "#ffd892", warm: "#24303c" });
    const beam2 = solid("#3a2a1c", { roughness: 0.8 });
    for (let k = 0; k < 8; k++) {
      const side = k % 2 ? 1 : -1, z = 8 - Math.floor(k / 2) * 7, h = 7 + (k % 3) * 1.5, w = 6.4;
      const g = new THREE.Group(); g.position.set(LN.x + side * 7.6, 0, LN.z + z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(g);
      bx(w, h, 6, TT(lw[k][0], lw[k][1], 31 + k, [w / 4, h / 4]), { parent: g, y: h / 2, keep: true });
      mesh(roofShape(w), TT("tiles", ["#4a5a6e", "#8a3a2a", "#3a4a5a"][k % 3], 9 + k, [w / 3, 1]), { parent: g, y: h, keep: true });
      for (const wy of [2.0, 4.4, ...(h > 7.5 ? [6.6] : [])]) for (const wx of [-1.6, 1.6]) { bx(1.0, 1.25, 0.08, frameM, { parent: g, x: wx, y: wy, z: 3.04, keep: true }); bx(0.8, 1.05, 0.08, winL, { parent: g, x: wx, y: wy, z: 3.07, keep: true }); }
      bx(1.1, 2.1, 0.1, beam2, { parent: g, x: 0, y: 1.05, z: 3.05, keep: true });
      bx(0.22, 0.36, 0.22, lanternMat, { parent: g, x: 0.85, y: 2.4, z: 3.25, keep: true });
    }
    const cloth = ["#ffffff", "#f7d038", "#e84a5f", "#7fc8f8", "#20bf6b"];
    for (const [z, y] of [[5, 5.2], [-6, 5.6]]) { const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 9, 4), solid("#2d2d2d")); wire.rotation.z = Math.PI / 2; wire.position.set(LN.x, y, LN.z + z); root.add(wire); for (let q = 0; q < 7; q++) bx(0.5, 0.65, 0.03, solid(cloth[(q + Math.round(z)) % 5]), o3(-3.3 + q * 1.1, y - 0.4, z, { shadow: false })); }
    // the arch at the far end
    const archM = TT("stone", "#8a6a5a", 19, [1, 2]);
    for (const sx of [-1, 1]) bx(1.2, 6, 1.2, archM, o3(sx * 3.6, 3, -24)); bx(8.4, 1.2, 1.2, archM, o3(0, 6.5, -24));
    for (const [x, z] of [[-3.2, 2], [3.2, -9]]) { const l = new THREE.PointLight("#ffbf6b", 0, 12, 1.6); l.position.set(LN.x + x, 3.2, LN.z + z); root.add(l); pLights.push(l); }
  }
  onLight.push((mode) => { for (const l of pLights) l.intensity = { day: 0, night: 22, warm: 6, dusk: 10, dawn: 3 }[mode] ?? 0; });

  // ---------- the places ----------
  const spotsAt = (c, far) => ({ center: c.clone(), left: c.clone().add(V(-1.2, 0, 0.3)), right: c.clone().add(V(1.2, 0, 0.3)), back: c.clone().add(V(0, 0, -2.4)), far: c.clone().add(V(0, 0, -far)), door: c.clone().add(V(3.5, 0, -2)) });
  const base = { spots: Object.fromEntries(Object.entries(S.spots).map(([k, v]) => [k, v.clone()])), camDir: S.camDir.clone(), bounds: S.bounds.map((b) => b.clone()), views: { ...(S.views ?? {}) } };
  const P = {
    street: base,
    square: { spots: spotsAt(V(0.5, 0.08, SZ + 1), 14), camDir: V(0.12, 0, 1).normalize(), bounds: [new THREE.Box3(V(-10, 0.4, SZ - 10), V(10, 9, SZ + 16)), new THREE.Box3(V(-12, 0.4, SZ + 2), V(12, 34, SZ + 46))], views: {} }, // LOOK-FIX: room to step back and up for a wide on the tall stacked towers
    belfry: { spots: spotsAt(V(BX, BY + 0.02, BZ + 1.2), 2.4), camDir: V(0.15, 0, 1).normalize(), bounds: [new THREE.Box3(V(BX - 3.4, BY + 0.4, BZ - 3.0), V(BX + 3.4, BY + 3.3, BZ + 9))], views: {} },
  };
  P.belfry.spots.door = V(BX + 2.5, BY + 0.02, BZ - 0.5);
  // SETS-V2: the park (people on the lawn path in front of the fountain) and the back lane (on the cobbles, the arch behind)
  P.park = { spots: spotsAt(V(PK.x + 0.5, 0.08, PK.z + 1), 17), camDir: V(0.1, 0, 1).normalize(), bounds: [new THREE.Box3(V(PK.x - 14, 0.4, PK.z - 8), V(PK.x + 14, 14, PK.z + 18))], views: {} };
  P.park.spots.door = V(PK.x - 8, 0.08, PK.z - 9);
  P.lane = { spots: spotsAt(V(LN.x, 0.08, LN.z + 2), 16), camDir: V(0, 0, 1), bounds: [new THREE.Box3(V(LN.x - 3.4, 0.4, LN.z - 14), V(LN.x + 3.4, 9, LN.z + 16))], views: {} };
  P.lane.spots.door = V(LN.x + 3.6, 0.08, LN.z - 1);
  const keep = S.spots.tower;
  let cur = "street";
  S.places = P;
  S.setPlace = (name0) => {
    const name = name0 === "square" || name0 === "belfry" || name0 === "park" || name0 === "lane" ? name0 : name0 === "tower" ? "belfry" : "street";
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
