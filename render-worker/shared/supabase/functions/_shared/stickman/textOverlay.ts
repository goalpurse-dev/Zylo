// deno-lint-ignore-file no-explicit-any
// stickman/textOverlay.ts — programmatic on-screen text (Phase 4b).
//
// Draws a beat's SHORT_TEXT onto the final 1920x1080 scene image: heavy bold
// rounded all-caps (Lilita One, SIL Open Font License, bundled in
// _shared/fonts), yellow fill, thick black outline, centered in the top
// third, auto-sized to at most 80% of the frame width. Deterministic: the
// same image + text always gives the same pixels (golden-image tested).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { findFaces } from "./faceFinder.ts";

export const OVERLAY_STYLE = {
  fontFile: "../fonts/LilitaOne-Regular.ttf",
  fill: 0xffd21fff, // warm yellow
  outline: 0x000000ff,
  maxWidthRatio: 0.8,
  maxHeightRatio: 0.2, // of the frame height, so text always fits the top third
  startScale: 190,
  minScale: 48,
  centerYRatio: 1 / 6, // middle of the top third
  outlineRatio: 0.11, // outline radius as a share of the font scale
  bottomPreference: 0.6, // move to the bottom band only when it is this much calmer than the top
  busyEdgeDensity: 14, // mean luma gradient above which a dark band goes behind the text
  darkBand: 0x0000008c, // black at ~55% opacity
};

let fontCache: Uint8Array | null = null;
export async function loadOverlayFont(): Promise<Uint8Array> {
  if (!fontCache) fontCache = await Deno.readFile(new URL(OVERLAY_STYLE.fontFile, import.meta.url));
  return fontCache;
}

function renderLine(font: Uint8Array, scale: number, text: string, color: number): Image {
  return Image.renderText(font, scale, text, color);
}

// Largest scale (from startScale down) whose text fits 80% width and 20% height.
export function fitScale(measure: (scale: number) => { width: number; height: number }, frameW: number, frameH: number): number {
  let scale = OVERLAY_STYLE.startScale;
  for (let i = 0; i < 12; i++) {
    const m = measure(scale);
    const pad = 2 * Math.ceil(scale * OVERLAY_STYLE.outlineRatio);
    const k = Math.min(1, (frameW * OVERLAY_STYLE.maxWidthRatio) / (m.width + pad), (frameH * OVERLAY_STYLE.maxHeightRatio) / (m.height + pad));
    if (k >= 0.999) return scale;
    scale = Math.max(OVERLAY_STYLE.minScale, Math.floor(scale * k * 0.98));
    if (scale === OVERLAY_STYLE.minScale) return scale;
  }
  return scale;
}

// The overlay as an editable layer: everything needed to re-draw or edit the
// text later (the base image is stored without it).
// Text upgrade: four styles, one brand look (Lilita One, thick black outline):
//   HEADLINE — yellow (the original); QUESTION — white;
//   BIG_STAT — an extra-large yellow number + a small white label under it;
//   CALLOUT  — a short yellow label with an arrow to the key object.
export type TextStyle = "HEADLINE" | "BIG_STAT" | "QUESTION" | "CALLOUT";
type Box = { x: number; y: number; width: number; height: number };
export type OverlayLayer = {
  type: "text";
  style?: TextStyle; // absent = HEADLINE (layers saved before the upgrade)
  text: string;
  font: "Lilita One";
  fill: string;
  outline: string;
  outlineRadius: number;
  scale: number;
  box: Box;
  band: "top" | "bottom" | "free";
  darkBand: boolean;
  edgeDensity: { top: number; bottom: number };
  // BIG_STAT: the small label under the number.
  label?: { text: string; fill: string; scale: number; outlineRadius: number; box: Box };
  // CALLOUT: the arrow from the label to the key object (tip at x2,y2).
  arrow?: { x1: number; y1: number; x2: number; y2: number; width: number };
};
export type OverlayResult = { bytes: Uint8Array; box: Box; scale: number; text: string; layer: OverlayLayer; blocked?: boolean; frame: { width: number; height: number } };
export type OverlayOpts = {
  quality?: number;
  font?: Uint8Array;
  style?: TextStyle;
  // In image pixels: faces to keep clear, and the CALLOUT's key object.
  avoid?: Box[];
  target?: Box | null;
  // The same as 0..1 fractions [x0, y0, x1, y1] (from placementLook).
  avoidFrac?: number[][];
  targetFrac?: number[] | null;
  findFaces?: boolean; // default on
};
export const STYLE_FILL: Record<TextStyle, number> = { HEADLINE: 0xffd21fff, BIG_STAT: 0xffd21fff, QUESTION: 0xffffffff, CALLOUT: 0xffd21fff };
const LABEL_FILL = 0xffffffff;
// The style the words call for when nobody said (a typed edit): see headlines.textStyleOf.
export function autoStyle(text: string): TextStyle {
  const t = String(text ?? "").trim();
  if (/^[~≈]?\d[\d.,]*%?(\s|$)/.test(t) && t.split(/\s+/).length <= 3) return "BIG_STAT";
  if (/\?$/.test(t)) return "QUESTION";
  return "HEADLINE";
}
// "300,000 YEARS" -> ["300,000", "YEARS"]; "27%" -> ["27%", ""].
export function splitStat(text: string): [string, string] {
  const m = String(text ?? "").trim().match(/^([~≈]?\d[\d.,]*%?)\s*(.*)$/);
  return m ? [m[1], m[2].trim()] : [String(text ?? ""), ""];
}
const overlaps = (a: Box, b: Box, pad = 0) => a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;

