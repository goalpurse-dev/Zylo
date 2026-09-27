// deno-lint-ignore-file no-explicit-any
// Programmatic scene compositor (Part 15/37) — BIG TEXT, labels and basic
// geometric callouts are composited onto an already-generated base image
// AFTER generation, never trusted to the image model (Part 12/13). Deno
// Edge Runtime has no native canvas/Cairo (rules out node-canvas), so this
// works entirely on raw RGBA pixel buffers: decode with the pure-JS
// npm:pngjs (already proven working in this codebase's character-turnaround
// crop feature) or npm:jpeg-js (Runware/Kling outputs are typically JPEG —
// character-reference-sheet result_urls observed as .jpg on the real Mars
// project), composite in raw pixel space, always re-encode as PNG (a
// universal, lossless output every downstream consumer already displays
// via a plain <img>/video pipeline).
//
// V1 primitive set only (Part 37's "even if V1 supports only a small
// primitive set" scope): BIG_TEXT, LABEL, ARROW, X_MARK, CIRCLE, LINE,
// NUMBER (reuses the same bitmap font as text), color block, before/after
// DIVIDER. Text uses a small hand-built monospace bitmap font — deliberately
// simple and legible rather than a fully general typography engine; this is
// the pragmatic "editable/deterministic, small primitive set" scope the
// spec explicitly allows for V1.

import { PNG } from "npm:pngjs@7.0.0";
import jpeg from "npm:jpeg-js@0.4.4";
import { Buffer } from "node:buffer";

export type RawImage = { width: number; height: number; data: Uint8Array | Buffer };

export async function fetchAndDecodeImage(url: string): Promise<RawImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("SCENE_BASE_IMAGE_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 30_000_000) throw new Error("SCENE_BASE_IMAGE_EXCEEDS_COMPOSITE_MEMORY_LIMIT");
  return decodeImage(bytes, response.headers.get("content-type") ?? "");
}

export function decodeImage(bytes: Uint8Array, contentType: string): RawImage {
  const isPng = contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
  if (isPng) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, data: png.data };
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

export function encodePng(image: RawImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return PNG.sync.write(png);
}

// Nearest-neighbor resize — no external dependency, and more than adequate
// for a reference-board CONDITIONING image (SceneReferenceBundle): the
// board is transport/conditioning material for the provider's own vision
// model, never the final output a viewer sees, so photographic resampling
// quality doesn't matter the way it would for a shipped frame.
export function resizeImage(img: RawImage, targetWidth: number, targetHeight: number): RawImage {
  const data = new Uint8Array(targetWidth * targetHeight * 4);
  const out: RawImage = { width: targetWidth, height: targetHeight, data };
  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(img.height - 1, Math.floor((y * img.height) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(img.width - 1, Math.floor((x * img.width) / targetWidth));
      const si = (srcY * img.width + srcX) * 4;
      const di = (y * targetWidth + x) * 4;
      data[di] = img.data[si]; data[di + 1] = img.data[si + 1]; data[di + 2] = img.data[si + 2]; data[di + 3] = img.data[si + 3];
    }
  }
  return out;
}

// Pastes `src` into `dest` at (x, y), opaque (alpha=255) — clips silently at
// dest's bounds rather than throwing, since a bundle's fixed grid cells are
// always sized to fit exactly, but this keeps it safe against any future
// caller with a slightly mismatched size.
export function blitImage(dest: RawImage, src: RawImage, x: number, y: number) {
  for (let sy = 0; sy < src.height; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dest.height) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const dx = x + sx;
      if (dx < 0 || dx >= dest.width) continue;
      const si = (sy * src.width + sx) * 4;
      const di = (dy * dest.width + dx) * 4;
      dest.data[di] = src.data[si]; dest.data[di + 1] = src.data[si + 1]; dest.data[di + 2] = src.data[si + 2]; dest.data[di + 3] = 255;
    }
  }
}

