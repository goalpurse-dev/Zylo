// Zyvo YouTube tutorials: our own motion-graphic cards, drawn on a canvas at a time t (cards.mjs films them).
// Zyvo colors (near-black, a violet glow, lime and yellow) and our own drawn icons: never another channel's look.
//   keyword  one spoken phrase: a light line + a heavy line, an icon       {icon, light, bold, flip}
//   step     "STEP N" + a two-line title, progress dots                     {n, of, title: [a, b]}
//   proof    a real public example: its picture, its real count, a credit  {image, stat, unit, title, credit, checked}
//   end      the end screen: two video slots and a subscribe circle        {site}
//   bg       the background every screen recording sits on (one frame)
//   thumb    a 1280x720 thumbnail: a real frame, 2-4 big words, a badge   {image, lines: [[text, color]...], badge}
const cv = document.getElementById("out"), ctx = cv.getContext("2d");
const LIME = "#BEF264", YELLOW = "#FFD43B", VIOLET = "#8B5CF6", INK = "#0A0B0E", WHITE = "#FFFFFF";
const SANS = '"Segoe UI Black", "Segoe UI", Arial', SERIF = 'Georgia, "Times New Roman", serif';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - (1 - clamp(x)) ** 3;
const back = (x) => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const images = {};
const img = (src) => images[src] ??= new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(`no picture ${src}`)); i.src = `/file?p=${encodeURIComponent(src)}`; });

function background(t, W = 1920, H = 1080) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  const gx = W * (0.3 + 0.08 * Math.sin(t * 0.6)), gy = H * (0.35 + 0.06 * Math.cos(t * 0.5));
  let g = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.7);
  g.addColorStop(0, "rgba(139,92,246,0.42)"); g.addColorStop(0.55, "rgba(76,29,149,0.14)"); g.addColorStop(1, "rgba(10,11,14,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, W * 0.45);
  g.addColorStop(0, "rgba(190,242,100,0.13)"); g.addColorStop(1, "rgba(190,242,100,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // a faint dot grid, drifting
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 30; y < H; y += 60) for (let x = 30 + ((t * 8) % 60); x < W; x += 60) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
}

