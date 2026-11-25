// IN THIS TOWN v2, NIGHT BUILD: THE PREFAB LIBRARY (data -> simple shapes). One builder for every place: a place is a
// data file listing prefab instances; expand() turns them into primitives (box / cyl / sph / text / light) in world
// units, and derives the obstacles the free checks use FROM THE SAME SHAPES (nothing is typed twice).
// Conventions: Blender units at the town scale (a kid 3.04 tall, an adult 3.5, a storey ~5.5); x along the street,
// y away from the cameras, z up. A prefab is built in LOCAL coords with its FRONT facing -y; `at` of a primitive is its
// CENTRE. Instance rotation rz (degrees) turns the whole prefab about z. Our own designs only; no logos or brand text.
//   primitive options: rx/ry/rz (deg), e (emit hex), es (emit strength), glow:"night" (emits only after dark),
//   rough, metal, alpha, sc ([x,y,z] scale), v (verts), r2 (top radius), solid (false = never an obstacle),
//   move ([dx,dy,dz] over the shot), key (text key a story can replace), when ("night"|"day"), tag (a named group)

const rad = (d) => (d * Math.PI) / 180;
const rot2 = (x, y, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [x * c - y * s, x * s + y * c]; };
export const box = (at, s, c, o = {}) => ({ t: "box", at, s, c, ...o });
export const cyl = (at, r, h, c, o = {}) => ({ t: "cyl", at, r, h, c, ...o });
export const sph = (at, r, c, o = {}) => ({ t: "sph", at, r, c, ...o });
export const txt = (at, body, size, c, o = {}) => ({ t: "text", at, body, size, c, solid: false, ...o });
export const lit = (at, w, c, o = {}) => ({ t: "light", at, w, c, solid: false, ...o });

/** move a list of local primitives to `at`, turned by rz */
export function xf(prims, at = [0, 0, 0], rz = 0, extra = {}) {
  return prims.map((p) => {
    const [x, y] = rot2(p.at[0], p.at[1], rz);
    const q = { ...p, ...extra, at: [at[0] + x, at[1] + y, (at[2] ?? 0) + p.at[2]], rz: (p.rz ?? 0) + rz };
    if (p.move) { const [mx, my] = rot2(p.move[0], p.move[1], rz); q.move = [mx, my, p.move[2] ?? 0]; }
    return q;
  });
}
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const hash = (i) => { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };

