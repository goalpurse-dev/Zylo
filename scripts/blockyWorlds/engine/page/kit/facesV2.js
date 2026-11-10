// Blocky Worlds FACES v2 (CHARACTERS-V2, 2026-11-09; owner: "eyes with pupils + highlights + eyelids, eyebrows, 12+ mouth
// shapes, extras (sweat drop, blush, tears, anger mark)"). Our own design: big oval eyes with a coloured iris, a pupil and
// two highlights, skin-coloured eyelids (upper + lower) with a lash line, chunky brows in the hair colour, a parametric
// mouth (18 named shapes), and the extras. Never the classic two-dots-and-a-smile.
// CHARACTERS-V3 (2026-11-10): simpler, bolder decals: big round white eyes, small dark pupils, one tiny highlight, flat
// lids (no lashes), thick brows, no nose, bolder mouth strokes; blush only for embarrassed / love, no sparkles or star
// eyes by default (the fx stay drawable); facial hair decals (full / moustache / goatee / chinstrap).
//
// Everything is PARAMETRIC, so two faces blend (an expression change animates: lerpFace + the person's own blend canvas).
//   FACES                              the face names (lib/expressions.js FACE_NAMES is the same list)
//   MOUTHS                             the named mouth shapes (18)
//   faceParams(name, variant) -> P     a full parameter set: { eyeL, eyeR, browL, browR, mouth, fx }
//   lerpFace(A, B, k) -> P             numbers blend, switches flip at k = 0.5
//   drawFaceV2(ctx, P, look)           onto a 256 x 256 design square (the caller scales the canvas)
//   faceMaterialV2(name, variant, look)               cached material per (face, variant, the person's face look)
//   blendMaterialV2(slot, from, to, k, variant, look) a person's own canvas, redrawn only when the 1/8 step changes
// The face plane (people.js) covers the front of the head: design y 0 = the hairline, y 256 = the chin. Hats and hair
// stay above design y ~30, the brows sit at ~60-75, the eyes at ~112, the mouth at ~190.
import * as THREE from "three";
import { cachedMat } from "./kitCommon.js";

const INK = "#24171d", MOUTH_IN = "#55141f", TONGUE = "#ff8a9a";
export const EYE = Object.freeze({ y: 118, lx: 82, rx: 174, rw: 33, rh: 34 });
export const PUPIL_R = 11.5; // CHARACTERS-V3: a small dark pupil (x eye.pupil), about a third of the eye
const BROW_Y = 66, MOUTH_Y = 192;

// ------------------------------------------------------------------------------------------------- parameter shapes
const EYE0 = { open: 1, wide: 1, pupil: 1, lookX: 0, lookY: 0, lid: 0.08, tilt: 0, low: 0, arc: -1, squeeze: 0, shape: "round", shine: 1 };
const BROW0 = { dy: 0, inner: 0, outer: 0, arch: 0.3, len: 1, thick: 1 };
const MOUTH0 = { w: 22, open: 0, curve: 0, skew: 0, round: 0, teeth: 0, clench: 0, tongue: 0, tongueOut: 0, wavy: 0, cat: 0, pout: 0, dy: 0 };
const FX0 = { blush: 0, hatch: 0, sweat: 0, tears: 0, stream: 0, anger: 0, sparkle: 0, gloom: 0, puff: 0, spray: 0, effort: 0, mime: 0, finger: 0 };

/** the 18 named mouth shapes */
export const MOUTHS = Object.freeze({
  flat: { w: 22 },
  softSmile: { w: 24, curve: 0.45 },
  smile: { w: 28, curve: 0.8 },
  grin: { w: 32, curve: 0.85, open: 0.42, teeth: 1 },
  laugh: { w: 34, curve: 0.95, open: 1, tongue: 0.8, teeth: 0.7 },
  frown: { w: 24, curve: -0.75 },
  sadOpen: { w: 24, curve: -0.6, open: 0.6, tongue: 0.5 },
  o: { w: 18, open: 0.8, round: 1, tongue: 0.4 },
  smallO: { w: 10, open: 0.38, round: 1 },
  gasp: { w: 17, open: 1.15, round: 1, tongue: 0.35 },
  wavy: { w: 26, wavy: 1 },
  smirk: { w: 24, curve: 0.35, skew: 0.85 },
  clench: { w: 30, open: 0.55, clench: 1, curve: -0.25 },
  grimace: { w: 33, open: 0.45, clench: 1, wavy: 0.6, curve: -0.05 },
  yell: { w: 36, open: 1.3, round: 0.35, teeth: 1, tongue: 1, curve: -0.15 },
  pout: { w: 12, pout: 1, curve: -0.2 },
  tongueOut: { w: 26, curve: 0.6, tongueOut: 1 },
  cat: { w: 22, cat: 1 },
});