// Mean luminance gradient inside a rectangle (sampled every 4 px): how busy
// the picture is where the text would sit.
export function edgeDensity(img: Image, x: number, y: number, w: number, h: number): number {
  const x0 = Math.max(1, x), y0 = Math.max(1, y), x1 = Math.min(img.width - 1, x + w), y1 = Math.min(img.height - 1, y + h);
  const luma = (px: number, py: number) => { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(px, py)); return 0.299 * r + 0.587 * g + 0.114 * b; };
  let sum = 0, n = 0;
  for (let py = y0; py < y1 - 4; py += 4) for (let px = x0; px < x1 - 4; px += 4) {
    const l = luma(px, py);
    sum += Math.abs(l - luma(px + 4, py)) + Math.abs(l - luma(px, py + 4));
    n += 2;
  }
  return n ? Number((sum / n).toFixed(2)) : 0;
}

const hex = (c: number) => `#${(c >>> 8).toString(16).padStart(6, "0").toUpperCase()}`;

// Largest scale that fits a max width/height (the general form of fitScale).
function fitTo(font: Uint8Array, text: string, maxW: number, maxH: number, start: number, min = OVERLAY_STYLE.minScale): number {
  let scale = start;
  for (let i = 0; i < 12; i++) {
    const t = renderLine(font, scale, text, OVERLAY_STYLE.fill);
    const pad = 2 * Math.ceil(scale * OVERLAY_STYLE.outlineRatio);
    const k = Math.min(1, maxW / (t.width + pad), maxH / (t.height + pad));
    if (k >= 0.999) return scale;
    scale = Math.max(min, Math.floor(scale * k * 0.98));
    if (scale === min) return scale;
  }
  return scale;
}

// A text block (one line, or BIG_STAT's number + label) measured at a size factor.
function measureBlock(font: Uint8Array, style: TextStyle, text: string, baseScale: number, labelBase: number, f: number) {
  const s = Math.max(OVERLAY_STYLE.minScale, Math.round(baseScale * f));
  const main = renderLine(font, s, style === "BIG_STAT" ? splitStat(text)[0] : text, OVERLAY_STYLE.fill);
  const r = Math.max(3, Math.ceil(s * OVERLAY_STYLE.outlineRatio));
  const mw = main.width + 2 * r, mh = main.height + 2 * r;
  const labelText = style === "BIG_STAT" ? splitStat(text)[1] : "";
  if (!labelText) return { s, r, mw, mh, w: mw, h: mh, label: null };
  const ls = Math.max(24, Math.round(labelBase * f));
  const lt = renderLine(font, ls, labelText, OVERLAY_STYLE.fill);
  const lr = Math.max(2, Math.ceil(ls * OVERLAY_STYLE.outlineRatio));
  const lw = lt.width + 2 * lr, lh = lt.height + 2 * lr;
  return { s, r, mw, mh, w: Math.max(mw, lw), h: mh + lh, label: { text: labelText, s: ls, r: lr, w: lw, h: lh } };
}

