// Set "street": the suburb street of the locked look (look/scene.js): asphalt road with yellow centre lines, concrete
// sidewalks and curbs, front lawns, code-built houses with real Poly Haven materials (gables, shutters, porches,
// garages, picket fences, mailboxes), jacaranda trees, shrubs, street lamps, parked Kenney cars, the yellow town bus,
// the bus shelter and the BUS stop sign, mountains and a tree line at the end of the street.
// The group stands on the right-hand sidewalk; the camera looks down the street (-z), like the locked frame.
import { makeKit, mergeStatic, glowList } from "./util.js";
import { backdrop, waterTower } from "./backdrop.js";

const SIDE = 4.5, WALK = 3.0, CURB = 0.15;
const WALLS = [["painted_plaster_wall", "#fff3d6"], ["painted_plaster_wall", "#cfe8ff"], ["brick_wall_02", "#ffffff"], ["painted_plaster_wall", "#d8f2d0"], ["painted_plaster_wall", "#ffd9cc"], ["beige_wall_001", "#ffffff"]];
const DOORS = ["#c0392b", "#1f6f8b", "#2c3e70", "#2e7d4f", "#8e44ad", "#e67e22"];
const ROOFS = [["roof_09", "#ffffff"], ["grey_roof_01", "#ffffff"]];