// face = { eye (both), eyeL / eyeR (one side), brow, browL / browR, mouth: name | params, fx }
const F = (o) => o;
const PRESETS = {
  // the planner's faces (+ mime)
  neutral: F({ eye: { lid: 0.04 }, brow: { dy: 4 }, mouth: "softSmile" }), // owner: never a blank face; neutral is a soft, friendly rest
  calm: F({ eye: { lid: 0.2, low: 0.08 }, brow: { dy: 4, arch: 0.4 }, mouth: "softSmile" }),
  happy: F({ eye: { lid: 0.04, low: 0.22, pupil: 1.05 }, brow: { dy: -4, arch: 0.6 }, mouth: "smile" }),
  excited: F({ eye: { open: 1.12, wide: 1.06, pupil: 1.15, lid: 0 }, brow: { dy: -10, arch: 0.7 }, mouth: "grin" }),
  sad: F({ eye: { lid: 0.3, tilt: -0.35, lookY: 6 }, brow: { dy: 6, inner: 12 }, mouth: "frown", fx: {} }),
  scared: F({ eye: { open: 1.2, wide: 1.06, pupil: 0.55, lid: 0 }, brow: { dy: -8, inner: 12 }, mouth: "grimace", fx: { sweat: 1, gloom: 0.6 } }),
  surprised: F({ eye: { open: 1.25, wide: 1.08, pupil: 0.7, lid: 0 }, brow: { dy: -14, arch: 0.8 }, mouth: "o" }),
  angry: F({ eye: { lid: 0.38, tilt: 0.45, pupil: 0.85 }, brow: { dy: 10, inner: -14, thick: 1.15 }, mouth: "clench", fx: { anger: 1 } }),
  sleepy: F({ eye: { open: 0.05, arc: -1 }, brow: { dy: 8, inner: 2 }, mouth: "smallO" }),
  smirk: F({ eye: { lid: 0.34, lookX: 6 }, browL: { dy: 6 }, browR: { dy: -10, arch: 0.7 }, mouth: "smirk" }),
  cry: F({ eye: { squeeze: 1 }, brow: { dy: 4, inner: 14 }, mouth: "sadOpen", fx: { stream: 1, tears: 1 } }),
  shush: F({ eye: { lid: 0.16, lookX: -8 }, browL: { dy: -6 }, browR: { dy: 3 }, mouth: "smallO", fx: { finger: 1 } }),
  yell: F({ eye: { squeeze: 1 }, brow: { dy: 10, inner: -12, thick: 1.15 }, mouth: "yell", fx: { effort: 1, anger: 0.6 } }),
  sneeze: F({ eye: { squeeze: 1 }, brow: { dy: 12, inner: -4 }, mouth: { w: 24, open: 0.7, round: 0.8, tongue: 0.3 }, fx: { spray: 1 } }),
  mime: F({ eye: { open: 1.05, lid: 0.05 }, brow: { dy: -8, inner: 3 }, mouth: "pout", fx: { mime: 1 } }),
  // CHARACTERS-V2: the richer faces
  laugh: F({ eye: { open: 0.05, arc: 1 }, brow: { dy: -8, arch: 0.7 }, mouth: "laugh", fx: { tears: 0.35 } }),
  proud: F({ eye: { lid: 0.36, low: 0.12, lookY: -2 }, brow: { dy: -4, arch: 0.5 }, mouth: "smile" }),
  worried: F({ eye: { lid: 0.12, pupil: 0.8, lookX: -5 }, brow: { dy: -2, inner: 14 }, mouth: "wavy", fx: { sweat: 0.8 } }),
  determined: F({ eye: { lid: 0.3, tilt: 0.3, pupil: 0.95, low: 0.12 }, brow: { dy: 8, inner: -10, thick: 1.15 }, mouth: { w: 24, curve: -0.25, skew: 0.15 }, fx: { effort: 0.4 } }),
  embarrassed: F({ eye: { lid: 0.22, lookX: 9, lookY: 6, pupil: 0.85 }, brow: { dy: 0, inner: 9 }, mouth: "wavy", fx: { blush: 1, hatch: 1, sweat: 0.7 } }),
  confused: F({ eyeL: { open: 0.82, lid: 0.25 }, eyeR: { open: 1.15, lid: 0 }, browL: { dy: 8, inner: -4 }, browR: { dy: -14, arch: 0.8 }, mouth: { w: 18, curve: -0.2, skew: -0.7, wavy: 0.4 } }),
  disgusted: F({ eye: { lid: 0.42, low: 0.3, tilt: 0.15, lookX: -6 }, brow: { dy: 10, inner: -8 }, mouth: "tongueOut", fx: { gloom: 0.7 } }),
  love: F({ eye: { open: 1.08, pupil: 1.25, lid: 0.04, shape: "heart" }, brow: { dy: -6, arch: 0.6 }, mouth: "smile", fx: { blush: 0.9 } }),
  nervous: F({ eye: { open: 1.05, pupil: 0.6, lid: 0.04, lookX: 7 }, brow: { dy: -4, inner: 11 }, mouth: "grimace", fx: { sweat: 1 } }),
  curious: F({ eye: { open: 1.08, pupil: 1.05, lid: 0.05, lookX: 6, lookY: -3 }, browL: { dy: 2 }, browR: { dy: -12, arch: 0.7 }, mouth: { w: 16, open: 0.25, round: 0.8 } }),
  relieved: F({ eye: { open: 0.05, arc: -1 }, brow: { dy: -2, inner: 6 }, mouth: "smile", fx: { sweat: 0.6 } }),
  grumpy: F({ eye: { lid: 0.45, tilt: 0.2, lookY: 3 }, brow: { dy: 10, inner: -9, thick: 1.15 }, mouth: "pout", fx: {} }),
  awe: F({ eye: { open: 1.2, wide: 1.05, pupil: 1.3, lid: 0, lookY: -6 }, brow: { dy: -12, inner: 6, arch: 0.6 }, mouth: "o" }),
  silly: F({ eyeL: { open: 0.05, arc: 1 }, eyeR: { open: 1.15, pupil: 1.1, lid: 0 }, brow: { dy: -8, arch: 0.7 }, mouth: "tongueOut" }),
  shocked: F({ eye: { open: 1.32, wide: 1.12, pupil: 0.42, lid: 0 }, brow: { dy: -18, inner: 8 }, mouth: "gasp", fx: { gloom: 1, sweat: 0.6 } }),
  bored: F({ eye: { lid: 0.55, lookX: -8, lookY: 2 }, brow: { dy: 8 }, mouth: { w: 20, curve: -0.15, skew: -0.3 } }),
  hopeful: F({ eye: { open: 1.1, pupil: 1.15, lid: 0, lookY: -6, shine: 1.4 }, brow: { dy: -6, inner: 10 }, mouth: "softSmile" }),
};
export const FACES = Object.freeze(Object.keys(PRESETS));

