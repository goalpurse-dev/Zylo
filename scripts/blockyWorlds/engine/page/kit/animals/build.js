// Blocky Worlds ANIMALS (BLOCKY-ANIMALS agent, 2026-11-06): the builder of the blocky animal kit. One data-driven
// builder per body plan (page/kit/animals/species.js holds the data), chunky rounded boxes in the locked look (like
// page/kit/people.js), procedural textures (textures.js), big expressive eyes, and a joint hierarchy for animate.js.
//
//   makeAnimal(spec) -> Group     spec: { species | kind (any alias: "puppy", "geese", "walrus"), variant?, size? (m:
//                                 overall length, or height for ref "height" plans; default the species' life size),
//                                 expr? (neutral|angry|scared|happy|sleepy), params? (spec overrides) }
//                                 origin on the ground under the body, faces +z (like people.js and giants.js)
//   solveLeg(J, leg, target, toe) 2-bone IK of one leg to a rig-space ankle target (feet planted, flat on the ground)
//
// userData: { kind: "animal", species, variant, plan, spec, size, unit, height, length, width, joints, rest, legs,
//             details, focus, params (giants.js-compatible: plan/body/shell/back for giantSurface + back towns), rigV2 }
// Joints (design units, rig scaled by unit): rig -> body -> neck -> head -> jaw | ears[] | eyes[] ; legs[] (hip) ->
// knees[] -> feet[] ; tail[] chain ; wings[] -> wingTips[] ; arms[] -> elbows[] ; spine[] (fish, snake, seal, snail) ;
// fins[] ; tents[][] (octopus arms) ; stalks[] (snail) ; antennae[] ; trunk[] ; tongue ; shell ; gaster ; hood
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { resolveAnimal, specFor, mergeSpec } from "./species.js";
import { animalMat, flatMat, spiralMat } from "./textures.js";
import { rng, hashSeed } from "../../../lib/rng.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const GEO = new Map();
const r3 = (v) => Math.round(v * 1000) / 1000;
function rgeo(w, h, d, r) {
  const k = `${r3(w)},${r3(h)},${r3(d)},${r3(r)}`;
  let g = GEO.get(k);
  if (!g) { const rr = Math.min(r, Math.min(w, h, d) * 0.45); g = rr > 0.01 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d); GEO.set(k, g); }
  return g;
}
/** a chunky block under a joint */
function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(rgeo(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d), o.r ?? Math.min(w, h, d) * 0.16), mat);
  m.position.set(x, y, z); m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.castShadow = o.cast ?? true; m.receiveShadow = true; if (o.detail) m.userData.detail = true;
  parent.add(m); return m;
}
const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const UP = V(0, 1, 0);
/** a block from p0 to p1 (a rod: horns, antlers, toes, antennae), square section t */
function rod(parent, p0, p1, t, mat, o = {}) {
  const d = V().subVectors(p1, p0), L = d.length();
  const m = new THREE.Mesh(rgeo(t, L + t * 0.5, t * (o.flat ?? 1), o.r ?? t * 0.25), mat);
  m.position.copy(p0).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true; m.receiveShadow = true; if (o.detail) m.userData.detail = true;
  parent.add(m); return m;
}
/** a chain of rods through points with a tapering thickness (t0 -> t1) */
function rods(parent, pts, t0, t1, mat, o = {}) { for (let i = 0; i < pts.length - 1; i++) rod(parent, pts[i], pts[i + 1], t0 + (t1 - t0) * (i / Math.max(1, pts.length - 2)), mat, o); }
/** a square pyramid (ears, spikes, fins) of base b and height h, pointing +y */
function pyramid(parent, b, h, mat, x = 0, y = 0, z = 0, o = {}) {
  const k = `pyr${r3(b)},${r3(h)}`;
  let g = GEO.get(k);
  if (!g) { g = new THREE.ConeGeometry(b * 0.7071, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); GEO.set(k, g); }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  if (o.sz) m.scale.z = o.sz; if (o.sx) m.scale.x = o.sx;
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const lum = (c) => { const k = new THREE.Color(c); return 0.3 * k.r + 0.59 * k.g + 0.11 * k.b; };
const dk = (c, k) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

// ------------------------------------------------------------------------------------------------ materials
function mats(S) {
  const c = S.c, tx = S.tex ?? "plain";
  const m = (col, kind = tx) => animalMat(col, kind);
  return {
    m, body: m(c.body), belly: m(c.belly ?? c.body), accent: m(c.accent ?? dk(c.body, 0.7)),
    nose: flatMat(c.nose ?? "#1b1b1f", { roughness: 0.3 }), white: flatMat("#ffffff", { roughness: 0.22 }), pupil: flatMat("#121216", { roughness: 0.15 }),
    iris: c.iris ? (S.eyes?.glow ? flatMat(c.iris, { emissive: c.glow ?? c.iris, emissiveIntensity: 1.4 }) : flatMat(c.iris, { roughness: 0.25 })) : null,
    inner: flatMat(c.inner ?? "#f4a9b8", { roughness: 0.7 }), mouth: flatMat(c.mouth ?? "#7a2030", { roughness: 0.6 }), tongue: flatMat(c.tongue ?? "#ff7a8a", { roughness: 0.5 }),
    teeth: flatMat("#fbf8ee", { roughness: 0.35 }), horn: animalMat(c.horn ?? "#efe4c8", "short"), hoof: flatMat(c.hoof ?? "#2a2420", { roughness: 0.5 }),
    dark: flatMat("#1e1e22", { roughness: 0.5 }),
  };
}

// ------------------------------------------------------------------------------------------------ eyes
/**
 * an eye at pos (head space) with a protrusion direction dir (x: side component 0..1, z: front 0..1). Built of a white,
 * an iris + pupil, a glint, an upper and a lower lid (head colour; scaled by the expression) and a brow.
 */
function eye(J, parent, side, s, pos, dir, M, S, lidMat, o = {}) {
  const E = pivot(parent, pos.x, pos.y, pos.z);
  const style = o.style ?? S.eyes?.pupil ?? "round";
  const px = side * dir.x * s * 0.26, pz = dir.z * s * 0.26;
  const irisCol = S.c.iris, darkIris = !irisCol || lum(irisCol) < 0.13;
  let white = null, pupil, iris = null;
  if (style === "compound") { pupil = box(E, s, s * 1.15, s, flatMat(S.c.iris ?? "#1b1b1f", { roughness: 0.12 }), 0, 0, 0, { r: s * 0.4 }); }
  else if (style === "tiny") { pupil = box(E, s * 0.7, s * 0.7, s * 0.7, M.pupil, 0, 0, 0, { r: s * 0.3 }); }
  else {
    white = box(E, s, s * 1.12, s, M.white, 0, 0, 0, { r: s * 0.22 });
    const big = style === "big";
    const pw = { round: [0.58, 0.68], slit: [0.2, 0.78], bar: [0.72, 0.28], wide: [0.66, 0.42], big: [0.86, 0.94] }[style] ?? [0.58, 0.68];
    if (!darkIris && !big) { iris = box(E, s * 0.7, s * 0.82, s * 0.7, M.iris ?? M.pupil, px * 0.92, -s * 0.02, pz * 0.92, { r: s * 0.12 }); }
    const k = darkIris || big ? 1 : 0.62;
    pupil = box(E, s * pw[0] * (darkIris ? 1 : k * 1.25), s * pw[1] * (darkIris ? 1 : k * 1.25), s * 0.6, M.pupil, px * 1.05, -s * 0.02, pz * 1.05, { r: s * 0.1 });
    if (style === "bar" || style === "wide") pupil.scale.z = 1;
  }
  const glint = box(E, s * 0.2, s * 0.22, s * 0.2, M.white, px * 1.15 + side * dir.z * s * 0.12, s * 0.2, pz * 1.15 + dir.x * s * 0.1, { r: 0.01, detail: true, cast: false });
  if (style === "compound" || style === "tiny") glint.position.set(px * 1.6 + side * s * 0.1, s * 0.25, pz * 1.6);
  // lids: pivots at the top / bottom of the eye, boxes a touch bigger than it, scaled down to show it
  const lidTop = pivot(E, 0, s * 0.6, 0), lidBot = pivot(E, 0, -s * 0.6, 0);
  box(lidTop, s * 1.1, s * 1.2, s * 1.1, lidMat, 0, -s * 0.6, 0, { r: s * 0.2 });
  box(lidBot, s * 1.1, s * 1.2, s * 1.1, lidMat, 0, s * 0.6, 0, { r: s * 0.2 });
  const browPv = pivot(E, 0, s * 0.78, dir.z * s * 0.22);
  const brow = box(browPv, s * 1.25, s * 0.24, s * 0.5 + dir.x * s * 0.3, flatMat(o.browColor ?? dk(S.c.accent ?? S.c.body, 0.75)), 0, 0, 0, { r: 0.02 });
  void brow;
  const rec = { E, side, s, white, pupil, iris, glint, lidTop, lidBot, brow: browPv, hasBrow: !!(S.eyes?.brow || S.head?.brow), dir };
  (J.eyes ??= []).push(rec);
  return rec;
}

// ------------------------------------------------------------------------------------------------ heads (mammal-like)
function buildHead(J, head, S, M, R) {
  const Hd = S.head, hw = Hd.w, hh = Hd.h, hd = Hd.d, cz = hd * 0.2, fz = cz + hd / 2;
  const P = S.pattern ?? {}, X = S.extra ?? {};
  const faceMat = Hd.face ? M.m(S.c.face ?? Hd.face, "skin") : M.body;
  const headMat = M.body;
  box(head, hw, hh, hd, headMat, 0, 0, cz, { r: Math.min(hw, hh) * 0.2 });
  J.headInfo = { hw, hh, hd, cz, fz };
  if (Hd.face) box(head, hw * 0.8, hh * 0.72, 0.2, faceMat, 0, -hh * 0.06, fz, { r: 0.08 });
  if (P.mask) box(head, hw * 1.02, hh * 0.46, hd * 0.7, M.m(P.mask), 0, -hh * 0.28, cz + hd * 0.16, { r: 0.12 });
  if (P.headPatch) box(head, hw * 0.52, hh * 0.7, hd * 0.8, M.m(P.headPatch), hw * 0.25, hh * 0.17, cz, { r: 0.1 });
  if (P.headStripe) box(head, hw * 0.28, hh * 1.03, hd * 1.03, M.m(P.headStripe), 0, 0, cz, { r: 0.05 });
  if (P.stripes && !P.stripes.bodyOnly) for (const x of [-0.22, 0, 0.22]) box(head, hw * 0.1, hh * 0.32, 0.1, M.m(P.stripes.color), x * hw, hh * 0.32, fz + 0.01, { r: 0.02 });
  if (Hd.cheeks) for (const s of [-1, 1]) box(head, hw * 0.36, hh * 0.5, hd * 0.55, M.belly, s * hw * 0.42, -hh * 0.18, cz + hd * 0.18, { r: 0.2 });
  // snout, nose, mouth, jaw
  const sn = Hd.snout;
  let tz = fz, jawY = -hh * 0.3, jawZ = fz - 0.35, jawW = hw * 0.7, jawL = 0.6;
  if (sn) {
    const sl = sn.len, smat = Hd.beak ? M.m(S.c.beak ?? "#4e4a3a", "smooth") : sn.color ? M.m(sn.color, "skin") : P.muzzle ? M.m(P.muzzle) : headMat;
    tz = fz + sl;
    if (Hd.beak) {
      box(head, sn.w * 0.8, sn.h * 0.55, 0.32, smat, 0, sn.y - sn.h * 0.42, tz - 0.05, { r: 0.1, rx: 0.35 });
      for (const s of [-1, 1]) { box(head, 0.07, 0.08, hd * 0.75 + sl, M.dark, s * (Math.max(hw, sn.w) / 2 + 0.01) * (1), sn.y - sn.h * 0.3, fz - hd * 0.35 + sl * 0.5, { r: 0.01, detail: true }); box(head, 0.07, 0.08, sl + 0.05, M.dark, s * (sn.w / 2 + 0.01), sn.y - sn.h * 0.3, fz + sl * 0.5, { r: 0.01, detail: true }); }
      for (const s of [-1, 1]) box(head, sn.w * 0.12, sn.h * 0.14, 0.06, M.dark, s * sn.w * 0.18, sn.y + sn.h * 0.22, tz + 0.02, { r: 0.02, detail: true });
    }
    if (P.headSpots) for (let k = 0; k < 7; k++) { const sd = k % 2 ? 1 : -1; box(head, 0.06, 0.22 + R() * 0.15, 0.22 + R() * 0.2, M.m(S.c.headSpot ?? S.c.accent), sd * (hw / 2 + 0.01), (R() - 0.3) * hh * 0.6, cz + (R() - 0.5) * hd * 0.7, { r: 0.04, detail: true }); }
    if (P.brow) box(head, hw * 0.7, 0.14, hd * 0.55, M.m(P.brow), 0, hh / 2 + 0.01, cz + hd * 0.1, { r: 0.05 });
    if (X.tufts) for (const s of [-1, 1]) { pyramid(head, hh * 0.38, hh * 0.6, M.m(X.tufts), s * hw * 0.5, -hh * 0.15, cz - hd * 0.15, { rz: s * 1.9, sz: 0.45 }); pyramid(head, hh * 0.3, hh * 0.45, M.m(P.mask ?? S.c.belly), s * hw * 0.5, -hh * 0.38, cz + hd * 0.05, { rz: s * 2.2, sz: 0.4 }); }
    if (sn.disc) {
      box(head, sn.w, sn.h, sl + 0.3, smat, 0, sn.y, fz + sl / 2 - 0.15, { r: Math.min(sn.w, sn.h) * 0.35 });
      box(head, sn.w * 1.04, sn.h * 1.04, 0.16, M.nose, 0, sn.y, tz, { r: 0.12 });
      for (const s of [-1, 1]) box(head, sn.w * 0.18, sn.h * 0.34, 0.08, flatMat(S.c.nostril ?? "#b04a60"), s * sn.w * 0.2, sn.y, tz + 0.08, { r: 0.03 });
    } else {
      const tl = sn.taper ? sl * 0.6 : sl;
      box(head, sn.w, sn.h, tl + 0.3, smat, 0, sn.y, fz + tl / 2 - 0.15, { r: Math.min(sn.w, sn.h) * 0.28 });
      if (sn.taper) box(head, sn.w * 0.7, sn.h * 0.78, sl * 0.45 + 0.1, smat, 0, sn.y - sn.h * 0.08, fz + sl * 0.78, { r: Math.min(sn.w, sn.h) * 0.22 });
      if (sn.droop) box(head, sn.w * 1.06, sn.h * 0.6, sl * 0.4, smat, 0, sn.y + sn.h * 0.1, tz - sl * 0.12, { r: 0.15 });
      if (sn.pad) for (const s of [-1, 1]) box(head, sn.w * 0.55, sn.h * 0.8, sl * 0.7, smat, s * sn.w * 0.26, sn.y - sn.h * 0.15, fz + sl * 0.55, { r: 0.25 });
      const tipY = sn.y - (sn.taper ? sn.h * 0.08 : 0) + (sn.taper ? sn.h * 0.39 : sn.h * 0.5);
      if (S.c.nostril && !sn.disc) { for (const s of [-1, 1]) box(head, sn.w * 0.16, sn.h * 0.22, 0.08, flatMat(S.c.nostril), s * sn.w * 0.24, sn.y + sn.h * 0.08, tz + 0.02, { r: 0.03 }); }
      else if (!Hd.beak) box(head, sn.w * (sn.taper ? 0.42 : 0.5), sn.h * 0.34, 0.34, M.nose, 0, tipY - sn.h * 0.17, tz - 0.1, { r: 0.1 });
      if (X.nosestar) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; box(head, 0.12, 0.12, 0.2, flatMat(S.c.nose), Math.cos(a) * 0.3, tipY - 0.17 + Math.sin(a) * 0.25, tz + 0.05, { r: 0.04, detail: true }); }
      // a mouth line and the philtrum, so a closed mouth reads
      if (!Hd.beak && S.plan !== "pinniped") {
        box(head, sn.w * 0.62, 0.07, 0.05, M.dark, 0, sn.y - sn.h * 0.3, tz + 0.01, { r: 0.01, detail: true });
        box(head, 0.07, sn.h * 0.26, 0.05, M.dark, 0, sn.y - sn.h * 0.1, tz + 0.01, { r: 0.01, detail: true });
      }
    }
    jawY = sn.y - sn.h / 2; jawZ = fz - 0.4; jawW = sn.w * 0.9; jawL = sl + 0.42;
    if (X.whiskers) for (const s of [-1, 1]) for (const [ry, rz] of [[0.2, 0.12], [0.05, 0], [-0.1, -0.12]]) {
      const w = box(head, 1.0, 0.045, 0.045, flatMat(X.whiskers), s * (sn.w / 2 + 0.45), sn.y + rz * 1.2 - 0.05, fz + sl * 0.65, { r: 0.01, detail: true, cast: false });
      w.rotation.set(0, s * ry, s * rz);
    }
  } else if (Hd.wide) { jawY = -hh * 0.18; jawZ = cz - hd / 2 + 0.1; jawW = hw * 0.98; jawL = hd - 0.05; }
  if (Hd.jaw) {
    const jh = Hd.jaw;
    const jaw = J.jaw = pivot(head, 0, jawY, jawZ);
    const jmat = P.muzzle && sn ? M.m(P.muzzle) : sn?.color ? M.m(sn.color, "skin") : Hd.wide ? M.belly : headMat;
    box(jaw, jawW, jh, jawL, jmat, 0, -jh / 2, jawL / 2, { r: Math.min(jh, jawW) * 0.3 });
    box(jaw, jawW * 0.78, 0.1, jawL * 0.85, M.mouth, 0, 0.0, jawL * 0.5, { r: 0.03 });
    box(jaw, jawW * 0.45, 0.12, jawL * 0.55, M.tongue, 0, 0.04, jawL * 0.45, { r: 0.05 });
    if (Hd.wide) box(head, hw * 1.0, 0.08, 0.06, M.dark, 0, jawY + 0.02, cz + hd / 2 + 0.01, { r: 0.01, detail: true });
    if (Hd.teeth || X.teeth) for (let k = 0; k < 4; k++) for (const s of [-1, 1]) pyramid(head, 0.16, 0.26, M.teeth, s * jawW * 0.36, jawY - 0.02, jawZ + 0.4 + k * (jawL - 0.6) / 4, { rx: Math.PI });
    if (Hd.fangs) for (const s of [-1, 1]) pyramid(head, 0.18, 0.38, M.teeth, s * jawW * 0.3, jawY + 0.02, jawZ + jawL - 0.3, { rx: Math.PI });
    if (X.teeth2) box(head, 0.36, 0.3, 0.1, M.teeth, 0, jawY - 0.08, (sn ? fz + sn.len : fz) - 0.02, { r: 0.03 });
    if (X.beard) box(jaw, 0.5, 1.0, 0.5, M.m(X.beard), 0, -jh - 0.45, jawL * 0.6, { r: 0.15 });
    if (Hd.tusks) for (const s of [-1, 1]) rods(jaw, [V(s * jawW * 0.42, 0, jawL * 0.7), V(s * jawW * 0.55, 0.45, jawL * 0.8), V(s * jawW * 0.5, 0.75, jawL * 0.65)], 0.2, 0.12, M.teeth);
  }
  if (X.ring && sn) rods(head, [V(-0.25, sn.y - 0.05, tz), V(-0.2, sn.y - 0.45, tz + 0.05), V(0.2, sn.y - 0.45, tz + 0.05), V(0.25, sn.y - 0.05, tz)], 0.09, 0.09, flatMat("#d8b44a", { metalness: 0.6, roughness: 0.3 }));
  // eyes on the cranium's front face (the ones near the corner wrap round it, so a side view shows them too)
  const E = S.eyes, s = E.s;
  for (const side of [-1, 1]) {
    const ex = E.x, corner = Math.min(1, Math.max(0, (ex - 0.5) / 0.25));
    let x = side * (hw / 2) * ex; if (Math.abs(x) + s * 0.5 > hw / 2 - s * 0.05) x = side * (hw / 2 - s * 0.25);
    const y = hh * E.y + (E.bulge ? hh * 0.25 : 0), z = E.bulge ? cz + hd * 0.05 : fz - s * 0.25 * (1 - corner * 0.2);
    if (E.bulge) box(head, s * 1.35, s * 1.0, s * 1.35, headMat, x, y - s * 0.3, z, { r: s * 0.4 });
    if (P.eyePatch) box(head, s * 1.9, s * 2.0, 0.3, M.m(P.eyePatch), x + side * s * 0.05, y - s * 0.1, fz - 0.1, { r: 0.25, rz: side * 0.35 });
    eye(J, head, side, s, V(x, y, z), E.bulge ? { x: 0.5, z: 1 } : { x: corner, z: 1 }, M, S, headMat);
  }
  buildEars(J, head, S, M);
  buildHorns(J, head, S, M, R);
  return { hw, hh, hd, cz, fz, tz };
}

