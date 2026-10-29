// Zyvo Studio cast (our own designs, owner 2026-10-29). Built only from code, nothing borrowed:
//   creator  a blocky creator: teal beanie, round glasses, denim jacket over a white tee, headphones round the neck
//   zee      the Zyvo mascot: a hovering violet block with a dark face screen, lime pixel eyes, a lime "Z" antenna
//            and a lime thruster ring (no legs). Zyvo colours: violet #7C4DFF / #9F5CFF, lime #BEF264, ink #090A0A.
// Both have expressions (neutral, happy, sad, shocked, smug, thinking), blinks, mouth flaps (0..1 "open"),
// and arm poses (rest, point, shrug, wave, holdCard). finish: "gloss" (soft-touch plastic) or "clay" (matte).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const ZYVO = { violet: "#7C4DFF", violet2: "#9F5CFF", lime: "#BEF264", ink: "#090A0A" };
const C = (h) => new THREE.Color(h);
const rbox = (w, h, d, r = 0.06, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

function matFor(finish) {
  return (color, o = {}) => (finish === "clay"
    ? new THREE.MeshStandardMaterial({ color: C(color), roughness: 0.92, metalness: 0, ...o })
    : new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: C("#ffffff"), ...o }));
}
const glow = (color, k = 2.2) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(k), toneMapped: false });

function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

/** An arm on a shoulder pivot: rotate the pivot (x forward/back, z out to the side). */
function arm(parent, side, mat, handMat, len, thick, x, y) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, 0); parent.add(pivot);
  add(pivot, rbox(thick, len, thick, thick * 0.3), mat, 0, -len / 2, 0);
  const hand = add(pivot, rbox(thick * 0.95, thick * 0.9, thick * 0.95, thick * 0.3), handMat, 0, -len - thick * 0.35, 0);
  return { pivot, hand, side };
}
// [x, z] rotations of the shoulder pivots for each pose (left, right); side +1 = the character's left.
const POSES = {
  rest: [[0.05, 0.12], [0.05, -0.12]],
  point: [[0.05, 0.12], [-1.45, -0.25]],
  shrug: [[0.2, 0.9], [0.2, -0.9]],
  wave: [[0.05, 0.12], [0, -2.6]],
  holdCard: [[-1.1, 0.25], [-1.1, -0.25]],
  type: [[-0.95, 0.2], [-0.95, -0.2]],
};
function pose(arms, name, k = 1) {
  const p = POSES[name] ?? POSES.rest;
  arms.forEach((a, i) => { a.pivot.rotation.x = p[i][0] * k; a.pivot.rotation.z = p[i][1] * k; });
}

/* ─── the creator ─────────────────────────────────────────────────────── */