const merge = (base, o) => Object.assign({}, base, o ?? {});
const mouthOf = (m) => merge(MOUTH0, typeof m === "string" ? MOUTHS[m] : m);
function normalize(pr) {
  return {
    eyeL: merge(merge(EYE0, pr.eye), pr.eyeL), eyeR: merge(merge(EYE0, pr.eye), pr.eyeR),
    browL: merge(merge(BROW0, pr.brow), pr.browL), browR: merge(merge(BROW0, pr.brow), pr.browR),
    mouth: mouthOf(pr.mouth ?? "flat"), fx: merge(FX0, pr.fx),
  };
}
/** variants: "base", "blink" (eyes shut), "talk" (open A mouth), "talkO" (rounded), "blow" (puffed cheeks) */
export const VARIANTS = Object.freeze(["base", "blink", "talk", "talkO", "blow"]);
/** the full parameter set of a face (+ a variant) */
export function faceParams(name, variant = "base") {
  const n = PRESETS[name] ? name : "neutral";
  const P = normalize(PRESETS[n]);
  if (variant === "blink") for (const e of [P.eyeL, P.eyeR]) if (!e.squeeze && e.open > 0.12) { e.open = 0.04; e.arc = -1; }
  if (variant === "talk" || variant === "talkO") {
    if (n === "sneeze") { // the "ah-" wind-up: eyes half shut looking up, a small O
      for (const e of [P.eyeL, P.eyeR]) Object.assign(e, { squeeze: 0, open: 0.8, lid: 0.5, lookY: -8 });
      P.browL.dy = P.browR.dy = -12; P.browL.inner = P.browR.inner = 8; P.mouth = mouthOf({ w: 13, open: 0.45, round: 1 }); P.fx.spray = 0;
    } else if (!["shush", "sleepy", "mime"].includes(n)) {
      const m = P.mouth, o = variant === "talkO";
      m.open = Math.max(m.open, o ? 0.6 : 0.55); m.round = o ? Math.max(m.round, 0.85) : m.round * 0.6; m.w = o ? Math.min(m.w, 18) : Math.max(m.w, 22);
      m.tongue = Math.max(m.tongue, 0.45); m.cat = 0; m.pout = 0; m.wavy *= 0.5; if (m.clench > 0.5 && n !== "angry") m.clench = 0;
    }
  }
  if (variant === "blow") { P.mouth = mouthOf({ w: 10, open: 0.3, round: 1 }); P.fx.puff = 1; }
  return P;
}
const lerpObj = (a, b, k) => { const o = {}; for (const key of Object.keys(a)) { const x = a[key], y = b[key]; o[key] = typeof x === "number" && typeof y === "number" ? x + (y - x) * k : k < 0.5 ? x : y; } return o; };
/** a face part way from A to B (k 0..1) */
export function lerpFace(A, B, k) {
  k = Math.max(0, Math.min(1, k));
  return { eyeL: lerpObj(A.eyeL, B.eyeL, k), eyeR: lerpObj(A.eyeR, B.eyeR, k), browL: lerpObj(A.browL, B.browL, k), browR: lerpObj(A.browR, B.browR, k), mouth: lerpObj(A.mouth, B.mouth, k), fx: lerpObj(A.fx, B.fx, k) };
}

