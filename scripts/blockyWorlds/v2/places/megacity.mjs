// IN THIS TOWN v2, OVERNIGHT BUILD 2: TOWN 4, THE NIGHT MEGACITY (our own design). Dense tall towers with window grids
// on both sides of a wide avenue (x), taxis + traffic, a plaza with a fountain and an empty middle for a big thing, a
// giant scoreboard + billboards (replaceable text and numbers), a parking lot, an apartment block with one lit room
// seen from outside, rooftops with water towers, a long lit bridge over water, a clock tower, an alley, a subway
// entrance, a manhole. The same data by day. Units as every town (a kid 3.04 tall).
import { P, box, cyl, sph, txt, lit } from "./prefabs.mjs";
import "./pieces.mjs";

const pave = 0.2;
const hsh = (i) => { let h = (i * 2654435761) >>> 0; h = (h ^ (h >>> 15)) >>> 0; return (h % 1000) / 1000; };
Object.assign(P, {
  // a yellow taxi: the car with a lit roof sign
  taxi({ move = null } = {}) {
    return [...P.car({ c: "#F2C200", move }), box([0.4, 0, 3.05], [1.2, 0.6, 0.4], "#FFF4C0", { e: "#FFE070", es: 2.5, solid: false, move }), box([0, 1.66, 1.2], [5.0, 0.04, 0.35], "#1A1A1A", { solid: false, move })];
  },
  // the giant scoreboard on a tower face: a title and a number (both replaceable)
  scoreboard({ w = 22, h = 11, z = 20, title = "NIGHT 1", num = "0", c = "#0E1016" } = {}) {
    return [box([0, 0.3, z], [w + 1.2, 0.6, h + 1.2], c, { solid: false }), box([0, -0.05, z], [w, 0.2, h], "#12151C", { e: "#0A0C12", es: 0.5, solid: false }),
      box([0, -0.12, z + h * 0.28], [w * 0.92, 0.05, h * 0.32], "#1B2A55", { e: "#21408F", es: 1.2, solid: false }),
      txt([0, -0.2, z + h * 0.28], title, h * 0.17, "#FFFFFF", { key: "score_title", e: "#FFFFFF", es: 3 }),
      txt([0, -0.2, z - h * 0.16], num, h * 0.36, "#FF4A3A", { key: "score_num", e: "#FF3A2A", es: 5 })];
  },
  // a flat billboard on a facade (no poles): one bold line, replaceable
  wallboard({ w = 12, h = 6, z = 16, text = "SLEEP WELL", key = "wallboard", c = "#F4D35E" } = {}) {
    return [box([0, 0.15, z], [w + 0.6, 0.3, h + 0.6], "#22252B", { solid: false }), box([0, -0.05, z], [w, 0.12, h], c, { e: c, es: 0.9, glow: "night", solid: false }), txt([0, -0.15, z], text, h * 0.2, "#15171D", { key })];
  },
  // the subway entrance: a railing round stairs going down into the dark, a glowing globe and a sign (our own)
  subway({ text = "SUBWAY" } = {}) {
    return [box([0, 0, 0.03], [3.2, 5.0, 0.06], "#08090C", { solid: false }), ...[[-1.7, 0], [1.7, 0]].map(([x]) => box([x, 0, 0.6], [0.12, 5.0, 1.1], "#2F6B3A", { solid: false })),
      box([0, 2.55, 0.6], [3.5, 0.12, 1.1], "#2F6B3A", { solid: false }), ...[0, 1, 2, 3].map((k) => box([0, -1.6 + k * 1.0, -0.1 - k * 0.25], [3.0, 1.0, 0.2], "#3A3C42", { solid: false })),
      cyl([2.1, -2.4, 1.6], 0.08, 3.2, "#2F6B3A", { v: 8 }), sph([2.1, -2.4, 3.4], 0.4, "#9FE0A8", { e: "#7FE08A", es: 3, glow: "night", solid: false }),
      box([0, -2.6, 2.2], [2.6, 0.12, 0.6], "#2F6B3A", { solid: false }), txt([0, -2.68, 2.2], text, 0.32, "#FFFFFF", { key: "subway" })];
  },
  // a manhole in the road (state manhole = closed / glowing: something lit below)
  manhole() {
    return [cyl([0, 0, 0.03], 0.95, 0.04, "#2A2C31", { v: 24, solid: false }), ...[-0.4, 0, 0.4].map((y) => box([0, y, 0.06], [1.5, 0.08, 0.02], "#3E4148", { solid: false })),
      cyl([0, 0, 0.065], 0.75, 0.02, "#FFE27A", { v: 24, e: "#FFD54A", es: 5, solid: false, only: "manhole=glowing" }), lit([0, 0, 0.6], 220, "#FFD54A", { only: "manhole=glowing" })];
  },
  // the apartment block: a tall block with ONE lit room open to the street (seen from outside, looked out of from inside)
  apartment({ w = 16, d = 12, h = 30, c = "#B8A48C", room = [5, 7, 3.6], rz0 = 9 } = {}) {
    const [rw, rd, rh] = room, o = [];
    o.push(box([-(w / 2 + rw / 2) / 2, d / 2, h / 2], [w / 2 - rw / 2, d, h], c, { wg: [2.4, 3.2] }), box([(w / 2 + rw / 2) / 2, d / 2, h / 2], [w / 2 - rw / 2, d, h], c, { wg: [2.4, 3.2] }));
    o.push(box([0, d / 2, rz0 / 2], [rw, d, rz0], c, { wg: [2.4, 3.2], solid: false }), box([0, d / 2, (h + rz0 + rh) / 2], [rw, d, h - rz0 - rh], c, { wg: [2.4, 3.2] }), box([0, (d + rd) / 2, rz0 + rh / 2], [rw, d - rd, rh], c));
    // the room: warm walls, a floor, a lamp, a bed, a poster, the window frame
    o.push(box([0, rd / 2, rz0 + 0.05], [rw, rd, 0.1], "#8A5A3A", { solid: false, tag: "floor" }), box([0, rd - 0.05, rz0 + rh / 2], [rw, 0.1, rh], "#F2C7A0", { solid: false, tag: "wall" }),
      box([-rw / 2 + 0.05, rd / 2, rz0 + rh / 2], [0.1, rd, rh], "#E8B890", { solid: false, tag: "wall" }), box([rw / 2 - 0.05, rd / 2, rz0 + rh / 2], [0.1, rd, rh], "#E8B890", { solid: false, tag: "wall" }),
      box([0, rd / 2, rz0 + rh - 0.05], [rw, rd, 0.1], "#F6E2CC", { solid: false }), box([1.4, rd - 1.1, rz0 + 0.45], [2.0, 2.0, 0.7], "#5B7FD0", { solid: false }),
      box([-1.6, rd - 0.15, rz0 + 2.2], [1.0, 0.04, 1.3], "#E85A5A", { solid: false }), lit([0, rd / 2, rz0 + rh - 0.4], 420, "#FFC88A", { size: 1.2 }),
      box([0, -0.05, rz0 - 0.1], [rw + 0.4, 0.3, 0.2], "#F2EDE4", { solid: false }), box([0, -0.05, rz0 + rh + 0.1], [rw + 0.4, 0.3, 0.2], "#F2EDE4", { solid: false }));
    return o;
  },
  // a long bridge over water with lit lamps, two pylons and cables
  longbridge({ L = 90, W = 16 } = {}) {
    const o = [box([0, 0, 0.3], [L, W, 0.6], "#5E636E", { solid: false }), box([0, -W / 2 + 0.3, 1.1], [L, 0.3, 1.0], "#9AA3B2", { solid: false }), box([0, W / 2 - 0.3, 1.1], [L, 0.3, 1.0], "#9AA3B2", { solid: false })];
    for (let x = -L / 2 + 6; x < L / 2; x += 14) for (const s of [-1, 1]) o.push(cyl([x, s * (W / 2 - 0.6), 4.2], 0.14, 7, "#3A3F4A", { v: 8 }), sph([x, s * (W / 2 - 0.6), 7.8], 0.45, "#FFF0C8", { e: "#FFE0A0", es: 5, glow: "night", solid: false }), lit([x, s * (W / 2 - 1.2), 7.2], 260, "#FFD8A0", { when: "night" }));
    for (const px of [-L * 0.28, L * 0.28]) { for (const s of [-1, 1]) o.push(box([px, s * (W / 2 - 0.6), 14], [1.6, 1.2, 28], "#7A8294")); o.push(box([px, 0, 27], [1.6, W, 1.6], "#7A8294", { solid: false }));
      for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) for (const dir of [-1, 1]) o.push(box([px + dir * k * 5, s * (W / 2 - 0.6), 27 - k * 5.2], [0.12, 0.12, 8.4], "#C9D2E0", { ry: dir * 44, solid: false, e: "#BFD6FF", es: 0.6, glow: "night" })); }
    return o;
  },
});