function buildEars(J, head, S, M) {
  const E = S.ears ?? { kind: "none" }, { hw, hh, hd, cz } = J.headInfo, s = E.s ?? 1;
  if (!E.kind || E.kind === "none") return;
  const mat = E.color ? M.m(E.color) : E.kind === "flop" ? M.accent : M.body, inner = E.inner ? M.m(E.inner) : M.inner;
  J.ears = [];
  for (const side of [-1, 1]) {
    const x = side * (hw / 2) * (E.x ?? 0.6);
    let pv;
    switch (E.kind) {
      case "point": case "fin": case "pig": case "tufts": {
        pv = pivot(head, x, hh / 2 - 0.1, cz - hd * 0.08);
        const h = hh * 0.8 * s * (E.kind === "tufts" ? 0.5 : 1), b = hh * 0.62 * s * (E.kind === "tufts" ? 0.45 : 1);
        pyramid(pv, b, h, mat, 0, 0, 0, { sz: 0.45 });
        if (E.kind !== "fin" && E.kind !== "tufts") pyramid(pv, b * 0.62, h * 0.7, inner, 0, 0.02, b * 0.14, { sz: 0.3 });
        pv.rotation.z = -side * (E.kind === "tufts" ? 0.45 : 0.16);
        if (E.kind === "fin") pv.rotation.x = -0.9;
        if (E.kind === "pig") { pv.rotation.x = 0.75; pv.rotation.z = -side * 0.35; }
        break;
      }
      case "flop": {
        pv = pivot(head, side * (hw / 2 - 0.05), hh * 0.36, cz - hd * 0.05);
        box(pv, 0.34 * s, hh * 0.95 * s, hd * 0.5 * s, mat, side * 0.16, -hh * 0.4 * s, 0, { r: 0.12 });
        pv.rotation.z = side * 0.14;
        break;
      }
      case "round": {
        pv = pivot(head, x, hh / 2 - 0.08, cz - hd * 0.1);
        box(pv, hh * 0.6 * s, hh * 0.6 * s, 0.24, mat, 0, hh * 0.27 * s, 0, { r: 0.1 });
        if (!E.color) box(pv, hh * 0.38 * s, hh * 0.36 * s, 0.1, inner, 0, hh * 0.27 * s, 0.1, { r: 0.05 });
        pv.rotation.z = -side * 0.32;
        break;
      }
      case "long": case "lop": {
        pv = pivot(head, x, hh / 2 - 0.1, cz - hd * 0.12);
        const L = hh * 1.8 * s;
        if (E.kind === "long") { box(pv, 0.58 * s, L, 0.3, mat, 0, L / 2, 0, { r: 0.14 }); box(pv, 0.32 * s, L * 0.8, 0.1, inner, 0, L / 2, 0.14, { r: 0.05 }); pv.rotation.set(-0.12, 0, -side * 0.14); }
        else { box(pv, 0.3, L * 0.85, 0.7 * s, mat, side * 0.2, -L * 0.36, 0, { r: 0.14 }); pv.rotation.z = side * 0.25; }
        break;
      }
      case "side": {
        pv = pivot(head, side * (hw / 2 - 0.05), hh * 0.22, cz - hd * 0.12);
        box(pv, hh * 0.62 * s, 0.32 * s, 0.5 * s, mat, side * hh * 0.3 * s, 0, 0, { r: 0.12 });
        if (!E.color) box(pv, hh * 0.45 * s, 0.1, 0.32 * s, inner, side * hh * 0.32 * s, 0, 0.2 * s, { r: 0.03 });
        pv.rotation.z = -side * 0.3;
        break;
      }
      case "leaf": {
        pv = pivot(head, side * (hw / 2 - 0.1), hh * 0.38, cz - hd * 0.1);
        box(pv, 0.62 * s, hh * 0.85 * s, 0.2, mat, 0, hh * 0.42 * s, 0, { r: 0.15 });
        box(pv, 0.38 * s, hh * 0.6 * s, 0.08, inner, 0, hh * 0.42 * s, 0.1, { r: 0.04 });
        pv.rotation.z = -side * 0.95;
        break;
      }
      case "elephant": {
        pv = pivot(head, side * (hw / 2 - 0.05), hh * 0.12, cz - hd * 0.2);
        box(pv, 0.24, hh * 1.15 * s, hd * 1.3 * s, mat, side * 0.12, -hh * 0.12, -hd * 0.42 * s, { r: 0.12 });
        box(pv, 0.08, hh * 0.85 * s, hd * 0.95 * s, inner, -side * 0.02, -hh * 0.12, -hd * 0.38 * s, { r: 0.04 });
        pv.rotation.y = -side * 0.55;
        break;
      }
      default: continue;
    }
    J.ears.push(pv);
  }
}