// ------------------------------------------------------------------------------------------------- the person's face look
const IRIS = ["#5a3a22", "#3d6fb0", "#3f8a55", "#7a5230", "#2f2a28", "#6a7f9a", "#8a6a2a"];
/** the face bits of a look: iris colour, brow colour, skin, glasses, beard (a stable key for caches) */
export function faceLook(look = {}) {
  const hair = look.hairColor ?? "#2a1a10";
  const c = new THREE.Color(hair), hsl = {}; c.getHSL(hsl);
  // brows: the hair colour, darkened (linear space: 0.12 ~ 40% in sRGB) so grey / blonde brows read bold on the skin
  const brow = `#${c.clone().multiplyScalar(hsl.l > 0.55 ? 0.12 : hsl.l > 0.3 ? 0.2 : 0.6).getHexString()}`;
  const seed = Math.abs(Math.round((look.phase ?? 0) * 1000));
  return { skin: look.skin ?? "#e7b38e", iris: look.eyeColor ?? IRIS[seed % IRIS.length], brow: look.role === "baby" ? "#c8a07a" : brow, glasses: look.glasses || false, beard: look.beard ?? null, facial: look.beard ? look.facial ?? "full" : null, mime: !!look.mimePaint };
}
const lookKey = (L) => `${L.skin}|${L.brow}|${L.glasses}|${L.beard ?? ""}|${L.facial ?? ""}`;

// ------------------------------------------------------------------------------------------------- drawing
function heartPath(p, x, y, r) {
  p.beginPath(); p.moveTo(x, y + r * 0.9);
  p.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
  p.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9); p.closePath();
}
function starPath(p, x, y, r, n = 4, inner = 0.38) {
  p.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  p.closePath();
}

// CHARACTERS-V3 (owner 2026-11-10: "simpler bold cartoon decals like the reference: big round eyes with small pupils,
// eyebrows, simple expressive mouths, sweat drops; remove the anime eyelashes, sparkles and blush as defaults"): the
// eye is a big round white disc with a bold outline, a small dark pupil and ONE tiny highlight; a lid is a flat skin
// band with the same bold line (no lash line, no lash flick). Never the classic two-dots-and-a-smile: ours always has
// whites, pupils and thick brows.
const OUT = 7.5;
function drawEye(p, e, cx, side, L) {
  // side: +1 = the viewer's left eye (its inner corner toward +x), -1 = the right one
  const cy = EYE.y;
  p.strokeStyle = INK; p.lineCap = p.lineJoin = "round";
  if (e.squeeze > 0.5) { // > <
    p.lineWidth = 10; p.beginPath();
    p.moveTo(cx - side * 18, cy - 15); p.lineTo(cx + side * 14, cy); p.lineTo(cx - side * 18, cy + 15); p.stroke();
    return;
  }
  const rw = EYE.rw * e.wide, rh = EYE.rh * e.open;
  if (e.open < 0.14) { // shut: ∩ (a happy squint) or ∪ (relaxed / asleep)
    p.lineWidth = 10; p.beginPath();
    if (e.arc > 0) p.arc(cx, cy + 14, rw * 0.85, Math.PI * 1.15, Math.PI * 1.85); else p.arc(cx, cy - 6, rw * 0.85, Math.PI * 0.15, Math.PI * 0.85);
    p.stroke();
    return;
  }
  const tilt = e.tilt * side, lidY = -rh + Math.max(0, Math.min(0.92, e.lid)) * 2 * rh, lowY = rh - Math.max(0, Math.min(0.6, e.low)) * 2 * rh;
  p.save(); p.beginPath(); p.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2); p.clip();
  p.fillStyle = "#ffffff"; p.fillRect(cx - rw - 4, cy - rh - 4, rw * 2 + 8, rh * 2 + 8);
  // the pupil (small, dark) + one tiny highlight; a heart for love
  const ix = cx + e.lookX, iy = cy + e.lookY + 1, pr = PUPIL_R * e.pupil;
  if (e.shape === "heart") { p.fillStyle = "#e8365d"; heartPath(p, ix, iy, 19 * e.pupil); p.fill(); }
  else { p.fillStyle = INK; p.beginPath(); p.arc(ix, iy, pr, 0, Math.PI * 2); p.fill(); }
  p.fillStyle = "#ffffff"; p.beginPath(); p.arc(ix + pr * 0.38, iy - pr * 0.4, Math.max(2.4, pr * 0.3) * Math.min(1.3, e.shine), 0, Math.PI * 2); p.fill();
  // a smiling / squinting lower lid: a skin crescent from below
  if (e.low > 0.02) { p.fillStyle = L.skin; p.beginPath(); p.ellipse(cx, cy + rh + (lowY - rh) * 0.2, rw * 1.3, (rh - lowY) * 0.9, 0, Math.PI, 0, true); p.fill(); }
  // the upper lid: a flat skin band above the lid line
  if (e.lid > 0.02) { p.translate(cx, cy); p.rotate(tilt); p.fillStyle = L.skin; p.fillRect(-rw * 2, -rh * 2 - 4, rw * 4, rh * 2 + 4 + lidY); p.rotate(-tilt); p.translate(-cx, -cy); }
  p.restore();
  // the bold outline, the lid line in the same weight
  p.strokeStyle = INK; p.lineWidth = OUT; p.beginPath(); p.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2); p.stroke();
  if (e.lid > 0.02) {
    p.save(); p.beginPath(); p.ellipse(cx, cy, rw + 4, rh + 4, 0, 0, Math.PI * 2); p.clip();
    p.translate(cx, cy); p.rotate(tilt); p.lineWidth = OUT; p.beginPath(); p.moveTo(-rw * 1.4, lidY); p.lineTo(rw * 1.4, lidY); p.stroke(); p.restore();
  }
  if (e.low > 0.02) { p.save(); p.beginPath(); p.ellipse(cx, cy, rw + 4, rh + 4, 0, 0, Math.PI * 2); p.clip(); p.lineWidth = 6; p.beginPath(); p.ellipse(cx, cy + rh + (lowY - rh) * 0.2, rw * 1.3, (rh - lowY) * 0.9, 0, Math.PI * 1.08, Math.PI * 1.92); p.stroke(); p.restore(); }
}

