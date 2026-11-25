// IN THIS TOWN v2, OVERNIGHT BUILD 2: MORE PLACES (step 6). Thirteen inside sets for night stories and eight far-away
// sets reached by a cut. Same data format, builder, checks and sheet as the first 21 side sets (sidesets.mjs). Our own.
import { side, R, ins, g } from "./sidesets.mjs";
import { box, cyl, sph, txt, lit } from "./prefabs.mjs";

const pr = (t, o) => ({ prim: { t, solid: false, ...o } });
// a window that shows the night city: a dark blue panel full of lit windows behind a frame
const cityWindow = (x, y, z, w = 4.4, h = 3.2) => [pr("box", { at: [x, y + 0.1, z], s: [w, 0.1, h], c: "#1C2C5A", wg: [0.5, 0.6] }), pr("box", { at: [x, y - 0.05, z + h / 2], s: [w + 0.4, 0.2, 0.25], c: "#F2EDE4" }),
  pr("box", { at: [x, y - 0.05, z - h / 2], s: [w + 0.4, 0.2, 0.25], c: "#F2EDE4" }), pr("box", { at: [x - w / 2, y - 0.05, z], s: [0.25, 0.2, h], c: "#F2EDE4" }), pr("box", { at: [x + w / 2, y - 0.05, z], s: [0.25, 0.2, h], c: "#F2EDE4" }), pr("box", { at: [x, y - 0.05, z], s: [0.12, 0.2, h], c: "#F2EDE4" })];
const closet = (x, y) => [{ prim: { t: "box", at: [x, y, 2.9], s: [3.0, 1.8, 5.8], c: "#B07A4A" } }, pr("box", { at: [x - 0.75, y - 0.95, 2.8], s: [1.4, 0.1, 5.4], c: "#C48A5A" }), pr("box", { at: [x + 0.8, y - 1.15, 2.8], s: [1.4, 0.1, 5.4], c: "#C48A5A", rz: -14 }), pr("box", { at: [x + 0.05, y - 0.9, 2.8], s: [0.1, 0.1, 5.4], c: "#050505" })];
const tiles = (w, d, c1, c2) => Array.from({ length: Math.ceil(w / 2) * Math.ceil(d / 2) }, (_, k) => { const i = k % Math.ceil(w / 2), j = Math.floor(k / Math.ceil(w / 2)); return (i + j) % 2 ? null : pr("box", { at: [-w / 2 + 1 + i * 2, -d / 2 + 1 + j * 2, 0.012], s: [2, 2, 0.02], c: c2 }); }).filter(Boolean);

