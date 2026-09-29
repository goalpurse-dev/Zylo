// deno-lint-ignore-file no-explicit-any
// stickman/thumbnailV2.ts — Thumbnail V2: built from THIS video (its title,
// script, story plan and Production Bible), one of six archetypes per
// thumbnail, the headline drawn by code in the top third. Pure functions
// (no network), so the rules are tested offline; long-form-thumbnails wires
// in the model calls.
//
// SOURCE OF TRUTH: docs/thumbnails/thumbnail-pack.md. Its THUMBNAIL HEADER and
// COMPOSITION/NO-TEXT blocks are used VERBATIM (thumbnailPack.gen.ts, built by
// scripts/buildThumbnailPack.mjs); a prompt is exactly the pack's shape:
//   [HEADER] BACKGROUND: … SUBJECT: … [COMPOSITION/NO-TEXT]
// Zyvo's own additions live inside SUBJECT: the video's hook object (large,
// attached — on a head or held, never floating), the video's canonical cast
// (only them, no extras, every face drawn), the main character largest.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { findFaces } from "./faceFinder.ts";
import { edgeDensity, type OverlayLayer } from "./textOverlay.ts";
import { PACK, PACK_COMPOSITION, PACK_HEADER, type PackExample } from "./thumbnailPack.gen.ts";

export const ARCHETYPES = ["REACTION", "VERSUS", "DANGER", "SCALE", "REVEAL", "TRANSFORMATION"] as const;
export type Archetype = typeof ARCHETYPES[number];
// The pack's archetype definitions, verbatim.
export const ARCHETYPE_DEFINITIONS: Record<Archetype, string> = {
  REACTION: "a character with an extreme emotion (shock, disgust, fear, confusion) reacting to something.",
  VERSUS: "a split frame: two things face off or before/after (myth vs reality, you vs X).",
  DANGER: "a character in obvious peril (predator eyes, sharks, a looming threat).",
  SCALE: "something absurdly big next to something tiny (star vs astronaut, mammoth vs person).",
  REVEAL: "a mystery or a surprising object that raises a question (an empty ship, a dashed missing moon).",
  TRANSFORMATION: "the same character in two states (rich → broke, asleep → awake).",
};
// The pack's background style (spec #4), for the concept call.
export const BACKGROUND_STYLE = "A flat 2–3 tone background that contrasts strongly with the subject (warm subject on a cool background or vice versa). Saturated, no gradients, no clutter.";
export type ThumbConcept = {
  archetype: Archetype; headline: string; scene: string; cast: string[];
  mainCharacter?: string | null; expression?: string; background?: string;
};

// Nano Banana 2 Lite on every tier (~$0.034 per image), upscaled to 1920x1080.
export const THUMB_MODEL = "google:nano-banana@2-lite";
export const THUMB_GEN = { width: 1376, height: 768 };
export const THUMB_OUT = { full: { width: 1920, height: 1080 }, youtube: { width: 1280, height: 720 } };
export const THUMB_MAX_BYTES = 2 * 1024 * 1024;
export const MAX_MAIN_CHARACTERS = 2;
export { PACK, PACK_HEADER, PACK_COMPOSITION };

/* ============================ Few-shot from the pack ============================ */

const STOP = new Set("a an and are as at be but by can could did do does for from had has have how in into is it its of on or so than that the their them then there these they this those to was were what when where which who why will with would you your".split(" "));
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ies)$/, "y").replace(/(es|s|ed|ing)$/, "");
const words = (s: string) => String(s ?? "").split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((w) => w.length >= 3 && !STOP.has(w));
// Pack examples from the video's niche: the pack's niches have 2 examples
// each, so the best-matching niche + the next one (4 examples).
export function packFewShot(videoText: string, n = 4): PackExample[] {
  const v = new Set(words(videoText).map(stem));
  const niches = [...new Set(PACK.map((e) => e.niche))];
  const score = (niche: string) => { const ws = words(`${niche} ${niche} ${PACK.filter((e) => e.niche === niche).map((e) => `${e.headline} ${e.subject}`).join(" ")}`).map(stem); return ws.filter((w) => v.has(w)).length / Math.sqrt(ws.length || 1); };
  const ranked = niches.map((nc) => ({ nc, s: score(nc) })).sort((a, b) => b.s - a.s);
  return ranked.flatMap((r) => PACK.filter((e) => e.niche === r.nc)).slice(0, n);
}

