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
// Moves (each is a timeline channel named by its name; the verb "<name>" plays it, "<name>Back" undoes it):
//   appear (the piece pops in on its word: hidden until then, so a thing is built step by step)
//   slide {to [dx,dy,dz]}   swing {axis, angle (degrees)}   track {path [[x,y,z]...]} (the pivot runs along the path)
//   spin {axis, turns (per second while on)}   extend {axis, k (the scale reached)}   light (its lamps on)
//   blink {rate (per second)}   fill {box {size [w,h,d], at, color}} (rises from the box floor)
//   flow {path, color} (dots run along the path while on)   count {from, to} (its screen's number ticks)
// Every part also has show / hide (it pops in, pops out).

export const RIG_SHAPES = ["box", "panel", "cylinder", "wheel", "gear", "hinge", "spring", "tube", "cable", "rail", "track", "chain", "belt", "button", "light", "beam", "screen", "model"];
export const RIG_MOVES = ["appear", "slide", "swing", "track", "spin", "extend", "light", "blink", "fill", "flow", "count"];
const PATHS = new Set(["tube", "cable", "rail", "track", "chain", "belt"]);
const LOOKS = { metal: ["#b9c0c7", 0.3, 0.8], plastic: ["#e8e4dc", 0.45, 0], wood: ["#a8743f", 0.75, 0], glass: ["#cfe8f5", 0.05, 0], rubber: ["#24262a", 0.9, 0], paint: ["#d64535", 0.4, 0], concrete: ["#b9b4aa", 0.9, 0] };
// how long a move takes on its word (s), and whether it is a state that stays on (spin, blink, flow, light)
const DUR = { appear: 0.35, slide: 0.9, swing: 0.9, track: 1.2, extend: 0.8, fill: 1.2, count: 1.5, light: 0.2, blink: 0.2, spin: 0.3, flow: 0.3 };

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : d);
const AX = { x: 0, y: 1, z: 2 };
const nodesOf = (p) => (Array.isArray(p?.nodes) ? p.nodes : []);
const movesOf = (p) => nodesOf(p).flatMap((n) => (Array.isArray(n.moves) ? n.moves : []).map((m) => ({ ...m, node: n.id })));

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
  const at = v3(s.at), r = num(s.r, 0.1);
  let half;
  if (s.shape === "beam") { const a = v3(s.from), b = v3(s.to), w = num(s.r, 0.04) + 0.03; return { min: [0, 1, 2].map((i) => Math.min(a[i], b[i]) - w), max: [0, 1, 2].map((i) => Math.max(a[i], b[i]) + w) }; }
  if (PATHS.has(s.shape)) {
    const pts = (Array.isArray(s.path) ? s.path : []).map((q) => v3(q)), w = Math.max(num(s.r, 0), num(s.w, 0.12)) / 2 + 0.02;
    if (!pts.length) return null;
    return { min: [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i])) - w), max: [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])) + w) };
  }
  if (s.shape === "box") half = v3(s.size, [0.5, 0.5, 0.5]).map((x) => Math.abs(x) / 2);
  else if (s.shape === "panel") { const [w, h] = Array.isArray(s.size) ? s.size.map(Number) : [1, 1]; half = [w / 2, h / 2, num(s.thick, 0.05) / 2]; }
  else if (s.shape === "screen") { const [w, h] = Array.isArray(s.size) ? s.size.map(Number) : [0.5, 0.35]; half = [w / 2 + 0.04, h / 2 + 0.04, 0.05]; }
  // (a model stands on its base at the shape's point: it rises from there)
  else if (s.shape === "model") { const k = num(s.size, 1) / 2; return { min: [at[0] - k, at[1], at[2] - k], max: [at[0] + k, at[1] + 2 * k, at[2] + k] }; }
  else if (["button", "light"].includes(s.shape)) half = [r, r, r];
  else {
    const len = s.shape === "wheel" || s.shape === "gear" ? num(s.w, 0.2) : num(s.h, 0.5), rad = s.shape === "gear" ? r * 1.15 : r;
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
      if (m.type === "track") for (const q of m.path ?? []) swept.push(shift(rest, v3(q)));
      // (a swing turns the box's corners through its angle about the hinge, a spin all the way round; along the axis
      // the piece keeps its size)
      if (m.type === "swing" || m.type === "spin") {
        const a = AX[m.axis] ?? 1, [i, j] = [0, 1, 2].filter((q) => q !== a), deg = m.type === "spin" ? 360 : num(m.angle, 90), pts = [];
        for (let st = 0; st <= 12; st++) {
          const r = (deg * Math.PI / 180) * (st / 12), c = Math.cos(r), s = Math.sin(r);
          for (const u of [rest.min[i], rest.max[i]]) for (const w of [rest.min[j], rest.max[j]]) { const du = u - pv[i], dw = w - pv[j]; pts.push([pv[i] + du * c - dw * s, pv[j] + du * s + dw * c]); }
        }
        const b = { min: [...rest.min], max: [...rest.max] };
        b.min[i] = Math.min(...pts.map((q) => q[0])); b.max[i] = Math.max(...pts.map((q) => q[0])); b.min[j] = Math.min(...pts.map((q) => q[1])); b.max[j] = Math.max(...pts.map((q) => q[1]));
        swept.push(b);
      }
      if (m.type === "extend") { const i = AX[m.axis] ?? 1, k = Math.max(1, num(m.k, 1.5)); const b = { min: [...rest.min], max: [...rest.max] }; b.max[i] = pv[i] + (rest.max[i] - pv[i]) * k; b.min[i] = pv[i] + (rest.min[i] - pv[i]) * k; swept.push(b); }
    }
    out.set(n.id, { rest, swept: unionB(swept), pivot: pv });
  }
  return out;
}