const GLASS = "#A9D2EE", WARM = "#FFE2A0", DARK = "#2E2A2A";
// ------------------------------------------------------------------------------------------------- BUILDINGS
export const P = {
  // a colourful shop: two storeys, a striped awning, a sign board with replaceable text, shop window lit at night
  shop({ w = 11, d = 8, h = 11, c = "#F28B82", c2 = "#FFFFFF", awn = ["#E53935", "#FFFFFF"], sign = "SHOP", key = null, i = 0 } = {}) {
    const o = [box([0, d / 2, h / 2], [w, d, h], c), box([0, d / 2 - 0.06, h * 0.75 + 0.1], [w - 0.4, d, h * 0.5 - 1.2], c, { wg: [2.2, 2.6], solid: false }), box([0, d / 2, h + 0.3], [w + 0.4, d + 0.4, 0.6], c2, { solid: false }),
      box([0, -0.1, 5.9], [w, 0.3, 0.35], c2, { solid: false }),
      box([-w * 0.17, -0.06, 2.6], [w * 0.46, 0.2, 3.4], GLASS, { e: WARM, es: 1.4, glow: "night", rough: 0.1, solid: false }),
      box([w * 0.3, -0.06, 2.2], [2.3, 0.2, 4.4], "#5A3A2A", { solid: false }),
      box([w * 0.3, -0.12, 3.3], [1.3, 0.1, 1.3], GLASS, { e: WARM, es: 1.0, glow: "night", solid: false }),
      box([0, -0.2, 7.0], [w * 0.72, 0.3, 1.5], "#FFF8EC", { solid: false }),
      txt([0, -0.4, 7.0], sign, 0.95, "#2B2B33", key ? { key } : {})];
    const n = 6, sw = (w * 0.96) / n;
    for (let k = 0; k < n; k++) o.push(box([-w * 0.48 + sw * (k + 0.5), -1.35, 5.0], [sw, 2.9, 0.14], awn[k % 2], { rx: -16, solid: false }));
    const nw = Math.max(2, Math.floor(w / 3.6));
    for (let k = 0; k < nw; k++) o.push(box([-w / 2 + (w / nw) * (k + 0.5), -0.06, 8.9], [1.7, 0.2, 2.1], GLASS, { e: WARM, es: hash(i * 7 + k) > 0.35 ? 1.2 : 0, glow: "night", rough: 0.1, solid: false }));
    return o;
  },
  // a glass tower behind the town: a body, floor bands, windows lit at random after dark
  tower({ w = 14, d = 14, h = 60, c = "#7FB4DA", band = "#E6F2FA", i = 0 } = {}) {
    const o = [box([0, d / 2, h / 2], [w, d, h], c, { rough: 0.12, metal: 0.2, wg: [2.4, 3.6] }), box([0, d / 2, h + 0.6], [w * 0.7, d * 0.7, 1.2], band, { solid: false })];
    for (let z = 4, k = 0; z < h - 2; z += 4.2, k++) {
      o.push(box([0, -0.05, z], [w + 0.1, 0.12, 0.4], band, { solid: false }));
      o.push(box([-w / 2 - 0.05, d / 2, z], [0.12, d + 0.1, 0.4], band, { solid: false }));
      if (hash(i * 31 + k) > 0.45) o.push(box([(hash(k + i) - 0.5) * w * 0.4, -0.08, z + 2.0], [w * 0.5, 0.1, 2.4], "#BFE0F5", { e: WARM, es: 0.9, glow: "night", solid: false }));
    }
    return o;
  },
  // a house (suburb / old town): walls, a pitched roof of two tilted slabs, a door, windows; `lean` tilts it (crooked)
  house({ w = 10, d = 9, h = 7, c = "#F2D7A6", roof = "#B5523B", door = "#6B3E2E", lean = 0, i = 0, chimney = true } = {}) {
    const a = 34, hd = d / 2, rl = hd / Math.cos(rad(a)) + 0.7, rz = h + (hd / 2) * Math.tan(rad(a));
    const o = [box([0, hd, h / 2], [w, d, h], c, { ry: lean }),
      box([0, hd / 2 - 0.1, rz], [w + 0.9, rl, 0.45], roof, { rx: a, ry: lean }), box([0, hd + hd / 2 + 0.1, rz], [w + 0.9, rl, 0.45], roof, { rx: -a, ry: lean }),
      box([0, hd, h + 0.8], [w - 0.2, d * 0.5, 1.6], c, { ry: lean, solid: false }),
      box([w * 0.22, -0.06, 2.2], [2.2, 0.2, 4.3], door, { solid: false }), sph([w * 0.22 + 0.7, -0.2, 2.2], 0.12, "#D9B24A", { solid: false })];
    for (const x of [-w * 0.24]) o.push(box([x, -0.06, 3.2], [2.4, 0.2, 2.3], GLASS, { e: WARM, es: 1.1, glow: "night", solid: false }), box([x, -0.15, 1.95], [2.8, 0.3, 0.25], "#FFFFFF", { solid: false }));
    if (h > 6) for (const x of [-w * 0.24, w * 0.22]) o.push(box([x, -0.06, h - 1.6], [1.9, 0.2, 1.9], GLASS, { e: WARM, es: hash(i + x) > 0.4 ? 1.0 : 0, glow: "night", solid: false }));
    if (chimney) o.push(box([w * 0.3, hd + 1.2, h + 3.6], [1.0, 1.0, 3.0], "#8C4A3A", { solid: false }));
    return o;
  },
  // the town hall: a wide body, columns, a pediment, steps, a sign with replaceable text
  townhall({ w = 26, d = 14, h = 13, c = "#EDE3CF", trim = "#C9B98F", sign = "TOWN HALL", key = "townhall" } = {}) {
    const o = [box([0, d / 2 + 2, h / 2], [w, d, h], c), box([0, d / 2 + 2, h + 0.5], [w + 1, d + 1, 1.0], trim, { solid: false }),
      box([0, 1.0, 0.3], [w * 0.8, 2.4, 0.6], trim, { solid: false }), box([0, 0.2, 0.15], [w * 0.86, 1.2, 0.3], trim, { solid: false }),
      box([0, 1.5, h + 2.0], [w * 0.7, 1.6, 3.0], trim, { solid: false }), box([0, 0.6, h - 0.8], [w * 0.8, 1.0, 1.2], trim, { solid: false }),
      txt([0, 0.0, h - 0.8], sign, 0.9, "#3A3226", { key }),
      box([0, 1.9, 2.6], [3.4, 0.2, 5.2], "#5A3A2A", { solid: false })];
    for (let k = 0; k < 6; k++) { const x = -w * 0.36 + (w * 0.72 / 5) * k; if (Math.abs(x) < 2.5) continue; o.push(cyl([x, 1.0, h / 2 - 0.4], 0.55, h - 1.6, "#FFFFFF", { v: 16 })); }
    for (const x of [-w * 0.42, w * 0.42]) o.push(box([x, 1.95, 7.4], [2.6, 0.2, 3.2], GLASS, { e: WARM, es: 1.1, glow: "night", solid: false }));
    return o;
  },
  // a clock tower (old town): a square tower, a clock face on the front with hands, a pointed roof
  clocktower({ w = 6, h = 24, c = "#C7B08A", roof = "#5B6E8C", time = [10, 10] } = {}) {
    const o = [box([0, w / 2, h / 2], [w, w, h], c), box([0, w / 2, h + 0.4], [w + 0.8, w + 0.8, 0.8], "#9E8862", { solid: false }),
      cyl([0, w / 2, h + 4.2], w * 0.78, 6.6, roof, { v: 4, r2: 0.05, rz: 45, solid: false }),
      cyl([0, -0.12, h - 4.2], 2.3, 0.25, "#FFF8E6", { rx: 90, v: 40, e: "#FFF4D0", es: 0.8, glow: "night", solid: false }),
      cyl([0, 0.06, h - 4.2], 2.5, 0.15, "#3A3226", { rx: 90, v: 40, solid: false })];
    const hand = (deg, len, wd) => { const [dx, dz] = [Math.sin(rad(deg)) * len / 2, Math.cos(rad(deg)) * len / 2]; return box([dx, -0.4, h - 4.2 + dz], [wd, 0.08, len], "#1E1A16", { ry: deg, solid: false }); };
    o.push(hand((time[0] % 12) * 30 + time[1] * 0.5, 1.3, 0.22), hand(time[1] * 6, 1.9, 0.14));
    for (let k = 0; k < 12; k++) { const a = k * 30; o.push(box([Math.sin(rad(a)) * 1.95, -0.32, h - 4.2 + Math.cos(rad(a)) * 1.95], [0.14, 0.06, 0.38], "#1E1A16", { ry: a, solid: false })); }
    o.push(box([0, -0.06, 2.3], [2.2, 0.2, 4.6], "#4E3426", { solid: false }));
    return o;
  },
  // ------------------------------------------------------------------------------------------- STREET THINGS
  tree({ h = 8, r = 2.8, c = "#5DAA4A", c2 = "#4A9140" } = {}) {
    return [cyl([0, 0, h * 0.3], 0.42, h * 0.6, "#7A5233", { v: 10 }), sph([0, 0, h * 0.68], r, c, { sc: [1, 1, 0.9], solid: false, v: 16 }), sph([r * 0.45, -r * 0.2, h * 0.82], r * 0.65, c2, { solid: false, v: 14 })];
  },
  pine({ h = 10, c = "#2F6B45" } = {}) {
    return [cyl([0, 0, 1.0], 0.4, 2.0, "#6B4A2E", { v: 8 }), cyl([0, 0, h * 0.45], h * 0.3, h * 0.6, c, { v: 10, r2: 0.2, solid: false }), cyl([0, 0, h * 0.75], h * 0.2, h * 0.45, c, { v: 10, r2: 0.1, solid: false })];
  },
  lamp({ h = 8, c = "#2E3440", style = "modern", light = true } = {}) {
    const o = [cyl([0, 0, h / 2], 0.17, h, c, { v: 10 })];
    if (style === "old") o.push(box([0, 0, h + 0.5], [0.9, 0.9, 1.2], "#FFE9B0", { e: "#FFD27A", es: 4, glow: "night", solid: false }), cyl([0, 0, h + 1.3], 0.75, 0.5, c, { v: 4, r2: 0.1, rz: 45, solid: false }));
    else o.push(box([0, -0.8, h], [0.3, 1.8, 0.2], c, { solid: false }), box([0, -1.6, h - 0.2], [0.7, 0.9, 0.25], "#FFF4D6", { e: "#FFE2A0", es: 5, glow: "night", solid: false }));
    if (light) o.push(lit([0, style === "old" ? 0 : -1.6, h - 0.6], 320, "#FFD8A0", { when: "night" }),
      cyl([0, style === "old" ? 0 : -1.6, 0.04], 2.6, 0.02, "#FFD8A0", { e: "#FFC870", es: 0.7, alpha: 0.35, glow: "night", when: "night", solid: false, v: 24 }));     // the pool of light on the ground
    return o;
  },
  bench({ c = "#8A5A3A" } = {}) {
    return [box([0, 0, 0.9], [3.2, 1.0, 0.18], c), box([0, 0.45, 1.55], [3.2, 0.14, 0.9], c, { solid: false }),
      box([-1.4, 0, 0.45], [0.16, 0.9, 0.9], "#3A3A40", { solid: false }), box([1.4, 0, 0.45], [0.16, 0.9, 0.9], "#3A3A40", { solid: false })];
  },
  fountain({ r = 3.2, c = "#D8D2C4", water = "#6CC4F0" } = {}) {
    return [cyl([0, 0, 0.5], r, 1.0, c, { v: 32 }), cyl([0, 0, 0.95], r - 0.35, 0.12, water, { v: 32, e: "#7FD0F5", es: 0.4, solid: false }),
      cyl([0, 0, 1.8], 0.55, 2.4, c, { v: 16 }), cyl([0, 0, 3.0], 1.5, 0.3, c, { v: 24, solid: false }),
      cyl([0, 0, 3.6], 0.18, 1.2, water, { v: 8, e: "#BFEAFF", es: 1.0, solid: false }), sph([0, 0, 4.3], 0.5, water, { e: "#BFEAFF", es: 0.8, solid: false })];
  },
  // a big screen with replaceable text (the town's billboard): a frame and a lit panel
  screen({ w = 18, h = 9, z = 10, text = "WELCOME", key = "screen", c = "#1D2230", panel = "#3D7BE0" } = {}) {
    return [box([0, 0.2, z], [w + 1.0, 0.6, h + 1.0], c, { solid: false }), box([0, -0.15, z], [w, 0.2, h], panel, { e: panel, es: 1.6, solid: false }),
      txt([0, -0.35, z], text, h * 0.16, "#FFFFFF", { key, e: "#FFFFFF", es: 3 })];
  },
  billboard({ w = 10, h = 5, z = 9, text = "BUY NOTHING", key = "billboard", c = "#F4D35E" } = {}) {
    return [cyl([-w * 0.3, 0.4, z / 2], 0.3, z, "#5A5F66", { v: 8 }), cyl([w * 0.3, 0.4, z / 2], 0.3, z, "#5A5F66", { v: 8 }),
      box([0, 0, z + h / 2 - 1], [w, 0.4, h], c, { solid: false }), txt([0, -0.25, z + h / 2 - 1], text, h * 0.2, "#22252B", { key })];
  },
  car({ c = "#E53935", L = 7.6, move = null } = {}) {
    const W = 3.3, dk = "#26282E";
    const o = [box([0, 0, 1.15], [L, W, 1.4], c, { rough: 0.3, move }), box([0.4, 0, 2.35], [L * 0.52, W - 0.3, 1.1], c, { rough: 0.3, solid: false, move }),
      box([0.4, 0, 2.35], [L * 0.53, W - 0.4, 0.85], "#9CC6E4", { rough: 0.1, solid: false, move }),
      box([-L / 2, 0, 1.2], [0.15, W - 0.6, 0.4], "#FFF6D8", { e: "#FFF2C0", es: 3, glow: "night", solid: false, move }),
      box([L / 2, 0, 1.25], [0.12, W - 0.6, 0.3], "#C42020", { e: "#FF3030", es: 2, glow: "night", solid: false, move })];
    for (const x of [-L * 0.32, L * 0.32]) for (const y of [-W / 2 + 0.2, W / 2 - 0.2]) o.push(cyl([x, y, 0.65], 0.65, 0.45, dk, { rx: 90, v: 16, solid: false, move }));
    return o;
  },
  bus({ c = "#F2B705", L = 15, text = "SCHOOL BUS", key = "bus", move = null } = {}) {
    const W = 3.8, o = [box([0, 0, 2.6], [L, W, 3.8], c, { rough: 0.35, move }), box([0, -W / 2 - 0.02, 3.4], [L * 0.86, 0.1, 1.3], "#2C3440", { solid: false, move }),
      box([-L / 2 - 0.02, 0, 3.4], [0.1, W * 0.8, 1.5], "#9CC6E4", { solid: false, move }), txt([0, -W / 2 - 0.1, 1.9], text, 0.75, "#1A1A1A", { key, move })];
    for (const x of [-L * 0.33, L * 0.33]) for (const y of [-W / 2 + 0.2, W / 2 - 0.2]) o.push(cyl([x, y, 0.75], 0.75, 0.5, "#22252B", { rx: 90, v: 16, solid: false, move }));
    return o;
  },
  busstop({ text = "BUS STOP", key = "busstop" } = {}) {
    return [box([0, 1.0, 4.4], [5.4, 2.6, 0.2], "#3E7CB1", { solid: false }), box([0, 2.2, 2.2], [5.2, 0.12, 4.2], "#BFE3F7", { alpha: 0.6, solid: true }),
      cyl([-2.6, 0.2, 2.2], 0.1, 4.4, "#5A5F66", { v: 8 }), cyl([2.6, 0.2, 2.2], 0.1, 4.4, "#5A5F66", { v: 8 }),
      box([0, 1.7, 0.85], [4.0, 0.8, 0.15], "#8A5A3A", { solid: false }), cyl([3.4, 0, 2.5], 0.1, 5.0, "#5A5F66", { v: 8 }),
      cyl([3.4, -0.06, 5.0], 0.7, 0.1, "#E53935", { rx: 90, v: 24, solid: false }), txt([3.4, -0.14, 5.0], "BUS", 0.4, "#FFFFFF", { key })];
  },
  stall({ c = "#C8553D", c2 = "#F4E9D8", goods = ["#F2A541", "#7FB86A", "#E05A5A"] } = {}) {
    const o = [box([0, 0, 1.6], [4.6, 2.2, 0.25], "#8A5A3A"), box([0, 0, 0.8], [4.4, 2.0, 1.4], "#9A6A44", { solid: true }),
      cyl([-2.1, -0.9, 2.4], 0.1, 4.8, "#6B4A2E", { v: 8 }), cyl([2.1, -0.9, 2.4], 0.1, 4.8, "#6B4A2E", { v: 8 }),
      cyl([-2.1, 0.9, 2.4], 0.1, 4.8, "#6B4A2E", { v: 8 }), cyl([2.1, 0.9, 2.4], 0.1, 4.8, "#6B4A2E", { v: 8 })];
    for (let k = 0; k < 5; k++) o.push(box([-2.2 + 1.1 * k, 0, 4.9], [1.1, 2.8, 0.14], k % 2 ? c2 : c, { rx: -8, solid: false }));
    for (let k = 0; k < 9; k++) o.push(sph([-1.8 + 0.45 * k, -0.4 + (k % 2) * 0.5, 1.95], 0.28, pick(goods, k), { solid: false, v: 10 }));
    return o;
  },
  well({ c = "#9A9488" } = {}) {
    return [cyl([0, 0, 0.7], 1.8, 1.4, c, { v: 20 }), cyl([0, 0, 1.38], 1.45, 0.06, "#0E1A2A", { v: 20, solid: false }),
      cyl([-1.6, 0, 2.4], 0.14, 3.4, "#6B4A2E", { v: 8 }), cyl([1.6, 0, 2.4], 0.14, 3.4, "#6B4A2E", { v: 8 }),
      cyl([0, 0, 4.5], 2.6, 1.4, "#8C3B2E", { v: 4, r2: 0.05, rz: 45, solid: false }), cyl([0, 0, 3.3], 0.1, 3.2, "#6B4A2E", { ry: 90, v: 8, solid: false })];
  },
  // a little stone bridge over a canal strip (the canal water is a floor, the parapets are walls)
  bridge({ L = 12, W = 6 } = {}) {
    return [box([0, 0, 0.35], [W, L, 0.7], "#A79B86", { solid: false }), box([-W / 2 + 0.3, 0, 1.2], [0.6, L, 1.4], "#9A8E78"), box([W / 2 - 0.3, 0, 1.2], [0.6, L, 1.4], "#9A8E78")];
  },
  canal({ L = 80, W = 7 } = {}) {
    return [box([0, 0, -0.1], [L, W, 0.15], "#3F7FA8", { e: "#2F6E96", es: 0.2, rough: 0.1, solid: false }),
      box([0, -W / 2 - 0.3, 0.1], [L, 0.6, 0.4], "#8F8471", { solid: false }), box([0, W / 2 + 0.3, 0.1], [L, 0.6, 0.4], "#8F8471", { solid: false })];
  },
  slide({ c = "#E8505B" } = {}) {
    return [box([0, 1.6, 2.2], [1.8, 1.8, 0.2], "#3E7CB1"), cyl([-0.8, 2.4, 1.1], 0.1, 2.2, "#3E7CB1", { v: 8 }), cyl([0.8, 2.4, 1.1], 0.1, 2.2, "#3E7CB1", { v: 8 }),
      box([0, -0.6, 1.2], [1.4, 3.6, 0.15], c, { rx: 35, solid: false })];
  },
  swing({ c = "#F2B705" } = {}) {
    return [cyl([-2, 0, 2.2], 0.12, 4.4, "#5A5F66", { v: 8 }), cyl([2, 0, 2.2], 0.12, 4.4, "#5A5F66", { v: 8 }), cyl([0, 0, 4.4], 0.12, 4.2, "#5A5F66", { ry: 90, v: 8, solid: false }),
      box([-0.9, 0, 1.2], [1.0, 0.5, 0.12], c, { solid: false }), box([0.9, 0, 1.2], [1.0, 0.5, 0.12], c, { solid: false }),
      cyl([-1.3, 0, 2.8], 0.03, 3.2, "#333333", { v: 6, solid: false }), cyl([-0.5, 0, 2.8], 0.03, 3.2, "#333333", { v: 6, solid: false }),
      cyl([0.5, 0, 2.8], 0.03, 3.2, "#333333", { v: 6, solid: false }), cyl([1.3, 0, 2.8], 0.03, 3.2, "#333333", { v: 6, solid: false })];
  },
  hoop({ c = "#E86A1E" } = {}) {
    return [cyl([0, 1.0, 3.6], 0.18, 7.2, "#5A5F66", { v: 8 }), box([0, 0.6, 6.8], [3.0, 0.15, 2.0], "#FFFFFF", { solid: false }), cyl([0, -0.2, 6.1], 0.6, 0.08, c, { v: 20, solid: false })];
  },
  fence({ L = 10, h = 1.8, c = "#FFFFFF" } = {}) {
    const o = [box([0, 0, h * 0.7], [L, 0.12, 0.2], c), box([0, 0, h * 0.35], [L, 0.12, 0.2], c, { solid: false })];
    for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.0) o.push(box([x, 0, h / 2], [0.18, 0.18, h], c, { solid: false }));
    return o;
  },
  hedge({ L = 6, h = 1.6, c = "#4E8F3A" } = {}) { return [box([0, 0, h / 2], [L, 1.1, h], c)]; },
  flowerbed({ L = 4 } = {}) { const o = [box([0, 0, 0.25], [L, 1.2, 0.5], "#6B4A2E", { solid: false })]; for (let k = 0; k < 8; k++) o.push(sph([-L / 2 + 0.3 + k * (L - 0.6) / 7, (k % 2) * 0.3 - 0.15, 0.7], 0.26, pick(["#E05A8A", "#F2C14E", "#FFFFFF", "#B06AC8"], k), { solid: false, v: 8 })); return o; },
  bin({ c = "#3E8E5A" } = {}) { return [cyl([0, 0, 0.75], 0.6, 1.5, c, { v: 14 }), cyl([0, 0, 1.55], 0.65, 0.12, "#2E6E44", { v: 14, solid: false })]; },
  hydrant() { return [cyl([0, 0, 0.6], 0.32, 1.2, "#D63A2F", { v: 12 }), sph([0, 0, 1.25], 0.32, "#D63A2F", { solid: false, v: 10 })]; },
  crate({ c = "#B98A55", s = 1.4 } = {}) { return [box([0, 0, s / 2], [s, s, s], c)]; },
  barrel() { return [cyl([0, 0, 0.8], 0.7, 1.6, "#7A4E30", { v: 16 }), cyl([0, 0, 1.2], 0.72, 0.1, "#3A3A40", { v: 16, solid: false })]; },
  // a security camera on a pole (a prop and a set piece): it looks down the street
  seccam({ h = 7, c = "#E6E8EC" } = {}) {
    return [cyl([0, 0, h / 2], 0.14, h, "#5A5F66", { v: 8 }), box([0, -0.7, h + 0.1], [0.6, 1.5, 0.6], c, { rx: 18, solid: false }),
      cyl([0, -1.5, h - 0.15], 0.22, 0.2, "#1A1A1A", { rx: 90 + 18, v: 12, solid: false }), sph([0.2, -0.3, h + 0.45], 0.09, "#FF2020", { e: "#FF2020", es: 6, solid: false })];
  },
};