/* ============================ Pixel primitives ============================ */
function setPixel(img: RawImage, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const srcA = a / 255;
  img.data[i] = Math.round(img.data[i] * (1 - srcA) + r * srcA);
  img.data[i + 1] = Math.round(img.data[i + 1] * (1 - srcA) + g * srcA);
  img.data[i + 2] = Math.round(img.data[i + 2] * (1 - srcA) + b * srcA);
  img.data[i + 3] = 255;
}

export function drawRect(img: RawImage, x: number, y: number, w: number, h: number, color: [number, number, number], alpha = 255) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(img, xx, yy, color[0], color[1], color[2], alpha);
}

// 2026-09-17 "long-form quality pass": Bresenham's own termination check
// (`x === x1 && y === y1`) requires INTEGER endpoints — `x`/`y` are stepped
// by exactly +/-1 each iteration starting from `x0`/`y0`, so a fractional
// x1/y1 (or fractional x0/y0 whose fractional part doesn't exactly match
// x1/y1's) can never be reached exactly, hanging the loop forever. Every
// caller in this codebase used to pass already-rounded integers by
// convention; the new vector stroke-text/icon renderers (graphicTemplates.ts)
// compute real (fractional) positions and hit this immediately (confirmed:
// a single fractional-coordinate drawXMark call hung indefinitely). Rounding
// here, once, makes drawLine — and everything built on it (drawXMark,
// drawArrow, drawCircleOutline's per-thickness radius, every glyph stroke)
// — safe for ANY caller, fractional or not, rather than relying on every
// call site to remember to round first.
export function drawLine(img: RawImage, x0: number, y0: number, x1: number, y1: number, color: [number, number, number], thickness = 3, alpha = 255) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  const half = Math.floor(thickness / 2);
  for (;;) {
    for (let ty = -half; ty <= half; ty++) for (let tx = -half; tx <= half; tx++) setPixel(img, x + tx, y + ty, color[0], color[1], color[2], alpha);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

export function drawCircleOutline(img: RawImage, cx: number, cy: number, radius: number, color: [number, number, number], thickness = 4, alpha = 255) {
  const steps = Math.max(64, radius * 2);
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    for (let t = 0; t < thickness; t++) {
      const r = radius - thickness / 2 + t;
      setPixel(img, Math.round(cx + r * Math.cos(theta)), Math.round(cy + r * Math.sin(theta)), color[0], color[1], color[2], alpha);
    }
  }
}

export function drawXMark(img: RawImage, cx: number, cy: number, size: number, color: [number, number, number], thickness = 6) {
  const half = size / 2;
  drawLine(img, cx - half, cy - half, cx + half, cy + half, color, thickness);
  drawLine(img, cx - half, cy + half, cx + half, cy - half, color, thickness);
}

export function drawArrow(img: RawImage, x0: number, y0: number, x1: number, y1: number, color: [number, number, number], thickness = 6) {
  drawLine(img, x0, y0, x1, y1, color, thickness);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = Math.max(16, thickness * 4);
  for (const da of [Math.PI * 0.8, -Math.PI * 0.8]) {
    drawLine(img, x1, y1, x1 + headLen * Math.cos(angle + da), y1 + headLen * Math.sin(angle + da), color, thickness);
  }
}

/* ============================ Minimal bitmap font (5x7, A-Z 0-9 space punctuation) ============================ */
// Deliberately small — legible uppercase-friendly glyphs only (textStyle
// casing:"upper" for BIG_TEXT is the primary path; sentence case for LABEL
// falls back to uppercase glyphs too, since a fully general font engine is
// explicitly out of scope for this V1 primitive set).
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"], "C": ["011", "100", "100", "100", "011"],
  "D": ["110", "101", "101", "101", "110"], "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
  "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"], "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "010"], "K": ["101", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"],
  "M": ["101", "111", "111", "101", "101"], "N": ["101", "111", "111", "111", "101"], "O": ["010", "101", "101", "101", "010"],
  "P": ["110", "101", "110", "100", "100"], "Q": ["010", "101", "101", "111", "011"], "R": ["110", "101", "110", "101", "101"],
  "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"], "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"], "W": ["101", "101", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
  " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"], ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"], "'": ["010", "010", "000", "000", "000"], "!": ["010", "010", "010", "000", "010"],
  "?": ["111", "001", "010", "000", "010"], ":": ["000", "010", "000", "010", "000"], "%": ["101", "001", "010", "100", "101"],
  "/": ["001", "001", "010", "100", "100"], "+": ["000", "010", "111", "010", "000"],
};
function glyphFor(ch: string): string[] { return GLYPHS[ch.toUpperCase()] ?? GLYPHS[" "]; }