function drawBrow(p, b, cx, side, color) {
  // a thick, simple, rounded stroke; inner > 0 raises the inner end (worried / sad), < 0 lowers it (angry)
  const half = 23 * b.len, y = BROW_Y + b.dy;
  const xi = cx + side * half * 0.85, xo = cx - side * half;
  const yi = y - b.inner * 0.9, yo = y + b.inner * 0.25 + b.outer;
  const mx = (xi + xo) / 2, my = (yi + yo) / 2 - 9 * b.arch;
  p.strokeStyle = color; p.lineCap = "round"; p.lineWidth = 13 * b.thick;
  p.beginPath(); p.moveTo(xo, yo); p.quadraticCurveTo(mx, my, xi, yi); p.stroke();
}

/** facial hair decals (CHARACTERS-V3): bold flat shapes in the beard colour, drawn under the mouth so it stays readable */
function drawFacial(p, L) {
  if (!L.beard) return;
  p.fillStyle = L.beard; p.strokeStyle = L.beard; p.lineCap = p.lineJoin = "round";
  const k = L.facial ?? "full";
  if (k === "full") { p.beginPath(); p.moveTo(24, 168); p.lineTo(48, 168); p.quadraticCurveTo(70, 210, 128, 212); p.quadraticCurveTo(186, 210, 208, 168); p.lineTo(232, 168); p.lineTo(232, 256); p.lineTo(24, 256); p.closePath(); p.fill(); }
  if (k === "full" || k === "moustache") { p.beginPath(); p.moveTo(84, 182); p.quadraticCurveTo(100, 160, 128, 168); p.quadraticCurveTo(156, 160, 172, 182); p.quadraticCurveTo(150, 176, 128, 180); p.quadraticCurveTo(106, 176, 84, 182); p.closePath(); p.fill(); p.lineWidth = 6; p.stroke(); }
  if (k === "goatee") { p.beginPath(); p.roundRect(104, 212, 48, 40, 14); p.fill(); p.beginPath(); p.roundRect(96, 168, 64, 14, 7); p.fill(); }
  if (k === "chinstrap") { p.lineWidth = 18; p.beginPath(); p.moveTo(26, 140); p.quadraticCurveTo(40, 246, 128, 246); p.quadraticCurveTo(216, 246, 230, 140); p.stroke(); }
}