/* ── icons: glossy, drawn here, about 1 unit = size ───────────────────── */
function glossy(c1, c2, x0, y0, x1, y1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }
const ICONS = {
  play(s) {   // a monitor with a play button
    ctx.fillStyle = glossy("#C4B5FD", VIOLET, 0, -s * 0.5, 0, s * 0.4); ctx.beginPath(); ctx.roundRect(-s * 0.62, -s * 0.45, s * 1.24, s * 0.8, s * 0.08); ctx.fill();
    ctx.fillStyle = "#1E1B2E"; ctx.beginPath(); ctx.roundRect(-s * 0.54, -s * 0.38, s * 1.08, s * 0.64, s * 0.05); ctx.fill();
    ctx.fillStyle = LIME; ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.22); ctx.lineTo(s * 0.2, -s * 0.06); ctx.lineTo(-s * 0.12, s * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#C4B5FD"; ctx.fillRect(-s * 0.06, s * 0.35, s * 0.12, s * 0.14); ctx.beginPath(); ctx.roundRect(-s * 0.3, s * 0.47, s * 0.6, s * 0.07, s * 0.03); ctx.fill();
  },
  check(s) {
    ctx.fillStyle = glossy("#D9F99D", "#65A30D", 0, -s * 0.5, 0, s * 0.5); ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.11; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.lineTo(-s * 0.05, s * 0.17); ctx.lineTo(s * 0.25, -s * 0.16); ctx.stroke();
  },
  no(s) {
    ctx.strokeStyle = glossy("#FCA5A5", "#DC2626", 0, -s * 0.5, 0, s * 0.5); ctx.lineWidth = s * 0.13;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.3); ctx.lineTo(s * 0.3, -s * 0.3); ctx.stroke();
  },
  clock(s) {
    ctx.fillStyle = "#E5E7EB"; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * s * 0.32, -s * 0.38, s * 0.13, 0, 7); ctx.fill(); }
    ctx.fillStyle = glossy("#FFFFFF", "#C7D2FE", 0, -s * 0.5, 0, s * 0.5); ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, 7); ctx.fill();
    ctx.strokeStyle = VIOLET; ctx.lineWidth = s * 0.06; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineCap = "round"; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.28); ctx.moveTo(0, 0); ctx.lineTo(s * 0.18, s * 0.08); ctx.stroke();
  },
  search(s) {
    ctx.strokeStyle = glossy("#C4B5FD", VIOLET, -s * 0.4, -s * 0.4, s * 0.4, s * 0.4); ctx.lineWidth = s * 0.12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.08, s * 0.3, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.15, s * 0.15); ctx.lineTo(s * 0.42, s * 0.42); ctx.stroke();
    ctx.fillStyle = "rgba(190,242,100,0.25)"; ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.08, s * 0.24, 0, 7); ctx.fill();
  },
  rocket(s) {
    ctx.fillStyle = "#F97316"; ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.3); ctx.lineTo(0, s * 0.55); ctx.lineTo(s * 0.1, s * 0.3); ctx.fill();
    ctx.fillStyle = glossy("#FFFFFF", "#C7D2FE", -s * 0.2, 0, s * 0.2, 0); ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.quadraticCurveTo(s * 0.24, -s * 0.2, s * 0.16, s * 0.3); ctx.lineTo(-s * 0.16, s * 0.3); ctx.quadraticCurveTo(-s * 0.24, -s * 0.2, 0, -s * 0.5); ctx.fill();
    ctx.fillStyle = VIOLET; ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.08, 0, 7); ctx.fill();
    ctx.fillStyle = LIME; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.15, s * 0.05); ctx.lineTo(sx * s * 0.32, s * 0.32); ctx.lineTo(sx * s * 0.15, s * 0.3); ctx.fill(); }
  },
  mic(s) {
    ctx.fillStyle = glossy("#C4B5FD", VIOLET, 0, -s * 0.5, 0, s * 0.2); ctx.beginPath(); ctx.roundRect(-s * 0.16, -s * 0.5, s * 0.32, s * 0.6, s * 0.16); ctx.fill();
    ctx.strokeStyle = "#E5E7EB"; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.28, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.23); ctx.lineTo(0, s * 0.42); ctx.moveTo(-s * 0.16, s * 0.44); ctx.lineTo(s * 0.16, s * 0.44); ctx.stroke();
  },
  film(s) {
    ctx.save(); ctx.rotate(-0.2);
    ctx.fillStyle = "#1E1B2E"; ctx.beginPath(); ctx.roundRect(-s * 0.6, -s * 0.24, s * 1.2, s * 0.48, s * 0.05); ctx.fill();
    ctx.fillStyle = "#E5E7EB"; for (let i = 0; i < 8; i++) { ctx.fillRect(-s * 0.55 + i * s * 0.145, -s * 0.21, s * 0.07, s * 0.06); ctx.fillRect(-s * 0.55 + i * s * 0.145, s * 0.15, s * 0.07, s * 0.06); }
    for (let i = 0; i < 3; i++) { ctx.fillStyle = glossy("#C4B5FD", VIOLET, 0, -s * 0.1, 0, s * 0.1); ctx.fillRect(-s * 0.5 + i * s * 0.35, -s * 0.12, s * 0.3, s * 0.24); }
    ctx.restore();
  },
  cloud(s) {
    ctx.fillStyle = glossy("#FFFFFF", "#C7D2FE", 0, -s * 0.4, 0, s * 0.2);
    ctx.beginPath(); ctx.arc(-s * 0.22, 0, s * 0.22, 0, 7); ctx.arc(s * 0.05, -s * 0.12, s * 0.3, 0, 7); ctx.arc(s * 0.3, s * 0.03, s * 0.2, 0, 7); ctx.fill();
    ctx.fillRect(-s * 0.22, 0, s * 0.52, s * 0.22);
    ctx.fillStyle = VIOLET; ctx.fillRect(-s * 0.05, -s * 0.05, s * 0.1, s * 0.3); ctx.beginPath(); ctx.moveTo(-s * 0.16, s * 0.22); ctx.lineTo(0, s * 0.42); ctx.lineTo(s * 0.16, s * 0.22); ctx.fill();
  },
  gear(s) {
    ctx.fillStyle = glossy("#E5E7EB", "#9CA3AF", 0, -s * 0.5, 0, s * 0.5); ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.34 : s * 0.46; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, 7); ctx.fill();
  },
  bolt(s) {
    ctx.fillStyle = glossy("#FEF08A", "#EAB308", 0, -s * 0.5, 0, s * 0.5); ctx.beginPath();
    ctx.moveTo(s * 0.08, -s * 0.5); ctx.lineTo(-s * 0.26, s * 0.06); ctx.lineTo(-s * 0.02, s * 0.06); ctx.lineTo(-s * 0.1, s * 0.5); ctx.lineTo(s * 0.26, -s * 0.08); ctx.lineTo(s * 0.02, -s * 0.08); ctx.closePath(); ctx.fill();
  },
  chart(s) {
    const hs = [0.3, 0.5, 0.75, 1.0];
    hs.forEach((h, i) => { ctx.fillStyle = glossy(i === 3 ? "#D9F99D" : "#C4B5FD", i === 3 ? "#65A30D" : VIOLET, 0, -s * 0.5, 0, s * 0.5); ctx.beginPath(); ctx.roundRect(-s * 0.48 + i * s * 0.26, s * 0.45 - h * s * 0.85, s * 0.2, h * s * 0.85, s * 0.04); ctx.fill(); });
  },
  eye(s) {
    ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.moveTo(-s * 0.55, 0); ctx.quadraticCurveTo(0, -s * 0.5, s * 0.55, 0); ctx.quadraticCurveTo(0, s * 0.5, -s * 0.55, 0); ctx.fill();
    ctx.fillStyle = VIOLET; ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, s * 0.09, 0, 7); ctx.fill();
  },
  sparkle(s) {
    const star = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); };
    star(-s * 0.08, s * 0.05, s * 0.45, LIME); star(s * 0.32, -s * 0.3, s * 0.18, YELLOW); star(s * 0.28, s * 0.35, s * 0.12, "#C4B5FD");
  },
  hourglass(s) {
    ctx.fillStyle = "#E5E7EB"; ctx.fillRect(-s * 0.32, -s * 0.5, s * 0.64, s * 0.08); ctx.fillRect(-s * 0.32, s * 0.42, s * 0.64, s * 0.08);
    ctx.fillStyle = "rgba(199,210,254,0.5)"; ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.42); ctx.lineTo(s * 0.26, -s * 0.42); ctx.lineTo(s * 0.04, 0); ctx.lineTo(s * 0.26, s * 0.42); ctx.lineTo(-s * 0.26, s * 0.42); ctx.lineTo(-s * 0.04, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.42); ctx.lineTo(s * 0.18, s * 0.42); ctx.lineTo(0, s * 0.16); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.3); ctx.lineTo(s * 0.12, -s * 0.3); ctx.lineTo(0, -s * 0.1); ctx.fill();
  },
};
function icon(name, x, y, s, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2.2) * 8); ctx.shadowColor = "rgba(139,92,246,0.7)"; ctx.shadowBlur = 60;
  (ICONS[name] ?? ICONS.sparkle)(s); ctx.restore();
}

