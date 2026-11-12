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
/* ── little animated scenes (owner, 2026-11-08: "hiring an animator → an animator pops up with a contract"): drawn
   around (0, 0), about s wide, animated by t. Used by keyword cards and notes in place of an icon. ── */
function person(x, y, s, { hat = null, body = VIOLET, mood = "smile" } = {}) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-s * 0.32, s * 0.05, s * 0.64, s * 0.6, s * 0.2); ctx.fill();
  ctx.fillStyle = "#F5D0A9"; ctx.beginPath(); ctx.arc(0, -s * 0.18, s * 0.24, 0, 7); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.2, s * 0.03, 0, 7); ctx.arc(s * 0.08, -s * 0.2, s * 0.03, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.025; ctx.beginPath();
  if (mood === "tired") { ctx.moveTo(-s * 0.08, -s * 0.06); ctx.lineTo(s * 0.08, -s * 0.06); } else ctx.arc(0, -s * 0.12, s * 0.08, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (hat === "beret") { ctx.fillStyle = "#DC2626"; ctx.beginPath(); ctx.ellipse(-s * 0.02, -s * 0.4, s * 0.24, s * 0.08, -0.2, 0, 7); ctx.fill(); ctx.fillRect(-s * 0.01, -s * 0.52, s * 0.03, s * 0.06); }
  ctx.restore();
}
function paper(x, y, w, h, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 20; ctx.fillStyle = "#F8FAFC"; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();
}
const SCENES = {
  // an animator pops up, a contract slides in, a pen signs it, a price tag stamps on
  animator(s, t) {
    const k = back(t / 0.4); ctx.save(); ctx.scale(k, k); person(-s * 0.32, 0, s * 0.62, { hat: "beret", body: "#2563EB" }); ctx.restore();
    const c = ease((t - 0.3) / 0.45), cx = s * 0.28 + (1 - c) * s * 0.6;
    ctx.globalAlpha = c; paper(cx, s * 0.02, s * 0.42, s * 0.56, 0.06);
    ctx.save(); ctx.translate(cx, s * 0.02); ctx.rotate(0.06);
    ctx.fillStyle = INK; ctx.font = `bold ${s * 0.06}px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("CONTRACT", 0, -s * 0.18);
    ctx.fillStyle = "#CBD5E1"; for (let i = 0; i < 4; i++) ctx.fillRect(-s * 0.15, -s * 0.12 + i * s * 0.05, s * 0.3, s * 0.012);
    // the signature, drawn stroke by stroke
    const sig = clamp((t - 0.75) / 0.6); ctx.strokeStyle = "#1D4ED8"; ctx.lineWidth = s * 0.012; ctx.beginPath();
    for (let i = 0; i <= 40 * sig; i++) { const u = i / 40; ctx.lineTo(-s * 0.14 + u * s * 0.28, s * 0.16 + Math.sin(u * 18) * s * 0.025); } ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    const p = back((t - 1.3) / 0.35);
    if (t > 1.3) { ctx.save(); ctx.translate(s * 0.42, -s * 0.3); ctx.rotate(-0.25); ctx.scale(p, p); ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.roundRect(-s * 0.13, -s * 0.06, s * 0.26, s * 0.12, s * 0.03); ctx.fill(); ctx.fillStyle = INK; ctx.font = `${s * 0.08}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$$$", 0, s * 0.005); ctx.restore(); }
  },
  // calendar days flipping by next to a slowly turning wireframe cube: days of 3D work
  days(s, t) {
    const day = 1 + Math.min(6, Math.floor(t * 3.2));
    paper(-s * 0.25, 0, s * 0.4, s * 0.46, -0.04);
    ctx.save(); ctx.translate(-s * 0.25, 0); ctx.rotate(-0.04);
    ctx.fillStyle = "#DC2626"; ctx.fillRect(-s * 0.2, -s * 0.23, s * 0.4, s * 0.1);
    ctx.fillStyle = WHITE; ctx.font = `${s * 0.05}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("DAY", 0, -s * 0.18);
    const flip = (t * 3.2) % 1; ctx.fillStyle = INK; ctx.font = `${s * 0.2}px ${SANS}`; ctx.save(); ctx.scale(1, day < 7 ? 1 - Math.max(0, flip - 0.8) * 4 : 1); ctx.fillText(String(day), 0, s * 0.05); ctx.restore();
    ctx.restore();
    const a = t * 1.2, P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => { const X = x * Math.cos(a) - z * Math.sin(a), Z = x * Math.sin(a) + z * Math.cos(a), Y = y * Math.cos(0.5) - Z * Math.sin(0.5); return [s * 0.28 + X * s * 0.12, Y * s * 0.12]; });
    ctx.strokeStyle = LIME; ctx.lineWidth = s * 0.012; ctx.beginPath();
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { ctx.moveTo(...P[i]); ctx.lineTo(...P[j]); }
    ctx.stroke();
  },
  // a code bracket and an editing timeline, each crossed out with a red stamp
  nocode(s, t) {
    const box = (x, draw, at) => {
      const k = back((t - at) / 0.35); ctx.save(); ctx.translate(x, 0); ctx.scale(k, k);
      ctx.fillStyle = "#1E1B2E"; ctx.beginPath(); ctx.roundRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.4, s * 0.05); ctx.fill(); draw(); ctx.restore();
      const x2 = back((t - at - 0.45) / 0.3); if (t > at + 0.45) { ctx.save(); ctx.translate(x, 0); ctx.scale(x2, x2); ctx.strokeStyle = "#EF4444"; ctx.lineWidth = s * 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.18); ctx.lineTo(s * 0.18, s * 0.18); ctx.moveTo(s * 0.18, -s * 0.18); ctx.lineTo(-s * 0.18, s * 0.18); ctx.stroke(); ctx.restore(); }
    };
    box(-s * 0.25, () => { ctx.fillStyle = "#C4B5FD"; ctx.font = `${s * 0.16}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("</>", 0, 0); }, 0);
    box(s * 0.25, () => { for (let i = 0; i < 3; i++) { ctx.fillStyle = [VIOLET, LIME, YELLOW][i]; ctx.fillRect(-s * 0.15 + i * s * 0.03, -s * 0.1 + i * s * 0.08, s * 0.22, s * 0.05); } ctx.fillStyle = "#EF4444"; ctx.fillRect(s * 0.02, -s * 0.15, s * 0.01, s * 0.3); }, 0.25);
  },
  // a phone with a feed of cut-away videos scrolling up, hearts popping
  feed(s, t) {
    const w = s * 0.42, h = s * 0.78;
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.roundRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 36); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 28); ctx.clip();
    const off = (t * h * 0.45) % h;
    for (let i = -1; i < 2; i++) {
      const y0 = -h / 2 + i * h - off + h;
      ctx.fillStyle = ["#7DD3FC", "#A7F3D0", "#FDE68A"][(i + 3) % 3]; ctx.fillRect(-w / 2, y0, w, h * 0.4);
      // a cut-away: soil layers with a pipe through them
      ["#92400E", "#78350F", "#57534E"].forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(-w / 2, y0 + h * (0.4 + j * 0.2), w, h * 0.2); });
      ctx.fillStyle = "#E5E7EB"; ctx.fillRect(-w * 0.3, y0 + h * 0.55, w * 0.6, h * 0.05);
    }
    ctx.restore();
    for (let i = 0; i < 3; i++) { const a = (t * 1.6 + i * 0.33) % 1; ctx.globalAlpha = 1 - a; ctx.fillStyle = "#F43F5E"; ctx.font = `${s * 0.09}px "Segoe UI Emoji"`; ctx.fillText("❤", w * 0.32 + i * s * 0.03, h * 0.2 - a * s * 0.4); } ctx.globalAlpha = 1;
  },
  // a person slumped at a desk under a growing stack of frames to draw
  tired(s, t) {
    ctx.fillStyle = "#3F3F46"; ctx.fillRect(-s * 0.45, s * 0.2, s * 0.9, s * 0.05);
    person(-s * 0.1, s * 0.0 + Math.sin(t * 2) * s * 0.01, s * 0.5, { body: "#64748B", mood: "tired" });
    const n = Math.min(9, Math.floor(t * 6)); for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? "#E2E8F0" : "#CBD5E1"; ctx.fillRect(s * 0.15, s * 0.16 - i * s * 0.045, s * 0.28, s * 0.04); }
    ctx.fillStyle = "#7DD3FC"; const d = (t * 1.5) % 1; ctx.globalAlpha = 1 - d; ctx.beginPath(); ctx.arc(s * 0.02, -s * 0.12 + d * s * 0.12, s * 0.02, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  },
  // a clipboard: three questions ticked off one by one
  checklist(s, t) {
    paper(0, 0, s * 0.5, s * 0.66);
    ctx.fillStyle = "#94A3B8"; ctx.beginPath(); ctx.roundRect(-s * 0.1, -s * 0.36, s * 0.2, s * 0.07, s * 0.02); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const y = -s * 0.16 + i * s * 0.15; ctx.strokeStyle = "#94A3B8"; ctx.lineWidth = s * 0.01; ctx.strokeRect(-s * 0.19, y - s * 0.035, s * 0.07, s * 0.07);
      ctx.fillStyle = "#CBD5E1"; ctx.fillRect(-s * 0.08, y - s * 0.01, s * 0.25, s * 0.02);
      const k = back((t - 0.3 - i * 0.35) / 0.3); if (t > 0.3 + i * 0.35) { ctx.save(); ctx.translate(-s * 0.155, y); ctx.scale(k, k); ctx.strokeStyle = "#16A34A"; ctx.lineWidth = s * 0.025; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-s * 0.03, 0); ctx.lineTo(-s * 0.005, s * 0.03); ctx.lineTo(s * 0.045, -s * 0.035); ctx.stroke(); ctx.restore(); }
    }
  },
  // a stopwatch running up to a real measured time ({seconds} in the spec)
  stopwatch(s, t, c) {
    const v = Math.round((c.seconds ?? 288) * ease(t / 1.2));
    ctx.fillStyle = "#E5E7EB"; ctx.fillRect(-s * 0.04, -s * 0.42, s * 0.08, s * 0.08);
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, 7); ctx.fill(); ctx.strokeStyle = VIOLET; ctx.lineWidth = s * 0.03; ctx.stroke();
    const a = (v / 60) * Math.PI * 2 - Math.PI / 2; ctx.strokeStyle = "#EF4444"; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `${s * 0.1}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`, 0, s * 0.15);
  },
  // the same style everywhere: three phones popping in, each showing a cut-away
  everywhere(s, t) {
    [-0.32, 0, 0.32].forEach((x, i) => { const k = back((t - i * 0.18) / 0.35); ctx.save(); ctx.translate(x * s, (i === 1 ? -0.04 : 0.04) * s); ctx.rotate((i - 1) * 0.12); ctx.scale(k * 0.62, k * 0.62); SCENES.feed(s, t + i); ctx.restore(); });
  },
};
function scene(name, x, y, s, t, c = {}) { ctx.save(); ctx.translate(x, y); (SCENES[name] ?? SCENES.checklist)(s, t, c); ctx.restore(); }

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
  if (c.scene) scene(c.scene, ix, 540, 640, t, c); else icon(c.icon, ix, 540, 300 * back(t / 0.45), t);
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

