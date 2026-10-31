// Zyvo Studio worlds (Master Prompt v2, owner 2026-10-31): warm, bright, original sets instead of a dark void. The cast
// stands at the same marks in every world (creator left, Zee right), so every world shares the 8 camera setups in
// timeline.js (SETUPS). buildWorld() dresses the scene and returns its look (exposure, bloom, vignette) + update(t).
import * as THREE from "three";
import { rbox, add } from "./world.js";

const C = (h) => new THREE.Color(h);
const std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: C(c), roughness: r, metalness: m });
const glow = (c, k = 1.4) => new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(k), toneMapped: false });
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sphere = (r) => new THREE.SphereGeometry(r, 24, 18);
const cyl = (a, b, h, n = 24) => new THREE.CylinderGeometry(a, b, h, n);

function gradientBackground(scene, top, bottom) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
function key(scene, color, i, pos, size = 12) {
  const k = new THREE.DirectionalLight(color, i); k.position.set(...pos); k.castShadow = true; k.shadow.mapSize.set(4096, 4096);
  Object.assign(k.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 60 }); k.shadow.bias = -0.0003; k.shadow.normalBias = 0.02; k.shadow.radius = 5;
  scene.add(k, k.target); return k;
}
function floor(scene, color, size = 200, r = 0.9) { const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std(color, r)); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f); return f; }

/** 1. A sunny diorama park: golden light, round trees, a bench, a pond, little houses, drifting clouds. */
function sunny(scene) {
  gradientBackground(scene, "#7fc8ff", "#ffe6b8"); scene.fog = new THREE.Fog(C("#ffe9c4"), 30, 90);
  floor(scene, "#8fce62");
  const path = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), std("#f3dca6")); path.rotation.x = -Math.PI / 2; path.position.set(0.1, 0.01, 0.6); path.receiveShadow = true; scene.add(path);
  scene.add(new THREE.HemisphereLight("#ffffff", "#9ccf6a", 1.5)); key(scene, "#fff0cf", 3.0, [6, 12, 9]);
  const leaf = ["#4fae4a", "#67c04f", "#3f9e57", "#8ccb4a"];
  for (const [x, z, s] of [[-7, -5, 1.5], [-4.2, -8, 1.2], [6.4, -5.5, 1.6], [3.6, -9, 1.1], [-10, -2, 1.3], [10, -2.5, 1.4], [0, -11, 1.5], [-7.5, -11, 1.2], [8, -11, 1.3]]) {
    add(scene, cyl(0.16 * s, 0.24 * s, 1.5 * s), std("#8a5a33"), x, 0.75 * s, z);
    add(scene, sphere(1.05 * s), std(leaf[Math.floor(rnd() * 4)]), x, 2.1 * s, z); add(scene, sphere(0.7 * s), std(leaf[Math.floor(rnd() * 4)]), x + 0.55 * s, 1.75 * s, z + 0.2);
  }
  // little houses on the horizon
  for (const [x, z, c, r] of [[-13, -15, "#f7b267", "#d1495b"], [-6, -18, "#fff1d0", "#3d84a8"], [7, -17, "#f4978e", "#6a4c93"], [14, -14, "#b5e2fa", "#d1495b"]]) {
    add(scene, rbox(3, 2.6, 2.6, 0.08), std(c), x, 1.3, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), std(r)); roof.position.set(x, 3.4, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
  }
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: C("#64c4ed"), roughness: 0.15, metalness: 0.3 })); pond.rotation.x = -Math.PI / 2; pond.scale.set(1.6, 1, 1); pond.position.set(6.8, 0.02, -1); scene.add(pond);
  add(scene, rbox(2.4, 0.14, 0.6, 0.04), std("#c98b4a"), -5.6, 0.62, -1.2); add(scene, rbox(2.4, 0.7, 0.12, 0.04), std("#c98b4a"), -5.6, 1.05, -1.5);
  for (const x of [-6.6, -4.6]) add(scene, rbox(0.14, 0.6, 0.5, 0.03), std("#6b4a2b"), x, 0.3, -1.2);
  const clouds = [];
  for (const [x, y, z, s] of [[-12, 13, -24, 2], [3, 15, -28, 2.6], [15, 12, -24, 1.9], [-3, 11, -22, 1.5]]) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); clouds.push(g);
    const w = new THREE.MeshStandardMaterial({ color: C("#ffffff"), roughness: 1, emissive: C("#ffffff"), emissiveIntensity: 0.35 });
    for (const [a, b, r] of [[0, 0, 1], [1, -0.1, 0.75], [-1, -0.15, 0.7], [0.4, 0.4, 0.7]]) { const m = new THREE.Mesh(sphere(r), w); m.position.set(a, b, 0); g.add(m); }
  }
  return { exposure: 0.95, bloom: 0.12, vig: 0.15, sat: 1.1, update: (t) => clouds.forEach((g, i) => { g.position.x += 0; g.rotation.z = Math.sin(t * 0.2 + i) * 0.02; }) };
}

