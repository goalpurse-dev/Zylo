// Zyvo Studio overlays, drawn on a 2D canvas over the 3D frame: word captions (1–3 words, one yellow key word),
// the header chip (top centre, below TikTok's top bar), the hook pill, the rolling counter, the TikTok safe zones
// (for review). Everything sits inside the export safe zone: x 110..910, y 320..1500 (centre x 510).
import { SAFE, W, H } from "./world.js";

export const SAFE_CX = (SAFE.left + (W - SAFE.right)) / 2;   // 510
const FONT = '"Segoe UI Black", "Segoe UI", "Segoe UI Emoji", Arial';   // the emoji font draws 👀 (no empty boxes)
const YELLOW = "#FFD43B", LIME = "#BEF264";
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const popScale = (age, d = 0.16) => (age < 0 ? 0 : age < d ? 0.6 + 0.55 * Math.sin((age / d) * Math.PI * 0.75) : 1);

/** Caption chunks: up to 3 words, broken after , . ? ! — each shown from its first word to the next chunk. */
export function captionChunks(lines) {
  const chunks = [];
  for (const ln of lines) {
    let cur = [];
    const flush = () => { if (cur.length) chunks.push({ words: cur, s: cur[0].s }); cur = []; };
    for (const w of ln.words) { cur.push(w); if (cur.length === 3 || /[,.?!]$/.test(w.w)) flush(); }
    flush();
    chunks[chunks.length - 1].end = ln.end + 0.12;
  }
  chunks.forEach((c, i) => { c.e = Math.min(c.end ?? Infinity, chunks[i + 1]?.s ?? Infinity); if (!isFinite(c.e)) c.e = c.s + 1; });
  return chunks;
}

