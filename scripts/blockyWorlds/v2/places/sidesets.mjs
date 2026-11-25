// IN THIS TOWN v2, NIGHT BUILD: THE SIDE SETS AS DATA (small three-wall corners, one open side toward -y; a few are
// outdoor corners). Same builder, checks and test sheet as the towns. Each: pieces, spots, cameras (a shared template:
// wide / medium / two / close + the set's own insert of its key object).
import "./pieces.mjs";

const g = (x, y, z = 0) => [x, y, z];
function cams(hero, two, extra = {}, { far = 1 } = {}) {
  const h = hero, c = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const tw = c(two[0], two[1]);
  return {
    wide: { loc: [h[0] * 0.5, h[1] - 15 * far, 6.5], tgt: [h[0] * 0.5, h[1] + 3, 2.2], lens: 18, shot: "wide", people: ["hero"] },
    medium: { loc: [h[0] + 0.8, h[1] - 6, 3.4], tgt: [h[0], h[1], 2.6], lens: 30, shot: "medium", people: ["hero"] },
    two: { loc: [tw[0], tw[1] - 6, 3.2], tgt: [tw[0], tw[1], 2.4], lens: 26, shot: "two", people: ["two_a", "two_b"] },
    close: { loc: [h[0] + 0.3, h[1] - 4, 3.0], tgt: [h[0], h[1], 2.7], lens: 40, shot: "close", people: ["hero"] },
    ...extra,
  };
}
// inserts: the camera pulled back 1.8x from its target (the first sheet: the key object filled or left the frame)
const ins = (loc, tgt, lens = 30, reads = []) => ({ loc: loc.map((v, i) => +(tgt[i] + (v - tgt[i]) * 1.8).toFixed(2)), tgt, lens, shot: "insert", people: [], fixed: true, reads });
function side(id, name, look, o) {
  const two = o.two ?? [g(-1.6, -0.6), g(1.6, -0.6)], hero = o.hero ?? g(0, -1.8);
  return { id, name, kind: "side", look, indoor: o.indoor !== false, ground: o.ground ?? null, light: o.light ?? null,
    items: o.items, spots: { hero: { at: hero, tag: o.tag ?? name }, two_a: { at: two[0], tag: name }, two_b: { at: two[1], tag: name }, ...(o.spots ?? {}) },
    creature_spots: o.creature_spots ?? {}, background: o.background ?? {}, cameras: { ...cams(hero, two, o.cams ?? {}, { far: o.far ?? 1 }) }, times: o.times ?? ["day", "night"], states: o.states ?? null };
}
const R = (p) => ({ p: "room", at: [0, 0, 0], ...p });