// Composites the text onto a JPEG/PNG and returns a JPEG plus the layer spec.
// Placement: the top band (middle of the top third) unless the bottom band is
// clearly calmer; if the chosen band is still busy, a translucent dark band
// goes behind the text so it always reads. With faces given (`avoid`), the
// text never covers one: it tries the other band, then a corner, then a
// smaller size; `blocked` says no clear spot existed (the caller skips it).
export async function overlayText(imageBytes: Uint8Array, rawText: string, opts: OverlayOpts = {}): Promise<OverlayResult> {
  const font = opts.font ?? (await loadOverlayFont());
  const text = String(rawText ?? "").trim().toUpperCase();
  const base = await Image.decode(imageBytes);
  const W = base.width, H = base.height;
  const fromFrac = (b: number[]): Box => ({ x: Math.round(b[0] * W), y: Math.round(b[1] * H), width: Math.round((b[2] - b[0]) * W), height: Math.round((b[3] - b[1]) * H) });
  // Faces are always kept clear: the free code finder (stickman heads) plus any given boxes.
  const avoid = [...(opts.avoid ?? []), ...(opts.avoidFrac ?? []).map(fromFrac), ...(opts.findFaces === false ? [] : findFaces(base))];
  const target = opts.target ?? (opts.targetFrac ? fromFrac(opts.targetFrac) : null);
  const facePad = Math.round(W * 0.015);
  let style: TextStyle = opts.style ?? autoStyle(text);
  if (style === "BIG_STAT" && !/^[~≈]?\d/.test(text)) style = "HEADLINE";

  // CALLOUT: a short label near the key object, with an arrow to it.
  if (style === "CALLOUT") {
    const c = target ? placeCallout(base, font, text, target, avoid, facePad) : null;
    if (c) { drawLayer(base, c, font); return { bytes: await base.encodeJPEG(opts.quality ?? 92), box: c.box, scale: c.scale, text, layer: c, frame: { width: W, height: H } }; }
    style = "HEADLINE"; // not sure where the object is: a plain headline instead
  }

  const baseScale = style === "BIG_STAT"
    ? fitTo(font, splitStat(text)[0], W * 0.6, H * 0.3, 330)
    : fitScale((s) => { const t = renderLine(font, s, text, OVERLAY_STYLE.fill); return { width: t.width, height: t.height }; }, W, H);
  const labelBase = Math.round(baseScale * 0.4);
  const margin = Math.round(W * 0.04);
  let chosen: { f: number; x: number; y: number; band: "top" | "bottom"; m: ReturnType<typeof measureBlock> } | null = null;
  let first: typeof chosen = null;
  let dTop = 0, dBottom = 0;
  for (const f of [1, 0.8, 0.65, 0.5]) {
    const m = measureBlock(font, style, text, baseScale, labelBase, f);
    const xc = Math.round((W - m.w) / 2);
    const yTop = Math.max(0, Math.round(H * OVERLAY_STYLE.centerYRatio - m.h / 2));
    const yBottom = Math.min(H - m.h, Math.round(H * (1 - OVERLAY_STYLE.centerYRatio) - m.h / 2));
    const dT = edgeDensity(base, xc, yTop, m.w, m.h), dB = edgeDensity(base, xc, yBottom, m.w, m.h);
    if (f === 1) { dTop = dT; dBottom = dB; }
    const centre: { x: number; y: number; band: "top" | "bottom" }[] = dB < dT * OVERLAY_STYLE.bottomPreference
      ? [{ x: xc, y: yBottom, band: "bottom" }, { x: xc, y: yTop, band: "top" }]
      : [{ x: xc, y: yTop, band: "top" }, { x: xc, y: yBottom, band: "bottom" }];
    const corners = [
      { x: margin, y: yTop, band: "top" as const }, { x: W - m.w - margin, y: yTop, band: "top" as const },
      { x: margin, y: yBottom, band: "bottom" as const }, { x: W - m.w - margin, y: yBottom, band: "bottom" as const },
    ].filter((p) => p.x >= 0).sort((a, b) => edgeDensity(base, a.x, a.y, m.w, m.h) - edgeDensity(base, b.x, b.y, m.w, m.h));
    for (const p of [...centre, ...corners]) {
      const cand = { f, ...p, m };
      first ??= cand;
      if (!avoid.some((a) => overlaps({ x: p.x, y: p.y, width: m.w, height: m.h }, a, facePad))) { chosen = cand; break; }
    }
    if (chosen) break;
  }
  const blocked = !chosen;
  const pick = chosen ?? first!;
  const { m } = pick;
  const fill = STYLE_FILL[style];
  const mainBox = { x: pick.x + Math.round((m.w - m.mw) / 2), y: pick.y, width: m.mw, height: m.mh };
  const darkBand = edgeDensity(base, pick.x, pick.y, m.w, m.h) > OVERLAY_STYLE.busyEdgeDensity;
  const layer: OverlayLayer = {
    type: "text", style, text: style === "BIG_STAT" ? splitStat(text)[0] : text, font: "Lilita One", fill: hex(fill), outline: hex(OVERLAY_STYLE.outline),
    outlineRadius: m.r, scale: m.s, box: mainBox, band: pick.band, darkBand, edgeDensity: { top: dTop, bottom: dBottom },
    ...(m.label ? { label: { text: m.label.text, fill: hex(LABEL_FILL), scale: m.label.s, outlineRadius: m.label.r, box: { x: pick.x + Math.round((m.w - m.label.w) / 2), y: pick.y + m.mh, width: m.label.w, height: m.label.h } } } : {}),
  };
  drawLayer(base, layer, font);
  return { bytes: await base.encodeJPEG(opts.quality ?? 92), box: mainBox, scale: m.s, text, layer, blocked, frame: { width: W, height: H } };
}