/* ============================ Headline rules ============================ */

export const titleWords = (title: string) => new Set(words(title).map(stem));
// Words that hand over the answer (in a statement; "FAKE HORNS?" asks, it doesn't answer).
const ANSWER = /\b(YES|TRUE|FALSE|FAKE|MYTHS?|DEBUNKED|BUSTED|HOAX|LIES?|PROVEN|CONFIRMED)\b|^NO[!.?]*$/;
// Generic hooks that fit any video: banned (they say nothing about THIS one).
export const GENERIC_HEADLINE = /^(THINK AGAIN|THE (REAL|TRUE|WHOLE|HIDDEN) (PIECE|STORY|TRUTH|REASON|ANSWER)|THE TRUTH|THE SECRET|WAIT,? WHAT\??|NO WAY!?|OMG!?|MIND ?BLOWN!?|SHOCKING!?|UNBELIEVABLE!?|YOU WON'?T BELIEVE.*|WHAT HAPPENED\??|WHAT\?!?|WOW!?|REALLY\?!?|IS IT TRUE\??|THE END|GAME OVER)$/;
const QUESTION = /\?[!]?$/;
const WH = /^(WHO|WHY|HOW|WHAT|WHERE|WHEN|WHICH|COULD|CAN|IS|ARE|DID|DOES)\b/;

// The pack: 1–3 words (max 4 for a question), ALL CAPS, usually a question,
// never the answer, complementing the title (a question may name the topic).
export function headlineProblems(headline: string, title: string, topicWords: string[] = []): string[] {
  const h = String(headline ?? "").trim();
  const ws = h.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const question = QUESTION.test(h);
  if (!ws.length) out.push("empty");
  if (ws.length > (question ? 4 : 3)) out.push(`${ws.length} words (max ${question ? 4 : 3})`);
  if (h !== h.toUpperCase()) out.push("not ALL CAPS");
  const bare = h.toUpperCase().replace(/[^A-Z0-9' ?!,]/g, "").trim();
  if (GENERIC_HEADLINE.test(bare)) out.push("generic");
  if (!question && ANSWER.test(bare)) out.push("gives the answer");
  const tw = titleWords(title);
  const topic = new Set([...tw, ...topicWords.flatMap(words).map(stem)]);
  const specific = ws.some((w) => { const s = stem(w); return s.length >= 3 && topic.has(s); });
  if (!question && ws.some((w) => tw.has(stem(w)))) out.push("repeats the title");
  if (!question && !specific && !out.includes("generic")) out.push("not about this video (make it a question or name the thing)");
  if (question && !specific && !WH.test(bare) && !out.includes("generic")) out.push("a vague question");
  return out;
}

// When the model still breaks a rule: a question about the hook object.
export function fixHeadline(headline: string, title: string, hookObject: string, topicWords: string[] = []): string {
  const h = String(headline ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  const cut = h.split(" ").slice(0, 3).join(" ");
  const q = QUESTION.test(cut) ? cut : `${cut.replace(/[.!,]+$/, "")}?`;
  if (cut && !headlineProblems(cut, title, topicWords).length) return cut;
  if (cut && !headlineProblems(q, title, topicWords).length) return q;
  const noun = words(hookObject).filter((w) => !/^(plain|small|big|large|round|iron|old|horned|shiny|curved|two)$/.test(w)).pop() ?? "IT";
  return `WHO MADE ${noun.toUpperCase().endsWith("S") ? "THESE" : "THIS"}?`;
}

/* ============================ Concepts ============================ */

// Nothing the model could letter: words, signs, symbols and question marks are ours (the headline).
export function scrubScene(scene: string, hookObject = ""): string {
  let s = String(scene ?? "")
    .replace(/[“"][^”"]*[”"]/g, "")
    .replace(/[?!]/g, "")
    .replace(/\b(with |a |an |the )?(big |bold |large |giant )?(question marks?|exclamation marks?|text|words?|letters?|headline|title|caption|labels?|signs? (reading|saying)[^.,;]*|speech bubbles?|thought bubbles?|emojis?|symbols?|arrows?|logos?)\b[^.,;]*/gi, "");
  // Vague object words ("a plain iron dome") become the object by its plain name.
  if (hookObject) s = s.replace(/\b(a|an|the)\s+((small|plain|simple|round|old|iron|metal|mysterious|strange),?\s+){0,3}(dome|object|item|thing|artifact|artefact)\b/gi, `$1 ${hookObject.replace(/^(a|an|the)\s+/i, "")}`);
  return s.replace(/\s+([,.;])/g, "$1").replace(/[,;]\s*[,;.]/g, ".").replace(/\s{2,}/g, " ").trim();
}
const mentions = (scene: string, hookObject: string) => { const w = words(hookObject).map(stem); const head = w[w.length - 1]; return !!head && words(scene).map(stem).includes(head); };
// The pack's background style: flat, saturated, 2-3 tones, the place only as a band — never a white/grey room.
const ROOM = /\b(room|interior|gallery|hall|office|studio|kitchen|museum)\b/i;
const PALE_FIRST = /^(flat\s+)?(plain\s+|pale\s+|light\s+|soft\s+)*(white|grey|gray|off-white|cream|beige)\b/i;
export function normalizeBackground(bg: string, fallback: string): { background: string; problem: string | null } {
  let b = String(bg ?? "").replace(/^BACKGROUND:\s*/i, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (!b) return { background: fallback, problem: "no background" };
  if (PALE_FIRST.test(b) || (ROOM.test(b) && !/\bband\b/i.test(b))) return { background: fallback, problem: `pale/room background "${b.slice(0, 60)}"` };
  if (!/^(flat|split)\b/i.test(b)) b = `flat ${b}`;
  return { background: b, problem: null };
}
const FALLBACK_BACKGROUNDS = ["flat deep royal blue", "flat saturated crimson red", "flat bright teal", "flat rich violet", "flat vivid orange", "flat emerald green"];

export function normalizeConcepts(raw: any[], title: string, castIds: string[], hookObject = "", topicWords: string[] = []): { concepts: ThumbConcept[]; problems: string[] } {
  const problems: string[] = [];
  const seen = new Set<string>();
  const concepts: ThumbConcept[] = [];
  const topic = [hookObject, ...topicWords];
  for (const [i, c] of (raw ?? []).slice(0, 3).entries()) {
    let archetype = String(c?.archetype ?? "").toUpperCase() as Archetype;
    if (!ARCHETYPES.includes(archetype) || seen.has(archetype)) {
      problems.push(`#${i + 1}: archetype ${archetype || "missing"} ${seen.has(archetype) ? "repeated" : "unknown"}`);
      archetype = ARCHETYPES.find((a) => !seen.has(a))!;
    }
    seen.add(archetype);
    const hp = headlineProblems(c?.headline, title, topic);
    if (hp.length) problems.push(`#${i + 1}: headline "${c?.headline}" ${hp.join("; ")}`);
    const cast = (Array.isArray(c?.cast) ? c.cast : []).map(String).filter((id: string) => castIds.includes(id));
    if (cast.length > MAX_MAIN_CHARACTERS) problems.push(`#${i + 1}: ${cast.length} main characters (max ${MAX_MAIN_CHARACTERS})`);
    const main = castIds.includes(String(c?.mainCharacter)) ? String(c.mainCharacter) : cast[0] ?? null;
    const keep = [...new Set([main, ...cast].filter(Boolean) as string[])].slice(0, MAX_MAIN_CHARACTERS);
    let scene = scrubScene(c?.scene, hookObject);
    if (hookObject && !mentions(scene, hookObject)) { problems.push(`#${i + 1}: scene misses the hook object`); scene = `${scene.replace(/\.?$/, ".")} ${hookObject.replace(/^./, (x) => x.toUpperCase())}, large and clear in the frame.`; }
    const bg = normalizeBackground(c?.background, FALLBACK_BACKGROUNDS[i % FALLBACK_BACKGROUNDS.length]);
    if (bg.problem) problems.push(`#${i + 1}: ${bg.problem}`);
    concepts.push({ archetype, headline: hp.length ? fixHeadline(c?.headline, title, hookObject, topic) : String(c.headline).trim(), scene, cast: keep, mainCharacter: main, expression: String(c?.expression ?? "").slice(0, 80) || "shocked", background: bg.background });
  }
  if (concepts.length < 3) problems.push(`${concepts.length} concepts (need 3)`);
  return { concepts, problems };
}

/* ============================ Prompt: the pack's exact shape ============================ */

export function subjectBlock(c: ThumbConcept, hookObject: string, cast: { id: string; block: string; name: string }[]): string {
  const main = cast.find((p) => p.id === c.mainCharacter) ?? cast[0];
  const people = cast.length
    ? ` The characters (these only, no extras or bystanders): ${cast.map((p) => p.block).join(" ")} ${main.name} is the LARGEST figure, closest to the viewer, with an extreme ${c.expression ?? "shocked"} face; every visible character has a full face (eyes, eyebrows, mouth), never a blank head.`
    : "";
  const hook = hookObject ? ` ${hookObject.replace(/^./, (x) => x.toUpperCase())} is large and clear, worn properly on a head or held firmly in mitten hands — never floating, with every part attached where it belongs.` : "";
  return `${c.scene.replace(/\.?$/, ".")}${hook}${people}`;
}
export function thumbnailPromptV2(c: ThumbConcept, hookObject: string, cast: { id: string; block: string; name: string }[]): string {
  return `${PACK_HEADER} BACKGROUND: ${String(c.background ?? FALLBACK_BACKGROUNDS[0]).replace(/\.?$/, ".")} SUBJECT: ${subjectBlock(c, hookObject, cast)} ${PACK_COMPOSITION}`;
}

/* ============================ Checks (free, in code) + the look ============================ */

// Calibrated 2026-09-29 on the Viking V2 / V2.1 renders (see tests/replay/thumbnailV2.test.ts).
export const THUMB_CHECKS = { topThirdMaxEdge: 14, faceMinShare: 0.08, contrastMin: 0.35, greyMaxShare: 0.45, subjectMinHeight: 0.45, topIntrusionMax: 0.04 };
const lumaAt = (img: Image, x: number, y: number) => { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x, y)); return 0.299 * r + 0.587 * g + 0.114 * b; };

// sRGB -> CIE Lab (D65).
export function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const dE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The frame read once on a grid. The BACKGROUND is a small palette (the pack's
// flat 2-3 tones): the colours that cover the top third and thin side strips
// (which the pack keeps free of the subject). The SUBJECT is every pixel far
// from all of them — so a burst or a floor band isn't mistaken for the subject.
// From that: the subject's box (height share, centre), how much of it reaches
// into the top third, and the first subject row (for the shift-down fix).
const STEP = 6, FAR = 24;
export type Layout = { bgPalette: number[][]; bgRgb: number[]; subjectDeltaE: number; box: { x0: number; y0: number; x1: number; y1: number } | null; heightShare: number; centerX: number; topIntrusion: number; topRow: number };
export function readLayout(img: Image): Layout {
  const W = img.width, H = img.height, top = Math.floor(H / 3), strip = Math.round(W * 0.03);
  const px = (x: number, y: number) => { const c = Image.colorToRGBA(img.getPixelAt(x, y)); return [c[0], c[1], c[2]]; };
  // Background palette: 8-level colour bins over the top third + side strips; bins with >= 4% of those samples.
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let border = 0;
  for (let y = 1; y <= H; y += STEP) for (let x = 1; x <= W; x += STEP) {
    if (!(y <= top || x <= strip || x > W - strip)) continue;
    const [r, g, b] = px(x, y);
    const k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
    border++;
  }
  const pal = [...bins.values()].filter((e) => e.n >= border * 0.04).sort((a, b) => b.n - a.n).slice(0, 4).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const palette = pal.length ? pal : [px(1, 1)];
  const bgPalette = palette.map((c) => toLab(c[0], c[1], c[2]));
  const bgRgb = palette[0].map(Math.round);
  const nearBg = (r: number, g: number, b: number) => { const l = toLab(r, g, b); let m = Infinity; for (const p of bgPalette) m = Math.min(m, dE(l, p)); return m; };
  const cols = Math.ceil(W / STEP), rows = Math.ceil(H / STEP);
  const grid: number[] = new Array(rows * cols).fill(0); // distance to the background, per cell
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
    const y = Math.min(H, ry * STEP + 1), x = Math.min(W, cx * STEP + 1);
    const [r, g, b] = px(x, y);
    grid[ry * cols + cx] = nearBg(r, g, b);
  }
  const rowHits = new Array(rows).fill(0), colHits = new Array(cols).fill(0);
  let sumDE = 0, n = 0, topHits = 0, topAll = 0;
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
    const d = grid[ry * cols + cx], far = d > FAR, y = ry * STEP;
    if (y < top) { topAll++; if (far) topHits++; }
    if (far) { rowHits[ry]++; colHits[cx]++; if (y >= top) { sumDE += d; n++; } }
  }
  // A row / column belongs to the subject when enough of it is subject (ignores thin outlines and specks).
  const rowOn = (ry: number) => rowHits[ry] > cols * 0.03, colOn = (cx: number) => colHits[cx] > rows * 0.03;
  const ys = rowHits.map((_, i) => i).filter(rowOn), xs = colHits.map((_, i) => i).filter(colOn);
  const box = ys.length && xs.length ? { x0: xs[0] * STEP, y0: ys[0] * STEP, x1: xs[xs.length - 1] * STEP, y1: ys[ys.length - 1] * STEP } : null;
  const topRow = ys.length ? ys[0] * STEP : H;
  return { bgPalette, bgRgb, subjectDeltaE: n ? sumDE / n : 0, box, heightShare: box ? (box.y1 - box.y0) / H : 0, centerX: box ? (box.x0 + box.x1) / 2 / W : 0.5, topIntrusion: topAll ? topHits / topAll : 0, topRow };
}

// The contrast score (0..1): colour difference between the subject and the
// background (mean Lab ΔE over the subject, /60) blended with the brightness
// spread (P10–P90 luma). Brightness alone scored the red-on-orange Viking #1
// at 0.28 (it reads strongly); colour + brightness scores it ~0.5.
export function lumaSpread(img: Image): number {
  const v: number[] = [];
  for (let y = 1; y <= img.height; y += 8) for (let x = 1; x <= img.width; x += 8) v.push(lumaAt(img, x, y));
  v.sort((a, b) => a - b);
  return (v[Math.floor(v.length * 0.9)] - v[Math.floor(v.length * 0.1)]) / 255;
}
export function contrastScore(img: Image, layout = readLayout(img)): number {
  return Number((0.6 * Math.min(1, layout.subjectDeltaE / 60) + 0.4 * lumaSpread(img)).toFixed(3));
}
// Share of the frame that is white or grey (a plain room / washed-out background).
export function greyShare(img: Image): number {
  let n = 0, grey = 0;
  for (let y = 1; y <= img.height; y += 8) for (let x = 1; x <= img.width; x += 8) {
    const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x, y));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 140 && (mx - mn) / (mx || 1) < 0.15) grey++;
    n++;
  }
  return Number((grey / n).toFixed(3));
}

// The hard top-third stop, by code ($0): content reaching into the top third
// is moved DOWN (the top filled with each column's own top-row colour — the
// flat background — and the bottom cropped), then scaled if a shift alone
// would crop too much. Returns null when it can't be fixed without losing the
// subject (then the one re-render).
export function clearTopThird(img: Image, layout = readLayout(img)): { img: Image; shiftPx: number; scale: number } | null {
  const W = img.width, H = img.height, target = Math.round(H / 3) + Math.round(H * 0.02);
  if (layout.topRow >= (H / 3) * 0.95) return { img, shiftPx: 0, scale: 1 };
  const need = target - layout.topRow;
  if (need > H * 0.3) return null;
  const maxShift = Math.round(H * 0.14);
  const shift = Math.min(need, maxShift);
  const scale = need > maxShift ? (H - target) / (H - layout.topRow - shift) : 1;
  let src = img;
  if (scale < 1) {
    if (scale < 0.72) return null;
    // Scale the picture about its bottom-centre; the freed side margins repeat the
    // picture's own edge columns (a flat fill left a visible frame on a split background).
    const s = img.clone().resize(Math.round(W * scale), Math.round(H * scale));
    const x0 = Math.round((W - s.width) / 2), y0 = H - s.height;
    src = new Image(W, H);
    src.composite(s, x0, y0);
    for (let y = y0 + 1; y <= H; y++) {
      const l = src.getPixelAt(x0 + 1, y), r = src.getPixelAt(x0 + s.width, y);
      for (let x = 1; x <= x0; x++) src.setPixelAt(x, y, l);
      for (let x = x0 + s.width + 1; x <= W; x++) src.setPixelAt(x, y, r);
    }
    for (let x = 1; x <= W; x++) { const c = src.getPixelAt(x, y0 + 1); for (let y = 1; y <= y0; y++) src.setPixelAt(x, y, c); }
  }
  const out = new Image(W, H);
  for (let x = 1; x <= W; x++) { const c = src.getPixelAt(x, 1); for (let y = 1; y <= shift; y++) out.setPixelAt(x, y, c); }
  const moved = src.clone().crop(0, 0, W, H - shift);
  out.composite(moved, 0, shift);
  return { img: out, shiftPx: shift, scale: Number(scale.toFixed(3)) };
}

// Thumbnail faces (the pack's exaggerated style): big round WHITE eyes with a
// dark pupil inside a black outline. The video's finder (faceFinder.ts) wants
// small dot eyes on even skin, so it under-read these (pack #1, #13: 0.8% and
// 1.4% for faces clearly bigger). Here: round near-white regions holding a
// dark pupil, paired side by side at a similar size; the face is a circle
// about twice the eye span.
export function findThumbFaces(src: Image): { x: number; y: number; width: number; height: number }[] {
  const WW = 688, k = src.width / WW;
  const img = src.clone().resize(WW, Math.round(src.height / k));
  const W = img.width, H = img.height;
  const luma = new Float32Array(W * H), white = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x + 1, y + 1));
    const i = y * W + x;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    white[i] = luma[i] > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 45 ? 1 : 0;
  }
  const seen = new Uint8Array(W * H), stack: number[] = [];
  const eyes: { cx: number; cy: number; size: number }[] = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !white[s]) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!, x = i % W, y = (i / W) | 0;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] || !white[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 6 || h < 6 || w > W * 0.15 || h > H * 0.25 || h / w < 0.6 || h / w > 1.7) continue;
    // A pupil: dark pixels inside the box (the white region wraps around it).
    let dark = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (luma[y * W + x] < 70) dark++;
    const box = w * h, fill = (area + dark) / box;
    if (dark < box * 0.03 || dark > box * 0.5 || fill < 0.55) continue;
    eyes.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: (w + h) / 2 });
  }
  const faces: { x: number; y: number; width: number; height: number }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < eyes.length; i++) for (let j = i + 1; j < eyes.length; j++) {
    if (used.has(i) || used.has(j)) continue;
    const a = eyes[i], b = eyes[j], size = (a.size + b.size) / 2;
    const dx = Math.abs(a.cx - b.cx), dy = Math.abs(a.cy - b.cy);
    if (Math.max(a.size, b.size) / Math.min(a.size, b.size) > 1.8 || dy > size * 0.6 || dx < size * 0.9 || dx > size * 4) continue;
    used.add(i); used.add(j);
    const d = (dx + size) * 2; // face diameter ≈ twice the eye span
    const cx = (a.cx + b.cx) / 2, cy = (a.cy + b.cy) / 2 + size * 0.3;
    faces.push({ x: Math.round((cx - d / 2) * k), y: Math.round((cy - d / 2) * k), width: Math.round(d * k), height: Math.round(d * k) });
  }
  return faces;
}