export const SIDESETS = {
  classroom: side("classroom", "Classroom", "desks, a board with replaceable text, the teacher's desk, a clock, a window", {
    items: [R({ wall: "#F3E6C4", floor: "#C9A26B" }), { p: "board", at: [0, 5.85, 4.2], text: "TODAY: MATH", key: "board" }, { p: "desk", at: [-4.6, 3.4, 0], w: 3.4, c: "#8A5A3A" },
      { p: "wallclock", at: [5.6, 5.85, 6.3] }, { p: "window", at: [-6.2, 5.85, 4.4], w: 2.4, curtains: null },
      ...[-5.6, 5.6].flatMap((x) => [-0.6, 2.4].flatMap((y) => [{ p: "desk", at: [x, y, 0], w: 2.2, d: 1.4, h: 1.4 }, { p: "chair", at: [x, y + 1.15, 0], c: "#E8505B", h: 0.9 }]))],
    spots: { teacher: { at: g(1.6, 4.4), tag: "at the board" } }, cams: { board: ins([0, -1.2, 4.2], [0, 5.8, 4.2], 30, ["board"]) } }),
  hallway: side("hallway", "School hallway", "a corridor of lockers, posters, a door", {
    items: [R({ d: 8, wall: "#EFE8D8", floor: "#D8D2C4" }), { p: "lockers", at: [0, 2.95, 0], n: 11, c: "#3E7CB1" }, { p: "poster", at: [-5, 3.86, 6.5], text: "GO TEAM", key: "poster", c: "#E8505B" },
      { p: "poster", at: [4.5, 3.86, 6.5], c: "#F2B705" }, { p: "door", at: [7.85, 0.5, 0], rz: 90 }],
    hero: g(0, -0.4), two: [g(-1.6, 0.4), g(1.6, 0.4)], spots: { far_end: { at: g(-5.5, 0.6) } }, cams: { locker: ins([2.6, -1.6, 3.4], [2.6, 3, 3.4], 30) } }),
  school_front: side("school_front", "School front", "the school with a sign, steps, a flag, a yellow school bus at the kerb", {
    indoor: false, ground: { c: "#C9C4BA" }, far: 1.1,
    items: [{ prim: { t: "box", at: [0, 22, 7], s: [34, 14, 14], c: "#B5523B" } }, { prim: { t: "box", at: [0, 14.8, 11.5], s: [14, 0.4, 2], c: "#FFF8EC", solid: false } },
      { prim: { t: "text", at: [0, 14.5, 11.5], body: "OUR SCHOOL", size: 1.2, c: "#2B2B33", key: "school", solid: false } },
      ...[-12, -6, 6, 12].flatMap((x) => [5, 9.5].map((z) => ({ prim: { t: "box", at: [x, 14.9, z], s: [3, 0.2, 2.4], c: "#A9D2EE", e: "#FFE2A0", es: 1, glow: "night", solid: false } }))),
      { prim: { t: "box", at: [0, 14.9, 2.4], s: [3.6, 0.2, 4.8], c: "#5A3A2A", solid: false } }, { prim: { t: "box", at: [0, 14, 0.3], s: [10, 2, 0.6], c: "#D8D2C4", solid: false } },
      { p: "flag", at: [-10, 12, 0] }, { prim: { t: "box", at: [0, -6, -0.02], s: [80, 8, 0.06], c: "#474C5A", solid: false } },
      { p: "bus", at: [9, -5.5, 0], text: "SCHOOL BUS", key: "bus" }, { p: "tree", at: [-16, 11, 0] }, { p: "tree", at: [17, 11, 0] }],
    hero: g(-3, 3), two: [g(-6.2, 4), g(-3, 6)], spots: { by_bus: { at: g(4, -1.4) } }, cams: { sign: ins([0, 4, 6], [0, 14.6, 11.4], 30, ["school"]) }, times: ["day", "morning"] }),
  bedroom: side("bedroom", "Kid's bedroom", "a bed, a desk, a window, a poster, a rug, a toy box, a lamp", {
    items: [R({ wall: "#BFD9E8", floor: "#C9A26B" }), { p: "bed", at: [-4.6, 3.0, 0], c: "#E8505B" }, { p: "window", at: [3.2, 5.85, 4.4] }, { p: "desk", at: [5.4, 4.6, 0] },
      { p: "chair", at: [5.4, 3.2, 0], rz: 180 }, { p: "poster", at: [-1.2, 5.88, 4.6], c: "#F2B705" }, { p: "rug", at: [0.6, -0.4, 0], r: 2.6, c: "#3E7CB1" },
      { p: "crate", at: [6.6, -3.6, 0], c: "#7FB86A" }, { p: "floorlamp", at: [-7, -1.2, 0] }],
    two: [g(-1.0, -0.4), g(2.2, -0.4)], spots: { bedside: { at: g(-2.0, 2.4) } }, cams: { bed: ins([-4.6, -2.6, 3.4], [-4.6, 3, 1.4], 26) } }),
  living_room: side("living_room", "Living room", "a sofa, a TV with replaceable text, a coffee table, a rug, a lamp, a window", {
    items: [R({ wall: "#F2E2C4", floor: "#8A5A3A" }), { p: "sofa", at: [0, 4.0, 0], c: "#6A994E" }, { p: "tv", at: [-7.0, 0, 0], rz: 90, text: "NEWS", key: "tv" },
      { p: "desk", at: [0, 1.0, 0], w: 3, d: 1.4, h: 0.9, c: "#6E4428" }, { p: "rug", at: [0, 1.4, 0], r: 3.2 }, { p: "floorlamp", at: [5.6, 4.6, 0] },
      { p: "window", at: [4.2, 5.85, 4.6] }, { p: "frame", at: [-3.8, 5.88, 5.0] }],
    hero: g(0, -1.8), two: [g(-1.6, -1.6), g(1.6, -1.6)], cams: { tv: ins([-1.2, 0, 2.9], [-7, 0, 2.8], 30) } }),
  kitchen: side("kitchen", "Kitchen", "a counter, a stove, a fridge, a table, a window", {
    items: [R({ wall: "#F6F1E4", floor: "#D9C7A7" }), { p: "counter", at: [-2, 5.0, 0], L: 8 }, { p: "stove", at: [3.2, 5.0, 0] }, { p: "fridge", at: [5.8, 4.9, 0] },
      { p: "window", at: [-2, 5.85, 4.8], curtains: "#7FB86A" }, { p: "desk", at: [0, 0.8, 0], w: 3.4, d: 2.0, h: 1.5, c: "#E8D9B0" },
      { p: "chair", at: [-2.6, 0.8, 0], rz: -90, c: "#F2B705" }, { p: "chair", at: [2.6, 0.8, 0], rz: 90, c: "#F2B705" }],
    hero: g(0, -1.8), two: [g(-1.6, -1.6), g(1.6, -1.6)], cams: { stove: ins([3.2, 0.6, 4.4], [3.2, 5, 2.2], 30) } }),
  grandma_room: side("grandma_room", "Grandma's room", "an armchair, a knitting basket, pictures, a cabinet, a lamp, lace curtains", {
    items: [R({ wall: "#E8D0D8", floor: "#8A5A3A" }), { p: "armchair", at: [-3.4, 3.0, 0], rz: 15 }, { p: "basket", at: [-1.2, 2.6, 0] }, { p: "floorlamp", at: [-6, 4.2, 0] },
      { p: "rug", at: [-2.5, 2.2, 0], r: 2.6, c: "#B06AC8" }, ...[-4, 0, 4].map((x, k) => ({ p: "frame", at: [x, 5.88, 5.2], c: ["#E8C07A", "#7FB3D9", "#B5D99C"][k] })),
      { p: "counter", at: [4.6, 5.0, 0], L: 3, h: 2.4, c: "#7A4E30", top: "#5A3A2A" }, { p: "window", at: [1.6, 5.85, 4.4], curtains: "#F4E4F0" }],
    hero: g(1.4, -1.6), two: [g(-0.2, -0.8), g(3.0, -0.8)], cams: { chair: ins([-1.6, -2.2, 3.0], [-3, 3, 1.5], 28) } }),
  shop_inside: side("shop_inside", "Shop inside", "shelves of goods, a counter with a till, a sign", {
    items: [R({ wall: "#FFF1D6", floor: "#C9C4BA" }), ...[-4.6, 0, 4.6].map((x) => ({ p: "shelf", at: [x, 4.4, 0], w: 4 })), { p: "counter", at: [-4.4, 0, 0], L: 5, c: "#E8505B" },
      { p: "till", at: [-5.2, 0, 2.12] }, { p: "poster", at: [0, 5.88, 6.6], w: 6, h: 1.2, text: "OPEN", key: "shop_sign", c: "#2E7D32" }],
    hero: g(2.2, -1.6), two: [g(0.8, -0.6), g(4.0, -0.6)], spots: { keeper: { at: g(-4.4, 2.1), tag: "behind the counter" } }, cams: { shelf: ins([0, 0.2, 3.2], [0, 4.4, 2.8], 30) } }),
  cafe: side("cafe", "Cafe", "a counter with a coffee machine, a menu board with replaceable text, little tables", {
    items: [R({ wall: "#F4E1C1", floor: "#6E4428" }), { p: "counter", at: [3, 3.4, 0], L: 8, c: "#B5523B" }, { p: "coffeemachine", at: [5.4, 3.4, 2.1] },
      { p: "board", at: [3, 5.85, 5.4], w: 5, h: 2, text: "COCOA 2", key: "menu", c: "#2B2B33" }, { p: "cafetable", at: [-4.6, 0.4, 0] }, { p: "cafetable", at: [-4.6, -3.6, 0] },
      { p: "chair", at: [-6.2, 0.4, 0], rz: -90, c: "#3A3A40" }, { p: "window", at: [-4.6, 5.85, 4.4], curtains: null }],
    hero: g(0, -1.8), two: [g(-1.6, -0.9), g(1.6, -0.9)], cams: { menu: ins([3, -0.6, 4.8], [3, 5.8, 5.4], 30, ["menu"]) } }),
  mayor_office: side("mayor_office", "The Mayor's office", "a big desk with a name plate, a big chair, two flags, a portrait, a red carpet", {
    items: [R({ wall: "#6E4428", floor: "#3A2A20" }), { p: "rug", at: [0, 0, 0], r: 4.2, c: "#8C1E2A" }, { p: "desk", at: [0, 2.2, 0], w: 5, d: 2.4, h: 1.7, c: "#4E2A1A", leg: "#4E2A1A" },
      { prim: { t: "box", at: [0, 0.98, 1.2], s: [2.6, 0.08, 0.6], c: "#D9B24A", solid: false } }, { prim: { t: "text", at: [0, 0.92, 1.2], body: "THE MAYOR", size: 0.3, c: "#2B1A10", key: "nameplate", solid: false } },
      { p: "armchair", at: [3.6, 4.4, 0], c: "#7A1E2A" }, { p: "flag", at: [-5.4, 4.8, 0] }, { p: "flag", at: [5.6, 2.0, 0], c1: "#C8283C", c2: "#F4F1EA" },
      { p: "frame", at: [0, 5.88, 5.4], w: 2.4, h: 3, c: "#2B3550" }, { p: "window", at: [-4.6, 5.85, 4.6], curtains: "#8C1E2A" }],
    hero: g(0, -1.8), two: [g(-1.6, -0.4), g(1.6, -0.4)], spots: { mayor: { at: g(0, 4.6), tag: "behind the desk" } }, cams: { nameplate: ins([0.4, -1.6, 2.2], [0, 1, 1.3], 34, ["nameplate"]), mayor_med: { loc: [0.6, -2.4, 3.8], tgt: [0, 4.6, 2.9], lens: 30, shot: "medium", people: ["mayor"] } } }),
  control_room: side("control_room", "The secret control room", "a wall of screens showing the town, a console with levers and big labelled buttons, one huge red button under a cover", {
    items: [R({ wall: "#1C2030", floor: "#22262F", trim: "#3A4050" }), { p: "screens", at: [0, 5.8, 4.6], cols: 5, rows: 3, tag: "obj_screens" }, { p: "console", at: [-2, 2.5, 0], L: 9, labels: ["RAIN", "SUN", "STORM"] },
      { p: "redbutton", at: [5, 2.5, 0], tag: "obj_red" }, { prim: { t: "light", at: [0, 3.2, 5], w: 250, c: "#6AB0E8", solid: false } }],
    hero: g(0, -0.8), two: [g(-1.6, -0.6), g(1.6, -0.6)], spots: { mayor: { at: g(-2, 4.8), tag: "behind the console" }, at_red: { at: g(5, -0.6), tag: "at the red button" } },
    cams: { red: ins([5, -1.0, 3.2], [5, 2.5, 1.0], 30, ["red_label"]), buttons: ins([-3.5, -0.6, 3.4], [-3.4, 2.0, 1.4], 30, ["btn1", "btn2", "btn3"]), screens: ins([0, -6, 4.6], [0, 5.8, 4.6], 24),
      mayor_med: { loc: [-1.6, -4.5, 6.4], tgt: [-2, 4.8, 2.2], lens: 30, shot: "top", people: ["mayor"], fixed: true },
      press_side: { loc: [0.8, -8.4, 4.6], tgt: [4.9, 0.6, 1.5], lens: 24, shot: "medium", people: ["at_red"], fixed: true } }, times: ["night", "dusk"], states: { red: "covered", screens: "town" } }),
  townhall_front: side("townhall_front", "Town hall front", "the town hall with columns, steps and its sign; flower beds; old lamps", {
    indoor: false, ground: { c: "#B9AA8E" }, far: 1.15,
    items: [{ p: "townhall", at: [0, 8, 0], sign: "TOWN HALL", key: "townhall" }, { p: "flowerbed", at: [-9, 5.5, 0] }, { p: "flowerbed", at: [9, 5.5, 0] }, { p: "lamp", at: [-13, 4, 0], style: "old", h: 6.5 }, { p: "lamp", at: [13, 4, 0], style: "old", h: 6.5 }],
    hero: g(0, 1.5), two: [g(-1.6, 2.6), g(1.6, 2.6)], spots: { on_steps: { at: g(5.5, 6.4) } }, cams: { sign: ins([0, 0, 7], [0, 8.6, 12.2], 30, ["townhall"]) } }),
  playground: side("playground", "Park playground", "a slide, swings, a sandbox, a bench, trees, a fence", {
    indoor: false, ground: { c: "#79B85A" }, far: 1.3,
    items: [{ p: "slide", at: [-5, 5, 0] }, { p: "swing", at: [4.5, 6, 0] }, { p: "sandbox", at: [-6.5, -2, 0] }, { p: "bench", at: [6.5, -1, 0], rz: -90 }, { p: "tree", at: [-11, 10, 0] }, { p: "tree", at: [10, 11, 0] }, { p: "fence", at: [0, 11, 0], L: 26 }],
    hero: g(0, 0), two: [g(-1.6, 1.0), g(1.6, 1.0)], cams: { swing: ins([4.5, -1, 3.4], [4.5, 6, 2.0], 28) } }),
  basketball: side("basketball", "Basketball court", "a blue court with lines, two hoops, a tall fence, a bench", {
    indoor: false, ground: { c: "#7FAF5A" }, far: 1.3,
    items: [{ prim: { t: "box", at: [0, 4, 0.02], s: [22, 26, 0.04], c: "#3E7CB1", solid: false } }, { prim: { t: "cyl", at: [0, 4, 0.05], r: 3, h: 0.03, c: "#FFFFFF", v: 40, solid: false } }, { prim: { t: "cyl", at: [0, 4, 0.06], r: 2.8, h: 0.03, c: "#3E7CB1", v: 40, solid: false } },
      { prim: { t: "box", at: [0, 4, 0.06], s: [22, 0.2, 0.03], c: "#FFFFFF", solid: false } }, { p: "hoop", at: [0, 14.5, 0] }, { p: "fence", at: [0, 16.5, 0], L: 26, h: 4.5, c: "#9AA4B0" }, { p: "bench", at: [-9, 8, 0], rz: 90 }],
    hero: g(0, 0), two: [g(-1.6, 1.0), g(1.6, 1.0)], cams: { hoop: ins([1, 6, 3.2], [0, 14.4, 6.6], 28) } }),
  hospital_room: side("hospital_room", "Hospital room", "a hospital bed, a heart monitor, a chair, a window with light curtains", {
    items: [R({ wall: "#DDEFF0", floor: "#C9D6D8" }), { p: "hospitalbed", at: [-3.2, 2.6, 0] }, { p: "monitor", at: [-0.6, 4.6, 0] }, { p: "window", at: [4.2, 5.85, 4.4], curtains: "#8FC3E3" }, { p: "chair", at: [4.6, 1.6, 0], c: "#5A8FB0" }],
    hero: g(1.4, -1.6), two: [g(-0.2, -0.8), g(3.0, -0.8)], spots: { bedside: { at: g(0.9, 2.4) } }, cams: { monitor: ins([-0.6, 1.4, 3.8], [-0.6, 4.4, 3.6], 30) } }),
  police_front: side("police_front", "Police station front", "the police station with its sign and a blue lamp, a police car", {
    indoor: false, ground: { c: "#C9C4BA" }, far: 1.15,
    items: [{ prim: { t: "box", at: [0, 15, 5.5], s: [26, 10, 11], c: "#D9DCE3" } }, { prim: { t: "box", at: [0, 9.8, 8.2], s: [10, 0.4, 1.8], c: "#1E3A8A", solid: false } },
      { prim: { t: "text", at: [0, 9.55, 8.2], body: "POLICE", size: 1.1, c: "#FFFFFF", key: "police", solid: false } }, { p: "bluelight", at: [0, 9.6, 10.0] },
      { prim: { t: "box", at: [0, 9.9, 2.4], s: [3.4, 0.2, 4.8], c: "#2B3550", solid: false } }, ...[-8, 8].map((x) => ({ prim: { t: "box", at: [x, 9.9, 4], s: [3.4, 0.2, 2.6], c: "#A9D2EE", e: "#FFE2A0", es: 1, glow: "night", solid: false } })),
      { p: "car", at: [9, 1.5, 0], c: "#F2F2F2" }, { prim: { t: "box", at: [9.4, 1.5, 3.05], s: [0.6, 2.2, 0.35], c: "#1E4FD8", e: "#3060FF", es: 3, solid: false } }, { prim: { t: "box", at: [9, 1.5, 1.4], s: [5, 3.36, 0.5], c: "#1E3A8A", solid: false } }],
    hero: g(-3, 2), two: [g(-5.2, 3), g(-2, 4.6)], cams: { sign: ins([0, 2, 6], [0, 9.6, 8.6], 30, ["police"]) } }),
  basement: side("basement", "Basement", "a boiler, pipes, shelves, a bare bulb, boxes", {
    items: [R({ wall: "#7A7A72", floor: "#5A5A55", trim: "#6A6A64" }), { p: "boiler", at: [-5.2, 3.6, 0] }, { p: "pipes", at: [0, 5.4, 6.6], L: 16 }, { p: "shelf", at: [4.6, 4.4, 0], c: "#6E6E66" },
      { p: "bulb", at: [0, 0.5, 6.2] }, { p: "crate", at: [5.8, -2.4, 0] }, { p: "crate", at: [5.8, -2.4, 1.4], s: 1.1 }],
    light: { lamp_at: [0, 0.5, 6.0] }, cams: { boiler: ins([-3.2, 0, 3.6], [-5.2, 3.4, 2.0], 28) } }),
  attic: side("attic", "Attic", "a sloping roof, an old trunk, boxes, a round window, a bare bulb", {
    items: [R({ wall: "#B98A55", floor: "#8A6A44", trim: "#7A5A3A" }), { p: "slope", at: [0, 0, 0] }, { p: "trunk", at: [-3.4, 2.4, 0] }, { p: "crate", at: [4.8, 2.6, 0] }, { p: "crate", at: [6.2, 0.4, 0], s: 1.2 },
      { prim: { t: "cyl", at: [0, 5.85, 3.2], r: 1.0, h: 0.12, c: "#BFE3FF", win: true, e: "#BFE3FF", es: 0.8, rx: 90, v: 32, solid: false } }, { p: "bulb", at: [0, 0.2, 5.6] }],
    cams: { trunk: ins([-2.4, -0.6, 3.0], [-3.4, 2.4, 1.0], 28) } }),
  forest_edge: side("forest_edge", "Forest edge", "tall pines, bushes, a path into the trees, fallen logs", {
    indoor: false, ground: { c: "#4E7A3A" }, far: 1.3,
    items: [{ prim: { t: "box", at: [0, 8, 0.02], s: [3.4, 24, 0.04], c: "#A68A64", solid: false } }, ...[[-6, 8], [-10, 12], [-4, 16], [6, 9], [10, 13], [4, 17], [-14, 6], [14, 6], [-8, 20], [9, 21]].map(([x, y], k) => ({ p: "pine", at: [x, y, 0], h: 10 + (k % 3) * 2 })),
      { p: "bush", at: [-4.5, 3.4, 0] }, { p: "bush", at: [5, 3.6, 0] }, { p: "log", at: [-7, 1.6, 0] }],
    hero: g(0, 0), two: [g(-1.6, 1.0), g(1.6, 1.0)], creature_spots: { cr_trees: { at: [0, 19, 0], far: true } }, cams: { path: ins([0.5, -2, 3.0], [0, 14, 2.4], 26) } }),
  alley: side("alley", "Dark alley", "two brick walls, bins, crates, a puddle, one old lamp", {
    indoor: false, ground: { c: "#3E4048" }, far: 1.2,
    items: [{ p: "brickwall", at: [-5, 6, 0], rz: 90, L: 26 }, { p: "brickwall", at: [5, 6, 0], rz: -90, L: 26 }, { p: "brickwall", at: [0, 18.8, 0], L: 10 },
      { p: "bin", at: [-3.6, 9, 0] }, { p: "bin", at: [-3.6, 10.6, 0], c: "#3A3A40" }, { p: "crate", at: [3.6, 12, 0] }, { prim: { t: "box", at: [1, 4, 0.02], s: [2.6, 3.4, 0.03], c: "#2A3344", rough: 0.05, solid: false } },
      { p: "lamp", at: [4.2, 14, 0], style: "old", h: 5.5 }],
    hero: g(0, 2), two: [g(-1.6, 3.0), g(1.6, 3.0)], creature_spots: { cr_end: { at: [0, 15.6, 0], far: true } }, cams: { bins: ins([-1, 5, 2.8], [-3.6, 9.8, 1.2], 28) }, times: ["dusk", "night"] }),
  rooftop: side("rooftop", "Rooftop", "a flat roof with a low wall, air units, a water tank, the city's towers around", {
    indoor: false, ground: { c: "#6E6E66" }, far: 1.3,
    items: [{ prim: { t: "box", at: [0, 14, 0.6], s: [30, 0.5, 1.2], c: "#8A8A82" } }, { prim: { t: "box", at: [-15, 4, 0.6], s: [0.5, 20, 1.2], c: "#8A8A82" } }, { prim: { t: "box", at: [15, 4, 0.6], s: [0.5, 20, 1.2], c: "#8A8A82" } },
      { p: "acunit", at: [-8, 9, 0] }, { p: "acunit", at: [-4.6, 9, 0] }, { p: "watertank", at: [9, 9, 0] }, { prim: { t: "cyl", at: [-11, 11, 4], r: 0.1, h: 8, c: "#5A5F66", solid: false } },
      ...[[-40, 70, 60], [-15, 90, 80], [15, 80, 70], [42, 66, 55], [0, 120, 100]].map(([x, y, h], k) => ({ p: "tower", at: [x, y, -40], w: 16, d: 16, h, i: k }))],
    hero: g(0, 1.5), two: [g(-1.6, 2.6), g(1.6, 2.6)], cams: { tank: ins([5, 1, 4], [9, 9, 5.5], 26) }, times: ["day", "night"] }),
};