export function makeOverlay(ctx) {
  const pill = (x, y, h, parts, { bg = "rgba(9,10,10,0.82)", border = "rgba(190,242,100,0.45)", size = 40, scale = 1 } = {}) => {
    ctx.save(); ctx.font = `${size}px ${FONT}`;
    const widths = parts.map(([t]) => ctx.measureText(t).width), w = widths.reduce((a, b) => a + b, 0) + h * 0.9;
    ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.textBaseline = "middle"; let cx = -w / 2 + h * 0.45;
    parts.forEach(([t, col], i) => { ctx.fillStyle = col ?? "#ffffff"; ctx.fillText(t, cx, 2); cx += widths[i]; });
    ctx.restore();
    return { x0: x - (w / 2) * scale, y0: y - (h / 2) * scale, x1: x + (w / 2) * scale, y1: y + (h / 2) * scale };   // for the overlay-vs-props check
  };
  return {
    clear() { ctx.clearRect(0, 0, W, H); },
    /** The chapter chip at the top centre, just below the top bar. */
    chip(parts, age) { if (age < 0) return null; return pill(SAFE_CX, SAFE.top + 52, 74, parts, { size: 38, scale: popScale(age) }); },
    /** The end chip (teaser): a lime call to action under the caption, clear of faces and the antenna. */
    endChip(text, age) { if (age < 0) return null; return pill(SAFE_CX, 1440, 100, [[text, "#BEF264"]], { size: 56, scale: popScale(age, 0.22), border: "rgba(190,242,100,0.8)" }); },
    /** The hook's stat pill ("MY LAST SHORT · 6 hours"). */
    statPill(parts, age, y = SAFE.top + 150) { if (age < 0) return null; return pill(SAFE_CX, y, 96, parts, { size: 50, scale: popScale(age, 0.2), border: "rgba(255,212,59,0.6)" }); },
    /** A counter rolling to its (real) value, with a label. */
    counter(value, label, age, rollFor) {
      if (age < 0) return null;
      const n = Math.round(value * ease(age / rollFor)), s = age < rollFor ? 1 : popScale(age - rollFor + 0.08, 0.2);
      ctx.save(); ctx.translate(SAFE_CX, SAFE.top + 280); ctx.scale(s, s);
      ctx.fillStyle = "rgba(9,10,10,0.84)"; ctx.beginPath(); ctx.roundRect(-300, -150, 600, 300, 44); ctx.fill();
      ctx.strokeStyle = "rgba(190,242,100,0.5)"; ctx.lineWidth = 4; ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `200px ${FONT}`; ctx.fillStyle = YELLOW; ctx.fillText(String(n), 0, -30);
      ctx.font = `40px ${FONT}`; ctx.fillStyle = "#ffffff"; ctx.fillText(label, 0, 92);
      ctx.restore();
      return { x0: SAFE_CX - 300 * s, y0: SAFE.top + 280 - 150 * s, x1: SAFE_CX + 300 * s, y1: SAFE.top + 280 + 150 * s };
    },
    /** The spoken words, 1–3 at a time, the key word in yellow. */
    caption(chunk, t) {
      if (!chunk) return;
      let size = 92; ctx.font = `${size}px ${FONT}`;
      const text = chunk.words.map((w) => w.w).join(" ");
      while (ctx.measureText(text).width > W - SAFE.left - SAFE.right - 40 && size > 56) { size -= 4; ctx.font = `${size}px ${FONT}`; }
      const s = popScale(t - chunk.s, 0.12);
      ctx.save(); ctx.translate(SAFE_CX, 1300); ctx.scale(s, s); ctx.textBaseline = "middle";
      const total = ctx.measureText(text).width; let x = -total / 2;
      for (const [i, w] of chunk.words.entries()) {
        const word = w.w + (i < chunk.words.length - 1 ? " " : ""), ww = ctx.measureText(word).width;
        ctx.lineJoin = "round"; ctx.lineWidth = size * 0.16; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(word, x, 0);
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.fillStyle = w.key ? YELLOW : "#ffffff"; ctx.fillText(word, x, 0); ctx.shadowBlur = 0;
        x += ww;
      }
      ctx.restore();
    },
    /** A step chip with the 5 progress dashes under it (the current one lit). */
    stepChip(n, total, parts, age) {
      if (age < 0) return null;
      const b = pill(SAFE_CX, SAFE.top + 52, 74, parts, { size: 38, scale: popScale(age) });
      const w = 56, gap = 12, x0 = SAFE_CX - (total * w + (total - 1) * gap) / 2;
      for (let i = 0; i < total; i++) { ctx.fillStyle = i < n ? YELLOW : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.roundRect(x0 + i * (w + gap), SAFE.top + 100, w, 8, 4); ctx.fill(); }
      return { ...b, y1: SAFE.top + 108 };
    },
    /** A REAL screen as a floating card (sharp: drawn in 2D), sliding in; a "real time" badge; a tap ring. */
    card(img, aspect, age, { width = 600, top = 448, badge = null, tap = null, tapAt = 0.45 } = {}) {
      if (age < 0 || !img) return null;
      const k = Math.min(1, age / 0.28), e = 1 - Math.pow(1 - k, 3), w = width * (0.92 + 0.08 * e), h = w / aspect;
      const x = SAFE_CX - w / 2, y = top + (1 - e) * 60;
      ctx.save(); ctx.globalAlpha = e;
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
      ctx.fillStyle = "#0b0c0e"; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 28); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
      ctx.strokeStyle = "rgba(190,242,100,0.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 28); ctx.stroke();
      if (badge) {   // the real time since the first click, as recorded
        ctx.font = `34px ${FONT}`; const tw = ctx.measureText(badge).width + 40;
        ctx.fillStyle = "rgba(9,10,10,0.9)"; ctx.beginPath(); ctx.roundRect(x + w - tw - 14, y + 14, tw, 54, 27); ctx.fill();
        ctx.fillStyle = YELLOW; ctx.textBaseline = "middle"; ctx.fillText(badge, x + w - tw + 6, y + 42);
      }
      if (tap && age > tapAt) {   // where the real click was: a cursor and a ring (just before the clicked screen shows)
        const ta = age - tapAt, px = x + tap[0] * w, py = y + tap[1] * h, r = 26 + ta * 90;
        ctx.globalAlpha = Math.max(0, 1 - ta / 0.7); ctx.strokeStyle = YELLOW; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 8, py + 44); ctx.lineTo(px + 20, py + 32); ctx.lineTo(px + 38, py + 40); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      return { x0: x - 8, y0: y - 8, x1: x + w + 8, y1: y + h + 8 };
    },
    /** A clock rolling up to a real measured time (seconds), with a label. */
    timer(seconds, label, age, rollFor) {
      if (age < 0) return null;
      const v = Math.round(seconds * ease(age / rollFor)), s = age < rollFor ? 1 : popScale(age - rollFor + 0.08, 0.2);
      const txt = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
      ctx.save(); ctx.translate(SAFE_CX, SAFE.top + 280); ctx.scale(s, s);
      ctx.fillStyle = "rgba(9,10,10,0.84)"; ctx.beginPath(); ctx.roundRect(-300, -150, 600, 300, 44); ctx.fill();
      ctx.strokeStyle = "rgba(190,242,100,0.5)"; ctx.lineWidth = 4; ctx.stroke();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `180px ${FONT}`; ctx.fillStyle = YELLOW; ctx.fillText(txt, 0, -30);
      ctx.font = `36px ${FONT}`; ctx.fillStyle = "#ffffff"; ctx.fillText(label, 0, 92);
      ctx.restore();
      return { x0: SAFE_CX - 300 * s, y0: SAFE.top + 280 - 150 * s, x1: SAFE_CX + 300 * s, y1: SAFE.top + 280 + 150 * s };
    },
    /** For review: the TikTok zones in red. */
    zones() {
      ctx.save(); ctx.fillStyle = "rgba(255,40,80,0.22)";
      ctx.fillRect(0, 0, W, SAFE.top); ctx.fillRect(0, H - SAFE.bottom, W, SAFE.bottom); ctx.fillRect(W - SAFE.right, 0, SAFE.right, H); ctx.fillRect(0, 0, SAFE.left, H);
      ctx.restore();
    },
    box(b, bad) { if (!b) return; ctx.save(); ctx.strokeStyle = bad ? "#ff3355" : "#38f2a0"; ctx.lineWidth = 4; ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.restore(); },
  };
}
export { LIME, YELLOW };