// ---- vehicles (step 7): our own shapes
Object.assign(P, {
  truck({ c = "#4C8FD6", move = null } = {}) {
    return [box([1.8, 0, 2.2], [3.0, 3.4, 3.4], c, { move }), box([-2.4, 0, 2.6], [6.6, 3.6, 4.2], "#E8E8E8", { move }), box([3.25, 0, 2.9], [0.1, 3.0, 1.4], "#9CC6E4", { solid: false, move }),
      ...[-4.2, -1.6, 2.2].flatMap((x) => [-1.75, 1.75].map((y) => cyl([x, y, 0.8], 0.8, 0.5, "#26282E", { rx: 90, v: 16, solid: false, move })))];
  },
  police_car({ move = null } = {}) {
    return [...P.car({ c: "#F4F4F4", move }), box([0, 0, 1.2], [7.7, 3.35, 0.5], "#1E2A4A", { solid: false, move }), box([0.4, -0.5, 3.0], [0.8, 0.6, 0.35], "#3A6BFF", { e: "#3A6BFF", es: 8, solid: false, move }), box([0.4, 0.5, 3.0], [0.8, 0.6, 0.35], "#FF3A3A", { e: "#FF3A3A", es: 8, solid: false, move }),
      lit([0.4, -0.5, 3.6], 400, "#3A6BFF", { when: "night" }), lit([0.4, 0.5, 3.6], 400, "#FF3A3A", { when: "night" })];
  },
  ambulance({ move = null } = {}) {
    return [...P.truck({ c: "#FFFFFF", move }), box([-2.4, -1.82, 2.6], [5.0, 0.05, 0.6], "#D63A2F", { solid: false, move }), box([1.8, 0, 4.0], [1.2, 0.8, 0.35], "#FF3A3A", { e: "#FF3A3A", es: 8, solid: false, move })];
  },
  train({ L = 30, c = "#C24A3A" } = {}) {
    const o = [box([0, 0, 2.6], [L, 3.8, 4.6], c), box([0, 0, 5.0], [L - 1, 3.2, 0.3], "#8A8E94", { solid: false })];
    for (let x = -L / 2 + 2.5; x < L / 2 - 1; x += 3.6) o.push(box([x, -1.92, 3.3], [2.4, 0.06, 1.5], "#FFF4D6", { e: "#FFE9B0", es: 2.5, glow: "night", solid: false }));
    o.push(box([L / 2, 0, 2.0], [0.1, 2.4, 1.0], "#FFF6D8", { e: "#FFF2C0", es: 5, solid: false }));
    return o;
  },
  helicopter({ z = 30 } = {}) {
    return [sph([0, 0, z], 2.4, "#2E3440", { sc: [1.6, 1.0, 0.9] }), box([-5, 0, z + 0.4], [6, 0.5, 0.5], "#2E3440", { solid: false }), box([0, 0, z + 2.2], [11, 0.4, 0.08], "#1A1A1A", { solid: false }),
      box([0, 0, z + 2.2], [0.4, 11, 0.08], "#1A1A1A", { solid: false }), sph([1.8, -1.0, z - 0.4], 0.6, "#9CC6E4", { solid: false }),
      cyl([2.2, 0, z - 12], 0.3, 22, "#FFFFFF", { r2: 4.5, e: "#E8F0FF", es: 1.4, alpha: 0.16, solid: false, ry: 8 }), lit([2.2, 0, z - 1.6], 1500, "#F0F4FF", { kind: "SPOT", size: 0.6 })];
  },
  far_crowd({ n = 60, w = 40, d = 30, seed = 3 } = {}) {
    // a cheap far crowd: little capsule people (2 shapes each) for aerials and plazas
    const o = [], cols = ["#E53935", "#3D7BE0", "#F2C14E", "#6A994E", "#C58AF9", "#F28B82", "#4FB3BF", "#FFFFFF"];
    for (let k = 0; k < n; k++) { const x = (hsh(k * 7 + seed) - 0.5) * w, y = (hsh(k * 13 + seed + 1) - 0.5) * d;
      o.push(cyl([x, y, 0.75], 0.32, 1.5, cols[k % 8], { v: 6, solid: false }), sph([x, y, 1.75], 0.3, "#E8C09A", { v: 6, solid: false })); }
    return o;
  },
});

