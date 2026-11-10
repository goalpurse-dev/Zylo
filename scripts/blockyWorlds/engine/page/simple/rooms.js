// Blocky Worlds SIMPLE LOOK interiors + the woods (production): the same box language as the street (solid colours,
// matte big surfaces, plastic props, no photo textures). One room each, the camera on +z looking at -z.
//   bedroom: pastel walls, a wood floor, a big window in the back wall (the night outside: deep blue, the "far" spot is
//            out there), a bed with a blanket + pillow, a nightstand lamp (glows at night), a desk + chair, a shelf of
//            books, a rug, a closet, the door
//   school:  a classroom: a green board (blank: no words), desks in rows with chairs, windows on the left wall, a
//            teacher's desk, a clock, cubby shelves
//   woods:   a park clearing: grass, a dirt path, cloud trees all round, bushes, rocks, a log, a lamp by the path
import * as THREE from "three";
import { mat, box, rbox, ball, cyl, seeded } from "./common.js";
import { makeSky, cloudTree, cubeBush, roundBush, lamp, finishPlace, bench } from "./town.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function kitOf(root) {
  const K = { root, glow: [], lamps: [], blockers: [], windows: [] };
  K.glass = (day = "#9ad8ff") => { const m = new THREE.MeshStandardMaterial({ color: day, roughness: 0.35, emissive: "#9ad8ff", emissiveIntensity: 0.55 }); m.userData.night = { emissive: "#24408a", ei: 0.9 }; K.glow.push(m); return m; };
  return K;
}
function wallBlock(K, parent, size, pos, color) { const b = box(parent, size, pos, mat(color, { rough: 0.9 })); b.userData.camBlock = true; K.blockers.push(b); return b; }

