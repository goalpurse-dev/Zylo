// deno-lint-ignore-file no-explicit-any
// stickman/editRender.ts — Phase 6d-1. The Edit document -> the render
// worker's EDL (STICKMAN_EDL_V2). The worker renders exactly this: one segment
// per clip (the picture + its camera move, frame-exact), the text and caption
// layers pre-drawn as transparent 1920x1080 PNGs with the frames they show on
// (drawn by the same code as the Scenes step's text), the quick fade, and the
// voice + music (ducked under the speech).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { drawLayer, type OverlayLayer } from "./textOverlay.ts";
import { withEnds, clipMotion, captionPhrases, mainText, speechSpans, transitionWindows, TRANSITIONS, CAPTION_Y, CAPTION_SCALE, TEXT_FILL } from "../../../../src/lib/stickmanEdit.js";

export const EDL_V2 = "STICKMAN_EDL_V2";
const OUTLINE = 0x000000ff;
const hexToInt = (h: string) => ((parseInt(h.slice(1), 16) << 8) | 0xff) >>> 0;
const frameOf = (ms: number, fps: number) => Math.round((ms * fps) / 1000);

// A text item (centre + size, 1920 space) -> the Scenes step's layer spec,
// with each line's box centred on its point (the preview draws it the same way).
export function layerFromItem(item: any, font: Uint8Array): OverlayLayer {
  const text = mainText(item);
  const g = Image.renderText(font, item.scale, text, 0xffffffff);
  const r = Math.max(3, Math.ceil(item.scale * 0.11));
  const w = g.width + 2 * r, h = g.height + 2 * r;
  const layer: any = {
    type: "text", style: item.style, text, font: "Lilita One", fill: TEXT_FILL[item.style] ?? "#FFD21F", outline: "#000000", outlineRadius: r, scale: item.scale,
    box: { x: Math.round(item.x - w / 2), y: Math.round(item.y - h / 2), width: w, height: h }, band: "free", darkBand: !!item.darkBand, edgeDensity: { top: 0, bottom: 0 },
  };
  if (item.label?.text) {
    const lg = Image.renderText(font, item.label.scale, item.label.text, 0xffffffff);
    const lr = Math.max(2, Math.ceil(item.label.scale * 0.11));
    layer.label = { text: item.label.text, fill: "#FFFFFF", scale: item.label.scale, outlineRadius: lr, box: { x: Math.round(item.x - (lg.width + 2 * lr) / 2), y: Math.round(item.label.y - (lg.height + 2 * lr) / 2), width: lg.width + 2 * lr, height: lg.height + 2 * lr } };
  }
  if (item.arrow) layer.arrow = { ...item.arrow };
  return layer as OverlayLayer;
}

function stamp(img: Image, font: Uint8Array, text: string, scale: number, cx: number, cy: number, color: number, r: number) {
  const fill = Image.renderText(font, scale, text, color);
  const dark = Image.renderText(font, scale, text, OUTLINE);
  const x = Math.round(cx - fill.width / 2), y = Math.round(cy - fill.height / 2);
  if (r > 0) for (let i = 0; i < 24; i++) { const a = (2 * Math.PI * i) / 24; img.composite(dark, x + Math.round(r * Math.cos(a)), y + Math.round(r * Math.sin(a))); }
  img.composite(fill, x, y);
  return fill.width;
}

// One caption state: the phrase, with word `active` highlighted (highlight style).
// k scales everything for a larger output (1440p = 4/3); cy is the caption's
// centre line in the canvas it's drawn on (a strip when drawn for the render).
export function drawCaption(img: Image, font: Uint8Array, words: string[], active: number, style: string, k = 1, cy = CAPTION_Y * k) {
  const s = Math.round(CAPTION_SCALE * k), cx = 960 * k;
  const parts = words.map((w) => Image.renderText(font, s, w.toUpperCase(), 0xffffffff));
  const space = Math.round(s * 0.26);
  const total = parts.reduce((a, p) => a + p.width, 0) + space * (parts.length - 1);
  if (style === "boxed") {
    const h = Math.round(s * 1.44), box = new Image(total + 56, h);
    box.fill(0x000000b8);
    img.composite(box, Math.round(cx - (total + 56) / 2), Math.round(cy - h / 2));
  }
  const r = Math.round((style === "boxed" ? 0 : style === "highlight" ? 7 : 4) * k);
  let x = cx - total / 2;
  words.forEach((w, j) => {
    const color = style === "highlight" && j === active ? hexToInt("#FFD21F") : 0xffffffff;
    const width = parts[j].width;
    stamp(img, font, w.toUpperCase(), s, x + width / 2, cy, color, r);
    x += width + space;
  });
}

