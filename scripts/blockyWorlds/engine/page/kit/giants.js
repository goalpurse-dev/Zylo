// Blocky Worlds EPIC (EPIC agent): giant creatures in the block style, 20-200 m, data-driven so ANY animal can be a
// giant (a parameter set, which the BUILDER's AI blueprints can fill later), with a town on the shell / back.
//
//   GIANT_PRESETS                     kind -> params (turtle, whale, elephant, snail, wolf, bear, dragon, dog, cat, frog,
//                                     crab, giant_human); giantParams(spec) merges spec.params over the preset
//   makeGiant(spec)  -> Group         spec: { kind, size (m: length for 4-legged / swimmers / sliders, height for bipeds),
//                                     params?, town?: true|false, lit?, armour?, seed?, tex? }
//                                     origin on the ground under the body's centre, faces +z (like people.js)
//   animateGiant(g, action, t, opts)  idle | walk | run | stomp | roar | attack | swim | hit | fall (t = shot seconds;
//                                     opts: { hitAt, landAt }); the root's position is the caller's (beats move it)
//   updateGiantLOD(g, camera)         hides small details (eyes' shine, teeth, toes, window frames) when the giant is far
//   giantSurface(g)                   (x, z) -> y in metres on its back / shell (null off it), for crowds on a giant
//
// userData: { kind, plan, size, unit, height, length, gait (lib/epic.js gaitOf), joints, focus (head, local m),
//             town (Group|null), details[] }
// Rig (design units, scaled by unit = size / 10): root -> rig (scale unit) -> body (bob/pitch/roll) -> head -> jaw;
// legs[i] pivots (at the hip / shoulder) -> knee[i]; tail[] chain; ears[]; trunk[] chain; fins[]; arms[] (bipeds).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fabric, solid } from "./kitCommon.js";
import { gaitOf, PLAN_OF, prng } from "../../lib/epic.js";
import { makeTown, townLayout } from "./town.js";

const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------------------ the presets (data)
// Every number is in design units of a 10-unit creature (length for quadrupeds / swimmers / sliders, height for bipeds).
const BASE = {
  plan: "quadruped",
  body: { len: 6, w: 3.4, h: 2.6, y: 2.6, round: 0.5 },
  neck: { len: 0.8, up: 0.25, w: 1.3 },
  head: { size: 1.9, snout: 0.8, jaw: true, ears: "point", horns: "none", trunk: 0, eyes: "friendly", beak: false, brow: false, teeth: false },
  legs: { n: 4, len: 2.6, thick: 0.95, foot: 1.15, toes: true, knee: true },
  tail: { kind: "long", len: 2.4 },
  shell: { kind: "none", h: 2.6 },
  back: { spikes: 0, wings: false, deck: false },
  palette: { body: "#8a6a4a", belly: "#e8d6b0", accent: "#4a3426", shell: "#5e8f3c", shell2: "#86b257", eye: "#1b1b1f", glow: null, horn: "#f2ead8", nose: "#2a1d24" },
  fur: true,
  town: "none",
};
export const GIANT_PRESETS = {
  turtle: {
    plan: "quadruped", fur: false, town: "shell",
    body: { len: 7.4, w: 6.4, h: 1.2, y: 1.9, round: 0.5 },
    neck: { len: 1.0, up: 0.1, w: 1.25 },
    head: { size: 1.75, snout: 0.25, ears: "none", eyes: "friendly", beak: true, jaw: true },
    legs: { n: 4, len: 1.9, thick: 1.15, foot: 1.35, toes: true, knee: false },
    tail: { kind: "stub", len: 1.0 },
    shell: { kind: "dome", h: 3.0 },
    palette: { body: "#8fbf5a", belly: "#e8d6a0", accent: "#5f8f3a", shell: "#4e7d2a", shell2: "#6f9f3c", eye: "#1b1b1f", horn: "#f2ead8", nose: "#2e4a1e" },
  },
  whale: {
    plan: "swimmer", fur: false, town: "back",
    body: { len: 8.4, w: 3.4, h: 3.0, y: 1.6, round: 1.0 },
    head: { size: 0, snout: 0, ears: "none", eyes: "friendly", jaw: false },
    legs: { n: 0, len: 0, thick: 0, foot: 0 },
    tail: { kind: "fluke", len: 3.2 },
    back: { deck: true },
    palette: { body: "#3c6fa8", belly: "#d9e6f2", accent: "#2b5585", shell: "#2b5585", shell2: "#3c6fa8", eye: "#1b1b1f", horn: "#f2ead8", nose: "#1b2b40" },
  },
  elephant: {
    plan: "quadruped", fur: false, town: "back",
    body: { len: 6.4, w: 4.0, h: 3.6, y: 3.4, round: 0.7 },
    neck: { len: 0.4, up: 0.2, w: 2.2 },
    head: { size: 2.7, snout: 0, ears: "big", horns: "tusk", trunk: 3.6, eyes: "friendly", jaw: false },
    legs: { n: 4, len: 3.4, thick: 1.35, foot: 1.5, toes: true, knee: false },
    tail: { kind: "long", len: 2.0 },
    back: { deck: true },
    palette: { body: "#9aa3ad", belly: "#b8c0c8", accent: "#7d8590", shell: "#c0392b", shell2: "#f1c40f", eye: "#1b1b1f", horn: "#fbf6e9", nose: "#5d6670" },
  },
  snail: {
    plan: "slider", fur: false, town: "shell",
    body: { len: 9.4, w: 2.6, h: 1.2, y: 0, round: 0.5 },
    head: { size: 1.4, snout: 0, ears: "none", eyes: "stalks", jaw: false },
    legs: { n: 0, len: 0, thick: 0, foot: 0 },
    tail: { kind: "none", len: 0 },
    shell: { kind: "spiral", h: 5.6 },
    palette: { body: "#d8c49a", belly: "#c4ae84", accent: "#a88c5e", shell: "#b0632e", shell2: "#e0a050", eye: "#1b1b1f", horn: "#f2ead8", nose: "#7a5a3a" },
  },
  wolf: {
    plan: "biped", fur: true, town: "none", armour: true,
    body: { len: 2.4, w: 2.9, h: 3.4, y: 4.6, round: 0.3 },
    head: { size: 1.9, snout: 1.25, ears: "point", eyes: "menacing", jaw: true, brow: true, teeth: true },
    legs: { n: 2, len: 4.6, thick: 1.0, foot: 1.3, toes: true, knee: true },
    tail: { kind: "bush", len: 2.4 },
    palette: { body: "#5d6470", belly: "#b9c0c8", accent: "#3e434c", shell: "#7c838e", shell2: "#8e1f2b", eye: "#ffd23a", glow: "#ffcc33", horn: "#f6f2e6", nose: "#16161a" },
  },
  giant_human: {
    plan: "biped", fur: false, town: "none",
    body: { len: 2.2, w: 3.0, h: 3.4, y: 4.6, round: 0.2 },
    head: { size: 1.9, snout: 0, ears: "none", eyes: "friendly", jaw: false },
    legs: { n: 2, len: 4.6, thick: 1.05, foot: 1.3, toes: false, knee: true },
    tail: { kind: "none", len: 0 },
    palette: { body: "#2e86de", belly: "#f3cba9", accent: "#2f4f86", shell: "#7c838e", shell2: "#c0392b", eye: "#1b1b1f", horn: "#f2ead8", nose: "#c98e6b" },
  },
  bear: { head: { size: 2.1, snout: 0.7, ears: "round" }, tail: { kind: "stub", len: 0.6 }, body: { len: 6, w: 3.8, h: 3.2, y: 2.8, round: 0.8 }, palette: { body: "#6b4423", belly: "#a87a4f", accent: "#4a2e18", nose: "#1b1b1f" } },
  dog: { head: { size: 1.9, snout: 1.0, ears: "flop" }, tail: { kind: "long", len: 2.2 }, palette: { body: "#c58b4f", belly: "#f1d6b0", accent: "#8a5a32", nose: "#1b1b1f" } },
  cat: { head: { size: 1.8, snout: 0.35, ears: "point" }, tail: { kind: "long", len: 3.2 }, body: { len: 5.6, w: 2.8, h: 2.4, y: 2.6, round: 0.6 }, palette: { body: "#f08a2c", belly: "#ffe1c2", accent: "#b35f18", nose: "#ff8fa8" } },
  frog: { fur: false, head: { size: 2.4, snout: 0.2, ears: "none", eyes: "bulge" }, legs: { n: 4, len: 1.6, thick: 1.0, foot: 1.6, toes: true, knee: false }, tail: { kind: "none", len: 0 }, body: { len: 5.6, w: 4.6, h: 2.6, y: 1.4, round: 0.9 }, palette: { body: "#4caf50", belly: "#c5e1a5", accent: "#2e7d32", nose: "#1b5e20" } },
  dragon: { fur: false, head: { size: 2.0, snout: 1.3, ears: "none", horns: "spike", eyes: "menacing", teeth: true, brow: true }, tail: { kind: "spike", len: 4.0 }, back: { spikes: 7, wings: true }, palette: { body: "#3f8f5a", belly: "#e8d58a", accent: "#2b6a40", eye: "#ffd23a", glow: "#ffb020", horn: "#f2ead8", nose: "#1b2b20" } },
  crab: { fur: false, plan: "quadruped", head: { size: 0.0, snout: 0, ears: "none", eyes: "stalks" }, legs: { n: 6, len: 2.2, thick: 0.6, foot: 0.7, toes: false, knee: true }, tail: { kind: "none", len: 0 }, body: { len: 5.0, w: 6.0, h: 2.0, y: 2.4, round: 0.8 }, palette: { body: "#e0532c", belly: "#f6c3a0", accent: "#b53a1c", eye: "#1b1b1f" } },
};
const deepMerge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v; return o; };
/** the full parameter set of a giant spec: BASE <- preset(kind) <- spec.params (the AI blueprint's numbers) */
export function giantParams(spec = {}) {
  const kind = GIANT_PRESETS[spec.kind] ? spec.kind : "generic";
  let p = deepMerge(BASE, GIANT_PRESETS[kind] ?? {});
  p = deepMerge(p, spec.params ?? {});
  if (!GIANT_PRESETS[spec.kind] && spec.kind) { // an unknown animal: a generic quadruped in a colour picked from its name
    const R = prng([...String(spec.kind)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7));
    const hues = ["#8a6a4a", "#6b7a8a", "#c58b4f", "#7d8590", "#a0522d", "#5e8f3c", "#8e7cc3"];
    if (!spec.params?.palette?.body) p.palette.body = hues[Math.floor(R() * hues.length)];
  }
  if (spec.town === false) p.town = "none";
  if (spec.armour === false) p.armour = false; else if (spec.armour === true) p.armour = true;
  return p;
}