export function buildBedroom({ tl = null } = {}) {
  const root = new THREE.Group(); root.name = "set:simple-bedroom";
  const K = kitOf(root);
  const sky = makeSky(root);
  const R = seeded(Number(tl?.world?.seed ?? 3) || 3);
  const wall = R.pick(["#a8d8ff", "#ffd1e0", "#c8f2b0", "#ffe39a", "#d8c8ff"]);
  const X0 = -3.4, X1 = 3.4, ZB = -3.2, ZF = 5.4, HT = 2.9;
  box(root, [X1 - X0, 0.1, ZF - ZB], [0, -0.05, (ZB + ZF) / 2], mat("#c98a4f", { rough: 0.8 }), { cast: false }); // floor
  for (let x = X0 + 0.4; x < X1; x += 0.8) box(root, [0.02, 0.005, ZF - ZB], [x, 0.003, (ZB + ZF) / 2], mat("#b0753f", { rough: 0.8 }), { cast: false });
  box(root, [X1 - X0, 0.1, ZF - ZB], [0, HT + 0.05, (ZB + ZF) / 2], mat("#fbfbf7", { rough: 0.9 }), { cast: false }); // ceiling
  // the back wall with a big window (four blocks round the opening), side walls
  const WX0 = -1.5, WX1 = 0.9, WY0 = 0.85, WY1 = 2.35;
  wallBlock(K, root, [WX0 - X0, HT, 0.2], [(X0 + WX0) / 2, HT / 2, ZB], wall);
  wallBlock(K, root, [X1 - WX1, HT, 0.2], [(X1 + WX1) / 2, HT / 2, ZB], wall);
  wallBlock(K, root, [WX1 - WX0, WY0, 0.2], [(WX0 + WX1) / 2, WY0 / 2, ZB], wall);
  wallBlock(K, root, [WX1 - WX0, HT - WY1, 0.2], [(WX0 + WX1) / 2, (WY1 + HT) / 2, ZB], wall);
  for (const s of [X0, X1]) wallBlock(K, root, [0.2, HT, ZF - ZB], [s, HT / 2, (ZB + ZF) / 2], wall);
  const white = mat("#ffffff", { rough: 0.7 });
  box(root, [WX1 - WX0 + 0.2, 0.12, 0.2], [(WX0 + WX1) / 2, WY0 - 0.06, ZB + 0.12], white); box(root, [WX1 - WX0 + 0.2, 0.12, 0.2], [(WX0 + WX1) / 2, WY1 + 0.06, ZB + 0.12], white);
  for (const x of [WX0, (WX0 + WX1) / 2, WX1]) box(root, [0.1, WY1 - WY0, 0.16], [x, (WY0 + WY1) / 2, ZB + 0.08], white);
  box(root, [WX1 - WX0, 0.08, 0.14], [(WX0 + WX1) / 2, (WY0 + WY1) / 2, ZB + 0.08], white);
  // outside the window: a lawn, a fence, cloud trees and the sky (the night outside reads deep blue)
  box(root, [40, 0.1, 30], [0, -0.06, ZB - 15.2], mat("#5ccc45"), { cast: false });
  for (let x = -8; x <= 8; x += 0.32) box(root, [0.12, 0.95, 0.05], [x, 0.47, ZB - 6], mat("#fbfbf7", { rough: 0.75 }));
  for (const y of [0.35, 0.72]) box(root, [16.4, 0.09, 0.06], [0, y, ZB - 6.05], mat("#fbfbf7", { rough: 0.75 }));
  for (const [x, z] of [[-4, -11], [2.5, -13], [6, -10], [-1, -16], [-7, -15]]) cloudTree(root, x, ZB + z, 1.1, x * 7 + z);
  // the bed (against the left wall under the window side), the nightstand + lamp
  const bedC = R.pick(["#ff6b6b", "#4b8bff", "#ffb02e", "#2fa86b", "#b06cff"]);
  const bed = new THREE.Group(); bed.position.set(-2.2, 0, -1.6); root.add(bed);
  box(bed, [1.4, 0.45, 2.2], [0, 0.225, 0], mat("#b0753f", { rough: 0.75 }));
  box(bed, [1.42, 1.1, 0.16], [0, 0.55, -1.12], mat("#9a6331", { rough: 0.75 }));
  rbox(bed, [1.36, 0.22, 2.08], [0, 0.56, 0.02], mat("#fbfbf7", { rough: 0.8 }), 0.06);
  rbox(bed, [1.42, 0.16, 1.4], [0, 0.72, 0.36], mat(bedC, { rough: 0.75 }), 0.06);
  rbox(bed, [0.95, 0.2, 0.45], [0, 0.78, -0.78], mat("#ffffff", { rough: 0.8 }), 0.08);
  const ns = new THREE.Group(); ns.position.set(-1.05, 0, -2.6); root.add(ns);
  box(ns, [0.6, 0.6, 0.5], [0, 0.3, 0], mat("#ffffff", { rough: 0.7 }));
  cyl(ns, 0.08, 0.12, 0.35, [0, 0.78, 0], mat("#3a3f4a", { rough: 0.5 }));
  const shade = new THREE.MeshStandardMaterial({ color: "#ffe9b0", roughness: 0.6 }); shade.userData.night = { emissive: "#ffcf73", ei: 2.2 }; K.glow.push(shade);
  cyl(ns, 0.16, 0.26, 0.3, [0, 1.08, 0], shade);
  K.lamps.push(V(-1.05, 1.2, -2.55));
  // desk + chair (right), shelf with books, rug, closet, door
  box(root, [1.5, 0.08, 0.7], [2.3, 0.76, -2.6], mat("#ffffff", { rough: 0.7 })); for (const [x, z] of [[1.62, -2.3], [2.98, -2.3], [1.62, -2.9], [2.98, -2.9]]) box(root, [0.08, 0.76, 0.08], [x, 0.38, z], mat("#ffffff", { rough: 0.7 }));
  box(root, [0.55, 0.08, 0.55], [2.3, 0.48, -1.9], mat("#2f78d8", { rough: 0.6 })); box(root, [0.55, 0.6, 0.08], [2.3, 0.8, -1.65], mat("#2f78d8", { rough: 0.6 })); for (const [x, z] of [[2.05, -2.15], [2.55, -2.15], [2.05, -1.65], [2.55, -1.65]]) box(root, [0.06, 0.48, 0.06], [x, 0.24, z], mat("#3a3f4a"));
  box(root, [1.6, 0.06, 0.32], [2.3, 1.75, ZB + 0.25], mat("#ffffff", { rough: 0.7 }));
  for (let i = 0; i < 9; i++) box(root, [0.1, 0.32 + (i % 3) * 0.05, 0.24], [1.66 + i * 0.15, 1.95 + (i % 3) * 0.025, ZB + 0.25], mat(["#e23b3b", "#2f78d8", "#ffd23a", "#2fa86b", "#b06cff"][i % 5], { rough: 0.6 }));
  cyl(root, 1.3, 1.3, 0.02, [0.2, 0.012, 0.6], mat(R.pick(["#ffd23a", "#ff9fb8", "#8fd0ff"]), { rough: 0.9 }), { seg: 32, cast: false });
  box(root, [1.2, 2.3, 0.6], [X1 - 0.35, 1.15, 1.6], mat("#ffffff", { rough: 0.7 }));
  box(root, [0.04, 2.1, 0.02], [X1 - 0.35, 1.15, 1.91], mat("#d8d8d8"));
  box(root, [0.06, 2.2, 1.0], [X0 + 0.12, 1.1, 2.6], mat("#c47a3d", { rough: 0.7 }));
  // the ceiling light
  const bulb = new THREE.MeshStandardMaterial({ color: "#fff4c8", roughness: 0.5 }); bulb.userData.night = { emissive: "#fff0c0", ei: 1.4 }; K.glow.push(bulb);
  cyl(root, 0.35, 0.35, 0.08, [0, HT - 0.05, 0.8], bulb, { seg: 20 });
  const S = {
    root, indoor: true, name: "bedroom", simple: true, sky, kit: K, windowY: 1.55, windowAt: V(-0.3, 1.55, ZB),
    spots: { center: V(0.1, 0, 0.4), left: V(-0.95, 0, 0.6), right: V(1.15, 0, 0.6), back: V(0.4, 0, -1.4), far: V(-0.3, 0, ZB - 4.5), door: V(X0 + 0.6, 0, 2.6), bed: V(-2.2, 0.66, -1.4), closet: V(X1 - 0.9, 0, 1.6) },
    depthDir: V(0, 0, -1), camDir: V(0, 0, 1),
    bounds: [new THREE.Box3(V(X0 + 0.3, 0.3, ZB + 0.5), V(X1 - 0.3, HT - 0.2, ZF - 0.2))],
    blockers: K.blockers, shadow: { half: 12 }, framing: { wide: 0.9 },
  };
  return finishPlace(S, K);
}

