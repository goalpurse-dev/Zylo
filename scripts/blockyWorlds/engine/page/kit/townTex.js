// Blocky Worlds WORLD-LOOK (2026-11-06): procedural, deterministic canvas textures for the town on a creature: wood
// planks (walls, decks, stairs, walkways), plaster (with half-timber beams), roof tiles and shingles, cobbles and dirt
// paths, stone blocks (walls, castle towers). Drawn once per page and cached (no downloads: our own pixels).
//   townTex(THREE, kind, { color }) -> CanvasTexture (sRGB, repeat-wrapped)   kind: planks | plaster | timber | tiles |
//   shingles | cobbles | stone | dirt
import { prng } from "../../lib/epic.js";

const CACHE = new Map();
const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
function shade(col, k) { const n = parseInt(col.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return hex((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)); }

const DRAW = {
  planks(x, w, h, R, col) {
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      let xx = -R() * 120;
      while (xx < w) { const len = 120 + R() * 140; x.fillStyle = shade(col, 0.82 + R() * 0.3); x.fillRect(xx, y, len, h / rows); x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(xx + len - 2, y, 2, h / rows); xx += len; }
      for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(60,35,15,${0.05 + R() * 0.08})`; x.fillRect(R() * w, y + R() * (h / rows), 20 + R() * 60, 1.5); }
      x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(0, y, w, 2.5);
    }
  },
  plaster(x, w, h, R, col) {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${0.03 + R() * 0.05})`; const r = 2 + R() * 8; x.fillRect(R() * w, R() * h, r, r); }
  },
  timber(x, w, h, R, col) {
    DRAW.plaster(x, w, h, R, col);
    x.fillStyle = "#4a3222";
    x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14); x.fillRect(0, h / 2 - 7, w, 14);
    for (const fx of [0, 0.5]) { x.fillRect(fx * w, 0, 14, h); }
    x.save(); x.lineWidth = 12; x.strokeStyle = "#4a3222"; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w / 2, 0); x.moveTo(w / 2, h); x.lineTo(w, h / 2); x.stroke(); x.restore();
  },
  tiles(x, w, h, R, col) {
    const rows = 10, cols = 8;
    x.fillStyle = shade(col, 0.55); x.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
      const cx = (c + (r % 2 ? 0.5 : 0)) * (w / cols), y = (r * h) / rows;
      x.fillStyle = shade(col, 0.8 + R() * 0.35); x.beginPath(); x.ellipse(cx, y + h / rows * 0.55, w / cols * 0.48, h / rows * 0.62, 0, 0, Math.PI); x.fill();
    }
  },
  shingles(x, w, h, R, col) {
    const rows = 12;
    x.fillStyle = shade(col, 0.5); x.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) { let xx = -R() * 40; while (xx < w) { const sw = 26 + R() * 30; x.fillStyle = shade(col, 0.75 + R() * 0.4); x.fillRect(xx + 1, (r * h) / rows, sw - 2, h / rows - 3); xx += sw; } }
  },
  cobbles(x, w, h, R, col) {
    x.fillStyle = shade(col, 0.5); x.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) { x.fillStyle = shade(col, 0.75 + R() * 0.45); x.beginPath(); x.ellipse(R() * w, R() * h, 10 + R() * 12, 8 + R() * 9, R() * 3, 0, 7); x.fill(); }
  },
  stone(x, w, h, R, col) {
    const rows = 8;
    x.fillStyle = shade(col, 0.45); x.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) { let xx = r % 2 ? -32 : 0; while (xx < w) { const bw = 52 + R() * 24; x.fillStyle = shade(col, 0.78 + R() * 0.3); x.fillRect(xx + 2, (r * h) / rows + 2, bw - 4, h / rows - 4); xx += bw; } }
  },
  dirt(x, w, h, R, col) {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 1500; k++) { x.fillStyle = shade(col, 0.7 + R() * 0.5); const r = 1 + R() * 5; x.fillRect(R() * w, R() * h, r, r); }
  },
};
export const TOWN_TEX_KINDS = Object.freeze(Object.keys(DRAW));

export function townTex(THREE, kind, { color = "#b08a5a", seed = 1 } = {}) {
  const k = `${kind}|${color}|${seed}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const draw = DRAW[kind] ?? DRAW.plaster;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  draw(c.getContext("2d"), 256, 256, prng(seed * 31 + kind.length), color);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  CACHE.set(k, t); return t;
}