// the end screen (owner, 2026-11-08: no empty video boxes): an animated close. The site pops in at the middle, icons
// orbit it, a phone of cut-aways floats beside it, and a cursor clicks a subscribe button that turns to "Subscribed".
async function end(c, t0, dur) {
  const t = t0 + (c.t0 ?? 0);   // the end screen runs on across its lines (c.t0: where this line picks it up)
  background(t);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = 960, cy = 470;
  // pulsing rings
  for (let i = 0; i < 3; i++) { const r = ((t * 0.6 + i / 3) % 1); ctx.strokeStyle = `rgba(190,242,100,${0.35 * (1 - r)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 160 + r * 320, 0, 7); ctx.stroke(); }
  // orbiting icons
  ["play", "check", "rocket", "sparkle", "film", "clock"].forEach((n, i) => { const a = t * 0.5 + (i / 6) * Math.PI * 2; icon(n, cx + Math.cos(a) * 470, cy + Math.sin(a) * 260, 110 * back((t - 0.1 * i) / 0.4), t + i); });
  const k = back(t / 0.5);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.fillStyle = "rgba(10,11,14,0.85)"; ctx.beginPath(); ctx.roundRect(-330, -90, 660, 180, 90); ctx.fill(); ctx.strokeStyle = LIME; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = LIME; ctx.font = `96px ${SANS}`; ctx.fillText(c.site ?? "tryzyvo.com", 0, 6); ctx.restore();
  // the subscribe button and a cursor that clicks it
  const bk = back((t - 0.6) / 0.4), clicked = t > 2.2, by = 790;
  ctx.save(); ctx.translate(cx, by); ctx.scale(bk * (clicked && t < 2.35 ? 0.92 : 1), bk * (clicked && t < 2.35 ? 0.92 : 1));
  ctx.fillStyle = clicked ? "#3F3F46" : "#DC2626"; ctx.beginPath(); ctx.roundRect(-190, -48, 380, 96, 48); ctx.fill();
  ctx.fillStyle = WHITE; ctx.font = `46px ${SANS}`; ctx.fillText(clicked ? "SUBSCRIBED ✓" : "SUBSCRIBE", 0, 4); ctx.restore();
  if (t > 1.0) {
    const m = ease((t - 1.0) / 1.1), px = cx + 420 - m * 380, py = by + 160 - m * 150;
    ctx.save(); ctx.translate(px, py); ctx.fillStyle = WHITE; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.lineTo(16, 46); ctx.lineTo(28, 72); ctx.lineTo(40, 66); ctx.lineTo(28, 41); ctx.lineTo(48, 41); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    if (clicked) { const r = clamp((t - 2.2) / 0.4); ctx.strokeStyle = `rgba(255,255,255,${1 - r})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, 20 + r * 60, 0, 7); ctx.stroke(); }
  }
  void dur;
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

