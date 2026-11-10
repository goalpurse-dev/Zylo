// Blocky Worlds SIMPLE LOOK places (production): the approved test's bright box town (page/simple/simple.js: road with
// double yellow centre lines, white edges, a zebra crossing, sidewalks + curbs, colourful gable / flat-roof houses,
// real shop signs, street lamps, blocky clouds, green grass, blue sky) + the owner's additions (2026-11-10):
//   - CLOUD TREES: bumpy ball canopies of several overlapping spheres on brown trunks (a few cube bushes stay)
//   - STREET DRESSING per lot, seeded: white picket fences, mailboxes, flower boxes under the windows, bushes, porches
//     with steps, benches
// The town is one world per story (permanent rule): its shops come from the world bible (tl.world.town.buildings: a
// building of a shop kind gets its real shop sign, e.g. BAKERY, SCHOOL); the seed is the bible's town seed.
// Layout (metres): the road along x (z = 0, 7.5 m wide); the north sidewalk z -3.75 .. -6.75 is where people stand
// (spots at z -5.3), facing +z; the north house fronts at z -10.5; the south row mirrored behind the camera.
import * as THREE from "three";
import { mat, box, rbox, ball, cyl, canvasTex, seeded, BOX } from "./common.js";

export const ROAD_W = 7.5, FRONT = -10.5, SW = -4.9;
const PALETTE = [
  { wall: "#ffd36b", roof: "#e0524a", door: "#2f78d8" },
  { wall: "#8fd0ff", roof: "#3b5b9a", door: "#ffb02e" },
  { wall: "#ff9fb8", roof: "#7a4bb3", door: "#ffffff" },
  { wall: "#b6f08a", roof: "#c0472f", door: "#7a3fd1" },
  { wall: "#ffffff", roof: "#2f9e8f", door: "#e04848" },
  { wall: "#ffb26b", roof: "#4b5fc9", door: "#2fa86b" },
];
// a building kind of the bible that is a real shop / public building -> its sign word (never a rule / word sign)
const SHOP_SIGN = { bakery: "BAKERY", school: "SCHOOL", cafe: "CAFE", diner: "DINER", market: "MARKET", shop: "SHOP", store: "STORE", library: "LIBRARY", bank: "BANK", post: "POST OFFICE", pharmacy: "PHARMACY", toyshop: "TOY SHOP", toys: "TOY SHOP", butcher: "BUTCHER", florist: "FLOWERS", barber: "BARBER", hall: "TOWN HALL", fire: "FIRE STATION", police: "POLICE", hospital: "HOSPITAL", museum: "MUSEUM", theater: "THEATER", cinema: "CINEMA", pizza: "PIZZA", icecream: "ICE CREAM" };
export function shopSignOf(b) {
  if (!b) return null;
  if (typeof b.sign === "string" && b.sign.trim() && b.sign.length <= 14) return b.sign.trim().toUpperCase();
  const k = String(b.kind ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (SHOP_SIGN[k]) return SHOP_SIGN[k];
  const n = String(b.name ?? "").toLowerCase();
  for (const [w, s] of Object.entries(SHOP_SIGN)) if (new RegExp(`\\b${w}`).test(n)) return s;
  return null;
}

/** the shared kit for one place: glow materials (switch at night), lamps, camera blockers */
function placeKit(root) {
  const K = { root, glow: [], lamps: [], blockers: [], clutter: [], windows: [] };
  K.glass = () => { const m = new THREE.MeshStandardMaterial({ color: "#8fd3ff", roughness: 0.35 }); m.userData.night = { emissive: "#ffc864", ei: 2.6 }; m.userData.window = true; K.glow.push(m); K.windows.push(m); return m; };
  return K;
}

// ------------------------------------------------------------------------------------------------ sky + clouds
export function makeSky(root) {
  const U = { top: { value: new THREE.Color("#2f7fe8") }, hor: { value: new THREE.Color("#aad8ff") } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = pow(clamp(vP.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(hor, top, t), 1.0); }",
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; root.add(sky);
  const cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#ffffff", emissiveIntensity: 0.45 });
  const cloud = (x, y, z, s) => { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); for (const [w, h, d, px, py, pz] of [[8, 2.6, 4, 0, 0, 0], [5, 2.4, 3.6, -4.5, -0.3, 0.4], [5.5, 3.2, 3.8, 2.8, 0.9, -0.2], [4, 2, 3, 6, -0.4, 0.3], [3.6, 2.2, 3.2, -1.5, 1.4, 0.2]]) box(g, [w, h, d], [px, py, pz], cloudM, { cast: false, receive: false }); root.add(g); };
  for (const c of [[-60, 46, -150, 2.2], [40, 58, -190, 2.8], [-20, 38, -110, 1.6], [90, 44, -120, 2], [-120, 60, -60, 2.6], [-90, 40, 40, 2], [10, 52, 160, 2.4], [120, 50, 60, 2.2]]) cloud(...c);
  return { uniforms: U, cloudM };
}

// ------------------------------------------------------------------------------------------------ trees + bushes (owner: round puffy "cloud" trees)
const LEAF = ["#43b83a", "#58cc45", "#36a332", "#4fc23c"];
/** a cloud tree: a brown trunk (+ 2 short branches) under a bumpy canopy of 5-8 overlapping balls, seeded */
export function cloudTree(parent, x, z, s = 1, seed = 1) {
  const R = seeded(seed * 7919 + 13);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * Math.PI * 2; parent.add(g);
  const trunk = mat("#8a5a34", { rough: 0.85 });
  const th = 2.2 + R() * 0.6;
  cyl(g, 0.24, 0.32, th, [0, th / 2, 0], trunk, { seg: 8 });
  for (const s2 of [-1, 1]) { const b = cyl(g, 0.1, 0.14, 1.1, [s2 * 0.35, th - 0.2, 0], trunk, { seg: 6 }); b.rotation.z = -s2 * 0.7; }
  const base = mat(LEAF[Math.floor(R() * 4)], { rough: 0.85 });
  const cy = th + 1.25;
  ball(g, 1.55, [0, cy, 0], base, { sy: 0.92 });
  const n = 5 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.5, rr = 0.9 + R() * 0.45;
    ball(g, 0.75 + R() * 0.45, [Math.cos(a) * rr, cy + R() * 0.9 - 0.25, Math.sin(a) * rr], mat(LEAF[(i + 1) % 4], { rough: 0.85 }), { sy: 0.9 });
  }
  ball(g, 0.9 + R() * 0.3, [R() * 0.4 - 0.2, cy + 1.05, R() * 0.4 - 0.2], base, { sy: 0.85 });
  return g;
}
export function cubeBush(parent, x, z, s = 1, color = "#3fae3a", y = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  rbox(g, [1.0, 0.85, 1.0], [0, 0.42, 0], mat(color, { rough: 0.85 }), 0.12);
  rbox(g, [0.6, 0.5, 0.6], [0.25, 0.85, 0.1], mat(color, { rough: 0.85 }), 0.1);
  return g;
}
export function roundBush(parent, x, z, s = 1, seed = 1, y = 0) {
  const R = seeded(seed * 31 + 7);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  for (let i = 0; i < 3; i++) ball(g, 0.45 + R() * 0.15, [(i - 1) * 0.45, 0.4, R() * 0.2 - 0.1], mat(LEAF[i % 4], { rough: 0.85 }), { sy: 0.85 });
  return g;
}