export type RenderClip = { sceneId?: string | null; masterImage?: string | null; masterSize?: { width: number; height: number } | null; index: number; image: string; startMs: number; endMs: number; startFrame: number; endFrame: number; frames: number; motion: any; fadeInFrames: number; overlays: { key: string; fromFrame: number; toFrame: number }[] };
// A piece of the timeline the worker renders as one segment: a clip's own
// frames ("clip"), or a transition window ("xfade": clip a into clip b).
export type Piece = { kind: "clip" | "xfade"; a: number; b?: number; fromFrame: number; toFrame: number; frames: number; transition?: string; xfade?: string; blur?: boolean; veil?: { color: string; opacity: number } | null; overlays: { key: string; fromFrame: number; toFrame: number }[] };
export type EdlV2 = { voiceVolume?: number; overlayFiles?: Record<string, string>; version: string; fps: number; width: number; height: number; audio: { url: string; durationMs: number }; totalFrames: number; pieces: Piece[]; music: { url: string; volume: number; duck: boolean; spans: [number, number][] } | null; clips: RenderClip[]; overlays: Record<string, { kind: "text" | "caption"; ref: any }> };

// The doc -> EDL v2 (pure: which overlay shows on which frames of which clip).
// Overlay PNGs are named by key; drawOverlay(key) draws one on demand.
export function compileEdit(doc: any, words: any[]): EdlV2 {
  const fps = doc.fps ?? 30;
  const clips = withEnds(doc);
  const totalFrames = frameOf(doc.audio.durationMs, fps);
  const overlays: EdlV2["overlays"] = {};
  const shows: { key: string; startMs: number; endMs: number }[] = [];
  for (const t of doc.texts ?? []) { overlays[`text-${t.id}`] = { kind: "text", ref: t }; shows.push({ key: `text-${t.id}`, startMs: t.startMs, endMs: t.endMs }); }
  if (doc.captions?.enabled) {
    captionPhrases(words, doc.captions.edits ?? {}).forEach((p: any, k: number) => {
      const texts = p.words.map((w: any) => String(w.text));
      if (doc.captions.style === "highlight") p.words.forEach((w: any, j: number) => {
        const key = `cap-${k}-${j}`;
        overlays[key] = { kind: "caption", ref: { words: texts, active: j, style: "highlight" } };
        shows.push({ key, startMs: j === 0 ? p.startMs : w.startMs, endMs: j + 1 < p.words.length ? p.words[j + 1].startMs : p.endMs });
      });
      else { const key = `cap-${k}`; overlays[key] = { kind: "caption", ref: { words: texts, active: -1, style: doc.captions.style } }; shows.push({ key, startMs: p.startMs, endMs: p.endMs }); }
    });
  }
  const out: RenderClip[] = clips.map((c: any, i: number) => {
    const startFrame = frameOf(c.startMs, fps), endFrame = i + 1 < clips.length ? frameOf(clips[i + 1].startMs, fps) : totalFrames;
    const ov = shows.map((s) => ({ key: s.key, fromFrame: Math.max(startFrame, frameOf(s.startMs, fps)) - startFrame, toFrame: Math.min(endFrame, frameOf(s.endMs, fps)) - startFrame })).filter((o) => o.toFrame > o.fromFrame);
    return { index: i, image: c.image, startMs: c.startMs, endMs: c.endMs, startFrame, endFrame, frames: endFrame - startFrame, motion: clipMotion(doc, c), fadeInFrames: 0, overlays: ov, sceneId: c.sceneId ?? null, masterImage: null, masterSize: null };
  });
  // Pieces: each clip's own frames, minus the transition windows around its
  // cuts; each window is its own piece (xfade of the two pictures). Their
  // frames add up to the audio exactly — transitions never move the voice.
  const windows = transitionWindows(doc, clips, fps);
  const pieceOverlays = (from: number, to: number) => shows.map((s) => ({ key: s.key, fromFrame: Math.max(from, frameOf(s.startMs, fps)) - from, toFrame: Math.min(to, frameOf(s.endMs, fps)) - from })).filter((o) => o.toFrame > o.fromFrame);
  const pieces: Piece[] = [];
  out.forEach((c, i) => {
    const inW = windows.find((w: any) => w.index === i), outW = windows.find((w: any) => w.index === i + 1);
    if (inW) pieces.push({ kind: "xfade", a: i - 1, b: i, fromFrame: inW.startFrame, toFrame: inW.endFrame, frames: inW.frames, transition: inW.kind, xfade: TRANSITIONS[inW.kind].xfade, blur: !!TRANSITIONS[inW.kind].blur, veil: (TRANSITIONS as any)[inW.kind].veil ?? null, overlays: pieceOverlays(inW.startFrame, inW.endFrame) });
    const from = inW ? inW.endFrame : c.startFrame, to = outW ? outW.startFrame : c.endFrame;
    if (to > from) pieces.push({ kind: "clip", a: i, fromFrame: from, toFrame: to, frames: to - from, overlays: pieceOverlays(from, to) });
  });
  return {
    version: EDL_V2, fps, width: 1920, height: 1080, audio: { url: doc.audio.url, durationMs: doc.audio.durationMs }, voiceVolume: Math.max(0, Math.min(2, Number(doc.audio.volume ?? 1))), totalFrames, clips: out, pieces, overlays,
    music: doc.music?.url ? { url: doc.music.url, volume: Number(doc.music.volume ?? 0.35), duck: doc.music.duck !== false, spans: speechSpans(words) as [number, number][] } : null,
  };
}