function buildHorns(J, head, S, M, R) {
  const Hn = S.horns; if (!Hn) return;
  const { hw, hh, hd, cz, fz } = J.headInfo, k = Hn.s ?? 1, mat = M.horn;
  for (const side of [-1, 1]) {
    const P = (x, y, z) => V(side * x, y, z);
    const b0 = P(hw * 0.32, hh / 2 - 0.05, cz - hd * 0.05);
    const add = (dx, dy, dz) => P(b0.x * side + dx * k, b0.y + dy * k, b0.z + dz * k);
    switch (Hn.kind) {
      case "antler": {
        const p1 = add(0.45, 0.9, -0.25), p2 = add(0.95, 1.8, -0.45), p3 = add(1.15, 2.6, -0.2);
        rods(head, [b0, p1, p2, p3], 0.24 * k, 0.15 * k, mat);
        rod(head, p1, add(0.55, 1.45, 0.45), 0.15 * k, mat); rod(head, p2, add(1.05, 2.5, 0.25), 0.14 * k, mat); rod(head, p2, add(1.6, 2.35, -0.75), 0.13 * k, mat);
        break;
      }
      case "moose": {
        const p1 = add(0.9, 0.3, -0.1);
        rod(head, b0, p1, 0.32 * k, mat);
        const palm = new THREE.Group(); palm.position.copy(add(1.75, 0.75, -0.1)); palm.rotation.z = -side * 0.5; head.add(palm);
        box(palm, 1.9 * k, 0.22 * k, 1.5 * k, mat, 0, 0, 0, { r: 0.1 });
        for (let q = 0; q < 5; q++) rod(palm, V(side * (0.2 + q * 0.18) * k, 0, (-0.6 + q * 0.3) * k), V(side * (0.55 + q * 0.2) * k, 0.55 * k, (-0.7 + q * 0.35) * k), 0.16 * k, mat);
        break;
      }
      case "curl": rods(head, [b0, add(0.12, 0.7, -0.25), add(0.2, 1.15, -0.85), add(0.24, 1.05, -1.45), add(0.24, 0.6, -1.75)], 0.32 * k, 0.12 * k, mat); break;
      case "ram": {
        const pts = [b0]; const c0 = add(0.55, -0.25, -0.35);
        for (let q = 0; q <= 8; q++) { const a = Math.PI * 0.6 + q * 0.62, r = (0.95 - q * 0.07) * k; pts.push(V(c0.x + side * q * 0.05 * k, c0.y + Math.sin(a) * r, c0.z + Math.cos(a) * r)); }
        rods(head, pts, 0.46 * k, 0.16 * k, mat);
        break;
      }
      case "small": rods(head, [b0, add(0.45, 0.25, 0), add(0.62, 0.6, 0.08)], 0.22 * k, 0.13 * k, mat); break;
      case "bull": rods(head, [b0, add(0.95, 0.1, 0), add(1.35, 0.45, 0.3), add(1.4, 0.85, 0.5)], 0.32 * k, 0.12 * k, mat); break;
      case "long": rods(head, [b0, add(1.4, 0.05, 0), add(2.2, 0.45, 0.05), add(2.45, 1.05, -0.1)], 0.3 * k, 0.12 * k, mat); break;
      case "tusk": case "mammoth": {
        const t0 = P(hw * 0.28, -hh * 0.32, fz - 0.3);
        const pts = Hn.kind === "tusk" ? [t0, V(t0.x, t0.y - 0.8 * k, t0.z + 0.5 * k), V(t0.x, t0.y - 1.05 * k, t0.z + 1.2 * k), V(t0.x - side * 0.05, t0.y - 0.75 * k, t0.z + 1.8 * k)]
          : [t0, V(t0.x + side * 0.3 * k, t0.y - 1.0 * k, t0.z + 0.6 * k), V(t0.x + side * 0.5 * k, t0.y - 1.3 * k, t0.z + 1.6 * k), V(t0.x + side * 0.2 * k, t0.y - 0.6 * k, t0.z + 2.5 * k), V(t0.x - side * 0.4 * k, t0.y + 0.1 * k, t0.z + 2.4 * k)];
        rods(head, pts, 0.34 * k, 0.16 * k, mat);
        break;
      }
      case "rhino": {
        if (side < 0) break;
        const sn = S.head.snout, z0 = fz + (sn?.len ?? 0.5) - 0.35, y0 = (sn?.y ?? 0) + (sn?.h ?? 0.6) / 2;
        rods(head, [V(0, y0 - 0.1, z0), V(0, y0 + 0.8 * k, z0 + 0.1), V(0, y0 + 1.4 * k, z0 - 0.25)], 0.55 * k, 0.12 * k, mat);
        rods(head, [V(0, y0 - 0.05, z0 - 0.8), V(0, y0 + 0.45 * k, z0 - 0.85)], 0.35 * k, 0.12 * k, mat);
        break;
      }
      case "dragon": {
        const d0 = P(hw * 0.3, hh * 0.35, cz - hd * 0.3);
        rods(head, [d0, V(d0.x + side * 0.2 * k, d0.y + 0.6 * k, d0.z - 0.6 * k), V(d0.x + side * 0.3 * k, d0.y + 0.95 * k, d0.z - 1.4 * k), V(d0.x + side * 0.35 * k, d0.y + 1.0 * k, d0.z - 2.0 * k)], 0.34 * k, 0.1 * k, mat);
        rods(head, [P(hw * 0.5, -hh * 0.15, cz - hd * 0.2), P(hw * 0.5 + 0.45 * k, -hh * 0.1, cz - hd * 0.2 - 0.6 * k)], 0.2 * k, 0.08 * k, mat);
        break;
      }
      case "yeti": rods(head, [b0, add(0.4, 0.3, 0), add(0.62, 0.72, -0.1), add(0.5, 1.05, -0.35)], 0.3 * k, 0.12 * k, mat); break;
      default: break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ legs + IK
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
/** a 2-bone leg: body -> splay (at the hip, rotation.z = splay) -> hip (rotation.x) -> knee -> foot (ankle) */
function makeLeg(J, parent, side, hip, a, b, lw, foot, mats, o = {}) {
  const splay = pivot(parent, hip.x, hip.y, hip.z); splay.rotation.z = side * (o.splay ?? 0);
  const hp = pivot(splay);
  box(hp, lw * (o.thigh ?? 1.18), a + lw * 0.45, lw * (o.thigh ?? 1.18) * (o.thighD ?? 1.05), mats.upper, 0, -a / 2 + lw * 0.12, 0, { r: lw * 0.32 });
  const kn = pivot(hp, 0, -a, 0);
  box(kn, lw * 0.92, b + lw * 0.3, lw * 0.92, mats.lower, 0, -b / 2, 0, { r: lw * 0.3 });
  const ft = pivot(kn, 0, -b, 0);
  const fw = foot.w, fh = foot.h, fl = foot.l;
  if (!o.noFoot) box(ft, fw, fh, fl, mats.foot, 0, -fh / 2, fl * 0.5 - lw * 0.45, { r: Math.min(fw, fh) * 0.35 });
  const leg = { side, splay, hip: hp, knee: kn, foot: ft, a, b, fh, fw, fl, bend: o.bend ?? 1, front: !!o.front, splayA: o.splay ?? 0, lw };
  (J.legInfo ??= []).push(leg); (J.legs ??= []).push(hp); (J.knees ??= []).push(kn); (J.feet ??= []).push(ft);
  return leg;
}
/** IK: the ankle of `leg` to `target` (rig space), the foot flat (times toe, a pitch in rad) */
export function solveLeg(J, leg, target, toe = 0) {
  const body = leg.splay.parent;
  // the target in the leg parent's space (body, or a chain under it)
  _m.identity();
  const chain = []; for (let o = body; o && o !== J.rig; o = o.parent) chain.push(o);
  for (let i = chain.length - 1; i >= 0; i--) { chain[i].updateMatrix(); _m.multiply(chain[i].matrix); }
  const inv = _m.clone().invert();
  const tl = _v.copy(target).applyMatrix4(inv);
  const s = leg.splayA * leg.side, cs = Math.cos(s);
  let Y = (tl.y - leg.splay.position.y) / cs, Z = tl.z - leg.splay.position.z;
  const a = leg.a, b = leg.b;
  let D = Math.hypot(Y, Z);
  const maxD = (a + b) * 0.9995, minD = Math.abs(a - b) + 1e-3;
  if (D > maxD) { Y *= maxD / D; Z *= maxD / D; D = maxD; } else if (D < minD) { Y *= minD / D; Z *= minD / D; D = minD; }
  const phi = Math.atan2(-Z, -Y);
  const alpha = Math.acos(Math.min(1, Math.max(-1, (a * a + D * D - b * b) / (2 * a * D))));
  const phi1 = phi - leg.bend * alpha;
  const KY = -a * Math.cos(phi1), KZ = -a * Math.sin(phi1);
  const phi2 = Math.atan2(-(Z - KZ), -(Y - KY));
  leg.hip.rotation.set(phi1, 0, 0); leg.knee.rotation.set(phi2 - phi1, 0, 0);
  // the foot flat in rig space
  _q.identity(); for (let i = chain.length - 1; i >= 0; i--) _q.multiply(chain[i].quaternion);
  _q.multiply(leg.splay.quaternion).multiply(leg.hip.quaternion).multiply(leg.knee.quaternion);
  leg.foot.quaternion.copy(_q.invert()).multiply(_q2.setFromAxisAngle(V(1, 0, 0), toe));
}
/** the rig-space position of a body-space point (rest of the frame's body transform) */
export function bodyToRig(J, p, body = J.body) {
  _m.identity(); const chain = []; for (let o = body; o && o !== J.rig; o = o.parent) chain.push(o);
  for (let i = chain.length - 1; i >= 0; i--) { chain[i].updateMatrix(); _m.multiply(chain[i].matrix); }
  return p.clone().applyMatrix4(_m);
}

// ------------------------------------------------------------------------------------------------ tails
function buildTail(J, parent, at, S, M) {
  const T = S.tail ?? { kind: "none" }; if (!T.kind || T.kind === "none") return;
  const P = S.pattern ?? {};
  const segs = Math.max(1, T.segs ?? 3), L = T.len, w = T.w, sl = L / segs;
  const prof = { bush: [0.75, 1.1, 1.2, 0.95, 0.7], thin: [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.36], dragon: [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.24], long: [1, 0.95, 0.9, 0.86, 0.82, 0.8], up: [1, 0.85, 0.7], tuft: [1, 0.9, 0.85] }[T.kind] ?? [1, 1, 1, 1, 1, 1, 1];
  const curl = T.kind === "curl" ? 1.05 : T.kind === "long" ? (T.curl ?? 0.12) : T.kind === "up" ? 0.18 : T.kind === "thin" ? 0.05 : T.kind === "tuft" ? 0.08 : T.kind === "bush" ? 0.12 : 0.08;
  J.tail = [];
  let pv = pivot(parent, at.x, at.y, at.z); pv.rotation.x = T.up ?? 0;
  const tipCol = T.tip ?? P.tip;
  for (let i = 0; i < segs; i++) {
    J.tail.push(pv);
    const wi = w * (prof[i] ?? prof[prof.length - 1]);
    const last = i === segs - 1;
    let mat = T.color ? M.m(T.color, "skin") : M.body;
    if (last && tipCol) mat = M.m(tipCol);
    if (T.kind === "puff") box(pv, w, w, w, M.m(T.color ?? "#ffffff", "fluff"), 0, 0, -w * 0.3, { r: w * 0.4 });
    else if (T.kind === "flag") { box(pv, w, 0.3, sl, M.body, 0, 0, -sl / 2, { r: 0.12 }); box(pv, w * 0.9, 0.12, sl * 0.9, M.m(T.under ?? "#ffffff"), 0, -0.18, -sl / 2, { r: 0.05 }); }
    else box(pv, wi, wi * (T.kind === "bush" ? 1.05 : 1), sl + wi * 0.35, mat, 0, 0, -sl / 2, { r: wi * 0.3 });
    if (T.kind === "dragon") pyramid(pv, wi * 0.6, wi * 0.9, M.horn, 0, wi * 0.4, -sl / 2, { sz: 0.6, rx: -0.3 });
    if (last && T.kind === "tuft") box(pv, w * 2.6, w * 3.4, w * 2.6, M.m(T.tip ?? "#1e1e22", "shag"), 0, 0, -sl - w, { r: w * 0.8 });
    if (last && T.kind === "dragon") box(pv, wi * 3.2, 0.2, wi * 3.2, M.horn, 0, 0, -sl - wi, { r: 0.05, ry: Math.PI / 4 });
    if (!last) { pv = pivot(pv, 0, 0, -sl); pv.rotation.x = curl; }
  }
}

// ------------------------------------------------------------------------------------------------ wings (birds, dragons)
function buildWing(J, parent, side, at, Wg, S, M, kind) {
  const sh = pivot(parent, at.x, at.y, at.z); sh.rotation.order = "YZX";
  const L = Wg.len, W = Wg.w, th = Wg.th ?? Math.max(0.18, W * 0.1), c = S.c, P = S.pattern ?? {};
  const wingM = M.m(c.wing ?? c.body, kind === "bat" ? "skin" : "feather"), tipM = M.m(c.tip ?? dk(c.wing ?? c.body, 0.6), "feather");
  if (kind === "bat") {
    const bone = M.m(c.wing ?? c.accent, "scale"), mem = M.m(c.membrane ?? c.belly, "skin");
    box(sh, L * 0.5, th, W * 0.25, bone, side * L * 0.25, 0, 0, { r: th * 0.4 });
    box(sh, L * 0.5, th * 0.4, W * 0.9, mem, side * L * 0.25, 0, -W * 0.5, { r: 0.05 });
    const tip = pivot(sh, side * L * 0.5, 0, 0);
    box(tip, L * 0.5, th * 0.9, W * 0.2, bone, side * L * 0.25, 0, 0, { r: th * 0.4 });
    for (let k = 0; k < 3; k++) {
      const end = V(side * L * (0.5 - k * 0.12), 0, -W * (0.8 + k * 0.25));
      rod(tip, V(side * L * 0.02, 0, 0), end, th * 0.6, bone);
    }
    box(tip, L * 0.46, th * 0.35, W * 1.1, mem, side * L * 0.23, 0, -W * 0.6, { r: 0.05 });
    pyramid(tip, th * 1.2, th * 2.4, M.horn, side * L * 0.5, 0, 0, { rz: -side * Math.PI / 2 });
    (J.wings ??= []).push(sh); (J.wingTips ??= []).push(tip);
    return;
  }
  box(sh, L * 0.5, th, W, wingM, side * L * 0.25, 0, -W * 0.45, { r: th * 0.4 });
  box(sh, L * 0.5, th * 1.25, W * 0.36, M.m(c.cover ?? c.body, "feather"), side * L * 0.25, 0.02, -W * 0.08, { r: th * 0.5 });
  if (P.wingBars) for (const f of [0.45, 0.72]) box(sh, L * 0.42, th * 1.3, W * 0.08, M.m(P.wingBars), side * L * 0.27, 0, -W * f, { r: 0.02 });
  if (P.speculum) box(sh, L * 0.25, th * 1.3, W * 0.22, flatMat(P.speculum, { roughness: 0.3 }), side * L * 0.32, 0, -W * 0.72, { r: 0.03 });
  if (P.wingBand) box(sh, L * 0.5, th * 1.3, W * 0.16, M.m(P.wingBand), side * L * 0.25, 0, -W * 0.42, { r: 0.03 });
  const tip = pivot(sh, side * L * 0.5, 0, 0);
  box(tip, L * 0.3, th * 0.85, W * 0.85, wingM, side * L * 0.15, 0, -W * 0.4, { r: th * 0.35 });
  const n = Wg.fingers ?? 4;
  for (let k = 0; k < n; k++) {
    const f = k / Math.max(1, n - 1), len = L * (0.32 - f * 0.08);
    const fp = pivot(tip, side * L * 0.26, 0, -W * (0.1 + f * 0.62));
    fp.rotation.y = -side * (0.05 + f * 0.6);
    box(fp, len, th * 0.6, W * 0.2, tipM, side * len / 2, 0, 0, { r: th * 0.25 });
    if (P.wingSpots && k < 2) box(fp, len * 0.22, th * 0.7, W * 0.16, M.m(P.wingSpots), side * len * 0.8, 0, 0, { r: 0.02, detail: true });
  }
  (J.wings ??= []).push(sh); (J.wingTips ??= []).push(tip);
}

// ------------------------------------------------------------------------------------------------ body plans
function quadPatterns(J, body, S, M, R) {
  const b = S.body, P = S.pattern ?? {}, L = b.len, W = b.w, H = b.h;
  if (P.saddle) box(body, W * 1.04, H * 0.42, L * 0.62, M.m(P.saddle), 0, H * 0.32, -L * 0.05, { r: 0.2 });
  if (P.band) box(body, W * 1.04, H * 1.04, L * 0.26, M.m(P.band), 0, 0, L * 0.26, { r: 0.25 });
  if (P.stripes && !P.stripes.headOnly) { const n = P.stripes.n ?? 4; for (let k = 0; k < n; k++) box(body, W * 1.04, H * 0.62, L * 0.065, M.m(P.stripes.color), 0, H * 0.2, -L * 0.34 + k * (L * 0.6) / Math.max(1, n - 1), { r: 0.04 }); }
  if (P.spots) {
    const sp = P.spots, n = sp.n ?? 6;
    for (let k = 0; k < n; k++) {
      const col = sp.also && k % 3 === 2 ? sp.also : sp.color, sz = (sp.s ?? 0.5) * (0.7 + R() * 0.6);
      const z = (R() - 0.5) * L * 0.8;
      if (sp.top || k % 3 === 0) box(body, sz * 1.2, 0.08, sz, M.m(col), (R() - 0.5) * W * 0.6, H / 2 + 0.02, z, { r: 0.03 });
      else { const side = k % 2 ? 1 : -1; box(body, 0.08, sz * 0.9, sz * 1.3, M.m(col), side * (W / 2 + 0.02), (R() - 0.2) * H * 0.5, z, { r: 0.03 }); }
    }
  }
  if (P.rump) box(body, W * 0.7, H * 0.55, 0.12, M.m(P.rump), 0, H * 0.05, -L / 2 - 0.04, { r: 0.05 });
  if (P.bib) box(body, W * 0.6, H * 0.6, 0.14, M.m(P.bib), 0, -H * 0.05, L / 2 + 0.03, { r: 0.05 });
  if (P.udder) { box(body, W * 0.42, H * 0.22, L * 0.18, M.m(P.udder, "skin"), 0, -H / 2 - H * 0.08, -L * 0.25, { r: 0.12 }); for (const x of [-0.12, 0.12]) for (const z of [-0.08, 0.08]) box(body, 0.1, 0.22, 0.1, M.m(P.udder, "skin"), x * W, -H / 2 - H * 0.24, -L * 0.25 + z * L, { r: 0.03, detail: true }); }
  if (P.bellyPlates) for (let k = 0; k < 6; k++) box(body, W * 0.7, 0.08, L * 0.08, M.m(P.bellyPlates), 0, -H / 2 - 0.02, -L * 0.35 + k * L * 0.14, { r: 0.02 });
  if (P.mane) box(body, W * 0.8, H * 0.5, L * 0.3, M.m(P.mane, "shag"), 0, -H * 0.15, L * 0.38, { r: 0.25 });
  if (P.fringe) box(body, W * 1.06, H * 0.4, L * 1.02, M.m(P.fringe, "shag"), 0, -H * 0.35, 0, { r: 0.2 });
}

function buildQuad(J, S, M, R) {
  const b = S.body, L = b.len, W = b.w, H = b.h, c = S.c, X = S.extra ?? {}, Lg = S.legs;
  const body = J.body = pivot(J.rig, 0, b.y, 0); body.rotation.x = b.pitch ?? 0;
  const turtle = S.shell?.kind === "dome";
  if (turtle) {
    // the shell: a chunky dome (semi-axes w/2, h, len/2) with scute plates, a rim of marginal plates, the plastron
    const geo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(geo, animalMat(c.shell, "scute", { repeat: 2 })); dome.scale.set(W / 2, S.shell.h, L / 2); dome.castShadow = dome.receiveShadow = true; body.add(dome);
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; box(body, 0.95, 0.42, 0.95, M.m(c.rim, "plate"), Math.sin(a) * W / 2 * 0.98, 0.05, Math.cos(a) * L / 2 * 0.98, { r: 0.12, ry: a }); }
    box(body, W * 0.86, H * 0.55, L * 0.86, M.m(c.belly, "plate"), 0, -H * 0.15, 0, { r: 0.3 });
    for (let k = 0; k < (S.pattern?.moss ?? 0); k++) {
      const th = R() * Math.PI * 2, ph = 0.35 + R() * 0.9, n = V(Math.sin(th) * Math.cos(ph) / (W / 2), Math.sin(ph) / S.shell.h, Math.cos(th) * Math.cos(ph) / (L / 2)).normalize();
      const m = box(body, 0.5 + R() * 0.6, 0.14, 0.45 + R() * 0.55, M.m(c.moss ?? "#6f9a3a", "fur"), Math.sin(th) * Math.cos(ph) * W / 2, Math.sin(ph) * S.shell.h, Math.cos(th) * Math.cos(ph) * L / 2, { r: 0.06 });
      m.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    }
    J.shell = body;
  } else {
    box(body, W, H, L, M.body, 0, 0, 0, { r: Math.min(W, H) * 0.2 * (b.round ?? 0.4) / 0.4 });
    const bf = b.belly ?? 0.36;
    box(body, W * 1.02, H * bf, L * 0.84, M.belly, 0, -H / 2 + H * bf / 2 - 0.03, 0, { r: H * bf * 0.3 });
    if (b.chest) box(body, W * (1 + b.chest), H * (1 + b.chest), L * 0.42, M.body, 0, H * b.chest * 0.3, L * 0.28, { r: Math.min(W, H) * 0.22 });
    if (b.hump) box(body, W * 0.8, H * b.hump * 0.6 + 0.3, L * 0.38, M.body, 0, H / 2 + H * b.hump * 0.15, L * 0.18, { r: 0.3 });
    quadPatterns(J, body, S, M, R);
  }
  if (X.spikes) for (let k = 0; k < X.spikes; k++) pyramid(body, 0.55 - k * 0.03, 0.85 - k * 0.04, M.horn, 0, H / 2 - 0.05, L * 0.4 - k * (L * 0.8) / X.spikes, { sz: 0.5, rx: -0.35 });
  if (X.wool) for (let k = 0; k < 14; k++) box(body, W * 0.42, H * 0.42, L * 0.24, M.body, (k % 3 - 1) * W * 0.35, H * (k % 2 ? 0.38 : 0.1), -L * 0.4 + (k / 14) * L * 0.85, { r: 0.18 });
  if (X.blanket) { box(body, W * 1.06, H * 0.55, L * 0.5, M.m(c.blanket ?? "#c0392b", "plain"), 0, H * 0.25, 0, { r: 0.1 }); box(body, W * 1.08, 0.18, L * 0.52, M.m(c.trim ?? "#f1c40f", "plain"), 0, H * 0.02, 0, { r: 0.05 }); }
  // neck + head
  const N = S.neck;
  const neck = J.neck = pivot(body, 0, H * (N.up ?? 0.25), L * (N.at ?? 0.42)); neck.rotation.x = -(N.tilt ?? 0.6);
  const segs = N.segs ?? 1, nl = N.len / segs;
  let np = neck;
  for (let i = 0; i < segs; i++) {
    box(np, N.w * (1 - i * 0.12), N.w * (1 - i * 0.12), nl + N.w * 0.6, N.color ? M.m(N.color) : M.body, 0, 0, nl / 2, { r: N.w * 0.3 });
    if (X.spikes && segs > 1) pyramid(np, 0.4, 0.6, M.horn, 0, N.w / 2 - 0.05, nl / 2, { sz: 0.5, rx: -0.35 });
    if (i < segs - 1) { np = pivot(np, 0, 0, nl); np.rotation.x = 0.25; (J.neckSegs ??= []).push(np); }
  }
  if (S.head?.folds) for (let k = 0; k < 3; k++) box(neck, N.w * 1.08, N.w * 1.08, 0.12, M.m(c.fold ?? dk(c.body, 0.8), "skin"), 0, 0, 0.15 + k * nl * 0.3, { r: 0.05 });
  if (X.tufts) for (let k = 0; k < 3; k++) pyramid(body, 0.6, 0.55, M.m(X.tufts), (k - 1) * W * 0.25, H / 2 - 0.1, L * 0.3 - k * 0.12, { rx: -0.9, sz: 0.5 });
  if (N.ruff) box(neck, N.w * 1.55, N.w * 1.45, 0.9, M.m(S.pattern?.mask ?? c.belly), 0, -N.w * 0.1, 0.25, { r: 0.35 });
  if (c.collar || X.bell) {
    const cm = flatMat(c.collar ?? "#6a4a2a", { roughness: 0.5 });
    box(neck, N.w + 0.28, N.w + 0.28, 0.3, cm, 0, 0, Math.min(nl * 0.6, 0.45), { r: 0.08 });
    const gold = flatMat("#e8b830", { metalness: 0.7, roughness: 0.3 });
    if (X.bell) box(neck, 0.55, 0.65, 0.55, gold, 0, -N.w / 2 - 0.45, Math.min(nl * 0.6, 0.45), { r: 0.15 });
    else box(neck, 0.3, 0.36, 0.12, gold, 0, -N.w / 2 - 0.3, Math.min(nl * 0.6, 0.45) + 0.1, { r: 0.06 });
  }
  if (S.pattern?.mane && S.species === "deer") box(neck, N.w * 1.3, N.w * 1.2, N.len * 0.9, M.m(S.pattern.mane, "shag"), 0, -N.w * 0.25, N.len * 0.45, { r: 0.3 });
  const head = J.head = pivot(np, 0, 0, nl); head.rotation.x = (N.tilt ?? 0.6) - (segs > 1 ? 0.25 * (segs - 1) : 0) - (b.pitch ?? 0);
  buildHead(J, head, S, M, R);
  if (X.trunk) {
    const { hh, fz } = J.headInfo, segN = 6, sl = X.trunk / segN;
    J.trunk = [];
    let tp = pivot(head, 0, -hh * 0.18, fz - 0.15); tp.rotation.x = 1.15;
    for (let i = 0; i < segN; i++) {
      J.trunk.push(tp);
      const w = 0.95 - i * 0.09;
      box(tp, w, w, sl + 0.25, M.body, 0, 0, sl / 2, { r: w * 0.3 });
      if (i === segN - 1) box(tp, w * 1.15, w * 1.15, 0.2, M.nose, 0, 0, sl + 0.05, { r: 0.1 });
      if (i < segN - 1) { tp = pivot(tp, 0, 0, sl); tp.rotation.x = 0.12; }
    }
  }
  // legs (IK): FL, FR, HL, HR (the left side is +x)
  const hipY = -H * 0.22, kind = Lg.kind;
  for (const [front, side] of [[1, 1], [1, -1], [0, 1], [0, -1]]) {
    const hip = V(side * W * (Lg.x ?? 0.36), hipY, L * (front ? Lg.zF : Lg.zH));
    const hipR = bodyToRig(J, hip);
    let foot = { ...Lg.foot }, crouch = 1.12, ratio = Lg.ratio ?? 0.5, bend = front ? 1 : -1, splay = Lg.splay ?? 0, lw = Lg.w;
    if (!front && Lg.hindFoot) foot = { ...Lg.hindFoot };
    if (front && Lg.frontHand) foot = { ...Lg.frontHand };
    if (kind === "frog") { if (front) { crouch = 1.08; lw *= 0.8; } else { crouch = 2.3; bend = 1; splay = 0.55; lw *= Lg.hindW ?? 1; foot = { w: 1.3, l: 1.6, h: 0.22 }; } }
    if (kind === "rabbit" && !front) { crouch = 2.0; bend = -1; }
    if (kind === "stump" || kind === "flipper") { crouch = 1.05; splay = Lg.splay ?? 0.3; }
    if (kind === "column") crouch = 1.03;
    if (kind === "hoof") crouch = 1.1;
    const legLen = (hipR.y - foot.h) * crouch, a = legLen * ratio, bb = legLen - a;
    const legMat = M.body, low = S.pattern?.socks ? M.m(S.pattern.socks) : legMat;
    const footMat = kind === "hoof" ? M.hoof : (front && Lg.frontHand) ? M.m(c.hand ?? c.nose, "skin") : low;
    const leg = makeLeg(J, body, side, hip, a, bb, lw, kind === "flipper" ? { w: 1.4, l: 2.0, h: 0.16 } : foot, { upper: legMat, lower: low, foot: footMat }, { front, bend, splay, thigh: front ? 1.12 : 1.3, thighD: front ? 1 : 1.25 });
    leg.restZ = hipR.z + (kind === "frog" && !front ? 0.6 : 0); leg.restX = hipR.x;
    // paw details: toe lines, claws, nails, cloven hooves
    const fl = leg.fl, fw = leg.fw, fz0 = fl * 0.5 - lw * 0.45;
    if (kind === "hoof") box(leg.foot, 0.06, leg.fh * 0.8, fl * 0.5, M.dark, 0, -leg.fh / 2, fz0 + fl * 0.3, { r: 0.01, detail: true });
    else if (kind === "column") for (const x of [-0.3, 0, 0.3]) box(leg.foot, fw * 0.2, leg.fh * 0.6, 0.1, flatMat(c.nail ?? "#e8e2d4"), x * fw, -leg.fh * 0.55, fz0 + fl / 2, { r: 0.04, detail: true });
    else if (kind !== "flipper") {
      for (const x of [-0.17, 0.17]) box(leg.foot, 0.06, leg.fh * 0.5, fl * 0.32, M.m(dk(c.body, 0.55)), x * fw, -leg.fh * 0.25, fz0 + fl * 0.36, { r: 0.01, detail: true });
      if (Lg.claws || (front && Lg.frontHand)) for (const x of [-0.3, 0, 0.3]) box(leg.foot, 0.12, 0.12, 0.3, flatMat(Lg.claws ?? "#e8e0cc"), x * fw, -leg.fh * 0.6, fz0 + fl / 2 + 0.1, { r: 0.03, detail: true });
    }
    if (S.species === "frog") for (const x of [-0.35, 0, 0.35]) box(leg.foot, 0.16, 0.12, 0.16, M.m(c.accent), x * fw, -leg.fh * 0.5, fz0 + fl / 2 + 0.05, { r: 0.05, detail: true });
  }
  // tail
  buildTail(J, body, V(0, H * 0.2, -L / 2 + 0.1), S, M);
  if (X.wings) {
    const Wg = { len: L * 1.35, w: L * 0.55, th: 0.28 };
    for (const side of [1, -1]) buildWing(J, body, side, V(side * W * 0.42, H * 0.42, L * 0.2), Wg, S, M, "bat");
    J.wings.forEach((w, i) => { const s = i ? -1 : 1; w.rotation.set(-0.15, s * 0.55, s * 0.62); J.wingTips[i].rotation.y = s * 0.9; });
  }
}

function buildBiped(J, S, M, R) {
  const b = S.body, c = S.c, X = S.extra ?? {}, Lg = S.legs;
  const pelvisY = b.y - b.h / 2;
  const body = J.body = pivot(J.rig, 0, pelvisY, 0);
  const torso = J.torso = pivot(body, 0, 0, 0);
  box(torso, b.w, b.h, b.d, M.body, 0, b.h / 2, 0, { r: Math.min(b.w, b.d) * 0.25 });
  box(torso, b.w * 0.62, b.h * 0.6, 0.3, M.belly, 0, b.h * 0.45, b.d / 2, { r: 0.12 });
  box(body, b.w * 0.9, 0.9, b.d * 0.92, M.body, 0, 0, 0, { r: 0.3 });
  if (X.tufts) for (const [x, y, z] of [[0.5, 0.95, 0], [-0.5, 0.95, 0], [0.35, 0.05, 0.3], [-0.35, 0.05, 0.3], [0, 0.6, -0.5]]) box(torso, 0.8, 0.7, 0.8, M.accent, x * b.w, y * b.h, z * b.d, { r: 0.3, rz: x * 0.6 });
  const neck = J.neck = pivot(torso, 0, b.h, 0.1);
  const head = J.head = pivot(neck, 0, S.head.h * 0.45, 0);
  buildHead(J, head, S, M, R);
  // arms
  const A = S.arms;
  J.arms = []; J.elbows = []; J.hands = [];
  for (const side of [1, -1]) {
    const sh = pivot(torso, side * (b.w / 2 + A.w * 0.35), b.h * 0.86, 0); sh.rotation.z = side * 0.12;
    box(sh, A.w * 1.15, A.len * 0.55, A.w * 1.1, M.body, 0, -A.len * 0.22, 0, { r: A.w * 0.35 });
    const el = pivot(sh, 0, -A.len * 0.5, 0); el.rotation.x = -0.25;
    box(el, A.w, A.len * 0.55, A.w, M.body, 0, -A.len * 0.24, 0, { r: A.w * 0.32 });
    if (X.tufts) box(el, A.w * 1.4, A.len * 0.18, A.w * 1.4, M.accent, 0, -A.len * 0.12, 0, { r: 0.25 });
    const hd = pivot(el, 0, -A.len * 0.5, 0);
    box(hd, A.hand, A.hand * 0.9, A.hand * 0.8, M.m(c.hand ?? c.face ?? c.body, "skin"), 0, -A.hand * 0.4, 0.05, { r: 0.2 });
    for (const x of [-0.3, 0, 0.3]) box(hd, 0.14, 0.2, 0.2, flatMat("#e8e0cc"), x * A.hand, -A.hand * 0.88, A.hand * 0.3, { r: 0.04, detail: true });
    J.arms.push(sh); J.elbows.push(el); J.hands.push(hd);
  }
  for (const side of [1, -1]) {
    const hip = V(side * b.w * (Lg.x ?? 0.28), -0.15, 0), hipR = bodyToRig(J, hip);
    const legLen = (hipR.y - Lg.foot.h) * 1.08, a = legLen * (Lg.ratio ?? 0.5);
    const leg = makeLeg(J, body, side, hip, a, legLen - a, Lg.w, Lg.foot, { upper: M.body, lower: M.body, foot: M.m(c.hand ?? c.face ?? c.body, "skin") }, { bend: 1, thigh: 1.25 });
    leg.restZ = hipR.z; leg.restX = hipR.x;
  }
}

function buildBird(J, S, M, R) {
  const b = S.body, c = S.c, P = S.pattern ?? {}, X = S.extra ?? {}, Lg = S.legs, tilt = b.tilt ?? 0.3;
  const body = J.body = pivot(J.rig, 0, b.y, 0); body.rotation.x = -tilt;
  const fluff = S.tex === "fluff";
  box(body, b.w, b.h, b.len, M.body, 0, 0, 0, { r: Math.min(b.w, b.h) * 0.32 });
  box(body, b.w * 0.94, b.h * 0.72, b.len * 0.5, P.chest ? M.m(P.chest, "feather") : M.belly, 0, -b.h * 0.14, b.len * 0.28, { r: Math.min(b.w, b.h) * 0.25 });
  if (P.breast) for (let k = 0; k < 8; k++) box(body, 0.22, 0.18, 0.1, M.m(P.breast), (R() - 0.5) * b.w * 0.6, -b.h * 0.3 + R() * b.h * 0.5, b.len * 0.53, { r: 0.04, detail: true });
  // neck + head
  const N = S.neck, nt = N.tilt ?? 1.3;
  const neck = J.neck = pivot(body, 0, b.h * 0.3, b.len * 0.32); neck.rotation.x = -nt + tilt;
  const neckMat = N.color ? M.m(N.color, "feather") : M.m(c.head ?? c.body, S.tex);
  box(neck, N.w, N.w, N.len + N.w * 0.7, neckMat, 0, 0, N.len / 2, { r: N.w * 0.35 });
  if (P.collar) box(neck, N.w * 1.12, N.w * 1.12, 0.25, M.m(P.collar, "feather"), 0, 0, N.len * 0.15 + 0.1, { r: 0.08 });
  if (P.neck) for (const side of [-1, 1]) { box(neck, 0.12, N.w * 0.6, N.len * 0.5 + 0.3, flatMat(P.neck[0], { roughness: 0.25, metalness: 0.2 }), side * N.w / 2, N.w * 0.12, N.len * 0.55, { r: 0.04 }); box(neck, 0.12, N.w * 0.4, N.len * 0.4 + 0.2, flatMat(P.neck[1], { roughness: 0.25, metalness: 0.2 }), side * N.w / 2, -N.w * 0.2, N.len * 0.3, { r: 0.04 }); }
  if (P.hackle) box(neck, N.w * 1.25, N.w * 1.2, N.len + 0.5, M.m(P.hackle, "feather"), 0, 0, N.len * 0.35, { r: 0.25 });
  const head = J.head = pivot(neck, 0, 0, N.len); head.rotation.x = nt;
  const Hd = S.head, hw = Hd.w, hh = Hd.h, hd = Hd.d, cz = hd * 0.12, fz = cz + hd / 2;
  const headMat = M.m(c.head ?? c.body, fluff ? "fluff" : "feather");
  box(head, hw, hh, hd, headMat, 0, hh * 0.12, cz, { r: Math.min(hw, hh) * 0.3 });
  J.headInfo = { hw, hh, hd, cz, fz };
  if (Hd.owl) box(head, hw * 0.92, hh * 0.8, 0.2, M.m(Hd.disc, "feather"), 0, hh * 0.08, fz, { r: 0.2 });
  if (P.face) for (const side of [-1, 1]) box(head, 0.12, hh * 0.55, hd * 0.6, M.m(P.face, "plain"), side * hw / 2, hh * 0.08, fz - hd * 0.3, { r: 0.05 });
  if (P.cap) box(head, hw * 1.02, hh * 0.3, hd * 0.85, M.m(P.cap, "feather"), 0, hh * 0.55, cz - 0.05, { r: 0.1 });
  if (P.chin) for (const side of [-1, 1]) box(head, 0.14, hh * 0.45, hd * 0.55, M.m(P.chin, "plain"), side * hw / 2, -hh * 0.12, cz + 0.05, { r: 0.05 });
  // beak
  const Bk = S.beak, bl = Bk.len, bw = Bk.w, bh = Bk.h, by = -hh * 0.02, bMat = M.m(c.nose, "smooth");
  const jaw = J.jaw = pivot(head, 0, by - bh * 0.15, fz - 0.1);
  switch (Bk.kind) {
    case "bill": case "goose":
      box(head, bw, bh * 0.6, bl + 0.15, bMat, 0, by + bh * 0.1, fz + bl / 2 - 0.05, { r: bh * 0.25 });
      box(head, bw * 0.4, bh * 0.25, 0.25, M.m(dk(c.nose, 0.6)), 0, by + bh * 0.38, fz + bl - 0.08, { r: 0.05, detail: true });
      box(jaw, bw * 0.85, bh * 0.35, bl * 0.9, bMat, 0, -bh * 0.15, bl * 0.45, { r: 0.08 });
      if (Bk.kind === "goose") box(head, bw * 1.02, 0.07, bl * 0.6, M.dark, 0, by - bh * 0.1, fz + bl * 0.35, { r: 0.01, detail: true });
      break;
    case "hook":
      box(head, bw, bh * 0.6, bl * 0.75, bMat, 0, by + bh * 0.15, fz + bl * 0.35, { r: bh * 0.25 });
      box(head, bw * 0.7, bh * 0.85, bl * 0.35, bMat, 0, by - bh * 0.12, fz + bl * 0.8, { r: bh * 0.2, rx: 0.35 });
      box(jaw, bw * 0.75, bh * 0.35, bl * 0.55, flatMat(Bk.lower ?? dk(c.nose, 0.8)), 0, -bh * 0.18, bl * 0.3, { r: 0.08 });
      break;
    case "gull":
      box(head, bw, bh * 0.55, bl + 0.1, bMat, 0, by + bh * 0.1, fz + bl / 2 - 0.05, { r: 0.1 });
      box(head, bw * 0.8, bh * 0.5, 0.25, bMat, 0, by - bh * 0.05, fz + bl - 0.08, { r: 0.08, rx: 0.4 });
      box(jaw, bw * 0.85, bh * 0.35, bl * 0.85, bMat, 0, -bh * 0.12, bl * 0.45, { r: 0.06 });
      if (c.spot) box(jaw, bw * 0.88, bh * 0.3, 0.25, flatMat(c.spot), 0, -bh * 0.12, bl * 0.7, { r: 0.05, detail: true });
      break;
    case "puffin":
      box(head, bw, bh, bl * 0.4, flatMat("#7a8088"), 0, by, fz + bl * 0.15, { r: 0.1 });
      box(head, bw * 1.02, bh * 0.85, bl * 0.18, flatMat("#ffd02a"), 0, by - bh * 0.03, fz + bl * 0.42, { r: 0.05 });
      box(head, bw, bh * 0.75, bl * 0.42, bMat, 0, by - bh * 0.06, fz + bl * 0.7, { r: 0.12 });
      box(jaw, bw * 0.8, bh * 0.3, bl * 0.5, bMat, 0, -bh * 0.3, bl * 0.45, { r: 0.05 });
      break;
    default:
      box(head, bw, bh * 0.6, bl * 0.65 + 0.1, bMat, 0, by + bh * 0.12, fz + bl * 0.3, { r: bh * 0.22 });
      box(head, bw * 0.6, bh * 0.42, bl * 0.4, bMat, 0, by + bh * 0.05, fz + bl * 0.75, { r: bh * 0.15 });
      box(jaw, bw * 0.8, bh * 0.35, bl * 0.8, bMat, 0, -bh * 0.1, bl * 0.4, { r: 0.06 });
      if (Bk.cere) box(head, bw * 0.8, bh * 0.35, bl * 0.25, flatMat(Bk.cere), 0, by + bh * 0.42, fz + bl * 0.1, { r: 0.08 });
  }
  if (P.bib) box(head, hw * 0.55, hh * 0.35, 0.2, M.m(P.bib, "plain"), 0, -hh * 0.38, fz - 0.05, { r: 0.05 });
  if (X.comb) { const big = X.comb === "big"; for (let k = 0; k < (big ? 4 : 3); k++) box(head, 0.3, (big ? 0.85 : 0.6) - Math.abs(k - 1.2) * 0.12, 0.42, flatMat(c.comb ?? "#e53935", { roughness: 0.5 }), 0, hh * 0.62 + 0.2, cz + hd * 0.32 - k * 0.38, { r: 0.12 }); }
  if (X.wattle) for (const side of [-1, 1]) box(head, 0.25, 0.55, 0.3, flatMat(c.comb ?? "#e53935", { roughness: 0.5 }), side * 0.14, by - bh * 0.65, fz + 0.05, { r: 0.1 });
  if (X.crest) for (let k = 0; k < 4; k++) rod(head, V(0, hh * 0.55, cz + hd * 0.1 - k * 0.2), V(0, hh * 0.55 + 1.1 - k * 0.12, cz - 0.4 - k * 0.45), 0.24, M.m(X.crest, "feather"));
  if (S.ears?.kind === "tufts") for (const side of [-1, 1]) pyramid(head, 0.4, 0.8, M.m(c.body, "feather"), side * hw * 0.35, hh * 0.6, cz, { rz: -side * 0.35, sz: 0.5 });
  // eyes on the side of the head (owls: in front)
  const E = S.eyes, s = E.s;
  for (const side of [-1, 1]) {
    const front = E.x <= 0.55, corner = front ? 0 : 1;
    const x = front ? side * (hw / 2) * E.x : side * (hw / 2 - s * 0.25), z = front ? fz - s * 0.2 : fz - s * 0.45;
    eye(J, head, side, s, V(x, hh * (0.12 + E.y), z), front ? { x: 0, z: 1 } : { x: 1, z: 0.6 }, M, S, headMat);
    void corner;
  }
  // wings (folded at rest), tail, legs
  const Wg = { ...S.wings, th: Math.max(0.2, S.wings.w * 0.1) };
  for (const side of [1, -1]) buildWing(J, body, side, V(side * (b.w / 2 + 0.02), b.h * 0.28, b.len * 0.3), Wg, S, M, "feather");
  J.wings.forEach((w, i) => { const s = i ? -1 : 1; w.rotation.set(-Math.PI / 2, s * 1.5, -s * 0.08); J.wingTips[i].rotation.y = s * 0.12; });
  const T = S.tail ?? { kind: "none" };
  if (T.kind && T.kind !== "none") {
    const tp = pivot(body, 0, b.h * 0.12, -b.len / 2 + 0.1); J.tail = [tp];
    const tm = M.m(T.color ?? c.wing ?? c.body, "feather"), tip = P.tailBand ? M.m(P.tailBand) : null;
    if (T.kind === "fan") { for (let k = -2; k <= 2; k++) { const f = pivot(tp); f.rotation.y = k * 0.16; box(f, T.w * 0.28, 0.16, T.len, tm, 0, 0, -T.len / 2, { r: 0.06 }); if (tip) box(f, T.w * 0.29, 0.18, T.len * 0.22, tip, 0, 0, -T.len * 0.88, { r: 0.04 }); } tp.rotation.x = 0.1 + tilt * 0.4; }
    else if (T.kind === "duck") { box(tp, T.w * 0.6, 0.3, T.len, tm, 0, 0, -T.len / 2, { r: 0.1 }); tp.rotation.x = 0.55; if (P.chest) rod(tp, V(0, 0.1, -T.len * 0.7), V(0, 0.6, -T.len * 0.75), 0.14, M.dark); }
    else if (T.kind === "hen" || T.kind === "rooster") {
      const n = T.kind === "rooster" ? 5 : 4, tc = T.kind === "rooster" ? M.m(T.color ?? "#1e5a3e", "feather") : tm;
      for (let k = 0; k < n; k++) { const pts = []; for (let q = 0; q <= 4; q++) { const a = q / 4; pts.push(V((k - (n - 1) / 2) * 0.22, Math.sin(a * Math.PI * 0.8) * T.len * (0.9 - k * 0.08), -a * T.len * (0.6 + k * 0.1))); } rods(tp, pts, 0.38, 0.2, tc); }
      tp.rotation.x = 0.2;
    } else if (T.kind === "long") { for (const s of [-1, 1]) { box(tp, T.w * 0.3, 0.14, T.len, tm, s * T.w * 0.14, 0, -T.len / 2, { r: 0.05 }); box(tp, T.w * 0.3, 0.15, T.len * 0.3, M.m(c.tip ?? c.wing, "feather"), s * T.w * 0.14, 0, -T.len * 0.85, { r: 0.04 }); } tp.rotation.x = 0.12 + tilt * 0.3; }
  }
  for (const side of [1, -1]) {
    const hip = V(side * b.w * (Lg.x ?? 0.3), -b.h * 0.32, -b.len * 0.05), hipR = bodyToRig(J, hip);
    const legLen = (hipR.y - Lg.foot.h) * 1.12, a = legLen * 0.42;
    const legM = M.m(c.leg, "skin"), upper = Lg.feathered ? M.m(c.body, "feather") : legM;
    const leg = makeLeg(J, body, side, hip, a, legLen - a, Lg.w, Lg.foot, { upper, lower: legM, foot: legM }, { bend: -1, thigh: Lg.feathered ? 3 : 1.4, noFoot: true });
    leg.restZ = hipR.z + 0.05; leg.restX = hipR.x;
    const fh = Lg.foot.h, fl = Lg.foot.l, ft = leg.foot;
    if (Lg.webbed) { box(ft, Lg.foot.w, fh, fl, legM, 0, -fh / 2, fl * 0.42, { r: 0.04 }); for (const x of [-0.35, 0, 0.35]) box(ft, 0.12, fh * 1.2, fl * 0.3, legM, x * Lg.foot.w, -fh / 2, fl * 0.82, { r: 0.04, detail: true }); }
    else {
      for (const ang of [-0.45, 0, 0.45]) { const tp = V(Math.sin(ang) * fl, -fh / 2, Math.cos(ang) * fl); rod(ft, V(0, -fh / 2, 0), tp, Math.max(0.1, Lg.w * 0.7), legM, { flat: 0.6 }); if (Lg.talons) box(ft, 0.14, 0.2, 0.2, flatMat(Lg.talons), tp.x, -fh / 2, tp.z + 0.05, { r: 0.04, detail: true }); }
      rod(ft, V(0, -fh / 2, 0), V(0, -fh / 2, -fl * 0.45), Math.max(0.1, Lg.w * 0.7), legM, { flat: 0.6 });
    }
  }
}

function buildFish(J, S, M, R) {
  const b = S.body, c = S.c, F = S.fins, P = S.pattern ?? {}, X = S.extra ?? {};
  const L = b.len, W = b.w, H = b.h, hl = S.head.len, segs = b.segs ?? 4, sl = (L - hl) / (segs - 1);
  const body = J.body = pivot(J.rig, 0, b.y, L / 2 - hl);
  J.head = body;
  const flatTop = !!b.headBig;
  // the head block (+z from the body pivot)
  box(body, W, H, hl + 0.3, M.body, 0, 0, hl / 2 - 0.15, { r: Math.min(W, H) * 0.3 * (b.round ?? 0.6) });
  box(body, W * 1.02, H * 0.42, hl * 0.96, M.belly, 0, -H * 0.3, hl / 2, { r: H * 0.12 });
  if (b.pointy) box(body, W * 0.6, H * 0.55, hl * 0.4, M.body, 0, H * 0.05, hl + hl * 0.12, { r: 0.25 });
  if (b.beak) box(body, W * 0.4, H * 0.25, hl * 0.45, M.body, 0, -H * 0.18, hl + hl * 0.18, { r: 0.1 });
  if (X.hammer) box(body, W * 3.0, H * 0.32, hl * 0.35, M.body, 0, H * 0.08, hl * 0.95, { r: 0.12 });
  J.spine = [];
  let pv = body, prevH = H;
  for (let i = 1; i < segs; i++) {
    const f = i / (segs - 1), hi = H * (1 - (b.taper ?? 0.35) * Math.pow(f, 1.3) * 1.7 + (b.taper ?? 0.35) * 0.12), wi = W * (1 - 0.45 * Math.pow(f, 1.2));
    const hI = Math.max(H * 0.22, hi), yo = flatTop ? (H - hI) / 2 : 0;
    const sp = pivot(pv, 0, 0, i === 1 ? 0 : -sl); J.spine.push(sp);
    box(sp, wi, hI, sl + 0.6, M.body, 0, yo, -sl / 2, { r: Math.min(wi, hI) * 0.14 });
    box(sp, wi * 1.02, hI * 0.4, sl, M.belly, 0, yo - hI * 0.3, -sl / 2, { r: hI * 0.1 });
    if (P.bands) for (const at of P.bands.at) { const zz = (at * L) - hl; if (zz >= (i - 1) * sl && zz < i * sl) { box(sp, wi * 1.04, hI * 1.04, L * 0.07, M.m(P.bands.edge), 0, yo, -(zz - (i - 1) * sl), { r: 0.08 }); box(sp, wi * 1.06, hI * 1.0, L * 0.05, M.m(P.bands.color, "plain"), 0, yo, -(zz - (i - 1) * sl), { r: 0.08 }); } }
    if (P.stripe) box(sp, wi * 1.03, hI * 0.22, sl, M.m(P.stripe), 0, yo + hI * 0.12, -sl / 2, { r: 0.04 });
    if (P.stripes) box(sp, wi * 1.03, hI * 0.6, sl * 0.18, M.m(P.stripes), 0, yo + hI * 0.15, -sl * 0.5, { r: 0.04 });
    if (P.saddle && i === 1) box(sp, wi * 0.8, 0.1, sl * 0.4, M.m(P.saddle), 0, yo + hI / 2 + 0.02, -sl * 0.7, { r: 0.03 });
    if (i === 1 && F.dorsal) { const d = F.dorsal; pyramid(sp, d * 0.9, d * 1.15, M.m(c.fin), 0, yo + hI / 2 - 0.15, -sl * 0.35, { sx: Math.max(0.16, W * 0.1) / (d * 0.9), rx: S.variant === "orca" ? -0.12 : -0.45 }); }
    if (i === segs - 2 && F.anal) box(sp, Math.max(0.12, W * 0.08), F.anal, F.anal, M.m(c.fin), 0, yo - hI / 2 - F.anal * 0.25, -sl * 0.5, { r: 0.05, rx: 0.5 });
    pv = sp; prevH = hI;
  }
  // the tail fin at the end of the last segment
  const tp = pivot(pv, 0, flatTop ? (H - prevH) / 2 : 0, -sl); J.tail = [tp];
  const ts = F.tailS, fm = M.m(c.fin, S.tex === "scale" ? "smooth" : S.tex), th = Math.max(0.14, W * 0.08);
  switch (F.tail) {
    case "fluke": for (const s of [-1, 1]) box(tp, ts * 0.62, th * 1.4, ts * 0.42, M.body, s * ts * 0.3, 0, -ts * 0.18, { r: 0.12, ry: -s * 0.45 }); break;
    case "crescent": box(tp, th, ts * 0.85, ts * 0.42, fm, 0, ts * 0.32, -ts * 0.25, { r: 0.06, rx: -0.6 }); box(tp, th, ts * 0.55, ts * 0.35, fm, 0, -ts * 0.2, -ts * 0.15, { r: 0.06, rx: 0.65 }); break;
    case "fork": for (const s of [-1, 1]) box(tp, th, ts * 0.6, ts * 0.38, fm, 0, s * ts * 0.22, -ts * 0.22, { r: 0.06, rx: -s * 0.6 }); break;
    case "round": box(tp, th, ts * 0.9, ts * 0.75, fm, 0, 0, -ts * 0.35, { r: ts * 0.3 }); break;
    default: for (const s of [-1, 1]) box(tp, th, ts * 0.8, ts * 0.75, fm, 0, s * ts * 0.3, -ts * 0.38, { r: ts * 0.25, rx: -s * 0.45 });
  }
  // pectoral fins (flippers)
  J.fins = [];
  for (const side of [-1, 1]) {
    const fp = pivot(body, side * W / 2, -H * 0.28, hl * 0.25); fp.rotation.set(0, side * 0.4, -side * 0.55);
    const pl = F.pect;
    box(fp, pl, Math.max(0.12, th * 0.6), pl * 0.6, M.m(c.fin, S.tex === "scale" ? "smooth" : S.tex), side * pl / 2, 0, -pl * 0.1, { r: 0.08 });
    J.fins.push(fp);
  }
  // face: eyes on the sides, mouth, gills, teeth, blowhole
  const E = S.eyes, s = E.s;
  J.headInfo = { hw: W, hh: H, hd: hl, cz: hl / 2, fz: hl };
  for (const side of [-1, 1]) {
    if (X.hammer) { eye(J, body, side, s, V(side * W * 1.45, H * 0.08, hl * 0.95), { x: 1, z: 0.2 }, M, S, M.body); continue; }
    if (P.eyePatch) box(body, 0.12, H * 0.3, hl * 0.3, M.m(P.eyePatch, "plain"), side * W / 2, H * 0.18, hl * 0.45, { r: 0.05 });
    eye(J, body, side, s, V(side * (W / 2 - s * 0.25), H * E.y, hl * (S.species === "whale" ? 0.6 : 0.68)), { x: 1, z: 0.15 }, M, S, M.body, { style: E.dark ? "tiny" : undefined });
  }
  const mouthY = S.species === "whale" ? -H * 0.22 : -H * 0.12;
  if (S.species === "whale") { box(body, W * 1.01, 0.1, hl * 0.85, M.dark, 0, mouthY, hl * 0.55, { r: 0.02, detail: true }); if (P.grooves) for (let k = 0; k < 5; k++) box(body, W * 0.12, 0.08, hl * 0.8, M.m(P.grooves, "plain"), (k - 2) * W * 0.17, -H / 2 - 0.02, hl * 0.5, { r: 0.02, detail: true }); }
  else box(body, W * 0.55, H * 0.1, 0.12, M.mouth, 0, mouthY, (b.pointy ? hl * 0.95 : hl) + 0.02, { r: 0.03 });
  const jaw = J.jaw = pivot(body, 0, mouthY - H * 0.05, hl * 0.3);
  box(jaw, W * 0.8, H * 0.18, hl * 0.6, M.belly, 0, -H * 0.06, hl * 0.32, { r: 0.08 });
  if (X.teeth) for (let k = 0; k < 6; k++) pyramid(body, 0.2, 0.3, M.teeth, (k - 2.5) * W * 0.14, mouthY - 0.02, (b.pointy ? hl * 0.92 : hl * 0.98), { rx: Math.PI });
  if (P.gills) for (let k = 0; k < 3; k++) for (const side of [-1, 1]) box(body, 0.06, H * 0.38, 0.1, M.m(P.gills, "plain"), side * W / 2, -H * 0.02, hl * 0.12 + k * 0.32, { r: 0.01, detail: true });
  if (X.blowhole) box(body, 0.5, 0.1, 0.3, M.dark, 0, H / 2 + 0.01, hl * 0.2, { r: 0.04, detail: true });
}

function buildSerpent(J, S, M, R) {
  const b = S.body, c = S.c, P = S.pattern ?? {}, X = S.extra ?? {};
  const n = b.segs, sl = b.len / n, W = b.w, H = b.h;
  const body = J.body = pivot(J.rig, 0, H / 2, b.len * 0.42);
  J.spine = [];
  let pv = body;
  const bandSeq = P.bands ? [c.body, ...P.bands] : null;
  for (let i = 0; i < n; i++) {
    const sp = i === 0 ? body : pivot(pv, 0, 0, -sl);
    J.spine.push(sp);
    const f = i / (n - 1), w = W * (f < 0.65 ? 1 : 1 - (f - 0.65) * 2.1), h = H * (f < 0.65 ? 1 : 1 - (f - 0.65) * 1.8);
    const mat = bandSeq ? M.m(bandSeq[i % bandSeq.length]) : M.body;
    box(sp, w, h, sl + 0.25, mat, 0, 0, -sl / 2, { r: Math.min(w, h) * 0.32 });
    box(sp, w * 0.82, 0.08, sl, M.belly, 0, -h / 2 - 0.01, -sl / 2, { r: 0.02 });
    if (P.diamonds && i % 2 === 0 && f < 0.9) box(sp, w * 0.62, 0.08, w * 0.62, M.m(P.diamonds), 0, h / 2, -sl / 2, { r: 0.03, ry: Math.PI / 4 });
    if (P.blotches && i % 2 === 1) { box(sp, w * 0.7, 0.08, sl * 0.6, M.m(P.blotches), 0, h / 2, -sl / 2, { r: 0.04 }); for (const s of [-1, 1]) box(sp, 0.08, h * 0.4, sl * 0.4, M.m(P.blotches), s * w / 2, 0, -sl * 0.3, { r: 0.03 }); }
    if (P.rings) box(sp, w * 1.04, h * 1.04, 0.12, M.m(P.rings), 0, 0, -sl * 0.05, { r: 0.05 });
    sp.rotation.y = i === 0 ? 0 : 0.34 * Math.sin(i * 0.62);
    pv = sp;
  }
  const Hd = S.head;
  const head = J.head = pivot(body, 0, 0, 0);
  box(head, Hd.w, Hd.h, Hd.d, M.body, 0, 0.02, Hd.d / 2 - 0.15, { r: Hd.h * 0.35 });
  box(head, Hd.w * 0.72, Hd.h * 0.82, Hd.d * 0.35, M.body, 0, -0.02, Hd.d - 0.1, { r: Hd.h * 0.3 });
  box(head, Hd.w * 0.9, 0.1, Hd.d * 0.9, M.belly, 0, -Hd.h / 2 + 0.02, Hd.d / 2, { r: 0.03 });
  J.headInfo = { hw: Hd.w, hh: Hd.h, hd: Hd.d, cz: Hd.d / 2, fz: Hd.d };
  for (const side of [-1, 1]) eye(J, head, side, S.eyes.s, V(side * (Hd.w / 2 - S.eyes.s * 0.25), Hd.h * S.eyes.y, Hd.d * 0.62), { x: 1, z: 0.5 }, M, S, M.body);
  const jaw = J.jaw = pivot(head, 0, -Hd.h * 0.3, 0.1);
  box(jaw, Hd.w * 0.8, Hd.h * 0.22, Hd.d * 0.85, M.belly, 0, -Hd.h * 0.05, Hd.d * 0.45, { r: 0.06 });
  box(jaw, Hd.w * 0.6, 0.08, Hd.d * 0.75, M.mouth, 0, 0.05, Hd.d * 0.45, { r: 0.02 });
  if (S.species === "snake" && S.variant !== "worm") for (const s of [-1, 1]) pyramid(head, 0.14, 0.3, M.teeth, s * Hd.w * 0.22, -Hd.h * 0.28, Hd.d * 0.85, { rx: Math.PI });
  if (!X.noTongue) {
    const tg = J.tongue = pivot(head, 0, -Hd.h * 0.2, Hd.d + 0.05);
    const tm = flatMat(c.tongue ?? "#e0283a");
    box(tg, 0.1, 0.06, 0.8, tm, 0, 0, 0.4, { r: 0.02, detail: true });
    for (const s of [-1, 1]) box(tg, 0.08, 0.06, 0.4, tm, s * 0.08, 0, 0.9, { r: 0.02, ry: s * 0.5, detail: true });
  }
  if (X.hood) { const hood = J.hood = pivot(body, 0, Hd.h * 0.1, -0.2); box(hood, Hd.w * 2.6, Hd.h * 2.6, 0.18, M.body, 0, Hd.h * 0.6, 0, { r: 0.4 }); box(hood, Hd.w * 1.4, Hd.h * 1.6, 0.2, M.belly, 0, Hd.h * 0.55, 0.02, { r: 0.3 }); hood.rotation.x = -0.25; }
}

function buildInsect(J, S, M, R) {
  const c = S.c, X = S.extra ?? {}, y = S.body.y;
  const body = J.body = pivot(J.rig, 0, y, 0);
  box(body, 1.5, 1.2, 2.2, M.body, 0, 0, 0, { r: 0.4 });
  box(body, 0.6, 0.6, 0.7, M.body, 0, -0.1, -1.35, { r: 0.2 });
  const gaster = J.gaster = pivot(body, 0, 0.1, -1.6); gaster.rotation.x = 0.25;
  if (X.beetle) { box(body, 3.0, 2.0, 4.2, M.body, 0, 0.6, -0.9, { r: 0.8 }); box(body, 0.08, 1.4, 4.2, M.dark, 0, 1.15, -0.9, { r: 0.02 }); }
  else { box(gaster, 2.5, 2.1, 3.2, M.body, 0, 0.1, -1.6, { r: 0.85 }); for (const z of [-0.9, -1.7, -2.5]) box(gaster, 2.55, 2.0, 0.12, M.belly, 0, 0.1, z, { r: 0.4 }); }
  const head = J.head = pivot(body, 0, 0.35, 1.0);
  box(head, 2.1, 1.9, 1.8, M.body, 0, 0.25, 0.85, { r: 0.6 });
  J.headInfo = { hw: 2.1, hh: 1.9, hd: 1.8, cz: 0.85, fz: 1.75 };
  for (const side of [-1, 1]) eye(J, head, side, S.eyes.s * 1.6, V(side * 0.95, 0.45, 1.05), { x: 1, z: 0.4 }, M, S, M.body, { style: "compound" });
  J.mandibles = [];
  for (const side of [-1, 1]) { const mp = pivot(head, side * 0.45, -0.45, 1.6); box(mp, 0.3, 0.25, 0.9, M.accent, -side * 0.15, 0, 0.35, { r: 0.08, ry: side * 0.5 }); J.mandibles.push(mp); }
  J.jaw = J.mandibles[0];
  J.antennae = [];
  for (const side of [-1, 1]) {
    const ap = pivot(head, side * 0.5, 1.0, 1.4); ap.rotation.set(-0.6, 0, -side * 0.35);
    rod(ap, V(0, 0, 0), V(0, 1.5, 0), 0.18, M.accent);
    const el = pivot(ap, 0, 1.5, 0); el.rotation.x = 1.3;
    rod(el, V(0, 0, 0), V(0, 1.7, 0), 0.14, M.accent); box(el, 0.28, 0.5, 0.28, M.accent, 0, 1.75, 0, { r: 0.1 });
    J.antennae.push(ap);
  }
  // six legs: femur up-out, tibia down to the ground (rotation gait: animate.js)
  J.legs = []; J.knees = []; J.insectLegs = [];
  const Lg = S.legs, f = Lg.len * 0.5, al = 0.65, beta = 0.32, hy = y - 0.35;
  const tb = (hy + f * Math.sin(al)) / Math.cos(beta);
  for (const [k, z] of [[0, 0.65], [1, 0], [2, -0.65]]) for (const side of [1, -1]) {
    const lp = pivot(body, side * 0.6, -0.35, z); lp.rotation.y = -side * (k === 0 ? 0.55 : k === 2 ? -0.6 : 0);
    const kneeP = V(side * f * Math.cos(al), f * Math.sin(al), 0);
    rod(lp, V(0, 0, 0), kneeP, Lg.w * 1.3, flatMat(c.leg ?? c.accent, { roughness: 0.4 }));
    const kn = pivot(lp, kneeP.x, kneeP.y, 0);
    rod(kn, V(0, 0, 0), V(side * tb * Math.sin(beta), -tb * Math.cos(beta), 0), Lg.w, flatMat(c.leg ?? c.accent, { roughness: 0.4 }));
    J.legs.push(lp); J.knees.push(kn); J.insectLegs.push({ lp, kn, side, k, base: lp.rotation.y });
  }
}

function buildSnail(J, S, M, R) {
  const b = S.body, c = S.c, L = b.len, W = b.w, H = b.h;
  const body = J.body = pivot(J.rig, 0, 0, 0);
  J.spine = [];
  const segs = 4, sl = L / segs;
  for (let i = 0; i < segs; i++) {
    const z = L / 2 - sl * (i + 0.5), w = W * (i === segs - 1 ? 0.6 : 1), h = H * (i === segs - 1 ? 0.65 : 1);
    const sp = pivot(body, 0, 0, z); J.spine.push(sp);
    box(sp, w, h, sl + 0.3, M.body, 0, h / 2, 0, { r: Math.min(w, h) * 0.4 });
    box(sp, w * 1.04, h * 0.25, sl, M.belly, 0, h * 0.12, 0, { r: 0.05 });
  }
  const Hd = S.head;
  const head = J.head = pivot(body, 0, H * 0.8, L * 0.38); head.rotation.x = -0.12;
  box(head, Hd.w, Hd.h, Hd.d, M.body, 0, Hd.h / 2 - 0.3, 0, { r: 0.55 });
  J.headInfo = { hw: Hd.w, hh: Hd.h, hd: Hd.d, cz: 0, fz: Hd.d / 2 };
  box(head, 0.7, 0.08, 0.06, M.dark, 0, Hd.h * 0.25, Hd.d / 2 + 0.01, { r: 0.02, detail: true });
  J.stalks = [];
  for (const side of [-1, 1]) {
    const st = pivot(head, side * 0.45, Hd.h - 0.4, 0.1); st.rotation.set(0.3, 0, -side * 0.22);
    box(st, 0.28, 1.9, 0.28, M.body, 0, 0.95, 0, { r: 0.12 });
    eye(J, st, side, S.eyes.s, V(0, 2.0, 0.08), { x: 0, z: 1 }, M, S, M.body);
    J.stalks.push(st);
    const lt = pivot(head, side * 0.5, 0.2, Hd.d / 2 - 0.1); lt.rotation.set(1.0, 0, -side * 0.4);
    box(lt, 0.2, 0.6, 0.2, M.body, 0, 0.3, 0, { r: 0.08 });
  }
  if (S.shell?.kind === "spiral") {
    const R0 = S.shell.h / 2, top = H + S.shell.h * 0.92, zc = -L * 0.08;
    J.shellTop = top;
    const sh = J.shell = pivot(body, 0, top - R0, zc);
    const spm = spiralMat(c.shell, c.shell2, c.seam);
    const geo = new THREE.CylinderGeometry(R0, R0, W, 12, 1); geo.rotateZ(Math.PI / 2);
    const cyl = new THREE.Mesh(geo, [animalMat(c.shell, "plate"), spm, spm]); cyl.castShadow = cyl.receiveShadow = true; sh.add(cyl);
    for (const s of [-1, 1]) { const hub = new THREE.Mesh(new THREE.CylinderGeometry(R0 * 0.38, R0 * 0.5, 0.35, 10).rotateZ(Math.PI / 2), animalMat(c.shell2, "plain")); hub.position.x = s * (W / 2 + 0.15); hub.castShadow = true; sh.add(hub); }
    box(sh, W * 1.05, R0 * 0.35, R0 * 0.5, animalMat(c.shell2, "smooth"), 0, -R0 * 0.82, R0 * 0.55, { r: 0.15 });
  } else box(body, W * 0.9, H * 0.8, L * 0.35, M.accent, 0, H + 0.3, -L * 0.05, { r: 0.4 });
}

function buildCephalopod(J, S, M, R) {
  const b = S.body, c = S.c, A = S.arms, P = S.pattern ?? {};
  const body = J.body = pivot(J.rig, 0, b.y, 0);
  const squid = !!b.squid;
  const mantle = J.head = pivot(body, 0, 0, 0);
  box(mantle, b.w, b.h, b.d, M.body, 0, b.h * (squid ? 0.42 : 0.3), squid ? 0 : -b.d * 0.12, { r: Math.min(b.w, b.d) * 0.4, rx: squid ? 0 : -0.3 });
  if (squid) for (const s of [-1, 1]) box(mantle, b.w * 0.9, 0.2, b.d * 0.8, M.body, s * b.w * 0.55, b.h * 0.85, 0, { r: 0.08, rz: s * 0.55 });
  if (P.spots) for (let k = 0; k < (P.spots.n ?? 8); k++) { const a = R() * Math.PI * 2, yy = b.h * (0.1 + R() * 0.6); box(mantle, 0.36, 0.36, 0.1, M.m(P.spots.color), Math.sin(a) * b.w * 0.5, yy, Math.cos(a) * b.d * 0.5 - (squid ? 0 : b.d * 0.12), { r: 0.08, ry: a, detail: true }); }
  J.headInfo = { hw: b.w, hh: b.h, hd: b.d, cz: 0, fz: b.d / 2 };
  const E = S.eyes, s = E.s;
  for (const side of [-1, 1]) eye(J, mantle, side, s, V(side * b.w * 0.36, b.h * E.y, b.d * 0.42), { x: 0.6, z: 1 }, M, S, M.body);
  box(mantle, 0.6, 0.35, 0.3, M.mouth, 0, -b.h * 0.42, b.d * 0.15, { r: 0.1 });
  J.jaw = null;
  J.tents = [];
  const n = A.n + (A.tentacles ?? 0);
  for (let k = 0; k < n; k++) {
    const isT = k >= A.n, ang = ((k % A.n) + 0.5) / A.n * Math.PI * 2 + (isT ? 0.35 : 0);
    const ring = squid ? b.w * 0.22 : b.w * 0.3;
    let pv = pivot(body, Math.cos(ang) * ring, -b.h * (squid ? 0.08 : 0.32), Math.sin(ang) * ring);
    pv.rotation.order = "YXZ"; pv.rotation.y = Math.atan2(Math.cos(ang), Math.sin(ang)); pv.rotation.x = squid ? 1.35 : 0.75;
    const segs = A.segs, len = A.len * (isT ? 1.6 : 1), sl = len / segs, chain = [];
    for (let j = 0; j < segs; j++) {
      chain.push(pv);
      const w = A.w * (1 - j / segs * 0.7) * (isT ? 0.6 : 1);
      box(pv, w, w, sl + w * 0.4, M.body, 0, 0, sl / 2, { r: w * 0.35 });
      box(pv, w * 0.7, 0.1, sl * 0.6, M.m(c.sucker ?? c.belly, "plain"), 0, -w / 2, sl / 2, { r: 0.03, detail: true });
      if (isT && j === segs - 1) box(pv, w * 2.2, w * 1.4, sl * 0.8, M.body, 0, 0, sl, { r: 0.2 });
      if (j < segs - 1) { pv = pivot(pv, 0, 0, sl); pv.rotation.x = squid ? 0.05 : (j < 1 ? 0.35 : -0.32); }
    }
    J.tents.push(chain);
  }
}

function buildPinniped(J, S, M, R) {
  const b = S.body, c = S.c, P = S.pattern ?? {}, X = S.extra ?? {}, L = b.len, W = b.w, H = b.h;
  const cl = L * 0.36;
  const body = J.body = pivot(J.rig, 0, b.y, L * 0.12);
  box(body, W, H, cl + 0.4, M.body, 0, 0, 0, { r: Math.min(W, H) * 0.25 });
  box(body, W * 0.9, H * 0.45, cl * 0.95, M.belly, 0, -H * 0.3, 0.05, { r: 0.3 });
  J.spine = [];
  let pv = body;
  for (let i = 0; i < 2; i++) {
    const sp = pivot(pv, 0, i === 0 ? -H * 0.05 : 0, i === 0 ? -cl / 2 + 0.1 : -L * 0.28); J.spine.push(sp);
    const f = (i + 1) / 3, w = W * (1 - f * 0.55), h = H * (1 - f * 0.55), sl = L * 0.3;
    box(sp, w, h, sl + 0.8, M.body, 0, -(H - h) * 0.3, -sl / 2 + 0.2, { r: Math.min(w, h) * 0.2 });
    box(sp, w * 0.9, h * 0.4, sl * 0.9, M.belly, 0, -(H - h) * 0.3 - h * 0.32, -sl / 2, { r: 0.2 });
    if (P.spots) for (let k = 0; k < 3; k++) box(sp, 0.3, 0.06, 0.3, M.m(P.spots.color), (R() - 0.5) * w * 0.6, h / 2 - (H - h) * 0.3, -R() * sl, { r: 0.05, detail: true });
    if (P.wrinkles) for (let k = 0; k < 3; k++) box(sp, w * 1.02, 0.1, 0.1, M.m(P.wrinkles), 0, -(H - h) * 0.3, -sl * (0.2 + k * 0.25), { r: 0.03, detail: true });
    pv = sp;
  }
  if (P.spots) for (let k = 0; k < 4; k++) box(body, 0.32, 0.06, 0.32, M.m(P.spots.color), (R() - 0.5) * W * 0.6, H / 2, (R() - 0.5) * cl, { r: 0.05, detail: true });
  const tp = pivot(pv, 0, -H * 0.2, -L * 0.3); J.tail = [tp];
  for (const s of [-1, 1]) box(tp, 0.9, 0.16, 1.4, M.m(c.flipper, "skin"), s * 0.45, -H * 0.12, -0.6, { r: 0.08, ry: s * 0.45 });
  // neck + head
  const neck = J.neck = pivot(body, 0, H * 0.18, cl / 2 - 0.2); neck.rotation.x = -0.75;
  box(neck, W * 0.62, W * 0.62, 1.2, M.body, 0, 0, 0.5, { r: 0.35 });
  const head = J.head = pivot(neck, 0, 0, 1.0); head.rotation.x = 0.75;
  buildHead(J, head, { ...S, head: { ...S.head, jaw: 0.25 } }, M, R);
  if (X.tusks) for (const s of [-1, 1]) rods(head, [V(s * 0.45, S.head.snout.y - S.head.snout.h * 0.4, J.headInfo.fz + 0.4), V(s * 0.5, S.head.snout.y - 1.4, J.headInfo.fz + 0.6), V(s * 0.45, S.head.snout.y - 2.3, J.headInfo.fz + 0.45)], 0.3, 0.16, M.teeth);
  // front flippers
  for (const side of [1, -1]) {
    const fp = pivot(body, side * W * 0.42, -H * 0.28, cl * 0.12); fp.rotation.set(0.35, 0, side * 0.5);
    box(fp, 0.3, 1.5, 0.9, M.m(c.flipper, "skin"), 0, -0.7, 0.15, { r: 0.1 });
    (J.legs ??= []).push(fp); (J.flippers ??= []).push(fp);
  }
}

// ------------------------------------------------------------------------------------------------ makeAnimal
const BUILD = { quadruped: buildQuad, biped: buildBiped, bird: buildBird, fish: buildFish, serpent: buildSerpent, insect: buildInsect, mollusc: buildSnail, cephalopod: buildCephalopod, pinniped: buildPinniped };
/** the merged spec of a makeAnimal spec (resolves aliases) */
export function animalSpec(spec = {}) {
  const r = resolveAnimal(spec.species ?? spec.kind ?? spec.name) ?? null;
  if (!r) return null;
  const S = specFor(r.species, spec.variant && spec.variant !== "default" ? spec.variant : r.variant);
  return spec.params ? mergeSpec(S, spec.params) : S;
}
export function makeAnimal(spec = {}) {
  const S = animalSpec(spec);
  if (!S) throw new Error(`makeAnimal: unknown animal "${spec.species ?? spec.kind}"`);
  const R = rng(hashSeed(`${S.species}/${S.variant}/${spec.seed ?? 1}`));
  const M = mats(S);
  const root = new THREE.Group(); root.name = `animal:${S.species}:${S.variant}`;
  const rig = new THREE.Group(); root.add(rig);
  const J = { rig };
  BUILD[S.plan](J, S, M, R);
  // the rest pose: legs on the ground (IK); the legless plans grounded on their lowest point
  for (const leg of J.legInfo ?? []) solveLeg(J, leg, V(leg.restX, leg.fh, leg.restZ));
  if (!J.legInfo?.length) {
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(rig);
    J.body.position.y -= bb.min.y;
  }
  if (S.plan === "fish") { root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(rig); J.body.position.z -= (bb.min.z + bb.max.z) / 2; }
  root.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(rig), sz = box0.getSize(V());
  const ref = S.ref === "height" ? box0.max.y : sz.z;
  const size = Number(spec.size) > 0 ? Number(spec.size) : S.life;
  const unit = size / Math.max(1e-6, ref);
  rig.scale.setScalar(unit);
  const rest = new Map(); rig.traverse((o) => { if (o.isGroup) rest.set(o, { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() }); });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), bs = box.getSize(V());
  const details = []; root.traverse((o) => { if (o.userData?.detail) details.push(o); });
  const focus = J.head ? J.head.getWorldPosition(V()) : V(0, box.max.y * 0.8, bs.z * 0.4);
  // giants.js-compatible params (giantSurface, back towns, creatureWorld)
  const compatPlan = S.plan === "quadruped" ? "quadruped" : S.plan === "fish" ? "swimmer" : S.plan === "mollusc" ? "slider" : S.plan;
  const pb = S.plan === "fish" ? { len: S.body.len, w: S.body.w, h: S.body.h, y: J.body.position.y } : S.plan === "mollusc" ? { len: S.body.len, w: S.body.w, h: S.body.h, y: 0 } : { len: S.body.len ?? S.body.d ?? 4, w: S.body.w ?? 2, h: S.body.h ?? 2, y: S.body.y ?? 2 };
  if (S.plan === "fish") J.deckY = S.body.h / 2;
  const params = {
    plan: compatPlan, body: pb, shell: { kind: S.shell?.kind ?? "none", h: S.shell?.h ?? 0 }, back: { deck: S.plan === "fish" && S.species === "whale", spikes: 0, wings: false },
    legs: { n: J.legInfo?.length ?? 0, knee: true }, head: { size: S.head?.h ?? 1 }, palette: { body: S.c.body, belly: S.c.belly, accent: S.c.accent, eye: S.c.iris ?? "#1b1b1f" },
    town: S.shell?.kind === "dome" || S.shell?.kind === "spiral" ? "shell" : "none", fur: /fur|shag|fluff/.test(S.tex ?? ""),
  };
  root.userData = {
    kind: "animal", rigV2: true, species: S.species, variant: S.variant, plan: S.plan, gaitKind: S.gait, spec: S, size, unit, ref,
    height: box.max.y, length: bs.z, width: bs.x, joints: J, rest, details, focus, params, legs: J.legInfo ?? [], expr: spec.expr ?? S.expr ?? "neutral", town: null, lod: "high",
  };
  return root;
}