export function megacity() {
  const items = [];
  // the ground: the wide avenue (lanes), the two pavements, the plaza, the parking lot, the water east
  items.push({ prim: { t: "box", at: [0, 0, -0.05], s: [330, 14, 0.1], c: "#2C2F37", rough: 0.6, solid: false } });
  for (let x = -160; x <= 140; x += 8) for (const y of [-3.5, 0, 3.5]) items.push({ prim: { t: "box", at: [x, y, 0.01], s: y === 0 ? [5, 0.25, 0.02] : [3, 0.18, 0.02], c: y === 0 ? "#F2C14E" : "#E8E8E8", solid: false } });
  items.push({ prim: { t: "box", at: [0, 9, 0.1], s: [330, 4, 0.2], c: "#9C9A94", solid: false } }, { prim: { t: "box", at: [0, -9, 0.1], s: [330, 4, 0.2], c: "#9C9A94", solid: false } });
  items.push({ prim: { t: "box", at: [0, 36, 0.1], s: [48, 48, 0.2], c: "#B9B1A2", solid: false } }, { prim: { t: "cyl", at: [8, 30, 0.21], r: 7.2, h: 0.04, c: "#A59B88", v: 48, solid: false } });
  items.push({ prim: { t: "box", at: [52, -26, 0.06], s: [36, 30, 0.12], c: "#33363E", solid: false } });
  for (let x = 37; x <= 67; x += 4.4) items.push({ prim: { t: "box", at: [x, -26, 0.13], s: [0.18, 9, 0.02], c: "#E8E8E8", solid: false } });
  items.push({ prim: { t: "box", at: [200, 0, -0.04], s: [100, 220, 0.1], c: "#16365E", rough: 0.12, metal: 0.2, solid: false } });
  // the towers: north (fronts at y = 12) with a gap for the plaza, south (fronts at y = -12) with gaps for the parking lot + the alley
  const cols = ["#5E6E86", "#7A6A5E", "#4F5E70", "#8A7E70", "#66758A", "#3F4A5C", "#7E8794", "#5A5048"];
  const north = [-150, -133, -116, -99, -82, -60, -43, 32, 49, 66, 83, 100, 117, 134], south = [-150, -133, -116, -99, -84, -56, -12, 5, 22, 82, 99, 116, 134];
  const hN = {}, hS = {};
  north.forEach((x, k) => { const h = 34 + Math.round(hsh(k + 3) * 46); hN[x] = h; items.push({ p: "tower", at: [x, 12, 0], w: 15, d: 15, h, i: k, c: cols[k % 8], band: "#2A2F3A" }); });
  south.forEach((x, k) => { const h = 30 + Math.round(hsh(k + 11) * 44); hS[x] = h; items.push({ p: "tower", at: [x, -12, 0], rz: 180, w: 15, d: 15, h, i: k + 20, c: cols[(k + 3) % 8], band: "#2A2F3A" }); });
  // the plaza: the scoreboard tower at its back, a fountain, benches, trees; the clock tower at its corner
  items.push({ prim: { t: "box", at: [0, 74, 40], s: [44, 20, 80], c: "#3A4252", wg: [2.4, 3.6] } });
  items.push({ p: "scoreboard", at: [0, 63.6, 0], w: 24, h: 12, z: 26, title: "NIGHT 1", num: "0" });
  items.push({ p: "fountain", at: [-12, 42, 0.2] }, { p: "bench", at: [17, 44, 0.2], rz: 180 }, { p: "bench", at: [-19, 24, 0.2], rz: 90 });
  for (const [x, y] of [[-20, 15], [20, 15], [-20, 52], [20, 52]]) items.push({ prim: { t: "cyl", at: [x, y, 0.6], r: 1.5, h: 1.2, c: "#8E877A", v: 16 } }, { p: "tree", at: [x, y, 1.0], h: 7, r: 2.4 });
  items.push({ p: "clocktower", at: [-20, 60, 0.2], w: 7, h: 36, c: "#9C8E78", roof: "#3E4A5C" });
  // billboards on facades + the apartment block with its lit room + water towers on roofs
  items.push({ p: "wallboard", at: [-82, 11.6, 0], w: 12, h: 6, z: 18, text: "SLEEP WELL", key: "board1", c: "#F4D35E" });
  items.push({ p: "wallboard", at: [49, 11.6, 0], w: 12, h: 6, z: 22, text: "OPEN ALL NIGHT", key: "board2", c: "#7FD3F0" });
  items.push({ p: "wallboard", at: [99, -11.6, 0], rz: 180, w: 12, h: 6, z: 20, text: "STAY INSIDE", key: "board3", c: "#F28B82" });
  items.push({ p: "apartment", at: [-30, -12, 0], rz: 180 });
  for (const x of [-116, -60, 66, 117]) if (hN[x]) items.push({ p: "watertank", at: [x + 3, 12 + 7.5, hN[x] + 1.2] });
  for (const x of [-99, 22, 116]) if (hS[x]) items.push({ p: "watertank", at: [x - 3, -12 - 7.5, hS[x] + 1.2] });
  // the alley (between south towers at x = -84 and -56: a narrow lit gap with bins), the subway entrance, the manhole
  items.push({ prim: { t: "box", at: [-70, -24, 0.05], s: [10, 26, 0.1], c: "#3A3530", solid: false } }, { p: "bin", at: [-73.5, -16, pave] }, { p: "bin", at: [-66.5, -19, pave] }, { prim: { t: "light", at: [-70, -20, 6], w: 300, c: "#FFB070", when: "night" } });
  items.push({ p: "subway", at: [-108, 9.0, pave], rz: 90 });
  items.push({ p: "manhole", at: [-24, 2.0, 0] });
  // lamps on both pavements; trees on the south pavement; a hydrant, bins
  for (let x = -150; x <= 140; x += 22) { items.push({ p: "lamp", at: [x, 7.4, pave] }); items.push({ p: "lamp", at: [x + 11, -7.4, pave], rz: 180 }); }
  // the long bridge east over the water
  items.push({ p: "longbridge", at: [196, 0, 0], L: 92, W: 16 });
  // cars: taxis + traffic driving both ways, parked cars in the lot
  items.push({ p: "taxi", at: [-20, -1.8, 0], move: [14, 0, 0] }, { p: "taxi", at: [10, 1.8, 0], rz: 180, move: [-14, 0, 0] }, { p: "taxi", at: [-90, -5.2, 0], move: [12, 0, 0] });
  items.push({ p: "car", at: [60, -5.2, 0], c: "#3D7BE0", move: [12, 0, 0] }, { p: "car", at: [-70, 5.2, 0], rz: 180, c: "#E53935", move: [-12, 0, 0] }, { p: "car", at: [100, 1.8, 0], rz: 180, c: "#F2F2F2", move: [-12, 0, 0] });
  for (const [x, y, c] of [[39, -21, "#7FB86A"], [47.8, -21, "#B06AC8"], [56.6, -31, "#F2C200"], [65.4, -21, "#3D7BE0"], [43.4, -31, "#E8E8E8"]]) items.push({ p: "car", at: [x, y, 0.12], rz: 90, c });
  // step 7: emergency vehicles on the avenue, a bus, the helicopter with its searchlight, far crowds for the aerials
  items.push({ p: "police_car", at: [-62, -4.4, 0], rz: 180 }, { p: "ambulance", at: [-112, 4.6, 0] }, { p: "truck", at: [118, -4.6, 0], rz: 180, c: "#6A994E" }, { p: "bus", at: [86, 4.4, 0] });
  items.push({ p: "helicopter", at: [14, 40, 0], z: 46 }, { p: "far_crowd", at: [0, 47, 0.2], n: 70, w: 36, d: 11 }, { p: "far_crowd", at: [-60, 9.4, 0.2], n: 30, w: 70, d: 2.4, seed: 9 }, { p: "far_crowd", at: [60, -9.4, 0.2], n: 30, w: 70, d: 2.4, seed: 21 });
  const T = {
    id: "megacity", name: "The Night Megacity", kind: "town", sky: "city", ground: { c: "#3A3D45" },
    look: "a dense night city: tall towers full of lit windows on both sides of a wide avenue with taxis, a fountain plaza under a giant scoreboard, billboards, a parking lot, an apartment with one lit room, rooftops with water towers, a long lit bridge over water, a clock tower, an alley, a subway entrance, a manhole",
    items,
    big: { at: [8, 30, pave], r: 6.5, note: "the plaza's middle, under the giant scoreboard" },
    states: { manhole: "closed" },
    spots: {
      plaza_front: { at: [0, 15.5, pave], tag: "plaza" }, two_a: { at: [-1.6, 17.2, pave], tag: "plaza" }, two_b: { at: [1.6, 17.2, pave], tag: "plaza" },
      big_front: { at: [6, 20.5, pave], tag: "plaza, before the big thing" }, fountain_side: { at: [-4, 40, pave], tag: "plaza, by the fountain" },
      avenue_mid: { at: [-40, 0.6, 0], tag: "the avenue (the street)" }, pave_n: { at: [-46, 9.2, pave], tag: "north pavement" },
      bridge_mid: { at: [190, 0, 0.6], tag: "on the long bridge" }, park_lot: { at: [52, -16.5, 0.12], tag: "the parking lot" },
      in_room: { at: [-30, -14.5, 9.1], tag: "inside the lit room of the apartment" },
      alley_mouth: { at: [-70, -14.5, pave], tag: "at the alley" }, subway_top: { at: [-104, 8.2, pave], tag: "by the subway entrance" },
    },
    creature_spots: { cr_plaza_back: { at: [4, 54, pave], far: true }, cr_avenue_far: { at: [-130, 0, 0], far: true }, cr_bridge: { at: [222, 0, 0.6], far: true } },
    background: {
      bg_n1: { at: [-30, 9.4, pave], loop: "walk" }, bg_n2: { at: [-60, 9.6, pave], loop: "phone" }, bg_n3: { at: [40, 9.4, pave], loop: "talk" }, bg_n4: { at: [70, 9.6, pave], loop: "walk" },
      bg_s1: { at: [-40, -9.4, pave], loop: "walk" }, bg_s2: { at: [10, -9.6, pave], loop: "talk" }, bg_s3: { at: [80, -9.4, pave], loop: "carry" }, bg_s4: { at: [-95, -9.4, pave], loop: "phone" },
      bg_p1: { at: [-8, 26, pave], loop: "talk" }, bg_p2: { at: [16, 36, pave], loop: "point" }, bg_p3: { at: [-2, 47, pave], loop: "walk" }, bg_p4: { at: [12, 50, pave], loop: "phone" }, bg_p5: { at: [-16, 32, pave], loop: "stand" }, bg_p6: { at: [18, 22, pave], loop: "walk" },
      bg_b1: { at: [176, -5.5, 0.6], loop: "walk" }, bg_b2: { at: [204, 5.0, 0.6], loop: "walk" }, bg_b3: { at: [214, -4.5, 0.6], loop: "talk" }, bg_b4: { at: [182, 5.5, 0.6], loop: "phone" }, bg_b5: { at: [198, -5.8, 0.6], loop: "stand" },
      bg_l1: { at: [45, -24, 0.12], loop: "walk" }, bg_p7: { at: [-6, 34, pave], loop: "walk" }, bg_p8: { at: [6, 40, pave], loop: "talk" }, bg_p9: { at: [-10, 22, pave], loop: "phone" }, bg_b6: { at: [208, -1.5, 0.6], loop: "walk" }, bg_b7: { at: [188, 3.0, 0.6], loop: "talk" }, bg_a1: { at: [-118, 9.4, pave], loop: "walk" }, bg_a2: { at: [-140, -9.4, pave], loop: "talk" },
    },
    cameras: {
      aerial_avenue: { loc: [-175, 0, 58], tgt: [-50, 0, 4], lens: 20, shot: "top", people: [], aerial: true },
      town_wide: { loc: [0, -82, 115], tgt: [0, 24, 0], lens: 20, shot: "top", people: [], aerial: true },
      low_up: { loc: [-36, -3, 0.8], tgt: [-14, 8, 22], lens: 14, shot: "low", people: [], fixed: true },
      roof_down: { loc: [-60, 17, hN[-60] + 3.2], tgt: [2, 30, 0], lens: 20, shot: "wide", people: [], fixed: true },
      window_out: { loc: [-30.4, -18.6, 11.0], tgt: [-30, 12, 10.2], lens: 20, shot: "medium", people: ["in_room"], fixed: true, eye_at: [-30, -6.5, 10.9] },     // a giant's eye can fill the window
      giant_eye: { loc: [-60, -6, 40], tgt: [-86, 0.6, 40], lens: 32, shot: "close", people: [], creature: "cr_reveal", reveal: "eye", monster: true, fixed: true },     // level with a giant's eyes (a rooftop)
      into_window: { loc: [-30.5, -5, 11.3], tgt: [-30, -14.5, 10.6], lens: 28, shot: "medium", people: ["in_room"], fixed: true },
      chase: { loc: [-48, -0.8, 3.6], tgt: [-40, 0.6, 2.4], lens: 26, shot: "medium", people: ["avenue_mid"] },
      tilt_danger: { loc: [-33.5, -4.5, 2.4], tgt: [-40, 0.6, 2.8], lens: 20, shot: "medium", people: ["avenue_mid"], roll: 14 },
      plaza_wide: { loc: [0, -6, 7], tgt: [0, 30, 1], lens: 20, shot: "wide", people: ["plaza_front"] },
      hero_med: { loc: [1, 7.5, 3.4], tgt: [0, 15.5, 2.6], lens: 30, shot: "medium", people: ["plaza_front"] },
      two_shot: { loc: [0, 10, 3.2], tgt: [0, 17.2, 2.4], lens: 26, shot: "two", people: ["two_a", "two_b"] },
      big_low: { loc: [4, 15, 1.1], tgt: [8, 30, 10], lens: 18, shot: "low", people: [], fixed: true },
      creature_cam: { loc: [-2, 1.5, 4.4], tgt: [3, 54, 0.5], lens: 20, shot: "medium", people: ["plaza_front"], creature: "cr_plaza_back", fixed: true },
      bridge_wide: { loc: [160, -5.5, 7], tgt: [196, 0, 3], lens: 22, shot: "wide", people: ["bridge_mid"] },
      parking_med: { loc: [50, -8.6, 3.2], tgt: [52, -16.5, 2.4], lens: 28, shot: "medium", people: ["park_lot"] },
    },
    times: ["night", "dusk", "day", "golden", "storm", "morning"],
  };
  return T;
}