export function buildSchool({ tl = null } = {}) {
  const root = new THREE.Group(); root.name = "set:simple-school";
  const K = kitOf(root);
  const sky = makeSky(root);
  const X0 = -5, X1 = 5, ZB = -4.5, ZF = 6, HT = 3.2, wall = "#fff1c8";
  box(root, [X1 - X0, 0.1, ZF - ZB], [0, -0.05, (ZB + ZF) / 2], mat("#d9dce0", { rough: 0.8 }), { cast: false });
  for (let x = X0 + 0.5; x < X1; x += 1) for (let z = ZB + 0.5; z < ZF; z += 1) if (((x + z) | 0) % 2 === 0) box(root, [0.98, 0.006, 0.98], [x, 0.004, z], mat("#c4c8ce", { rough: 0.8 }), { cast: false });
  box(root, [X1 - X0, 0.1, ZF - ZB], [0, HT + 0.05, (ZB + ZF) / 2], mat("#fbfbf7"), { cast: false });
  wallBlock(K, root, [X1 - X0, HT, 0.2], [0, HT / 2, ZB], wall);
  wallBlock(K, root, [0.2, HT, ZF - ZB], [X1, HT / 2, (ZB + ZF) / 2], wall);
  // the left wall: windows between pillars (blue sky / night blue)
  for (let z = ZB; z < ZF; z += 2.5) { wallBlock(K, root, [0.2, HT, 0.6], [X0, HT / 2, z + 0.3], wall); box(root, [0.12, 1.5, 1.9], [X0, 1.75, z + 1.55], K.glass()); }
  box(root, [0.2, 1.0, ZF - ZB], [X0, 0.5, (ZB + ZF) / 2], mat(wall)); box(root, [0.2, 0.7, ZF - ZB], [X0, HT - 0.35, (ZB + ZF) / 2], mat(wall));
  box(root, [0.25, 0.1, ZF - ZB], [X0 + 0.15, 1.0, (ZB + ZF) / 2], mat("#ffffff", { rough: 0.7 }));
  // the green board (blank), its frame and chalk ledge, the teacher's desk, a clock
  box(root, [5.2, 1.6, 0.08], [0, 1.75, ZB + 0.14], mat("#2f6b4a", { rough: 0.9 }));
  box(root, [5.4, 1.8, 0.05], [0, 1.75, ZB + 0.11], mat("#b0753f", { rough: 0.8 }));
  box(root, [5.2, 0.06, 0.16], [0, 0.93, ZB + 0.2], mat("#b0753f", { rough: 0.8 }));
  box(root, [1.8, 0.8, 0.8], [2.4, 0.4, ZB + 1.4], mat("#c47a3d", { rough: 0.7 }));
  cyl(root, 0.32, 0.32, 0.06, [3.6, 2.75, ZB + 0.14], mat("#ffffff", { rough: 0.6 }), { seg: 24 }).rotation.x = Math.PI / 2;
  // desks in rows with chairs
  const DC = ["#2f78d8", "#ffb02e", "#2fa86b", "#e23b3b"];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = -3.3 + c * 2.0, z = -1.4 + r * 1.9;
    if (Math.abs(x) < 1.2 && r === 0) continue; // the aisle where people stand
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    box(g, [1.1, 0.06, 0.6], [0, 0.72, 0], mat("#f1d6a8", { rough: 0.7 })); box(g, [1.0, 0.68, 0.06], [0, 0.36, -0.27], mat("#9aa3ab", { rough: 0.5 }));
    box(g, [0.5, 0.06, 0.45], [0, 0.44, 0.6], mat(DC[(r + c) % 4], { rough: 0.6 })); box(g, [0.5, 0.5, 0.06], [0, 0.72, 0.84], mat(DC[(r + c) % 4], { rough: 0.6 }));
  }
  for (let i = 0; i < 6; i++) box(root, [0.9, 0.9, 0.5], [X1 - 0.35, 0.45 + Math.floor(i / 3) * 0.95, -1.5 + (i % 3) * 1.0], mat(DC[i % 4], { rough: 0.6 }));
  const panel = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.25 }); panel.userData.night = { emissive: "#fff6dc", ei: 1.4 }; K.glow.push(panel);
  for (const z of [-2, 1, 4]) box(root, [2.2, 0.06, 0.6], [0, HT - 0.04, z], panel, { cast: false });
  const S = {
    root, indoor: true, name: "school", simple: true, sky, kit: K,
    spots: { center: V(0, 0, -2.4), left: V(-1.1, 0, -2.2), right: V(1.1, 0, -2.2), back: V(0.4, 0, -3.4), far: V(X0 - 6, 0, -1), door: V(X1 - 0.8, 0, 4.5), classroom: V(0, 0, 0.5) },
    depthDir: V(0, 0, -1), camDir: V(0, 0, 1),
    bounds: [new THREE.Box3(V(X0 + 0.4, 0.3, ZB + 0.6), V(X1 - 0.4, HT - 0.2, ZF - 0.2))],
    blockers: K.blockers, shadow: { half: 14 },
  };
  return finishPlace(S, K);
}

