// Blocky Worlds one-word captions (AUDIO agent). Browser ES module, no THREE needed.
//   await loadCaptionFont();              // once, before the first frame
//   drawCaption(ctx2d, timeline.captions, t);
// Deterministic: the drawing depends only on (captions, t).

const FAMILY = "BWCaption";
const HOLD = 0.25;            // keep the last word this long after its end when nobody is speaking
const POP = 0.09;             // pop-in length (s): scale 0.7 -> 1.08 -> 1.0
const BASE_PX = 140;          // font size at 1080 wide
const STROKE = "#0b0a12";
const EMPHASIS = "#BEF264";   // lime, for ALL-CAPS words and shouts ("Barnaby!")

let fontPromise = null;
/** Load Lilita One as "BWCaption" once (served at /assets/LilitaOne-Regular.ttf). */
export function loadCaptionFont(url = "/assets/LilitaOne-Regular.ttf") {
  if (!fontPromise) {
    fontPromise = (async () => {
      const face = new FontFace(FAMILY, `url(${url})`);
      await face.load();
      document.fonts.add(face);
      return face;
    })();
  }
  return fontPromise;
}

/** Index of the caption to show at t, or -1. captions are in time order. */
export function captionIndexAt(captions, t) {
  if (!captions || !captions.length) return -1;
  let lo = 0, hi = captions.length - 1, i = -1;
  while (lo <= hi) {                      // last word with start <= t
    const mid = (lo + hi) >> 1;
    if (captions[mid].start <= t) { i = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (i < 0) return -1;
  const w = captions[i];
  if (t < w.end) return i;
  return t < w.end + HOLD ? i : -1;       // the next word has not started yet (else it would be i)
}

/** The text drawn for a token: trailing commas/periods/quotes dropped, ? and ! kept. */
export function captionText(word) {
  let s = String(word ?? "").trim();
  s = s.replace(/^["'“‘(]+/, "").replace(/["'”’),.;:…]+$/, "");
  if (/[!?]$/.test(s)) s = s.replace(/[.,]+(?=[!?]+$)/, "");
  return s || String(word ?? "").trim();
}

function isEmphasis(word) {
  const letters = String(word).replace(/[^A-Za-z]/g, "");
  return /!$/.test(word) || (letters.length >= 2 && letters === letters.toUpperCase());
}

/** Pop-in scale for age (s) since the word started. */
function popScale(age) {
  if (age >= POP) return 1;
  const a = Math.max(0, age);
  const k1 = POP * 0.6;
  if (a < k1) { const u = a / k1; return 0.7 + (1.08 - 0.7) * (1 - (1 - u) * (1 - u)); }
  const u = (a - k1) / (POP - k1);
  return 1.08 + (1 - 1.08) * (u * u * (3 - 2 * u));
}

/** Draw the one word spoken at t onto a 2D context (any size; designed at 1080x1920). */
export function drawCaption(ctx, captions, t) {
  const i = captionIndexAt(captions, t);
  if (i < 0) return;
  const w = captions[i];
  const text = captionText(w.word);
  if (!text) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const s = W / 1080;
  const maxW = W * 0.9;
  const strokeW = 16 * s;
  ctx.save();
  let px = BASE_PX * s;
  const font = (p) => `${Math.round(p)}px ${FAMILY}, "Lilita One", "Arial Black", sans-serif`;
  ctx.font = font(px);
  const tw = ctx.measureText(text).width + strokeW;
  if (tw > maxW) { px *= maxW / tw; ctx.font = font(px); }
  const scale = popScale(t - w.start);
  ctx.translate(W / 2, H * 0.62);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  // soft drop shadow under the stroke
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18 * s;
  ctx.shadowOffsetY = 8 * s;
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = STROKE;
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = isEmphasis(w.word) ? EMPHASIS : "#ffffff";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