// ------------------------------------------------------------------------------------------------ building helpers
const GEO = new Map();
const rgeo = (w, h, d, r) => { const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${r.toFixed(3)}`; if (!GEO.has(k)) GEO.set(k, r > 0.01 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d)); return GEO.get(k); };
/** a block under a joint; merged with its siblings of the same material at the end (static) */
function B(parent, w, h, d, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(rgeo(w, h, d, o.r ?? Math.min(w, h, d) * 0.12), mat);
  m.position.set(x, y, z); m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.castShadow = o.cast ?? true; m.receiveShadow = true; m.userData.static = !o.keep; if (o.detail) m.userData.detail = true;
  parent.add(m); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
/** merge every static child mesh of each joint group (per material, in that group's local space); details kept apart */
function mergeJoint(group) {
  const by = new Map();
  for (const c of [...group.children]) {
    if (!c.isMesh || !c.userData.static || c.userData.detail) continue;
    const k = `${c.material.uuid}|${c.castShadow}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(c);
  }
  for (const list of by.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => { o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); for (const n of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(n)) g.deleteAttribute(n); g.applyMatrix4(o.matrix); return g; });
    const geo = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    if (!geo) continue;
    const m = new THREE.Mesh(geo, list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = true;
    group.add(m); for (const o of list) group.remove(o);
  }
}
const glowMat = (c, k = 2.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.4 });

/** the materials of a giant from its palette (fur = the look's procedural fabric "fur") */
function materials(p) {
  const P = p.palette;
  const body = p.fur ? fabric(P.body, "fur") : solid(P.body, { roughness: 0.7 });
  return {
    body, belly: p.fur ? fabric(P.belly, "fur") : solid(P.belly, { roughness: 0.75 }), accent: p.fur ? fabric(P.accent, "fur") : solid(P.accent, { roughness: 0.7 }),
    shell: solid(P.shell, { roughness: 0.55 }), shell2: solid(P.shell2, { roughness: 0.55 }), shellDark: solid(new THREE.Color(P.shell).multiplyScalar(0.45).getStyle(), { roughness: 0.8 }),
    white: solid("#ffffff", { roughness: 0.35 }), ink: solid(P.eye === "#ffd23a" ? "#16161a" : P.eye, { roughness: 0.3 }), horn: solid(P.horn, { roughness: 0.45 }), nose: solid(P.nose, { roughness: 0.4 }),
    eyeGlow: P.glow ? glowMat(P.eye, 1.6) : solid(P.eye, { roughness: 0.3 }), steel: solid("#8a929c", { roughness: 0.35, metalness: 0.6 }), steelDark: solid("#4a5058", { roughness: 0.4, metalness: 0.5 }),
    cape: fabric(P.shell2 ?? "#8e1f2b", "cotton"), wood: solid("#8a5a34", { roughness: 0.8 }),
  };
}