function mouthEdges(m, cy) {
  const N = 22, top = [], bot = [];
  const h = m.open * 30, r = Math.max(0, Math.min(1, m.round));
  const w = m.w * (1 - 0.35 * r);
  const tk = 0.12 + 0.45 * Math.max(0, -m.curve), bk = 0.9 - 0.42 * Math.max(0, -m.curve);
  for (let i = 0; i <= N; i++) {
    const s = -1 + (2 * i) / N, x = 128 + w * s;
    const lift = cy - m.curve * 13 * s * s - m.skew * 10 * s + m.curve * 3;
    const wv = m.wavy * 3.5 * Math.sin(s * Math.PI * 3);
    const ell = Math.sqrt(Math.max(0, 1 - s * s));
    const t1 = lift - h * tk * (1 - s * s) + wv, b1 = lift + h * bk * Math.pow(1 - s * s, 0.85) + wv;
    const t2 = cy - (h / 2) * ell, b2 = cy + (h / 2) * ell;
    top.push([x, t1 + (t2 - t1) * r]); bot.push([x, b1 + (b2 - b1) * r]);
  }
  return { top, bot, w, h };
}
function drawMouth(p, m, L) {
  const cy = MOUTH_Y + m.dy;
  p.strokeStyle = INK; p.lineCap = p.lineJoin = "round";
  if (m.cat > 0.5) { // a little "w"
    p.lineWidth = 10; p.beginPath();
    p.moveTo(128 - m.w, cy - 6); p.quadraticCurveTo(128 - m.w / 2, cy + 12, 128, cy - 2); p.quadraticCurveTo(128 + m.w / 2, cy + 12, 128 + m.w, cy - 6); p.stroke();
    return;
  }
  if (m.pout > 0.5 && m.open < 0.1) { // pursed lips pushed out
    p.fillStyle = MOUTH_IN; p.lineWidth = 7;
    p.beginPath(); p.ellipse(128, cy, m.w + 3, 9, 0, 0, Math.PI * 2); p.fill(); p.stroke();
    return;
  }
  if (m.open < 0.08) { // a line mouth (smile / frown / flat / wavy / smirk), the middle dipping for a smile
    p.lineWidth = 11; p.beginPath();
    for (let i = 0; i <= 24; i++) {
      const s = -1 + i / 12, x = 128 + m.w * s;
      const y = cy - m.curve * 13 * s * s - m.skew * 10 * s + m.curve * 6 * (1 - s * s) + m.wavy * 4 * Math.sin(s * Math.PI * 3);
      if (i) p.lineTo(x, y); else p.moveTo(x, y);
    }
    p.stroke();
  } else {
    const { top, bot, w, h } = mouthEdges(m, cy);
    const path = () => { p.beginPath(); top.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i][0], bot[i][1]); p.closePath(); };
    path(); p.fillStyle = m.clench > 0.5 ? "#ffffff" : MOUTH_IN; p.fill();
    p.save(); path(); p.clip();
    const ty = Math.min(...top.map((q) => q[1])), by = Math.max(...bot.map((q) => q[1]));
    if (m.clench > 0.5) { // gritted teeth: a middle line + gaps
      p.strokeStyle = INK; p.lineWidth = 3.5; p.beginPath(); p.moveTo(128 - w, (ty + by) / 2); p.lineTo(128 + w, (ty + by) / 2);
      for (let k = -2; k <= 2; k++) { p.moveTo(128 + k * w * 0.36, ty - 2); p.lineTo(128 + k * w * 0.36, by + 2); }
      p.stroke();
    } else {
      if (m.tongue > 0.02) { p.fillStyle = TONGUE; p.beginPath(); p.ellipse(128, by - h * 0.12, w * 0.55 * Math.min(1, m.tongue + 0.3), Math.max(5, h * 0.36 * m.tongue), 0, 0, Math.PI * 2); p.fill(); }
      if (m.teeth > 0.02) { // the top teeth follow the upper lip
        p.fillStyle = "#ffffff"; p.beginPath(); top.forEach(([x, y], i) => (i ? p.lineTo(x, y - 3) : p.moveTo(x, y - 3)));
        for (let i = top.length - 1; i >= 0; i--) p.lineTo(top[i][0], top[i][1] + 4 + 9 * m.teeth); p.closePath(); p.fill();
      }
    }
    p.restore();
    path(); p.strokeStyle = INK; p.lineWidth = 8; p.stroke();
  }
  if (m.tongueOut > 0.02) { // the tongue poking out of a smile, at one side
    const k = m.tongueOut, tx = 128 + m.w * 0.25, ty = cy + 3;
    p.fillStyle = TONGUE; p.strokeStyle = INK; p.lineWidth = 5;
    p.beginPath(); p.moveTo(tx - 11 * k, ty); p.lineTo(tx - 11 * k, ty + 12 * k); p.arc(tx, ty + 12 * k, 11 * k, Math.PI, 0, true); p.lineTo(tx + 11 * k, ty); p.closePath(); p.fill(); p.stroke();
    p.lineWidth = 2.5; p.beginPath(); p.moveTo(tx, ty + 3); p.lineTo(tx, ty + 14 * k); p.stroke();
    // redraw the lip line over the tongue root
    p.lineWidth = 9; p.beginPath(); p.moveTo(tx - 13 * k, ty - 1); p.lineTo(tx + 13 * k, ty - 1 - 2 * m.curve); p.stroke();
  }
}

