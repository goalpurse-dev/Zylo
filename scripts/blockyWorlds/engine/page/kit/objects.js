// Blocky Worlds scene objects (owner: OBJECTS agent, CONTRACT.md addendum "every spoken noun gets a visual").
// Simple, chunky, readable versions of the story's nouns in the locked look: bold colours, the people kit's procedural
// fabric, Lilita text. Every object: origin on the floor at its front-centre, faces +z (it extends to -z), metres.
//   OBJECTS[name] = { aliases, height, width, place: "floor" | "street", states, state (default) }
//   makeObject(name, { state }) -> THREE.Group with userData:
//     height, width, depth            metres
//     focus     Vector3 (local)       the floor point under the object's key detail (what the camera frames)
//     frameH    number                the height to hand frameShot for focus "object" (fits the whole thing)
//     actors    "front" | "behind" | "beside" | "seat" | "bed"   where actors who share the object's spot go:
//               front  (default) the object is pushed back behind them by userData.push metres
//               behind they stand behind it (a table: the cake stays in view), userData.actorsBack metres
//               beside they stand to its sides (a storybook on a stand)
//               seat   the first one sits on userData.seat (local Vector3, height seatH) (photo_set's stool)
//               bed    babies go in at userData.bed (local Vector3 on the mattress); grown-ups stand beside (crib)
//     big       true for set-sized pieces (football_field, house_front, bakery, ice_cream_truck): the engine clears
//               the street's sidewalk props (bus shelter, bin...) while one is in the shot
//   animateObject(obj, state, t)     per frame: flashing alarm lights, bobbing balloons, the mime's hands, people
//   resolveObject(name) -> canonical name | null (aliases, spaces, plurals)
//   partyHat(seed) -> a party hat for a person's head joint (the engine puts them on birthday guests)
import * as THREE from "three";
import { bodyMotion, MOTION_STATES } from "./motion.js";
import { rng, hashSeed, cachedGeo, cachedMat, solid, fabric, rbx, bx, addMesh, canvasTex, loadKitFonts, kitFont, fitText, darker } from "./kitCommon.js";
import { makePerson, posePerson, setFace, reach } from "./people.js";
import { catalogObjects } from "../../lib/catalog.js";
import { THING_BUILD } from "./things.js";

await loadKitFonts();

export const OBJECTS = {
  ice_cream_truck: { aliases: ["ice cream truck", "ice cream van", "ice cream", "ice-cream truck", "ice cream man", "food truck"], height: 4.7, width: 4.4, place: "street", states: ["open", "mime"], state: "open" },
  football_field: { aliases: ["football field", "football team", "football", "football game", "team", "field", "stadium", "bleachers", "soccer", "game", "match"], height: 6.2, width: 6.0, place: "street", states: ["quiet"], state: "quiet" },
  birthday_party: { aliases: ["birthday party", "birthday", "party", "birthday cake", "cake", "balloons", "party table"], height: 2.6, width: 2.6, place: "floor", states: ["on"], state: "on" },
  bakery: { aliases: ["bakery", "bakery shop", "bread shop", "baker", "baker's", "bakers", "shop", "store", "cafe"], height: 4.4, width: 5.0, place: "street", states: ["open", "for_sale"], state: "open" },
  car: { aliases: ["car", "car alarm", "alarm", "vehicle", "auto"], height: 1.6, width: 3.6, place: "street", states: ["parked", "alarm"], state: "parked" },
  photo_set: { aliases: ["school photo", "photo", "photograph", "picture day", "photo day", "camera", "photo shoot", "portrait"], height: 2.6, width: 2.6, place: "floor", states: ["on"], state: "on" },
  crib: { aliases: ["crib", "cot", "cradle", "baby bed", "nursery", "baby crib"], height: 1.55, width: 1.0, place: "floor", states: ["on"], state: "on" },
  house_front: { aliases: ["house", "home", "window", "windows", "houses", "every house", "every window", "building", "house front"], height: 7.4, width: 6.4, place: "street", states: ["dark", "lit", "open", "yell"], state: "lit" },
  stories_book: { aliases: ["stories", "story", "storybook", "story book", "book of stories", "grandpa's stories", "fairy tale", "tales", "big book"], height: 1.6, width: 1.4, place: "floor", states: ["on"], state: "on" },
};
// the coverage kit (lib/catalog.js + kit/things.js): weather, town, country, home, animals, creatures, the item display
for (const [k, v] of Object.entries(catalogObjects())) if (!OBJECTS[k]) OBJECTS[k] = { aliases: v.aliases, height: v.big ? 6 : 2, width: v.big ? 5 : 1.5, place: v.place ?? "floor", states: v.states, state: v.state };