export async function build(ctx) {
  const { THREE } = ctx;
  const root = new THREE.Group(); root.name = "set:street";
  const K = makeKit(ctx, root), { bx, rbx, plane, mesh, pbr, solid, glass, paint } = K;
  const glow = glowList(), onLight = [];

  // ---------- the street ----------
  plane(9, 320, pbr("asphalt_02", { repeat: [3, 106], tint: "#b8b8bc" }), { y: 0, z: -120 });
  for (const x of [-0.11, 0.11]) plane(0.1, 320, paint("#f2c230"), { x, y: 0.004, z: -120, shadow: false });
  for (const x of [-4.2, 4.2]) plane(0.12, 320, paint("#f4f4f0"), { x, y: 0.004, z: -120, shadow: false });
  const busBox = plane(2.6, 3.2, new THREE.MeshStandardMaterial({ color: "#f4f4f0", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), { x: 2.2, y: 0.005, z: -6, shadow: false });
  void busBox;
  for (const sx of [-1, 1]) {
    bx(0.3, CURB + 0.05, 320, pbr("concrete_pavement", { repeat: [0.2, 100], tint: "#e6e2dc" }), { x: sx * (SIDE + 0.15), y: (CURB + 0.05) / 2 - 0.05, z: -120 });
    bx(WALK, CURB, 320, pbr("concrete_pavement", { repeat: [1.5, 160], tint: "#f2eee8" }), { x: sx * (SIDE + 0.3 + WALK / 2), y: CURB / 2, z: -120 });
    bx(60, 0.1, 320, pbr("leafy_grass", { repeat: [20, 100], tint: "#9fe06a", normal: 0.6 }), { x: sx * (SIDE + 0.3 + WALK + 30), y: 0.05, z: -120 });
  }
  backdrop(K, (f) => onLight.push(f));
  // the landmark: the water tower on a hill where the street ends
  const towerSpot = waterTower(K, (f) => onLight.push(f), { x: -1.5, z: -122, legH: 16, R: 3.6, hill: { r: 26, h: 5.5, d: 0.8 } });

  // ---------- houses ----------
  const roofCache = {};
  function house(x, z, side, i, { lit = false } = {}) {
    const g = new THREE.Group(); g.position.set(x, 0.1, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(g);
    const w = 9 + (i % 3), d = 7, h = i % 2 ? 5.6 : 3.4;
    const [wn, wt] = WALLS[i % WALLS.length], wallMat = pbr(wn, { repeat: [w / 3, h / 3], tint: wt });
    bx(w, h, d, wallMat, { y: h / 2, parent: g, block: true });
    const [rn, rt] = ROOFS[i % 2], rh = 2.4, half = d / 2 + 0.5, slope = Math.hypot(half, rh), ang = Math.atan2(rh, half);
    const roofMat = roofCache[`${rn}${w}`] ??= pbr(rn, { repeat: [w / 2.5, slope / 2.5], tint: rt });
    for (const s of [-1, 1]) bx(w + 0.8, 0.16, slope, roofMat, { y: h + rh / 2, z: s * half / 2, rx: s * ang, parent: g });
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rh - 0.1)]);
    for (const s of [-1, 1]) mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), wallMat, { x: s * (w / 2) - (s > 0 ? 0.1 : 0), y: h, ry: Math.PI / 2, parent: g });
    const frame = solid("#fbfbf6", { roughness: 0.5 }), shutter = solid(DOORS[(i + 2) % DOORS.length], { roughness: 0.55 });
    const winGlass = lit ? glowGlass : plainGlass;
    const rows = h > 4 ? [1.6, 4.1] : [1.7];
    for (const wy of rows) for (const wx of [-w / 2 + 1.8, w / 2 - 1.8, ...(w > 10 ? [0] : [])]) {
      if (wy < 3 && Math.abs(wx) < 0.5) continue;
      bx(1.35, 1.55, 0.12, frame, { x: wx, y: wy, z: d / 2 + 0.03, parent: g });
      bx(1.15, 1.35, 0.06, winGlass, { x: wx, y: wy, z: d / 2 + 0.08, parent: g, shadow: false });
      bx(0.05, 1.35, 0.1, frame, { x: wx, y: wy, z: d / 2 + 0.1, parent: g }); bx(1.15, 0.05, 0.1, frame, { x: wx, y: wy, z: d / 2 + 0.1, parent: g });
      for (const s of [-1, 1]) bx(0.4, 1.55, 0.06, shutter, { x: wx + s * 0.9, y: wy, z: d / 2 + 0.04, parent: g });
    }
    bx(1.1, 2.2, 0.12, solid(DOORS[i % DOORS.length], { roughness: 0.4 }), { x: 0, y: 1.1, z: d / 2 + 0.04, parent: g });
    bx(1.5, 2.45, 0.08, frame, { x: 0, y: 1.2, z: d / 2 + 0.01, parent: g });
    bx(3.2, 0.25, 1.8, pbr("concrete_pavement", { repeat: [1, 0.6], tint: "#f0ece6" }), { y: 0.12, z: d / 2 + 0.9, parent: g });
    bx(3.4, 0.14, 2.0, roofMat, { y: 2.75, z: d / 2 + 0.95, parent: g });
    for (const s of [-1, 1]) bx(0.16, 2.6, 0.16, frame, { x: s * 1.5, y: 1.4, z: d / 2 + 1.7, parent: g });
    bx(0.18, 0.26, 0.12, porchMat, { x: 0.85, y: 2.0, z: d / 2 + 0.1, parent: g });
    if (i % 3 !== 1) {
      const gw = 3.6; bx(gw, 3.0, 6, wallMat, { x: w / 2 + gw / 2, y: 1.5, parent: g, block: true });
      bx(3.0, 2.4, 0.1, solid("#f3f1ea", { roughness: 0.5 }), { x: w / 2 + gw / 2, y: 1.2, z: 3.02, parent: g });
      for (let k = 0; k < 4; k++) bx(3.0, 0.03, 0.12, solid("#d9d6cd"), { x: w / 2 + gw / 2, y: 0.3 + k * 0.6, z: 3.06, parent: g });
      bx(gw + 0.4, 0.14, 6.4, roofMat, { x: w / 2 + gw / 2, y: 3.07, parent: g });
      bx(3.4, 0.06, 4.4, pbr("concrete_pavement", { repeat: [1, 1.5], tint: "#ebe7e0" }), { x: w / 2 + gw / 2, y: 0.0, z: 5.2, parent: g });
    }
    bx(0.8, 2.2, 0.8, pbr("brick_wall_02", { repeat: [0.3, 0.8] }), { x: -w / 2 + 1.4, y: h + 1.6, z: -0.8, parent: g });
    bx(1.3, 0.05, 1.9, pbr("concrete_pavement", { repeat: [0.4, 0.6], tint: "#ebe7e0" }), { y: 0.0, z: d / 2 + 2.75, parent: g });
    const picket = solid("#ffffff", { roughness: 0.6 });
    for (let px = -w / 2 - 1; px < w / 2 + 2; px += 0.32) if (Math.abs(px) > 0.8) bx(0.08, 0.9, 0.04, picket, { x: px, y: 0.45, z: d / 2 + 3.6, parent: g });
    for (const fy of [0.75, 0.3]) for (const s2 of [-1, 1]) bx(w / 2 + 0.2, 0.06, 0.05, picket, { x: s2 * (w / 4 + 0.85) + (s2 > 0 ? 0.5 : 0), y: fy, z: d / 2 + 3.6, parent: g });
    bx(0.1, 1.1, 0.1, solid("#5b4636"), { x: 1.2, y: 0.55, z: d / 2 + 3.9, parent: g });
    rbx(0.32, 0.3, 0.5, 0.08, solid(DOORS[(i + 4) % DOORS.length], { roughness: 0.35 }), { x: 1.2, y: 1.2, z: d / 2 + 3.9, parent: g });
    return g;
  }
  const plainGlass = glass();
  const glowGlass = glow.add(Object.assign(glass(), { emissive: new THREE.Color("#ffb257") }), { day: 0, night: 1.8, warm: 0.25 }, { day: "#20303f", night: "#ffd38a", warm: "#20303f" });
  const porchMat = glow.add(new THREE.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffcf7a" }), { day: 0.2, night: 3, warm: 1.2 });
  const HZ = [10, -8, -26, -44, -62, -80];
  HZ.forEach((z, k) => { house(15.5, z, 1, k, { lit: k % 2 === 0 }); house(-15.5, z + 6, -1, k + 3, { lit: k % 3 === 0 }); });

  // ---------- models ----------
  const [lampP, hydrantP, binP, benchP, shrubA, shrubB, treeP, planterP, sedan, suv, van, taxi] = await Promise.all([
    K.model("/assets/ph/street_lamp_01/street_lamp_01.gltf", { height: 6.2 }),
    K.model("/assets/ph/fire_hydrant/fire_hydrant.gltf", { height: 0.85, first: true }),
    K.model("/assets/ph/metal_trash_can/metal_trash_can.gltf", { height: 1.0 }),
    K.model("/assets/ph/modular_street_seating/modular_street_seating.gltf", { length: 2.2 }),
    K.model("/assets/ph/shrub_02/shrub_02.gltf", { height: 1.2 }),
    K.model("/assets/ph/shrub_04/shrub_04.gltf", { height: 1.0 }),
    K.model("/assets/ph/jacaranda_tree/jacaranda_tree.gltf", { height: 8.5 }),
    K.model("/assets/ph/planter_box_01/planter_box_01.gltf", { length: 1.4 }),
    K.model("/assets/kenney/car/sedan.glb", { length: 4.6 }), K.model("/assets/kenney/car/suv.glb", { length: 4.8 }),
    K.model("/assets/kenney/car/van.glb", { length: 5.2 }), K.model("/assets/kenney/car/taxi.glb", { length: 4.6 }),
  ]);
  // jacarandas: the near ones lightly thinned and casting shadows, the far ones thinned harder, no shadows
  const tree = ([x, z, s]) => ({ x, y: 0.1, z, ry: z * 0.7, s });
  K.instance(K.thin(treeP, { leaves: 3, branches: 3 }), [[9.3, -9, 0.95], [-9.6, -2, 1.05], [9.5, 7, 1.0], [-9.6, 12, 0.9]].map(tree));
  K.instance(K.thin(treeP, { leaves: 6, branches: 0 }), [[9.6, -24, 0.9], [-9.8, -30, 0.95], [9.4, -38, 1.1], [-9.4, -52, 1], [9.6, -54, 1.0]].map(tree), { shadow: false });
  K.instance(shrubA, [[8.6, -5], [-8.7, 1], [8.7, -21], [8.8, -41], [8.7, 4]].map(([x, z]) => ({ x, y: 0.1, z, ry: z })));
  K.instance(shrubB, [[8.8, -6.4], [-8.6, -20], [8.6, -19.6], [-8.7, -36]].map(([x, z]) => ({ x, y: 0.1, z, ry: z })));
  const LAMPZ = [-3.2, -24, -46];
  K.instance(lampP, [...LAMPZ.map((z) => ({ x: 4.95, y: CURB, z, ry: -Math.PI / 2 })), ...[-14, -36].map((z) => ({ x: -4.95, y: CURB, z, ry: Math.PI / 2 }))]);
  const bulb = glow.add(new THREE.MeshStandardMaterial({ color: "#fff4d8", emissive: "#ffd28a" }), { day: 0, night: 5, warm: 1.5 });
  for (const z of LAMPZ) mesh(new THREE.SphereGeometry(0.16, 12, 8), bulb, { x: 3.62, y: 5.72, z, shadow: false });
  for (const z of [-14, -36]) mesh(new THREE.SphereGeometry(0.16, 12, 8), bulb, { x: -3.62, y: 5.72, z, shadow: false });
  K.place(hydrantP, 7.55, CURB, -12, 0.4);
  K.place(binP, 7.45, CURB, -3.2, 0.3);
  K.place(planterP, 7.4, CURB, -15, 0);
  K.place(sedan, -3.2, 0, -9, 0); K.place(suv, -3.2, 0, -22, 0); K.place(van, 3.25, 0, -40, Math.PI); K.place(taxi, -1.8, 0, -52, Math.PI);

  // ---------- the yellow bus (parked down the street) ----------
  {
    const g = new THREE.Group(); g.position.set(2.15, 0, -16); g.rotation.y = -0.05; root.add(g);
    const Lb = 11, Wd = 2.55, Hh = 3.05;
    const paintMat = new THREE.MeshPhysicalMaterial({ color: "#ffb30f", roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35, metalness: 0, envMapIntensity: 0.55 });
    const black = solid("#1b1c20", { roughness: 0.5 }), chrome = new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 1, roughness: 0.2 });
    rbx(Wd, Hh - 0.45, Lb, 0.18, paintMat, { y: 0.45 + (Hh - 0.45) / 2, parent: g, block: true });
    rbx(Wd - 0.1, 0.12, Lb - 0.4, 0.05, solid("#f4f1e6", { roughness: 0.4 }), { y: Hh + 0.02, parent: g });
    const win = glow.add(Object.assign(glass(), { emissive: new THREE.Color("#ffd28a") }), { day: 0, night: 0.9, warm: 0 }, { day: "#20303f", night: "#ffe3a8", warm: "#20303f" });
    for (const s of [-1, 1]) {
      for (let k = 0; k < 7; k++) bx(0.06, 0.95, 1.2, win, { x: s * (Wd / 2 + 0.005), y: 2.15, z: -Lb / 2 + 1.0 + k * 1.38, parent: g, shadow: false });
      bx(0.05, 0.14, Lb - 0.6, black, { x: s * (Wd / 2 + 0.01), y: 1.45, parent: g });
      bx(0.05, 0.08, Lb - 0.6, black, { x: s * (Wd / 2 + 0.01), y: 1.15, parent: g });
    }
    bx(Wd - 0.3, 1.25, 0.06, win, { y: 2.05, z: Lb / 2 + 0.005, parent: g, shadow: false });
    const sign = K.canvas(512, 96, (x) => { x.fillStyle = "#101010"; x.fillRect(0, 0, 512, 96); x.fillStyle = "#ffb43a"; x.font = "bold 62px sans-serif"; x.textBaseline = "middle"; x.fillText("7  MAPLE AVE", 22, 50); });
    bx(Wd - 0.5, 0.32, 0.05, new THREE.MeshStandardMaterial({ map: sign, emissive: "#ffffff", emissiveMap: sign, emissiveIntensity: 0.9 }), { y: 2.87, z: Lb / 2 + 0.01, parent: g, shadow: false });
    bx(Wd + 0.05, 0.42, 0.2, black, { y: 0.55, z: Lb / 2 + 0.06, parent: g });
    bx(1.2, 0.5, 0.05, chrome, { y: 1.1, z: Lb / 2 + 0.01, parent: g });
    const lampMat = glow.add(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6dd" }), { day: 1.2, night: 2.5, warm: 1.6 });
    const amber = new THREE.MeshStandardMaterial({ color: "#ffa21a", emissive: "#ff9a10", emissiveIntensity: 1 });
    for (const s of [-1, 1]) {
      K.cyl(0.17, 0.17, 0.06, 20, lampMat, { x: s * 0.85, y: 1.05, z: Lb / 2 + 0.02, rx: Math.PI / 2, parent: g });
      bx(0.22, 0.12, 0.05, amber, { x: s * 1.1, y: 1.32, z: Lb / 2 + 0.02, parent: g });
      bx(0.04, 0.6, 0.04, black, { x: s * (Wd / 2 + 0.3), y: 2.35, z: Lb / 2 - 0.1, parent: g });
      bx(0.1, 0.42, 0.24, black, { x: s * (Wd / 2 + 0.42), y: 2.05, z: Lb / 2 - 0.1, parent: g });
      for (const wz of [Lb / 2 - 2.0, -Lb / 2 + 2.2]) {
        K.cyl(0.52, 0.52, 0.34, 28, black, { x: s * (Wd / 2 - 0.12), y: 0.52, z: wz, rz: Math.PI / 2, parent: g });
        K.cyl(0.26, 0.26, 0.36, 20, chrome, { x: s * (Wd / 2 - 0.12), y: 0.52, z: wz, rz: Math.PI / 2, parent: g });
      }
    }
    bx(0.06, 1.9, 0.95, win, { x: Wd / 2 + 0.01, y: 1.45, z: Lb / 2 - 1.05, parent: g, shadow: false });
    const side = K.canvas(512, 80, (x) => { x.fillStyle = "#1b1c20"; x.font = "bold 56px sans-serif"; x.textBaseline = "middle"; x.fillText("MAPLEWOOD TOWN BUS", 10, 42); });
    mesh(new THREE.PlaneGeometry(4.6, 0.72), new THREE.MeshStandardMaterial({ map: side, transparent: true, roughness: 0.4 }), { x: Wd / 2 + 0.02, y: 0.85, z: -0.5, ry: Math.PI / 2, parent: g, shadow: false });
  }

  // ---------- the bus shelter and the stop sign ----------
  {
    const g = new THREE.Group(); g.position.set(7.15, CURB, -6.2); root.add(g);
    const alu = new THREE.MeshStandardMaterial({ color: "#c7ccd3", metalness: 0.8, roughness: 0.3 });
    const pane = new THREE.MeshPhysicalMaterial({ color: "#d9f0ff", roughness: 0.05, transparent: true, opacity: 0.22, metalness: 0 });
    for (const pz of [-1.8, 1.8]) for (const px of [-0.7, 0.7]) bx(0.08, 2.6, 0.08, alu, { x: px, y: 1.3, z: pz, parent: g });
    bx(1.7, 0.12, 4.0, alu, { y: 2.65, parent: g });
    bx(0.04, 2.0, 3.5, pane, { x: 0.7, y: 1.35, parent: g, shadow: false, keep: true });
    bx(1.3, 2.0, 0.04, pane, { y: 1.35, z: -1.8, parent: g, shadow: false, keep: true });
    const ad = K.canvas(360, 540, (p) => {
      const gr = p.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, "#ff5e7e"); gr.addColorStop(1, "#ffb347"); p.fillStyle = gr; p.fillRect(0, 0, 360, 540);
      p.fillStyle = "#fff"; p.font = "bold 70px sans-serif"; p.textAlign = "center"; p.fillText("SUMMER", 180, 160); p.fillText("FAIR", 180, 240);
      p.font = "bold 34px sans-serif"; p.fillText("SAT • TOWN SQUARE", 180, 330); p.beginPath(); p.arc(180, 440, 60, 0, Math.PI * 2); p.fillStyle = "#ffe66d"; p.fill();
    });
    bx(1.25, 1.85, 0.06, glow.add(new THREE.MeshStandardMaterial({ map: ad, emissive: "#ffffff", emissiveMap: ad, roughness: 0.3 }), { day: 0.25, night: 0.9, warm: 0.4 }), { y: 1.35, z: 1.8, parent: g });
    K.place(benchP, 0.0, 0, 0, -Math.PI / 2, 1, g);
  }
  {
    const x = 4.95, z = -1.6;
    bx(0.08, 2.9, 0.08, new THREE.MeshStandardMaterial({ color: "#9aa1aa", metalness: 0.7, roughness: 0.35 }), { x, y: CURB + 1.45, z });
    const t = K.canvas(256, 256, (p) => {
      p.fillStyle = "#1f6fd6"; p.beginPath(); p.arc(128, 128, 124, 0, Math.PI * 2); p.fill(); p.fillStyle = "#fff"; p.beginPath(); p.arc(128, 128, 100, 0, Math.PI * 2); p.fill();
      p.fillStyle = "#1f6fd6"; p.font = "bold 82px sans-serif"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("BUS", 128, 132);
    });
    const back = t.clone(); back.wrapS = THREE.RepeatWrapping; back.repeat.set(-1, -1); back.offset.set(1, 1); back.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 32), [solid("#1f6fd6"), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: back, roughness: 0.4 })]);
    m.position.set(x, CURB + 2.6, z); m.rotation.set(0, -Math.PI / 2 + 0.3, Math.PI / 2); m.castShadow = true; root.add(m);
  }

  mergeStatic(THREE, root);

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  return {
    root, indoor: false,
    spots: { center: V(6.3, CURB, 0), left: V(5.25, CURB, 0.25), right: V(7.35, CURB, 0.25), back: V(6.5, CURB, -2.6), far: V(6.4, CURB, -30), door: V(11.0, 0.35, -8), tower: towerSpot },
    // the camera side of each spot (unit, horizontal); default: +z (looking down the street)
    camDir: V(0, 0, 1),
    views: { door: V(-1, 0, 0.45).normalize() },
    bounds: [new THREE.Box3(V(4.9, 0.4, -40), V(8.6, 7, 18)), new THREE.Box3(V(-3.8, 0.4, -98), V(4.9, 7, 18)), new THREE.Box3(V(8.6, 0.4, -12), V(11.6, 5, -4))],
    rig: {
      shadow: { center: [5, 0, -10], half: 30, far: 160, map: 2048 },
      practicals(mode) {
        if (mode !== "night") return [];
        const L = [];
        for (const z of LAMPZ.slice(0, 2)) { const l = new THREE.SpotLight("#ffc77a", 150, 26, 0.95, 0.6, 1.6); l.position.set(3.7, 5.9, z); l.target.position.set(5.6, 0, z + 1.2); L.push(l); }
        const shel = new THREE.PointLight("#bfe2ff", 10, 6, 2); shel.position.set(6.6, 2.4, -6.2); L.push(shel);
        const porch = new THREE.PointLight("#ffbe6b", 14, 9, 2); porch.position.set(10.8, 2.3, -26 + 0); L.push(porch);
        const porch2 = new THREE.PointLight("#ffbe6b", 14, 9, 2); porch2.position.set(10.8, 2.3, 10); L.push(porch2);
        return L;
      },
      onLight(mode) { glow.apply(mode); onLight.forEach((f) => f(mode)); },
    },
  };
}
