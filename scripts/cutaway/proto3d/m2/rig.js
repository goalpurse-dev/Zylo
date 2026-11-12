// M2: the rig, a part the scene planner designs itself from building blocks when the kit has no part for a thing (a
// garage door, a rain barrel, a toilet's flush valve). The owner's rule of 2026-10-26: users will type topics the kit
// has never seen, so the system builds new things instead of refusing them.
//
// A rig's params (a "part recipe"):
//   name, synonyms: what it is (a passing video saves it to the parts library under these: the kit grows by itself)
//   pos [x, y, z]: its base point on the floor (y = the floor top); rotY (radians); scale (1)
//   nodes: [{ id, parent? (a node id; default the rig's base), at [x, y, z] (its pivot, from the parent's pivot),
//             shapes: [shape...], moves: [move...] }]
// Shapes (positions from the node's pivot, metres; look: metal | plastic | wood | glass | rubber | paint | concrete):
//   box {size [w,h,d], at, rot? [rx,ry,rz] degrees, radius?}     panel {size [w,h], thick (0.05), at, rot?}
//   cylinder {r, h, axis x|y|z, at}   wheel {r, w, axis, at}   gear {r, w, teeth (12), axis, at}   hinge {r, h, axis, at}
//   spring {r, h, turns (8), wire (0.03), axis, at}   tube | cable {path [[x,y,z]...], r}   rail | track {path, w (0.12)}
//   chain | belt {path, w (0.1)}   button {r, at}   light {r, at} (a lamp; lit by a light or blink move)
//   beam {from, to, r (0.04), color} (a glowing ray between two points: a sensor beam, a laser; lit like a lamp)
//   screen {size [w,h], at, rot?} (shows a number with a count move)   model {file (a CC0 model, kit/modelCatalog), size, at, rotY?}
// The mechanism kit (phase 1 of the any-topic plan, 2026-11-04: appliances and cars are machines inside):
//   drum {r, h, axis, holes (true)} (a hollow drum, open at the front, holed wall, lifter ribs: a washer or dryer drum)
//   cone {r, r2 (0), h, axis}   sphere {r}   torus {r, tube, axis} (a ring round the axis: a seal, a tyre, a coil loop)
//   fan {r, blades (5), w (0.08), axis} (a hub with pitched blades: a fan, an impeller, a turbine; spins with a spin move)
//   element {r, turns (3), wire (0.03), axis (y)} (a flat spiral heating coil: a stove ring, a heater; glows on heat)
//   flame {r, h (0.18)} (a ring of gas flames: hidden until a burn move on its node)
//   bellows {r, h, folds (5), axis} (an accordion air bag: grows with extend, breathes with pump)
// The household things (the owner's look round of 2026-11-10: "plates look like white plates with food stains, a dish
// rack, ... recognizable parts, not abstract shapes"; the dishwasher's plates were wheels, black tyres with white hubs):
//   plate {r (0.12), axis (y: lying flat; z: standing in a rack facing the camera), stain (0-1), stainColor} (a white
//   glazed plate, a well and a raised rim; stain draws food smears on its face)   bowl {r (0.08), h, stain, stainColor}
//   cup {r (0.04), h, handle (true)} (a mug)   glass {r (0.035), h} (a drinking glass)
//   smear {r (0.05), axis, color, amount (0.6)} (soft food or grease smears on a surface: put it on its own node with an
//   appear move, so "<name>Back" washes it off)
//   rack {size [w,h,d], gap, wire, tines (true or a row count)} (a wire dish basket: a rod grid, sides, rows of prongs; a
//   fridge or oven shelf with h small and tines false)   nozzle {r (0.02), h, axis} (a spout pointing along +axis)
// Moves (each is a timeline channel named by its name; the verb "<name>" plays it, "<name>Back" undoes it):
//   appear (the piece pops in on its word: hidden until then, so a thing is built step by step)
//   slide {to [dx,dy,dz]}   swing {axis, angle (degrees)}   track {path [[x,y,z]...]} (the pivot runs along the path)
//   spin {axis, turns (per second while on)}   extend {axis, k (the scale reached)}   light (its lamps on)
//   blink {rate (per second)}   fill {box {size [w,h,d], at, color}} (rises from the box floor)
//   flow {path, color, look (spray | stream | dots), size, speed} (water as spray streaks and droplets, a liquid as a
//   stream, or dots running along the path while on; no look: guessed from its words, see flowLook)   count {from, to} (its screen's number ticks)
// The mechanism kit's moves:
//   heat {color ("#ff3a0a")} (the node's shapes glow, a coil going red-hot)   chill {color ("#bfe6ff")} (they frost over)
//   burn (its flame shapes light and flicker while on)   pump {axis, stroke (0.2), rate (1.5)} (back and forth while on:
//   a piston, a compressor, an agitator)   shake {amp (0.03), rate (8)} (a jitter while on: a drum spinning fast)
//   follow {of, ratio (1)} (turns with another node's spin or swing, times ratio: a meshing gear -r1/r2, rear wheels
//   steering -0.3; always on, it moves whenever its node moves)   crank {of, axis (y), throw (0.2)} (slides along
//   axis by throw x sin of that node's turn: a piston on a crankshaft; always on)
// Every part also has show / hide (it pops in, pops out).

export const RIG_SHAPES = ["box", "panel", "cylinder", "wheel", "gear", "hinge", "spring", "tube", "cable", "rail", "track", "chain", "belt", "button", "light", "beam", "screen", "model", "drum", "cone", "sphere", "torus", "fan", "element", "flame", "bellows", "plate", "bowl", "cup", "glass", "smear", "rack", "nozzle"];
// snap {axis, gap (m)}: the piece breaks in two along its axis and the halves stay apart, tilted (the damage stays in
// place until "<name>Back", the fix); the garage door's spring "snaps in two" could not be shown (2026-10-28)
export const RIG_MOVES = ["appear", "slide", "swing", "track", "spin", "extend", "light", "blink", "fill", "flow", "count", "snap", "heat", "chill", "burn", "pump", "shake", "follow", "crank"];
// the moves that copy another node's turn (always on: no verb plays them)
const LINKED = new Set(["follow", "crank"]);
const PATHS = new Set(["tube", "cable", "rail", "track", "chain", "belt"]);
const LOOKS = { metal: ["#b9c0c7", 0.3, 0.8], plastic: ["#e8e4dc", 0.45, 0], wood: ["#a8743f", 0.75, 0], glass: ["#cfe8f5", 0.05, 0], rubber: ["#24262a", 0.9, 0], paint: ["#d64535", 0.4, 0], concrete: ["#b9b4aa", 0.9, 0] };
// how long a move takes on its word (s), and whether it is a state that stays on (spin, blink, flow, light)
const DUR = { appear: 0.35, slide: 0.9, swing: 0.9, track: 1.2, extend: 0.8, fill: 1.2, count: 1.5, light: 0.2, blink: 0.2, spin: 0.3, flow: 0.3, snap: 0.35, heat: 1.6, chill: 1.6, burn: 0.3, pump: 0.3, shake: 0.3, follow: 0.3, crank: 0.3};

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : d);
const AX = { x: 0, y: 1, z: 2 };
const nodesOf = (p) => (Array.isArray(p?.nodes) ? p.nodes : []);
export const movesOf = (p) => nodesOf(p).flatMap((n) => (Array.isArray(n.moves) ? n.moves : []).map((m) => ({ ...m, node: n.id })));

// ---------- the household things and the water look (the owner's look round of 2026-11-10) ----------
// each household shape's own default size (a plate is not 0.1 m like a gear): the box and the builder agree on it
const HOUSE_R = { plate: 0.12, bowl: 0.08, cup: 0.04, glass: 0.035, smear: 0.05, nozzle: 0.02 };
const rOf = (s) => Math.abs(num(s.r, HOUSE_R[s.shape] ?? 0.1));
// a household shape's length along its axis (its thickness for a plate, its height for a cup)
const houseLen = (s, r) => ({ plate: r * 0.22, bowl: num(s.h, r * 0.6), cup: num(s.h, r * 2.3), glass: num(s.h, r * 3.2), smear: 0.012, nozzle: num(s.h, r * 2.5) })[s.shape];
const rgbOf = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(String(c ?? "")) ?? (/^#([0-9a-f]{3})$/i.exec(String(c ?? "")) && [0, String(c).slice(1).split("").map((x) => x + x).join("")]); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null; };
const hslOf = (c) => {
  const v = rgbOf(c); if (!v) return null;
  const mx = Math.max(...v), mn = Math.min(...v), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1)), [r, g, b] = v;
  const h = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  return { h, s, l };
};
/** a colour that reads as water (a clear blue, not the pale near-white the plans draw air with), or none given */
export const wateryColor = (c) => { if (c == null) return true; const q = hslOf(c); return !!q && q.h > 0.48 && q.h < 0.7 && q.s > 0.35 && q.l > 0.3 && q.l < 0.86; };
export const FLOW_LOOKS = ["spray", "stream", "dots"];
// the liquid words the flow kind uses work here too (a stream in that liquid's colour when none is given)
export const LIQUID_COLOR = { water: "#6fc3ff", oil: "#4a3010", mud: "#6b4a2a", sludge: "#5a5638" };
/** a flow move's colour: its own, else its liquid's */
export const flowColor = (m) => m?.color ?? LIQUID_COLOR[m?.look] ?? null;
const GASSY = /air|gas|blow|vent|steam|smoke|soot|stink|fume|exhaust|breath|wind|vapou?r|puff|spark|current|power|signal|chain|belt|carr(y|ies)|conveyor|item/i;
const SPRAYY = /spray|jet|drizzle|squirt|shower|sprinkl|mist|rinse|nozzle/i;
const WET = /water|drain|pour|siphon|flush|drip|faucet|splash/i;
const WETISH = /leak|rush|rain|refill|tap\b|wash/i;
const WET_PART = /wash|sink|toilet|shower|faucet|sprinkler|fountain/i;
/**
 * which look a flow move draws (pure: the free tests call it): its own look field, else a guess from its words. The
 * real dishwasher's water ran as chains of big blue balls (the owner, 2026-11-10): water words (spray, jet, drizzle) and
 * a water colour now draw spray streaks and droplets, a drain or a pour a stream; air, gas, a chain or a belt keep the
 * dots they were planned with, and so does anything the words do not say is wet.
 */