// ------------------------------------------------------------------------------------------------ head (shared)
function buildHead(J, p, M, at) {
  const H = p.head, s = H.size;
  const neck = pivot(J.body, at.x, at.y, at.z); J.neck = neck;
  if (p.neck && p.neck.len > 0.05 && p.plan !== "biped") B(neck, p.neck.w ?? s * 0.7, p.neck.w ?? s * 0.7, p.neck.len + 0.6, M.body, 0, p.neck.up * p.neck.len, p.neck.len / 2);
  const head = pivot(neck, 0, (p.neck?.up ?? 0) * (p.neck?.len ?? 0), (p.plan === "biped" ? 0 : p.neck?.len ?? 0) + s * 0.35); J.head = head;
  if (s <= 0.01) return head;
  B(head, s * 1.05, s * 0.95, s, M.body, 0, s * 0.1, 0, { r: s * 0.18 });
  // snout + jaw
  if (H.snout > 0.05) {
    B(head, s * 0.62, s * 0.42, H.snout + 0.2, M.belly, 0, -s * 0.05, s / 2 + H.snout / 2 - 0.05, { r: s * 0.1 });
    B(head, s * 0.3, s * 0.2, s * 0.18, M.nose, 0, s * 0.1, s / 2 + H.snout + 0.1, { r: 0.05 });
  } else if (H.beak) {
    B(head, s * 0.7, s * 0.25, s * 0.35, M.accent, 0, -s * 0.12, s * 0.55, { r: 0.08 });
  }
  if (H.jaw) {
    const jaw = pivot(head, 0, -s * 0.28, s * 0.1); J.jaw = jaw;
    const jl = Math.max(H.snout, 0.25) + s * 0.4;
    B(jaw, s * 0.56, s * 0.18, jl, M.belly, 0, -s * 0.06, jl / 2, { r: s * 0.06 });
    // the inside of the mouth (dark) shows when the jaw opens
    B(head, s * 0.5, s * 0.06, jl * 0.9, solid("#5a1f2a", { roughness: 0.8 }), 0, -s * 0.26, s * 0.1 + jl * 0.45, { r: 0.02 });
    if (H.teeth) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      B(head, s * 0.07, s * 0.11, s * 0.07, M.white, side * s * 0.2, -s * 0.25, s * 0.5 + H.snout * (0.25 + k * 0.28), { r: 0.01, detail: true, keep: true });
      B(jaw, s * 0.07, s * 0.1, s * 0.07, M.white, side * s * 0.19, s * 0.05, jl * (0.45 + k * 0.17), { r: 0.01, detail: true, keep: true });
    }
  }
  // eyes
  const ey = s * 0.28, ez = s / 2 + 0.01, ex = s * 0.27;
  if (H.eyes === "stalks") {
    J.stalks = [];
    for (const side of [-1, 1]) { const st = pivot(head, side * s * 0.25, s * 0.45, s * 0.2); st.rotation.z = -side * 0.25; B(st, s * 0.14, s * 1.2, s * 0.14, M.body, 0, s * 0.6, 0); B(st, s * 0.32, s * 0.32, s * 0.32, M.white, 0, s * 1.25, 0, { r: s * 0.12 }); B(st, s * 0.16, s * 0.16, s * 0.06, M.ink, 0, s * 1.27, s * 0.16, { r: 0.03 }); J.stalks.push(st); }
  } else if (H.eyes === "bulge") {
    for (const side of [-1, 1]) { B(head, s * 0.42, s * 0.42, s * 0.42, M.body, side * s * 0.35, s * 0.6, s * 0.1, { r: s * 0.16 }); B(head, s * 0.32, s * 0.32, s * 0.08, M.white, side * s * 0.35, s * 0.62, s * 0.3, { r: s * 0.08 }); B(head, s * 0.16, s * 0.2, s * 0.05, M.ink, side * s * 0.35, s * 0.6, s * 0.35, { r: 0.02 }); }
  } else {
    const menacing = H.eyes === "menacing";
    for (const side of [-1, 1]) {
      B(head, s * 0.26, s * (menacing ? 0.17 : 0.3), 0.06, menacing ? M.eyeGlow : M.white, side * ex, ey, ez, { r: 0.02, cast: false });
      B(head, s * (menacing ? 0.06 : 0.13), s * (menacing ? 0.16 : 0.18), 0.04, M.ink, side * ex + side * (menacing ? 0 : -0.02 * s), ey - 0.01 * s, ez + 0.035, { r: 0.01, cast: false });
      if (!menacing) B(head, s * 0.05, s * 0.05, 0.03, M.white, side * ex - 0.03 * s, ey + 0.06 * s, ez + 0.06, { r: 0.005, detail: true, keep: true, cast: false });
      if (H.brow || menacing) B(head, s * 0.34, s * 0.09, s * 0.12, M.accent, side * ex, ey + s * 0.18, ez - 0.02, { rz: side * -0.35, r: 0.02 });
    }
  }
  // ears
  J.ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot(head, side * s * 0.4, s * 0.5, -s * 0.1); J.ears.push(ear);
    if (H.ears === "point") { const m = new THREE.Mesh(new THREE.ConeGeometry(s * 0.24, s * 0.62, 4), M.body); m.position.y = s * 0.28; m.rotation.y = Math.PI / 4; m.castShadow = true; m.userData.static = true; ear.add(m); B(ear, s * 0.14, s * 0.3, s * 0.06, M.belly, 0, s * 0.22, s * 0.12, { r: 0.02 }); ear.rotation.z = side * -0.15; }
    else if (H.ears === "round") B(ear, s * 0.4, s * 0.36, s * 0.14, M.body, 0, s * 0.1, 0, { r: s * 0.12 });
    else if (H.ears === "flop") { ear.position.y = s * 0.3; B(ear, s * 0.2, s * 0.7, s * 0.4, M.accent, side * s * 0.12, -s * 0.25, 0, { r: s * 0.06 }); }
    else if (H.ears === "big") { ear.position.set(side * s * 0.5, s * 0.15, -s * 0.15); B(ear, s * 0.12, s * 1.25, s * 1.15, M.body, side * s * 0.06, -s * 0.15, -s * 0.45, { r: s * 0.1 }); B(ear, s * 0.13, s * 0.9, s * 0.8, solid("#c8a0a8", { roughness: 0.8 }), side * s * 0.02, -s * 0.15, -s * 0.4, { r: s * 0.08 }); }
  }
  // horns / tusks / trunk
  if (H.horns === "spike" || H.horns === "curl") for (const side of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.7, 5), M.horn); m.position.set(side * s * 0.3, s * 0.75, -s * 0.15); m.rotation.set(-0.5, 0, side * -0.3); m.castShadow = true; m.userData.static = true; head.add(m); }
  if (H.horns === "tusk") for (const side of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.9, 6), M.horn); m.position.set(side * s * 0.28, -s * 0.45, s * 0.6); m.rotation.set(1.9, 0, 0); m.castShadow = true; m.userData.static = true; head.add(m); }
  if (H.trunk > 0) {
    J.trunk = []; let par = pivot(head, 0, -s * 0.2, s * 0.5); const n = 5, seg = H.trunk / n;
    for (let k = 0; k < n; k++) { const w = s * (0.36 - k * 0.04); B(par, w, seg + 0.05, w, M.body, 0, -seg / 2, 0, { r: w * 0.2 }); J.trunk.push(par); par = pivot(par, 0, -seg, 0); }
  }
  return head;
}

