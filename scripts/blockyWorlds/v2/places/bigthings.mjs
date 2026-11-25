// IN THIS TOWN v2, NIGHT BUILD: THE BIG THINGS for a town's middle spot (data prefabs, our own designs). Each has
// states and a close camera on its key detail (placed relative to the town's big spot). withBig() makes a town
// variant with the big thing standing on its big spot, so the same checks / sheets / shot rows work.
import { P, box, cyl, sph, txt, lit } from "./prefabs.mjs";

const GOLD = "#E8B63C";
Object.assign(P, {
  // a giant door standing alone (no wall): frame, panel, a gold keyhole plate; open = the panel swung, light or dark behind
  giant_door({ state = "closed", behind = "light", w = 7, h = 15, sign = "", key = "door_sign" } = {}) {
    const o = [box([-w / 2 - 0.6, 0, h / 2], [1.2, 1.6, h + 0.4], "#3A2A20"), box([w / 2 + 0.6, 0, h / 2], [1.2, 1.6, h + 0.4], "#3A2A20"),
      box([0, 0, h + 0.8], [w + 2.4, 1.8, 1.2], "#3A2A20"), box([0, -0.3, 0.15], [w + 2.6, 2.4, 0.3], "#5A4A3A", { solid: false })];
    if (state === "open") {
      o.push(box([-w / 2 + 0.2, -w / 2 + 0.2, h / 2], [0.5, w, h], "#2A1A12", { solid: false }));
      o.push(box([0, 0.2, h / 2], [w, 0.1, h], behind === "light" ? "#FFF4D0" : "#000000", behind === "light" ? { e: "#FFE9A8", es: 6, solid: false } : { rough: 1, solid: false }));
      if (behind === "light") o.push(lit([0, -3, h / 2], 2500, "#FFE2A0"));
    } else {
      o.push(box([0, 0, h / 2], [w, 0.6, h], "#2A1A12"));
      for (let k = 0; k < 4; k++) o.push(box([0, -0.32, 2 + k * 3.6], [w * 0.92, 0.08, 0.25], "#1A100A", { solid: false }));
      o.push(cyl([w * 0.28, -0.36, h * 0.45], 0.55, 0.12, GOLD, { rx: 90, v: 24, metal: 0.8, rough: 0.3, solid: false }),
        cyl([w * 0.28, -0.44, h * 0.45 + 0.08], 0.16, 0.06, "#050505", { rx: 90, v: 16, solid: false }), box([w * 0.28, -0.44, h * 0.45 - 0.15], [0.14, 0.06, 0.34], "#050505", { solid: false }),
        box([w * 0.28, -0.34, h * 0.45 - 0.2], [0.9, 0.06, 1.7], GOLD, { metal: 0.8, rough: 0.3, solid: false }),
        box([w * 0.28, -0.75, h * 0.45 + 0.05], [0.14, 0.8, 0.14], GOLD, { metal: 0.8, rough: 0.3, solid: false, only: "key=in|turned" }),
        cyl([w * 0.28, -1.25, h * 0.45 + 0.05], 0.36, 0.1, GOLD, { rx: 90, v: 20, metal: 0.8, rough: 0.3, solid: false, only: "key=in" }),
        cyl([w * 0.28, -1.25, h * 0.45 + 0.05], 0.36, 0.1, GOLD, { ry: 90, v: 20, metal: 0.8, rough: 0.3, solid: false, only: "key=turned" }),
        lit([w * 0.28, -2.0, h * 0.45], 300, "#FFE2A0", { only: "key=turned" }));
    }
    if (sign) o.push(box([0, -0.95, h + 2.6], [w + 1, 0.2, 1.6], "#15181F", { solid: false }), txt([0, -1.08, h + 2.6], sign, 0.62, "#FFD36A", { key, e: "#FFD36A", es: 2 }));
    return o;
  },
  // a giant statue of a townsperson (our own blocky figure) on a plinth with a plaque
  giant_statue({ c = "#B8B4AA", pose = "point", plaque = "OUR FOUNDER", key = "plaque" } = {}) {
    const o = [box([0, 0, 1.5], [6, 6, 3], "#8A8478"), box([0, -3.05, 1.6], [3.6, 0.1, 1.0], "#C9A24A", { solid: false }), txt([0, -3.12, 1.6], plaque, 0.34, "#2B2216", { key }),
      box([-0.9, 0, 6.2], [1.5, 1.6, 6.4], c), box([0.9, 0, 6.2], [1.5, 1.6, 6.4], c), box([0, 0, 11.5], [4.0, 2.0, 4.6], c), box([0, 0, 15.2], [2.8, 2.6, 2.8], c, { solid: false }),
      box([-2.6, 0, 11.0], [1.2, 1.2, 4.4], c, { solid: false })];
    if (pose === "point") o.push(box([2.7, -1.6, 13.2], [1.2, 4.2, 1.2], c, { solid: false }));
    else o.push(box([2.6, 0, 11.0], [1.2, 1.2, 4.4], c, { solid: false }));
    o.push(box([-0.6, -1.32, 15.5], [0.4, 0.05, 0.4], "#6E6A62", { solid: false }), box([0.6, -1.32, 15.5], [0.4, 0.05, 0.4], "#6E6A62", { solid: false }));
    return o;
  },
  // a strange machine: a body, a glowing core window, gauges, a screen with replaceable text, pipes, a funnel
  machine({ on = true, text = "READY", key = "machine_screen" } = {}) {
    const glow = on ? { e: "#7CFFB0", es: 4 } : {};
    const o = [box([0, 0, 4], [9, 6, 8], "#5A6878"), box([0, 0, 8.6], [6, 4.4, 1.2], "#46525F", { solid: false }), cyl([0, 0, 11], 1.2, 3.6, "#46525F", { v: 16, r2: 2.6, solid: false }),
      cyl([0, -3.05, 4.4], 1.6, 0.2, "#BFFFE0", { rx: 90, v: 32, solid: false, ...glow }), box([-3, -3.05, 6.4], [2.4, 0.1, 1.4], "#10161C", { solid: false }),
      txt([-3, -3.12, 6.4], text, 0.36, "#7CFFB0", { key, e: "#7CFFB0", es: 3 }),
      cyl([3, -3.05, 6.4], 0.55, 0.12, "#FFFFFF", { rx: 90, v: 24, solid: false }), box([3.15, -3.14, 6.55], [0.06, 0.04, 0.5], "#D63A2F", { ry: 40, solid: false }),
      cyl([3, -3.05, 2.2], 0.55, 0.12, "#FFFFFF", { rx: 90, v: 24, solid: false }), box([2.85, -3.14, 2.3], [0.06, 0.04, 0.5], "#D63A2F", { ry: -50, solid: false }),
      cyl([-5.2, 0, 3], 0.4, 6, "#8C6E4E", { v: 12 }), cyl([5.2, 1, 5], 0.4, 10, "#8C6E4E", { v: 12 }), box([-3.4, -3.3, 1.6], [0.2, 0.6, 2.2], "#C9CED6", { rx: -25, solid: false }), sph([-3.4, -3.8, 2.6], 0.3, "#E53935", { solid: false })];
    if (on) o.push(lit([0, -5, 4.4], 900, "#7CFFB0"));
    return o;
  },
  // a deep hole in the ground: a black disc, a dark inner wall, a ring of broken paving chunks around it
  hole({ r = 5 } = {}) {
    const o = [cyl([0, 0, 0.25], r, 0.08, "#000000", { v: 40, rough: 1, solid: false }), cyl([0, 0, 0.2], r + 0.2, 0.1, "#1A1410", { v: 40, solid: false })];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; o.push(box([Math.cos(a) * (r + 0.7), Math.sin(a) * (r + 0.7), 0.35], [1.4, 0.9, 0.35], k % 2 ? "#8E8676" : "#A79B86", { rz: (a * 180) / Math.PI + 10 * (k % 3), rx: 10 + (k % 4) * 6, solid: false })); }
    return o;
  },
  // a huge clock on a stand (time = [h, m]); the close camera reads its face
  huge_clock({ time = [11, 55], c = "#D9B24A" } = {}) {
    const z = 10, o = [box([0, 0.6, z / 2 - 1], [1.6, 1.2, z - 2], "#3A3226"), box([0, 0.6, 0.5], [6, 4, 1], "#3A3226"),
      cyl([0, 0, z + 3], 5.4, 1.0, c, { rx: 90, v: 48, metal: 0.6, rough: 0.35 }), cyl([0, -0.64, z + 3], 4.8, 0.2, "#FFF8E6", { rx: 90, v: 48, e: "#FFF4D0", es: 0.6, glow: "night", solid: false })];
    for (let k = 0; k < 12; k++) { const a = (k * 30 * Math.PI) / 180; o.push(box([Math.sin(a) * 4.1, -0.7, z + 3 + Math.cos(a) * 4.1], [0.3, 0.1, 0.8], "#1E1A16", { ry: k * 30, solid: false })); }
    const hand = (deg, len, wd) => box([(Math.sin((deg * Math.PI) / 180) * len) / 2, -0.8, z + 3 + (Math.cos((deg * Math.PI) / 180) * len) / 2], [wd, 0.1, len], "#1E1A16", { ry: deg, solid: false });
    o.push(hand((time[0] % 12) * 30 + time[1] * 0.5, 2.6, 0.45), hand(time[1] * 6, 3.8, 0.28), cyl([0, -0.9, z + 3], 0.3, 0.2, "#1E1A16", { rx: 90, v: 16, solid: false }));
    return o;
  },
  // a giant gift box with a ribbon and a bow; a tag with replaceable text
  gift_box({ s = 9, c = "#E53935", ribbon = "#F2C14E", tag = "FOR YOU", key = "gift_tag", open = false } = {}) {
    const o = [box([0, 0, s / 2], [s, s, s], c), box([0, 0, s / 2], [1.2, s + 0.1, s + 0.1], ribbon, { solid: false }), box([0, 0, s / 2], [s + 0.1, 1.2, s + 0.1], ribbon, { solid: false })];
    if (!open) o.push(box([0, 0, s + 0.35], [s + 0.6, s + 0.6, 0.7], c, { solid: false }), sph([-1.3, 0, s + 1.6], 1.6, ribbon, { sc: [1.2, 0.5, 0.8], solid: false }), sph([1.3, 0, s + 1.6], 1.6, ribbon, { sc: [1.2, 0.5, 0.8], solid: false }));
    else o.push(box([s * 0.7, 0, s * 0.4], [s + 0.6, s + 0.6, 0.7], c, { ry: 70, solid: false }), lit([0, 0, s + 1], 1500, "#FFE2A0"));
    o.push(box([s * 0.3, -s / 2 - 0.15, s * 0.3], [2.4, 0.08, 1.4], "#FFF8EC", { rz: 8, solid: false }), txt([s * 0.3, -s / 2 - 0.22, s * 0.3], tag, 0.36, "#2B2B33", { key, rz: 8 }));
    return o;
  },
});