export const SIDESETS2 = {
  // ------------------------------------------------------------------ INSIDE
  night_bedroom: side("night_bedroom", "Night bedroom", "a kid's bedroom at night: a bed, a closet with a dark gap, a door, a window full of the night city, a little lamp", {
    items: [R({ wall: "#7A86B8", floor: "#6B4E3A" }), { p: "bed", at: [-4.6, 3.0, 0], c: "#5B7FD0" }, ...closet(4.6, 4.6), ...cityWindow(-0.6, 5.85, 4.4), { p: "door", at: [7.2, 2.0, 0], rz: -90 },
      { p: "floorlamp", at: [-6.6, 4.8, 0] }, { p: "rug", at: [0, 0.6, 0], r: 2.4, c: "#3E4A7A" }, pr("light", { at: [-6.6, 4.4, 4.0], w: 160, c: "#FFC07A" })],
    creature_spots: { cr_under_bed: { at: [-4.6, 0.2, 0.45], scare: true }, cr_closet: { at: [4.65, 3.62, 3.4], scare: true }, cr_door: { at: [7.05, 1.0, 3.4], scare: true } },
    cams: { bed_low: { loc: [-2.2, -4.2, 0.7], tgt: [-4.6, 0.6, 0.5], lens: 26, shot: "insert", people: [], fixed: true }, closet_gap: ins([3.2, 0.6, 3.6], [4.65, 3.6, 3.3], 30), city: ins([-0.6, 0.2, 4.4], [-0.6, 5.8, 4.4], 26) },
    times: ["night", "dusk", "day"] }),
  under_bed: side("under_bed", "Under the bed", "the view from under a bed: the bed's slats above, the bedroom floor and a door far off", {
    items: [R({ wall: "#7A86B8", floor: "#6B4E3A", h: 7 }), pr("box", { at: [0, -2.6, 1.7], s: [10, 6, 0.3], c: "#3A2A20" }), ...[-4, -2, 0, 2, 4].map((x) => pr("box", { at: [x, -2.6, 1.5], s: [0.3, 6, 0.2], c: "#5A3A28" })),
      { p: "door", at: [0, 5.85, 0] }, pr("light", { at: [0, 2, 1.2], w: 120, c: "#9AB4FF" })],
    hero: g(0, -2.2), cams: { wide: { loc: [0, -5.2, 0.6], tgt: [0, 6, 0.9], lens: 20, shot: "wide", people: [], fixed: true } }, times: ["night"] }),
  inside_closet: side("inside_closet", "Inside the closet", "inside a dark closet: hanging clothes, a bright gap between the doors", {
    items: [R({ w: 8, d: 5, wall: "#5A4030", floor: "#3A2A20", h: 6 }), ...[-2.4, -1.2, 0, 1.2, 2.4].map((x, k) => pr("box", { at: [x, 1.4, 3.6], s: [0.9, 0.3, 2.6], c: ["#C8553D", "#3E7CB1", "#6A994E", "#F2C14E", "#8A5A9A"][k] })), pr("cyl", { at: [0, 1.5, 5.0], r: 0.05, h: 7, c: "#9A9A9A", ry: 90 }),
      pr("box", { at: [0, -2.6, 2.8], s: [0.25, 0.05, 5.0], c: "#FFF2C8", e: "#FFE6A0", es: 4 }), pr("light", { at: [0, -3.0, 3.0], w: 140, c: "#FFE6A0" })],
    hero: g(0, -0.6), times: ["night"] }),
  apartment_hallway: side("apartment_hallway", "Apartment hallway", "a long apartment hallway: numbered doors, ceiling lights, a worn carpet runner", {
    items: [R({ wall: "#D8C8A8", floor: "#7A4A3A" }), pr("box", { at: [0, -2, 0.03], s: [3.4, 20, 0.04], c: "#A8423A" }), ...[-5, -1.6, 1.8, 5.2].map((x, k) => ({ p: "door", at: [x, 5.85, 0] })), ...[-5, -1.6, 1.8, 5.2].map((x, k) => ({ prim: { t: "text", at: [x, 5.6, 5.4], body: String(301 + k), size: 0.4, c: "#2A2A2A", solid: false } })),
      ...[-4, 0, 4].map((x) => pr("box", { at: [x, 0, 7.8], s: [1.2, 1.2, 0.1], c: "#FFF4D6", e: "#FFE9B0", es: 3 }))],
    times: ["night", "day"] }),
  stairwell: side("stairwell", "Stairwell", "a concrete stairwell: flights of stairs up the back wall, a railing, a floor number, a buzzing light", {
    items: [R({ wall: "#A8ACB2", floor: "#6A6E74", h: 9 }), ...Array.from({ length: 9 }, (_, k) => ({ prim: { t: "box", at: [-3 + k * 0.9, 4.6, 0.25 + k * 0.5], s: [0.9, 2.2, 0.5], c: "#8A8E94" } })), pr("box", { at: [0.6, 3.4, 3.4], s: [8.2, 0.12, 0.12], c: "#C24A3A", ry: -29 }),
      { prim: { t: "text", at: [-5.6, 5.8, 5.6], body: "3", size: 1.4, c: "#C24A3A", solid: false } }, pr("box", { at: [0, 0, 8.8], s: [1.4, 0.6, 0.1], c: "#E8FFF0", e: "#D8FFE8", es: 2.5 })],
    times: ["night", "day"] }),
  lift: side("lift", "The lift", "inside a small lift: steel walls, a panel of buttons, a floor display, doors closing", {
    items: [R({ w: 8, d: 6, wall: "#A8B0B8", floor: "#4A4E54", h: 7, trim: "#C8CED4" }), pr("box", { at: [3.2, 2.9, 3.0], s: [0.9, 0.08, 1.8], c: "#2A2E34" }), ...[0, 1, 2, 3].map((k) => pr("cyl", { at: [3.0 + (k % 2) * 0.4, 2.84, 2.5 + Math.floor(k / 2) * 0.6], r: 0.13, h: 0.05, c: "#FFE27A", e: "#FFD54A", es: k === 2 ? 4 : 1, rx: 90 })),
      pr("box", { at: [0, 2.9, 5.8], s: [1.6, 0.08, 0.5], c: "#101010" }), { prim: { t: "text", at: [0, 2.84, 5.8], body: "13", size: 0.32, c: "#FF4A3A", e: "#FF3A2A", es: 4, solid: false, key: "lift_floor" } }],
    hero: g(0, -0.6), two: [g(-1.3, -0.4), g(1.3, -0.4)], times: ["night", "day"], cams: { panel: ins([2.2, 1.2, 3.0], [3.2, 2.9, 3.0], 30, ["lift_floor"]) } }),
  subway_station: side("subway_station", "Subway station", "an underground platform: tiles, a yellow edge line, a waiting train with lit windows, a station sign", {
    indoor: true, items: [R({ w: 24, d: 14, wall: "#D8E2DC", floor: "#8A8E94", h: 8 }), pr("box", { at: [0, 1.4, 0.02], s: [30, 0.5, 0.04], c: "#F2C14E" }), { prim: { t: "box", at: [0, 4.4, 2.6], s: [26, 3.8, 4.6], c: "#C24A3A" } },
      ...[-9, -5, -1, 3, 7, 11].map((x) => pr("box", { at: [x, 2.45, 3.3], s: [2.6, 0.1, 1.6], c: "#FFF4D6", e: "#FFE9B0", es: 2.5 })), pr("box", { at: [0, 6.8, 6.6], s: [6, 0.1, 1.0], c: "#1E4A8A" }), { prim: { t: "text", at: [0, 6.7, 6.6], body: "CENTRAL", size: 0.6, c: "#FFFFFF", solid: false, key: "station" } }],
    hero: g(0, -1.8), times: ["night", "day"] }),
  train_carriage: side("train_carriage", "Train carriage", "inside a train: seat rows, yellow poles, windows with the dark tunnel rushing past, a route map", {
    items: [R({ w: 14, d: 7, wall: "#D2D8DE", floor: "#5A5F66", h: 7 }), ...[-5, -1.5, 2, 5.5].map((x) => ({ prim: { t: "box", at: [x, 2.6, 1.2], s: [2.6, 1.4, 1.0], c: "#3E7CB1" } })), ...[-3.2, 0.3, 3.8].map((x) => pr("cyl", { at: [x, 0.4, 3.5], r: 0.1, h: 7, c: "#F2C14E" })),
      ...[-5, -1.5, 2, 5.5].map((x) => pr("box", { at: [x, 3.4, 4.2], s: [2.4, 0.1, 1.6], c: "#10141C", e: "#2A3550", es: 0.6 })), pr("box", { at: [0, 3.4, 6.0], s: [8, 0.06, 0.6], c: "#F4F4F4" })],
    hero: g(0, -0.4), two: [g(-1.6, -0.2), g(1.6, -0.2)], times: ["night", "day"] }),
  cafeteria: side("cafeteria", "School cafeteria", "long tables with trays, a serving counter with food, a menu board, round lights", {
    items: [R({ w: 20, wall: "#F2E6C8", floor: "#B8B0A0" }), ...[-4.5, 4.5].map((x) => ({ prim: { t: "box", at: [x, 1.8, 1.4], s: [6, 2.2, 0.2], c: "#D9C7A7" } })), ...[-6, -3, 3, 6].map((x) => pr("box", { at: [x, 1.8, 1.55], s: [1.2, 0.8, 0.1], c: "#3E7CB1" })),
      { p: "counter", at: [0, 5.0, 0], L: 10 }, { p: "board", at: [0, 5.85, 5.2], text: "TODAY: PIZZA", key: "menu" }],
    times: ["day", "night"] }),
  bathroom: side("bathroom", "Bathroom", "a tiled bathroom: a sink under a mirror, a bath with a curtain, a towel, a night light", {
    items: [R({ w: 12, d: 10, wall: "#CFE4EC", floor: "#E8E8E8" }), ...tiles(12, 10, "#E8E8E8", "#9FC8D8"), { prim: { t: "box", at: [-3.5, 4.4, 1.5], s: [2.4, 1.4, 0.4], c: "#F4F4F4" } }, pr("box", { at: [-3.5, 4.9, 4.0], s: [2.2, 0.08, 2.4], c: "#BFD4E0", metal: 0.6, rough: 0.05 }),
      { prim: { t: "box", at: [3.5, 3.8, 1.0], s: [4.6, 2.4, 1.6], c: "#F4F4F4" } }, pr("box", { at: [3.5, 2.6, 4.0], s: [4.6, 0.06, 4.0], c: "#7FC8A8", alpha: 0.85 }), pr("light", { at: [-5.6, 4.0, 1.0], w: 60, c: "#9FE0FF" })],
    times: ["night", "day"] }),
  garage: side("garage", "Garage", "a garage: a car, a tool wall, shelves with boxes, a roll-up door, a bare bulb", {
    items: [R({ w: 18, wall: "#9A9890", floor: "#6A6862", h: 8 }), { p: "car", at: [-3.6, 3.4, 0], c: "#3D7BE0" }, { p: "shelf", at: [5.8, 5.0, 0], w: 4 }, pr("box", { at: [-6, 5.85, 4.0], s: [4, 0.1, 3], c: "#5A4A3A" }),
      ...[0, 1, 2, 3].map((k) => pr("box", { at: [-7.2 + k * 0.8, 5.75, 4.2], s: [0.12, 0.1, 1.4], c: "#C8CED4", metal: 0.7 })), { p: "bulb", at: [0, 1.0, 7.4] }],
    times: ["night", "day"] }),
  shop_shutters: side("shop_shutters", "Shop front with shutters", "a corner shop front at night; its metal shutter rolls down (state shutter = up / down)", {
    indoor: false, ground: { c: "#3A3D45" }, far: 1.2,
    items: [{ prim: { t: "box", at: [0, 8, 5], s: [16, 4, 10], c: "#7A6A5E" } }, pr("box", { at: [0, 5.95, 2.6], s: [10, 0.1, 4.6], c: "#FFE6A0", e: "#FFD27A", es: 2.2, only: "shutter=up" }),
      pr("box", { at: [0, 5.85, 2.6], s: [10.2, 0.12, 4.8], c: "#8A9098", metal: 0.6, only: "shutter=down" }), ...[0.8, 1.6, 2.4, 3.2, 4.0].map((z) => pr("box", { at: [0, 5.78, z], s: [10.2, 0.05, 0.08], c: "#5A6068", only: "shutter=down" })),
      pr("box", { at: [0, 5.8, 5.6], s: [10, 0.3, 1.0], c: "#C24A3A" }), { prim: { t: "text", at: [0, 5.6, 5.6], body: "OPEN LATE", size: 0.6, c: "#FFFFFF", solid: false, key: "shop_sign" } }, { p: "lamp", at: [-7, 3.4, 0] }],
    states: { shutter: "up" }, times: ["night", "dusk"] }),
  tunnel: side("tunnel", "The tunnel", "a long road tunnel: a curved roof, a row of orange lights running into the dark, a wet floor", {
    indoor: true, items: [R({ w: 14, d: 40, wall: "#4A4E54", floor: "#2C2F37", h: 8 }), ...Array.from({ length: 10 }, (_, k) => pr("box", { at: [-5.8, -14 + k * 3.6, 6.4], s: [0.4, 1.2, 0.3], c: "#FFB060", e: "#FF9A40", es: 4 })), ...Array.from({ length: 10 }, (_, k) => pr("box", { at: [5.8, -14 + k * 3.6, 6.4], s: [0.4, 1.2, 0.3], c: "#FFB060", e: "#FF9A40", es: 4 })),
      ...Array.from({ length: 12 }, (_, k) => pr("box", { at: [0, -16 + k * 3, 0.02], s: [0.25, 1.4, 0.02], c: "#F2C14E" }))],
    hero: g(0, -2.4), times: ["night"] }),
  // ------------------------------------------------------------------ FAR AWAY (reached by a cut)
  castle_square: side("castle_square", "Castle square", "a castle courtyard: stone walls with towers and flags, a gate, a well, torches", {
    indoor: false, ground: { c: "#8E8676" }, far: 1.3,
    items: [{ prim: { t: "box", at: [0, 14, 5], s: [30, 3, 10], c: "#9C9488" } }, ...[-13, 13].map((x) => ({ prim: { t: "cyl", at: [x, 14, 7.5], r: 2.6, h: 15, c: "#8A8276", v: 16 } })), ...[-13, 13].map((x) => pr("cyl", { at: [x, 14, 16], r: 3.0, h: 3, c: "#5B3A6E", r2: 0.2, v: 16 })),
      pr("box", { at: [0, 12.4, 3.2], s: [5, 0.3, 6.4], c: "#3A2A20" }), { p: "flag", at: [-13, 14, 17.5] }, { p: "well", at: [6, 5, 0] }, ...[-4, 4].map((x) => pr("sph", { at: [x, 12.3, 6.4], r: 0.4, c: "#FFB060", e: "#FF9A40", es: 6 }))],
    times: ["day", "dusk", "night"] }),
  desert_pyramid: side("desert_pyramid", "Desert with a pyramid", "golden dunes, a huge stepped pyramid, a palm, a hot sun", {
    indoor: false, ground: { c: "#E2C27A" }, far: 1.4,
    items: [...[0, 1, 2, 3, 4, 5].map((k) => ({ prim: { t: "box", at: [0, 40, 2.5 + k * 5], s: [44 - k * 7.4, 44 - k * 7.4, 5], c: k % 2 ? "#D8B26A" : "#CFA65E" } })), ...[[-18, 18, 9], [20, 24, 7], [-30, 34, 10]].map(([x, y, r]) => pr("sph", { at: [x, y, 0], r, c: "#E8CC88", sc: [2.2, 1.4, 0.4] })),
      pr("cyl", { at: [8, 6, 3.5], r: 0.3, h: 7, c: "#8A6A44" }), pr("sph", { at: [8, 6, 7.4], r: 1.6, c: "#4E8A3A", sc: [1.6, 1.6, 0.5] })],
    times: ["day", "golden", "dusk"] }),
  cave: side("cave", "The cave", "a dark cave: rough rock walls, stalactites, glowing crystals, a pool", {
    indoor: true, items: [R({ w: 18, wall: "#4A4440", floor: "#3A3430", h: 9, trim: "#3A3430" }), ...Array.from({ length: 9 }, (_, k) => pr("cyl", { at: [-7 + k * 1.8, 2 + (k % 3) * 1.4, 8.0], r: 0.5, h: 2.4 + (k % 3), c: "#5A524C", r2: 0.02, rx: 180 })),
      ...[[-5, 4.6, 0.8, "#7FE0FF"], [4.8, 4.2, 1.0, "#C08AFF"], [6.2, 2.4, 0.6, "#7FE0FF"]].map(([x, y, r, c]) => pr("cyl", { at: [x, y, r * 1.2], r, h: r * 2.6, c, e: c, es: 4, v: 6, r2: 0.05 })), pr("cyl", { at: [0, 3.2, 0.03], r: 3, h: 0.05, c: "#1E4A6A", rough: 0.05 }), pr("light", { at: [-5, 3.6, 2.0], w: 200, c: "#7FE0FF" })],
    times: ["night"] }),
  neon_city: side("neon_city", "Neon future city", "a future street: glowing pink and cyan signs, smooth towers, floating lights, a hover car", {
    indoor: false, ground: { c: "#1A1C28" }, far: 1.3,
    items: [...[-12, -4, 4, 12].map((x, k) => ({ prim: { t: "box", at: [x, 16, 14 + (k % 2) * 6], s: [7, 7, 28 + (k % 2) * 12], c: "#202436", wg: [1.6, 2.2] } })), ...[[-8, 12.4, 9, "#FF4FD8"], [8, 12.4, 12, "#4FF0FF"], [0, 12.4, 16, "#B57FFF"]].map(([x, y, z, c]) => pr("box", { at: [x, y, z], s: [6, 0.2, 1.4], c, e: c, es: 5 })),
      pr("box", { at: [0, 3, 0.03], s: [30, 0.3, 0.02], c: "#4FF0FF", e: "#4FF0FF", es: 3 }), pr("box", { at: [-3, 7, 3.6], s: [5, 2.4, 1.2], c: "#E8E8F4", metal: 0.5 }), pr("box", { at: [-3, 7, 2.9], s: [4.6, 2.0, 0.1], c: "#FF4FD8", e: "#FF4FD8", es: 4 })],
    times: ["night", "dusk"] }),
  time_machine: side("time_machine", "Time machine room", "a room with a big round time machine: a glowing ring, a chair, dials, cables", {
    items: [R({ wall: "#3A3A4A", floor: "#2A2A34" }), pr("cyl", { at: [0, 3.4, 3.8], r: 3.2, h: 0.5, c: "#C9A24A", metal: 0.7, rx: 90, v: 40 }), pr("cyl", { at: [0, 3.2, 3.8], r: 2.6, h: 0.2, c: "#8FE8FF", e: "#8FE8FF", es: 4, rx: 90, v: 40, alpha: 0.7 }),
      { p: "chair", at: [0, 2.0, 0], c: "#8A3A3A" }, ...[-5, 5].map((x) => ({ p: "console", at: [x, 4.4, 0], L: 3.4, labels: ["PAST", "NOW", "NEXT"] })), ...[-2, 0, 2].map((x) => pr("cyl", { at: [x, 5.6, 0.2], r: 0.15, h: 6, c: "#1A1A1A", ry: 90 }))],
    times: ["night"] }),
  space_station: side("space_station", "Space station", "a space station deck: white panels, a big round window with the planet and stars, blinking lights", {
    items: [R({ wall: "#E4E8EE", floor: "#B8C0C8", trim: "#9AA4B0" }), pr("cyl", { at: [0, 5.8, 4.2], r: 3.0, h: 0.2, c: "#05060C", rx: 90, v: 40 }), pr("sph", { at: [1.2, 5.9, 3.6], r: 1.6, c: "#3E7CB1", e: "#2A5A9A", es: 0.8, sc: [1, 0.2, 1] }),
      ...[[-2, 5.3], [-1, 3.2], [2.2, 5.6], [-2.4, 3.6]].map(([x, z], k) => pr("sph", { at: [x, 5.86, z], r: 0.06, c: "#FFFFFF", e: "#FFFFFF", es: 6 })), ...[-6, -4, 4, 6].map((x, k) => pr("sph", { at: [x, 5.8, 6.5], r: 0.12, c: k % 2 ? "#FF4A3A" : "#4AFF8A", e: k % 2 ? "#FF4A3A" : "#4AFF8A", es: 6 })), { p: "console", at: [-4.5, 3.6, 0], L: 4 }],
    times: ["night", "day"] }),
  under_sea: side("under_sea", "Under the sea", "the sea floor: sand, coral in bright colours, seaweed swaying, bubbles, light rays from above", {
    indoor: false, ground: { c: "#C8B88A" }, far: 1.2,
    items: [...[[-6, 6, "#FF6F61"], [5, 7, "#FFB347"], [-2, 10, "#C06BD9"], [8, 3, "#FF6F61"]].map(([x, y, c]) => pr("sph", { at: [x, y, 1.0], r: 1.4, c, sc: [1, 1, 1.6] })), ...[-8, -4, 3, 7].map((x) => pr("cyl", { at: [x, 9, 3.0], r: 0.25, h: 6, c: "#3E8E5A", rx: 8 })),
      ...Array.from({ length: 14 }, (_, k) => pr("sph", { at: [-6 + k, 3 + (k % 4), 2 + (k * 1.7) % 8], r: 0.15, c: "#DFF6FF", alpha: 0.5 })), ...[-5, 0, 5].map((x) => pr("box", { at: [x, 8, 12], s: [1.6, 0.05, 24], c: "#BFF0FF", e: "#BFF0FF", es: 0.6, alpha: 0.15, ry: 14 }))],
    times: ["day"] }),
  snowy_mountain: side("snowy_mountain", "Snowy mountain", "a snowy mountain top: white slopes, pines, a cabin with a lit window, a flag at the peak", {
    indoor: false, ground: { c: "#EEF2F8" }, far: 1.4,
    items: [pr("cyl", { at: [0, 40, 14], r: 26, h: 28, c: "#DDE4EE", r2: 1.0, v: 8 }), pr("cyl", { at: [-26, 46, 10], r: 18, h: 20, c: "#C8D2E0", r2: 1.0, v: 8 }), ...[[-8, 10], [8, 12], [-12, 16], [12, 6]].map(([x, y], k) => ({ p: "pine", at: [x, y, 0], h: 8 + k % 2 * 2 })),
      { prim: { t: "box", at: [5, 6, 2], s: [5, 4, 4], c: "#8A5A3A" } }, pr("box", { at: [5, 3.95, 2.2], s: [1.4, 0.1, 1.2], c: "#FFE6A0", e: "#FFD27A", es: 3, glow: "night" }), pr("cyl", { at: [0, 40, 29], r: 0.1, h: 3, c: "#5A5F66" })],
    times: ["day", "dusk", "night"] }),
};