// Renders text at `scale`x pixel size per glyph cell (5 wide x 7 tall
// including inter-glyph spacing at scale 1), left-to-right, with an
// optional outline/shadow pass for legibility over photographic content —
// the exact "outline/shadow" textStyle fields overlaySpec already declares.
export function measureText(text: string, scale: number): { width: number; height: number } {
  const cols = text.length * 4 - 1; // 3px glyph + 1px gap, minus trailing gap
  return { width: Math.max(0, cols * scale), height: 5 * scale };
}

export function drawText(img: RawImage, text: string, x: number, y: number, scale: number, color: [number, number, number], opts: { outline?: boolean; shadow?: boolean } = {}) {
  const drawGlyphs = (ox: number, oy: number, c: [number, number, number], alpha: number) => {
    let cursor = ox;
    for (const ch of text) {
      const rows = glyphFor(ch);
      for (let ry = 0; ry < rows.length; ry++) {
        for (let rx = 0; rx < rows[ry].length; rx++) {
          if (rows[ry][rx] === "1") drawRect(img, cursor + rx * scale, oy + ry * scale, scale, scale, c, alpha);
        }
      }
      cursor += 4 * scale;
    }
  };
  // 2026-09-16 "production invariants" pass (Section 11-13) — real Mars
  // incident: Chapter 4's graphic cards (shots ~53-56) rendered as an
  // illegible glitchy mess. Root cause found by decoding the actual
  // shipped file: this offset used to GROW with scale (scale/3, scale/4) —
  // at the large scale BIG_TEXT actually renders at (~80-90px per glyph
  // cell on a 2720px-wide card), that put the black outline/shadow copies
  // 20-30px away from the white glyph they're supposed to hug, which reads
  // as a smeared, multi-layered, chromatic-looking fringe rather than a
  // clean outline. A real outline must stay a small, ABSOLUTE number of
  // pixels regardless of how large the glyph itself is — capped here at 3px
  // (outline) / 5px (shadow) however big `scale` gets.
  const outlineOffset = Math.max(1, Math.min(3, Math.round(scale * 0.08)));
  const shadowOffset = Math.max(2, Math.min(5, Math.round(scale * 0.12)));
  if (opts.shadow) drawGlyphs(x + shadowOffset, y + shadowOffset, [0, 0, 0], 140);
  if (opts.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawGlyphs(x + dx * outlineOffset, y + dy * outlineOffset, [0, 0, 0], 220);
  }
  drawGlyphs(x, y, color, 255);
}

/* ============================ Supersampled canvas (real anti-aliasing) ============================
 * 2026-09-17 "long-form quality pass" (Part 2) — the previous graphic
 * renderer's crude 3-wide bitmap glyphs, drawn hard-edged, are exactly what
 * produced the "giant pixel-text card" complaint. Rather than a bigger
 * pixel grid (still forbidden — "NO 5x7 enlarged pixel font"), everything
 * the new graphic templates draw (vector stroke text AND icons) is drawn
 * hard-edged onto a canvas rendered at `factor`x the real target
 * resolution, then averaged back down ONE time — a standard supersample
 * anti-aliasing (SSAA) technique that turns every hard edge (a line, an
 * arc, a glyph stroke) into a genuinely smooth, anti-aliased edge with no
 * per-primitive AA math needed anywhere else in this file.
 */