/* ── the split view (owner, 2026-11-07): 75 % on the left for a screen recording / example video (or a keyword while
   it explains), 25 % on the right for a live step panel: the step number, its keyword, an animated icon and the
   tracker of all steps (done ones stamped with a check, the current one highlighted and filling) ── */
export const LEFT = { x: 36, y: 36, w: 1404, h: 1008 }, PANEL = { x: 1468, y: 36, w: 416, h: 1008 };
function wrap(text, font, size, max) {
  ctx.font = `${size}px ${font}`; const out = []; let line = "";
  for (const w of String(text).split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function slotLeft(L, t) {
  const { x, y, w, h } = LEFT;
  if (L.filled) {   // the owner's footage is laid in here by the assembly: a clean frame around a hole
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
    ctx.strokeStyle = "rgba(190,242,100,0.55)"; ctx.lineWidth = 4; ctx.stroke(); return;
  }
  ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
  ctx.setLineDash([22, 16]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = "rgba(190,242,100,0.7)"; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([]);
  // a slow scan line, so a placeholder still moves
  const sy = y + ((t * 260) % h); const g = ctx.createLinearGradient(0, sy - 60, 0, sy); g.addColorStop(0, "rgba(190,242,100,0)"); g.addColorStop(1, "rgba(190,242,100,0.10)");
  ctx.fillStyle = g; ctx.fillRect(x + 4, Math.max(y, sy - 60), w - 8, Math.min(60, sy - y));
  // no text in the slot (owner, 2026-11-08): the footage goes here; slots.txt says what each one shows
  if (L.label) { ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = LIME; ctx.font = `46px ${SANS}`; ctx.fillText(`SLOT ${String(L.n).padStart(2, "0")}  ·  ${L.secs.toFixed(1)} s`, x + 70, y + 120); ctx.fillStyle = WHITE; wrap(L.show, SANS, 64, w - 140).slice(0, 7).forEach((l, i) => ctx.fillText(l, x + 70, y + 250 + i * 82)); }
}
void wrap;
function noteLeft(N, t) {
  const { x, y, w, h } = LEFT, cx = x + w / 2;
  ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
  if (N.scene) scene(N.scene, cx, y + 300, 560, t, N); else icon(N.icon, cx, y + 360, 260 * back(t / 0.45), t);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const k = ease((t - 0.08) / 0.4);
  ctx.globalAlpha = k;
  if (N.light) { fit(N.light, `italic ${SERIF}`, 70, w - 160); ctx.fillStyle = "#C4B5FD"; ctx.fillText(N.light, cx + (1 - k) * 60, y + 640); }
  if (N.bold) { fit(N.bold, SANS, 120, w - 160); ctx.fillStyle = WHITE; ctx.fillText(N.bold, cx + (1 - k) * 60, y + 790); }
  ctx.globalAlpha = 1;
}
function panel(P, t, dur) {
  const { x, y, w, h } = PANEL, cx = x + w / 2;
  ctx.fillStyle = "rgba(10,11,14,0.75)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
  ctx.strokeStyle = "rgba(139,92,246,0.45)"; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cur = P.steps.find((s) => s.n === P.current);
  if (cur) {
    const k = P.enter ? back(t / 0.4) : 1;
    ctx.save(); ctx.translate(cx, y + 90); ctx.scale(k, k);
    ctx.fillStyle = LIME; ctx.beginPath(); ctx.roundRect(-140, -46, 280, 92, 46); ctx.fill();
    ctx.fillStyle = INK; ctx.font = `60px ${SANS}`; ctx.fillText(`STEP ${cur.n}`, 0, 4); ctx.restore();
    icon(cur.icon ?? "sparkle", cx, y + 270, 170 * (P.enter ? back((t - 0.1) / 0.45) : 1), t);
    fit(cur.keyword, SANS, 64, w - 50); ctx.fillStyle = WHITE; ctx.fillText(cur.keyword, cx, y + 420);
  } else {
    ctx.fillStyle = YELLOW; ctx.font = `46px ${SANS}`; ctx.fillText(P.title ?? "IN THIS VIDEO", cx, y + 90);
    icon(P.icon ?? "play", cx, y + 260, 170, t);
  }
  // the tracker: one row per step
  const top = y + 500, row = Math.min(70, (h - 520) / P.steps.length);
  P.steps.forEach((s, i) => {
    const ry = top + i * row, done = s.n < (P.current ?? 0), now = s.n === P.current;
    if (now) {
      ctx.fillStyle = "rgba(190,242,100,0.14)"; ctx.beginPath(); ctx.roundRect(x + 14, ry - row / 2 + 6, w - 28, row - 12, 16); ctx.fill();
      const f = (P.fill0 ?? 0) + ((P.fill1 ?? 1) - (P.fill0 ?? 0)) * clamp(t / Math.max(0.1, dur)); ctx.fillStyle = "rgba(190,242,100,0.30)";
      ctx.beginPath(); ctx.roundRect(x + 14, ry - row / 2 + 6, (w - 28) * f, row - 12, 16); ctx.fill();
    }
    // the check stamps in when its step was just finished
    const stampK = done && s.n === (P.current ?? 0) - 1 && P.enter ? back((t - 0.05) / 0.35) : 1;
    ctx.save(); ctx.translate(x + 50, ry); ctx.scale(done ? stampK : 1, done ? stampK : 1);
    ctx.fillStyle = done ? LIME : now ? "rgba(190,242,100,0.25)" : "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
    if (done) { ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, 8); ctx.lineTo(10, -8); ctx.stroke(); }
    else { ctx.fillStyle = now ? LIME : "rgba(255,255,255,0.6)"; ctx.font = `24px ${SANS}`; ctx.fillText(String(s.n), 0, 2); }
    ctx.restore();
    ctx.textAlign = "left"; ctx.font = `${now ? 34 : 30}px ${SANS}`; ctx.fillStyle = done ? "rgba(255,255,255,0.55)" : now ? WHITE : "rgba(255,255,255,0.6)";
    ctx.fillText(s.label, x + 86, ry + 2); ctx.textAlign = "center";
  });
}
async function split(c, t, dur) {
  background(t);
  if (c.left.type === "slot") slotLeft(c.left, t); else noteLeft(c.left, t);
  panel(c.panel, t, dur);
}

window.renderCard = async (c, t, dur) => {
  if (c.kind === "thumb") return thumb(c);
  cv.width = 1920; cv.height = 1080;
  if (c.kind === "bg") return bg();
  await ({ keyword, step, proof, end, split }[c.kind] ?? keyword)(c, t, dur);
};
window.ready = true;
