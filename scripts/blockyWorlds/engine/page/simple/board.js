// Blocky Worlds STORYBOARD SET "board" (owner 2026-11-11: "each line = what we SEE happening"): a small town built for
// storyboard shots (lib/storyboard.js) - a street of houses with REAL windows (a hole in the wall, a lit room cavity
// behind, glass, cloth curtains), each house's own room inside, and the ANIMATED ACTIONS of lib/boardActions.js
// (curtains ripping off and flying like kites, a hammer nailing boards, a tongue licking glass, a blanket blowing
// off, an eye blinking...). The engine (page/engine.js) hands it each board shot: S.boardShot(ctx) places the people,
// the monster, the houses' state, animates the actions and sets the camera. Deterministic in t.
import * as THREE from "three";
import { mat, box, rbox, ball, cyl, canvasTex, seeded } from "./common.js";
import { makeSky, cloudTree } from "./town.js";
import { kneelBend } from "./monsters.js";
import { BOARD_ACTIONS } from "/lib/boardActions.js";

const HZ = -7, HX0 = -45, HDX = 15, HW = 9, FL = 3.2;            // house fronts at z = HZ, x = HX0 + i * HDX
const WIN = [[-2.4, 0.9], [2.4, 0.9], [-2.4, 4.1], [2.4, 4.1]];  // window [x, sill y] (0, 1 ground; 2, 3 upstairs)
const WW = 1.6, WH = 1.7, DEPTH = 2.4;
const ROOMZ = 110, RDX = 22, RW = 7, RH = 3.2, RD = 6, RWIN = { x: 0, y: 0.9, w: 1.9, h: 1.9 };
const WALLS = ["#f4c27a", "#9fd4e8", "#f2a3a3", "#c7e3a1", "#e8d0f2", "#f6e08c", "#b9c8f5"];
const CURT = ["#d6453c", "#3f7fd6", "#e8a33d", "#7a4fc2", "#3fae7a", "#e86fa5", "#d9d24a"];
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------------------------------------ cloth (soft folds)
/** a curtain panel: a plane of soft vertical folds (its own geometry, so it can flutter / fly) */
function cloth(w, h, color, { folds = 5, depth = 0.07, opacity = 1, seg = [12, 10], pattern = true } = {}) {
  const g = new THREE.PlaneGeometry(w, h, seg[0], seg[1]);
  const p = g.attributes.position, base = Float32Array.from(p.array);
  for (let i = 0; i < p.count; i++) { const x = base[i * 3]; base[i * 3 + 2] = Math.sin((x / w + 0.5) * folds * Math.PI * 2) * depth; }
  p.array.set(base); g.computeVertexNormals();
  const tex = pattern ? canvasTex(64, 64, (c, W, H) => { c.fillStyle = color; c.fillRect(0, 0, W, H); c.fillStyle = "rgba(255,255,255,0.18)"; for (let y = 4; y < H; y += 16) for (let x = 4; x < W; x += 16) c.fillRect(x, y, 5, 5); c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, H - 6, W, 6); }) : null;
  const m = new THREE.MeshStandardMaterial({ color: pattern ? "#ffffff" : color, map: tex, roughness: 0.95, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = opacity >= 1; mesh.receiveShadow = true;
  mesh.userData.cloth = { base, w, h };
  return mesh;
}
/** flutter: the hem moves most (amp metres), deterministic in t */
function flutter(mesh, t, amp, speed = 7) {
  const { base, h } = mesh.userData.cloth, p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], k = 0.5 - y / h; // 0 at the rod, 1 at the hem
    p.array[i * 3 + 2] = base[i * 3 + 2] + amp * k * Math.sin(t * speed + x * 2.3 + y * 1.7);
  }
  p.needsUpdate = true; mesh.geometry.computeVertexNormals();
}
/** a soft fabric puff (the curtain pile): a ball with folds */
function puff(r, color, seed) {
  const g = new THREE.SphereGeometry(r, 18, 12), p = g.attributes.position, R = seeded(seed);
  const a = R() * 6, f = 5 + Math.floor(R() * 4);
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const th = Math.atan2(v.z, v.x); v.multiplyScalar(1 + 0.11 * Math.sin(th * f + a + v.y * 3)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95 })); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------------------------------------ small kit
function catHead(parent) {
  const g = new THREE.Group(), fur = mat("#f08a2c", { rough: 0.9 }), ink = mat("#1b1b22"), pink = mat("#ff8fa6");
  rbox(g, [0.42, 0.36, 0.36], [0, 0, 0], fur, 0.06);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), fur); e.position.set(s * 0.13, 0.24, 0); g.add(e); ball(g, 0.045, [s * 0.09, 0.04, 0.18], ink); ball(g, 0.015, [s * 0.08, 0.06, 0.215], mat("#ffffff", { emissive: "#ffffff", ei: 0.4 })); }
  ball(g, 0.03, [0, -0.04, 0.19], pink);
  for (const s of [-1, 1]) box(g, [0.18, 0.01, 0.01], [s * 0.17, -0.06, 0.18], ink, { cast: false });
  parent.add(g); return g;
}
function catBody(parent) {
  const g = new THREE.Group(), fur = mat("#f08a2c", { rough: 0.9 });
  rbox(g, [0.32, 0.26, 0.55], [0, 0.18, 0], fur, 0.07);
  const h = catHead(g); h.position.set(0, 0.42, 0.28); h.scale.setScalar(0.8);
  const tail = rbox(g, [0.07, 0.07, 0.4], [0, 0.3, -0.42], fur, 0.03); tail.rotation.x = -0.6;
  parent.add(g); g.userData.head = h; return g;
}
const SOCK_TEX = () => canvasTex(256, 256, (c, W, H) => {
  c.clearRect(0, 0, W, H);
  c.save(); c.beginPath(); c.moveTo(60, 8); c.lineTo(196, 8); c.lineTo(196, 150); c.quadraticCurveTo(250, 160, 246, 210); c.quadraticCurveTo(240, 250, 180, 248); c.lineTo(80, 248); c.quadraticCurveTo(52, 246, 60, 200); c.closePath(); c.clip();
  for (let y = 0; y < H; y += 32) { c.fillStyle = (y / 32) % 2 ? "#ffffff" : "#e2373d"; c.fillRect(0, y, W, 32); }
  c.restore();
  c.fillStyle = "#14141c"; c.beginPath(); c.ellipse(110, 196, 16, 13, 0, 0, Math.PI * 2); c.fill(); // the hole (lower left: at the kid's eye)
});
const BRICK_TEX = () => canvasTex(128, 128, (c, W, H) => { c.fillStyle = "#e7dccb"; c.fillRect(0, 0, W, H); for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) { c.fillStyle = ["#b5492f", "#c4583a", "#a8412b"][(r + k + 3) % 3]; c.fillRect(k * 32 + (r % 2) * 16 + 2, r * 16 + 2, 28, 12); } });
const BOAT_TEX = () => canvasTex(256, 180, (c, W, H) => {
  c.fillStyle = "#8fd3ff"; c.fillRect(0, 0, W, H); c.fillStyle = "#2f6fd6"; c.fillRect(0, 110, W, 70);
  c.fillStyle = "#ffffff"; for (let x = 10; x < W; x += 40) c.fillRect(x, 118 + (x % 3) * 8, 22, 4);
  c.fillStyle = "#9b5a2c"; c.beginPath(); c.moveTo(60, 110); c.lineTo(196, 110); c.lineTo(176, 136); c.lineTo(80, 136); c.closePath(); c.fill();
  c.fillStyle = "#5a3a1c"; c.fillRect(126, 30, 6, 80); c.fillStyle = "#fff6e0"; c.beginPath(); c.moveTo(132, 34); c.lineTo(190, 100); c.lineTo(132, 100); c.closePath(); c.fill();
  c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(40, 36, 16, 0, Math.PI * 2); c.fill();
});
const QUILT_TEX = () => canvasTex(256, 256, (c, W, H) => { const P = ["#e8574a", "#f2c14e", "#4fa3d9", "#6cc070", "#b06fd1", "#f28fb8"]; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = P[(x * 3 + y * 5) % P.length]; c.fillRect(x * 32, y * 32, 32, 32); c.strokeStyle = "#ffffff"; c.setLineDash([4, 4]); c.strokeRect(x * 32 + 2, y * 32 + 2, 28, 28); } });

