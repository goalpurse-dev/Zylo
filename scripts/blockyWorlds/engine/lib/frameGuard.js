// Blocky Worlds: the free pixel guard (no AI): a rendered frame that is one colour is never shipped.
// Turtle run 1620fc3e: every daytime shot inside the 30 m turtle was a flat beige frame (its fog's far end was
// nearer than its near end), every night one black; the old guard (mean < 3 = a GPU blank) then reused the frame
// before, so line 15 kept line 14's picture and its "Boom" caption.
//   flatShare(rgba)        the share (0-1) of the probe's pixels in its most common colour bucket (16 levels a channel)
//   detailOf(rgba)         the mean luminance step between neighbouring probe pixels (a smooth one-colour gradient: ~0)
//   isFlat(r)              a renderAt result whose 3D frame is (almost) one colour: r.flat > FLAT_LIMIT or r.detail < DETAIL_MIN
//   pickSafe(tries)        the first try that is neither black nor flat, else null
// render.mjs re-renders a flat frame with renderAt(t, { safe: 1 }) (no fog), then { safe: 2 } (no fog + a plain
// camera on the set's centre), remembers the level per shot, and logs every shot it had to save.

export const FLAT_LIMIT = 0.85;
export const BLACK_MEAN = 3;

export function flatShare(px) {
  const n = Math.floor(px.length / 4);
  if (!n) return 0;
  const counts = new Map();
  let best = 0;
  for (let i = 0; i < px.length; i += 4) {
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const c = (counts.get(k) ?? 0) + 1; counts.set(k, c);
    if (c > best) best = c;
  }
  return +(best / n).toFixed(3);
}

/**
 * detailOf(rgba, w = 16): the mean luminance step (0-255) between neighbouring probe pixels. A smooth one-colour
 * gradient (a camera inside a hill: a flat green frame) has almost none; any real scene has several.
 */
export function detailOf(px, w = 16) {
  const n = Math.floor(px.length / 4), h = Math.floor(n / w);
  if (n < 4 || !h) return 0;
  const L = (i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  let sum = 0, k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x + 1 < w) { sum += Math.abs(L(i) - L(i + 1)); k++; }
    if (y + 1 < h) { sum += Math.abs(L(i) - L(i + w)); k++; }
  }
  return +(sum / Math.max(1, k)).toFixed(2);
}
// calibrated on run 1620fc3e (129 review stills, captions in): the beige frames 0.3-4.0, every real scene 6.8 and up;
// the engine probe has no caption (a little less detail): 3
export const DETAIL_MIN = 3;

export const isBlack = (r) => r?.mean != null && r.mean < BLACK_MEAN;
export const isFlat = (r) => (r?.flat != null && r.flat > FLAT_LIMIT) || (r?.detail != null && r.detail < DETAIL_MIN);
export const isBad = (r) => isBlack(r) || isFlat(r);
export function pickSafe(tries) { return tries.find((r) => r && !isBad(r)) ?? null; }