/** 2. A cozy creator room at night: warm lamp, monitor glow, shelves, a bed, string lights, a window with stars. */
function cozy(scene) {
  scene.background = C("#2a1f3d"); scene.fog = null;
  floor(scene, "#9c6b45", 60, 0.7);
  const wall = std("#5a4a8a", 0.95), wall2 = std("#6a5397", 0.95);
  add(scene, new THREE.BoxGeometry(40, 16, 0.3), wall, 0, 8, -7);
  add(scene, new THREE.BoxGeometry(0.3, 16, 30), wall2, -11, 8, 6); add(scene, new THREE.BoxGeometry(0.3, 16, 30), wall2, 11, 8, 6);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), std("#e07a5f", 1)); rug.rotation.x = -Math.PI / 2; rug.position.set(0.1, 0.01, 0.8); rug.receiveShadow = true; scene.add(rug);
  scene.add(new THREE.HemisphereLight("#ffd9b0", "#3c2a4d", 1.15)); key(scene, "#ffe2bd", 2.1, [4, 10, 10]);
  // the desk with a monitor (a soft generic glow, no brand)
  add(scene, rbox(5, 0.16, 1.5, 0.04), std("#c98f5a"), -6, 1.6, -5.8); for (const x of [-8.2, -3.8]) add(scene, rbox(0.14, 1.6, 1.2, 0.03), std("#7a5233"), x, 0.8, -5.8);
  add(scene, rbox(3, 1.8, 0.1, 0.05), std("#1a1a22", 0.4), -6, 3.1, -6.1);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), glow("#7fd1ff", 1.15)); scr.position.set(-6, 3.1, -6.04); scene.add(scr);
  const mon = new THREE.PointLight("#8fd6ff", 40, 12); mon.position.set(-6, 3.2, -4.8); scene.add(mon);
  // the lamp
  add(scene, cyl(0.05, 0.05, 2.2), std("#d9c9a3", 0.4, 0.5), 7, 2.7, -5.6); add(scene, cyl(0.5, 0.25, 0.1), std("#d9c9a3", 0.4, 0.5), 7, 1.65, -5.6);
  add(scene, cyl(0.45, 0.85, 0.9, 32), glow("#ffd48a", 1.3), 7, 4.1, -5.6);
  const lamp = new THREE.PointLight("#ffc77a", 70, 18); lamp.position.set(7, 4.2, -4.8); scene.add(lamp);
  add(scene, rbox(3.4, 1.65, 1.4, 0.08), std("#a56cc1"), 7, 0.82, -5.8);
  // the window + stars
  add(scene, rbox(4.4, 3.8, 0.14, 0.05), std("#e8d9c5"), 0.1, 8.7, -6.8);
  add(scene, new THREE.PlaneGeometry(4, 3.4), new THREE.MeshBasicMaterial({ color: C("#1c2a5e") }), 0.1, 8.7, -6.7);
  for (let i = 0; i < 40; i++) { const s = new THREE.Mesh(sphere(0.03 + rnd() * 0.03), glow("#fff3c4", 1.6)); s.position.set(0.1 + (rnd() - 0.5) * 3.8, 8.7 + (rnd() - 0.5) * 3.2, -6.65); scene.add(s); }
  // shelves with colorful books
  for (const [x, y] of [[-7, 7.6], [7.5, 7.6]]) {
    add(scene, rbox(4.2, 0.12, 0.6, 0.03), std("#c98f5a"), x, y, -6.6);
    for (let i = 0; i < 8; i++) add(scene, rbox(0.3, 0.8 + rnd() * 0.5, 0.42, 0.02), std(["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b"][i % 5]), x - 1.6 + i * 0.42, y + 0.56, -6.6);
  }
  // string lights
  const bulbs = [];
  for (let i = 0; i < 22; i++) { const x = -10 + i * 0.95; const b = new THREE.Mesh(sphere(0.09), glow("#ffdf9e", 1.8)); b.position.set(x, 12 - Math.sin((i / 21) * Math.PI) * 1.2 - (i % 3) * 0.05, -6.6); scene.add(b); bulbs.push(b); }
  return { exposure: 1.02, bloom: 0.24, vig: 0.25, sat: 1.08, update: (t) => { bulbs.forEach((b, i) => b.material.color.copy(C("#ffdf9e")).multiplyScalar(1.5 + 0.35 * Math.sin(t * 1.4 + i))); } };
}