function fit(text, font, size, max) { ctx.font = `${size}px ${font}`; while (ctx.measureText(text).width > max && size > 30) { size -= 4; ctx.font = `${size}px ${font}`; } return size; }
const fadeIO = (t, dur) => clamp(t / 0.18) * clamp((dur - t) / 0.22);

async function keyword(c, t, dur) {
  background(t);
  const a = fadeIO(t, dur), flip = !!c.flip, ix = flip ? 1380 : 540, tx = flip ? 900 : 1020;
  ctx.globalAlpha = a;
  const s = 300 * back(t / 0.45);
  icon(c.icon, ix, 540, s, t);
  ctx.textAlign = flip ? "right" : "left"; ctx.textBaseline = "alphabetic";
  const k = ease((t - 0.08) / 0.4), dx = (1 - k) * (flip ? -60 : 60);
  ctx.globalAlpha = a * k;
  if (c.light) { const sz = fit(c.light, `italic ${SERIF}`, 76, 760); ctx.fillStyle = "#C4B5FD"; ctx.fillText(c.light, tx + dx, 500); void sz; }
  if (c.bold) { fit(c.bold, SANS, 128, 820); ctx.fillStyle = WHITE; ctx.shadowColor = "rgba(190,242,100,0.35)"; ctx.shadowBlur = 30; ctx.fillText(c.bold, tx + dx, c.light ? 640 : 590); ctx.shadowBlur = 0; }
  ctx.globalAlpha = 1;
}

