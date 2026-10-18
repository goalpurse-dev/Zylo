// Content Machine: the slide templates. One self-contained HTML page per 1080×1920 slide. The SAME code
// draws the admin preview (in the browser, $0, even in a dry run) and the real PNGs (Chromium on Fly,
// render-worker/src/cmSlides.mjs), so what the owner previews is what gets posted.
//
// Layout rules (owner, 2026-10-18):
//  - Every word and key visual sits inside the platforms' safe zone (SAFE below): TikTok / Instagram /
//    YouTube cover the edges with their own buttons, captions and search bar. Backgrounds may bleed.
//  - Each slide is ONE vertical stack with fixed gaps (headline → card → caption). Text is measured in
//    the page and shrunk to fit its line limit; if it still doesn't fit, the page says so.
//  - The page then checks itself (LAYOUT_SCRIPT): the boxes of every text and image element may not
//    overlap, no text may leave the safe zone, every image must have loaded. The result is written to
//    body[data-layout]; the renderer refuses a slide that fails, so a broken slide is never posted.
//  - Text on a photo gets a dark scrim. Backgrounds are generated without people, so text never crosses
//    a face. A missing image is a failure, never a grey placeholder.
//  - Logos: only an owner-approved official file (the logo library), small, next to the tool's name;
//    without one, an icon tile with the initials.