// The vision look (one cheap call): stray words, who is in the picture, the hook object.
export type ThumbLook = { text: string; people: number; blankHeads: number; hookVisible: boolean; hookAttached?: boolean };
export type ThumbChecks = {
  topEdge: number; topClear: boolean; topIntrusion: number; faceShare: number; faceOk: boolean; contrast: number; contrastOk: boolean; grey: number; greyOk: boolean;
  subjectHeight: number; subjectCenterX: number; subjectOk: boolean;
  ocr: string; textFree: boolean; people: number | null; peopleOk: boolean; blankHeads: number | null; hookVisible: boolean | null; hookAttached: boolean | null; pass: boolean; score: number;
};
export function checkThumb(img: Image, look: Partial<ThumbLook> = {}, castCount = 0, archetype?: string): ThumbChecks {
  // The pack by design: SCALE shows a tiny person next to something huge (no big face); a VERSUS/TRANSFORMATION split may have one flat grey half.
  const tinyByDesign = archetype === "SCALE", splitGrey = archetype === "VERSUS" || archetype === "TRANSFORMATION";
  const W = img.width, H = img.height;
  const layout = readLayout(img);
  const topEdge = edgeDensity(img, 0, 0, W, Math.round(H / 3));
  const faces = [...findFaces(img), ...findThumbFaces(img)]; // dot-eye faces + the big white thumbnail eyes
  const faceShare = Number((faces.reduce((m, f) => Math.max(m, f.width * f.height), 0) / (W * H)).toFixed(3));
  const contrast = contrastScore(img, layout);
  const grey = greyShare(img);
  const ocr = String(look.text ?? "");
  const textFree = !/[A-Za-z0-9]{2,}/.test(ocr.replace(/[?!\s]/g, ""));
  const people = typeof look.people === "number" ? look.people : null;
  const blankHeads = typeof look.blankHeads === "number" ? look.blankHeads : null;
  const hookVisible = typeof look.hookVisible === "boolean" ? look.hookVisible : null;
  const hookAttached = typeof look.hookAttached === "boolean" ? look.hookAttached : null;
  const peopleOk = (people == null || people <= Math.max(castCount, 1)) && (blankHeads == null || blankHeads === 0);
  const subjectHeight = Number(layout.heightShare.toFixed(3)), subjectCenterX = Number(layout.centerX.toFixed(3));
  const c = {
    // The hard top-third stop: no subject row may start inside the top third (5% slack).
    topEdge, topClear: topEdge <= THUMB_CHECKS.topThirdMaxEdge && layout.topRow >= (H / 3) * 0.95, topIntrusion: Number(layout.topIntrusion.toFixed(3)),
    faceShare, faceOk: castCount === 0 || tinyByDesign || faceShare >= THUMB_CHECKS.faceMinShare, contrast, contrastOk: contrast >= THUMB_CHECKS.contrastMin,
    grey, greyOk: grey <= (splitGrey ? 0.65 : THUMB_CHECKS.greyMaxShare), subjectHeight, subjectCenterX, subjectOk: subjectHeight >= THUMB_CHECKS.subjectMinHeight && subjectCenterX > 0.25 && subjectCenterX < 0.75,
    ocr, textFree, people, peopleOk, blankHeads, hookVisible, hookAttached,
  };
  const pass = c.topClear && c.faceOk && c.contrastOk && c.greyOk && c.subjectOk && c.textFree && c.peopleOk && hookVisible !== false && hookAttached !== false;
  // Best-of when a re-render also fails: stray text is the worst, then a missing/floating hook object, a busy top, extras, a small face.
  const score = (c.textFree ? 4 : 0) + (hookVisible !== false ? 3 : 0) + (hookAttached !== false ? 1 : 0) + (c.topClear ? 2 : 0) + (c.peopleOk ? 1.5 : 0) + (c.faceOk ? 1.5 : 0) + (c.subjectOk ? 1 : 0) + (c.contrastOk ? 1 : 0) + (c.greyOk ? 1 : 0) + Math.min(1, faceShare * 5) + contrast - topEdge / 100;
  return { ...c, pass, score: Number(score.toFixed(3)) };
}

