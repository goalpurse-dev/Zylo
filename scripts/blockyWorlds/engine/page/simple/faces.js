// Blocky Worlds SIMPLE LOOK faces: the approved test's 15 bold face decals + blink (page/simple/simple.js drawFace,
// round-2 features 1.3x), drawn once per (face, blink) on a 512 px canvas and swapped on the head (no blends: faces
// swap on words). Our own design: chunky black brows, black rounded eyes with two white shines, filled mouths; never
// the classic default face (two plain ovals + a thin smile line).
//   SIMPLE_FACES                 the 15 drawn faces
//   simpleFaceOf(name) -> face   any engine face name (lib/expressions.js FACE_NAMES, the planner's EXPRS) -> one of the 15
//   faceTexture(face, blink)     the cached CanvasTexture
import { canvasTex } from "./common.js";

const INK = "#1b1b22", MOUTH = "#5a1a22", TONGUE = "#ff7d8e", TEETH = "#ffffff";
const EXPR = {
  neutral:   { eyes: "open", brows: [0, 0, 0], mouth: "flat" },
  happy:     { eyes: "open", brows: [-0.1, -0.1, -0.05], mouth: "smile" },
  grin:      { eyes: "happy", brows: [-0.15, -0.15, -0.08], mouth: "grin" },
  laugh:     { eyes: "squint", brows: [-0.2, -0.2, -0.1], mouth: "laugh" },
  sad:       { eyes: "open", brows: [0.45, 0.45, 0.02], mouth: "frown", small: true },
  crying:    { eyes: "closedSad", brows: [0.5, 0.5, 0], mouth: "wail", tears: true },
  angry:     { eyes: "open", brows: [-0.55, -0.55, 0.12], mouth: "teeth" },
  surprised: { eyes: "wide", brows: [0.15, 0.15, -0.22], mouth: "o" },
  shocked:   { eyes: "tiny", brows: [0.1, 0.1, -0.3], mouth: "bigO" },
  scared:    { eyes: "wide", brows: [0.55, 0.55, -0.14], mouth: "wavy", sweat: true },
  smirk:     { eyes: "half", brows: [-0.2, 0.25, 0], mouth: "smirk" },
  wink:      { eyes: "wink", brows: [-0.1, 0.1, -0.05], mouth: "grin" },
  thinking:  { eyes: "side", brows: [0.3, -0.1, -0.06], mouth: "side" },
  sleepy:    { eyes: "sleepy", brows: [0.1, 0.1, 0.08], mouth: "smallO", zzz: true },
  worried:   { eyes: "open", brows: [0.4, 0.4, -0.05], mouth: "wavy", small: true, sweat: true },
  determined: { eyes: "half", brows: [-0.45, -0.45, 0.14], mouth: "flat" }, // owner 2026-11-11: Nell in the staring contest (firm brows, narrowed eyes, a tight mouth)
};
export const SIMPLE_FACES = Object.freeze(Object.keys(EXPR));