/** 3. A colorful idea factory: moving conveyor belts, machines with lights, turning gears, pipes. */
function factory(scene) {
  gradientBackground(scene, "#ffd166", "#ffe8b6"); scene.fog = new THREE.Fog(C("#ffe8b6"), 34, 80);
  floor(scene, "#ffefc9", 200, 0.6);
  add(scene, new THREE.BoxGeometry(60, 18, 0.3), std("#2ec4b6", 0.9), 0, 9, -9);
  scene.add(new THREE.HemisphereLight("#ffffff", "#ffd8a8", 1.5)); key(scene, "#fff4dd", 2.7, [5, 13, 9]);
  const stripes = std("#ff6b6b", 0.7);
  for (const x of [-16, -8, 0, 8, 16]) add(scene, rbox(0.6, 18, 0.5, 0.05), stripes, x, 9, -8.7);
  // two belts with boxes riding them
  const boxes = [];
  const belt = (y, z, dir, cols) => {
    add(scene, rbox(30, 0.3, 1.4, 0.05), std("#444a5c", 0.6), 0, y, z);
    for (let x = -14; x <= 14; x += 4) add(scene, rbox(0.2, y - 0.1, 0.9, 0.03), std("#7a8195"), x, (y - 0.1) / 2, z);
    for (let i = 0; i < 8; i++) { const m = add(scene, rbox(0.8, 0.8, 0.8, 0.1), std(cols[i % cols.length], 0.5), 0, y + 0.55, z); boxes.push({ m, i, dir }); }
  };
  belt(1.2, -5.8, 1, ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a06cd5"]); belt(5.4, -7.6, -1, ["#a06cd5", "#ff9f1c", "#4ecdc4"]);
  // machines
  const lamps = [];
  for (const [x, c] of [[-8.5, "#ef476f"], [8.8, "#118ab2"]]) {
    add(scene, rbox(4, 5, 3, 0.2), std(c, 0.5), x, 2.5, -4.6);
    add(scene, rbox(2.4, 1.4, 0.1, 0.05), glow("#fff5c2", 1.15), x, 3.4, -3.05);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(sphere(0.14), glow(["#06d6a0", "#ffd166", "#ff6b6b"][i], 1.4)); l.position.set(x - 0.6 + i * 0.6, 1.8, -3.05); scene.add(l); lamps.push(l); }
    add(scene, cyl(0.3, 0.3, 4), std("#c0c6d4", 0.3, 0.7), x, 7, -4.6);
  }
  // gears
  const gears = [];
  for (const [x, y, r, c] of [[-3.8, 9.4, 1.5, "#ffd166"], [-1.3, 8.2, 1.0, "#ff9f1c"], [4.6, 9.6, 1.6, "#a06cd5"]]) {
    const g = new THREE.Group(); g.position.set(x, y, -8.6); scene.add(g);
    add(g, cyl(r, r, 0.3, 32).rotateX(Math.PI / 2), std(c, 0.45), 0, 0, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const t = add(g, rbox(r * 0.34, r * 0.34, 0.3, 0.03), std(c, 0.45), Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 0); t.rotation.z = a; }
    gears.push({ g, s: 1 / r });
  }
  return { exposure: 0.92, bloom: 0.1, vig: 0.15, sat: 1.1, update: (t) => {
    for (const b of boxes) { const L = 30, p = (((t * 1.1 * b.dir + b.i * (L / 8)) % L) + L) % L; b.m.position.x = p - L / 2; }
    gears.forEach(({ g, s }, i) => { g.rotation.z = t * 0.7 * s * (i === 1 ? -1 : 1); });
    lamps.forEach((l, i) => l.scale.setScalar(0.85 + 0.25 * Math.max(0, Math.sin(t * 3 + i))));
  } };
}

