// Blocky Worlds WORLD-LOOK (2026-11-06): street-level places IN the town on the creature, built from the SAME town
// (page/kit/backTown.js plan): people and town scenes happen here, never on the old bus-stop street. Owner's rule: at
// street level you still feel you are on the creature (the shell edge / its head and neck in the background, the ground
// tilting gently as it walks: the "on" world's sway), and people are always doing something with readable faces.
//   addPlaces(S, { ctx, K, world, giant, town, plan, surface(x, z) (world), toWorld(x, y, z) (root -> world), seed })
//   S.places: { street, deck, stairs, rooftop, school, room, classroom } -> { spots, camDir, bounds, light? }
//   S.setPlace(name | null)  the engine calls it per shot (shot.place); unknown / null = "street"
import { townTex } from "../kit/townTex.js";

/** the world bible's spot ids (CONTRACT addendum (d)) -> our places */
export const SPOT_PLACE = Object.freeze({ main_street: "street", square: "school", market: "street", deck: "deck", stairs: "stairs", rooftop: "rooftop", school: "school", home: "room", classroom: "classroom", outside_on: "street" });
export const PLACES = Object.freeze(["street", "deck", "stairs", "rooftop", "school", "room", "classroom"]);
// words in a line -> a place: lib/worldBible.js placeFor (pure; the planner sets shot.place with it)
export { placeFor } from "../../lib/worldBible.js";