export function flowLook(m, nodeId = "", p = {}) {
  if (FLOW_LOOKS.includes(m?.look)) return m.look;
  if (m?.look in LIQUID_COLOR) return m.look === "water" && SPRAYY.test(`${m?.name ?? ""} ${nodeId ?? ""}`) ? "spray" : "stream";
  const own = `${m?.name ?? ""} ${nodeId ?? ""}`, part = [p?.name, ...(Array.isArray(p?.synonyms) ? p.synonyms : [])].join(" ");
  if (GASSY.test(own)) return "dots";
  const wet = wateryColor(m?.color);
  if (SPRAYY.test(own)) return wet ? "spray" : "stream";
  if (WET.test(own)) return "stream";
  if (wet && m?.color != null && (WETISH.test(own) || WET_PART.test(part))) return "stream";
  return "dots";
}
const whiteish = (c) => { const v = rgbOf(c); return !!v && Math.min(...v) > 0.78 && Math.max(...v) - Math.min(...v) < 0.14; };
/**
 * an old plan's plate drawn as a plate: a thin white wheel on a node the plan calls plates (or dishes, in a washing
 * thing) is a plate, not a tyre (the real dishwasher, 2026-11-10). null when the wheel is a wheel.
 */
export function plateFromWheel(s, nodeId, p = {}) {
  if (s?.shape !== "wheel") return null;
  const r = num(s.r, 0.1), w = num(s.w, 0.2), id = String(nodeId ?? ""), words = [p?.name, ...(Array.isArray(p?.synonyms) ? p.synonyms : []), id].join(" ");
  if (!(r > 0 && w <= r * 0.4) || !whiteish(s.color)) return null;
  if (!(/plate|saucer/i.test(id) || (/dish/i.test(id) && /wash|rack|sink|kitchen|cupboard/i.test(words)))) return null;
  const { w: _w, ...rest } = s;
  return { ...rest, shape: "plate", r };
}

/** the timeline channels of a rig: its pop and one per move */
export const rigChannels = (p) => ["pop", ...new Set(movesOf(p).map((m) => m.name).filter(Boolean))];

/** a verb on a rig as ramps [{c, a, b, amp, e, stretch}]: show / hide, "<move>" and "<move>Back"; null if none */
export function rigVerb(p, v) {
  const R = (c, a, b, amp = 1, e = "inOut") => ({ c, a, b, amp, e, stretch: true });
  if (v === "show") return [R("pop", -0.1, 0.3, 1, "back")];
  if (v === "hide") return [R("pop", 0, 0.25, -1, "in2")];
  const back = /Back$/.test(v), name = back ? v.slice(0, -4) : v, m = movesOf(p).find((x) => x.name === name);
  if (!m) return null;
  const d = DUR[m.type] ?? 0.9;
  return [R(name, back ? 0 : -0.05, back ? d * 0.8 : d, back ? -1 : 1, m.type === "count" ? "lin" : m.type === "appear" && !back ? "back" : "inOut")];
}

// ---------- the pure geometry: a shape's box at rest, a node's pivot, the whole rig's box (for the camera) ----------
function shapeBox(s) {
  const at = v3(s.at), r = s.shape in HOUSE_R ? rOf(s) : num(s.r, 0.1);
  let half;
  if (s.shape === "rack") half = v3(s.size, [0.5, 0.2, 0.5]).map((x) => Math.abs(x) / 2);
  else if (s.shape in HOUSE_R) { const rad = s.shape === "cup" && s.handle !== false ? r * 1.5 : r; half = [rad, rad, rad]; half[AX[s.axis] ?? 1] = Math.abs(houseLen(s, r)) / 2; }
  if (s.shape === "beam") { const a = v3(s.from), b = v3(s.to), w = num(s.r, 0.04) + 0.03; return { min: [0, 1, 2].map((i) => Math.min(a[i], b[i]) - w), max: [0, 1, 2].map((i) => Math.max(a[i], b[i]) + w) }; }
  if (PATHS.has(s.shape)) {
    const pts = (Array.isArray(s.path) ? s.path : []).map((q) => v3(q)), w = Math.max(num(s.r, 0), num(s.w, 0.12)) / 2 + 0.02;
    if (!pts.length) return null;
    return { min: [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i])) - w), max: [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])) + w) };
  }
  if (half) { /* a household shape or a rack, sized above */ }
  else if (s.shape === "box") half = v3(s.size, [0.5, 0.5, 0.5]).map((x) => Math.abs(x) / 2);
  else if (s.shape === "panel") { const [w, h] = Array.isArray(s.size) ? s.size.map(Number) : [1, 1]; half = [w / 2, h / 2, num(s.thick, 0.05) / 2]; }
  else if (s.shape === "screen") { const [w, h] = Array.isArray(s.size) ? s.size.map(Number) : [0.5, 0.35]; half = [w / 2 + 0.04, h / 2 + 0.04, 0.05]; }
  // (a model stands on its base at the shape's point: it rises from there)
  else if (s.shape === "model") { const k = num(s.size, 1) / 2; return { min: [at[0] - k, at[1], at[2] - k], max: [at[0] + k, at[1] + 2 * k, at[2] + k] }; }
  else if (["button", "light", "sphere"].includes(s.shape)) half = [r, r, r];
  // (a flame ring rises from its point)
  else if (s.shape === "flame") { const h = num(s.h, 0.18); return { min: [at[0] - r - 0.05, at[1], at[2] - r - 0.05], max: [at[0] + r + 0.05, at[1] + h, at[2] + r + 0.05] }; }
  else {
    const len = { wheel: num(s.w, 0.2), gear: num(s.w, 0.2), fan: num(s.w, 0.08), torus: 2 * num(s.tube, r * 0.25), element: 2 * num(s.wire, 0.03) + 0.02 }[s.shape] ?? num(s.h, 0.5);
    const rad = s.shape === "gear" ? r * 1.15 : s.shape === "torus" ? r + num(s.tube, r * 0.25) : s.shape === "cone" ? Math.max(r, num(s.r2, 0)) : s.shape === "element" ? r + num(s.wire, 0.03) : r;
    half = [rad, rad, rad]; half[AX[s.axis] ?? 1] = len / 2;
  }
  // a rotated shape: its bounding sphere (safe for the camera and the floating check)
  if (Array.isArray(s.rot) && s.rot.some((a) => Math.abs(num(a)) > 0.5)) { const k = Math.hypot(...half); half = [k, k, k]; }
  return { min: at.map((c, i) => c - half[i]), max: at.map((c, i) => c + half[i]) };
}
const unionB = (bs) => { bs = bs.filter(Boolean); if (!bs.length) return null; return { min: [0, 1, 2].map((i) => Math.min(...bs.map((b) => b.min[i]))), max: [0, 1, 2].map((i) => Math.max(...bs.map((b) => b.max[i]))) }; };
const shift = (b, d) => b && { min: b.min.map((x, i) => x + d[i]), max: b.max.map((x, i) => x + d[i]) };

/** each node's pivot in rig space at rest (parents first), or null for a node whose parent chain is broken */
function pivots(p) {
  const nodes = nodesOf(p), byId = new Map(nodes.map((n) => [n.id, n])), out = new Map();
  const at = (n, seen = new Set()) => {
    if (out.has(n.id)) return out.get(n.id);
    if (seen.has(n.id)) return null; seen.add(n.id);
    const parent = n.parent ? byId.get(n.parent) : null;
    if (n.parent && !parent) return null;
    const base = parent ? at(parent, seen) : [0, 0, 0];
    const v = base && base.map((c, i) => c + v3(n.at)[i]);
    out.set(n.id, v); return v;
  };
  for (const n of nodes) at(n);
  return out;
}

/** a node's own box at rest in rig space, and the box it sweeps while it moves */
function nodeBoxes(p) {
  const piv = pivots(p), out = new Map();
  for (const n of nodesOf(p)) {
    const pv = piv.get(n.id); if (!pv) continue;
    const rest = unionB([...(n.shapes ?? []).map(shapeBox), ...(n.moves ?? []).filter((m) => m.type === "fill" && m.box).map((m) => shapeBox({ shape: "box", size: m.box.size, at: m.box.at }))].map((b) => shift(b, pv)));
    if (!rest) { out.set(n.id, { rest: null, swept: null, pivot: pv }); continue; }
    const swept = [rest];
    for (const m of n.moves ?? []) {
      if (m.type === "slide") swept.push(shift(rest, v3(m.to)));
      // (a pump or crank travels its stroke both ways along its axis, a shake a little everywhere)
      if (m.type === "pump" || m.type === "crank") { const d = [0, 0, 0]; d[AX[m.axis] ?? 1] = m.type === "pump" ? num(m.stroke, 0.2) : num(m.throw, 0.2); swept.push(shift(rest, d), shift(rest, d.map((x) => -x))); }
      if (m.type === "shake") { const a = num(m.amp, 0.03); swept.push(shift(rest, [a, a, a]), shift(rest, [-a, -a, -a])); }
      if (m.type === "track") for (const q of m.path ?? []) swept.push(shift(rest, v3(q)));
      // (a swing turns the box's corners through its angle about the hinge, a spin all the way round; along the axis
      // the piece keeps its size)
      // (a follower turns as far as its node might: all the way round, as a spin)
      if (m.type === "swing" || m.type === "spin" || m.type === "follow") {
        const a = AX[m.axis] ?? 1, [i, j] = [0, 1, 2].filter((q) => q !== a), deg = m.type === "swing" ? num(m.angle, 90) : 360, pts = [];
        for (let st = 0; st <= 12; st++) {
          const r = (deg * Math.PI / 180) * (st / 12), c = Math.cos(r), s = Math.sin(r);
          for (const u of [rest.min[i], rest.max[i]]) for (const w of [rest.min[j], rest.max[j]]) { const du = u - pv[i], dw = w - pv[j]; pts.push([pv[i] + du * c - dw * s, pv[j] + du * s + dw * c]); }
        }
        const b = { min: [...rest.min], max: [...rest.max] };
        b.min[i] = Math.min(...pts.map((q) => q[0])); b.max[i] = Math.max(...pts.map((q) => q[0])); b.min[j] = Math.min(...pts.map((q) => q[1])); b.max[j] = Math.max(...pts.map((q) => q[1]));
        swept.push(b);
      }
      if (m.type === "extend") { const i = AX[m.axis] ?? 1, k = Math.max(1, num(m.k, 1.5)); const b = { min: [...rest.min], max: [...rest.max] }; b.max[i] = pv[i] + (rest.max[i] - pv[i]) * k; b.min[i] = pv[i] + (rest.min[i] - pv[i]) * k; swept.push(b); }
      if (m.type === "snap") { const i = AX[m.axis] ?? 1, g = num(m.gap, 0.25) / 2 + 0.05; const b = { min: [...rest.min], max: [...rest.max] }; b.min[i] -= g; b.max[i] += g; swept.push(b); }
    }
    out.set(n.id, { rest, swept: unionB(swept), pivot: pv });
  }
  return out;
}