/** 4. The Zyvo studio, brighter: a lit violet floor, soft colored panels and rim lights, no black void. */
function studio(scene) {
  gradientBackground(scene, "#3b2a78", "#6f54c4"); scene.fog = new THREE.Fog(C("#5a43a8"), 34, 90);
  const f = floor(scene, "#8d78e0", 200, 0.42); f.material.metalness = 0.05;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), std("#d7f26a", 0.5)); disc.rotation.x = -Math.PI / 2; disc.position.set(0.1, 0.01, 0.7); disc.receiveShadow = true; scene.add(disc);
  scene.add(new THREE.HemisphereLight("#ffffff", "#9a86e8", 1.6)); key(scene, "#fff8ee", 2.6, [4, 12, 10]);
  for (const [col, i, p] of [["#c5a5ff", 1.5, [-7, 5, -5]], ["#d7f26a", 1.1, [7, 4, -4]]]) { const r = new THREE.DirectionalLight(col, i); r.position.set(...p); scene.add(r); }
  const panels = [];
  [["#ff7ab6", -11], ["#7ad7ff", -6.6], ["#d7f26a", 6.8], ["#ffc75a", 11.2]].forEach(([c, x], i) => {
    add(scene, rbox(3.6, 12, 0.3, 0.2), std("#2d2460", 0.5), x, 6, -9);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 11.4), glow(c, 1.05)); m.position.set(x, 6, -8.8); scene.add(m); panels.push(m);
    void i;
  });
  // the big Z-free backdrop arch and low plinths (the set, not a logo)
  add(scene, new THREE.TorusGeometry(5.4, 0.28, 16, 64, Math.PI), std("#ffffff", 0.3), 0.1, 2.4, -7.6);
  for (const [x, z, h] of [[-5.4, -2.6, 0.8], [5.8, -2.8, 1.1], [-7, 0.2, 0.5], [7.4, 0, 0.6]]) add(scene, cyl(1, 1.1, h, 32), std("#efe9ff", 0.4), x, h / 2, z);
  return { exposure: 0.98, bloom: 0.16, vig: 0.2, sat: 1.08, update: (t) => panels.forEach((m, i) => { m.material.opacity = 1; m.scale.y = 1 + 0.012 * Math.sin(t * 0.6 + i); }) };
}

const WORLDS = { sunny, cozy, factory, studio };
export const WORLD_NAMES = Object.keys(WORLDS);
export function buildWorld(name, scene) {
  const b = WORLDS[name]; if (!b) throw new Error(`no world "${name}"`);
  return b(scene);
}
