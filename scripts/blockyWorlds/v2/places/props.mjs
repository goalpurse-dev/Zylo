// IN THIS TOWN v2: THE PROP LIBRARY AS DATA (fix round 2, 2026-11-25). Every story object is a RECIPE of simple shapes
// (the same primitives as the places: box / cyl / sph / text / light) in LOCAL units: the base at z = 0, the front
// facing -y. The same recipe is (1) a place's own item (P.prop in a town: tagged obj_<id>, its states through the
// place's state key) and (2) a prop held in a hand / worn on a head / on a back / at the feet (set_v2.py zv_recipe).
// States: a shape with only: "open|letter" shows only in those states (the first state is the default).
// Sizes read in a medium shot (a kid is 3.04 tall): props are about 1.5x their real size.
// A story's NEW item (built on the spot by the prop builder) uses the same format; once its test still passes it is
// saved to places/props_built.json and joins the catalogue.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { box, cyl, sph, txt, lit } from "./prefabs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const n = (o) => ({ solid: false, ...o });

export const PROPS = {
  letter: { what: "a folded letter with a red stamp", h: 0.6, attach: ["hand", "ground", "mouth"], states: ["plain"],
    prims: [box([0, 0, 0.3], [0.8, 0.04, 0.56], "#FAF6EC", n()), box([0.27, -0.03, 0.47], [0.16, 0.02, 0.16], "#D94040", n()),
      ...[0.36, 0.26, 0.16].map((z) => box([-0.08, -0.03, z], [0.5, 0.01, 0.035], "#7A8090", n()))] },
  envelope: { what: "a sealed envelope with a red heart seal", h: 0.6, attach: ["hand", "ground"], states: ["closed", "open"],
    prims: [box([0, 0, 0.3], [0.86, 0.05, 0.58], "#F3E6C8", n()), box([-0.2, -0.04, 0.42], [0.62, 0.02, 0.04], "#D8C8A4", n({ ry: 34, only: "closed" })),
      box([0.2, -0.04, 0.42], [0.62, 0.02, 0.04], "#D8C8A4", n({ ry: -34, only: "closed" })), cyl([0, -0.05, 0.36], 0.08, 0.03, "#C62828", n({ rx: 90, only: "closed" })),
      box([0, 0.02, 0.62], [0.86, 0.03, 0.3], "#E8D7B0", n({ rx: -30, only: "open" })), box([0, -0.01, 0.58], [0.7, 0.02, 0.3], "#FFFFFF", n({ only: "open" }))] },
  mailbox: { what: "a mailbox on a post with a red flag and a door that opens", h: 2.4, attach: ["ground"], states: ["closed", "open", "letter", "glowing"],
    prims: [box([0, 0, 0.9], [0.18, 0.18, 1.8], "#6B4A32"), box([0, 0, 1.95], [0.66, 1.1, 0.5], "#3E6FB8", { bev: 0.05 }), cyl([0, 0, 2.2], 0.33, 1.1, "#3E6FB8", { rx: 90, v: 20 }),
      box([0.38, 0.1, 2.25], [0.05, 0.05, 0.5], "#D32F2F", n({ only: "closed" })), box([0.38, 0.22, 2.48], [0.05, 0.3, 0.2], "#E53935", n({ only: "closed" })),
      box([0.38, 0.1, 2.52], [0.05, 0.05, 0.6], "#D32F2F", n({ only: "open|letter|glowing" })), box([0.38, 0.1, 2.85], [0.05, 0.32, 0.2], "#E53935", n({ only: "open|letter|glowing" })),
      box([0, -0.57, 2.06], [0.64, 0.05, 0.72], "#2F5A99", n({ only: "closed" })), box([0, -0.57, 2.06], [0.5, 0.03, 0.1], "#F2C14E", n({ only: "closed" })),
      box([0, -0.9, 1.72], [0.64, 0.7, 0.05], "#2F5A99", n({ only: "open|letter|glowing" })), box([0, -0.55, 2.06], [0.56, 0.04, 0.62], "#10131A", n({ only: "open|letter" })),
      box([0, -0.75, 2.1], [0.5, 0.5, 0.36], "#FAF6EC", n({ rx: 8, only: "letter" })), box([0.12, -0.98, 2.16], [0.12, 0.02, 0.12], "#D94040", n({ only: "letter" })),
      box([0, -0.56, 2.06], [0.56, 0.04, 0.62], "#FFE27A", n({ e: "#FFD54A", es: 6, only: "glowing" })), lit([0, -1.3, 2.2], 260, "#FFD54A", { only: "glowing", size: 0.4 })] },
  flower: { what: "a flower with pink petals (grows on a head: bud, then bloom)", h: 1.0, attach: ["head", "hand", "ground"], states: ["bloom", "bud"],
    prims: [cyl([0, 0, 0.32], 0.05, 0.64, "#3E8E3A", n()), sph([0.13, 0, 0.34], 0.14, "#5DAA4A", n({ sc: [1.4, 0.4, 0.7] })),
      sph([0, 0, 0.78], 0.15, "#FFD23F", n({ only: "bloom" })), ...[0, 60, 120, 180, 240, 300].map((a) => sph([0.24 * Math.cos(a * Math.PI / 180), 0.02, 0.78 + 0.24 * Math.sin(a * Math.PI / 180)], 0.15, "#FF6FA8", n({ sc: [1, 0.45, 1], only: "bloom" }))),
      sph([0, 0, 0.74], 0.14, "#FF6FA8", n({ sc: [0.8, 0.8, 1.3], only: "bud" }))] },
  bouquet: { what: "a bouquet of flowers in paper", h: 1.5, attach: ["hand"], states: ["fresh"],
    prims: [cyl([0, 0, 0.45], 0.32, 0.9, "#F3E6C8", n({ r2: 0.06, rx: 180 })), ...[[-0.2, 1.05, "#FF6FA8"], [0.2, 1.1, "#FFD23F"], [0, 1.3, "#E53935"], [-0.05, 0.98, "#B388FF"], [0.25, 0.9, "#FF9E40"]].map(([x, z, c]) => sph([x, 0, z], 0.2, c, n())),
      ...[-0.15, 0.15].map((x) => sph([x, -0.08, 0.92], 0.1, "#4CAF50", n({ sc: [1, 0.5, 1.6] })))] },
  book: { what: "a thick book", h: 1.2, attach: ["hand", "ground"], states: ["closed", "open"],
    prims: [box([0, 0, 0.6], [0.95, 0.28, 1.2], "#3E7CB1", n({ only: "closed" })), box([0.05, -0.01, 0.6], [0.88, 0.24, 1.14], "#F4F0E6", n({ only: "closed" })), box([-0.47, 0, 0.6], [0.06, 0.3, 1.2], "#2C5A85", n({ only: "closed" })),
      box([-0.5, 0, 0.6], [1.0, 0.06, 1.2], "#3E7CB1", n({ rz: 20, only: "open" })), box([0.5, 0, 0.6], [1.0, 0.06, 1.2], "#3E7CB1", n({ rz: -20, only: "open" })),
      box([-0.48, -0.05, 0.6], [0.92, 0.04, 1.12], "#F4F0E6", n({ rz: 20, only: "open" })), box([0.48, -0.05, 0.6], [0.92, 0.04, 1.12], "#F4F0E6", n({ rz: -20, only: "open" }))] },
  box: { what: "a cardboard box with tape (closed or open)", h: 1.3, attach: ["hand", "ground"], states: ["closed", "open"],
    prims: [box([0, 0, 0.6], [1.3, 1.1, 1.2], "#C89B62", { bev: 0.03 }), box([0, -0.56, 0.95], [0.3, 0.02, 0.5], "#E8D7A8", n({ only: "closed" })), box([0, 0, 1.21], [1.3, 0.3, 0.02], "#E8D7A8", n({ only: "closed" })),
      box([0, -0.85, 1.35], [1.3, 0.6, 0.04], "#B88A52", n({ rx: -60, only: "open" })), box([0, 0.85, 1.35], [1.3, 0.6, 0.04], "#B88A52", n({ rx: 60, only: "open" })), box([0, 0, 1.15], [1.2, 1.0, 0.04], "#3A2A1A", n({ only: "open" }))] },
  bag: { what: "a shopping bag with handles", h: 1.6, attach: ["hand", "ground"], states: ["full"],
    prims: [box([0, 0, 0.55], [0.95, 0.5, 1.1], "#E86A5A", { bev: 0.02 }), cyl([0, 0, 1.25], 0.28, 0.06, "#A84436", n({ rx: 90, v: 16 })), sph([-0.15, 0, 1.15], 0.22, "#7FC48A", n()), box([0.2, 0, 1.2], [0.3, 0.3, 0.4], "#FDD663", n())] },
  toy: { what: "a teddy bear toy", h: 1.3, attach: ["hand", "ground"], states: ["sit"],
    prims: [sph([0, 0, 0.45], 0.42, "#B0703A", { sc: [1, 0.85, 1.1] }), sph([0, -0.05, 1.05], 0.32, "#B0703A", n()), ...[-1, 1].map((s) => sph([s * 0.24, 0, 1.3], 0.12, "#8A5226", n())),
      sph([0, -0.33, 1.0], 0.12, "#E8C89A", n()), ...[-1, 1].map((s) => sph([s * 0.12, -0.3, 1.12], 0.045, "#15151A", n())), ...[-1, 1].map((s) => sph([s * 0.42, -0.08, 0.55], 0.16, "#B0703A", n({ sc: [0.8, 0.8, 1.4] })))] },
  lamp: { what: "a table lamp (off / on)", h: 1.7, attach: ["ground", "hand"], states: ["on", "off"],
    prims: [cyl([0, 0, 0.06], 0.4, 0.12, "#5A5A66", n()), cyl([0, 0, 0.6], 0.05, 1.0, "#8A8A96", n()), cyl([0, 0, 1.3], 0.55, 0.6, "#F4E4C0", n({ r2: 0.32, only: "off" })),
      cyl([0, 0, 1.3], 0.55, 0.6, "#FFF1C8", n({ r2: 0.32, e: "#FFE6A0", es: 3, only: "on" })), lit([0, -0.9, 1.2], 180, "#FFE2A0", { only: "on", size: 0.5 })] },
  mirror: { what: "a tall oval mirror on a stand (normal / glowing / eyes in it)", h: 3.2, attach: ["ground"], states: ["normal", "glowing", "eyes"],
    prims: [box([0, 0.2, 0.06], [1.4, 0.8, 0.12], "#6B4A32", n()), cyl([0, 0, 1.85], 0.82, 0.12, "#C9A24A", { rx: 90, sc: [1, 1.5, 1], v: 32 }),
      cyl([0, -0.04, 1.85], 0.7, 0.06, "#BFD4E0", n({ rx: 90, sc: [1, 1.5, 1], v: 32, rough: 0.05, metal: 0.6, only: "normal" })),
      cyl([0, -0.04, 1.85], 0.7, 0.06, "#C8F0FF", n({ rx: 90, sc: [1, 1.5, 1], v: 32, e: "#9FE7FF", es: 4, only: "glowing" })),
      cyl([0, -0.04, 1.85], 0.7, 0.06, "#0B0D14", n({ rx: 90, sc: [1, 1.5, 1], v: 32, only: "eyes" })), ...[-0.22, 0.22].map((x) => sph([x, -0.1, 2.0], 0.1, "#FFF6B0", n({ e: "#FFF06A", es: 9, only: "eyes" })))] },
  door: { what: "a door in a frame (closed / open / glowing light behind)", h: 4.4, attach: ["ground"], states: ["closed", "open", "glowing"],
    prims: [box([-1.15, 0, 2.15], [0.25, 0.4, 4.3], "#F2EDE4"), box([1.15, 0, 2.15], [0.25, 0.4, 4.3], "#F2EDE4"), box([0, 0, 4.3], [2.55, 0.4, 0.25], "#F2EDE4", n()),
      box([0, 0, 2.05], [2.05, 0.16, 4.1], "#8C4A2F", n({ only: "closed" })), sph([0.75, -0.12, 2.0], 0.1, "#E2B84A", n({ only: "closed" })),
      box([-0.95, -0.95, 2.05], [0.16, 2.05, 4.1], "#8C4A2F", n({ only: "open|glowing" })), box([0, 0.1, 2.05], [2.05, 0.04, 4.1], "#15131A", n({ only: "open" })),
      box([0, 0.1, 2.05], [2.05, 0.04, 4.1], "#FFF1B8", n({ e: "#FFE680", es: 6, only: "glowing" })), lit([0, -1.5, 2.2], 600, "#FFE680", { only: "glowing", size: 1 })] },
  window: { what: "a window in a frame (dark / lit / a face in it)", h: 2.6, attach: ["ground"], states: ["lit", "dark", "face"],
    prims: [box([0, 0, 1.3], [2.3, 0.22, 2.3], "#F2EDE4"), box([0, -0.12, 1.3], [1.9, 0.04, 1.9], "#FFE6A0", n({ e: "#FFD27A", es: 2.5, only: "lit" })), box([0, -0.12, 1.3], [1.9, 0.04, 1.9], "#16202E", n({ only: "dark|face" })),
      ...[-1, 1].map((s) => sph([s * 0.3, -0.16, 1.45], 0.13, "#FFF6B0", n({ e: "#FFF06A", es: 9, only: "face" }))), box([0, -0.15, 1.3], [1.9, 0.05, 0.1], "#F2EDE4", n()), box([0, -0.15, 1.3], [0.1, 0.05, 1.9], "#F2EDE4", n())] },
  sign: { what: "a sign on a post with words on it", h: 3.0, attach: ["ground", "hand"], states: ["plain"], text: true,
    prims: [cyl([0, 0.06, 1.2], 0.07, 2.4, "#8C6A4A", n()), box([0, 0, 2.4], [1.9, 0.08, 1.05], "#FFFFFF", n()), box([0, 0.02, 2.4], [2.0, 0.06, 1.15], "#D32F2F", n()), txt([0, -0.07, 2.4], "SIGN", 0.26, "#1A1A22", { key: "sign" })] },
  cup: { what: "a mug", h: 0.55, attach: ["hand", "ground"], states: ["full"],
    prims: [cyl([0, 0, 0.25], 0.26, 0.5, "#F4F4F4", n({ v: 20 })), cyl([0, 0, 0.49], 0.22, 0.02, "#6B3A22", n()), cyl([0.3, 0, 0.27], 0.13, 0.06, "#F4F4F4", n({ rx: 90, v: 12 })), box([0, -0.25, 0.28], [0.2, 0.02, 0.16], "#E8505B", n())] },
  plate: { what: "a plate of food", h: 0.4, attach: ["hand", "ground"], states: ["full", "empty"],
    prims: [cyl([0, 0, 0.04], 0.55, 0.08, "#FFFFFF", n({ v: 28 })), sph([0, 0, 0.18], 0.24, "#D99A4A", n({ sc: [1.2, 1, 0.5], only: "full" })), sph([-0.22, 0.1, 0.14], 0.12, "#6FB04A", n({ only: "full" })), sph([0.25, 0.08, 0.14], 0.1, "#E53935", n({ only: "full" }))] },
  cake: { what: "a birthday cake with candles", h: 1.6, attach: ["ground", "hand"], states: ["lit", "out"],
    prims: [cyl([0, 0, 0.35], 0.9, 0.7, "#F8C8DC", n({ v: 32 })), cyl([0, 0, 0.72], 0.92, 0.08, "#FFFFFF", n({ v: 32 })), cyl([0, 0, 1.0], 0.6, 0.5, "#FFF1F6", n({ v: 32 })),
      ...[-0.3, 0, 0.3].map((x) => cyl([x, 0, 1.4], 0.04, 0.3, "#64B5F6", n())), ...[-0.3, 0, 0.3].map((x) => sph([x, 0, 1.62], 0.07, "#FFD54A", n({ sc: [1, 1, 1.6], e: "#FFB300", es: 8, only: "lit" }))),
      ...[0, 90, 180, 270].map((a) => sph([0.9 * Math.cos(a * Math.PI / 180), 0.9 * Math.sin(a * Math.PI / 180), 0.62], 0.1, "#E53935", n()))] },
  balloon: { what: "a balloon on a string", h: 3.0, attach: ["hand"], states: ["full"], grip: [0, 0, 0],
    prims: [cyl([0, 0, 0.9], 0.02, 1.8, "#EEEEEE", n()), sph([0, 0, 2.35], 0.6, "#E53935", n({ sc: [1, 1, 1.2], rough: 0.25 })), cyl([0, 0, 1.68], 0.08, 0.12, "#C62828", n({ r2: 0.02, rx: 180 }))] },
  rope: { what: "a coiled rope", h: 0.7, attach: ["hand", "ground", "back"], states: ["coiled"],
    prims: [...[0, 1, 2, 3, 4].map((k) => cyl([0, 0, 0.08 + k * 0.13], 0.48 - (k % 2) * 0.04, 0.12, "#C8A266", n({ v: 24 }))), cyl([0.45, 0, 0.35], 0.06, 0.7, "#B08A50", n({ ry: 20 }))] },
  ladder: { what: "a wooden ladder", h: 5.0, attach: ["ground"], states: ["up"],
    prims: [box([-0.6, 0, 2.5], [0.14, 0.14, 5.0], "#B8865A"), box([0.6, 0, 2.5], [0.14, 0.14, 5.0], "#B8865A"), ...[0.5, 1.1, 1.7, 2.3, 2.9, 3.5, 4.1, 4.7].map((z) => box([0, 0, z], [1.2, 0.1, 0.1], "#A87650", n()))] },
  bucket: { what: "a bucket with a handle", h: 1.0, attach: ["hand", "ground"], states: ["empty", "full"],
    prims: [cyl([0, 0, 0.36], 0.42, 0.72, "#4A90D9", n({ r2: 0.52, v: 24 })), cyl([0, 0, 0.71], 0.48, 0.02, "#1E3A5F", n({ only: "empty" })), cyl([0, 0, 0.7], 0.48, 0.03, "#7FC8F8", n({ only: "full", e: "#7FC8F8", es: 0.3 })),
      cyl([0, 0, 0.75], 0.5, 0.05, "#B0BEC5", n({ rx: 90, v: 20, sc: [1, 1, 1] }))] },
};

