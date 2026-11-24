// IN THIS TOWN v2, NIGHT BUILD: THE THREE TOWNS AS DATA (one builder: set_v2.py zv_build_set). Each town: ground,
// prefab items, people spots (a body apart), creature spots (far / silhouette / eyes), background spots with calm
// loops, the BIG SPOT (an empty middle where a story's big thing stands), cameras (aerials included) and light notes.
// Spot: { at: [x, y, z], tag }; camera: { loc, tgt, lens, shot, people, creature?, fixed? }; shot "top" = aerial.

const pave = 0.2;
// ---------------------------------------------------------------------------------------- A. BRIGHT CITY
function brightCity() {
  const items = [];
  // the ground: the main street, two pavements, the plaza; lane marks
  items.push({ prim: { t: "box", at: [0, 0, -0.05], s: [200, 12, 0.1], c: "#3A3D45", rough: 0.8, solid: false } });
  for (let x = -96; x <= 96; x += 8) items.push({ prim: { t: "box", at: [x, 0, 0.01], s: [3.2, 0.3, 0.02], c: "#F2D25A", solid: false } });
  items.push({ prim: { t: "box", at: [0, 8, 0.1], s: [200, 4, 0.2], c: "#CFC9BE", solid: false } }, { prim: { t: "box", at: [0, -8, 0.1], s: [200, 4, 0.2], c: "#CFC9BE", solid: false } });
  items.push({ prim: { t: "box", at: [0, 28, 0.1], s: [44, 36, 0.2], c: "#E8DCC6", solid: false } });
  items.push({ prim: { t: "cyl", at: [0, 26, 0.21], r: 7.5, h: 0.04, c: "#D7C3A2", v: 48, solid: false } });
  for (const x of [-7.4, 7.4]) items.push({ prim: { t: "box", at: [x, 2.0, 0.01], s: [0.5, 8.4, 0.02], c: "#FFFFFF", solid: false } });   // a crossing
  for (let k = 0; k < 7; k++) items.push({ prim: { t: "box", at: [-6 + k * 2, 0, 0.012], s: [1.0, 8.0, 0.02], c: "#F4F4F4", solid: false } });
  // north shops (fronts at y = 10), split by the plaza
  const cols = [["#F28B82", ["#D32F2F", "#FFFFFF"], "BAKERY"], ["#81C995", ["#2E7D32", "#FFFFFF"], "FLOWERS"], ["#FDD663", ["#F57C00", "#FFF3D6"], "TOYS"], ["#8AB4F8", ["#1565C0", "#FFFFFF"], "BOOKS"],
    ["#C58AF9", ["#6A1B9A", "#FFFFFF"], "SWEETS"], ["#FCAD70", ["#E64A19", "#FFFFFF"], "PIZZA"], ["#78D9EC", ["#00838F", "#FFFFFF"], "GAMES"], ["#F6AEA9", ["#C2185B", "#FFFFFF"], "HATS"]];
  [-28, -40, -52, -64, 28, 40, 52, 64].forEach((x, k) => items.push({ p: "shop", at: [x, 10, 0], w: 11.4, h: 10 + (k % 3) * 1.5, c: cols[k][0], awn: cols[k][1], sign: cols[k][2] }));
  // south shops (fronts at y = -10, facing the street)
  [-64, -52, -40, -28, -16, -4, 8, 20, 32, 44, 56, 68].forEach((x, k) => items.push({ p: "shop", at: [x, -10, 0], rz: 180, w: 11.4, h: 10 + ((k + 1) % 3) * 1.5, c: cols[(k + 3) % 8][0], awn: cols[(k + 3) % 8][1], sign: cols[(k + 3) % 8][2] }));
  // the plaza: the screen building at its back, a fountain, benches, trees in planters
  items.push({ prim: { t: "box", at: [0, 52, 9], s: [34, 8, 18], c: "#F4F1EA" } });
  items.push({ prim: { t: "box", at: [0, 52, 18.4], s: [35, 9, 0.8], c: "#3D7BE0", solid: false } });
  items.push({ p: "screen", at: [0, 47.8, 0], w: 20, h: 8.5, z: 10.5, text: "HAVE A NICE DAY", key: "screen" });
  items.push({ p: "fountain", at: [-14, 36, 0.2] });
  items.push({ p: "bench", at: [13, 40, 0.2], rz: 180 }, { p: "bench", at: [-17, 20, 0.2], rz: 90 });
  for (const [x, y] of [[-19, 13.5], [19, 13.5], [-19, 44], [19, 44]]) items.push({ prim: { t: "cyl", at: [x, y, 0.6], r: 1.5, h: 1.2, c: "#B9B2A3", v: 16 } }, { p: "tree", at: [x, y, 1.0], h: 7, r: 2.4 });
  // glass towers behind (the skyline)
  [[-52, 72, 16, 62], [-32, 84, 14, 88], [-12, 96, 18, 70], [10, 80, 14, 96], [30, 92, 16, 74], [50, 74, 14, 58], [-70, 90, 16, 50], [70, 96, 18, 66], [-2, 120, 20, 110]].forEach(([x, y, w, h], k) => items.push({ p: "tower", at: [x, y, 0], w, d: w, h, i: k, c: ["#7FB4DA", "#8FC3E3", "#6FA3CF", "#9AC9E6"][k % 4] }));
  // street lamps, trees on the south pavement, bins, a hydrant, security cameras
  for (const x of [-34, -58, 34, 58]) items.push({ p: "lamp", at: [x, 6.6, pave] });
  for (const x of [-46, -22, 2, 26, 50]) items.push({ p: "lamp", at: [x, -6.6, pave], rz: 180 });
  for (const x of [-34, -10, 14, 38]) items.push({ p: "tree", at: [x, -7.6, pave], h: 7, r: 2.2 });
  items.push({ p: "bin", at: [-23.5, 7.8, pave] }, { p: "hydrant", at: [23.5, 6.9, pave] }, { p: "seccam", at: [21, 11.5, pave], rz: 200 });
  // cars: parked at the kerbs, two driving
  items.push({ p: "car", at: [-46, 4.4, 0], c: "#E53935" }, { p: "car", at: [-34.5, 4.4, 0], c: "#3D7BE0" }, { p: "car", at: [46, 4.4, 0], c: "#FDD663" },
    { p: "car", at: [-20, -4.4, 0], rz: 180, c: "#7FB86A" }, { p: "car", at: [40, -4.4, 0], rz: 180, c: "#F2F2F2" },
    { p: "car", at: [24, -1.9, 0], c: "#B06AC8", move: [-10, 0, 0] }, { p: "car", at: [-58, 1.9, 0], rz: 180, c: "#FCAD70", move: [-10, 0, 0] });
  return {
    id: "bright_city", name: "Bright City", kind: "town", sky: "city",
    look: "a colourful main street of shops with striped awnings, a plaza with a fountain and a big screen, glass towers behind",
    items,
    big: { at: [0, 26, pave], r: 6.5, note: "the plaza's middle: an empty circle in front of the big screen" },
    spots: {
      plaza_front: { at: [0, 14, pave], tag: "plaza" }, two_a: { at: [-1.6, 15.8, pave], tag: "plaza" }, two_b: { at: [1.6, 15.8, pave], tag: "plaza" },
      big_front: { at: [0, 18.2, pave], tag: "plaza, before the big thing" }, fountain_side: { at: [-8.5, 32, pave], tag: "plaza, by the fountain" },
      plaza_right: { at: [9, 24, pave], tag: "plaza" }, bench_by: { at: [10, 37, pave], tag: "plaza, by the bench" },
      shop_a: { at: [-41.5, 8.3, pave], tag: "pavement, before a shop" }, shop_b: { at: [-38.3, 8.3, pave], tag: "pavement, before a shop" },
      shop_far: { at: [40, 8.3, pave], tag: "pavement" }, south_a: { at: [-4, -8.3, pave], tag: "pavement" }, south_b: { at: [8, -8.3, pave], tag: "pavement" },
      road_mid: { at: [0, 0.4, 0], tag: "street" }, road_far: { at: [-16, -0.6, 0], tag: "street" },
    },
    creature_spots: {
      cr_plaza_back: { at: [5, 43.5, pave], far: true }, cr_street_far: { at: [-66, 0, 0], far: true }, cr_screen: { at: [-9, 45, pave], far: true },
    },
    background: {
      bg_shop_w: { at: [-47, 8.4, pave], loop: "talk" }, bg_shop_e: { at: [47, 8.4, pave], loop: "phone" }, bg_s_w: { at: [-22, -8.4, pave], loop: "walk" },
      bg_s_e: { at: [20, -8.4, pave], loop: "stand" }, bg_plaza_back: { at: [14, 45, pave], loop: "talk" }, bg_plaza_l: { at: [-12, 26, pave], loop: "phone" },
      bg_fountain: { at: [-18.5, 31, pave], loop: "stand" }, bg_n_e: { at: [31, 8.4, pave], loop: "walk" },
    },
    cameras: {
      aerial_main: { loc: [-80, -8, 36], tgt: [6, 6, 2], lens: 18, shot: "top", people: [], aerial: true },
      town_wide: { loc: [0, -58, 88], tgt: [0, 30, 4], lens: 20, shot: "top", people: [], aerial: true },
      plaza_wide: { loc: [0, -5, 6.5], tgt: [0, 26, 2], lens: 20, shot: "wide", people: ["plaza_front"] },
      hero_med: { loc: [1, 6, 3.4], tgt: [0, 14, 2.6], lens: 30, shot: "medium", people: ["plaza_front"] },
      two_shot: { loc: [0, 8.5, 3.2], tgt: [0, 15.8, 2.4], lens: 26, shot: "two", people: ["two_a", "two_b"] },
      hero_close: { loc: [0.3, 10.2, 3.0], tgt: [0, 14, 2.7], lens: 40, shot: "close", people: ["plaza_front"] },
      big_low: { loc: [2.5, 11.5, 1.1], tgt: [0, 26, 9], lens: 18, shot: "low", people: [], fixed: true },
      big_med: { loc: [3, 8, 3.4], tgt: [0, 18.2, 3.2], lens: 26, shot: "medium", people: ["big_front"] },
      shop_two: { loc: [-39.9, 1.0, 3.2], tgt: [-39.9, 8.3, 2.5], lens: 26, shot: "two", people: ["shop_a", "shop_b"] },
      street_med: { loc: [2.5, -6.5, 3.0], tgt: [0, 0.4, 2.4], lens: 28, shot: "medium", people: ["road_mid"] },
      creature_cam: { loc: [2, 4, 3.2], tgt: [0.4, 30, 2.4], lens: 20, shot: "medium", people: ["plaza_front"], creature: "cr_plaza_back", fixed: true },
      fountain_med: { loc: [-5, 25, 3.2], tgt: [-8.5, 32, 2.5], lens: 28, shot: "medium", people: ["fountain_side"] },
    },
    times: ["day", "golden", "dusk", "night", "storm", "morning"],
  };
}

