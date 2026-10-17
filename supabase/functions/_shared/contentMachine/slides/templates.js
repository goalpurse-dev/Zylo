// Content Machine: the slide templates. One self-contained HTML page per 1080×1920 slide. The SAME code
// draws the admin preview (in the browser, $0, even in a dry run) and the real PNGs (Chromium on Fly,
// render-worker/src/cmSlides.mjs), so what the owner previews is what gets posted.
//
// Images are backgrounds and illustrations only; every word is drawn here, so it is always sharp.
// Real logos are never drawn: a tool gets an icon tile with its initials and its name.
// Keeps clear of the platforms' own UI: nothing important in the bottom 400 px or the right 150 px.

export const SIZE = Object.freeze({ width: 1080, height: 1920 });
const SAFE = { top: 150, side: 90, right: 150, bottom: 420 };

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const safeUrl = (u) => (/^(https?:|data:image\/|file:)/i.test(String(u ?? "")) ? String(u).replace(/"/g, "%22") : "");

/** "*key phrase*" → the highlight bar. Everything else escaped. */
export function highlight(text) {
  return esc(text).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>').replace(/\*/g, "");
}

const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
export function initials(name) {
  const parts = String(name ?? "?").replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}
export function domain(url) {
  return String(url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").slice(0, 40);
}

export const FONT_CSS = {
  google: '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=block" rel="stylesheet">',
  local: (base) => `<style>
@font-face{font-family:"Anton";src:url("${base}/Anton-Regular.ttf") format("truetype");font-display:block}
@font-face{font-family:"Inter";src:url("${base}/Inter-Variable.ttf") format("truetype");font-weight:100 900;font-display:block}
</style>`,
};

function css(style) {
  const head = style.font === "inter" ? `"Inter", sans-serif` : `"Anton", "Impact", sans-serif`;
  const headWeight = style.font === "inter" ? 800 : 400;
  const light = isLight(style.bg);
  return `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden;background:${style.bg}}
body{font-family:"Inter",system-ui,sans-serif;color:${style.fg};-webkit-font-smoothing:antialiased}
.slide{position:relative;width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
.bg,.bg img{position:absolute;inset:0;width:100%;height:100%}
.bg img{object-fit:cover}
.shade{position:absolute;inset:0;background:${light ? "linear-gradient(180deg,rgba(246,243,238,.55),rgba(246,243,238,.82))" : "linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,.25) 35%,rgba(0,0,0,.70) 100%)"}}
.grid{position:absolute;inset:0;background-image:linear-gradient(${hexA(style.accent, 0.16)} 2px,transparent 2px),linear-gradient(90deg,${hexA(style.accent, 0.16)} 2px,transparent 2px);background-size:90px 90px;mask-image:radial-gradient(ellipse at 50% 40%,#000 30%,transparent 80%)}
.glow{position:absolute;width:1100px;height:1100px;left:-10px;top:300px;border-radius:50%;background:radial-gradient(circle,${hexA(style.accent, 0.45)},transparent 65%);filter:blur(40px)}
.content{position:absolute;left:${SAFE.side}px;right:${SAFE.right}px;top:${SAFE.top}px;bottom:${SAFE.bottom}px;display:flex;flex-direction:column;gap:36px}
.center{justify-content:safe center}
.content>*{flex-shrink:0}
.top{justify-content:flex-start}
.counter{position:absolute;top:60px;left:${SAFE.side}px;font:600 30px "Inter";letter-spacing:.06em;color:${hexA(style.fg, 0.7)};background:${hexA(light ? "#000000" : "#ffffff", 0.08)};border:2px solid ${hexA(style.fg, 0.15)};padding:8px 20px;border-radius:999px}
.kicker{font:800 34px "Inter";letter-spacing:.14em;text-transform:uppercase;color:${style.accent}}
.headline{font-family:${head};font-weight:${headWeight};text-transform:${style.font === "inter" ? "none" : "uppercase"};line-height:1.12;letter-spacing:${style.font === "inter" ? "-0.02em" : "0.005em"};font-size:120px;color:${style.fg};text-wrap:balance;max-height:900px;overflow:hidden}
.hl{background:${style.highlight};color:${isLight(style.highlight) ? "#0b0b0f" : "#ffffff"};padding:0 .12em;margin:0 -.02em;line-height:1.02;display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone;border-radius:.06em}
.body{font:500 52px/1.32 "Inter";color:${hexA(style.fg, 0.9)};max-height:520px;overflow:hidden}
.items{display:flex;flex-direction:column;gap:22px}
.item{display:flex;gap:26px;align-items:flex-start;font:600 52px/1.25 "Inter"}
.dot{flex:none;width:22px;height:22px;margin-top:16px;border-radius:50%;background:${style.accent}}
.box{flex:none;width:56px;height:56px;margin-top:4px;border:5px solid ${style.accent};border-radius:12px;position:relative}
.box::after{content:"";position:absolute;left:11px;top:2px;width:14px;height:26px;border:solid ${style.highlight};border-width:0 7px 7px 0;transform:rotate(45deg)}
.card{display:flex;flex-direction:column;gap:30px;padding:56px;border-radius:44px;background:${hexA(light ? "#ffffff" : "#0b0b12", light ? 0.85 : 0.72)};border:2px solid ${hexA(style.fg, 0.12)};backdrop-filter:blur(8px)}
.tile{width:220px;height:220px;border-radius:52px;display:flex;align-items:center;justify-content:center;font:800 96px "Inter";color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.toolname{font:800 84px/1.05 "Inter";letter-spacing:-.02em}
.card .body{font-size:50px}
.card .browser img{height:440px}
.pill{align-self:flex-start;font:600 34px "Inter";padding:12px 28px;border-radius:999px;background:${style.highlight};color:${isLight(style.highlight) ? "#0b0b0f" : "#fff"}}
.num{font-family:${head};font-size:260px;line-height:.9;color:${style.accent}}
.vs{display:flex;flex-direction:column;gap:26px}
.side{padding:40px 44px;border-radius:36px;font:600 46px/1.25 "Inter"}
.side b{display:block;font:800 30px "Inter";letter-spacing:.14em;margin-bottom:12px}
.bad{background:rgba(60,10,14,.88);color:#fff;border:3px solid rgba(239,68,68,.8)}
.good{background:rgba(8,48,24,.88);color:#fff;border:3px solid rgba(34,197,94,.85)}
.tier{display:flex;gap:28px;align-items:center;font:700 56px/1.2 "Inter"}
.tier i{flex:none;font:400 80px "Anton";width:130px;height:130px;border-radius:28px;display:flex;align-items:center;justify-content:center;font-style:normal;color:#0b0b0f}
.option{font:700 56px "Inter";padding:30px 40px;border-radius:30px;border:3px solid ${hexA(style.fg, 0.3)};background:${hexA(light ? "#ffffff" : "#000000", 0.35)}}
.browser{border-radius:34px;overflow:hidden;border:3px solid ${hexA(style.fg, 0.2)};box-shadow:0 30px 80px rgba(0,0,0,.5);background:#0d0d14}
.browser .bar{height:74px;display:flex;align-items:center;gap:14px;padding:0 26px;background:#1b1b26}
.browser .bar i{width:20px;height:20px;border-radius:50%;background:#555;font-style:normal}
.browser .bar span{margin-left:18px;font:600 28px "Inter";color:#cfcfe0;background:#2a2a38;padding:8px 26px;border-radius:999px}
.browser img{display:block;width:100%;height:760px;object-fit:cover;object-position:top}
.illu{width:100%;height:760px;object-fit:cover;border-radius:40px;box-shadow:0 24px 70px rgba(0,0,0,.45)}
.tilt{transform:rotate(-2.2deg);border:14px solid #fff}
.meme{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff}
.memebar{flex:none;max-height:640px;overflow:hidden;padding:150px 80px 50px;background:#fff;color:#000;font:400 92px/1.08 "Anton";text-transform:uppercase;text-align:center}
.memeimg{flex:1;min-height:0;width:100%;object-fit:cover;background:#ddd}
.memefoot{flex:none;padding:36px 80px 430px;background:#fff;color:#111;font:700 44px/1.25 "Inter";text-align:center}
.swipe{position:absolute;right:${SAFE.right}px;bottom:${SAFE.bottom - 40}px;font:700 34px "Inter";color:${hexA(style.fg, 0.75)}}
.site{font:700 40px "Inter";color:${style.accent}}
`;
}

function isLight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function tileStyle(name) {
  const h = hash(String(name).toLowerCase()) % 360;
  return `background:linear-gradient(140deg,hsl(${h},72%,58%),hsl(${(h + 45) % 360},70%,42%))`;
}

const TIER_COLORS = { S: "#f87171", A: "#fb923c", B: "#facc15", C: "#4ade80", D: "#60a5fa" };

function inner(slide, i, total, style, images, zyvoShot) {
  const k = slide.kind;
  const label = slide.label ? `<div class="kicker">${esc(slide.label)}</div>` : "";
  const head = `<h1 class="headline" data-fit="900">${highlight(slide.headline)}</h1>`;
  const body = slide.body ? `<p class="body" data-fit="520">${highlight(slide.body)}</p>` : "";
  const items = (marker) => (slide.items?.length ? `<div class="items">${slide.items.map((t) => `<div class="item">${marker}<span>${highlight(t)}</span></div>`).join("")}</div>` : "");
  const illu = images.illustration ? `<img class="illu${style.collage ? " tilt" : ""}" src="${safeUrl(images.illustration)}" alt="">` : "";

  if ((style.meme || k === "meme") && (images.illustration || images.background)) {
    const pic = images.illustration ?? images.background;
    return `<div class="meme"><div class="memebar" data-fit="640">${esc(String(slide.headline).replace(/\*/g, ""))}</div>
${pic ? `<img class="memeimg" src="${safeUrl(pic)}" alt="">` : '<div class="memeimg"></div>'}
${slide.body ? `<div class="memefoot">${esc(String(slide.body).replace(/\*/g, ""))}</div>` : ""}</div>`;
  }
  switch (k) {
    case "cover":
      return `<div class="content center">${label}${head}${body}</div><div class="swipe">swipe →</div>`;
    case "item": {
      if (!slide.tool) return `<div class="content center">${label}${head}${body}${items('<span class="dot"></span>')}</div>`;
      const zyvo = slide.is_zyvo || /^zyvo$/i.test(slide.tool.name);
      const media = zyvo && zyvoShot
        ? `<div class="browser"><div class="bar"><i></i><i></i><i></i><span>tryzyvo.com</span></div><img src="${safeUrl(zyvoShot)}" alt=""></div>`
        : `<div class="tile" style="${tileStyle(slide.tool.name)}">${esc(initials(slide.tool.name))}</div>`;
      return `<div class="content center">${label}<h1 class="headline" data-fit="420" style="font-size:96px">${highlight(slide.headline)}</h1>
<div class="card">${media}<div class="toolname">${esc(slide.tool.name)}</div><p class="body" data-fit="360">${esc(slide.tool.what_it_does)}</p><div class="pill">${esc(domain(slide.tool.url))}</div></div></div>`;
    }
    case "zyvo":
      return `<div class="content center">${label}<h1 class="headline" data-fit="420" style="font-size:100px">${highlight(slide.headline)}</h1>
${zyvoShot ? `<div class="browser"><div class="bar"><i></i><i></i><i></i><span>tryzyvo.com</span></div><img src="${safeUrl(zyvoShot)}" alt=""></div>` : ""}${body}</div>`;
    case "step":
      return `<div class="content center">${slide.label ? `<div class="num">${esc(slide.label)}</div>` : ""}${head}${body}${items('<span class="dot"></span>')}</div>`;
    case "checklist":
      return `<div class="content center">${label}${head}${items('<span class="box"></span>')}${body}</div>`;
    case "versus": {
      const [l, r] = String(slide.label ?? "").split(/\s+vs\.?\s+/i);
      const [a, b] = slide.items ?? [];
      return `<div class="content center">${head}<div class="vs">
<div class="side bad"><b>✗ ${esc(l || "MYTH")}</b>${highlight(a ?? "")}</div>
<div class="side good"><b>✓ ${esc(r || "FACT")}</b>${highlight(b ?? slide.body ?? "")}</div></div></div>`;
    }
    case "tier":
      return `<div class="content center">${head}<div class="items">${(slide.items ?? []).map((t) => {
        const m = /^\s*([SABCD])\s*[:\-–]\s*(.*)$/i.exec(t);
        const tier = (m?.[1] ?? "B").toUpperCase();
        return `<div class="tier"><i style="background:${TIER_COLORS[tier]}">${tier}</i><span>${highlight(m?.[2] ?? t)}</span></div>`;
      }).join("")}</div></div>`;
    case "quiz_question":
      return `<div class="content center">${label}${head}${illu}<div class="items">${(slide.items ?? []).map((t, n) => `<div class="option">${"ABCD"[n] ?? "•"}. ${highlight(t)}</div>`).join("")}</div></div>`;
    case "quiz_answer":
      return `<div class="content center"><div class="num">✓</div>${head}${body}</div>`;
    case "cta":
      return `<div class="content center">${label}${head}${body}${slide.is_zyvo ? '<div class="site">tryzyvo.com</div>' : ""}</div>`;
    case "text":
    default:
      return `<div class="content center">${label}${head}${illu}${body}${items('<span class="dot"></span>')}</div>`;
  }
}

// Shrinks every [data-fit] block until it fits its height (px), then marks the page ready for the renderer.
const FIT_SCRIPT = `<script>
(async()=>{try{await document.fonts.ready}catch(e){}
for(const el of document.querySelectorAll("[data-fit]")){const max=+el.dataset.fit;let s=parseFloat(getComputedStyle(el).fontSize);
while((el.scrollHeight>max||el.scrollWidth>el.clientWidth+2)&&s>28){s-=4;el.style.fontSize=s+"px"}}
const imgs=[...document.images];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
document.body.dataset.ready="1"})();
</script>`;

/**
 * One slide as a full HTML document.
 * images: { background, illustration } (URLs or null); zyvoShot: the stored tryzyvo.com screenshot URL.
 * fontCss: FONT_CSS.google in the browser, FONT_CSS.local(dir) on the renderer.
 */
export function slideHtml({ slide, index, total, style, images = {}, zyvoShot = null, fontCss = FONT_CSS.google }) {
  const bg = images.background ? `<div class="bg"><img src="${safeUrl(images.background)}" alt=""></div><div class="shade"></div>` : "";
  const deco = `${style.grid ? '<div class="glow"></div><div class="grid"></div>' : ""}`;
  const counter = index > 0 ? `<div class="counter">${index + 1}/${total}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${SIZE.width}">${fontCss}<style>${css(style)}</style></head>
<body><div class="slide">${bg}${deco}${counter}${inner(slide, index, total, style, images, zyvoShot)}</div>${FIT_SCRIPT}</body></html>`;
}

/** Which image each slide uses: the shared background, plus its own illustration if it asked for one. */
export function imagesForSlides(slides, generated) {
  return slides.map((s, i) => ({ background: generated.background ?? null, illustration: generated.illustrations?.[i] ?? null }));
}