async function step(c, t, dur) {
  background(t);
  const a = fadeIO(t, dur); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const k = back(t / 0.4), w = 420, h = 130;
  ctx.save(); ctx.translate(960, 330); ctx.scale(k, k);
  ctx.fillStyle = LIME; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 65); ctx.fill();
  ctx.fillStyle = INK; ctx.font = `92px ${SANS}`; ctx.fillText(`STEP ${c.n}`, 0, 6); ctx.restore();
  const k2 = ease((t - 0.15) / 0.45);
  ctx.globalAlpha = a * k2;
  const [l1, l2] = c.title;
  fit(l1, SANS, 104, 1600); ctx.fillStyle = WHITE; ctx.fillText(l1, 960, 560 + (1 - k2) * 40);
  if (l2) { fit(l2, SANS, 104, 1600); ctx.fillStyle = YELLOW; ctx.fillText(l2, 960, 690 + (1 - k2) * 40); }
  if (c.of) for (let i = 0; i < c.of; i++) { ctx.fillStyle = i < c.n ? LIME : "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(960 - c.of * 45 + i * 90 + 10, 860, 70, 14, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

async function proof(c, t, dur) {
  background(t);
  const a = fadeIO(t, dur); ctx.globalAlpha = a;
  const im = c.image ? await img(c.image) : null;
  const k = back(t / 0.5);
  if (im) {
    const w = 860, h = w * 9 / 16; ctx.save(); ctx.translate(560, 520); ctx.rotate(-0.03); ctx.scale(k, k);
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 50; ctx.fillStyle = "#111"; ctx.beginPath(); ctx.roundRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 28); ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 20); ctx.clip();
    const r = Math.max(w / im.width, h / im.height); ctx.drawImage(im, -im.width * r / 2, -im.height * r / 2, im.width * r, im.height * r); ctx.restore();
  }
  // the real count rolls up to its value
  const roll = ease((t - 0.3) / 1.0), v = c.value * roll;
  const shown = c.value >= 1e6 ? `${(Math.floor(v / 1e5) / 10).toFixed(1)}M` : c.value >= 1e3 ? `${Math.floor(v / 1e3)}K` : String(Math.round(v));
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = YELLOW; ctx.font = `190px ${SANS}`; ctx.fillText(roll >= 1 ? c.stat : shown, 1080, 470);
  ctx.fillStyle = WHITE; ctx.font = `64px ${SANS}`; ctx.fillText(c.unit ?? "views", 1086, 560);
  if (c.title) { fit(c.title, SANS, 44, 780); ctx.fillStyle = "#E5E7EB"; ctx.fillText(c.title, 1086, 650); }
  ctx.font = `34px "Segoe UI", Arial`; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillText(`${c.credit}${c.checked ? ` · views checked ${c.checked}` : ""}`, 1086, 720);
  ctx.globalAlpha = 1;
}

async function end(c, t, dur) {
  background(t);
  const a = clamp(t / 0.3); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = WHITE; ctx.font = `96px ${SANS}`; ctx.fillText("WATCH NEXT", 960, 170);
  // the end-screen elements are placed in YouTube Studio over these slots (two videos, subscribe in the middle)
  for (const x of [210, 1110]) { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 4; ctx.setLineDash([18, 14]); ctx.beginPath(); ctx.roundRect(x, 330, 600, 338, 24); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = LIME; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(960, 500, 110, 0, 7); ctx.stroke();
  ctx.fillStyle = "#DC2626"; ctx.beginPath(); ctx.roundRect(840, 650, 240, 64, 32); ctx.fill(); ctx.fillStyle = WHITE; ctx.font = `34px ${SANS}`; ctx.fillText("SUBSCRIBE", 960, 683);
  ctx.fillStyle = LIME; ctx.font = `60px ${SANS}`; ctx.fillText(c.site ?? "tryzyvo.com", 960, 900);
  ctx.globalAlpha = 1;
}

async function thumb(c) {
  const W = 1280, H = 720; cv.width = W; cv.height = H;
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  if (c.image) { const im = await img(c.image), r = Math.max(W / im.width, H / im.height); ctx.drawImage(im, (W - im.width * r) / 2 + (c.shift ?? 0), (H - im.height * r) / 2, im.width * r, im.height * r); }
  const g = ctx.createLinearGradient(0, 0, W * 0.75, 0); g.addColorStop(0, "rgba(10,11,14,0.92)"); g.addColorStop(0.6, "rgba(10,11,14,0.55)"); g.addColorStop(1, "rgba(10,11,14,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  let y = c.top ?? 230;
  for (const [text, color, size = 120] of c.lines) {
    ctx.font = `${size}px ${SANS}`; ctx.lineWidth = size * 0.14; ctx.strokeStyle = INK; ctx.strokeText(text, 60, y); ctx.fillStyle = color === "lime" ? LIME : color === "yellow" ? YELLOW : WHITE; ctx.fillText(text, 60, y); y += size * 1.05;
  }
  if (c.badge) { ctx.font = `44px ${SANS}`; const w = ctx.measureText(c.badge).width + 60; ctx.fillStyle = "#DC2626"; ctx.beginPath(); ctx.roundRect(60, H - 130, w, 80, 40); ctx.fill(); ctx.fillStyle = WHITE; ctx.fillText(c.badge, 90, H - 74); }
}

function bg() { background(0); }

window.renderCard = async (c, t, dur) => {
  if (c.kind === "thumb") return thumb(c);
  cv.width = 1920; cv.height = 1080;
  if (c.kind === "bg") return bg();
  await ({ keyword, step, proof, end }[c.kind] ?? keyword)(c, t, dur);
};
window.ready = true;