function rigBoxPlayed(p, { node, hide, played }) {
  const nodes = nodesOf(p), byId = new Map(nodes.map((n) => [n.id, n])), boxes = nodeBoxes(p);
  const keep = node ? new Set([node]) : null;
  if (keep) for (let grown = true; grown;) { grown = false; for (const n of nodes) if (n.parent && keep.has(n.parent) && !keep.has(n.id)) { keep.add(n.id); grown = true; } }
  const gone = hide ? new Set(hide) : null;
  if (gone) for (let grown = true; grown;) { grown = false; for (const n of nodes) if (n.parent && gone.has(n.parent) && !gone.has(n.id)) { gone.add(n.id); grown = true; } }
  const lift = (n, seen = new Set()) => {
    if (!n || seen.has(n.id)) return [0, 0, 0]; seen.add(n.id);
    const own = (n.moves ?? []).filter((m) => m.type === "slide" && played.has(m.name)).reduce((a, m) => a.map((v, i) => v + v3(m.to)[i]), [0, 0, 0]);
    const up = n.parent ? lift(byId.get(n.parent), seen) : [0, 0, 0];
    return own.map((v, i) => v + up[i]);
  };
  const b = unionB([...boxes].filter(([id]) => (!keep || keep.has(id)) && (!gone || !gone.has(id))).map(([id, x]) => shift(x.rest, lift(byId.get(id)))));
  if (!b) return null;
  const s = num(p.scale, 1), pos = v3(p.pos), ry = num(p.rotY, 0), cs = [];
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) cs.push([x * s * Math.cos(ry) + z * s * Math.sin(ry), z * s * Math.cos(ry) - x * s * Math.sin(ry)]);
  return { min: [Math.min(...cs.map((c) => c[0])) + pos[0], b.min[1] * s + pos[1], Math.min(...cs.map((c) => c[1])) + pos[2]], max: [Math.max(...cs.map((c) => c[0])) + pos[0], b.max[1] * s + pos[1], Math.max(...cs.map((c) => c[1])) + pos[2]] };
}

/** the rig's box in world space (at rest and through its moves), for the camera and the checks */
/** rigBox, softly (its crash is our bug, logged; no box) */
export function rigBox(p, opts = {}) { return soft("a designed part's box (rigBox)", () => rigBoxRaw(p, opts), null); }
function rigBoxRaw(p, { swept = true, node = null, hide = null, played = null } = {}) {
  // (played: the move names played so far in the story, a Set: each piece at rest, carried by the slides it and the pieces
  // it hangs on have made; a float inside a tank lifted onto its legs was framed where the tank stood before the lift, the
  // camera on the bare legs, the real water tower run of 2026-11-11)
  if (played) return rigBoxPlayed(p, { node, hide, played });
  // (node: one piece and the pieces hung on it, for a shot of "part.node": the camera frames the motor, not the garage)
  const keep = node ? new Set([node]) : null;
  if (keep) for (let grown = true; grown;) { grown = false; for (const n of nodesOf(p)) if (n.parent && keep.has(n.parent) && !keep.has(n.id)) { keep.add(n.id); grown = true; } }
  // (hide: pieces not shown yet, and the pieces hung on them: the hook's opening frame measured pieces that appear later)
  const gone = hide ? new Set(hide) : null;
  if (gone) for (let grown = true; grown;) { grown = false; for (const n of nodesOf(p)) if (n.parent && gone.has(n.parent) && !gone.has(n.id)) { gone.add(n.id); grown = true; } }
  const b = unionB([...nodeBoxes(p)].filter(([id]) => (!keep || keep.has(id)) && (!gone || !gone.has(id))).map(([, x]) => (swept ? x.swept : x.rest)));
  if (!b) return null;
  const s = num(p.scale, 1), pos = v3(p.pos), ry = num(p.rotY, 0);
  // a turned rig: the box of its corners turned about y
  const cs = [];
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) cs.push([x * s * Math.cos(ry) + z * s * Math.sin(ry), z * s * Math.cos(ry) - x * s * Math.sin(ry)]);
  return { min: [Math.min(...cs.map((c) => c[0])) + pos[0], b.min[1] * s + pos[1], Math.min(...cs.map((c) => c[1])) + pos[2]], max: [Math.max(...cs.map((c) => c[0])) + pos[0], b.max[1] * s + pos[1], Math.max(...cs.map((c) => c[1])) + pos[2]] };
}

/**
 * The code checks on a recipe (free, before anything is paid for after the plan): a recipe the renderer can build, of a
 * sensible size, every piece joined to its parent, standing on the floor (or in the cut). problems: [strings].
 */
/** the recipe checks, softly (a check that crashes is our bug, logged, and finds nothing) */
export function rigProblems(part, opts = {}) { return soft("the designed part checks (rigProblems)", () => rigProblemsRaw(part, opts), []); }
function rigProblemsRaw(part, { floor = 0, cut = null, supports = [], sunkOk = false } = {}) {
  const P = [], p = part.params ?? {}, id = part.id, nodes = nodesOf(p);
  if (!nodes.length) return [`part ${id} (rig): needs nodes, each with shapes`];
  if (nodes.length > 40) P.push(`part ${id} (rig): ${nodes.length} nodes (at most 40)`);
  const shapes = nodes.flatMap((n) => n.shapes ?? []);
  if (!shapes.length) P.push(`part ${id} (rig): no shapes`);
  if (shapes.length > 160) P.push(`part ${id} (rig): ${shapes.length} shapes (at most 160)`);
  const ids = new Set();
  for (const n of nodes) {
    if (!n.id || ids.has(n.id)) P.push(`part ${id} (rig): every node needs its own id (${n.id ?? "missing"})`); ids.add(n.id);
  }
  for (const n of nodes) if (n.parent && !ids.has(n.parent)) P.push(`part ${id} (rig): node ${n.id}'s parent ${n.parent} is not a node`);
  const piv = pivots(p);
  for (const n of nodes) if (!piv.get(n.id)) P.push(`part ${id} (rig): node ${n.id}'s parents loop or are missing`);
  for (const n of nodes) for (const s of n.shapes ?? []) {
    if (!RIG_SHAPES.includes(s.shape)) { P.push(`part ${id} (rig): node ${n.id}: unknown shape ${s.shape} (use ${RIG_SHAPES.join(", ")})`); continue; }
    if (PATHS.has(s.shape) && !(Array.isArray(s.path) && s.path.length >= 2 && s.path.every((q) => v3(q, null)))) P.push(`part ${id} (rig): node ${n.id}: a ${s.shape} needs a path of 2+ points [x, y, z]`);
    if (s.shape === "model" && !s.file) P.push(`part ${id} (rig): node ${n.id}: a model shape needs a file from the model catalog`);
    const b = shapeBox(s);
    if (b && b.max.some((x, i) => x - b.min[i] > 16)) P.push(`part ${id} (rig): node ${n.id}: a ${s.shape} over 16 m long (sizes are in metres)`);
    if (b && b.max.every((x, i) => x - b.min[i] < 0.01)) P.push(`part ${id} (rig): node ${n.id}: a ${s.shape} too small to see`);
  }
  // one name on several nodes is one move of them all (a garage door's sections rolling up together): the same type
  const types = new Map();
  for (const m of movesOf(p)) {
    if (!m.name) P.push(`part ${id} (rig): every move needs a name`);
    else if (types.has(m.name) && types.get(m.name) !== m.type) P.push(`part ${id} (rig): move ${m.name} is a ${types.get(m.name)} on one node and a ${m.type} on another (one name, one type)`);
    else types.set(m.name, m.type);
    if (["show", "hide", "pop"].includes(m.name) || /Back$/.test(m.name ?? "")) P.push(`part ${id} (rig): move name ${m.name} is reserved`);
    if (!RIG_MOVES.includes(m.type)) P.push(`part ${id} (rig): move ${m.name}: unknown type ${m.type} (use ${RIG_MOVES.join(", ")})`);
    if (m.type === "track" && !(Array.isArray(m.path) && m.path.length >= 2)) P.push(`part ${id} (rig): move ${m.name}: a track needs a path of 2+ points`);
    if (m.type === "flow" && !(Array.isArray(m.path) && m.path.length >= 2)) P.push(`part ${id} (rig): move ${m.name}: a flow needs a path of 2+ points`);
    if (m.type === "fill" && !m.box?.size) P.push(`part ${id} (rig): move ${m.name}: a fill needs box {size, at}`);
    if (m.type === "count" && !nodes.find((n) => n.id === m.node)?.shapes?.some((s) => s.shape === "screen")) P.push(`part ${id} (rig): move ${m.name}: a count needs a screen shape on its node`);
    if (LINKED.has(m.type)) {
      const src = nodes.find((n) => n.id === m.of);
      if (!src) P.push(`part ${id} (rig): move ${m.name}: a ${m.type} names the node it copies in "of" (${m.of ?? "missing"} is not a node)`);
      else if (src.id === m.node) P.push(`part ${id} (rig): move ${m.name}: a ${m.type} cannot copy its own node`);
      else if (!(src.moves ?? []).some((x) => ["spin", "swing", "follow"].includes(x.type))) P.push(`part ${id} (rig): move ${m.name}: node ${src.id} never turns (give it a spin, swing or follow move)`);
    }
  }
  for (const n of nodes) if ((n.shapes ?? []).some((s) => s.shape === "flame") && !(n.moves ?? []).some((m) => m.type === "burn")) P.push(`part ${id} (rig): node ${n.id}: a flame shape stays hidden without a burn move on its node`);
  // every piece joined: a node's own shapes touch its parent's (or the base, for a top node standing on it)
  const nb = nodeBoxes(p), near = (a, b, pad = 0.12) => a && b && [0, 1, 2].every((i) => a.min[i] <= b.max[i] + pad && b.min[i] <= a.max[i] + pad);
  for (const n of nodes) if (n.parent && nb.get(n.id)?.rest && nb.get(n.parent)?.rest && !near(nb.get(n.id).rest, nb.get(n.parent).rest)) P.push(`part ${id} (rig): node ${n.id} floats apart from its parent ${n.parent} (move it so they touch)`);
  // the whole rig: a sensible size, standing on the floor (its lowest point at the floor) or set into the cut
  const b = rigBox(p, { swept: false });
  if (b) {
    const size = b.max.map((x, i) => x - b.min[i]);
    if (Math.max(...size) > 18) P.push(`part ${id} (rig): ${Math.max(...size).toFixed(1)} m across (at most 18: sizes are in metres)`);
    if (Math.max(...size) < 0.15) P.push(`part ${id} (rig): too small to see (${Math.max(...size).toFixed(2)} m)`);
    const inCut = cut && b.min[1] < -0.2 && b.min[0] < cut.x1 && b.max[0] > cut.x0 && b.max[2] > cut.z0;
    // (or standing on another rig: the cart crossing the deck of the ancient bridge run of 2026-11-04 was refused at 4.2 m)
    const onPart = supports.some((s) => Math.abs(b.min[1] - s.max[1]) <= 0.3 && b.min[0] < s.max[0] && s.min[0] < b.max[0] && b.min[2] < s.max[2] && s.min[2] < b.max[2]);
    if (!inCut && !onPart && p.mount !== "wall" && (sunkOk ? b.min[1] - floor > 0.3 : Math.abs(b.min[1] - floor) > 0.3)) P.push(`part ${id} (rig): its lowest point is at y = ${b.min[1].toFixed(2)}, not on the floor (y ${floor}): set pos y to the floor and build up from the node pivots`);
  }
  return P;
}