export async function drawOverlayPng(edl: EdlV2, key: string, font: Uint8Array): Promise<Uint8Array> {
  const o = edl.overlays[key];
  const img = new Image(1920, 1080);
  if (o.kind === "text") drawLayer(img, layerFromItem(o.ref, font), font);
  else drawCaption(img, font, o.ref.words, o.ref.active, o.ref.style);
  return await img.encode();
}

// For the render: each overlay as a SMALL PNG + its position in the output
// frame (width x height), so thousands of caption states stay cheap. Texts are
// drawn full-frame at the output size and cropped to what they cover; captions
// are drawn straight onto a strip around their line.
export async function drawOverlayPiece(edl: EdlV2, key: string, font: Uint8Array): Promise<{ png: Uint8Array; x: number; y: number }> {
  const o = edl.overlays[key];
  const W = edl.width ?? 1920, H = edl.height ?? 1080, k = W / 1920;
  if (o.kind === "caption") {
    const band = Math.round(CAPTION_SCALE * k * 2.2);
    const strip = new Image(W, band);
    drawCaption(strip, font, o.ref.words, o.ref.active, o.ref.style, k, band / 2);
    const y = Math.round(CAPTION_Y * k - band / 2);
    const [x0, x1] = opaqueSpan(strip);
    if (x1 <= x0) return { png: await new Image(2, 2).encode(), x: 0, y: 0 };
    return { png: await strip.crop(x0, 0, x1 - x0, band).encode(), x: x0, y };
  }
  const img = new Image(W, H);
  drawLayer(img, scaleLayerBy(layerFromItem(o.ref, font), k), font);
  const [x0, x1] = opaqueSpan(img), [y0, y1] = opaqueSpan(img, true);
  if (x1 <= x0 || y1 <= y0) return { png: await new Image(2, 2).encode(), x: 0, y: 0 };
  return { png: await img.crop(x0, y0, x1 - x0, y1 - y0).encode(), x: x0, y: y0 };
}
// The first/last column (or row) with any visible pixel (sampled every 2 px, padded).
function opaqueSpan(img: Image, rows = false): [number, number] {
  const n = rows ? img.height : img.width, m = rows ? img.width : img.height;
  const has = (i: number) => { for (let j = 1; j <= m; j += 2) { const px = rows ? img.getPixelAt(j, i + 1) : img.getPixelAt(i + 1, j); if ((px & 0xff) > 0) return true; } return false; };
  let a = 0; while (a < n && !has(a)) a += 2;
  let b = n - 1; while (b > a && !has(b)) b -= 2;
  return [Math.max(0, a - 4), Math.min(n, b + 5)];
}
function scaleLayerBy(layer: any, k: number) {
  if (k === 1) return layer;
  const r = (v: number) => Math.round(v * k);
  const box = (b: any) => ({ x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) });
  return { ...layer, scale: r(layer.scale), outlineRadius: Math.max(1, r(layer.outlineRadius)), box: box(layer.box), ...(layer.label ? { label: { ...layer.label, scale: r(layer.label.scale), outlineRadius: Math.max(1, r(layer.label.outlineRadius)), box: box(layer.label.box) } } : {}), ...(layer.arrow ? { arrow: { x1: r(layer.arrow.x1), y1: r(layer.arrow.y1), x2: r(layer.arrow.x2), y2: r(layer.arrow.y2), width: Math.max(2, r(layer.arrow.width)) } } : {}) };
}

// The music's gain over time as an FFmpeg volume expression (the preview's musicGainAt).
export function musicVolumeExpr(m: NonNullable<EdlV2["music"]>, offsetMs = 0): string {
  const v = Math.max(0, Math.min(1, m.volume));
  if (!m.duck || !m.spans.length) return `${v}`;
  const inSpeech = m.spans.map(([a, b]) => `between(t,${((a - offsetMs) / 1000).toFixed(3)},${((b - offsetMs) / 1000).toFixed(3)})`).join("+");
  return `if(gt(${inSpeech},0),${(v * 0.28).toFixed(4)},${v})`;
}