// ------------------------------------------------------------------------------------------------ a wall with holes
/** a wall of w x h at (0..), thickness d, front face at z = 0, with rectangular holes [{ x (centre), y (bottom), w, h }] */
function wallWithHoles(parent, w, h, d, holes, m) {
  const xs = [...new Set([-w / 2, w / 2, ...holes.flatMap((o) => [o.x - o.w / 2, o.x + o.w / 2])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1], cx = (x0 + x1) / 2, inH = holes.filter((o) => cx > o.x - o.w / 2 && cx < o.x + o.w / 2).sort((a, b) => a.y - b.y);
    let y = 0;
    for (const o of inH) { if (o.y > y) box(parent, [x1 - x0, o.y - y, d], [cx, (y + o.y) / 2, -d / 2], m); y = o.y + o.h; }
    if (h > y) box(parent, [x1 - x0, h - y, d], [cx, (y + h) / 2, -d / 2], m);
  }
}
function frameOf(parent, o, z, m) { const t = 0.12; box(parent, [o.w + 2 * t, t, 0.16], [o.x, o.y - t / 2, z], m); box(parent, [o.w + 2 * t, t, 0.16], [o.x, o.y + o.h + t / 2, z], m); for (const s of [-1, 1]) box(parent, [t, o.h, 0.16], [o.x + s * (o.w / 2 + t / 2), o.y + o.h / 2, z], m); }

// ------------------------------------------------------------------------------------------------ one window
/** a window's state objects: glass, the lit cavity, curtains (2 cloth panels), thin curtains (3), sock, bricks, batter,
 *  the pile (Dottie's puffs + drapes), all in the window's own group (front face at z = 0, the room behind at -z) */
function makeWindow(parent, o, k, seed) {
  const g = new THREE.Group(); g.position.set(o.x, o.y, 0); parent.add(g);
  const R = seeded(seed), wm = mat("#f3dfb8", { rough: 0.9 });
  // the cavity (a small lit room behind the glass)
  const cw = o.w + 1.2, ch = o.h + 1.0;
  const glowM = new THREE.MeshStandardMaterial({ color: "#3a3550", emissive: "#ffcf7a", emissiveIntensity: 0, roughness: 0.9 });
  box(g, [cw, ch, 0.05], [0, o.h / 2, -DEPTH], glowM, { cast: false });
  for (const s of [-1, 1]) box(g, [0.05, ch, DEPTH], [s * cw / 2, o.h / 2, -DEPTH / 2], wm, { cast: false });
  box(g, [cw, 0.05, DEPTH], [0, o.h / 2 + ch / 2, -DEPTH / 2], wm, { cast: false });
  box(g, [cw, 0.05, DEPTH], [0, -0.45, -DEPTH / 2], mat("#b98b5e"), { cast: false });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff3c8", emissive: "#ffdf9a", emissiveIntensity: 0 });
  box(g, [0.5, 0.06, 0.5], [0, o.h / 2 + ch / 2 - 0.05, -DEPTH / 2], lamp, { cast: false });
  const glassM = new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.16, roughness: 0.05, emissive: "#ffffff", emissiveIntensity: 0, depthWrite: false });
  const glass = box(g, [o.w, o.h, 0.02], [0, o.h / 2, -0.08], glassM, { cast: false, receive: false }); glass.renderOrder = 3;
  // curtains: two cloth panels at the sides (the house's colour), slightly closed
  const col = CURT[k % CURT.length];
  const curt = [-1, 1].map((s) => { const c = cloth(o.w * 0.55, o.h + 0.2, col, { folds: 4 }); c.position.set(s * o.w * 0.25, o.h / 2, -0.25); g.add(c); c.userData.home = c.position.clone(); return c; });
  const rod = box(g, [o.w + 0.4, 0.06, 0.06], [0, o.h + 0.08, -0.22], mat("#6b4a2a"));
  const thin = [-1, 0, 1].map((s) => { const c = cloth(o.w * 0.36, o.h + 0.1, "#f7f2e6", { folds: 3, opacity: 0.45, pattern: false, depth: 0.04 }); c.position.set(s * o.w * 0.32, o.h / 2, -0.22); g.add(c); return c; });
  const sock = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.62, o.h * 0.68), new THREE.MeshStandardMaterial({ map: SOCK_TEX(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
  sock.position.set(0, o.h * 0.4, -0.12); g.add(sock); sock.userData.home = sock.position.clone(); // the lower middle: the eye glows above and around it
  const tape = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => { const t = box(g, [0.3, 0.08, 0.01], [sx * o.w * 0.27, o.h * 0.4 + sy * o.h * 0.31, -0.11], mat("#f2e6b0"), { cast: false }); t.rotation.z = sx * sy * 0.6; return t; });
  const bricks = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({ map: BRICK_TEX(), roughness: 0.9 }));
  bricks.position.set(0, o.h / 2, -0.4); g.add(bricks);
  // batter: blobs on the glass (smeared / licked)
  const batter = []; for (let i = 0; i < 9; i++) { const b = ball(g, 0.18 + R() * 0.12, [(R() - 0.5) * o.w * 0.8, 0.2 + R() * (o.h - 0.4), -0.04], mat("#ffe9a8", { rough: 0.35 }), { sz: 0.12, sx: 1.7 }); b.userData.k = i; batter.push(b); }
  // the pile (bulging): puffs spilling out + drapes hanging down the wall
  const pile = new THREE.Group(); g.add(pile);
  // (no round puffs: they read as balloons) the pile is cloth: drapes spilling out of the window and bulging forward
  for (let i = 0; i < 9; i++) { const d = cloth(0.55 + R() * 0.5, 2.0 + R() * 1.2, CURT[(k + 2 + i) % CURT.length], { folds: 4, depth: 0.12 }); d.position.set((R() - 0.5) * o.w * 1.15, o.h - 0.6 - R() * 0.7, 0.15 + i * 0.07); d.rotation.set(0.25 + R() * 0.55, (R() - 0.5) * 0.5, (R() - 0.5) * 0.4); d.userData.home = d.position.clone(); pile.add(d); }
  return { g, o, glassM, glowM, lamp, glass, curt, rod, thin, sock, tape, bricks, batter, pile, col };
}
/** the window's look for a house state + this frame's actions; light: off | warm | white | dark */
function setWindow(w, st, light, night) {
  const cover = st?.cover ?? "curtained";
  w.curt.forEach((c) => { c.visible = cover === "curtained" || cover === "bulging"; c.position.copy(c.userData.home); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); });
  w.rod.visible = w.curt[0].visible || cover === "thin";
  w.thin.forEach((c) => { c.visible = cover === "thin"; });
  w.sock.visible = cover === "sock"; w.sock.position.copy(w.sock.userData.home); w.sock.rotation.set(0, 0, 0);
  w.tape.forEach((t) => { t.visible = cover === "sock"; });
  w.bricks.visible = !!st?.bricks; w.bricks.rotation.set(0, 0, 0); w.bricks.position.y = w.o.h / 2;
  w.batter.forEach((b) => { b.visible = cover === "smeared"; b.scale.z = 0.25 * (b.userData.s0 ?? 1); });
  w.pile.visible = cover === "bulging"; w.pile.children.forEach((p) => { if (p.userData.home) p.position.copy(p.userData.home); p.scale.setScalar(1); });
  const L = { off: [0, 0], warm: [night ? 1.1 : 0.25, night ? 0.9 : 0], white: [3.2, 2.2], dark: [0, 0] }[light] ?? [0, 0];
  w.glowM.emissive.set(light === "white" ? "#ffffff" : "#ffcf7a"); w.glowM.emissiveIntensity = L[0]; w.lamp.emissiveIntensity = L[1] * 1.5;
  w.glassM.emissiveIntensity = light === "white" ? 1.2 : 0; w.glassM.opacity = light === "white" ? 0.75 : 0.16;
}