// CALLOUT placement: the label sits off the object (8 directions, the calmest
// clear spot inside the frame), never on a face or on the object itself; the
// arrow runs from the label's edge to just inside the object's box.
function placeCallout(base: Image, font: Uint8Array, text: string, target: Box, avoid: Box[], facePad: number): OverlayLayer | null {
  const W = base.width, H = base.height;
  const s = fitTo(font, text, W * 0.34, H * 0.12, Math.round(H * 0.085), 28);
  const g = renderLine(font, s, text, OVERLAY_STYLE.fill);
  const r = Math.max(3, Math.ceil(s * OVERLAY_STYLE.outlineRatio));
  const w = g.width + 2 * r, h = g.height + 2 * r;
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const margin = Math.round(W * 0.03);
  const spots: { box: Box; d: number }[] = [];
  for (const dist of [0.2, 0.28]) for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 4; // start up-right
    const cx = tc.x + Math.cos(a) * (target.width / 2 + W * dist), cy = tc.y + Math.sin(a) * (target.height / 2 + H * dist);
    const box = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h };
    if (box.x < margin || box.y < margin || box.x + w > W - margin || box.y + h > H - margin) continue;
    if (overlaps(box, target, Math.round(W * 0.02)) || avoid.some((f) => overlaps(box, f, facePad))) continue;
    spots.push({ box, d: edgeDensity(base, box.x, box.y, w, h) });
  }
  if (!spots.length) return null;
  const { box } = spots.sort((a, b) => a.d - b.d)[0];
  const lc = { x: box.x + w / 2, y: box.y + h / 2 };
  // Where the centre-to-centre line leaves a box (scaled by k around its centre).
  const exit = (b: Box, from: { x: number; y: number }, to: { x: number; y: number }, k: number) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const t = Math.min(Math.abs((b.width * k) / 2 / (dx || 1e-6)), Math.abs((b.height * k) / 2 / (dy || 1e-6)));
    return { x: Math.round(from.x + dx * t), y: Math.round(from.y + dy * t) };
  };
  const start = exit(box, lc, tc, 1.15);
  const tip = exit(target, tc, lc, 0.7);
  // Unsure = skip (a HEADLINE instead): a stub arrow, or an "object" that is a speck or half the frame.
  const share = (target.width * target.height) / (W * H);
  if (Math.hypot(tip.x - start.x, tip.y - start.y) < W * 0.07 || share < 0.004 || share > 0.3) return null;
  const width = Math.max(4, Math.round(H * 0.009));
  return {
    type: "text", style: "CALLOUT", text, font: "Lilita One", fill: hex(STYLE_FILL.CALLOUT), outline: hex(OVERLAY_STYLE.outline),
    outlineRadius: r, scale: s, box, band: "free", darkBand: false, edgeDensity: { top: 0, bottom: 0 },
    arrow: { x1: start.x, y1: start.y, x2: tip.x, y2: tip.y, width },
  };
}