// ------------------------------------------------------------------------------------------------ the plans
function buildQuadruped(J, p, M) {
  const b = p.body, L = p.legs;
  const body = J.body;
  if (p.shell.kind === "dome") buildDome(J, p, M);
  else {
    B(body, b.w, b.h, b.len, M.body, 0, 0, 0, { r: Math.min(b.w, b.h) * 0.25 * b.round + 0.1 });
    B(body, b.w * 0.8, b.h * 0.25, b.len * 0.8, M.belly, 0, -b.h * 0.42, 0, { r: 0.15 });
  }
  if (p.back.spikes) for (let k = 0; k < p.back.spikes; k++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9 - Math.abs(k - p.back.spikes / 2) * 0.06, 4), M.horn); m.position.set(0, b.h / 2 + 0.35, b.len * 0.4 - k * (b.len * 0.8 / p.back.spikes)); m.castShadow = true; m.userData.static = true; body.add(m); }
  if (p.back.wings) { J.wings = []; for (const side of [-1, 1]) { const w = pivot(body, side * b.w * 0.45, b.h * 0.45, b.len * 0.15); B(w, 3.4, 0.14, 2.6, M.accent, side * 1.7, 0, -0.6, { r: 0.05 }); for (let k = 0; k < 3; k++) B(w, 0.18, 0.22, 2.5, M.body, side * (0.8 + k * 1.1), 0.05, -0.6, { r: 0.05 }); w.rotation.z = side * 0.35; J.wings.push(w); } }
  // legs: pairs along the body, the hip at the body's side, bottom
  const n = Math.max(0, L.n), pairs = Math.ceil(n / 2), hipY = -b.h * 0.3;
  J.legs = []; J.knees = [];
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1, pair = Math.floor(k / 2);
    const z = pairs === 1 ? 0 : b.len * 0.36 - (pair * (b.len * 0.72)) / (pairs - 1);
    const xw = p.shell.kind === "dome" ? b.w * 0.42 : b.w * 0.36;
    const hip = pivot(body, side * xw, hipY, z);
    const crab = n > 4;
    if (crab) hip.rotation.z = side * 0.9;
    const up = L.knee ? L.len * 0.5 : L.len;
    B(hip, L.thick, up + 0.3, L.thick, M.body, 0, -up / 2, 0, { r: L.thick * 0.25 });
    const knee = pivot(hip, 0, -up, 0);
    if (L.knee) { B(knee, L.thick * 0.85, L.len * 0.5 + 0.2, L.thick * 0.85, M.body, 0, -L.len * 0.25, 0, { r: L.thick * 0.2 }); if (crab) knee.rotation.z = -side * 1.6; }
    const foot = pivot(knee, 0, L.knee ? -L.len * 0.5 : 0, 0);
    if (!crab) {
      B(foot, L.foot, 0.35, L.foot * 1.1, M.accent, 0, -0.17 + (p.body.y - b.h * 0.3 - L.len) * 0, 0.12, { r: 0.1 });
      if (L.toes) for (const tx of [-0.3, 0, 0.3]) B(foot, L.foot * 0.22, 0.2, 0.3, M.horn, tx * L.foot, -0.22, L.foot * 0.6, { r: 0.05, detail: true, keep: true });
    }
    J.legs.push(hip); J.knees.push(knee);
  }
  // head
  const hs = p.head.size;
  if (hs > 0.01) buildHead(J, p, M, { x: 0, y: p.shell.kind === "dome" ? 0.1 : b.h * 0.2, z: p.shell.kind === "dome" ? b.len * 0.5 : b.len * 0.45 });
  else if (p.head.eyes === "stalks") buildHead(J, { ...p, head: { ...p.head, size: 1.2 } }, M, { x: 0, y: b.h * 0.3, z: b.len * 0.45 });
  // tail
  buildTail(J, p, M, { x: 0, y: p.shell.kind === "dome" ? -0.1 : b.h * 0.15, z: -b.len * 0.5 });
  if (p.back.deck) buildDeck(J, p, M);
}
function buildTail(J, p, M, at) {
  const T = p.tail; J.tail = [];
  if (!T || T.kind === "none" || !(T.len > 0)) return;
  let par = pivot(J.body, at.x, at.y, at.z);
  const n = T.kind === "stub" ? 1 : 4, seg = T.len / n;
  for (let k = 0; k < n; k++) {
    const w = T.kind === "bush" ? 0.9 + Math.sin((k / n) * Math.PI) * 0.5 : Math.max(0.2, 0.7 - k * 0.12);
    B(par, w, w, seg + 0.1, k === n - 1 && T.kind === "spike" ? M.horn : T.kind === "bush" && k === n - 1 ? M.belly : M.body, 0, 0, -seg / 2, { r: w * 0.25 });
    J.tail.push(par); par = pivot(par, 0, 0, -seg);
  }
  J.tail[0].rotation.x = T.kind === "bush" || T.kind === "long" ? 0.5 : 0.15;
}
/** the turtle's shell: a flattened dome of blocky plates (merged), a lighter rim, the belly plate under it */
function buildDome(J, p, M) {
  const b = p.body, a = b.w / 2, c = b.len / 2, h = p.shell.h;
  const shell = pivot(J.body, 0, 0, 0); J.shell = shell;
  // the dark seam layer (a scaled sphere) under the plates
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, TAU, 0, Math.PI / 2), M.shellDark); core.scale.set(a * 0.97, h * 0.97, c * 0.97); core.castShadow = true; core.receiveShadow = true; core.userData.static = false; shell.add(core);
  const bands = 6, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < bands; i++) {
    const th = 0.12 + (i + 0.5) * (Math.PI / 2 - 0.12) / bands;
    const ring = Math.max(1, Math.round((TAU * Math.sin(th) * (a + c)) / 2 / 1.35));
    for (let j = 0; j < ring; j++) {
      const ph = (j + (i % 2) * 0.5) / ring * TAU;
      const x = a * Math.sin(th) * Math.sin(ph), z = c * Math.sin(th) * Math.cos(ph), y = h * Math.cos(th);
      const nrm = new THREE.Vector3(x / (a * a), y / (h * h), z / (c * c)).normalize();
      const m = B(shell, 1.28, 0.28, 1.28, (i + j) % 2 ? M.shell : M.shell2, x, y, z, { r: 0.12 });
      m.quaternion.setFromUnitVectors(up, nrm); m.rotateY(ph);
    }
  }
  // the cap plate on top
  B(shell, 1.6, 0.3, 1.6, M.shell2, 0, h + 0.02, 0, { r: 0.15 });
  // the rim: lighter marginal plates around the base
  const rim = Math.round((TAU * (a + c) / 2) / 1.1);
  for (let j = 0; j < rim; j++) { const ph = (j / rim) * TAU; const m = B(shell, 1.0, 0.5, 0.5, M.accent, a * 1.02 * Math.sin(ph), 0.05, c * 1.02 * Math.cos(ph), { r: 0.1 }); m.rotation.y = ph; }
  // the belly plate
  B(J.body, b.w * 0.92, 0.5, b.len * 0.92, M.belly, 0, -0.3, 0, { r: 0.2 });
}
/** a flat wooden deck on a back (elephant / whale) where the town stands */
function buildDeck(J, p, M) {
  const b = p.body;
  const y = p.plan === "swimmer" ? b.h * 0.5 : b.h / 2;
  J.deckY = y + 0.15;
  if (p.plan !== "swimmer") {
    B(J.body, b.w * 1.1, 0.3, b.len * 0.7, M.wood, 0, y + 0.1, -b.len * 0.05, { r: 0.05 });
    // a blanket hanging down the sides (red/gold, the look's bold colours)
    for (const side of [-1, 1]) { B(J.body, 0.12, b.h * 0.5, b.len * 0.62, M.shell, side * (b.w * 0.52), y - b.h * 0.22, -b.len * 0.05, { r: 0.04 }); B(J.body, 0.14, 0.25, b.len * 0.62, M.shell2, side * (b.w * 0.52), y - b.h * 0.47, -b.len * 0.05, { r: 0.04 }); }
  }
}
function buildSwimmer(J, p, M) {
  const b = p.body, body = J.body;
  // a fat front, tapering to the tail, a white grooved belly
  B(body, b.w, b.h, b.len * 0.62, M.body, 0, 0, b.len * 0.12, { r: b.h * 0.32 });
  B(body, b.w * 0.86, b.h * 0.86, b.len * 0.3, M.body, 0, -0.05, -b.len * 0.3, { r: b.h * 0.3 });
  B(body, b.w * 0.88, b.h * 0.3, b.len * 0.7, M.belly, 0, -b.h * 0.38, b.len * 0.05, { r: 0.3 });
  for (let k = 0; k < 6; k++) B(body, b.w * 0.7, 0.05, b.len * 0.5, M.accent, 0, -b.h * 0.49, b.len * 0.08, { r: 0.01, detail: true, keep: true, rz: 0 }).position.x = (k - 2.5) * b.w * 0.12;
  // the mouth line + eyes on the front sides
  B(body, b.w * 1.01, 0.12, b.len * 0.28, M.accent, 0, -b.h * 0.12, b.len * 0.3, { r: 0.04 });
  for (const side of [-1, 1]) { B(body, 0.08, 0.42, 0.42, M.white, side * b.w * 0.5, b.h * 0.08, b.len * 0.3, { r: 0.08, cast: false }); B(body, 0.06, 0.22, 0.22, M.ink, side * (b.w * 0.5 + 0.04), b.h * 0.06, b.len * 0.31, { r: 0.04, cast: false }); }
  // blowhole
  B(body, 0.5, 0.15, 0.3, M.accent, 0, b.h / 2, b.len * 0.28, { r: 0.05 });
  J.head = pivot(body, 0, 0, b.len * 0.42);
  J.fins = [];
  for (const side of [-1, 1]) { const f = pivot(body, side * b.w * 0.45, -b.h * 0.3, b.len * 0.18); B(f, 2.0, 0.22, 0.9, M.body, side * 1.0, 0, 0, { r: 0.1 }); f.rotation.z = side * -0.35; J.fins.push(f); }
  // tail chain: 3 segments + the fluke
  J.tail = []; let par = pivot(body, 0, 0.1, -b.len * 0.45);
  for (let k = 0; k < 3; k++) { const w = b.w * (0.6 - k * 0.14), seg = p.tail.len * 0.3; B(par, w, w * 0.9, seg + 0.2, M.body, 0, 0, -seg / 2, { r: w * 0.3 }); J.tail.push(par); par = pivot(par, 0, 0, -seg); }
  const fl = pivot(par, 0, 0, 0); J.tail.push(fl);
  B(fl, 3.4, 0.2, 1.2, M.body, 0, 0, -0.5, { r: 0.1 }); for (const side of [-1, 1]) B(fl, 1.4, 0.2, 0.8, M.body, side * 1.3, 0, -0.95, { r: 0.1, ry: side * 0.4 });
  buildDeck(J, p, M);
}
function buildSlider(J, p, M) {
  const b = p.body, body = J.body;
  // the foot: a long low slab with a rounded front (the head end at +z), and a ripple strip we animate
  B(body, b.w, b.h, b.len * 0.85, M.body, 0, b.h / 2, -b.len * 0.05, { r: 0.4 });
  B(body, b.w * 1.04, b.h * 0.3, b.len * 0.86, M.belly, 0, b.h * 0.12, -b.len * 0.05, { r: 0.12 });
  buildHead(J, { ...p, head: { ...p.head, size: 1.5 } }, M, { x: 0, y: b.h * 0.8, z: b.len * 0.38 });
  // the spiral shell: a stack of blocky rings around the x axis, getting smaller toward the apex (a coil)
  const shell = pivot(body, 0, b.h, -b.len * 0.08); J.shell = shell;
  const R0 = p.shell.h * 0.5, turns = 2.6, steps = 64;
  for (let k = 0; k < steps; k++) {
    const u = k / steps, ang = u * turns * TAU, r = R0 * (1 - u * 0.78), w = 1.25 * (1 - u * 0.6);
    const y = R0 + Math.cos(ang) * r * 0.92, z = Math.sin(ang) * r;
    B(shell, b.w * 0.95 * (1 - u * 0.35) + 0.6, w, w, k % 2 ? M.shell : M.shell2, (u - 0.5) * 0.8, y, z, { r: w * 0.2, rx: -ang });
  }
  B(shell, b.w * 1.05, R0 * 1.15, R0 * 1.15, M.shellDark, 0, R0, 0, { r: 0.4 });
  J.shellTop = R0 * 2 + b.h; // the top of the coil, in body space
}
function buildBiped(J, p, M) {
  const b = p.body, L = p.legs, body = J.body, armour = !!p.armour;
  // body = the pelvis pivot at hip height (rig y = b.y); torso above it, leaning forward a little
  B(body, b.w * 0.8, 1.0, b.len * 0.8, M.accent, 0, 0.2, 0, { r: 0.2 });
  const torso = pivot(body, 0, 0.6, 0); J.torso = torso; torso.rotation.x = 0.12;
  B(torso, b.w, b.h, b.len, M.body, 0, b.h / 2, 0, { r: 0.35 });
  B(torso, b.w * 0.62, b.h * 0.7, 0.2, M.belly, 0, b.h * 0.45, b.len / 2, { r: 0.08 });
  if (armour) {
    B(torso, b.w * 1.06, b.h * 0.55, b.len * 1.08, M.steel, 0, b.h * 0.62, 0, { r: 0.2 });
    B(torso, b.w * 0.5, b.h * 0.25, 0.12, M.steelDark, 0, b.h * 0.62, b.len * 0.55, { r: 0.04 });   // a dark plate (an emblem in steel, no logo)
    B(torso, b.w * 1.1, 0.35, b.len * 1.12, M.steelDark, 0, b.h * 0.05, 0, { r: 0.08 });         // the belt
    // the cape behind
    const cape = pivot(torso, 0, b.h * 0.95, -b.len * 0.55); J.cape = cape;
    B(cape, b.w * 1.15, b.h * 1.45, 0.14, M.cape, 0, -b.h * 0.7, -0.05, { r: 0.04 });
  }
  // arms
  J.arms = []; J.elbows = [];
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * (b.w / 2 + 0.45), b.h * 0.85, 0);
    if (armour) B(sh, 1.15, 0.7, 1.25, M.steel, 0, 0.15, 0, { r: 0.2 });
    B(sh, 0.8, 2.0, 0.85, M.body, 0, -1.0, 0, { r: 0.18 });
    const el = pivot(sh, 0, -2.0, 0);
    B(el, 0.72, 1.9, 0.78, M.body, 0, -0.95, 0, { r: 0.18 });
    if (armour) B(el, 0.8, 0.9, 0.86, M.steelDark, 0, -0.75, 0, { r: 0.1 });
    B(el, 0.95, 0.75, 0.9, M.belly, 0, -2.1, 0.05, { r: 0.18 });  // the paw
    for (const cx of [-0.28, 0, 0.28]) B(el, 0.16, 0.38, 0.2, M.horn, cx, -2.55, 0.25, { r: 0.04, detail: true, keep: true });
    J.arms.push(sh); J.elbows.push(el);
  }
  // legs: thigh, a backward-bent shin (digitigrade when furry), a long foot
  J.legs = []; J.knees = [];
  for (const side of [-1, 1]) {
    const hip = pivot(body, side * b.w * 0.27, 0, 0);
    B(hip, L.thick * 1.15, L.len * 0.5, L.thick * 1.2, M.body, 0, -L.len * 0.24, 0.1, { r: 0.25 });
    const knee = pivot(hip, 0, -L.len * 0.48, 0.25);
    B(knee, L.thick * 0.9, L.len * 0.52, L.thick * 0.95, M.body, 0, -L.len * 0.25, 0, { r: 0.2 });
    if (armour) B(knee, L.thick * 1.0, L.len * 0.28, L.thick * 1.05, M.steelDark, 0, -L.len * 0.18, 0.06, { r: 0.08 });
    const foot = pivot(knee, 0, -L.len * 0.52, 0);
    B(foot, L.foot * 0.85, 0.42, L.foot * 1.25, M.accent, 0, 0.0, 0.35, { r: 0.12 });
    if (L.toes) for (const tx of [-0.3, 0, 0.3]) B(foot, 0.2, 0.22, 0.32, M.horn, tx, -0.05, 1.05, { r: 0.04, detail: true, keep: true });
    J.legs.push(hip); J.knees.push(knee);
  }
  // the head on the torso (bipeds: no neck block)
  buildHead(J, { ...p, neck: { len: 0, up: 0 } }, M, { x: 0, y: 0, z: 0 });
  // re-parent the head's neck pivot to the torso top
  torso.add(J.neck); J.neck.position.set(0, b.h + 0.45, b.len * 0.12); J.head.position.set(0, 0.55, 0.15);
  if (p.head.snout > 0.05) B(J.head, p.head.size * 0.9, p.head.size * 0.3, p.head.size * 0.6, M.belly, 0, -p.head.size * 0.42, -p.head.size * 0.05, { r: 0.12 }); // the ruff under the chin
  buildTail(J, p, M, { x: 0, y: 0.2, z: -b.len * 0.45 });
  if (J.tail.length) J.tail[0].rotation.x = 0.7;
}

