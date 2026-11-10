// Blocky Worlds WORLD-LOOK (2026-11-06): procedural, deterministic canvas textures for the town on a creature: wood
// planks (walls, decks, stairs, walkways), plaster (with half-timber beams), roof tiles and shingles, cobbles and dirt
// paths, stone blocks (walls, castle towers). Drawn once per page and cached (no downloads: our own pixels).
//   townTex(THREE, kind, { color }) -> CanvasTexture (sRGB, repeat-wrapped)   kind: planks | plaster | timber | tiles |
//   shingles | cobbles | cobblesRich (512 px: the town square / streets) | stone | dirt
import { prng } from "../../lib/epic.js";
import { PLASTIC_LOOK, toyColour, hsvOf } from "./plastic.js"; // PLASTIC-WORLD 2026-11-10

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
  // LOOK-LEFTOVERS 2026-11-08 (lead: "the town square ground is pale beige cobbles, still the old pastel look"): rich
  // cobbles: rows of rounded stones in warm varied tones (rust, ochre, slate, umber), dark grout with moss in it, a lit
  // top edge + shadowed lower edge per stone (reads as relief), worn shiny tops on some, lichen specks
  cobblesRich(x, w, h, R, col) {
    x.fillStyle = "#2c2a1e"; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 700; k++) { x.fillStyle = R() < 0.6 ? `rgba(70,110,40,${0.35 + R() * 0.4})` : `rgba(40,36,26,${0.4 + R() * 0.4})`; const r = 2 + R() * 5; x.fillRect(R() * w, R() * h, r, r * 0.7); }
    const tones = [col, shade(col, 0.78), shade(col, 1.15), "#7c5a44", "#8a7a62", "#5f6670", "#9a6438", "#6e5a48"];
    const rows = 12, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let xx = r % 2 ? -rh * 0.6 : 0;
      while (xx < w) {
        const sw = rh * (0.9 + R() * 0.7), cy = r * rh + rh / 2, cx = xx + sw / 2, base = tones[Math.floor(R() * tones.length)], k = 0.8 + R() * 0.35;
        const rr = (ox, oy, ww, hh, fill) => { x.fillStyle = fill; x.beginPath(); x.roundRect ? x.roundRect(ox, oy, ww, hh, Math.min(ww, hh) * 0.38) : x.rect(ox, oy, ww, hh); x.fill(); };
        rr(cx - sw / 2 + 2, cy - rh / 2 + 3, sw - 4, rh - 4, shade(base, k * 0.6)); // the shadowed lower edge
        rr(cx - sw / 2 + 2, cy - rh / 2 + 2, sw - 5, rh - 6, shade(base, k));
        rr(cx - sw / 2 + 5, cy - rh / 2 + 3, sw - 11, rh * 0.32, shade(base, k * 1.18)); // the lit top
        if (R() < 0.3) { x.fillStyle = `rgba(255,240,215,${0.08 + R() * 0.1})`; x.beginPath(); x.ellipse(cx, cy, sw * 0.25, rh * 0.18, 0, 0, 7); x.fill(); } // worn shiny top
        for (let q = 0; q < 4; q++) { x.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.08})`; x.fillRect(cx - sw / 2 + 4 + R() * (sw - 8), cy - rh / 2 + 3 + R() * (rh - 8), 2 + R() * 3, 2); }
        if (R() < 0.18) { x.fillStyle = `rgba(96,140,52,${0.45 + R() * 0.3})`; x.beginPath(); x.ellipse(cx - sw / 2 + R() * sw, cy + rh * 0.4, 4 + R() * 6, 2 + R() * 2, 0, 0, 7); x.fill(); } // moss creeping out of the grout
        xx += sw;
      }
    }
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

// PLASTIC-WORLD 2026-11-10 (owner: "no photo textures, no noisy cobbles ... clean paths (smooth stone tiles in clear
// colours, no noise)"): the same kinds as CLEAN toy patterns: one flat toy colour (page/kit/plastic.js toyColour) with
// thin even lines (plank seams, beams, roof rows, paving joints); no specks, grain, moss or per-stone noise
const rr = (x, ox, oy, ww, hh, fill, rad = 0.3) => { x.fillStyle = fill; x.beginPath(); if (x.roundRect) x.roundRect(ox, oy, ww, hh, Math.min(ww, hh) * rad); else x.rect(ox, oy, ww, hh); x.fill(); };
const CLEAN = {
  planks(x, w, h, R, col) { x.fillStyle = col; x.fillRect(0, 0, w, h); const rows = 6; for (let r = 0; r < rows; r++) { const y = (r * h) / rows; if (r % 2) { x.fillStyle = shade(col, 0.94); x.fillRect(0, y, w, h / rows); } x.fillStyle = shade(col, 0.72); x.fillRect(0, y, w, 3); x.fillRect(((r * 97) % (w - 40)) + 20, y, 3, h / rows); } },
  plaster(x, w, h, R, col) { x.fillStyle = col; x.fillRect(0, 0, w, h); },
  timber(x, w, h, R, col) { CLEAN.plaster(x, w, h, R, col); x.fillStyle = "#9a5224"; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14); x.fillRect(0, h / 2 - 7, w, 14); for (const fx of [0, 0.5]) x.fillRect(fx * w, 0, 14, h); x.save(); x.lineWidth = 12; x.strokeStyle = "#9a5224"; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w / 2, 0); x.moveTo(w / 2, h); x.lineTo(w, h / 2); x.stroke(); x.restore(); },
  tiles(x, w, h, R, col) { const rows = 8, cols = 6; x.fillStyle = shade(col, 0.74); x.fillRect(0, 0, w, h); for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) { const cx = (c + (r % 2 ? 0.5 : 0)) * (w / cols), y = (r * h) / rows; x.fillStyle = col; x.beginPath(); x.ellipse(cx, y + (h / rows) * 0.5, (w / cols) * 0.47, (h / rows) * 0.6, 0, 0, Math.PI); x.fill(); } },
  shingles(x, w, h, R, col) { const rows = 8; x.fillStyle = shade(col, 0.74); x.fillRect(0, 0, w, h); for (let r = 0; r < rows; r++) { const sw = w / 5; for (let xx = r % 2 ? -sw / 2 : 0; xx < w; xx += sw) rr(x, xx + 2, (r * h) / rows + 1, sw - 4, h / rows - 4, col, 0.2); } },
  cobbles(x, w, h, R, col) { x.fillStyle = shade(col, 0.84); x.fillRect(0, 0, w, h); const n = 4, s = w / n; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) rr(x, c * s + 3, r * s + 3, s - 6, s - 6, (r + c) % 2 ? col : shade(col, 0.95), 0.12); },
  cobblesRich(x, w, h, R, col) { CLEAN.cobbles(x, w, h, R, col); },
  stone(x, w, h, R, col) { const rows = 6; x.fillStyle = shade(col, 0.78); x.fillRect(0, 0, w, h); for (let r = 0; r < rows; r++) { const bw = w / 3; for (let xx = r % 2 ? -bw / 2 : 0; xx < w; xx += bw) rr(x, xx + 3, (r * h) / rows + 3, bw - 6, h / rows - 6, r % 2 ? col : shade(col, 0.95), 0.1); } },
  dirt(x, w, h, R, col) { x.fillStyle = col; x.fillRect(0, 0, w, h); },
};
// the toy colour of a town surface: paths / cobbles / dirt that were beige-brown become clean light stone
const TOY_SURF = { cobbles: "#b4bfcf", cobblesRich: "#b4bfcf", dirt: "#aeb8c8" }; // GATE-V3: light-mid greys (near-white clipped)
export function townTexColour(kind, color) {
  if (!PLASTIC_LOOK) return color;
  const { s, h } = hsvOf(color);
  if (TOY_SURF[kind] && (s < 0.3 || (h >= 15 && h <= 50))) return TOY_SURF[kind];
  return toyColour(color);
}

export function townTex(THREE, kind, { color = "#b08a5a", seed = 1 } = {}) {
  const k = `${kind}|${color}|${seed}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const draw = (PLASTIC_LOOK ? CLEAN : DRAW)[kind] ?? (PLASTIC_LOOK ? CLEAN : DRAW).plaster;
  const N = kind === "cobblesRich" && !PLASTIC_LOOK ? 512 : 256;
  const c = document.createElement("canvas"); c.width = c.height = N;
  draw(c.getContext("2d"), N, N, prng(seed * 31 + kind.length), townTexColour(kind, color));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  CACHE.set(k, t); return t;
}
