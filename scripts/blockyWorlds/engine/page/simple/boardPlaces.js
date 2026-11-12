// Blocky Worlds STORYBOARD PLACES + WEATHER + ANIMALS (kit expansion 2026-11-12): the board set's other places beside
// the street of houses, each at its own spot of the board world (far from the street, so a camera sees one place):
//   school  the simple classroom (page/simple/rooms.js buildSchool)        indoor
//   woods   the simple woods path (rooms.js buildWoods)                     outdoor
//   park    grass, a path, trees, benches, a pond, lamps                     outdoor
//   shop    a shop: a counter with a till, shelves of goods, a shop window   indoor
// each: { root, spots (world), indoor, cam(name, ctx) -> { pos, look, fov } }; marks: center left right back far door.
// Weather: rain / snow particles round the camera. Animals: the blocky animal kit (page/kit/animals) at a mark.
import * as THREE from "three";
import { mat, box, ball, cyl, seeded } from "./common.js";
import { cloudTree, roundBush, bench } from "./town.js";
import { buildSchool, buildWoods } from "./rooms.js";
import { makeAnimal, animateAnimal } from "/page/kit/animals/index.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PLACES = Object.freeze(["school", "woods", "park", "shop"]);
const ORIGIN = { school: V(-320, 0, 0), woods: V(320, 0, 0), park: V(0, 0, -260), shop: V(0, 0, 260) };
const INDOOR = { school: true, woods: false, park: false, shop: true };

/** the place's own sky dome off (the board's sky + light serve every place) */
function noSky(root) { const out = []; root.traverse((o) => { if (o.isMesh && o.material?.isShaderMaterial && o.geometry?.parameters?.radius >= 500) out.push(o); }); for (const o of out) o.parent.remove(o); }

function buildPark() {
  const root = new THREE.Group(), R = seeded(11);
  box(root, [60, 0.1, 60], [0, -0.04, 0], mat("#5bb54a"));
  box(root, [3, 0.04, 60], [0, 0.02, 0], mat("#d9c8a0"));
  const pond = cyl(root, 4.5, 4.5, 0.06, [6.5, 0.03, -6], mat("#4fa3d9", { rough: 0.2 })); void pond;
  for (let i = 0; i < 14; i++) cloudTree(root, (R() < 0.5 ? -1 : 1) * (5 + R() * 18), -20 + R() * 34, 0.9 + R() * 0.5, i + 40);
  for (let i = 0; i < 8; i++) roundBush(root, (R() < 0.5 ? -1 : 1) * (2.6 + R() * 6), -14 + R() * 26, 0.6 + R() * 0.4, i + 7);
  bench(root, -2.6, 0, -2, Math.PI / 2); bench(root, 2.6, 0, 3, -Math.PI / 2);
  const lamps = []; for (const z of [-12, 0, 12]) { cyl(root, 0.08, 0.1, 4.2, [-1.9, 2.1, z], mat("#2b2f3a")); box(root, [0.45, 0.25, 0.45], [-1.9, 4.3, z], mat("#fff2c4", { emissive: "#ffd98a", ei: 1.2 })); lamps.push(V(-1.9, 4.1, z)); }
  return { root, spots: { center: V(0, 0, 0), left: V(-1.2, 0, 0.4), right: V(1.2, 0, 0.4), back: V(0.3, 0, -3), far: V(0, 0, -16), door: V(-2.6, 0, 2) }, lamps };
}
function buildShop() {
  const root = new THREE.Group(), R = seeded(5);
  const wall = mat("#f6e6c8"), wood = mat("#8a5a3a");
  box(root, [9, 0.1, 8], [0, -0.05, 0], mat("#c9b18a"));
  box(root, [9, 3.4, 0.2], [0, 1.7, -4], wall); for (const s of [-1, 1]) box(root, [0.2, 3.4, 8], [s * 4.5, 1.7, 0], wall); box(root, [9, 0.1, 8], [0, 3.4, 0], mat("#fbf6ec"));
  // shelves of goods along the back wall, the counter with a till in front
  for (let r = 0; r < 3; r++) { box(root, [7.6, 0.08, 0.5], [0, 0.7 + r * 0.8, -3.65], wood); for (let i = 0; i < 16; i++) box(root, [0.32, 0.4 + R() * 0.2, 0.3], [-3.6 + i * 0.48, 0.95 + r * 0.8, -3.65], mat(["#e8574a", "#f2c14e", "#4fa3d9", "#6cc070", "#b06fd1", "#f28fb8"][(i + r) % 6])); }
  box(root, [3.6, 1.0, 0.8], [-1.2, 0.5, -1.4], wood); box(root, [0.5, 0.35, 0.4], [-2.4, 1.18, -1.4], mat("#3a3f4a")); box(root, [0.45, 0.04, 0.3], [-2.4, 1.38, -1.35], mat("#7ee0a0", { emissive: "#7ee0a0", ei: 0.6 }));
  // the shop window + its sign (the street outside at the front)
  box(root, [3.0, 1.8, 0.05], [2.2, 1.6, 3.95], new THREE.MeshStandardMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.25 }));
  return { root, spots: { center: V(0.2, 0, 0.2), left: V(-1.2, 0, -0.6), right: V(1.4, 0, 0.4), back: V(-1.2, 0, -2.3), far: V(0, 0, -3), door: V(3.4, 0, 2.6) }, lamps: [V(0, 3.2, 0)] };
}