// ------------------------------------------------------------------------------------------------ makeGiant
/** makeGiant(spec) -> Group: see the header. spec.size defaults to 60 m. */
export function makeGiant(spec = {}) {
  const p = giantParams(spec), kind = GIANT_PRESETS[spec.kind] ? spec.kind : spec.kind ?? "generic";
  const size = Math.min(200, Math.max(5, Number(spec.size) || 60)), unit = size / 10;
  const M = materials(p);
  const root = new THREE.Group(); root.name = `giant:${spec.id ?? kind}`;
  const rig = pivot(root); rig.scale.setScalar(unit);
  const J = { rig };
  // the body pivot: at hip height for bipeds, at the belly-to-back centre for the rest
  const by = p.plan === "biped" ? p.body.y : p.plan === "slider" ? 0 : p.plan === "swimmer" ? p.body.y : p.body.y + (p.shell.kind === "dome" ? 0 : p.body.h * 0.3);
  J.body = pivot(rig, 0, by, 0);
  if (p.plan === "biped") buildBiped(J, p, M);
  else if (p.plan === "swimmer") buildSwimmer(J, p, M);
  else if (p.plan === "slider") buildSlider(J, p, M);
  else buildQuadruped(J, p, M);
  // merge the static blocks of every joint group
  const groups = []; rig.traverse((o) => { if (o.isGroup || o === rig) groups.push(o); });
  for (const gp of groups) mergeJoint(gp);
  // rest pose of every joint (animateGiant resets to it each frame)
  const rest = new Map(); rig.traverse((o) => { if (o.isGroup) rest.set(o, { p: o.position.clone(), r: o.rotation.clone() }); });
  // measurements
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3());
  const details = []; root.traverse((o) => { if (o.userData.detail) details.push(o); });
  root.userData = { kind, plan: p.plan, params: p, size, unit, height: box.max.y, length: sz.z, width: sz.x, joints: J, rest, details, gait: gaitOf(kind, "walk", size), town: null, lod: "high" };
  const hp = J.head ? J.head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, box.max.y * 0.8, sz.z * 0.4);
  root.userData.focus = hp; // local (root at the origin)
  // the town on the shell / back
  const wantTown = spec.town !== false && p.town !== "none";
  if (wantTown) {
    const town = buildGiantTown(root, p, spec);
    if (town) root.userData.town = town;
  }
  return root;
}