// ------------------------------------------------------------------------------------------------- EXPAND
/** a place's prefab list -> world primitives; each item: { p: prefab, at, rz, ...params } or { prim: {...} } */
export function expand(items) {
  const out = [];
  items.forEach((it, i) => {
    if (it.prim) { out.push(it.prim); return; }
    if (it.prims) { out.push(...xf(it.prims, it.at ?? [0, 0, 0], it.rz ?? 0)); return; }
    const f = P[it.p];
    if (!f) throw new Error(`unknown prefab ${it.p}`);
    const { p, at, rz, tag, ...params } = it;
    out.push(...xf(f({ i, ...params }), at, rz ?? 0, tag ? { tag } : {}));
  });
  return out;
}

/** the obstacles (for the free checks) from the solid primitives: boxes as rotated footprints' bounds, upright
 *  cylinders as cylinders; floors, decorations and anything solid:false never count */
export function obstaclesOf(prims) {
  const out = [];
  prims.forEach((p, k) => {
    if (p.solid === false || p.t === "text" || p.t === "light") return;
    if (p.move) return;   // a driving car: checked by its lane, not as a wall
    if (p.t === "cyl" && !p.rx && !p.ry) {
      const hz = p.h * (p.sc?.[2] ?? 1), z0 = p.at[2] - hz / 2;
      if (p.at[2] + hz / 2 < 0.45) return;
      if (z0 < 0.6) out.push({ n: `${p.tag ?? p.t}${k}`, cyl: [p.at[0], p.at[1], p.r * Math.max(p.sc?.[0] ?? 1, p.sc?.[1] ?? 1), p.at[2] + hz / 2] });
      else out.push({ n: `${p.tag ?? p.t}${k}`, box: [p.at[0] - p.r, p.at[0] + p.r, p.at[1] - p.r, p.at[1] + p.r, z0, z0 + hz] });
      return;
    }
    let sx, sy, sz;
    if (p.t === "box") [sx, sy, sz] = p.s;
    else if (p.t === "cyl") { sx = sy = 2 * p.r; sz = p.h; if (p.rx) [sy, sz] = [p.h, 2 * p.r]; if (p.ry) [sx, sz] = [p.h, 2 * p.r]; }
    else { const s = p.sc ?? [1, 1, 1]; sx = 2 * p.r * s[0]; sy = 2 * p.r * s[1]; sz = 2 * p.r * s[2]; }
    if (p.rx) { const a = rad(p.rx); [sy, sz] = [Math.abs(sy * Math.cos(a)) + Math.abs(sz * Math.sin(a)), Math.abs(sy * Math.sin(a)) + Math.abs(sz * Math.cos(a))]; }
    if (p.ry) { const a = rad(p.ry); [sx, sz] = [Math.abs(sx * Math.cos(a)) + Math.abs(sz * Math.sin(a)), Math.abs(sx * Math.sin(a)) + Math.abs(sz * Math.cos(a))]; }
    const a = rad(p.rz ?? 0), ex = Math.abs(sx / 2 * Math.cos(a)) + Math.abs(sy / 2 * Math.sin(a)), ey = Math.abs(sx / 2 * Math.sin(a)) + Math.abs(sy / 2 * Math.cos(a));
    const z0 = p.at[2] - sz / 2, z1 = p.at[2] + sz / 2;
    if (z1 < 0.45) return;    // a floor
    out.push({ n: `${p.tag ?? p.t}${k}`, box: [p.at[0] - ex, p.at[0] + ex, p.at[1] - ey, p.at[1] + ey, Math.max(0, z0), z1] });
  });
  return out;
}