// The arrow as strokes: the shaft plus two head strokes at the tip.
export function arrowStrokes(a: NonNullable<OverlayLayer["arrow"]>): [number, number, number, number][] {
  const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const L = a.width * 4.5;
  const head = (d: number) => [a.x2, a.y2, Math.round(a.x2 - L * Math.cos(ang + d)), Math.round(a.y2 - L * Math.sin(ang + d))] as [number, number, number, number];
  return [[a.x1, a.y1, a.x2, a.y2], head(0.5), head(-0.5)];
}
function stroke(img: Image, [x1, y1, x2, y2]: [number, number, number, number], radius: number, color: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.ceil(len / Math.max(1, radius / 2)));
  for (let i = 0; i <= n; i++) img.drawCircle(Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y1 + ((y2 - y1) * i) / n), radius, color);
}

function drawText(img: Image, font: Uint8Array, text: string, scale: number, r: number, box: Box, fillColor: number) {
  const fill = renderLine(font, scale, text, fillColor);
  const dark = renderLine(font, scale, text, OVERLAY_STYLE.outline);
  const { x, y } = box;
  // Thick outline: the black glyphs stamped around a circle of radius r.
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    img.composite(dark, x + r + Math.round(r * Math.cos(a)), y + r + Math.round(r * Math.sin(a)));
  }
  img.composite(dark, x + r, y + r);
  img.composite(fill, x + r, y + r);
}
const parseHex = (s: string | undefined, dflt: number) => (s && /^#[0-9A-F]{6}$/i.test(s) ? ((parseInt(s.slice(1), 16) << 8) | 0xff) >>> 0 : dflt);

// Draws an editable text layer onto an image — the ONE drawing path for the
// preview (overlayText) and the video render (renderLayerPng), so they match.
export function drawLayer(img: Image, layer: OverlayLayer, font: Uint8Array, _glyphs?: unknown) {
  const { y, height: h } = layer.box;
  const r = layer.outlineRadius;
  if (layer.darkBand) {
    const pad = 2 * r;
    const bottom = layer.label ? layer.label.box.y + layer.label.box.height : y + h;
    const strip = new Image(img.width, Math.min(img.height, bottom - y + 2 * pad));
    strip.fill(OVERLAY_STYLE.darkBand);
    img.composite(strip, 0, Math.max(0, y - pad));
  }
  if (layer.arrow) {
    const strokes = arrowStrokes(layer.arrow);
    const rr = Math.max(2, Math.round(layer.arrow.width / 2));
    for (const s of strokes) stroke(img, s, rr + Math.max(2, Math.round(rr * 0.8)), OVERLAY_STYLE.outline);
    for (const s of strokes) stroke(img, s, rr, parseHex(layer.fill, OVERLAY_STYLE.fill));
  }
  drawText(img, font, layer.text, layer.scale, r, layer.box, parseHex(layer.fill, OVERLAY_STYLE.fill));
  if (layer.label) drawText(img, font, layer.label.text, layer.label.scale, layer.label.outlineRadius, layer.label.box, parseHex(layer.label.fill, LABEL_FILL));
}

// Phase 5c: the same layer for a larger frame (the 1440p master): every
// size and position scales, so the text is re-drawn sharp, not upscaled.
export function scaleLayer(layer: OverlayLayer, k: number): OverlayLayer {
  const r = (v: number) => Math.round(v * k);
  const box = (b: Box) => ({ x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) });
  return {
    ...layer, scale: r(layer.scale), outlineRadius: Math.max(1, r(layer.outlineRadius)), box: box(layer.box),
    ...(layer.label ? { label: { ...layer.label, scale: r(layer.label.scale), outlineRadius: Math.max(1, r(layer.label.outlineRadius)), box: box(layer.label.box) } } : {}),
    ...(layer.arrow ? { arrow: { x1: r(layer.arrow.x1), y1: r(layer.arrow.y1), x2: r(layer.arrow.x2), y2: r(layer.arrow.y2), width: Math.max(2, r(layer.arrow.width)) } } : {}),
  };
}

// Phase 5a: the layer alone on a transparent frame (PNG), burned in over the
// moving image at render time so the text itself never zooms or pans.
export async function renderLayerPng(layer: OverlayLayer, width = 1920, height = 1080, font?: Uint8Array): Promise<Uint8Array> {
  const img = new Image(width, height);
  drawLayer(img, layer, font ?? (await loadOverlayFont()));
  return await img.encode();
}