export function buildWoods({ tl = null } = {}) {
  const root = new THREE.Group(); root.name = "set:simple-woods";
  const K = { root, glow: [], lamps: [], blockers: [], windows: [] };
  const sky = makeSky(root);
  const seed = Number(tl?.world?.seed ?? 11) || 11, R = seeded(seed);
  box(root, [600, 0.2, 600], [0, -0.1, 0], mat("#5ccc45"), { cast: false });
  const dirt = mat("#c9a26b", { rough: 0.95 });
  for (let z = 14; z > -60; z -= 2) box(root, [2.4, 0.04, 2.1], [Math.sin(z * 0.08) * 1.6, 0.02, z], dirt, { cast: false });
  const pathX = (z) => Math.sin(z * 0.08) * 1.6;
  for (let i = 0; i < 140; i++) {
    const z = 12 - i * 0.55 - R() * 2, side = i % 2 ? 1 : -1, x = pathX(z) + side * (3.4 + R() * 9 + (i % 7));
    cloudTree(root, x, z, 0.95 + R() * 0.35, seed + i);
  }
  for (let i = 0; i < 26; i++) { const z = 10 - i * 2.4, side = i % 2 ? 1 : -1, x = pathX(z) + side * (2.2 + R() * 1.2); if (R() < 0.4) cubeBush(root, x, z, 0.7 + R() * 0.3, "#3fae3a"); else roundBush(root, x, z, 0.8 + R() * 0.3, seed + i); }
  for (let i = 0; i < 10; i++) { const z = 8 - i * 6, x = pathX(z) + (i % 2 ? 1 : -1) * (2.9 + R()); rbox(root, [0.6 + R() * 0.5, 0.4 + R() * 0.3, 0.6], [x, 0.2, z], mat("#9aa3ab", { rough: 0.9 }), 0.12); }
  const log = cyl(root, 0.3, 0.3, 2.4, [pathX(-3) + 2.6, 0.3, -3], mat("#8a5a34", { rough: 0.85 }), { seg: 10 }); log.rotation.z = Math.PI / 2;
  lamp(K, root, pathX(2) - 2.2, 2, Math.PI / 2);
  bench(root, pathX(-6) - 2.3, 0, -6, Math.PI / 2);
  const S = {
    root, indoor: false, name: "woods", simple: true, sky, kit: K,
    spots: { center: V(pathX(0), 0, 0), left: V(pathX(0) - 1.2, 0, 0.3), right: V(pathX(0) + 1.2, 0, 0.3), back: V(pathX(-2.4) + 0.2, 0, -2.4), far: V(pathX(-18), 0, -18), door: V(pathX(-6) - 1.6, 0, -6) },
    depthDir: V(0, 0, -1), camDir: V(0, 0, 1),
    bounds: [new THREE.Box3(V(-3.4, 0.3, -24), V(3.4, 9, 14))],
    blockers: K.blockers, shadow: { half: 30 },
  };
  return finishPlace(S, K);
}