/* ============================ Headline layer (drawn by code) ============================ */

export const HEADLINE_V2 = { yellow: "#FFD21F", white: "#FFFFFF", outline: "#000000", widthRatio: 0.8, maxHeightRatio: 0.26, outlineRatio: 0.12 };
// Yellow text vanishes on a yellow/gold background: white there instead (the pack, spec #6).
export function isYellowish(img: Image, x: number, y: number, w: number, h: number): boolean {
  let r = 0, g = 0, b = 0, n = 0;
  for (let py = Math.max(1, y); py < Math.min(img.height, y + h); py += 6) for (let px = Math.max(1, x); px < Math.min(img.width, x + w); px += 6) { const c = Image.colorToRGBA(img.getPixelAt(px, py)); r += c[0]; g += c[1]; b += c[2]; n++; }
  if (!n) return false;
  r /= n; g /= n; b /= n;
  // Yellow/gold keep green close to red; orange (r 250, g 150) is NOT yellow (the pack proof drew white on orange).
  return r > 170 && g > 0.72 * r && b < 0.6 * g;
}
// ~80% of the width, in the TOP THIRD only (centred on its middle), Lilita One with a thick black outline.
export function headlineLayerV2(img: Image, text: string, font: Uint8Array): OverlayLayer {
  const W = img.width, H = img.height;
  const t = String(text ?? "").trim().toUpperCase();
  const measure = (s: number) => { const g = Image.renderText(font, s, t, 0xffffffff); const r = Math.max(3, Math.ceil(s * HEADLINE_V2.outlineRatio)); return { w: g.width + 2 * r, h: g.height + 2 * r, r }; };
  let s = Math.round(H * 0.3);
  for (let i = 0; i < 14; i++) {
    const m = measure(s);
    const k = Math.min((W * HEADLINE_V2.widthRatio) / m.w, (H * HEADLINE_V2.maxHeightRatio) / m.h);
    if (Math.abs(k - 1) < 0.02) break;
    s = Math.max(24, Math.floor(s * k));
  }
  const m = measure(s);
  const box = { x: Math.round((W - m.w) / 2), y: Math.max(0, Math.round(H / 6 - m.h / 2)), width: m.w, height: m.h };
  const fill = isYellowish(img, box.x, box.y, box.width, box.height) ? HEADLINE_V2.white : HEADLINE_V2.yellow;
  return { type: "text", style: "HEADLINE", text: t, font: "Lilita One", fill, outline: HEADLINE_V2.outline, outlineRadius: m.r, scale: s, box, band: "top", darkBand: false, edgeDensity: { top: edgeDensity(img, box.x, box.y, box.width, box.height), bottom: 0 } };
}