/** the height (metres, root space) of the back / shell at (x, z) metres, or null off it; rest pose */
export function giantSurface(g) {
  const { params: p, unit } = g.userData;
  const b = p.body;
  if (p.shell.kind === "dome") {
    const a = (b.w / 2) * unit, c = (b.len / 2) * unit, h = p.shell.h * unit, base = (p.body.y) * unit;
    return (x, z) => { const q = 1 - (x / a) ** 2 - (z / c) ** 2; return q <= 0.02 ? null : base + h * Math.sqrt(q) + 0.28 * unit * 0.5; };
  }
  if (p.shell.kind === "spiral") {
    const top = (g.userData.joints.shellTop ?? 6) * unit, R0 = p.shell.h * 0.5 * unit, zc = -b.len * 0.08 * unit, hw = b.w * 0.5 * unit;
    return (x, z) => { const dz = z - zc; if (Math.abs(x) > hw || Math.abs(dz) > R0 * 0.75) return null; return top - R0 + Math.sqrt(Math.max(0, R0 * R0 - dz * dz)) * 0.98; };
  }
  if (p.back.deck) {
    const y = ((p.plan === "swimmer" ? p.body.y : p.body.y + p.body.h * 0.3) + (g.userData.joints.deckY ?? b.h / 2)) * unit;
    const hw = (b.w * (p.plan === "swimmer" ? 0.38 : 0.5)) * unit, z0 = (p.plan === "swimmer" ? -b.len * 0.3 : -b.len * 0.38) * unit, z1 = (p.plan === "swimmer" ? b.len * 0.36 : b.len * 0.28) * unit;
    return (x, z) => (Math.abs(x) <= hw && z >= z0 && z <= z1 ? y : null);
  }
  return () => null;
}