export function addPlaces(S, { ctx, K, world, plan, surface, toWorld, seed = 1 }) {
  const { THREE } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = (x, z, d = 0) => surface(x, z) ?? d;
  const plankM = new THREE.MeshStandardMaterial({ map: townTex(THREE, "planks", { color: "#a07850", seed: 11 }), roughness: 0.85 });
  const darkM = new THREE.MeshStandardMaterial({ color: "#5a3e28", roughness: 0.8 });
  const add = (geo, mat, x, y, z, ry = 0, parent = world) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; m.userData.placeProp = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = world) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, parent);
  const base = { spots: Object.fromEntries(Object.entries(S.spots).map(([k, v]) => [k, v.clone()])), camDir: S.camDir.clone(), bounds: S.bounds.map((b) => b.clone()) };
  const P = { street: base };
  const placeSpots = (c, { lat = V(1, 0, 0), dep = V(0, 0, -1), yAt = (p) => Y(p.x, p.z, c.y), far = 20, door = null } = {}) => {
    const at = (dx, dz) => { const p = c.clone().addScaledVector(lat, dx).addScaledVector(dep, dz); p.y = yAt(p); return p; };
    return { center: c.clone(), left: at(-1.2, 0.3), right: at(1.2, 0.3), back: at(0, 2.2), far: at(0, far), door: door ?? at(0, 4), horizon: base.spots.horizon.clone(), head: base.spots.head.clone(), tail: base.spots.tail.clone() };
  };
  // houses on the main street, in world space, nearest the centre first (ahead of the camera: z < 0)
  const main = plan.houses.filter((h) => h.street === 0).map((h) => ({ h, w: toWorld(h.x, h.y, h.z) })).sort((a, b) => Math.abs(a.w.z + 10) - Math.abs(b.w.z + 10));
  // DECK: a raised plank deck in front of a house on the main street (rail on the street side, two steps)
  if (main[0]) {
    const { h, w } = main[0], sgn = Math.sign(w.x) || 1, front = w.x - sgn * (h.d / 2), gy = Y(front - sgn * 1.4, w.z, 0), dy = gy + 0.8;
    const cx = front - sgn * 1.4;
    box(2.8, 0.25, h.w * 0.95, plankM, cx, dy, w.z);
    for (const e of [-1, 1]) for (const f of [-1, 1]) box(0.2, 0.8, 0.2, darkM, cx + e * 1.25, gy + 0.4, w.z + f * h.w * 0.45);
    box(0.1, 0.9, h.w * 0.95, darkM, cx - sgn * 1.35, dy + 0.55, w.z); box(0.12, 0.12, h.w * 0.95, plankM, cx - sgn * 1.35, dy + 1.0, w.z);
    for (let k = 0; k < 3; k++) box(0.6, 0.27 * (k + 1), 1.4, plankM, cx - sgn * (1.7 + 0.3 * (2 - k)), gy + 0.135 * (k + 1), w.z + h.w * 0.25);
    box(0.7, 0.7, 0.7, darkM, cx + sgn * 0.8, dy + 0.47, w.z - h.w * 0.35); // a crate
    const c = V(cx, dy + 0.13, w.z + 0.5);
    P.deck = { spots: placeSpots(c, { lat: V(0, 0, 1).multiplyScalar(0), yAt: () => dy + 0.13, far: 18, door: V(front, dy, w.z) }), camDir: V(-sgn * 0.35, 0, 1).normalize(), bounds: base.bounds };
    for (const k of ["left", "right"]) P.deck.spots[k].set(cx + (k === "left" ? -0.5 : 0.5) * sgn, dy + 0.13, w.z + (k === "left" ? 1.6 : -0.8));
  }
  // STAIRS: an outdoor wooden staircase up the street side of the next house, rising away from the camera to a landing
  if (main[1]) {
    const { h, w } = main[1], sgn = Math.sign(w.x) || 1, front = w.x - sgn * (h.d / 2), sx = front - sgn * 0.9, gy = Y(sx, w.z, 0);
    const top = gy + Math.max(3.2, h.h * 0.85), z0 = w.z + h.w / 2 + 1.5, z1 = w.z - h.w / 2 + 1.2, n = Math.max(8, Math.round((top - gy) / 0.25));
    const stepG = new THREE.BoxGeometry(1.4, 0.12, ((z0 - z1) / n) * 1.05);
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; add(stepG, plankM, sx, gy + (top - gy) * u, z0 + (z1 - z0) * u); }
    box(0.12, 0.12, Math.hypot(z0 - z1, top - gy), darkM, sx - sgn * 0.75, (gy + top) / 2 + 0.95, (z0 + z1) / 2).rotation.x = Math.atan2(top - gy, z0 - z1);
    box(1.6, 0.2, 1.8, plankM, sx, top, z1 - 0.9); box(0.25, top - gy, 0.25, darkM, sx - sgn * 0.7, (gy + top) / 2, z1 - 1.6);
    const yAt = (p) => { const u = Math.min(1, Math.max(0, (z0 - p.z) / (z0 - z1))); return gy + (top - gy) * u + 0.06; };
    const c = V(sx, 0, z0 - (z0 - z1) * 0.3); c.y = yAt(c);
    P.stairs = { spots: placeSpots(c, { lat: V(0, 0, 0), yAt, far: (z0 - z1) * 0.65 }), camDir: V(-sgn * 0.5, 0, 1).normalize(), bounds: base.bounds };
    P.stairs.spots.back = V(sx, yAt({ z: z0 - (z0 - z1) * 0.6 }), z0 - (z0 - z1) * 0.6); P.stairs.spots.far = V(sx, top + 0.1, z1 - 0.9);
    P.stairs.spots.left = V(sx, yAt({ z: z0 - (z0 - z1) * 0.18 }), z0 - (z0 - z1) * 0.18); P.stairs.spots.right = V(sx, yAt({ z: z0 - (z0 - z1) * 0.42 }), z0 - (z0 - z1) * 0.42);
  }
  // ROOFTOP: a plank walkway with rails over the roofs of a row of houses (the town all round, the creature's head ahead)
  const row = plan.houses.filter((h) => h.street === 0 && h.side === 1).map((h) => ({ h, w: toWorld(h.x, h.y, h.z) })).filter((o) => o.w.z < 12 && o.w.z > -40);
  if (row.length) {
    const x = row[0].w.x, ry = Math.max(...row.map((o) => o.w.y + o.h.h + Math.min(o.h.d * 0.6, 3.6 * plan.scale))) + 0.3;
    const zA = Math.max(...row.map((o) => o.w.z + o.h.w / 2)), zB = Math.min(...row.map((o) => o.w.z - o.h.w / 2));
    box(2.2, 0.2, zA - zB, plankM, x, ry, (zA + zB) / 2);
    for (const e of [-1, 1]) { box(0.08, 0.08, zA - zB, darkM, x + e * 1.05, ry + 1.0, (zA + zB) / 2); for (let z = zB; z < zA; z += 2.2) box(0.1, 1.0, 0.1, darkM, x + e * 1.05, ry + 0.5, z); }
    for (let z = zB; z < zA; z += 4.5) box(0.25, ry - Y(x, z, 0), 0.25, darkM, x, (ry + Y(x, z, 0)) / 2, z);
    const c = V(x, ry + 0.1, Math.min(zA - 3, 2));
    P.rooftop = { spots: placeSpots(c, { lat: V(0, 0, 0), yAt: () => ry + 0.1, far: Math.max(4, c.z - zB - 2) }), camDir: V(0.25, 0, 1).normalize(), bounds: [new THREE.Box3(V(-80, -400, -160), V(80, 200, 60))] };
    P.rooftop.spots.left = V(x - 0.5, ry + 0.1, c.z + 0.6); P.rooftop.spots.right = V(x + 0.5, ry + 0.1, c.z - 0.6);
  }
  // SCHOOL: the yard on the street in front of the school landmark (its sign readable behind the kids)
  const L = (plan.landmarks ?? []).find((l) => l.name === "school") ?? (plan.landmarks ?? [])[0];
  if (L) {
    // WORLD-FIX-2 2026-11-07 (owner: "school day" was a blank yellow wall, the camera inside a building): the camera
    // looked ACROSS the narrow street (it stood in the houses opposite). Now the kids stand in the street beside the
    // school's front, the camera stands down the street (toward the tail, the street is long and free) looking up it at
    // a slant toward the school side: the kids in front, the SCHOOL facade + sign along the side of the frame behind them
    const lw = toWorld(L.x, L.y, L.z), sgn = Math.sign(lw.x) || 1, half = plan.street?.half ?? 3;
    const c = V(sgn * half * 0.25, 0, lw.z + (L.w ?? 10) * 0.35); c.y = Y(c.x, c.z, 0);
    const dep = V(sgn * 0.12, 0, -1).normalize(); // up the street, past the school
    P.school = { spots: placeSpots(c, { lat: V(-dep.z, 0, dep.x), dep, far: 14 }), camDir: V(-sgn * 0.42, 0, 1).normalize(), bounds: base.bounds, school: lw.clone() };
    P.school.framing = { medium: 1.5, wide: 1.6 };
  }
  // INTERIORS: a room and a classroom (closed boxes far below the land; a warm light each, a bright window)
  const interior = (name, at, build) => {
    const g = new THREE.Group(); g.name = `place:${name}`; g.position.copy(at); S.root.add(g);
    const W = 7, D = 7.5, H = 3.2;
    const floorM = new THREE.MeshStandardMaterial({ map: townTex(THREE, "planks", { color: "#b48a5e", seed: 21 }), roughness: 0.8 });
    const wallM = new THREE.MeshStandardMaterial({ map: townTex(THREE, name === "classroom" ? "plaster" : "timber", { color: name === "classroom" ? "#f0e6c8" : "#f4ead2", seed: 22 }), roughness: 0.9, side: THREE.DoubleSide });
    box(W, 0.2, D, floorM, 0, -0.1, 0, 0, g); box(W, 0.2, D, wallM, 0, H, 0, 0, g);
    box(W, H, 0.2, wallM, 0, H / 2, -D / 2, 0, g); box(0.2, H, D, wallM, -W / 2, H / 2, 0, 0, g); box(0.2, H, D, wallM, W / 2, H / 2, 0, 0, g);
    const winM = new THREE.MeshBasicMaterial({ color: "#cfe8ff" });
    box(0.05, 1.3, 1.8, winM, W / 2 - 0.12, 1.7, -1.2, 0, g); box(0.05, 1.3, 1.8, winM, -W / 2 + 0.12, 1.7, 0.8, 0, g);
    const lamp = new THREE.PointLight("#ffd9a0", 14, 14, 1.6); lamp.position.set(0, H - 0.4, 0.5); g.add(lamp);
    build(g, { W, D, H, box: (w, h, d, m, x, y, z, r = 0) => box(w, h, d, m, x, y, z, r, g) });
    g.visible = false;
    const c = at.clone().add(V(0, 0, 0.6));
    return { group: g, spots: placeSpots(c, { yAt: () => at.y, far: 2.8, door: at.clone().add(V(W / 2 - 1, 0, 2)) }), camDir: V(0, 0, 1), bounds: [new THREE.Box3(at.clone().add(V(-W / 2 + 0.3, 0.3, -D / 2 + 0.3)), at.clone().add(V(W / 2 - 0.3, H - 0.3, D / 2 + 1.5)))], indoor: true };
  };
  const deep = S.groundY - 260;
  P.room = interior("room", V(-40, deep, 0), (g, { box: b, W, D }) => {
    const wood = new THREE.MeshStandardMaterial({ color: "#8a5a3a", roughness: 0.7 }), quilt = new THREE.MeshStandardMaterial({ color: "#d0603a", roughness: 0.9 }), rug = new THREE.MeshStandardMaterial({ color: "#4f7aa8", roughness: 1 });
    b(2.1, 0.45, 1.3, wood, -W / 2 + 1.3, 0.25, -D / 2 + 1.6); b(1.9, 0.18, 1.2, quilt, -W / 2 + 1.3, 0.55, -D / 2 + 1.6); b(0.6, 0.15, 1.0, new THREE.MeshStandardMaterial({ color: "#fff8ee" }), -W / 2 + 0.55, 0.65, -D / 2 + 1.6);
    b(1.2, 0.08, 0.8, wood, 1.6, 0.78, -D / 2 + 1.2); for (const e of [-1, 1]) for (const f of [-1, 1]) b(0.08, 0.76, 0.08, wood, 1.6 + e * 0.5, 0.38, -D / 2 + 1.2 + f * 0.3);
    b(1.6, 1.9, 0.4, wood, W / 2 - 1.0, 0.95, -D / 2 + 0.3); b(2.6, 0.02, 1.8, rug, 0, 0.01, 0.2);
  });
  P.classroom = interior("classroom", V(40, deep, 0), (g, { box: b, D }) => {
    const desk = new THREE.MeshStandardMaterial({ color: "#c09060", roughness: 0.7 }), board = new THREE.MeshStandardMaterial({ color: "#2f4a3a", roughness: 0.9 });
    b(4.2, 1.5, 0.08, board, 0, 1.6, -D / 2 + 0.15);
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 180; const x2 = cv.getContext("2d"); x2.fillStyle = "#2f4a3a"; x2.fillRect(0, 0, 512, 180); x2.fillStyle = "#f4f4e8"; x2.font = "bold 70px Arial"; x2.textAlign = "center"; x2.fillText("2 + 3 = 5", 256, 115);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const txt = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })); txt.position.set(0, 1.6, -D / 2 + 0.2); g.add(txt);
    for (const r of [0, 1]) for (const c of [-1, 0, 1]) { b(1.0, 0.06, 0.6, desk, c * 1.9, 0.72, -1.2 + r * 1.9); for (const e of [-1, 1]) b(0.06, 0.7, 0.5, desk, c * 1.9 + e * 0.45, 0.36, -1.2 + r * 1.9); }
  });
  // WORLD-FIX-2: the town's buildings as solid boxes (world space, rest pose): the street camera never stands inside one
  const solids = [...plan.houses, ...(plan.landmarks ?? [])].map((h) => {
    const w = toWorld(h.x, h.y, h.z), cs = Math.abs(Math.cos(h.ry ?? 0)), sn = Math.abs(Math.sin(h.ry ?? 0));
    return { x: w.x, z: w.z, hx: (cs * h.w + sn * h.d) / 2 + 0.25, hz: (sn * h.w + cs * h.d) / 2 + 0.25, y0: w.y - (h.sink ?? 0) - 0.5, y1: w.y + h.h * 1.6 + 0.5 };
  });
  S.solidAt = (p) => { if (S.indoor) return false; const q = world.worldToLocal(p.clone()); return solids.some((b) => Math.abs(q.x - b.x) < b.hx && Math.abs(q.z - b.z) < b.hz && q.y > b.y0 && q.y < b.y1); };
  for (const [k, p] of Object.entries(P)) p.name = k;
  S.places = P;
  let cur = "street";
  const apply = (p) => {
    for (const k of Object.keys(S.spots)) if (p.spots[k]) S.spots[k].copy(p.spots[k]);
    S.camDir.copy(p.camDir);
    S.bounds.length = 0; S.bounds.push(...p.bounds);
    S.indoor = !!p.indoor;
    S.framing = p.framing ?? (p.indoor ? { medium: 1.5, wide: 1.0 } : { medium: 1.8, wide: 1.5, closeup: 1.2 }); // WORLD-FIX: the place in frame
    const d = S.spots.far.clone().sub(S.spots.center).setY(0);
    if (S.depth && d.lengthSq() > 1e-4) { S.depth.copy(d.normalize()); S.lateral?.set(-S.depth.z, 0, S.depth.x); }
    for (const q of Object.values(P)) if (q.group) q.group.visible = q === p;
  };
  S.setPlace = (name0, shot = null) => {
    // shot.onCreature: walkTilt false = the creature stands still (no rock); tiltDeg scales the gentle rock (~1.3 deg = 1)
    const oc = shot?.onCreature; S.tiltK = oc ? (oc.walkTilt === false ? 0 : Number.isFinite(oc.tiltDeg) ? Math.min(2.5, Math.max(0, oc.tiltDeg / 1.3)) : 1) : 1;
    const name = SPOT_PLACE[name0] ?? name0;
    const n = P[name] ? name : "street";
    if (n === cur && S._placeApplied) return;
    cur = n; S._placeApplied = true; apply(P[n]);
  };
  void K; void seed;
  return P;
}