function drawFx(p, fx, L) {
  const a = (x) => Math.max(0, Math.min(1, x));
  if (fx.mime > 0.5) { // white-face make-up marks above and below each eye
    p.strokeStyle = INK; p.lineWidth = 4;
    for (const cx of [EYE.lx, EYE.rx]) { p.beginPath(); p.moveTo(cx, EYE.y - 58); p.lineTo(cx, EYE.y - 42); p.moveTo(cx, EYE.y + 40); p.lineTo(cx, EYE.y + 56); p.stroke(); }
  }
  if (fx.blush > 0.02) {
    p.fillStyle = `rgba(255,105,120,${0.55 * a(fx.blush)})`;
    for (const x of [50, 206]) { p.beginPath(); p.ellipse(x, 166, 24, 13, 0, 0, Math.PI * 2); p.fill(); }
    if (fx.hatch > 0.3) { p.strokeStyle = `rgba(200,40,70,${0.8 * a(fx.hatch)})`; p.lineWidth = 3.5; for (const x of [50, 206]) for (const dx of [-11, 0, 11]) { p.beginPath(); p.moveTo(x + dx - 4, 172); p.lineTo(x + dx + 4, 160); p.stroke(); } }
  }
  if (fx.puff > 0.02) { // puffed cheeks
    p.fillStyle = `rgba(255,150,160,${0.8 * a(fx.puff)})`; p.strokeStyle = INK; p.lineWidth = 4;
    for (const x of [62, 194]) { p.beginPath(); p.arc(x, 178, 28 * a(fx.puff), 0, Math.PI * 2); p.fill(); p.stroke(); }
  }
  if (fx.gloom > 0.02) { // the blue "uh-oh" lines over the forehead
    p.strokeStyle = `rgba(80,90,200,${0.65 * a(fx.gloom)})`; p.lineWidth = 4;
    for (let k = 0; k < 7; k++) { const x = 60 + k * 23; p.beginPath(); p.moveTo(x, 6); p.lineTo(x, 26 + (k % 2) * 12); p.stroke(); }
  }
  if (fx.sweat > 0.02) { // a sweat drop at the temple
    const s = a(fx.sweat), x = 226, y = 52;
    p.fillStyle = `rgba(120,205,255,${0.95 * s})`; p.strokeStyle = `rgba(36,23,29,${s})`; p.lineWidth = 4;
    p.beginPath(); p.moveTo(x, y - 20 * s); p.quadraticCurveTo(x + 16 * s, y + 6, x, y + 12 * s); p.quadraticCurveTo(x - 16 * s, y + 6, x, y - 20 * s); p.fill(); p.stroke();
    p.fillStyle = `rgba(255,255,255,${0.9 * s})`; p.beginPath(); p.arc(x - 4, y + 3, 3, 0, Math.PI * 2); p.fill();
  }
  if (fx.tears > 0.02) { // drops at the outer corners
    p.fillStyle = `rgba(110,195,255,${0.95 * a(fx.tears)})`; p.strokeStyle = `rgba(36,23,29,${0.8 * a(fx.tears)})`; p.lineWidth = 3;
    for (const [x, d] of [[EYE.lx - 30, -1], [EYE.rx + 30, 1]]) { const y = EYE.y + 22; p.beginPath(); p.moveTo(x, y - 9); p.quadraticCurveTo(x + d * 9, y + 6, x, y + 10); p.quadraticCurveTo(x - d * 9, y + 6, x, y - 9); p.fill(); p.stroke(); }
  }
  if (fx.stream > 0.02) { // tear streams down the cheeks
    p.fillStyle = `rgba(110,195,255,${0.9 * a(fx.stream)})`;
    for (const x of [EYE.lx, EYE.rx]) { p.beginPath(); p.roundRect(x - 8, EYE.y + 8, 16, 70 * a(fx.stream), 8); p.fill(); p.beginPath(); p.arc(x, EYE.y + 8 + 70 * a(fx.stream), 10, 0, Math.PI * 2); p.fill(); }
  }
  if (fx.anger > 0.02) { // the cross-shaped "popping vein" mark at the forehead corner
    const s = a(fx.anger), x = 40, y = 34;
    p.strokeStyle = `rgba(225,30,45,${s})`; p.lineWidth = 6; p.lineCap = "round";
    for (const [dx, dy, r0] of [[-1, -1, 0], [1, -1, 0.5], [-1, 1, 1.5], [1, 1, 1]]) { p.beginPath(); p.arc(x + dx * 11, y + dy * 11, 8, Math.PI * r0, Math.PI * (r0 + 0.5) + Math.PI * 0.001); p.stroke(); }
  }
  if (fx.sparkle > 0.02) { // little four-point stars by the eyes
    p.fillStyle = `rgba(255,232,120,${a(fx.sparkle)})`; p.strokeStyle = `rgba(36,23,29,${0.7 * a(fx.sparkle)})`; p.lineWidth = 2.5;
    for (const [x, y, r] of [[22, 92, 11], [234, 84, 13], [228, 128, 7]]) { starPath(p, x, y, r * a(fx.sparkle), 4, 0.35); p.fill(); p.stroke(); }
  }
  if (fx.effort > 0.02) { // strain lines at both temples
    p.strokeStyle = `rgba(36,23,29,${a(fx.effort)})`; p.lineWidth = 5;
    for (const [sx, x0] of [[-1, 30], [1, 226]]) for (const [dy, len] of [[-18, 14], [0, 18], [18, 14]]) { p.beginPath(); p.moveTo(x0, 112 + dy * 1.2); p.lineTo(x0 + sx * len, 112 + dy * 1.2 + dy * 0.5); p.stroke(); }
  }
  if (fx.spray > 0.02) { // a sneeze
    p.fillStyle = "rgba(140,210,255,0.95)"; p.strokeStyle = INK; p.lineWidth = 3;
    for (const [x, y, r] of [[92, 230, 7], [112, 242, 6], [140, 244, 7], [164, 232, 6], [78, 214, 5], [180, 216, 5], [126, 252, 5]]) { p.beginPath(); p.arc(x, y, r, 0, Math.PI * 2); p.fill(); p.stroke(); }
  }
  if (fx.finger > 0.5) { // a finger over the lips
    p.fillStyle = L.skin; p.strokeStyle = INK; p.lineWidth = 5;
    p.beginPath(); p.roundRect(134, 156, 24, 120, 12); p.fill(); p.stroke();
    p.strokeStyle = "rgba(36,23,29,0.5)"; p.lineWidth = 3; p.beginPath(); p.moveTo(139, 174); p.lineTo(153, 174); p.stroke();
  }
}