// the props built on the spot by earlier stories (each passed its test still): they join the library
const BUILT = path.join(HERE, "props_built.json");
export const BUILT_PROPS = fs.existsSync(BUILT) ? JSON.parse(fs.readFileSync(BUILT, "utf8")) : {};
export const allProps = () => ({ ...PROPS, ...BUILT_PROPS });
export function saveBuilt(id, recipe) { const cur = fs.existsSync(BUILT) ? JSON.parse(fs.readFileSync(BUILT, "utf8")) : {}; cur[id] = { ...recipe, built: true }; fs.writeFileSync(BUILT, JSON.stringify(cur, null, 1)); }

/** a place's own copy of a prop (a town item): its shapes tagged obj_<id>, its states through the place's key <id> */
export function placeProp(id, { scale = 1 } = {}) {
  const R = allProps()[id];
  if (!R) throw new Error(`unknown prop ${id}`);
  return R.prims.map((p) => ({ ...p, at: p.at.map((v) => v * scale), ...(p.s ? { s: p.s.map((v) => v * scale) } : {}), ...(p.r ? { r: p.r * scale } : {}), ...(p.h ? { h: p.h * scale } : {}), ...(p.size ? { size: p.size * scale } : {}),
    tag: `obj_${id}`, ...(p.only ? { only: `${id}=${p.only}` } : {}) }));
}