export function makeCreator({ finish = "gloss" } = {}) {
  const M = matFor(finish);
  const skin = M("#c48a64", { clearcoat: 0, roughness: 0.6 }), denim = M("#3a6fb0"), denimDark = M("#2c5590"), tee = M("#f4f1ea"),
    pants = M("#262a3a"), shoe = M("#f5f5f5"), sole = M("#c9c9cf"), hair = M("#2a1c15", { roughness: 0.8, clearcoat: 0 }),
    beanie = M("#1fb5a7", { roughness: 0.85, clearcoat: 0 }), beanieBand = M("#178f84", { roughness: 0.85, clearcoat: 0 }),
    phones = M("#e9e9f0"), phonesDark = M("#30323a"), frame = M("#141418", { roughness: 0.3 }), white = M("#ffffff", { roughness: 0.3 }),
    ink = M("#17110f", { roughness: 0.4 }), mouthIn = M("#4a1d22", { roughness: 0.7 }), tongue = M("#d4636a");
  const g = new THREE.Group(); g.name = "creator";
  const body = new THREE.Group(); g.add(body);
  // legs + shoes
  for (const s of [-1, 1]) { add(body, rbox(0.3, 0.74, 0.32, 0.06), pants, s * 0.17, 0.44, 0); add(body, rbox(0.32, 0.12, 0.44, 0.05), shoe, s * 0.17, 0.1, 0.05); add(body, rbox(0.33, 0.04, 0.45, 0.02), sole, s * 0.17, 0.03, 0.05); }
  // torso: open denim jacket over a white tee
  add(body, rbox(0.8, 0.82, 0.44, 0.09), denim, 0, 1.2, 0);
  add(body, rbox(0.3, 0.74, 0.04, 0.02), tee, 0, 1.2, 0.215);
  for (const s of [-1, 1]) { add(body, rbox(0.06, 0.74, 0.03, 0.015), denimDark, s * 0.17, 1.2, 0.225); add(body, rbox(0.12, 0.1, 0.03, 0.02), denimDark, s * 0.25, 1.32, 0.225); }
  // headphones round the neck
  const ring = add(body, new THREE.TorusGeometry(0.27, 0.045, 12, 40), phones, 0, 1.64, 0.02); ring.rotation.x = Math.PI / 2 - 0.25;
  for (const s of [-1, 1]) add(body, rbox(0.1, 0.2, 0.2, 0.05), phonesDark, s * 0.29, 1.6, 0.08);
  // arms
  const arms = [arm(body, 1, denim, skin, 0.66, 0.22, 0.52, 1.56), arm(body, -1, denim, skin, 0.66, 0.22, -0.52, 1.56)];
  // head
  const head = new THREE.Group(); head.position.set(0, 2.06, 0); body.add(head);
  add(head, rbox(0.8, 0.78, 0.76, 0.1), skin, 0, 0, 0);
  for (const s of [-1, 1]) add(head, rbox(0.08, 0.16, 0.14, 0.03), skin, s * 0.42, -0.02, 0);   // ears
  for (const s of [-1, 1]) add(head, rbox(0.06, 0.22, 0.3, 0.02), hair, s * 0.405, 0.12, -0.08); // sideburns under the beanie
  add(head, rbox(0.82, 0.2, 0.74, 0.08), hair, 0, 0.3, -0.06);                                     // hair at the back
  add(head, rbox(0.86, 0.42, 0.82, 0.2, 6), beanie, 0, 0.52, -0.02);                               // beanie: a soft dome
  add(head, rbox(0.9, 0.14, 0.86, 0.06), beanieBand, 0, 0.33, -0.02);                              // its folded band
  for (let i = -3; i <= 3; i++) add(head, rbox(0.03, 0.12, 0.02, 0.01), beanie, i * 0.11, 0.33, 0.43); // rib lines on the band
  add(head, rbox(0.1, 0.1, 0.06, 0.03), skin, 0, -0.02, 0.4);                                       // nose
  const face = new THREE.Group(); face.position.z = 0.385; head.add(face);
  const eyes = [], pupils = [], brows = [], lids = [];
  for (const s of [-1, 1]) {
    const e = add(face, rbox(0.16, 0.17, 0.02, 0.025), white, s * 0.17, 0.08, 0.005, false); eyes.push(e);
    pupils.push(add(face, rbox(0.085, 0.1, 0.02, 0.02), ink, s * 0.17, 0.07, 0.02, false));
    lids.push(add(face, rbox(0.17, 0.18, 0.03, 0.02), skin, s * 0.17, 0.08, 0.025, false));
    brows.push(add(face, rbox(0.19, 0.045, 0.03, 0.015), hair, s * 0.17, 0.24, 0.02, false));
    // round glasses: a frame around each eye and a bridge
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 36), frame); f.position.set(s * 0.17, 0.08, 0.035); face.add(f);
  }
  add(face, rbox(0.1, 0.025, 0.02, 0.01), frame, 0, 0.1, 0.035, false);
  const mouth = new THREE.Group(); mouth.position.set(0, -0.2, 0.01); face.add(mouth);
  const mouthBox = add(mouth, rbox(0.22, 0.06, 0.02, 0.02), mouthIn, 0, 0, 0, false);
  const tongueBox = add(mouth, rbox(0.14, 0.03, 0.02, 0.01), tongue, 0, -0.012, 0.004, false);
  const corners = [-1, 1].map((s) => add(mouth, rbox(0.05, 0.025, 0.02, 0.01), mouthIn, s * 0.12, 0.02, 0, false));
  lids.forEach((l) => (l.visible = false));
  return rig(g, { body, head, arms, eyes, pupils, brows, lids, mouth, mouthBox, tongueBox, corners, kind: "creator" });
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
  const violet = M(ZYVO.violet, finish === "clay" ? {} : { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), violet2 = M(ZYVO.violet2),
    screen = new THREE.MeshPhysicalMaterial({ color: C("#0b0a12"), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    lime = glow(ZYVO.lime, 1.15), limeSoft = M(ZYVO.lime, { roughness: 0.5 }), dark = M("#1b1530");
  const g = new THREE.Group(); g.name = "zee";
  const body = new THREE.Group(); g.add(body);
  add(body, rbox(1.06, 1.2, 0.9, 0.26, 6), violet, 0, 1.25, 0);
  // the face screen with lime pixel eyes and a small mouth
  const face = new THREE.Group(); face.position.set(0, 1.38, 0.43); body.add(face);
  add(face, rbox(0.84, 0.58, 0.06, 0.12), screen, 0, 0, 0, false);
  const eyes = [], pupils = [], brows = [], lids = [], happy = [];
  for (const s of [-1, 1]) {
    eyes.push(add(face, rbox(0.12, 0.19, 0.02, 0.04), lime, s * 0.19, 0.04, 0.035, false));
    // happy eyes "^": two small bars, hidden unless happy
    const h = new THREE.Group(); h.position.set(s * 0.19, 0.04, 0.035); face.add(h);
    for (const d of [-1, 1]) { const b = add(h, rbox(0.11, 0.04, 0.02, 0.015), lime, d * 0.04, 0, 0, false); b.rotation.z = -d * 0.75; }
    h.visible = false; happy.push(h);
    brows.push(add(face, rbox(0.15, 0.035, 0.02, 0.012), lime, s * 0.19, 0.2, 0.035, false));
  }
  const mouth = new THREE.Group(); mouth.position.set(0, -0.16, 0.035); face.add(mouth);
  const mouthBox = add(mouth, rbox(0.16, 0.035, 0.02, 0.012), lime, 0, 0, 0, false);
  const corners = [-1, 1].map((s) => add(mouth, rbox(0.04, 0.03, 0.02, 0.01), lime, s * 0.09, 0.02, 0, false));
  // the "Z" antenna on a short stalk (body top at y 1.85)
  add(body, new THREE.CylinderGeometry(0.035, 0.045, 0.2, 12), dark, 0, 1.94, 0);
  add(body, new THREE.SphereGeometry(0.06, 16, 12), dark, 0, 2.04, 0);
  const zg = new THREE.ExtrudeGeometry(zShape(0.36), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); zg.center();
  const antenna = add(body, zg, new THREE.MeshPhysicalMaterial({ color: C(ZYVO.lime), emissive: C(ZYVO.lime), emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1 }), 0, 2.27, 0); antenna.rotation.z = -0.1;
  // small arms with lime mitts
  const arms = [arm(body, 1, violet2, limeSoft, 0.42, 0.2, 0.62, 1.42), arm(body, -1, violet2, limeSoft, 0.42, 0.2, -0.62, 1.42)];
  // a short thruster under the body with a lime ring, and the ring's glow on the floor
  add(body, new THREE.CylinderGeometry(0.3, 0.22, 0.14, 32), dark, 0, 0.6, 0);
  const ringMesh = add(body, new THREE.TorusGeometry(0.27, 0.04, 12, 48), lime, 0, 0.53, 0, false); ringMesh.rotation.x = Math.PI / 2;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ map: radial("#BEF264"), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.012; g.add(pool);
  return rig(g, { body, head: face, arms, eyes, pupils, brows, lids, happy, mouth, mouthBox, corners, kind: "zee", hover: 0.18 });
}

export function radial(color, inner = 0, px = 128) {
  const c = document.createElement("canvas"); c.width = c.height = px; const x = c.getContext("2d");
  const gr = x.createRadialGradient(px / 2, px / 2, inner, px / 2, px / 2, px / 2); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, px, px); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ─── expressions, mouth, blink, idle ─────────────────────────────────── */

// brow: [y offset, tilt (inner end up > 0)], pupils: [x, y], mouth: [width, open height, corner lift]
const EXPR = {
  neutral: { brow: [0, 0], pupil: [0, 0], mouth: [1, 0, 0] },
  happy: { brow: [0.02, -0.1], pupil: [0, 0.005], mouth: [1.15, 0.4, 0.03], happyEyes: true },
  sad: { brow: [-0.01, 0.35], pupil: [0, -0.02], mouth: [0.8, 0, -0.03] },
  shocked: { brow: [0.05, 0.1], pupil: [0, 0.01], mouth: [0.75, 1, 0], wide: true },
  smug: { brow: [0.025, 0.12], pupil: [0.02, 0], mouth: [1.05, 0.1, 0.025], half: true, tilt: -0.08 },
  thinking: { brow: [0.03, 0.15], pupil: [0.025, 0.03], mouth: [0.6, 0, -0.01], tilt: 0.06 },
};

function rig(g, p) {
  const base = { brows: p.brows.map((b) => b.position.y), pupils: p.pupils.map((q) => [q.position.x, q.position.y]), eyes: p.eyes.map((e) => e.scale.y) };
  let expr = EXPR.neutral, openK = 0;
  const api = {
    group: g, parts: p,
    expr(name) {
      expr = EXPR[name] ?? EXPR.neutral;
      p.brows.forEach((b, i) => { const s = i === 0 ? 1 : -1; b.position.y = base.brows[i] + expr.brow[0]; b.rotation.z = s * expr.brow[1]; });
      p.pupils.forEach((q, i) => { q.position.x = base.pupils[i][0] + expr.pupil[0]; q.position.y = base.pupils[i][1] + expr.pupil[1]; });
      const happyEyes = Boolean(expr.happyEyes) && p.kind === "zee";
      p.eyes.forEach((e) => { e.visible = !happyEyes; e.scale.y = expr.wide ? 1.15 : expr.half ? 0.6 : 1; });
      (p.happy ?? []).forEach((h) => (h.visible = happyEyes));
      if (p.kind === "zee") p.brows.forEach((b) => (b.visible = !happyEyes));
      if (p.kind === "creator" && expr.happyEyes) p.eyes.forEach((e) => (e.scale.y = 0.75));
      p.head.rotation.z = expr.tilt ?? 0;
      api.mouth(openK);
      return api;
    },
    /** 0 = closed, 1 = wide open (driven by voice loudness). */
    mouth(k) {
      openK = Math.max(0, Math.min(1, k));
      const [w, base0, lift] = expr.mouth, open = Math.max(openK, base0);
      p.mouthBox.scale.set(w * (1 - 0.25 * open), 1 + open * (p.kind === "zee" ? 3.2 : 2.6), 1);
      p.mouthBox.position.y = -open * 0.03;
      // the tongue rests on the bottom of the open mouth, a little narrower than the opening
      if (p.tongueBox) {
        const h = 0.06 * (1 + open * 2.6), w0 = 0.22 * w * (1 - 0.25 * open);
        p.tongueBox.visible = open > 0.45; p.tongueBox.scale.set((w0 * 0.75) / 0.14, 1, 1); p.tongueBox.position.y = -open * 0.03 - h / 2 + 0.024;
      }
      p.corners.forEach((c, i) => { c.visible = Math.abs(lift) > 0.005 && open < 0.3; c.position.x = (i === 0 ? -1 : 1) * 0.11 * w; c.position.y = lift; });
      return api;
    },
    blink(k) { // 0 open .. 1 closed
      p.eyes.forEach((e) => (e.scale.y = Math.max(0.08, 1 - k)));
      p.pupils.forEach((q) => (q.visible = k < 0.6));
      return api;
    },
    pose(name, k) { pose(p.arms, name, k); return api; },
    /** Idle life: a slow bob and breathing; Zee hovers. t in seconds. */
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