function drawGlasses(p, kind) {
  const k = kind === true ? "square" : String(kind);
  p.save();
  p.strokeStyle = "#3b2f2f"; p.lineWidth = 5;
  const lens = (cx) => {
    p.beginPath();
    if (k === "round") p.ellipse(cx, EYE.y + 2, 38, 37, 0, 0, Math.PI * 2);
    else if (k === "half") { p.moveTo(cx - 38, EYE.y + 8); p.lineTo(cx + 38, EYE.y + 8); p.quadraticCurveTo(cx + 36, EYE.y + 40, cx, EYE.y + 40); p.quadraticCurveTo(cx - 36, EYE.y + 40, cx - 38, EYE.y + 8); }
    else p.roundRect(cx - 39, EYE.y - 32, 78, 70, 12);
  };
  // a faint lens tint + a glint: the eyes always show through (owner: glasses transparent-ish)
  for (const cx of [EYE.lx, EYE.rx]) { lens(cx); p.fillStyle = "rgba(190,225,255,0.14)"; p.fill(); p.stroke(); }
  p.strokeStyle = "rgba(255,255,255,0.75)"; p.lineWidth = 4;
  for (const cx of [EYE.lx, EYE.rx]) { p.beginPath(); p.moveTo(cx + 14, EYE.y - 22); p.lineTo(cx + 26, EYE.y - 10); p.stroke(); }
  p.strokeStyle = "#3b2f2f"; p.lineWidth = 5; p.beginPath(); p.moveTo(EYE.lx + 38, EYE.y - 2); p.quadraticCurveTo(128, EYE.y - 12, EYE.rx - 38, EYE.y - 2); p.stroke();
  p.restore();
}

/** draws a face (params P) for a person's face look L onto a 256 x 256 design square */
export function drawFaceV2(p, P, L) {
  p.lineCap = p.lineJoin = "round";
  drawFacial(p, L); // under everything else, so every mouth stays readable on it
  drawEye(p, P.eyeL, EYE.lx, 1, L); drawEye(p, P.eyeR, EYE.rx, -1, L);
  if (L.glasses) drawGlasses(p, L.glasses);
  drawBrow(p, P.browL, EYE.lx, 1, L.brow); drawBrow(p, P.browR, EYE.rx, -1, L.brow);
  drawMouth(p, P.mouth, L); // CHARACTERS-V3: no nose (the reference's simple decal faces)
  drawFx(p, P.fx, L);
}

// ------------------------------------------------------------------------------------------------- materials
const RES = 512;
function newCanvas() { const c = document.createElement("canvas"); c.width = c.height = RES; return c; }
function paint(c, P, L) {
  const p = c.getContext("2d");
  p.setTransform?.(1, 0, 0, 1, 0, 0); p.clearRect?.(0, 0, RES, RES);
  p.save(); p.scale(RES / 256, RES / 256); drawFaceV2(p, P, L); p.restore();
}
const faceMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
/** the cached face material for a face + variant + the person's face look */
export function faceMaterialV2(name, variant, look) {
  if (!PRESETS[name]) name = "neutral";
  const L = faceLook(look), key = `faceV2|${name}|${variant}|${lookKey(L)}`;
  return cachedMat(key, () => {
    const c = newCanvas(); paint(c, faceParams(name, variant), L);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return faceMat(t);
  });
}
export const BLEND_STEPS = 8;
/**
 * A person's own blend material (slot: an object on the person, it keeps the canvas): face `from` -> `to` at k (0..1),
 * redrawn only when the 1/8 step changes. -> the material
 */
export function blendMaterialV2(slot, from, to, k, variant, look) {
  const step = Math.round(Math.max(0, Math.min(1, k)) * BLEND_STEPS);
  const L = faceLook(look), key = `${from}>${to}|${step}|${variant}`;
  if (!slot.canvas) { slot.canvas = newCanvas(); slot.tex = new THREE.CanvasTexture(slot.canvas); slot.tex.colorSpace = THREE.SRGBColorSpace; slot.tex.anisotropy = 8; slot.mat = faceMat(slot.tex); }
  if (slot.key !== key) {
    slot.key = key;
    paint(slot.canvas, lerpFace(faceParams(from, variant), faceParams(to, variant), step / BLEND_STEPS), L);
    slot.tex.needsUpdate = true;
  }
  return slot.mat;
}
