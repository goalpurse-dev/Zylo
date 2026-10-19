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
// Each platform's own UI over a 1080×1920 slide, in px: what is covered on each side, plus "avoid" areas.
//   tiktok_photo    MEASURED on the owner's iPhone screenshot of a posted photo slideshow (2026-10-18): TikTok
//                   fits the slide to the screen width (×1.092) and places it 40 screen px above the top. The
//                   status bar + back arrow + "Find related content" search bar cover slide y 0–308; the icon
//                   column starts at x 936 (the "2/8" counter at x 932–1047, y 342–406); the caption panel
//                   covers y 1728–1920; the profile avatar sits at x 33–170, y 1553–1685. Each + a small margin.
//   instagram_feed  a 9:16 carousel slide is shown cropped to 4:5 in the feed: only the middle 1350 px show.
//   shorts_video    Reels / Shorts / TikTok video (the MP4): search bar on top, caption at the bottom, icons right.
export const SAFE_PROFILES = Object.freeze({
  tiktok_photo: { label: "TikTok photo post", left: 40, right: 150, top: 320, bottom: 200, avoid: [{ name: "the TikTok profile avatar", x0: 0, y0: 1530, x1: 190, y1: 1720 }] },
  instagram_feed: { label: "Instagram feed (4:5 crop)", left: 60, right: 60, top: 285, bottom: 285, avoid: [] },
  shorts_video: { label: "Reels / Shorts video", left: 110, right: 170, top: 200, bottom: 420, avoid: [] },
});
// ONE export fits every platform: the zone every profile leaves free (the strictest side of each).
const PROFILES = Object.values(SAFE_PROFILES);
export const SAFE = Object.freeze(Object.fromEntries(["left", "right", "top", "bottom"].map((k) => [k, Math.max(...PROFILES.map((p) => p[k]))])));
export const AVOID = Object.freeze(PROFILES.flatMap((p) => p.avoid));
export const SAFE_RECT = Object.freeze({ x0: SAFE.left, y0: SAFE.top, x1: SIZE.width - SAFE.right, y1: SIZE.height - SAFE.bottom });
// Inner padding: nothing touches the zone's edge. Every text and key visual must sit inside INNER_RECT, which
// also ends above any avoid area that reaches across the stack's left edge (the avatar): the stack is centered
// between the top zone and the avatar.
export const PAD = 24;
const innerBottom = Math.min(SAFE_RECT.y1 - PAD, ...AVOID.filter((a) => a.x0 <= SAFE_RECT.x0 + PAD && a.x1 > SAFE_RECT.x0 + PAD).map((a) => a.y0 - PAD));
export const INNER_RECT = Object.freeze({ x0: SAFE_RECT.x0 + PAD, y0: SAFE_RECT.y0 + PAD, x1: SAFE_RECT.x1 - PAD, y1: innerBottom });
// Slides that may carry their message without a hero visual (on a photo background): the last question,
// the answer reveal. Every other slide needs a visual (the "visual richness" rule).
export const TEXT_ONLY_KINDS = Object.freeze(["quiz_answer"]);
// The Zyvo account's footer (logo, name, swipe) sits under the stack, inside the safe zone.
export const FOOTER_H = 64;
// Raised whenever the slide templates change how a slide looks (zones, sizes, kinds): a render made with an older
// version shows as "Outdated" in admin and can be rendered again. 7 = the measured TikTok zones + the Zyvo account.
export const LAYOUT_VERSION = 7;

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
  uiPrompt: { size: 46, min: 38, lines: 3 },
  callout: { size: 40, min: 38, lines: 2 },
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
.content{position:absolute;left:${I.x0}px;top:${I.y0}px;width:${I.x1 - I.x0}px;height:${I.y1 - I.y0 - (style.brand ? FOOTER_H + 20 : 0)}px;display:flex;flex-direction:column;justify-content:safe center;gap:36px}
.content>*{flex-shrink:0}
.kicker{font:800 30px/1.2 "Inter";letter-spacing:.14em;text-transform:uppercase;color:${style.accent}}
.headline{font-family:${head};font-weight:${headWeight};text-transform:${style.font === "inter" ? "none" : "uppercase"};line-height:1.14;letter-spacing:${style.font === "inter" ? "-0.02em" : "0.005em"};color:${style.fg};text-wrap:balance${hasPhoto && !light ? ";text-shadow:0 4px 24px rgba(0,0,0,.55)" : ""}}
.headline:has(.hl){line-height:1.25}
.hl{background:linear-gradient(${style.highlight},${style.highlight}) no-repeat 0 0/100% 100%;color:${isLight(style.highlight) ? "#0b0b0f" : "#ffffff"};padding:0 .12em;margin:0 -.02em;box-decoration-break:clone;-webkit-box-decoration-break:clone;border-radius:.06em;text-shadow:none}
.body{font:500 42px/1.32 "Inter";color:${hexA(style.fg, 0.92)}${hasPhoto && !light ? ";text-shadow:0 2px 12px rgba(0,0,0,.6)" : ""}}
.items{display:flex;flex-direction:column;gap:22px}
.item{display:flex;gap:24px;align-items:flex-start;font:600 42px/1.25 "Inter"}
.dot{flex:none;width:20px;height:20px;margin-top:15px;border-radius:50%;background:${style.accent}}
.box{flex:none;width:48px;height:48px;margin-top:4px;border:5px solid ${style.accent};border-radius:12px;position:relative}
.box::after{content:"";position:absolute;left:10px;top:1px;width:12px;height:24px;border:solid ${style.highlight};border-width:0 6px 6px 0;transform:rotate(45deg)}
.card{display:flex;flex-direction:column;gap:20px;padding:36px 40px;border-radius:40px;background:${hexA(light ? "#ffffff" : "#0b0b12", light ? 0.9 : 0.8)};border:2px solid ${hexA(style.fg, 0.12)}}
.toolrow{display:flex;align-items:center;gap:28px}
.tile{flex:none;width:120px;height:120px;border-radius:32px;display:flex;align-items:center;justify-content:center;font:800 52px "Inter";color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.35)}
.logo{flex:none;width:120px;height:120px;border-radius:32px;background:#fff;display:flex;align-items:center;justify-content:center;padding:16px}
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
.browser img{display:block;width:100%;height:auto;object-fit:cover;object-position:top}
.hero{position:relative;align-self:center;display:flex;align-items:center;justify-content:center;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45);background:${hexA(style.fg, 0.06)};line-height:0}
.hero img{display:block;position:relative}
.hero .blur{display:none;position:absolute;left:-60px;top:-60px;width:calc(100% + 120px);height:calc(100% + 120px);object-fit:cover;filter:blur(34px) brightness(.8)}
.hero.wide .blur{display:block}
.collage{align-self:center;display:flex;flex-direction:column;align-items:center;gap:14px;line-height:0}
.collage .row{display:flex;gap:14px;justify-content:center;flex:none}
.collage img{display:block;border-radius:22px;box-shadow:0 16px 44px rgba(0,0,0,.4)${style.collage ? ";border:6px solid #fff" : ""}}
.collage figure{position:relative;margin:0;line-height:0;flex:none}
.collage figure.cell{display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:22px;background:#111;box-shadow:0 16px 44px rgba(0,0,0,.4)}
.collage figure.cell img[data-tile]{position:relative;border-radius:0;box-shadow:none}
.collage .gblur{position:absolute;left:-30px;top:-30px;width:calc(100% + 60px);height:calc(100% + 60px);object-fit:cover;filter:blur(22px) brightness(.65);border-radius:0;box-shadow:none}
.collage figure.cell figcaption{z-index:1}
.collage figcaption{position:absolute;left:10px;bottom:10px;font:700 30px/1.1 "Inter";padding:7px 14px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;white-space:nowrap;max-width:calc(100% - 20px);overflow:hidden;text-overflow:ellipsis}
.collage figure.play::after{content:"";position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(0,0,0,.55) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 5v14l11-7z' fill='white'/%3E%3C/svg%3E") center/62px no-repeat;border:4px solid rgba(255,255,255,.9)}
.ui{border-radius:30px;background:${hexA(light ? "#ffffff" : "#16131f", 0.96)};border:2px solid ${hexA(style.accent, 0.55)};box-shadow:0 24px 70px rgba(0,0,0,.45);padding:34px 36px;display:flex;flex-direction:column;gap:20px}
.ui-cap{font:700 30px "Inter";color:${hexA(style.fg, 0.6)};letter-spacing:.02em}
.ui-input{font:600 46px/1.25 "Inter";color:${style.fg};border-radius:20px;background:${hexA(style.fg, 0.07)};border:2px solid ${hexA(style.fg, 0.16)};padding:22px 26px}
.ui-input .caret{display:inline-block;width:4px;height:1em;margin-left:6px;vertical-align:-0.12em;background:${style.accent}}
.ui-row{display:flex;justify-content:flex-end}
.ui-btn{font:800 38px "Inter";padding:18px 30px;border-radius:999px;background:${style.accent};color:${isLight(style.accent) ? "#0b0b0f" : "#ffffff"}}
.ui-item{display:flex;gap:22px;align-items:flex-start;font:600 42px/1.25 "Inter";color:${style.fg}}
.ui-item i{flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 30px "Inter";font-style:normal;background:${hexA(style.accent, 0.2)};color:${style.accent}}
.ui-dl{align-items:center;padding:24px}
.callout{align-self:flex-start;display:flex;gap:14px;align-items:center;font:700 40px/1.2 "Inter";color:${style.fg};padding:14px 24px;border-radius:20px;border:3px dashed ${hexA(style.accent, 0.85)}}
.callout .arrow{font:800 46px "Inter";color:${style.accent}}
.stepnum{align-self:flex-start;width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 48px "Inter";background:${style.accent};color:${isLight(style.accent) ? "#0b0b0f" : "#ffffff"}}
.arrowdown{align-self:center;font:800 72px/1 "Inter";color:${style.accent}}
.ctabtn{align-self:stretch;text-align:center;font:800 52px/1.15 "Inter";padding:34px 30px;border-radius:999px;background:${style.accent};color:${isLight(style.accent) ? "#0b0b0f" : "#ffffff"};box-shadow:0 20px 60px ${hexA(style.accent, 0.45)}}
.ctameta{align-self:center;display:flex;gap:22px;align-items:center}
.ctameta .site{font:800 40px "Inter";color:${style.fg}}
.brandfoot{position:absolute;left:${I.x0}px;width:${I.x1 - I.x0}px;top:${I.y1 - FOOTER_H}px;height:${FOOTER_H}px;display:flex;align-items:center;gap:16px;font:800 34px "Inter";color:${style.fg}}
.bf-logo{width:56px;height:56px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;padding:8px}
.bf-logo img{max-width:100%;max-height:100%}
.bf-z{font:900 34px "Inter";color:${style.accent}}
.bf-swipe{margin-left:auto;font:700 30px "Inter";color:${hexA(style.fg, 0.7)}}
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
  const browser = `<div class="browser" data-box data-visual data-name="Zyvo screenshot"><div class="bar"><i></i><i></i><i></i><span>tryzyvo.com</span></div><img data-shot data-shrink="240" src="${U(ctx.zyvoShot)}" alt=""></div>`;
  // The slide's hero visual. It fills a box up to `h` px tall at the PICTURE'S OWN aspect ratio (the page
  // sizes it once loaded), so nothing is ever cropped; it may shrink to `min` px when the text needs room.
  // A slide about Zyvo shows real Zyvo: its library asset (a real output), else the real Zyvo screen;
  // never a generic generated picture (owner, 2026-10-18).
  const heroUrl = images.hero ?? images.illustration ?? null;
  // After the text fits, the page grows the frame into the free height (a tall picture gets a tall frame); a
  // frame wider or taller than its picture is filled by a blurred copy of the same picture, never a crop.
  const hero = (h, min = Math.round(h * 0.6)) => {
    if (heroUrl) return `<div class="hero${style.collage ? " tilt" : ""}" data-box data-visual data-name="visual"><img class="blur" src="${U(heroUrl)}" alt=""><img data-hero="${h}" data-shrink="${min}" src="${U(heroUrl)}" alt=""></div>`;
    if (slide.is_zyvo && ctx.zyvoShot) return browser;
    return "";
  };
  // A showcase cover (owner, 2026-10-18): a grid of the real Zyvo outputs shown later in the slideshow, each
  // at its own shape (the page lays them out in one or two rows), never a generic picture.
  const collage = (images.collage ?? []).filter(Boolean).slice(0, 4);
  const grid = (h, min) => `<div class="collage" data-box data-visual data-name="collage" data-collage="${h}" data-shrink="${min}">${collage.map((u) => `<img data-tile src="${U(u)}" alt="">`).join("")}</div>`;

  if (ZYVO_KINDS.includes(k)) return zyvoInner(slide, style, images, ctx, { label, head, body, items, hero, U });

  switch (k) {
    case "cover":
      return `${label}${head(TYPE.cover)}${collage.length >= 2 ? grid(700, 420) : hero(640, 420)}${body}${style.brand ? "" : '<div class="swipe" data-box data-text>swipe →</div>'}`;
    case "item": {
      if (!slide.tool) return `${label}${head()}${hero(600)}${body}${items('<span class="dot"></span>')}`;
      const zyvo = slide.is_zyvo || /^zyvo$/i.test(slide.tool.name);
      const mark = toolMark(slide.tool, ctx.logos, U);
      const visual = zyvo && !heroUrl && ctx.zyvoShot ? browser : hero(540, 280);
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

// The Zyvo brand account's slide kinds (owner, 2026-10-19). Product-forward; only REAL Zyvo outputs from the
// asset library (each with a small style / tool label); rebuilt UI components instead of screenshots: clean
// versions of Zyvo's real screens, with the real labels, large enough to read on a phone.
export const ZYVO_KINDS = Object.freeze(["feature_hero", "style_grid", "template_showcase", "spotlight", "ui_prompt", "ui_checklist", "ui_result", "prompt_result", "by_hand", "cta_button"]);
// The labels of the real app the rebuilt components use (the Long Form "Create New Video" flow and the publish step).
export const ZYVO_UI = Object.freeze({ idea: "Your idea", generate: "Generate video", download: "Download video (1080p)", button: "Make your first video →", site: "tryzyvo.com", bio: "Link in bio" });

function zyvoInner(slide, style, images, ctx, { label, head, body, items, hero, U }) {
  const k = slide.kind;
  const gallery = (images.gallery ?? []).filter((g) => g?.url);
  const tiles = (list, h, min, name = "gallery") => (list.length
    ? `<div class="collage" data-box data-visual data-name="${name}" data-collage="${h}" data-shrink="${min}" data-cols="2">${list.map((g) => `<figure class="gtile"><img data-tile src="${U(g.url)}" alt="">${g.label ? `<figcaption>${esc(g.label)}</figcaption>` : ""}</figure>`).join("")}</div>`
    : hero(Math.min(h, 640), min));
  const num = slide.label ? `<div class="stepnum" data-box data-text data-name="step">${esc(slide.label)}</div>` : "";
  const promptBox = `<div class="ui ui-prompt" data-box data-ui data-name="prompt box"><div class="ui-cap">${esc(ZYVO_UI.idea)}</div><div class="ui-input" ${fitAttr(TYPE.uiPrompt)} data-name="prompt">${esc(slide.prompt ?? "")}<span class="caret"></span></div><div class="ui-row"><span class="ui-btn">${esc(ZYVO_UI.generate)} →</span></div></div>`;
  const list = (rows, mark = "✓") => rows.map((t, n) => `<div class="ui-item" data-name="line ${n + 1}" ${fitAttr(TYPE.item)}><i>${mark}</i><span>${highlight(t)}</span></div>`).join("");
  const callout = slide.callout ? `<div class="callout" data-box data-text ${fitAttr(TYPE.callout)} data-name="callout"><span class="arrow">↑</span>${highlight(slide.callout)}</div>` : "";
  switch (k) {
    case "feature_hero":
      return `${label}${head(TYPE.cover)}${tiles(gallery.slice(0, 3), 640, 380)}${callout}${body}`;
    case "style_grid":
    case "template_showcase":
      return `${label}${head()}${tiles(gallery.slice(0, 8), 860, 520)}${body}`;
    case "spotlight":
      return `${label}${head()}${gallery.length > 1 ? tiles(gallery.slice(0, 3), 640, 380) : tiles(gallery, 640, 380)}${body}${items('<span class="dot"></span>')}${callout}`;
    case "ui_prompt":
      return `${num}${head()}${promptBox}${body}`;
    case "ui_checklist":
      return `${num}${head()}<div class="ui ui-check" data-box data-ui data-name="checklist">${list(slide.items ?? [])}</div>${body}`;
    case "ui_result":
      return `${num}${head()}${tiles(gallery.slice(0, 1), 640, 380, "finished video").replace('<figure class="gtile">', '<figure class="gtile play">')}<div class="ui ui-dl" data-box data-ui data-name="download panel"><span class="ui-btn">⬇ ${esc(ZYVO_UI.download)}</span></div>${body}`;
    case "prompt_result":
      return `${label}${head()}${promptBox}<div class="arrowdown" data-box data-name="arrow">↓</div>${tiles(gallery.slice(0, 1), 560, 340, "result")}`;
    case "by_hand":
      return `${head()}${tiles(gallery.slice(0, 1), 420, 260)}<div class="vs"><div class="side bad" data-box data-name="by hand"><b>✗ BY HAND</b>${list(slide.items ?? [], "•")}</div>
<div class="side good" data-box data-name="with Zyvo"><b>✓ WITH ZYVO</b>${list(slide.items_right ?? [], "✓")}</div></div>`;
    case "cta_button":
    default:
      return `${head()}${tiles(gallery.slice(0, 3), 520, 320)}<div class="ctabtn" data-box data-ui data-text data-name="button">${esc(slide.body || ZYVO_UI.button)}</div><div class="ctameta" data-box data-text data-name="link"><span class="site">${esc(ZYVO_UI.site)}</span><span class="pill">${esc(ZYVO_UI.bio)}</span></div>`;
  }
}

/** The brand footer on every Zyvo-account slide: the Zyvo logo + name, and the swipe hint (inside the safe zone). */
function brandFooter(index, total, ctx) {
  const z = ctx.logos?.["tryzyvo.com"];
  const logo = typeof z === "string" ? z : z?.url;
  const mark = logo ? `<img src="${safeUrl(logo, ctx.allowFile)}" alt="">` : '<span class="bf-z">Z</span>';
  return `<div class="brandfoot" data-box data-name="footer"><span class="bf-logo">${mark}</span><b>Zyvo</b><span class="bf-swipe">${index < total - 1 ? "swipe →" : "tryzyvo.com"}</span></div>`;
}

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
const problems=[],warnings=[];
try{await document.fonts.ready}catch(e){}
const imgs=[...document.images];
await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
for(const i of imgs)if(!i.naturalWidth&&!i.classList.contains("blur"))problems.push("an image didn't load ("+(i.closest("[data-name]")?.dataset.name||"background")+")");
const content=document.querySelector(".content");
const CW=content?content.clientWidth:0;
const borders=(el)=>{const c=getComputedStyle(el);return[parseFloat(c.borderLeftWidth)+parseFloat(c.borderRightWidth),parseFloat(c.borderTopWidth)+parseFloat(c.borderBottomWidth)]};
// A hero: the picture at its own shape inside W x H. The frame is the picture, at least 75 % of the width
// for a tall picture; fill=true (free height left) lets the frame grow up to 1.45x the picture's height.
// Any frame area beyond the picture shows the blurred copy (.wide).
const sizeHero=(img,h,fill)=>{const box=img.closest(".hero");const tilt=img.closest(".tilt");const W=CW-(tilt?72:0);const H=h-(tilt?40:0);const nw=img.naturalWidth,nh=img.naturalHeight;if(!nw||!nh)return;const k=Math.min(W/nw,H/nh);const w=Math.round(nw*k),ih=Math.round(nh*k);img.style.width=w+"px";img.style.height=ih+"px";img.dataset.h=h;
if(!box)return;const[bw,bh]=borders(box);const fw=Math.max(w,Math.round(W*0.75));const fh=fill?Math.max(ih,Math.min(H,Math.round(ih*1.45))):ih;box.style.width=(fw+bw)+"px";box.style.height=(fh+bh)+"px";box.classList.toggle("wide",fw>w+4||fh>ih+4)};
// The showcase collage: the tiles at their own shapes in one or two rows (whichever shows them biggest).
// The Zyvo account's galleries (data-cols): an even grid, 2 cells a row (an odd first picture spans the row),
// each picture whole inside its cell over a blurred copy of itself (never cropped).
const layGrid=(el,H)=>{const tiles=[...el.querySelectorAll("img[data-tile]")].filter(i=>i.naturalWidth);el.dataset.h=H;if(!tiles.length)return;
const g=14,W=CW,n=tiles.length,cols=Math.min(+el.dataset.cols||2,n),span=n%cols===1&&n>1;const rows=Math.ceil(n/cols);
const cw=(W-g*(cols-1))/cols;const ch=Math.floor(Math.min((H-g*(rows-1))/rows,cw*1.3,(span?W:cw)*1.3));
el.innerHTML="";let row=null;
tiles.forEach((t,i)=>{const fig=t.closest("figure")||t;const wide=span&&i===0;const fw=Math.floor(wide?W:cw);
if(wide||!row||row.children.length>=cols||(span&&i===1)){row=document.createElement("div");row.className="row";el.appendChild(row)}
fig.classList.add("cell");fig.style.width=fw+"px";fig.style.height=ch+"px";
if(!fig.querySelector(".gblur")){const b=t.cloneNode();b.className="gblur";b.removeAttribute("data-tile");fig.insertBefore(b,t)}
const k=Math.min(fw/t.naturalWidth,ch/t.naturalHeight);t.style.width=Math.round(t.naturalWidth*k)+"px";t.style.height=Math.round(t.naturalHeight*k)+"px";row.appendChild(fig)})};
const layCollage=(el,H)=>{if(el.dataset.cols)return layGrid(el,H);const tiles=[...el.querySelectorAll("img[data-tile]")].filter(i=>i.naturalWidth);el.dataset.h=H;if(!tiles.length)return;
const g=14,W=CW,a=tiles.map(i=>i.naturalWidth/i.naturalHeight);
const plans=[[tiles.length]];for(let s=1;s<tiles.length;s++)plans.push([s,tiles.length-s]);for(let r=3;r<=Math.min(4,tiles.length);r++){const p=[];let left=tiles.length;for(let k=r;k>0;k--){const n=Math.ceil(left/k);p.push(n);left-=n}plans.push(p)}
const cols=+el.dataset.cols||99;const ok=plans.filter(p=>p.every(n=>n<=cols));if(ok.length)plans.splice(0,plans.length,...ok);
let best=null;for(const p of plans){let at=0;const rows=p.map(n=>{const r=a.slice(at,at+n);at+=n;return r});
const hs=rows.map(r=>(W-g*(r.length-1))/r.reduce((x,y)=>x+y,0));const tot=hs.reduce((x,y)=>x+y,0);const s=Math.min(1,(H-g*(rows.length-1))/tot);
const area=rows.reduce((A,r,ri)=>A+r.reduce((B,x)=>B+x*(hs[ri]*s)*(hs[ri]*s),0),0);if(!best||area>best.area)best={p,hs,s,area}}
el.innerHTML="";let at=0;for(const[ri,n]of best.p.entries()){const row=document.createElement("div");row.className="row";const hh=Math.floor(best.hs[ri]*best.s);
for(const t of tiles.slice(at,at+n)){t.style.height=hh+"px";t.style.width=Math.floor(hh*t.naturalWidth/t.naturalHeight)+"px";row.appendChild(t.closest("figure")||t)}at+=n;el.appendChild(row)}};
const resize=(el,h,fill)=>{if(el.hasAttribute("data-hero"))sizeHero(el,h,fill);else if(el.hasAttribute("data-collage"))layCollage(el,h);else{el.style.height=h+"px";el.dataset.h=h}};
const heightOf=(el)=>+el.dataset.h||el.getBoundingClientRect().height;
for(const i of document.querySelectorAll("img[data-hero]"))sizeHero(i,+i.dataset.hero);
for(const c of document.querySelectorAll("[data-collage]"))layCollage(c,+c.dataset.collage);
for(const i of document.querySelectorAll(".logo img"))if(i.naturalWidth){i.style.maxWidth=Math.min(i.naturalWidth,106)+"px";i.style.maxHeight=Math.min(i.naturalHeight,106)+"px"}
const lines=(el)=>{const r=document.createRange();r.selectNodeContents(el);const tol=parseFloat(getComputedStyle(el).fontSize)*0.6;const tops=[];for(const q of r.getClientRects()){if(q.width<1||q.height<1)continue;if(!tops.some(t=>Math.abs(t-q.top)<tol))tops.push(q.top)}return tops.length};
const fits=[...document.querySelectorAll("[data-fit]")];
for(const el of fits){const[size,min,max]=el.dataset.fit.split(",").map(Number);let s=size;el.style.fontSize=s+"px";
while((lines(el)>max||el.scrollWidth>el.clientWidth+2)&&s>min){s-=2;el.style.fontSize=s+"px"}
if(lines(el)>max||el.scrollWidth>el.clientWidth+2)problems.push((el.dataset.name||"text")+" needs more than "+max+" line"+(max>1?"s":"")+": shorten it")}
const gap=content?parseFloat(getComputedStyle(content).rowGap)||0:0;
const stackH=()=>{const kids=[...content.children];return kids.reduce((s,k)=>s+k.offsetHeight,0)+Math.max(0,kids.length-1)*gap};
const over=()=>stackH()>content.clientHeight+1;
const growers=content?[...content.querySelectorAll("img[data-hero],[data-collage]")]:[];
if(content){let guard=200;
while(over()&&guard-->0){
const sh=[...content.querySelectorAll("[data-shrink]")].find(i=>heightOf(i)>+i.dataset.shrink+20);
if(sh){resize(sh,heightOf(sh)-40);continue}
const cand=fits.filter(el=>content.contains(el)).map(el=>{const[,min]=el.dataset.fit.split(",").map(Number);return{el,min,s:parseFloat(el.style.fontSize)}}).filter(c=>c.s>c.min).sort((a,b)=>b.s-a.s)[0];
if(!cand)break;cand.el.style.fontSize=(cand.s-2)+"px"}
if(over())problems.push("the slide has more than fits in the safe zone: shorten it");
// Then the other way (owner, 2026-10-18: no empty space): free height goes to the slide's picture first,
// then, on a short slide, to the headline (up to 1.3x its size, within its line limit).
else{if(growers.length){const g0=growers[0];
const free=content.clientHeight-stackH();if(free>8){resize(g0,Math.min(1400,Math.floor(g0.offsetHeight+free)),true);let t=60;while(over()&&t-->0)resize(g0,heightOf(g0)-10,true)}}
const H=content.clientHeight;
for(const el of fits.filter(e=>e.classList.contains("headline")&&content.contains(e))){const[size,,max]=el.dataset.fit.split(",").map(Number);let s=parseFloat(el.style.fontSize);
while(s+4<=size*1.3&&H-stackH()>H*0.18){el.style.fontSize=(s+4)+"px";if(lines(el)>max||el.scrollWidth>el.clientWidth+2||over()){el.style.fontSize=s+"px";break}s+=4}}}}
// Highlights: the bar covers the letters plus a padding smaller than the gap to the next line, so a bar
// never touches another line's letters or bar. The font's metrics come from a canvas measurement.
const cv=document.createElement("canvas").getContext("2d");
const metrics=(el,text)=>{const c=getComputedStyle(el);cv.font=c.fontWeight+" "+c.fontSize+" "+c.fontFamily;let t=text??el.textContent;if(c.textTransform==="uppercase")t=t.toUpperCase();const m=cv.measureText(t||"H");return{fa:m.fontBoundingBoxAscent,fd:m.fontBoundingBoxDescent,aa:m.actualBoundingBoxAscent,ad:Math.max(0,m.actualBoundingBoxDescent),size:parseFloat(c.fontSize)}};
const pitchOf=(el)=>{const v=parseFloat(getComputedStyle(el).lineHeight);return isNaN(v)?parseFloat(getComputedStyle(el).fontSize)*1.2:v};
const hlBlocks=new Set();
for(const hl of document.querySelectorAll(".hl")){const p=hl.closest("[data-fit]")||hl.parentElement;hlBlocks.add(p);const m=metrics(hl);const pm=metrics(p);const pitch=pitchOf(p);
const glyphH=Math.max(m.aa,pm.aa)+Math.max(m.ad,pm.ad);const pad=Math.max(0,Math.min(m.size*0.08,(pitch-glyphH)/2-6));
hl.style.paddingTop=hl.style.paddingBottom=pad+"px";hl.dataset.band=JSON.stringify([m.fa-m.aa,m.aa+m.ad+2*pad,pad]);
hl.style.backgroundSize="100% "+(m.aa+m.ad+2*pad)+"px";hl.style.backgroundPosition="0 "+(m.fa-m.aa)+"px"}
const touch=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>1&&a.t<b.b+2&&b.t<a.b+2;
for(const p of hlBlocks){const pm=metrics(p);const tol=pm.size*0.5;const tops=[];const lineOf=(top)=>{let i=tops.findIndex(t=>Math.abs(t-top)<tol);if(i<0){tops.push(top);i=tops.length-1}return i};
const glyphs=[],bands=[];const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);const r=document.createRange();
for(let n=w.nextNode();n;n=w.nextNode()){r.selectNodeContents(n);const m=metrics(n.parentElement,n.textContent);for(const q of r.getClientRects()){if(q.width<1)continue;glyphs.push({line:lineOf(q.top),l:q.left,r:q.right,t:q.top+m.fa-m.aa,b:q.top+m.fa+m.ad})}}
for(const hl of p.querySelectorAll(".hl")){const[off,bh,pad]=JSON.parse(hl.dataset.band);for(const q of hl.getClientRects()){if(q.width<1)continue;const t=q.top+off;bands.push({line:lineOf(q.top+pad),l:q.left,r:q.right,t,b:t+bh})}}
let bad=false;for(const b of bands){for(const o of[...glyphs,...bands])if(o!==b&&o.line!==b.line&&touch(b,o)){bad=true;break}if(bad)break}
if(bad)problems.push("a highlight in the "+(p.dataset.name||"text")+" touches another line")}
const S=${JSON.stringify(INNER_RECT)};const AV=${JSON.stringify(AVOID)};const TEXT_ONLY=${JSON.stringify(TEXT_ONLY_KINDS)};
const boxes=[...document.querySelectorAll("[data-box]")].map(el=>({el,r:el.getBoundingClientRect(),name:el.dataset.name||el.className}));
for(const b of boxes){const r=b.r;
if(r.left<S.x0-1||r.top<S.y0-1||r.right>S.x1+1||r.bottom>S.y1+1)problems.push(b.name+" is outside the safe zone");
for(const a of AV)if(r.right>a.x0+1&&r.left<a.x1-1&&r.bottom>a.y0+1&&r.top<a.y1-1)problems.push(b.name+" is under "+a.name)}
// A picture drawn outside its own frame (a frame that shrank) would cover the text without any box overlapping.
for(const img of document.querySelectorAll("[data-box] img")){if(img.classList.contains("blur")||img.classList.contains("gblur"))continue;const box=img.closest("[data-box]").getBoundingClientRect(),q=img.getBoundingClientRect();if(q.width>2&&(q.left<box.left-2||q.top<box.top-2||q.right>box.right+2||q.bottom>box.bottom+2))problems.push("a picture spills out of its frame ("+(img.closest("[data-name]")?.dataset.name||"picture")+")")}
const visuals=[...document.querySelectorAll("[data-visual] img, img[data-visual]")].filter(i=>i.naturalWidth>0);
const bgPhoto=[...document.querySelectorAll(".bg img")].some(i=>i.naturalWidth>0);
const uiVisual=Boolean(document.querySelector("[data-ui]"));
if(!visuals.length&&!uiVisual&&!(TEXT_ONLY.includes(document.body.dataset.kind)&&bgPhoto))problems.push("no visual element: the slide needs a picture");
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];
if(a.el.contains(b.el)||b.el.contains(a.el))continue;
const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
if(w>2&&h>2)problems.push(a.name+" overlaps "+b.name)}
// Empty space (a warning: the slide still renders, admin marks it): the free height above and below the
// stack plus the empty sides beside a picture narrower than the zone, as a share of the safe area.
let empty=0;
if(content){const W=content.clientWidth,H=content.clientHeight;let side=0;
for(const v of content.querySelectorAll(".hero,.browser"))side+=Math.max(0,W-v.offsetWidth)*v.offsetHeight;
for(const row of content.querySelectorAll(".collage .row"))side+=Math.max(0,W-row.offsetWidth)*row.offsetHeight;
empty=Math.max(0,((H-stackH())*W+side)/(W*H));
if(empty>0.25)warnings.push("about "+Math.round(empty*100)+"% of the safe area is empty")}
const result={ok:problems.length===0,problems:[...new Set(problems)],warnings,empty:Math.round(empty*100)/100};
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
  // Only for a GENERATED meme picture (it fills the frame edge to edge): a real Zyvo output, a Zyvo slide and a
  // showcase collage keep the normal layout, where nothing is cropped (owner, 2026-10-18).
  const real = slide.is_zyvo || Boolean(slide.asset_id) || (images.collage ?? []).filter(Boolean).length >= 2;
  const meme = !real && (slide.kind === "meme" || (style.meme && ["cover", "text", "cta"].includes(slide.kind))) && Boolean(heroUrl || images.background);
  // Text goes over a background photo only in the photo styles (generated with no people). The meme style's
  // picture may show an invented character, so it is never put behind text.
  const photo = !meme && !style.meme && Boolean(images.background);
  const bg = photo ? `<div class="bg"><img src="${safeUrl(images.background, allowFile)}" alt=""></div><div class="shade"></div><div class="scrim"></div>` : "";
  const deco = style.grid && !photo ? '<div class="glow"></div><div class="grid"></div>' : "";
  const avoid = AVOID.map((a) => `<div class="zone" style="left:${a.x0}px;top:${a.y0}px;width:${a.x1 - a.x0}px;height:${a.y1 - a.y0}px;background:rgba(255,140,0,.35)"></div>`).join("");
  const zones = safeZones ? `<div class="zone l"></div><div class="zone r"></div><div class="zone t"></div><div class="zone b"></div>${avoid}<div class="zoneline"></div><div class="zonepad"></div>` : "";
  const pic = heroUrl ?? images.background;
  const main = meme
    ? `<div class="meme"><div class="memebar"><div class="memetext" ${fit(TYPE.meme)} data-name="meme text">${esc(String(slide.headline).replace(/\*/g, ""))}</div>${slide.body ? `<div class="memebody" ${fit(TYPE.memeBody)} data-name="meme caption">${esc(String(slide.body).replace(/\*/g, ""))}</div>` : ""}</div>
<img class="memeimg" data-visual src="${safeUrl(pic, allowFile)}" alt=""></div>`
    : `<div class="content">${inner(slide, style, images, ctx)}</div>${style.brand ? brandFooter(index, total, ctx) : ""}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${SIZE.width}">${fontCss}<style>${css(style, photo)}</style></head>
<body data-slide="${index}" data-kind="${esc(slide.kind)}"><div class="slide">${bg}${deco}${main}${zones}</div>${LAYOUT_SCRIPT}</body></html>`;
}