/** every face name the engine / planner / director may send -> the nearest of the 15 */
export const FACE_MAP = Object.freeze({
  neutral: "neutral", happy: "happy", sad: "sad", scared: "scared", surprised: "surprised", angry: "angry", sleepy: "sleepy",
  smirk: "smirk", cry: "crying", crying: "crying", excited: "grin", shush: "neutral", yell: "shocked", sneeze: "laugh", mime: "neutral",
  calm: "happy", laugh: "laugh", proud: "smirk", worried: "worried", determined: "determined", embarrassed: "worried", confused: "thinking",
  disgusted: "angry", love: "grin", nervous: "worried", curious: "thinking", relieved: "happy", grumpy: "angry", awe: "surprised",
  silly: "wink", shocked: "shocked", bored: "sleepy", hopeful: "happy", grin: "grin", wink: "wink", thinking: "thinking",
});
export const simpleFaceOf = (name) => FACE_MAP[name] ?? (EXPR[name] ? name : "neutral");

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, r); }
/** the approved test's drawFace (page/simple/simple.js), unchanged */
export function drawFace(c, S, name, blink) {
  const e = EXPR[name] ?? EXPR.neutral;
  c.clearRect(0, 0, S, S);
  c.save(); c.translate(S / 2, S * 0.55); c.scale(1.3, 1.3); c.translate(-S / 2, -S * 0.55);
  c.lineCap = "round"; c.lineJoin = "round";
  const ex = S * 0.2, ey = S * 0.44;
  const eye = (side) => {
    const x = S / 2 + side * ex, y = ey;
    let kind = blink ? "closed" : e.eyes;
    if (kind === "wink") kind = side < 0 ? "open" : "happy";
    c.fillStyle = INK; c.strokeStyle = INK;
    if (kind === "open" || kind === "side" || kind === "half") {
      rr(c, x, y, S * 0.1, S * 0.17, S * 0.05); c.fill();
      c.fillStyle = "#fff"; const off = kind === "side" ? S * 0.022 : 0;
      c.beginPath(); c.arc(x + S * 0.018 + off, y - S * 0.04, S * 0.022, 0, 7); c.fill();
      c.beginPath(); c.arc(x - S * 0.015 + off, y + S * 0.035, S * 0.01, 0, 7); c.fill();
      if (kind === "half") { c.globalCompositeOperation = "destination-out"; c.fillRect(x - S * 0.07, y - S * 0.1, S * 0.14, S * 0.08); c.globalCompositeOperation = "source-over"; c.fillStyle = INK; c.fillRect(x - S * 0.065, y - S * 0.03, S * 0.13, S * 0.025); }
    } else if (kind === "wide") {
      c.fillStyle = "#fff"; c.lineWidth = S * 0.025; c.beginPath(); c.ellipse(x, y, S * 0.075, S * 0.095, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x, y + S * 0.01, S * 0.035, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x + S * 0.012, y - S * 0.004, S * 0.011, 0, 7); c.fill();
    } else if (kind === "tiny") {
      c.fillStyle = "#fff"; c.lineWidth = S * 0.022; c.beginPath(); c.arc(x, y, S * 0.08, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(x, y, S * 0.018, 0, 7); c.fill();
    } else if (kind === "happy" || kind === "squint") {
      c.lineWidth = S * 0.035; c.beginPath();
      if (kind === "happy") c.arc(x, y + S * 0.03, S * 0.055, Math.PI * 1.1, Math.PI * 1.9);
      else { c.moveTo(x - side * S * 0.06, y - S * 0.04); c.lineTo(x + side * S * 0.04, y); c.lineTo(x - side * S * 0.06, y + S * 0.04); }
      c.stroke();
    } else if (kind === "closedSad") {
      c.lineWidth = S * 0.032; c.beginPath(); c.arc(x, y - S * 0.03, S * 0.055, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    } else if (kind === "sleepy") {
      c.lineWidth = S * 0.03; c.beginPath(); c.moveTo(x - S * 0.06, y + S * 0.01); c.lineTo(x + S * 0.06, y + S * 0.01); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(x, y + S * 0.025, S * 0.045, S * 0.022, 0, 0, Math.PI); c.fill();
    } else {
      c.lineWidth = S * 0.032; c.beginPath(); c.arc(x, y - S * 0.012, S * 0.055, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
    }
  };
  eye(-1); eye(1);
  c.strokeStyle = INK; c.lineWidth = S * 0.042;
  for (const side of [-1, 1]) {
    const a = e.brows[side < 0 ? 0 : 1], x = S / 2 + side * ex, y = ey - S * 0.15 + e.brows[2] * S * 0.25;
    const dx = S * 0.065, L = Math.sin(a) * S * 0.05;
    c.beginPath(); c.moveTo(x - side * dx, y - L); c.lineTo(x + side * dx, y + L); c.stroke();
  }
  const mx = S / 2, my = S * 0.72, k = e.small ? 0.75 : 1;
  c.lineWidth = S * 0.03; c.strokeStyle = INK; c.fillStyle = MOUTH;
  const tongue = (cx, cy, w, h) => { c.save(); c.clip(); c.fillStyle = TONGUE; c.beginPath(); c.ellipse(cx, cy, w, h, 0, 0, 7); c.fill(); c.restore(); };
  const grinPath = () => { c.beginPath(); c.moveTo(mx - S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx, my - S * 0.02, mx + S * 0.13, my - S * 0.04); c.quadraticCurveTo(mx + S * 0.1, my + S * 0.12, mx, my + S * 0.12); c.quadraticCurveTo(mx - S * 0.1, my + S * 0.12, mx - S * 0.13, my - S * 0.04); c.closePath(); };
  switch (e.mouth) {
    case "flat": c.beginPath(); c.moveTo(mx - S * 0.07, my); c.lineTo(mx + S * 0.07, my); c.stroke(); break;
    case "smile": c.beginPath(); c.arc(mx, my - S * 0.07, S * 0.1 * k, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); break;
    case "grin": grinPath(); c.fill(); tongue(mx, my + S * 0.12, S * 0.07, S * 0.05); c.fillStyle = TEETH; c.fillRect(mx - S * 0.1, my - S * 0.035, S * 0.2, S * 0.03); grinPath(); c.stroke(); break;
    case "laugh": c.beginPath(); c.ellipse(mx, my + S * 0.01, S * 0.13, S * 0.12, 0, 0, Math.PI); c.closePath(); c.fill(); tongue(mx, my + S * 0.11, S * 0.08, S * 0.05); c.beginPath(); c.ellipse(mx, my + S * 0.01, S * 0.13, S * 0.12, 0, 0, Math.PI); c.closePath(); c.stroke(); break;
    case "frown": c.beginPath(); c.arc(mx, my + S * 0.08, S * 0.09 * k, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); break;
    case "wail": c.beginPath(); c.moveTo(mx - S * 0.1, my + S * 0.09); c.quadraticCurveTo(mx, my - S * 0.08, mx + S * 0.1, my + S * 0.09); c.closePath(); c.fill(); c.stroke(); break;
    case "teeth": rr(c, mx, my + S * 0.02, S * 0.22, S * 0.09, S * 0.03); c.fillStyle = TEETH; c.fill(); c.stroke(); c.lineWidth = S * 0.015; c.beginPath(); c.moveTo(mx - S * 0.1, my + S * 0.02); c.lineTo(mx + S * 0.1, my + S * 0.02); for (let i = -2; i <= 2; i++) { c.moveTo(mx + i * S * 0.037, my - S * 0.02); c.lineTo(mx + i * S * 0.037, my + S * 0.06); } c.stroke(); break;
    case "o": c.beginPath(); c.ellipse(mx, my + S * 0.02, S * 0.05, S * 0.065, 0, 0, 7); c.fill(); c.stroke(); break;
    case "bigO": c.beginPath(); c.ellipse(mx, my + S * 0.03, S * 0.075, S * 0.1, 0, 0, 7); c.fill(); tongue(mx, my + S * 0.11, S * 0.05, S * 0.035); c.beginPath(); c.ellipse(mx, my + S * 0.03, S * 0.075, S * 0.1, 0, 0, 7); c.stroke(); break;
    case "smallO": c.beginPath(); c.ellipse(mx + S * 0.02, my + S * 0.02, S * 0.03, S * 0.035, 0, 0, 7); c.fill(); c.stroke(); break;
    case "wavy": { const w = S * 0.13 * k; c.beginPath(); for (let i = 0; i <= 8; i++) { const x = mx - w + (i * 2 * w) / 8, y = my + S * 0.02 + (i % 2 ? -1 : 1) * S * 0.018; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); break; }
    case "smirk": c.beginPath(); c.moveTo(mx - S * 0.08, my + S * 0.02); c.quadraticCurveTo(mx + S * 0.04, my + S * 0.04, mx + S * 0.1, my - S * 0.04); c.stroke(); break;
    case "side": c.beginPath(); c.moveTo(mx - S * 0.02, my + S * 0.03); c.lineTo(mx + S * 0.09, my + S * 0.0); c.stroke(); break;
    default: break;
  }
  if (e.tears) { c.fillStyle = "#5ec8ff"; for (const side of [-1, 1]) { c.beginPath(); c.roundRect(S / 2 + side * ex - S * 0.025, ey + S * 0.02, S * 0.05, S * 0.2, S * 0.025); c.fill(); } }
  if (e.sweat) { c.fillStyle = "#7fd4ff"; c.strokeStyle = INK; c.lineWidth = S * 0.012; c.beginPath(); c.moveTo(S * 0.83, S * 0.2); c.quadraticCurveTo(S * 0.88, S * 0.3, S * 0.83, S * 0.32); c.quadraticCurveTo(S * 0.78, S * 0.3, S * 0.83, S * 0.2); c.fill(); c.stroke(); }
  if (e.zzz) { c.fillStyle = INK; c.font = `900 ${Math.round(S * 0.1)}px Arial`; c.fillText("z", S * 0.78, S * 0.2); c.font = `900 ${Math.round(S * 0.07)}px Arial`; c.fillText("z", S * 0.86, S * 0.12); }
  if (name === "happy" || name === "grin" || name === "laugh") { c.fillStyle = "rgba(255,110,130,0.35)"; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(S / 2 + side * S * 0.3, S * 0.6, S * 0.06, S * 0.035, 0, 0, 7); c.fill(); } }
  c.restore();
}
const FACE_TEX = new Map();
export function faceTexture(face, blink = false) {
  const f = simpleFaceOf(face), k = `${f}|${blink ? 1 : 0}`;
  if (!FACE_TEX.has(k)) FACE_TEX.set(k, canvasTex(512, 512, (c, S) => drawFace(c, S, f, blink)));
  return FACE_TEX.get(k);
}
