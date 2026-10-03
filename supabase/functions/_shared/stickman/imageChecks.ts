// stickman/imageChecks.ts — free code checks on every rendered scene image
// (Phase 4c). V2 skips AI QA, but every image must still decode, have the
// requested dimensions, not be blank/near-uniform, and not be a truncated
// tiny file. A failure gets one re-render (renderTiers).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

// Phase 6c-polish: a 64-bit difference hash (9x8 grayscale, left<right per
// row) — near-identical images differ by only a few bits. Used to flag TRUE
// duplicates (not "similar subject nearby", which is a director note).
export async function imageDHash(bytes: Uint8Array): Promise<string> {
  const img = await Image.decode(bytes);
  img.resize(9, 8);
  let bits = "";
  for (let y = 1; y <= 8; y++) {
    const row: number[] = [];
    for (let x = 1; x <= 9; x++) { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x, y)); row.push(0.299 * r + 0.587 * g + 0.114 * b); }
    for (let x = 0; x < 8; x++) bits += row[x] < row[x + 1] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
  return d;
}
// Scenes whose image is near-identical to an EARLIER scene's (the first of a pair is never flagged).
export const DUPLICATE_MAX_BITS = 3;
export function duplicateScenes(hashes: { n: number; hash: string | null | undefined }[], maxBits = DUPLICATE_MAX_BITS): Set<number> {
  const out = new Set<number>();
  const seen: { n: number; hash: string }[] = [];
  for (const h of [...hashes].sort((a, b) => a.n - b.n)) {
    if (!h.hash) continue;
    if (seen.some((s) => hashDistance(s.hash, h.hash!) <= maxBits)) out.add(h.n);
    seen.push({ n: h.n, hash: h.hash });
  }
  return out;
}

export type CodeCheck ={ pass: boolean; reasons: string[]; width?: number; height?: number; lumaStdDev?: number; uniformShare?: number; soft?: boolean; splitAt?: number | null };

// Phase 5b: the share of pixels (192x108 grid) within a small RGB distance of
// the most common color. A frame that is ~all background (5a beat 47: a thin
// line on off-white) passes the std-dev test but shows almost nothing.
export const NEAR_BLANK_SHARE = 0.9;
export function uniformShare(img: Image): number {
  const px: [number, number, number][] = [];
  for (let gy = 0; gy < 108; gy++) for (let gx = 0; gx < 192; gx++) {
    const [r, g, b] = Image.colorToRGBA(img.getPixelAt(1 + Math.floor((gx * (img.width - 2)) / 192), 1 + Math.floor((gy * (img.height - 2)) / 108)));
    px.push([r, g, b]);
  }
  const counts = new Map<number, number>();
  for (const [r, g, b] of px) { const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const [mr, mg, mb] = [((mode >> 8) & 15) * 16 + 8, ((mode >> 4) & 15) * 16 + 8, (mode & 15) * 16 + 8];
  const near = px.filter(([r, g, b]) => Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb) <= 36).length;
  return Number((near / px.length).toFixed(3));
}

// A split frame: one thin dark vertical line running (almost) the full height in the
// middle 30-70% of the width, with lighter pixels right beside it (2f1b7e40 beat 121).
export function splitDivider(img: Image): number | null {
  const rows = 120;
  const lumAt = (x: number, y: number) => { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(Math.max(1, Math.min(img.width, x)), Math.max(1, Math.min(img.height, y)))); return 0.299 * r + 0.587 * g + 0.114 * b; };
  const step = Math.max(1, Math.floor(img.width / 400));
  for (let x = Math.floor(img.width * 0.3); x <= Math.floor(img.width * 0.7); x += step) {
    let line = 0;
    for (let i = 0; i < rows; i++) {
      const y = 1 + Math.floor((i * (img.height - 2)) / rows);
      const c = lumAt(x, y);
      if (c < 80 && lumAt(x - 6, y) - c > 40 && lumAt(x + 6, y) - c > 40) line++;
    }
    if (line / rows >= 0.85) return Number((x / img.width).toFixed(3));
  }
  return null;
}

export async function codeCheckImage(bytes: Uint8Array, expected: { width: number; height: number }, opts: { minBytes?: number; minStdDev?: number; maxUniformShare?: number } = {}): Promise<CodeCheck> {
  const reasons: string[] = [];
  if (bytes.length < (opts.minBytes ?? 5_000)) reasons.push(`tiny file (${bytes.length} bytes)`);
  let img: Image;
  try {
    img = await Image.decode(bytes);
  } catch (e) {
    return { pass: false, reasons: [...reasons, `does not decode: ${String(e).slice(0, 80)}`] };
  }
  if (img.width !== expected.width || img.height !== expected.height) reasons.push(`dimensions ${img.width}x${img.height}, expected ${expected.width}x${expected.height}`);
  // Blank / near-uniform: luminance spread over a 64x36 sample grid.
  const lum: number[] = [];
  for (let gy = 0; gy < 36; gy++) for (let gx = 0; gx < 64; gx++) {
    const [r, g, b] = Image.colorToRGBA(img.getPixelAt(1 + Math.floor((gx * (img.width - 1)) / 64), 1 + Math.floor((gy * (img.height - 1)) / 36)));
    lum.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  const sd = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length);
  if (sd < (opts.minStdDev ?? 4)) reasons.push(`blank or near-uniform (luma std-dev ${sd.toFixed(1)})`);
  // Near-blank is SOFT: one automatic re-render, then the better of the two is
  // kept with a warning (a sparse graphic can be legitimate) — never a failed beat.
  const share = uniformShare(img);
  const hard = reasons.length > 0;
  if (share > (opts.maxUniformShare ?? NEAR_BLANK_SHARE)) reasons.push(`near_blank (${Math.round(share * 100)}% one color)`);
  return { pass: reasons.length === 0, reasons, width: img.width, height: img.height, lumaStdDev: Number(sd.toFixed(1)), uniformShare: share, soft: !hard && reasons.length > 0, splitAt: splitDivider(img) };
}