export function createSupersampledCanvas(width: number, height: number, factor: number): RawImage {
  return { width: width * factor, height: height * factor, data: new Uint8Array(width * factor * height * factor * 4) };
}
export function downsampleBox(img: RawImage, factor: number): RawImage {
  if (factor <= 1) return img;
  const w = Math.floor(img.width / factor), h = Math.floor(img.height / factor);
  const data = new Uint8Array(w * h * 4);
  const srcData = img.data as Uint8Array;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy++) {
        const rowStart = ((y * factor + sy) * img.width + x * factor) * 4;
        for (let sx = 0; sx < factor; sx++) {
          const si = rowStart + sx * 4;
          r += srcData[si]; g += srcData[si + 1]; b += srcData[si + 2]; a += srcData[si + 3];
        }
      }
      const count = factor * factor;
      const di = (y * w + x) * 4;
      data[di] = Math.round(r / count); data[di + 1] = Math.round(g / count); data[di + 2] = Math.round(b / count); data[di + 3] = Math.round(a / count);
    }
  }
  return { width: w, height: h, data };
}

/* ============================ Vector stroke font (real, scalable, no pixel grid) ============================
 * Each glyph is a set of STROKES (polylines) on a normalized [0,1] wide x
 * [0,1] tall design grid (baseline at y=1, cap-height at y=0) — drawn with
 * real line segments (drawLine, arbitrary angle/position), never a fixed
 * pixel/bitmap grid, so it stays crisp and proportioned at any size and
 * anti-aliases cleanly through the supersample-canvas above. Curved
 * letters use `arc()` to generate a smooth run of short segments along a
 * real ellipse rather than being hand-placed point by point.
 */