// ------------------------------------------------------------------------------------------------ the street
function makeHouse(root, i, owner) {
  const g = new THREE.Group(); g.position.set(HX0 + i * HDX, 0, HZ); root.add(g);
  const wall = mat(WALLS[i % WALLS.length], { rough: 0.85 }), trim = mat("#ffffff", { rough: 0.6 }), roofM = mat(["#4a5fb0", "#b04a4a", "#4a8f5a", "#7a5aa8"][i % 4], { rough: 0.8 });
  const holes = WIN.map(([x, y]) => ({ x, y, w: WW, h: WH })).concat([{ x: 0, y: 0, w: 1.3, h: 2.3 }]);
  wallWithHoles(g, HW, 2 * FL, 0.3, holes, wall);
  for (const s of [-1, 1]) box(g, [0.3, 2 * FL, 8], [s * (HW / 2 - 0.15), FL, -4], wall); box(g, [HW, 2 * FL, 0.3], [0, FL, -8], wall);
  box(g, [HW, 0.3, 8], [0, 2 * FL, -4], wall);
  for (const s of [-1, 1]) { const r = box(g, [HW / 2 + 0.6, 0.35, 8.8], [s * HW / 4, 2 * FL + 1.25, -4], roofM); r.rotation.z = -s * 0.55; }
  box(g, [HW + 0.2, 0.4, 0.5], [0, 0.2, 0.15], mat("#d8d2c4"));
  const door = box(g, [1.3, 2.3, 0.12], [0, 1.15, -0.2], mat(["#c0392b", "#2e86de", "#27ae60", "#8e44ad"][i % 4]));
  ball(g, 0.06, [0.45, 1.15, -0.1], mat("#ffd84a", { rough: 0.3 })); void door;
  const wins = WIN.map(([x, y], k) => { const o = { x, y, w: WW, h: WH }; frameOf(g, o, 0.02, trim); return makeWindow(g, o, i, i * 10 + k + 1); });
  cloudTree(root, HX0 + i * HDX + 7.5, HZ - 9, 0.8, i + 3); // behind the houses' line (a front-yard tree blocked the street shots)
  return { g, i, owner, wins, x: HX0 + i * HDX };
}
function makeLamp(root, x, z, S) {
  const pole = mat("#2b2f3a"), head = new THREE.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffd98a", emissiveIntensity: 0 });
  cyl(root, 0.08, 0.1, 4.4, [x, 2.2, z], pole); box(root, [0.5, 0.25, 0.5], [x, 4.5, z], head);
  S.lamps.push(V(x, 4.2, z)); S.lampHeads.push(head);
}

// ------------------------------------------------------------------------------------------------ the rooms
function makeRoom(root, k, owner) {
  const g = new THREE.Group(); g.position.set(-60 + k * RDX, 0, ROOMZ); root.add(g);
  const wall = mat(["#f6e3c4", "#dfe9f7", "#f4d9e4", "#e3f1d8", "#fbe8c8", "#e9e0f6", "#f7efc9"][k % 7], { rough: 0.9 }), floor = mat("#b98b5e", { rough: 0.8 });
  box(g, [RW, 0.1, RD], [0, -0.05, -RD / 2 + 3], floor);
  const back = new THREE.Group(); back.position.set(0, 0, -3); g.add(back);
  wallWithHoles(back, RW, RH, 0.2, [RWIN], wall);
  frameOf(back, RWIN, 0.02, mat("#ffffff"));
  const winObj = makeWindow(back, RWIN, k, 500 + k);
  winObj.glowM.visible = false; // the room window looks OUT: no cavity behind it
  winObj.g.children.slice(0, 6).forEach((c) => { c.visible = false; }); // (cavity walls, floor, lamp)
  for (const s of [-1, 1]) { const sw = new THREE.Group(); sw.position.set(s * RW / 2, 0, 0); g.add(sw); box(sw, [0.2, RH, RD], [0, RH / 2, 0], wall); }
  box(g, [RW, 0.1, RD], [0, RH, 0], mat("#fbf6ec")); // ceiling
  box(g, [RW, 0.25, 0.08], [0, 0.12, -2.88], mat("#ffffff")); // skirting
  // outside the window: the night garden, a fence, the houses across with lit windows
  box(g, [40, 0.05, 30], [0, -0.06, -18], mat("#2f6b3a"));
  for (let i = -3; i <= 3; i++) { const hx = i * 7; box(g, [5, 5 + (i & 1) * 2, 4], [hx, 2.6, -22], mat(WALLS[(i + 7) % 7])); for (const wx of [-1.2, 1.2]) box(g, [1, 1.1, 0.05], [hx + wx, 3.2, -19.95], new THREE.MeshStandardMaterial({ color: "#3a3550", emissive: "#ffcf7a", emissiveIntensity: 0.9 }), { cast: false }); }
  const light = new THREE.PointLight("#ffd9a0", 0, 12, 1.4); light.position.set(0.5, 2.7, 0.2); g.add(light);
  const R = { g, k, owner, win: winObj, light, x: -60 + k * RDX, props: {} };
  // furniture by owner
  const P = R.props;
  const bed = (x, z) => { const b = new THREE.Group(); b.position.set(x, 0, z); g.add(b); box(b, [1.4, 0.45, 2.3], [0, 0.25, 0], mat("#8a5a3a")); box(b, [1.3, 0.18, 2.1], [0, 0.55, 0.05], mat("#fbfbf5")); box(b, [1.3, 0.12, 1.4], [0, 0.66, 0.4], mat("#5b8fd9")); rbox(b, [0.7, 0.16, 0.4], [0, 0.7, -0.8], mat("#ffffff"), 0.06); box(b, [1.4, 0.9, 0.12], [0, 0.6, -1.12], mat("#8a5a3a")); return b; };
  if (owner === "me") { P.bed = bed(2.2, -0.9); box(g, [1.6, 0.06, 0.3], [-2.6, 1.9, -1.0], mat("#8a5a3a")); for (let i = 0; i < 5; i++) box(g, [0.14, 0.32, 0.22], [-3.1 + i * 0.2, 2.1, -1.0], mat(CURT[i])); cyl(g, 1.3, 1.3, 0.02, [0.3, 0.01, 0.2], mat("#ffb84a")); P.cat = catBody(g); P.cat.position.set(1.65, 0.7, -0.4); P.cat.rotation.y = -Math.PI / 2; }
  if (owner === "hollis") {
    const pf = new THREE.Group(); pf.position.set(-RW / 2 + 0.12, 1.75, -0.6); pf.rotation.y = Math.PI / 2; g.add(pf);
    box(pf, [1.6, 1.15, 0.06], [0, 0, 0], mat("#7a4a1c")); const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.98), new THREE.MeshStandardMaterial({ map: BOAT_TEX(), roughness: 0.8 })); pic.position.z = 0.035; pf.add(pic);
    P.boards = [0, 1, 2].map((i) => { const b = box(pf, [1.9, 0.22, 0.05], [0, -0.38 + i * 0.38, 0.09], mat("#c9935a")); b.rotation.z = [0.12, -0.08, 0.05][i]; return b; });
    P.nails = P.boards.map((b) => [-0.75, 0.75].map((x) => { const n = ball(pf, 0.035, [x, b.position.y, 0.13], mat("#9aa0a8", { rough: 0.3 })); return n; }));
    P.stack = new THREE.Group(); P.stack.position.set(2.6, 0, -2.4); g.add(P.stack); for (let i = 0; i < 4; i++) { const b = box(P.stack, [0.22, 1.9, 0.05], [i * 0.08, 0.95, i * 0.12], mat("#c9935a")); b.rotation.z = 0.12; }
    P.table = box(g, [0.9, 0.75, 0.6], [1.8, 0.375, -0.2], mat("#8a5a3a"));
    P.bricks = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) P.bricks.push(box(g, [0.4, 0.2, 0.22], [-0.8 + c * 0.4 + (r % 2) * 0.2 - 0.1, 0.9 + 0.11 + r * 0.21, -2.65], mat(["#b5492f", "#c4583a", "#a8412b"][(r + c) % 3])));
    P.ledge = box(g, [2.2, 0.9, 0.3], [0, 0.45, -2.7], mat("#8a5a3a"));
  }
  if (owner === "dottie") { box(g, [2.2, 0.9, 0.7], [-2.2, 0.45, -2.4], mat("#e9ecef")); P.bowl = cyl(g, 0.25, 0.16, 0.18, [-2.2, 1.0, -2.3], mat("#4fa3d9")); ball(g, 0.2, [-2.2, 1.06, -2.3], mat("#f3d58a", { rough: 0.5 }), { sy: 0.4 }); box(g, [1.2, 0.75, 0.8], [1.6, 0.375, -0.8], mat("#c98a5a")); }
  if (owner === "fenwick") { box(g, [2.6, 0.5, 0.9], [-1.7, 0.25, -2.3], mat("#7a8fd9")); box(g, [2.6, 0.8, 0.25], [-1.7, 0.75, -2.7], mat("#6a7fc9")); cyl(g, 1.5, 1.5, 0.02, [0.3, 0.01, -0.4], mat("#c9545a")); cyl(g, 0.05, 0.05, 1.5, [2.8, 0.75, -2.4], mat("#2b2f3a")); ball(g, 0.25, [2.8, 1.6, -2.4], new THREE.MeshStandardMaterial({ color: "#fff3c8", emissive: "#ffdf9a", emissiveIntensity: 0.8 })); }
  if (owner === "town1") { P.bed = bed(0.6, -0.9); box(g, [0.5, 0.6, 0.5], [-0.6, 0.3, -1.7], mat("#8a5a3a")); }
  // the door (left wall, at the front)
  box(g, [0.1, 2.2, 1.1], [-RW / 2 + 0.12, 1.1, 2.0], mat("#a0522d"));
  return R;
}
const MARK = { window: [-1.2, -2.2], center: [0.4, -0.2], door: [-2.6, 1.6], painting: [-2.55, -0.55], bed: [0.6, -0.9], huddle0: [-0.35, -0.6], huddle1: [0.35, -0.6], huddle2: [-0.15, -1.25], huddle3: [0.5, -1.25] };