/** the rig's box in world space (at rest and through its moves), for the camera and the checks */
export function rigBox(p, { swept = true, node = null } = {}) {
  // (node: one piece and the pieces hung on it, for a shot of "part.node": the camera frames the motor, not the garage)
  const keep = node ? new Set([node]) : null;
  if (keep) for (let grown = true; grown;) { grown = false; for (const n of nodesOf(p)) if (n.parent && keep.has(n.parent) && !keep.has(n.id)) { keep.add(n.id); grown = true; } }
  const b = unionB([...nodeBoxes(p)].filter(([id]) => !keep || keep.has(id)).map(([, x]) => (swept ? x.swept : x.rest)));
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
export function rigProblems(part, { floor = 0, cut = null } = {}) {
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
  }
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
    if (!inCut && p.mount !== "wall" && Math.abs(b.min[1] - floor) > 0.3) P.push(`part ${id} (rig): its lowest point is at y = ${b.min[1].toFixed(2)}, not on the floor (y ${floor}): set pos y to the floor and build up from the node pivots`);
  }
  return P;
}

import { model } from "../kit/models.js";

// ---------- the renderer (the page): the shapes in the house style, and the moves on their channels ----------
export function rig(ctx, p, api) {
  const { THREE, std, C, RoundedBoxGeometry } = ctx;
  const root = new THREE.Group(); root.position.set(...v3(p.pos)); root.rotation.y = num(p.rotY, 0); root.scale.setScalar(num(p.scale, 1)); ctx.scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const matOf = (s, extra = {}) => {
    const [col, rough, metal] = LOOKS[s.look] ?? LOOKS.paint;
    const m = std({ color: C(s.color ?? col), roughness: rough, metalness: metal, ...extra });
    if (s.look === "glass") { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; }
    return m;
  };
  const place = (mesh, s, parent) => { mesh.position.set(...v3(s.at)); if (Array.isArray(s.rot)) mesh.rotation.set(...s.rot.map((a) => (num(a) * Math.PI) / 180)); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const alongAxis = (geo, axis) => { if (axis === "x") geo.rotateZ(Math.PI / 2); else if (axis === "z") geo.rotateX(Math.PI / 2); return geo; };
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...v3(q))), false, "catmullrom", 0.05);
  const groups = new Map(), lamps = new Map(), screens = new Map(), fills = [], flows = [];
  const screenTex = new Map();
  const numTex = (v, col) => {
    const key = `${v}|${col}`; if (screenTex.has(key)) return screenTex.get(key);
    const cv = typeof document !== "undefined" ? document.createElement("canvas") : null; if (!cv) return null;
    cv.width = 256; cv.height = 180; const g = cv.getContext("2d");
    g.fillStyle = "#06120a"; g.fillRect(0, 0, 256, 180); g.fillStyle = col; g.font = "bold 140px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(v), 128, 98);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; screenTex.set(key, t); return t;
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
        const m = new THREE.Mesh(new THREE.CylinderGeometry(num(s.r, 0.04), num(s.r, 0.04), len, 10), std({ color: C(col), emissive: C(col), emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.85 }));
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
    const g = new THREE.Group(), parent = (n.parent && groups.get(n.parent)?.g) || body;
    g.position.set(...v3(n.at)); parent.add(g);
    groups.set(n.id, { g, n, base: g.position.clone() });
    for (const s of n.shapes ?? []) build(s, g, n.id);
    for (const m of n.moves ?? []) {
      if (m.type === "fill" && m.box?.size) {
        const [w, h, d] = v3(m.box.size, [0.5, 0.5, 0.5]), fm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std({ color: C(m.box.color ?? "#3d8fd6"), roughness: 0.15, transparent: true, opacity: 0.8 }));
        fm.geometry.translate(0, h / 2, 0); const [x, y, z] = v3(m.box.at); fm.position.set(x, y - h / 2, z); fm.scale.y = 0.001; fm.visible = false; g.add(fm); fills.push({ fm, m });
      }
      if (m.type === "flow" && Array.isArray(m.path) && m.path.length >= 2) {
        const c = curve(m.path), dots = [], dm = std({ color: C(m.color ?? "#5aa9e6"), roughness: 0.3 });
        for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(num(m.size, 0.07), 10, 8), dm); d.visible = false; g.add(d); dots.push(d); }
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
    update(t) {
      const pp = api.ch("pop", t); body.visible = pp > 0.002; body.scale.setScalar(Math.max(0.001, pp));
      for (const { g, n, base } of groups.values()) {
        g.position.copy(base); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.visible = true;
        for (const m of n.moves ?? []) {
          const v = clamp01(api.ch(m.name, t)), ax = AX[m.axis] ?? 1;
          if (m.type === "slide") { const d = v3(m.to); g.position.x += d[0] * v; g.position.y += d[1] * v; g.position.z += d[2] * v; }
          if (m.type === "swing") g.rotation.setFromVector3(new THREE.Vector3(...[0, 1, 2].map((i) => (i === ax ? (num(m.angle, 90) * Math.PI / 180) * v : 0))));
          if (m.type === "track" && Array.isArray(m.path) && m.path.length >= 2) { const q = curve(m.path).getPointAt(v); g.position.set(base.x + q.x, base.y + q.y, base.z + q.z); }
          if (m.type === "spin") { const a = integral(m.name, t) * num(m.turns, 1) * Math.PI * 2; g.rotation.setFromVector3(new THREE.Vector3(...[0, 1, 2].map((i) => (i === ax ? a : 0)))); }
          if (m.type === "extend") { const k = 1 + (num(m.k, 1.5) - 1) * v; g.scale.setComponent(ax, k); }
          if (m.type === "appear") { const a = api.ch(m.name, t); g.visible = a > 0.002; g.scale.multiplyScalar(Math.max(0.001, a)); }
          if (m.type === "light" || m.type === "blink") for (const l of lamps.get(n.id) ?? []) l.material.emissiveIntensity = m.type === "light" ? 2 * v : v * (((t * num(m.rate, 2)) % 1) < 0.5 ? 2.2 : 0.15);
          if (m.type === "count") { const sc = screens.get(n.id); if (sc) { const val = Math.round(num(m.from, 9) + (num(m.to, 0) - num(m.from, 9)) * v); if (val !== sc.shown) { const tx = numTex(val, sc.col); if (tx) { sc.face.material.map = tx; sc.face.material.emissiveMap = tx; sc.face.material.needsUpdate = true; } sc.shown = val; } } }
        }
      }
      for (const { fm, m } of fills) { const v = clamp01(api.ch(m.name, t)); fm.visible = v > 0.002; fm.scale.y = Math.max(0.001, v); }
      for (const { c, dots, m } of flows) { const v = clamp01(api.ch(m.name, t)); dots.forEach((d, i) => { d.visible = v > 0.05; if (d.visible) { d.position.copy(c.getPointAt((((t * num(m.speed, 0.6)) + i / dots.length) % 1))); d.scale.setScalar(v); } }); }
    },
  };
}