export const SIZE = Object.freeze({ width: 1080, height: 1920 });
// The platforms' UI: the like/comment/share column on the right, the caption, name and dots at the bottom,
// the search bar at the top. Round 3 (owner, 2026-10-18): more breathing room than the bare minimum.
export const SAFE = Object.freeze({ left: 110, right: 170, top: 200, bottom: 420 });
export const SAFE_RECT = Object.freeze({ x0: SAFE.left, y0: SAFE.top, x1: SIZE.width - SAFE.right, y1: SIZE.height - SAFE.bottom });
// Inner padding: nothing touches the zone's edge. Every text and key visual must sit inside INNER_RECT.
export const PAD = 24;
export const INNER_RECT = Object.freeze({ x0: SAFE_RECT.x0 + PAD, y0: SAFE_RECT.y0 + PAD, x1: SAFE_RECT.x1 - PAD, y1: SAFE_RECT.y1 - PAD });
// Slides that may carry their message without a hero visual (on a photo background): the last question,
// the answer reveal. Every other slide needs a visual (the "visual richness" rule).
export const TEXT_ONLY_KINDS = Object.freeze(["quiz_answer"]);

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
// http(s) and data: images only. file: is allowed ONLY for the renderer's local mode (allowFile).
const safeUrl = (u, allowFile = false) => (new RegExp(`^(https?:|data:image\\/${allowFile ? "|file:" : ""})`, "i").test(String(u ?? "")) ? String(u).replace(/"/g, "%22") : "");

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
  return String(url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase().slice(0, 60);
}
/** The approved logo for a tool, by its domain or its name (logos: {key: url}, keys lowercase). */
export function logoFor(tool, logos) {
  if (!tool || !logos) return null;
  return logos[domain(tool.url)] ?? logos[String(tool.name ?? "").trim().toLowerCase()] ?? null;
}

export const FONT_CSS = {
  google: '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=block" rel="stylesheet">',
  local: (base) => `<style>
@font-face{font-family:"Anton";src:url("${base}/Anton-Regular.ttf") format("truetype");font-display:block}
@font-face{font-family:"Inter";src:url("${base}/Inter-Variable.ttf") format("truetype");font-weight:100 900;font-display:block}
</style>`,
};

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

// The type scale (px at 1080 wide), 15–20 % under the first version. Line limits per block.
export const TYPE = Object.freeze({
  cover: { size: 100, min: 56, lines: 4 },
  headline: { size: 88, min: 50, lines: 4 },
  cardHeadline: { size: 68, min: 44, lines: 3 },
  body: { size: 42, min: 38, lines: 5 },
  item: { size: 42, min: 38, lines: 2 },
  toolname: { size: 60, min: 44, lines: 1 },
  tool: { size: 40, min: 38, lines: 3 },
  meme: { size: 76, min: 46, lines: 4 },
  memeBody: { size: 40, min: 38, lines: 2 },
  side: { size: 40, min: 38, lines: 5 },
  option: { size: 42, min: 38, lines: 2 },
});

function css(style, hasPhoto) {
  const head = style.font === "inter" ? `"Inter", sans-serif` : `"Anton", "Impact", sans-serif`;
  const headWeight = style.font === "inter" ? 800 : 400;
  const light = isLight(style.bg);
  const S = SAFE_RECT, I = INNER_RECT;
  return `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden;background:${style.bg}}
body{font-family:"Inter",system-ui,sans-serif;color:${style.fg};-webkit-font-smoothing:antialiased}
.slide{position:relative;width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden}
.bg,.bg img{position:absolute;inset:0;width:100%;height:100%}
.bg img{object-fit:cover}
.shade{position:absolute;inset:0;background:${light ? "linear-gradient(180deg,rgba(246,243,238,.62),rgba(246,243,238,.86))" : "linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.35) 30%,rgba(0,0,0,.78) 100%)"}}
.scrim{position:absolute;left:${S.x0 - 60}px;top:${S.y0 - 60}px;width:${S.x1 - S.x0 + 120}px;height:${S.y1 - S.y0 + 120}px;border-radius:80px;background:${light ? "radial-gradient(ellipse at center,rgba(246,243,238,.9),rgba(246,243,238,.55) 70%,transparent)" : "radial-gradient(ellipse at center,rgba(0,0,0,.72),rgba(0,0,0,.45) 70%,transparent)"};filter:blur(10px)}
.grid{position:absolute;inset:0;background-image:linear-gradient(${hexA(style.accent, 0.16)} 2px,transparent 2px),linear-gradient(90deg,${hexA(style.accent, 0.16)} 2px,transparent 2px);background-size:90px 90px;mask-image:radial-gradient(ellipse at 50% 40%,#000 30%,transparent 80%)}
.glow{position:absolute;width:1100px;height:1100px;left:-10px;top:300px;border-radius:50%;background:radial-gradient(circle,${hexA(style.accent, 0.45)},transparent 65%);filter:blur(40px)}
.content{position:absolute;left:${I.x0}px;top:${I.y0}px;width:${I.x1 - I.x0}px;height:${I.y1 - I.y0}px;display:flex;flex-direction:column;justify-content:safe center;gap:36px}
.content>*{flex-shrink:0}
.kicker{font:800 30px/1.2 "Inter";letter-spacing:.14em;text-transform:uppercase;color:${style.accent}}
.headline{font-family:${head};font-weight:${headWeight};text-transform:${style.font === "inter" ? "none" : "uppercase"};line-height:1.12;letter-spacing:${style.font === "inter" ? "-0.02em" : "0.005em"};color:${style.fg};text-wrap:balance${hasPhoto && !light ? ";text-shadow:0 4px 24px rgba(0,0,0,.55)" : ""}}
.hl{background:${style.highlight};color:${isLight(style.highlight) ? "#0b0b0f" : "#ffffff"};padding:0 .12em;margin:0 -.02em;box-decoration-break:clone;-webkit-box-decoration-break:clone;border-radius:.06em;text-shadow:none}
.body{font:500 42px/1.32 "Inter";color:${hexA(style.fg, 0.92)}${hasPhoto && !light ? ";text-shadow:0 2px 12px rgba(0,0,0,.6)" : ""}}
.items{display:flex;flex-direction:column;gap:22px}
.item{display:flex;gap:24px;align-items:flex-start;font:600 42px/1.25 "Inter"}
.dot{flex:none;width:20px;height:20px;margin-top:15px;border-radius:50%;background:${style.accent}}
.box{flex:none;width:48px;height:48px;margin-top:4px;border:5px solid ${style.accent};border-radius:12px;position:relative}
.box::after{content:"";position:absolute;left:10px;top:1px;width:12px;height:24px;border:solid ${style.highlight};border-width:0 6px 6px 0;transform:rotate(45deg)}
.card{display:flex;flex-direction:column;gap:26px;padding:48px;border-radius:40px;background:${hexA(light ? "#ffffff" : "#0b0b12", light ? 0.9 : 0.8)};border:2px solid ${hexA(style.fg, 0.12)}}
.toolrow{display:flex;align-items:center;gap:28px}
.tile{flex:none;width:150px;height:150px;border-radius:38px;display:flex;align-items:center;justify-content:center;font:800 64px "Inter";color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.35)}
.logo{flex:none;width:150px;height:150px;border-radius:38px;background:#fff;display:flex;align-items:center;justify-content:center;padding:22px}
.logo img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto}
.toolname{font:800 60px/1.1 "Inter";letter-spacing:-.02em;min-width:0}
.tooltext{font:500 40px/1.32 "Inter";color:${hexA(style.fg, 0.9)}}
.pill{align-self:flex-start;font:600 30px "Inter";padding:10px 24px;border-radius:999px;background:${style.highlight};color:${isLight(style.highlight) ? "#0b0b0f" : "#fff"}}
.num{font-family:${head};font-size:190px;line-height:.95;color:${style.accent}}
.vs{display:flex;flex-direction:column;gap:24px}
.side{padding:36px 40px;border-radius:32px;font:600 42px/1.28 "Inter";color:#fff}
.side b{display:block;font:800 28px "Inter";letter-spacing:.14em;margin-bottom:10px}
.bad{background:rgba(60,10,14,.9);border:3px solid rgba(239,68,68,.8)}
.good{background:rgba(8,48,24,.9);border:3px solid rgba(34,197,94,.85)}
.tier{display:flex;gap:26px;align-items:center;font:700 44px/1.2 "Inter"}
.tier i{flex:none;font:400 68px "Anton";width:112px;height:112px;border-radius:26px;display:flex;align-items:center;justify-content:center;font-style:normal;color:#0b0b0f}
.option{font:700 44px/1.25 "Inter";padding:26px 36px;border-radius:28px;border:3px solid ${hexA(style.fg, 0.3)};background:${hexA(light ? "#ffffff" : "#000000", 0.55)}}
.browser{border-radius:30px;overflow:hidden;border:3px solid ${hexA(style.fg, 0.2)};box-shadow:0 26px 70px rgba(0,0,0,.5);background:#0d0d14}
.browser .bar{height:64px;display:flex;align-items:center;gap:12px;padding:0 24px;background:#1b1b26}
.browser .bar i{width:18px;height:18px;border-radius:50%;background:#555;font-style:normal}
.browser .bar span{margin-left:16px;font:600 26px "Inter";color:#cfcfe0;background:#2a2a38;padding:6px 22px;border-radius:999px}
.browser img{display:block;width:100%;height:520px;object-fit:cover;object-position:top}
.hero{align-self:center;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45);background:${hexA(style.fg, 0.06)};line-height:0}
.hero img{display:block}
.tilt{transform:rotate(-1.5deg);border:10px solid #fff;margin:0 12px}
.meme{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff}
.memebar{flex:none;background:#fff;padding:${I.y0}px ${SIZE.width - I.x1}px 36px ${I.x0}px;display:flex;flex-direction:column;gap:18px}
.memetext{color:#000;font:400 76px/1.1 "Anton";text-transform:uppercase;text-align:center}
.memeimg{flex:1;min-height:0;width:100%;object-fit:cover;object-position:center top}
.memebody{color:#222;font:700 40px/1.25 "Inter";text-align:center}
.swipe{align-self:flex-end;font:700 32px "Inter";color:${hexA(style.fg, 0.75)}}
.site{font:700 38px "Inter";color:${style.accent}}
.zone{position:absolute;background:rgba(255,40,80,.18);pointer-events:none;z-index:50}
.zone.l{left:0;top:0;bottom:0;width:${SAFE.left}px}.zone.r{right:0;top:0;bottom:0;width:${SAFE.right}px}
.zone.t{top:0;left:${SAFE.left}px;right:${SAFE.right}px;height:${SAFE.top}px}.zone.b{bottom:0;left:${SAFE.left}px;right:${SAFE.right}px;height:${SAFE.bottom}px}
.zoneline{position:absolute;left:${S.x0}px;top:${S.y0}px;width:${S.x1 - S.x0}px;height:${S.y1 - S.y0}px;outline:3px dashed rgba(255,40,80,.9);pointer-events:none;z-index:51}
.zonepad{position:absolute;left:${I.x0}px;top:${I.y0}px;width:${I.x1 - I.x0}px;height:${I.y1 - I.y0}px;outline:2px dotted rgba(255,180,200,.8);pointer-events:none;z-index:51}
`;
}

function tileStyle(name) {
  const h = hash(String(name).toLowerCase()) % 360;
  return `background:linear-gradient(140deg,hsl(${h},72%,58%),hsl(${(h + 45) % 360},70%,42%))`;
}
const TIER_COLORS = { S: "#f87171", A: "#fb923c", B: "#facc15", C: "#4ade80", D: "#60a5fa" };

// data-box: an element whose box is checked for overlaps; data-text: it holds words (must stay in the
// safe zone); data-fit="size,min,lines": the size it starts at, the smallest it may shrink to, its line limit.
const fit = (t) => `data-box data-text data-fit="${t.size},${t.min},${t.lines}" style="font-size:${t.size}px"`;

function inner(slide, style, images, ctx) {
  const k = slide.kind;
  const U = (u) => safeUrl(u, ctx.allowFile);
  const label = slide.label ? `<div class="kicker" data-box data-text>${esc(slide.label)}</div>` : "";
  const head = (t = TYPE.headline) => `<h1 class="headline" ${fit(t)} data-name="headline">${highlight(slide.headline)}</h1>`;
  const body = slide.body ? `<p class="body" ${fit(TYPE.body)} data-name="body">${highlight(slide.body)}</p>` : "";
  const items = (marker) => (slide.items?.length ? `<div class="items">${slide.items.map((t, n) => `<div class="item" data-box data-text data-name="item ${n + 1}" ${fitAttr(TYPE.item)}>${marker}<span>${highlight(t)}</span></div>`).join("")}</div>` : "");
  const browser = `<div class="browser" data-box data-visual data-name="Zyvo screenshot"><div class="bar"><i></i><i></i><i></i><span>tryzyvo.com</span></div><img data-shrink="240" src="${U(ctx.zyvoShot)}" alt=""></div>`;
  // The slide's hero visual. It fills a box up to `h` px tall at the PICTURE'S OWN aspect ratio (the page
  // sizes it once loaded), so nothing is ever cropped; it may shrink to `min` px when the text needs room.
  // A slide about Zyvo shows real Zyvo: its library asset (a real output), else the real Zyvo screen;
  // never a generic generated picture (owner, 2026-10-18).
  const heroUrl = images.hero ?? images.illustration ?? null;
  const hero = (h, min = Math.round(h * 0.6)) => {
    if (heroUrl) return `<div class="hero${style.collage ? " tilt" : ""}" data-box data-visual data-name="visual"><img data-hero="${h}" data-shrink="${min}" src="${U(heroUrl)}" alt=""></div>`;
    if (slide.is_zyvo && ctx.zyvoShot) return browser;
    return "";
  };

  switch (k) {
    case "cover":
      return `${label}${head(TYPE.cover)}${hero(640, 420)}${body}<div class="swipe" data-box data-text>swipe →</div>`;
    case "item": {
      if (!slide.tool) return `${label}${head()}${hero(600)}${body}${items('<span class="dot"></span>')}`;
      const zyvo = slide.is_zyvo || /^zyvo$/i.test(slide.tool.name);
      const mark = toolMark(slide.tool, ctx.logos, U);
      const visual = zyvo && !heroUrl && ctx.zyvoShot ? browser : hero(540, 380);
      return `${label}<h1 class="headline" ${fit(TYPE.cardHeadline)} data-name="headline">${highlight(slide.headline)}</h1>${visual}
<div class="card" data-box data-name="card"><div class="toolrow">${mark}<div class="toolname" ${fit(TYPE.toolname)} data-name="tool name">${esc(slide.tool.name)}</div></div>
<p class="tooltext" ${fit(TYPE.tool)} data-name="tool text">${esc(slide.tool.what_it_does)}</p><div class="pill" data-box data-text>${esc(domain(slide.tool.url))}</div></div>`;
    }
    case "zyvo": {
      const z = ctx.logos?.["tryzyvo.com"];
      const logo = typeof z === "string" ? z : z?.url;
      return `${label}<h1 class="headline" ${fit(TYPE.cardHeadline)} data-name="headline">${highlight(slide.headline)}</h1>${heroUrl ? hero(620, 380) : ctx.zyvoShot ? browser : ""}${body}${logo ? `<div class="logo" data-box data-name="Zyvo logo" style="width:110px;height:110px;padding:16px"><img src="${U(logo)}" alt=""></div>` : ""}`;
    }
    case "step":
      return `${slide.label ? `<div class="num" data-box data-text>${esc(slide.label)}</div>` : ""}${head()}${hero(600, 400)}${body}${items('<span class="dot"></span>')}`;
    case "checklist":
      return `${label}${head()}${hero(520, 340)}${items('<span class="box"></span>')}${body}`;
    case "versus": {
      const [l, r] = String(slide.label ?? "").split(/\s+vs\.?\s+/i);
      const [a, b] = slide.items ?? [];
      return `${head()}${hero(480, 300)}<div class="vs"><div class="side bad" data-box data-text ${fitAttr(TYPE.side)} data-name="left side"><b>✗ ${esc(l || "MYTH")}</b>${highlight(a ?? "")}</div>
<div class="side good" data-box data-text ${fitAttr(TYPE.side)} data-name="right side"><b>✓ ${esc(r || "FACT")}</b>${highlight(b ?? slide.body ?? "")}</div></div>`;
    }
    case "tier":
      return `${head()}${hero(460, 280)}<div class="items">${(slide.items ?? []).map((t, n) => {
        const m = /^\s*([SABCD])\s*[:\-–]\s*(.*)$/i.exec(t);
        const tier = (m?.[1] ?? "B").toUpperCase();
        return `<div class="tier" data-box data-text data-name="tier ${n + 1}" ${fitAttr(TYPE.option)}><i style="background:${TIER_COLORS[tier]}">${tier}</i><span>${highlight(m?.[2] ?? t)}</span></div>`;
      }).join("")}</div>`;
    case "quiz_question":
      return `${label}${head()}${hero(500, 300)}<div class="items">${(slide.items ?? []).map((t, n) => `<div class="option" data-box data-text data-name="option ${n + 1}" ${fitAttr(TYPE.option)}>${"ABCD"[n] ?? "•"}. ${highlight(t)}</div>`).join("")}</div>`;
    case "quiz_answer":
      return `<div class="num" data-box data-text>✓</div>${head()}${hero(560, 360)}${body}`;
    case "cta":
      return `${label}${head()}${hero(620, 400)}${body}${slide.is_zyvo ? '<div class="site" data-box data-text>tryzyvo.com</div>' : ""}`;
    case "text":
    default:
      return `${label}${head()}${hero(640, 400)}${body}${items('<span class="dot"></span>')}`;
  }
}

const fitAttr = (t) => `data-fit="${t.size},${t.min},${t.lines}" style="font-size:${t.size}px"`;

/**
 * A tool's mark next to its name (owner's logo rules, 2026-10-18): the approved official file, shown no
 * larger than the file itself (never upscaled, redrawn or recoloured); "tile" → the initials tile;
 * "name" → nothing but the name (Veo, Midjourney).
 */
function toolMark(tool, logos, U) {
  const entry = logoFor(tool, logos);
  const display = typeof entry === "object" && entry ? entry.display : entry ? "logo" : "tile";
  const url = typeof entry === "string" ? entry : entry?.url;
  if (display === "name") return "";
  if (display === "logo" && url) return `<div class="logo" data-box data-name="logo"><img src="${U(url)}" alt=""></div>`;
  return `<div class="tile" data-box data-name="tile" style="${tileStyle(tool.name)}">${esc(initials(tool.name))}</div>`;
}

// In the page: fit every [data-fit] block to its line limit, shrink the stack until it fits the safe zone,
// then check it. Writes body[data-layout] = {ok, problems} and body[data-ready]; also posts it to the
// parent window (the admin preview shows a warning on a slide that fails).
const LAYOUT_SCRIPT = `<script>
(async()=>{
const problems=[];
try{await document.fonts.ready}catch(e){}
const imgs=[...document.images];
await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
for(const i of imgs)if(!i.naturalWidth)problems.push("an image didn't load ("+(i.closest("[data-name]")?.dataset.name||"background")+")");
const sizeHero=(img,h)=>{const tilt=img.closest(".tilt");const W=(img.closest(".content")?.clientWidth||0)-(tilt?72:0);const H=h-(tilt?40:0);const nw=img.naturalWidth,nh=img.naturalHeight;if(!nw||!nh)return;const k=Math.min(W/nw,H/nh);img.style.width=Math.round(nw*k)+"px";img.style.height=Math.round(nh*k)+"px";img.dataset.h=h};
for(const i of document.querySelectorAll("img[data-hero]"))sizeHero(i,+i.dataset.hero);
for(const i of document.querySelectorAll(".logo img"))if(i.naturalWidth){i.style.maxWidth=Math.min(i.naturalWidth,106)+"px";i.style.maxHeight=Math.min(i.naturalHeight,106)+"px"}
const lines=(el)=>{const r=document.createRange();r.selectNodeContents(el);const tol=parseFloat(getComputedStyle(el).fontSize)*0.6;const tops=[];for(const q of r.getClientRects()){if(q.width<1||q.height<1)continue;if(!tops.some(t=>Math.abs(t-q.top)<tol))tops.push(q.top)}return tops.length};
const fits=[...document.querySelectorAll("[data-fit]")];
for(const el of fits){const[size,min,max]=el.dataset.fit.split(",").map(Number);let s=size;el.style.fontSize=s+"px";
while((lines(el)>max||el.scrollWidth>el.clientWidth+2)&&s>min){s-=2;el.style.fontSize=s+"px"}
if(lines(el)>max||el.scrollWidth>el.clientWidth+2)problems.push((el.dataset.name||"text")+" needs more than "+max+" line"+(max>1?"s":"")+": shorten it")}
const content=document.querySelector(".content");
if(content){let guard=200;
const over=()=>content.scrollHeight>content.clientHeight+1;
while(over()&&guard-->0){
const shrinkImg=[...content.querySelectorAll("img[data-shrink]")].find(i=>(+i.dataset.h||i.getBoundingClientRect().height)>+i.dataset.shrink+20);
if(shrinkImg){if(shrinkImg.hasAttribute("data-hero"))sizeHero(shrinkImg,(+shrinkImg.dataset.h)-40);else shrinkImg.style.height=(shrinkImg.getBoundingClientRect().height-40)+"px";continue}
const cand=fits.filter(el=>content.contains(el)).map(el=>{const[,min]=el.dataset.fit.split(",").map(Number);return{el,min,s:parseFloat(el.style.fontSize)}}).filter(c=>c.s>c.min).sort((a,b)=>b.s-a.s)[0];
if(!cand)break;cand.el.style.fontSize=(cand.s-2)+"px"}
if(over())problems.push("the slide has more than fits in the safe zone: shorten it")}
const S=${JSON.stringify(INNER_RECT)};const TEXT_ONLY=${JSON.stringify(TEXT_ONLY_KINDS)};
const boxes=[...document.querySelectorAll("[data-box]")].map(el=>({el,r:el.getBoundingClientRect(),name:el.dataset.name||el.className}));
for(const b of boxes){const r=b.r;
if(r.left<S.x0-1||r.top<S.y0-1||r.right>S.x1+1||r.bottom>S.y1+1)problems.push(b.name+" is outside the safe zone")}
const visuals=[...document.querySelectorAll("[data-visual] img, img[data-visual]")].filter(i=>i.naturalWidth>0);
const bgPhoto=[...document.querySelectorAll(".bg img")].some(i=>i.naturalWidth>0);
if(!visuals.length&&!(TEXT_ONLY.includes(document.body.dataset.kind)&&bgPhoto))problems.push("no visual element: the slide needs a picture");
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];
if(a.el.contains(b.el)||b.el.contains(a.el))continue;
const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
if(w>2&&h>2)problems.push(a.name+" overlaps "+b.name)}
const result={ok:problems.length===0,problems:[...new Set(problems)]};
document.body.dataset.layout=JSON.stringify(result);
try{parent.postMessage({cmLayout:result,slide:document.body.dataset.slide},"*")}catch(e){}
document.body.dataset.ready="1"})();
</script>`;

/**
 * One slide as a full HTML document.
 * images: { background, illustration } (URLs or null); zyvoShot: the stored tryzyvo.com screenshot URL;
 * logos: {domain or lowercase name: url} of APPROVED logos only; fontCss: FONT_CSS.google in the browser,
 * FONT_CSS.local(dir) on the renderer; safeZones: draw the zones on top (previews only, never posted);
 * allowFile: file: image URLs (the renderer's local mode only).
 */
export function slideHtml({ slide, index, total, style, images = {}, zyvoShot = null, logos = null, fontCss = FONT_CSS.google, safeZones = false, allowFile = false }) {
  const ctx = { zyvoShot, logos, allowFile };
  // The meme layout (caption bar over a picture): meme slides, and the cover / text / cta slides of the meme
  // style. Everything else keeps its own layout (a tool card, a tier list…). Never without a picture.
  const heroUrl = images.hero ?? images.illustration ?? null;
  const meme = (slide.kind === "meme" || (style.meme && ["cover", "text", "cta"].includes(slide.kind))) && Boolean(heroUrl || images.background);
  // Text goes over a background photo only in the photo styles (generated with no people). The meme style's
  // picture may show an invented character, so it is never put behind text.
  const photo = !meme && !style.meme && Boolean(images.background);
  const bg = photo ? `<div class="bg"><img src="${safeUrl(images.background, allowFile)}" alt=""></div><div class="shade"></div><div class="scrim"></div>` : "";
  const deco = style.grid && !photo ? '<div class="glow"></div><div class="grid"></div>' : "";
  const zones = safeZones ? '<div class="zone l"></div><div class="zone r"></div><div class="zone t"></div><div class="zone b"></div><div class="zoneline"></div><div class="zonepad"></div>' : "";
  const pic = heroUrl ?? images.background;
  const main = meme
    ? `<div class="meme"><div class="memebar"><div class="memetext" ${fit(TYPE.meme)} data-name="meme text">${esc(String(slide.headline).replace(/\*/g, ""))}</div>${slide.body ? `<div class="memebody" ${fit(TYPE.memeBody)} data-name="meme caption">${esc(String(slide.body).replace(/\*/g, ""))}</div>` : ""}</div>
<img class="memeimg" data-visual src="${safeUrl(pic, allowFile)}" alt=""></div>`
    : `<div class="content">${inner(slide, style, images, ctx)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${SIZE.width}">${fontCss}<style>${css(style, photo)}</style></head>
<body data-slide="${index}" data-kind="${esc(slide.kind)}"><div class="slide">${bg}${deco}${main}${zones}</div>${LAYOUT_SCRIPT}</body></html>`;
}