import { model } from "../kit/models.js";
import { soft } from "./bookkeeping.js";
import { surfaceKind, surfaces } from "./materials.js";

// ---------- the renderer (the page): the shapes in the house style, and the moves on their channels ----------
export function rig(ctx, p, api) {
  const { THREE, std, C, RoundedBoxGeometry } = ctx;
  const root = new THREE.Group(); root.position.set(...v3(p.pos)); root.rotation.y = num(p.rotY, 0); root.scale.setScalar(num(p.scale, 1)); ctx.scene.add(root);
  const body = new THREE.Group(); root.add(body);
  // (the node being built: its id and the part's name pick a shape's surface, "shingles", "chimney", "grate")
  let nodeWords = "";
  const matOf = (s, extra = {}) => {
    const [col, rough, metal] = LOOKS[s.look] ?? LOOKS.paint;
    // a custom layout's shapes are made of something (owner's rules 16 and 18, 2026-11-11): the surface library at real
    // scale, a fresh material each (a heat or chill move tints its own); a premade layout keeps the flat house style
    if (ctx.realLook === true && !Object.keys(extra).length) {
      const kind = surfaceKind({ look: s.look ?? "paint", words: `${nodeWords} ${s.name ?? ""}`, surface: s.surface });
      if (kind) { try { return surfaces(ctx).make(kind, s.color ?? col); } catch (e) { rigBug(`surface ${kind}`, e); } }
    }
    const m = std({ color: C(s.color ?? col), roughness: rough, metalness: metal, ...extra });
    if (s.look === "glass") { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; }
    return m;
  };
  const place = (mesh, s, parent) => { mesh.position.set(...v3(s.at)); if (Array.isArray(s.rot)) mesh.rotation.set(...s.rot.map((a) => (num(a) * Math.PI) / 180)); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const alongAxis = (geo, axis) => { if (axis === "x") geo.rotateZ(Math.PI / 2); else if (axis === "z") geo.rotateX(Math.PI / 2); return geo; };
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...v3(q))), false, "catmullrom", 0.05);
  const groups = new Map(), lamps = new Map(), screens = new Map(), flames = new Map(), fills = [], flows = [], snaps = [];
  // (the owner's rule of 2026-11-05: one bad shape or move of a designed part is skipped and logged as our bug, the part is still drawn)
  const deadMoves = new Set(), rigBug = (what, e) => console.error(`[cutaway-bug] ${p.name ?? "rig"}: ${what} skipped: ${e?.message ?? e}`);
  const screenTex = new Map(), notedPlates = new Set();
  const numTex = (v, col) => {
    const key = `${v}|${col}`; if (screenTex.has(key)) return screenTex.get(key);
    const cv = typeof document !== "undefined" ? document.createElement("canvas") : null; if (!cv) return null;
    cv.width = 256; cv.height = 180; const g = cv.getContext("2d");
    g.fillStyle = "#06120a"; g.fillRect(0, 0, 256, 180); g.fillStyle = col; g.font = "bold 140px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(v), 128, 98);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; screenTex.set(key, t); return t;
  };
  // ----- the household looks (2026-11-10): glazed white china, clear glass, food smears, soft mist -----
  const glaze = (col) => (ctx.phys ? ctx.phys({ color: C(col), roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }) : std({ color: C(col), roughness: 0.2, metalness: 0 }));
  const glassMat = (col) => { const m = (ctx.phys ?? std)({ color: C(col ?? "#e6f4fb"), roughness: 0.05, metalness: 0, ...(ctx.phys ? { clearcoat: 1 } : {}) }); m.transparent = true; m.opacity = 0.32; m.depthWrite = false; return m; };
  // a shape built in the y-up frame laid along its axis (y: as built; z: its top toward the camera; x: toward +x)
  const orient = (g, axis) => { if (axis === "z") g.rotation.x = Math.PI / 2; else if (axis === "x") g.rotation.z = -Math.PI / 2; const w = new THREE.Group(); w.add(g); return w; };
  const seedOf = (s) => { const a = v3(s.at); return Math.abs(Math.round(a[0] * 7919 + a[1] * 104729 + a[2] * 1299709 + rOf(s) * 15485863)) + 1; };
  const canvas = (n) => { const cv = typeof document !== "undefined" ? document.createElement("canvas") : null; if (cv) { cv.width = n; cv.height = n; } return cv; };
  const texs = new Map();
  // food smears: a few soft strokes of sauce and some crumbs, drawn once per colour, amount and seed (no canvas: none)
  const smearTex = (col, amount, seed) => {
    const key = `smear|${col}|${amount.toFixed(2)}|${seed}`; if (texs.has(key)) return texs.get(key);
    const cv = canvas(256); if (!cv) return null;
    const g2 = cv.getContext("2d"), [r, gg, b] = rgbOf(col) ?? [0.54, 0.29, 0.11], rgba = (k, a) => `rgba(${Math.round(r * k * 255)},${Math.round(gg * k * 255)},${Math.round(b * k * 255)},${a})`;
    let st = (seed % 2147483646) + 1; const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647;
    g2.save(); g2.beginPath(); g2.arc(128, 128, 124, 0, Math.PI * 2); g2.clip();
    const n = 2 + Math.round(amount * 5);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 78, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, dir = rnd() * Math.PI, len = 20 + rnd() * 50, k = 0.75 + rnd() * 0.4;
      for (let j = 0; j < 7; j++) {
        const f = j / 6 - 0.5, x = cx + Math.cos(dir) * len * f + (rnd() - 0.5) * 8, y = cy + Math.sin(dir) * len * f + (rnd() - 0.5) * 8, rad = (9 + rnd() * 15) * (0.6 + amount * 0.6);
        const gr = g2.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(k, 0.8)); gr.addColorStop(0.55, rgba(k, 0.55)); gr.addColorStop(1, rgba(k, 0));
        g2.fillStyle = gr; g2.beginPath(); g2.arc(x, y, rad, 0, Math.PI * 2); g2.fill();
      }
    }
    for (let i = 0, nc = Math.round(amount * 16); i < nc; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 100; g2.fillStyle = rgba(0.5, 0.9); g2.beginPath(); g2.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1.5 + rnd() * 3, 0, Math.PI * 2); g2.fill(); }
    g2.restore();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texs.set(key, t); return t;
  };
  // a disc of smears facing +y (laid on a plate's well, or turned with its shape's axis)
  const smearMesh = (rad, col, amount, seed) => {
    const map = smearTex(col, amount, seed); if (!map) return null;
    const mt = std({ map, color: C("#ffffff"), roughness: 0.45, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.CircleGeometry(rad, 32); geo.rotateX(-Math.PI / 2);
    const o = new THREE.Mesh(geo, mt); o.receiveShadow = true; o.castShadow = false; return o;
  };
  // a soft round puff (white centre fading out): the mist where a spray lands
  const puffTex = () => {
    if (texs.has("puff")) return texs.get("puff");
    const cv = canvas(64); if (!cv) return null;
    const g2 = cv.getContext("2d"), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texs.set("puff", t); return t;
  };
  /**
   * water and other liquids along a flow path (2026-11-10, the owner: "water as spray streams and droplets instead of
   * balls"). spray: thin bright streaks fanning out along the path, droplets breaking off and falling, a light mist where
   * it lands; stream: a liquid running the path (a translucent water stream, or an opaque oil or mud one) with moving
   * glints. Everything is placed from t alone (frames render out of order).
   */
  const liquid = (c, m, look, g) => {
    const water = wateryColor(flowColor(m)), col = C(flowColor(m) ?? "#6fc3ff"), size = Math.max(0.005, num(m.size, 0.05)), L = Math.max(0.02, c.getLength()), rate = Math.max(0.2, num(m.speed, 0.6));
    const bright = col.clone().lerp(C("#ffffff"), water ? 0.3 : 0.12);
    const mat = (op, ei, base = bright) => { const mt = std({ color: base.clone(), emissive: col.clone(), emissiveIntensity: ei, roughness: water ? 0.06 : 0.3, metalness: 0 }); mt.transparent = true; mt.opacity = op; mt.depthWrite = false; return mt; };
    const up = new THREE.Vector3(0, 1, 0), t0 = c.getTangentAt(0), side = new THREE.Vector3().crossVectors(t0, Math.abs(t0.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize(), side2 = new THREE.Vector3().crossVectors(t0, side).normalize();
    const end = c.getPointAt(1), tEnd = c.getTangentAt(1);
    const at = (u, out) => (u <= 1 ? out.copy(c.getPointAt(Math.max(0, u))) : out.copy(end).addScaledVector(tEnd, (u - 1) * L));
    const tan = (u) => c.getTangentAt(Math.min(1, Math.max(0, u)));
    const parts = [], mats = [];
    const frac = (x) => x - Math.floor(x);
    if (look === "spray") {
      // the streaks (thin streaks pointed at both ends): a centre lane and five round it, widening toward the end
      const nS = Math.max(3, Math.min(8, Math.round(L / (size * 3)))), sl = Math.min((L / nS) * 1.1, size * 8), sr = size * 0.075;
      const sm = mat(0.7, water ? 0.7 : 0.15), geo = new THREE.SphereGeometry(sr, 8, 6).scale(1, sl / (2 * sr), 1); mats.push([sm, 0.6]);
      const core = new THREE.Mesh(new THREE.TubeGeometry(c, 24, size * 0.1, 6), mat(0.35, 0.5)); core.castShadow = false; g.add(core); mats.push([core.material, 0.35]);
      const lanes = [[0, 0], ...[0, 1, 2, 3, 4].map((k) => [Math.cos((k * 2 * Math.PI) / 5), Math.sin((k * 2 * Math.PI) / 5)])];
      lanes.forEach(([a, b], k) => { for (let i = 0; i < nS; i++) { const o = new THREE.Mesh(geo, sm); o.castShadow = false; o.visible = false; g.add(o); parts.push({ o, kind: "streak", k, i, a, b }); } });
      // the droplets breaking off along the second half, and the mist where it lands
      const dg = new THREE.SphereGeometry(size * 0.11, 8, 6), dm = mat(0.9, water ? 0.4 : 0.15); mats.push([dm, 0.9]);
      for (let i = 0; i < 14; i++) { const o = new THREE.Mesh(dg, dm); o.castShadow = false; o.visible = false; o.scale.setScalar(0.6 + frac(i * 0.754877) * 0.8); g.add(o); parts.push({ o, kind: "drop", i }); }
      const pt = water ? puffTex() : null;
      if (pt) for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, color: bright.clone(), transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; g.add(sp); parts.push({ o: sp, kind: "mist", i }); }
      return {
        update(v, t) {
          for (const [mt, op] of mats) mt.opacity = op * v;
          const pt = new THREE.Vector3();
          for (const q of parts) {
            q.o.visible = v > 0.05; if (!q.o.visible) continue;
            if (q.kind === "streak") {
              const u = frac(t * rate * 1.6 + q.i / nS + q.k * 0.37), spread = size * 1.3 * u;
              if (u > v * 1.05) { q.o.visible = false; continue; }
              at(u, pt).addScaledVector(side, q.a * spread).addScaledVector(side2, q.b * spread); q.o.position.copy(pt);
              q.o.quaternion.setFromUnitVectors(up, tan(u)); q.o.scale.set(1, 0.6 + 0.4 * Math.min(1, u * 4), 1);
            } else if (q.kind === "drop") {
              const u = 0.35 + frac(t * rate * 1.2 + q.i * 0.618034) * 0.8, ang = q.i * 2.39996, sc = size * 2.4 * (u - 0.3);
              at(u, pt).addScaledVector(side, Math.cos(ang) * sc).addScaledVector(side2, Math.sin(ang) * sc); pt.y -= size * 3 * Math.max(0, u - 0.7) ** 2 * 4;
              q.o.position.copy(pt);
            } else {
              const k = 1 + 0.25 * Math.sin(t * 3 + q.i * 1.7), ang = q.i * 1.9; at(1, pt).addScaledVector(side, Math.cos(ang) * size * 1.2).addScaledVector(side2, Math.sin(ang) * size * 1.2);
              q.o.position.copy(pt); q.o.scale.setScalar(size * 5 * k); q.o.material.opacity = 0.22 * v;
            }
          }
        },
      };
    }
    // stream: the liquid itself, drawn from the start as it switches on (its index runs segment by segment along the path)
    const S = Math.max(16, Math.min(96, Math.round(L / (size * 0.5)))), R = 10, rT = size * (water ? 0.42 : 0.55);
    const geo = new THREE.TubeGeometry(c, S, rT, R), body = new THREE.Mesh(geo, water ? mat(0.62, 0.3, col.clone().lerp(C("#ffffff"), 0.1)) : mat(0.95, 0.06, col.clone())); body.castShadow = false; g.add(body); mats.push([body.material, body.material.opacity]);
    const nG = Math.max(3, Math.min(12, Math.round(L / (size * 4)))), gm = mat(0.85, water ? 0.6 : 0.2, col.clone().lerp(C("#ffffff"), water ? 0.75 : 0.35)), gg = new THREE.CapsuleGeometry(rT * 0.55, size * 1.8, 3, 8); mats.push([gm, 0.85]);
    for (let i = 0; i < nG; i++) { const o = new THREE.Mesh(gg, gm); o.castShadow = false; o.visible = false; g.add(o); parts.push({ o, i }); }
    return {
      update(v, t) {
        for (const [mt, op] of mats) mt.opacity = op * Math.min(1, v * 1.5);
        body.visible = v > 0.02; geo.setDrawRange(0, Math.ceil(S * Math.min(1, v)) * R * 6);
        const pt = new THREE.Vector3();
        for (const q of parts) {
          const u = frac(t * rate + q.i / nG); q.o.visible = v > 0.05 && u <= v;
          if (q.o.visible) { at(u, pt); q.o.position.copy(pt); q.o.quaternion.setFromUnitVectors(up, tan(u)); }
        }
      },
    };
  };
  const build = (s, parent, nodeId) => {
    const r = num(s.r, 0.1);
    switch (s.shape) {
      case "box": { const [w, h, d] = v3(s.size, [0.5, 0.5, 0.5]).map(Math.abs); return place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(num(s.radius, 0.03), w * 0.45, h * 0.45, d * 0.45)), matOf(s)), s, parent); }
      case "panel": { const [w, h] = (s.size ?? [1, 1]).map(Number), t = num(s.thick, 0.05); return place(new THREE.Mesh(new RoundedBoxGeometry(w, h, t, 2, Math.min(0.015, t * 0.45)), matOf(s)), s, parent); }
      case "cylinder": case "hinge": return place(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(r, r, num(s.h, 0.5), 24), s.axis), matOf(s.shape === "hinge" ? { look: "metal", ...s } : s)), s, parent);
      case "button": return place(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(r, r, r * 0.6, 20), s.axis ?? "z"), matOf({ look: "plastic", ...s })), s, parent);
      case "wheel": {
        const g = new THREE.Group(), w = num(s.w, 0.2);
        g.add(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(r, r, w, 28), s.axis), matOf({ look: "rubber" })));
        g.add(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 1.05, 20), s.axis), matOf({ look: "metal", ...s })));
        return place(g, s, parent);
      }
      case "gear": {
        const g = new THREE.Group(), w = num(s.w, 0.15), n = Math.max(6, Math.round(num(s.teeth, 12))), m = matOf({ look: "metal", ...s });
        g.add(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(r, r, w, 32), s.axis), m));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.3, w), m), c = Math.cos(a) * r * 1.05, d = Math.sin(a) * r * 1.05;
          // the teeth stand round the axis
          if ((s.axis ?? "z") === "z") { tooth.position.set(c, d, 0); tooth.rotation.z = a; } else if (s.axis === "x") { tooth.geometry.rotateY(Math.PI / 2); tooth.position.set(0, c, d); tooth.rotation.x = a; } else { tooth.geometry.rotateX(Math.PI / 2); tooth.position.set(c, 0, d); tooth.rotation.y = -a; }
          g.add(tooth);
        }
        return place(g, s, parent);
      }
      case "spring": {
        const h = num(s.h, 0.6), turns = num(s.turns, 8), pts = [];
        for (let i = 0; i <= turns * 24; i++) { const a = (i / 24) * Math.PI * 2, y = (i / (turns * 24)) * h - h / 2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
        return place(new THREE.Mesh(alongAxis(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, num(s.wire, 0.03), 8), s.axis), matOf({ look: "metal", ...s })), s, parent);
      }
      case "tube": case "cable": {
        const pts = s.path ?? [[0, 0, 0], [0, 1, 0]], rr = num(s.r, s.shape === "cable" ? 0.03 : 0.1);
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve(pts), Math.max(8, pts.length * 12), rr, 12), matOf({ look: s.shape === "cable" ? "rubber" : "plastic", ...s }));
        m.castShadow = true; parent.add(m); return m;
      }
      case "rail": case "track": case "chain": case "belt": {
        const g = new THREE.Group(), pts = (s.path ?? []).map((q) => new THREE.Vector3(...v3(q))), w = num(s.w, s.shape === "chain" || s.shape === "belt" ? 0.1 : 0.12);
        const m = matOf({ look: s.shape === "belt" ? "rubber" : "metal", ...s });
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1], len = a.distanceTo(b); if (len < 1e-3) continue;
          const seg = new THREE.Mesh(new THREE.BoxGeometry(w, s.shape === "rail" || s.shape === "track" ? w * 0.6 : w * 0.35, len), m);
          seg.position.copy(a).lerp(b, 0.5); seg.lookAt(b); seg.castShadow = true; g.add(seg);
          if (s.shape === "chain") for (let k = 0; k < len / (w * 1.4); k++) { const l = new THREE.Mesh(new THREE.TorusGeometry(w * 0.35, w * 0.1, 6, 12), m); l.position.copy(a).lerp(b, (k + 0.5) / (len / (w * 1.4))); l.lookAt(b); l.rotation.z += (k % 2) * Math.PI / 2; g.add(l); }
        }
        parent.add(g); return g;
      }
      case "beam": {
        // a glowing ray: dark until a light or blink move on its node (registered with the lamps)
        const a = new THREE.Vector3(...v3(s.from)), b = new THREE.Vector3(...v3(s.to)), len = Math.max(0.01, a.distanceTo(b)), col = s.color ?? "#ff4d4d";
        // (the owner's list of 2026-11-07: the beam was a pale stick even when off and never glowed; now light itself:
        // additive, unlit by the scene, invisible until its node's light or blink move, widening toward its far end)
        const r0 = num(s.r, 0.04), m = new THREE.Mesh(new THREE.CylinderGeometry(r0 * (len > 3 ? 4 : 1.6), r0, len, 16, 1, true), new THREE.MeshBasicMaterial({ color: C(col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
        m.userData.beam = true; m.visible = false;
        m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = false; parent.add(m);
        if (!lamps.has(nodeId)) lamps.set(nodeId, []); lamps.get(nodeId).push(m); return m;
      }
      case "light": {
        const col = s.color ?? "#ffd23d", m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), std({ color: C(col), emissive: C(col), emissiveIntensity: 0, roughness: 0.3 }));
        place(m, s, parent); if (!lamps.has(nodeId)) lamps.set(nodeId, []); lamps.get(nodeId).push(m); return m;
      }
      case "screen": {
        const [w, h] = (s.size ?? [0.5, 0.35]).map(Number), g = new THREE.Group();
        g.add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, h + 0.08, 0.06, 2, 0.02), std({ color: C("#1c1f24"), roughness: 0.6 })));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(s.color ?? "#4dff7a"), emissiveIntensity: 0.6 }));
        face.position.z = 0.035; g.add(face); place(g, s, parent); screens.set(nodeId, { face, col: s.color ?? "#4dff7a", shown: null }); return g;
      }
      case "drum": {
        // a hollow drum open at the front (+ along its axis): the wall, a back plate, holes, three lifter ribs inside
        const g = new THREE.Group(), h = num(s.h, 0.6), m = matOf({ look: "metal", ...s }), dk = std({ color: C("#2a2e34"), roughness: 0.7 });
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), m); wall.material.side = THREE.DoubleSide; g.add(wall);
        const back = new THREE.Mesh(new THREE.CircleGeometry(r, 40), m); back.rotation.x = Math.PI / 2; back.position.y = -h / 2; back.material.side = THREE.DoubleSide; g.add(back);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, rib = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, h * 0.9, r * 0.22), m); rib.position.set(Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9); rib.rotation.y = -a; g.add(rib); }
        if (s.holes !== false) for (let k = 0; k < 4; k++) for (let i = 0; i < 18; i++) { const a = ((i + (k % 2) * 0.5) / 18) * Math.PI * 2, d = new THREE.Mesh(new THREE.CircleGeometry(r * 0.045, 10), dk); d.position.set(Math.cos(a) * r * 1.002, (k / 3 - 0.5) * h * 0.75, Math.sin(a) * r * 1.002); d.lookAt(d.position.clone().multiplyScalar(2)); g.add(d); }
        // (built along y with the open end up: turned so the open end faces + along its axis, the camera for "z")
        if ((s.axis ?? "z") === "z") g.rotation.x = Math.PI / 2; else if (s.axis === "x") g.rotation.z = -Math.PI / 2;
        const w = new THREE.Group(); w.add(g); return place(w, s, parent);
      }
      case "cone": return place(new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(num(s.r2, 0), r, num(s.h, 0.5), 28), s.axis), matOf(s)), s, parent);
      case "sphere": return place(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), matOf(s)), s, parent);
      case "torus": { const geo = new THREE.TorusGeometry(r, num(s.tube, r * 0.25), 12, 36); if ((s.axis ?? "y") === "y") geo.rotateX(Math.PI / 2); else if (s.axis === "x") geo.rotateY(Math.PI / 2); return place(new THREE.Mesh(geo, matOf({ look: "rubber", ...s })), s, parent); }
      case "fan": {
        const g = new THREE.Group(), n = Math.max(2, Math.round(num(s.blades, 5))), w = num(s.w, 0.08), m = matOf({ look: "plastic", ...s });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, w * 1.6, 20), m));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = new THREE.Mesh(new RoundedBoxGeometry(r * 0.8, w * 0.35, r * 0.34, 2, w * 0.15), m); b.position.set(Math.cos(a) * r * 0.55, 0, Math.sin(a) * r * 0.55); b.rotation.set(0, -a, 0.45); g.add(b); }
        // (built in the x-z plane, turning about y)
        if ((s.axis ?? "z") === "z") g.rotation.x = Math.PI / 2; else if (s.axis === "x") g.rotation.z = Math.PI / 2;
        const w2 = new THREE.Group(); w2.add(g); return place(w2, s, parent);
      }
      case "element": {
        // a flat spiral of wire from the centre out, in the plane across its axis
        const turns = num(s.turns, 3), pts = [];
        for (let i = 0; i <= turns * 32; i++) { const a = (i / 32) * Math.PI * 2, rr = r * (0.22 + 0.78 * (i / (turns * 32))); pts.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)); }
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 32, num(s.wire, 0.03), 8);
        if (s.axis === "z") geo.rotateX(Math.PI / 2); else if (s.axis === "x") geo.rotateZ(Math.PI / 2);
        return place(new THREE.Mesh(geo, matOf({ look: "metal", color: "#4a4d52", ...s })), s, parent);
      }
      case "flame": {
        // a ring of soft teardrop flames in their colour (blue: a clean gas flame; color "#ffb020": a lazy yellow one), a
        // bright core in each, overlapping into one crown (registered: dark until a burn move). Cones read as "yellow spikes",
        // and the real stove run's checker could not see a blue flame at all, 2026-11-04
        const g = new THREE.Group(), h = num(s.h, 0.18), col = s.color ?? "#2f6bff", n = Math.max(10, Math.round(r * 70));
        const hsl = C(col).getHSL({}), cool = hsl.h > 0.45 && hsl.h < 0.8, w = Math.max(0.045, ((2 * Math.PI * r) / n) * 0.62);
        const outer = std({ color: C(col), emissive: C(col), emissiveIntensity: 1.8, transparent: true, opacity: 0.7, depthWrite: false });
        const core = std({ color: C(cool ? "#bfe2ff" : "#fff1b8"), emissive: C(cool ? "#9fd0ff" : "#ffe48a"), emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, f = new THREE.Group(); f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          const o = new THREE.Mesh(new THREE.SphereGeometry(w, 14, 10), outer); o.scale.set(1, h / w / 2, 1); o.position.y = h / 2; f.add(o);
          const c = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 12, 8), core); c.scale.set(1, (h * 0.45) / (w * 0.5) / 2, 1); c.position.y = h * 0.3; f.add(c);
          for (const m of [o, c]) m.castShadow = false;
          f.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); g.add(f);
        }
        // (a glowing ring at their foot joins them into one flame ring)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w * 0.7, 8, 40), outer); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
        // the burner cap the flames come out of, always there (a dark ring with a hole at each flame): it reads as a gas
        // burner before it lights (the free stove proof's checker saw "a dark disc" and no holes, 2026-11-04)
        if (s.cap !== false) {
          const cap = new THREE.Group(), steel = std({ color: C("#2a2d31"), roughness: 0.45, metalness: 0.6 }), hole = std({ color: C("#08090a"), roughness: 0.9 });
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 10, 40), steel); rim.rotation.x = Math.PI / 2; rim.position.y = -0.01; cap.add(rim);
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.85, 0.05, 32), steel); disc.position.y = -0.005; cap.add(disc);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, d = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hole); d.position.set(Math.cos(a) * (r + 0.035), 0.02, Math.sin(a) * (r + 0.035)); cap.add(d); }
          place(cap, s, parent);
        }
        place(g, s, parent); g.visible = false; if (!flames.has(nodeId)) flames.set(nodeId, []); flames.get(nodeId).push(g); return g;
      }
      case "bellows": {
        // an accordion air bag along its axis: a rubber skin with ribs at each fold
        const g = new THREE.Group(), h = num(s.h, 0.5), n = Math.max(2, Math.round(num(s.folds, 5))), m = matOf({ look: "rubber", ...s });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, h, 28), m));
        for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.12, 10, 28), m); t.rotation.x = Math.PI / 2; t.position.y = ((i + 0.5) / n - 0.5) * h; g.add(t); }
        if (s.axis === "z") g.rotation.x = Math.PI / 2; else if (s.axis === "x") g.rotation.z = Math.PI / 2;
        const w = new THREE.Group(); w.add(g); return place(w, s, parent);
      }
      // ----- the household things (the owner's look round of 2026-11-10: recognizable parts, not abstract shapes) -----
      case "plate": case "bowl": case "cup": case "glass": {
        // turned on a lathe in the y-up frame, then laid along its axis: a plate's well top is its point (a smear at the
        // plate's own point sits on its face)
        const rr = rOf(s), h = Math.abs(houseLen(s, rr)), g = new THREE.Group(), t = Math.max(0.003, rr * 0.045);
        const V = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)), 48);
        const glazed = !s.look || s.look === "paint";
        const m = s.shape === "glass" ? glassMat(s.color) : glazed ? glaze(s.color ?? "#f7f5f0") : matOf(s);
        m.side = THREE.DoubleSide;
        let stainAt = null;
        if (s.shape === "plate") {
          const rim = rr * 0.12;
          g.add(new THREE.Mesh(V([[0, 0], [rr * 0.6, 0], [rr * 0.78, rr * 0.05], [rr * 0.95, rim], [rr, rim], [rr, rim - t], [rr * 0.94, rim - t * 1.2], [rr * 0.76, rr * 0.05 - t], [rr * 0.58, -t], [rr * 0.56, -t - rr * 0.035], [rr * 0.47, -t - rr * 0.035], [rr * 0.45, -t], [0, -t]]), m));
          stainAt = { y: 0.0015, r: rr * 0.66 };
        } else if (s.shape === "bowl") {
          const y0 = -h / 2, fl = y0 + h * 0.1 + t;
          g.add(new THREE.Mesh(V([[0, y0], [rr * 0.42, y0], [rr * 0.45, y0 + h * 0.06], [rr * 0.7, y0 + h * 0.25], [rr * 0.9, y0 + h * 0.6], [rr, h / 2], [rr - t, h / 2], [rr * 0.88 - t, y0 + h * 0.62], [rr * 0.66 - t * 0.5, y0 + h * 0.3], [rr * 0.38, fl], [0, fl]]), m));
          stainAt = { y: fl + 0.0015, r: rr * 0.42 };
        } else if (s.shape === "cup") {
          g.add(new THREE.Mesh(V([[0, -h / 2], [rr * 0.9, -h / 2], [rr, -h / 2 + h * 0.06], [rr, h / 2], [rr - t, h / 2], [rr - t, -h / 2 + t * 1.6], [0, -h / 2 + t * 1.6]]), m));
          if (s.handle !== false) { const hd = new THREE.Mesh(new THREE.TorusGeometry(h * 0.27, Math.max(t * 0.9, rr * 0.11), 8, 20, Math.PI), m); hd.rotation.z = -Math.PI / 2; hd.position.x = rr * 0.98; g.add(hd); }
        } else {
          g.add(new THREE.Mesh(V([[0, -h / 2], [rr * 0.84, -h / 2], [rr, h / 2], [rr - t, h / 2], [rr * 0.84 - t, -h / 2 + t * 3], [0, -h / 2 + t * 3]]), m));
        }
        // (the stain drawn on the plate's face or in the bowl: soft food smears, not brown boxes)
        const amount = s.stain === true ? 0.6 : Math.min(1, Math.max(0, num(s.stain, 0)));
        if (stainAt && amount > 0.01) { const sm = smearMesh(stainAt.r, s.stainColor ?? "#8b5a2b", amount, seedOf(s)); if (sm) { sm.position.y = stainAt.y; g.add(sm); } }
        g.traverse((x) => { if (x.isMesh) { x.castShadow = s.shape !== "glass"; x.receiveShadow = true; } });
        return place(orient(g, s.axis), s, parent);
      }
      case "smear": {
        const sm = smearMesh(rOf(s), s.color ?? "#8b5a2b", Math.min(1, Math.max(0.05, num(s.amount, 0.6))), seedOf(s));
        if (!sm) return null;
        const g = new THREE.Group(); g.add(sm); const o = place(orient(g, s.axis), s, parent); o.castShadow = false; return o;
      }
      case "rack": {
        // a wire dish basket: a floor grid, rimmed sides of upright rods, rows of prongs the plates stand in, and rollers
        const [w, h, d] = v3(s.size, [0.5, 0.2, 0.5]).map(Math.abs), g = new THREE.Group();
        const gap = Math.max(0.015, num(s.gap, Math.min(0.08, Math.max(0.025, Math.min(w, d) / 9)))), wr = Math.max(0.002, num(s.wire, Math.min(0.02, Math.max(0.004, Math.min(w, d) * 0.012))));
        const m = s.look ? matOf(s) : std({ color: C(s.color ?? "#d8dcdf"), roughness: 0.35, metalness: 0.25 });
        const unit = new THREE.CylinderGeometry(wr, wr, 1, 6), thick = new THREE.CylinderGeometry(wr * 1.5, wr * 1.5, 1, 8), up = new THREE.Vector3(0, 1, 0);
        const rod = (a, b, geo = unit) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); if (L < 1e-4) return; const c = new THREE.Mesh(geo, m); c.position.copy(A).lerp(B, 0.5); c.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize()); c.scale.y = L; c.castShadow = true; g.add(c); };
        const steps = (a, b, st) => { const n = Math.min(40, Math.max(1, Math.round((b - a) / st))), out = []; for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n); return out; };
        const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
        for (const z of steps(z0, z1, gap)) rod([x0, y0, z], [x1, y0, z]);
        for (const x of steps(x0, x1, gap)) rod([x, y0, z0], [x, y0, z1]);
        const rimAt = h > 0.06 ? [y0, (y0 + y1) / 2, y1] : [y0, y1];
        for (const y of rimAt) { rod([x0, y, z0], [x1, y, z0], thick); rod([x0, y, z1], [x1, y, z1], thick); rod([x0, y, z0], [x0, y, z1], thick); rod([x1, y, z0], [x1, y, z1], thick); }
        if (h > 0.02) {
          for (const x of steps(x0, x1, gap * 1.5)) { rod([x, y0, z0], [x, y1, z0]); rod([x, y0, z1], [x, y1, z1]); }
          for (const z of steps(z0, z1, gap * 1.5)) { rod([x0, y0, z], [x0, y1, z]); rod([x1, y0, z], [x1, y1, z]); }
        }
        // (rows of prongs across the width: the plates stand between them, facing the front)
        const rows = s.tines === false ? 0 : Number.isFinite(Number(s.tines)) && s.tines !== true ? Math.min(12, Math.max(0, Math.round(Number(s.tines)))) : Math.max(1, Math.round(d / 0.09) - 1);
        const tH = Math.min(h * 0.9, Math.max(0.04, Math.min(w, d) * 0.2));
        for (let k = 0; k < rows; k++) { const z = z0 + (d * (k + 1)) / (rows + 1); for (const x of steps(x0 + gap / 2, x1 - gap / 2, gap * 0.8)) rod([x, y0, z], [x, y0 + tH, z]); }
        if (h > 0.06) { const rm = std({ color: C("#3a3f45"), roughness: 0.5 }); for (const x of [x0, x1]) for (const z of [z0 + d * 0.15, z1 - d * 0.15]) { const wl = new THREE.Mesh(alongAxis(new THREE.CylinderGeometry(gap * 0.45, gap * 0.45, gap * 0.3, 14), "x"), rm); wl.position.set(x + Math.sign(x) * gap * 0.15, y0, z); g.add(wl); } }
        return place(g, s, parent);
      }
      case "nozzle": {
        // a spout along +axis: a tapered body, a collar at its foot, a dark hole at its tip
        const rr = rOf(s), h = Math.abs(houseLen(s, rr)), g = new THREE.Group(), m = matOf({ look: "metal", ...s });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.55, rr, h * 0.8, 20), m); body.position.y = h * 0.1; g.add(body);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.25, rr * 1.25, h * 0.2, 20), m); collar.position.y = -h * 0.4; g.add(collar);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.3, 16), std({ color: C("#0c0d0f"), roughness: 0.9 })); hole.rotation.x = -Math.PI / 2; hole.position.y = h / 2 + 0.001; g.add(hole);
        return place(orient(g, s.axis), s, parent);
      }
      case "model": {
        // a CC0 model (kit/models.js), on its base at the shape's point
        const g = new THREE.Group(); place(g, s, parent);
        model(ctx, String(s.file).replace(/^\/?(assets\/)?(kenney\/)?/, ""), { parent: g, size: num(s.size, 1), rotY: num(s.rotY, 0), ...(s.color ? { tint: s.color } : {}) });
        return g;
      }
      default: return null;
    }
  };
  // the nodes, parents first (a node with a broken parent hangs on the base)
  const piv = pivots(p), nodes = nodesOf(p);
  const order = [...nodes].sort((a, b) => depth(a) - depth(b));
  function depth(n) { let d = 0, cur = n; const seen = new Set(); while (cur?.parent && !seen.has(cur.id)) { seen.add(cur.id); cur = nodes.find((x) => x.id === cur.parent); d++; } return d; }
  for (const n of order) {
    nodeWords = String(n.id ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
    const g = new THREE.Group(), parent = (n.parent && groups.get(n.parent)?.g) || body;
    g.position.set(...v3(n.at)); parent.add(g);
    // (its own materials, as built: a heat or chill move tints them from there)
    const mats = [];
    groups.set(n.id, { g, n, base: g.position.clone(), mats });
    for (const s0 of n.shapes ?? []) {
      // (an old plan's plates drawn as wheels are drawn as plates, 2026-11-10: the owner saw black tyres in the dishwasher)
      let s = s0; try { const pl = plateFromWheel(s0, n.id, p); if (pl) { s = pl; if (!notedPlates.has(n.id)) { notedPlates.add(n.id); console.log(`[cutaway-note] ${p.name ?? "rig"}: the white wheels on ${n.id} are drawn as plates`); } } } catch { s = s0; }
      let o = null; try { o = build(s, g, n.id); } catch (e) { rigBug(`shape ${s?.shape} on ${n.id}`, e); continue; }
      if (o && !["flame", "light", "beam"].includes(s.shape)) o.traverse((x) => { if (x.isMesh && x.material?.color && !mats.some((q) => q.m === x.material)) mats.push({ m: x.material, col: x.material.color.clone(), em: x.material.emissive?.clone(), ei: x.material.emissiveIntensity ?? 0 }); });
    }
    // a piece that can snap: its second half is a copy, shown once it breaks
    for (const m of (n.moves ?? []).filter((x) => x.type === "snap")) {
      const half = g.clone(true); half.visible = false; parent.add(half);
      const bb = new THREE.Box3().setFromObject(g), ax = AX[m.axis] ?? 1, L = Math.max(0.05, bb.max.getComponent(ax) - bb.min.getComponent(ax));
      snaps.push({ id: n.id, half, m, L, ax });
    }
    for (const m of n.moves ?? []) {
      if (m.type === "fill" && m.box?.size) {
        const [w, h, d] = v3(m.box.size, [0.5, 0.5, 0.5]), fm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std({ color: C(m.box.color ?? "#3d8fd6"), roughness: 0.15, transparent: true, opacity: 0.8 }));
        fm.geometry.translate(0, h / 2, 0); const [x, y, z] = v3(m.box.at); fm.position.set(x, y - h / 2, z); fm.scale.y = 0.001; fm.visible = false; g.add(fm); fills.push({ fm, m });
      }
      if (m.type === "flow" && Array.isArray(m.path) && m.path.length >= 2) {
        const c = curve(m.path), look = flowLook(m, n.id, p);
        // (water as spray or a stream, 2026-11-10; a broken liquid look falls back to the dots, logged as our bug)
        if (look !== "dots") { try { flows.push({ m, ...liquid(c, m, look, g) }); continue; } catch (e) { rigBug(`the ${look} look of flow ${m.name} on ${n.id}`, e); } }
        const dots = [], dm = std({ color: C(m.color ?? "#5aa9e6"), roughness: 0.3 });
        // (spaced about five dot widths apart: packed bead to bead on a short pipe they read as a still stack of balls, not
        // something moving; the free stove proof's checker, 2026-11-04)
        const size = num(m.size, 0.05), nDots = Math.max(3, Math.min(14, Math.round(c.getLength() / (size * 2 * 5))));
        for (let i = 0; i < nDots; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), dm); d.visible = false; g.add(d); dots.push(d); }
        flows.push({ c, dots, m });
      }
    }
  }
  void piv;
  // the integral of a channel up to t (how far a spin has turned): sampled, pure in t (frames render out of order)
  const integral = (name, t) => { let s = 0; for (let u = 0; u < t; u += 0.05) s += Math.min(1, Math.max(0, api.ch(name, u))) * 0.05; return s; };
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  return {
    group: root,
    // (each node's group by id: the "This is a…" glow traces one piece, outline {of: "stove.head"})
    nodes: groups,
    update(t) {
      const pp = api.ch("pop", t); body.visible = pp > 0.002; body.scale.setScalar(Math.max(0.001, pp));
      for (const { g, n, base, mats } of groups.values()) {
        g.position.copy(base); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.visible = true;
        if ((n.moves ?? []).some((m) => m.type === "heat" || m.type === "chill")) for (const q of mats) { q.m.color.copy(q.col); if (q.em) q.m.emissive.copy(q.em); q.m.emissiveIntensity = q.ei; }
        for (const m of n.moves ?? []) { if (deadMoves.has(m)) continue; try {
          const v = clamp01(api.ch(m.name, t)), ax = AX[m.axis] ?? 1;
          if (m.type === "slide") { const d = v3(m.to); g.position.x += d[0] * v; g.position.y += d[1] * v; g.position.z += d[2] * v; }
          // (swings and spins add up: a panel with a "flop" and a "jam" swing showed only the last one, at rest, so the garage
          // door never swung out; round 3, 2026-10-28)
          if (m.type === "swing") g.rotation["xyz"[ax]] += (num(m.angle, 90) * Math.PI / 180) * v;
          if (m.type === "track" && Array.isArray(m.path) && m.path.length >= 2) { const q = curve(m.path).getPointAt(v); g.position.set(base.x + q.x, base.y + q.y, base.z + q.z); }
          if (m.type === "spin") g.rotation["xyz"[ax]] += integral(m.name, t) * num(m.turns, 1) * Math.PI * 2;
          if (m.type === "extend") { const k = 1 + (num(m.k, 1.5) - 1) * v; g.scale.setComponent(ax, k); }
          if (m.type === "appear") { const a = api.ch(m.name, t); g.visible = a > 0.002; g.scale.multiplyScalar(Math.max(0.001, a)); }
          if (m.type === "light" || m.type === "blink") for (const l of lamps.get(n.id) ?? []) {
            l.material.emissiveIntensity = m.type === "light" ? 2 * v : v * (((t * num(m.rate, 2)) % 1) < 0.5 ? 2.2 : 0.15);
            // (a beam is light itself: invisible until lit, then a glowing additive ray)
            if (l.userData.beam) { const k = Math.min(1, l.material.emissiveIntensity / 2); l.material.opacity = 0.7 * k; l.visible = k > 0.01; }
          }
          if (m.type === "snap") {
            // the piece shortened to one half, pushed one way; its copy the other way: two pieces with a gap, tilted
            const sn = snaps.find((x) => x.id === n.id && x.m === m), k = 1 - 0.5 * v, off = (sn.L / 4 + num(m.gap, 0.25) / 2) * v, tilt = 0.18 * v;
            g.scale.setComponent(sn.ax, g.scale.getComponent(sn.ax) * k); g.position.setComponent(sn.ax, g.position.getComponent(sn.ax) - off);
            g.rotation.z += tilt;
            sn.half.visible = v > 0.01 && g.visible; sn.half.position.copy(base); sn.half.position.setComponent(sn.ax, base.getComponent(sn.ax) + off);
            sn.half.scale.set(1, 1, 1); sn.half.scale.setComponent(sn.ax, k); sn.half.rotation.set(0, 0, -tilt);
          }
          if (m.type === "heat" || m.type === "chill") {
            // (red-hot: the colour goes to the glow and lights; frost: a pale blue-white with a faint cold glow)
            const col = C(m.color ?? (m.type === "heat" ? "#ff3a0a" : "#bfe6ff")), hot = m.type === "heat";
            if (v > 0.002) for (const q of mats) { q.m.color.lerp(col, (hot ? 0.9 : 0.75) * v); if (q.m.emissive) { q.m.emissive.copy(col); q.m.emissiveIntensity = Math.max(q.m.emissiveIntensity, (hot ? 0.9 : 0.25) * v); } }
          }
          if (m.type === "burn") (flames.get(n.id) ?? []).forEach((f, i) => { f.visible = v > 0.02; f.scale.set(1, Math.max(0.001, v * (0.85 + 0.2 * Math.sin(t * 23 + i * 1.7))), 1); });
          if (m.type === "pump") g.position.setComponent(ax, g.position.getComponent(ax) + num(m.stroke, 0.2) * v * Math.sin(t * num(m.rate, 1.5) * Math.PI * 2));
          if (m.type === "shake") { const a = num(m.amp, 0.03) * v, w = t * num(m.rate, 8) * Math.PI * 2; g.position.x += a * Math.sin(w * 1.3); g.position.y += a * Math.sin(w + 1); }
          if (m.type === "count") { const sc = screens.get(n.id); if (sc) { const val = Math.round(num(m.from, 9) + (num(m.to, 0) - num(m.from, 9)) * v); if (val !== sc.shown) { const tx = numTex(val, sc.col); if (tx) { sc.face.material.map = tx; sc.face.material.emissiveMap = tx; sc.face.material.needsUpdate = true; } sc.shown = val; } } }
        } catch (e) { deadMoves.add(m); rigBug(`move ${m.name} (${m.type}) on ${n.id}`, e); } }
      }
      // the linked moves, after every node has turned: a follower turns with its node (that node's own links first), a
      // crank slides by the sine of its node's turn
      const turnOf = (id) => {
        const gg = groups.get(id), mv = gg && (gg.n.moves ?? []).find((m) => ["spin", "swing", "follow"].includes(m.type));
        return mv ? gg.g.rotation["xyz"[AX[mv.axis] ?? 1]] : 0;
      };
      const done = new Set(), runLink = (gg, left = 8) => {
        if (done.has(gg.n.id) || left < 0) return; done.add(gg.n.id);
        for (const m of (gg.n.moves ?? []).filter((x) => LINKED.has(x.type))) {
          const src = groups.get(m.of); if (!src) continue;
          runLink(src, left - 1);
          const turn = turnOf(m.of), ax = AX[m.axis] ?? (m.type === "crank" ? 1 : 2);
          if (m.type === "follow") gg.g.rotation["xyz"[ax]] += turn * num(m.ratio, 1);
          else gg.g.position.setComponent(ax, gg.g.position.getComponent(ax) + num(m.throw, 0.2) * Math.sin(turn + (num(m.phase, 0) * Math.PI) / 180));
        }
      };
      for (const gg of groups.values()) runLink(gg);
      for (const { fm, m } of fills) { const v = clamp01(api.ch(m.name, t)); fm.visible = v > 0.002; fm.scale.y = Math.max(0.001, v); }
      for (const { c, dots, m, update } of flows) { const v = clamp01(api.ch(m.name, t)); if (update) { try { update(v, t); } catch (e) { if (!deadMoves.has(m)) { deadMoves.add(m); rigBug(`flow ${m.name} look`, e); } } continue; } dots.forEach((d, i) => { d.visible = v > 0.05; if (d.visible) { d.position.copy(c.getPointAt((((t * num(m.speed, 0.6)) + i / dots.length) % 1))); d.scale.setScalar(v); } }); }
    },
  };
}