type Stroke = [number, number][];
function arc(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, steps = 10): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= steps; i++) {
    const t = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (t * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return pts;
}
// width = this glyph's natural advance width in the same [0,1]-per-cap-
// height units as the strokes themselves (most letters ~0.62-0.8; I/1/. are
// narrow; M/W are wide) — real proportional spacing, not a fixed grid cell.
type GlyphDef = { width: number; strokes: Stroke[] };
const G = (width: number, ...strokes: Stroke[]): GlyphDef => ({ width, strokes });
const STROKE_GLYPHS: Record<string, GlyphDef> = {
  " ": G(0.5),
  A: G(0.72, [[0, 1], [0.36, 0], [0.72, 1]], [[0.14, 0.62], [0.58, 0.62]]),
  B: G(0.68, [[0, 0], [0, 1]], [[0, 0], [0.44, 0], ...arc(0.44, 0.25, 0.24, 0.25, -90, 90), [0, 0.5]], [[0, 0.5], [0.48, 0.5], ...arc(0.48, 0.75, 0.26, 0.25, -90, 90), [0, 1]]),
  C: G(0.62, [[0.58, 0.1], [0.3, 0], [0.06, 0.16], [0, 0.5], [0.06, 0.84], [0.3, 1], [0.58, 0.9]]),
  D: G(0.7, [[0, 0], [0, 1]], [[0, 0], [0.3, 0], ...arc(0.3, 0.5, 0.4, 0.5, -90, 90, 14), [0, 1]]),
  E: G(0.62, [[0.6, 0], [0, 0], [0, 1], [0.6, 1]], [[0, 0.5], [0.5, 0.5]]),
  F: G(0.6, [[0.6, 0], [0, 0], [0, 1]], [[0, 0.5], [0.5, 0.5]]),
  G: G(0.72, [[0.62, 0.1], [0.34, 0], [0.08, 0.18], [0, 0.5], [0.08, 0.82], [0.34, 1], [0.62, 0.9], [0.62, 0.55], [0.36, 0.55]]),
  H: G(0.72, [[0, 0], [0, 1]], [[0.72, 0], [0.72, 1]], [[0, 0.5], [0.72, 0.5]]),
  I: G(0.24, [[0.12, 0], [0.12, 1]]),
  J: G(0.5, [[0.4, 0], [0.4, 0.78]], arc(0.22, 0.78, 0.18, 0.2, 5, 175, 10)),
  K: G(0.68, [[0, 0], [0, 1]], [[0.62, 0], [0, 0.52]], [[0.14, 0.4], [0.62, 1]]),
  L: G(0.58, [[0, 0], [0, 1], [0.58, 1]]),
  M: G(0.84, [[0, 1], [0, 0], [0.42, 0.58], [0.84, 0], [0.84, 1]]),
  N: G(0.72, [[0, 1], [0, 0], [0.72, 1], [0.72, 0]]),
  O: G(0.74, arc(0.37, 0.5, 0.37, 0.5, 0, 360, 20)),
  P: G(0.62, [[0, 1], [0, 0]], [[0, 0], [0.4, 0], ...arc(0.4, 0.27, 0.22, 0.27, -90, 90, 12), [0, 0.54]]),
  Q: G(0.76, arc(0.38, 0.48, 0.36, 0.46, 0, 360, 20), [[0.34, 0.72], [0.78, 1.12]]),
  R: G(0.66, [[0, 1], [0, 0]], [[0, 0], [0.4, 0], ...arc(0.4, 0.27, 0.22, 0.27, -90, 90, 12), [0, 0.54]], [[0.2, 0.54], [0.66, 1]]),
  S: G(0.56, [[0.52, 0.08], [0.22, 0], [0.02, 0.12], [0.04, 0.28], [0.22, 0.36], [0.4, 0.42], [0.54, 0.5], [0.56, 0.68], [0.4, 0.84], [0.16, 0.92], [0, 0.8]]),
  T: G(0.64, [[0, 0], [0.64, 0]], [[0.32, 0], [0.32, 1]]),
  U: G(0.72, [[0, 0], [0, 0.62], ...arc(0.36, 0.62, 0.36, 0.38, 180, 0, 12), [0.72, 0.62], [0.72, 0]]),
  V: G(0.68, [[0, 0], [0.34, 1], [0.68, 0]]),
  W: G(0.94, [[0, 0], [0.24, 1], [0.47, 0.4], [0.7, 1], [0.94, 0]]),
  X: G(0.68, [[0, 0], [0.68, 1]], [[0, 1], [0.68, 0]]),
  Y: G(0.66, [[0, 0], [0.33, 0.55], [0.66, 0]], [[0.33, 0.55], [0.33, 1]]),
  Z: G(0.62, [[0, 0], [0.62, 0], [0, 1], [0.62, 1]]),
  0: G(0.68, arc(0.34, 0.5, 0.32, 0.5, 0, 360, 20), [[0.16, 0.78], [0.52, 0.22]]),
  1: G(0.42, [[0.08, 0.2], [0.28, 0], [0.28, 1]], [[0.06, 1], [0.5, 1]]),
  2: G(0.58, [[0.04, 0.22], [0.08, 0.06], [0.28, -0.02], [0.48, 0.04], [0.56, 0.2], [0.48, 0.36], [0, 0.86], [0, 1], [0.6, 1]]),
  3: G(0.58, [[0.04, 0.06], [0.3, -0.02], [0.52, 0.08], [0.52, 0.28], [0.3, 0.38], [0.14, 0.36]], [[0.3, 0.38], [0.56, 0.46], [0.58, 0.7], [0.4, 0.92], [0.12, 0.96], [0, 0.82]]),
  4: G(0.7, [[0.5, 1], [0.5, 0], [0, 0.68], [0.7, 0.68]]),
  5: G(0.58, [[0.5, 0], [0.02, 0], [0, 0.4], [0.3, 0.36], [0.5, 0.46], [0.56, 0.68], [0.42, 0.9], [0.14, 0.94], [0, 0.8]]),
  6: G(0.58, [[0.5, 0.04], [0.24, 0.14], [0.08, 0.42], [0.04, 0.68], [0.14, 0.9], [0.4, 0.96], [0.56, 0.8], [0.54, 0.58], [0.34, 0.44], [0.1, 0.5]]),
  7: G(0.62, [[0, 0], [0.62, 0], [0.2, 1]]),
  8: G(0.62, arc(0.31, 0.27, 0.26, 0.25, 0, 360, 16), arc(0.31, 0.73, 0.29, 0.27, 0, 360, 16)),
  9: G(0.58, [[0.1, 0.94], [0.34, 0.86], [0.5, 0.6], [0.54, 0.34], [0.44, 0.1], [0.2, 0.02], [0.04, 0.16], [0.04, 0.4], [0.24, 0.52], [0.48, 0.48]]),
  ".": G(0.28, [[0.1, 0.94], [0.18, 0.94]]),
  ",": G(0.28, [[0.16, 0.94], [0.08, 1.12]]),
  ":": G(0.24, [[0.1, 0.32], [0.14, 0.32]], [[0.1, 0.94], [0.14, 0.94]]),
  "-": G(0.4, [[0.04, 0.5], [0.36, 0.5]]),
  "+": G(0.5, [[0.05, 0.5], [0.45, 0.5]], [[0.25, 0.3], [0.25, 0.7]]),
  "/": G(0.45, [[0.05, 1], [0.4, 0]]),
  "%": G(0.72, arc(0.16, 0.18, 0.16, 0.18, 0, 360, 10), arc(0.56, 0.82, 0.16, 0.18, 0, 360, 10), [[0.06, 1], [0.66, 0]]),
  "°": G(0.4, arc(0.2, 0.16, 0.18, 0.16, 0, 360, 10)),
  "→": G(0.9, [[0.05, 0.5], [0.85, 0.5]], [[0.6, 0.26], [0.85, 0.5], [0.6, 0.74]]),
  "'": G(0.2, [[0.08, 0], [0.04, 0.22]]),
  "!": G(0.24, [[0.12, 0], [0.12, 0.68]], [[0.1, 0.92], [0.14, 0.92]]),
  "$": G(0.65, [[0.57, 0.16], [0.45, 0.04], [0.16, 0.04], [0.04, 0.23], [0.15, 0.43], [0.48, 0.56], [0.6, 0.75], [0.48, 0.96], [0.15, 0.96], [0.04, 0.84]], [[0.32, 0], [0.32, 1]]),
  "=": G(0.6, [[0.03, 0.35], [0.57, 0.35]], [[0.03, 0.65], [0.57, 0.65]]),
  "~": G(0.65, [[0.04, 0.55], [0.2, 0.4], [0.45, 0.6], [0.61, 0.45]]),
  "≈": G(0.65, [[0.04, 0.38], [0.2, 0.27], [0.45, 0.43], [0.61, 0.32]], [[0.04, 0.68], [0.2, 0.57], [0.45, 0.73], [0.61, 0.62]]),
  "μ": G(0.65, [[0.06, 0.3], [0.06, 1.2]], [[0.06, 0.78], [0.22, 0.95], [0.43, 0.95], [0.55, 0.78], [0.55, 0.3]], [[0.55, 0.78], [0.61, 0.97]]),
};
const glyphAlias = (ch: string): string => ({ "‑": "-", "–": "-", "—": "-", "−": "-", "’": "'", "‘": "'", "\u00a0": " ", "Μ": "μ" } as Record<string, string>)[ch] ?? ch;
export function supportsExactText(text: string): boolean {
  return [...text].every(ch => Boolean(STROKE_GLYPHS[glyphAlias(ch)] ?? STROKE_GLYPHS[ch.toUpperCase()]));
}
function glyphDefFor(ch: string): GlyphDef {
  return STROKE_GLYPHS[glyphAlias(ch)] ?? STROKE_GLYPHS[ch.toUpperCase()] ?? STROKE_GLYPHS[" "];
}
const GLYPH_GAP = 0.22; // extra horizontal space between glyphs, same [0,1]-per-cap-height units

export function measureStrokeText(text: string, capHeightPx: number): { width: number; height: number } {
  let width = 0;
  for (const ch of text) width += (glyphDefFor(ch).width + GLYPH_GAP) * capHeightPx;
  return { width: Math.max(0, width - GLYPH_GAP * capHeightPx), height: capHeightPx };
}

// Draws real, proportionally-spaced, anti-aliasable (via the supersampled
// canvas this is drawn onto) vector text — never a fixed bitmap grid.
// `thickness` is the stroke width in the SAME pixel space `img` is drawn in
// (pass a supersampled thickness when drawing onto a supersampled canvas).
export function drawStrokeText(img: RawImage, text: string, x: number, y: number, capHeightPx: number, thickness: number, color: [number, number, number], opts: { outline?: boolean; outlineColor?: [number, number, number] } = {}) {
  const drawPass = (ox: number, oy: number, c: [number, number, number], t: number) => {
    let cursor = ox;
    for (const ch of text) {
      const def = glyphDefFor(ch);
      for (const stroke of def.strokes) {
        for (let i = 0; i < stroke.length - 1; i++) {
          const [x0, y0] = stroke[i], [x1, y1] = stroke[i + 1];
          drawLine(img, Math.round(cursor + x0 * capHeightPx), Math.round(oy + y0 * capHeightPx), Math.round(cursor + x1 * capHeightPx), Math.round(oy + y1 * capHeightPx), c, t, 255);
        }
      }
      cursor += (def.width + GLYPH_GAP) * capHeightPx;
    }
  };
  const strokeWidth = Math.max(1, Math.round(thickness));
  if (opts.outline) {
    const haloWidth = strokeWidth + Math.max(2, Math.round(capHeightPx * 0.09));
    drawPass(x, y, opts.outlineColor ?? [0, 0, 0], haloWidth);
  }
  drawPass(x, y, color, strokeWidth);
}

/* ============================ Vector icon library (Part 2) ============================
 * Small, purpose-built line icons for the educational graphic templates —
 * drawn with the SAME primitives as everything else (drawLine/
 * drawCircleOutline/drawRect), inside a normalized [0,1]x[0,1] box the
 * caller positions/scales, so every icon anti-aliases through the same
 * supersample-canvas pipeline as the text. A small, curated set (not all
 * 22 visual forms need a bespoke icon) — `iconFor` falls back to a plain
 * circle-badge for any name not in this table rather than throwing, so an
 * unrecognized icon name degrades gracefully instead of breaking a layout.
 */
export type IconName = "phone" | "oxygen" | "water" | "power" | "clock" | "warning" | "check" | "cross" | "arrow-up" | "arrow-down" | "person" | "generic";
function iconBox(img: RawImage, x: number, y: number, size: number, color: [number, number, number], thickness: number, draw: (px: (u: number, v: number) => [number, number]) => void) {
  const px = (u: number, v: number): [number, number] => [x + u * size, y + v * size];
  draw(px);
}
export function drawIcon(img: RawImage, name: IconName, x: number, y: number, size: number, color: [number, number, number], thickness = Math.max(2, Math.round(size * 0.06))) {
  const line = (p0: [number, number], p1: [number, number]) => drawLine(img, Math.round(p0[0]), Math.round(p0[1]), Math.round(p1[0]), Math.round(p1[1]), color, thickness, 255);
  const circle = (cx: number, cy: number, r: number) => drawCircleOutline(img, Math.round(cx), Math.round(cy), Math.round(r), color, thickness, 255);
  switch (name) {
    case "phone":
      iconBox(img, x, y, size, color, thickness, (px) => {
        const a = px(0.3, 0.05), b = px(0.7, 0.05), c = px(0.7, 0.95), d = px(0.3, 0.95);
        line(a, b); line(b, c); line(c, d); line(d, a);
        drawRect(img, Math.round(x + size * 0.44), Math.round(y + size * 0.83), Math.round(size * 0.12), Math.round(size * 0.03), color, 255);
      });
      return;
    case "oxygen":
      iconBox(img, x, y, size, color, thickness, (px) => {
        circle(x + size * 0.5, y + size * 0.55, size * 0.32);
        line(px(0.5, 0.02), px(0.5, 0.23));
        line(px(0.38, 0.1), px(0.62, 0.1));
      });
      return;
    case "water":
      iconBox(img, x, y, size, color, thickness, (px) => {
        const pts = arcPointsForIcon(x + size * 0.5, y + size * 0.55, size * 0.32, size * 0.4, -220, 40, 14);
        for (let i = 0; i < pts.length - 1; i++) line(pts[i], pts[i + 1]);
      });
      return;
    case "power":
      iconBox(img, x, y, size, color, thickness, (px) => {
        circle(x + size * 0.5, y + size * 0.58, size * 0.3);
        line(px(0.5, 0.05), px(0.5, 0.45));
      });
      return;
    case "clock":
      iconBox(img, x, y, size, color, thickness, (px) => {
        circle(x + size * 0.5, y + size * 0.5, size * 0.42);
        line(px(0.5, 0.5), px(0.5, 0.22));
        line(px(0.5, 0.5), px(0.72, 0.58));
      });
      return;
    case "warning":
      iconBox(img, x, y, size, color, thickness, (px) => {
        line(px(0.5, 0.05), px(0.05, 0.9)); line(px(0.05, 0.9), px(0.95, 0.9)); line(px(0.95, 0.9), px(0.5, 0.05));
        drawRect(img, Math.round(x + size * 0.47), Math.round(y + size * 0.38), Math.round(size * 0.06), Math.round(size * 0.28), color, 255);
        drawRect(img, Math.round(x + size * 0.47), Math.round(y + size * 0.75), Math.round(size * 0.06), Math.round(size * 0.06), color, 255);
      });
      return;
    case "check":
      iconBox(img, x, y, size, color, thickness, (px) => { line(px(0.08, 0.5), px(0.4, 0.85)); line(px(0.4, 0.85), px(0.95, 0.15)); });
      return;
    case "cross":
      drawXMark(img, Math.round(x + size * 0.5), Math.round(y + size * 0.5), Math.round(size * 0.75), color, thickness);
      return;
    case "arrow-up":
      iconBox(img, x, y, size, color, thickness, (px) => { drawArrow(img, Math.round(x + size * 0.5), Math.round(y + size * 0.92), Math.round(x + size * 0.5), Math.round(y + size * 0.08), color, thickness); });
      return;
    case "arrow-down":
      iconBox(img, x, y, size, color, thickness, (px) => { drawArrow(img, Math.round(x + size * 0.5), Math.round(y + size * 0.08), Math.round(x + size * 0.5), Math.round(y + size * 0.92), color, thickness); });
      return;
    case "person":
      iconBox(img, x, y, size, color, thickness, (px) => {
        circle(x + size * 0.5, y + size * 0.22, size * 0.18);
        line(px(0.5, 0.4), px(0.5, 0.75));
        line(px(0.5, 0.5), px(0.2, 0.7)); line(px(0.5, 0.5), px(0.8, 0.7));
        line(px(0.5, 0.75), px(0.22, 1)); line(px(0.5, 0.75), px(0.78, 1));
      });
      return;
    default:
      circle(x + size * 0.5, y + size * 0.5, size * 0.42);
      return;
  }
}
function arcPointsForIcon(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, steps: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const rad = (t * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return pts;
}

/* ============================ overlaySpec -> composited image ============================ */
export type OverlaySpec = {
  type: "BIG_TEXT" | "LABEL" | "ARROW" | "X_MARK" | "CIRCLE" | "LINE" | "DIVIDER";
  text?: string;
  placement?: "upper_third" | "lower_third" | "center";
  hierarchy?: "primary" | "secondary";
  textStyle?: { casing?: "upper" | "sentence"; weight?: "bold" | "medium"; outline?: boolean; shadow?: boolean; alignment?: "center" | "left" };
};

export function compositeOverlay(base: RawImage, overlay: OverlaySpec): RawImage {
  const img: RawImage = { width: base.width, height: base.height, data: Uint8Array.from(base.data) };
  if (overlay.type === "BIG_TEXT" || overlay.type === "LABEL") {
    const text = overlay.textStyle?.casing === "sentence" ? String(overlay.text ?? "") : String(overlay.text ?? "").toUpperCase();
    const scale = Math.max(2, Math.round(img.width / (overlay.type === "BIG_TEXT" ? 34 : 60)));
    const { width: textWidth, height: textHeight } = measureText(text, scale);
    const x = overlay.textStyle?.alignment === "left" ? Math.round(img.width * 0.06) : Math.round((img.width - textWidth) / 2);
    const y = overlay.placement === "lower_third" ? Math.round(img.height * 0.82 - textHeight) : Math.round(img.height * 0.1);
    drawText(img, text, Math.max(0, x), Math.max(0, y), scale, [255, 255, 255], { outline: overlay.textStyle?.outline !== false, shadow: overlay.textStyle?.shadow !== false });
  }
  return img;
}
