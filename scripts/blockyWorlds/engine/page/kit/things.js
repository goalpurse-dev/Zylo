// Blocky Worlds coverage kit (owner: COVERAGE, 2026-11-04): the scene objects lib/catalog.js names, so the 130 library
// ideas show their nouns for real (not on picture cards). Simple, chunky, readable, in the locked look: bold colours,
// the kit's procedural fabric, rounded boxes. Same contract as kit/objects.js: origin on the floor at the front-centre,
// faces +z (extends to -z), metres; userData { height, width, depth, focus, fitW, fitH, fitY, detail, big, push, actors }.
//   THING_BUILD[name](g, state)       every THINGS / ANIMALS / creature object / "item" of lib/catalog.js
import * as THREE from "three";
import { rng, hashSeed, cachedGeo, cachedMat, solid, fabric, rbx, bx, addMesh, canvasTex, kitFont, fitText, darker } from "./kitCommon.js";
import { THINGS, ANIMALS, CREATURE_OBJECTS } from "../../lib/catalog.js";
import { makeHeld } from "./props.js";
import { makeMonster, animateMonster } from "./monsters.js";

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cyl = (r1, r2, h, seg = 16) => cachedGeo(`tcyl${r1},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const sph = (r, w = 16, h = 12) => cachedGeo(`tsph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, seg = 16) => cachedGeo(`tcone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const hemi = (r) => cachedGeo(`themi${r}`, () => new THREE.SphereGeometry(r, 18, 10, 0, TAU, 0, Math.PI / 2));
const openCyl = (r, h, seg = 24) => cachedGeo(`topen${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg, 1, true));
const tor = (r, t, a = TAU, rs = 8, ts = 20) => cachedGeo(`ttor${r},${t},${a},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, a));
const glow = (color, k = 2, base = "#ffffff") => cachedMat(`tglow${color}${k}${base}`, () => new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: k, roughness: 0.4 }));
const gloss = (c) => solid(c, { roughness: 0.3 });
const matte = (c) => solid(c, { roughness: 0.9 });
const clear = (c, o) => cachedMat(`tclear${c}${o}`, () => new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: o, roughness: 0.15, depthWrite: false }));
const M = (geo, mat, o) => addMesh(geo, mat, o);

/** standard framing data: an object h tall, w wide, d deep, its key detail at height dh */
function fin(g, { h, w, d = 1, big = false, push = 0.8, actors, detailH, focusZ, fitY, extra = {} }) {
  const fz = focusZ ?? -d / 2;
  Object.assign(g.userData, { height: h, width: w, depth: d, focus: V(0, 0, fz), fitW: w * 1.05, fitH: h * 1.05, fitY: fitY ?? h * 0.52, detail: { at: V(0, 0, fz), h: detailH ?? Math.min(h, 2) }, big, push, ...(actors ? { actors } : {}), ...extra });
}
/** a text plane (Lilita) */
const TXT = new Map();
function label(text, w, h, { bg = null, ink = "#2a1d24", rim = null } = {}) {
  const k = `${text}|${w}|${h}|${bg}|${ink}|${rim}`;
  let t = TXT.get(k);
  if (!t) {
    const W = Math.round(256 * (w / h)), H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const p = c.getContext("2d");
    if (bg) { p.fillStyle = bg; p.fillRect(0, 0, W, H); }
    if (rim) { p.strokeStyle = rim; p.lineWidth = 18; p.strokeRect(12, 12, W - 24, H - 24); }
    const { lines, size } = fitText(p, text, W * 0.86, H * 0.78, { maxSize: 200, maxLines: 2 });
    p.font = kitFont(size); p.textAlign = "center"; p.textBaseline = "middle"; p.fillStyle = ink;
    const y0 = H / 2 - ((lines.length - 1) * size) / 2;
    lines.forEach((l, i) => p.fillText(l, W / 2, y0 + i * size));
    t = canvasTex(c); TXT.set(k, t);
  }
  const m = new THREE.Mesh(cachedGeo(`tlabel${w},${h}`, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshStandardMaterial({ map: t, transparent: !bg, alphaTest: bg ? 0 : 0.05, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  return m;
}
/** a little seeded sprinkle of boxes (snow lumps, leaves, straw) */
function lumps(g, n, seed, { x0 = -1, x1 = 1, z0 = -1, z1 = 0, y = 0, s = 0.25, mat, r = 0.06 }) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) { const w = s * (0.6 + R() * 0.8); rbx(w, w * (0.4 + R() * 0.5), w * (0.7 + R() * 0.6), r, mat, { x: x0 + R() * (x1 - x0), y: y + w * 0.2, z: z0 + R() * (z1 - z0), ry: R() * 3, parent: g }); }
}
const anims = (g) => (g.userData.animList ??= []);

// =====================================================================================================
export const THING_BUILD = {
  // ---------------------------------------------------------------- weather / sky
  cloud(g, state) {
    // a fat cartoon cloud floating ~2.5 m up, with rain / snow / lightning under it
    const dark = state === "storm" || state === "rain";
    const c = new THREE.Group(); c.position.set(0, 2.3, -0.5); g.add(c);
    const mat = solid(state === "storm" ? "#6d7486" : state === "rain" ? "#aab3c2" : "#ffffff", { roughness: 0.95 });
    for (const [x, y, r] of [[-0.55, 0, 0.42], [0, 0.18, 0.55], [0.55, 0.02, 0.44], [0.25, -0.12, 0.38], [-0.25, -0.12, 0.38]]) M(sph(r, 18, 14), mat, { x, y, parent: c });
    const drops = [];
    if (state === "rain" || state === "storm") {
      const dm = glow("#7fc8ff", 0.6, "#bfe6ff"), R = rng(3);
      for (let i = 0; i < 18; i++) { const d = bx(0.03, 0.18, 0.03, dm, { x: -0.8 + R() * 1.6, y: -0.4, z: -0.3 + R() * 0.6, parent: c, shadow: false }); drops.push({ d, ph: R(), sp: 2.5 }); }
    }
    if (state === "snow") {
      const sm = glow("#ffffff", 0.5), R = rng(4);
      for (let i = 0; i < 20; i++) { const d = rbx(0.07, 0.07, 0.07, 0.03, sm, { x: -0.9 + R() * 1.8, y: -0.4, z: -0.3 + R() * 0.6, parent: c, shadow: false }); drops.push({ d, ph: R(), sp: 0.6 }); }
    }
    let bolt = null;
    if (state === "storm") {
      bolt = new THREE.Group(); bolt.position.set(0.1, -0.45, 0.2); c.add(bolt);
      const bm = glow("#fff27a", 6, "#fff8c0");
      bx(0.09, 0.55, 0.04, bm, { x: 0, y: -0.25, rz: -0.35, parent: bolt, shadow: false });
      bx(0.09, 0.5, 0.04, bm, { x: 0.12, y: -0.62, rz: 0.35, parent: bolt, shadow: false });
    }
    g.userData.anim = (t) => {
      c.position.y = 2.3 + 0.05 * Math.sin(t * 1.4);
      for (const { d, ph, sp } of drops) { const k = (t * sp * 0.5 + ph) % 1; d.position.y = -0.4 - k * 2.0; d.visible = k < 0.95; }
      if (bolt) bolt.visible = (t % 1.3) < 0.18;
    };
    fin(g, { h: 3.5, w: 2.4, d: 1.2, fitY: 2.15, detailH: 1.6, extra: { detail: { at: V(0, 1.7, -0.5), h: 1.6 } } });
    g.userData.focusY = 2.2;
  },
  snow_pile(g) {
    const snow = solid("#f4f8ff", { roughness: 0.85 }), blue = solid("#dfe8f7", { roughness: 0.9 });
    for (const [x, z, w, h] of [[0, -0.6, 2.2, 0.55], [-0.7, -0.3, 1.2, 0.4], [0.75, -0.35, 1.1, 0.35], [0.1, -1.0, 1.6, 0.8]]) { const m = M(sph(0.5, 18, 12), snow, { x, y: 0, z, parent: g }); m.scale.set(w, h * 2, 1.0); }
    lumps(g, 6, 9, { x0: -1.2, x1: 1.2, z0: -0.2, z1: 0.3, s: 0.22, mat: blue, r: 0.08 });
    // a snowball on top + falling flakes
    M(sph(0.2, 14, 10), snow, { x: 0.45, y: 0.5, z: -0.35, parent: g });
    const fm = glow("#ffffff", 0.45), R = rng(12), flakes = [];
    for (let i = 0; i < 26; i++) { const f = rbx(0.06, 0.06, 0.06, 0.02, fm, { x: -1.6 + R() * 3.2, y: 3, z: -1.4 + R() * 1.8, parent: g, shadow: false }); flakes.push({ f, ph: R(), x: f.position.x }); }
    g.userData.anim = (t) => { for (const { f, ph, x } of flakes) { const k = (t * 0.22 + ph) % 1; f.position.y = 3.2 - k * 3.2; f.position.x = x + 0.12 * Math.sin(t * 1.5 + ph * 9); } };
    fin(g, { h: 1.2, w: 2.6, d: 1.6, detailH: 1.0 });
  },
  snowman(g) {
    const snow = solid("#f7fbff", { roughness: 0.8 });
    M(sph(0.5, 20, 14), snow, { y: 0.45, z: -0.4, parent: g });
    M(sph(0.36, 20, 14), snow, { y: 1.12, z: -0.4, parent: g });
    const head = new THREE.Group(); head.position.set(0, 1.6, -0.4); g.add(head);
    M(sph(0.26, 18, 14), snow, { parent: head });
    for (const s of [-1, 1]) M(sph(0.035, 8, 6), solid("#1b1b1f"), { x: s * 0.09, y: 0.06, z: 0.23, parent: head });
    M(cone(0.045, 0.28, 10), solid("#ff7a1a", { roughness: 0.5 }), { y: -0.01, z: 0.38, rx: Math.PI / 2, parent: head });
    for (let k = 0; k < 5; k++) M(sph(0.022, 6, 5), solid("#1b1b1f"), { x: -0.1 + k * 0.05, y: -0.12 + Math.sin(k / 4 * Math.PI) * -0.03, z: 0.22, parent: head });
    for (let k = 0; k < 3; k++) M(sph(0.04, 8, 6), solid("#1b1b1f"), { y: 1.0 + k * 0.12, z: -0.4 + 0.33 - k * 0.02, parent: g });
    // a stripy scarf, stick arms, a little hat
    M(tor(0.27, 0.07, TAU, 8, 18), fabric("#e53935", "stripes"), { y: 1.38, z: -0.4, rx: Math.PI / 2, parent: g });
    bx(0.12, 0.42, 0.04, fabric("#e53935", "stripes"), { x: 0.15, y: 1.18, z: -0.12, rz: 0.15, parent: g });
    for (const s of [-1, 1]) bx(0.05, 0.75, 0.05, solid("#6b4423"), { x: s * 0.55, y: 1.25, z: -0.4, rz: -s * 1.0, parent: g });
    M(cyl(0.2, 0.2, 0.26, 16), solid("#1b1b1f"), { y: 0.38, parent: head }); M(cyl(0.3, 0.3, 0.03, 18), solid("#1b1b1f"), { y: 0.24, parent: head });
    fin(g, { h: 2.0, w: 1.3, d: 1.0, detailH: 1.2, extra: { detail: { at: V(0, 0.9, -0.4), h: 1.2 } } });
  },
  wind_gust(g) {
    // swirling white wind lines + tumbling leaves
    const lm = cachedMat("windLine", () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, fog: false }));
    const curls = [];
    for (const [y, r, x] of [[1.0, 0.35, -0.6], [1.6, 0.45, 0.4], [0.6, 0.3, 0.7], [2.1, 0.3, -0.3]]) {
      const c = new THREE.Group(); c.position.set(x, y, -0.4); g.add(c);
      M(tor(r, 0.03, Math.PI * 1.5, 6, 24), lm, { parent: c, shadow: false });
      bx(1.1, 0.06, 0.03, lm, { x: -0.55, y: -r, parent: c, shadow: false });
      curls.push({ c, x });
    }
    const leaves = [], R = rng(6), cols = ["#e67e22", "#f1c40f", "#c0392b", "#7cb342"];
    for (let i = 0; i < 10; i++) { const l = bx(0.14, 0.02, 0.09, solid(cols[i % 4]), { parent: g }); leaves.push({ l, ph: R(), y: 0.4 + R() * 1.8 }); }
    g.userData.anim = (t) => {
      curls.forEach(({ c, x }, i) => { c.position.x = x + ((t * 0.9 + i * 0.3) % 1) * 0.6 - 0.3; c.rotation.z = -t * 2 - i; });
      for (const { l, ph, y } of leaves) { const k = (t * 0.45 + ph) % 1; l.position.set(-1.6 + k * 3.2, y + 0.3 * Math.sin(t * 3 + ph * 7), -0.4 + 0.3 * Math.cos(t * 2 + ph * 5)); l.rotation.set(t * 4 + ph, t * 3, t * 5); }
    };
    fin(g, { h: 2.6, w: 2.6, d: 1.0, detailH: 2.2 });
  },
  fog_bank(g) {
    const fm = cachedMat("fogPuff", () => new THREE.MeshStandardMaterial({ color: "#e8edf3", transparent: true, opacity: 0.55, roughness: 1, depthWrite: false }));
    const R = rng(21), puffs = [];
    for (let i = 0; i < 14; i++) { const p = M(sph(0.5 + R() * 0.4, 14, 10), fm, { x: -1.8 + R() * 3.6, y: 0.3 + R() * 0.7, z: -0.3 - R() * 1.6, parent: g, shadow: false }); p.scale.set(1.6, 0.7, 1); puffs.push({ p, x: p.position.x, ph: R() }); }
    g.userData.anim = (t) => { for (const { p, x, ph } of puffs) p.position.x = x + 0.25 * Math.sin(t * 0.5 + ph * 6); };
    fin(g, { h: 1.6, w: 3.6, d: 2.0, detailH: 1.4 });
  },

  // ---------------------------------------------------------------- town
  fountain(g, state) {
    const stone = solid("#c9c3b6", { roughness: 0.85 }), rim = solid("#b2ab9c", { roughness: 0.8 });
    const water = cachedMat("fountainWater", () => new THREE.MeshStandardMaterial({ color: "#5ab4e8", roughness: 0.08, metalness: 0.1, emissive: "#1e6fa8", emissiveIntensity: 0.25 }));
    const zc = -1.1;
    M(cyl(1.25, 1.3, 0.55, 28), stone, { y: 0.275, z: zc, parent: g });
    M(tor(1.22, 0.1, TAU, 8, 32), rim, { y: 0.56, z: zc, rx: Math.PI / 2, parent: g });
    M(cyl(1.13, 1.13, 0.04, 28), water, { y: 0.5, z: zc, parent: g });
    M(cyl(0.18, 0.24, 1.0, 14), stone, { y: 1.0, z: zc, parent: g });
    M(cyl(0.6, 0.35, 0.22, 22), stone, { y: 1.55, z: zc, parent: g });
    M(cyl(0.5, 0.5, 0.03, 22), water, { y: 1.65, z: zc, parent: g });
    M(cyl(0.08, 0.12, 0.5, 10), stone, { y: 1.9, z: zc, parent: g });
    M(sph(0.14, 12, 10), stone, { y: 2.2, z: zc, parent: g });
    const jets = [];
    if (state !== "off") {
      const jm = clear("#bfe6ff", 0.75);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; const j = M(cyl(0.035, 0.05, 0.55, 6), jm, { x: Math.cos(a) * 0.42, y: 1.45, z: zc + Math.sin(a) * 0.42, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5, parent: g, shadow: false }); jets.push(j); }
      jets.push(M(cyl(0.04, 0.06, 0.6, 6), jm, { y: 2.55, z: zc, parent: g, shadow: false }));
    }
    g.userData.anim = (t) => jets.forEach((j, i) => { j.scale.y = 1 + 0.12 * Math.sin(t * 6 + i); });
    fin(g, { h: 2.9, w: 2.7, d: 2.6, push: 1.0, detailH: 2.4, focusZ: zc });
  },
  statue(g) {
    const stone = solid("#b9b4a8", { roughness: 0.85 }), dk = solid("#8f8a7f", { roughness: 0.9 });
    const zc = -0.6;
    rbx(1.1, 1.0, 1.1, 0.04, dk, { y: 0.5, z: zc, parent: g });
    rbx(1.25, 0.12, 1.25, 0.03, stone, { y: 1.06, z: zc, parent: g });
    const p = label("FOUNDER", 0.8, 0.22, { ink: "#4a453c" }); p.position.set(0, 0.62, zc + 0.556); g.add(p);
    // a blocky stone person, one arm raised, a stone pigeon on its head
    const s = new THREE.Group(); s.position.set(0, 1.12, zc); g.add(s);
    for (const x of [-0.13, 0.13]) rbx(0.2, 0.8, 0.24, 0.04, stone, { x, y: 0.4, parent: s });
    rbx(0.55, 0.7, 0.3, 0.05, stone, { y: 1.15, parent: s });
    rbx(0.38, 0.38, 0.36, 0.06, stone, { y: 1.72, parent: s });
    rbx(0.16, 0.62, 0.18, 0.04, stone, { x: -0.36, y: 1.05, rz: -0.12, parent: s });
    rbx(0.16, 0.66, 0.18, 0.04, stone, { x: 0.42, y: 1.62, rz: 2.6, parent: s });
    bx(0.24, 0.04, 0.14, stone, { y: 0.2, z: 0.19, parent: (() => { const n = new THREE.Group(); n.position.set(0, 1.72, 0); s.add(n); return n; })() }); // the nose
    const bird = new THREE.Group(); bird.position.set(0.02, 1.93, 0); s.add(bird);
    rbx(0.2, 0.14, 0.26, 0.06, dk, { y: 0.07, parent: bird }); rbx(0.11, 0.11, 0.11, 0.04, dk, { y: 0.17, z: 0.13, parent: bird });
    fin(g, { h: 3.2, w: 1.4, d: 1.3, detailH: 1.6, extra: { detail: { at: V(0, 2.3, zc), h: 1.6 } } });
  },
  mailbox(g, state) {
    const blue = solid("#2e5fd6", { roughness: 0.45 }), post = fabric("#7a5230", "cotton");
    bx(0.12, 1.0, 0.12, post, { y: 0.5, z: -0.3, parent: g });
    const box = new THREE.Group(); box.position.set(0, 1.0, -0.3); box.rotation.y = 0.9; g.add(box);
    rbx(0.42, 0.34, 0.75, 0.05, blue, { y: 0.17, parent: box });
    const top = M(cyl(0.21, 0.21, 0.75, 18), blue, { y: 0.34, rx: Math.PI / 2, parent: box }); top.scale.set(1, 1, 1);
    rbx(0.44, 0.48, 0.03, 0.02, solid("#244caa"), { y: 0.24, z: 0.38, parent: box });
    bx(0.12, 0.03, 0.03, solid("#d8d8d8", { metalness: 0.7, roughness: 0.3 }), { y: 0.28, z: 0.41, parent: box });
    const flag = new THREE.Group(); flag.position.set(0.23, 0.2, -0.1); box.add(flag);
    bx(0.03, 0.4, 0.03, solid("#d32f2f"), { y: 0.2, parent: flag }); bx(0.03, 0.14, 0.18, solid("#e53935"), { y: 0.33, z: 0.08, parent: flag });
    flag.rotation.x = state === "down" ? 1.5 : 0;
    const name = label("MAIL", 0.3, 0.1, { ink: "#ffffff" }); name.position.set(0.215, 0.17, 0.05); name.rotation.y = Math.PI / 2; box.add(name);
    fin(g, { h: 1.65, w: 0.8, d: 0.9, detailH: 1.0, extra: { detail: { at: V(0, 0.9, -0.3), h: 1.0 } } });
  },
  fence(g, state) {
    const wood = fabric("#f4efe6", "cotton"), dk = solid("#d8d0c2");
    const n = 9, W = 3.6;
    for (let k = 0; k < n; k++) {
      const x = -W / 2 + (k + 0.5) * (W / n);
      if (k === 4) continue; // the gate
      rbx(0.22, 1.05, 0.06, 0.02, wood, { x, y: 0.525, z: -0.3, parent: g });
      M(cone(0.13, 0.16, 4), wood, { x, y: 1.12, z: -0.3, ry: Math.PI / 4, parent: g });
    }
    for (const y of [0.3, 0.8]) { bx(W / 2 - 0.25, 0.08, 0.05, dk, { x: -W / 4 - 0.12, y, z: -0.35, parent: g }); bx(W / 2 - 0.25, 0.08, 0.05, dk, { x: W / 4 + 0.12, y, z: -0.35, parent: g }); }
    // the gate: a little swinging door with a post on each side
    for (const s of [-1, 1]) rbx(0.12, 1.3, 0.12, 0.02, dk, { x: s * 0.27, y: 0.65, z: -0.3, parent: g });
    const gate = new THREE.Group(); gate.position.set(-0.2, 0, -0.3); g.add(gate);
    for (let k = 0; k < 3; k++) rbx(0.11, 0.95, 0.05, 0.02, wood, { x: 0.07 + k * 0.13, y: 0.5, parent: gate });
    bx(0.42, 0.07, 0.04, dk, { x: 0.2, y: 0.75, z: 0.03, parent: gate }); bx(0.42, 0.07, 0.04, dk, { x: 0.2, y: 0.3, z: 0.03, parent: gate });
    gate.rotation.y = state === "open" ? 1.2 : 0.25;
    fin(g, { h: 1.35, w: W, d: 0.6, detailH: 1.3 });
  },
  wall(g, state) {
    const t = cachedMat("wallBricks", () => {
      const c = document.createElement("canvas"); c.width = c.height = 256; const p = c.getContext("2d"); const R = rng(17);
      p.fillStyle = "#d9cdb8"; p.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) { const x = k * 64 + (r % 2 ? 32 : 0); p.fillStyle = `hsl(${12 + R() * 10},${45 + R() * 15}%,${38 + R() * 12}%)`; p.fillRect(x + 3, r * 32 + 3, 58, 26); }
      const tx = canvasTex(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1.2);
      return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 });
    });
    rbx(3.6, 2.4, 0.4, 0.02, t, { y: 1.2, z: -0.6, parent: g });
    bx(3.8, 0.14, 0.5, solid("#9e9384"), { y: 2.45, z: -0.6, parent: g });
    if (state === "crack") {
      const cm = solid("#1a1412");
      [[-0.2, 1.5, 0.5, 0.6], [0.05, 1.2, 0.45, -0.7], [-0.05, 0.85, 0.5, 0.5], [0.2, 0.55, 0.4, -0.4]].forEach(([x, y, l, r]) => bx(0.07, l, 0.05, cm, { x, y, z: -0.38, rz: r, parent: g }));
      lumps(g, 7, 31, { x0: -0.6, x1: 0.6, z0: -0.3, z1: 0.1, s: 0.18, mat: solid("#a8502f"), r: 0.02 });
    }
    fin(g, { h: 2.6, w: 3.8, d: 0.8, detailH: 2.4 });
  },
  bridge(g) {
    const wood = fabric("#a0703e", "cotton"), dk = fabric("#7a5230", "cotton"), rope = fabric("#c9a66b", "denim");
    // a chunky arched wooden footbridge seen side-on (it runs across the frame)
    const L = 5.2, H = 0.9;
    for (let k = 0; k < 14; k++) { const u = -L / 2 + (k + 0.5) * (L / 14), y = H * (1 - (2 * u / L) ** 2) + 0.15; rbx(L / 14 - 0.02, 0.1, 1.3, 0.02, k % 2 ? wood : dk, { x: u, y, z: -0.9, rz: -Math.atan(-4 * H * u / (L * L) * 2) * 0.5, parent: g }); }
    for (const z of [-0.3, -1.5]) for (let k = 0; k <= 6; k++) { const u = -L / 2 + 0.2 + k * ((L - 0.4) / 6), y = H * (1 - (2 * u / L) ** 2) + 0.15; rbx(0.12, 0.9, 0.12, 0.02, dk, { x: u, y: y + 0.45, z, parent: g }); }
    for (const z of [-0.3, -1.5]) for (let k = 0; k < 12; k++) { const u0 = -L / 2 + 0.2 + k * ((L - 0.4) / 12), u1 = u0 + (L - 0.4) / 12, y0 = H * (1 - (2 * u0 / L) ** 2) + 1.0, y1 = H * (1 - (2 * u1 / L) ** 2) + 1.0; const len = Math.hypot(u1 - u0, y1 - y0); bx(len, 0.05, 0.05, rope, { x: (u0 + u1) / 2, y: (y0 + y1) / 2, z, rz: Math.atan2(y1 - y0, u1 - u0), parent: g }); }
    // water under it
    const wm = cachedMat("bridgeWater", () => new THREE.MeshStandardMaterial({ color: "#3d8fd1", roughness: 0.1, emissive: "#114a7a", emissiveIntensity: 0.2 }));
    bx(L + 1, 0.04, 2.4, wm, { y: 0.02, z: -0.9, parent: g });
    fin(g, { h: 2.2, w: L, d: 2.4, big: true, push: 0.6, detailH: 2.0 });
  },
  castle(g) {
    const stone = cachedMat("castleStone", () => {
      const c = document.createElement("canvas"); c.width = c.height = 256; const p = c.getContext("2d"); const R = rng(41);
      p.fillStyle = "#9d9a93"; p.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 6; r++) for (let k = -1; k < 4; k++) { const x = k * 86 + (r % 2 ? 43 : 0); p.fillStyle = `hsl(40,${6 + R() * 6}%,${52 + R() * 14}%)`; p.fillRect(x + 4, r * 43 + 4, 78, 35); }
      const tx = canvasTex(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 2);
      return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.92 });
    });
    const roof = solid("#3c4fa8", { roughness: 0.6 }), dark = solid("#1c1a22");
    const z = -1.5;
    rbx(5.0, 3.4, 1.4, 0.03, stone, { y: 1.7, z, parent: g });
    for (let k = 0; k < 9; k++) bx(0.36, 0.4, 1.45, stone, { x: -2.3 + k * 0.575, y: 3.6, z, parent: g });
    for (const s of [-1, 1]) {
      M(cyl(0.9, 0.95, 5.0, 16), stone, { x: s * 2.6, y: 2.5, z, parent: g });
      M(cone(1.15, 1.7, 16), roof, { x: s * 2.6, y: 5.85, z, parent: g });
      bx(0.03, 0.9, 0.03, solid("#2b2f33"), { x: s * 2.6, y: 7.1, z, parent: g });
      bx(0.5, 0.3, 0.02, solid("#e53935"), { x: s * 2.6 + 0.25, y: 7.4, z, parent: g });
      rbx(0.32, 0.55, 0.05, 0.1, glow("#ffcf7a", 1.4, "#fff2c8"), { x: s * 2.6, y: 3.6, z: z + 0.92, parent: g });
    }
    // the gate: a dark arch with a portcullis
    rbx(1.5, 2.1, 0.08, 0.05, dark, { y: 1.05, z: z + 0.7, parent: g });
    M(cyl(0.75, 0.75, 0.08, 20, 1, false), dark, { y: 2.1, z: z + 0.7, rx: Math.PI / 2, parent: g });
    for (let k = 0; k < 5; k++) bx(0.05, 2.2, 0.05, solid("#4a4038", { metalness: 0.5 }), { x: -0.6 + k * 0.3, y: 1.3, z: z + 0.76, parent: g });
    for (const x of [-1.5, 1.5]) rbx(0.4, 0.7, 0.05, 0.12, glow("#ffcf7a", 1.4, "#fff2c8"), { x, y: 2.5, z: z + 0.71, parent: g });
    fin(g, { h: 7.6, w: 7.0, d: 2.2, big: true, push: 1.2, detailH: 4.5, extra: { detail: { at: V(0, 0, z), h: 4.5 } } });
  },
  trash_can(g) {
    const metal = solid("#8f9aa3", { metalness: 0.6, roughness: 0.4 }), dk = solid("#6b757d", { metalness: 0.6, roughness: 0.45 });
    M(cyl(0.34, 0.3, 0.9, 20), metal, { y: 0.45, z: -0.35, parent: g });
    for (const y of [0.25, 0.65]) M(tor(0.33, 0.025, TAU, 6, 22), dk, { y, z: -0.35, rx: Math.PI / 2, parent: g });
    const lid = M(cyl(0.38, 0.38, 0.06, 20), dk, { y: 0.97, z: -0.35, rz: 0.25, parent: g });
    M(tor(0.07, 0.02, Math.PI, 6, 10), dk, { y: 1.03, z: -0.35, parent: g });
    // a banana peel + a crumpled paper sticking out, a stinky fly
    bx(0.18, 0.04, 0.06, solid("#f1d24a"), { x: 0.1, y: 0.92, z: -0.15, rz: 0.4, parent: g });
    M(sph(0.08, 8, 6), solid("#ece6d6"), { x: -0.12, y: 0.95, z: -0.2, parent: g });
    lumps(g, 3, 5, { x0: 0.35, x1: 0.7, z0: -0.4, z1: -0.1, s: 0.12, mat: solid("#ece6d6"), r: 0.03 });
    fin(g, { h: 1.15, w: 0.9, d: 0.8, detailH: 1.0 });
    void lid;
  },
  clock(g) {
    // a town clock on a lamp-post pole (also the clock tower's face): a big readable face
    const post = solid("#2b4a3a", { metalness: 0.4, roughness: 0.5 }), face = solid("#fffaf0", { roughness: 0.5 });
    M(cyl(0.08, 0.12, 2.6, 12), post, { y: 1.3, z: -0.3, parent: g });
    M(cyl(0.22, 0.28, 0.25, 12), post, { y: 0.12, z: -0.3, parent: g });
    const c = new THREE.Group(); c.position.set(0, 3.0, -0.3); g.add(c);
    M(cyl(0.52, 0.52, 0.22, 28), post, { rx: Math.PI / 2, parent: c });
    M(cyl(0.45, 0.45, 0.24, 28), face, { rx: Math.PI / 2, parent: c });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; bx(0.035, k % 3 ? 0.06 : 0.11, 0.02, solid("#1b1b1f"), { x: Math.sin(a) * 0.37, y: Math.cos(a) * 0.37, z: 0.125, rz: -a, parent: c, shadow: false }); }
    const hh = new THREE.Group(); hh.position.z = 0.13; c.add(hh); bx(0.05, 0.24, 0.02, solid("#1b1b1f"), { y: 0.1, parent: hh });
    const mh = new THREE.Group(); mh.position.z = 0.14; c.add(mh); bx(0.035, 0.34, 0.02, solid("#1b1b1f"), { y: 0.15, parent: mh });
    hh.rotation.z = -2.3; g.userData.anim = (t) => { mh.rotation.z = -t * 1.2; };
    fin(g, { h: 3.6, w: 1.2, d: 0.6, detailH: 1.5, extra: { detail: { at: V(0, 2.3, -0.3), h: 1.6 } } });
  },
  lamp(g, state) {
    // an old street lamp: a tall post and a glowing lantern head (off: dark glass)
    const post = solid("#23262b", { metalness: 0.5, roughness: 0.45 });
    M(cyl(0.07, 0.1, 3.0, 12), post, { y: 1.5, z: -0.3, parent: g });
    M(cyl(0.2, 0.26, 0.3, 12), post, { y: 0.15, z: -0.3, parent: g });
    const on = state !== "off";
    bx(0.42, 0.06, 0.42, post, { y: 3.0, z: -0.3, parent: g });
    rbx(0.34, 0.46, 0.34, 0.03, on ? glow("#ffcf7a", 3.2, "#fff6dc") : solid("#2e3440", { roughness: 0.2 }), { y: 3.27, z: -0.3, parent: g, shadow: false });
    M(cone(0.32, 0.3, 4), post, { y: 3.65, z: -0.3, ry: Math.PI / 4, parent: g });
    if (on) { const l = new THREE.PointLight("#ffcf7a", 3, 6, 1.5); l.position.set(0, 3.2, 0); g.add(l); }
    fin(g, { h: 3.8, w: 0.8, d: 0.6, detailH: 1.4, extra: { detail: { at: V(0, 2.6, -0.3), h: 1.6 } } });
  },
  bell(g) {
    // a big brass bell in a wooden frame (a town bell)
    const wood = fabric("#7a5230", "cotton"), brass = solid("#d6a42f", { metalness: 0.85, roughness: 0.25 });
    for (const s of [-1, 1]) rbx(0.16, 2.6, 0.16, 0.02, wood, { x: s * 0.85, y: 1.3, z: -0.5, parent: g });
    rbx(2.0, 0.18, 0.22, 0.02, wood, { y: 2.6, z: -0.5, parent: g });
    const b = new THREE.Group(); b.position.set(0, 2.5, -0.5); g.add(b);
    const prof = [V(0, 0, 0), V(0.18, 0, 0), V(0.24, -0.15, 0), V(0.32, -0.5, 0), V(0.5, -0.85, 0), V(0.55, -0.92, 0), V(0, -0.92, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    M(cachedGeo("bellLathe", () => new THREE.LatheGeometry(prof, 24)), brass, { parent: b });
    M(sph(0.1, 10, 8), solid("#8a6a1f", { metalness: 0.7 }), { y: -0.95, parent: b });
    bx(0.03, 0.5, 0.03, fabric("#c9a66b", "denim"), { x: 0.4, y: -1.2, parent: b });
    g.userData.anim = (t) => { b.rotation.z = 0.18 * Math.sin(t * 3.2); };
    fin(g, { h: 2.8, w: 2.0, d: 0.6, detailH: 1.4, extra: { detail: { at: V(0, 1.7, -0.5), h: 1.4 } } });
  },

  // ---------------------------------------------------------------- country
  barn(g) {
    const red = cachedMat("barnRed", () => {
      const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d"); p.fillStyle = "#b7342b"; p.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 16) { p.fillStyle = "rgba(0,0,0,0.18)"; p.fillRect(x, 0, 2, 128); }
      const tx = canvasTex(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 2); return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.85 });
    });
    const white = solid("#f5f2ea"), roof = solid("#5b5f66", { roughness: 0.7 });
    const W = 5.2, H = 3.4, z = -1.6;
    rbx(W, H, 2.6, 0.03, red, { y: H / 2, z, parent: g });
    const gab = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2 - 0.6, 1.0), new THREE.Vector2(0, 1.9), new THREE.Vector2(-W / 2 + 0.6, 1.0)]);
    M(cachedGeo("barnGable", () => { const e = new THREE.ExtrudeGeometry(gab, { depth: 2.6, bevelEnabled: false }); e.translate(0, 0, -1.3); return e; }), red, { y: H, z, parent: g });
    for (const s of [-1, 1]) { bx(1.6, 0.12, 2.9, roof, { x: s * (W / 2 - 0.3) * 0.9, y: H + 0.55, z, rz: -s * 1.0, parent: g }); bx(2.9, 0.12, 2.9, roof, { x: s * 1.3, y: H + 1.45, z, rz: -s * 0.36, parent: g }); }
    // big white-trimmed doors with the X, a hay loft window
    const dz = z + 1.32;
    for (const s of [-1, 1]) { bx(1.0, 2.2, 0.06, red, { x: s * 0.52, y: 1.1, z: dz, parent: g }); for (const r of [0.92, -0.92]) bx(0.08, 2.35, 0.03, white, { x: s * 0.52, y: 1.1, z: dz + 0.04, rz: r * 0.42, parent: g }); }
    for (const [w, h, x, y] of [[2.2, 0.1, 0, 2.25], [0.1, 2.3, -1.05, 1.1], [0.1, 2.3, 1.05, 1.1], [0.1, 2.3, 0, 1.1]]) bx(w, h, 0.07, white, { x, y, z: dz + 0.02, parent: g });
    rbx(0.9, 0.8, 0.06, 0.02, solid("#3a2a1e"), { y: H + 0.55, z: dz, parent: g });
    for (const [w, h, x, y] of [[1.05, 0.08, 0, H + 0.95], [1.05, 0.08, 0, H + 0.15], [0.08, 0.85, -0.5, H + 0.55], [0.08, 0.85, 0.5, H + 0.55]]) bx(w, h, 0.07, white, { x, y, z: dz + 0.02, parent: g });
    lumps(g, 5, 7, { x0: -0.4, x1: 0.4, z0: dz - 0.3, z1: dz - 0.05, y: H + 0.2, s: 0.18, mat: solid("#e6c35c"), r: 0.03 });
    fin(g, { h: 5.5, w: W + 0.4, d: 3.0, big: true, push: 1.0, detailH: 3.4, extra: { detail: { at: V(0, 0, z), h: 3.6 } } });
  },
  windmill(g) {
    const wall = solid("#efe6d2", { roughness: 0.85 }), roof = solid("#6d4c41"), wood = fabric("#8a5a32", "cotton"), cloth = fabric("#f5f2ea", "cotton");
    const z = -1.2;
    M(cyl(0.9, 1.3, 4.4, 8), wall, { y: 2.2, z, parent: g });
    M(cone(1.15, 1.3, 8), roof, { y: 5.05, z, parent: g });
    rbx(0.6, 1.1, 0.06, 0.1, solid("#5a3d24"), { y: 0.55, z: z + 1.25, parent: g });
    rbx(0.4, 0.5, 0.06, 0.05, glow("#ffcf7a", 1.0, "#fff2c8"), { y: 2.6, z: z + 1.08, parent: g });
    const hub = new THREE.Group(); hub.position.set(0, 4.3, z + 1.25); g.add(hub);
    M(cyl(0.2, 0.2, 0.3, 12), wood, { rx: Math.PI / 2, parent: hub });
    for (let k = 0; k < 4; k++) { const a = new THREE.Group(); a.rotation.z = (k / 4) * TAU; hub.add(a); bx(0.12, 2.2, 0.06, wood, { y: 1.15, parent: a }); bx(0.5, 1.7, 0.03, cloth, { x: 0.3, y: 1.35, z: 0.03, parent: a }); }
    g.userData.anim = (t) => { hub.rotation.z = t * 0.6; };
    fin(g, { h: 6.8, w: 4.6, d: 2.6, big: true, push: 0.9, detailH: 4.5, extra: { detail: { at: V(0, 0, z), h: 5 } } });
  },
  haystack(g) {
    const hay = fabric("#e3b94f", "fur"), hay2 = fabric("#cfa23b", "fur");
    const z = -0.7;
    // two stacked square bales + a loose pile
    rbx(1.2, 0.55, 0.65, 0.06, hay, { x: -0.35, y: 0.275, z, parent: g });
    rbx(1.2, 0.55, 0.65, 0.06, hay2, { x: 0.45, y: 0.275, z: z - 0.1, parent: g });
    rbx(1.2, 0.55, 0.65, 0.06, hay, { x: 0.05, y: 0.825, z: z - 0.05, ry: 0.15, parent: g });
    for (const [x, y, zz] of [[-0.35, 0.275, z], [0.45, 0.275, z - 0.1]]) for (const s of [-0.3, 0.3]) bx(0.03, 0.57, 0.67, solid("#8a5a32"), { x: x + s, y, z: zz, parent: g });
    const pile = M(sph(0.6, 14, 10), hay2, { x: 1.2, y: 0, z: z + 0.1, parent: g }); pile.scale.set(1, 0.8, 0.9);
    lumps(g, 8, 13, { x0: -1, x1: 1.6, z0: -0.2, z1: 0.3, s: 0.12, mat: hay, r: 0.02 });
    fin(g, { h: 1.2, w: 2.6, d: 1.2, detailH: 1.2 });
  },
  tractor(g) {
    const green = solid("#2e9b3f", { roughness: 0.45 }), yel = solid("#f2c511", { roughness: 0.45 }), dk = solid("#1f1f24", { roughness: 0.6 });
    const t = new THREE.Group(); t.position.set(0, 0, -1.2); t.rotation.y = -0.5; g.add(t);
    rbx(1.6, 0.7, 0.9, 0.08, green, { x: 0.5, y: 0.95, parent: t });
    rbx(0.9, 1.2, 1.0, 0.06, green, { x: -0.45, y: 1.3, parent: t });
    bx(0.92, 0.6, 1.02, solid("#9cc8e8", { roughness: 0.1 }), { x: -0.45, y: 1.6, parent: t, shadow: false });
    rbx(1.05, 0.08, 1.15, 0.03, green, { x: -0.45, y: 2.0, parent: t });
    M(cyl(0.06, 0.06, 0.6, 8), dk, { x: 0.9, y: 1.55, z: 0.2, parent: t });
    for (const s of [-1, 1]) { M(cyl(0.62, 0.62, 0.32, 20), dk, { x: -0.55, y: 0.62, z: s * 0.62, rx: Math.PI / 2, parent: t }); M(cyl(0.34, 0.34, 0.34, 14), yel, { x: -0.55, y: 0.62, z: s * 0.62, rx: Math.PI / 2, parent: t }); M(cyl(0.36, 0.36, 0.22, 16), dk, { x: 0.95, y: 0.36, z: s * 0.5, rx: Math.PI / 2, parent: t }); M(cyl(0.18, 0.18, 0.24, 12), yel, { x: 0.95, y: 0.36, z: s * 0.5, rx: Math.PI / 2, parent: t }); }
    rbx(0.06, 0.3, 0.5, 0.02, glow("#fff1c4", 1.2), { x: 1.31, y: 1.05, parent: t });
    fin(g, { h: 2.1, w: 2.8, d: 2.2, push: 0.9, detailH: 2.0 });
  },
  garden(g) {
    const soil = solid("#5a3d2b", { roughness: 1 }), leaf = solid("#3f9a3f", { roughness: 0.7 });
    rbx(2.8, 0.25, 1.4, 0.04, fabric("#8a5a32", "cotton"), { y: 0.125, z: -0.8, parent: g });
    bx(2.6, 0.04, 1.2, soil, { y: 0.26, z: -0.8, parent: g });
    const cols = ["#ff5e8a", "#ffd32a", "#ff7a1a", "#c56cf0", "#ffffff", "#ff3b3b"], R = rng(8);
    for (let i = 0; i < 14; i++) {
      const x = -1.15 + (i % 7) * 0.38 + R() * 0.08, z = -0.5 - Math.floor(i / 7) * 0.55, h = 0.35 + R() * 0.3;
      bx(0.03, h, 0.03, leaf, { x, y: 0.28 + h / 2, z, parent: g });
      bx(0.14, 0.03, 0.06, leaf, { x: x + 0.06, y: 0.28 + h * 0.4, z, rz: 0.4, parent: g });
      const c = cols[i % cols.length];
      if (i % 3 === 0) M(sph(0.1, 10, 8), solid(c), { x, y: 0.3 + h, z, parent: g });
      else for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; M(sph(0.055, 8, 6), solid(c), { x: x + Math.cos(a) * 0.07, y: 0.3 + h, z: z + Math.sin(a) * 0.07, parent: g }); }
      if (i % 3 !== 0) M(sph(0.045, 8, 6), solid("#ffd32a"), { x, y: 0.31 + h, z, parent: g });
    }
    // two carrots poking out and a cabbage
    for (const x of [0.9, 1.1]) { M(cone(0.06, 0.25, 8), solid("#ff7a1a"), { x, y: 0.3, z: -0.25, rx: Math.PI, parent: g }); bx(0.1, 0.18, 0.02, leaf, { x, y: 0.5, z: -0.25, parent: g }); }
    M(sph(0.18, 12, 10), solid("#8cc63f"), { x: -1.0, y: 0.38, z: -0.25, parent: g });
    fin(g, { h: 1.0, w: 2.9, d: 1.6, detailH: 1.0 });
  },
  pumpkin(g) {
    const or = solid("#ff7f1a", { roughness: 0.55 }), dk = solid("#e0650a", { roughness: 0.6 });
    const p = new THREE.Group(); p.position.set(0, 0.55, -0.6); g.add(p);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, m = M(sph(0.42, 16, 12), k % 2 ? or : dk, { x: Math.cos(a) * 0.32, z: Math.sin(a) * 0.32, parent: p }); m.scale.set(0.65, 1.0, 0.65); }
    M(cyl(0.06, 0.09, 0.32, 8), solid("#4e7d2a"), { y: 0.55, rz: 0.2, parent: p });
    bx(0.4, 0.02, 0.18, solid("#3f9a3f"), { x: 0.2, y: 0.47, rz: -0.3, parent: p });
    fin(g, { h: 1.3, w: 1.6, d: 1.4, detailH: 1.2 });
  },

  // ---------------------------------------------------------------- wild / underground
  hole(g) {
    // a dark round hole in the ground with a dirt rim (a drain, a pit, a mine shaft)
    const dirt = solid("#6b4a33", { roughness: 1 }), black = cachedMat("holeBlack", () => new THREE.MeshBasicMaterial({ color: "#050405" }));
    M(cyl(0.95, 1.05, 0.12, 24), dirt, { y: 0.06, z: -0.9, parent: g });
    M(cyl(0.8, 0.8, 0.02, 24), black, { y: 0.125, z: -0.9, parent: g, shadow: false });
    const inner = M(openCyl(0.8, 0.6), cachedMat("holeWall", () => new THREE.MeshStandardMaterial({ color: "#2a1d14", side: THREE.BackSide })), { y: -0.2, z: -0.9, parent: g });
    void inner;
    lumps(g, 9, 19, { x0: -1.2, x1: 1.2, z0: -1.6, z1: -0.1, s: 0.2, mat: dirt, r: 0.05 });
    // two little warning cones
    for (const x of [-1.2, 1.2]) { M(cone(0.14, 0.45, 12), solid("#ff7a1a"), { x, y: 0.225, z: -0.5, parent: g }); M(cyl(0.12, 0.12, 0.06, 12), solid("#ffffff"), { x, y: 0.25, z: -0.5, parent: g }); }
    fin(g, { h: 0.6, w: 2.6, d: 1.9, detailH: 0.9, fitY: 0.5 });
  },
  rock(g) {
    const r1 = solid("#8d8a85", { roughness: 0.95 }), r2 = solid("#77736d", { roughness: 0.95 });
    const big = M(cachedGeo("rockIco", () => new THREE.IcosahedronGeometry(0.75, 0)), r1, { y: 0.5, z: -0.7, parent: g }); big.scale.set(1.3, 0.85, 1);
    const s2 = M(cachedGeo("rockIco2", () => new THREE.IcosahedronGeometry(0.4, 0)), r2, { x: 0.95, y: 0.25, z: -0.4, ry: 0.6, parent: g }); s2.scale.set(1.2, 0.8, 1);
    for (const [x, z, s] of [[-0.9, -0.3, 0.16], [-0.6, 0.0, 0.1], [0.5, 0.1, 0.12]]) M(cachedGeo(`rockIco${s}`, () => new THREE.IcosahedronGeometry(s, 0)), r2, { x, y: s * 0.7, z, parent: g });
    bx(0.5, 0.04, 0.3, solid("#5f8f3a"), { x: -0.2, y: 1.0, z: -0.75, rz: 0.1, parent: g }); // moss
    fin(g, { h: 1.3, w: 2.2, d: 1.5, detailH: 1.2 });
  },
  stump(g) {
    const bark = fabric("#6b4423", "denim"), top = solid("#d9b27c", { roughness: 0.8 }), ring = solid("#b58a55");
    M(cyl(0.55, 0.65, 0.9, 14), bark, { y: 0.45, z: -0.6, parent: g });
    M(cyl(0.55, 0.55, 0.02, 20), top, { y: 0.91, z: -0.6, parent: g });
    for (const r of [0.15, 0.3, 0.44]) M(tor(r, 0.012, TAU, 4, 24), ring, { y: 0.925, z: -0.6, rx: Math.PI / 2, parent: g, shadow: false });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; rbx(0.18, 0.3, 0.5, 0.04, bark, { x: Math.cos(a) * 0.6, y: 0.12, z: -0.6 + Math.sin(a) * 0.6, ry: -a, rx: 0.35, parent: g }); }
    M(sph(0.12, 8, 6), solid("#d23b3b"), { x: 0.5, y: 0.12, z: -0.05, parent: g }); // a tiny red mushroom
    fin(g, { h: 1.0, w: 1.5, d: 1.4, detailH: 1.0 });
  },
  mushroom(g) {
    // a giant glowing cave mushroom + two small ones
    const stem = solid("#f2ead8", { roughness: 0.7 }), cap = glow("#3fd0c9", 0.9, "#7ef0e6");
    const one = (x, z, s) => { M(cyl(0.12 * s, 0.16 * s, 0.9 * s, 12), stem, { x, y: 0.45 * s, z, parent: g }); const c = M(hemi(0.55 * s), cap, { x, y: 0.85 * s, z, parent: g }); c.scale.set(1, 0.6, 1); for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; M(sph(0.06 * s, 8, 6), solid("#ffffff"), { x: x + Math.cos(a) * 0.3 * s, y: 0.85 * s + 0.2 * s, z: z + Math.sin(a) * 0.3 * s, parent: g }); } };
    one(0, -0.7, 1.6); one(-0.9, -0.3, 0.7); one(0.8, -0.2, 0.55);
    fin(g, { h: 2.0, w: 2.2, d: 1.4, detailH: 1.8 });
  },
  crystal(g) {
    const cm = glow("#8f6bff", 1.6, "#d9ccff"), cm2 = glow("#4fd6ff", 1.4, "#cdf6ff");
    const R = rng(23);
    for (let i = 0; i < 7; i++) { const h = 0.5 + R() * 1.1; M(cachedGeo(`crys${i}`, () => new THREE.CylinderGeometry(0, 0.12 + R() * 0.08, h, 6)), i % 2 ? cm : cm2, { x: -0.6 + R() * 1.2, y: h / 2, z: -0.6 + R() * 0.4, rz: (R() - 0.5) * 0.7, rx: (R() - 0.5) * 0.5, parent: g, shadow: false }); }
    M(cachedGeo("crysBase", () => new THREE.IcosahedronGeometry(0.5, 0)), solid("#5d5a64", { roughness: 0.9 }), { y: 0.05, z: -0.5, parent: g }).scale.set(1.6, 0.4, 1);
    fin(g, { h: 1.7, w: 1.6, d: 1.0, detailH: 1.6 });
  },
  porthole(g, state) {
    // a riveted metal wall with a big round porthole: the sea outside (fish swimming by), or covered by a curtain
    const steel = solid("#7d8a96", { metalness: 0.7, roughness: 0.35 }), dk = solid("#59636d", { metalness: 0.7, roughness: 0.4 });
    rbx(3.4, 3.0, 0.2, 0.02, steel, { y: 1.5, z: -0.6, parent: g });
    const c = new THREE.Group(); c.position.set(0, 1.65, -0.48); g.add(c);
    M(tor(0.72, 0.11, TAU, 10, 32), solid("#c9a23b", { metalness: 0.85, roughness: 0.3 }), { parent: c });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; M(sph(0.04, 6, 5), dk, { x: Math.cos(a) * 0.86, y: Math.sin(a) * 0.86, z: 0.03, parent: c }); }
    const sea = cachedMat("portSea", () => new THREE.MeshStandardMaterial({ color: "#1d5fa0", emissive: "#0c3d73", emissiveIntensity: 0.9, roughness: 0.2 }));
    M(cachedGeo("portDisc", () => new THREE.CircleGeometry(0.7, 32)), sea, { z: -0.02, parent: c, shadow: false });
    const fish = [];
    if (state === "covered") { bx(1.5, 1.5, 0.04, fabric("#c0392b", "dots"), { z: 0.08, parent: c }); }
    else {
      for (let i = 0; i < 3; i++) { const f = new THREE.Group(); c.add(f); const col = ["#ffb400", "#ff6fb5", "#7fffd4"][i]; const b = M(sph(0.09, 10, 8), glow(col, 0.6, col), { parent: f, shadow: false }); b.scale.set(1.5, 1, 0.5); M(cone(0.07, 0.1, 4), glow(col, 0.6, col), { x: -0.16, rz: Math.PI / 2, parent: f, shadow: false }); fish.push({ f, y: -0.3 + i * 0.28, ph: i * 0.37 }); }
      for (let k = 0; k < 5; k++) M(sph(0.03, 6, 5), clear("#e6f7ff", 0.7), { x: -0.3 + k * 0.15, y: -0.5 + k * 0.2, z: 0.01, parent: c, shadow: false });
    }
    g.userData.anim = (t) => { for (const { f, y, ph } of fish) { const k = ((t * 0.25 + ph) % 1); f.position.set(-0.75 + k * 1.5, y + 0.05 * Math.sin(t * 3 + ph * 8), 0); f.visible = Math.abs(f.position.x) < 0.62; } };
    fin(g, { h: 3.0, w: 3.4, d: 0.6, detailH: 2.0, extra: { detail: { at: V(0, 0.8, -0.5), h: 1.8 } } });
  },

  // ---------------------------------------------------------------- home
  chair(g, state) {
    if (state === "throne") {
      const gold = solid("#d6a42f", { metalness: 0.7, roughness: 0.3 }), velvet = fabric("#8e1b3a", "cotton");
      rbx(1.0, 0.5, 0.9, 0.04, gold, { y: 0.25, z: -0.5, parent: g });
      rbx(0.9, 0.12, 0.8, 0.05, velvet, { y: 0.56, z: -0.48, parent: g });
      rbx(1.0, 1.6, 0.16, 0.05, gold, { y: 1.1, z: -0.92, parent: g });
      rbx(0.8, 1.3, 0.05, 0.05, velvet, { y: 1.15, z: -0.83, parent: g });
      for (const s of [-1, 1]) { rbx(0.14, 0.35, 0.8, 0.04, gold, { x: s * 0.5, y: 0.7, z: -0.5, parent: g }); M(sph(0.1, 10, 8), gold, { x: s * 0.42, y: 1.95, z: -0.92, parent: g }); }
      M(cone(0.12, 0.25, 5), gold, { y: 2.0, z: -0.92, parent: g });
      fin(g, { h: 2.1, w: 1.1, d: 1.0, actors: "seat", extra: { seat: V(0, 0, -0.45), seatH: 0.62 } });
      return;
    }
    if (state === "pile") {
      const cols = ["#ff6fb5", "#ffd32a", "#2e86de", "#20bf6b", "#c56cf0", "#ff7a1a"];
      for (let k = 0; k < 6; k++) rbx(0.9 - k * 0.05, 0.22, 0.85 - k * 0.05, 0.1, fabric(cols[k], k % 2 ? "dots" : "stripes"), { y: 0.11 + k * 0.22, z: -0.45, ry: (k % 3 - 1) * 0.15, parent: g });
      fin(g, { h: 1.4, w: 1.0, d: 0.9, actors: "seat", extra: { seat: V(0, 0, -0.45), seatH: 1.34 } });
      return;
    }
    const wood = fabric("#b07a45", "cotton"), dk = fabric("#8a5a32", "cotton");
    rbx(0.55, 0.07, 0.55, 0.02, wood, { y: 0.46, z: -0.35, parent: g });
    for (const [x, z] of [[-0.23, -0.12], [0.23, -0.12], [-0.23, -0.58], [0.23, -0.58]]) bx(0.06, 0.46, 0.06, dk, { x, y: 0.23, z, parent: g });
    for (const x of [-0.23, 0.23]) bx(0.06, 0.55, 0.06, dk, { x, y: 0.77, z: -0.6, parent: g });
    rbx(0.55, 0.22, 0.05, 0.02, wood, { y: 0.92, z: -0.6, parent: g });
    fin(g, { h: 1.05, w: 0.7, d: 0.7, actors: "seat", extra: { seat: V(0, 0, -0.35), seatH: 0.5 } });
  },
  couch(g) {
    const fab = fabric("#4f7cc8", "cotton"), cush = fabric("#6a94dc", "cotton"), leg = solid("#3a2a1e");
    const z = -0.6;
    rbx(2.2, 0.45, 0.9, 0.08, fab, { y: 0.35, z, parent: g });
    rbx(2.2, 0.7, 0.25, 0.1, fab, { y: 0.8, z: z - 0.35, parent: g });
    for (const s of [-1, 1]) { rbx(0.25, 0.65, 0.9, 0.1, fab, { x: s * 1.0, y: 0.5, z, parent: g }); rbx(0.85, 0.16, 0.7, 0.07, cush, { x: s * 0.45, y: 0.64, z: z + 0.05, parent: g }); }
    for (const x of [-0.95, 0.95]) for (const zz of [z + 0.35, z - 0.35]) bx(0.08, 0.12, 0.08, leg, { x, y: 0.06, z: zz, parent: g });
    rbx(0.38, 0.38, 0.12, 0.08, fabric("#ffd32a", "dots"), { x: -0.7, y: 0.9, z: z - 0.15, rz: 0.2, parent: g });
    fin(g, { h: 1.2, w: 2.3, d: 1.0, actors: "seat", extra: { seat: V(0.45, 0, z + 0.05), seatH: 0.72 } });
  },
  table(g) {
    const wood = fabric("#a87a4f", "cotton"), dk = fabric("#7a5230", "cotton");
    const z = -0.5;
    rbx(1.6, 0.08, 0.85, 0.02, wood, { y: 0.78, z, parent: g });
    for (const x of [-0.72, 0.72]) for (const zz of [z + 0.35, z - 0.35]) bx(0.08, 0.78, 0.08, dk, { x, y: 0.39, z: zz, parent: g });
    // a plate, a cup, an apple: it reads as a table
    M(cyl(0.16, 0.14, 0.02, 18), solid("#ffffff"), { x: -0.35, y: 0.83, z, parent: g });
    M(cyl(0.05, 0.04, 0.12, 12), gloss("#e53935"), { x: 0.35, y: 0.88, z: z - 0.1, parent: g });
    M(sph(0.07, 10, 8), gloss("#7cc242"), { x: -0.35, y: 0.89, z, parent: g });
    fin(g, { h: 1.0, w: 1.7, d: 1.0, actors: "behind", extra: { actorsBack: 0.9 } });
  },
  fridge(g, state) {
    const white = solid("#f2f4f6", { roughness: 0.3 }), hand = solid("#b8c0c8", { metalness: 0.8, roughness: 0.2 });
    const z = -0.45, W = 0.9, H = 1.9;
    rbx(W, H, 0.75, 0.06, white, { y: H / 2, z, parent: g });
    const open = state === "open";
    const door = new THREE.Group(); door.position.set(-W / 2, 0, z + 0.38); g.add(door);
    rbx(W, H * 0.66, 0.08, 0.04, white, { x: W / 2, y: H * 0.33 + 0.01, parent: door });
    bx(0.04, 0.5, 0.05, hand, { x: W - 0.1, y: H * 0.45, z: 0.06, parent: door });
    rbx(W, H * 0.32, 0.08, 0.04, white, { x: 0, y: H * 0.83, z: z + 0.38, parent: g }).position.x = 0;
    bx(0.04, 0.25, 0.05, hand, { x: W / 2 - 0.1, y: H * 0.78, z: z + 0.44, parent: g });
    // magnets + a drawing on the freezer door
    for (const [x, y, c] of [[-0.25, 1.7, "#e53935"], [0.15, 1.75, "#2e86de"], [0.0, 1.0, "#ffd32a"]]) rbx(0.08, 0.08, 0.03, 0.02, gloss(c), { x, y, z: z + 0.44, parent: g });
    bx(0.25, 0.3, 0.01, solid("#fffbe6"), { x: -0.2, y: 0.95, z: z + 0.425, parent: g });
    if (open) {
      door.rotation.y = -1.6;
      bx(W - 0.1, H * 0.62, 0.02, glow("#fff7d6", 1.6, "#fffdf2"), { y: H * 0.33, z: z - 0.3, parent: g, shadow: false });
      for (const y of [0.4, 0.8]) bx(W - 0.12, 0.02, 0.6, solid("#e8eef2"), { y, z, parent: g });
      M(cyl(0.08, 0.08, 0.22, 10), gloss("#ffffff"), { x: -0.2, y: 0.52, z: z + 0.1, parent: g });
      M(sph(0.1, 10, 8), solid("#ffd23a"), { x: 0.15, y: 0.9, z: z + 0.1, parent: g }).scale.set(1.3, 0.6, 1);
    }
    fin(g, { h: H, w: W + 0.2, d: 0.9, detailH: 1.8 });
  },
  stove(g) {
    // a kitchen stove with a pot, or the fireplace with a fire (a hearth also stands for a chimney)
    const white = solid("#f2f4f6", { roughness: 0.35 }), dk = solid("#24272c", { roughness: 0.4 });
    const z = -0.4;
    rbx(0.9, 0.9, 0.7, 0.04, white, { y: 0.45, z, parent: g });
    bx(0.9, 0.04, 0.7, dk, { y: 0.92, z, parent: g });
    rbx(0.7, 0.45, 0.04, 0.03, solid("#1b1d22", { roughness: 0.15 }), { y: 0.45, z: z + 0.36, parent: g });
    bx(0.6, 0.04, 0.05, solid("#c8ced4", { metalness: 0.8 }), { y: 0.74, z: z + 0.4, parent: g });
    for (let k = 0; k < 4; k++) M(cyl(0.06, 0.06, 0.04, 10), solid("#ff3b2e", { emissive: "#ff2a0a", emissiveIntensity: k === 1 ? 1.5 : 0 }), { x: -0.3 + k * 0.2, y: 0.86, z: z + 0.36, rx: Math.PI / 2, parent: g });
    bx(0.9, 0.35, 0.1, white, { y: 1.1, z: z - 0.32, parent: g });
    M(cyl(0.2, 0.18, 0.25, 16), solid("#9aa3ad", { metalness: 0.8, roughness: 0.3 }), { x: -0.18, y: 1.06, z, parent: g });
    const steam = [];
    for (let k = 0; k < 3; k++) steam.push(M(sph(0.08, 8, 6), clear("#ffffff", 0.5), { x: -0.18, y: 1.3, z, parent: g, shadow: false }));
    g.userData.anim = (t) => steam.forEach((s, k) => { const p = (t * 0.5 + k / 3) % 1; s.position.y = 1.25 + p * 0.6; s.scale.setScalar(0.6 + p); s.material.opacity = 0.5 * (1 - p); });
    fin(g, { h: 1.3, w: 1.0, d: 0.8, detailH: 1.2 });
  },
  drawer(g, state) {
    const wood = fabric("#c48a52", "cotton"), dk = fabric("#9a6a3a", "cotton"), knob = solid("#d8b45a", { metalness: 0.8, roughness: 0.3 });
    const z = -0.4, W = 1.3;
    rbx(W, 1.3, 0.55, 0.03, wood, { y: 0.65, z, parent: g });
    for (let k = 0; k < 3; k++) {
      const out = state === "open" && k === 1 ? 0.35 : 0;
      const d = new THREE.Group(); d.position.set(0, 0.25 + k * 0.4, z + 0.28 + out); g.add(d);
      rbx(W - 0.12, 0.34, 0.05, 0.02, dk, { parent: d });
      M(sph(0.035, 8, 6), knob, { z: 0.04, parent: d });
      if (out) { bx(W - 0.18, 0.28, 0.5, wood, { y: -0.02, z: -0.27, parent: d }); for (let s = 0; s < 4; s++) rbx(0.18, 0.1, 0.28, 0.04, fabric(["#e84a5f", "#2e86de", "#ffd32a", "#20bf6b"][s], "stripes"), { x: -0.4 + s * 0.27, y: 0.1, z: -0.27, rz: (s % 2 - 0.5) * 0.4, parent: d }); }
    }
    fin(g, { h: 1.4, w: W + 0.1, d: 0.9, detailH: 1.3 });
  },
  laundry(g) {
    // a clothesline between two poles with clothes on it + a basket
    const pole = fabric("#8a5a32", "cotton"), rope = solid("#f5f5f5");
    for (const s of [-1, 1]) { bx(0.08, 1.9, 0.08, pole, { x: s * 1.5, y: 0.95, z: -0.7, parent: g }); bx(0.5, 0.06, 0.06, pole, { x: s * 1.5, y: 1.85, z: -0.7, parent: g }); }
    bx(3.0, 0.02, 0.02, rope, { y: 1.8, z: -0.7, parent: g, shadow: false });
    const items = [];
    const cl = [["#e84a5f", "stripes", 0.4, 0.55], ["#2e86de", "denim", 0.35, 0.7], ["#ffd32a", "dots", 0.32, 0.45], ["#20bf6b", "cotton", 0.22, 0.32], ["#ffffff", "cotton", 0.5, 0.45]];
    cl.forEach(([c, k, w, h], i) => { const it = new THREE.Group(); it.position.set(-1.15 + i * 0.58, 1.79, -0.7); g.add(it); bx(w, h, 0.02, fabric(c, k), { y: -h / 2, parent: it }); items.push(it); });
    rbx(0.6, 0.35, 0.4, 0.06, fabric("#d9b27c", "plaid"), { x: 0.9, y: 0.175, z: -0.2, parent: g });
    g.userData.anim = (t) => items.forEach((it, i) => { it.rotation.x = 0.12 * Math.sin(t * 2 + i); });
    fin(g, { h: 2.0, w: 3.2, d: 1.0, detailH: 1.6 });
  },
  ladder(g) {
    const wood = fabric("#c48a52", "cotton");
    const L = new THREE.Group(); L.position.set(0, 0, -0.7); L.rotation.x = -0.25; g.add(L);
    for (const s of [-1, 1]) bx(0.08, 3.2, 0.08, wood, { x: s * 0.3, y: 1.6, parent: L });
    for (let k = 0; k < 9; k++) bx(0.6, 0.06, 0.06, wood, { y: 0.3 + k * 0.33, parent: L });
    rbx(0.5, 0.6, 0.3, 0.02, solid("#9aa3ad"), { y: 1.5, z: -1.2, parent: g }); // something it leans on
    fin(g, { h: 3.2, w: 1.0, d: 1.2, detailH: 2.4 });
  },
  stairs(g) {
    const step = fabric("#b07a45", "cotton"), side = solid("#e9e1d3");
    for (let k = 0; k < 6; k++) rbx(1.4, 0.2, 0.32, 0.02, step, { y: 0.1 + k * 0.2, z: -0.3 - k * 0.3, parent: g });
    for (let k = 0; k < 6; k++) bx(1.4, 0.2 * (k + 1), 0.3, side, { y: 0.1 * (k + 1), z: -0.3 - k * 0.3, parent: g });
    for (const s of [-1, 1]) { const len = Math.hypot(1.8, 1.2); bx(0.06, 0.06, len, solid("#5a3d24"), { x: s * 0.68, y: 1.3, z: -1.05, rx: Math.atan2(1.2, 1.8), parent: g }); for (let k = 0; k < 6; k++) bx(0.04, 0.8, 0.04, solid("#5a3d24"), { x: s * 0.68, y: 0.6 + k * 0.2, z: -0.3 - k * 0.3, parent: g }); }
    fin(g, { h: 2.1, w: 1.5, d: 2.0, detailH: 1.8 });
  },
  footprints(g) {
    // a trail of dark footprints across the ground, toward the camera
    const fm = cachedMat("footprint", () => new THREE.MeshStandardMaterial({ color: "#2a1e18", roughness: 1, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }));
    for (let k = 0; k < 8; k++) {
      const s = k % 2 ? 1 : -1, z = -2.6 + k * 0.38, x = s * 0.14 + Math.sin(k * 0.6) * 0.2;
      const f = new THREE.Group(); f.position.set(x, 0.012, z); g.add(f);
      const sole = M(cachedGeo("fpSole", () => new THREE.CircleGeometry(0.1, 14)), fm, { rx: -Math.PI / 2, parent: f, shadow: false }); sole.scale.set(0.8, 1.4, 1);
      M(cachedGeo("fpHeel", () => new THREE.CircleGeometry(0.07, 12)), fm, { z: 0.17, rx: -Math.PI / 2, parent: f, shadow: false });
    }
    fin(g, { h: 0.6, w: 1.2, d: 3.0, detailH: 0.9, fitY: 0.4 });
  },

  // ---------------------------------------------------------------- the item display: any hand prop, big, on a crate
  item(g, state) {
    const crate = fabric("#b88a57", "cotton");
    rbx(0.7, 0.55, 0.6, 0.03, crate, { y: 0.275, z: -0.4, parent: g });
    for (const y of [0.12, 0.42]) bx(0.72, 0.06, 0.62, fabric("#8a5a32", "cotton"), { y, z: -0.4, parent: g });
    const h = makeHeld(state);
    if (h) {
      const box = new THREE.Box3().setFromObject(h), size = box.getSize(new THREE.Vector3());
      const k = Math.min(3.2, 0.55 / Math.max(0.05, size.x, size.y, size.z));
      h.scale.setScalar(k);
      h.position.set(-(box.min.x + box.max.x) / 2 * k, 0.56 - box.min.y * k, -0.4 - (box.min.z + box.max.z) / 2 * k);
      g.add(h);
    }
    fin(g, { h: 1.15, w: 0.8, d: 0.7, detailH: 1.0 });
  },
};

// ---------------------------------------------------------------- animals: one chunky builder, a species each
const SPECIES = {
  dog: { body: "#c58b4f", belly: "#f1d6b0", size: 0.55, ears: "flop", tail: "up", snout: 0.16 },
  cat: { body: "#f08a2c", belly: "#ffe1c2", size: 0.4, ears: "point", tail: "curl", snout: 0.06, whiskers: true, stripes: true },
  goat: { body: "#f2ede4", belly: "#ffffff", size: 0.65, ears: "side", tail: "stub", snout: 0.14, horns: "curl", beard: true },
  sheep: { body: "#fbfbf8", belly: "#ffffff", size: 0.62, ears: "side", tail: "stub", snout: 0.1, wool: true, face: "#2a2a2e" },
  cow: { body: "#ffffff", belly: "#ffffff", size: 0.9, ears: "side", tail: "long", snout: 0.18, spots: "#1e1e1e", horns: "small", nose: "#ffb3c1" },
  pig: { body: "#ffb3c1", belly: "#ffc8d3", size: 0.6, ears: "point", tail: "curl", snout: 0.12, nose: "#ff8fa8", flat: true },
  horse: { body: "#8a5a32", belly: "#a87a4f", size: 1.1, ears: "point", tail: "long", snout: 0.3, mane: "#3a2a1e", tall: true },
  bear: { body: "#6b4423", belly: "#a87a4f", size: 1.0, ears: "round", tail: "stub", snout: 0.16 },
  moose: { body: "#5a3d24", belly: "#7a5230", size: 1.15, ears: "side", tail: "stub", snout: 0.32, antlers: true, tall: true },
  mouse: { body: "#9aa0a8", belly: "#e9e1d3", size: 0.3, ears: "round", tail: "long", snout: 0.08, bigEars: true },
  squirrel: { body: "#c0662b", belly: "#f1d6b0", size: 0.3, ears: "point", tail: "bush", snout: 0.05 },
  mole: { body: "#3a3036", belly: "#4f454b", size: 0.35, ears: "none", tail: "stub", snout: 0.08, nose: "#ff8fa8", glasses: false },
  rabbit: { body: "#e9e1d3", belly: "#ffffff", size: 0.35, ears: "long", tail: "puff", snout: 0.05, nose: "#ff8fa8" },
  skunk: { body: "#1e1e24", belly: "#1e1e24", size: 0.4, ears: "round", tail: "bush", snout: 0.07, stripe: "#ffffff" },
  fox: { body: "#e8691e", belly: "#ffffff", size: 0.45, ears: "point", tail: "bush", snout: 0.14 },
  wolf: { body: "#7d8590", belly: "#d9dde2", size: 0.7, ears: "point", tail: "bush", snout: 0.18 },
};
function quadruped(g, sp) {
  const S = sp.size * 1.25; // a touch bigger than life, so it reads on a phone
  const body = sp.wool ? fabric(sp.body, "fur") : fabric(sp.body, "fur"), belly = solid(sp.belly, { roughness: 0.8 }), dk = solid("#1b1b1f");
  const a = new THREE.Group(); a.position.set(0, 0, -0.5); a.rotation.y = -0.6; g.add(a); // three-quarter view, head toward the camera
  const legH = S * (sp.tall ? 0.75 : 0.45) * (sp.flat ? 0.7 : 1), bl = S * 1.2, bh = S * 0.62, bw = S * 0.62;
  rbx(bl, bh, bw, Math.min(bh, bw) * 0.3, body, { y: legH + bh / 2, parent: a });
  if (sp.wool) for (let k = 0; k < 10; k++) M(sph(bh * 0.32, 10, 8), body, { x: -bl / 2 + (k % 5) * bl / 4, y: legH + bh * (k < 5 ? 0.95 : 0.55), z: (k % 2 ? 1 : -1) * bw * 0.32, parent: a });
  if (sp.spots) for (const [x, y, s] of [[-0.2, 0.7, 0.3], [0.25, 0.5, 0.25], [0, 0.9, 0.2]]) bx(bl * s, bh * 0.4, bw + 0.01, solid(sp.spots), { x: x * bl, y: legH + bh * y, parent: a });
  if (sp.stripes) for (let k = 0; k < 3; k++) bx(bl * 0.08, bh * 1.01, bw * 1.01, solid(darker(sp.body, 0.75)), { x: -bl * 0.25 + k * bl * 0.2, y: legH + bh / 2, parent: a });
  if (sp.stripe) bx(bl * 1.01, bh * 0.15, bw * 0.3, solid(sp.stripe), { y: legH + bh * 0.98, parent: a });
  bx(bl * 0.8, bh * 0.1, bw * 0.8, belly, { y: legH + 0.02, parent: a });
  for (const [x, z] of [[bl * 0.35, bw * 0.3], [bl * 0.35, -bw * 0.3], [-bl * 0.35, bw * 0.3], [-bl * 0.35, -bw * 0.3]]) { rbx(S * 0.16, legH + 0.04, S * 0.16, 0.03, body, { x, y: legH / 2, z, parent: a }); bx(S * 0.17, S * 0.06, S * 0.18, dk, { x, y: S * 0.03, z, parent: a }); }
  // head (toward +x), facing a little to the camera
  const head = new THREE.Group(); head.position.set(bl / 2 + S * 0.12, legH + bh * (sp.tall ? 1.15 : 0.95), 0); head.rotation.y = -0.5; a.add(head);
  const hs = S * 0.48;
  rbx(hs, hs, hs, hs * 0.25, sp.face ? solid(sp.face) : body, { parent: head });
  if (sp.snout) rbx(sp.snout * 1.25 + 0.05, hs * 0.45, hs * 0.55, 0.03, sp.nose && sp.flat ? solid(sp.nose) : belly, { x: hs / 2 + sp.snout * 0.6, y: -hs * 0.18, parent: head });
  if (sp.nose) bx(0.05, hs * 0.15, hs * 0.3, solid(sp.nose), { x: hs / 2 + sp.snout * 1.25 + 0.04, y: -hs * 0.12, parent: head });
  else bx(0.04, hs * 0.14, hs * 0.2, dk, { x: hs / 2 + (sp.snout ?? 0) * 1.25 + 0.04, y: -hs * 0.05, parent: head });
  for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(hs * 0.42, hs * 0.12, s * hs * 0.26); head.add(e); bx(0.02, hs * 0.2, hs * 0.16, solid("#ffffff"), { parent: e }); bx(0.025, hs * 0.13, hs * 0.1, dk, { x: 0.005, parent: e }); }
  const ear = (s) => {
    const y = hs * 0.5, z = s * hs * 0.32;
    if (sp.ears === "point") M(cone(hs * 0.18, hs * 0.38, 4), body, { y: y + hs * 0.15, z, parent: head });
    else if (sp.ears === "round") M(sph(hs * (sp.bigEars ? 0.3 : 0.16), 10, 8), body, { y, z, parent: head }).scale.set(0.4, 1, 1);
    else if (sp.ears === "flop") bx(hs * 0.12, hs * 0.5, hs * 0.22, solid(darker(sp.body, 0.7)), { x: -hs * 0.1, y: hs * 0.1, z: s * hs * 0.55, rz: 0.2, parent: head });
    else if (sp.ears === "side") bx(hs * 0.12, hs * 0.14, hs * 0.4, body, { y: hs * 0.25, z: s * hs * 0.6, rx: s * 0.4, parent: head });
    else if (sp.ears === "long") bx(hs * 0.12, hs * 0.85, hs * 0.2, body, { y: hs * 0.85, z: s * hs * 0.22, rz: -0.15, parent: head });
  };
  ear(-1); ear(1);
  if (sp.horns === "curl") for (const s of [-1, 1]) M(tor(hs * 0.25, hs * 0.07, Math.PI * 1.3, 6, 12), solid("#8a7a5a"), { x: -hs * 0.1, y: hs * 0.62, z: s * hs * 0.3, ry: Math.PI / 2, parent: head });
  if (sp.horns === "small") for (const s of [-1, 1]) M(cone(hs * 0.07, hs * 0.25, 6), solid("#f2ead8"), { y: hs * 0.6, z: s * hs * 0.35, rx: s * 0.6, parent: head });
  if (sp.beard) M(cone(hs * 0.12, hs * 0.35, 6), solid("#ffffff"), { x: hs * 0.45, y: -hs * 0.62, rx: Math.PI, parent: head });
  if (sp.whiskers) for (const s of [-1, 1]) for (const r of [-0.15, 0.15]) bx(0.01, 0.01, hs * 0.6, solid("#ffffff"), { x: hs * 0.6, y: -hs * 0.15, z: s * hs * 0.45, rx: r, parent: head, shadow: false });
  if (sp.antlers) for (const s of [-1, 1]) { const an = new THREE.Group(); an.position.set(-hs * 0.1, hs * 0.55, s * hs * 0.35); an.rotation.x = s * 0.7; head.add(an); const m = solid("#d9c49a", { roughness: 0.7 }); bx(hs * 0.12, hs * 0.6, hs * 0.12, m, { y: hs * 0.3, parent: an }); rbx(hs * 0.6, hs * 0.1, hs * 0.8, 0.02, m, { y: hs * 0.62, parent: an }); for (let k = 0; k < 4; k++) bx(hs * 0.08, hs * 0.3, hs * 0.08, m, { x: (k % 2 - 0.5) * hs * 0.3, y: hs * 0.82, z: (k - 1.5) * hs * 0.22, parent: an }); }
  if (sp.mane) bx(hs * 0.25, hs * 0.5, hs * 0.2, solid(sp.mane), { x: -hs * 0.4, y: hs * 0.2, parent: head });
  // tail (toward -x)
  const tx = -bl / 2, ty = legH + bh * 0.8;
  if (sp.tail === "bush") { const t = M(sph(S * 0.28, 12, 10), body, { x: tx - S * 0.15, y: ty + S * 0.25, parent: a }); t.scale.set(0.8, 1.6, 0.8); }
  else if (sp.tail === "long") bx(S * 0.6, 0.05, 0.05, body, { x: tx - S * 0.25, y: ty - S * 0.15, rz: 0.9, parent: a });
  else if (sp.tail === "curl") M(tor(S * 0.1, 0.025, Math.PI * 1.5, 6, 12), body, { x: tx - S * 0.08, y: ty + S * 0.08, ry: Math.PI / 2, parent: a });
  else if (sp.tail === "up") bx(S * 0.07, S * 0.4, S * 0.07, body, { x: tx - S * 0.05, y: ty + S * 0.15, rz: 0.5, parent: a });
  else if (sp.tail === "puff") M(sph(S * 0.12, 10, 8), solid("#ffffff"), { x: tx, y: ty, parent: a });
  else bx(S * 0.15, S * 0.08, S * 0.08, body, { x: tx - S * 0.05, y: ty, parent: a });
  const H = legH + bh + hs * (sp.tall ? 1.1 : 0.8) + (sp.antlers ? hs : 0);
  g.userData.anim = (t) => { head.rotation.z = 0.06 * Math.sin(t * 1.6); head.rotation.y = -0.5 + 0.12 * Math.sin(t * 0.9); };
  fin(g, { h: Math.max(0.5, H), w: Math.max(0.7, bl + S * 0.8), d: Math.max(0.7, bl * 0.8), detailH: Math.max(0.6, H), push: 0.6 });
  // 2026-11-05 (GAPS): a rider sits on the back, along the body (its head toward +x of the 3/4-turned group)
  g.userData.ride = { at: V(0, 0, -0.5), yaw: 0.97 }; g.userData.heading = 0.97;
  g.userData.parts = { body: a, head };
}
function bird(g, kind) {
  const look = { pigeon: ["#8d96a3", "#5d6a7a", "#ffb400", "#5aa874"], duck: ["#ffffff", "#f2f2f2", "#ff9f1a", null], chicken: ["#fbfbf5", "#f2ece0", "#ffb400", "#e53935"] }[kind] ?? ["#8d96a3", "#5d6a7a", "#ffb400", null];
  const [c1, c2, beakC, extra] = look;
  const b = new THREE.Group(); b.position.set(0, 0, -0.4); b.rotation.y = -0.5; b.scale.setScalar(1.4); g.add(b);
  const body = M(sph(0.2, 16, 12), solid(c1, { roughness: 0.8 }), { y: 0.3, parent: b }); body.scale.set(1.35, 1, 1);
  for (const s of [-1, 1]) { const w = M(sph(0.15, 12, 8), solid(c2, { roughness: 0.8 }), { x: -0.03, y: 0.32, z: s * 0.15, parent: b }); w.scale.set(1.4, 0.7, 0.35); }
  const head = new THREE.Group(); head.position.set(0.2, 0.52, 0); b.add(head);
  M(sph(0.11, 12, 10), solid(kind === "pigeon" ? "#6b7685" : c1, { roughness: 0.8 }), { parent: head });
  if (kind === "pigeon") M(tor(0.12, 0.04, TAU, 6, 14), solid(extra), { y: -0.09, rx: Math.PI / 2, parent: head });
  M(cone(0.04, kind === "duck" ? 0.12 : 0.1, 6), solid(beakC, { roughness: 0.5 }), { x: 0.13, y: -0.01, rz: -Math.PI / 2, parent: head }).scale.set(kind === "duck" ? 1.6 : 1, 1, kind === "duck" ? 0.6 : 1);
  if (kind === "chicken") for (let k = 0; k < 3; k++) M(sph(0.03, 6, 5), solid(extra), { x: -0.02 + k * 0.04, y: 0.12, parent: head });
  for (const s of [-1, 1]) { M(sph(0.025, 8, 6), solid("#ffffff"), { x: 0.07, y: 0.03, z: s * 0.07, parent: head }); M(sph(0.015, 6, 5), solid("#1b1b1f"), { x: 0.09, y: 0.03, z: s * 0.08, parent: head }); bx(0.02, 0.14, 0.02, solid(beakC), { x: 0.02, y: 0.08, z: s * 0.07, parent: b }); bx(0.08, 0.015, 0.06, solid(beakC), { x: 0.05, y: 0.01, z: s * 0.07, parent: b }); }
  M(cone(0.08, 0.2, 4), solid(c2), { x: -0.3, y: 0.34, rz: Math.PI / 2 + 0.3, parent: b });
  g.userData.anim = (t) => { head.position.x = 0.2 + 0.03 * Math.max(0, Math.sin(t * 5)); };
  fin(g, { h: 0.95, w: 0.9, d: 0.8, detailH: 0.9, push: 0.5 });
  g.userData.heading = 1.07; // the head toward +x of the half-turned group (page/kit/motion.js walks it that way)
}
const SIMPLE = {
  fish(g) { const f = new THREE.Group(); f.position.set(0, 0.9, -0.4); g.add(f); const b = M(sph(0.3, 16, 12), gloss("#ff9f1a"), { parent: f }); b.scale.set(1.5, 1, 0.55); M(cone(0.25, 0.3, 4), gloss("#ff7a1a"), { x: -0.55, rz: Math.PI / 2, parent: f }).scale.set(1, 1, 0.3); for (const s of [-1, 1]) { M(sph(0.06, 8, 6), solid("#ffffff"), { x: 0.28, y: 0.08, z: s * 0.14, parent: f }); M(sph(0.035, 6, 5), solid("#1b1b1f"), { x: 0.31, y: 0.08, z: s * 0.17, parent: f }); } for (let k = 0; k < 4; k++) M(sph(0.04, 6, 5), clear("#e6f7ff", 0.7), { x: 0.5 + k * 0.05, y: 0.25 + k * 0.18, parent: f }); rbx(0.5, 0.06, 0.4, 0.02, solid("#2e86de"), { y: -0.6, parent: f }); g.userData.anim = (t) => { f.rotation.y = -0.5 + 0.15 * Math.sin(t * 3); f.position.y = 0.9 + 0.05 * Math.sin(t * 2); }; fin(g, { h: 1.4, w: 1.2, d: 0.8, detailH: 1.0 }); },
  frog(g) { const f = new THREE.Group(); f.position.set(0, 0, -0.4); f.scale.setScalar(1.8); g.add(f); const m = solid("#4caf50", { roughness: 0.6 }); const b = M(sph(0.2, 14, 10), m, { y: 0.16, parent: f }); b.scale.set(1.2, 0.8, 1.1); for (const s of [-1, 1]) { M(sph(0.07, 10, 8), m, { x: 0.1, y: 0.32, z: s * 0.1, parent: f }); M(sph(0.045, 8, 6), solid("#ffffff"), { x: 0.14, y: 0.34, z: s * 0.1, parent: f }); M(sph(0.025, 6, 5), solid("#1b1b1f"), { x: 0.18, y: 0.35, z: s * 0.1, parent: f }); bx(0.2, 0.05, 0.08, m, { x: -0.1, y: 0.05, z: s * 0.2, parent: f }); } bx(0.02, 0.015, 0.2, solid("#2e6b31"), { x: 0.23, y: 0.14, parent: f }); fin(g, { h: 0.75, w: 0.9, d: 0.8, detailH: 0.8 }); },
  snail(g) { const s = new THREE.Group(); s.position.set(0, 0, -0.4); s.scale.setScalar(2.2); g.add(s); const m = solid("#c9b28f"); rbx(0.4, 0.08, 0.1, 0.04, m, { y: 0.04, parent: s }); M(tor(0.1, 0.06, TAU, 10, 18), solid("#b0632e"), { x: -0.03, y: 0.17, parent: s }); for (const z of [-0.03, 0.03]) { bx(0.015, 0.12, 0.015, m, { x: 0.18, y: 0.12, z, rz: -0.3, parent: s }); M(sph(0.02, 6, 5), solid("#1b1b1f"), { x: 0.2, y: 0.18, z, parent: s }); } fin(g, { h: 0.7, w: 1.0, d: 0.6, detailH: 0.7 }); },
  worm(g) { const w = new THREE.Group(); w.position.set(0, 0, -0.4); g.add(w); const m = solid("#e889a0", { roughness: 0.6 }); for (let k = 0; k < 9; k++) M(sph(0.11 - k * 0.004, 10, 8), m, { x: -0.5 + k * 0.12, y: 0.1 + Math.max(0, Math.sin(k * 0.7)) * 0.15, parent: w }); for (const s of [-1, 1]) M(sph(0.025, 6, 5), solid("#1b1b1f"), { x: 0.5, y: 0.25, z: s * 0.05, parent: w }); M(cyl(0.25, 0.3, 0.06, 16), solid("#5a3d2b"), { x: -0.55, y: 0.03, parent: w }); fin(g, { h: 0.6, w: 1.3, d: 0.6, detailH: 0.6 }); },
  bat(g) { const b = new THREE.Group(); b.position.set(0, 1.6, -0.4); b.scale.setScalar(1.6); g.add(b); const m = solid("#3b3442"); M(sph(0.12, 10, 8), m, { parent: b }); for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.x = s * 0.1; b.add(w); bx(0.45, 0.22, 0.02, m, { x: s * 0.22, y: 0.02, parent: w }); M(cone(0.04, 0.1, 4), m, { x: s * 0.05, y: 0.14, parent: b }); M(sph(0.025, 6, 5), glow("#ff3b3b", 2), { x: s * 0.045, y: 0.03, z: 0.1, parent: b }); } g.userData.anim = (t) => { b.children.forEach((c, i) => { if (c.isGroup) c.rotation.y = (i % 2 ? 1 : -1) * 0.5 * Math.sin(t * 12); }); b.position.y = 1.6 + 0.08 * Math.sin(t * 3); }; fin(g, { h: 2.0, w: 1.2, d: 0.6, detailH: 1.0, extra: { detail: { at: V(0, 1.1, -0.4), h: 1.0 } } }); },
  moth(g) { const b = new THREE.Group(); b.position.set(0, 1.5, -0.4); b.scale.setScalar(1.6); g.add(b); bx(0.06, 0.06, 0.25, solid("#6b5a45"), { parent: b }); for (const s of [-1, 1]) { const w = new THREE.Group(); b.add(w); const p = M(sph(0.22, 12, 8), solid("#d9c49a", { roughness: 0.9 }), { x: s * 0.22, parent: w }); p.scale.set(1, 0.08, 0.8); M(sph(0.06, 8, 6), solid("#6b5a45"), { x: s * 0.25, y: 0.02, z: 0.05, parent: w }); bx(0.01, 0.01, 0.12, solid("#6b5a45"), { x: s * 0.03, y: 0.04, z: 0.18, ry: s * 0.4, parent: b }); } g.userData.anim = (t) => { b.children.forEach((c, i) => { if (c.isGroup) c.rotation.z = (i % 2 ? 1 : -1) * 0.5 * Math.sin(t * 10); }); }; fin(g, { h: 1.9, w: 1.0, d: 0.6, detailH: 0.9, extra: { detail: { at: V(0, 1.1, -0.4), h: 0.9 } } }); },
  firefly(g) { const fl = [], R = rng(31); const jar = new THREE.Group(); jar.position.set(0, 0, -0.4); g.add(jar); M(openCyl(0.18, 0.4, 16), clear("#e6f7ff", 0.35), { y: 0.2, parent: jar, shadow: false }); M(cyl(0.19, 0.19, 0.06, 16), solid("#d8b45a", { metalness: 0.7 }), { y: 0.43, parent: jar }); for (let i = 0; i < 16; i++) { const f = M(sph(0.035, 6, 5), glow("#e8ff6a", 5, "#f6ffc0"), { parent: g, shadow: false }); fl.push({ f, ph: R() * 10, r: 0.3 + R() * 0.9, y: 0.4 + R() * 1.6, i }); } g.userData.anim = (t) => { for (const { f, ph, r, y } of fl) f.position.set(Math.cos(t * 0.6 + ph) * r, y + 0.2 * Math.sin(t * 1.3 + ph), -0.4 + Math.sin(t * 0.6 + ph) * r * 0.5); }; fin(g, { h: 2.2, w: 2.0, d: 1.2, detailH: 1.8 }); },
  whale(g) { const w = new THREE.Group(); w.position.set(0, 1.4, -1.2); w.rotation.y = -0.3; g.add(w); const m = solid("#3c6fa8", { roughness: 0.6 }); const b = M(sph(1, 20, 14), m, { parent: w }); b.scale.set(2.2, 1, 1); bx(2.6, 0.5, 1.4, solid("#d9e6f2"), { y: -0.65, parent: w }); M(cone(0.6, 0.9, 4), m, { x: -2.4, y: 0.3, rz: 1.9, parent: w }).scale.set(1, 1, 0.3); for (const s of [-1, 1]) { M(sph(0.1, 8, 6), solid("#ffffff"), { x: 1.4, y: 0.15, z: s * 0.75, parent: w }); M(sph(0.06, 6, 5), solid("#1b1b1f"), { x: 1.48, y: 0.15, z: s * 0.8, parent: w }); } const sp = []; for (let k = 0; k < 4; k++) sp.push(M(sph(0.12, 8, 6), clear("#bfe6ff", 0.7), { x: 0.6, y: 1.1, parent: w, shadow: false })); g.userData.anim = (t) => sp.forEach((s, k) => { const p = (t * 0.6 + k / 4) % 1; s.position.set(0.6 + (k - 1.5) * 0.15 * p * 3, 1.1 + p * 1.0, 0); }); fin(g, { h: 3.4, w: 5.0, d: 2.4, big: true, detailH: 2.8 }); },
  squid(g) { const s = new THREE.Group(); s.position.set(0, 0, -0.6); s.scale.setScalar(1.6); g.add(s); const m = solid("#c94f7c", { roughness: 0.6 }); const h = M(sph(0.35, 16, 12), m, { y: 1.05, parent: s }); h.scale.set(1, 1.5, 1); for (const sd of [-1, 1]) { M(sph(0.09, 10, 8), solid("#ffffff"), { x: sd * 0.15, y: 0.85, z: 0.28, parent: s }); M(sph(0.05, 8, 6), solid("#1b1b1f"), { x: sd * 0.15, y: 0.85, z: 0.35, parent: s }); } const arms = []; for (let k = 0; k < 6; k++) { const a = new THREE.Group(); const ang = (k / 6) * TAU; a.position.set(Math.cos(ang) * 0.2, 0.65, Math.sin(ang) * 0.2); s.add(a); for (let j = 0; j < 9; j++) M(sph(0.085 - j * 0.007, 8, 6), m, { x: Math.cos(ang) * j * 0.06, y: -j * 0.075, z: Math.sin(ang) * j * 0.06, parent: a }); arms.push(a); } g.userData.anim = (t) => arms.forEach((a, k) => { a.rotation.z = 0.2 * Math.sin(t * 2 + k); }); fin(g, { h: 2.6, w: 1.6, d: 1.2, detailH: 2.0 }); },
  spider(g) { const s = new THREE.Group(); s.position.set(0, 0, -0.4); s.scale.setScalar(1.4); g.add(s); const m = solid("#2b2530"); M(sph(0.18, 12, 10), m, { y: 0.25, parent: s }); M(sph(0.11, 10, 8), m, { x: 0.22, y: 0.22, parent: s }); for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { bx(0.3, 0.025, 0.025, m, { x: -0.1 + k * 0.08, y: 0.25, z: sd * 0.2, ry: sd * (0.6 - k * 0.3), rz: 0.4, parent: s }); M(sph(0.025, 6, 5), glow("#ff3b3b", 1.5), { x: 0.3, y: 0.26, z: sd * 0.04, parent: s }); } fin(g, { h: 0.7, w: 1.0, d: 0.8, detailH: 0.7 }); },
  bee(g) { const b = new THREE.Group(); b.position.set(0, 1.2, -0.4); b.scale.setScalar(2.2); g.add(b); const body = M(sph(0.12, 12, 10), solid("#ffd32a"), { parent: b }); body.scale.set(1.4, 1, 1); for (const x of [-0.05, 0.06]) bx(0.04, 0.25, 0.25, solid("#1b1b1f"), { x, parent: b }); for (const s of [-1, 1]) M(sph(0.08, 8, 6), clear("#e6f7ff", 0.6), { y: 0.12, z: s * 0.08, parent: b, shadow: false }).scale.set(1, 0.3, 1.5); g.userData.anim = (t) => { b.position.y = 1.2 + 0.1 * Math.sin(t * 4); }; fin(g, { h: 1.6, w: 0.8, d: 0.6, detailH: 0.8, extra: { detail: { at: V(0, 0.8, -0.4), h: 0.9 } } }); },
  turtle(g) { const s = new THREE.Group(); s.position.set(0, 0, -0.4); s.scale.setScalar(1.6); g.add(s); M(hemi(0.25), solid("#4e7d2a"), { y: 0.08, parent: s }).scale.set(1.2, 0.8, 1); M(sph(0.08, 10, 8), solid("#9ccc65"), { x: 0.32, y: 0.12, parent: s }); for (const [x, z] of [[0.18, 0.18], [0.18, -0.18], [-0.18, 0.18], [-0.18, -0.18]]) bx(0.08, 0.1, 0.08, solid("#9ccc65"), { x, y: 0.05, z, parent: s }); fin(g, { h: 0.6, w: 0.9, d: 0.8, detailH: 0.6 }); },
};

for (const name of Object.keys(ANIMALS)) {
  if (THING_BUILD[name]) continue;
  if (SPECIES[name]) THING_BUILD[name] = (g) => quadruped(g, SPECIES[name]);
  else if (["pigeon", "duck", "chicken"].includes(name)) THING_BUILD[name] = (g) => bird(g, name);
  else if (SIMPLE[name]) THING_BUILD[name] = SIMPLE[name];
}
// creatures as objects: the monster looks, smaller (a line that names a dragon that is not the story's monster)
for (const [kind] of Object.entries(CREATURE_OBJECTS)) {
  THING_BUILD[`${kind}_creature`] = (g) => {
    const variant = { dragon: "dragon", goblin: "goblin", yeti: "yeti", troll: "troll", ghost: "ghost", giant: "giant", scarecrow: "scarecrow", robot: "boxy", alien: "goblin", mannequin: "mannequin", unicorn: "beast" }[kind] ?? null;
    const m = makeMonster({ type: "furry", variant, species: kind === "unicorn" ? "horse" : kind, name: kind, glow: "#ffd84a" });
    const h = m.userData.height || 2.5, k = Math.min(1, 2.2 / h);
    m.scale.setScalar(k); m.position.z = -0.5; g.add(m);
    g.userData.creature = m;
    g.userData.anim = (t) => animateMonster(m, "lurk", t);
    fin(g, { h: h * k, w: 1.6, d: 1.2, detailH: Math.min(2, h * k) });
  };
}

/** sanity: every catalog name has a builder (checked by dev/coverage.test.mjs through objects.js) */
export const THING_NAMES = Object.keys(THING_BUILD);
void THINGS; void hashSeed;