// ------------------------------------------------------------------------------------------------ street furniture
export function lamp(K, parent, x, z, face) {
  const pole = mat("#3a3f4a", { rough: 0.6 });
  const bulb = new THREE.MeshStandardMaterial({ color: "#fff4c8", roughness: 0.5 }); bulb.userData.night = { emissive: "#ffe9a8", ei: 6 }; K.glow.push(bulb);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; parent.add(g);
  box(g, [0.5, 0.3, 0.5], [0, 0.15, 0], pole); box(g, [0.18, 4.6, 0.18], [0, 2.4, 0], pole);
  box(g, [0.14, 0.14, 1.3], [0, 4.6, 0.55], pole); box(g, [0.75, 0.3, 0.75], [0, 4.5, 1.15], pole);
  box(g, [0.55, 0.16, 0.55], [0, 4.3, 1.15], bulb, { cast: false });
  (K.lampGroups ??= []).push(g);
  K.lamps.push(new THREE.Vector3(x + Math.sin(face) * 1.15, 4.1, z + Math.cos(face) * 1.15));
  return g;
}
export function bench(parent, x, y, z, rotY = 0) {
  const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = rotY; parent.add(b);
  const wood = mat("#c47a3d", { rough: 0.7 }), pole = mat("#3a3f4a", { rough: 0.6 });
  box(b, [2.4, 0.15, 0.7], [0, 0.55, 0], wood); box(b, [2.4, 0.6, 0.12], [0, 0.95, -0.33], wood);
  for (const s of [-1, 1]) box(b, [0.12, 0.55, 0.6], [s * 1.0, 0.27, 0], pole);
  return b;
}
export function mailbox(parent, x, z, color = "#e23b3b", rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  box(g, [0.12, 1.0, 0.12], [0, 0.5, 0], mat("#5a3b24", { rough: 0.7 }));
  rbox(g, [0.5, 0.45, 0.75], [0, 1.2, 0], mat(color, { rough: 0.5 }), 0.08);
  box(g, [0.06, 0.3, 0.06], [0.28, 1.35, -0.2], mat("#ffd23a", { rough: 0.5 })); // the flag
  return g;
}
/** a white picket fence from x0 to x1 at z (gap: [g0, g1] for the garden path) */
export function picketFence(parent, x0, x1, z, gap = null) {
  const white = mat("#fbfbf7", { rough: 0.75 });
  const g = new THREE.Group(); parent.add(g);
  const segs = gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
  for (const [a, b] of segs) {
    if (b - a < 0.3) continue;
    for (const y of [0.35, 0.72]) box(g, [b - a, 0.09, 0.06], [(a + b) / 2, y, z], white);
    for (let x = a + 0.1; x <= b - 0.05; x += 0.32) { box(g, [0.12, 0.95, 0.05], [x, 0.475, z + 0.04], white); box(g, [0.085, 0.085, 0.05], [x, 0.98, z + 0.04], white, { rot: [0, 0, Math.PI / 4] }); }
  }
  return g;
}
export function flowerBox(parent, x, y, z, w = 1.6, seed = 1) {
  const R = seeded(seed * 17 + 3);
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  box(g, [w, 0.3, 0.38], [0, 0, 0], mat("#b0622e", { rough: 0.8 }));
  for (let i = 0; i < Math.round(w / 0.24); i++) {
    const fx = -w / 2 + 0.14 + i * 0.24;
    box(g, [0.18, 0.16, 0.18], [fx, 0.22, 0], mat("#3fae3a", { rough: 0.85 }), { cast: false });
    box(g, [0.14, 0.14, 0.14], [fx + 0.03, 0.34, 0.03], mat(R.pick(["#ff5c8a", "#ffd23a", "#ffffff", "#ff8a1f", "#b06cff"]), { rough: 0.6 }), { cast: false });
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ houses
function windowAt(K, g, x, y, z, w = 1.3, h = 1.4) {
  const frame = mat("#ffffff", { rough: 0.7 });
  box(g, [w + 0.24, h + 0.24, 0.12], [x, y, z + 0.04], frame, { cast: false });
  const gm = K.glass(); box(g, [w, h, 0.1], [x, y, z + 0.09], gm, { cast: false });
  (g.userData.wins ??= []).push({ x, y, z: z + 0.09, w, h, glass: gm });
  box(g, [0.09, h, 0.06], [x, y, z + 0.16], frame, { cast: false });
  box(g, [w, 0.09, 0.06], [x, y, z + 0.16], frame, { cast: false });
  box(g, [w + 0.5, 0.12, 0.3], [x, y - h / 2 - 0.16, z + 0.15], frame, { cast: false });
}
function doorAt(K, g, x, z, color, { w = 1.25, h = 2.35 } = {}) {
  const frame = mat("#ffffff", { rough: 0.7 });
  box(g, [w + 0.3, h + 0.2, 0.12], [x, h / 2 + 0.05, z + 0.04], frame, { cast: false });
  box(g, [w, h, 0.14], [x, h / 2, z + 0.08], mat(color, { rough: 0.6 }), { cast: false });
  box(g, [w - 0.36, 0.5, 0.05], [x, h - 0.45, z + 0.16], K.glass(), { cast: false });
  box(g, [0.12, 0.12, 0.12], [x + w / 2 - 0.22, h / 2, z + 0.2], mat("#ffd23a", { rough: 0.4 }), { cast: false });
}
function gableRoof(g, w, d, y, color, over = 0.45) {
  const hh = d * 0.38;
  const shape = new THREE.Shape([new THREE.Vector2(-d / 2 - over, 0), new THREE.Vector2(d / 2 + over, 0), new THREE.Vector2(0, hh + over * 0.4)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + over * 2, bevelEnabled: false });
  geo.translate(0, 0, -(w + over * 2) / 2);
  const m = new THREE.Mesh(geo, mat(color, { rough: 0.85 }));
  m.rotation.y = Math.PI / 2; m.position.y = y; m.castShadow = m.receiveShadow = true;
  g.add(m);
}
const SIGNS = new Map();
function shopSign(K, g, text, [x, y, z], { w = 4, h = 0.95, bg = "#ffffff", fg = "#1f2a44", border = "#1f2a44" } = {}) {
  const key = `${text}|${bg}|${fg}|${border}|${w}|${h}`;
  let face = SIGNS.get(key);
  if (!face) {
    const tex = canvasTex(1024, Math.round((1024 * h) / w), (c, W, H) => {
      c.fillStyle = border; c.fillRect(0, 0, W, H);
      c.fillStyle = bg; c.fillRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
      c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
      let fs = Math.round(H * 0.62); c.font = `900 ${fs}px "Arial Black", "Arial", sans-serif`;
      while (c.measureText(text).width > W * 0.88 && fs > 20) { fs -= 4; c.font = `900 ${fs}px "Arial Black", "Arial", sans-serif`; }
      c.fillText(text, W / 2, H * 0.54);
    });
    face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    face.userData.night = { emissive: "#ffffff", ei: 0.5, emissiveMap: tex };
    SIGNS.set(key, face);
  }
  K.glow.push(face);
  const bm = mat(border);
  const b = new THREE.Mesh(BOX, [bm, bm, bm, bm, face, bm]);
  b.scale.set(w, h, 0.18); b.position.set(x, y, z); b.castShadow = true;
  g.add(b);
}
function awning(g, x, y, z, w, c1, c2) {
  const tex = canvasTex(512, 64, (c, W, H) => { const n = 10; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect((i * W) / n, 0, W / n + 1, H); } });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const a = new THREE.Mesh(BOX, m); a.scale.set(w, 0.12, 1.6); a.position.set(x, y, z + 0.75); a.rotation.x = 0.32; a.castShadow = true; g.add(a);
  const val = new THREE.Mesh(BOX, m); val.scale.set(w, 0.35, 0.06); val.position.set(x, y - 0.42, z + 1.52); g.add(val);
}
/** a house: front at local z = +d/2, faces +z; dressed per lot (seeded): porch + steps, flower boxes, fence, mailbox, bushes */
function house(K, parent, x, z, face, { w = 7, d = 7, floors = 2, wall, roof, door, flat = false, dress = true, seed = 1, yardDepth = 3.0 } = {}) {
  const R = seeded(seed);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; parent.add(g); g.name = "house";
  if (face === 0) (K.northHouses ??= []).push(g); else (K.southHouses ??= []).push(g);
  g.userData.lotX = x; g.userData.w = w; g.userData.fz = d / 2;
  const H = floors * 3.1 + 0.3;
  const body = box(g, [w, H, d], [0, H / 2, 0], mat(wall)); body.userData.camBlock = true; K.blockers.push(body);
  box(g, [w + 0.2, 0.3, d + 0.2], [0, 0.15, 0], mat("#e9e4da"));
  const fz = d / 2;
  if (flat) box(g, [w + 0.3, 0.5, d + 0.3], [0, H + 0.25, 0], mat(roof));
  else { box(g, [w + 0.25, 0.25, d + 0.25], [0, H, 0], mat("#ffffff", { rough: 0.8 })); gableRoof(g, w, d, H + 0.1, roof); }
  const dx = -w * 0.18;
  doorAt(K, g, dx, fz, door);
  windowAt(K, g, w * 0.24, 1.75, fz);
  for (let f = 1; f < floors; f++) { windowAt(K, g, -w * 0.22, 1.75 + f * 3.1, fz); windowAt(K, g, w * 0.24, 1.75 + f * 3.1, fz); }
  box(g, [1.6, 0.05, yardDepth + 0.2], [dx, 0.03, fz + yardDepth / 2 + 0.2], mat("#cfd2d6"), { cast: false }); // the garden path
  if (!dress) return { g, H, fz, w, dx };
  // a porch with steps (half the houses): a deck, two posts, a little roof
  if (R() < 0.55) {
    const pw = 2.4, wood = mat("#f3e6cf", { rough: 0.8 }), post = mat("#ffffff", { rough: 0.7 });
    box(g, [pw, 0.35, 1.5], [dx, 0.175, fz + 0.75], wood);
    for (let k = 0; k < 2; k++) box(g, [1.4, 0.17, 0.35], [dx, 0.085 + (k === 0 ? 0 : 0.17), fz + 1.5 + 0.35 * (1 - k) + 0.175], mat("#d9cbb2", { rough: 0.8 }));
    for (const s of [-1, 1]) box(g, [0.16, 2.6, 0.16], [dx + s * (pw / 2 - 0.12), 1.65, fz + 1.38], post);
    box(g, [pw + 0.4, 0.18, 1.8], [dx, 3.0, fz + 0.85], mat(roof, { rough: 0.85 }));
  } else box(g, [2.2, 0.16, 0.9], [dx, 0.08, fz + 0.5], mat("#c9ccd2"));
  // flower boxes under the ground-floor window (and the upper ones sometimes)
  flowerBox(g, w * 0.24, 1.75 - 0.7 - 0.32, fz + 0.32, 1.7, seed);
  if (floors > 1 && R() < 0.5) flowerBox(g, -w * 0.22, 1.75 + 3.1 - 0.7 - 0.32, fz + 0.32, 1.7, seed + 5);
  // the front yard: a picket fence along the sidewalk (gap at the path), a mailbox at the path, bushes along the wall
  const fenceZ = fz + yardDepth;
  if (R() < 0.8) picketFence(g, -w / 2 - 0.4, w / 2 + 0.4, fenceZ, [dx - 0.9, dx + 0.9]);
  mailbox(g, dx + 1.35, fenceZ - 0.35, R.pick(["#e23b3b", "#2f78d8", "#2fa86b", "#3a3f4a"]));
  const nb = 1 + Math.floor(R() * 3);
  for (let k = 0; k < nb; k++) {
    const bx = w * 0.24 - 1.0 + k * 1.05 + R() * 0.2;
    if (R() < 0.35) cubeBush(g, bx, fz + 0.7, 0.75 + R() * 0.25, R.pick(["#3fae3a", "#2f9a3a"]));
    else roundBush(g, bx, fz + 0.75, 0.8 + R() * 0.3, seed * 3 + k);
  }
  return { g, H, fz, w, dx };
}

// ------------------------------------------------------------------------------------------------ the street (box town)
export function buildStreet({ tl = null } = {}) {
  const root = new THREE.Group(); root.name = "set:simple-street";
  const K = placeKit(root);
  const sky = makeSky(root);
  const town = new THREE.Group(); root.add(town);
  const seed = Number(tl?.world?.town?.seed ?? tl?.world?.seed ?? 7) || 7;
  const R = seeded(seed);
  const ground = box(town, [600, 0.2, 600], [0, -0.1, 0], mat("#5ccc45"), { cast: false });
  void ground;
  box(town, [240, 0.06, ROAD_W], [0, 0.02, 0], mat("#4d525b"), { cast: false });
  const yellow = mat("#ffcf2e", { rough: 0.7 }), white = mat("#f4f4f2", { rough: 0.8 });
  for (let x = -118; x < 118; x += 4.5) { box(town, [2.6, 0.02, 0.14], [x, 0.06, -0.14], yellow, { cast: false }); box(town, [2.6, 0.02, 0.14], [x, 0.06, 0.14], yellow, { cast: false }); }
  for (const s of [-1, 1]) box(town, [240, 0.02, 0.16], [0, 0.06, s * (ROAD_W / 2 - 0.35)], white, { cast: false });
  for (let i = -3; i <= 3; i++) box(town, [0.6, 0.025, ROAD_W - 1.2], [6 + i * 1.1, 0.065, 0], white, { cast: false });
  const walk = mat("#d9dce0"), curb = mat("#b8bcc3");
  for (const s of [-1, 1]) {
    box(town, [240, 0.18, 3], [0, 0.09, s * (ROAD_W / 2 + 1.5)], walk, { cast: false });
    box(town, [240, 0.2, 0.22], [0, 0.1, s * (ROAD_W / 2 + 0.11)], curb, { cast: false });
    for (let x = -118; x < 118; x += 2.4) box(town, [0.04, 0.005, 3], [x, 0.181, s * (ROAD_W / 2 + 1.5)], curb, { cast: false });
  }
  // the bible's palette (walls) when it has one, else the approved test's
  const bw = (tl?.world?.town?.style?.walls ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const pal = (i) => ({ ...PALETTE[i % PALETTE.length] }); void bw; // the approved bright palette (bible walls read beige)
  // the shops: the bible's buildings of a shop kind (their real signs), else the approved BAKERY + SCHOOL
  const shops = (tl?.world?.town?.buildings ?? []).map((b) => ({ b, sign: shopSignOf(b) })).filter((x) => x.sign);
  const signs = shops.length ? shops.map((x) => x.sign) : ["BAKERY", "SCHOOL"];
  const school = signs.includes("SCHOOL");
  const small = signs.filter((s) => s !== "SCHOOL");
  const north = [[-34, 0], [-22, 1], [-10, 2], [14, 3], [38, 5]];
  north.forEach(([x, p], i) => house(K, town, x, FRONT - 3.5, 0, { ...pal(p), seed: seed * 13 + i * 7 }));
  // shop 1 (x = 2): the approved bakery front (pink, striped awning, big shop window), with the first shop sign
  if (small[0] || !school) {
    const b = house(K, town, 2, FRONT - 3.5, 0, { w: 8, d: 7, floors: 2, wall: "#ff8fb1", roof: "#8a4fd0", door: "#ffffff", flat: true, dress: false });
    box(b.g, [3.2, 1.9, 0.1], [1.9, 1.55, b.fz + 0.06], mat("#ffffff"), { cast: false });
    box(b.g, [2.9, 1.6, 0.1], [1.9, 1.55, b.fz + 0.1], K.glass(), { cast: false });
    awning(b.g, 0.4, 3.15, b.fz, 6.4, "#ffffff", "#ff4f7d");
    shopSign(K, b.g, small[0] ?? "BAKERY", [0, 5.55, b.fz + 0.12], { w: 5.2, h: 1.15, bg: "#fff6e8", fg: "#d6336c", border: "#7a2a4a" });
    bench(town, 6.2, 0.18, FRONT + 4.2, Math.PI);
    for (const bx of [-1.6, 5.6]) flowerBox(b.g, bx, 0.3, b.fz + 0.5, 1.4, bx * 7);
  } else house(K, town, 2, FRONT - 3.5, 0, { ...pal(4), seed: seed * 13 + 40 });
  // the school (x = 26): wide, brick red, flat roof, a bell tower; a second small shop takes the lot when there is no school
  if (school || !small[1]) {
    const s = house(K, town, 26, FRONT - 5, 0, { w: 14, d: 10, floors: 2, wall: "#e2553f", roof: "#f1efe9", door: "#2f6fd6", flat: true, dress: false, yardDepth: 4.9 });
    for (const wx of [-5, 3.8, 5.8]) windowAt(K, s.g, wx, 1.75, s.fz);
    for (const wx of [-5, -3, 1, 3.8, 5.8]) windowAt(K, s.g, wx, 4.85, s.fz);
    shopSign(K, s.g, school ? "SCHOOL" : small[1] ?? "SCHOOL", [0, 7.1, s.fz + 0.12], { w: 6.4, h: 1.3, bg: "#ffffff", fg: "#1f4fbf", border: "#1f2a44" });
    box(s.g, [3, 2.6, 3], [0, s.H + 1.8, -1], mat("#f1efe9")); box(s.g, [3.6, 0.4, 3.6], [0, s.H + 3.3, -1], mat("#2f6fd6"));
    box(s.g, [1.1, 1.1, 0.1], [0, s.H + 1.9, 0.55], mat("#ffd23a", { rough: 0.5 }));
    picketFence(town, 19.6, 32.4, FRONT + 4.0, [24.2, 26.4]);
  } else {
    const b = house(K, town, 26, FRONT - 3.5, 0, { w: 8, d: 7, floors: 2, wall: "#8fd0ff", roof: "#2f6fd6", door: "#ffffff", flat: true, dress: false });
    box(b.g, [2.9, 1.6, 0.1], [1.9, 1.55, b.fz + 0.1], K.glass(), { cast: false });
    awning(b.g, 0.4, 3.15, b.fz, 6.4, "#ffffff", "#2f9e8f");
    shopSign(K, b.g, small[1], [0, 5.55, b.fz + 0.12], { w: 5.2, h: 1.15, bg: "#ffffff", fg: "#1f4fbf", border: "#1f2a44" });
  }
  // the south row (behind the camera in the street shots; seen in the wides and reverse angles)
  [[-30, 4], [-18, 5], [-6, 0], [6, 1], [18, 2], [30, 3]].forEach(([x, p], i) => house(K, town, x, -(FRONT - 3.5), Math.PI, { ...pal(p), seed: seed * 17 + i * 11 }));
  // cloud trees: in the gaps between the houses (both rows), a park belt behind each row; a few cube bushes stay
  for (const x of [-40, -28, -16, -4, 8, 20, 46]) (K.yardTrees ??= []).push(cloudTree(town, x, FRONT - 1.2, 1.25 + R() * 0.2, seed + x));
  // bigger, closer puffy trees (owner 2026-11-10): one in each front yard corner, near the fence, beside the people
  for (const x of [-34, -22, -10, 2, 14, 26, 38]) for (const s of [-1, 1]) if (R() < 0.75) (K.yardTrees ??= []).push(cloudTree(town, x + s * (3.9 + R() * 0.6), FRONT + 1.7 + R() * 0.6, 1.3 + R() * 0.25, seed * 7 + x * 3 + s));
  for (const x of [-36, -24, -12, 0, 12, 24, 36]) cloudTree(town, x, -(FRONT - 1.2), 1, seed + x * 3);
  for (let i = 0; i < 60; i++) { const a = i * 2.39996, r = 38 + (i % 9) * 6; cloudTree(town, Math.cos(a) * r * 1.4, -24 - Math.abs(Math.sin(a)) * 40 - (i % 5) * 3, 1.15, seed + i); cloudTree(town, Math.cos(a + 1) * r * 1.4, 24 + Math.abs(Math.sin(a)) * 40 + (i % 4) * 3, 1.15, seed + i + 99); }
  for (const x of [-28, -16, -4, 8, 20, 32]) cubeBush(town, x, FRONT + 1.6, 0.9);
  // lamps (north: facing the street; south: mirrored), benches on the sidewalks
  for (let x = -42; x <= 42; x += 14) { lamp(K, town, x + 3, -(ROAD_W / 2 + 0.6), 0); lamp(K, town, x - 4, ROAD_W / 2 + 0.6, Math.PI); }
  const lampLocal = K.lamps.map((v) => v.clone());
  bench(town, -16.5, 0.18, -(ROAD_W / 2 + 2.6), 0); bench(town, 12.5, 0.18, ROAD_W / 2 + 2.6, Math.PI);
  box(town, [0.45, 0.8, 0.45], [9.5, 0.58, -(ROAD_W / 2 + 0.7)], mat("#ffcc22", { rough: 0.5 })); // a hydrant

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const S = {
    root, indoor: false, name: "street", simple: true, sky, kit: K,
    spots: { center: V(0, 0.18, SW), left: V(-1.15, 0.18, SW + 0.2), right: V(1.15, 0.18, SW + 0.2), back: V(0.3, 0.18, SW - 1.2), far: V(-22, 0.02, -1.6), door: V(-11.26, 0.2, FRONT + 0.9) },
    depthDir: V(0, 0, -1),
    camDir: V(0, 0, 1),
    views: { door: V(0.25, 0, 1).normalize() },
    bounds: [new THREE.Box3(V(-80, 0.3, -6.9), V(80, 40, 30))],
    blockers: K.blockers,
    shadow: { half: 40 },
    // the establishing view (a place shot with nobody in it): high, down the street, the town and its shops
    establish: { cam: V(38, 17, 0.5), look: V(-20, 0, -1.5), fov: 55 },
  };
  // one street, many stand points (world continuity: the same town): each line stands in front of one lot of it (the
  // town slides under the fixed spots), so the backdrop changes from line to line, never inside a line
  /** the street's own house behind the stand point stands for a planned house front (the still gate's subject) */
  S.standInHouse = (on) => { let best = null; for (const g of K.northHouses ?? []) { g.name = "house"; const d = Math.abs(g.position.x + (S.townX ?? 0)); if (!best || d < best.d) best = { g, d }; } if (on && best) best.g.name = "object:house_front:lit"; };
  const LOTS = [2, -10, 14, 26, -22, 38, -34];
  S.setPlace = (place, shot) => {
    const k = ((Number(shot?.line ?? 0) * 5 + seed) % LOTS.length + LOTS.length) % LOTS.length;
    const own = shot?.house != null ? S.owners?.[shot.house] : null;
    const x = own != null ? -own + 1.2 : shot?.line === 0 || shot?.part === "rule" ? -2 : -LOTS[k] + 1.2;
    if (town.position.x !== x) { town.position.x = x; town.updateMatrixWorld(true); K.lamps.forEach((v, i) => v.copy(lampLocal[i]).add(town.position)); }
    // no lamp post in front of the people: a north lamp within 3.5 m of the stand point steps aside (hidden) for this line
    for (const g of K.lampGroups ?? []) g.visible = !(g.position.z < 0 && Math.abs(g.position.x + x) < 3.5);
    // where a giant looms "behind" the people: the gap between two houses nearest the stand point, across the yards
    const spans = [[-34, 3.5], [-22, 3.5], [-10, 3.5], [2, 4], [14, 3.5], [26, 7], [38, 3.5]];
    let best = null;
    for (let i = 0; i + 1 < spans.length; i++) { const l = spans[i][0] + spans[i][1], r = spans[i + 1][0] - spans[i + 1][1]; if (r - l < 3) continue; const gx = (l + r) / 2 + x; if (!best || Math.abs(gx - 1.5) < Math.abs(best - 1.5)) best = gx; }
    S.loom = new THREE.Vector3(best ?? 6, 0.02, FRONT - 2.2);
    S.townX = x;
    for (const g of [...(K.yardTrees ?? [])]) g.visible = Math.abs(g.position.x + x - S.loom.x) > 2.8; // the giant stands where a yard tree would hide it
  };
  S.owners = tl?.houseOwners ?? {};
  /** each house in its own state (lib/scenes.js housesAt: cover, bricks, painting, light): curtains, bulging curtains,
   *  thin curtains, a sock, batter smears, bricked windows, a boarded painting, glowing white, dark, the eye in a window */
  S.applyHouses = (houses, night) => applyHouses(K, S, houses, night);
  const done = finishPlace(S, K), on = done.onLight;
  // a new light: the windows' own values again (applyHouses overrides them per shot)
  done.onLight = (n) => { for (const g of [...(K.northHouses ?? []), ...(K.southHouses ?? [])]) for (const w of g.userData.wins ?? []) w.glass.userData.ov = null; on(n); };
  return done;
}
function lighten(c) { const col = new THREE.Color(c); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.max(0.55, hsl.s), Math.max(0.62, hsl.l)); return `#${col.getHexString()}`; }

/** windows (null | dark | lit | open), lights (the glow switch), clutter: the shared tail of every simple place */
export function finishPlace(S, K) {
  let mode = "day", win = null, key = "";
  const apply = () => {
    const k = `${mode}|${win}`; if (k === key) return; key = k;
    const night = mode === "night" || mode === "dusk";
    for (const m of K.glow) {
      const n = m.userData.night; if (!n) continue;
      m.userData.day ??= { emissive: m.emissive.getHex(), ei: m.emissiveIntensity, map: m.emissiveMap, color: m.color.getHex() };
      let on = night;
      if (m.userData.window) on = win === "dark" ? false : win === "lit" || win === "open" ? true : night;
      if (on) { m.emissive.set(n.emissive); m.emissiveIntensity = n.ei * (night ? 1 : 0.35); if (n.emissiveMap) m.emissiveMap = n.emissiveMap; }
      else { m.emissive.setHex(m.userData.day.emissive); m.emissiveIntensity = m.userData.day.ei; m.emissiveMap = m.userData.day.map; }
      if (m.userData.window) m.color.set(win === "dark" && night ? "#1a2238" : on ? "#ffe2a8" : "#8fd3ff");
      m.needsUpdate = true;
    }
  };
  S.onLight = (name) => { mode = name; apply(); };
  S.setWindows = (state) => { const s = ["dark", "lit", "open"].includes(state) ? state : null; if (s !== win) { win = s; apply(); } };
  S.setClutter = () => {};
  S.lamps = K.lamps;
  apply();
  return S;
}

// ------------------------------------------------------------------------------------------------ per-house state dressing
const CURTAIN = ["#ff7aa2", "#ffd23a", "#5bc0be", "#b06cff", "#7bc96f", "#f9a03f"];
let BRICK = null, SOCK = null, EYE = null;
function brickMat() {
  if (BRICK) return BRICK;
  const t = canvasTex(128, 128, (c, W, H) => { c.fillStyle = "#b8452e"; c.fillRect(0, 0, W, H); c.fillStyle = "#e7d8c6"; for (let r = 0; r < 8; r++) { c.fillRect(0, r * 16, W, 2); for (let k = 0; k < 4; k++) c.fillRect(((k * 32 + (r % 2) * 16) % W), r * 16, 2, 16); } });
  BRICK = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); return BRICK;
}
function sockMat() {
  if (SOCK) return SOCK;
  const t = canvasTex(64, 128, (c, W, H) => { c.clearRect(0, 0, W, H); for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#e8323f"; c.fillRect(8, i * 15, 34, 15); } c.fillStyle = "#e8323f"; c.fillRect(8, 100, 50, 22); c.fillStyle = "#c8c8c8"; c.fillRect(2, 2, 46, 8); });
  SOCK = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7 }); return SOCK;
}
function eyeMat() {
  if (EYE) return EYE;
  const t = canvasTex(256, 256, (c, S) => { c.fillStyle = "#fff4cf"; c.beginPath(); c.arc(S / 2, S / 2, S * 0.47, 0, 7); c.fill(); c.fillStyle = "#ff8a1f"; c.beginPath(); c.arc(S / 2, S / 2, S * 0.26, 0, 7); c.fill(); c.fillStyle = "#ffd23a"; c.beginPath(); c.arc(S / 2, S / 2, S * 0.18, 0, 7); c.fill(); c.fillStyle = "#050508"; c.beginPath(); c.arc(S / 2, S / 2, S * 0.12, 0, 7); c.fill(); c.fillStyle = "#ffffff"; c.beginPath(); c.arc(S * 0.58, S * 0.42, S * 0.05, 0, 7); c.fill(); });
  EYE = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, emissive: "#fff4cf", emissiveIntensity: 0.6, emissiveMap: t }); return EYE;
}
function dressOf(g) {
  if (g.userData.dress) return g.userData.dress;
  const D = {}, wins = g.userData.wins ?? [], fz = g.userData.fz ?? 3.5, wmax = g.userData.w ?? 7;
  const grp = (name) => { const x = new THREE.Group(); x.name = name; x.visible = false; g.add(x); D[name] = x; return x; };
  const cur = grp("curtained"), bul = grp("bulging"), thin = grp("thin"), sock = grp("sock"), smear = grp("smeared"), bricks = grp("bricks"), paint = grp("painting"), eye = grp("eye");
  wins.forEach((w, i) => {
    const c = mat(CURTAIN[i % CURTAIN.length], { rough: 0.8 }), z = w.z + 0.07;
    for (const s of [-1, 1]) box(cur, [w.w * 0.34, w.h * 0.96, 0.05], [w.x + s * w.w * 0.33, w.y, z], c, { cast: false });
    box(cur, [w.w * 1.05, 0.14, 0.08], [w.x, w.y + w.h * 0.47, z + 0.02], c, { cast: false });
    for (let k = 0; k < 3; k++) { const r = rbox(bul, [w.w * 0.42, w.h * 0.36, 0.55], [w.x + (k - 1) * w.w * 0.3, w.y + (k % 2 ? 0.25 : -0.2), z + 0.25], mat(CURTAIN[(i + k) % CURTAIN.length], { rough: 0.8 }), 0.14); r.rotation.z = (k - 1) * 0.2; }
    rbox(bul, [w.w * 0.5, w.h * 0.7, 0.35], [w.x + 0.15, w.y - w.h * 0.75, z + 0.3], mat(CURTAIN[(i + 4) % CURTAIN.length], { rough: 0.8 }), 0.14);
    for (let k = 0; k < 3; k++) box(thin, [w.w * 0.1, w.h * 0.92, 0.03], [w.x + (k - 1) * w.w * 0.32, w.y, z], mat("#eef0ff", { rough: 0.8 }), { cast: false });
    for (let k = 0; k < 3; k++) ball(smear, w.w * (0.16 + 0.05 * (k % 2)), [w.x + (k - 1) * w.w * 0.28, w.y + ((k * 37) % 3 - 1) * 0.25, z + 0.04], mat("#e9c77a", { rough: 0.6 }), { sz: 0.25, cast: false });
    box(bricks, [w.w + 0.1, w.h + 0.1, 0.18], [w.x, w.y, z + 0.06], brickMat(), { cast: false });
    if (i === 0) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w.w * 0.42, w.h * 0.8), sockMat()); p.position.set(w.x, w.y + 0.05, z + 0.03); sock.add(p); for (const s of [-1, 1]) box(sock, [0.22, 0.06, 0.01], [w.x + s * w.w * 0.12, w.y + w.h * 0.42, z + 0.05], mat("#d8d8d8", { rough: 0.7 }), { cast: false }); }
    if (i === 0) { const e = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w.w, w.h) * 0.48, 40), eyeMat()); e.position.set(w.x, w.y, z + 0.22); eye.add(e); /* in front of any bricks: the eye is what the line is about */ }
  });
  // a painting of a boat on the wall beside the door, boards nailed across it
  const px = wmax * 0.02, py = 3.4, pz = fz + 0.06;
  box(paint, [1.4, 1.0, 0.06], [px, py, pz], mat("#c8a24a", { rough: 0.5 }), { cast: false });
  box(paint, [1.2, 0.5, 0.04], [px, py + 0.2, pz + 0.03], mat("#8fd3ff", { rough: 0.7 }), { cast: false });
  box(paint, [1.2, 0.3, 0.04], [px, py - 0.25, pz + 0.03], mat("#2e86de", { rough: 0.7 }), { cast: false });
  box(paint, [0.5, 0.14, 0.05], [px, py - 0.1, pz + 0.05], mat("#c0392b", { rough: 0.6 }), { cast: false });
  for (const [y, r] of [[py + 0.25, 0.08], [py, -0.05], [py - 0.25, 0.1]]) box(paint, [1.6, 0.16, 0.05], [px, y, pz + 0.08], mat("#b0753f", { rough: 0.8 }), { rot: [0, 0, r] });
  g.userData.dress = D;
  return D;
}
function applyHouses(K, S, houses, night) {
  const lotOwner = Object.fromEntries(Object.entries(S.owners ?? {}).map(([o, x]) => [x, o]));
  for (const g of [...(K.northHouses ?? []), ...(K.southHouses ?? [])]) {
    const st = houses ? houses[lotOwner[g.userData.lotX] ?? (g.rotation.y === 0 ? "" : "")] ?? houses["*"] : null;
    if (!st) { if (g.userData.dress) for (const d of Object.values(g.userData.dress)) d.visible = false; continue; }
    const D = dressOf(g);
    for (const [k, d] of Object.entries(D)) d.visible = false;
    if (D[st.cover]) D[st.cover].visible = true;
    if (st.bricks) D.bricks.visible = true;
    if (st.painting === "boarded") D.painting.visible = true;
    if (st.light === "eye") D.eye.visible = true;
    for (const w of g.userData.wins ?? []) {
      const m = w.glass;
      if (st.light !== "glow_white" && st.light !== "eye" && st.light !== "dark") { if (m.userData.ov) { m.color.copy(m.userData.ov.c); m.emissive.copy(m.userData.ov.e); m.emissiveIntensity = m.userData.ov.i; m.userData.ov = null; m.needsUpdate = true; } continue; }
      m.userData.ov ??= { c: m.color.clone(), e: m.emissive.clone(), i: m.emissiveIntensity };
      if (st.light === "glow_white" || st.light === "eye") { m.color.set("#ffffff"); m.emissive.set("#eef4ff"); m.emissiveIntensity = night ? 1.25 : 0.6; }
      else if (st.light === "dark") { m.color.set("#141a2c"); m.emissive.set("#000000"); m.emissiveIntensity = 0; }
      else continue; // default / lit: the place's own day / night windows (finishPlace)
      m.needsUpdate = true;
    }
  }
}