// ------------------------------------------------------------------------------------------------ the set
export function buildBoard({ tl = null } = {}) {
  const root = new THREE.Group(); root.name = "set:board";
  const S = { root, spots: {}, lamps: [], lampHeads: [], indoor: false, simple: true, board: true, shadow: { half: 30 }, camDir: V(0, 0, 1) };
  S.sky = makeSky(root);
  const moon = ball(root, 9, [120, 160, -380], new THREE.MeshStandardMaterial({ color: "#fff8dc", emissive: "#fff3c0", emissiveIntensity: 1.2 }), { cast: false }); S.moon = moon;
  // the ground: grass, the road with its dashes, two pavements
  box(root, [400, 0.1, 400], [0, -0.05, 0], mat("#4c9a3f"));
  box(root, [200, 0.04, 7], [0, 0.0, 0], mat("#2f3238", { rough: 0.95 }));
  for (let x = -96; x < 100; x += 6) box(root, [2.4, 0.02, 0.18], [x, 0.03, 0], mat("#f2c14e"), { cast: false });
  for (const z of [-4.6, 4.6]) box(root, [200, 0.18, 2.2], [0, 0.09, z], mat("#c9c5bb"));
  const homes = tl?.storyboard?.homes ?? { town1: 0, town2: 1, dottie: 2, hollis: 3, fenwick: 4, town3: 5, me: 6 };
  const owners = Object.entries(homes).sort((a, b) => a[1] - b[1]).map(([o]) => o);
  S.houses = {}; owners.forEach((o, i) => { S.houses[o] = makeHouse(root, i, o); });
  for (let x = -50; x <= 60; x += 14) { makeLamp(root, x, -3.6, S); makeLamp(root, x + 7, 3.6, S); }
  for (let x = -60; x <= 70; x += 13) cloudTree(root, x, 15 + (x % 3), 1.1, x + 99); // the far side, well behind the street cameras
  S.rooms = {}; owners.forEach((o, k) => { S.rooms[o] = makeRoom(root, k, o); });
  Object.assign(S.spots, { center: V(0, 0, 0), left: V(-3, 0, 0), right: V(3, 0, 0), back: V(0, 0, HZ), far: V(0, 0, HZ - 4), door: V(0, 0, HZ + 1) });
  S.depthDir = V(0, 0, -1);
  // the flying things (wind, kites), the blanket, the tongue, the leaves
  S.kites = Array.from({ length: 22 }, (_, i) => { const g = new THREE.Group(); const c = cloth(2.4, 3.2, CURT[i % CURT.length], { folds: 3, seg: [8, 8] }); g.add(c); g.userData.c = c; const tail = new THREE.Group(); g.add(tail); for (let j = 0; j < 5; j++) { const bw = box(tail, [0.45, 0.25, 0.03], [0, -1.9 - j * 0.55, 0], mat(CURT[(i + j + 2) % CURT.length]), { cast: false }); bw.rotation.z = (j % 2 ? 1 : -1) * 0.5; } g.userData.tail = tail; root.add(g); return g; });
  S.blanket = new THREE.Group(); { const tex = QUILT_TEX(); const geo = new THREE.CylinderGeometry(0.95, 1.25, 1.35, 20, 6, true); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.06 * Math.sin(a * 9); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide })); m.castShadow = true; S.blanket.add(m); const top = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.97, 20), m.material); top.rotation.x = -Math.PI / 2; top.position.y = 0.67; S.blanket.add(top); root.add(S.blanket); }
  S.flyBlanket = cloth(2.6, 2.0, "#e8574a", { folds: 4, seg: [12, 10] }); S.flyBlanket.material.map = QUILT_TEX(); S.flyBlanket.material.color.set("#ffffff"); root.add(S.flyBlanket);
  S.tongue = rbox(new THREE.Group(), [0.8, 0.18, 2.0], [0, 0, 1.0], mat("#e8577a", { rough: 0.4 }), 0.07).parent;
  S.leaves = Array.from({ length: 40 }, (_, i) => box(root, [0.18, 0.02, 0.12], [0, 0, 0], mat(["#e8a33d", "#d6453c", "#6cc070"][i % 3]), { cast: false }));
  S.held = [];
  S.camFill = new THREE.PointLight("#fff1dc", 0, 9, 1.2); root.add(S.camFill); // a soft key from the lens side indoors (faces read, not dark silhouettes)
  S.setWindows = () => {};
  S.boardShot = (ctx) => boardShot(S, ctx);
  for (const k of Object.keys(BOARD_ACTIONS)) if (!ACTS.has(k)) throw new Error(`board: action ${k} has no animation`);
  return S;
}

// every action key this page animates (a key in lib/boardActions.js without one here fails the build above)
const ACTS = new Set(["lights_on:windows", "peek:curtains", "lurk:monster", "press:eye", "glow:windows", "stare:ceiling", "bulge:curtains", "poke_out:cat", "stack:bricks", "tremble:curtains", "wave", "peek:sock", "stare:cat", "catch:peeking", "talk", "rip:curtains", "fly:curtains", "grab:boards", "nail:boards", "smear:batter", "lick:glass", "huddle:blanket", "herd", "sneeze", "blow_off:blanket", "look_up", "turn:monster", "pull:sock", "blink:eye", "back_away:monster", "dark:windows", "sleep", "cover:eyes", "walk", "stare", "twitch:eye", "arrive:monster", "hide:curtains"]);

