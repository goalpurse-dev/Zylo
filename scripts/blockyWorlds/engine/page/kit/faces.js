// Face stickers in the locked look: whites of the eyes, pupils with a highlight, thick brows, a bold mouth
// (never the classic two-dots-and-a-smile). Drawn on a 512 canvas (256 design units x2), scaled 1.2 about the face
// centre like LOCKED in look/scene.js. Variants: "base", "blink" (eyes shut), "talk" (open mouth).
import * as THREE from "three";
import { cachedMat } from "./kitCommon.js";

export const EXPRS = ["neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush"];
const INK = "#2a1d24";
const POSITIVE = new Set(["neutral", "happy", "excited", "smirk", "surprised"]);

function drawFace(p, expr, variant, { glasses, beard, skin }) {
  p.lineCap = p.lineJoin = "round";
  p.translate(128, 136); p.scale(1.2, 1.2); p.translate(-128, -136);
  const big = 1.12;
  const L = { x: 88, y: 116 }, R = { x: 168, y: 116 };

  // ---- eyes ----
  // o: { open (height factor), pupil (size factor), look [dx,dy], cover (0..0.7 of the eye hidden by the upper lid), tilt }
  const eye = (x, y, side, o = {}) => {
    const open = o.open ?? 1, ps = o.pupil ?? 1, look = o.look ?? [0, 0], cover = o.cover ?? 0, tilt = (o.tilt ?? 0) * side;
    const ew = 17 * big * (o.wide ?? 1), eh = 22 * big * open;
    p.save();
    if (cover > 0) { p.translate(x, y); p.rotate(tilt); p.beginPath(); p.rect(-60, -eh + cover * 2 * eh, 120, 120); p.clip(); p.rotate(-tilt); p.translate(-x, -y); }
    p.fillStyle = "#fff"; p.strokeStyle = INK; p.lineWidth = 5;
    p.beginPath(); p.ellipse(x, y, ew, eh, 0, 0, Math.PI * 2); p.fill(); p.stroke();
    p.fillStyle = INK; p.beginPath(); p.ellipse(x + look[0], y + look[1] + 2, 9 * big * ps, 11 * big * ps * Math.min(1, open + 0.2), 0, 0, Math.PI * 2); p.fill();
    p.fillStyle = "#fff"; p.beginPath(); p.arc(x + look[0] + 4 * ps, y + look[1] - 3, 3.5 * Math.max(0.8, ps), 0, Math.PI * 2); p.fill();
    if (o.sparkle) { p.beginPath(); p.arc(x + look[0] - 3, y + look[1] + 6, 2, 0, Math.PI * 2); p.fill(); }
    p.restore();
    if (cover > 0) { // the lid line
      p.save(); p.translate(x, y); p.rotate(tilt); p.strokeStyle = INK; p.lineWidth = 7;
      p.beginPath(); p.moveTo(-ew - 3, -eh + cover * 2 * eh); p.lineTo(ew + 3, -eh + cover * 2 * eh); p.stroke(); p.restore();
    }
  };
  const shut = (x, y, up = false) => { // closed eye: relaxed ∪, or squeezed ∩
    p.strokeStyle = INK; p.lineWidth = 7; p.beginPath();
    if (up) p.arc(x, y + 14, 16 * big, Math.PI * 1.15, Math.PI * 1.85); else p.arc(x, y + 2, 16 * big, Math.PI * 0.15, Math.PI * 0.85);
    p.stroke();
  };
  // brows: inner > 0 raises the inner ends (worried), < 0 lowers them (angry); dy moves both up (negative) / down
  const brow = (x, y, tilt, w = 16) => { p.strokeStyle = INK; p.lineWidth = 9; p.beginPath(); p.moveTo(x - w, y + tilt); p.lineTo(x + w, y - tilt); p.stroke(); };
  const brows = (y, inner, { ly = 0, ry = 0 } = {}) => { brow(L.x, y + ly, inner); brow(R.x, y + ry, -inner); };
  const blush = (a = 0.35) => { p.fillStyle = `rgba(255,110,120,${a})`; p.beginPath(); p.ellipse(66, 160, 18, 10, 0, 0, Math.PI * 2); p.ellipse(190, 160, 18, 10, 0, 0, Math.PI * 2); p.fill(); };

  const closed = variant === "blink";
  const E = (o) => { if (closed) { shut(L.x, L.y); shut(R.x, R.y); } else { eye(L.x, L.y, 1, o); eye(R.x, R.y, -1, o); } };

  switch (expr) {
    case "happy": E({}); brows(76, 1); blush(); break;
    case "excited": E({ open: 1.1, pupil: 1.15, sparkle: true }); brows(70, -2); blush(0.45); break;
    case "sad": E({ look: [0, 6], cover: 0.22, tilt: -0.35 }); brows(84, 6); break;
    case "scared": E({ open: 1.2, wide: 1.08, pupil: 0.6 }); brows(70, 7); break;
    case "surprised": E({ open: 1.25, wide: 1.1, pupil: 0.75 }); brows(64, 2); break;
    case "angry": E({ cover: 0.35, tilt: 0.4, pupil: 0.9 }); brows(88, -9); break;
    case "sleepy": shut(L.x, L.y); shut(R.x, R.y); brows(86, 1); break;
    case "smirk": E({ cover: 0.32, look: [5, 0] }); brows(80, 0, { ly: 6, ry: -8 }); break;
    case "cry": shut(L.x, L.y - 4, true); shut(R.x, R.y - 4, true); brows(82, 8); break;
    case "shush": E({ look: [-7, 0], cover: 0.12 }); brows(80, 0, { ly: -6, ry: 3 }); break;
    default: E({}); brows(82, 2); break; // neutral
  }

  if (beard) { // drawn before the mouth so every expression stays readable
    p.fillStyle = beard; p.fillRect(56, 196, 144, 60); p.fillRect(46, 150, 22, 80); p.fillRect(188, 150, 22, 80);
    p.beginPath(); p.moveTo(56, 196); p.quadraticCurveTo(128, 166, 200, 196); p.fill();
  }

  // ---- mouth ----
  p.strokeStyle = INK; p.fillStyle = INK; p.lineWidth = 8;
  const openMouth = (w, h, dy = 0, smile = true) => { // a dark open mouth with a tongue
    p.beginPath();
    if (smile) { p.moveTo(128 - w, 172 + dy); p.quadraticCurveTo(128, 172 + dy + h * 2.2, 128 + w, 172 + dy); p.closePath(); }
    else p.ellipse(128, 184 + dy, w, h, 0, 0, Math.PI * 2);
    p.fill();
    p.save(); p.clip(); p.fillStyle = "#ff8fa0"; p.beginPath(); p.ellipse(128, 172 + dy + h * (smile ? 1.9 : 1.6), w * 0.55, h * 0.6, 0, 0, Math.PI * 2); p.fill(); p.restore();
  };
  if (variant === "talk" && expr !== "shush" && expr !== "sleepy") {
    if (POSITIVE.has(expr)) openMouth(expr === "excited" ? 30 : 22, expr === "excited" ? 16 : 11);
    else openMouth(15, 13, expr === "cry" ? 8 : 2, false);
  } else switch (expr) {
    case "happy": p.beginPath(); p.moveTo(102, 170); p.quadraticCurveTo(128, 198, 154, 170); p.stroke(); break;
    case "excited": openMouth(30, 18); break;
    case "sad": p.beginPath(); p.moveTo(104, 194); p.quadraticCurveTo(128, 168, 152, 194); p.stroke(); break;
    case "scared": { // a wobbly grimace with teeth
      p.beginPath(); p.moveTo(100, 184); p.quadraticCurveTo(128, 168, 156, 184); p.lineTo(156, 194); p.quadraticCurveTo(128, 184, 100, 194); p.closePath();
      p.fillStyle = "#fff"; p.fill(); p.lineWidth = 6; p.stroke();
      p.beginPath(); for (let i = 0; i <= 6; i++) { const x = 102 + i * 9, y = 186 + (i % 2 ? -3 : 3) - Math.sin((i / 6) * Math.PI) * 6; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.lineWidth = 4; p.stroke();
      p.fillStyle = "#7fd3ff"; p.strokeStyle = INK; p.lineWidth = 4; // sweat drop
      p.beginPath(); p.moveTo(206, 62); p.quadraticCurveTo(222, 88, 206, 96); p.quadraticCurveTo(190, 88, 206, 62); p.fill(); p.stroke();
      break;
    }
    case "surprised": openMouth(17, 22, 6, false); break;
    case "angry": {
      p.beginPath(); p.roundRect(102, 176, 52, 20, 6); p.fillStyle = "#fff"; p.fill(); p.lineWidth = 6; p.stroke();
      p.lineWidth = 4; p.beginPath(); p.moveTo(104, 186); p.lineTo(152, 186); for (const x of [115, 128, 141]) { p.moveTo(x, 177); p.lineTo(x, 195); } p.stroke();
      break;
    }
    case "sleepy": p.beginPath(); p.ellipse(128, 184, 9, 8, 0, 0, Math.PI * 2); p.fill(); break;
    case "smirk": p.beginPath(); p.moveTo(106, 184); p.quadraticCurveTo(136, 190, 156, 168); p.stroke(); break;
    case "cry": {
      openMouth(20, 16, 10, false);
      p.fillStyle = "rgba(120,200,255,0.95)"; // tear streams
      for (const x of [L.x, R.x]) { p.beginPath(); p.roundRect(x - 7, 120, 14, 64, 7); p.fill(); p.beginPath(); p.arc(x, 192, 9, 0, Math.PI * 2); p.fill(); }
      break;
    }
    case "shush": {
      p.lineWidth = 6; p.beginPath(); p.ellipse(128, 184, 8, 7, 0, 0, Math.PI * 2); p.stroke();
      p.fillStyle = skin || "#e7b38e"; p.strokeStyle = INK; p.lineWidth = 5; // a finger over the lips
      p.beginPath(); p.roundRect(134, 150, 22, 120, 11); p.fill(); p.stroke();
      p.strokeStyle = "rgba(42,29,36,0.5)"; p.lineWidth = 3; p.beginPath(); p.moveTo(139, 166); p.lineTo(151, 166); p.stroke();
      break;
    }
    default: p.beginPath(); p.moveTo(108, 181); p.lineTo(148, 179); p.stroke(); // neutral
  }

  if (glasses) {
    p.strokeStyle = "#3b2f2f"; p.lineWidth = 6;
    p.strokeRect(L.x - 27, L.y - 25, 54, 48); p.strokeRect(R.x - 27, R.y - 25, 54, 48);
    p.beginPath(); p.moveTo(L.x + 27, L.y - 4); p.lineTo(R.x - 27, R.y - 4); p.stroke();
  }
}

const TEX = new Map();
/** the face material for an expression + variant (+ the person's glasses/beard/skin), cached */
export function faceMaterial(expr, variant, look) {
  if (!EXPRS.includes(expr)) expr = "neutral";
  const key = `face|${expr}|${variant}|${look.glasses ? 1 : 0}|${look.beard ?? ""}|${expr === "shush" ? look.skin : ""}`;
  return cachedMat(key, () => {
    let t = TEX.get(key);
    if (!t) {
      const c = document.createElement("canvas"); c.width = c.height = 512; const p = c.getContext("2d");
      p.scale(2, 2); drawFace(p, expr, variant, look);
      t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX.set(key, t);
    }
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  });
}
