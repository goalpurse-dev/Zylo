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
  const fam = !GIANT_PRESETS[spec.kind] && spec.kind ? familyOf(spec.kind) : null;
  if (fam) p = deepMerge(deepMerge(BASE, fam), spec.params ?? {});
  else if (!GIANT_PRESETS[spec.kind] && spec.kind) { // an unknown animal: a generic quadruped in a colour picked from its name
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
  if (p.neck && p.neck.len > 0.05 && p.plan !== "biped" && p.neck.up >= 0.5) { // a long, rising neck (horse, giraffe): one slanted block up to the head
    const L = Math.hypot(p.neck.len, p.neck.up * p.neck.len), nk = pivot(neck); nk.rotation.x = -Math.atan2(p.neck.up, 1);
    B(nk, p.neck.w ?? s * 0.7, p.neck.w ?? s * 0.7, L + 0.6, M.body, 0, 0, L / 2);
  } else if (p.neck && p.neck.len > 0.05 && p.plan !== "biped") B(neck, p.neck.w ?? s * 0.7, p.neck.w ?? s * 0.7, p.neck.len + 0.6, M.body, 0, p.neck.up * p.neck.len, p.neck.len / 2);
  const head = pivot(neck, 0, (p.neck?.up ?? 0) * (p.neck?.len ?? 0), (p.plan === "biped" ? 0 : p.neck?.len ?? 0) + s * 0.35); J.head = head;
  if (s <= 0.01) return head;
  B(head, s * 1.05, s * 0.95, s, M.body, 0, s * 0.1, 0, { r: s * 0.18 });
  // snout + jaw
  if (H.snout > 0.05) {
    B(head, s * 0.62, s * 0.42, H.snout + 0.2, M.belly, 0, -s * 0.05, s / 2 + H.snout / 2 - 0.05, { r: s * 0.1 });
    B(head, s * 0.3, s * 0.2, s * 0.18, M.nose, 0, s * 0.1, s / 2 + H.snout + 0.1, { r: 0.05 });
  } else if (H.beak) {
    if (p.plan === "bird") { B(head, s * 0.36, s * 0.3, s * 0.5, M.nose, 0, -s * 0.05, s * 0.62, { r: 0.06 }); B(head, s * 0.3, s * 0.12, s * 0.38, M.nose, 0, -s * 0.22, s * 0.58, { r: 0.04 }); }
    else B(head, s * 0.7, s * 0.25, s * 0.35, M.accent, 0, -s * 0.12, s * 0.55, { r: 0.08 });
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
    J.lids = [-1, 1].map((side) => B(head, s * 0.36, s * 0.36, s * 0.1, M.body, side * s * 0.35, s * 0.62, s * 0.36, { r: s * 0.06, keep: true }));
  } else if (H.eyes === "owl") { // big round eyes in pale discs (owls)
    for (const side of [-1, 1]) { B(head, s * 0.46, s * 0.46, 0.06, M.belly, side * s * 0.25, s * 0.18, s / 2 + 0.01, { r: s * 0.2, cast: false }); B(head, s * 0.3, s * 0.3, 0.06, M.white, side * s * 0.25, s * 0.18, s / 2 + 0.04, { r: s * 0.13, cast: false }); B(head, s * 0.15, s * 0.17, 0.05, M.ink, side * s * 0.25, s * 0.18, s / 2 + 0.08, { r: s * 0.06, cast: false }); }
    J.lids = [-1, 1].map((side) => B(head, s * 0.34, s * 0.34, 0.1, M.body, side * s * 0.25, s * 0.18, s / 2 + 0.1, { r: s * 0.1, keep: true }));
  } else {
    const menacing = H.eyes === "menacing";
    for (const side of [-1, 1]) {
      B(head, s * 0.26, s * (menacing ? 0.17 : 0.3), 0.06, menacing ? M.eyeGlow : M.white, side * ex, ey, ez, { r: 0.02, cast: false });
      B(head, s * (menacing ? 0.06 : 0.13), s * (menacing ? 0.16 : 0.18), 0.04, M.ink, side * ex + side * (menacing ? 0 : -0.02 * s), ey - 0.01 * s, ez + 0.035, { r: 0.01, cast: false });
      if (!menacing) B(head, s * 0.05, s * 0.05, 0.03, M.white, side * ex - 0.03 * s, ey + 0.06 * s, ez + 0.06, { r: 0.005, detail: true, keep: true, cast: false });
      if (H.brow || menacing) B(head, s * 0.34, s * 0.09, s * 0.12, M.accent, side * ex, ey + s * 0.18, ez - 0.02, { rz: side * -0.35, r: 0.02 });
    }
    J.lids = [-1, 1].map((side) => B(head, s * 0.32, s * 0.34, 0.12, M.body, side * ex, ey, ez + 0.07, { r: 0.03, keep: true, cast: false }));
  }
  for (const l of J.lids ?? []) l.visible = false;
  // ears
  J.ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot(head, side * s * 0.4, s * 0.5, -s * 0.1); J.ears.push(ear);
    if (H.ears === "point") { const m = new THREE.Mesh(new THREE.ConeGeometry(s * 0.24, s * 0.62, 4), M.body); m.position.y = s * 0.28; m.rotation.y = Math.PI / 4; m.castShadow = true; m.userData.static = true; ear.add(m); B(ear, s * 0.14, s * 0.3, s * 0.06, M.belly, 0, s * 0.22, s * 0.12, { r: 0.02 }); ear.rotation.z = side * -0.15; }
    else if (H.ears === "round") B(ear, s * 0.4, s * 0.36, s * 0.14, M.body, 0, s * 0.1, 0, { r: s * 0.12 });
    else if (H.ears === "flop") { ear.position.y = s * 0.3; B(ear, s * 0.2, s * 0.7, s * 0.4, M.accent, side * s * 0.12, -s * 0.25, 0, { r: s * 0.06 }); }
    else if (H.ears === "long") { ear.position.y = s * 0.45; B(ear, s * 0.22, s * 1.1, s * 0.14, M.body, 0, s * 0.5, 0, { r: s * 0.08 }); B(ear, s * 0.12, s * 0.85, s * 0.06, M.belly, 0, s * 0.5, s * 0.06, { r: 0.02 }); ear.rotation.z = side * -0.12; }
    else if (H.ears === "big") { ear.position.set(side * s * 0.5, s * 0.15, -s * 0.15); B(ear, s * 0.12, s * 1.25, s * 1.15, M.body, side * s * 0.06, -s * 0.15, -s * 0.45, { r: s * 0.1 }); B(ear, s * 0.13, s * 0.9, s * 0.8, solid("#c8a0a8", { roughness: 0.8 }), side * s * 0.02, -s * 0.15, -s * 0.4, { r: s * 0.08 }); }
  }
  // horns / tusks / trunk
  if (H.horns === "spike" || H.horns === "curl") for (const side of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.7, 5), M.horn); m.position.set(side * s * 0.3, s * 0.75, -s * 0.15); m.rotation.set(-0.5, 0, side * -0.3); m.castShadow = true; m.userData.static = true; head.add(m); }
  if (H.horns === "antler") for (const side of [-1, 1]) { const an = pivot(head, side * s * 0.32, s * 0.55, -s * 0.1); an.rotation.z = side * -0.6; B(an, s * 0.12, s * 0.7, s * 0.12, M.horn, 0, s * 0.35, 0); B(an, s * 0.95, s * 0.14, s * 0.7, M.horn, side * s * 0.2, s * 0.72, 0, { r: 0.04 }); for (let k = 0; k < 3; k++) B(an, s * 0.1, s * 0.38, s * 0.1, M.horn, side * s * (0.0 + k * 0.22), s * 0.95, (k - 1) * s * 0.22); }
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
  // blowhole (whales), or a dorsal fin and a toothy grin (sharks, fish)
  if (p.back.fin) {
    const fm = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 4), M.body); fm.scale.set(0.35, 1, 1.2); fm.position.set(0, b.h / 2 + 0.9, -b.len * 0.02); fm.rotation.x = -0.35; fm.castShadow = true; fm.userData.static = true; body.add(fm);
    if (p.head.teeth) for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) B(body, 0.12, 0.28, 0.16, M.white, sd * (b.w * 0.46), -b.h * 0.18, b.len * 0.2 + k * 0.28, { r: 0.02, detail: true, keep: true });
    B(body, b.w * 0.75, b.h * 0.5, b.len * 0.2, M.body, 0, -0.1, b.len * 0.42, { r: b.h * 0.2 });
  } else B(body, 0.5, 0.15, 0.3, M.accent, 0, b.h / 2, b.len * 0.28, { r: 0.05 });
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
  if (p.float) { // a ghost: no legs, a long sheet hanging from the body, its hem in tabs that wave
    J.hem = [];
    B(body, b.w * 1.02, L.len * 0.6, b.len * 1.02, M.body, 0, -L.len * 0.25, 0, { r: 0.4 });
    for (let k = 0; k < 6; k++) { const hp = pivot(body, (k - 2.5) * b.w * 0.17, -L.len * 0.55, b.len * 0.1 * Math.sin(k)); B(hp, b.w * 0.16, L.len * 0.35, b.len * 0.85, M.body, 0, -L.len * 0.17, 0, { r: 0.2 }); J.hem.push(hp); }
  } else for (const side of [-1, 1]) {
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

/** a bird standing upright (owl, pigeon, crow, gull, duck, eagle...): an egg body, folded wings that flap, two thin legs */
function buildBird(J, p, M) {
  const b = p.body, L = p.legs, body = J.body;
  const torso = pivot(body, 0, 0.2, 0); J.torso = torso; torso.rotation.x = 0.08;
  B(torso, b.w, b.h, b.len, M.body, 0, b.h / 2, 0, { r: Math.min(b.w, b.len) * 0.42 });
  B(torso, b.w * 0.72, b.h * 0.62, 0.3, M.belly, 0, b.h * 0.4, b.len / 2 - 0.05, { r: 0.3 });
  J.wings = [];
  for (const side of [-1, 1]) { const w = pivot(torso, side * b.w * 0.48, b.h * 0.85, -0.1); B(w, 0.45, b.h * 0.78, b.len * 0.85, M.accent, side * 0.22, -b.h * 0.36, 0, { r: 0.2 }); B(w, 0.3, b.h * 0.3, b.len * 0.6, M.body, side * 0.3, -b.h * 0.72, -0.2, { r: 0.12 }); J.wings.push(w); }
  J.tail = []; const tp = pivot(torso, 0, b.h * 0.12, -b.len * 0.45); B(tp, b.w * 0.6, 0.25, 1.6, M.accent, 0, 0, -0.7, { r: 0.08 }); tp.rotation.x = 0.5; J.tail.push(tp);
  buildHead(J, { ...p, neck: { len: 0, up: 0 } }, M, { x: 0, y: 0, z: 0 });
  torso.add(J.neck); J.neck.position.set(0, b.h - p.head.size * (p.head.merged ? 0.45 : 0.3), b.len * 0.05); J.head.position.set(0, p.head.size * 0.45, 0.05);
  J.legs = []; J.knees = [];
  for (const side of [-1, 1]) {
    const hip = pivot(body, side * b.w * 0.22, 0.3, 0);
    B(hip, 0.32, L.len * 0.55, 0.32, M.nose, 0, -L.len * 0.27, 0, { r: 0.08 });
    const knee = pivot(hip, 0, -L.len * 0.55, 0);
    B(knee, 0.26, L.len * 0.5, 0.26, M.nose, 0, -L.len * 0.24, 0, { r: 0.06 });
    const foot = pivot(knee, 0, -L.len * 0.5, 0);
    for (const a of [-0.5, 0, 0.5]) B(foot, 0.2, 0.18, L.foot, M.nose, Math.sin(a) * 0.4, 0.05, Math.cos(a) * L.foot * 0.45, { r: 0.05, ry: a });
    J.legs.push(hip); J.knees.push(knee);
  }
}
/** an octopus / squid: a round (or tall, pointed) mantle with big eyes, eight tentacles in chains that curl */
function buildOctopus(J, p, M) {
  const b = p.body, body = J.body, n = 8;
  B(body, b.w, b.h, b.len, M.body, 0, b.h * 0.45, 0, { r: Math.min(b.w, b.len) * 0.45 });
  if (p.shell.kind === "spike") { const c = new THREE.Mesh(new THREE.ConeGeometry(b.w * 0.5, b.h * 0.9, 4), M.body); c.position.y = b.h * 1.25; c.rotation.y = Math.PI / 4; c.castShadow = true; c.userData.static = true; body.add(c); }
  J.head = pivot(body, 0, b.h * 0.25, b.len * 0.45);
  for (const side of [-1, 1]) { B(body, b.w * 0.26, b.w * 0.3, 0.1, M.white, side * b.w * 0.22, b.h * 0.25, b.len * 0.48, { r: b.w * 0.1, cast: false }); B(body, b.w * 0.12, b.w * 0.17, 0.08, M.ink, side * b.w * 0.22, b.h * 0.24, b.len * 0.51, { r: 0.03, cast: false }); }
  J.lids = [-1, 1].map((side) => B(body, b.w * 0.28, b.w * 0.32, 0.12, M.body, side * b.w * 0.22, b.h * 0.25, b.len * 0.53, { r: 0.05, keep: true, cast: false }));
  for (const l of J.lids) l.visible = false;
  J.tents = [];
  const segs = 5, segL = (p.legs.len || 4) / segs;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + 0.2;
    const root = pivot(body, Math.sin(a) * b.w * 0.36, -b.h * 0.02, Math.cos(a) * b.len * 0.36); root.rotation.y = a;
    const chain = []; let par = root;
    for (let q = 0; q < segs; q++) { const w = Math.max(0.25, b.w * 0.16 * (1 - q * 0.15)); const sg = pivot(par, 0, q ? -segL : 0, 0); sg.rotation.x = q ? 0.22 : 0.55; B(sg, w, segL + 0.1, w, q % 2 ? M.body : M.accent, 0, -segL / 2, 0, { r: w * 0.3 }); chain.push(sg); par = sg; }
    J.tents.push(chain);
  }
}
/** the extras every giant can show: "Z z z" over a sleeper and a cargo crate (carry), hidden until used */
function buildExtras(J, p, M) {
  const zm = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#bfe6ff", emissiveIntensity: 0.6, roughness: 0.4 });
  J.zzz = pivot(J.rig, 0, 0, 0); J.zzz.visible = false;
  J.zs = [0, 1, 2].map((k) => { const z = pivot(J.zzz); const sc = 0.55 + k * 0.25; for (const [w, h, y, rz] of [[1, 0.22, 0.5, 0], [1, 0.22, -0.5, 0], [1.25, 0.2, 0, 0.9]]) { const m = new THREE.Mesh(rgeo(w * sc, h * sc, 0.18 * sc, 0.02), zm); m.position.set(0, y * sc, 0); m.rotation.z = rz; z.add(m); } return z; });
  J.cargo = pivot(J.rig, 0, 0, 0); J.cargo.visible = false;
  B(J.cargo, 2.2, 1.6, 1.6, M.wood, 0, 0, 0, { r: 0.1, keep: true });
  for (const x of [-0.75, 0.75]) B(J.cargo, 0.18, 1.65, 1.65, solid("#5a3b24", { roughness: 0.8 }), x, 0, 0, { r: 0.03, keep: true });
  B(J.cargo, 2.25, 0.18, 1.65, solid("#5a3b24", { roughness: 0.8 }), 0, 0, 0, { r: 0.03, keep: true });
}