// ------------------------------------------------------------------------------------------------ one shot
const houseLight = (st, night) => (!st ? "warm" : st.light === "glow_white" || st.light === "eye" ? "white" : st.light === "dark" ? "dark" : night ? "warm" : "off");
function winWorld(w) { w.g.updateMatrixWorld(true); return w.g.localToWorld(V(0, w.o.h / 2, 0)); }

function boardShot(S, { shot, lt, dur, camera, people, monster, animateMonster, posePerson, setFace }) {
  const b = shot.board, acts = new Map(b.acts.map((a) => [a.k, a])), has = (k) => acts.has(k), atOf = (k) => acts.get(k)?.at ?? 0;
  const night = shot.light === "night" || shot.light === "dusk";
  const room = /^room:/.test(b.loc) ? S.rooms[b.loc.slice(5)] : null;
  const houseOf = (id) => b.houses?.[id] ?? b.houses?.["*"] ?? null;
  for (const h of S.held) h.parent?.remove(h); S.held = [];
  // ---- the houses + rooms: their windows in this line's state
  for (const [id, H] of Object.entries(S.houses)) {
    const st = houseOf(id), before = b.before?.[id] ?? b.before?.["*"] ?? st;
    const stNow = (has("rip:curtains") || has("pull:sock") || has("lick:glass")) ? before : st;
    H.wins.forEach((w, k) => {
      let light = houseLight(stNow, night);
      if (has("lights_on:windows")) light = lt > 0.3 + ((H.i * 4 + k) % 11) * (dur * 0.06) ? "warm" : "off";
      if (has("glow:windows")) { const only = acts.get("glow:windows").only; if (!only || only === `${id}:${k}`) light = lt >= atOf("glow:windows") ? "white" : light; }
      if (has("dark:windows")) light = lt > dur * (0.15 + 0.07 * ((H.i * 4 + k) % 10)) ? "dark" : "white";
      if (st?.light === "eye" && !(acts.get("glow:windows")?.only === `${id}:${k}`)) light = night ? "warm" : "off";
      setWindow(w, stNow, light, night);
    });
  }
  for (const [id, R] of Object.entries(S.rooms)) {
    const st = houseOf(id), before = b.before?.[id] ?? b.before?.["*"] ?? st;
    setWindow(R.win, (has("pull:sock") || has("lick:glass")) ? before : st, "off", night);
    R.win.glassM.opacity = 0.12; R.light.intensity = room === R ? (night ? 7 : 3) : 0;
    if (room === R && has("glow:windows") && lt >= atOf("glow:windows")) { R.win.glassM.emissiveIntensity = 1.4; R.win.glassM.opacity = 0.5; R.light.color.set("#e8f0ff"); } else R.light.color.set("#ffd9a0");
  }
  const lampsOn = night ? (has("lights_on:windows") ? ease((lt - 0.2) / Math.max(0.5, dur * 0.5)) : 1) : 0;
  S.lampHeads.forEach((h, i) => { h.emissiveIntensity = (has("lights_on:windows") ? (lt > 0.2 + (i % 9) * dur * 0.06 ? 1 : 0) : lampsOn) * 2.2; });
  S.__night = night && lampsOn > 0.5;
  S.moon.visible = night;
  // ---- the hidden-by-default things
  S.kites.forEach((k) => { k.visible = false; }); S.blanket.visible = false; S.flyBlanket.visible = false; S.leaves.forEach((l) => { l.visible = false; });
  if (S.tongue.parent) S.tongue.parent.remove(S.tongue);
  for (const R of Object.values(S.rooms)) { const P = R.props; if (P.cat) P.cat.visible = has("stare:cat"); if (P.boards) { P.boards.forEach((x) => { x.visible = (houseOf("hollis")?.painting === "boarded"); }); P.nails.flat().forEach((n) => { n.visible = houseOf("hollis")?.painting === "boarded"; }); } if (P.bricks) P.bricks.forEach((x) => { x.visible = false; }); }

  // ---- people
  const where = {};
  for (const p of b.people) {
    const P = people[p.id]; if (!P) continue;
    const o = P.obj; o.visible = true; o.rotation.set(0, 0, 0);
    let pos = V(0, 0, 0), yaw = 0;
    const w = String(p.where);
    if (w.startsWith("window:")) { const [, h, k] = w.split(":"); const win = S.houses[h]?.wins[Number(k) || 0]; if (win) { const c = winWorld(win); pos = V(c.x, c.y - P.headC + 0.05, c.z - 0.75); yaw = 0; } }
    else if (w.startsWith("room:") && room) {
      const m = MARK[w.slice(5)] ?? MARK.center; pos = room.g.localToWorld(V(m[0], 0, m[1]));
      yaw = w === "room:window" ? (has("peek:sock") ? Math.PI : has("smear:batter") ? Math.PI - 0.7 : has("pull:sock") ? Math.PI - 0.9 : has("stack:bricks") ? Math.PI * 0.55 : 0.3) : w === "room:painting" ? -Math.PI / 2 + 0.5 : w === "room:door" ? Math.PI * 0.35 : /^room:huddle/.test(w) ? (p.pose === "look_up" ? Math.PI - 1.5 : 0.15) : 0;
      if (p.peek) { pos = room.g.localToWorld(V(-0.38, 0, -2.55)); yaw = Math.PI - 0.7; } // the eye at the hole, the face 3/4 to the lens
      if (w === "room:center" && has("stare:cat")) { pos = room.g.localToWorld(V(0.75, 0, -0.4)); yaw = Math.PI / 2; }
      if (w === "room:center" && (has("grab:boards"))) { pos = room.g.localToWorld(V(1.0, 0, 0.3)); yaw = -0.4; }
      if (w === "room:bed") { pos = room.g.localToWorld(V(0.6, 0.62, -0.75)); }
    }
    if (b.cam === "pov_eye" && room) { const c = room.g.localToWorld(V(0.15, 0, -2.75)); yaw = Math.atan2(c.x - pos.x, c.z - pos.z); } // the eye's view: every face turned up to it
    if (has("catch:peeking") && p.id === acts.get("catch:peeking").who && room) { pos = room.g.localToWorld(V(1.6 + 0.9 * (1 - ease(lt / 0.8)), 0, 0.3)); yaw = -0.2; } // steps in from the right, Nell at the sock behind him
    o.position.copy(pos); o.rotation.y = yaw;
    let pose = p.pose ?? "stand";
    if (p.where === "room:bed") pose = p.awake ? "stand" : "sleep";
    if (has("herd") && p.id === acts.get("herd").who) pose = "wave";
    if (has("sneeze") && p.id === acts.get("sneeze").who) pose = "sneeze";
    if (has("grab:boards") && p.id === acts.get("grab:boards").who) pose = lt < 0.5 ? "stand" : "carry";
    const blink = !!p.shut;
    posePerson(o, pose, has("sneeze") && pose === "sneeze" ? Math.max(0, lt - atOf("sneeze") + 0.1) : lt, { blink, ...(pose === "sleep" ? { bed: 0 } : {}), ...(has("grab:boards") && lt < 0.8 ? { blendFrom: { pose: "stand", t: lt, k: ease((lt - 0.5) / 0.3) } } : {}) });
    { const fk = (p.faces ?? []).filter((x) => x.t <= lt).at(-1); const face = fk?.face ?? p.face; if (face) setFace(o, face); }
    if (p.where === "room:bed" && p.awake) { o.rotation.set(-Math.PI / 2, 0, 0); o.position.y += 0.1; o.position.z += 0.85; }
    const J = o.userData.joints;
    // hands-on actions: the arm moves, the thing in the hand
    if (J && has("nail:boards") && p.id === acts.get("nail:boards").who) { const sw = Math.abs(Math.sin(lt * 6.5)); J.sh[1].rotation.set(-1.9 + 1.1 * sw, 0, 0); J.el[1].rotation.set(-0.4, 0, 0); J.sh[0].rotation.set(-1.4, 0, 0.2); hold(S, J.hand[1], "hammer"); }
    if (J && has("grab:boards") && p.id === acts.get("grab:boards").who && lt > 0.55) { hold(S, J.hand[0], "boards"); hold(S, J.hand[1], "hammer"); }
    if (J && has("smear:batter") && p.id === acts.get("smear:batter").who) { const a = lt * 5; J.sh[1].rotation.set(-1.6 + 0.35 * Math.sin(a), 0, 0.3 * Math.cos(a)); J.sh[0].rotation.set(-0.9, 0, 0.3); hold(S, J.hand[0], "bowl"); }
    if (J && has("pull:sock") && p.id === acts.get("pull:sock").who) { const k = ease(lt / Math.max(0.6, dur * 0.5)); J.sh[1].rotation.set(-2.6 + 1.6 * k, 0, 0); J.sh[0].rotation.set(-2.4 + 1.4 * k, 0, 0); }
    if (J && has("stack:bricks") && p.id === acts.get("stack:bricks").who) { const sw = Math.sin(lt * 4.5); J.sh[0].rotation.set(-1.3 + 0.3 * sw, 0, 0); J.sh[1].rotation.set(-1.3 + 0.3 * sw, 0, 0); hold(S, J.hand[1], "brick"); }
    if (J && has("cover:eyes")) { J.sh[0].rotation.set(-2.5, 0, 0.35); J.sh[1].rotation.set(-2.5, 0, -0.35); J.el[0].rotation.set(-1.3, 0, 0); J.el[1].rotation.set(-1.3, 0, 0); }
    if (J && has("look_up") && pose === "look_up") J.head.rotation.x = -0.55;
    if (J && has("stare:cat") && p.id === acts.get("stare:cat").who) { J.head.rotation.x = 0.15; }
    o.updateMatrixWorld(true);
    where[p.id] = { pos, head: pos.clone().setY(pos.y + P.headC), yaw, P };
  }

  // a person behind a glowing window stays readable: the glass lets their silhouette through the white
  for (const p of b.people) { if (!String(p.where).startsWith("window:")) continue; const [, h, kk] = p.where.split(":"); const w = S.houses[h]?.wins[Number(kk) || 0]; if (w && w.glassM.opacity > 0.5) { w.glassM.opacity = 0.18; w.glassM.emissiveIntensity = 0.2; w.glowM.emissiveIntensity = 1.4; } }
  // ---- the window / room actions
  const H = /^(house|window):/.test(b.loc) || b.loc.startsWith("house:") ? S.houses[b.loc.split(":")[1]] : null;
  if (has("peek:curtains")) { const p = acts.get("peek:curtains"), win = S.houses[p.who]?.wins[0] ?? H?.wins[0]; if (win) { const k = ease((lt - 0.2) / 0.7); win.curt[1].scale.x = 1 - 0.55 * k; win.curt[1].position.x = win.curt[1].userData.home.x + 0.22 * k; win.curt[0].position.x = win.curt[0].userData.home.x - 0.05 * k; } }
  if (has("hide:curtains")) for (const p of b.people) { if (!String(p.where).startsWith("window:")) continue; const [, h, kk] = p.where.split(":"); const win = S.houses[h]?.wins[Number(kk) || 0]; const P = people[p.id]; if (!win || !P) continue; const lean = Math.sin(Math.PI * Math.min(1, lt / Math.max(0.8, dur * 0.55))); P.obj.position.z += 0.35 * lean - (lt > dur * 0.55 ? 0.4 * ease((lt - dur * 0.55) / 0.3) : 0); const shut = ease((lt - dur * 0.5) / 0.35); win.curt.forEach((c, ci) => { c.visible = true; c.position.x = c.userData.home.x * (1 - 0.95 * shut) + (ci ? 0.02 : -0.02); c.scale.x = 1 + 0.35 * shut; }); P.obj.updateMatrixWorld(true); }
  if (has("tremble:curtains")) for (const w of (H ?? S.houses.fenwick).wins) for (const c of w.thin) flutter(c, lt, 0.06, 11);
  if (has("bulge:curtains")) { const pl = S.houses.dottie.wins.map((w) => w.pile); pl.forEach((g, gi) => g.children.forEach((p, i) => { if (p.userData.home) { const s = 1 + 0.07 * Math.sin(lt * 2.2 + i + gi); p.scale.setScalar(s); } else flutter(p, lt + i, 0.08, 3); })); }
  if (has("poke_out:cat")) { const w = S.houses.dottie.wins[0]; if (!S.cat) S.cat = catHead(new THREE.Group()); w.g.add(S.cat); S.held.push(S.cat); const k = ease((lt - 0.3) / 0.6); S.cat.position.set(0.35, 0.95, -0.1 + 1.05 * k); S.cat.rotation.set(0, 0.5 * Math.sin(lt * 2.5) * k, 0.15 * Math.sin(lt * 3)); }
  if (has("stack:bricks") && room?.props.bricks) { const n = room.props.bricks.length, k = Math.min(1, lt / Math.max(0.5, dur * 0.85)); room.props.bricks.forEach((x, i) => { const on = i < 6 + k * (n - 6); x.visible = on; const fresh = on && i >= Math.floor(6 + k * (n - 6)) - 2; x.position.y = x.userData.y0 ?? (x.userData.y0 = x.position.y); if (fresh) x.position.y += 0.25 * (1 - ((k * (n - 6)) % 1)); }); room.win.curt.forEach((c) => { c.visible = true; }); }
  if (has("nail:boards") && room?.props.boards) { const k = Math.min(1, lt / Math.max(0.6, dur * 0.8)); room.props.boards.forEach((x, i) => { x.visible = k > i * 0.3 || houseOf("hollis")?.painting === "boarded" && b.cam !== "painting"; }); room.props.nails.forEach((ns, i) => ns.forEach((n) => { n.visible = k > i * 0.3 + 0.12; })); }
  if (has("smear:batter") && room) { const n = room.win.batter.length; room.win.batter.forEach((x, i) => { x.visible = lt > 0.25 + i * (dur * 0.8 / n); const k = ease((lt - 0.25 - i * (dur * 0.8 / n)) / 0.2); x.scale.z = 0.25 * k; x.scale.x = (x.userData.sx0 ??= x.scale.x) * (0.4 + 0.6 * k); }); }
  if (has("lick:glass")) { const w = S.houses.dottie.wins[0]; const sweep = -0.9 + 1.8 * ease(lt / Math.max(0.6, dur * 0.85)); w.batter.forEach((x) => { x.visible = x.position.x > sweep; x.scale.z = 0.25; }); }
  if (has("pull:sock") && room) { const k = ease((lt - 0.2) / Math.max(0.5, dur * 0.5)); room.win.sock.position.set(0.3 * k, room.win.o.h * 0.4 - 1.4 * k, -0.12 + 0.6 * k); room.win.sock.rotation.set(-0.9 * k, 0, 0.6 * k); room.win.sock.visible = k < 0.98; room.win.tape.forEach((t) => { t.visible = k < 0.2; }); }
  if (has("rip:curtains")) {
    const t0 = dur * 0.18;
    for (const Hh of Object.values(S.houses)) Hh.wins.forEach((w, k) => {
      const d = lt - t0 - ((Hh.i * 4 + k) % 9) * 0.07; w.bricks.visible = false;
      for (const [ci, c] of [...w.curt, ...w.thin].entries()) { if (!c.visible) continue; flutter(c, lt, d < 0 ? 0.12 : 0.3, 12); if (d > 0) { const e = d * 1.4; c.position.set(c.userData.home?.x ?? c.position.x + (ci - 0.5) * 0.4 * e, w.o.h / 2 + 1.6 * e * e + 0.6 * e, (c.userData.home?.z ?? -0.25) + 2.4 * e); c.rotation.set(-0.6 * e, 0.4 * e * (ci ? 1 : -1), 0.5 * Math.sin(lt * 6 + ci) * Math.min(1, e)); } }
      w.pile.children.forEach((p, i) => { if (d > 0) { const e = d * 1.2; p.position.set((p.userData.home?.x ?? 0) + 0.8 * e * (i % 2 ? 1 : -1), (p.userData.home?.y ?? 0) + 2 * e * e + e, (p.userData.home?.z ?? 0) + 2.5 * e); } });
    });
    S.leaves.forEach((l, i) => { const R = seeded(i + 7); l.visible = true; const ph = (lt * 0.6 + R()) % 1; l.position.set(-50 + ph * 100 + R() * 6, 0.6 + R() * 7 + 1.5 * Math.sin(lt * 3 + i), -6 + R() * 14); l.rotation.set(lt * 5 + i, lt * 3, i); });
  }
  if (has("fly:curtains")) S.kites.forEach((g, i) => { const R = seeded(i + 31); g.visible = true; const e = lt + R() * 1.5; g.position.set(-2 + R() * 14 + 1.6 * e, 6 + R() * 11 + 1.3 * e, -4 - R() * 9); g.rotation.set(0.4 * Math.sin(e * 2 + i), 0.3 * Math.sin(e + i), 0.5 * Math.sin(e * 1.7 + i)); flutter(g.userData.c, lt + i, 0.45, 9); g.userData.tail.rotation.z = 0.5 * Math.sin(lt * 4 + i); });
  if ((has("huddle:blanket") || has("blow_off:blanket")) && room) {
    const ids = b.people.filter((p) => /^room:huddle/.test(p.where)).map((p) => where[p.id]).filter(Boolean);
    const c = ids.reduce((a, x) => a.add(x.pos), V(0, 0, 0)).divideScalar(Math.max(1, ids.length));
    const sh = Math.min(...ids.map((x) => x.P.headC)) - 0.2;
    const off = has("blow_off:blanket") ? ease((lt - atOf("blow_off:blanket")) / 0.5) : 0;
    S.blanket.visible = off < 0.05; S.blanket.position.set(c.x, sh - 0.68, c.z); S.blanket.scale.set(1.05, 1, 1.05);
    if (off >= 0.05) { S.flyBlanket.visible = true; const e = lt - atOf("blow_off:blanket"); S.flyBlanket.position.set(c.x + 0.8 * e, sh + 0.4 + 1.6 * e, c.z + 1.4 * e); S.flyBlanket.rotation.set(-0.9 - 0.5 * e, 0.4 * e, 0.3 * Math.sin(e * 5)); flutter(S.flyBlanket, lt, 0.35, 10); }
  }

  // ---- the monster
  let mon = null;
  if (monster && b.monster) {
    const m = b.monster, M = monster; M.visible = true; mon = M;
    const eye = m.eye ?? (has("blink:eye") ? "blink" : has("twitch:eye") ? "twitch" : "stare");
    const eyeAt = has("blink:eye") ? atOf("blink:eye") : 0;
    const w = String(m.where);
    M.rotation.set(0, 0, 0); M.position.set(0, 0, 0);
    const arriving = has("arrive:monster") ? ease((lt - 0.1) / Math.max(0.6, dur * 0.75)) : 1;
    if (w.startsWith("window:") || w.startsWith("roomwindow:")) {
      const out = w.startsWith("window:"), [, h, k] = w.split(":");
      const win = out ? S.houses[h]?.wins[Number(k) || 0] : S.rooms[h]?.win;
      const c = winWorld(win), facing = out ? Math.PI : 0, fwd = V(Math.sin(facing), 0, Math.cos(facing));
      const target = c.clone().addScaledVector(fwd, -0.45);
      const opts = { eye: eye === "press" ? "press" : eye, eyeAt, kneel: { bend: kneelBend(target.y) }, crisp: !out };
      M.rotation.y = facing; animateMonster(M, "lurk", lt, opts); if (out) M.userData.head.rotation.y -= 0.9; M.updateMatrixWorld(true); // outside: the eye turned to the lens (side-on it read as a dark block)
      const e = M.userData.eyes[0].e.getWorldPosition(V(0, 0, 0));
      M.position.x += target.x - e.x; M.position.z += target.z - e.z; M.position.y += Math.min(0.6, Math.max(-0.6, target.y - e.y));
      if (arriving < 1) { // still walking in: upright, on the road, legs striding, then down to the window
        const kneelPos = M.position.clone(), road = V(kneelPos.x - 14, 0, 1.2), k2 = Math.min(1, arriving / 0.85);
        animateMonster(M, "lurk", lt, { eye: "stare" }); M.position.copy(road.clone().lerp(V(kneelPos.x - 1.5, 0, kneelPos.z + 3), k2)); M.rotation.y = Math.atan2(kneelPos.x - M.position.x, kneelPos.z - M.position.z) * (1 - k2) + facing * k2;
        const lg = M.userData.legs; lg[0].rotation.x = 0.55 * Math.sin(lt * 6) * (1 - k2 * 0.6); lg[1].rotation.x = -0.55 * Math.sin(lt * 6) * (1 - k2 * 0.6);
        if (arriving > 0.85) { const k3 = ease((arriving - 0.85) / 0.15); animateMonster(M, "lurk", lt, { ...opts, kneel: { bend: opts.kneel.bend * k3 } }); M.position.copy(V(kneelPos.x - 1.5, 0, kneelPos.z + 3).lerp(kneelPos, k3)); M.rotation.y = facing; }
      }
      if (has("lick:glass")) { const head = M.userData.head; head.add(S.tongue); const sw = Math.sin(lt * 4.2); S.tongue.position.set(0.35 * sw, -0.7, 0.55); S.tongue.rotation.set(0.12, 0.55 * sw, 0.25 * sw); S.tongue.scale.set(1, 1, 0.3 + 0.7 * ease(lt / 0.35)); } // the tongue sweeps across the glass, the batter going where it passes
    } else {
      const base = w === "end" ? V(62, 0, -0.5) : w.startsWith("street:") ? V(S.houses[w.slice(7)]?.x ?? 0, 0, 0.5) : V(0, 0, 0);
      M.position.copy(base);
      let yaw = Math.atan2(camera.position.x - base.x, camera.position.z - base.z);
      if (w === "end") yaw = -Math.PI / 2;
      if (has("turn:monster") && m.turnTo) { const to = S.houses[m.turnTo]; const y1 = Math.atan2(to.x - base.x, HZ - base.z); const k = ease((lt - atOf("turn:monster")) / 0.9); yaw = Math.PI * 0.1 + (y1 - Math.PI * 0.1) * k; }
      if (has("back_away:monster")) { yaw = -Math.PI / 2; const k = ease(lt / Math.max(0.8, dur)); M.position.x = base.x + 22 * k; }
      M.rotation.y = yaw;
      animateMonster(M, m.state === "flee" ? "lurk" : m.state ?? "lurk", lt, { eye, eyeAt });
      if (has("back_away:monster")) { const lg = M.userData.legs; lg[0].rotation.x = 0.5 * Math.sin(lt * 5); lg[1].rotation.x = -0.5 * Math.sin(lt * 5); M.userData.torso.rotation.x = -0.12; }
    }
    M.updateMatrixWorld(true);
  }

  // ---- the camera
  const cam = b.cam; let look = V(0, 2, 0), pos = V(0, 3, 10), fov = 50;
  const R0 = room ? (lx, ly, lz) => room.g.localToWorld(V(lx, ly, lz)) : null;
  const k = ease(lt / Math.max(1, dur));
  if (cam === "town_wide") { pos = V(-66 + 4 * k, 15 - 1.5 * k, 20); look = V(-8, 1.5, -5); fov = 52; }
  else if (cam === "street_end") { pos = V(-40, 1.7, 1.2); look = V(62, 7, -0.5); fov = 30; }
  else if (cam === "street_wide") { pos = has("rip:curtains") ? V(-36 + 2 * k, 2.6, 5.5) : V(-56 + 3 * k, 3.4, 6.2); look = has("rip:curtains") ? V(-20, 4.2, -7) : V(-4, 3.4, -7); fov = 52; if (mon) { look = V(mon.position.x - 6, 5.5, -4); pos = V(mon.position.x - 30.5, 2.2, 7.5); } }
  else if (cam === "sky_up") { pos = V(5, 1.6, 7.5); look = V(9, 8.5, -8); fov = 66; } // the rooftops at the bottom, the kites above
  else if (cam === "street_back") { pos = V(-18, 1.8, 1.8); look = V(40, 5.5, -0.5); fov = 44; }
  else if (cam === "eye_close" && mon) { const e = mon.userData.eyes[0].e.getWorldPosition(V(0, 0, 0)), f = V(Math.sin(mon.rotation.y), 0, Math.cos(mon.rotation.y)); pos = e.clone().addScaledVector(f, 12 - 0.8 * k).add(V(2.0, -4.0, 0)); look = e.clone().add(V(0, -3.2, 0)); fov = 52; } // the head + body + the lit street: the shut lid never fills the frame
  else if (/^houses:/.test(cam)) { const hs = cam.split(":").slice(1).map((h) => S.houses[h]).filter(Boolean); const x0 = Math.min(...hs.map((h) => h.x)); pos = V(x0 - 2, 1.8, HZ + 5); look = V(x0 + 8, 1.6, HZ); fov = 50; }
  else if (/^front:/.test(cam)) { const h = S.houses[cam.slice(6)]; pos = V(h.x, 3.0, HZ + 11); look = V(h.x, 2.9, HZ); fov = 52; } // one house straight on: every window readable
  else if (/^house:/.test(cam)) { const h = S.houses[cam.slice(6)]; pos = V(h.x + 3.5, 3.0, HZ + 16 - 2 * k); look = V(h.x, 3.6, HZ); fov = 50; }
  else if (/^window:/.test(cam)) { const [, h, kk] = cam.split(":"); const c = winWorld(S.houses[h].wins[Number(kk) || 0]); if (mon || has("lick:glass")) { pos = c.clone().add(V(2.4, 0.5, 2.2)); look = c.clone().add(V(-0.1, 0.05, 0.35)); fov = 50; } else { pos = c.clone().add(V(0.7, 0.15, 4.2 - 0.5 * k)); look = c.clone().add(V(0, -0.05, 0)); fov = 40; } } // the eye at a window: from the side, the head in profile against the glass, the body going back to the road
  else if (/^cat:/.test(cam)) { const c = winWorld(S.houses[cam.slice(4)].wins[0]); pos = c.clone().add(V(0.9, 0.3, 2.6)); look = c.clone().add(V(0.25, 0.15, 0.4)); fov = 44; }
  else if (/^arrive:/.test(cam)) { const h = S.houses[cam.slice(7)]; pos = V(h.x + 4, 2.4, 10); look = V(h.x - 4, 5, HZ + 2); fov = 56; }
  else if (R0) {
    if (cam === "room_window") { pos = room.owner === "me" && b.monster ? R0(1.2, 1.55, -0.2) : R0(2.2, 1.6, 0.6); look = room.owner === "me" && b.monster ? R0(-0.1, 1.75, -3) : R0(-0.6, 1.4, -2.6); fov = 58; } // the eye behind the sock: the window big in frame
    else if (cam === "room_wide") { pos = room.owner === "hollis" ? R0(-0.6, 1.6, 2.6) : R0(0.5, 2.1, 3.4 - 0.4 * k); look = room.owner === "hollis" ? R0(0.9, 1.1, 0.0) : R0(-0.2, 1.1, -1.4); fov = room.owner === "hollis" ? 55 : 64; }
    else if (cam === "room_me") { pos = R0(-0.4, 1.5, 0.6); look = R0(-1.1, 1.2, -2.3); fov = 58; }
    else if (cam === "room_door") { pos = room.owner === "me" ? R0(2.8, 1.5, 2.6) : R0(2.6, 1.6, 2.2); look = room.owner === "me" ? R0(0.6, 1.35, -0.6) : R0(-1.4, 1.3, 0.0); fov = room.owner === "me" ? 55 : 66; }
    else if (cam === "pov_eye") { pos = R0(0.15, 2.2, -2.75); look = R0(0.15, 1.15, -0.6); fov = 62; } // from the eye at the window: the faces tipped up at it
    else if (cam === "window_in") { pos = R0(0.5, 1.7, -0.6); look = R0(0, 1.85, -3); fov = 50; } // the window from inside: the eye fills it
    else if (cam === "room_side") { pos = R0(1.6, 1.6, -2.3); look = R0(-1.0, 1.5, -2.75); fov = 56; }
    else if (cam === "peek:me") { pos = R0(1.2, 1.25, -2.4); look = R0(-0.35, 1.2, -2.8); fov = 46; }
    else if (cam === "cat_stare") { pos = R0(2.6, 0.95, 1.4); look = R0(1.0, 0.9, -0.4); fov = 54; } // over the cat onto Nell's face
    else if (cam === "bed_top") { pos = R0(0.6, 2.95, 1.1); look = R0(0.6, 0.65, -0.8); fov = 56; }
    else if (cam === "painting") { pos = R0(-3.0 + 0.8 * k, 1.7 + 0.1 * k, 0.9 + 1.5 * k); look = R0(-3.3, 1.6, -0.6); fov = 52; } // close on the hammer + boards, pulling back to reveal the boat painting
    else if (cam === "behind_window") { pos = R0(-2.1, 1.8, 2.9); look = R0(-0.9, 1.6, -3); fov = 70; }
    else if (cam === "huddle_up") { pos = R0(1.8, 0.9, 1.4); look = R0(-0.1, 1.7, -2.6); fov = 60; } // low at the side: their faces tipped up, the eye filling the window behind them
    else if (/^face:/.test(cam)) { const p = where[cam.slice(5)]; if (p) { const f = V(Math.sin(p.yaw), 0, Math.cos(p.yaw)); pos = p.head.clone().addScaledVector(f, 2.3 - 0.15 * k).add(V(0, 0.02, 0)); look = p.head.clone(); fov = 40; } }
  }
  S.camFill.position.copy(pos).add(V(0, 0.4, 0)); S.camFill.intensity = room && night ? (cam === "pov_eye" ? 9 : 4) : 0; S.camFill.color.set(cam === "pov_eye" ? "#e8f0ff" : "#fff1dc");
  camera.position.copy(pos); camera.fov = fov; camera.near = 0.05; camera.far = 3000; camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0); camera.lookAt(look); camera.updateMatrixWorld();
  S.spots.center.copy(look).setY(0);
  return { focus: pos.distanceTo(look) };
}

/** a thing in a hand for this frame (removed at the next shot) */
function hold(S, hand, what) {
  const g = new THREE.Group(); hand.add(g); S.held.push(g);
  if (what === "hammer") { const hdl = box(g, [0.05, 0.42, 0.05], [0, -0.12, 0.12], mat("#8a5a3a")); hdl.rotation.x = Math.PI / 2; box(g, [0.1, 0.1, 0.24], [0, -0.12, 0.34], mat("#6f7680", { rough: 0.3 })); }
  if (what === "boards") { for (let i = 0; i < 3; i++) box(g, [1.4, 0.06, 0.2], [0.5, -0.1 - i * 0.07, 0.1], mat("#c9935a")); }
  if (what === "bowl") { cyl(g, 0.16, 0.1, 0.12, [0, -0.1, 0.08], mat("#4fa3d9")); ball(g, 0.13, [0, -0.06, 0.08], mat("#f3d58a", { rough: 0.5 }), { sy: 0.4 }); }
  if (what === "brick") box(g, [0.36, 0.18, 0.2], [0, -0.12, 0.1], mat("#b5492f"));
  g.scale.setScalar(1 / Math.max(0.2, hand.getWorldScale(V(0, 0, 0)).x));
  return g;
}