// ---------------------------------------------------------------------------------------- B. COSY OLD TOWN
function oldTown() {
  const items = [];
  items.push({ prim: { t: "box", at: [0, 0, -0.05], s: [200, 11, 0.1], c: "#8E8676", rough: 0.9, solid: false } });     // the cobbled street
  items.push({ prim: { t: "box", at: [0, 30, -0.04], s: [50, 46, 0.1], c: "#B9AA8E", rough: 0.9, solid: false } });     // the square
  for (let x = -24; x <= 24; x += 2.4) items.push({ prim: { t: "box", at: [x, 30, 0.012], s: [0.12, 46, 0.02], c: "#A3947A", solid: false } });
  for (let y = 8; y <= 52; y += 2.4) items.push({ prim: { t: "box", at: [0, y, 0.013], s: [50, 0.12, 0.02], c: "#A3947A", solid: false } });
  for (let x = -96; x <= 96; x += 3) items.push({ prim: { t: "box", at: [x, 0, 0.012], s: [0.12, 11, 0.02], c: "#7C7465", solid: false } });
  items.push({ prim: { t: "cyl", at: [0, 28, 0.02], r: 7.2, h: 0.04, c: "#C9BBA0", v: 48, solid: false } });
  // small crooked houses: the street's north side (split by the square) and south side
  const hc = [["#F2D7A6", "#B5523B"], ["#CFE3C8", "#5B6E8C"], ["#F4C7B8", "#7A4A3A"], ["#D8D0F0", "#8C3B2E"], ["#FBE7A1", "#4E6B5A"], ["#BFD9E8", "#9E4A32"]];
  [-31, -42, -53, -64, 31, 53, 64].forEach((x, k) => items.push({ p: "house", at: [x, 7.5, 0], w: 9.6, d: 9, h: 7 + (k % 3) * 1.6, c: hc[k % 6][0], roof: hc[k % 6][1], lean: [2, -2.5, 1.5, -1.5][k % 4] }));
  [-60, -49, -38, -27, -16, -5, 6, 17, 28, 50, 61].forEach((x, k) => items.push({ p: "house", at: [x, -7.5, 0], rz: 180, w: 9.6, d: 9, h: 7 + ((k + 2) % 3) * 1.6, c: hc[(k + 3) % 6][0], roof: hc[(k + 3) % 6][1], lean: [-2, 2.5, -1.5, 1.8][k % 4] }));
  // the square: the town hall at its back, the clock tower beside it, the well, the market stalls, old lamps
  items.push({ p: "townhall", at: [4, 46, 0], w: 24, sign: "TOWN HALL", key: "townhall" });
  items.push({ p: "clocktower", at: [-19, 47, 0], w: 6.4, h: 26, time: [10, 10] });
  items.push({ p: "well", at: [-14, 22, 0] });
  for (const [y, c] of [[18, "#C8553D"], [26, "#3E7CB1"], [34, "#6A994E"]]) items.push({ p: "stall", at: [15.6, y, 0], rz: -90, c });
  for (const [x, y] of [[-22, 10], [22, 10], [-22, 40], [22, 42]]) items.push({ p: "lamp", at: [x, y, 0], style: "old", h: 6.5 });
  for (const x of [-46, -20, 20, 46]) items.push({ p: "lamp", at: [x, -5.2, 0], style: "old", h: 6.5, light: x === -20 || x === 20 });
  items.push({ p: "flowerbed", at: [-6, 41.5, 0] }, { p: "barrel", at: [21, 14.5, 0] }, { p: "crate", at: [21, 30, 0] }, { p: "bench", at: [-21, 30, 0], rz: 90 });
  items.push({ p: "tree", at: [-22.5, 16, 0], h: 8, r: 2.6 }, { p: "tree", at: [23, 47, 0], h: 8, r: 2.6 });
  // the canal across the street at x = 40 and its little bridge; houses step back there
  items.push({ p: "canal", at: [40, -30, 0], rz: 90, L: 40, W: 7 }, { p: "canal", at: [40, 31, 0], rz: 90, L: 40, W: 7 }, { p: "bridge", at: [40, 0, 0], L: 12, W: 7.4 });
  // cars (an old town: few): two parked, one driving out of the square's side
  items.push({ p: "car", at: [-36, -3.2, 0], rz: 180, c: "#6A994E" }, { p: "car", at: [60, 3.0, 0], c: "#C8553D" }, { p: "car", at: [-12, -2.4, 0], c: "#3E7CB1", move: [-10, 0, 0] });
  return {
    id: "old_town", name: "Cosy Old Town", kind: "town", sky: "town", ground: { c: "#7FAF5A" },
    look: "a cobbled square with a clock tower and the town hall, small crooked houses, a market with stalls, old lamps, a well, a canal bridge",
    items,
    big: { at: [0, 28, 0], r: 6.5, note: "the square's middle, in front of the town hall" },
    spots: {
      sq_front: { at: [0, 14, 0], tag: "square" }, two_a: { at: [-1.6, 15.8, 0], tag: "square" }, two_b: { at: [1.6, 15.8, 0], tag: "square" },
      big_front: { at: [0, 20.3, 0], tag: "square, before the big thing" }, well_side: { at: [-10.4, 22, 0], tag: "square, by the well" },
      stall_buyer: { at: [11, 26, 0], tag: "market, at a stall" }, hall_steps: { at: [9, 43.5, 0], tag: "before the town hall" },
      street_a: { at: [-31.6, 3.0, 0], tag: "street" }, street_b: { at: [-28.4, 3.0, 0], tag: "street" }, bridge_mid: { at: [40, 1.0, 0.7], tag: "on the bridge" },
      street_s: { at: [6, -3.0, 0], tag: "street" },
    },
    creature_spots: { cr_tower: { at: [-14, 41.5, 0], far: true }, cr_street_end: { at: [-72, 0, 0], far: true }, cr_canal: { at: [40, 24, -0.1], far: true } },
    background: {
      bg_stall1: { at: [18.6, 18, 0], loop: "stand" }, bg_stall2: { at: [18.6, 34, 0], loop: "talk" }, bg_hall: { at: [-4, 42.5, 0], loop: "talk" },
      bg_street_w: { at: [-46, 3.0, 0], loop: "walk" }, bg_street_e: { at: [52, 3.0, 0], loop: "phone" }, bg_sq_l: { at: [-12, 34, 0], loop: "phone" },
      bg_sq_r: { at: [8, 37, 0], loop: "stand" }, bg_well: { at: [-18, 27, 0], loop: "talk" },
    },
    cameras: {
      aerial_main: { loc: [-78, -10, 34], tgt: [8, 4, 2], lens: 18, shot: "top", people: [], aerial: true },
      town_wide: { loc: [0, -72, 56], tgt: [0, 30, 6], lens: 20, shot: "top", people: [], aerial: true },
      sq_wide: { loc: [0, -5, 6.5], tgt: [0, 28, 2], lens: 20, shot: "wide", people: ["sq_front"] },
      hero_med: { loc: [1, 6, 3.4], tgt: [0, 14, 2.6], lens: 30, shot: "medium", people: ["sq_front"] },
      two_shot: { loc: [0, 8.5, 3.2], tgt: [0, 15.8, 2.4], lens: 26, shot: "two", people: ["two_a", "two_b"] },
      hero_close: { loc: [0.3, 10.2, 3.0], tgt: [0, 14, 2.7], lens: 40, shot: "close", people: ["sq_front"] },
      big_low: { loc: [2.5, 13, 1.1], tgt: [0, 28, 9], lens: 18, shot: "low", people: [], fixed: true },
      big_med: { loc: [3, 10, 3.4], tgt: [0, 20.3, 3.0], lens: 26, shot: "medium", people: ["big_front"] },
      clock_low: { loc: [-12, 28, 1.3], tgt: [-19, 47, 20], lens: 18, shot: "low", people: [], fixed: true },
      market_med: { loc: [6, 22, 3.2], tgt: [11, 26, 2.4], lens: 28, shot: "medium", people: ["stall_buyer"] },
      street_two: { loc: [-30, -5.5, 3.2], tgt: [-30, 3.0, 2.4], lens: 20, shot: "two", people: ["street_a", "street_b"] },
      creature_cam: { loc: [2, 4, 3.2], tgt: [-5.9, 30, 2.0], lens: 20, shot: "medium", people: ["sq_front"], creature: "cr_tower", fixed: true },
    },
    times: ["day", "golden", "dusk", "night", "storm", "morning"],
  };
}