/** a place of the board world: built once, at its own origin; its marks and cameras in world space */
export function buildPlace(name, parent, tl) {
  let P;
  if (name === "school" || name === "woods") { const S = (name === "school" ? buildSchool : buildWoods)({ tl }); noSky(S.root); P = { root: S.root, spots: S.spots, lamps: S.lamps ?? [] }; }
  else if (name === "park") P = buildPark(); else if (name === "shop") P = buildShop();
  else throw new Error(`board: unknown place "${name}"`);
  P.root.position.copy(ORIGIN[name]); parent.add(P.root); P.root.updateMatrixWorld(true);
  const w = (v) => P.root.localToWorld(v.clone());
  const spots = Object.fromEntries(Object.entries(P.spots).map(([k, v]) => [k, w(v)]));
  const light = new THREE.PointLight("#ffe2b0", 0, 16, 1.3); light.position.copy(w(V(0, 3, 1))); parent.add(light);
  return {
    name, indoor: INDOOR[name], spots, light, lamps: (P.lamps ?? []).map(w),
    /** the place's cameras: place_wide (the place + whoever is in it), place_medium (on the first person) */
    cam(cam, { where = {}, people = [], k = 0 } = {}) {
      const c = spots.center, first = people.map((p) => where[p.id]).find(Boolean);
      if (cam === "place_medium" && first) { const f = V(Math.sin(first.yaw), 0, Math.cos(first.yaw)); return { pos: first.head.clone().addScaledVector(f, 3.2 - 0.3 * k).add(V(0.4, 0.1, 0)), look: first.head.clone().add(V(0, -0.35, 0)), fov: 48 }; }
      const back = name === "shop" ? 3.3 : INDOOR[name] ? 5.5 : 9; // the shop's window is at z 3.95: the camera stays inside it
      return { pos: c.clone().add(V(0.6, INDOOR[name] ? 1.9 : 2.6, back - 0.6 * k)), look: c.clone().add(V(0, 1.2, -2)), fov: INDOOR[name] ? 62 : 56 };
    },
  };
}

// ------------------------------------------------------------------------------------------------ weather
/** rain (streaks) or snow (flakes) in a box round the camera, deterministic in t */
export function makeWeather(parent) {
  const N = 1600, geo = new THREE.BoxGeometry(1, 1, 1);
  const rain = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: "#e6f0ff", transparent: true, opacity: 0.6 }), N);
  const snow = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: "#ffffff" }), N);
  rain.frustumCulled = snow.frustumCulled = false; parent.add(rain); parent.add(snow); rain.visible = snow.visible = false;
  const R = seeded(77), seeds = Array.from({ length: N }, () => [R(), R(), R()]), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    update(kind, t, camera, night = false) {
      rain.material.color.set(night ? "#e6f0ff" : "#5d7ea8"); // day rain: darker streaks against the bright sky
      rain.visible = kind === "rain"; snow.visible = kind === "snow";
      const mesh = kind === "rain" ? rain : kind === "snow" ? snow : null; if (!mesh) return;
      const c = camera.position, d = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      for (let i = 0; i < N; i++) {
        const [a, b, e] = seeds[i], speed = kind === "rain" ? 14 : 1.4, h = 12;
        const y = h - (((t * speed + e * h) % h) + h) % h;
        const r = 3 + a * 9, ang = (b - 0.5) * 1.6; // 3-12 m in front of the lens, across the view (a flake at the lens filled the frame)
        p.set(c.x + d.x * r * Math.cos(ang) - d.z * r * Math.sin(ang) + 0 * (a - 0.5) * 12 + (kind === "snow" ? 0.4 * Math.sin(t * 1.3 + i) : 0), c.y - 4 + y, c.z + d.z * r * Math.cos(ang) + d.x * r * Math.sin(ang));
        s.set(kind === "rain" ? 0.02 : 0.08, kind === "rain" ? 0.6 : 0.08, kind === "rain" ? 0.02 : 0.08);
        m.compose(p, q, s); mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------------------------------------ animals
const ANIMALS = new Map();
/** the shot's animals at their marks: { species, where (a world position), action, yaw } -> placed + animated */
export function placeAnimals(parent, list, t) {
  for (const g of ANIMALS.values()) g.visible = false;
  for (const [i, a] of (list ?? []).entries()) {
    const key = `${a.species}:${i}`;
    if (!ANIMALS.has(key)) { const g = makeAnimal({ species: a.species, seed: 3 + i }); parent.add(g); ANIMALS.set(key, g); }
    const g = ANIMALS.get(key); g.visible = true; g.position.copy(a.pos); g.rotation.set(0, a.yaw ?? 0, 0);
    animateAnimal(g, a.action ?? "idle", t);
    if (a.action === "run" || a.action === "walk") g.position.x += (a.action === "run" ? 2.2 : 0.8) * t * Math.sin(a.yaw ?? 0), g.position.z += (a.action === "run" ? 2.2 : 0.8) * t * Math.cos(a.yaw ?? 0);
  }
}