/** THE PROP BUILDER'S FREE CHECK: a recipe is sane before any render (shapes known, sizes, everything near the base,
 *  touching parts, its states used, a readable size) */
export function recipeProblems(id, R) {
  const out = [], T = ["box", "cyl", "sph", "text", "light"];
  if (!/^[a-z][a-z0-9_]{1,24}$/.test(id)) out.push(`id ${id}: lowercase letters / digits / _ only`);
  if (!Array.isArray(R.prims) || R.prims.length < 2 || R.prims.length > 40) out.push("2 to 40 shapes");
  if (!Array.isArray(R.states) || !R.states.length) out.push("at least one state");
  if (!(R.h >= 0.3 && R.h <= 9)) out.push("height h between 0.3 and 9 units (a kid is 3.04)");
  const used = new Set();
  let zmax = 0;
  for (const [k, p] of (R.prims ?? []).entries()) {
    if (!T.includes(p.t)) { out.push(`shape ${k}: unknown type ${p.t}`); continue; }
    if (!Array.isArray(p.at) || p.at.length !== 3 || p.at.some((v) => typeof v !== "number" || Math.abs(v) > 8)) out.push(`shape ${k}: at must be 3 numbers within 8 units of the base`);
    if (p.t === "box" && (!Array.isArray(p.s) || p.s.some((v) => !(v > 0 && v <= 9)))) out.push(`shape ${k}: box size s = 3 numbers in (0, 9]`);
    if ((p.t === "cyl" || p.t === "sph") && !(p.r > 0 && p.r <= 5)) out.push(`shape ${k}: radius r in (0, 5]`);
    if (p.t === "cyl" && !(p.h > 0 && p.h <= 9)) out.push(`shape ${k}: cylinder height h in (0, 9]`);
    if (p.c && !/^#[0-9A-Fa-f]{6}$/.test(p.c)) out.push(`shape ${k}: colour c as #RRGGBB`);
    if (p.only) for (const s of String(p.only).split("|")) { if (!R.states?.includes(s)) out.push(`shape ${k}: only "${s}" is not one of the states`); used.add(s); }
    if (Array.isArray(p.at)) zmax = Math.max(zmax, p.at[2] + (p.s?.[2] ?? 2 * (p.r ?? 0)) / 2);
  }
  const seen = (s) => (R.prims ?? []).map((p) => (!p.only || String(p.only).split("|").includes(s) ? 1 : 0)).join("");
  for (const s of (R.states ?? []).slice(1)) if (seen(s) === seen(R.states[0])) out.push(`state ${s} looks the same as ${R.states[0]} (give it shapes with only: "${s}")`);
  if (R.prims?.length && Math.abs(zmax - R.h) > Math.max(0.6, 0.35 * R.h)) out.push(`h is ${R.h} but the shapes reach ${zmax.toFixed(2)}`);
  return out;
}