function buildGiantTown(g, p, spec) {
  const surf = giantSurface(g), u = g.userData.unit, b = p.body;
  const region = { x0: -b.w * 0.6 * u, x1: b.w * 0.6 * u, z0: -b.len * 0.6 * u, z1: b.len * 0.6 * u };
  // how many houses: the area of the back in ~9x9 m cells, capped (the town is a few draw calls whatever the count)
  const area = (region.x1 - region.x0) * (region.z1 - region.z0);
  const count = Math.max(6, Math.min(140, Math.round(area / 420)));
  const steep = p.shell.kind === "dome" ? (x, z) => { const y = surf(x, z); if (y == null) return null; const a = (b.w / 2) * u, c = (b.len / 2) * u; return (x / a) ** 2 + (z / c) ** 2 > 0.62 ? null : y; } : surf;
  const houses = townLayout({ surface: steep, region, count, seed: spec.seed ?? 5, minGap: 1.0, size: [7, 11], tall: [6, 10] });
  const trees = [];
  const R = prng((spec.seed ?? 5) * 3 + 1);
  for (let k = 0; k < count * 0.5; k++) { const x = region.x0 + R() * (region.x1 - region.x0), z = region.z0 + R() * (region.z1 - region.z0), y = steep(x, z); if (y == null) continue; if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < Math.hypot(h.w, h.d) / 2 + 1.5)) continue; trees.push({ x, y, z, s: 0.9 + R() * 0.5 }); }
  const town = makeTown(houses, { seed: spec.seed ?? 5, lit: !!spec.lit, trees, tex: spec.tex ?? null });
  // the town lives in root space (metres) but rides the body: parent it to the body joint with the inverse unit scale
  const holder = new THREE.Group(); holder.scale.setScalar(1 / u);
  const by = g.userData.joints.body.position.y * u;
  holder.position.set(0, -by / u, 0); // body space -> root space offset (rest)
  holder.add(town);
  g.userData.joints.body.add(holder);
  g.userData.details.push(...town.userData.details);
  return town;
}