const norm = (s) => String(s ?? "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
const ALIAS = new Map();
for (const [k, v] of Object.entries(OBJECTS)) { ALIAS.set(norm(k), k); for (const a of v.aliases) if (!ALIAS.has(norm(a))) ALIAS.set(norm(a), k); }
/** the catalog name for a name or alias ("Ice cream truck", "ice_cream_truck", "balloons"...), or null */
export function resolveObject(name) {
  const n = norm(name);
  return ALIAS.get(n) ?? ALIAS.get(n.replace(/s$/, "")) ?? ALIAS.get(n.replace(/^the /, "")) ?? null;
}

// =====================================================================================================
// shared bits
// =====================================================================================================
const TAU = Math.PI * 2;
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
const cyl = (r1, r2, h, seg = 16) => cachedGeo(`ocyl${r1},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const sph = (r, w = 18, h = 12) => cachedGeo(`osph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, seg = 18) => cachedGeo(`ocone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const glowMat = (color, k, base = "#ffffff") => cachedMat(`oglow${color}${k}${base}`, () => new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: k, roughness: 0.4 }));
const gloss = (c) => solid(c, { roughness: 0.28 });
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** a canvas texture, cached by key */
const TEXC = new Map();
function ctex(key, w, h, draw) {
  let t = TEXC.get(key);
  if (!t) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); t = canvasTex(c); TEXC.set(key, t); }
  return t;
}
/** text on a board face: a plane mesh (w x h metres) */
function textPlane(text, w, h, { bg = null, ink = "#2a1d24", stroke = null, rim = null, px = 256, maxSize = 220, emissive = 0, key = "" } = {}) {
  const W = Math.round(px * (w / h)), H = px;
  const t = ctex(`txt|${text}|${w}|${h}|${bg}|${ink}|${stroke}|${rim}|${key}`, W, H, (p) => {
    if (bg) { p.fillStyle = bg; p.fillRect(0, 0, W, H); }
    if (rim) { p.strokeStyle = rim; p.lineWidth = H * 0.07; p.beginPath(); p.roundRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16, H * 0.1); p.stroke(); }
    const { lines, size } = fitText(p, text, W * 0.86, H * 0.78, { maxSize, maxLines: 2, lineGap: 1.0 });
    p.font = kitFont(size); p.textAlign = "center"; p.textBaseline = "middle"; p.lineJoin = "round";
    const y0 = H / 2 - ((lines.length - 1) * size) / 2 + size * 0.04;
    lines.forEach((l, i) => { if (stroke) { p.lineWidth = size * 0.16; p.strokeStyle = stroke; p.strokeText(l, W / 2, y0 + i * size); } p.fillStyle = ink; p.fillText(l, W / 2, y0 + i * size); });
  });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: !bg, alphaTest: bg ? 0 : 0.05, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  if (emissive) { m.emissive = new THREE.Color("#ffffff"); m.emissiveMap = t; m.emissiveIntensity = emissive; }
  const mesh = new THREE.Mesh(cachedGeo(`oplane${w},${h}`, () => new THREE.PlaneGeometry(w, h)), m);
  mesh.receiveShadow = true;
  return mesh;
}
/** vertical stripes (awnings): two colours, n stripes per texture */
const stripesV = (a, b, n = 8) => cachedMat(`ostripesV${a}${b}${n}`, () => new THREE.MeshStandardMaterial({ roughness: 0.75, map: ctex(`stripesV${a}${b}${n}`, 256, 64, (p, w, h) => { for (let i = 0; i < n; i++) { p.fillStyle = i % 2 ? b : a; p.fillRect((i * w) / n, 0, w / n + 1, h); } p.fillStyle = "rgba(0,0,0,0.06)"; for (let i = 0; i < 400; i++) p.fillRect((i * 37) % w, (i * 53) % h, 2, 2); }) }));
/** clapboard siding, 5 boards per metre (UVs in metres) */
const siding = (c) => cachedMat(`osiding${c}`, () => { const t = ctex(`siding${c}`, 128, 128, (p, w, h) => { p.fillStyle = c; p.fillRect(0, 0, w, h); const R = rng(hashSeed(c)); for (let i = 0; i < 900; i++) { p.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.04})`; p.fillRect(R() * w, R() * h, 2, 1); } for (let k = 0; k < 5; k++) { const y = (k * h) / 5; const g = p.createLinearGradient(0, y, 0, y + h / 5); g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(0.85, "rgba(0,0,0,0.0)"); g.addColorStop(1, "rgba(0,0,0,0.28)"); p.fillStyle = g; p.fillRect(0, y, w, h / 5); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }); });
/** bricks, ~4 rows per metre */
const bricks = (c) => cachedMat(`obricks${c}`, () => { const t = ctex(`bricks${c}`, 128, 128, (p, w, h) => { p.fillStyle = "#e8dccb"; p.fillRect(0, 0, w, h); const R = rng(hashSeed(c + "b")); const base = new THREE.Color(c); for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) { const x = k * 64 + (r % 2 ? 32 : 0); p.fillStyle = `#${base.clone().multiplyScalar(0.85 + R() * 0.3).getHexString()}`; p.fillRect(x + 3, r * 32 + 3, 58, 26); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); });
/** roof shingles (UVs in metres) */
const shingles = (c) => cachedMat(`oshingle${c}`, () => { const t = ctex(`shingle${c}`, 128, 128, (p, w, h) => { const base = new THREE.Color(c), R = rng(hashSeed(c + "s")); p.fillStyle = c; p.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let k = -1; k < 5; k++) { p.fillStyle = `#${base.clone().multiplyScalar(0.8 + R() * 0.35).getHexString()}`; p.fillRect(k * 32 + (r % 2 ? 16 : 0) + 1, r * 32 + 1, 30, 29); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); });
/** a box whose UVs are in metres (so tiled textures keep their scale): front face (+z) gets uvs from x,y */
function boxUV(w, h, d) { return cachedGeo(`oboxuv${w},${h},${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (ax > 0.5) uv.setXY(i, z, y); else if (ay > 0.5) uv.setXY(i, x, z); else uv.setXY(i, x, y); } return g; }); }
const wbx = (w, h, d, mat, o) => addMesh(boxUV(w, h, d), mat, o);

/** a person for an object (townsfolk, players, the mime); posed in animateObject */
function extra(g, spec, { x = 0, y = 0, z = 0, ry = 0, pose = "stand", expr = "neutral", opts = {}, phase = 0, lean = 0 } = {}) {
  const p = makePerson(spec);
  p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  setFace(p, expr);
  posePerson(p, pose, phase, opts);
  (g.userData.people ??= []).push({ p, pose, opts, phase, lean });
  return p;
}
function poseExtras(obj, t) {
  for (const e of obj.userData.people ?? []) {
    posePerson(e.p, e.pose, t + e.phase, e.opts);
    if (e.lean) e.p.userData.joints.spine.rotation.x += e.lean;
  }
}

/** a balloon on its string; the group's origin is where the string is tied (sway it with rotation) */
function balloon(color, len) {
  const g = new THREE.Group();
  const b = addMesh(sph(0.2, 20, 14), gloss(color), { y: len + 0.22, parent: g }); b.scale.set(1, 1.18, 1);
  addMesh(cone(0.04, 0.06, 8), gloss(color), { y: len - 0.01, rx: Math.PI, parent: g });
  bx(0.008, len, 0.008, solid("#f5f5f5"), { y: len / 2, parent: g, shadow: false });
  return g;
}

/** a party hat (head-local units: put it on a person's head joint at y ~0.33) */
export function partyHat(seed = 1) {
  const cols = ["#6c5ce7", "#ff6fb5", "#20bf6b", "#2e86de", "#ffb400", "#ff5e57"];
  const c = cols[seed % cols.length], g = new THREE.Group(); g.name = "partyHat";
  addMesh(cone(0.13, 0.34, 16), fabric(c, seed % 2 ? "dots" : "stripes"), { y: 0.17, parent: g });
  addMesh(sph(0.045, 10, 8), solid("#ffffff", { roughness: 0.8 }), { y: 0.35, parent: g });
  g.rotation.z = (seed % 3 - 1) * 0.12;
  return g;
}

// =====================================================================================================
// the builders: build(g, state) fills g and sets its userData
// =====================================================================================================
const BUILD = {
  // ---------------------------------------------------------------------------------------------
  ice_cream_truck(g, state) {
    const D = 2.1, zc = -D / 2;
    const pink = fabric("#ffb3c9", "cotton"), mint = fabric("#9fe8d3", "cotton"), cream = solid("#fff6e3", { roughness: 0.6 });
    const dark = solid("#26262b", { roughness: 0.55 }), chrome = solid("#dfe3e8", { metalness: 0.9, roughness: 0.25 });
    const glass = solid("#2a3d52", { roughness: 0.08, metalness: 0.3 });
    // wheels + chassis
    for (const x of [-1.45, 1.35]) for (const z of [-0.1, -D + 0.1]) {
      addMesh(cyl(0.42, 0.42, 0.28, 22), dark, { x, y: 0.42, z, rx: Math.PI / 2, parent: g });
      addMesh(cyl(0.2, 0.2, 0.3, 14), chrome, { x, y: 0.42, z, rx: Math.PI / 2, parent: g });
    }
    bx(4.2, 0.3, D - 0.3, dark, { y: 0.55, z: zc, parent: g });
    // the serving box: x -2.2..0.9, y 0.7..3.0; window x -1.75..0.45, y 1.35..2.45 on the +z side
    const X0 = -2.2, X1 = 0.9, Y0 = 0.7, Y1 = 3.0, WX0 = -1.75, WX1 = 0.45, WY0 = 1.35, WY1 = 2.45, IN = 0.95;
    const bw = X1 - X0, bxm = (X0 + X1) / 2;
    rbx(bw, Y1 - Y0, D - IN, 0.04, pink, { x: bxm, y: (Y0 + Y1) / 2, z: -IN - (D - IN) / 2, parent: g }); // back half
    bx(bw - 0.1, Y1 - Y0 - 0.1, 0.02, cachedMat("truckInside", () => new THREE.MeshStandardMaterial({ color: "#ffe7a3", emissive: "#ffd27a", emissiveIntensity: 0.35, roughness: 0.8 })), { x: bxm, y: (Y0 + Y1) / 2, z: -IN + 0.01, parent: g }); // the inside wall
    for (let k = 0; k < 4; k++) rbx(0.34, 0.26, 0.2, 0.03, solid(["#ff8fb1", "#a8ecd8", "#ffe08a", "#c7a4ff"][k], { roughness: 0.5 }), { x: WX0 + 0.35 + k * 0.5, y: WY1 - 0.32, z: -IN + 0.12, parent: g }); // tubs on a shelf
    for (const x of [X0 + 0.04, X1 - 0.04]) bx(0.08, Y1 - Y0, IN, pink, { x, y: (Y0 + Y1) / 2, z: -IN / 2, parent: g });
    bx(bw, 0.08, IN, pink, { x: bxm, y: Y1 - 0.04, z: -IN / 2, parent: g }); // roof over the open part
    bx(bw, WY0 - Y0, 0.1, pink, { x: bxm, y: (Y0 + WY0) / 2, z: -0.05, parent: g });
    bx(bw, Y1 - WY1, 0.1, pink, { x: bxm, y: (WY1 + Y1) / 2, z: -0.05, parent: g });
    bx(WX0 - X0, WY1 - WY0, 0.1, pink, { x: (X0 + WX0) / 2, y: (WY0 + WY1) / 2, z: -0.05, parent: g });
    bx(X1 - WX1, WY1 - WY0, 0.1, pink, { x: (WX1 + X1) / 2, y: (WY0 + WY1) / 2, z: -0.05, parent: g });
    bx(bw + 0.02, 0.16, 0.12, solid("#ffd84a", { roughness: 0.5 }), { x: bxm, y: 1.0, z: -0.04, parent: g }); // a yellow band
    for (let k = 0; k < 7; k++) addMesh(cachedGeo("dot", () => new THREE.CircleGeometry(0.07, 14)), solid("#ffffff"), { x: X0 + 0.25 + k * 0.45, y: 0.82, z: 0.004, parent: g, shadow: false });
    // window frame + serving counter with two cones on it
    for (const [w, h, x, y] of [[WX1 - WX0 + 0.12, 0.07, (WX0 + WX1) / 2, WY1], [0.07, WY1 - WY0, WX0, (WY0 + WY1) / 2], [0.07, WY1 - WY0, WX1, (WY0 + WY1) / 2]]) bx(w, h, 0.14, solid("#ffffff", { roughness: 0.4 }), { x, y, z: 0.0, parent: g });
    bx(WX1 - WX0 + 0.3, 0.07, 0.42, cream, { x: (WX0 + WX1) / 2, y: WY0, z: 0.08, parent: g });
    const smallCone = (x, c) => { addMesh(cone(0.07, 0.2, 12), fabric("#d99a4e", "plaid"), { x, y: WY0 + 0.14, z: 0.18, rx: Math.PI, parent: g }); addMesh(sph(0.085, 12, 10), gloss(c), { x, y: WY0 + 0.27, z: 0.18, parent: g }); };
    smallCone(WX0 + 0.25, "#ff8fb1"); smallCone(WX1 - 0.25, "#a8ecd8");
    // the sign above the window
    const sign = textPlane("ICE CREAM", 2.9, 0.5, { ink: "#ffffff", stroke: "#e84393", maxSize: 210 });
    sign.position.set(bxm, (WY1 + Y1) / 2 + 0.02, 0.003); g.add(sign);
    // the cab
    rbx(0.85, 1.85, D - 0.05, 0.06, mint, { x: 1.32, y: Y0 + 0.92, z: zc, parent: g });
    rbx(0.6, 0.85, D - 0.1, 0.06, mint, { x: 2.0, y: Y0 + 0.42, z: zc, parent: g });
    bx(0.55, 0.62, 0.03, glass, { x: 1.35, y: 2.05, z: 0.0, parent: g, shadow: false });
    bx(0.03, 0.75, D - 0.4, glass, { x: 1.76, y: 2.0, z: zc, rz: -0.18, parent: g, shadow: false });
    bx(0.08, 0.2, D, chrome, { x: 2.32, y: 0.75, z: zc, parent: g });
    for (const z of [-0.35, -D + 0.35]) bx(0.04, 0.16, 0.26, glowMat("#fff1c4", 1.5), { x: 2.31, y: 1.0, z, parent: g, shadow: false });
    addMesh(cachedGeo("horn", () => new THREE.CylinderGeometry(0.2, 0.05, 0.38, 14, 1, true)), solid("#e8e8ea", { metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }), { x: 1.35, y: Y0 + 2.05, z: -0.6, rz: -1.1, parent: g });
    // the big cone on the roof
    const cx = -0.65, cz = -1.05;
    addMesh(cone(0.46, 1.05, 20), fabric("#d99a4e", "plaid"), { x: cx, y: Y1 + 0.55, z: cz, rx: Math.PI, parent: g });
    addMesh(sph(0.52, 22, 16), gloss("#ff8fb1"), { x: cx, y: Y1 + 1.22, z: cz, parent: g });
    addMesh(cachedGeo("drip", () => new THREE.TorusGeometry(0.47, 0.08, 8, 26)), gloss("#ff8fb1"), { x: cx, y: Y1 + 1.07, z: cz, rx: Math.PI / 2, parent: g });
    addMesh(sph(0.14, 14, 10), gloss("#e3172e"), { x: cx, y: Y1 + 1.78, z: cz, parent: g });
    bx(0.03, 0.18, 0.03, solid("#4caf50"), { x: cx + 0.03, y: Y1 + 1.93, z: cz, rz: -0.4, parent: g });
    const R = rng(7), SPR = ["#ffffff", "#ffd32a", "#2e86de", "#20bf6b", "#6c5ce7"];
    for (let i = 0; i < 16; i++) { const th = R() * TAU, ph = 0.25 + R() * 1.0; bx(0.09, 0.025, 0.025, solid(SPR[i % SPR.length]), { x: cx + Math.cos(th) * Math.sin(ph) * 0.52, y: Y1 + 1.22 + Math.cos(ph) * 0.52, z: cz + Math.sin(th) * Math.sin(ph) * 0.52, ry: th, rz: R() * 3, parent: g, shadow: false }); }
    // who is at the window
    const mx = (WX0 + WX1) / 2, mz = -0.5, floor = 0.52;
    if (state === "mime") {
      const p = extra(g, { id: "mime", role: "adult", seed: 4, look: { skin: "#f7f7f5", top: "#1e1e24", pattern: "stripes", sleeve: "long", bottom: "pants", pants: "#1e1e24", pantsKind: "cotton", shoes: "#1e1e24", hair: "bald", hat: null, glasses: false, beard: null, acc: [] } }, { x: mx, y: floor, z: mz, expr: "mime" });
      const j = p.userData.joints, black = solid("#141418", { roughness: 0.8 });
      addMesh(cyl(0.19, 0.2, 0.07, 22), black, { x: 0.03, y: 0.35, z: -0.01, rz: -0.22, parent: j.head }); // the beret
      bx(0.03, 0.05, 0.03, black, { x: 0.05, y: 0.4, parent: j.head });
      bx(0.24, 0.08, 0.05, solid("#e3172e", { roughness: 0.7 }), { y: 0.52, z: 0.12, parent: j.spine }); // neckerchief
      for (const s of [-1, 1]) bx(0.04, 0.5, 0.02, black, { x: s * 0.12, y: 0.25, z: 0.135, parent: j.spine }); // braces
      g.userData.mime = p;
    } else {
      extra(g, { id: "vendor", role: "adult", seed: 12, look: { hat: "cap", hatColor: "#ff6fb5", acc: [] } }, { x: mx, y: floor, z: mz, pose: "wave", expr: "happy" });
    }
    Object.assign(g.userData, { height: 4.75, width: 4.55, depth: D, focus: V(-0.3, 0, 0), fitW: 4.5, fitH: 4.8, fitY: 2.45, detail: { at: V(mx, 0, 0), h: 2.6 }, big: true, push: 0.9 });
  },

  // ---------------------------------------------------------------------------------------------
  football_field(g) {
    const W = 6.0, D = 9.0;
    const fieldTex = ctex("field", 384, 576, (p, w, h) => {
      for (let i = 0; i < 9; i++) { p.fillStyle = i % 2 ? "#3f9a3f" : "#4cae49"; p.fillRect(0, (i * h) / 9, w, h / 9 + 1); }
      const R = rng(5); for (let i = 0; i < 2500; i++) { p.fillStyle = `rgba(${R() < 0.5 ? "20,60,20" : "160,220,120"},0.18)`; p.fillRect(R() * w, R() * h, 2, 3); }
      p.fillStyle = "#ffffff"; p.fillRect(14, 0, 8, h); p.fillRect(w - 22, 0, 8, h);
      for (let i = 1; i < 9; i++) p.fillRect(14, (i * h) / 9 - 3, w - 28, 6);
      for (let i = 0; i < 9; i++) for (const x of [w * 0.36, w * 0.64]) p.fillRect(x - 10, (i * h) / 9 + h / 18 - 2, 20, 4);
    });
    const fieldMat = new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 0.95 });
    const top = new THREE.Mesh(cachedGeo(`fieldTop${W},${D}`, () => new THREE.PlaneGeometry(W, D)), fieldMat);
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0.07, -D / 2); top.receiveShadow = true; g.add(top);
    bx(W, 0.07, D, solid("#3b8a3b", { roughness: 1 }), { y: 0.03, z: -D / 2, parent: g });
    // the goal posts at the back
    const yel = solid("#ffd32a", { roughness: 0.4 }), gz = -D + 1.2;
    bx(0.18, 3.0, 0.18, yel, { y: 1.5, z: gz, parent: g });
    rbx(0.34, 1.7, 0.34, 0.05, solid("#2e5fd6", { roughness: 0.7 }), { y: 0.95, z: gz, parent: g });
    bx(4.4, 0.18, 0.18, yel, { y: 3.0, z: gz, parent: g });
    for (const s of [-1, 1]) { bx(0.16, 3.3, 0.16, yel, { x: s * 2.2, y: 4.6, z: gz, parent: g }); bx(0.1, 0.5, 0.04, solid("#ff5e57"), { x: s * 2.2, y: 6.45, z: gz + 0.06, parent: g, shadow: false }); }
    // the bleachers + a silent crowd covering their mouths
    const alu = solid("#c9ced6", { metalness: 0.6, roughness: 0.35 }), riser = solid("#5d6670", { roughness: 0.6 });
    const BW = 4.8, rise = 0.62, step = 0.62, bz0 = -3.0;
    for (let k = 0; k < 3; k++) {
      const z = bz0 - k * step, y = rise * (k + 1);
      bx(BW, 0.08, step * 0.9, alu, { y, z, parent: g });
      bx(BW, rise, 0.05, riser, { y: y - rise / 2, z: z + step * 0.45, parent: g });
      bx(BW, y, 0.08, riser, { y: y / 2, z: z - step * 0.45, parent: g });
    }
    for (const s of [-1, 1]) bx(0.08, rise * 3 + 0.9, step * 3, riser, { x: s * BW / 2, y: (rise * 3 + 0.9) / 2, z: bz0 - step, parent: g });
    bx(BW, 0.06, 0.06, alu, { y: rise * 3 + 0.9, z: bz0 - step * 2.4, parent: g });
    const seats = [[0, -1.7, 3], [0, 0.0, 30], [0, 1.6, 9], [1, -0.85, 41], [1, 0.95, 13], [2, -1.8, 57], [2, 0.05, 66], [2, 1.75, 22]];
    for (const [k, x, seed] of seats) {
      const role = seed % 3 === 0 ? "kid" : seed % 7 === 1 ? "elder" : "adult", sc = role === "kid" ? 0.62 : 0.87;
      const z = bz0 - k * step + 0.12 + 0.38 * sc, y = rise * (k + 1) + 0.04 - Math.min(rise, 0.5); // feet dangle when the step is tall
      extra(g, { id: `fan${seed}`, role, seed }, { x, y, z, pose: "sit", expr: seed % 2 ? "surprised" : "sad", opts: { seat: Math.min(rise, 0.5), hands: "mouth" }, phase: seed * 0.37 });
    }
    // the team: matching red jerseys with numbers, white pants, helmets; two jump about (a silent celebration)
    const numTex = (n) => ctex(`jersey${n}`, 128, 128, (p, w, h) => { p.font = kitFont(104); p.textAlign = "center"; p.textBaseline = "middle"; p.lineJoin = "round"; p.lineWidth = 12; p.strokeStyle = "#7a0f14"; p.strokeText(String(n), w / 2, h / 2 + 6); p.fillStyle = "#ffffff"; p.fillText(String(n), w / 2, h / 2 + 6); });
    const helmet = gloss("#d63031"), mask = solid("#9aa0a8", { metalness: 0.6, roughness: 0.35 });
    const team = [[-1.65, 7, "stand", "neutral"], [-0.82, 23, "cheer", "excited"], [0, 10, "stand", "happy"], [0.82, 4, "cheer", "excited"], [1.65, 12, "stand", "neutral"]];
    team.forEach(([x, n, pose, expr], i) => {
      const p = extra(g, { id: `player${n}`, role: "adult", seed: 200 + n * 3, look: { top: "#d63031", pattern: "cotton", sleeve: "short", bottom: "pants", pants: "#f5f6fa", pantsKind: "cotton", shoes: "#1e1e1e", hair: "short", hat: null, glasses: false, acc: [] } }, { x, y: 0.07, z: -1.25 - (i % 2) * 0.3, pose, expr, phase: i * 0.21 });
      const j = p.userData.joints;
      const num = new THREE.Mesh(cachedGeo("jerseyNum", () => new THREE.PlaneGeometry(0.24, 0.24)), new THREE.MeshStandardMaterial({ map: numTex(n), transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -2 }));
      num.position.set(0, 0.28, 0.133); j.spine.add(num);
      rbx(0.37, 0.25, 0.37, 0.08, helmet, { y: 0.31, z: -0.015, parent: j.head });
      bx(0.07, 0.255, 0.375, solid("#ffffff"), { y: 0.315, z: -0.015, parent: j.head });
      for (const y of [0.05, 0.11]) bx(0.3, 0.022, 0.022, mask, { y, z: 0.2, parent: j.head });
      bx(0.022, 0.1, 0.022, mask, { y: 0.08, z: 0.2, parent: j.head });
      if (i === 2) { const ball = addMesh(sph(0.1, 14, 10), solid("#7a4a26", { roughness: 0.6 }), { y: -0.06, z: 0.08, parent: j.hand[0] }); ball.scale.set(0.62, 0.62, 1.15); bx(0.02, 0.012, 0.12, solid("#ffffff"), { y: -0.0, z: 0.08, parent: j.hand[0] }); ball.scale.multiplyScalar(1 / 0.87); }
    });
    Object.assign(g.userData, { height: 6.5, width: W, depth: D, focus: V(0, 0, -1.5), fitW: 4.6, fitH: 6.6, fitY: 2.7, detail: { at: V(0, 0, -1.25), h: 1.95 }, big: true, push: 0.4 });
  },

  // ---------------------------------------------------------------------------------------------
  birthday_party(g) {
    const tz = -0.45, ty = 0.76;
    const wood = fabric("#a87a4f", "cotton");
    for (const x of [-0.82, 0.82]) for (const z of [tz - 0.36, tz + 0.36]) bx(0.07, ty, 0.07, wood, { x, y: ty / 2, z, parent: g });
    bx(1.86, 0.05, 0.92, wood, { y: ty, z: tz, parent: g });
    const cloth = fabric("#ff6fb5", "dots");
    bx(1.92, 0.03, 0.98, cloth, { y: ty + 0.03, z: tz, parent: g });
    bx(1.92, 0.34, 0.02, cloth, { y: ty - 0.14, z: tz + 0.49, parent: g });
    for (const s of [-1, 1]) bx(0.02, 0.34, 0.98, cloth, { x: s * 0.96, y: ty - 0.14, z: tz, parent: g });
    // the cake (big, so it reads on a phone)
    const cy = ty + 0.045;
    addMesh(cyl(0.24, 0.24, 0.025, 28), solid("#ffffff", { roughness: 0.3 }), { y: cy + 0.012, z: tz + 0.05, parent: g });
    addMesh(cyl(0.2, 0.2, 0.2, 28), solid("#fff3f7", { roughness: 0.5 }), { y: cy + 0.125, z: tz + 0.05, parent: g });
    addMesh(cachedGeo("cakeDrip", () => new THREE.TorusGeometry(0.2, 0.03, 8, 30)), gloss("#ff6fa0"), { y: cy + 0.22, z: tz + 0.05, rx: Math.PI / 2, parent: g });
    addMesh(cyl(0.14, 0.14, 0.15, 24), gloss("#ff8fb1"), { y: cy + 0.3, z: tz + 0.05, parent: g });
    const flames = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.3, x = Math.cos(a) * 0.08, z = tz + 0.05 + Math.sin(a) * 0.08;
      addMesh(cyl(0.013, 0.013, 0.11, 8), fabric(["#2e86de", "#ffd32a", "#20bf6b", "#6c5ce7", "#ff5e57"][k], "stripes"), { x, y: cy + 0.43, z, parent: g });
      const f = addMesh(cachedGeo("oflame", () => { const s = new THREE.SphereGeometry(0.022, 10, 8); s.scale(1, 1.8, 1); return s; }), glowMat("#ffae3b", 5), { x, y: cy + 0.515, z, parent: g, shadow: false });
      flames.push(f);
    }
    // plates, cups, hats and a present on the table
    for (const x of [-0.6, 0.6]) { addMesh(cyl(0.11, 0.1, 0.015, 20), solid("#ffffff", { roughness: 0.35 }), { x, y: cy + 0.008, z: tz + 0.15, parent: g }); addMesh(cyl(0.045, 0.036, 0.12, 14), gloss(x < 0 ? "#2e86de" : "#ffb400"), { x: x * 1.3, y: cy + 0.06, z: tz - 0.12, parent: g }); }
    for (const [x, s] of [[-0.42, 1], [0.45, 4]]) { const h = partyHat(s); h.position.set(x, cy, tz - 0.15); h.scale.setScalar(0.85); h.rotation.z = 0; g.add(h); }
    const present = (x, y, z, w, h, d, c, rib) => { rbx(w, h, d, 0.01, solid(c, { roughness: 0.5 }), { x, y: y + h / 2, z, parent: g }); bx(w + 0.005, h + 0.005, 0.05, solid(rib), { x, y: y + h / 2, z, parent: g }); bx(0.05, h + 0.005, d + 0.005, solid(rib), { x, y: y + h / 2, z, parent: g }); for (const s of [-1, 1]) addMesh(cachedGeo("bow", () => new THREE.TorusGeometry(0.05, 0.016, 6, 14)), solid(rib), { x: x + s * 0.045, y: y + h + 0.035, z, rz: s * 0.5, parent: g }); };
    present(0.62, cy, tz - 0.05, 0.24, 0.2, 0.24, "#6c5ce7", "#ffd32a");
    present(-1.25, 0, tz + 0.05, 0.42, 0.36, 0.42, "#20bf6b", "#ff5e57");
    present(1.22, 0, tz + 0.1, 0.36, 0.3, 0.36, "#2e86de", "#ffffff");
    present(1.3, 0.3, tz + 0.1, 0.24, 0.2, 0.24, "#ff6fb5", "#ffd32a");
    // balloons tied at the table's back corners, and the banner behind
    const balloons = [];
    const cols = ["#ff3b5c", "#ffd32a", "#2e86de", "#20bf6b", "#ff6fb5", "#6c5ce7"];
    [[-0.95, 1.05, -0.25], [-0.95, 1.35, 0.1], [-0.95, 0.85, 0.3], [0.95, 1.2, -0.15], [0.95, 0.95, 0.25], [0.95, 1.45, 0.05]].forEach(([x, len, tilt], i) => {
      const b = balloon(cols[i], len); b.position.set(x, ty + 0.05, tz - 0.4); b.rotation.z = tilt * (x < 0 ? 1 : -1) * 0.6; g.add(b);
      balloons.push({ b, base: b.rotation.z, ph: i * 1.3 });
    });
    const banner = new THREE.Group(); banner.position.set(0, 2.15, -1.95); g.add(banner);
    for (const s of [-1, 1]) bx(0.05, 2.25, 0.05, solid("#ffffff"), { x: s * 1.25, y: -1.0, parent: banner });
    const letters = "HAPPY BIRTHDAY!".split("");
    const flagCols = ["#ff3b5c", "#ffb400", "#20bf6b", "#2e86de", "#6c5ce7", "#ff6fb5"];
    letters.forEach((ch, i) => {
      const x = -1.2 + (i + 0.5) * (2.4 / letters.length), sag = -0.12 * Math.sin((Math.PI * (i + 0.5)) / letters.length);
      if (ch === " ") return;
      const t = ctex(`pennant${ch}${i % flagCols.length}`, 96, 128, (p, w, h) => { p.fillStyle = flagCols[i % flagCols.length]; p.beginPath(); p.moveTo(0, 0); p.lineTo(w, 0); p.lineTo(w / 2, h); p.closePath(); p.fill(); p.font = kitFont(62); p.fillStyle = "#ffffff"; p.textAlign = "center"; p.textBaseline = "middle"; p.fillText(ch, w / 2, 44); });
      const m = new THREE.Mesh(cachedGeo("pennant", () => new THREE.PlaneGeometry(0.16, 0.21)), cachedMat(`pennantM${ch}${i % flagCols.length}`, () => new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, roughness: 0.7 })));
      m.position.set(x, sag - 0.1, 0); m.castShadow = true; banner.add(m);
    });
    bx(2.5, 0.012, 0.012, solid("#ffffff"), { y: -0.02, parent: banner, shadow: false });
    g.userData.anim = (t) => {
      for (const { b, base, ph } of balloons) { b.rotation.z = base + 0.07 * Math.sin(t * 1.3 + ph); b.rotation.x = 0.05 * Math.sin(t * 1.1 + ph * 0.7); }
      flames.forEach((f, i) => { f.scale.set(1, 1 + 0.18 * Math.sin(t * 17 + i * 2.1), 1); });
    };
    Object.assign(g.userData, { height: 2.6, width: 2.7, depth: 2.0, focus: V(0, 0, tz), fitW: 2.7, fitH: 2.6, fitY: 1.3, detail: { at: V(0, 0, tz - 0.4), h: 2.1 }, actors: "behind", actorsBack: 1.25 });
  },

  // ---------------------------------------------------------------------------------------------
  bakery(g, state) {
    const sale = state === "for_sale";
    const W = 5.0, H = 4.3, T = 0.22, WX0 = -2.15, WX1 = 0.45, WY0 = 0.62, WY1 = 2.4, DX0 = 0.85, DX1 = 1.85, DY1 = 2.3;
    const wall = siding("#f6d7a7"), brick = bricks("#b5523b"), trim = solid("#7a3e1d", { roughness: 0.6 }), white = solid("#ffffff", { roughness: 0.45 });
    const z = -T / 2;
    // the wall around the window and the door (UVs in metres)
    wbx(W / 2 + WX0, H, T, wall, { x: (-W / 2 + WX0) / 2, y: H / 2, z, parent: g });
    wbx(DX0 - WX1, H, T, wall, { x: (WX1 + DX0) / 2, y: H / 2, z, parent: g });
    wbx(W / 2 - DX1, H, T, wall, { x: (DX1 + W / 2) / 2, y: H / 2, z, parent: g });
    wbx(WX1 - WX0, H - WY1, T, wall, { x: (WX0 + WX1) / 2, y: (WY1 + H) / 2, z, parent: g });
    wbx(DX1 - DX0, H - DY1, T, wall, { x: (DX0 + DX1) / 2, y: (DY1 + H) / 2, z, parent: g });
    wbx(WX1 - WX0, WY0, T + 0.04, brick, { x: (WX0 + WX1) / 2, y: WY0 / 2, z, parent: g });
    bx(W + 0.2, 0.22, T + 0.16, trim, { y: H + 0.11, z, parent: g }); // cornice
    // the shop inside (seen through the window): back wall, floor, sides, two shelves
    const backMat = new THREE.MeshStandardMaterial({ color: sale ? "#3a332c" : "#c98b52", emissive: "#ffb45a", emissiveIntensity: sale ? 0 : 0.22, roughness: 0.8 });
    const IN = 1.3;
    bx(WX1 - WX0 + 0.4, WY1 - WY0 + 0.4, 0.04, backMat, { x: (WX0 + WX1) / 2, y: (WY0 + WY1) / 2, z: -IN, parent: g });
    for (const x of [WX0 - 0.05, WX1 + 0.05]) bx(0.04, WY1 - WY0 + 0.4, IN, sale ? solid("#2e2823") : solid("#b97a45"), { x, y: (WY0 + WY1) / 2, z: -IN / 2, parent: g });
    bx(WX1 - WX0 + 0.1, 0.04, IN, sale ? solid("#2e2823") : solid("#b97a45"), { x: (WX0 + WX1) / 2, y: WY1 + 0.05, z: -IN / 2, parent: g });
    const shelfMat = fabric("#8a5a32", "cotton");
    for (const y of [WY0 + 0.05, WY0 + 0.72]) bx(WX1 - WX0 - 0.05, 0.05, 0.5, shelfMat, { x: (WX0 + WX1) / 2, y, z: -0.45, parent: g });
    if (!sale) {
      const crust = fabric("#e0a050", "cotton"), dark = fabric("#c07a2e", "cotton"), score = solid("#ffe2a6");
      const loaf = (x, y, zz, w = 0.36, ry = 0) => { rbx(w, 0.19, 0.22, 0.07, crust, { x, y: y + 0.095, z: zz, ry, parent: g }); for (const k of [-1, 0, 1]) bx(0.03, 0.015, 0.15, score, { x: x + k * w * 0.25, y: y + 0.192, z: zz, ry: ry + 0.5, parent: g, shadow: false }); };
      const baguette = (x, y, zz, rz) => rbx(0.66, 0.11, 0.11, 0.05, dark, { x, y: y + 0.07, z: zz, rz, parent: g });
      const croissant = (x, y, zz) => { const m = addMesh(cachedGeo("croissant", () => new THREE.TorusGeometry(0.09, 0.05, 8, 12, Math.PI * 1.2)), crust, { x, y: y + 0.05, z: zz, rx: -Math.PI / 2, rz: -0.3, parent: g }); m.scale.set(1, 1, 0.8); };
      const sy0 = WY0 + 0.075, sy1 = WY0 + 0.745;
      loaf(-1.85, sy0, -0.4); loaf(-1.45, sy0, -0.45, 0.3, 0.2); croissant(-1.05, sy0, -0.35); croissant(-0.8, sy0, -0.42); loaf(-0.42, sy0, -0.42); loaf(0.05, sy0, -0.4, 0.3, -0.15);
      baguette(-1.6, sy1, -0.42, 0.18); baguette(-1.0, sy1, -0.45, -0.12); loaf(-0.45, sy1, -0.42, 0.32); croissant(-0.05, sy1, -0.38); croissant(0.22, sy1, -0.42);
      addMesh(cyl(0.16, 0.16, 0.14, 20), gloss("#ff8fb1"), { x: 0.1, y: WY1 - 0.55, z: -0.9, parent: g }); // a cake on the counter behind
    } else {
      // FOR SALE in the window
      const s = textPlane("FOR SALE", 1.7, 0.85, { bg: "#ffffff", ink: "#d32f2f", rim: "#d32f2f", maxSize: 200, emissive: 0.35 });
      s.position.set((WX0 + WX1) / 2 + 0.05, WY0 + 0.9, -0.035); s.rotation.z = -0.05; g.add(s);
      bx(0.5, 0.06, 0.02, solid("#9a9a9a"), { x: (WX0 + WX1) / 2 - 0.6, y: WY1 - 0.4, z: -0.12, rz: 0.6, parent: g, shadow: false }); // a cobweb-ish strand
    }
    // window frame + a little glass sheen
    for (const [w, h, x, y] of [[WX1 - WX0 + 0.14, 0.1, (WX0 + WX1) / 2, WY1], [WX1 - WX0 + 0.24, 0.1, (WX0 + WX1) / 2, WY0], [0.1, WY1 - WY0, WX0, (WY0 + WY1) / 2], [0.1, WY1 - WY0, WX1, (WY0 + WY1) / 2]]) bx(w, h, 0.1, white, { x, y, z: 0.0, parent: g });
    const sheen = new THREE.MeshStandardMaterial({ color: "#dff1ff", transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
    addMesh(cachedGeo("bakGlass", () => new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0)), sheen, { x: (WX0 + WX1) / 2, y: (WY0 + WY1) / 2, z: -0.06, parent: g, shadow: false });
    // the door with its little hanging sign
    const doorC = "#2e7d4f";
    bx(DX1 - DX0, DY1, 0.08, solid(doorC, { roughness: 0.45 }), { x: (DX0 + DX1) / 2, y: DY1 / 2, z: -0.12, parent: g });
    bx(0.6, 0.9, 0.02, sale ? solid("#2b2620") : glowMat("#ffcf8a", 0.6, "#fff0d0"), { x: (DX0 + DX1) / 2, y: 1.6, z: -0.07, parent: g });
    addMesh(sph(0.04, 10, 8), solid("#d8b45a", { metalness: 0.8, roughness: 0.3 }), { x: DX1 - 0.15, y: 1.05, z: -0.06, parent: g });
    const hang = textPlane(sale ? "CLOSED" : "OPEN", 0.46, 0.2, { bg: sale ? "#c62828" : "#ffffff", ink: sale ? "#ffffff" : "#2e7d4f", maxSize: 120 });
    hang.position.set((DX0 + DX1) / 2, 1.42, -0.055); g.add(hang);
    for (const [w, h, x, y] of [[DX1 - DX0 + 0.16, 0.09, (DX0 + DX1) / 2, DY1], [0.08, DY1, DX0, DY1 / 2], [0.08, DY1, DX1, DY1 / 2]]) bx(w, h, 0.12, white, { x, y, z: 0.0, parent: g });
    bx(DX1 - DX0 + 0.4, 0.1, 0.4, solid("#bdb6aa"), { x: (DX0 + DX1) / 2, y: 0.05, z: 0.2, parent: g }); // the step
    // the striped awning over the window and the door
    const aw = stripesV("#e53935", "#ffffff", 14), ad = 0.95, ang = 0.42;
    const awn = new THREE.Group(); awn.position.set(-0.15, WY1 + 0.42, 0.0); g.add(awn);
    bx(4.5, 0.05, ad, aw, { y: -Math.sin(ang) * ad / 2, z: Math.cos(ang) * ad / 2, rx: ang, parent: awn });
    for (let k = 0; k < 15; k++) bx(0.29, 0.17, 0.03, solid(k % 2 ? "#ffffff" : "#e53935", { roughness: 0.75 }), { x: -2.25 + 0.15 + k * 0.3, y: -Math.sin(ang) * ad - 0.07, z: Math.cos(ang) * ad, parent: awn });
    // the sign
    const signY = H - 0.55;
    bx(3.1, 0.78, 0.08, trim, { x: -0.15, y: signY, z: 0.02, parent: g });
    const sign = textPlane("BAKERY", 2.95, 0.66, { bg: "#fff3d6", ink: "#7a3e1d", stroke: null, rim: "#d9963f", maxSize: 220, emissive: sale ? 0 : 0.12 });
    sign.position.set(-0.15, signY, 0.065); g.add(sign);
    for (const s of [-1, 1]) { const m = addMesh(cachedGeo("signLoaf", () => new THREE.CapsuleGeometry(0.11, 0.22, 4, 10)), fabric("#d9963f", "cotton"), { x: -0.15 + s * 1.85, y: signY, z: 0.08, rz: Math.PI / 2, parent: g }); m.scale.set(1, 1, 0.7); }
    // wall lamps
    for (const x of [WX0 - 0.2, DX1 + 0.25]) { bx(0.08, 0.3, 0.12, solid("#2b2f33"), { x, y: 2.55, z: 0.06, parent: g }); addMesh(sph(0.1, 12, 10), sale ? solid("#5a5a50") : glowMat("#ffcf7a", 2.2, "#fff4d8"), { x, y: 2.75, z: 0.14, parent: g, shadow: false }); }
    Object.assign(g.userData, { height: H + 0.25, width: W + 0.2, depth: IN, focus: V(-0.15, 0, 0), fitW: 5.1, fitH: 4.6, fitY: 2.3, detail: { at: V(-0.5, 0, 0), h: 2.2 }, big: true, push: 0.9 });
  },

  // ---------------------------------------------------------------------------------------------
  car(g, state) {
    // a chunky blue hatchback, seen three-quarter (its front turned toward the camera-right)
    const c = new THREE.Group(); c.rotation.y = -0.75; c.position.set(0, 0, -1.9); g.add(c);
    const L = 3.6, Wd = 1.75, paint = cachedMat("carPaint", () => new THREE.MeshPhysicalMaterial({ color: "#1b56b8", roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35 }));
    const dark = solid("#1f1f24", { roughness: 0.55 }), chrome = solid("#dfe3e8", { metalness: 0.9, roughness: 0.25 }), glass = solid("#22364a", { roughness: 0.06, metalness: 0.35 });
    rbx(L, 0.62, Wd, 0.14, paint, { y: 0.62, parent: c });
    rbx(2.05, 0.62, Wd - 0.16, 0.12, paint, { x: -0.3, y: 1.2, parent: c });
    for (const s of [-1, 1]) {
      bx(0.62, 0.42, 0.02, glass, { x: 0.25, y: 1.2, z: s * (Wd / 2 - 0.075), parent: c, shadow: false });
      bx(0.78, 0.42, 0.02, glass, { x: -0.62, y: 1.2, z: s * (Wd / 2 - 0.075), parent: c, shadow: false });
      for (const x of [-1.15, 1.15]) { addMesh(cyl(0.36, 0.36, 0.26, 20), dark, { x, y: 0.36, z: s * (Wd / 2 - 0.1), rx: Math.PI / 2, parent: c }); addMesh(cyl(0.18, 0.18, 0.28, 12), chrome, { x, y: 0.36, z: s * (Wd / 2 - 0.1), rx: Math.PI / 2, parent: c }); }
      bx(0.08, 0.1, 0.16, paint, { x: 0.62, y: 1.05, z: s * (Wd / 2 + 0.05), parent: c }); // mirrors
    }
    bx(0.03, 0.5, Wd - 0.3, glass, { x: 0.73, y: 1.2, rz: -0.5, parent: c, shadow: false });
    bx(0.03, 0.46, Wd - 0.3, glass, { x: -1.33, y: 1.2, rz: 0.35, parent: c, shadow: false });
    bx(0.06, 0.2, Wd + 0.04, chrome, { x: L / 2 + 0.02, y: 0.42, parent: c });
    bx(0.06, 0.2, Wd + 0.04, dark, { x: -L / 2 - 0.02, y: 0.42, parent: c });
    bx(0.04, 0.22, 0.7, dark, { x: L / 2 + 0.005, y: 0.7, parent: c }); // grille
    // lights: own materials (they flash)
    const head = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6dd", emissiveIntensity: 0.25, roughness: 0.3 });
    const tail = new THREE.MeshStandardMaterial({ color: "#ff3b3b", emissive: "#ff1a1a", emissiveIntensity: 0.4, roughness: 0.3 });
    const amber = new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff8a00", emissiveIntensity: 0.2, roughness: 0.3 });
    for (const s of [-1, 1]) {
      bx(0.05, 0.16, 0.34, head, { x: L / 2 + 0.01, y: 0.74, z: s * 0.6, parent: c, shadow: false });
      bx(0.05, 0.16, 0.3, tail, { x: -L / 2 - 0.01, y: 0.74, z: s * 0.6, parent: c, shadow: false });
      bx(0.1, 0.2, 0.24, amber, { x: L / 2 + 0.01, y: 0.74, z: s * 0.78, parent: c, shadow: false });
      bx(0.1, 0.2, 0.24, amber, { x: -L / 2 - 0.01, y: 0.74, z: s * 0.78, parent: c, shadow: false });
      bx(0.42, 0.14, 0.04, amber, { x: 1.25, y: 0.82, z: s * (Wd / 2 + 0.01), parent: c, shadow: false }); // side repeaters
      bx(0.42, 0.14, 0.04, amber, { x: -1.3, y: 0.82, z: s * (Wd / 2 + 0.01), parent: c, shadow: false });
    }
    // sound lines: arcs radiating from the car, in a plane facing the camera
    const arcs = [];
    if (state === "alarm") {
      const arcMat = new THREE.MeshBasicMaterial({ color: "#ffa21a", fog: false });
      const sets = [[-1.7, 1.05, Math.PI - 0.6], [1.75, 1.05, -0.6], [0.0, 1.75, Math.PI / 2 - 0.6]];
      for (const [x, y, rot] of sets) for (let k = 0; k < 3; k++) {
        const r = 0.3 + k * 0.26;
        const m = addMesh(cachedGeo(`soundArc${k}`, () => new THREE.TorusGeometry(0.3 + k * 0.26, 0.06, 6, 20, 1.2)), arcMat, { x, y, z: 0.25, rz: rot, parent: g, shadow: false });
        arcs.push({ m, k, r });
      }
    }
    g.userData.anim = (t) => {
      if (state !== "alarm") return;
      const on = (t * 1.7) % 1 < 0.5;
      amber.emissiveIntensity = on ? 12 : 0.1; amber.color.set(on ? "#ffc06a" : "#8a4a08"); tail.emissiveIntensity = on ? 3 : 0.3;
      for (const a of arcs) { const ph = (t * 2.2 - a.k * 0.28) % 1; a.m.visible = ph >= 0 && ph < 0.62; a.m.scale.setScalar(0.92 + 0.12 * ph); }
    };
    Object.assign(g.userData, { height: 1.6, width: 3.9, depth: 2.6, focus: V(0, 0, -1.2), fitW: 3.6, fitH: 2.4, fitY: 1.05, detail: { at: V(0, 0, -1.0), h: 1.75 }, big: false, push: 0.6 });
  },

  // ---------------------------------------------------------------------------------------------
  photo_set(g) {
    // the school-photo backdrop: mottled blue on a stand, swept onto the floor
    const tex = ctex("photoBackdrop", 512, 640, (p, w, h) => {
      const gr = p.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.5, h * 0.75); gr.addColorStop(0, "#8fc4f2"); gr.addColorStop(1, "#1f4f9a"); p.fillStyle = gr; p.fillRect(0, 0, w, h);
      const R = rng(11); for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h, r = 10 + R() * 46; const c = R() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(10,30,90,0.14)"; p.fillStyle = c; p.beginPath(); p.ellipse(x, y, r * (0.7 + R()), r, R() * 3, 0, TAU); p.fill(); }
    });
    const back = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const BZ = -0.95, BW = 2.3, BH = 2.45;
    addMesh(cachedGeo("photoBack", () => new THREE.PlaneGeometry(BW, BH)), back, { y: 0.2 + BH / 2, z: BZ, parent: g, shadow: true });
    addMesh(cachedGeo("photoSweep", () => new THREE.PlaneGeometry(BW, 0.9)), back, { y: 0.012, z: BZ + 0.45, rx: -Math.PI / 2, parent: g });
    addMesh(cachedGeo("photoCurve", () => new THREE.CylinderGeometry(0.2, 0.2, BW, 12, 1, true, Math.PI, Math.PI / 2)), back, { y: 0.2, z: BZ + 0.2, rz: Math.PI / 2, parent: g });
    const stand = solid("#2b2f33", { metalness: 0.5, roughness: 0.4 });
    for (const s of [-1, 1]) { bx(0.05, BH + 0.4, 0.05, stand, { x: s * (BW / 2 + 0.06), y: (BH + 0.4) / 2, z: BZ - 0.03, parent: g }); bx(0.5, 0.04, 0.05, stand, { x: s * (BW / 2 + 0.06), y: 0.02, z: BZ - 0.03, ry: Math.PI / 2, parent: g }); }
    bx(BW + 0.2, 0.06, 0.06, stand, { y: BH + 0.38, z: BZ - 0.03, parent: g });
    // the stool (at the origin)
    const stoolM = solid("#3a3f46", { roughness: 0.5 });
    addMesh(cyl(0.21, 0.21, 0.06, 20), solid("#d63031", { roughness: 0.6 }), { y: 0.49, parent: g });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; bx(0.04, 0.5, 0.04, stoolM, { x: Math.cos(a) * 0.13, y: 0.24, z: Math.sin(a) * 0.13, rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12, parent: g }); }
    addMesh(cachedGeo("stoolRing", () => new THREE.TorusGeometry(0.15, 0.015, 6, 20)), stoolM, { y: 0.2, rx: Math.PI / 2, parent: g });
    // the camera on its tripod, at the side, aimed at the stool
    const cam = new THREE.Group(); cam.position.set(1.15, 0, 1.0); cam.rotation.y = Math.atan2(-1.15, -1.0) + Math.PI; g.add(cam);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; bx(0.035, 1.35, 0.035, stand, { x: Math.cos(a) * 0.2, y: 0.64, z: Math.sin(a) * 0.2, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3, parent: cam }); }
    bx(0.1, 0.12, 0.1, stand, { y: 1.32, parent: cam });
    rbx(0.34, 0.24, 0.18, 0.03, solid("#1b1b1f", { roughness: 0.4 }), { y: 1.48, parent: cam });
    addMesh(cyl(0.085, 0.095, 0.2, 18), solid("#2a2a2e", { roughness: 0.3 }), { y: 1.48, z: -0.18, rx: Math.PI / 2, parent: cam });
    addMesh(cachedGeo("lensGlass", () => new THREE.CircleGeometry(0.07, 18)), solid("#3d6fa8", { roughness: 0.05, metalness: 0.5 }), { y: 1.48, z: -0.285, ry: Math.PI, parent: cam, shadow: false });
    const flashMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.1 });
    bx(0.14, 0.08, 0.06, solid("#1b1b1f"), { y: 1.64, parent: cam }); bx(0.12, 0.05, 0.02, flashMat, { y: 1.64, z: -0.035, parent: cam, shadow: false });
    // a softbox light on the other side
    const sb = new THREE.Group(); sb.position.set(-1.6, 0, 0.1); sb.rotation.y = Math.atan2(1.6, -0.1) + Math.PI; g.add(sb);
    bx(0.04, 1.85, 0.04, stand, { y: 0.92, parent: sb });
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; bx(0.03, 0.45, 0.03, stand, { x: Math.cos(a) * 0.15, y: 0.15, z: Math.sin(a) * 0.15, rx: Math.sin(a) * 0.9, rz: -Math.cos(a) * 0.9, parent: sb }); }
    rbx(0.62, 0.62, 0.32, 0.03, solid("#1b1b1f"), { y: 1.95, z: 0.05, parent: sb });
    bx(0.56, 0.56, 0.02, glowMat("#ffffff", 1.2, "#ffffff"), { y: 1.95, z: -0.115, parent: sb, shadow: false });
    g.userData.anim = (t) => { flashMat.emissiveIntensity = (t % 1.6) > 1.1 && (t % 1.6) < 1.18 ? 9 : 0.1; };
    Object.assign(g.userData, { height: 2.9, width: 2.6, depth: 2.2, focus: V(0, 0, -0.3), fitW: 2.7, fitH: 2.9, fitY: 1.45, detail: { at: V(0, 0, 0), h: 1.45 }, actors: "seat", seat: V(0, 0, 0), seatH: 0.52 });
  },

  // ---------------------------------------------------------------------------------------------
  crib(g) {
    const W = 1.0, D = 0.62, zc = -D / 2, wood = fabric("#e3b77d", "cotton"), dk = fabric("#c8955a", "cotton");
    const bed = 0.3, topB = 0.86, topF = 0.54;
    for (const x of [-W / 2, W / 2]) for (const z of [-0.03, -D + 0.03]) { const h = z > zc ? topF + 0.08 : topB + 0.06; rbx(0.07, h, 0.07, 0.015, dk, { x, y: h / 2, z, parent: g }); }
    bx(W, 0.06, D, wood, { y: bed - 0.11, z: zc, parent: g });
    rbx(W - 0.06, 0.1, D - 0.06, 0.03, fabric("#bfe3ff", "dots"), { y: bed - 0.05, z: zc, parent: g });
    rbx(0.34, 0.07, 0.2, 0.03, fabric("#ffffff", "cotton"), { y: bed + 0.03, z: -D + 0.14, parent: g }); // the pillow
    const rails = (z, top, along) => {
      const len = along === "x" ? W : D;
      for (const y of [bed - 0.08, top]) bx(along === "x" ? len : 0.05, 0.05, along === "x" ? 0.05 : len, wood, { x: along === "x" ? 0 : z, y, z: along === "x" ? z : zc, parent: g });
      const n = Math.round(len / 0.14);
      for (let k = 1; k < n; k++) { const u = -len / 2 + (k * len) / n; bx(0.024, top - bed + 0.08, 0.024, wood, { x: along === "x" ? u : z, y: (top + bed - 0.08) / 2, z: along === "x" ? z : zc + u, parent: g }); }
    };
    rails(-0.03, topF, "x"); rails(-D + 0.03, topB, "x"); rails(-W / 2, topB, "z"); rails(W / 2, topB, "z");
    // the mobile: an arm from the back-right post, four shapes turning slowly
    bx(0.03, 0.62, 0.03, solid("#ffffff"), { x: W / 2 - 0.02, y: topB + 0.36, z: -D + 0.03, parent: g });
    bx(0.5, 0.03, 0.03, solid("#ffffff"), { x: W / 2 - 0.25, y: topB + 0.66, z: -D + 0.03, parent: g });
    const mob = new THREE.Group(); mob.position.set(0.02, topB + 0.66, -D + 0.05); g.add(mob);
    const shapes = [["#ffd32a", "star"], ["#ff8fb1", "ball"], ["#7fd3ff", "moon"], ["#a8ecd8", "ball"]];
    shapes.forEach(([c, k], i) => {
      const a = (i / 4) * TAU, x = Math.cos(a) * 0.18, z = Math.sin(a) * 0.18;
      bx(0.006, 0.16, 0.006, solid("#ffffff"), { x, y: -0.08, z, parent: mob, shadow: false });
      if (k === "star") { const s = addMesh(cachedGeo("mobStar", () => { const sh = new THREE.Shape(); for (let q = 0; q < 10; q++) { const r = q % 2 ? 0.035 : 0.08, t = (q / 10) * TAU + Math.PI / 2; if (q) sh.lineTo(Math.cos(t) * r, Math.sin(t) * r); else sh.moveTo(Math.cos(t) * r, Math.sin(t) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); }), gloss(c), { x, y: -0.2, z, parent: mob }); s.position.z -= 0.015; }
      else if (k === "moon") addMesh(cachedGeo("mobMoon", () => new THREE.TorusGeometry(0.06, 0.025, 8, 14, Math.PI * 1.3)), gloss(c), { x, y: -0.2, z, parent: mob });
      else addMesh(sph(0.055, 12, 10), gloss(c), { x, y: -0.2, z, parent: mob });
    });
    g.userData.anim = (t) => { mob.rotation.y = t * 0.6; };
    Object.assign(g.userData, { height: 1.6, width: W, depth: D, focus: V(0, 0, zc), fitW: 1.15, fitH: 1.6, fitY: 0.75, detail: { at: V(0, 0, zc), h: 0.95 }, actors: "bed", bed: V(0, 0, zc + 0.02), bedH: bed });
  },

  // ---------------------------------------------------------------------------------------------
  house_front(g, state) {
    const W = 6.4, H = 5.6, T = 0.25, roofH = 1.9;
    const lit = state !== "dark", open = state === "open" || state === "yell";
    const wallM = siding("#a9d3f5"), trim = solid("#ffffff", { roughness: 0.5 });
    const WIN = [[-1.9, 1.0, 1.2, 1.3], [1.9, 1.0, 1.2, 1.3], [-2.0, 3.55, 1.2, 1.35], [0, 3.55, 1.2, 1.35], [2.0, 3.55, 1.2, 1.35]]; // x, y0, w, h
    const DOOR = [0, 0, 1.1, 2.25];
    // the facade: one extruded shape with holes (UVs in metres)
    const geo = cachedGeo(`houseFacade${W}`, () => {
      const s = new THREE.Shape([V(-W / 2, 0, 0), V(W / 2, 0, 0), V(W / 2, H, 0), V(-W / 2, H, 0)].map((v) => new THREE.Vector2(v.x, v.y)));
      for (const [x, y0, w, h] of [...WIN, DOOR]) { const hole = new THREE.Path(); hole.moveTo(x - w / 2, y0); hole.lineTo(x - w / 2, y0 + h); hole.lineTo(x + w / 2, y0 + h); hole.lineTo(x + w / 2, y0); hole.lineTo(x - w / 2, y0); s.holes.push(hole); }
      const e = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }); e.translate(0, 0, -T); return e;
    });
    addMesh(geo, wallM, { parent: g });
    const gable = cachedGeo(`houseGable${W}`, () => { const s = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, roofH)]); const ring = new THREE.Path(); ring.absarc(0, roofH * 0.42, 0.3, 0, TAU, true); s.holes.push(ring); const e = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }); e.translate(0, H, -T); return e; });
    addMesh(gable, wallM, { parent: g });
    const roofM = shingles("#6d4c41"), slope = Math.hypot(W / 2 + 0.4, roofH + 0.3), ang = Math.atan2(roofH + 0.3, W / 2 + 0.4);
    for (const s of [-1, 1]) wbx(slope, 0.16, 1.6, roofM, { x: s * (W / 4 + 0.1), y: H + roofH / 2 - 0.05, z: -0.65, rz: -s * ang, parent: g });
    bx(W + 0.3, 0.18, 0.12, trim, { y: H, z: 0.04, parent: g });
    bx(0.7, 1.3, 0.7, bricks("#9c4a36"), { x: 1.7, y: H + 1.5, z: -0.8, parent: g }); // chimney
    // inside: one backing wall, warm when lit
    const inside = new THREE.MeshStandardMaterial({ color: lit ? "#ffe2b0" : "#151a24", emissive: "#ffb257", emissiveIntensity: lit ? 0.75 : 0, roughness: 0.9 });
    bx(W - 0.1, H + roofH - 0.2, 0.05, inside, { y: (H + roofH) / 2 - 0.1, z: -1.5, parent: g });
    bx(W - 0.1, 0.06, 1.3, solid("#5d4a3a"), { y: 3.0, z: -0.85, parent: g }); // the upper floor
    // windows: frames, sills, shutters, two casement panes each (open swings them out)
    const glassM = new THREE.MeshStandardMaterial({ color: lit ? "#ffe6b0" : "#1b2533", emissive: "#ffb257", emissiveIntensity: lit ? 1.1 : 0, roughness: lit ? 0.5 : 0.08, metalness: lit ? 0 : 0.3 });
    const shutterM = solid("#2c5aa0", { roughness: 0.55 });
    const panes = [];
    for (const [x, y0, w, h] of WIN) {
      for (const [ww, hh, xx, yy] of [[w + 0.2, 0.1, x, y0 + h + 0.05], [0.1, h, x - w / 2 - 0.05, y0 + h / 2], [0.1, h, x + w / 2 + 0.05, y0 + h / 2]]) bx(ww, hh, 0.1, trim, { x: xx, y: yy, z: 0.03, parent: g });
      bx(w + 0.3, 0.08, 0.22, trim, { x, y: y0 - 0.04, z: 0.06, parent: g });
      for (const s of [-1, 1]) { bx(0.42, h, 0.05, shutterM, { x: x + s * (w / 2 + 0.33), y: y0 + h / 2, z: 0.03, parent: g }); for (let k = 1; k < 5; k++) bx(0.36, 0.02, 0.02, solid("#244b86"), { x: x + s * (w / 2 + 0.33), y: y0 + (k * h) / 5, z: 0.06, parent: g, shadow: false }); }
      for (const s of [-1, 1]) {
        const hinge = new THREE.Group(); hinge.position.set(x + s * (w / 2), y0 + h / 2, -0.06); g.add(hinge);
        const pw = w / 2;
        bx(pw, h, 0.03, glassM, { x: -s * pw / 2, parent: hinge, shadow: false });
        for (const [fw, fh, fx, fy] of [[pw, 0.06, -s * pw / 2, h / 2 - 0.03], [pw, 0.06, -s * pw / 2, -h / 2 + 0.03], [0.06, h, -s * 0.03, 0], [0.06, h, -s * (pw - 0.03), 0], [pw, 0.04, -s * pw / 2, 0]]) bx(fw, fh, 0.05, trim, { x: fx, y: fy, parent: hinge });
        panes.push({ hinge, s });
      }
    }
    // the round attic window
    addMesh(cachedGeo("attic", () => new THREE.CircleGeometry(0.3, 24)), glassM, { y: H + roofH * 0.42, z: -0.1, parent: g, shadow: false });
    addMesh(cachedGeo("atticRing", () => new THREE.TorusGeometry(0.31, 0.05, 8, 24)), trim, { y: H + roofH * 0.42, z: 0.0, parent: g });
    // the door, a porch light, steps
    bx(DOOR[2], DOOR[3], 0.08, solid("#c0392b", { roughness: 0.45 }), { y: DOOR[3] / 2, z: -0.12, parent: g });
    for (const [ww, hh, xx, yy] of [[DOOR[2] + 0.22, 0.11, 0, DOOR[3] + 0.05], [0.11, DOOR[3], -DOOR[2] / 2 - 0.05, DOOR[3] / 2], [0.11, DOOR[3], DOOR[2] / 2 + 0.05, DOOR[3] / 2]]) bx(ww, hh, 0.12, trim, { x: xx, y: yy, z: 0.03, parent: g });
    addMesh(sph(0.045, 10, 8), solid("#d8b45a", { metalness: 0.8, roughness: 0.3 }), { x: 0.38, y: 1.05, z: -0.06, parent: g });
    addMesh(sph(0.11, 12, 10), lit ? glowMat("#ffcf7a", 2.5, "#fff4d8") : solid("#6b6b60"), { x: 0.85, y: 2.15, z: 0.12, parent: g, shadow: false });
    bx(1.8, 0.16, 0.5, solid("#bdb6aa"), { y: 0.08, z: 0.25, parent: g });
    // townsfolk leaning out (open): upper-left, upper-right, ground-right
    if (open) {
      const yell = state === "yell";
      const folk = [[-2.0, 3.03, "adult", 31, yell ? "yell" : "wave", yell ? "yell" : "excited"], [2.0, 3.03, "elder", 47, yell ? "yell" : "talk", yell ? "yell" : "surprised"], [1.9, 0.35, "kid", 52, yell ? "yell" : "wave", yell ? "yell" : "happy"]];
      for (const [x, y, role, seed, pose, expr] of folk) extra(g, { id: `window${seed}`, role, seed }, { x, y, z: -0.3, pose, expr, lean: role === "kid" ? 0.5 : 0.7, phase: seed * 0.13 });
    }
    g.userData.anim = (t) => { const a = open ? 1.75 * ease(t / 0.35) : 0; for (const { hinge, s } of panes) hinge.rotation.y = s * a; };
    g.userData.anim(open ? 1 : 0);
    Object.assign(g.userData, { height: H + roofH + 0.1, width: W + 0.6, depth: 1.6, focus: V(0, 0, 0), fitW: 6.8, fitH: 7.6, fitY: 3.8, detail: { at: V(-2.0, 0, 0), h: 4.9 }, big: true, push: 0.9 });
  },

  // ---------------------------------------------------------------------------------------------
  stories_book(g) {
    const wood = fabric("#7a4a26", "cotton"), dk = solid("#4a2c16", { roughness: 0.6 });
    // the lectern
    for (const s of [-1, 1]) { bx(0.7, 0.06, 0.1, dk, { y: 0.03, z: -0.25 + s * 0.0, ry: s > 0 ? 0 : Math.PI / 2, parent: g }); }
    rbx(0.12, 1.0, 0.12, 0.02, wood, { y: 0.5, z: -0.25, parent: g });
    const top = new THREE.Group(); top.position.set(0, 1.05, -0.25); top.rotation.x = 0.62; g.add(top); // tilted toward the camera
    rbx(0.9, 0.05, 0.62, 0.015, wood, { parent: top });
    bx(0.9, 0.06, 0.03, dk, { y: 0.04, z: 0.31, parent: top }); // the ledge
    // the giant open book
    const book = new THREE.Group(); book.position.set(0, 0.05, -0.02); top.add(book);
    rbx(1.34, 0.04, 0.86, 0.015, fabric("#b0232e", "leather"), { parent: book });
    const page = (side) => ctex(`storyPage${side}`, 480, 640, (p, w, h) => {
      p.fillStyle = "#fbf3dc"; p.fillRect(0, 0, w, h);
      const gr = p.createLinearGradient(side < 0 ? w : 0, 0, side < 0 ? w - 60 : 60, 0); gr.addColorStop(0, "rgba(120,90,40,0.35)"); gr.addColorStop(1, "rgba(120,90,40,0)"); p.fillStyle = gr; p.fillRect(0, 0, w, h);
      p.lineJoin = p.lineCap = "round";
      if (side < 0) { // a picture: night sky, moon, hills, little houses with lit windows
        p.fillStyle = "#24407a"; p.beginPath(); p.roundRect(40, 50, w - 80, 420, 24); p.fill();
        p.fillStyle = "#fff3b0"; p.beginPath(); p.arc(340, 140, 46, 0, TAU); p.fill(); p.fillStyle = "#24407a"; p.beginPath(); p.arc(362, 128, 42, 0, TAU); p.fill();
        p.fillStyle = "#ffffff"; for (const [x, y] of [[90, 100], [150, 160], [220, 90], [270, 200], [120, 230]]) { p.beginPath(); p.arc(x, y, 5, 0, TAU); p.fill(); }
        p.fillStyle = "#3f8f4a"; p.beginPath(); p.moveTo(40, 470); p.quadraticCurveTo(160, 300, 300, 400); p.quadraticCurveTo(380, 340, w - 40, 380); p.lineTo(w - 40, 470); p.closePath(); p.fill();
        for (const [x, y, c] of [[110, 360, "#ff8a65"], [200, 380, "#ffd54f"], [300, 360, "#81d4fa"]]) { p.fillStyle = c; p.fillRect(x, y, 60, 50); p.fillStyle = "#8d3b2f"; p.beginPath(); p.moveTo(x - 8, y); p.lineTo(x + 30, y - 32); p.lineTo(x + 68, y); p.fill(); p.fillStyle = "#ffe08a"; p.fillRect(x + 20, y + 14, 18, 16); }
        p.strokeStyle = "#5a4a3a"; p.lineWidth = 6; for (let k = 0; k < 3; k++) { p.beginPath(); p.moveTo(60, 520 + k * 34); p.lineTo(w - 60 - (k === 2 ? 120 : 0), 520 + k * 34); p.stroke(); }
      } else { // the title, a drawing of a kid with sound waves, lines of text
        p.font = kitFont(58); p.fillStyle = "#b0232e"; p.textAlign = "center"; p.fillText("ONCE UPON", w / 2, 110); p.fillText("A TIME...", w / 2, 172);
        p.fillStyle = "#ffcc80"; p.fillRect(200, 250, 70, 70); p.fillStyle = "#4fc3f7"; p.fillRect(190, 320, 90, 100); p.fillStyle = "#2a1d24"; p.fillRect(218, 272, 10, 12); p.fillRect(244, 272, 10, 12); p.beginPath(); p.arc(236, 300, 9, 0, TAU); p.fill();
        p.strokeStyle = "#e65100"; p.lineWidth = 7; for (let k = 0; k < 3; k++) { p.beginPath(); p.arc(290, 296, 30 + k * 26, -0.7, 0.7); p.stroke(); }
        p.strokeStyle = "#5a4a3a"; p.lineWidth = 6; for (let k = 0; k < 5; k++) { p.beginPath(); p.moveTo(60, 470 + k * 34); p.lineTo(w - 60 - (k === 4 ? 160 : 0), 470 + k * 34); p.stroke(); }
      }
    });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group(); leaf.position.set(s * 0.005, 0.03, 0); leaf.rotation.z = s * 0.1; book.add(leaf);
      bx(0.62, 0.05, 0.8, solid("#f3e6c4", { roughness: 0.9 }), { x: s * 0.31, y: 0.0, parent: leaf });
      const m = new THREE.MeshStandardMaterial({ map: page(s), roughness: 0.9, emissive: "#ffffff", emissiveMap: page(s), emissiveIntensity: 0.08 });
      addMesh(cachedGeo("storyPage", () => new THREE.PlaneGeometry(0.6, 0.8)), m, { x: s * 0.31, y: 0.026, rx: -Math.PI / 2, parent: leaf, shadow: false }).receiveShadow = true;
    }
    bx(0.04, 0.005, 0.5, solid("#ffd32a"), { y: 0.06, z: 0.55, parent: book, shadow: false }); // the ribbon
    // a few sparkles above the pages
    const sparkles = [];
    for (let k = 0; k < 4; k++) { const m = addMesh(cachedGeo("sparkle", () => new THREE.OctahedronGeometry(0.04, 0)), glowMat("#ffe066", 3.5, "#fff6c0"), { x: -0.45 + k * 0.3, y: 1.55, z: -0.1, parent: g, shadow: false }); sparkles.push(m); }
    g.userData.anim = (t) => sparkles.forEach((m, k) => { m.position.y = 1.5 + 0.08 * Math.sin(t * 2 + k * 1.7) + k * 0.03; m.rotation.y = t * 2 + k; });
    Object.assign(g.userData, { height: 1.7, width: 1.4, depth: 0.8, focus: V(0, 0, -0.25), fitW: 1.5, fitH: 1.75, fitY: 0.85, detail: { at: V(0, 0, -0.25), h: 1.45 }, actors: "beside" });
  },
};

/** an object by name or alias; opts.state from OBJECTS[name].states (default OBJECTS[name].state) */
export function makeObject(name, opts = {}) {
  const key = resolveObject(name);
  if (!key) throw new Error(`makeObject: unknown object "${name}" (${Object.keys(OBJECTS).join(", ")})`);
  const def = OBJECTS[key], state = opts.state ?? def.state;
  if (!def.states.includes(state)) throw new Error(`makeObject: object "${key}" has no state "${state}" (${def.states.join(", ")})`);
  const g = new THREE.Group(); g.name = `object:${key}:${state}`;
  g.userData = { kind: "object", name: key, state, actors: "front", push: 0.8 };
  (BUILD[key] ?? THING_BUILD[key])(g, state);
  g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return g;
}

/** per frame: lights, balloons, the mime, the people of an object */
export function animateObject(obj, state, t = 0) {
  const u = obj.userData;
  u.anim?.(t);
  if (u.animal || u.ride || MOTION_STATES.includes(state)) bodyMotion(obj, state, t); // 2026-11-05 (GAPS): walking, flying, sleeping...
  poseExtras(obj, t);
  if (u.mime) { // miming the invisible wall: both palms on a pane in front, sliding
    const j = u.mime.userData.joints, q = (v) => Math.round(v * 50) / 50;
    const a = Math.sin(t * TAU * 0.55), b = Math.sin(t * TAU * 0.55 + 1.9);
    reach(u.mime, 0, V(q(-0.2 + 0.07 * a), q(0.66 + 0.12 * b), 0.48));
    reach(u.mime, 1, V(q(0.2 + 0.07 * b), q(0.66 - 0.12 * a), 0.48));
    for (let i = 0; i < 2; i++) j.hand[i].rotation.x = -(j.sh[i].rotation.x + j.el[i].rotation.x) - 1.4;
    j.head.rotation.z = 0.1 * Math.sin(t * TAU * 0.4); j.head.rotation.y = 0.15 * Math.sin(t * TAU * 0.3);
  }
}