// ---------------------------------------------------------------------------------------- C. SUBURB (Stage A, widened)
import { STAGE_A } from "../stageA.mjs";
import SOLVED_A from "../stageA.solved.json" with { type: "json" };
function suburb() {
  const items = [], C = [166, 0];
  // the cul-de-sac at the street's east end: a pavement ring, the turning circle, five houses facing its middle
  items.push({ prim: { t: "cyl", at: [C[0], 0, 0.12], r: 18.5, h: 0.25, c: "#ECE8E1", v: 64, solid: false } }, { prim: { t: "cyl", at: [C[0], 0, 0.13], r: 15, h: 0.25, c: "#474C5A", v: 64, solid: false } });
  items.push({ prim: { t: "box", at: [152, 0, 0.13], s: [6, 12, 0.25], c: "#474C5A", solid: false } });
  const hc = [["#F4D6A0", "#9E4A32"], ["#BFD9E8", "#4E5A6A"], ["#D8E8C8", "#7A4A3A"], ["#F4C7B8", "#5B6E8C"], ["#E8E0F4", "#8C3B2E"]];
  [0, 60, -60, 120, -120].forEach((th, k) => { const a = th * Math.PI / 180; items.push({ p: "house", at: [C[0] + 30 * Math.cos(a), 30 * Math.sin(a), 0], rz: th - 90, w: 11, d: 9, h: 7.5, c: hc[k][0], roof: hc[k][1] }); });
  // the park corner (between two houses north of the street): grass, a slide, swings, a bench, a tree, a fence
  items.push({ prim: { t: "box", at: [45, 19, 0.03], s: [15, 17, 0.06], c: "#79B85A", solid: false } });
  items.push({ p: "slide", at: [40.5, 22, 0] }, { p: "swing", at: [48, 23, 0] }, { p: "bench", at: [50.8, 15, 0], rz: -90 }, { p: "tree", at: [51, 27, 0], h: 8, r: 2.4 }, { p: "fence", at: [45, 27.8, 0], L: 14, h: 1.4 });
  // the bus stop near the cul-de-sac (a shelter, a bench, the stop sign)
  items.push({ p: "busstop", at: [140, 7.0, 0.25] });
  // cars: parked and one driving
  items.push({ p: "car", at: [-40, 3.6, 0.06], c: "#E2405B" }, { p: "car", at: [70, -3.6, 0.06], rz: 180, c: "#22B5A3" }, { p: "car", at: [175, 8.5, 0.15], rz: -150, c: "#FFCF1F" },
    { p: "car", at: [40, -3.0, 0.06], c: "#3D8BFD", move: [-12, 0, 0] });
  const base = [...STAGE_A.obstacles];
  for (const x of [-120, -90, -60, -30, 0, 30, 60, 90, 120]) base.push({ n: "sub_house_n" + x, box: [x - 7, x + 7, 18, 30, 0, 19.5] }, { n: "sub_house_s" + x, box: [x + 5, x + 19, -30, -18, 0, 19.5] });
  for (let k = 0; k < 12; k++) base.push({ n: "sub_lamp" + k, cyl: [-110 + k * 20, 10.2, 0.3, 9.0] });
  const pick = ["house_wide", "porch_two", "pave_two", "from_porch", "step_med"];
  const spots = Object.fromEntries(Object.entries(STAGE_A.spots).filter(([, v]) => !v.inside));
  return {
    id: "suburb", name: "Our Suburb", kind: "town", base: "suburb", sky: "town", deck: STAGE_A.deck, base_obstacles: base,
    look: "our street (Stage A: our house, porch, lawn, neighbours) widened: a cul-de-sac with five houses, a park corner, a bus stop",
    items,
    big: { at: [C[0], 0, 0.25], r: 6.5, note: "the middle of the cul-de-sac (the turning circle)" },
    spots: { ...spots,
      cul_front: { at: [158.2, 0, 0.25], tag: "cul-de-sac, before the big thing" }, cul_a: { at: [157.5, -4.5, 0.25], tag: "cul-de-sac" }, cul_b: { at: [157.5, 4.5, 0.25], tag: "cul-de-sac" },
      park_kid: { at: [44, 17, 0.06], tag: "the park corner" }, bus_wait: { at: [140, 7.6, 0.25], tag: "at the bus stop" } },
    creature_spots: { cr_road_south: STAGE_A.creature_spots.cr_road_south, cr_road_far: STAGE_A.creature_spots.cr_road_far, cr_across: STAGE_A.creature_spots.cr_across, cr_cul_far: { at: [188, 0, 0.25], far: true } },
    background: {
      bg_pave_sw: { at: [-14, -8.0, 0.25], loop: "talk" }, bg_pave_se: { at: [16, -8.0, 0.25], loop: "phone" }, bg_pave_nw: { at: [-20, 8.0, 0.25], loop: "walk" },
      bg_pave_ne: { at: [22, 8.0, 0.25], loop: "stand" }, bg_park: { at: [41.5, 13.5, 0.06], loop: "talk" }, bg_bus: { at: [134.4, 7.8, 0.25], loop: "phone" },
      bg_cul: { at: [170, 15.5, 0.25], loop: "stand" }, bg_cul2: { at: [176, -12, 0.25], loop: "walk" },
    },
    cameras: {
      aerial_main: { loc: [-70, -14, 34], tgt: [20, 6, 2], lens: 18, shot: "top", people: [], aerial: true },
      town_wide: { loc: [70, -95, 72], tgt: [70, 10, 4], lens: 18, shot: "top", people: [], aerial: true },
      aerial_cul: { loc: [138, -32, 36], tgt: [166, 0, 2], lens: 22, shot: "top", people: [], aerial: true },
      ...Object.fromEntries(pick.map((k) => [k, SOLVED_A[k]])),
      cul_med: { loc: [150, -2, 3.4], tgt: [158.2, 0, 2.6], lens: 30, shot: "medium", people: ["cul_front"] },
      big_low: { loc: [151, -3, 1.1], tgt: [166, 0, 9], lens: 18, shot: "low", people: [], fixed: true },
      park_med: { loc: [44, 9, 3.2], tgt: [44, 17, 2.4], lens: 28, shot: "medium", people: ["park_kid"] },
      bus_med: { loc: [141, 1.5, 3.2], tgt: [140, 7.6, 2.4], lens: 28, shot: "medium", people: ["bus_wait"] },
    },
    times: ["day", "golden", "dusk", "night", "storm", "morning"],
  };
}

export const TOWNS = { bright_city: brightCity(), old_town: oldTown(), suburb: suburb() };