// ------------------------------------------------------------------------------------------------ animation
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/** animateGiant(g, action, t, opts) sets every joint for shot time t (resets to rest first) */
export function animateGiant(g, action = "idle", t = 0, opts = {}) {
  const U = g.userData, J = U.joints, p = U.params, plan = U.plan;
  for (const [o, r] of U.rest) { o.position.copy(r.p); o.rotation.copy(r.r); }
  const gait = gaitOf(U.kind, action === "run" ? "run" : action === "swim" ? "swim" : "walk", U.size);
  const cyc = t * gait.cadence * TAU;
  const breathe = Math.sin(t * 0.8 * TAU / 2);
  // idle life everywhere: breathing, a slow head sway, ear twitches, a tail swish
  J.body.position.y += breathe * 0.04;
  if (J.head) { J.head.rotation.y += 0.08 * Math.sin(t * 0.45 * TAU); J.head.rotation.x += 0.03 * Math.sin(t * 0.3 * TAU); }
  (J.ears ?? []).forEach((e, i) => { e.rotation.x += 0.08 * Math.sin(t * 1.3 + i); });
  if (J.tail?.length) J.tail.forEach((s, i) => { s.rotation.y += 0.12 * Math.sin(t * 1.1 * TAU / 2 - i * 0.6); });
  (J.trunk ?? []).forEach((s, i) => { s.rotation.x += 0.08 * Math.sin(t * 0.7 * TAU / 2 - i * 0.5) + 0.05 * i; });
  (J.stalks ?? []).forEach((s, i) => { s.rotation.x += 0.15 * Math.sin(t * 0.9 + i * 1.7); });
  if (J.cape) J.cape.rotation.x = -0.08 - 0.05 * Math.sin(t * 1.4);

  const legs = J.legs ?? [], knees = J.knees ?? [];
  const walkLegs = (amp, kneeAmp) => {
    if (plan === "biped") legs.forEach((l, i) => { const s = Math.sin(cyc + i * Math.PI); l.rotation.x += amp * s; knees[i].rotation.x += kneeAmp * Math.max(0, -Math.cos(cyc + i * Math.PI)); });
    else legs.forEach((l, i) => { const pair = Math.floor(i / 2), side = i % 2; const ph = cyc + (side ^ (pair % 2)) * Math.PI; l.rotation.x += amp * Math.sin(ph); if (knees[i] && p.legs.knee) knees[i].rotation.x += kneeAmp * Math.max(0, Math.cos(ph)); });
  };
  switch (action) {
    case "walk": case "run": {
      const run = action === "run";
      walkLegs(run ? 0.6 : 0.34, run ? 0.9 : 0.45);
      J.body.position.y += (run ? 0.25 : 0.1) * Math.abs(Math.sin(cyc));
      J.body.rotation.z += (run ? 0.03 : 0.02) * Math.sin(cyc);
      J.body.rotation.x += plan === "biped" ? (run ? 0.12 : 0.04) : 0.01 * Math.sin(cyc * 2);
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.x += (run ? 0.7 : 0.35) * Math.sin(cyc + (i ? 0 : Math.PI)); J.elbows[i].rotation.x -= run ? 0.8 : 0.3; });
      if (J.head) J.head.rotation.x += 0.04 * Math.sin(cyc * 2);
      if (plan === "slider") slide(J, t);
      if (plan === "swimmer") swim(J, t, gait);
      break;
    }
    case "swim": swim(J, t, gait); if (plan === "quadruped") legs.forEach((l, i) => { l.rotation.z += (i % 2 ? 1 : -1) * 0.35 * Math.sin(cyc + Math.floor(i / 2) * Math.PI); l.rotation.x += 0.4 * Math.sin(cyc + Math.floor(i / 2) * Math.PI); }); break;
    case "stomp": {
      // raise one front leg (the right / first), hold, slam down at 60 % of a ~1.6 s cycle; the body rears then dips
      const per = 1 / gaitOf(U.kind, "stomp", U.size).cadence, u = (t % per) / per;
      const raise = u < 0.45 ? ease(u / 0.45) : u < 0.6 ? 1 - ease((u - 0.45) / 0.15) : 0;
      const dip = u >= 0.6 && u < 0.8 ? Math.sin(((u - 0.6) / 0.2) * Math.PI) : 0;
      if (plan === "biped") { legs[0].rotation.x -= 1.1 * raise; knees[0].rotation.x += 1.2 * raise; J.body.position.y -= 0.35 * dip; if (J.arms) J.arms.forEach((a) => { a.rotation.z += (a.position.x > 0 ? -1 : 1) * 0.5 * raise; }); }
      else { legs[0].rotation.x -= 0.9 * raise; J.body.rotation.x -= 0.12 * raise; J.body.position.y += 0.3 * raise - 0.2 * dip; }
      if (J.head) J.head.rotation.x -= 0.2 * raise;
      if (J.jaw) J.jaw.rotation.x += 0.5 * raise;
      break;
    }
    case "roar": {
      const k = ease(t / 0.35) * (opts.dur ? ease((opts.dur - t) / 0.4) : 1), buzz = 0.03 * Math.sin(t * 40);
      if (J.head) { J.head.rotation.x -= 0.45 * k + buzz; }
      if (J.neck) J.neck.rotation.x -= 0.15 * k;
      if (J.jaw) J.jaw.rotation.x += 0.75 * k;
      if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x -= (0.35 + i * 0.12) * k; });
      if (J.torso) J.torso.rotation.x -= 0.3 * k;
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.z += (i ? -1 : 1) * 0.9 * k; a.rotation.x -= 0.6 * k; J.elbows[i].rotation.x -= 0.5 * k; });
      if (plan === "quadruped") { J.body.rotation.x -= 0.1 * k; legs.forEach((l, i) => { if (i < 2) l.rotation.x -= 0.15 * k; }); }
      (J.ears ?? []).forEach((e, i) => { e.rotation.z += (i ? -1 : 1) * 0.3 * k; });
      if (J.wings) J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * 0.6 * k; });
      break;
    }
    case "attack": {
      // wind up, lunge and strike at hitAt (s), recover
      const hit = opts.hitAt ?? 0.6, wind = ease((t - (hit - 0.55)) / 0.35) * (t < hit ? 1 : 0), strike = t >= hit - 0.18 ? Math.max(0, 1 - Math.abs(t - hit) / 0.35) : 0;
      if (J.torso) { J.torso.rotation.x += 0.35 * strike - 0.2 * wind; J.torso.rotation.y += -0.5 * wind + 0.6 * strike; }
      if (J.arms) { J.arms[1].rotation.x += -2.4 * wind + (-1.2 + 2.6 * strike) * (strike > 0 ? 1 : 0); J.arms[1].rotation.z -= 0.5 * wind; J.arms[0].rotation.x -= 0.6 * strike; }
      if (plan === "biped") { legs[0].rotation.x -= 0.5 * strike; legs[1].rotation.x += 0.35 * strike; J.body.position.z += 0.8 * strike; }
      else { J.body.position.z += 0.8 * strike - 0.3 * wind; J.body.rotation.x += 0.12 * strike - 0.08 * wind; legs.forEach((l, i) => { if (i < 2) l.rotation.x -= 0.4 * strike; }); }
      if (J.head) J.head.rotation.x += 0.25 * strike - 0.2 * wind;
      if (J.jaw) J.jaw.rotation.x += 0.7 * Math.max(wind, strike);
      break;
    }
    case "hit": {
      // recoil at opts.at (s): pushed back and tilted, then settles
      const at = opts.at ?? 0.3, u = t - at, k = u < 0 ? 0 : Math.exp(-u / 0.5) * Math.sin(Math.min(Math.PI / 2, u * 12));
      J.body.rotation.x -= 0.18 * k; J.body.rotation.z += 0.1 * k; J.body.position.z -= 0.6 * k;
      if (J.head) J.head.rotation.x -= 0.3 * k; if (J.jaw) J.jaw.rotation.x += 0.4 * k;
      (J.stalks ?? []).forEach((s) => { s.rotation.x -= 0.6 * k; });
      break;
    }
    case "fall": {
      // tips over sideways like a tree (gravity: ease-in), lands at landAt (s), a small bounce
      const land = opts.landAt ?? 1.0, u = Math.min(1, Math.max(0, t / land)), ang = (Math.PI / 2 - 0.12) * u * u;
      const bounce = t > land ? 0.05 * Math.exp(-(t - land) / 0.15) * Math.sin((t - land) * 30) : 0;
      J.rig.rotation.z = ang + bounce; J.rig.position.y = 0;
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.z += (i ? -1 : 1) * 1.2 * u; });
      if (J.jaw) J.jaw.rotation.x += 0.5 * u;
      break;
    }
    default: break; // idle: the idle life above
  }
}
function swim(J, t, gait) {
  const c = t * gait.cadence * TAU;
  if (J.tail) J.tail.forEach((s, i) => { s.rotation.x += 0.2 * Math.sin(c - i * 0.7) * (i + 1) * 0.5; });
  if (J.fins) J.fins.forEach((f, i) => { f.rotation.x += 0.25 * Math.sin(c + i * Math.PI * 0.1); f.rotation.z += (i ? -1 : 1) * 0.15 * Math.sin(c); });
  J.body.rotation.x += 0.04 * Math.sin(c + 0.5); J.body.position.y += 0.15 * Math.sin(c);
}
function slide(J, t) {
  // the foot ripples: a small wave along the body, the shell rocks gently
  if (J.shell) J.shell.rotation.x = 0.02 * Math.sin(t * 1.2);
  J.body.scale.set(1, 1 + 0.02 * Math.sin(t * 4), 1);
}

/** updateGiantLOD(g, camera): small details (teeth, toes, shine, window frames) off when the giant is far */
export function updateGiantLOD(g, camera) {
  const pos = new THREE.Vector3(); g.getWorldPosition(pos);
  const d = camera.position.distanceTo(pos), U = g.userData;
  const far = d > U.size * 3.2;
  if ((U.lod === "low") === far) return;
  U.lod = far ? "low" : "high";
  for (const o of U.details) o.visible = !far;
}
/** a giant's height in metres (rest pose) */
export const giantHeight = (g) => g.userData.height;