/** the big things: their prefab, their states, the close camera on the key detail (offset from the big spot) */
export const BIG_THINGS = {
  giant_door: { states: { closed: {}, open_light: { state: "open", behind: "light" }, open_dark: { state: "open", behind: "dark" } }, close: { loc: [2.6, -6.5, 6.5], tgt: [1.96, 0, 6.75], lens: 40 }, look: "a giant door standing alone with a gold keyhole; it opens onto light or darkness" },
  giant_statue: { states: { pointing: { pose: "point" }, arms_down: { pose: "down" } }, close: { k: 1.9, loc: [0.5, -8, 3], tgt: [0, -3, 1.6], lens: 40 }, look: "a giant stone townsperson on a plinth with a plaque" },
  machine: { states: { on: { on: true }, off: { on: false } }, close: { k: 1.9, loc: [-1.5, -8.5, 6.6], tgt: [-1.8, -3, 6.2], lens: 40 }, look: "a strange machine with a glowing core, gauges, a screen with text, a funnel" },
  hole: { states: { open: {} }, close: { loc: [0, -9, 8], tgt: [0, 0, 0], lens: 28 }, look: "a deep black hole in the ground ringed by broken paving" },
  huge_clock: { states: { five_to_twelve: { time: [11, 55] }, midnight: { time: [12, 0] } }, close: { k: 1.9, loc: [0.5, -9, 13], tgt: [0, 0, 13], lens: 36 }, look: "a huge clock on a stand in the middle of town" },
  gift_box: { states: { closed: {}, open: { open: true } }, close: { k: 1.9, loc: [3.6, -9, 3], tgt: [2.7, -4.6, 2.7], lens: 40 }, look: "a giant gift box with a ribbon, a bow and a tag" },
};

/** a town with a big thing on its big spot (the town's own cameras + `<kind>_close`) */
export function withBig(town, kind, state) {
  const B = BIG_THINGS[kind], at = town.big.at;
  const params = B.states[state] ?? {};
  const add = (v) => [at[0] + v[0], at[1] + v[1], at[2] + v[2]];
  return { ...town, id: `${town.id}+${kind}.${state}`, big_filled: { kind, state }, states: { key: "none", ...(town.states ?? {}) },
    items: [...town.items, { p: kind, at: [at[0], at[1], at[2]], ...params }],
    cameras: { ...town.cameras, [`${kind}_close`]: { loc: add(B.close.tgt.map((t, i) => t + (B.close.loc[i] - t) * (B.close.k ?? 1))), tgt: add(B.close.tgt), lens: B.close.lens, shot: "insert", people: [], fixed: true } } };
}
