// Zyvo Studio cast (our own designs, owner 2026-10-29). Built only from code, nothing borrowed:
//   creator  a blocky creator: teal beanie, round glasses, denim jacket over a white tee, headphones round the neck
//   zee      the Zyvo mascot: a hovering violet block with a dark face screen, lime pixel eyes, a lime "Z" antenna
//            and a lime thruster ring (no legs). Zyvo colours: violet #7C4DFF / #9F5CFF, lime #BEF264, ink #090A0A.
// Both: 6 expressions that read at phone size (neutral, happy, sad, shocked, smug, thinking), blinks, a talking
// mouth driven by voice loudness (0..1) that replaces the expression's mouth while speaking, and arm poses.
// finish: "gloss" (soft-touch plastic) or "clay" (matte). Zee keeps a soft lavender rim (fresnel) on any stage.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const ZYVO = { violet: "#7C4DFF", violet2: "#9F5CFF", lime: "#BEF264", ink: "#090A0A" };
export const EXPRESSIONS = ["neutral", "happy", "sad", "shocked", "smug", "thinking"];
const C = (h) => new THREE.Color(h);
const rbox = (w, h, d, r = 0.06, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

function matFor(finish) {
  return (color, o = {}) => (finish === "clay"
    ? new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.92, metalness: 0, ...o })
    : new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: C("#ffffff"), ...o }));
}
const glow = (color, k = 1.15) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(k), toneMapped: false });
/** A soft fresnel rim on a material, so a dark-on-dark silhouette still reads. */
function rim(mat, color = "#c9b8ff", k = 0.55, power = 2.6) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rimCol = { value: C(color) }; sh.uniforms.rimK = { value: k };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 rimCol; uniform float rimK;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});
        totalEmissiveRadiance += rimCol * fr * rimK;`);
  };
  return mat;
}

function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
/** A flat curved band: a smile (bend > 0) or a frown (bend < 0), width w, thickness th. */
function bandGeo(w, bend, th = 0.035, depth = 0.02) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.quadraticCurveTo(0, -2 * bend, w / 2, 0);
  s.lineTo(w / 2 - th * 0.3, th); s.quadraticCurveTo(0, -2 * bend + th * 1.6, -w / 2 + th * 0.3, th); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, bend * 0.6, -depth / 2); return g;
}
/** A filled D-shape mouth (an open smile), width w, height h. */
function grinGeo(w, h, depth = 0.02) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.quadraticCurveTo(w / 2, -h * 1.3, 0, -h); s.quadraticCurveTo(-w / 2, -h * 1.3, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, h / 2, -depth / 2); return g;
}

/** An arm on a shoulder pivot: rotate the pivot (x forward/back, z out to the side). */
function arm(parent, side, mat, handMat, len, thick, x, y) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
  add(pivot, rbox(thick, len, thick, thick * 0.3), mat, 0, -len / 2, 0);
  const hand = add(pivot, rbox(thick * 0.95, thick * 0.9, thick * 0.95, thick * 0.3), handMat, 0, -len - thick * 0.35, 0);
  return { pivot, hand, side };
}
// [x, z] rotations of the shoulder pivots for each pose: [the character's left arm, right arm].
export const POSES = {
  rest: [[0.05, 0.12], [0.05, -0.12]],
  point: [[0.05, 0.12], [-1.45, -0.25]],
  pointUp: [[0.05, 0.12], [-0.5, -2.2]],
  pointUpL: [[-0.5, 2.2], [0.05, -0.12]],   // the other arm: points up to the character's left (the viewer's right)
  shrug: [[0.3, 0.6], [0.3, -0.6]],          // kept narrow: hands stay inside a close-up
  handsUp: [[-2.55, 0.45], [-2.55, -0.45]],   // raised FORWARD: in and out of the pose the hands stay inside a close-up
  wave: [[0.05, 0.12], [-2.5, -0.5]],   // a forward wave: the arm never swings out to the frame edge
  holdCard: [[-1.1, 0.25], [-1.1, -0.25]],
  type: [[-0.95, 0.2], [-0.95, -0.2]],
  chin: [[0.05, 0.12], [-1.9, 0.55]],
};

/* ─── the creator ─────────────────────────────────────────────────────── */

export function makeCreator({ finish = "gloss" } = {}) {
  const M = matFor(finish);
  const skin = M("#c48a64", { clearcoat: 0, roughness: 0.6 }), denim = M("#3a6fb0"), denimDark = M("#2c5590"), tee = M("#f4f1ea"),
    pants = M("#262a3a"), shoe = M("#f5f5f5"), sole = M("#c9c9cf"), hair = M("#2a1c15", { roughness: 0.8, clearcoat: 0 }),
    beanie = M("#1fb5a7", { roughness: 0.85, clearcoat: 0 }), beanieBand = M("#178f84", { roughness: 0.85, clearcoat: 0 }),
    phones = M("#e9e9f0"), phonesDark = M("#30323a"), frame = M("#141418", { roughness: 0.3 }), white = M("#ffffff", { roughness: 0.3 }),
    ink = M("#17110f", { roughness: 0.4 }), mouthIn = M("#4a1d22", { roughness: 0.7 }), tongue = M("#d4636a"), blush = M("#e07a6e", { transparent: true, opacity: 0.55 });
  const g = new THREE.Group(); g.name = "creator";
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) { add(body, rbox(0.3, 0.74, 0.32, 0.06), pants, s * 0.17, 0.44, 0); add(body, rbox(0.32, 0.12, 0.44, 0.05), shoe, s * 0.17, 0.1, 0.05); add(body, rbox(0.33, 0.04, 0.45, 0.02), sole, s * 0.17, 0.03, 0.05); }
  add(body, rbox(0.8, 0.82, 0.44, 0.09), denim, 0, 1.2, 0);
  add(body, rbox(0.3, 0.74, 0.04, 0.02), tee, 0, 1.2, 0.215);
  for (const s of [-1, 1]) { add(body, rbox(0.06, 0.74, 0.03, 0.015), denimDark, s * 0.17, 1.2, 0.225); add(body, rbox(0.12, 0.1, 0.03, 0.02), denimDark, s * 0.25, 1.32, 0.225); }
  const ring = add(body, new THREE.TorusGeometry(0.27, 0.045, 12, 40), phones, 0, 1.64, 0.02); ring.rotation.x = Math.PI / 2 - 0.25;
  for (const s of [-1, 1]) add(body, rbox(0.1, 0.2, 0.2, 0.05), phonesDark, s * 0.29, 1.6, 0.08);
  const arms = [arm(body, 1, denim, skin, 0.66, 0.22, 0.52, 1.56), arm(body, -1, denim, skin, 0.66, 0.22, -0.52, 1.56)];
  const head = new THREE.Group(); head.position.set(0, 2.06, 0); body.add(head);
  add(head, rbox(0.8, 0.78, 0.76, 0.1), skin, 0, 0, 0);
  for (const s of [-1, 1]) add(head, rbox(0.08, 0.16, 0.14, 0.03), skin, s * 0.42, -0.02, 0);
  for (const s of [-1, 1]) add(head, rbox(0.06, 0.22, 0.3, 0.02), hair, s * 0.405, 0.12, -0.08);
  add(head, rbox(0.82, 0.2, 0.74, 0.08), hair, 0, 0.3, -0.06);
  add(head, rbox(0.86, 0.42, 0.82, 0.2, 6), beanie, 0, 0.52, -0.02);
  add(head, rbox(0.9, 0.14, 0.86, 0.06), beanieBand, 0, 0.33, -0.02);
  for (let i = -3; i <= 3; i++) add(head, rbox(0.03, 0.12, 0.02, 0.01), beanie, i * 0.11, 0.33, 0.43);
  add(head, rbox(0.1, 0.1, 0.06, 0.03), skin, 0, -0.02, 0.4);
  const face = new THREE.Group(); face.position.z = 0.385; head.add(face);
  const eyes = [], pupils = [], brows = [], lids = [];
  for (const s of [-1, 1]) {
    eyes.push(add(face, rbox(0.16, 0.17, 0.02, 0.025), white, s * 0.17, 0.08, 0.005, false));
    pupils.push(add(face, rbox(0.085, 0.1, 0.02, 0.02), ink, s * 0.17, 0.07, 0.02, false));
    const lid = add(face, rbox(0.18, 0.1, 0.03, 0.02), skin, s * 0.17, 0.16, 0.028, false); lid.visible = false; lids.push(lid);
    brows.push(add(face, rbox(0.21, 0.06, 0.03, 0.02), hair, s * 0.17, 0.25, 0.03, false));
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 36), frame); f.position.set(s * 0.17, 0.08, 0.035); face.add(f);
  }
  add(face, rbox(0.1, 0.025, 0.02, 0.01), frame, 0, 0.1, 0.035, false);
  const cheeks = [-1, 1].map((s) => { const c = add(face, rbox(0.1, 0.05, 0.01, 0.02), blush, s * 0.26, -0.1, 0.012, false); c.visible = false; return c; });
  // mouths: one per expression, plus the talking mouth (an opening that grows with loudness)
  const mouth = new THREE.Group(); mouth.position.set(0, -0.2, 0.012); face.add(mouth);
  const shapes = {
    neutral: add(mouth, rbox(0.17, 0.035, 0.02, 0.015), mouthIn, 0, 0, 0, false),
    happy: add(mouth, grinGeo(0.26, 0.11), mouthIn, 0, 0.0, 0, false),
    sad: add(mouth, bandGeo(0.2, -0.05, 0.035), mouthIn, 0, -0.01, 0, false),
    shocked: add(mouth, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 32), mouthIn, 0, -0.02, 0, false),
    smug: add(mouth, bandGeo(0.18, 0.035, 0.032), mouthIn, 0.04, 0, 0, false),
    thinking: add(mouth, rbox(0.1, 0.03, 0.02, 0.012), mouthIn, 0.07, -0.005, 0, false),
  };
  shapes.shocked.rotation.x = Math.PI / 2; shapes.shocked.scale.set(1, 1, 1.3); shapes.smug.rotation.z = 0.18;
  const talk = add(mouth, rbox(0.2, 0.06, 0.02, 0.025), mouthIn, 0, 0, 0, false);
  const tongueBox = add(mouth, rbox(0.12, 0.03, 0.02, 0.012), tongue, 0, 0, 0.006, false);
  const happyTongue = add(shapes.happy, rbox(0.12, 0.035, 0.02, 0.012), tongue, 0, -0.07, 0.01, false);
  return rig(g, { body, head, arms, eyes, pupils, brows, lids, cheeks, mouth, shapes, talk, tongueBox, happyTongue, kind: "creator", eyeH: 0.08 });
}

/* ─── Zee, the Zyvo mascot ────────────────────────────────────────────── */

export function zShape(size = 1, t = 0.27) {
  const s = new THREE.Shape(), k = 0.05;
  const P = [[0, 1], [1, 1], [1, 1 - t], [t + k, t], [1, t], [1, 0], [0, 0], [0, t], [1 - t - k, 1 - t], [0, 1 - t]];
  s.moveTo((P[0][0] - 0.5) * size, (P[0][1] - 0.5) * size);
  for (const [x, y] of P.slice(1)) s.lineTo((x - 0.5) * size, (y - 0.5) * size);
  return s;
}

export function makeZee({ finish = "gloss" } = {}) {
  const M = matFor(finish);
  const violet = rim(M(ZYVO.violet, finish === "clay" ? {} : { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 })), violet2 = rim(M(ZYVO.violet2), "#d8ccff", 0.45),
    screen = new THREE.MeshPhysicalMaterial({ color: C("#0b0a12"), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    lime = glow(ZYVO.lime), tear = glow("#7dd3fc", 1.2), limeSoft = M(ZYVO.lime, { roughness: 0.5 }), dark = M("#1b1530");
  const g = new THREE.Group(); g.name = "zee";
  const body = new THREE.Group(); g.add(body);
  add(body, rbox(1.06, 1.2, 0.9, 0.26, 6), violet, 0, 1.25, 0);
  const face = new THREE.Group(); face.position.set(0, 1.38, 0.43); body.add(face);
  add(face, rbox(0.84, 0.58, 0.06, 0.12), screen, 0, 0, 0, false);
  // Every expression is its own set of lime pixels, so the six read clearly at phone size.
  const Z = 0.036, P = (w, h, x, y, mat = lime, rz = 0) => { const m = new THREE.Mesh(rbox(w, h, 0.02, Math.min(w, h) * 0.3), mat); m.position.set(x, y, Z); m.rotation.z = rz; return m; };
  const ring = (r, x, y, tube = 0.022) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 40), lime); m.position.set(x, y, Z); return m; };
  const set = (...meshes) => { const s = new THREE.Group(); meshes.forEach((m) => s.add(m)); face.add(s); s.visible = false; return s; };
  const caret = (x, y, up = 1) => [P(0.1, 0.035, x - 0.035, y, lime, up * 0.75), P(0.1, 0.035, x + 0.035, y, lime, -up * 0.75)];
  const eyeSets = {
    neutral: set(P(0.11, 0.18, -0.19, 0.04), P(0.11, 0.18, 0.19, 0.04)),
    happy: set(...caret(-0.19, 0.05), ...caret(0.19, 0.05)),
    sad: set(P(0.11, 0.08, -0.19, -0.01), P(0.11, 0.08, 0.19, -0.01), P(0.13, 0.03, -0.2, 0.09, lime, 0.4), P(0.13, 0.03, 0.2, 0.09, lime, -0.4), P(0.035, 0.05, -0.15, -0.1, tear), P(0.03, 0.03, -0.15, -0.15, tear)),
    shocked: set(ring(0.085, -0.19, 0.04), ring(0.085, 0.19, 0.04), P(0.035, 0.035, -0.19, 0.04), P(0.035, 0.035, 0.19, 0.04)),
    smug: set(P(0.12, 0.06, -0.19, 0.0), P(0.12, 0.06, 0.19, 0.0), P(0.14, 0.03, -0.19, 0.07), P(0.14, 0.035, 0.2, 0.2, lime, 0.25)),
    thinking: set(P(0.09, 0.09, -0.15, 0.09), P(0.09, 0.09, 0.23, 0.09), P(0.13, 0.03, 0.23, 0.19, lime, 0.2), P(0.03, 0.03, 0.29, -0.18), P(0.03, 0.03, 0.34, -0.18), P(0.03, 0.03, 0.39, -0.18)),
  };
  const mouthSets = {
    neutral: set(P(0.16, 0.035, 0, -0.17)),
    happy: set(P(0.18, 0.06, 0, -0.17), P(0.04, 0.035, -0.11, -0.13), P(0.04, 0.035, 0.11, -0.13)),
    sad: set(P(0.14, 0.035, 0, -0.17), P(0.04, 0.035, -0.09, -0.2), P(0.04, 0.035, 0.09, -0.2)),
    shocked: set(ring(0.05, 0, -0.17, 0.018)),
    smug: set(P(0.12, 0.035, 0.04, -0.17), P(0.04, 0.035, 0.12, -0.13)),
    thinking: set(P(0.07, 0.035, 0.07, -0.17)),
  };
  const talk = P(0.16, 0.05, 0, -0.17); face.add(talk);
  add(body, new THREE.CylinderGeometry(0.035, 0.045, 0.2, 12), dark, 0, 1.94, 0);
  add(body, new THREE.SphereGeometry(0.06, 16, 12), dark, 0, 2.04, 0);
  const zg = new THREE.ExtrudeGeometry(zShape(0.36), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); zg.center();
  const antenna = add(body, zg, new THREE.MeshPhysicalMaterial({ color: C(ZYVO.lime), emissive: C(ZYVO.lime), emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1 }), 0, 2.27, 0); antenna.rotation.z = -0.1;
  const arms = [arm(body, 1, violet2, limeSoft, 0.42, 0.2, 0.62, 1.42), arm(body, -1, violet2, limeSoft, 0.42, 0.2, -0.62, 1.42)];
  add(body, new THREE.CylinderGeometry(0.3, 0.22, 0.14, 32), dark, 0, 0.6, 0);
  const ringMesh = add(body, new THREE.TorusGeometry(0.27, 0.04, 12, 48), lime, 0, 0.53, 0, false); ringMesh.rotation.x = Math.PI / 2;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: radial("#BEF264"), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.012; g.add(pool);
  return rig(g, { body, head: face, arms, eyeSets, mouthSets, talk, kind: "zee", hover: 0.18, antenna });
}

export function radial(color, inner = 0, px = 128) {
  const c = document.createElement("canvas"); c.width = c.height = px; const x = c.getContext("2d");
  const gr = x.createRadialGradient(px / 2, px / 2, inner, px / 2, px / 2, px / 2); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, px, px); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ─── expressions, mouth, blink, idle ─────────────────────────────────── */

// The creator's faces: brows [y offset, tilt (inner end up > 0), one-brow raise], pupils [x, y], eye scale y,
// lids (droop), cheeks, head tilt. Strong on purpose: they must read on a phone.
const CREATOR_EXPR = {
  neutral: { brow: [0, 0, 0], pupil: [0, 0], eye: 1 },
  happy: { brow: [0.04, -0.15, 0], pupil: [0, 0.01], eye: 0.55, cheeks: true },
  sad: { brow: [-0.02, 0.55, 0], pupil: [0, -0.025], eye: 0.9, lids: 0.45, tilt: 0.06 },
  shocked: { brow: [0.08, 0.15, 0], pupil: [0, 0.01], eye: 1.3, pupilScale: 0.7 },
  smug: { brow: [0.0, -0.1, 0.07], pupil: [0.03, -0.01], eye: 0.7, lids: 0.3, tilt: -0.08 },
  thinking: { brow: [0.02, 0.2, 0.06], pupil: [0.035, 0.04], eye: 1, tilt: 0.09 },
};

function rig(g, p) {
  const isZee = p.kind === "zee";
  const base = isZee ? null : { brows: p.brows.map((b) => b.position.y), pupils: p.pupils.map((q) => [q.position.x, q.position.y]) };
  let name = "neutral", openK = 0, blinkK = 0;
  const applyEyes = () => {
    if (isZee) {
      for (const [k, s] of Object.entries(p.eyeSets)) { s.visible = k === name; s.scale.y = k === name ? Math.max(0.1, 1 - blinkK) : 1; }
      return;
    }
    const e = CREATOR_EXPR[name];
    p.eyes.forEach((m) => (m.scale.set(e.eye > 1 ? e.eye : 1, Math.max(0.08, e.eye * (1 - blinkK)), 1)));
    p.pupils.forEach((q, i) => { q.visible = blinkK < 0.6; q.scale.setScalar(e.pupilScale ?? 1); q.position.x = base.pupils[i][0] + e.pupil[0]; q.position.y = base.pupils[i][1] + e.pupil[1]; });
    p.lids.forEach((l, i) => { const k = Math.max(e.lids ?? 0, blinkK); l.visible = k > 0.02; l.scale.y = 0.4 + k * 1.4; l.position.y = 0.17 - k * 0.06; l.rotation.z = name === "sad" ? (i === 0 ? 0.25 : -0.25) : 0; });
  };
  const api = {
    group: g, parts: p, get expression() { return name; },
    expr(n) {
      name = EXPRESSIONS.includes(n) ? n : "neutral";
      if (!isZee) {
        const e = CREATOR_EXPR[name];
        p.brows.forEach((b, i) => { const s = i === 0 ? -1 : 1; b.position.y = base.brows[i] + e.brow[0] + (i === 0 ? e.brow[2] : 0); b.rotation.z = s * e.brow[1]; });
        p.cheeks.forEach((c) => (c.visible = Boolean(e.cheeks)));
        p.head.rotation.z = e.tilt ?? 0;
      }
      applyEyes(); api.mouth(openK);
      return api;
    },
    /** 0 = closed (the expression's own mouth) .. 1 = wide open while speaking. */
    mouth(k) {
      openK = Math.max(0, Math.min(1, k));
      const talking = openK > 0.08;
      const shapes = isZee ? p.mouthSets : p.shapes;
      for (const [n, s] of Object.entries(shapes)) s.visible = !talking && n === name;
      p.talk.visible = talking;
      if (isZee) { p.talk.scale.set(1 - 0.3 * openK, 1 + openK * 2.4, 1); return api; }
      const h = 0.06 * (1 + openK * 2.4), w = name === "happy" ? 1.15 : name === "shocked" ? 0.7 : 1;
      p.talk.scale.set(w * (1 - 0.2 * openK), 1 + openK * 2.4, 1); p.talk.position.y = -openK * 0.03;
      p.tongueBox.visible = talking && openK > 0.45; p.tongueBox.scale.x = w * 0.9; p.tongueBox.position.y = -openK * 0.03 - h / 2 + 0.024;
      return api;
    },
    blink(k) { blinkK = Math.max(0, Math.min(1, k)); applyEyes(); return api; },
    pose(n, k = 1) { const P = POSES[n] ?? POSES.rest; p.arms.forEach((a, i) => { a.pivot.rotation.x = P[i][0] * k; a.pivot.rotation.z = P[i][1] * k; }); return api; },
    /** Blend two poses (a gesture moving in): f 0 = a, 1 = b. */
    poseMix(a, b, f) { const A = POSES[a] ?? POSES.rest, B = POSES[b] ?? POSES.rest; p.arms.forEach((m, i) => { m.pivot.rotation.x = A[i][0] + (B[i][0] - A[i][0]) * f; m.pivot.rotation.z = A[i][1] + (B[i][1] - A[i][1]) * f; }); return api; },
    idle(t, phase = 0) {
      const b = Math.sin((t + phase) * 2.1);
      p.body.position.y = (p.hover ?? 0) + (p.hover ? b * 0.05 : Math.abs(b) * 0.012);
      p.body.rotation.z = Math.sin((t + phase) * 1.3) * 0.015;
      return api;
    },
  };
  api.expr("neutral").pose("rest");
  return api;
}