// ------------------------------------------------------------------------------------------------ species families
// Any animal or figure the director names becomes a giant: a preset when there is one, else the closest family with its
// own look (a ghost floats, an owl stands on two legs with big eyes, a shark has a fin and teeth, a goblin is a green
// giant with pointed ears, a moose has antlers). Unknown words stay the generic quadruped, coloured from the name.
const HUMANOID = { plan: "biped", fur: false, town: "none", body: { len: 2.2, w: 3.0, h: 3.4, y: 4.6, round: 0.2 }, legs: { n: 2, len: 4.6, thick: 1.05, foot: 1.3, toes: false, knee: true }, tail: { kind: "none", len: 0 }, head: { size: 1.9, snout: 0, ears: "none", eyes: "friendly", jaw: false } };
const BIRD = { plan: "bird", fur: false, town: "none", body: { len: 3.4, w: 3.6, h: 4.4, y: 2.8, round: 0.8 }, legs: { n: 2, len: 2.6, thick: 0.3, foot: 1.0, toes: false, knee: true }, tail: { kind: "none", len: 0 }, head: { size: 2.2, snout: 0, ears: "none", eyes: "friendly", beak: true, jaw: false } };
const by1 = (k) => k.replace(/(es|s)$/, "");
const FAMILY = [
  [/^(ghost|ghosts|phantom|spirit|spectre|specter|wraith|shadow|shade|spook)$/, { ...HUMANOID, float: true, palette: { body: "#eef2f7", belly: "#ffffff", accent: "#cfd8e3", eye: "#1b1b1f", nose: "#cfd8e3" }, head: { size: 2.5, snout: 0, ears: "none", eyes: "friendly", jaw: true } }, (k) => (/shadow|shade/.test(k) ? { palette: { body: "#2b2d3a", belly: "#3a3d4f", accent: "#1c1d27", eye: "#ffd23a", glow: "#ffcc33" }, head: { eyes: "menacing" } } : {})],
  [/^(goblin|goblins|imp|gremlin|elf|gnome)$/, { ...HUMANOID, palette: { body: "#6ab04c", belly: "#a3cb38", accent: "#4a3426", eye: "#ffd23a", glow: "#ffcc33", nose: "#3d7a2a" }, head: { size: 2.3, snout: 0.35, ears: "point", eyes: "menacing", jaw: true, teeth: true, brow: true } }],
  [/^(troll|trolls|ogre|ogres)$/, { ...HUMANOID, body: { len: 2.8, w: 3.8, h: 3.6, y: 4.2, round: 0.4 }, palette: { body: "#7f8c6a", belly: "#a4a98c", accent: "#5b4a3a", eye: "#1b1b1f", nose: "#5f6b4f" }, head: { size: 2.0, snout: 0.5, ears: "round", eyes: "friendly", jaw: true, teeth: true, brow: true } }],
  [/^(yeti|yetis|bigfoot|sasquatch|ape|apes|gorilla|gorillas|monkey|monkeys)$/, { ...HUMANOID, fur: true, palette: { body: "#eef1f5", belly: "#9fb3c8", accent: "#cfd8e3", eye: "#1b1b1f", nose: "#5d6d7e" }, head: { size: 2.1, snout: 0.3, ears: "round", eyes: "friendly", jaw: true, brow: true } }, (k) => (/ape|gorilla|monkey/.test(k) ? { palette: { body: "#4a3426", belly: "#8a6a4a", accent: "#2b1d14" } } : {})],
  [/^(snowman|snowmen)$/, { ...HUMANOID, body: { len: 3.6, w: 4.0, h: 3.8, y: 3.6, round: 1.0 }, palette: { body: "#f5f8fc", belly: "#ffffff", accent: "#2d3436", eye: "#1b1b1f", nose: "#ff7f1a" }, head: { size: 2.4, snout: 0.6, ears: "none", eyes: "friendly", jaw: false } }],
  [/^(robot|robots|android|machine|boxy|mech)$/, { ...HUMANOID, palette: { body: "#9aa3ad", belly: "#dfe4ea", accent: "#57606f", eye: "#7fd8ff", glow: "#7fd8ff", nose: "#57606f" }, head: { size: 2.0, snout: 0, ears: "none", eyes: "menacing", jaw: false } }],
  [/^(alien|aliens|martian)$/, { ...HUMANOID, palette: { body: "#7bed9f", belly: "#c8f7c5", accent: "#2ed573", eye: "#1b1b1f", nose: "#2ed573" }, head: { size: 2.6, snout: 0, ears: "none", eyes: "bulge", jaw: false } }],
  [/^(scarecrow|scarecrows|zombie|zombies|mummy|mummies|vampire|vampires|witch|wizard|king|queen|knight|pirate|human|man|woman|person|people|giant|giants|titan|lifeguard|mailman|baker|clown|mermaid|statue)$/, { ...HUMANOID }, (k) => ({ scarecrow: { palette: { body: "#c0392b", belly: "#e1c699", accent: "#d4a373", nose: "#e1c699" } }, zombie: { palette: { body: "#57606f", belly: "#9ccc65", accent: "#2f3542", nose: "#7fa65a" } }, mummy: { palette: { body: "#e8dcc0", belly: "#f5edd8", accent: "#c8b996" } }, mummie: { palette: { body: "#e8dcc0", belly: "#f5edd8", accent: "#c8b996" } }, vampire: { palette: { body: "#2d3436", belly: "#f5f6fa", accent: "#c0392b" }, head: { teeth: true, jaw: true } }, statue: { palette: { body: "#9aa3ad", belly: "#bfc6ce", accent: "#7d8590" } } }[by1(k)] ?? {})],
  [/^(owl|owls)$/, { ...BIRD, palette: { body: "#8a6a4a", belly: "#e8d6b0", accent: "#5e4430", eye: "#1b1b1f", nose: "#f0a030" }, head: { size: 3.0, eyes: "owl", beak: true, ears: "point", merged: true } }],
  [/^(pigeon|pigeons|dove|crow|crows|raven|ravens|gull|gulls|seagull|seagulls|bird|birds|eagle|hawk|parrot|parrots|duck|ducks|goose|geese|chicken|chickens|hen|rooster|penguin|penguins|bat|bats|puffin)$/, { ...BIRD, palette: { body: "#8d96a3", belly: "#cfd6de", accent: "#5d6a7a", eye: "#1b1b1f", nose: "#ffb400" } }, (k) => ({ crow: { palette: { body: "#26262e", belly: "#3a3a46", accent: "#16161a" } }, raven: { palette: { body: "#26262e", belly: "#3a3a46", accent: "#16161a" } }, gull: { palette: { body: "#f5f6fa", belly: "#ffffff", accent: "#9aa3ad" } }, seagull: { palette: { body: "#f5f6fa", belly: "#ffffff", accent: "#9aa3ad" } }, duck: { palette: { body: "#ffffff", belly: "#ffffff", accent: "#dfe4ea", nose: "#ff9f1a" } }, goose: { palette: { body: "#ffffff", belly: "#ffffff", accent: "#dfe4ea", nose: "#ff9f1a" } }, geese: { palette: { body: "#ffffff", belly: "#ffffff", accent: "#dfe4ea", nose: "#ff9f1a" } }, chicken: { palette: { body: "#fbfbf5", belly: "#ffffff", accent: "#e53935", nose: "#ffb400" } }, hen: { palette: { body: "#c58b4f", belly: "#f1d6b0", accent: "#e53935" } }, eagle: { palette: { body: "#5e4430", belly: "#ffffff", accent: "#3e2c1f", nose: "#ffcc00" } }, parrot: { palette: { body: "#27ae60", belly: "#f1c40f", accent: "#c0392b", nose: "#2d3436" } }, penguin: { palette: { body: "#1e1e24", belly: "#ffffff", accent: "#1e1e24", nose: "#ff9f1a" } }, bat: { palette: { body: "#3b3442", belly: "#5a4f63", accent: "#2a2430", nose: "#3b3442" } } }[by1(k)] ?? {})],
  [/^(octopus|octopuses|octopi|squid|squids|kraken|jellyfish)$/, { plan: "octopus", fur: false, town: "none", body: { len: 4.2, w: 4.2, h: 4.4, y: 4.0, round: 1 }, legs: { n: 8, len: 4.6, thick: 0.8, foot: 0, toes: false, knee: false }, tail: { kind: "none", len: 0 }, head: { size: 0, snout: 0, ears: "none", eyes: "friendly", jaw: false }, palette: { body: "#c94f7c", belly: "#f3a6c0", accent: "#a63d63", eye: "#1b1b1f", nose: "#a63d63" } }, (k) => (/squid|kraken/.test(k) ? { body: { h: 6.0, w: 3.4, len: 3.4 }, shell: { kind: "spike" }, palette: { body: "#8e44ad", belly: "#c39bd3", accent: "#6c3483" } } : /jelly/.test(k) ? { palette: { body: "#a29bfe", belly: "#dfe6e9", accent: "#74b9ff" } } : {})],
  [/^(shark|sharks|fish|fishes|goldfish|piranha|dolphin|dolphins|tuna|eel|eels|carp)$/, { plan: "swimmer", fur: false, town: "none", body: { len: 8.4, w: 2.6, h: 2.8, y: 1.6, round: 0.8 }, head: { size: 0, snout: 0, ears: "none", eyes: "friendly", jaw: false, teeth: true }, legs: { n: 0, len: 0, thick: 0, foot: 0 }, tail: { kind: "fluke", len: 3.0 }, back: { fin: true }, palette: { body: "#7d8a99", belly: "#eef1f5", accent: "#5d6a7a", shell: "#5d6a7a", shell2: "#7d8a99", eye: "#1b1b1f", nose: "#2d3436" } }, (k) => (/shark/.test(k) ? {} : /dolphin/.test(k) ? { head: { teeth: false }, palette: { body: "#74b9ff", belly: "#eaf6ff" } } : { head: { teeth: false }, palette: { body: "#ff9f1a", belly: "#ffd8a8", accent: "#e67e22" } })],
  [/^(moose|elk|deer|reindeer|caribou|stag)$/, { head: { size: 2.0, snout: 1.1, ears: "point", horns: "antler" }, legs: { len: 3.6 }, body: { y: 3.6 }, tail: { kind: "stub", len: 0.5 }, palette: { body: "#6b4423", belly: "#a87a4f", accent: "#4a2e18", horn: "#e8d6b0", nose: "#2b1d14" } }, (k) => (/deer|reindeer|caribou|stag/.test(k) ? { palette: { body: "#b5733a", belly: "#f1d6b0" } } : {})],
  [/^(cow|cows|bull|bulls|ox|oxen|goat|goats|ram|sheep|buffalo|bison|yak)$/, { head: { size: 2.0, snout: 0.7, ears: "flop", horns: "curl" }, tail: { kind: "long", len: 1.8 }, palette: { body: "#ffffff", belly: "#ffffff", accent: "#2d3436", nose: "#ffb3c1" } }, (k) => (/goat|ram/.test(k) ? { palette: { body: "#f2ede4", accent: "#8a7a5a", nose: "#2d3436" } } : /sheep/.test(k) ? { fur: true, palette: { body: "#fbfbf8", belly: "#ffffff", accent: "#2a2a2e", nose: "#2a2a2e" }, head: { horns: "none" } } : /bison|buffalo|yak/.test(k) ? { palette: { body: "#4a2e18", belly: "#6b4423", accent: "#2b1d14", nose: "#1b1b1f" } } : {})],
  [/^(horse|horses|pony|donkey|zebra|camel|camels|giraffe|giraffes|llama|alpaca)$/, { neck: { len: 2.2, up: 1.0, w: 1.2 }, head: { size: 1.6, snout: 1.2, ears: "point" }, legs: { len: 4.0, thick: 0.8 }, body: { y: 4.2, h: 2.4 }, tail: { kind: "long", len: 2.0 }, palette: { body: "#8a5a32", belly: "#a87a4f", accent: "#3a2a1e", nose: "#2b1d14" } }, (k) => (/giraffe/.test(k) ? { neck: { len: 2.4, up: 2.2, w: 1.0 }, legs: { len: 5.0 }, body: { y: 5.2 }, palette: { body: "#f0b44c", belly: "#fbe3a8", accent: "#8a5a32" }, head: { horns: "spike" } } : /camel|llama|alpaca/.test(k) ? { palette: { body: "#d9a86c", belly: "#f1d6b0", accent: "#a87a4f" } } : /zebra/.test(k) ? { palette: { body: "#f5f6fa", accent: "#1e1e24" } } : /donkey/.test(k) ? { palette: { body: "#8e8e93", belly: "#dcdcdc" } } : {})],
  [/^(mouse|mice|rat|rats|hamster|hamsters|gerbil|squirrel|squirrels|rabbit|rabbits|bunny|bunnies|hare)$/, { head: { size: 2.2, snout: 0.5, ears: "round" }, legs: { len: 1.6, thick: 0.8 }, body: { y: 2.0, round: 1 }, tail: { kind: "long", len: 3.0 }, palette: { body: "#9aa0a8", belly: "#e9e1d3", accent: "#6d737b", nose: "#ff8fa8" } }, (k) => (/hamster|gerbil/.test(k) ? { tail: { kind: "stub", len: 0.4 }, palette: { body: "#e0a050", belly: "#fff1d6" } } : /rabbit|bunn|hare/.test(k) ? { head: { ears: "long" }, tail: { kind: "stub", len: 0.5 }, palette: { body: "#e9e1d3", belly: "#ffffff" } } : /squirrel/.test(k) ? { tail: { kind: "bush", len: 3.0 }, palette: { body: "#c0662b", belly: "#f1d6b0" } } : {})],
  [/^(lion|lions|tiger|tigers|leopard|cheetah|panther|fox|foxes|coyote|hyena|pig|pigs|hog|boar|rhino|hippo|lizard|crocodile|alligator|dinosaur|dino)$/, { head: { size: 2.0, snout: 0.8, ears: "point" }, palette: { body: "#e1a23a", belly: "#f6deb0", accent: "#8a5a32", nose: "#2b1d14" } }, (k) => (/tiger/.test(k) ? { palette: { body: "#f08a2c", belly: "#ffffff", accent: "#1e1e24" } } : /panther/.test(k) ? { palette: { body: "#26262e", belly: "#3a3a46" } } : /fox/.test(k) ? { tail: { kind: "bush", len: 2.6 }, palette: { body: "#e8691e", belly: "#ffffff" } } : /pig|hog|boar/.test(k) ? { fur: false, head: { snout: 0.4, ears: "flop" }, palette: { body: "#ffb3c1", belly: "#ffc8d3", nose: "#ff8fa8" } } : /hippo|rhino/.test(k) ? { fur: false, head: { horns: /rhino/.test(k) ? "spike" : "none", ears: "round" }, palette: { body: "#8e8e93", belly: "#b8b8bd" } } : /lizard|crocodile|alligator|dino/.test(k) ? { fur: false, head: { snout: 1.4, ears: "none", teeth: true }, tail: { kind: "spike", len: 4 }, back: { spikes: 6 }, palette: { body: "#4caf50", belly: "#c5e1a5", accent: "#2e7d32" } } : {})],
  [/^(spider|spiders|ant|ants|beetle|beetles|bee|bees|bug|bugs|cockroach|scorpion)$/, { fur: false, plan: "quadruped", head: { size: 1.4, snout: 0, ears: "none", eyes: "bulge" }, legs: { n: 6, len: 2.6, thick: 0.4, foot: 0.4, toes: false, knee: true }, tail: { kind: "none", len: 0 }, body: { len: 5.0, w: 3.6, h: 2.0, y: 2.4, round: 0.9 }, palette: { body: "#2b2530", belly: "#4a4252", accent: "#1b1b1f", eye: "#1b1b1f" } }, (k) => (/bee/.test(k) ? { palette: { body: "#ffd32a", belly: "#1b1b1f", accent: "#1b1b1f" } } : /^ant/.test(k) ? { palette: { body: "#8e2b1f", belly: "#5a1a12" } } : /spider/.test(k) ? { legs: { n: 8 } } : {})],
];
/** the family preset + its tweaks for an unknown species word (null when none fits): "river_mouth" -> mouth, "the giant snail" -> snail */
export function familyOf(kind) {
  const ws = String(kind ?? "").toLowerCase().replace(/[^a-z_ ]/g, " ").split(/[_ ]+/).filter(Boolean);
  for (const k of [...ws].reverse()) for (const [re, base, tweak] of FAMILY) if (re.test(k)) return deepMerge(base, tweak ? tweak(k) : {});
  return null;
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
  const by = p.plan === "biped" || p.plan === "bird" || p.plan === "octopus" ? p.body.y : p.plan === "slider" ? 0 : p.plan === "swimmer" ? p.body.y : p.body.y + (p.shell.kind === "dome" ? 0 : p.body.h * 0.3);
  J.body = pivot(rig, 0, by, 0);
  if (p.plan === "biped") buildBiped(J, p, M);
  else if (p.plan === "bird") buildBird(J, p, M);
  else if (p.plan === "octopus") buildOctopus(J, p, M);
  else if (p.plan === "swimmer") buildSwimmer(J, p, M);
  else if (p.plan === "slider") buildSlider(J, p, M);
  else buildQuadruped(J, p, M);
  buildExtras(J, p, M, kind);
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
  // 2026-11-05 (GAPS): any other four-legged body (a moose, a frog, a generic animal): the flat top of its back, so a
  // town "on" it stands on it (it used to sit inside the body, and the camera with it)
  if (p.plan === "quadruped") {
    const y = (g.userData.joints.body.position.y + b.h / 2 + 0.05) * unit, hw = b.w * 0.42 * unit, hl = b.len * 0.42 * unit;
    return (x, z) => (Math.abs(x) <= hw && Math.abs(z) <= hl ? y : null);
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
  for (const l of J.lids ?? []) l.visible = false;
  if (J.zzz) J.zzz.visible = false; if (J.cargo) J.cargo.visible = false;
  J.body.scale.set(1, 1, 1);
  // the gait of the giant's own body plan (a ghost or an owl walks like a biped, an octopus like a quadruped)
  const gk = PLAN_OF[U.kind] ? U.kind : plan === "biped" || plan === "bird" ? "giant_human" : plan === "swimmer" ? "whale" : plan === "slider" ? "snail" : "generic";
  const gait = gaitOf(gk, action === "run" || action === "flee" ? "run" : action === "swim" ? "swim" : "walk", U.size);
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
  // 2026-11-05 (GAPS): the new body plans' idle life: a ghost hovers and its hem waves, tentacles curl, wings settle
  if (p.float) { J.rig.position.y += 0.35 + 0.25 * Math.sin(t * 1.3); (J.hem ?? []).forEach((h, i) => { h.rotation.x += 0.18 * Math.sin(t * 2.2 + i * 0.9); }); }
  (J.tents ?? []).forEach((ch, i) => ch.forEach((sg, q) => { sg.rotation.x += 0.12 * Math.sin(t * 1.4 + i * 0.8 - q * 0.6); }));
  if (plan === "bird" && J.wings) J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * 0.04 * Math.sin(t * 1.1); });

  const legs = J.legs ?? [], knees = J.knees ?? [];
  const walkLegs = (amp, kneeAmp) => {
    if (plan === "biped" || plan === "bird") legs.forEach((l, i) => { const s = Math.sin(cyc + i * Math.PI); l.rotation.x += amp * s; knees[i].rotation.x += kneeAmp * Math.max(0, -Math.cos(cyc + i * Math.PI)); });
    else if (plan === "octopus") (J.tents ?? []).forEach((ch, i) => { const ph = cyc + (i % 2) * Math.PI; ch[0].rotation.x += amp * 0.8 * Math.sin(ph); ch[1].rotation.x += amp * 0.6 * Math.max(0, Math.cos(ph)); });
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
    case "roar": case "howl": {
      const k = ease(t / 0.35) * (opts.dur ? ease((opts.dur - t) / 0.4) : 1);
      roarPose(J, plan, legs, k, t);
      if (action === "howl") { if (J.head) J.head.rotation.x -= 0.45 * k; if (plan === "quadruped") { J.body.rotation.x -= 0.18 * k; J.body.position.y -= 0.3 * k; } }
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
    // ---------------- 2026-11-05 (GAPS): what the real stress run asked giants for
    case "reach": { // leans in and reaches toward the lens / the town: arms (or the head, a front leg, two tentacles) out
      const k = ease(t / 1.0), grab = 0.5 + 0.5 * Math.sin(t * 5);
      reachPose(J, p, plan, legs, knees, k, grab);
      break;
    }
    case "sleep": { // lies down (eyes shut, slow deep breaths) with "Z z z" rising over the head
      const k = ease(t / 0.8);
      sleepPose(J, p, plan, legs, knees, k);
      J.body.scale.set(1, 1 + 0.035 * Math.sin(t * 1.3), 1);
      for (const l of J.lids ?? []) l.visible = k > 0.3;
      showZzz(J, t);
      break;
    }
    case "lurk": { // crouched low, half hidden, head forward, swaying slowly; creeping a little
      lurkPose(J, p, plan, legs, knees, 1, t);
      break;
    }
    case "reveal": { // rises out of the crouch (1.1 s), then rears up and roars, arms spread
      lurkPose(J, p, plan, legs, knees, 1 - ease(t / 1.1), t);
      roarPose(J, plan, legs, ease((t - 0.8) / 0.4), t);
      if (plan === "swimmer") { J.body.rotation.x -= 0.35 * ease((t - 0.3) / 0.8); J.body.position.y += 1.2 * ease((t - 0.3) / 0.8); }
      break;
    }
    case "carry": { // walking with a crate in its arms (in its mouth, on its back, held up by tentacles)
      walkLegs(0.3, 0.4);
      J.body.position.y += 0.08 * Math.abs(Math.sin(cyc));
      holdCargo(J, p, plan);
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.x -= 0.8; a.rotation.z += (i ? -1 : 1) * 0.1; J.elbows[i].rotation.x -= 0.55; });
      if (plan === "bird" && J.wings) J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * 0.5; w.rotation.x -= 0.6; });
      if (plan === "octopus") J.tents.forEach((ch, i) => { if (i === 0 || i === 7) { ch[0].rotation.x -= 1.4; ch[1].rotation.x -= 0.6; } });
      if (plan === "swimmer") swim(J, t, gait);
      break;
    }
    case "eat": { // the head down to the food, the jaw chomping (bipeds: a hand to the mouth; birds peck)
      const chomp = 0.5 + 0.5 * Math.sin(t * 7), k = ease(t / 0.5);
      if (plan === "biped") { J.arms[0].rotation.x -= 0.75 * k; J.elbows[0].rotation.x -= 2.0 * k; J.torso.rotation.x += 0.1 * k; if (J.head) J.head.rotation.x += 0.12 * k; }
      else if (plan === "bird") { const pk = Math.max(0, Math.sin(t * 4)); J.torso.rotation.x += 0.75 * pk * k; if (J.head) J.head.rotation.x += 0.4 * pk; }
      else if (plan === "octopus") J.tents.forEach((ch, i) => { if (i === 0 || i === 7) { ch[0].rotation.x -= 1.2 * k; ch[1].rotation.x -= 0.9 * k; } });
      else if (plan === "swimmer") { J.body.position.z += 0.4 * chomp; J.body.rotation.x += 0.06 * chomp; }
      else { if (J.neck) J.neck.rotation.x += 0.55 * k; if (J.head) J.head.rotation.x += 0.35 * k; J.body.rotation.x += 0.1 * k; legs.forEach((l, i) => { if (i < 2) l.rotation.x -= 0.25 * k; }); }
      if (J.jaw) J.jaw.rotation.x += 0.15 + 0.45 * chomp * k;
      break;
    }
    case "fly": { // up off the ground: wings beat (birds, dragons), the rest hover with a slow bob, legs tucked
      const k = ease(t / 0.7);
      J.rig.position.y += (3.2 + 0.5 * Math.sin(t * 1.6)) * k;
      if (J.wings) J.wings.forEach((w, i) => { const s = i ? 1 : -1; w.rotation.z += s * (plan === "bird" ? 1.3 + 0.9 * Math.sin(t * 6) : 0.7 * Math.sin(t * 5)); });
      legs.forEach((l, i) => { l.rotation.x += 0.7 * k; if (knees[i]) knees[i].rotation.x += 0.6 * k; });
      J.body.rotation.x += 0.1 * k;
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.z += (i ? 1 : -1) * 0.5 * k; });
      if (plan === "octopus") J.tents.forEach((ch) => ch.forEach((sg, q) => { sg.rotation.x += (0.25 - q * 0.05) * Math.sin(t * 3 - q); }));
      break;
    }
    case "climb": { // reared up against something, front legs / arms reaching up in turn
      const a = Math.sin(t * 3);
      J.rig.rotation.x = -0.45; J.rig.position.y += 0.6;
      if (J.arms) J.arms.forEach((arm, i) => { arm.rotation.x -= 2.5 + 0.35 * (i ? a : -a); J.elbows[i].rotation.x -= 0.4; });
      else legs.forEach((l, i) => { if (i < 2) l.rotation.x -= 1.0 + 0.35 * (i ? a : -a); });
      if (plan === "biped" || plan === "bird") legs.forEach((l, i) => { l.rotation.x -= 0.4 + 0.3 * (i ? -a : a); knees[i].rotation.x += 0.5; });
      if (plan === "octopus") J.tents.forEach((ch, i) => { ch[0].rotation.x -= (i < 2 || i > 5) ? 1.2 + 0.3 * a : 0; });
      break;
    }
    case "flee": { // running away (the caller faces it away from the danger)
      walkLegs(0.6, 0.9);
      J.body.position.y += 0.25 * Math.abs(Math.sin(cyc));
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.x += 0.7 * Math.sin(cyc + (i ? 0 : Math.PI)); a.rotation.z += (i ? 1 : -1) * 0.5; });
      if (J.head) J.head.rotation.y += 0.3 * Math.sin(t * 1.5);
      if (plan === "swimmer") swim(J, t, gaitOf("whale", "swim", U.size));
      if (plan === "bird" && J.wings) J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * (0.8 + 0.6 * Math.sin(t * 7)); });
      break;
    }
    case "dig": { // head down, front paws (hands) scraping in turn
      const a = Math.max(0, Math.sin(t * 5)), b2 = Math.max(0, -Math.sin(t * 5));
      if (plan === "biped") { J.torso.rotation.x += 0.7; J.body.position.y -= 1.0; knees.forEach((kn) => { kn.rotation.x += 0.9; }); legs.forEach((l) => { l.rotation.x -= 0.6; }); J.arms[0].rotation.x -= 0.9 + 0.8 * a; J.arms[1].rotation.x -= 0.9 + 0.8 * b2; }
      else if (plan === "bird") { J.torso.rotation.x += 0.6; legs[0].rotation.x += 0.6 * a; legs[1].rotation.x += 0.6 * b2; }
      else { J.body.rotation.x += 0.15; if (J.neck) J.neck.rotation.x += 0.35; if (J.head) J.head.rotation.x += 0.25; if (legs[0]) legs[0].rotation.x -= 0.9 * a; if (legs[1]) legs[1].rotation.x -= 0.9 * b2; }
      break;
    }
    default: break; // idle: the idle life above
  }
}
/** the roar: head up, jaw wide, arms / wings spread (k 0..1) */
function roarPose(J, plan, legs, k, t) {
  if (k <= 0) return;
  const buzz = 0.03 * Math.sin(t * 40) * k;
  if (J.head) { J.head.rotation.x -= 0.45 * k + buzz; }
  if (J.neck) J.neck.rotation.x -= 0.15 * k;
  if (J.jaw) J.jaw.rotation.x += 0.75 * k;
  if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x -= (0.35 + i * 0.12) * k; });
  if (J.torso) J.torso.rotation.x -= 0.3 * k;
  // arms flung out wide and up (2026-11-05: they used to cross over the chest)
  if (J.arms) J.arms.forEach((a, i) => { a.rotation.z += (i ? 1 : -1) * 1.0 * k; a.rotation.x -= 0.5 * k; J.elbows[i].rotation.x -= 0.4 * k; });
  if (plan === "quadruped") { J.body.rotation.x -= 0.1 * k; legs.forEach((l, i) => { if (i < 2) l.rotation.x -= 0.15 * k; }); }
  (J.ears ?? []).forEach((e, i) => { e.rotation.z += (i ? -1 : 1) * 0.3 * k; });
  if (J.wings) J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * (plan === "bird" ? 1.4 : 0.6) * k; });
  (J.tents ?? []).forEach((ch, i) => { if (i < 2 || i > 5) ch[0].rotation.x -= 1.0 * k; });
}
/** crouched low and hidden (k 0..1): bipeds squat, four-legged ones press down, swimmers sink to the fin */
function lurkPose(J, p, plan, legs, knees, k, t) {
  if (k <= 0) return;
  const sway = Math.sin(t * 0.6);
  if (plan === "biped") {
    if (!p.float) { legs.forEach((l) => { l.rotation.x -= 0.75 * k; }); knees.forEach((kn) => { kn.rotation.x += 1.3 * k; }); J.body.position.y -= p.legs.len * 0.33 * k; }
    else J.body.position.y -= 1.2 * k;
    J.torso.rotation.x += 0.55 * k; J.torso.rotation.z += 0.05 * sway * k;
    if (J.head) J.head.rotation.x -= 0.4 * k;
    if (J.arms) J.arms.forEach((a, i) => { a.rotation.x -= 0.5 * k; a.rotation.z += (i ? -1 : 1) * 0.15 * k; J.elbows[i].rotation.x -= 0.5 * k; });
  } else if (plan === "bird") {
    J.body.position.y -= p.legs.len * 0.45 * k; knees.forEach((kn) => { kn.rotation.x += 1.0 * k; }); legs.forEach((l) => { l.rotation.x -= 0.5 * k; });
    J.torso.rotation.x += 0.35 * k; if (J.head) J.head.rotation.y += 0.25 * sway * k;
  } else if (plan === "swimmer") {
    J.body.position.y -= p.body.h * 0.35 * k; J.body.rotation.z += 0.03 * sway * k;
  } else if (plan === "octopus") {
    J.body.position.y -= p.legs.len * 0.45 * k; J.tents.forEach((ch) => { ch[0].rotation.x += 0.6 * k; });
  } else if (plan === "slider") {
    if (J.head) J.head.position.y -= 0.5 * k;
  } else {
    J.body.position.y -= p.legs.len * 0.35 * k; J.body.rotation.x += 0.06 * k;
    if (J.neck) J.neck.rotation.x += 0.25 * k; if (J.head) { J.head.rotation.x -= 0.25 * k; J.head.rotation.y += 0.2 * sway * k; }
    (J.legs ?? []).forEach((l, i) => { l.rotation.x += (i < 2 ? -0.35 : 0.35) * k; });
    if (J.knees && p.legs.knee) J.knees.forEach((kn) => { kn.rotation.x += 0.5 * k; });
  }
}
/** reaching toward the lens (k 0..1; grab 0..1 = the claws / fingers working) */
function reachPose(J, p, plan, legs, knees, k, grab) {
  if (plan === "biped") {
    J.torso.rotation.x += 0.55 * k; J.body.position.y -= 0.4 * k; knees.forEach((kn) => { kn.rotation.x += 0.35 * k; }); legs.forEach((l) => { l.rotation.x -= 0.2 * k; });
    J.arms.forEach((a, i) => { a.rotation.x -= (1.55 + (i ? 0.15 : 0)) * k; a.rotation.z += (i ? 1 : -1) * 0.12 * k; J.elbows[i].rotation.x -= (0.15 + 0.35 * grab) * k; });
    if (J.head) J.head.rotation.x -= 0.15 * k;
    if (J.jaw) J.jaw.rotation.x += 0.3 * k;
  } else if (plan === "bird") {
    J.torso.rotation.x += 0.6 * k; if (J.head) J.head.rotation.x -= 0.3 * k;
    J.wings.forEach((w, i) => { w.rotation.z += (i ? 1 : -1) * 1.1 * k; w.rotation.x -= 0.8 * k; });
    legs[0].rotation.x -= 0.9 * k; knees[0].rotation.x += 0.4 * grab * k;
  } else if (plan === "octopus") {
    J.body.rotation.x += 0.15 * k;
    J.tents.forEach((ch, i) => { if (i === 0 || i === 7 || i === 1) { ch[0].rotation.x -= 1.9 * k; ch[1].rotation.x -= (0.2 + 0.4 * grab) * k; ch[2].rotation.x -= 0.3 * grab * k; } });
  } else if (plan === "swimmer" || plan === "slider") {
    J.body.rotation.x += 0.12 * k; J.body.position.z += 1.2 * k;
    if (J.head) J.head.position.z += 0.6 * k;
    (J.stalks ?? []).forEach((s) => { s.rotation.x -= 0.6 * k; });
  } else {
    J.body.position.z += 0.8 * k; J.body.rotation.x += 0.12 * k;
    if (J.neck) J.neck.rotation.x += 0.2 * k; if (J.head) J.head.rotation.x -= 0.1 * k;
    if (J.jaw) J.jaw.rotation.x += (0.35 + 0.3 * grab) * k;
    if (legs[0]) legs[0].rotation.x -= (1.0 + 0.15 * grab) * k; if (knees[0] && p.legs.knee) knees[0].rotation.x -= 0.3 * k;
    if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x -= (0.45 + i * 0.1) * k; });
  }
}
/** lying down asleep (k 0..1) */
function sleepPose(J, p, plan, legs, knees, k) {
  if (plan === "biped") {
    if (p.float) { J.body.position.y -= 1.5 * k; J.torso.rotation.x += 0.5 * k; if (J.head) J.head.rotation.x += 0.4 * k; return; }
    // curled up on its side
    J.rig.rotation.z = (Math.PI / 2 - 0.08) * k; J.rig.position.y += 0.1 * k;
    legs.forEach((l) => { l.rotation.x -= 0.9 * k; }); knees.forEach((kn) => { kn.rotation.x += 1.3 * k; });
    J.arms.forEach((a, i) => { a.rotation.x -= 0.9 * k; J.elbows[i].rotation.x -= 1.2 * k; });
    if (J.head) J.head.rotation.x += 0.2 * k;
  } else if (plan === "bird") {
    J.body.position.y -= p.legs.len * 0.8 * k; knees.forEach((kn) => { kn.rotation.x += 1.6 * k; }); legs.forEach((l) => { l.rotation.x -= 0.8 * k; });
    if (J.head) J.head.rotation.x += 0.35 * k; J.torso.rotation.x += 0.1 * k;
  } else if (plan === "swimmer") {
    J.body.position.y -= 0.3 * k;
  } else if (plan === "octopus") {
    J.body.position.y -= p.legs.len * 0.6 * k; J.tents.forEach((ch) => { ch[0].rotation.x -= 0.5 * k; ch.forEach((sg, q) => { if (q) sg.rotation.x -= 0.15 * k; }); });
  } else if (plan === "slider") {
    if (J.head) { J.head.position.y -= 0.8 * k; J.head.position.z -= 0.6 * k; }
    (J.stalks ?? []).forEach((s) => { s.rotation.x += 1.0 * k; });
  } else {
    const drop = (p.legs.len ?? 2) * 0.82;
    J.body.position.y -= drop * k;
    legs.forEach((l, i) => { l.rotation.x += (i < 2 ? -1.35 : 1.35) * k; });
    if (J.neck) J.neck.rotation.x += 0.35 * k; if (J.head) { J.head.rotation.x += 0.25 * k; J.head.rotation.z += 0.25 * k; }
    if (J.tail?.length) J.tail[0].rotation.y += 0.8 * k;
    if (J.trunk) J.trunk.forEach((s) => { s.rotation.x += 0.15 * k; });
  }
}
/** "Z z z": three Zs rising and growing over the head, one after the other */
function showZzz(J, t) {
  if (!J.zzz) return;
  J.zzz.visible = true;
  const h = J.head ?? J.body;
  J.rig.updateMatrixWorld(true);
  const at = h.getWorldPosition(new THREE.Vector3()); J.rig.worldToLocal(at);
  J.zs.forEach((z, k) => { const ph = (t * 0.45 + k / 3) % 1; z.position.set(at.x + 0.8 + ph * 1.6, at.y + 1.6 + ph * 3.2, at.z); z.scale.setScalar(0.4 + ph * 0.9); z.visible = ph < 0.92; });
}
/** the cargo crate where this body plan carries things */
function holdCargo(J, p, plan) {
  const c = J.cargo; if (!c) return;
  c.visible = true;
  const b = p.body;
  let par = J.body, pos = [0, b.h / 2 + 1.0, 0];
  if (plan === "biped" && J.torso) { par = J.torso; pos = [0, b.h * 0.18, b.len / 2 + 1.5]; }
  else if (plan === "bird" && J.torso) { par = J.torso; pos = [0, b.h * 0.35, b.len / 2 + 1.0]; }
  else if (plan === "octopus") pos = [0, b.h * 0.2, b.len / 2 + 1.4];
  else if (plan === "swimmer") pos = [0, b.h / 2 + 0.85, b.len * 0.1];
  else if (plan === "slider") pos = [0, (J.shellTop ?? b.h * 4) + 0.8, -b.len * 0.08];
  else if (J.head && (p.head.size ?? 0) > 0.01) { par = J.head; const s = p.head.size; pos = [0, -s * 0.35, s * 0.55 + (p.head.snout ?? 0) + 0.6]; }
  if (c.parent !== par) par.add(c);
  c.position.set(...pos); c.rotation.set(0, 0, 0);
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
