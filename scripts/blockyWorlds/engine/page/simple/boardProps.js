// Blocky Worlds BOARD PROPS KIT (2026-11-12): the small things kid stories hold or set down, cheap blocky builds
// (a few boxes / cylinders / balls each, ~0.1-0.6 m), in a hand, on a table or on the ground. The names are the ids of
// supabase/functions/_shared/blockyWorlds/boardKit.js BOARD_KIT.props (a test keeps the two lists equal).
import * as THREE from "three";
import { mat, box, ball, cyl } from "./common.js";

const C = { red: "#e8574a", yellow: "#f2c14e", blue: "#4fa3d9", green: "#6cc070", purple: "#b06fd1", pink: "#f28fb8", white: "#f7f4ec", brown: "#8a5a3a", wood: "#c9935a", grey: "#9aa0a8", dark: "#2b2f3a", gold: "#f5c542", orange: "#f08a2c", paper: "#fbf6e6" };
const glowM = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 });
/** each prop: (g) => builds it in g, its base at y = 0, its front at +z */
export const PROPS = Object.freeze({
  cup: (g) => { cyl(g, 0.06, 0.05, 0.12, [0, 0.06, 0], mat(C.white)); },
  mug: (g) => { cyl(g, 0.07, 0.07, 0.13, [0, 0.065, 0], mat(C.blue)); box(g, [0.02, 0.07, 0.05], [0.08, 0.07, 0], mat(C.blue)); },
  saucer: (g) => { cyl(g, 0.12, 0.09, 0.02, [0, 0.01, 0], mat(C.white)); cyl(g, 0.08, 0.08, 0.01, [0, 0.025, 0], mat("#fffaf0")); },
  bowl: (g) => { cyl(g, 0.14, 0.08, 0.08, [0, 0.04, 0], mat(C.blue)); },
  plate: (g) => { cyl(g, 0.16, 0.14, 0.02, [0, 0.01, 0], mat(C.white)); },
  spoon: (g) => { box(g, [0.02, 0.01, 0.16], [0, 0.005, 0], mat(C.grey)); ball(g, 0.025, [0, 0.01, 0.09], mat(C.grey), { sy: 0.4 }); },
  bottle: (g) => { cyl(g, 0.045, 0.045, 0.18, [0, 0.09, 0], mat(C.green)); cyl(g, 0.02, 0.03, 0.06, [0, 0.21, 0], mat(C.green)); },
  jar: (g) => { cyl(g, 0.06, 0.06, 0.12, [0, 0.06, 0], new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.55 })); cyl(g, 0.062, 0.062, 0.02, [0, 0.13, 0], mat(C.red)); },
  book: (g) => { box(g, [0.18, 0.04, 0.24], [0, 0.02, 0], mat(C.red)); box(g, [0.17, 0.035, 0.23], [0.006, 0.02, 0], mat(C.paper)); },
  letter: (g) => { box(g, [0.18, 0.005, 0.12], [0, 0.003, 0], mat(C.paper)); box(g, [0.04, 0.006, 0.04], [0.06, 0.005, -0.03], mat(C.red)); },
  note: (g) => { box(g, [0.12, 0.004, 0.12], [0, 0.002, 0], mat("#fff27a")); },
  map: (g) => { box(g, [0.3, 0.004, 0.22], [0, 0.002, 0], mat("#f3e2b0")); box(g, [0.1, 0.005, 0.01], [0.02, 0.004, 0.02], mat(C.red)); },
  phone: (g) => { box(g, [0.07, 0.01, 0.14], [0, 0.005, 0], mat(C.dark)); box(g, [0.06, 0.011, 0.12], [0, 0.006, 0], glowM("#7ec8ff")); },
  ball: (g) => { ball(g, 0.11, [0, 0.11, 0], mat(C.red)); },
  kazoo: (g) => { box(g, [0.04, 0.035, 0.16], [0, 0.02, 0], mat(C.purple)); cyl(g, 0.025, 0.025, 0.04, [0, 0.05, 0.02], mat(C.purple)); },
  whistle: (g) => { box(g, [0.035, 0.035, 0.08], [0, 0.02, 0], mat(C.grey)); cyl(g, 0.03, 0.03, 0.035, [0, 0.03, -0.04], mat(C.grey)); },
  bell: (g) => { cyl(g, 0.02, 0.08, 0.1, [0, 0.05, 0], mat(C.gold, { rough: 0.3 })); cyl(g, 0.01, 0.01, 0.06, [0, 0.13, 0], mat(C.brown)); },
  bag: (g) => { box(g, [0.26, 0.3, 0.12], [0, 0.15, 0], mat(C.blue)); box(g, [0.04, 0.12, 0.02], [0, 0.34, 0], mat(C.dark)); },
  backpack: (g) => { box(g, [0.28, 0.36, 0.16], [0, 0.18, 0], mat(C.orange)); box(g, [0.2, 0.12, 0.04], [0, 0.12, 0.09], mat(C.yellow)); },
  box: (g) => { box(g, [0.3, 0.24, 0.3], [0, 0.12, 0], mat(C.wood)); },
  present: (g) => { box(g, [0.24, 0.2, 0.24], [0, 0.1, 0], mat(C.pink)); box(g, [0.25, 0.21, 0.04], [0, 0.1, 0], mat(C.yellow)); box(g, [0.04, 0.21, 0.25], [0, 0.1, 0], mat(C.yellow)); },
  key: (g) => { box(g, [0.02, 0.01, 0.1], [0, 0.005, 0], mat(C.gold, { rough: 0.3 })); cyl(g, 0.025, 0.025, 0.01, [0, 0.005, -0.06], mat(C.gold, { rough: 0.3 })); },
  lantern: (g) => { box(g, [0.12, 0.18, 0.12], [0, 0.09, 0], glowM("#ffd27a")); box(g, [0.14, 0.03, 0.14], [0, 0.19, 0], mat(C.dark)); box(g, [0.14, 0.02, 0.14], [0, 0.0, 0], mat(C.dark)); },
  flashlight: (g) => { cyl(g, 0.025, 0.025, 0.16, [0, 0.025, 0], mat(C.dark)).rotation.x = Math.PI / 2; cyl(g, 0.035, 0.035, 0.02, [0, 0.025, 0.09], glowM("#fff6c0")).rotation.x = Math.PI / 2; },
  umbrella: (g) => { cyl(g, 0.01, 0.01, 0.8, [0, 0.4, 0], mat(C.dark)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.25, 8), mat(C.red)); c.position.y = 0.85; g.add(c); },
  pencil: (g) => { box(g, [0.015, 0.015, 0.18], [0, 0.008, 0], mat(C.yellow)); box(g, [0.016, 0.016, 0.03], [0, 0.008, 0.1], mat(C.pink)); },
  crayon: (g) => { box(g, [0.02, 0.02, 0.1], [0, 0.01, 0], mat(C.blue)); },
  coin: (g) => { cyl(g, 0.04, 0.04, 0.008, [0, 0.004, 0], mat(C.gold, { rough: 0.3 })); },
  candy: (g) => { ball(g, 0.04, [0, 0.04, 0], mat(C.pink), { sx: 1.4 }); box(g, [0.05, 0.03, 0.01], [0.07, 0.04, 0], mat(C.pink)); box(g, [0.05, 0.03, 0.01], [-0.07, 0.04, 0], mat(C.pink)); },
  cake: (g) => { cyl(g, 0.16, 0.16, 0.12, [0, 0.06, 0], mat("#f6d7b0")); cyl(g, 0.165, 0.165, 0.03, [0, 0.12, 0], mat(C.pink)); cyl(g, 0.01, 0.01, 0.06, [0, 0.16, 0], glowM(C.yellow)); },
  cookie: (g) => { cyl(g, 0.06, 0.06, 0.015, [0, 0.008, 0], mat("#c98a4a")); },
  sandwich: (g) => { box(g, [0.14, 0.02, 0.14], [0, 0.01, 0], mat("#f0d6a0")); box(g, [0.14, 0.015, 0.14], [0, 0.028, 0], mat(C.green)); box(g, [0.14, 0.02, 0.14], [0, 0.045, 0], mat("#f0d6a0")); },
  apple: (g) => { ball(g, 0.06, [0, 0.06, 0], mat(C.red)); box(g, [0.01, 0.03, 0.01], [0, 0.12, 0], mat(C.brown)); },
  egg: (g) => { ball(g, 0.04, [0, 0.05, 0], mat(C.white), { sy: 1.3 }); },
  pumpkin: (g) => { ball(g, 0.2, [0, 0.16, 0], mat(C.orange), { sy: 0.8 }); box(g, [0.03, 0.06, 0.03], [0, 0.34, 0], mat(C.green)); },
  teddy: (g) => { ball(g, 0.12, [0, 0.12, 0], mat("#b07a4a")); ball(g, 0.09, [0, 0.3, 0], mat("#b07a4a")); ball(g, 0.035, [-0.07, 0.38, 0], mat("#b07a4a")); ball(g, 0.035, [0.07, 0.38, 0], mat("#b07a4a")); },
  doll: (g) => { box(g, [0.1, 0.16, 0.06], [0, 0.08, 0], mat(C.pink)); ball(g, 0.06, [0, 0.22, 0], mat("#f2c9a0")); },
  toy: (g) => { box(g, [0.16, 0.08, 0.1], [0, 0.07, 0], mat(C.red)); for (const x of [-0.05, 0.05]) cyl(g, 0.03, 0.03, 0.11, [x, 0.03, 0], mat(C.dark)).rotation.x = Math.PI / 2; },
  balloon: (g) => { ball(g, 0.18, [0, 0.9, 0], mat(C.red, { rough: 0.3 }), { sy: 1.2 }); cyl(g, 0.003, 0.003, 0.7, [0, 0.38, 0], mat(C.white)); },
  kite: (g) => { const k = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), mat(C.yellow, { side: "double" })); k.rotation.z = Math.PI / 4; k.position.y = 0.6; g.add(k); },
  bucket: (g) => { cyl(g, 0.14, 0.11, 0.22, [0, 0.11, 0], mat(C.blue)); },
  broom: (g) => { cyl(g, 0.015, 0.015, 1.1, [0, 0.55, 0], mat(C.wood)); box(g, [0.22, 0.18, 0.06], [0, 0.05, 0], mat(C.yellow)); },
  shovel: (g) => { cyl(g, 0.015, 0.015, 0.9, [0, 0.45, 0], mat(C.wood)); box(g, [0.18, 0.22, 0.03], [0, 0.0, 0], mat(C.grey)); },
  stick: (g) => { cyl(g, 0.015, 0.02, 0.6, [0, 0.3, 0], mat(C.brown)); },
  rock: (g) => { ball(g, 0.1, [0, 0.07, 0], mat(C.grey), { sy: 0.7 }); },
  flower: (g) => { cyl(g, 0.008, 0.008, 0.25, [0, 0.12, 0], mat(C.green)); ball(g, 0.04, [0, 0.27, 0], mat(C.pink)); },
  clock: (g) => { cyl(g, 0.12, 0.12, 0.04, [0, 0.12, 0], mat(C.white)).rotation.x = Math.PI / 2; box(g, [0.01, 0.07, 0.01], [0, 0.15, 0.03], mat(C.dark)); },
  camera: (g) => { box(g, [0.14, 0.09, 0.06], [0, 0.045, 0], mat(C.dark)); cyl(g, 0.03, 0.03, 0.04, [0, 0.045, 0.05], mat(C.grey)).rotation.x = Math.PI / 2; },
  wand: (g) => { cyl(g, 0.008, 0.008, 0.3, [0, 0.15, 0], mat(C.dark)); ball(g, 0.03, [0, 0.31, 0], glowM(C.yellow)); },
  crown: (g) => { cyl(g, 0.1, 0.1, 0.08, [0, 0.04, 0], mat(C.gold, { rough: 0.3 })); for (let i = 0; i < 5; i++) box(g, [0.03, 0.05, 0.03], [0.09 * Math.cos(i * 1.256), 0.1, 0.09 * Math.sin(i * 1.256)], mat(C.gold, { rough: 0.3 })); },
  mask: (g) => { box(g, [0.2, 0.12, 0.03], [0, 0.06, 0], mat(C.purple)); },
  trophy: (g) => { cyl(g, 0.08, 0.04, 0.12, [0, 0.16, 0], mat(C.gold, { rough: 0.3 })); box(g, [0.1, 0.06, 0.1], [0, 0.03, 0], mat(C.dark)); },
  drum: (g) => { cyl(g, 0.16, 0.16, 0.16, [0, 0.08, 0], mat(C.red)); cyl(g, 0.165, 0.165, 0.01, [0, 0.165, 0], mat(C.white)); },
  basket: (g) => { cyl(g, 0.16, 0.12, 0.14, [0, 0.07, 0], mat("#c9a36a")); },
});
/** a prop by name (an unknown name: null); its base at y = 0 */
export function makeProp(name) { const f = PROPS[name]; if (!f) return null; const g = new THREE.Group(); g.name = `prop:${name}`; f(g); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
