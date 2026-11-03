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
    // a long label shrinks to fit the safe width (it never pokes out of the safe zone)
    const maxW = (W - SAFE.left - SAFE.right - 20) / 1.16;   // room for the pop-in overshoot (popScale peaks ~1.15)
    while (parts.reduce((a, [t]) => a + ctx.measureText(t).width, 0) + h * 0.9 > maxW && size > 24) { size -= 2; ctx.font = `${size}px ${FONT}`; }
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
    /** The Rage hook's numbered step (owner, 2026-11-03: "big numbered chips"): twice the chapter chip, above a big screen. */
    bigStepChip(text, age) { if (age < 0) return null; return pill(SAFE_CX, SAFE.top + 70, 124, [[text, "#FFD43B"]], { size: 78, scale: popScale(age, 0.2), border: "rgba(255,212,59,0.85)" }); },
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
    caption(chunk, t, y = 1300) {
      if (!chunk) return;
      let size = 92; ctx.font = `${size}px ${FONT}`;
      const text = chunk.words.map((w) => w.w).join(" ");
      while (ctx.measureText(text).width > W - SAFE.left - SAFE.right - 40 && size > 56) { size -= 4; ctx.font = `${size}px ${FONT}`; }
      const s = chunk.s < 0.05 ? 1 : popScale(t - chunk.s, 0.12);   // the first words are whole on frame 0
      ctx.save(); ctx.translate(SAFE_CX, y); ctx.scale(s, s); ctx.textBaseline = "middle";
      const total = ctx.measureText(text).width; let x = -total / 2;
      for (const [i, w] of chunk.words.entries()) {
        const word = w.w + (i < chunk.words.length - 1 ? " " : ""), ww = ctx.measureText(word).width;
        ctx.lineJoin = "round"; ctx.lineWidth = size * 0.16; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(word, x, 0);
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.fillStyle = w.key ? YELLOW : "#ffffff"; ctx.fillText(word, x, 0); ctx.shadowBlur = 0;
        x += ww;
      }
      ctx.restore();
    },
    /** Bold hook text over a real clip (short videos): "LINE ONE|LINE *TWO*" (| breaks, *word* yellow), centred at y,
     *  sized to the safe width. Whole from age 0 (frame 0 must read at once) unless pop; a pulse on zoom punches. */
    hook(text, age, { y = 1040, pop = false, pulse = 0, size: size0 = 104, top = null } = {}) {
      if (age < 0) return null;
      // *a key phrase* may span words ("*UNDER 4 MINUTES*"): every word inside the asterisks is yellow
      let inKey = false;
      let rows = text.split("|").map((r) => r.trim().split(/\s+/).map((w) => {
        const opens = w.startsWith("*"), closes = w.endsWith("*") && (w.length > 1 || inKey);
        const key = inKey || opens; inKey = (inKey || opens) && !closes;
        return { w: w.replace(/\*/g, ""), key };
      }));
      let size = size0; ctx.font = `${size}px ${FONT}`;
      const rowW = (r) => ctx.measureText(r.map((x) => x.w).join(" ")).width, maxW = (W - SAFE.left - SAFE.right - 30) / 1.1;   // room for the punch pulse
      // too long for two big rows: rewrap into more, shorter rows rather than shrink (the hook must read at a glance)
      if (Math.max(...rows.map(rowW)) > maxW) {
        const words = rows.flat(); rows = [[]];
        for (const w of words) { const r = rows.at(-1); if (r.length && rowW([...r, w]) > maxW) rows.push([w]); else r.push(w); }
      }
      while (Math.max(...rows.map(rowW)) > maxW && size > 60) { size -= 4; ctx.font = `${size}px ${FONT}`; }
      const s = (pop ? popScale(age, 0.2) : 1) * (1 + pulse * 0.25), lh = size * 1.08, h = rows.length * lh;
      if (top != null) y = top + h / 2;
      ctx.save(); ctx.translate(SAFE_CX, y); ctx.scale(s, s); ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      let x1 = 0;
      rows.forEach((r, i) => {
        const tw = rowW(r); x1 = Math.max(x1, tw / 2); let x = -tw / 2; const yy = -h / 2 + lh * (i + 0.5);
        for (const [j, w] of r.entries()) {
          const word = w.w + (j < r.length - 1 ? " " : ""), ww = ctx.measureText(word).width;
          ctx.lineWidth = size * 0.2; ctx.strokeStyle = "rgba(0,0,0,0.92)"; ctx.strokeText(word, x, yy);
          ctx.fillStyle = w.key ? YELLOW : "#ffffff"; ctx.fillText(word, x, yy); x += ww;
        }
      });
      ctx.restore();
      return { x0: SAFE_CX - (x1 + size * 0.1) * s, y0: y - (h / 2 + size * 0.1) * s, x1: SAFE_CX + (x1 + size * 0.1) * s, y1: y + (h / 2 + size * 0.1) * s };
    },
    /** The headline question (Master Prompt v2): big at the top for its first seconds, whole from frame 0, one word yellow. */
    headline(text, t, secs, size = 74) {
      const out = Math.min(1, Math.max(0, (t - (secs - 0.3)) / 0.3));
      ctx.save(); ctx.globalAlpha = 1 - out;
      const b = this.hook(text, 1, { size, top: SAFE.top + 10 });
      ctx.restore();
      return b;
    },
    /** A REAL screen BIG: ~80% of the width (x 40..910, clear of the icon column), readable on a phone, with one sticker. */
    bigScreen(img, aspect, age, { outAge = -1, sticker = null, top = 400, big = false } = {}) {
      if (!img) return null;
      const k = Math.min(1, Math.max(0, age) / 0.3), e = 1 - Math.pow(1 - k, 3), fade = outAge > 0 ? Math.max(0, 1 - outAge / 0.25) : 1;
      // big: the whole safe width and taller (a square or upright crop fills it), never past the safe zone
      const [x0, w, maxH] = big ? [SAFE.left + 8, W - SAFE.left - SAFE.right - 16, 880] : [40, 870, 830];
      const h = Math.min(w / aspect, maxH), ww = h * aspect, x = x0 + (w - ww) / 2, y = top + (1 - e) * 70;
      ctx.save(); ctx.globalAlpha = e * fade;
      ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 44; ctx.shadowOffsetY = 16;
      ctx.fillStyle = "#0b0c0e"; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, ww + 16, h + 16, 30); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, ww, h, 24); ctx.clip(); ctx.drawImage(img, x, y, ww, h); ctx.restore();
      ctx.strokeStyle = "rgba(190,242,100,0.75)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, ww + 16, h + 16, 30); ctx.stroke();
      if (sticker && age > 0.45) {
        const px = x + sticker.x * ww, py = y + sticker.y * h, s = popScale(age - 0.45, 0.22), sx = x + (sticker.tx ?? sticker.x) * ww, sy = y + (sticker.ty ?? Math.max(0.06, sticker.y - 0.14)) * h;
        // a ring on the exact spot, a sticker next to it
        ctx.strokeStyle = YELLOW; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(px, py, 34 + Math.sin(age * 5) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.save(); ctx.translate(Math.min(Math.max(sx, 200), 750), sy); ctx.rotate(-0.04); ctx.scale(s, s);
        ctx.font = `46px ${FONT}`; const tw = ctx.measureText(sticker.text).width + 48;
        ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.roundRect(-tw / 2, -40, tw, 80, 20); ctx.fill();
        ctx.fillStyle = "#141414"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sticker.text, 0, 3);
        ctx.restore();
      }
      ctx.restore();
      return { x0: x - 8, y0: y - 8, x1: x + ww + 8, y1: y + h + 8 };
    },
    /** The Trend how-to's frame 0 (owner, 2026-11-03): two REAL public examples of the trend stacked, each with its real
     *  view count and a small credit (not ours), a big two-row title across the seam ("HOW TO MAKE" over a yellow
     *  "WHAT IF VIDEOS"). Whole from age 0; slides up and fades from outAge >= 0. */
    trendSplit(cards, title, age, outAge = -1) {
      const k = outAge > 0 ? Math.min(1, outAge / 0.35) : 0, e = k * k, dy = -260 * e;
      ctx.save(); ctx.globalAlpha = 1 - e;
      ctx.fillStyle = "#0c0d11"; ctx.fillRect(0, 0, W, H);
      const cw = 900, ch = cw * 9 / 16, tops = [300, 300 + ch + 64];
      cards.forEach((c, i) => {
        const x = (W - cw) / 2 - 45, y = tops[i] + dy;   // left of centre: clear of the icon column's middle
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 22); ctx.clip();
        if (c.img) { const r = Math.max(cw / c.img.naturalWidth, ch / c.img.naturalHeight); ctx.drawImage(c.img, x + (cw - c.img.naturalWidth * r) / 2, y + (ch - c.img.naturalHeight * r) / 2, c.img.naturalWidth * r, c.img.naturalHeight * r); }
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 22); ctx.stroke();
        // the view count, as on the platform (bottom left), and the credit under it
        ctx.font = `46px ${FONT}`; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
        const bx = Math.max(SAFE.left + 6, x + 22), by = y + ch - 74;
        // the play triangle is drawn (the emoji font would paint ▶ as a blue tile)
        ctx.beginPath(); ctx.moveTo(bx, by - 17); ctx.lineTo(bx + 30, by); ctx.lineTo(bx, by + 17); ctx.closePath();
        ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.fill();
        ctx.lineWidth = 9; ctx.strokeText(c.views, bx + 44, by); ctx.fillText(c.views, bx + 44, by);
        ctx.font = `26px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(c.credit, bx, by + 42); ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fillText(c.credit, bx, by + 42);
      });
      // the title over the top of the second card: both view counts and credits stay readable
      const seam = tops[1] + 70 + dy;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let size = 84; ctx.font = `${size}px ${FONT}`;
      const maxW = W - SAFE.left - SAFE.right - 30;
      while (Math.max(ctx.measureText(title[0]).width, ctx.measureText(title[1]).width + 50) > maxW && size > 50) { size -= 4; ctx.font = `${size}px ${FONT}`; }
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = "rgba(0,0,0,0.92)"; ctx.strokeText(title[0], SAFE_CX, seam - size * 0.62); ctx.fillStyle = "#ffffff"; ctx.fillText(title[0], SAFE_CX, seam - size * 0.62);
      const tw = ctx.measureText(title[1]).width + 50, th = size * 1.12;
      ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.roundRect(SAFE_CX - tw / 2, seam + size * 0.55 - th / 2, tw, th, 12); ctx.fill();
      ctx.fillStyle = "#0c0d11"; ctx.fillText(title[1], SAFE_CX, seam + size * 0.58);
      ctx.restore();
      return { x0: SAFE.left, y0: tops[0] + dy, x1: W - SAFE.right, y1: tops[1] + ch + dy };
    },
    /** A tap on a real screen: a ring that lands on the spot and stays a moment. */
    tapRing(x, y, age) {
      if (age < 0 || age > 0.85) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, (0.85 - age) / 0.2); ctx.strokeStyle = YELLOW; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(x, y, 70 - 26 * ease(age / 0.18) + Math.sin(age * 7) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    },
    /** A small source stamp: where a fact comes from, or that it is an estimate. */
    stamp(text, age, y = 1212) {
      if (age < 0.2) return null;
      return pill(SAFE_CX, y, 50, [[text, "#e9e9ef"]], { size: 25, scale: 1, border: "rgba(255,255,255,0.3)", bg: "rgba(9,10,10,0.72)" });
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
