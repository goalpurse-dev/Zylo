// IN THIS TOWN v2, NIGHT BUILD: SIDE SET PIECES (added to the one prefab library P; same conventions as prefabs.mjs).
// A room is open toward -y: floor, back wall (y = d/2), side walls; furniture stands inside x in [-w/2, w/2].
import { P, box, cyl, sph, txt, lit } from "./prefabs.mjs";

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const SCR = (at, s, c, o = {}) => box(at, s, c, { e: c, es: 1.4, solid: false, ...o });
Object.assign(P, {
  room({ w = 16, d = 12, h = 8, wall = "#E9D9B8", floor = "#A9764E", trim = "#F4EEE2", ceiling = true, run = 12 } = {}) {
    // the side walls and the ceiling run `run` past the open side, so a wide camera never sees void above or beside them
    const o = [box([0, -2 - run / 2, -0.1], [w + 8, d + 12 + run, 0.2], floor, { solid: false, rough: 0.7 }), box([0, d / 2 + 0.15, h / 2], [w + 0.6, 0.3, h], wall, { tag: "wall" }),
      box([-w / 2 - 0.15, -run / 2, h / 2], [0.3, d + run, h], wall, { tag: "wall", solid: false }), box([w / 2 + 0.15, -run / 2, h / 2], [0.3, d + run, h], wall, { tag: "wall", solid: false }),
      box([-w / 2 - 0.15, 0, h / 2], [0.3, d, h], wall, { solid: true, sc: [0.001, 1, 1] }), box([w / 2 + 0.15, 0, h / 2], [0.3, d, h], wall, { solid: true, sc: [0.001, 1, 1] }),
      box([0, d / 2 - 0.05, 0.25], [w, 0.12, 0.5], trim, { solid: false }), box([-w / 2 + 0.05, 0, 0.25], [0.12, d, 0.5], trim, { solid: false }), box([w / 2 - 0.05, 0, 0.25], [0.12, d, 0.5], trim, { solid: false })];
    if (ceiling) o.push(box([0, -run / 2, h + 0.1], [w + 0.6, d + run, 0.2], wall, { solid: false, tag: "wall" }));
    return o;
  },
  window({ w = 3.6, h = 3, curtains = "#B84A4A" } = {}) {
    const o = [box([0, -0.05, 0], [w, 0.12, h], "#BFE3FF", { win: true, e: "#BFE3FF", es: 0.8, solid: false }),
      box([0, -0.12, h / 2], [w + 0.4, 0.2, 0.22], "#F4EEE2", { solid: false }), box([0, -0.12, -h / 2], [w + 0.5, 0.3, 0.25], "#F4EEE2", { solid: false }),
      box([-w / 2, -0.12, 0], [0.2, 0.2, h], "#F4EEE2", { solid: false }), box([w / 2, -0.12, 0], [0.2, 0.2, h], "#F4EEE2", { solid: false }), box([0, -0.12, 0], [0.1, 0.16, h], "#F4EEE2", { solid: false })];
    if (curtains) for (const s of [-1, 1]) o.push(box([s * (w / 2 + 0.5), -0.35, -0.1], [1.0, 0.15, h + 0.6], curtains, { solid: false }));
    return o;
  },
  door({ c = "#7A4E30" } = {}) {
    return [box([0, -0.06, 2.2], [2.4, 0.15, 4.4], c, { solid: false }), box([0, -0.1, 4.5], [2.9, 0.2, 0.25], "#F4EEE2", { solid: false }), sph([0.85, -0.2, 2.1], 0.11, "#D9B24A", { solid: false })];
  },
  board({ w = 7, h = 3, text = "MONDAY", key = "board", c = "#2F5D4A" } = {}) {
    return [box([0, -0.05, 0], [w + 0.4, 0.12, h + 0.4], "#8A5A3A", { solid: false }), box([0, -0.12, 0], [w, 0.06, h], c, { solid: false }),
      txt([0, -0.17, 0.2], text, h * 0.22, "#F4F4EC", { key }), box([0, -0.35, -h / 2 - 0.2], [w * 0.8, 0.4, 0.08], "#8A5A3A", { solid: false })];
  },
  poster({ w = 2.2, h = 3, text = "", key = null, c = "#3E7CB1" } = {}) {
    return [box([0, -0.04, 0], [w, 0.04, h], c, { solid: false }), ...(text ? [txt([0, -0.08, 0], text, w * 0.16, "#FFFFFF", key ? { key } : {})] : [])];
  },
  wallclock({ r = 0.8 } = {}) {
    return [cyl([0, -0.06, 0], r, 0.12, "#FFFFFF", { rx: 90, v: 32, solid: false }), cyl([0, -0.02, 0], r + 0.08, 0.1, "#2B2B33", { rx: 90, v: 32, solid: false }),
      box([0, -0.14, r * 0.25], [0.08, 0.04, r * 0.5], "#1A1A1A", { solid: false }), box([r * 0.3, -0.14, 0], [r * 0.6, 0.04, 0.06], "#1A1A1A", { solid: false })];
  },
  desk({ w = 2.6, d = 1.6, h = 1.55, c = "#C9A26B", leg = "#5A5F66" } = {}) {
    const o = [box([0, 0, h], [w, d, 0.12], c)];
    for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) for (const y of [-d / 2 + 0.12, d / 2 - 0.12]) o.push(box([x, y, h / 2], [0.1, 0.1, h], leg, { solid: false }));
    return o;
  },
  chair({ c = "#3E7CB1", h = 1.0 } = {}) {
    return [box([0, 0, h], [1.1, 1.0, 0.12], c), box([0, 0.5, h + 0.7], [1.1, 0.12, 1.3], c, { solid: false }),
      ...[[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]].map(([x, y]) => box([x, y, h / 2], [0.08, 0.08, h], "#5A5F66", { solid: false }))];
  },
  lockers({ n = 6, c = "#3E7CB1", h = 5.2 } = {}) {
    const o = [];
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * 1.3; o.push(box([x, 0.5, h / 2], [1.25, 1.0, h], c), box([x, -0.02, h - 0.8], [0.8, 0.04, 0.12], "#1E3A5A", { solid: false }), box([x, -0.02, h - 1.1], [0.8, 0.04, 0.12], "#1E3A5A", { solid: false }), box([x + 0.4, -0.04, h / 2], [0.1, 0.06, 0.4], "#C9CED6", { solid: false })); }
    return o;
  },
  bed({ c = "#3E7CB1", L = 5.2, w = 2.8 } = {}) {
    return [box([0, 0, 0.6], [w, L, 0.7], "#8A5A3A"), box([0, -0.2, 1.1], [w - 0.1, L - 0.6, 0.35], "#FFFFFF", { solid: false }), box([0, -0.5, 1.32], [w, L - 1.6, 0.18], c, { solid: false }),
      box([0, L / 2 - 0.7, 1.4], [w * 0.7, 0.9, 0.35], "#F4F0E6", { solid: false }), box([0, L / 2 + 0.05, 1.5], [w + 0.2, 0.25, 2.4], "#8A5A3A", { solid: false })];
  },
  sofa({ c = "#6A994E", w = 6 } = {}) {
    return [box([0, 0, 0.6], [w, 2.4, 1.2], c), box([0, 1.0, 1.8], [w, 0.5, 1.6], c, { solid: false }), box([-w / 2 + 0.3, 0, 1.4], [0.6, 2.4, 0.8], c, { solid: false }), box([w / 2 - 0.3, 0, 1.4], [0.6, 2.4, 0.8], c, { solid: false })];
  },
  armchair({ c = "#B5523B" } = {}) {
    return [box([0, 0, 0.6], [2.4, 2.2, 1.2], c), box([0, 0.9, 1.9], [2.4, 0.5, 1.8], c, { solid: false }), box([-1.05, 0, 1.4], [0.4, 2.2, 0.8], c, { solid: false }), box([1.05, 0, 1.4], [0.4, 2.2, 0.8], c, { solid: false })];
  },
  tv({ w = 4.2, h = 2.4, text = "", key = "tv", z = 2.8 } = {}) {
    return [box([0, 0.4, 0.7], [w + 1, 1.2, 1.4], "#6E4428"), box([0, 0.2, z], [w + 0.2, 0.25, h + 0.2], "#1A1A1E", { solid: false }),
      box([0, 0.05, z], [w, 0.1, h], "#5AA8E8", { e: "#6AB8F0", es: 1.2, solid: false }), ...(text ? [txt([0, -0.05, z], text, h * 0.16, "#FFFFFF", { key, e: "#FFFFFF", es: 2 })] : [])];
  },
  rug({ r = 3, c = "#C8553D" } = {}) { return [cyl([0, 0, 0.02], r, 0.04, c, { v: 32, solid: false }), cyl([0, 0, 0.03], r * 0.7, 0.04, "#E8C07A", { v: 32, solid: false })]; },
  shelf({ w = 4, h = 5, c = "#8A5A3A", goods = ["#E05A5A", "#F2C14E", "#4C8FD6", "#7FB86A", "#B06AC8"] } = {}) {
    const o = [box([0, 0.5, h / 2], [w, 1.0, h], c)];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) o.push(box([-w / 2 + 0.45 + k * (w - 0.9) / 4, -0.05, 0.6 + r * (h - 0.9) / 3.4], [0.6, 0.6, 0.7 + ((k + r) % 3) * 0.15], pick(goods, k + r * 2), { solid: false }));
    return o;
  },
  counter({ L = 6, h = 2.0, c = "#D9C7A7", top = "#5A5F66" } = {}) { return [box([0, 0, h / 2], [L, 1.6, h], c), box([0, 0, h + 0.06], [L + 0.2, 1.8, 0.12], top, { solid: false })]; },
  fridge() { return [box([0, 0, 2.6], [2.0, 1.8, 5.2], "#E8ECEF"), box([0.8, -0.95, 3.6], [0.12, 0.1, 1.2], "#9AA4B0", { solid: false }), box([0, -0.92, 2.0], [1.9, 0.04, 0.06], "#C9CED6", { solid: false })]; },
  stove() { return [box([0, 0, 1.0], [2.0, 1.6, 2.0], "#DADDE2"), cyl([-0.45, -0.3, 2.04], 0.32, 0.06, "#222222", { v: 16, solid: false }), cyl([0.45, -0.3, 2.04], 0.32, 0.06, "#222222", { v: 16, solid: false }), box([0, -0.82, 1.0], [1.6, 0.04, 1.1], "#2B2B33", { solid: false })]; },
  floorlamp({ c = "#F2E2B8" } = {}) { return [cyl([0, 0, 2.0], 0.08, 4.0, "#3A3A40", { v: 8 }), cyl([0, 0, 4.2], 0.8, 0.9, c, { v: 16, r2: 0.5, e: "#FFE6B0", es: 1.2, solid: false }), lit([0, 0, 4.0], 120, "#FFD8A0")]; },
  frame({ w = 2.0, h = 1.6, c = "#7FB3D9" } = {}) { return [box([0, -0.04, 0], [w + 0.3, 0.08, h + 0.3], "#8A5A3A", { solid: false }), box([0, -0.09, 0], [w, 0.04, h], c, { solid: false })]; },
  basket() { return [cyl([0, 0, 0.45], 0.7, 0.9, "#B98A55", { v: 16 }), sph([-0.2, 0, 0.95], 0.35, "#E05A8A", { solid: false, v: 10 }), sph([0.25, 0.1, 0.92], 0.3, "#5C8FD6", { solid: false, v: 10 })]; },
  till() { return [box([0, 0, 0.35], [1.4, 1.0, 0.7], "#2B2B33", { solid: false }), box([0, 0.2, 0.95], [1.1, 0.12, 0.7], "#5AA8E8", { e: "#5AA8E8", es: 1, rx: -20, solid: false })]; },
  cafetable({ c = "#FFFFFF" } = {}) { return [cyl([0, 0, 1.6], 1.1, 0.1, c, { v: 24 }), cyl([0, 0, 0.8], 0.1, 1.6, "#3A3A40", { v: 8, solid: false }), cyl([0.3, 0.2, 1.8], 0.18, 0.3, "#F4F0E6", { v: 12, solid: false })]; },
  coffeemachine() { return [box([0, 0, 1.0], [1.4, 1.0, 2.0], "#3A3A40"), box([0, -0.52, 1.3], [0.9, 0.04, 0.5], "#E8505B", { e: "#E8505B", es: 1, solid: false })]; },
  flag({ c1 = "#3D7BE0", c2 = "#F2C14E" } = {}) { return [cyl([0, 0, 3.0], 0.08, 6.0, "#D9B24A", { v: 8 }), box([0.9, 0, 4.9], [1.8, 0.04, 0.6], c1, { solid: false }), box([0.9, 0, 4.3], [1.8, 0.04, 0.6], c2, { solid: false })]; },
  // the control room's wall of screens: each screen shows a little town view (sky, buildings, a street) and a REC dot
  screens({ cols = 5, rows = 3, sw = 2.6, sh = 1.7 } = {}) {
    const o = [box([0, 0.3, 0], [cols * (sw + 0.25) + 0.4, 0.4, rows * (sh + 0.25) + 0.4], "#15181F", { solid: false })];
    const skies = ["#7FC8F8", "#6AB0E8", "#F2A65A", "#1E3A6A", "#8FD4F0"];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * (sw + 0.25), z = (r - (rows - 1) / 2) * (sh + 0.25);
      o.push(SCR([x, 0.05, z], [sw, 0.1, sh], pick(skies, c + r * 2)), SCR([x, -0.01, z - sh * 0.38], [sw, 0.06, sh * 0.22], "#6FB04A"));
      for (let b = 0; b < 3; b++) o.push(SCR([x - sw * 0.3 + b * sw * 0.3, -0.03, z - sh * 0.1 + ((b + c) % 2) * 0.15], [sw * 0.22, 0.05, sh * (0.35 + ((b + r) % 3) * 0.1)], pick(["#F28B82", "#FDD663", "#8AB4F8", "#C58AF9"], b + c + r)));
      o.push(sph([x + sw * 0.4, -0.08, z + sh * 0.36], 0.08, "#FF2020", { e: "#FF2020", es: 5, solid: false }));
    }
    return o;
  },
  // a console desk with levers and a row of big labelled buttons (texts replaceable: btn1, btn2, btn3)
  console({ L = 9, labels = ["RAIN", "SUN", "STORM"], cols = ["#3D7BE0", "#F2B705", "#7FB86A"] } = {}) {
    const o = [box([0, 0, 1.1], [L, 2.2, 2.2], "#2B2F3A"), box([0, -0.2, 2.35], [L + 0.2, 2.6, 0.2], "#3A4050", { rx: -12, solid: false })];
    labels.forEach((t, k) => { const x = -L / 2 + 1.6 + k * 2.2; o.push(cyl([x, -0.3, 2.62], 0.55, 0.32, cols[k % 3], { v: 24, e: cols[k % 3], es: 0.6, solid: false, rx: -12 }), box([x, -1.12, 1.6], [1.9, 0.06, 0.6], "#E9E6DE", { solid: false }), txt([x, -1.17, 1.6], t, 0.26, "#15181F", { key: `btn${k + 1}` })); });
    for (let k = 0; k < 3; k++) { const x = L / 2 - 2.4 + k * 0.7; o.push(box([x, 0.2, 2.9], [0.12, 0.12, 1.2], "#C9CED6", { rx: -20 + k * 15, solid: false }), sph([x, 0.0, 3.5], 0.18, "#E53935", { solid: false, v: 10 })); }
    return o;
  },
  // THE huge red button under a clear cover, on its own pedestal, with a label plate (key red_label)
  redbutton({ label = "DO NOT PRESS" } = {}) {
    return [cyl([0, 0, 1.2], 1.4, 2.4, "#2B2F3A", { v: 24 }), cyl([0, 0, 2.6], 1.0, 0.45, "#E01E1E", { v: 32, e: "#FF2A2A", es: 1.2, solid: false, only: "red=covered|open" }),
      cyl([0, 0, 2.47], 1.0, 0.2, "#FF3030", { v: 32, e: "#FF2A2A", es: 7, solid: false, only: "red=pressed" }), lit([0, -1.5, 3.5], 900, "#FF2020", { only: "red=pressed" }),
      sph([0, 0, 2.6], 1.25, "#DDEEFF", { sc: [1, 1, 0.7], alpha: 0.28, rough: 0.05, solid: false, only: "red=covered" }),
      sph([0, 1.3, 3.9], 1.25, "#DDEEFF", { sc: [1, 1, 0.7], rx: -60, alpha: 0.28, rough: 0.05, solid: false, only: "red=open|pressed" }), box([0, -1.42, 1.5], [2.0, 0.06, 0.6], "#F2C14E", { solid: false }),
      txt([0, -1.47, 1.5], label, 0.24, "#15181F", { key: "red_label" })];
  },
  hospitalbed() { return [box([0, 0, 1.3], [2.6, 5.0, 0.5], "#E8ECEF"), box([0, 0.2, 1.7], [2.5, 4.4, 0.35], "#FFFFFF", { solid: false }), box([0, -0.4, 1.95], [2.6, 3.0, 0.15], "#8FC3E3", { solid: false }), box([0, 2.3, 2.3], [2.7, 0.2, 1.8], "#C9CED6", { solid: false }), cyl([0, 0, 0.6], 0.1, 1.2, "#9AA4B0", { v: 8, solid: false })]; },
  monitor() { return [cyl([0, 0, 1.6], 0.08, 3.2, "#9AA4B0", { v: 8 }), box([0, -0.1, 3.6], [1.4, 0.3, 1.0], "#1A1A1E", { solid: false }), box([0, -0.27, 3.6], [1.2, 0.04, 0.8], "#0E2A18", { e: "#0E2A18", es: 1, solid: false }),
    ...[0, 1, 2, 3, 4].map((k) => box([-0.45 + k * 0.22, -0.3, 3.6 + (k === 2 ? 0.18 : 0)], [0.2, 0.03, 0.05], "#3CFF7A", { e: "#3CFF7A", es: 4, ry: k === 2 ? 60 : 0, solid: false }))]; },
  boiler() { return [cyl([0, 0, 2.4], 1.3, 4.8, "#7A8088", { v: 20 }), cyl([0, -1.3, 1.2], 0.35, 0.2, "#FF7A1A", { rx: 90, e: "#FF7A1A", es: 2, v: 16, solid: false }), cyl([0.9, 0, 6.0], 0.2, 3.0, "#5A5F66", { v: 10, solid: false })]; },
  bulb() { return [cyl([0, 0, 0.8], 0.03, 1.6, "#222222", { v: 6, solid: false }), sph([0, 0, 0], 0.22, "#FFF2C0", { e: "#FFE6A0", es: 8, solid: false }), lit([0, 0, -0.3], 260, "#FFD8A0")]; },
  pipes({ L = 14 } = {}) { return [cyl([0, 0, 0], 0.22, L, "#6E747C", { ry: 90, v: 12, solid: false }), cyl([0, 0, -0.7], 0.15, L, "#8C6E4E", { ry: 90, v: 10, solid: false })]; },
  trunk() { return [box([0, 0, 0.8], [2.8, 1.6, 1.6], "#7A4E30"), box([0, 0, 1.62], [2.9, 1.7, 0.1], "#D9B24A", { solid: false }), box([0, -0.82, 1.2], [0.3, 0.06, 0.4], "#D9B24A", { solid: false })]; },
  slope({ w = 16, d = 12, h = 8, c = "#B98A55" } = {}) { return [box([0, d / 2 - 1.5, h * 0.62], [w + 0.6, d * 0.75, 0.3], c, { rx: -38, solid: false })]; },
  bush({ r = 1.4, c = "#4E8F3A" } = {}) { return [sph([0, 0, r * 0.6], r, c, { sc: [1.2, 1, 0.8], v: 12 })]; },
  log() { return [cyl([0, 0, 0.45], 0.45, 3.2, "#7A5233", { ry: 90, v: 12 })]; },
  brickwall({ L = 20, h = 12, c = "#9C4A3A" } = {}) { const o = [box([0, 0, h / 2], [L, 0.6, h], c)]; for (let z = 1.0; z < h; z += 1.2) o.push(box([0, -0.31, z], [L, 0.04, 0.1], "#7A3A2E", { solid: false })); return o; },
  acunit() { return [box([0, 0, 1.0], [2.4, 1.8, 2.0], "#C9CED6"), cyl([0, -0.92, 1.1], 0.7, 0.06, "#5A5F66", { rx: 90, v: 16, solid: false })]; },
  watertank() { return [cyl([0, 0, 5.5], 2.2, 4.0, "#8C6E4E", { v: 16 }), cyl([0, 0, 8.0], 2.4, 1.0, "#5A5F66", { v: 16, r2: 0.3, solid: false }), ...[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map(([x, y]) => cyl([x, y, 1.75], 0.15, 3.5, "#3A3A40", { v: 8, solid: false }))]; },
  sandbox() { return [box([0, 0, 0.25], [5, 5, 0.5], "#C9A26B", { solid: false }), box([0, 0, 0.3], [4.4, 4.4, 0.5], "#F0D9A0", { solid: false })]; },
  bluelight() { return [box([0, 0, 0.25], [1.2, 0.6, 0.5], "#1E4FD8", { e: "#3060FF", es: 4, solid: false }), lit([0, -0.8, 0], 300, "#4060FF", { when: "night" })]; },
});
export { P };
